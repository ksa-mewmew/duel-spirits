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
  /** 라이프에 있을 때 사용하는 고정 표시 슬롯입니다. */
  lifeSlotIndex?: number
}

export interface ManaCardInstance extends CardInstance {
  exhausted: boolean
}

export interface UnitInstance extends CardInstance {
  /** 전장의 고정 슬롯 번호입니다. 다른 카드가 떠나도 유지됩니다. */
  slotIndex: number
  battlefieldEntrySeq: number
  damage: number
  exhausted: boolean
  summonedThisTurn: boolean
  attacksThisTurn: number
  temporaryAttackModifier: number
  temporaryHealthModifier: number
  temporaryRush?: boolean
  temporaryFlying?: boolean
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
  /** 현재 턴에 이 플레이어의 어둠 카드가 묘지로 보내진 횟수입니다. */
  darkCardsDiscardedThisTurn?: number
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
      revealedCards: CardInstance[]
    }
  | {
      type: 'BURNING_PROCESSION'
      playerId: PlayerId
      revealedCards: CardInstance[]
      maxSummons: number
    }
  | {
      type: 'GRAVE_DIGGING_RETURN'
      playerId: PlayerId
      sourceCard: CardInstance
      maxCards: number
    }
  | {
      type: 'DEMON_FINGER_DISCARD'
      playerId: PlayerId
    }
  | {
      type: 'DEMON_BREATH_TARGET'
      playerId: PlayerId
      sourceCard: CardInstance
      candidateUnitIds: string[]
    }
  | {
      type: 'HOLY_MIRROR_LIFE'
      playerId: PlayerId
    }
  | {
      type: 'AWAKEN_SUMMON_SLOT'
      playerId: PlayerId
      cardInstanceId: string
    }

export interface GameState {
  matchConfig: MatchConfig
  actionSequence: number
  nextBattlefieldEntrySeq: number
  status: GameStatus
  currentPlayer: PlayerId
  turnNumber: number
  players: Record<PlayerId, PlayerState>
  winner: PlayerId | null
  pendingChoices: PendingChoice[]
}
