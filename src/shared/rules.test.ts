import { describe, expect, test } from 'vitest'

import { DEFAULT_DECK } from './cards'
import {
  DECK_SIZE,
  DRAW_DECK_SIZE,
  LIFE_SIZE,
  STARTING_HAND_SIZE,
  applyAction,
  collectDeadUnitsInResolutionOrder,
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
        slotIndex: 0,
        battlefieldEntrySeq: 1,
        exhausted: true, summonedThisTurn: false, attacksThisTurn: 0,
        temporaryAttackModifier: 0, temporaryHealthModifier: 0,
      },
      {
        instanceId: 'chosen-target', cardId: 'cathedral_guard', damage: 0,
        slotIndex: 1,
        battlefieldEntrySeq: 2,
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
      selection: { fieldSlot: 0 },
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
      { instanceId: 'life-0', cardId: 'ash_hound', lifeSlotIndex: 0 },
      { instanceId: 'life-1', cardId: 'wave_reader', lifeSlotIndex: 2 },
    ]

    const firstChoice = applyAction(game, 'P1', {
      type: 'PLAY_CARD',
      cardInstanceId: 'prospect',
      manaIds: ['light-mana'],
      selection: { fieldSlot: 0 },
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
    expect(resolved.players.P1.life.find((card) => card.instanceId === 'life-1')).toMatchObject({
      lifeSlotIndex: 2,
    })
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

describe('카드 상호작용 보강', () => {
  test('씨 뿌리는 요정으로 나무에 사는 요정이 마나에 놓여도 1장 뽑는다', () => {
    const game = createGame({ random: () => 0.5, idSource: createIdSource() })
    game.players.P1.hand = [{ instanceId: 'seeder', cardId: 'seeding_fairy' }]
    game.players.P1.mana = [
      { instanceId: 'earth-mana', cardId: 'seeding_fairy', exhausted: false },
    ]
    game.players.P1.deck = [
      { instanceId: 'tree-on-top', cardId: 'tree_fairy' },
      { instanceId: 'drawn-card', cardId: 'ash_hound' },
    ]

    const next = applyAction(game, 'P1', {
      type: 'PLAY_CARD',
      cardInstanceId: 'seeder',
      manaIds: ['earth-mana'],
      selection: { fieldSlot: 0 },
    })

    expect(next.players.P1.mana.find((card) => card.instanceId === 'tree-on-top')).toMatchObject({
      cardId: 'tree_fairy',
      exhausted: true,
    })
    expect(next.players.P1.hand.some((card) => card.instanceId === 'drawn-card')).toBe(true)
  })

  test('고립은 전장 상태가 바뀌면 즉시 활성화·비활성화된다', () => {
    const game = createGame({ random: () => 0.5, idSource: createIdSource() })
    game.players.P1.field = [{
      instanceId: 'ember', cardId: 'last_ember', damage: 0,
      slotIndex: 0,
      battlefieldEntrySeq: 1,
      exhausted: false, summonedThisTurn: false, attacksThisTurn: 0,
      temporaryAttackModifier: 0, temporaryHealthModifier: 0,
    }]
    game.players.P2.field = [{
      instanceId: 'first-defender', cardId: 'tree_fairy', damage: 0,
      slotIndex: 0,
      battlefieldEntrySeq: 2,
      exhausted: false, summonedThisTurn: false, attacksThisTurn: 0,
      temporaryAttackModifier: 0, temporaryHealthModifier: 10,
    }]

    const isolatedAttack = applyAction(game, 'P1', {
      type: 'ATTACK_UNIT',
      attackerId: 'ember',
      defenderId: 'first-defender',
    })

    expect(isolatedAttack.players.P1.field[0]).toMatchObject({
      instanceId: 'ember',
      attacksThisTurn: 1,
      exhausted: true,
    })
    expect(isolatedAttack.players.P2.field[0]?.damage).toBe(4)

    const notIsolated = createGame({ random: () => 0.5, idSource: createIdSource(), startingPlayer: 'P1' })
    notIsolated.players.P1.field = [
      {
        instanceId: 'ember-2', cardId: 'last_ember', damage: 0, slotIndex: 0,
        battlefieldEntrySeq: 1,
        exhausted: false, summonedThisTurn: false, attacksThisTurn: 0,
        temporaryAttackModifier: 0, temporaryHealthModifier: 0,
      },
      {
        instanceId: 'ally', cardId: 'living_flame', damage: 0, slotIndex: 1,
        battlefieldEntrySeq: 2,
        exhausted: false, summonedThisTurn: false, attacksThisTurn: 0,
        temporaryAttackModifier: 0, temporaryHealthModifier: 0,
      },
    ]
    notIsolated.players.P2.field = [{
      instanceId: 'second-defender', cardId: 'rock_armor_knight', damage: 0, slotIndex: 2,
      battlefieldEntrySeq: 3,
      exhausted: false, summonedThisTurn: false, attacksThisTurn: 0,
      temporaryAttackModifier: 0, temporaryHealthModifier: 10,
    }]
    const normalAttack = applyAction(notIsolated, 'P1', {
      type: 'ATTACK_UNIT', attackerId: 'ember-2', defenderId: 'second-defender',
    })
    expect(normalAttack.players.P2.field[0]?.damage).toBe(2)
  })

  test('잿빛 들개는 소환된 턴에 몬스터만 돌진 공격할 수 있다', () => {
    const game = createGame({ random: () => 0.5, idSource: createIdSource() })
    game.players.P1.hand = [{ instanceId: 'hound', cardId: 'ash_hound' }]
    game.players.P1.mana = [
      { instanceId: 'mana-1', cardId: 'living_flame', exhausted: false },
      { instanceId: 'mana-2', cardId: 'living_smoke', exhausted: false },
    ]
    game.players.P2.field = [{
      instanceId: 'defender', cardId: 'rock_armor_knight', damage: 0,
      slotIndex: 0,
      battlefieldEntrySeq: 1,
      exhausted: false, summonedThisTurn: false, attacksThisTurn: 0,
      temporaryAttackModifier: 0, temporaryHealthModifier: 0,
    }]

    const summoned = applyAction(game, 'P1', {
      type: 'PLAY_CARD',
      cardInstanceId: 'hound',
      manaIds: ['mana-1', 'mana-2'],
      selection: { fieldSlot: 0 },
    })
    const attacked = applyAction(summoned, 'P1', {
      type: 'ATTACK_UNIT',
      attackerId: 'hound',
      defenderId: 'defender',
    })
    expect(attacked.players.P2.field[0]?.damage).toBe(3)

    const directGame = createGame({ random: () => 0.5, idSource: createIdSource() })
    directGame.players.P1.hand = [{ instanceId: 'direct-hound', cardId: 'ash_hound' }]
    directGame.players.P1.mana = [
      { instanceId: 'direct-mana-1', cardId: 'living_flame', exhausted: false },
      { instanceId: 'direct-mana-2', cardId: 'living_smoke', exhausted: false },
    ]
    directGame.players.P2.field = []
    const directSummoned = applyAction(directGame, 'P1', {
      type: 'PLAY_CARD',
      cardInstanceId: 'direct-hound',
      manaIds: ['direct-mana-1', 'direct-mana-2'],
      selection: { fieldSlot: 0 },
    })

    expect(() => applyAction(directSummoned, 'P1', {
      type: 'ATTACK_PLAYER',
      attackerId: 'direct-hound',
      lifeIndices: [0],
    })).toThrow('돌진 몬스터는 소환된 턴에 상대 몬스터만 공격할 수 있습니다.')
  })

  test('상대 턴에 각성한 카드의 선택을 라이프 소유자가 처리한다', () => {
    const game = createGame({ random: () => 0.5, idSource: createIdSource() })
    game.players.P1.field = [{
      instanceId: 'attacker', cardId: 'living_flame', damage: 0,
      slotIndex: 0,
      battlefieldEntrySeq: 1,
      exhausted: false, summonedThisTurn: false, attacksThisTurn: 0,
      temporaryAttackModifier: 0, temporaryHealthModifier: 0,
    }]
    game.players.P1.life = [{ instanceId: 'p1-life', cardId: 'ash_hound' }]
    game.players.P2.field = []
    game.players.P2.life = [
      { instanceId: 'mirror-life', cardId: 'holy_mirror_wall' },
      { instanceId: 'other-life', cardId: 'wave_reader' },
    ]

    const awakened = applyAction(game, 'P1', {
      type: 'ATTACK_PLAYER',
      attackerId: 'attacker',
      lifeIndices: [0],
    })

    expect(awakened.currentPlayer).toBe('P1')
    expect(awakened.pendingChoices[0]).toEqual({
      type: 'HOLY_MIRROR_LIFE',
      playerId: 'P2',
    })
    expect(awakened.players.P2.discard.some((card) => card.instanceId === 'mirror-life')).toBe(true)

    const resolved = applyAction(awakened, 'P2', {
      type: 'RESOLVE_CHOICE',
      choiceIds: ['life:0'],
    })
    expect(resolved.currentPlayer).toBe('P1')
    expect(resolved.pendingChoices).toHaveLength(0)
    expect(resolved.players.P1.life).toHaveLength(0)
    expect(resolved.players.P1.discard[0]?.instanceId).toBe('p1-life')
  })
})


describe('선공과 전장 슬롯', () => {
  test('선공은 난수에 따라 P1 또는 P2로 정해진다', () => {
    expect(createGame({ random: () => 0.1, idSource: createIdSource() }).currentPlayer).toBe('P1')
    expect(createGame({ random: () => 0.9, idSource: createIdSource() }).currentPlayer).toBe('P2')
  })

  test('소환 위치를 선택하고 다른 카드가 떠나도 슬롯 정보가 유지된다', () => {
    const game = createGame({ random: () => 0.5, idSource: createIdSource(), startingPlayer: 'P1' })
    game.players.P1.hand = [{ instanceId: 'flame', cardId: 'living_flame' }]
    game.players.P1.mana = [{ instanceId: 'mana', cardId: 'living_flame', exhausted: false }]
    game.players.P1.field = [{
      instanceId: 'left', cardId: 'volcano_mouse', slotIndex: 0, damage: 0,
      battlefieldEntrySeq: 1,
      exhausted: false, summonedThisTurn: false, attacksThisTurn: 0,
      temporaryAttackModifier: 0, temporaryHealthModifier: 0,
    }]

    const summoned = applyAction(game, 'P1', {
      type: 'PLAY_CARD', cardInstanceId: 'flame', manaIds: ['mana'], selection: { fieldSlot: 3 },
    })
    expect(summoned.players.P1.field.map((unit) => [unit.instanceId, unit.slotIndex]))
      .toEqual([['left', 0], ['flame', 3]])
  })

  test('마지막 불씨의 유언은 전장에서 묘지로 갈 때 카드 1장을 뽑는다', () => {
    const game = createGame({ random: () => 0.5, idSource: createIdSource(), startingPlayer: 'P1' })
    game.players.P1.field = [{
      instanceId: 'ember-death', cardId: 'last_ember', slotIndex: 2, damage: 0,
      battlefieldEntrySeq: 1,
      exhausted: false, summonedThisTurn: false, attacksThisTurn: 0,
      temporaryAttackModifier: 0, temporaryHealthModifier: 0,
    }]
    game.players.P1.deck = [{ instanceId: 'draw-after-death', cardId: 'wave_reader' }]
    game.players.P2.field = [{
      instanceId: 'killer', cardId: 'blue_black_hound', slotIndex: 1, damage: 0,
      battlefieldEntrySeq: 2,
      exhausted: false, summonedThisTurn: false, attacksThisTurn: 0,
      temporaryAttackModifier: 0, temporaryHealthModifier: 0,
    }]
    game.currentPlayer = 'P2'

    const next = applyAction(game, 'P2', {
      type: 'ATTACK_UNIT', attackerId: 'killer', defenderId: 'ember-death',
    })
    expect(next.players.P1.field).toHaveLength(0)
    expect(next.players.P1.discard.some((card) => card.instanceId === 'ember-death')).toBe(true)
    expect(next.players.P1.hand.some((card) => card.instanceId === 'draw-after-death')).toBe(true)
  })

  test('동시에 죽은 유닛은 전장 등장 순서대로 정렬된다', () => {
    const game = createGame({ random: () => 0.5, idSource: createIdSource() })
    game.players.P1.field = [
      {
        instanceId: 'later-on-board', cardId: 'last_ember', damage: 10,
        slotIndex: 0,
        battlefieldEntrySeq: 20,
        exhausted: false, summonedThisTurn: false, attacksThisTurn: 0,
        temporaryAttackModifier: 0, temporaryHealthModifier: 0,
      },
      {
        instanceId: 'earlier-on-board', cardId: 'last_ember', damage: 10,
        slotIndex: 1,
        battlefieldEntrySeq: 10,
        exhausted: false, summonedThisTurn: false, attacksThisTurn: 0,
        temporaryAttackModifier: 0, temporaryHealthModifier: 0,
      },
    ]

    expect(collectDeadUnitsInResolutionOrder(game).map((unit) => unit.instanceId))
      .toEqual(['earlier-on-board', 'later-on-board'])
  })
})

describe('고정 라이프 슬롯', () => {
  test('가운데 라이프를 공격하면 그 슬롯만 비고 나머지 슬롯은 유지된다', () => {
    const game = createGame({
      random: () => 0.5,
      idSource: createIdSource(),
      startingPlayer: 'P1',
    })
    game.players.P1.field = [{
      instanceId: 'slot-attacker', cardId: 'living_flame', damage: 0,
      slotIndex: 0,
      battlefieldEntrySeq: 1,
      exhausted: false, summonedThisTurn: false, attacksThisTurn: 0,
      temporaryAttackModifier: 0, temporaryHealthModifier: 0,
    }]
    game.players.P2.field = []
    game.players.P2.life = [0, 1, 2, 3].map((lifeSlotIndex) => ({
      instanceId: `life-slot-${lifeSlotIndex}`,
      cardId: 'ash_hound' as const,
      lifeSlotIndex,
    }))

    const attacked = applyAction(game, 'P1', {
      type: 'ATTACK_PLAYER',
      attackerId: 'slot-attacker',
      lifeSlotIndices: [1],
    })

    expect(attacked.players.P2.life.map((card) => card.lifeSlotIndex)).toEqual([0, 2, 3])
    expect(attacked.players.P2.life.map((card) => card.instanceId)).toEqual([
      'life-slot-0',
      'life-slot-2',
      'life-slot-3',
    ])
    expect(attacked.players.P2.hand.at(-1)).toMatchObject({
      instanceId: 'life-slot-1',
      lifeSlotIndex: 1,
    })
  })
})

describe('라이프 0 패배와 턴 종료 시점', () => {
  test('라이프 1에서 라이프 2장 손실 공격을 받아도 패배하지 않고 남은 라이프의 각성을 처리한다', () => {
    const game = createGame({
      random: () => 0.5,
      idSource: createIdSource(),
      startingPlayer: 'P1',
    })
    game.players.P1.field = [{
      instanceId: 'double-breaker', cardId: 'living_flame', damage: 0,
      slotIndex: 0,
      battlefieldEntrySeq: 1,
      exhausted: false, summonedThisTurn: false, attacksThisTurn: 0,
      temporaryAttackModifier: 0, temporaryHealthModifier: 0,
    }]
    game.players.P1.extraLifeLossOnDirectAttack = true
    game.players.P1.life = [{ instanceId: 'p1-life', cardId: 'ash_hound' }]
    game.players.P2.field = []
    game.players.P2.life = [{ instanceId: 'last-life', cardId: 'holy_mirror_wall' }]

    const attacked = applyAction(game, 'P1', {
      type: 'ATTACK_PLAYER',
      attackerId: 'double-breaker',
      lifeIndices: [0],
    })

    expect(attacked.status).toBe('playing')
    expect(attacked.winner).toBeNull()
    expect(attacked.players.P2.life).toHaveLength(0)
    expect(attacked.players.P2.discard.some((card) => card.instanceId === 'last-life')).toBe(true)
    expect(attacked.pendingChoices[0]).toEqual({
      type: 'HOLY_MIRROR_LIFE',
      playerId: 'P2',
    })
  })

  test('라이프가 0인 플레이어가 직접 공격을 받으면 라이프 처리 없이 즉시 패배한다', () => {
    const game = createGame({
      random: () => 0.5,
      idSource: createIdSource(),
      startingPlayer: 'P1',
    })
    game.players.P1.field = [{
      instanceId: 'finisher', cardId: 'living_flame', damage: 0,
      slotIndex: 0,
      battlefieldEntrySeq: 1,
      exhausted: false, summonedThisTurn: false, attacksThisTurn: 0,
      temporaryAttackModifier: 0, temporaryHealthModifier: 0,
    }]
    game.players.P2.field = []
    game.players.P2.life = []

    const attacked = applyAction(game, 'P1', {
      type: 'ATTACK_PLAYER',
      attackerId: 'finisher',
      lifeIndices: [],
    })

    expect(attacked.status).toBe('finished')
    expect(attacked.winner).toBe('P1')
    expect(attacked.pendingChoices).toHaveLength(0)
  })

  test('턴과 선택 대기 여부에 관계없이 항복할 수 있다', () => {
    const game = createGame({
      random: () => 0.5,
      idSource: createIdSource(),
      startingPlayer: 'P1',
    })
    game.pendingChoices = [{ type: 'HOLY_MIRROR_LIFE', playerId: 'P1' }]

    const surrendered = applyAction(game, 'P2', { type: 'SURRENDER' })

    expect(surrendered.status).toBe('finished')
    expect(surrendered.winner).toBe('P1')
    expect(surrendered.pendingChoices).toHaveLength(0)
  })

  test('이번 턴 동안의 효과는 턴 종료 시 양쪽에서 제거되고 체력 감소에 따른 사망을 처리한다', () => {
    const game = createGame({
      random: () => 0.5,
      idSource: createIdSource(),
      startingPlayer: 'P1',
    })
    game.players.P1.field = [{
      instanceId: 'expiring-health', cardId: 'living_flame', damage: 1,
      slotIndex: 0,
      battlefieldEntrySeq: 1,
      exhausted: true, summonedThisTurn: false, attacksThisTurn: 1,
      temporaryAttackModifier: 2, temporaryHealthModifier: 1,
      temporaryRush: true,
    }]
    game.players.P2.field = [{
      instanceId: 'opponent-temporary', cardId: 'ash_hound', damage: 0,
      slotIndex: 0,
      battlefieldEntrySeq: 2,
      exhausted: true, summonedThisTurn: true, attacksThisTurn: 1,
      temporaryAttackModifier: 3, temporaryHealthModifier: 2,
      temporaryRush: true,
    }]
    game.players.P1.extraLifeLossOnDirectAttack = true
    game.players.P2.extraLifeLossOnDirectAttack = true

    const next = applyAction(game, 'P1', { type: 'END_TURN' })

    expect(next.currentPlayer).toBe('P2')
    expect(next.players.P1.field).toHaveLength(0)
    expect(next.players.P1.discard.some((card) => card.instanceId === 'expiring-health')).toBe(true)
    expect(next.players.P2.field[0]).toMatchObject({
      instanceId: 'opponent-temporary',
      temporaryAttackModifier: 0,
      temporaryHealthModifier: 0,
      temporaryRush: false,
      exhausted: false,
      summonedThisTurn: false,
      attacksThisTurn: 0,
    })
    expect(next.players.P1.extraLifeLossOnDirectAttack).toBe(false)
    expect(next.players.P2.extraLifeLossOnDirectAttack).toBe(false)
  })
})
