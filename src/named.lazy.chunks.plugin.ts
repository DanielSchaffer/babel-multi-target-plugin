import { Chunk, Compilation, Compiler, Plugin, ModuleGraph, ChunkGraph, Entrypoint } from 'webpack'

import { BabelTarget } from './babel-target'

const PLUGIN_NAME = 'NamedLazyChunksPlugin'

/**
 * Gives names to lazy chunks (lazy routes) so their assets have recognizable names instead of just numbers.
 */
export class NamedLazyChunksPlugin implements Plugin {

  private getNameFromOrigins(chunk: Chunk, moduleGraph: ModuleGraph, chunkGraph: ChunkGraph): string {

    // TODO: why is this Entrypoint
    const nameInfo = Array.from(chunk.groupsIterable).reduce((result, group: Entrypoint) => {
      if (!group.origins) {
        return
      }
      const runtimeChunk = group.getRuntimeChunk()
      if (runtimeChunk === chunk) {
        const reasons = Array.from(moduleGraph.getIncomingConnections(runtimeChunk.entryModule))
        result.origins = [ reasons[0].dependency.originalName ]
        result.isEntry = true
      }
      group.origins.forEach((origin) => {
        const isLazyModule = origin.module && origin.module.options && origin.module.options.mode === 'lazy'
        const isNgFactory = origin.request && origin.request.match(/\.ngfactory(?:\?babel-target=\w+)?$/)
        if (!isLazyModule && !isNgFactory) {
          return
        }
        if (!result.babelTarget) {
          result.babelTarget = BabelTarget.findTarget(origin.module, moduleGraph, chunkGraph)
        }
        if (result.isEntry) {
          return
        }
        const cleanedName = isNgFactory ?
          // remove .ngfactory and babel target tag from request name
          origin.request.replace(/\.ngfactory(?:\?babel-target=\w+)?$/, '') :
          // remove file extension
          origin.request.replace(/\.\w+(?:\?babel-target=\w+)?$/, '')
        const nameStart = cleanedName.lastIndexOf('/') + 1
        const originName = cleanedName.substring(nameStart)

        if (!result.origins.includes(originName)) {
          result.origins.push(originName)
        }

      })
      return result
    }, { origins: [] } as { origins: string[], babelTarget?: BabelTarget, isEntry: boolean })

    const name = nameInfo.origins.join('~')
    return nameInfo.babelTarget.tagAssetsWithKey ? `${name}.${nameInfo.babelTarget.key}` : name
  }

  public apply(compiler: Compiler): void {
    compiler.hooks.compilation.tap(PLUGIN_NAME, (compilation: Compilation) => {
      if (compilation.name) {
        return
      }
      compilation.hooks.beforeChunkIds.tap(PLUGIN_NAME, (chunks: Chunk[]) => {
        const usedNames: { [name: string]: number } = {}
        chunks.forEach(chunk => {
          if (chunk.id || chunk.name) {
            return
          }
          const isVendorsChunk = chunk.chunkReason === 'split chunk (cache group: vendors)'
          let name = this.getNameFromOrigins(chunk, compilation.moduleGraph, compilation.chunkGraph)
          if (isVendorsChunk) {
            name = `vendors~` + name
          }

          // HACK ALERT: the combination of multiple lazy child routes and chunk splitting can make this
          // get pretty hairy. Need to figure out a better way to handle it.
          if (typeof (usedNames[name]) === 'undefined') {
            usedNames[name] = -1
          }
          usedNames[name]++
          if (usedNames[name] > 0) {
            name += `.${usedNames[name]}`
          }
          chunk.id = name
        })
      })
    })
  }

}
