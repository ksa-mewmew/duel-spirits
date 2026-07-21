import {
  DECK_SCHEMA_VERSION,
  MAX_SAVED_DECKS,
  createDefaultSavedDeck,
  normalizeDeckFormatSelection,
  validateDeck,
} from '../shared/decks'
import { isCardId } from '../shared/cards'

import type { CardId } from '../shared/cards'
import type { SavedDeck } from '../shared/decks'

const STORAGE_KEY = 'card-duel:decks:v1'
const ACTIVE_DECK_KEY = 'card-duel:active-deck:v1'

function parseSavedDeck(value: unknown): SavedDeck | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null
  const record = value as Record<string, unknown>

  if (
    typeof record.id !== 'string'
    || typeof record.name !== 'string'
    || !Array.isArray(record.cardIds)
    || !record.cardIds.every(isCardId)
    || typeof record.createdAt !== 'number'
    || typeof record.updatedAt !== 'number'
  ) return null

  const selection = normalizeDeckFormatSelection({
    formatId: record.formatId as SavedDeck['formatId'],
    selectedSetIds: Array.isArray(record.selectedSetIds)
      ? record.selectedSetIds as SavedDeck['selectedSetIds']
      : [],
    draftPool: record.draftPool as SavedDeck['draftPool'],
  })

  return {
    schemaVersion: DECK_SCHEMA_VERSION,
    id: record.id,
    name: record.name,
    cardIds: [...record.cardIds] as CardId[],
    ...selection,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  }
}

export function loadDecks(): SavedDeck[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)

    if (!raw) {
      const defaultDeck = createDefaultSavedDeck()
      saveDecks([defaultDeck])
      setActiveDeckId(defaultDeck.id)
      return [defaultDeck]
    }

    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) throw new Error('invalid deck storage')

    const decks = parsed
      .map(parseSavedDeck)
      .filter((deck): deck is SavedDeck => deck !== null)

    if (decks.length === 0) {
      const defaultDeck = createDefaultSavedDeck()
      saveDecks([defaultDeck])
      setActiveDeckId(defaultDeck.id)
      return [defaultDeck]
    }

    saveDecks(decks)
    return decks.slice(0, MAX_SAVED_DECKS)
  } catch {
    const defaultDeck = createDefaultSavedDeck()
    saveDecks([defaultDeck])
    setActiveDeckId(defaultDeck.id)
    return [defaultDeck]
  }
}

export function saveDecks(decks: SavedDeck[]): void {
  window.localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(decks.slice(0, MAX_SAVED_DECKS)),
  )
}

export function getActiveDeckId(): string | null {
  return window.localStorage.getItem(ACTIVE_DECK_KEY)
}

export function setActiveDeckId(deckId: string): void {
  window.localStorage.setItem(ACTIVE_DECK_KEY, deckId)
}

export function getActiveDeck(): SavedDeck {
  const decks = loadDecks()
  const activeId = getActiveDeckId()
  const activeDeck = decks.find((deck) => deck.id === activeId) ?? decks[0]

  if (!activeDeck) {
    const defaultDeck = createDefaultSavedDeck()
    saveDecks([defaultDeck])
    setActiveDeckId(defaultDeck.id)
    return defaultDeck
  }

  if (getActiveDeckId() !== activeDeck.id) setActiveDeckId(activeDeck.id)
  return activeDeck
}

export function upsertDeck(deck: SavedDeck): SavedDeck[] {
  const validation = validateDeck(deck.cardIds, deck)
  if (!validation.valid) throw new Error(validation.errors.join(' '))

  const decks = loadDecks()
  const existingIndex = decks.findIndex((existing) => existing.id === deck.id)

  if (existingIndex === -1) {
    if (decks.length >= MAX_SAVED_DECKS) {
      throw new Error(`덱은 최대 ${MAX_SAVED_DECKS}개까지 저장할 수 있습니다.`)
    }
    decks.push(deck)
  } else {
    decks[existingIndex] = deck
  }

  saveDecks(decks)
  return decks
}

export function deleteDeck(deckId: string): SavedDeck[] {
  const decks = loadDecks()
  if (decks.length <= 1) throw new Error('최소 한 개의 덱은 남겨야 합니다.')

  const nextDecks = decks.filter((deck) => deck.id !== deckId)
  saveDecks(nextDecks)

  if (getActiveDeckId() === deckId) {
    const nextActive = nextDecks[0]
    if (nextActive) setActiveDeckId(nextActive.id)
  }

  return nextDecks
}
