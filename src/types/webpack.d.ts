import * as webpack from 'webpack'
declare module 'webpack' {
  import { Compiler, Compilation, Entry, ExternalsPlugin, WebpackPluginInstance } from 'webpack'
  
  import { BabelTarget } from './babel.target'

  import LoaderContext = webpack.loader.LoaderContext

  // no idea why these are not exported
  type Plugin = WebpackPluginInstance
  interface NewLoader {
    loader: string;
    options?: { [name: string]: any };
  }
  type Loader = string | NewLoader;
  type Externals = ExternalsPlugin['externals'];
  type NormalModuleFactory = ReturnType<Compiler['newCompilationParams']>['normalModuleFactory'];
  type ContextModuleFactory = ReturnType<Compiler['newCompilationParams']>['contextModuleFactory'];

  type ChunkGroup = Compilation['chunkGroups'][number]

  type Entrypoint = Compilation['asyncEntrypoints'][number]

  // TODO: remove following custom type
  interface Dependency {
    originalName: string
    request: string
  }

  interface Module {
    request: string
    options?: any
  }

  interface MainTemplate {
    hooks: any
  }
}
