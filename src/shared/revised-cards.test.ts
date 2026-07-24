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
  test('화산쥐는 불 마나가 둘 이상일 때만 비용 0으로 소환할 수 있다', () => {
    const blocked = createTestGame()
    blocked.players.P1.hand = [{ instanceId: 'mouse', cardId: 'volcano_mouse' }]
    blocked.players.P1.mana = [mana('fire-1', 'living_flame')]
    expect(() => applyAction(blocked, 'P1', {
      type: 'PLAY_CARD',
      cardInstanceId: 'mouse',
      manaIds: [],
      selection: { fieldSlot: 0 },
    })).toThrow('불 카드가 2장 이상')

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
      manaIds: [],
      selection: { fieldSlot: 0 },
    })
    expect(summoned.players.P1.mana.every((card) => !card.exhausted)).toBe(true)
    expect(() => applyAction(summoned, 'P1', {
      type: 'ATTACK_UNIT',
      attackerId: 'mouse',
      defenderId: 'target',
    })).toThrow('이번 턴에 소환된 몬스터')
  })

  test('화산쥐의 소환 조건은 불타는 행렬 같은 효과 소환에도 적용된다', () => {
    const blocked = createTestGame()
    blocked.players.P1.hand = [{ instanceId: 'procession', cardId: 'burning_procession' }]
    blocked.players.P1.mana = [
      mana('w1', 'wave_reader'), mana('w2', 'ripple_spirit'),
      mana('w3', 'high_tide'), mana('w4', 'reverse_current'),
    ]
    blocked.players.P1.deck = [
      { instanceId: 'mouse-top', cardId: 'volcano_mouse' },
      { instanceId: 'flame-top', cardId: 'living_flame' },
      { instanceId: 'other-top', cardId: 'tree_fairy' },
    ]
    const blockedChoice = applyAction(blocked, 'P1', {
      type: 'PLAY_CARD',
      cardInstanceId: 'procession',
      manaIds: ['w1', 'w2', 'w3', 'w4'],
    })
    expect(() => applyAction(blockedChoice, 'P1', {
      type: 'RESOLVE_CHOICE',
      choiceIds: ['mouse-top@0'],
    })).toThrow('소환할 수 없는 카드')

    const allowed = createTestGame()
    allowed.players.P1.hand = [{ instanceId: 'procession', cardId: 'burning_procession' }]
    allowed.players.P1.mana = [
      mana('f1', 'living_flame'), mana('f2', 'living_smoke'),
      mana('w1', 'wave_reader'), mana('w2', 'ripple_spirit'),
    ]
    allowed.players.P1.deck = [
      { instanceId: 'mouse-top', cardId: 'volcano_mouse' },
      { instanceId: 'flame-top', cardId: 'living_flame' },
      { instanceId: 'other-top', cardId: 'tree_fairy' },
    ]
    const allowedChoice = applyAction(allowed, 'P1', {
      type: 'PLAY_CARD',
      cardInstanceId: 'procession',
      manaIds: ['f1', 'f2', 'w1', 'w2'],
    })
    const summoned = applyAction(allowedChoice, 'P1', {
      type: 'RESOLVE_CHOICE',
      choiceIds: ['mouse-top@0'],
    })
    expect(summoned.players.P1.field).toContainEqual(
      expect.objectContaining({ instanceId: 'mouse-top', cardId: 'volcano_mouse' }),
    )
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

  test('나무에 사는 요정이 마나에 놓이면 손 카드 한 장을 추가로 준비 마나에 놓을 수 있다', () => {
    const handGame = createTestGame()
    handGame.players.P1.hand = [
      { instanceId: 'tree-hand', cardId: 'tree_fairy' },
      { instanceId: 'extra-hand', cardId: 'ash_hound' },
    ]

    const choosingFromHand = applyAction(handGame, 'P1', {
      type: 'PLACE_MANA',
      cardInstanceId: 'tree-hand',
    })
    expect(choosingFromHand.pendingChoices[0]).toMatchObject({
      effect: 'TREE_FAIRY_HAND_MANA',
      candidateIds: ['extra-hand'],
    })
    const placedFromHand = applyAction(choosingFromHand, 'P1', {
      type: 'RESOLVE_CHOICE',
      choiceIds: ['extra-hand'],
    })
    expect(placedFromHand.players.P1.mana).toEqual(expect.arrayContaining([
      expect.objectContaining({ instanceId: 'tree-hand', exhausted: false }),
      expect.objectContaining({ instanceId: 'extra-hand', exhausted: false }),
    ]))

    const effectGame = createTestGame()
    effectGame.players.P1.hand = [
      { instanceId: 'seeder', cardId: 'seeding_fairy' },
      { instanceId: 'effect-extra', cardId: 'living_flame' },
    ]
    effectGame.players.P1.mana = [mana('earth-1', 'heavy_seed')]
    effectGame.players.P1.deck = [{ instanceId: 'tree-effect', cardId: 'tree_fairy' }]

    const choosingFromEffect = applyAction(effectGame, 'P1', {
      type: 'PLAY_CARD',
      cardInstanceId: 'seeder',
      manaIds: ['earth-1'],
      selection: { fieldSlot: 0 },
    })
    expect(choosingFromEffect.players.P1.mana).toContainEqual(
      expect.objectContaining({ instanceId: 'tree-effect', exhausted: true }),
    )
    expect(choosingFromEffect.pendingChoices[0]).toMatchObject({ effect: 'TREE_FAIRY_HAND_MANA' })
    const placedByEffect = applyAction(choosingFromEffect, 'P1', {
      type: 'RESOLVE_CHOICE',
      choiceIds: ['effect-extra'],
    })
    expect(placedByEffect.players.P1.mana).toContainEqual(
      expect.objectContaining({ instanceId: 'effect-extra', exhausted: false }),
    )
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

  test('검푸른 들개는 어둠 공명을 충족했을 때만 소환된 턴에 돌진하며 직접 공격할 수 없다', () => {
    const resonant = createTestGame()
    resonant.players.P1.hand = [{ instanceId: 'hound', cardId: 'blue_black_hound' }]
    resonant.players.P1.mana = [
      mana('dark', 'corpse_cat'),
      mana('earth', 'tree_fairy'),
    ]
    resonant.players.P2.field = [unit('target', 'rock_armor_knight')]

    const summoned = applyAction(resonant, 'P1', {
      type: 'PLAY_CARD',
      cardInstanceId: 'hound',
      manaIds: ['dark', 'earth'],
      selection: { fieldSlot: 0 },
    })
    expect(summoned.players.P1.field[0]?.temporaryCharge).toBe(true)
    const attacked = applyAction(summoned, 'P1', {
      type: 'ATTACK_UNIT',
      attackerId: 'hound',
      defenderId: 'target',
    })
    expect(attacked.players.P2.field).toHaveLength(0)

    const nonResonant = createTestGame()
    nonResonant.players.P1.hand = [{ instanceId: 'hound-2', cardId: 'blue_black_hound' }]
    nonResonant.players.P1.mana = [
      mana('earth-1', 'tree_fairy'),
      mana('earth-2', 'seeding_fairy'),
    ]
    nonResonant.players.P2.field = [unit('target-2', 'rock_armor_knight')]
    const noCharge = applyAction(nonResonant, 'P1', {
      type: 'PLAY_CARD',
      cardInstanceId: 'hound-2',
      manaIds: ['earth-1', 'earth-2'],
      selection: { fieldSlot: 0 },
    })
    expect(noCharge.players.P1.field[0]?.temporaryCharge).not.toBe(true)
    expect(() => applyAction(noCharge, 'P1', {
      type: 'ATTACK_UNIT',
      attackerId: 'hound-2',
      defenderId: 'target-2',
    })).toThrow('이번 턴에 소환된 몬스터')

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
