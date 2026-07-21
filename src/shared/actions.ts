export interface CardPlaySelection {
  unitId?: string
  lifeIndex?: number
  effectManaId?: string
  discardId?: string
  fieldSlot?: number
}

export interface PlaceManaAction {
  type: 'PLACE_MANA'
  cardInstanceId: string
}

export interface PlayCardAction {
  type: 'PLAY_CARD'
  cardInstanceId: string
  manaIds: string[]
  selection?: CardPlaySelection
}

export interface ResolveChoiceAction {
  type: 'RESOLVE_CHOICE'
  choiceIds: string[]
}

export interface SummonFromManaAction {
  type: 'SUMMON_FROM_MANA'
  cardInstanceId: string
  fieldSlot: number
}

export interface AttackUnitAction {
  type: 'ATTACK_UNIT'
  attackerId: string
  defenderId: string
}

export interface AttackPlayerAction {
  type: 'ATTACK_PLAYER'
  attackerId: string
  /** 화면에서 선택한 고정 라이프 슬롯 번호입니다. */
  lifeSlotIndices?: number[]
  /** 이전 클라이언트와 저장된 행동 기록을 위한 배열 위치 기반 값입니다. */
  lifeIndices?: number[]
}

export interface EndTurnAction { type: 'END_TURN' }
export interface SurrenderAction { type: 'SURRENDER' }

export type GameAction =
  | PlaceManaAction
  | PlayCardAction
  | ResolveChoiceAction
  | SummonFromManaAction
  | AttackUnitAction
  | AttackPlayerAction
  | EndTurnAction
  | SurrenderAction
