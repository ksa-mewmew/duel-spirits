import { DEFAULT_FORMAT_ID, LOBBY_FORMATS, getFormat, isGameFormatId } from '../content/formats'
import { SET_IDS } from '../content/schema'

import type { GameFormatId, SetId } from '../content/schema'

export const TURN_LIMIT_OPTIONS = [30, 60, 90, 120, 180, 300, null] as const
export const SEAT_EXPIRY_OPTIONS = [60, 300, 900, 1800, 3600] as const

export const DEFAULT_TURN_LIMIT_SECONDS = 180
export const DEFAULT_SEAT_EXPIRY_SECONDS = 900

export interface RoomSettings {
  turnLimitSeconds: number | null
  seatExpirySeconds: number
  formatId: GameFormatId
  selectedSetIds: SetId[]
}

export function isTurnLimitSeconds(value: unknown): value is number | null {
  return TURN_LIMIT_OPTIONS.some((option) => option === value)
}

export function isSeatExpirySeconds(value: unknown): value is number {
  return SEAT_EXPIRY_OPTIONS.some((option) => option === value)
}

export function parseTurnLimitSeconds(rawValue: string | null): number | null {
  if (rawValue === 'none') return null
  const parsed = Number(rawValue)
  return isTurnLimitSeconds(parsed) ? parsed : DEFAULT_TURN_LIMIT_SECONDS
}

export function parseSeatExpirySeconds(rawValue: string | null): number {
  const parsed = Number(rawValue)
  return isSeatExpirySeconds(parsed) ? parsed : DEFAULT_SEAT_EXPIRY_SECONDS
}

export function parseRoomFormatId(rawValue: string | null): GameFormatId {
  if (!isGameFormatId(rawValue)) return DEFAULT_FORMAT_ID
  return LOBBY_FORMATS.some((format) => format.id === rawValue)
    ? rawValue
    : DEFAULT_FORMAT_ID
}

export function parseSelectedSetIds(rawValue: string | null, formatId: GameFormatId): SetId[] {
  const format = getFormat(formatId)
  if (format.cardPool.type !== 'selected-sets') return []

  const parsed = (rawValue ?? '')
    .split(',')
    .filter((value): value is SetId => SET_IDS.includes(value as SetId))

  return parsed.length ? [...new Set(parsed)] : [...format.cardPool.defaultSetIds]
}

export function createDefaultRoomSettings(): RoomSettings {
  return {
    turnLimitSeconds: DEFAULT_TURN_LIMIT_SECONDS,
    seatExpirySeconds: DEFAULT_SEAT_EXPIRY_SECONDS,
    formatId: DEFAULT_FORMAT_ID,
    selectedSetIds: [],
  }
}

export function normalizeRoomSettings(
  value: Partial<RoomSettings> | null | undefined,
): RoomSettings {
  const formatId = parseRoomFormatId(value?.formatId ?? null)
  return {
    turnLimitSeconds: isTurnLimitSeconds(value?.turnLimitSeconds)
      ? value.turnLimitSeconds
      : DEFAULT_TURN_LIMIT_SECONDS,
    seatExpirySeconds: isSeatExpirySeconds(value?.seatExpirySeconds)
      ? value.seatExpirySeconds
      : DEFAULT_SEAT_EXPIRY_SECONDS,
    formatId,
    selectedSetIds: parseSelectedSetIds(
      Array.isArray(value?.selectedSetIds) ? value.selectedSetIds.join(',') : null,
      formatId,
    ),
  }
}
