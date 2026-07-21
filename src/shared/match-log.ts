import type { GameAction } from './actions'
import type { PlayerId } from './types'

export interface LoggedAction {
  sequence: number
  playerId: PlayerId
  action: GameAction
  createdAt: number
}

export interface MatchRecord {
  randomSeed: string
  rulesVersion: string
  contentVersion: string
  actions: LoggedAction[]
}
