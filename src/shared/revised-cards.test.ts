import { describe, expect, test } from 'vitest'

import { applyAction, createGame } from './rules'

import type { CardId } from './cards'
import type { ManaCardInstance, UnitInstance } from './types'

function createIdSource(): () => string {
  let nextId = 0
  return () => `revised-${nextId++}`
}

function createTestGame() {
  return createGame({
    random: () => 0.5,
    idSource: createIdSource(),
    startingPlayer: 'P1',
  })
}

function mana(instanceId: string, cardId: CardId, exhausted = false): ManaCardInstance {
  return { instanceId, cardId, exhausted }
}

function unit(
  instanceId: string,
  cardId: CardId,
  slotIndex = 0,
  overrides: Partial<UnitInstance> = {},
): UnitInstance {
  return {
    instanceId,
    cardId,
    slotIndex,
    battlefieldEntrySeq: slotIndex + 1,
    damage: 0,
    exhausted: false,
    summonedThisTurn: false,
    attacksThisTurn: 0,
    temporaryAttackModifier: 0,
    temporaryHealthModifier: 0,
    ...overrides,
  }
}

describe('카드군 1 최신 능력', () => {
  test('화산쥐는 항상 돌진하며 불 마나가 둘 이상이면 공격력 2로 전투한다', () => {
    const game = createTestGame()
    game.players.P1.hand = [{ instanceId: 'mouse', cardId: 'volcano_mouse' }]
    game.players.P1.mana = [
      mana('fire-1', 'living_flame'),
      mana('fire-2', 'living_smoke'),
    ]
    game.players.P2.field = [unit('target', 'rock_armor_knight')]

    const summoned = applyAction(game, 'P1', {
      type: 'PLAY_CARD',
      cardInstanceId: 'mouse',
      manaIds: ['fire-1'],
      selection: { fieldSlot: 0 },
    })
    const attacked = applyAction(summoned, 'P1', {
      type: 'ATTACK_UNIT',
      attackerId: 'mouse',
      defenderId: 'target',
    })

    expect(attacked.players.P2.field[0]?.damage).toBe(2)
  })

  test('살아 움직이는 연기는 전투에서만 공격력 2를 얻는다', () => {
    const game = createTestGame()
    game.players.P1.field = [unit('smoke', 'living_smoke')]
    game.players.P2.field = [unit('target', 'rock_armor_knight')]

    const attacked = applyAction(game, 'P1', {
      type: 'ATTACK_UNIT',
      attackerId: 'smoke',
      defenderId: 'target',
    })

    expect(attacked.players.P2.field[0]?.damage).toBe(2)
    expect(attacked.players.P1.field[0]?.damage).toBe(2)
  })

  test('잔물결 정령은 손에서 정상 소환하면 카드 한 장을 뽑는다', () => {
    const game = createTestGame()
    game.players.P1.hand = [{ instanceId: 'ripple', cardId: 'ripple_spirit' }]
    game.players.P1.mana = [mana('water-1', 'wave_reader'), mana('water-2', 'high_tide')]
    game.players.P1.deck = [{ instanceId: 'drawn', cardId: 'living_flame' }]

    const next = applyAction(game, 'P1', {
      type: 'PLAY_CARD',
      cardInstanceId: 'ripple',
      manaIds: ['water-1', 'water-2'],
      selection: { fieldSlot: 0 },
    })

    expect(next.players.P1.hand).toContainEqual(expect.objectContaining({ instanceId: 'drawn' }))
  })

  test('몰아치는 파도는 비용 2 이하 물 몬스터를 출현 없이 소환한다', () => {
    const game = createTestGame()
    game.players.P1.hand = [{ instanceId: 'wave', cardId: 'surging_wave' }]
    game.players.P1.mana = [
      mana('water-1', 'wave_reader'),
      mana('water-2', 'high_tide'),
      mana('water-3', 'reverse_current'),
    ]
    game.players.P1.deck = [
      { instanceId: 'ripple-top', cardId: 'ripple_spirit' },
      { instanceId: 'fire-top', cardId: 'living_flame' },
      { instanceId: 'draw-marker', cardId: 'ash_hound' },
    ]

    const choosing = applyAction(game, 'P1', {
      type: 'PLAY_CARD',
      cardInstanceId: 'wave',
      manaIds: ['water-1', 'water-2', 'water-3'],
      selection: { fieldSlot: 0 },
    })
    const resolved = applyAction(choosing, 'P1', {
      type: 'RESOLVE_CHOICE',
      choiceIds: ['summon:ripple-top@1'],
    })

    expect(resolved.players.P1.field.map((card) => card.instanceId)).toEqual(['wave', 'ripple-top'])
    expect(resolved.players.P1.hand).toHaveLength(0)
    expect(resolved.players.P1.deck.map((card) => card.instanceId)).toEqual(['draw-marker', 'fire-top'])
  })

  test('나무에 사는 요정은 손에서 직접 마나로 놓을 때는 뽑지 않고 효과로 놓일 때만 뽑는다', () => {
    const handGame = createTestGame()
    handGame.players.P1.hand = [{ instanceId: 'tree-hand', cardId: 'tree_fairy' }]
    handGame.players.P1.deck = [{ instanceId: 'not-drawn', cardId: 'ash_hound' }]

    const placedFromHand = applyAction(handGame, 'P1', {
      type: 'PLACE_MANA',
      cardInstanceId: 'tree-hand',
    })
    expect(placedFromHand.players.P1.hand).toHaveLength(0)
    expect(placedFromHand.players.P1.deck[0]?.instanceId).toBe('not-drawn')

    const effectGame = createTestGame()
    effectGame.players.P1.hand = [{ instanceId: 'seeder', cardId: 'seeding_fairy' }]
    effectGame.players.P1.mana = [mana('earth-1', 'heavy_seed'), mana('earth-2', 'rock_armor_knight')]
    effectGame.players.P1.deck = [
      { instanceId: 'tree-effect', cardId: 'tree_fairy' },
      { instanceId: 'drawn', cardId: 'ash_hound' },
    ]

    const placedByEffect = applyAction(effectGame, 'P1', {
      type: 'PLAY_CARD',
      cardInstanceId: 'seeder',
      manaIds: ['earth-1', 'earth-2'],
      selection: { fieldSlot: 0 },
    })
    expect(placedByEffect.players.P1.hand).toContainEqual(expect.objectContaining({ instanceId: 'drawn' }))
  })

  test('이름 없는 그림자는 묘지 세 장 이상이면 전투한 상대를 암살한다', () => {
    const game = createTestGame()
    game.players.P1.discard = [
      { instanceId: 'd1', cardId: 'demon_breath' },
      { instanceId: 'd2', cardId: 'corpse_cat' },
      { instanceId: 'd3', cardId: 'grave_digging' },
    ]
    game.players.P1.field = [unit('shadow', 'nameless_shadow')]
    game.players.P2.field = [unit('knight', 'rock_armor_knight')]

    const attacked = applyAction(game, 'P1', {
      type: 'ATTACK_UNIT',
      attackerId: 'shadow',
      defenderId: 'knight',
    })

    expect(attacked.players.P2.field).toHaveLength(0)
    expect(attacked.players.P2.discard).toContainEqual(expect.objectContaining({ instanceId: 'knight' }))
  })

  test('시체를 먹는 까마귀는 잠행이며 고립이면 비행으로 직접 공격할 수 있다', () => {
    const game = createTestGame()
    game.players.P1.field = [unit('crow', 'carrion_crow')]
    game.players.P2.field = [unit('blocker', 'rock_armor_knight')]
    game.players.P2.life = [{ instanceId: 'life', cardId: 'living_flame', lifeSlotIndex: 0 }]

    const attacked = applyAction(game, 'P1', {
      type: 'ATTACK_PLAYER',
      attackerId: 'crow',
      lifeSlotIndices: [0],
    })

    expect(attacked.players.P2.life).toHaveLength(0)
  })

  test('검푸른 들개는 준비된 몬스터도 공격할 수 있지만 직접 공격할 수 없다', () => {
    const game = createTestGame()
    game.players.P1.field = [unit('hound', 'blue_black_hound')]
    game.players.P2.field = [unit('target', 'rock_armor_knight')]

    const attacked = applyAction(game, 'P1', {
      type: 'ATTACK_UNIT',
      attackerId: 'hound',
      defenderId: 'target',
    })
    expect(attacked.players.P2.field).toHaveLength(0)

    const directGame = createTestGame()
    directGame.players.P1.field = [unit('direct-hound', 'blue_black_hound')]
    directGame.players.P2.field = []
    directGame.players.P2.life = [{ instanceId: 'life', cardId: 'living_flame', lifeSlotIndex: 0 }]
    expect(() => applyAction(directGame, 'P1', {
      type: 'ATTACK_PLAYER',
      attackerId: 'direct-hound',
      lifeSlotIndices: [0],
    })).toThrow('직접 공격할 수 없습니다')
  })

  test('한 턴에 어둠 카드 두 장이 묘지로 가면 관 속의 전사를 비용 없이 낸다', () => {
    const game = createTestGame()
    game.players.P1.hand = [
      { instanceId: 'grave', cardId: 'grave_digging' },
      { instanceId: 'coffin', cardId: 'coffin_warrior' },
    ]
    game.players.P1.mana = [
      mana('pay-1', 'living_flame'),
      mana('pay-2', 'living_flame'),
      mana('pay-3', 'living_flame'),
      mana('dark-sacrifice', 'corpse_cat'),
    ]

    const choosing = applyAction(game, 'P1', {
      type: 'PLAY_CARD',
      cardInstanceId: 'grave',
      manaIds: ['pay-1', 'pay-2', 'pay-3'],
      selection: { effectManaId: 'dark-sacrifice' },
    })
    const afterGrave = applyAction(choosing, 'P1', {
      type: 'RESOLVE_CHOICE',
      choiceIds: [],
    })

    expect(afterGrave.players.P1.darkCardsDiscardedThisTurn).toBe(2)
    const afterCoffin = applyAction(afterGrave, 'P1', {
      type: 'PLAY_CARD',
      cardInstanceId: 'coffin',
      manaIds: [],
      selection: { fieldSlot: 0 },
    })
    expect(afterCoffin.players.P1.field).toContainEqual(expect.objectContaining({ instanceId: 'coffin' }))
  })

  test('관 속의 전사 무료 조건은 턴이 끝나면 초기화된다', () => {
    const game = createTestGame()
    game.players.P1.darkCardsDiscardedThisTurn = 2
    const next = applyAction(game, 'P1', { type: 'END_TURN' })
    expect(next.players.P1.darkCardsDiscardedThisTurn).toBe(0)
    expect(next.players.P2.darkCardsDiscardedThisTurn).toBe(0)
  })
})
