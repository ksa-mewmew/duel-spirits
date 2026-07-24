import { describe, expect, test } from 'vitest'

import { CARDS, DEFAULT_DECK } from './cards'

const BALANCE = {
  volcano_mouse: ['화산쥐', 'unit', 0, 1, 1, ['fire']],
  living_flame: ['살아 움직이는 불꽃', 'unit', 1, 2, 1, ['fire']],
  living_smoke: ['살아 움직이는 연기', 'unit', 2, 0, 3, ['fire']],
  last_ember: ['마지막 불씨', 'unit', 2, 2, 1, ['fire']],
  ash_hound: ['잿빛 들개', 'unit', 2, 3, 2, ['fire']],
  moth_swarm: ['불나방 무리', 'unit', 3, 3, 1, ['fire']],
  burning_procession: ['불타는 행렬', 'spell', 4, null, null, ['fire']],
  ash_pirate_ship: ['잿더미 해적선', 'unit', 4, 3, 2, ['fire', 'water']],
  wave_reader: ['물결을 읽는 자', 'unit', 1, 1, 2, ['water']],
  ripple_spirit: ['잔물결 정령', 'unit', 2, 1, 2, ['water']],
  ebb: ['썰물', 'spell', 3, null, null, ['water']],
  surging_wave: ['몰아치는 파도', 'unit', 3, 2, 3, ['water']],
  ash_clearing_rain: ['잿더미를 치우는 비', 'spell', 3, null, null, ['water']],
  high_tide: ['밀물', 'spell', 3, null, null, ['water']],
  reverse_current: ['역류', 'spell', 4, null, null, ['water']],
  tsunami: ['쓰나미', 'spell', 2, null, null, ['water', 'earth']],
  tree_fairy: ['나무에 사는 요정', 'unit', 1, 1, 1, ['earth']],
  seeding_fairy: ['씨 뿌리는 요정', 'unit', 1, 1, 1, ['earth']],
  heavy_seed: ['너무 무거운 씨앗', 'unit', 3, 1, 3, ['earth']],
  rock_armor_knight: ['바위 갑옷 기사', 'unit', 3, 2, 4, ['earth']],
  desertification: ['사막화', 'spell', 5, null, null, ['earth']],
  overgrown_sprout: ['하늘까지 자라난 새싹', 'spell', 4, null, null, ['earth']],
  floating_mountains: ['떠다니는 산맥', 'unit', 6, 5, 6, ['earth']],
  grave_digging: ['파묘', 'spell', 3, null, null, ['earth', 'dark']],
  carrion_crow: ['시체를 먹는 까마귀', 'unit', 2, 1, 1, ['dark']],
  corpse_cat: ['시체에 숨은 고양이', 'unit', 1, 1, 2, ['dark']],
  nameless_shadow: ['이름 없는 그림자', 'unit', 1, 1, 2, ['dark']],
  blue_black_hound: ['검푸른 들개', 'unit', 2, 4, 2, ['dark']],
  weakened_giant: ['쇠약한 거인', 'unit', 2, 3, 3, ['dark']],
  coffin_warrior: ['관 속의 전사', 'unit', 4, 3, 3, ['dark']],
  demon_finger: ['악마의 손가락', 'unit', 4, 4, 4, ['dark']],
  demon_breath: ['악마의 숨결', 'spell', 5, null, null, ['dark']],
  eclipse: ['일식', 'spell', 6, null, null, ['dark', 'light']],
  pegasus_rider: ['페가수스 기마병', 'unit', 2, 1, 2, ['light']],
  temple_prospect: ['신전의 유망주', 'unit', 2, 2, 2, ['light']],
  cathedral_guard: ['성당 경비병', 'unit', 2, 1, 4, ['light']],
  prophet: ['예언자', 'unit', 3, 2, 3, ['light']],
  apostle_pigeon: ['사도의 비둘기', 'unit', 3, 1, 3, ['light']],
  devotion: ['헌신', 'spell', 4, null, null, ['light']],
  holy_mirror_wall: ['성스러운 거울의 벽', 'spell', 6, null, null, ['light']],
  battle_campfire: ['전장의 모닥불', 'spell', 3, null, null, ['fire', 'light']],
} as const

describe('카드군 1 개정 원고', () => {
  test('카드군 1의 40장이 개정된 이름·종류·비용·공체·속성과 일치한다', () => {
    expect(Object.keys(CARDS)).toHaveLength(80)

    for (const [cardId, expected] of Object.entries(BALANCE)) {
      const [name, type, cost, attack, health, attributes] = expected
      const card = CARDS[cardId as keyof typeof CARDS]

      expect(card.name).toBe(name)
      expect(card.type).toBe(type)
      expect(card.cost).toBe(cost)
      expect(card.attributes).toEqual(attributes)
      expect(card.families).toEqual([])

      if (card.type === 'unit') {
        expect(card.attack).toBe(attack)
        expect(card.health).toBe(health)
      } else {
        expect(attack).toBeNull()
        expect(health).toBeNull()
      }
    }
  })

  test('규칙 변화가 큰 카드의 능력 문구를 보존한다', () => {
    expect(CARDS.volcano_mouse.rulesText).toContain('불 카드가 2장 이상')
    expect(CARDS.last_ember.rulesText).toContain('고립 - 이 몬스터는 돌진')
    expect(CARDS.last_ember.rulesText).not.toContain('공격력 +')
    expect(CARDS.tree_fairy.rulesText).toContain('손에서 마나에 카드를 한 장')
    expect(CARDS.burning_procession.rulesText).toContain('덱 맨 위 카드 3장')
    expect(CARDS.burning_procession.rulesText).toContain('최대 2장')
    expect(CARDS.surging_wave.rulesText).toContain('비용 2 이하의 물 몬스터')
    expect(CARDS.grave_digging.rulesText).toContain('카드 2장을 손으로')
    expect(CARDS.demon_breath.rulesText).toContain('남은 체력이 가장 높은 몬스터 중 1장')
    expect(CARDS.overgrown_sprout.rulesText).toContain('비행을 얻는다')
    expect(CARDS.cathedral_guard.rulesText).toContain('비용 1 이하 몬스터로 공격할 수 없다')
    expect(CARDS.nameless_shadow.rulesText).toContain('암살')
    expect(CARDS.coffin_warrior.rulesText).toContain('비용 없이')
  })

  test('기본 덱은 20장이며 같은 이름은 최대 3장이다', () => {
    expect(DEFAULT_DECK).toHaveLength(20)
    const counts = new Map<string, number>()
    for (const cardId of DEFAULT_DECK) counts.set(cardId, (counts.get(cardId) ?? 0) + 1)
    expect(Math.max(...counts.values())).toBeLessThanOrEqual(3)
  })
})
