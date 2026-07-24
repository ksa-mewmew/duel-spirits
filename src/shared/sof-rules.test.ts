import { describe, expect, test } from 'vitest'

import { applyAction, countPlayerCards, createGame, GameRuleError } from './rules'

import type { CardId } from './cards'
import type { CardInstance, ManaCardInstance, UnitInstance } from './types'

function createIdSource(): () => string {
  let next = 0
  return () => `sof-${next++}`
}

function createTestGame() {
  return createGame({ random: () => 0.5, idSource: createIdSource(), startingPlayer: 'P1' })
}

function card(instanceId: string, cardId: CardId): CardInstance {
  return { instanceId, cardId, ownerId: 'P1', controllerId: 'P1' }
}

function mana(instanceId: string, cardId: CardId, exhausted = false): ManaCardInstance {
  return { instanceId, cardId, exhausted, ownerId: 'P1', controllerId: 'P1' }
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
    ownerId: overrides.ownerId ?? 'P1',
    controllerId: overrides.controllerId ?? overrides.ownerId ?? 'P1',
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

function setEnemyUnit(game: ReturnType<typeof createTestGame>, value: UnitInstance): void {
  value.ownerId = 'P2'
  value.controllerId = 'P2'
  game.players.P2.field = [value]
}

describe('진화 규칙', () => {
  test('같은 속성 몬스터 위에 겹쳐지고 소환된 턴에도 공격한다', () => {
    const game = createTestGame()
    game.players.P1.hand = [card('captain', 'flame_mane_captain')]
    game.players.P1.mana = [
      mana('m1', 'living_flame'), mana('m2', 'living_flame'), mana('m3', 'living_flame'),
    ]
    game.players.P1.field = [unit('base', 'living_flame', 2, { summonedThisTurn: true })]
    setEnemyUnit(game, unit('target', 'rock_armor_knight', 0))

    const evolved = applyAction(game, 'P1', {
      type: 'PLAY_CARD', cardInstanceId: 'captain', manaIds: ['m1', 'm2', 'm3'],
      selection: { evolutionUnitId: 'base' },
    })

    expect(evolved.players.P1.field[0]).toMatchObject({
      instanceId: 'captain', cardId: 'flame_mane_captain', slotIndex: 2,
      evolvedThisTurn: true, summonedThisTurn: true,
    })
    expect(evolved.players.P1.field[0]?.evolutionStack).toEqual([
      expect.objectContaining({ instanceId: 'base', cardId: 'living_flame' }),
    ])

    const attacked = applyAction(evolved, 'P1', {
      type: 'ATTACK_UNIT', attackerId: 'captain', defenderId: 'target',
    })
    expect(attacked.players.P2.field[0]?.damage).toBe(3)
  })

  test('잘못된 속성 위에는 진화할 수 없다', () => {
    const game = createTestGame()
    game.players.P1.hand = [card('captain', 'flame_mane_captain')]
    game.players.P1.mana = [mana('m1', 'living_flame'), mana('m2', 'living_flame'), mana('m3', 'living_flame')]
    game.players.P1.field = [unit('water-base', 'wave_reader')]

    expect(() => applyAction(game, 'P1', {
      type: 'PLAY_CARD', cardInstanceId: 'captain', manaIds: ['m1', 'm2', 'm3'],
      selection: { evolutionUnitId: 'water-base' },
    })).toThrow(GameRuleError)
  })

  test('진화 몬스터가 전장을 떠나면 아래 카드도 묘지로 간다', () => {
    const game = createTestGame()
    game.players.P1.field = [unit('hill', 'walking_hill', 0, {
      evolutionStack: [card('base', 'tree_fairy')],
    })]
    game.players.P2.hand = [card('current', 'reverse_current')]
    game.players.P2.mana = [mana('w1', 'wave_reader'), mana('w2', 'wave_reader'), mana('w3', 'wave_reader'), mana('w4', 'wave_reader')]
    game.currentPlayer = 'P2'
    game.players.P1.field[0]!.exhausted = true

    const immune = applyAction(game, 'P2', {
      type: 'PLAY_CARD', cardInstanceId: 'current', manaIds: ['w1', 'w2', 'w3', 'w4'],
      selection: { unitId: 'hill' },
    })
    expect(immune.players.P1.field).toHaveLength(1)
    expect(immune.players.P1.discard).toHaveLength(0)

    // 자신의 효과로 손으로 돌아가면 진화 아래 카드는 묘지로 갑니다.
    immune.currentPlayer = 'P1'
    immune.players.P1.hand = [card('grand', 'grand_reverse_current')]
    immune.players.P1.mana = [
      mana('a', 'wave_reader'), mana('b', 'wave_reader'), mana('c', 'wave_reader'), mana('d', 'wave_reader'), mana('e', 'wave_reader'),
    ]
    immune.players.P1.field[0]!.exhausted = true
    const returned = applyAction(immune, 'P1', {
      type: 'PLAY_CARD', cardInstanceId: 'grand', manaIds: ['a', 'b', 'c', 'd', 'e'],
    })
    expect(returned.players.P1.hand).toContainEqual(expect.objectContaining({ instanceId: 'hill' }))
    expect(returned.players.P1.discard).toContainEqual(expect.objectContaining({ instanceId: 'base' }))
  })

  test('카드 수 계산은 진화 아래 카드도 포함한다', () => {
    const game = createTestGame()
    const before = countPlayerCards(game.players.P1)
    const base = game.players.P1.hand[0]!
    const top = game.players.P1.hand[1]!
    game.players.P1.hand.splice(0, 2)
    game.players.P1.field = [unit(top.instanceId, top.cardId, 0, { evolutionStack: [base] })]
    expect(countPlayerCards(game.players.P1)).toBe(before)
  })
})

describe('SOF 불·물 전투', () => {
  test('불똥을 쫓는 도마뱀은 공격할 때 공격력 3을 얻는다', () => {
    const game = createTestGame()
    game.players.P1.field = [unit('lizard', 'spark_chasing_lizard')]
    setEnemyUnit(game, unit('target', 'rock_armor_knight'))
    const next = applyAction(game, 'P1', { type: 'ATTACK_UNIT', attackerId: 'lizard', defenderId: 'target' })
    expect(next.players.P2.field[0]?.damage).toBe(3)
  })

  test('비늘 잠수부는 공격 중 공격력이 3 이상이 되는 몬스터도 막는다', () => {
    const game = createTestGame()
    game.players.P1.field = [unit('lizard', 'spark_chasing_lizard')]
    setEnemyUnit(game, unit('diver', 'scale_diver'))
    expect(() => applyAction(game, 'P1', {
      type: 'ATTACK_UNIT', attackerId: 'lizard', defenderId: 'diver',
    })).toThrow('비늘 잠수부')

    const direct = applyAction(game, 'P1', {
      type: 'ATTACK_PLAYER', attackerId: 'lizard',
      lifeSlotIndices: [game.players.P2.life[0]!.lifeSlotIndex ?? 0],
    })
    expect(direct.players.P2.life).toHaveLength(3)
  })

  test('쇠뿔 멧돼지는 불 공명을 충족했을 때만 소환된 턴에 돌진한다', () => {
    const resonant = createTestGame()
    resonant.players.P1.hand = [card('boar', 'iron_horn_boar')]
    resonant.players.P1.mana = [mana('fire', 'living_flame'), mana('earth', 'seeding_fairy')]
    setEnemyUnit(resonant, unit('target', 'rock_armor_knight'))
    const summoned = applyAction(resonant, 'P1', {
      type: 'PLAY_CARD', cardInstanceId: 'boar', manaIds: ['fire', 'earth'], selection: { fieldSlot: 0 },
    })
    expect(summoned.players.P1.field[0]?.temporaryCharge).toBe(true)
    const attacked = applyAction(summoned, 'P1', {
      type: 'ATTACK_UNIT', attackerId: 'boar', defenderId: 'target',
    })
    expect(attacked.players.P2.field).toHaveLength(0)

    const nonResonant = createTestGame()
    nonResonant.players.P1.hand = [card('boar-2', 'iron_horn_boar')]
    nonResonant.players.P1.mana = [mana('earth-1', 'seeding_fairy'), mana('earth-2', 'tree_fairy')]
    setEnemyUnit(nonResonant, unit('target-2', 'rock_armor_knight'))
    const noCharge = applyAction(nonResonant, 'P1', {
      type: 'PLAY_CARD', cardInstanceId: 'boar-2', manaIds: ['earth-1', 'earth-2'], selection: { fieldSlot: 0 },
    })
    expect(() => applyAction(noCharge, 'P1', {
      type: 'ATTACK_UNIT', attackerId: 'boar-2', defenderId: 'target-2',
    })).toThrow('이번 턴에 소환된 몬스터')
  })

  test('화염 투창병의 선제 피해로 대상이 죽으면 반격받지 않는다', () => {
    const game = createTestGame()
    game.players.P1.field = [unit('javelin', 'flame_javelin_soldier')]
    setEnemyUnit(game, unit('target', 'living_flame'))
    const next = applyAction(game, 'P1', { type: 'ATTACK_UNIT', attackerId: 'javelin', defenderId: 'target' })
    expect(next.players.P2.field).toHaveLength(0)
    expect(next.players.P1.field[0]?.damage).toBe(0)
  })

  test('화염 투창병은 방어할 때도 전투 전에 상대에게 피해 1을 준다', () => {
    const game = createTestGame()
    game.players.P1.field = [unit('attacker', 'living_flame')]
    setEnemyUnit(game, unit('javelin', 'flame_javelin_soldier'))
    const next = applyAction(game, 'P1', {
      type: 'ATTACK_UNIT', attackerId: 'attacker', defenderId: 'javelin',
    })
    expect(next.players.P1.field).toHaveLength(0)
    expect(next.players.P2.field[0]).toMatchObject({ instanceId: 'javelin', damage: 0 })
  })

  test('화산 폭발은 자신의 불 몬스터가 죽었을 때만 한 번 더 발동한다', () => {
    const nonFireDeath = createTestGame()
    nonFireDeath.players.P1.hand = [card('eruption', 'volcanic_eruption')]
    nonFireDeath.players.P1.mana = Array.from({ length: 5 }, (_, index) => mana(`m${index}`, 'living_flame'))
    nonFireDeath.players.P1.field = [unit('earth-victim', 'tree_fairy')]
    setEnemyUnit(nonFireDeath, unit('enemy-survivor', 'rock_armor_knight'))
    const once = applyAction(nonFireDeath, 'P1', {
      type: 'PLAY_CARD', cardInstanceId: 'eruption', manaIds: ['m0', 'm1', 'm2', 'm3', 'm4'],
    })
    expect(once.players.P2.field[0]).toMatchObject({ instanceId: 'enemy-survivor', damage: 2 })

    const fireDeath = createTestGame()
    fireDeath.players.P1.hand = [card('eruption-2', 'volcanic_eruption')]
    fireDeath.players.P1.mana = Array.from({ length: 5 }, (_, index) => mana(`f${index}`, 'living_flame'))
    fireDeath.players.P1.field = [unit('fire-victim', 'living_flame')]
    setEnemyUnit(fireDeath, unit('enemy-destroyed', 'rock_armor_knight'))
    const twice = applyAction(fireDeath, 'P1', {
      type: 'PLAY_CARD', cardInstanceId: 'eruption-2', manaIds: ['f0', 'f1', 'f2', 'f3', 'f4'],
    })
    expect(twice.players.P2.field).toHaveLength(0)
  })

  test('터지지 않은 폭탄쥐 유언은 상대 몬스터에게 피해 2를 준다', () => {
    const game = createTestGame()
    game.players.P1.field = [unit('bomb', 'unexploded_bomb_mouse', 0, { damage: 1 })]
    setEnemyUnit(game, unit('target', 'rock_armor_knight'))
    // 임시 체력 감소를 정리하면서 폭탄쥐를 죽입니다.
    game.players.P1.field[0]!.temporaryHealthModifier = -1
    const choosing = applyAction(game, 'P1', { type: 'END_TURN' })
    expect(choosing.pendingChoices[0]).toMatchObject({ effect: 'BOMB_MOUSE_DAMAGE', playerId: 'P1' })
    const resolved = applyAction(choosing, 'P1', { type: 'RESOLVE_CHOICE', choiceIds: ['target'] })
    expect(resolved.players.P2.field[0]?.damage).toBe(2)
  })

  test('화염갈기 대장은 전투로 상대를 보내면 준비된다', () => {
    const game = createTestGame()
    game.players.P1.field = [unit('captain', 'flame_mane_captain')]
    setEnemyUnit(game, unit('target', 'living_flame'))
    const next = applyAction(game, 'P1', { type: 'ATTACK_UNIT', attackerId: 'captain', defenderId: 'target' })
    expect(next.players.P1.field[0]).toMatchObject({ exhausted: false, attacksThisTurn: 0 })
  })

  test('폭발하는 산맥룡은 라이프가 3장 이상인 상대를 직접 공격하면 2장을 잃게 한다', () => {
    const game = createTestGame()
    game.players.P1.field = [unit('dragon', 'exploding_mountain_dragon')]
    const slots = game.players.P2.life.slice(0, 2).map((life, index) => life.lifeSlotIndex ?? index)
    const next = applyAction(game, 'P1', { type: 'ATTACK_PLAYER', attackerId: 'dragon', lifeSlotIndices: slots })
    expect(next.players.P2.life).toHaveLength(2)
  })

  test('얼음거울 정령은 소진된 비용 2 이하 몬스터만 대상으로 삼는다', () => {
    const game = createTestGame()
    game.players.P1.hand = [card('ice', 'ice_mirror_spirit')]
    game.players.P1.mana = [mana('w1', 'wave_reader'), mana('w2', 'ripple_spirit'), mana('w3', 'high_tide')]
    game.players.P2.field = [
      unit('ready-small', 'living_flame', 0, { ownerId: 'P2', controllerId: 'P2', exhausted: false }),
      unit('tired-small', 'ash_hound', 1, { ownerId: 'P2', controllerId: 'P2', exhausted: true }),
      unit('tired-large', 'rock_armor_knight', 2, { ownerId: 'P2', controllerId: 'P2', exhausted: true }),
    ]
    const choosing = applyAction(game, 'P1', {
      type: 'PLAY_CARD', cardInstanceId: 'ice', manaIds: ['w1', 'w2', 'w3'], selection: { fieldSlot: 0 },
    })
    expect(choosing.pendingChoices[0]).toMatchObject({
      effect: 'ICE_MIRROR_FREEZE',
      candidateIds: ['tired-small'],
    })
  })

  test('되돌아오는 해파리는 전투 뒤 살아 있으면 손으로 돌아간다', () => {
    const game = createTestGame()
    game.players.P1.field = [unit('jelly', 'returning_jellyfish')]
    setEnemyUnit(game, unit('target', 'tree_fairy'))
    const next = applyAction(game, 'P1', { type: 'ATTACK_UNIT', attackerId: 'jelly', defenderId: 'target' })
    expect(next.players.P1.field).toHaveLength(0)
    expect(next.players.P1.hand).toContainEqual(expect.objectContaining({ instanceId: 'jelly' }))
  })
})

describe('SOF 땅·빛·어둠과 공명', () => {
  test('땅을 가는 요정으로 나무 요정을 마나에 놓으면 나무 요정의 추가 마나 효과가 이어진다', () => {
    const game = createTestGame()
    game.players.P1.hand = [
      card('fairy', 'mana_flipping_fairy'),
      card('tree', 'tree_fairy'),
      card('extra', 'living_flame'),
    ]
    game.players.P1.mana = [mana('pay1', 'heavy_seed'), mana('pay2', 'heavy_seed'), mana('return', 'rock_armor_knight')]

    const first = applyAction(game, 'P1', {
      type: 'PLAY_CARD', cardInstanceId: 'fairy', manaIds: ['pay1', 'pay2'], selection: { fieldSlot: 0 },
    })
    const returned = applyAction(first, 'P1', { type: 'RESOLVE_CHOICE', choiceIds: ['return'] })
    const treePlaced = applyAction(returned, 'P1', { type: 'RESOLVE_CHOICE', choiceIds: ['tree'] })
    expect(treePlaced.pendingChoices[0]).toMatchObject({ effect: 'TREE_FAIRY_HAND_MANA' })
    const completed = applyAction(treePlaced, 'P1', { type: 'RESOLVE_CHOICE', choiceIds: ['extra'] })
    expect(completed.players.P1.mana).toContainEqual(expect.objectContaining({ instanceId: 'tree', exhausted: true }))
    expect(completed.players.P1.mana).toContainEqual(expect.objectContaining({ instanceId: 'extra', exhausted: false }))
    expect(completed.players.P1.hand).toContainEqual(expect.objectContaining({ instanceId: 'return' }))
  })

  test('솟아나는 대지는 출현 없이 소환하고 땅 몬스터에게 이번 턴 돌진을 준다', () => {
    const game = createTestGame()
    game.players.P1.hand = [card('spell', 'rising_earth')]
    game.players.P1.mana = [
      mana('p1', 'tree_fairy'), mana('p2', 'tree_fairy'), mana('p3', 'tree_fairy'), mana('p4', 'tree_fairy'), mana('p5', 'tree_fairy'),
      mana('seeder', 'seeding_fairy', true),
    ]
    game.players.P1.deck = [card('marker', 'living_flame')]
    setEnemyUnit(game, unit('target', 'rock_armor_knight'))

    const summoned = applyAction(game, 'P1', {
      type: 'PLAY_CARD', cardInstanceId: 'spell', manaIds: ['p1', 'p2', 'p3', 'p4', 'p5'],
      selection: { effectManaId: 'seeder', fieldSlot: 0 },
    })
    expect(summoned.players.P1.deck[0]?.instanceId).toBe('marker')
    const attacked = applyAction(summoned, 'P1', { type: 'ATTACK_UNIT', attackerId: 'seeder', defenderId: 'target' })
    expect(attacked.players.P2.field[0]?.damage).toBe(1)
  })

  test('쇠약한 거인은 턴 종료 시 묘지에 어둠 카드가 없으면 묘지로 간다', () => {
    const noDark = createTestGame()
    noDark.players.P1.field = [unit('giant', 'weakened_giant')]
    noDark.players.P1.discard = [card('fire-discard', 'living_flame')]
    const destroyed = applyAction(noDark, 'P1', { type: 'END_TURN' })
    expect(destroyed.players.P1.field).toHaveLength(0)
    expect(destroyed.players.P1.discard).toContainEqual(expect.objectContaining({ instanceId: 'giant' }))

    const withDark = createTestGame()
    withDark.players.P1.field = [unit('safe-giant', 'weakened_giant')]
    withDark.players.P1.discard = [card('dark-discard', 'corpse_cat')]
    const survived = applyAction(withDark, 'P1', { type: 'END_TURN' })
    expect(survived.players.P1.field).toContainEqual(expect.objectContaining({ instanceId: 'safe-giant' }))
  })

  test('침묵하는 방패병과 돌덩이 운반꾼은 공격할 수 없고 작은 심판관은 비용 1 공격을 막는다', () => {
    const shieldGame = createTestGame()
    shieldGame.players.P1.field = [unit('shield', 'silent_shield_soldier')]
    setEnemyUnit(shieldGame, unit('target', 'living_flame'))
    expect(() => applyAction(shieldGame, 'P1', { type: 'ATTACK_UNIT', attackerId: 'shield', defenderId: 'target' })).toThrow('공격할 수 없습니다')

    const carrierGame = createTestGame()
    carrierGame.players.P1.field = [unit('carrier', 'boulder_carrier')]
    setEnemyUnit(carrierGame, unit('carrier-target', 'living_flame'))
    expect(() => applyAction(carrierGame, 'P1', { type: 'ATTACK_UNIT', attackerId: 'carrier', defenderId: 'carrier-target' })).toThrow('공격할 수 없습니다')
    expect(() => applyAction(carrierGame, 'P1', { type: 'ATTACK_PLAYER', attackerId: 'carrier' })).toThrow('공격할 수 없습니다')

    const judgeGame = createTestGame()
    judgeGame.players.P1.field = [unit('small', 'living_flame')]
    setEnemyUnit(judgeGame, unit('judge', 'little_judge'))
    expect(() => applyAction(judgeGame, 'P1', { type: 'ATTACK_UNIT', attackerId: 'small', defenderId: 'judge' })).toThrow('작은 심판관')
  })

  test('구원의 창기사는 라이프가 2장 이하이면 공격력 +1을 얻는다', () => {
    const game = createTestGame()
    game.players.P1.life = game.players.P1.life.slice(0, 2)
    game.players.P1.field = [unit('lancer', 'salvation_lancer')]
    setEnemyUnit(game, unit('target', 'rock_armor_knight'))
    const next = applyAction(game, 'P1', {
      type: 'ATTACK_UNIT', attackerId: 'lancer', defenderId: 'target',
    })
    expect(next.players.P2.field[0]?.damage).toBe(3)
  })

  test('성령의 대리인이 있으면 한 턴의 전체 공격은 최대 두 번이다', () => {
    const limited = createTestGame()
    limited.players.P1.field = [unit('a', 'living_flame', 0), unit('b', 'living_flame', 1), unit('c', 'living_flame', 2)]
    limited.players.P2.field = [unit('agent', 'spirit_agent', 0, { ownerId: 'P2', controllerId: 'P2', exhausted: true })]
    limited.players.P2.life = limited.players.P2.life.slice(0, 3)
    // 비행을 부여해 수호자를 건너뛰고 직접 공격합니다.
    limited.players.P1.field.forEach((u) => { u.temporaryFlying = true })
    let next = applyAction(limited, 'P1', { type: 'ATTACK_PLAYER', attackerId: 'a', lifeSlotIndices: [limited.players.P2.life[0]!.lifeSlotIndex ?? 0] })
    next = applyAction(next, 'P1', { type: 'ATTACK_PLAYER', attackerId: 'b', lifeSlotIndices: [next.players.P2.life[0]!.lifeSlotIndex ?? 0] })
    expect(() => applyAction(next, 'P1', { type: 'ATTACK_PLAYER', attackerId: 'c', lifeSlotIndices: [next.players.P2.life[0]!.lifeSlotIndex ?? 0] })).toThrow('성령의 대리인')
  })

  test('화장터의 연기는 불·어둠 공명을 모두 충족하면 모든 상대에게 피해 2를 준다', () => {
    const game = createTestGame()
    game.players.P1.hand = [card('smoke', 'crematory_smoke')]
    game.players.P1.mana = [mana('fire', 'living_flame'), mana('dark', 'corpse_cat'), mana('both', 'crematory_smoke')]
    game.players.P2.field = [
      unit('x', 'rock_armor_knight', 0, { ownerId: 'P2', controllerId: 'P2' }),
      unit('y', 'cathedral_guard', 1, { ownerId: 'P2', controllerId: 'P2' }),
    ]
    const next = applyAction(game, 'P1', { type: 'PLAY_CARD', cardInstanceId: 'smoke', manaIds: ['fire', 'dark', 'both'] })
    expect(next.players.P2.field.map((u) => u.damage)).toEqual([2, 2])
  })
})

test('여러 폭탄쥐의 유언 중 뒤 효과는 피해 대상이 사라지면 정상적으로 끝난다', () => {
  const game = createTestGame()
  game.players.P1.field = [
    // 기본 체력 1에 임시 체력 +1로 살아 있다가, 턴 종료 시 임시 효과가
    // 사라지면 누적 피해 1 때문에 두 장이 동시에 묘지로 갑니다.
    unit('bomb-a', 'unexploded_bomb_mouse', 0, { damage: 1, temporaryHealthModifier: 1 }),
    unit('bomb-b', 'unexploded_bomb_mouse', 1, { damage: 1, temporaryHealthModifier: 1 }),
  ]
  setEnemyUnit(game, unit('target', 'living_flame', 0))

  const firstChoice = applyAction(game, 'P1', { type: 'END_TURN' })
  expect(firstChoice.pendingChoices).toHaveLength(2)
  const afterFirst = applyAction(firstChoice, 'P1', { type: 'RESOLVE_CHOICE', choiceIds: ['target'] })
  expect(afterFirst.players.P2.field).toHaveLength(0)
  expect(afterFirst.pendingChoices).toHaveLength(1)
  const completed = applyAction(afterFirst, 'P1', { type: 'RESOLVE_CHOICE', choiceIds: [] })
  expect(completed.pendingChoices).toHaveLength(0)
})
