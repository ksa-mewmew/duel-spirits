import { DECK_SCHEMA_VERSION, normalizeDeckFormatSelection, validateDeck } from './decks'
import { isCardId } from './cards'

import type { CardId } from './cards'
import type { SavedDeck } from './decks'

const DECK_CODE_PREFIX = 'DS1.'

interface PortableDeck {
  v: 1
  n: string
  c: CardId[]
  f: SavedDeck['formatId']
  s: SavedDeck['selectedSetIds']
  d: SavedDeck['draftPool']
}

function encodeUtf8Base64Url(value: string): string {
  const bytes = new TextEncoder().encode(value)
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '')
}

function decodeUtf8Base64Url(value: string): string {
  const normalized = value.replaceAll('-', '+').replaceAll('_', '/')
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=')
  const binary = atob(padded)
  return new TextDecoder().decode(Uint8Array.from(binary, (character) => character.charCodeAt(0)))
}

export function exportDeckCode(deck: SavedDeck): string {
  const portable: PortableDeck = {
    v: 1,
    n: deck.name.slice(0, 40),
    c: [...deck.cardIds],
    f: deck.formatId,
    s: [...deck.selectedSetIds],
    d: deck.draftPool ? structuredClone(deck.draftPool) : null,
  }
  return `${DECK_CODE_PREFIX}${encodeUtf8Base64Url(JSON.stringify(portable))}`
}

export function importDeckCode(code: string, now = Date.now()): SavedDeck {
  const trimmed = code.trim()
  if (!trimmed.startsWith(DECK_CODE_PREFIX) || trimmed.length > 20_000) {
    throw new Error('Duel Spirits 덱 코드가 아닙니다.')
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(decodeUtf8Base64Url(trimmed.slice(DECK_CODE_PREFIX.length)))
  } catch {
    throw new Error('덱 코드가 손상되었습니다.')
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error('덱 코드 형식이 올바르지 않습니다.')
  }
  const record = parsed as Record<string, unknown>
  if (
    record.v !== 1
    || typeof record.n !== 'string'
    || !Array.isArray(record.c)
    || !record.c.every(isCardId)
  ) {
    throw new Error('지원하지 않는 덱 코드입니다.')
  }

  const selection = normalizeDeckFormatSelection({
    formatId: record.f as SavedDeck['formatId'],
    selectedSetIds: Array.isArray(record.s) ? record.s as SavedDeck['selectedSetIds'] : [],
    draftPool: record.d as SavedDeck['draftPool'],
  })
  const validation = validateDeck(record.c, selection)
  if (!validation.valid) throw new Error(validation.errors.join(' '))

  return {
    schemaVersion: DECK_SCHEMA_VERSION,
    id: crypto.randomUUID(),
    name: record.n.trim().slice(0, 40) || '가져온 덱',
    cardIds: [...record.c] as CardId[],
    ...selection,
    createdAt: now,
    updatedAt: now,
  }
}
