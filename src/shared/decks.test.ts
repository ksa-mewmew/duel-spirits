import { describe, expect, test } from 'vitest'

import { DEFAULT_DECK } from './cards'
import {
  DECK_SIZE,
  getAverageCost,
  getAttributeDistribution,
  validateDeck,
} from './decks'

describe('덱 검증', () => {
  test('기본 덱은 유효하다', () => {
    expect(DEFAULT_DECK).toHaveLength(DECK_SIZE)
    expect(validateDeck(DEFAULT_DECK)).toEqual({
      valid: true,
      errors: [],
    })
  })

  test('20장이 아니면 거부한다', () => {
    const result = validateDeck(DEFAULT_DECK.slice(0, 19))

    expect(result.valid).toBe(false)
    expect(result.errors).toContain(
      '덱에는 정확히 20장이 필요합니다.',
    )
  })

  test('동일 카드를 세 장 넣을 수 없다', () => {
    const invalidDeck = [...DEFAULT_DECK]
    invalidDeck[2] = 'living_flame'

    const result = validateDeck(invalidDeck)

    expect(result.valid).toBe(false)
    expect(result.errors.some(
      (error) => error.includes('최대 2장'),
    )).toBe(true)
  })
})

describe('덱 통계', () => {
  test('속성 분포와 평균 비용을 계산한다', () => {
    const distribution = getAttributeDistribution(DEFAULT_DECK)

    expect(distribution.fire).toBe(12)
    expect(distribution.water).toBe(0)
    expect(distribution.earth).toBe(0)
    expect(distribution.dark).toBe(0)
    expect(distribution.light).toBe(10)
    expect(getAverageCost(DEFAULT_DECK)).toBeGreaterThan(0)
  })
})
