import {
  ALL_CARD_IDS,
  CARD_ATTRIBUTES,
  CARDS,
  DEFAULT_DECK,
  isCardId,
} from './cards'
import { DEFAULT_FORMAT_ID, GAME_FORMATS, getFormat, isGameFormatId } from '../content/formats'
import { SET_IDS } from '../content/schema'
import { CURRENT_CARD_ACCESS_POLICY } from './card-access'
import { createRandomSeed, createSeededRandom } from './random'

import type { CardAttributeId, CardId } from './cards'
import type {
  DeckFormatSelection,
  DraftPool,
  GameFormatId,
  SetId,
} from '../content/schema'

export const DECK_SCHEMA_VERSION = 2
export const MAX_SAVED_DECKS = 12
export const DECK_SIZE = getFormat(DEFAULT_FORMAT_ID).deckSize
export const MAX_COPIES_PER_CARD = getFormat(DEFAULT_FORMAT_ID).maxCopiesPerCard

export interface SavedDeck extends DeckFormatSelection<CardId> {
  schemaVersion: typeof DECK_SCHEMA_VERSION
  id: string
  name: string
  cardIds: CardId[]
  createdAt: number
  updatedAt: number
}

export interface SubmittedDeck extends DeckFormatSelection<CardId> {
  schemaVersion: typeof DECK_SCHEMA_VERSION
  deckId: string
  name: string
  cardIds: CardId[]
}

export interface DeckValidationResult {
  valid: boolean
  errors: string[]
}

export type CountByCost = Record<number, number>
export type CountByAttribute = Record<CardAttributeId, number>

export function createDefaultFormatSelection(
  formatId: GameFormatId = DEFAULT_FORMAT_ID,
): DeckFormatSelection<CardId> {
  const format = getFormat(formatId)

  return {
    formatId,
    selectedSetIds: format.cardPool.type === 'selected-sets'
      ? [...format.cardPool.defaultSetIds]
      : [],
    draftPool: null,
  }
}

export function createDefaultSavedDeck(now = Date.now()): SavedDeck {
  return {
    schemaVersion: DECK_SCHEMA_VERSION,
    id: 'default-deck',
    name: '기본 실험 덱',
    cardIds: [...DEFAULT_DECK],
    ...createDefaultFormatSelection(),
    createdAt: now,
    updatedAt: now,
  }
}

function isSetId(value: unknown): value is SetId {
  return typeof value === 'string' && SET_IDS.includes(value as SetId)
}

function parseDraftPool(value: unknown): DraftPool<CardId> | null {
  if (value === null || value === undefined) return null
  if (typeof value !== 'object' || Array.isArray(value)) return null
  const record = value as Record<string, unknown>

  if (
    typeof record.id !== 'string'
    || typeof record.seed !== 'string'
    || !Array.isArray(record.cardIds)
    || !record.cardIds.every(isCardId)
    || typeof record.createdAt !== 'number'
  ) return null

  return {
    id: record.id.slice(0, 100),
    seed: record.seed.slice(0, 160),
    cardIds: [...record.cardIds],
    createdAt: record.createdAt,
  }
}

export function normalizeDeckFormatSelection(
  value: Partial<DeckFormatSelection<CardId>> | null | undefined,
): DeckFormatSelection<CardId> {
  const formatId = isGameFormatId(value?.formatId)
    ? value.formatId
    : DEFAULT_FORMAT_ID
  const format = getFormat(formatId)
  const selectedSetIds = Array.isArray(value?.selectedSetIds)
    ? value.selectedSetIds.filter(isSetId)
    : []

  return {
    formatId,
    selectedSetIds: format.cardPool.type === 'selected-sets'
      ? selectedSetIds.length
        ? [...new Set(selectedSetIds)]
        : [...format.cardPool.defaultSetIds]
      : [],
    draftPool: parseDraftPool(value?.draftPool),
  }
}

export function getFormatCardPool(
  selection: DeckFormatSelection<CardId>,
): CardId[] {
  const format = getFormat(selection.formatId)
  const accessible = new Set(CURRENT_CARD_ACCESS_POLICY.getAvailableCardIds())

  if (format.cardPool.type === 'draft-pool') {
    return selection.draftPool
      ? [...new Set(selection.draftPool.cardIds)].filter((id) => accessible.has(id))
      : []
  }

  const setIds = format.cardPool.type === 'sets'
    ? format.cardPool.setIds
    : format.cardPool.type === 'selected-sets'
      ? selection.selectedSetIds
      : null

  return ALL_CARD_IDS.filter((cardId) => (
    accessible.has(cardId)
    && (setIds === null || setIds.includes(CARDS[cardId].setId))
  ))
}

export function getCardCopyLimit(
  cardId: CardId,
  selection: DeckFormatSelection<CardId>,
): number {
  const format = getFormat(selection.formatId)
  if (format.bannedCardIds.includes(cardId)) return 0
  return format.restrictedCardLimits[cardId] ?? format.maxCopiesPerCard
}

export function validateDeck(
  rawCardIds: readonly unknown[],
  rawSelection: Partial<DeckFormatSelection<CardId>> = createDefaultFormatSelection(),
): DeckValidationResult {
  const errors: string[] = []
  const selection = normalizeDeckFormatSelection(rawSelection)
  const format = getFormat(selection.formatId)

  if (rawCardIds.length !== format.deckSize) {
    errors.push(`덱에는 정확히 ${format.deckSize}장이 필요합니다.`)
  }

  if (format.deckSource === 'draft' && !selection.draftPool) {
    errors.push('드래프트 포맷에는 먼저 드래프트 카드 풀이 필요합니다.')
  }

  if (format.deckSource === 'draft' && selection.draftPool) {
    const expectedPool = createDraftPool(
      selection.draftPool.seed,
      selection.formatId,
      selection.draftPool.createdAt,
    )
    const poolMatches = expectedPool.cardIds.length === selection.draftPool.cardIds.length
      && expectedPool.cardIds.every(
        (cardId, index) => cardId === selection.draftPool?.cardIds[index],
      )
    if (!poolMatches) {
      errors.push('드래프트 풀이 발급된 시드와 일치하지 않습니다.')
    }
  }

  const allowedCards = new Set(getFormatCardPool(selection))
  const counts = new Map<CardId, number>()
  const draftCounts = new Map<CardId, number>()

  for (const cardId of selection.draftPool?.cardIds ?? []) {
    draftCounts.set(cardId, (draftCounts.get(cardId) ?? 0) + 1)
  }

  for (const rawCardId of rawCardIds) {
    if (!isCardId(rawCardId)) {
      errors.push('존재하지 않는 카드가 포함되어 있습니다.')
      continue
    }

    const nextCount = (counts.get(rawCardId) ?? 0) + 1
    counts.set(rawCardId, nextCount)

    if (!allowedCards.has(rawCardId)) {
      errors.push(`${CARDS[rawCardId].name}은 ${format.name}에서 사용할 수 없습니다.`)
    }

    if (!CURRENT_CARD_ACCESS_POLICY.canUseCard(rawCardId, nextCount)) {
      errors.push(`${CARDS[rawCardId].name}의 사용 권한이나 보유 수량이 부족합니다.`)
    }

    const copyLimit = getCardCopyLimit(rawCardId, selection)
    if (copyLimit === 0) {
      errors.push(`${CARDS[rawCardId].name}은 ${format.name}의 금지 카드입니다.`)
    } else if (nextCount > copyLimit) {
      errors.push(`${CARDS[rawCardId].name}은 최대 ${copyLimit}장까지 넣을 수 있습니다.`)
    }

    if (format.deckSource === 'draft' && nextCount > (draftCounts.get(rawCardId) ?? 0)) {
      errors.push(`${CARDS[rawCardId].name}은 드래프트 풀에 있는 수량보다 많이 넣을 수 없습니다.`)
    }
  }

  return {
    valid: errors.length === 0,
    errors: [...new Set(errors)],
  }
}

export function parseSubmittedDeck(value: unknown): SubmittedDeck | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null
  const record = value as Record<string, unknown>

  if (
    typeof record.deckId !== 'string'
    || typeof record.name !== 'string'
    || !Array.isArray(record.cardIds)
    || !record.cardIds.every(isCardId)
  ) return null

  const selection = normalizeDeckFormatSelection({
    formatId: isGameFormatId(record.formatId) ? record.formatId : DEFAULT_FORMAT_ID,
    selectedSetIds: Array.isArray(record.selectedSetIds)
      ? record.selectedSetIds.filter(isSetId)
      : [],
    draftPool: parseDraftPool(record.draftPool),
  })

  return {
    schemaVersion: DECK_SCHEMA_VERSION,
    deckId: record.deckId.slice(0, 80),
    name: record.name.trim().slice(0, 40) || '이름 없는 덱',
    cardIds: [...record.cardIds],
    ...selection,
  }
}

export function createDraftPool(
  seed = createRandomSeed('draft'),
  formatId: GameFormatId = 'draft-v1',
  now = Date.now(),
): DraftPool<CardId> {
  const format = getFormat(formatId)
  if (!format.draft) throw new Error('드래프트 규칙이 없는 포맷입니다.')

  const source = CURRENT_CARD_ACCESS_POLICY.getAvailableCardIds()
  const random = createSeededRandom(seed).next
  const cardIds: CardId[] = []

  for (let index = 0; index < format.draft.poolSize; index += 1) {
    const cardId = source[Math.floor(random() * source.length)]
    if (cardId) cardIds.push(cardId)
  }

  return {
    id: `draft-pool-${seed}`,
    seed,
    cardIds,
    createdAt: now,
  }
}

export function isDeckCompatibleWithFormat(
  deck: Pick<SavedDeck | SubmittedDeck, 'formatId' | 'selectedSetIds'>,
  formatId: GameFormatId,
  selectedSetIds: readonly SetId[],
): boolean {
  if (deck.formatId !== formatId) return false
  const format = getFormat(formatId)
  if (format.cardPool.type !== 'selected-sets') return true

  const left = [...new Set(deck.selectedSetIds)].sort()
  const right = [...new Set(selectedSetIds)].sort()
  return left.length === right.length && left.every((id, index) => id === right[index])
}

export function getCardCounts(cardIds: readonly CardId[]): Map<CardId, number> {
  const counts = new Map<CardId, number>()
  for (const cardId of cardIds) counts.set(cardId, (counts.get(cardId) ?? 0) + 1)
  return counts
}

export function getAttributeDistribution(cardIds: readonly CardId[]): CountByAttribute {
  const counts: CountByAttribute = { fire: 0, water: 0, earth: 0, dark: 0, light: 0 }
  for (const cardId of cardIds) {
    for (const attributeId of CARDS[cardId].attributes) counts[attributeId] += 1
  }
  return counts
}

export function getCostDistribution(cardIds: readonly CardId[]): CountByCost {
  const counts: CountByCost = {}
  for (const cardId of cardIds) {
    const cost = CARDS[cardId].cost
    counts[cost] = (counts[cost] ?? 0) + 1
  }
  return counts
}

export function getAverageCost(cardIds: readonly CardId[]): number {
  if (cardIds.length === 0) return 0
  return cardIds.reduce((sum, cardId) => sum + CARDS[cardId].cost, 0) / cardIds.length
}

export function getAttributeLabel(attributeId: CardAttributeId): string {
  return CARD_ATTRIBUTES[attributeId].name
}

export function sortCardIdsForBuilder(
  cardIds: readonly CardId[] = ALL_CARD_IDS,
): CardId[] {
  return [...cardIds].sort((leftId, rightId) => {
    const left = CARDS[leftId]
    const right = CARDS[rightId]
    return left.cost - right.cost
      || left.attributes[0].localeCompare(right.attributes[0])
      || left.name.localeCompare(right.name)
  })
}

export const ALL_GAME_FORMATS = Object.values(GAME_FORMATS)
