import { Chunk, Compilation, Module, Compiler, Plugin } from 'webpack'
import { STAGE_BASIC } from 'webpack/lib/OptimizationStages'

import { BabelTarget } from './babel-target'
import { BabelTargetEntryDependency } from './babel.target.entry.dependency'
import { PLUGIN_NAME } from './plugin.name'

// While CSS modules aren't duplicated by targeting the way code modules are, since they are referenced by targeted
// modules, they end up getting duplicated. Without intervention, we'd end up with one CSS file per target, which each
// file containing the exact same content. To fix this, we remove CSS modules from the targeted and move them into their
// own (non-targeted) chunks.

/**
 * @internalapi
 */
export class NormalizeCssChunksPlugin implements Plugin {

  constructor(private targets: BabelTarget[]) {}

  public apply(compiler: Compiler): void {

    compiler.hooks.compilation.tap(PLUGIN_NAME, (compilation: Compilation) => {

      if (compilation.name) {
        return
      }

      compilation.hooks.optimizeChunks.tap({
        name: PLUGIN_NAME,
        stage: STAGE_BASIC,
      }, data => this.extractCssChunks(compilation, data))
      compilation.hooks.processAssets.tap({
        name: PLUGIN_NAME,
        stage: Compilation.PROCESS_ASSETS_STAGE_OPTIMIZE_COUNT,
      }, () => this.cleanCssChunks(compilation))
    })
  }

  public extractCssChunks(compilation: Compilation, chunks: Iterable<Chunk>): void {
    const { chunkGraph } = compilation
    const cssModules: { [name: string]: Set<Module> } = {}
    let hasUntaggedTarget = false

    // first, find the CSS modules and remove them from their targeted chunks
    Array.from(chunks).forEach(chunk => {

      // if `isGeneratedForBabelTargets` is present, we've already processed this chunk
      // the `optimizeChunksBasic` hook can get called more than once
      if ((chunk as any).isGeneratedForBabelTargets) {
        return
      }

      const target = BabelTarget.findTarget(chunk, compilation.moduleGraph, chunkGraph)
      if (!target) {
        // can probably skip these? maybe?
      }

      // don't mess with a chunk if it's not tagged with the target key
      if (target && !target.tagAssetsWithKey) {
        hasUntaggedTarget = true
        return
      }

      // get the original (untagged) name of the entry module so we can correctly
      // attribute any contained CSS modules to the entry
      const name = this.findEntryName(chunk, compilation)

      // track the original entry names to use later
      if (!cssModules[name]) {
        cssModules[name] = new Set<Module>()
      }

      for (const module of chunkGraph.getChunkModulesIterable(chunk)) {
        if (module.constructor.name !== 'CssModule') {
          continue
        }

        chunkGraph.disconnectChunkAndModule(chunk, module)

        // don't duplicate modules - we should only have one per imported/required CSS/SCSS/etc file
        cssModules[name].add(module)
      }
    })

    if (hasUntaggedTarget) {
      // untagged targets keep their CSS modules, so we don't need to create a fake one below
      return
    }

    // create chunks for the extracted modules
    Object.keys(cssModules).forEach(name => {
      const modules = cssModules[name]
      const cssGroup = compilation.addChunkInGroup(name, undefined, undefined, undefined)
      const cssChunk = cssGroup.chunks[cssGroup.chunks.length - 1]

      // HACK ALERT! fool HtmlWebpackPlugin into thinking this is an actual Entrypoint chunk so it
      // will include its assets by default (assuming the user hasn't filtered the name of the chunk)
      // somewhat relevant: BabelMultiTargetHtmlUpdater.mapChunkNames
      cssGroup.isInitial = () => true
      cssChunk.hasRuntime = () => false;
      (cssChunk as any).isInitial = () => true;
      (cssChunk as any).isGeneratedForBabelTargets = true

      modules.forEach(module => cssChunk.addModule(module))

    })
  }

  private findEntryName(chunk: Chunk, compilation: Compilation): string {
    const entry = this.findEntryModule(chunk, compilation)
    if (entry) {
      const reasons = Array.from(compilation.moduleGraph.getIncomingConnections(entry))
      return reasons[0].dependency.originalName
    }

    return undefined
    // throw new Error(`Could not determine entry module for chunk ${chunk.name}`)
  }

  private findEntryModule(chunk: Chunk, compilation: Compilation): Module {
    const entry = Array.from(compilation.chunkGraph.getChunkEntryModulesIterable(chunk))[0]
    if (entry) {
      return entry
    }

    // sure, fine, make me work for it...
    for (const group of chunk.groupsIterable) {
      for (const groupParent of group.parentsIterable) {
        for (const chunk of groupParent.chunks) {
          const entries = Array.from(compilation.chunkGraph.getChunkEntryModulesIterable(chunk))
          if (entries.length !== 0) {
            return entries[0]
          }
        }
      }
    }

    // sure, fine, make me REALLY work for it...
    for (const module of compilation.chunkGraph.getChunkModulesIterable(chunk)) {
      const entry = this.getEntryFromModule(module, compilation)
      if (entry) {
        return entry
      }
    }
  }

  private getEntryFromModule(module: Module, compilation: Compilation): any {
    for (const reason of compilation.moduleGraph.getIncomingConnections(module)) {
      const babelTarget = (reason.dependency as BabelTargetEntryDependency).babelTarget 
        || BabelTarget.getTargetFromTag(reason.dependency.request, this.targets)
      if (babelTarget) {
        return module
      }

      // https://github.com/webpack/webpack/pull/7861
      const parent = compilation.moduleGraph.getParentModule(reason.dependency)
      const depEntry = this.getEntryFromModule(parent || reason.dependency.module, compilation)
      if (depEntry) {
        return depEntry
      }
    }
  }

  // The extract process in extractCssChunks causes a small JavaScript loader file to get generated. Since the file
  // gets loaded by HtmlWebpackPlugin, we don't want this file cluttering up the assets, so it gets removed.
  public cleanCssChunks(compilation: Compilation): void {
    compilation.chunks.forEach(chunk => {

      if (!(chunk as any).isGeneratedForBabelTargets) {
        return
      }

      chunk.files = new Set([...chunk.files].reduce((result, file) => {
        if (file.endsWith('.js')) {
          delete compilation.assets[file]
        } else {
          result.push(file)
        }
        return result
      }, []))
    })
  }

}
