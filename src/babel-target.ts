import { BabelLoaderTransformOptions, BabelPresetOptions } from 'babel-loader'
import { ModuleGraph, ChunkGraph } from 'webpack'

import Entrypoint = require('webpack/lib/Entrypoint')
import Chunk = require('webpack/lib/Chunk')
import ChunkGroup = require('webpack/lib/ChunkGroup')
import Module = require('webpack/lib/Module')

import { BabelLoaderCacheDirectoryOption } from './babel.multi.target.options'
import { BabelTargetOptions } from './babel.target.options'
import { BabelTargetEntryDependency } from './babel.target.entry.dependency'
import { BrowserProfileName, StandardBrowserProfileName } from './browser.profile.name'
import { DEV_SERVER_CLIENT } from './constants'
import {
  DEFAULT_BABEL_PRESET_OPTIONS,
  DEFAULT_BROWSERS,
  DEFAULT_TARGET_INFO,
} from './defaults'

export type BabelTargetSource = Module | Chunk | ChunkGroup

/**
 * Represents a targeted transpilation output.
 *
 * Includes properties from {@link BabelTargetOptions}, but all properties are required.
 */
export type BabelTargetInfo = { [TOption in keyof BabelTargetOptions]: BabelTargetOptions[TOption] } & {
  readonly profileName: BrowserProfileName
  readonly options: BabelLoaderTransformOptions
}

export class BabelTarget implements BabelTargetInfo {

  public readonly profileName: BrowserProfileName
  public readonly key: string
  public readonly options: BabelLoaderTransformOptions
  public readonly tagAssetsWithKey: boolean
  public readonly browsers: string[]
  public readonly esModule: boolean
  public readonly noModule: boolean
  public readonly additionalModules: string[]

  constructor(info: BabelTargetInfo) {
    Object.assign(this, info)
  }

  public getTargetedAssetName(name: string): string {
    // sometimes a asset will be targeted twice
    if (this.tagAssetsWithKey && !name.endsWith(`.${this.key}`)) {
      return `${name}.${this.key}`
    }
    return name
  }

  public getTargetedRequest(request: string): string {
    const tag = `babel-target=${this.key}`
    if (request.includes(tag)) {
      return request
    }
    if (request.includes('babel-target=')) {
      throw new Error('The request was already tagged with a different target')
    }

    // need to make separate "requests" for the dev server client, but using the query breaks it, so use a hash instead
    const joiner = request.startsWith(DEV_SERVER_CLIENT) ?
      '#' :
      request.includes('?') ? '&' : '?'
    return request + joiner + tag
  }

  public static isTaggedRequest(request: string): boolean {
    return /[?&]babel-target=\w+/.test(request)
  }

  public static getTargetFromTag(request: string, targets: BabelTarget[]): BabelTarget {
    if (!BabelTarget.isTaggedRequest(request)) {
      return undefined
    }
    const key = request.match(/\bbabel-target=(\w+)/)[1]
    return targets.find(target => target.key === key)
  }

  public static getTargetFromModule(module: Module, moduleGraph: ModuleGraph): BabelTarget {
    if (module.options?.babelTarget) {
      return module.options.babelTarget
    }

    // https://github.com/webpack/webpack/pull/7826/commits/381e2db2009b0020de358c23c702d074806980a5
    const reasons = Array.from(moduleGraph.getIncomingConnections(module))

    for (const reason of reasons) {
      if (reason.dependency && reason.dependency instanceof BabelTargetEntryDependency) {
        return reason.dependency.babelTarget
      }
      if (reason.module && reason.module !== module) {
        const target = BabelTarget.getTargetFromModule(reason.module, moduleGraph)
        if (target) {
          return target
        }
      }
    }

    return undefined

  }

  public static getTargetFromEntrypoint(entrypoint: Entrypoint, moduleGraph: ModuleGraph, chunkGraph: ChunkGraph): BabelTarget {
    const runtime = entrypoint.getRuntimeChunk()
    const modules = Array.from(chunkGraph.getChunkEntryModulesIterable(runtime))
    if (modules.length === 0) {
      return undefined
    }
    return BabelTarget.getTargetFromModule(modules[0], moduleGraph)
  }

  // eslint-disable-next-line
  public static getTargetFromGroup(group: ChunkGroup): BabelTarget {
    return undefined
  }

  public static getTargetFromChunk(chunk: Chunk, moduleGraph: ModuleGraph, chunkGraph: ChunkGraph): BabelTarget {
    const modules = Array.from(chunkGraph.getChunkEntryModulesIterable(chunk))
    if (modules.length === 0) {
      return undefined
    }
    return BabelTarget.getTargetFromModule(modules[0], moduleGraph)
  }

  public static findTarget(source: BabelTargetSource, moduleGraph: ModuleGraph, chunkGraph: ChunkGraph): BabelTarget {

    if (source instanceof Module) {
      return BabelTarget.getTargetFromModule(source, moduleGraph)
    }
    if (source instanceof Entrypoint) {
      return BabelTarget.getTargetFromEntrypoint(source, moduleGraph, chunkGraph)
    }
    if (source instanceof ChunkGroup) {
      return BabelTarget.getTargetFromGroup(source)
    }
    if (source instanceof Chunk) {
      return BabelTarget.getTargetFromChunk(source, moduleGraph, chunkGraph)
    }

    return undefined
  }
}

export class BabelTargetFactory {
  constructor(private presetOptions: BabelPresetOptions, private plugins: string[], private presets: string[]) {}

  public createBabelTarget(
    profileName: BrowserProfileName,
    options: BabelTargetOptions,
    loaderOptions: { cacheDirectory?: BabelLoaderCacheDirectoryOption },
  ): BabelTarget {
    const browsers = options.browsers || DEFAULT_BROWSERS[profileName]
    const key = options.key || profileName

    const info: BabelTargetInfo = Object.assign(
      {},
      DEFAULT_TARGET_INFO[profileName as StandardBrowserProfileName],
      options,
      {
        profileName,
        browsers,
        key,
        options: this.createTransformOptions(key, browsers, loaderOptions),
      },
    )

    return new BabelTarget(info)
  }

  public createTransformOptions(key: string, browsers: string[], loaderOptions: { cacheDirectory?: BabelLoaderCacheDirectoryOption }): BabelLoaderTransformOptions {

    const mergedPresetOptions: BabelPresetOptions = {
      ...DEFAULT_BABEL_PRESET_OPTIONS,
      ...this.presetOptions,
      targets: {
        browsers,
      },
      modules: false,
    }

    const cacheDirectory = this.getCacheDirectory(key, loaderOptions.cacheDirectory)

    return {
      presets: [
        ['@babel/preset-env', mergedPresetOptions],
        ...this.presets,
      ],
      plugins: [
        // https://github.com/babel/babel/issues/10271#issuecomment-528379505
        ...this.plugins,
      ],
      cacheDirectory,
    }
  }

  private getCacheDirectory(key: string, option: BabelLoaderCacheDirectoryOption): string {
    if (option === false) {
      return undefined
    }
    if (option === true || typeof option === 'undefined') {
      return `node_modules/.cache/babel-loader/${key}`
    }
    if (typeof option === 'function') {
      return option(key)
    }

    return option
  }
}
