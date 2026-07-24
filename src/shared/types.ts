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
  temporaryCharge?: boolean
  temporaryFlying?: boolean
  /** 진화 몬스터 아래에 겹쳐진 카드들입니다. 아래에서 위 순서로 저장합니다. */
  evolutionStack?: CardInstance[]
  /** 진화로 소환된 턴에는 일반적인 소환 멀미를 무시합니다. */
  evolvedThisTurn?: boolean
  /** 다음 자신의 준비 단계 한 번을 건너뜁니다. */
  skipNextReady?: boolean
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


export type SofChoiceEffect =
  | 'BOMB_MOUSE_DAMAGE'
  | 'UNDERWATER_OBSERVER_TOP'
  | 'ICE_MIRROR_FREEZE'
  | 'WAVE_FIN_BOUNCE'
  | 'CRYSTAL_TSUNAMI_BOUNCE'
  | 'WAVE_FIN_DRAW'
  | 'WAVE_FIN_BOTTOM'
  | 'TREE_FAIRY_HAND_MANA'
  | 'MANA_FLIP_RETURN'
  | 'MANA_FLIP_PLACE'
  | 'EARTH_GUARDIAN_SUMMON'
  | 'GRAVE_MERCHANT_RETURN'
  | 'BLACKWING_RETURN'
  | 'MASS_BURIAL_ENEMY_FIRST'
  | 'MASS_BURIAL_SELF'
  | 'MASS_BURIAL_ENEMY_SECOND'
  | 'MOURNER_SACRIFICE'
  | 'MOURNER_DESTROY'
  | 'MOURNER_LAST_WORDS'
  | 'SKY_KNIGHT_READY'
  | 'STONE_PRIEST_HAND_MANA'
  | 'STONE_PRIEST_LIFE'
  | 'MIRROR_LAKE_RESOLVE'
  | 'COFFIN_KEEPER_BOTTOM'
  | 'COFFIN_KEEPER_TOP'

export interface SofPendingChoice {
  type: 'SOF_CHOICE'
  effect: SofChoiceEffect
  playerId: PlayerId
  /** 효과를 발생시킨 카드의 조종자입니다. 상대가 선택하는 효과에서도 유지됩니다. */
  sourcePlayerId: PlayerId
  sourceUnitId?: string
  sourceCard?: CardInstance
  candidateIds?: string[]
  revealedCards?: CardInstance[]
  maxChoices?: number
  minChoices?: number
  data?: Record<string, string | number | boolean | null>
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
  | SofPendingChoice
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
