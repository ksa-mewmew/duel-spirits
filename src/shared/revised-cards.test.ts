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

function mana(instanceId: string, cardId: CardId): ManaCardInstance {
  return { instanceId, cardId, exhausted: false }
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

describe('카드군 1 개정 능력', () => {
  test('화산쥐는 불 마나가 두 장 이상이면 소환한 턴에 돌진한다', () => {
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

    expect(attacked.players.P2.field[0]?.damage).toBe(1)
  })

  test('몰아치는 파도는 위의 두 장에서 물 몬스터 한 장을 손으로 가져오고 나머지를 아래에 둔다', () => {
    const game = createTestGame()
    game.players.P1.hand = [{ instanceId: 'wave', cardId: 'surging_wave' }]
    game.players.P1.mana = [
      mana('water-1', 'wave_reader'),
      mana('water-2', 'ripple_spirit'),
      mana('water-3', 'high_tide'),
    ]
    game.players.P1.deck = [
      { instanceId: 'water-unit', cardId: 'wave_reader' },
      { instanceId: 'fire-unit', cardId: 'living_flame' },
      { instanceId: 'third', cardId: 'ash_hound' },
    ]

    const choosing = applyAction(game, 'P1', {
      type: 'PLAY_CARD',
      cardInstanceId: 'wave',
      manaIds: ['water-1', 'water-2', 'water-3'],
      selection: { fieldSlot: 0 },
    })
    const resolved = applyAction(choosing, 'P1', {
      type: 'RESOLVE_CHOICE',
      choiceIds: ['take:water-unit'],
    })

    expect(resolved.players.P1.hand.some((card) => card.instanceId === 'water-unit')).toBe(true)
    expect(resolved.players.P1.deck.map((card) => card.instanceId)).toEqual(['third', 'fire-unit'])
  })

  test('불타는 행렬은 위의 네 장에서 비용 2 이하 불 몬스터를 최대 둘 소환한다', () => {
    const game = createTestGame()
    game.players.P1.hand = [{ instanceId: 'procession', cardId: 'burning_procession' }]
    game.players.P1.mana = [0, 1, 2, 3].map((index) => mana(`fire-${index}`, 'living_flame'))
    game.players.P1.deck = [
      { instanceId: 'eligible-1', cardId: 'living_flame' },
      { instanceId: 'eligible-2', cardId: 'ash_hound' },
      { instanceId: 'too-expensive', cardId: 'moth_swarm' },
      { instanceId: 'wrong-attribute', cardId: 'wave_reader' },
      { instanceId: 'left-in-deck', cardId: 'last_ember' },
    ]

    const choosing = applyAction(game, 'P1', {
      type: 'PLAY_CARD',
      cardInstanceId: 'procession',
      manaIds: ['fire-0', 'fire-1', 'fire-2', 'fire-3'],
    })
    const resolved = applyAction(choosing, 'P1', {
      type: 'RESOLVE_CHOICE',
      choiceIds: ['eligible-1@0', 'eligible-2@1'],
    })

    expect(resolved.players.P1.field.map((card) => card.instanceId)).toEqual(['eligible-1', 'eligible-2'])
    expect(resolved.players.P1.deck.map((card) => card.instanceId)).toEqual(['left-in-deck'])
    expect(resolved.players.P1.discard.some((card) => card.instanceId === 'too-expensive')).toBe(true)
    expect(resolved.players.P1.discard.some((card) => card.instanceId === 'wrong-attribute')).toBe(true)
  })

  test('파묘는 비용과 별도로 준비된 마나를 보내고 묘지에서 최대 두 장을 가져온다', () => {
    const game = createTestGame()
    game.players.P1.hand = [{ instanceId: 'grave', cardId: 'grave_digging' }]
    game.players.P1.mana = [
      mana('pay-1', 'living_flame'),
      mana('pay-2', 'living_flame'),
      mana('pay-3', 'living_flame'),
      mana('sacrifice', 'coffin_warrior'),
    ]
    game.players.P1.discard = [
      { instanceId: 'return-1', cardId: 'wave_reader' },
      { instanceId: 'return-2', cardId: 'ash_hound' },
    ]

    const choosing = applyAction(game, 'P1', {
      type: 'PLAY_CARD',
      cardInstanceId: 'grave',
      manaIds: ['pay-1', 'pay-2', 'pay-3'],
      selection: { effectManaId: 'sacrifice' },
    })
    const resolved = applyAction(choosing, 'P1', {
      type: 'RESOLVE_CHOICE',
      choiceIds: ['return-1', 'return-2'],
    })

    expect(resolved.players.P1.hand.map((card) => card.instanceId).sort()).toEqual(['return-1', 'return-2'])
    expect(resolved.players.P1.discard.some((card) => card.instanceId === 'sacrifice')).toBe(true)
    expect(resolved.players.P1.discard.some((card) => card.instanceId === 'grave')).toBe(true)
  })

  test('악마의 숨결은 남은 체력이 가장 높은 몬스터 중 선택한 한 장만 보낸다', () => {
    const game = createTestGame()
    game.players.P1.hand = [{ instanceId: 'breath', cardId: 'demon_breath' }]
    game.players.P1.mana = [0, 1, 2, 3, 4].map((index) => mana(`dark-${index}`, 'corpse_cat'))
    game.players.P2.field = [
      unit('highest-1', 'ripple_spirit', 0),
      unit('highest-2', 'cathedral_guard', 1),
      unit('lower', 'living_flame', 2),
    ]

    const resolved = applyAction(game, 'P1', {
      type: 'PLAY_CARD',
      cardInstanceId: 'breath',
      manaIds: ['dark-0', 'dark-1', 'dark-2', 'dark-3', 'dark-4'],
      selection: { unitId: 'highest-2' },
    })

    expect(resolved.players.P2.field.map((card) => card.instanceId)).toEqual(['highest-1', 'lower'])
  })

  test('준비된 성당 경비병은 비용 1 이하 몬스터의 공격을 막는다', () => {
    const game = createTestGame()
    game.players.P1.field = [unit('attacker', 'living_flame')]
    game.players.P2.field = [unit('guard', 'cathedral_guard')]

    expect(() => applyAction(game, 'P1', {
      type: 'ATTACK_UNIT',
      attackerId: 'attacker',
      defenderId: 'guard',
    })).toThrow('성당 경비병')
  })

  test('검푸른 들개는 준비된 몬스터를 공격할 수 없지만 소진된 몬스터는 공격할 수 있다', () => {
    const game = createTestGame()
    game.players.P1.field = [unit('hound', 'blue_black_hound')]
    game.players.P2.field = [unit('target', 'rock_armor_knight')]

    expect(() => applyAction(game, 'P1', {
      type: 'ATTACK_UNIT',
      attackerId: 'hound',
      defenderId: 'target',
    })).toThrow('준비된 몬스터')

    game.players.P2.field[0]!.exhausted = true
    const attacked = applyAction(game, 'P1', {
      type: 'ATTACK_UNIT',
      attackerId: 'hound',
      defenderId: 'target',
    })
    expect(attacked.players.P2.field).toHaveLength(0)
  })

  test('하늘까지 자라난 새싹은 공격력 1 몬스터에게 이번 턴 동안 비행을 준다', () => {
    const game = createTestGame()
    game.players.P1.hand = [{ instanceId: 'sprout', cardId: 'overgrown_sprout' }]
    game.players.P1.mana = [
      mana('earth-1', 'tree_fairy'),
      mana('earth-2', 'seeding_fairy'),
      mana('earth-3', 'heavy_seed'),
      mana('earth-4', 'rock_armor_knight'),
    ]
    game.players.P1.field = [
      unit('attack-one', 'seeding_fairy'),
      unit('attack-two', 'living_flame', 1),
    ]

    const used = applyAction(game, 'P1', {
      type: 'PLAY_CARD',
      cardInstanceId: 'sprout',
      manaIds: ['earth-1', 'earth-2', 'earth-3', 'earth-4'],
    })
    expect(used.players.P1.field.find((card) => card.instanceId === 'attack-one')?.temporaryFlying).toBe(true)
    expect(used.players.P1.field.find((card) => card.instanceId === 'attack-two')?.temporaryFlying).not.toBe(true)

    const ended = applyAction(used, 'P1', { type: 'END_TURN' })
    expect(ended.players.P1.field.find((card) => card.instanceId === 'attack-one')?.temporaryFlying).toBe(false)
  })

  test('악마의 손가락이 죽으면 상대가 버릴 손 카드 한 장을 고른다', () => {
    const game = createTestGame()
    game.currentPlayer = 'P2'
    game.players.P1.field = [unit('finger', 'demon_finger')]
    game.players.P2.field = [unit('killer', 'floating_mountains')]
    game.players.P2.hand = [
      { instanceId: 'keep', cardId: 'wave_reader' },
      { instanceId: 'discard-me', cardId: 'living_flame' },
    ]

    const choosing = applyAction(game, 'P2', {
      type: 'ATTACK_UNIT',
      attackerId: 'killer',
      defenderId: 'finger',
    })
    expect(choosing.pendingChoices[0]).toEqual({
      type: 'DEMON_FINGER_DISCARD',
      playerId: 'P2',
    })

    const resolved = applyAction(choosing, 'P2', {
      type: 'RESOLVE_CHOICE',
      choiceIds: ['discard-me'],
    })
    expect(resolved.players.P2.hand.map((card) => card.instanceId)).toEqual(['keep'])
    expect(resolved.players.P2.discard.some((card) => card.instanceId === 'discard-me')).toBe(true)
  })
})
