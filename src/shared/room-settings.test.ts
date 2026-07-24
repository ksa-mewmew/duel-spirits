import { describe, expect, test } from 'vitest'

import {
  DEFAULT_SEAT_EXPIRY_SECONDS,
  DEFAULT_DRAFT_LIMIT_SECONDS,
  DEFAULT_TURN_LIMIT_SECONDS,
  parseSeatExpirySeconds,
  parseDraftLimitSeconds,
  parseTurnLimitSeconds,
} from './room-settings'

describe('방 설정 파싱', () => {
  test('기본 턴 제한은 180초다', () => {
    expect(parseTurnLimitSeconds(null)).toBe(
      DEFAULT_TURN_LIMIT_SECONDS,
    )
  })

  test('시간 제한 없음 값을 읽는다', () => {
    expect(parseTurnLimitSeconds('none')).toBeNull()
  })

  test('허용되지 않은 턴 제한은 기본값으로 돌아간다', () => {
    expect(parseTurnLimitSeconds('17')).toBe(
      DEFAULT_TURN_LIMIT_SECONDS,
    )
  })

  test('허용되지 않은 자리 만료값은 기본값으로 돌아간다', () => {
    expect(parseSeatExpirySeconds('12')).toBe(
      DEFAULT_SEAT_EXPIRY_SECONDS,
    )
  })

  test('드래프트 제한 시간을 읽고 잘못된 값은 기본값으로 돌린다', () => {
    expect(parseDraftLimitSeconds('600')).toBe(600)
    expect(parseDraftLimitSeconds('17')).toBe(
      DEFAULT_DRAFT_LIMIT_SECONDS,
    )
  })
})
