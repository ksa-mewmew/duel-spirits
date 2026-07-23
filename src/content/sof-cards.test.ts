import { describe, expect, test } from 'vitest'

import { CARDS, SOF_CARD_IDS } from './cards'
import { CARD_SETS } from './sets'

const SOF_BALANCE = {
  spark_chasing_lizard: ['불똥을 쫓는 도마뱀', 'unit', 1, 0, 1, ['fire'], null],
  unexploded_bomb_mouse: ['터지지 않은 폭탄쥐', 'unit', 2, 2, 1, ['fire'], null],
  iron_horn_boar: ['쇠뿔 멧돼지', 'unit', 2, 4, 2, ['fire'], null],
  flame_javelin_soldier: ['화염 투창병', 'unit', 3, 1, 4, ['fire'], null],
  volcanic_eruption: ['화산 폭발', 'spell', 5, null, null, ['fire'], null],
  flame_mane_captain: ['화염갈기 대장', 'unit', 3, 3, 3, ['fire'], 'fire'],
  exploding_mountain_dragon: ['폭발하는 산맥룡', 'unit', 6, 5, 3, ['fire'], 'fire'],

  scale_diver: ['비늘 잠수부', 'unit', 1, 1, 2, ['water'], null],
  underwater_observer: ['물밑을 살피는 자', 'unit', 2, 2, 3, ['water'], null],
  returning_jellyfish: ['되돌아오는 해파리', 'unit', 2, 2, 4, ['water'], null],
  ice_mirror_spirit: ['얼음거울 정령', 'unit', 3, 2, 3, ['water'], null],
  grand_reverse_current: ['대환류', 'spell', 5, null, null, ['water'], null],
  wave_fin: ['파도의 등지느러미', 'unit', 3, 3, 4, ['water'], 'water'],
  crystal_tsunami: ['수정 해일', 'unit', 5, 4, 4, ['water'], 'water'],

  hard_seed_bug: ['단단한 씨앗벌레', 'unit', 1, 1, 2, ['earth'], null],
  boulder_carrier: ['돌덩이 운반꾼', 'unit', 2, 4, 3, ['earth'], null],
  mana_flipping_fairy: ['마나를 뒤집는 요정', 'unit', 2, 1, 3, ['earth'], null],
  cliff_hunter: ['절벽의 사냥꾼', 'unit', 3, 1, 4, ['earth'], null],
  rising_earth: ['솟아나는 대지', 'spell', 5, null, null, ['earth'], null],
  walking_hill: ['걸어 다니는 언덕', 'unit', 4, 5, 5, ['earth'], 'earth'],
  earth_guardian: ['대지의 수호자', 'unit', 6, 4, 4, ['earth'], 'earth'],

  poisoned_skeleton: ['독이 발린 해골', 'unit', 2, 1, 1, ['dark'], null],
  grave_merchant: ['무덤 안의 상인', 'unit', 2, 2, 2, ['dark'], null],
  weakened_giant: ['쇠약한 거인', 'unit', 2, 4, 3, ['dark'], null],
  funeral_inviter: ['장례식의 초대자', 'unit', 3, 2, 3, ['dark'], null],
  mass_burial: ['집단 매장', 'spell', 4, null, null, ['dark'], null],
  blackwing_predator: ['검은날개 포식자', 'unit', 3, 3, 2, ['dark'], 'dark'],
  mourner: ['장송하는 자', 'unit', 5, 4, 5, ['dark'], 'dark'],

  silent_shield_soldier: ['침묵하는 방패병', 'unit', 2, 2, 4, ['light'], null],
  returning_paladin: ['돌아오는 성기사', 'unit', 2, 2, 2, ['light'], null],
  little_judge: ['작은 심판관', 'unit', 2, 2, 3, ['light'], null],
  salvation_lancer: ['구원의 창기사', 'unit', 3, 2, 3, ['light'], null],
  last_prayer: ['마지막 기도', 'spell', 5, null, null, ['light'], null],
  sky_white_horse_knight: ['천공의 백마기사', 'unit', 4, 3, 4, ['light'], 'light'],
  spirit_agent: ['성령의 대리인', 'unit', 6, 5, 7, ['light'], 'light'],

  lava_gardener: ['용암 정원사', 'unit', 3, 2, 3, ['fire', 'earth'], null],
  stone_pillar_priest: ['돌기둥의 성직자', 'unit', 3, 1, 4, ['earth', 'light'], null],
  mirror_lake_prophet: ['거울 호수의 예언자', 'unit', 3, 2, 3, ['light', 'water'], null],
  sunken_coffin_keeper: ['가라앉은 관지기', 'unit', 3, 2, 2, ['water', 'dark'], null],
  crematory_smoke: ['화장터의 연기', 'spell', 3, null, null, ['dark', 'fire'], null],
} as const

describe('진화의 시작(SOF) 원고', () => {
  test('정확히 40장이며 이름·종류·비용·공체·속성·진화 조건이 일치한다', () => {
    expect(SOF_CARD_IDS).toHaveLength(40)
    expect(Object.keys(SOF_BALANCE)).toHaveLength(40)

    for (const [cardId, expected] of Object.entries(SOF_BALANCE)) {
      const [name, type, cost, attack, health, attributes, evolutionAttribute] = expected
      const card = CARDS[cardId as keyof typeof CARDS]
      expect(card.name).toBe(name)
      expect(card.type).toBe(type)
      expect(card.cost).toBe(cost)
      expect(card.attributes).toEqual(attributes)
      expect(card.setId).toBe('evolution-begins-001')
      expect(card.collectorNumber).toMatch(/^SOF-\d{3}$/)

      if (card.type === 'unit') {
        expect(card.attack).toBe(attack)
        expect(card.health).toBe(health)
        expect(card.evolutionAttribute ?? null).toBe(evolutionAttribute)
      } else {
        expect(attack).toBeNull()
        expect(health).toBeNull()
        expect(evolutionAttribute).toBeNull()
      }
    }
  })

  test('불·물·땅·어둠·빛 최종 포함 수가 각각 9장으로 같다', () => {
    const counts = { fire: 0, water: 0, earth: 0, dark: 0, light: 0 }
    for (const cardId of SOF_CARD_IDS) {
      for (const attribute of CARDS[cardId].attributes) counts[attribute] += 1
    }
    expect(counts).toEqual({ fire: 9, water: 9, earth: 9, dark: 9, light: 9 })
  })

  test('세트 이름과 코드가 진화의 시작(SOF)이다', () => {
    expect(CARD_SETS['evolution-begins-001']).toMatchObject({
      name: '진화의 시작',
      code: 'SOF',
      unlockedByDefault: true,
    })
  })

  test('핵심 능력 문구를 보존한다', () => {
    expect(CARDS.flame_mane_captain.rulesText).toContain('진화 - 불 몬스터')
    expect(CARDS.exploding_mountain_dragon.rulesText).toContain('라이프를 하나 추가로')
    expect(CARDS.earth_guardian.rulesText).toContain('최대 2장')
    expect(CARDS.mourner.rulesText).toContain('출현은 발동하지 않는다')
    expect(CARDS.spirit_agent.rulesText).toContain('최대 두 번')
    expect(CARDS.crematory_smoke.rulesText).toContain('대신 상대의 모든 몬스터')
  })
})
