import { Compiler, Plugin } from 'webpack'

import { BabelTarget }                  from './babel-target'
import { BabelTargetEntryPlugin }  from './babel.target.entry.plugin'

// takes over processing of webpack's entry options so that it generates one entry per entry and target
// basically the same as webpack's built-in EntryOptionPlugin, just using the babel targeting stuff instead

/**
 * @internalapi
 */
export class BabelTargetEntryOptionPlugin implements Plugin {

  constructor(private targets: BabelTarget[]) {
  }

  // private itemToPlugin(context: string, item: string | string[], name: string): Plugin {
  //   if (Array.isArray(item)) {
  //     return new BabelTargetMultiEntryPlugin(this.targets, context, name, item)
  //   }
  //   if (this.targets.find(target => !!(target.additionalModules && target.additionalModules.length))) {
  //     return new BabelTargetMultiEntryPlugin(this.targets, context, name, [item])
  //   }
  //   return new BabelTargetSingleEntryPlugin(this.targets, context, name, item)
  // }

  private static entryDescriptionToOptions(compiler: Compiler, name: string, desc: any): any {
    const options = {
      name,
      filename: desc.filename,
      runtime: desc.runtime,
      dependOn: desc.dependOn,
      chunkLoading: desc.chunkLoading,
      wasmLoading: desc.wasmLoading,
      library: desc.library,
    }
    // TODO what does those plugins do?
    if (desc.chunkLoading) {
      // const EnableChunkLoadingPlugin = require("./javascript/EnableChunkLoadingPlugin")
      // EnableChunkLoadingPlugin.checkEnabled(compiler, desc.chunkLoading)
    }
    if (desc.wasmLoading) {
      // const EnableWasmLoadingPlugin = require("./wasm/EnableWasmLoadingPlugin")
      // EnableWasmLoadingPlugin.checkEnabled(compiler, desc.wasmLoading)
    }
    if (desc.library) {
      // const EnableLibraryPlugin = require("./library/EnableLibraryPlugin")
      // EnableLibraryPlugin.checkEnabled(compiler, desc.library.type)
    }
    return options
  }

  public apply(compiler: Compiler): void {
    compiler.hooks.entryOption.tap('EntryOptionPlugin', (context, entry) => {
      if (typeof entry === 'function') {
        throw new Error('not supported')
        // new DynamicEntryPlugin(context, entry).apply(compiler)
      } else {
        for (const name of Object.keys(entry)) {
          const desc = entry[name]
          const options = BabelTargetEntryOptionPlugin.entryDescriptionToOptions(compiler, name, desc)
          for (const entry of desc.import) {
            new BabelTargetEntryPlugin(this.targets, context, entry, options).apply(compiler)
          }
        }
      }
      return true
    })
  }
}
