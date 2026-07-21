import { describe, expect, test } from 'vitest'
import { CARDS } from './cards'

const SOURCE = {
  volcano_mouse: { name: "화산쥐", type: 'unit', cost: 0, attack: 1, health: 1, attributes: ["fire"], rulesText: "자신의 마나에 불 카드가 2장 이상 있을 때만 이 카드를 소환할 수 있다." },
  living_flame: { name: "살아 움직이는 불꽃", type: 'unit', cost: 1, attack: 2, health: 1, attributes: ["fire"], rulesText: "없음." },
  living_smoke: { name: "살아 움직이는 연기", type: 'unit', cost: 2, attack: 3, health: 1, attributes: ["fire"], rulesText: "각성 - 자신의 전장에 빈 슬롯이 있다면 이 카드를 소환한다." },
  last_ember: { name: "마지막 불씨", type: 'unit', cost: 2, attack: 2, health: 1, attributes: ["fire"], rulesText: "고립 - 이 몬스터는 돌진과 공격력 +2를 얻는다. 유언 - 카드를 1장 뽑는다." },
  ash_hound: { name: "잿빛 들개", type: 'unit', cost: 2, attack: 3, health: 2, attributes: ["fire"], rulesText: "돌진" },
  moth_swarm: { name: "불나방 무리", type: 'unit', cost: 3, attack: 3, health: 1, attributes: ["fire"], rulesText: "기습" },
  burning_procession: { name: "불타는 행렬", type: 'spell', cost: 3, attributes: ["fire"], rulesText: "자신의 전장에 있는 불 몬스터 수만큼 자신의 덱 맨 위 카드를 확인한다. 그중 비용 1 이하인 불 몬스터를 자신의 빈 전장만큼 소환할 수 있다. 나머지는 묘지로 보낸다." },
  ash_pirate_ship: { name: "잿더미 해적선", type: 'unit', cost: 3, attack: 3, health: 1, attributes: ["fire", "water"], rulesText: "출현 - 불 공명 - 이 턴 동안, 자신의 모든 몬스터는 공격력 +2를 얻는다. 출현 - 물 공명 - 양쪽 전장에 다른 몬스터가 셋 이상 존재할 경우, 이 카드는 기습을 얻는다." },
  wave_reader: { name: "물결을 읽는 자", type: 'unit', cost: 1, attack: 1, health: 1, attributes: ["water"], rulesText: "출현 - 물 공명 - 자신의 덱 맨 위 카드를 확인한 후, 그 카드를 덱 맨 위로 되돌리거나 묘지로 보낸다." },
  ebb: { name: "썰물", type: 'spell', cost: 2, attributes: ["water"], rulesText: "자신의 마나에 물 카드만 있어야 사용할 수 있다. 상대 전장의 소진된 몬스터 하나를 손으로 되돌린다." },
  ripple_spirit: { name: "잔물결 정령", type: 'unit', cost: 2, attack: 2, health: 3, attributes: ["water"], rulesText: "없음." },
  surging_wave: { name: "몰아치는 파도", type: 'unit', cost: 3, attack: 2, health: 3, attributes: ["water"], rulesText: "출현 - 자신의 덱 맨 위 카드를 확인한 후, 물 몬스터인 경우 소환할 수 있다. 이때, 출현은 발동하지 않는다." },
  ash_clearing_rain: { name: "잿더미를 치우는 비", type: 'spell', cost: 3, attributes: ["water"], rulesText: "공격력 혹은 체력이 1인 모든 몬스터를 묘지로 보낸다." },
  high_tide: { name: "밀물", type: 'spell', cost: 3, attributes: ["water"], rulesText: "카드 2장을 뽑는다." },
  reverse_current: { name: "역류", type: 'spell', cost: 3, attributes: ["water"], rulesText: "소진된 상대 몬스터 하나를 그 소유자의 손으로 가져온다." },
  tsunami: { name: "쓰나미", type: 'spell', cost: 2, attributes: ["earth", "water"], rulesText: "물 공명 - 카드 1장을 뽑는다. 땅 공명 - 덱 맨 위 카드를 소진된 상태로 자신의 마나에 놓는다." },
  seeding_fairy: { name: "씨 뿌리는 요정", type: 'unit', cost: 1, attack: 1, health: 1, attributes: ["earth"], rulesText: "출현 - 자신의 덱에 카드가 있다면, 덱 맨 위 카드를 소진된 상태로 자신의 마나에 놓는다." },
  tree_fairy: { name: "나무에 사는 요정", type: 'unit', cost: 1, attack: 0, health: 1, attributes: ["earth"], rulesText: "이 카드가 마나에 놓일 때, 카드 1장을 뽑는다. 각성 - 이 카드를 소진된 상태로 자신의 마나에 놓는다." },
  heavy_seed: { name: "너무 무거운 씨앗", type: 'unit', cost: 3, attack: 1, health: 2, attributes: ["earth"], rulesText: "자신의 마나에 땅 카드가 세 장 이상인 경우, 마나에 있는 이 카드를 소환할 수 있다." },
  rock_armor_knight: { name: "바위 갑옷 기사", type: 'unit', cost: 3, attack: 2, health: 4, attributes: ["earth"], rulesText: "없음." },
  desertification: { name: "사막화", type: 'spell', cost: 4, attributes: ["earth"], rulesText: "상대 전장의 몬스터 하나를 소진된 상태로 그 소유자의 마나에 놓는다. 그 후 이 카드를 소진된 상태로 자신의 마나에 놓는다." },
  overgrown_sprout: { name: "과하게 자라난 새싹", type: 'spell', cost: 4, attributes: ["earth"], rulesText: "자신의 마나에 땅 카드만 존재할 경우, 이번 턴 동안, 공격력이 1인 자신 몬스터가 직접 공격하면 상대는 라이프를 하나 추가로 잃는다." },
  floating_mountains: { name: "떠다니는 산맥", type: 'unit', cost: 5, attack: 5, health: 5, attributes: ["earth"], rulesText: "질풍" },
  grave_digging: { name: "파묘", type: 'spell', cost: 0, attributes: ["earth", "dark"], rulesText: "소진되지 않은 마나 1장을 묘지로 보낸다. 묘지에서 카드 1장을 손으로 되돌린다." },
  carrion_crow: { name: "시체를 먹는 까마귀", type: 'unit', cost: 1, attack: 1, health: 1, attributes: ["dark"], rulesText: "자신의 묘지에 카드가 2장 이상 있으면, 이 카드는 질풍을 얻는다." },
  corpse_cat: { name: "시체에 숨은 고양이", type: 'unit', cost: 1, attack: 1, health: 1, attributes: ["dark"], rulesText: "자신의 전장에 다른 몬스터가 있으면, 이 카드는 잠행을 얻는다." },
  nameless_shadow: { name: "이름 없는 그림자", type: 'unit', cost: 2, attack: 2, health: 1, attributes: ["dark"], rulesText: "고립 - 이 카드는 잠행을 얻는다." },
  blue_black_hound: { name: "검푸른 들개", type: 'unit', cost: 2, attack: 4, health: 1, attributes: ["dark"], rulesText: "없음." },
  coffin_warrior: { name: "관 속의 전사", type: 'unit', cost: 3, attack: 3, health: 3, attributes: ["dark"], rulesText: "이 카드가 손에 있는 동안, 자신의 어둠 카드가 묘지로 보내질 때마다 이 카드의 비용이 1 감소한다. 이 카드가 손을 떠나면 비용은 3이 된다." },
  demon_finger: { name: "악마의 손가락", type: 'unit', cost: 4, attack: 4, health: 4, attributes: ["dark"], rulesText: "" },
  demon_breath: { name: "악마의 숨결", type: 'spell', cost: 4, attributes: ["dark"], rulesText: "상대 전장에서 체력이 가장 높은 카드를 묘지로 보낸다. (여러 장일 경우 모두 보낸다.) 각성 - 이 카드를 사용한다." },
  eclipse: { name: "일식", type: 'spell', cost: 5, attributes: ["dark", "light"], rulesText: "빛 공명 - 전장의 모든 몬스터를 소진한다. 어둠 공명 - 전장의 모든 소진된 몬스터를 묘지로 보낸다. (빛 공명이 먼저 발동한다.) 각성 - 전장의 모든 몬스터를 소진한다." },
  pegasus_rider: { name: "페가수스 기마병", type: 'unit', cost: 1, attack: 1, health: 1, attributes: ["light"], rulesText: "비행" },
  temple_prospect: { name: "신전의 유망주", type: 'unit', cost: 1, attack: 1, health: 1, attributes: ["light"], rulesText: "출현 - 자신의 라이프에서 한 장을 손으로 가져온다. (이때, 그 카드의 각성 능력은 발동하지 않는다.) 가져왔을 경우, 자신의 손에서 한 장을 라이프에 뒷면 표시로 놓을 수 있다." },
  prophet: { name: "예언자", type: 'unit', cost: 2, attack: 2, health: 2, attributes: ["light"], rulesText: "이 몬스터가 전장에 있는 동안, 상대의 각성은 발동하지 않는다." },
  cathedral_guard: { name: "성당 경비병", type: 'unit', cost: 2, attack: 1, health: 4, attributes: ["light"], rulesText: "없음." },
  apostle_pigeon: { name: "사도의 비둘기", type: 'unit', cost: 3, attack: 1, health: 3, attributes: ["light"], rulesText: "이 몬스터가 전장에 있는 동안, 각 플레이어는 턴마다 한 번만 공격할 수 있다. 각성 - 자신의 전장에 빈 슬롯이 있다면 이 카드를 소환한다." },
  devotion: { name: "헌신", type: 'spell', cost: 3, attributes: ["light"], rulesText: "라이프가 2 이하일 때 사용할 수 있다. 이 카드를 자신의 라이프에 뒷면 표시로 놓는다." },
  holy_mirror_wall: { name: "성스러운 거울의 벽", type: 'spell', cost: 5, attributes: ["light"], rulesText: "상대의 라이프 한 장을 묘지로 보낸다. (이때, 그 카드의 각성 능력은 발동하지 않는다.) 각성 - 이 카드를 발동한다." },
  battle_campfire: { name: "전장의 모닥불", type: 'spell', cost: 2, attributes: ["fire", "light"], rulesText: "불 공명 - 모든 몬스터에게 1 피해를 준다. 빛 공명 - 내 모든 몬스터가 +1 회복한다. (불 공명이 먼저 발동한다.)" },
} as const

describe('사용자 카드 원고 반영', () => {
  test('40장 모두 원고의 속성·비용·능력 문구와 일치한다', () => {
    expect(Object.keys(CARDS)).toHaveLength(40)
    for (const [cardId, expected] of Object.entries(SOURCE)) {
      const card = CARDS[cardId as keyof typeof CARDS]
      expect(card).toMatchObject(expected)
      expect(card.families).toEqual([])
    }
  })
})
