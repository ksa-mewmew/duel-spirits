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
  lifeIndices: number[]
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
