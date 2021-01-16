import { Chunk, ChunkGraph, ChunkGroup, ModuleGraph } from 'webpack'

import { BabelTarget } from './babel-target'

export class TargetedChunk {

    private _target: BabelTarget;
    public get target(): BabelTarget {
      if (!this._target) {
        this._target = BabelTarget.findTarget(this.group, this.moduleGraph, this.chunkGraph) || 
          BabelTarget.findTarget(this.chunk, this.moduleGraph, this.chunkGraph)
      }
      return this._target
    }

    constructor(public readonly group: ChunkGroup, public readonly chunk: Chunk,
      public readonly chunkGraph: ChunkGraph, public readonly moduleGraph: ModuleGraph) { }

}

export class TargetedChunkMap {

    private innerMap: { [key: string]: TargetedChunk[] } = {};
    private targetedChunks: { [hash: string]: TargetedChunk } = {};

    constructor(private publicPath: string) {
      // seems good enough
      if (publicPath === 'auto') {
        this.publicPath = ''
      }
    }

    public get(key: string): TargetedChunk[] {
      return this.innerMap[key]
    }

    public set(key: string, group: ChunkGroup, chunk: Chunk, chunkGraph: ChunkGraph, moduleGraph: ModuleGraph): void {
      const pathKey = this.publicPath + key
      if (!this.innerMap[pathKey]) {
        this.innerMap[pathKey] = []
      }
      const targetedChunk = this.getTargetedChunk(group, chunk, chunkGraph, moduleGraph)
      if (!this.innerMap[pathKey].includes(targetedChunk)) {
        this.innerMap[pathKey].push(targetedChunk)
      }
    }

    private getTargetedChunk(group: ChunkGroup, chunk: Chunk, chunkGraph: ChunkGraph, moduleGraph: ModuleGraph): TargetedChunk {
      const key = group.id + chunk.hash
      if (!this.targetedChunks[key]) {
        this.targetedChunks[key] = new TargetedChunk(group, chunk, chunkGraph, moduleGraph)
      }
      return this.targetedChunks[key]
    }

}
