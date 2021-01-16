import { HtmlTagObject, getHooks } from 'html-webpack-plugin'
import HtmlWebpackPlugin = require('html-webpack-plugin')
import { Compiler, Compilation, Module, Plugin, RuntimeGlobals } from 'webpack'

import { BabelTarget } from './babel-target'

export class NormalizeModuleIdsPlugin implements Plugin {

  public apply(compiler: Compiler): void {
    this.applyModuleIdNormalizing(compiler)
    this.applyConditionJsonpCallback(compiler)
    this.applyHtmlWebpackTagOrdering(compiler)
  }

  private pluginName(desc?: string): string {
    return `${NormalizeModuleIdsPlugin.name}${desc ? ': ' : ''}${desc || ''}`
  }

  private applyModuleIdNormalizing(compiler: Compiler): void {
    // NamedModuleIdsPlugin changed to moduleIds
    compiler.hooks.afterPlugins.tap(this.pluginName(), compiler => {
      compiler.hooks.compilation.tap(this.pluginName(), (compilation: Compilation) => {
        if (compilation.name) {
          return
        }
        compilation.hooks.moduleIds.tap(this.pluginName(), modules => {
          const { chunkGraph } = compilation
          for (const module of modules) {
            const id = chunkGraph.getModuleId(module) as string
            if (BabelTarget.isTaggedRequest(id)) {
              const queryIndex = id.indexOf('?')
              const ogId = id.substring(0, queryIndex)
              const query = id.substring(queryIndex + 1)
              const queryParts = query.split('&').filter((part: string) => !part.startsWith('babel-target'))
              if (!queryParts.length) {
                chunkGraph.setModuleId(module, ogId)
              } else {
                chunkGraph.setModuleId(module, `${ogId}?${queryParts.join('&')}`)
              }
            }
          }
        })
      })
    })
  }

  private applyConditionJsonpCallback(compiler: Compiler): void {
    // TODO: for browsers which load module and nomdule script like Safari 10.1
    // hook into webpack's runtime to prevent them from running twice
    // maybe figure it out next time
    // compiler.hooks.afterPlugins.tap(this.pluginName(), () => {
    //   compiler.hooks.thisCompilation.tap(this.pluginName(), (compilation: Compilation) => {
    //     if (compilation.name) {
    //       return
    //     }
    //     const hooks = compilation.mainTemplate.hooks as any
    //     hooks.beforeStartup.tap(this.pluginName('conditional jsonp callback'), (source: string) => {
    //       const insertPointCode = 'var oldJsonpFunction = jsonpArray.push.bind(jsonpArray);\n'
    //       const insertPoint = source.indexOf(insertPointCode)
    //       if (insertPoint < 0) {
    //         return
    //       }
    //       const before = source.substring(0, insertPoint)
    //       const after = source.substring(insertPoint)
    //       return `${before}if (jsonpArray.push.name === 'webpackJsonpCallback') return;\n${after}`

    //     })
    //   })
    //   return compiler
    // })
  }

  private applyHtmlWebpackTagOrdering(compiler: Compiler): void {

    compiler.hooks.afterPlugins.tap(this.pluginName(), () => {

      const htmlWebpackPlugin: HtmlWebpackPlugin = compiler.options.plugins
      // instanceof can act wonky since we don't actually keep our own dependency on html-webpack-plugin
      // should we?
        .find(plugin => plugin.constructor.name === 'HtmlWebpackPlugin') as any

      if (!htmlWebpackPlugin) {
        return
      }

      compiler.hooks.compilation.tap(this.pluginName(), (compilation: Compilation) => {

        if (compilation.name) {
          return
        }

        // TODO: runtime should be first
        getHooks(compilation).alterAssetTagGroups.tapPromise(this.pluginName('reorder asset tags'),
          async (htmlPluginData) => {

            const body = htmlPluginData.bodyTags
            const tags = body.slice(0)

            // re-sort the tags so that es module tags are rendered first, otherwise maintaining the original order
            body.sort((a, b) => {
              const aIndex = tags.indexOf(a)
              const bIndex = tags.indexOf(b)
              if (a.tagName !== 'script' || b.tagName !== 'script' ||
                !a.attributes || !b.attributes ||
                !a.attributes.src || !b.attributes.src ||
                (a.attributes.type !== 'module' && b.attributes.type !== 'module')) {
                // use the original order
                return aIndex - bIndex
              }

              if (a.attributes.type === 'module') {
                return -1
              }
              return 1
            })

            body.forEach((tag: HtmlTagObject) => {
              if (tag.tagName === 'script' && tag.attributes && tag.attributes.nomodule) {
                tag.attributes.defer = true
              }
            })

            htmlPluginData.bodyTags = body

            return htmlPluginData

          })

      })
    })
  }

}
