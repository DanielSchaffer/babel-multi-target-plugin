import * as path from 'path'

import { Compilation, ContextModuleFactory, Dependency, NormalModuleFactory, Compiler, Externals, Loader, Plugin, ModuleGraph, ChunkGraph, Module } from 'webpack'
import ImportContextDependency = require('webpack/lib/dependencies/ImportContextDependency')
import ProvidedDependency = require('webpack/lib/dependencies/ProvidedDependency')
import ContextElementDependency = require('webpack/lib/dependencies/ContextElementDependency')
import AsyncDependenciesBlock = require('webpack/lib/AsyncDependenciesBlock')

import { BabelTarget }                       from './babel-target'
import { BlindTargetingError }               from './blind.targeting.error'
import { KNOWN_EXCLUDED, STANDARD_EXCLUDED } from './excluded.packages'
import { BabelMultiTargetLoader }            from './babel.multi.target.loader'
import { PLUGIN_NAME }                       from './plugin.name'
import { BabelTargetEntryDependency }        from './babel.target.entry.dependency'

const NOT_TARGETED = [
  /\.s?css$/,
]

// So basically module create data has been moved to field createData
interface ResolveContext {
  contextInfo: any,
  resolveOptions: any,
  context: any,
  request: string,
  dependencies: Dependency[],
  fileDependencies: Dependency[],
  missingDependencies: Dependency[],
  contextDependencies: Dependency[],
  chunkName?: string,
  createData?: {
    request: string,
    userRequest: any,
    rawRequest: any,
    loaders: any[],
    resource: any,
    matchResource: any,
    resourceResolveData: any,
    settings: any,
    type: any,
    parser: any,
    generator: any,
    resolveOptions: any
  },
  cacheable: any
}

interface ContextModuleFactoryData {
  context: string,
  dependencies: Dependency[],
  resolveOptions: any,
  fileDependencies: Set<String>
  missingDependencies: Set<String>,
  contextDependencies: Set<String>,
  request: string,
  recursive: true,
  regExp: RegExp,
  mode: 'lazy' | 'sync',
  chunkName: string,
  category: string,
}

// picks up where BabelTargetEntryPlugin leaves off and takes care of targeting all dependent modules
// includes special case handling for Angular lazy routes

/**
 * @internalapi
 */
export class TargetingPlugin implements Plugin {

  private babelLoaderPath = require.resolve('babel-loader')
  private babelLoaders: { [key: string]: any } = {}
  private remainingTargets: { [issuer: string]: { [file: string]: BabelTarget[] } } = {}
  private readonly doNotTarget: RegExp[]

  constructor(private targets: BabelTarget[], private exclude: RegExp[], doNotTarget: RegExp[], private readonly externals: Externals) {
    this.doNotTarget = NOT_TARGETED.concat(doNotTarget || [])
  }

  public apply(compiler: Compiler): void {

    // make sure our taps come after other plugins (particularly AngularCompilerPlugin)
    compiler.hooks.afterPlugins.tap(PLUGIN_NAME, () => {

      compiler.hooks.contextModuleFactory.tap(PLUGIN_NAME, (cmf: ContextModuleFactory) => {
        cmf.hooks.beforeResolve.tapPromise(PLUGIN_NAME, this.targetLazyModules.bind(this))
        cmf.hooks.afterResolve.tapPromise(PLUGIN_NAME, this.wrapResolveDependencies.bind(this))
        // there won't be any loaders for lazyModule
        // cmf.hooks.afterResolve.tapPromise(PLUGIN_NAME, this.afterResolve.bind(this))
      })

      // Yes it's ugly but it works because normalModuleFactory always happens before compilation
      // and for multi compilation we need it
      let factory: NormalModuleFactory

      compiler.hooks.normalModuleFactory.tap(PLUGIN_NAME, (nmf: NormalModuleFactory) => {
        factory = nmf
        nmf.hooks.module.tap(PLUGIN_NAME, this.targetModule.bind(this))
      })

      compiler.hooks.compilation.tap(PLUGIN_NAME, (compilation: Compilation) => {
        factory.hooks.afterResolve.tapPromise(PLUGIN_NAME, data => this.afterResolve(data as any, compilation.chunkGraph, compilation.moduleGraph))

        if (compilation.name) {
          return
        }

        const ogAddModule = compilation.addModule.bind(compilation)
        compilation.addModule = (module, cacheGroup) => {
          this.targetModule(module)
          return ogAddModule(module, cacheGroup)
        }

      })

      compiler.hooks.watchRun.tapPromise(PLUGIN_NAME, async () => {
        this.remainingTargets = {}
      })

    })
  }

  // HACK ALERT!
  // Sometimes, there just isn't a way to trace a request back to a targeted module or entry. This happens with
  // Angular's lazy loaded routes and ES6 dynamic imports. With dynamic imports, we'll get a pair of requests for each
  // time a module is dynamically referenced. The best we can do is just fake it - create an array for each request
  // that has a copy of the targets array, and assign a the first remaining target to each request
  private getBlindTarget(issuer: string, key: string): BabelTarget {
    if (!this.remainingTargets) {
      this.remainingTargets = {}
    }
    if (!this.remainingTargets[issuer]) {
      this.remainingTargets[issuer] = {}
    }

    if (!this.remainingTargets[issuer][key]) {
      this.remainingTargets[issuer][key] = this.targets.slice(0)
    }

    if (!this.remainingTargets[issuer][key].length) {
      throw new BlindTargetingError(key)
    }

    return this.remainingTargets[issuer][key].shift()
  }

  public async targetLazyModules(resolveContext: ContextModuleFactoryData): Promise<any> {
    // handle lazy modules from ES6 dynamic imports or Angular's AngularCompilerPlugin
    if (resolveContext.mode === 'lazy') {

      // FIXME: Mixing Harmony and CommonJs requires of @angular/core breaks lazy loading!
      // if this is happening, it's likely that a dependency has not correctly provided a true ES6 module and is
      // instead providing CommonJs module.
      const babelTarget = BabelTarget.getTargetFromTag(resolveContext.request, this.targets)
      // there is no resource in beforeResolve hook

      resolveContext.request = babelTarget.getTargetedRequest(resolveContext.request)

      this.targetDependencies(babelTarget, resolveContext.dependencies)

      return resolveContext
    }
  }

  public async wrapResolveDependencies(resolveContext: ContextModuleFactoryData & {
    addon: string,
    resource: string,
    resolveDependencies: Function,
  }): Promise<void> {
    if (resolveContext.mode === 'lazy') {

      const babelTarget = BabelTarget.getTargetFromTag(resolveContext.request, this.targets)
      if (resolveContext.chunkName && babelTarget.tagAssetsWithKey) {
        resolveContext.chunkName = babelTarget.getTargetedAssetName(resolveContext.chunkName)
      }

      // this needs to happen in addition to request targeting in targetLazyModules, otherwise it breaks Angular routing
      // and makes all sorts of weird chunks
      resolveContext.resource = babelTarget.getTargetedRequest(resolveContext.resource)

      // piggy-back on the existing resolveDependencies function to target the dependencies.
      // for angular lazy routes, this wraps the resolveDependencies function defined in the compiler plugin
      const ogResolveDependencies = resolveContext.resolveDependencies
      resolveContext.resolveDependencies = (_fs: any, _resource: any, cb: any) => {
        ogResolveDependencies(_fs, _resource, (err: Error, dependencies: Dependency[]) => {
          this.targetDependencies(babelTarget, dependencies)
          cb(null, dependencies)
        })
      }

    }
  }

  public targetModule(module: Module): Module {
    if (module.options && module.options.babelTarget) {
      // already targeted, no need to do it again
      return
    }

    if (!this.isTargetedRequest(module.request)) {
      return
    }

    let babelTarget: BabelTarget
    if (module.options && module.options.mode === 'lazy') {
      babelTarget = BabelTarget.getTargetFromTag(module.options.request, this.targets)
      module.options.babelTarget = babelTarget
    } else {
      babelTarget = BabelTarget.getTargetFromTag(module.request, this.targets)
      if (!babelTarget) {
        return
      }

      module.request = babelTarget.getTargetedRequest(module.request)
      if (!module.options) {
        module.options = {}
      }
      module.options.babelTarget = babelTarget
    }

    // wrap the module's addDependency function so that any dependencies added after this point are automatically
    // targeted
    const ogAddDependency = module.addDependency.bind(module)
    module.addDependency = dep => {
      this.targetDependency(dep, babelTarget)
      return ogAddDependency(dep)
    }
    const ogAddBlock = module.addBlock.bind(module)
    module.addBlock = block => {
      // if a dynamic import has specified the [resource] tag in its chunk name, overwrite the computed
      // name with the request path, minus the extension
      if (module.options.mode === 'lazy' && module.options.chunkName && module.options.chunkName.includes('[resource]')) {
        const resource = block.request
          .replace(/\.\w+$/, '') // remove the extension
          .replace(/\W+/g, '-') // replace any non-alphanumeric characters with -
          .replace(/^-/, '') // trim leading -
          .replace(/-$/, '') // trim following -
        block.chunkName = module.options.chunkName.replace('[resource]', resource)
      }
      this.targetDependency(block, babelTarget)
      return ogAddBlock(block)
    }

    return module
  }

  private targetDependency(dep: { request?: string }, babelTarget: BabelTarget): void {
    // ProvidePlugin changed generated denpendency to ProvidedDependency
    // it does have a request but we want to do absolutely nothing about it
    if (dep instanceof ProvidedDependency) {
      return
    }
    if (dep instanceof ImportContextDependency && dep.options.mode === 'lazy') {
      return this.targetDependency(dep.options, babelTarget)
    }
    if (!dep.request || !this.isTargetedRequest(dep.request)) {
      return
    }

    // update the dependency requests to be targeted
    // only tag dep.request, not tag dep.userRequest, it breaks lazy loading
    // userRequest basically maps the user-friendly name to the actual request
    // so if the code does require('some-lazy-route/lazy.module.ngfactory.js') <-- userRequest
    // it can be mapped to 'some-lazy-route/lazy.module.ngfactory.js?babelTarget=modern <-- request
    if (dep.request) {
      dep.request = babelTarget.getTargetedRequest(dep.request)
    }
  }

  public targetDependencies(babelTarget: BabelTarget, dependencies: Dependency[]): void {
    dependencies.forEach(dep => this.targetDependency(dep, babelTarget))
  }

  public async afterResolve(resolveContext: ResolveContext, chunkGraph: ChunkGraph, moduleGraph: ModuleGraph): Promise<void> {
    const loaders: BabelMultiTargetLoader[] = resolveContext.createData.loaders
      .filter(loaderInfo => loaderInfo.options && loaderInfo.options.isBabelMultiTargetLoader)

    if (loaders.length !== 0) {
      this.checkResolveTarget(resolveContext, moduleGraph, chunkGraph)
      this.replaceLoaders(resolveContext, loaders, moduleGraph, chunkGraph)
    }
  }

  public checkResolveTarget(resolveContext: ResolveContext, moduleGraph: ModuleGraph, chunkGraph: ChunkGraph): void {
    const { createData, dependencies } = resolveContext
    if (!this.isTargetedRequest(createData.request) || !this.isTranspiledRequest(resolveContext)) {
      return
    }

    let babelTarget = BabelTarget.getTargetFromTag(createData.request, this.targets)
    if (babelTarget) {
      // save babelTarget for quick lookup
      // makes it easier to get babelTarget for commonjs modules.
      resolveContext.contextInfo = { babelTarget }
      this.targetChunkNames(resolveContext, moduleGraph, babelTarget)
      return
    }

    babelTarget = this.getTargetFromContext(resolveContext, moduleGraph, chunkGraph)
    if (babelTarget) {
      // this is probably a dynamic import, in which case the dependencies need to get targeted
      dependencies.forEach((dep: Dependency) => this.targetDependency(dep, babelTarget))
    } else {
      babelTarget = this.getBlindTarget(resolveContext.contextInfo.issuer, createData.request)
    }

    this.targetChunkNames(resolveContext, moduleGraph, babelTarget)

    createData.request = babelTarget.getTargetedRequest(createData.request)
    if (createData.resource) {
      createData.resource = babelTarget.getTargetedRequest(resolveContext.createData.resource)
    }
  }

  private targetChunkNames(resolveContext: ResolveContext, moduleGraph: ModuleGraph, babelTarget: BabelTarget): void {
    resolveContext.dependencies.forEach(dep => {
      // https://github.com/webpack/webpack/commit/f987d82979c2a8a9535e26f96611719ef68d1b7a
      const block = moduleGraph.getParentBlock(dep)
      if (!(block instanceof AsyncDependenciesBlock) || !block.chunkName) {
        return
      }
      block.chunkName = babelTarget.getTargetedAssetName(block.chunkName)
    })
  }

  public replaceLoaders(resolveContext: ResolveContext, loaders: BabelMultiTargetLoader[], moduleGraph: ModuleGraph, chunkGraph: ChunkGraph): void {
    const babelTarget: BabelTarget = this.isTranspiledRequest(resolveContext) &&
      (BabelTarget.getTargetFromTag(resolveContext.createData.rawRequest, this.targets) ||
      (resolveContext.createData.resourceResolveData && this.getTargetFromContext(resolveContext, moduleGraph, chunkGraph)))

    loaders.forEach((loader: BabelMultiTargetLoader) => {
      const index = resolveContext.createData.loaders.indexOf(loader)

      if (!babelTarget) {
        resolveContext.createData.loaders.splice(index, 1)
        return
      }

      const effectiveLoader = {
        loader: loader.loader,
        options: loader.options.loaderOptions,
        ident: (loader as any).ident,
      }
      if (loader.loader === this.babelLoaderPath) {
        resolveContext.createData.loaders.splice(index, 1, this.getTargetedBabelLoader(effectiveLoader, babelTarget))
      } else {
        resolveContext.createData.loaders.splice(index, 1, effectiveLoader)
      }
    })

  }

  public isTargetedRequest(request: string): boolean {
    if (this.doNotTarget?.find(entry => entry.test(request))) {
      return false
    }

    return !this.isExternalRequest(request, this.externals)
  }

  private isExternalRequest(request: string, externals: Externals): boolean {
    if (!externals) {
      return false
    }

    if (Array.isArray(externals)) {
      for (const ext of externals) {
        if (this.isExternalRequest(request, ext)) {
          return true
        }
      }
      return false
    }

    if (typeof (externals) === 'function') {
      throw new Error('Using an ExternalsFunctionElement is not supported')
    }

    if (typeof (externals) === 'string') {
      return request === externals
    }

    if (externals instanceof RegExp) {
      return externals.test(request)
    }

    if (typeof (externals) === 'object') {
      return this.isExternalRequest(request, Object.keys(externals))
    }

    return false
  }

  public isTranspiledRequest(resolveContext: ResolveContext): boolean {
    const { resource, resourceResolveData } = resolveContext.createData

    // ignore files/libs that are known to not need transpiling
    if (STANDARD_EXCLUDED.find(pattern => pattern.test(resource))) {
      // TODO: report this somewhere?
      // console.info('not transpiling request from STANDARD_EXCLUDED', resolveContext.resource)
      return false
    }
    if (KNOWN_EXCLUDED.find(pattern => pattern.test(resource))) {
      // TODO: report this somewhere?
      // console.info('not transpiling request from KNOWN_EXCLUDED', resolveContext.resource)
      return false
    }

    if (this.exclude.find(pattern => pattern.test(resource))) {
      // TODO: report this somewhere?
      // console.info('not transpiling request from excluded patterns', resolveContext.resource)
      return false
    }

    if (resolveContext.resolveOptions.mode === 'lazy') {
      // ES6 dynamic import entry
      return true
    }

    if (resolveContext.resolveOptions.mode === 'sync' && !resourceResolveData) {
      // Webpack require.context modules
      return true
    }

    const pkgRoot = resourceResolveData.descriptionFileRoot || {}
    const pkg = resourceResolveData.descriptionFileData || {}

    // coming from a package's "main" or "browser" field? don't need to transpile
    if (pkg.main && resource === path.resolve(pkgRoot, pkg.main)) {
      // TODO: report this somewhere?
      // console.info('not transpiling request using package "main"', resolveContext.resource)
      return false
    }
    if (pkg.browser) {
      // TODO: report this somewhere?
      // console.info('not transpiling request using package "browser"', resolveContext.resource)
      if (typeof (pkg.browser) === 'string' && resource === path.resolve(pkgRoot, pkg.browser)) {
        return false
      }
      if (Array.isArray(pkg.browser) &&
        pkg.browser.find((entry: string) => resource === path.resolve(pkgRoot, entry))
      ) {
        return false
      }
      if (typeof (pkg.browser === 'object') &&
        Object.values(pkg.browser).find((entry: string | boolean) => {
          if (typeof entry === 'string') {
            return resource === path.resolve(pkgRoot, entry)
          }
          // "browser" object values can be `false` when packages want the browser to ignore a module
          // see https://github.com/defunctzombie/package-browser-field-spec#ignore-a-module
          return false
        })
      ) {
        return false
      }

    }

    return true
  }

  public getTargetFromContext(resolveData: ResolveContext, moduleGraph: ModuleGraph, chunkGraph: ChunkGraph): BabelTarget {
    if (resolveData.contextInfo && resolveData.contextInfo.babelTarget) {
      return resolveData.contextInfo.babelTarget
    }
    if (resolveData.createData.resourceResolveData?.context?.babelTarget
    ) {
      return resolveData.createData.resourceResolveData.context.babelTarget
    }
    const { dependencies } = resolveData
    for (const dep of dependencies) {
      if (dep instanceof BabelTargetEntryDependency) {
        return dep.babelTarget
      }
      // https://github.com/webpack/webpack/pull/7861
      const parent = moduleGraph.getParentModule(dep)
      if (parent) {
        const target = BabelTarget.findTarget(parent, moduleGraph, chunkGraph)
        if (target) {
          return target
        }
      }
    }
  }

  private getTargetedBabelLoader(loader: any, babelTarget: BabelTarget): Loader {
    if (!this.babelLoaders[babelTarget.key]) {
      this.babelLoaders[babelTarget.key] = Object.assign({}, loader, {
        loader: this.babelLoaderPath,
        options: babelTarget.options,
      })
    }
    return this.babelLoaders[babelTarget.key]
  }

  public static loader(loader?: Loader): Loader {
    return new BabelMultiTargetLoader(loader)
  }

}
