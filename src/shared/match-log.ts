import type { GameAction } from './actions'
import type { CardId } from './cards'
import type { PlayerId } from './types'

export interface LoggedActionDetail {
  sourceCardId?: CardId
  targetCardIds?: CardId[]
  destroyedCardIds?: CardId[]
  lifeLost?: Partial<Record<PlayerId, number>>
  cardsDrawn?: Partial<Record<PlayerId, number>>
  summonedCardIds?: CardId[]
}

export interface LoggedAction {
  sequence: number
  playerId: PlayerId
  action: GameAction
  createdAt: number
  /** Public, replay-safe facts captured while the authoritative pre/post states exist. */
  detail?: LoggedActionDetail
}

export interface MatchRecord {
  randomSeed: string
  rulesVersion: string
  contentVersion: string
  actions: LoggedAction[]
}
