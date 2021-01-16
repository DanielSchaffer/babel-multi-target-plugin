import { getHooks, HtmlTagObject } from 'html-webpack-plugin'
import { Chunk, ChunkGroup, Compilation, Compiler, Plugin } from 'webpack'

import { BabelTarget } from './babel-target'
import { PLUGIN_NAME } from './plugin.name'
import { TargetedChunkMap } from './targeted.chunk'

// Works with HtmlWebpackPlugin to make sure the targeted assets are referenced correctly
// Tags for assets whose target has `esModule` set are updated with the `"type"="module"` attribute
// Tags for assets whose target has `noModule` set are updated with the `"nomodule"` attribute

/**
 * @internalapi
 */
export class BabelMultiTargetHtmlUpdater implements Plugin {

  constructor(private targets: BabelTarget[]) {}

  public updateScriptTags(chunkMap: TargetedChunkMap, tags: HtmlTagObject[]): void {
    tags
      .forEach((tag: HtmlTagObject) => {
        if (tag.tagName !== 'script') {
          return
        }
        const targetedChunks = chunkMap.get(tag.attributes.src as string)
        // chunks that are added outside of an entry point (e.g. by HtmlWebpackIncludeAssetsPlugin) will not be targeted
        if (!targetedChunks) {
          return
        }

        const targets = targetedChunks.map(targetedChunk => targetedChunk.target)
        if (!targets || !targets.length) {
          return
        }

        // if this file is referenced by multiple targets, don't change the tag
        // this can happen with vendor chunks that don't get transpiled
        if (!targets.every((target, index) => index === 0 || target === targets[index - 1])) {
          return
        }

        const target = targets[0]
        if (target === undefined) {
          return
        }

        if (target.esModule) {
          tag.attributes.type = 'module'
          return
        }

        if (target.noModule) {
          tag.attributes.nomodule = true
        }
      })
  }

  // expands any provided chunk names (for options.chunks or options.excludeChunks) to include the targeted versions
  // of each chunk. also includes the original chunk name if all targets are tagged so that CSS assets are included
  // or excluded as expected
  // also relevant: NormalizeCssChunks.extractCssChunks
  private mapChunkNames(chunkNames: string[]): string[] {
    const allTaggedWithKey = this.targets.every(target => target.tagAssetsWithKey)
    return chunkNames.reduce((result: string[], name: string) => {
      if (allTaggedWithKey) {
        result.push(name)
      }
      this.targets.forEach(target => {
        result.push(target.getTargetedAssetName(name))
      })


      return result
    }, [] as string[])
  }

  public apply(compiler: Compiler): void {

    compiler.hooks.afterPlugins.tap(PLUGIN_NAME, () => {
      const htmlWebpackPlugin = compiler.options.plugins
      // instanceof can act wonky since we don't actually keep our own dependency on html-webpack-plugin
      // should we?
        .find(plugin => plugin.constructor.name === 'HtmlWebpackPlugin') as any

      if (!htmlWebpackPlugin) {
        return
      }

      // not sure if this is a problem since webpack will wait for dependencies to load, but sorting
      // by auto/dependency will result in a cyclic dependency error for lazy-loaded routes
      htmlWebpackPlugin.userOptions.chunksSortMode = 'none'

      if ((htmlWebpackPlugin.userOptions.chunks) !== 'all' &&
        htmlWebpackPlugin.userOptions.chunks?.length
      ) {
        htmlWebpackPlugin.userOptions.chunks = this.mapChunkNames(htmlWebpackPlugin.userOptions.chunks as string[])
      }

      if (htmlWebpackPlugin.userOptions.excludeChunks?.length) {
        htmlWebpackPlugin.userOptions.excludeChunks = this.mapChunkNames(htmlWebpackPlugin.userOptions.excludeChunks)
      }

      compiler.hooks.compilation.tap(PLUGIN_NAME, (compilation: Compilation) => {

        if (compilation.name) {
          return
        }

        getHooks(compilation).alterAssetTagGroups.tapPromise(`${PLUGIN_NAME} update asset tags`,
          async (htmlPluginData) => {
            const hash = compilation.hash
            const publicPath = compilation.getAssetPath(compilation.outputOptions.publicPath, { hash })
            const chunkMap: TargetedChunkMap = compilation.chunkGroups.reduce((result: TargetedChunkMap, chunkGroup: ChunkGroup) => {
              chunkGroup.chunks.forEach((chunk: Chunk) => {
                chunk.files.forEach((file: string) => {
                  result.set(file, chunkGroup, chunk, compilation.chunkGraph, compilation.moduleGraph)
                })
              })
              return result
            }, new TargetedChunkMap(publicPath))
            this.updateScriptTags(chunkMap, htmlPluginData.headTags)
            this.updateScriptTags(chunkMap, htmlPluginData.bodyTags)
            return htmlPluginData
          })

      })
    })
  }


}
