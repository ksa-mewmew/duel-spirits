import { describe, expect, test } from 'vitest'

import { ALL_CARD_IDS, CARDS, DEFAULT_DECK, SOF_CARD_IDS } from './cards'
import { GAME_FORMATS } from '../content/formats'
import { CARD_SETS } from '../content/sets'
import { SET_IDS } from '../content/schema'
import {
  createDefaultFormatSelection,
  createDraftPool,
  normalizeDeckFormatSelection,
  getFormatCardPool,
  validateDeck,
} from './decks'
import { createGame, applyAction } from './rules'
import { createMatchConfig } from './match-config'

const setDeck = [
  'living_flame', 'living_flame',
  'living_smoke', 'living_smoke',
  'ash_hound', 'ash_hound',
  'pegasus_rider', 'pegasus_rider',
  'cathedral_guard', 'cathedral_guard',
  'wave_reader', 'wave_reader',
  'ripple_spirit', 'ripple_spirit',
  'battle_campfire', 'battle_campfire',
  'temple_prospect', 'temple_prospect',
  'moth_swarm', 'moth_swarm',
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

  test('모든 포맷에서 같은 카드는 최대 세 장까지 사용한다', () => {
    for (const format of Object.values(GAME_FORMATS)) {
      expect(format.maxCopiesPerCard).toBe(3)
    }
  })

  test('모든 카드에 올바른 세트와 수집 번호가 있다', () => {
    const sofIds = new Set<string>(SOF_CARD_IDS)
    for (const cardId of ALL_CARD_IDS) {
      const card = CARDS[cardId]
      expect(card.setId).toBe(sofIds.has(cardId) ? 'evolution-begins-001' : 'foundations-001')
      expect(card.collectorNumber).toMatch(sofIds.has(cardId) ? /^SOF-\d{3}$/ : /^DSF-\d{3}$/)
      expect(card.contentVersion).toBeTruthy()
    }
  })

  test('전체 카드전 카드 풀에는 DSF 40종과 SOF 40종이 모두 보인다', () => {
    const pool = getFormatCardPool({
      formatId: 'open-v1',
      selectedSetIds: [],
      draftPool: null,
    })

    expect(pool).toHaveLength(80)
    expect(pool.filter((cardId) => CARDS[cardId].setId === 'foundations-001')).toHaveLength(40)
    expect(pool.filter((cardId) => CARDS[cardId].setId === 'evolution-begins-001')).toHaveLength(40)
  })

  test('세트 한정전은 선택한 세트 카드만 허용한다', () => {
    const foundationsSelection = {
      formatId: 'set-constructed-v1' as const,
      selectedSetIds: ['foundations-001' as const],
      draftPool: null,
    }
    const evolutionSelection = {
      formatId: 'set-constructed-v1' as const,
      selectedSetIds: ['evolution-begins-001' as const],
      draftPool: null,
    }

    expect(validateDeck(setDeck, foundationsSelection).valid).toBe(true)
    expect(getFormatCardPool(foundationsSelection)).toContain('battle_campfire')
    expect(validateDeck(DEFAULT_DECK, foundationsSelection).valid).toBe(true)

    expect(getFormatCardPool(evolutionSelection)).toHaveLength(40)
    expect(getFormatCardPool(evolutionSelection).every(
      (cardId) => CARDS[cardId].setId === 'evolution-begins-001',
    )).toBe(true)
    expect(validateDeck(DEFAULT_DECK, evolutionSelection).valid).toBe(false)
  })

  test('공개 카드 세트는 DSF와 SOF 두 종류뿐이다', () => {
    expect(SET_IDS).toEqual(['foundations-001', 'evolution-begins-001'])
    expect(Object.keys(CARD_SETS)).toEqual(['foundations-001', 'evolution-begins-001'])
  })

  test('모든 포맷의 턴 시작 드로우는 2장이다', () => {
    for (const format of Object.values(GAME_FORMATS)) {
      expect(format.turnDrawCount).toBe(2)
    }
  })

  test('새 세트 한정 덱은 DSF와 SOF를 기본 카드 풀로 연다', () => {
    expect(createDefaultFormatSelection('set-constructed-v1').selectedSetIds).toEqual([
      'foundations-001',
      'evolution-begins-001',
    ])
  })

  test('삭제된 더미 세트가 저장 덱에 남아 있어도 DSF와 SOF로 복구한다', () => {
    const normalized = normalizeDeckFormatSelection({
      formatId: 'set-constructed-v1',
      selectedSetIds: ['confluence-001'] as never[],
      draftPool: null,
    })

    expect(normalized.selectedSetIds).toEqual([
      'foundations-001',
      'evolution-begins-001',
    ])
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

  test('드래프트는 50장 풀에서 20장 덱을 만든다', () => {
    const format = GAME_FORMATS['draft-v1']
    const pool = createDraftPool('pool-size-seed', 'draft-v1', 1)

    expect(format.draft).toMatchObject({ poolSize: 50, deckSize: 20 })
    expect(pool.cardIds).toHaveLength(50)
  })

  test('드래프트 덱은 생성된 풀의 수량을 넘을 수 없다', () => {
    const pool = createDraftPool('fixed-draft-seed', 'draft-v1', 1)
    const counts = new Map<keyof typeof CARDS, number>()
    const deck = pool.cardIds.filter((cardId) => {
      const nextCount = (counts.get(cardId) ?? 0) + 1
      if (nextCount > 3) return false
      counts.set(cardId, nextCount)
      return true
    }).slice(0, 20)
    const selection = {
      formatId: 'draft-v1' as const,
      selectedSetIds: [],
      draftPool: pool,
    }

    expect(deck).toHaveLength(20)
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
      startingPlayer: 'P1',
    })
    const next = applyAction(game, 'P1', { type: 'END_TURN' })
    expect(game.actionSequence).toBe(0)
    expect(next.actionSequence).toBe(1)
  })
})
