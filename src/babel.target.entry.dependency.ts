import ModuleDependency = require('webpack/lib/dependencies/ModuleDependency')

import { BabelTarget } from './babel-target'
import { DEV_SERVER_CLIENT } from './constants'

interface EntryLoc {
  name: string
  index?: number
}

// TODO what's makeSerializable?
export class BabelTargetEntryDependency extends ModuleDependency {

  public name: string
  public loc: EntryLoc

  // @ts-ignore
  // webpack official typing is wrong
  public get type(): string {
    return 'babel target entry'
  }

  public getResourceIdentifier(): string {
    return `module${this.request}!${this.babelTarget.key}`
  }
  
  // @ts-ignore
  public get category(): string {
    return 'esm'
  }

  constructor(public babelTarget: BabelTarget, request: string, public originalName: string, loc?: EntryLoc) {
    super(`${request.startsWith(DEV_SERVER_CLIENT) ? request : babelTarget.getTargetedRequest(request)}`)

    this.name = babelTarget.getTargetedAssetName(originalName)
    if (!loc) {
      loc = { name: `${this.request}:${babelTarget.key}` }
    } else {
      loc.name += `:${babelTarget.key}`
    }
    this.loc = loc
  }
}
