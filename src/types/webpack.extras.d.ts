declare module 'webpack/lib/dependencies/ModuleDependency' {
  import { Chunk, Dependency } from 'webpack'

  class ModuleDependency extends Dependency {
    constructor(request: string);

    public request: string;
    public userRequest: string;
  }

  export = ModuleDependency;
}

declare module 'webpack/lib/Dependency' {
  import { Dependency } from 'webpack'
  export = Dependency;
}

declare module 'webpack/lib/dependencies/EntryDependency' {
  import { Dependency } from 'webpack'

  class ModuleDependency extends Dependency {
    constructor(request: string) {
    }
  }

  export = ModuleDependency;
}

declare module 'webpack/lib/dependencies/ImportContextDependency' {
  import { Dependency } from 'webpack'

  class ImportContextDependency extends Dependency {
    constructor(public options: any, public range: any, public valueRange: any) {
    }
  }

  export = ImportContextDependency;
}

declare module 'webpack/lib/dependencies/ProvidedDependency' {
  import { Dependency } from 'webpack'

  class ProvidedDependency extends Dependency {
    request: string
  }

  export = ProvidedDependency;
}

declare module 'webpack/lib/dependencies/ContextElementDependency' {
  import { Dependency } from 'webpack'

  class ContextElementDependency extends Dependency {
    request: string
  }

  export = ContextElementDependency;
}

declare module 'webpack/lib/OptimizationStages' {
  const STAGE_BASIC: number
  const STAGE_ADVANCED: number
}

declare module 'webpack/lib/AsyncDependenciesBlock' {
  import { ChunkGroup } from 'webpack'
  type A = ChunkGroup['blocksIterable'] extends Iterable<infer T> ? T : never
  interface AsyncDependenciesBlock extends A {
  }
  class AsyncDependenciesBlock {
  }
  export = AsyncDependenciesBlock;
}

declare module 'webpack/lib/Entrypoint' {
  import { Compilation } from 'webpack'
  type E = Compilation['asyncEntrypoints'][number]
  interface Entrypoint extends E {
  }
  class Entrypoint {
  }
  export = Entrypoint;
}

declare module 'webpack/lib/Chunk' {
  import { Chunk as C } from 'webpack'
  interface Chunk extends C {
  }
  class Chunk {
  }
  export = Chunk;
}

declare module 'webpack/lib/ChunkGroup' {
  import { Compilation } from 'webpack'
  type CG = Compilation['chunkGroups'][number]
  interface ChunkGroup extends CG {
  }
  class ChunkGroup {
  }
  export = ChunkGroup;
}

declare module 'webpack/lib/Module' {
  import { Module as M } from 'webpack'
  interface Module extends M {
  }
  class Module {
  }
  export = Module;
}

declare module 'webpack/lib/ContextModule' {
  import { Module as M, Compiler } from 'webpack'

  type options = ReturnType<Compiler['newCompilationParams']>['contextModuleFactory']['resolveDependencies']extends ($1: any, options: infer T, $2: any) => any ? T : never

  interface ContextModule extends M {
    options: options
  }
  class ContextModule {
  }
  export = ContextModule;
}