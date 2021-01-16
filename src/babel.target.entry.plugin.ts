import { Compiler, EntryPlugin, Compilation, Dependency } from 'webpack'

import { BabelTarget }                      from './babel-target'
import { BabelTargetEntryDependency }       from './babel.target.entry.dependency'

export class BabelTargetEntryPlugin implements EntryPlugin {
  public constructor(protected targets: BabelTarget[], public context: string,
    public entry: string, public options: EntryPlugin['options']) {}

  public apply(compiler: Compiler): void {
    compiler.hooks.compilation.tap(
      this.constructor.name,
      (compilation: Compilation, { normalModuleFactory }) => {
        compilation.dependencyFactories.set(
          BabelTargetEntryDependency,
          normalModuleFactory,
        )
      },
    )
  
    compiler.hooks.make.tapPromise(
      this.constructor.name,
      async (compilation: Compilation) => {
        await Promise.all(this.targets.map(async target => {
          const dep = new BabelTargetEntryDependency(target, this.entry, typeof this.options === 'string' ? this.options : this.options.name)
          return await this.addEntry(compilation, dep)
        }))
      },
    )
  }

  protected async addEntry(compilation: Compilation, dep: BabelTargetEntryDependency): Promise<void>
  protected async addEntry(compilation: Compilation, dep: Dependency, name: string): Promise<void>
  protected async addEntry(compilation: Compilation, dep: Dependency, name?: string): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      compilation.addEntry(this.context, dep, (dep as BabelTargetEntryDependency).name || name, (err: Error) => {
        if (err) {
          return reject(err)
        }
        resolve()
      })
    })
  }

}
