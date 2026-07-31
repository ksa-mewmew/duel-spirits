import {
  DECK_SCHEMA_VERSION,
  MAX_SAVED_DECKS,
  normalizeDeckFormatSelection,
  validateDeck,
} from '../shared/decks'
import { isCardId } from '../shared/cards'
import { SAMPLE_DECK_LIST } from '../content/sample-decks'

import type { CardId } from '../shared/cards'
import type { SavedDeck } from '../shared/decks'

const STORAGE_KEY = 'card-duel:decks:v1'
const ACTIVE_DECK_KEY = 'card-duel:active-deck:v1'
const LEGACY_DEFAULT_DECK_ID = 'default-deck'
const SAMPLE_DECK_ID_PREFIX = 'sample-'
const LEGACY_SAMPLE_DECK_REPLACEMENTS: Record<string, string> = {
  'sample-eclipse-omen': 'sample-destined-spirit',
  'sample-ash-mountains': 'sample-procession-ignition',
  'sample-rising-earth': 'sample-mana-ladder',
  'sample-spirit-discipline': 'sample-destined-spirit',
  'sample-swirling-waves': 'sample-graveyard-cycle',
}

function createInitialDecks(createdAt = Date.now()): SavedDeck[] {
  return SAMPLE_DECK_LIST.map((sampleDeck, index) => ({
    schemaVersion: DECK_SCHEMA_VERSION,
    id: `sample-${sampleDeck.id}`,
    name: sampleDeck.name,
    cardIds: [...sampleDeck.cardIds],
    formatId: sampleDeck.formatId,
    selectedSetIds: [],
    draftPool: null,
    createdAt: createdAt + index,
    updatedAt: createdAt + index,
  }))
}

function saveInitialDecks(): SavedDeck[] {
  const decks = createInitialDecks()
  saveDecks(decks)
  const firstDeck = decks[0]
  if (firstDeck) setActiveDeckId(firstDeck.id)
  return decks
}

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
    const desktopRaw = window.duelDesktop?.storage?.loadDecks() ?? null
    const raw = desktopRaw ?? window.localStorage.getItem(STORAGE_KEY)
    if (desktopRaw) window.localStorage.setItem(STORAGE_KEY, desktopRaw)

    if (!raw) {
      return saveInitialDecks()
    }

    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) throw new Error('invalid deck storage')

    const decks = parsed
      .map(parseSavedDeck)
      .filter((deck): deck is SavedDeck => deck !== null)

    if (decks.length === 0) {
      return saveInitialDecks()
    }

    const hasLegacyDefault = decks.some((deck) => deck.id === LEGACY_DEFAULT_DECK_ID)
    const currentSamples = createInitialDecks()
    const savedById = new Map(decks.map((deck) => [deck.id, deck]))
    const synchronizedSamples = currentSamples.map((sample) => {
      const saved = savedById.get(sample.id)
      return saved ? { ...sample, createdAt: saved.createdAt } : sample
    })
    const customDecks = decks.filter((deck) => (
      deck.id !== LEGACY_DEFAULT_DECK_ID
      && !deck.id.startsWith(SAMPLE_DECK_ID_PREFIX)
    ))
    const nextDecks = [...synchronizedSamples, ...customDecks].slice(0, MAX_SAVED_DECKS)

    saveDecks(nextDecks)
    const activeDeckId = getActiveDeckId()
    const replacementActiveId = activeDeckId
      ? LEGACY_SAMPLE_DECK_REPLACEMENTS[activeDeckId]
      : undefined
    if (replacementActiveId && nextDecks.some((deck) => deck.id === replacementActiveId)) {
      setActiveDeckId(replacementActiveId)
    } else if (
      (hasLegacyDefault && activeDeckId === LEGACY_DEFAULT_DECK_ID)
      || (activeDeckId?.startsWith(SAMPLE_DECK_ID_PREFIX) && !nextDecks.some((deck) => deck.id === activeDeckId))
    ) {
      const firstDeck = nextDecks[0]
      if (firstDeck) setActiveDeckId(firstDeck.id)
    }
    return nextDecks
  } catch {
    return saveInitialDecks()
  }
}

export function saveDecks(decks: SavedDeck[]): void {
  const serialized = JSON.stringify(decks.slice(0, MAX_SAVED_DECKS))
  window.localStorage.setItem(
    STORAGE_KEY,
    serialized,
  )
  void window.duelDesktop?.storage?.saveDecks(serialized).catch((error) => {
    console.error('덱 파일 백업에 실패했습니다.', error)
  })
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
    const initialDecks = saveInitialDecks()
    const firstDeck = initialDecks[0]
    if (!firstDeck) throw new Error('기본 덱을 만들지 못했습니다.')
    return firstDeck
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
