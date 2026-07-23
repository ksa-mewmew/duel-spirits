export const SET_IDS = [
  'foundations-001',
  'evolution-begins-001',
] as const

export type SetId = typeof SET_IDS[number]

export const DEFAULT_TURN_DRAW_COUNT = 2

export const FORMAT_IDS = [
  'campaign-prologue-v1',
  'set-constructed-v1',
  'open-v1',
  'draft-v1',
  'restricted-v1',
] as const

export type GameFormatId = typeof FORMAT_IDS[number]

export type GameMode = 'pvp' | 'campaign'
export type DeckSource = 'constructed' | 'campaign' | 'draft'
export type FormatKind = 'campaign' | 'set-constructed' | 'open' | 'draft' | 'restricted'

export interface CardSet {
  id: SetId
  code: string
  name: string
  description: string
  releaseType: 'core' | 'expansion' | 'campaign'
  contentVersion: string
  unlockedByDefault: boolean
}

export type CardPoolRule =
  | { type: 'all' }
  | { type: 'sets'; setIds: SetId[] }
  | { type: 'selected-sets'; defaultSetIds: SetId[] }
  | { type: 'draft-pool' }

export interface DraftRules {
  poolSize: number
  deckSize: number
  packCount: number
  cardsPerPack: number
}

export interface GameFormat<CardKey extends string = string> {
  id: GameFormatId
  name: string
  shortName: string
  description: string
  kind: FormatKind
  mode: GameMode
  deckSource: DeckSource
  deckSize: number
  maxCopiesPerCard: number
  startingLife: number
  startingHand: number
  turnDrawCount: number
  fieldSlots: number
  cardPool: CardPoolRule
  bannedCardIds: CardKey[]
  restrictedCardLimits: Partial<Record<CardKey, number>>
  selectableInDeckBuilder: boolean
  selectableInLobby: boolean
  scenarioId?: string
  draft?: DraftRules
}

export interface DraftPool<CardKey extends string = string> {
  id: string
  seed: string
  cardIds: CardKey[]
  createdAt: number
}

export interface DeckFormatSelection<CardKey extends string = string> {
  formatId: GameFormatId
  selectedSetIds: SetId[]
  draftPool: DraftPool<CardKey> | null
}
