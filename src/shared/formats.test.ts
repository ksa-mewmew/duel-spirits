import { describe, expect, test } from 'vitest'

import { CARDS, DEFAULT_DECK } from './cards'
import { GAME_FORMATS } from '../content/formats'
import {
  createDraftPool,
  getFormatCardPool,
  validateDeck,
} from './decks'
import { createGame, applyAction } from './rules'
import { createMatchConfig } from './match-config'

const setDeck = [
  'living_flame', 'living_flame', 'living_flame',
  'ash_hound', 'ash_hound', 'ash_hound',
  'pegasus_rider', 'pegasus_rider', 'pegasus_rider',
  'cathedral_guard', 'cathedral_guard', 'cathedral_guard',
] as const

describe('콘텐츠와 포맷', () => {
  test('요청한 다섯 포맷을 모두 제공한다', () => {
    expect(Object.keys(GAME_FORMATS).sort()).toEqual([
      'campaign-prologue-v1',
      'draft-v1',
      'open-v1',
      'restricted-v1',
      'set-constructed-v1',
    ])
  })

  test('모든 카드에 세트와 수집 번호가 있다', () => {
    for (const card of Object.values(CARDS)) {
      expect(card.setId).toMatch(/^(foundations|confluence)-001$/)
      expect(card.collectorNumber).toMatch(/^DS[FC]-\d{3}$/)
      expect(card.contentVersion).toBeTruthy()
    }
  })

  test('세트 한정전은 선택한 세트 카드만 허용한다', () => {
    const foundationsSelection = {
      formatId: 'set-constructed-v1' as const,
      selectedSetIds: ['foundations-001' as const],
      draftPool: null,
    }
    const emptyExpansionSelection = {
      formatId: 'set-constructed-v1' as const,
      selectedSetIds: ['confluence-001' as const],
      draftPool: null,
    }

    expect(validateDeck(setDeck, foundationsSelection).valid).toBe(true)
    expect(getFormatCardPool(foundationsSelection)).toContain('battle_campfire')
    expect(validateDeck(DEFAULT_DECK, foundationsSelection).valid).toBe(true)

    expect(getFormatCardPool(emptyExpansionSelection)).toEqual([])
    expect(validateDeck(DEFAULT_DECK, emptyExpansionSelection).valid).toBe(false)
  })

  test('금지·제한전은 제한 카드 수량을 검사한다', () => {
    const deck = [...DEFAULT_DECK]
    deck[0] = 'holy_mirror_wall'
    const result = validateDeck(deck, {
      formatId: 'restricted-v1',
      selectedSetIds: [],
      draftPool: null,
    })

    expect(result.valid).toBe(false)
    expect(result.errors.some((error) => error.includes('최대 1장'))).toBe(true)
  })

  test('드래프트 덱은 생성된 풀의 수량을 넘을 수 없다', () => {
    const pool = createDraftPool('fixed-draft-seed', 'draft-v1', 1)
    const deck = pool.cardIds.slice(0, 12)
    const selection = {
      formatId: 'draft-v1' as const,
      selectedSetIds: [],
      draftPool: pool,
    }

    expect(validateDeck(deck, selection).valid).toBe(true)

    const unavailable = Object.keys(CARDS).find(
      (cardId) => !pool.cardIds.includes(cardId as keyof typeof CARDS),
    ) as keyof typeof CARDS | undefined

    if (unavailable) {
      const invalid = [...deck]
      invalid[0] = unavailable
      expect(validateDeck(invalid, selection).valid).toBe(false)
    }

    const tamperedPool = {
      ...pool,
      cardIds: [...pool.cardIds].reverse(),
    }
    expect(validateDeck(deck, {
      ...selection,
      draftPool: tamperedPool,
    }).errors).toContain('드래프트 풀이 발급된 시드와 일치하지 않습니다.')
  })

  test('캠페인 포맷은 PvP 로비에서 분리되어 있다', () => {
    expect(GAME_FORMATS['campaign-prologue-v1'].mode).toBe('campaign')
    expect(GAME_FORMATS['campaign-prologue-v1'].selectableInLobby).toBe(false)
  })
})

describe('재현 가능한 경기 메타데이터', () => {
  test('같은 시드로 만든 초기 배치는 동일하다', () => {
    const matchConfig = createMatchConfig({ randomSeed: 'same-seed', createdAt: 1 })
    let id = 0
    const first = createGame({ matchConfig, idSource: () => `a-${id++}` })
    id = 0
    const second = createGame({ matchConfig, idSource: () => `a-${id++}` })

    expect(first.players.P1.life.map((card) => card.cardId))
      .toEqual(second.players.P1.life.map((card) => card.cardId))
  })

  test('성공한 행동마다 행동 순번이 증가한다', () => {
    const game = createGame({
      matchConfig: createMatchConfig({ randomSeed: 'sequence-seed', createdAt: 1 }),
    })
    const next = applyAction(game, 'P1', { type: 'END_TURN' })
    expect(game.actionSequence).toBe(0)
    expect(next.actionSequence).toBe(1)
  })
})