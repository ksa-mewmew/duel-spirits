import { describe, expect, test } from 'vitest'

import { DEFAULT_DECK } from './cards'
import {
  DECK_SIZE,
  DRAW_DECK_SIZE,
  LIFE_SIZE,
  STARTING_HAND_SIZE,
  applyAction,
  countPlayerCards,
  createGame,
} from './rules'

function createIdSource(): () => string {
  let nextId = 0
  return () => `test-${nextId++}`
}

describe('4 · 4 · 4 게임 시작', () => {
  test('각 플레이어에게 라이프 4, 손 4, 덱 4를 배분한다', () => {
    const game = createGame({
      random: () => 0.5,
      idSource: createIdSource(),
    })

    for (const playerId of ['P1', 'P2'] as const) {
      const player = game.players[playerId]
      expect(player.life).toHaveLength(LIFE_SIZE)
      expect(player.hand).toHaveLength(STARTING_HAND_SIZE)
      expect(player.deck).toHaveLength(DRAW_DECK_SIZE)
      expect(player.mana).toHaveLength(0)
      expect(countPlayerCards(player)).toBe(DECK_SIZE)
    }
  })

  test('플레이어별로 제출한 덱을 사용한다', () => {
    const p2Deck = [...DEFAULT_DECK]
    p2Deck[0] = 'wave_reader'

    const game = createGame({
      decks: {
        P1: [...DEFAULT_DECK],
        P2: p2Deck,
      },
      random: () => 0.5,
      idSource: createIdSource(),
    })

    const p2Cards = [
      ...game.players.P2.life,
      ...game.players.P2.hand,
      ...game.players.P2.deck,
    ]

    expect(p2Cards.some((card) => card.cardId === 'wave_reader')).toBe(true)
  })
})

describe('기본 행동', () => {
  test('손의 카드를 마나로 놓으면 즉시 준비된다', () => {
    const game = createGame({
      random: () => 0.5,
      idSource: createIdSource(),
    })
    const card = game.players.P1.hand[0]

    if (!card) throw new Error('테스트 카드를 찾지 못했습니다.')

    const next = applyAction(game, 'P1', {
      type: 'PLACE_MANA',
      cardInstanceId: card.instanceId,
    })

    expect(next.players.P1.mana).toHaveLength(1)
    expect(next.players.P1.mana[0]?.exhausted).toBe(false)
    expect(countPlayerCards(next.players.P1)).toBe(DECK_SIZE)
  })

  test('턴 종료 시 상대가 한 장 뽑는다', () => {
    const game = createGame({
      random: () => 0.5,
      idSource: createIdSource(),
    })
    const next = applyAction(game, 'P1', { type: 'END_TURN' })

    expect(next.currentPlayer).toBe('P2')
    expect(next.players.P2.hand).toHaveLength(5)
    expect(next.players.P2.deck).toHaveLength(3)
  })
})

describe('플레이어 선택 처리', () => {
  test('선택한 마나만 비용으로 소진한다', () => {
    const game = createGame({ random: () => 0.5, idSource: createIdSource() })
    game.players.P1.hand = [{ instanceId: 'spell', cardId: 'battle_campfire' }]
    game.players.P1.mana = [
      { instanceId: 'fire-mana', cardId: 'living_flame', exhausted: false },
      { instanceId: 'light-mana', cardId: 'pegasus_rider', exhausted: false },
      { instanceId: 'earth-mana', cardId: 'seeding_fairy', exhausted: false },
    ]

    const next = applyAction(game, 'P1', {
      type: 'PLAY_CARD',
      cardInstanceId: 'spell',
      manaIds: ['light-mana', 'fire-mana'],
    })

    expect(next.players.P1.mana.find((mana) => mana.instanceId === 'fire-mana')?.exhausted).toBe(true)
    expect(next.players.P1.mana.find((mana) => mana.instanceId === 'light-mana')?.exhausted).toBe(true)
    expect(next.players.P1.mana.find((mana) => mana.instanceId === 'earth-mana')?.exhausted).toBe(false)
  })

  test('대상 지정 주문은 선택한 몬스터에만 적용된다', () => {
    const game = createGame({ random: () => 0.5, idSource: createIdSource() })
    game.players.P1.hand = [{ instanceId: 'spell', cardId: 'reverse_current' }]
    game.players.P1.mana = [0, 1, 2].map((index) => ({
      instanceId: `mana-${index}`,
      cardId: 'ripple_spirit' as const,
      exhausted: false,
    }))
    game.players.P2.field = [
      {
        instanceId: 'first-target', cardId: 'ash_hound', damage: 0,
        exhausted: true, summonedThisTurn: false, attacksThisTurn: 0,
        temporaryAttackModifier: 0, temporaryHealthModifier: 0,
      },
      {
        instanceId: 'chosen-target', cardId: 'cathedral_guard', damage: 0,
        exhausted: true, summonedThisTurn: false, attacksThisTurn: 0,
        temporaryAttackModifier: 0, temporaryHealthModifier: 0,
      },
    ]

    const next = applyAction(game, 'P1', {
      type: 'PLAY_CARD',
      cardInstanceId: 'spell',
      manaIds: ['mana-0', 'mana-1', 'mana-2'],
      selection: { unitId: 'chosen-target' },
    })

    expect(next.players.P2.field.map((unit) => unit.instanceId)).toEqual(['first-target'])
    expect(next.players.P2.hand.some((card) => card.instanceId === 'chosen-target')).toBe(true)
  })

  test('물결을 읽는 자는 공개 후 플레이어 결정을 기다린다', () => {
    const game = createGame({ random: () => 0.5, idSource: createIdSource() })
    game.players.P1.hand = [{ instanceId: 'reader', cardId: 'wave_reader' }]
    game.players.P1.mana = [
      { instanceId: 'water-mana', cardId: 'ripple_spirit', exhausted: false },
    ]
    game.players.P1.deck = [{ instanceId: 'top-card', cardId: 'ash_hound' }]

    const choosing = applyAction(game, 'P1', {
      type: 'PLAY_CARD',
      cardInstanceId: 'reader',
      manaIds: ['water-mana'],
    })

    expect(choosing.pendingChoices[0]?.type).toBe('WAVE_READER_TOP')
    expect(choosing.players.P1.deck[0]?.instanceId).toBe('top-card')

    const resolved = applyAction(choosing, 'P1', {
      type: 'RESOLVE_CHOICE',
      choiceIds: ['discard'],
    })

    expect(resolved.pendingChoices).toHaveLength(0)
    expect(resolved.players.P1.deck).toHaveLength(0)
    expect(resolved.players.P1.discard.some((card) => card.instanceId === 'top-card')).toBe(true)
  })

  test('신전의 유망주는 라이프와 되돌릴 손 카드를 각각 선택한다', () => {
    const game = createGame({ random: () => 0.5, idSource: createIdSource() })
    game.players.P1.hand = [
      { instanceId: 'prospect', cardId: 'temple_prospect' },
      { instanceId: 'old-hand', cardId: 'living_flame' },
    ]
    game.players.P1.mana = [
      { instanceId: 'light-mana', cardId: 'pegasus_rider', exhausted: false },
    ]
    game.players.P1.life = [
      { instanceId: 'life-0', cardId: 'ash_hound' },
      { instanceId: 'life-1', cardId: 'wave_reader' },
    ]

    const firstChoice = applyAction(game, 'P1', {
      type: 'PLAY_CARD',
      cardInstanceId: 'prospect',
      manaIds: ['light-mana'],
    })
    expect(firstChoice.pendingChoices[0]?.type).toBe('TEMPLE_PROSPECT_LIFE')

    const secondChoice = applyAction(firstChoice, 'P1', {
      type: 'RESOLVE_CHOICE',
      choiceIds: ['life:1'],
    })
    expect(secondChoice.players.P1.hand.some((card) => card.instanceId === 'life-1')).toBe(true)
    expect(secondChoice.pendingChoices[0]?.type).toBe('TEMPLE_PROSPECT_HAND')

    const resolved = applyAction(secondChoice, 'P1', {
      type: 'RESOLVE_CHOICE',
      choiceIds: ['life-1'],
    })
    expect(resolved.players.P1.life.some((card) => card.instanceId === 'life-1')).toBe(true)
    expect(resolved.pendingChoices).toHaveLength(0)
  })

  test('각성으로 생긴 선택은 현재 턴이 아닌 플레이어도 해결한다', () => {
    const game = createGame({ random: () => 0.5, idSource: createIdSource() })
    game.pendingChoices = [{ type: 'HOLY_MIRROR_LIFE', playerId: 'P2' }]
    game.players.P1.life = [{ instanceId: 'target-life', cardId: 'living_flame' }]

    const resolved = applyAction(game, 'P2', {
      type: 'RESOLVE_CHOICE',
      choiceIds: ['life:0'],
    })

    expect(resolved.players.P1.life).toHaveLength(0)
    expect(resolved.players.P1.discard[0]?.instanceId).toBe('target-life')
  })
})
