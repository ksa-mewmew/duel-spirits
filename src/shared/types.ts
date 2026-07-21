import type { CardId } from './cards'
import type { MatchConfig } from './match-config'

export type PlayerId = 'P1' | 'P2'
export type GameStatus = 'waiting' | 'playing' | 'finished'

export interface CardInstance {
  instanceId: string
  cardId: CardId
  ownerId?: PlayerId
  controllerId?: PlayerId
  costReduction?: number
}

export interface ManaCardInstance extends CardInstance {
  exhausted: boolean
}

export interface UnitInstance extends CardInstance {
  damage: number
  exhausted: boolean
  summonedThisTurn: boolean
  attacksThisTurn: number
  temporaryAttackModifier: number
  temporaryHealthModifier: number
  temporaryRush?: boolean
}

export interface PlayerState {
  deck: CardInstance[]
  hand: CardInstance[]
  life: CardInstance[]
  mana: ManaCardInstance[]
  field: UnitInstance[]
  discard: CardInstance[]
  manaPlacedThisTurn: boolean
  attacksThisTurn: number
  extraLifeLossOnDirectAttack: boolean
}

export type PendingChoice =
  | {
      type: 'TEMPLE_PROSPECT_LIFE'
      playerId: PlayerId
      sourceUnitId: string
    }
  | {
      type: 'TEMPLE_PROSPECT_HAND'
      playerId: PlayerId
      sourceUnitId: string
    }
  | {
      type: 'WAVE_READER_TOP'
      playerId: PlayerId
      revealedCard: CardInstance
    }
  | {
      type: 'SURGING_WAVE_TOP'
      playerId: PlayerId
      revealedCard: CardInstance
      canSummon: boolean
    }
  | {
      type: 'BURNING_PROCESSION'
      playerId: PlayerId
      revealedCards: CardInstance[]
      maxSummons: number
    }
  | {
      type: 'HOLY_MIRROR_LIFE'
      playerId: PlayerId
    }

export interface GameState {
  matchConfig: MatchConfig
  actionSequence: number
  status: GameStatus
  currentPlayer: PlayerId
  turnNumber: number
  players: Record<PlayerId, PlayerState>
  winner: PlayerId | null
  pendingChoices: PendingChoice[]
}
