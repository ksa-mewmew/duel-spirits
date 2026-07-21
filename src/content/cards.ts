import { CARD_SETS, CONTENT_VERSION } from './sets'
import type { SetId } from './schema'

export type CardAttributeId = 'fire' | 'water' | 'earth' | 'dark' | 'light'

export interface CardAttributeDefinition {
  id: CardAttributeId
  name: string
  shortName: string
  description: string
}

/**
 * 불·물·땅·어둠·빛은 카드의 속성입니다.
 * 추후 종족·직업·계열처럼 별개의 속성이 추가되더라도 속성과 혼합하지 않습니다.
 */
export const CARD_ATTRIBUTES: Record<CardAttributeId, CardAttributeDefinition> = {
  fire: { id: 'fire', name: '불', shortName: '불', description: '공격과 폭발' },
  water: { id: 'water', name: '물', shortName: '물', description: '드로우와 되돌리기' },
  earth: { id: 'earth', name: '땅', shortName: '땅', description: '마나와 성장' },
  dark: { id: 'dark', name: '어둠', shortName: '암', description: '묘지와 고립' },
  light: { id: 'light', name: '빛', shortName: '빛', description: '라이프와 비행' },
}

/** 미래의 카드군 식별자는 속성과 독립적으로 확장합니다. */
export type CardFamilyId = string

export const CARD_IDS = [
  'volcano_mouse', 'living_flame', 'living_smoke', 'last_ember', 'ash_hound', 'moth_swarm', 'burning_procession', 'ash_pirate_ship',
  'wave_reader', 'ebb', 'ripple_spirit', 'surging_wave', 'ash_clearing_rain', 'high_tide', 'reverse_current', 'tsunami',
  'seeding_fairy', 'tree_fairy', 'heavy_seed', 'rock_armor_knight', 'desertification', 'overgrown_sprout', 'floating_mountains', 'grave_digging',
  'carrion_crow', 'corpse_cat', 'nameless_shadow', 'blue_black_hound', 'coffin_warrior', 'demon_finger', 'demon_breath', 'eclipse',
  'pegasus_rider', 'temple_prospect', 'prophet', 'cathedral_guard', 'apostle_pigeon', 'devotion', 'holy_mirror_wall', 'battle_campfire',
] as const

export type CardId = typeof CARD_IDS[number]

export type CardKeyword =
  | 'rush'
  | 'charge'
  | 'windfury'
  | 'flying'
  | 'stealth'
  | 'last_words'

export interface CardBase {
  artUrl?: string
  id: CardId
  name: string
  cost: number
  attributes: CardAttributeId[]
  families: CardFamilyId[]
  rulesText: string
  visualKey: string
  setId: SetId
  collectorNumber: string
  contentVersion: string
}

export interface UnitCard extends CardBase {
  type: 'unit'
  attack: number
  health: number
  keywords?: CardKeyword[]
}

export interface SpellCard extends CardBase {
  type: 'spell'
}

export type CardDefinition = UnitCard | SpellCard

const getMetadata = (id: CardId) => {
  const setId: SetId = 'foundations-001'
  const code = CARD_SETS[setId].code
  const number = String(CARD_IDS.indexOf(id) + 1).padStart(3, '0')
  return {
    setId,
    collectorNumber: `${code}-${number}`,
    contentVersion: CONTENT_VERSION,
  }
}

const u = (
  id: CardId,
  name: string,
  cost: number,
  attack: number,
  health: number,
  attributes: CardAttributeId[],
  rulesText = '',
  keywords: CardKeyword[] = [],
  visualKey = 'rings',
  families: CardFamilyId[] = [],
): UnitCard => ({
  id,
  name,
  type: 'unit',
  cost,
  attack,
  health,
  attributes,
  families,
  rulesText,
  keywords,
  visualKey,
  ...getMetadata(id),
})

const s = (
  id: CardId,
  name: string,
  cost: number,
  attributes: CardAttributeId[],
  rulesText: string,
  visualKey = 'waves',
  families: CardFamilyId[] = [],
): SpellCard => ({
  id,
  name,
  type: 'spell',
  cost,
  attributes,
  families,
  rulesText,
  visualKey,
  ...getMetadata(id),
})

export const CARDS: Record<CardId, CardDefinition> = {
  volcano_mouse: u(
    'volcano_mouse', '화산쥐', 0, 1, 1, ['fire'],
    '자신의 마나에 불 카드가 2장 이상 있을 때만 이 카드를 소환할 수 있다.',
  ),
  living_flame: u('living_flame', '살아 움직이는 불꽃', 1, 2, 1, ['fire'], '없음.'),
  living_smoke: u(
    'living_smoke', '살아 움직이는 연기', 2, 3, 1, ['fire'],
    '각성 - 자신의 전장에 빈 슬롯이 있다면 이 카드를 소환한다.',
  ),
  last_ember: u(
    'last_ember', '마지막 불씨', 2, 2, 1, ['fire'],
    '고립 - 이 몬스터는 돌진과 공격력 +2를 얻는다. 유언 - 카드를 1장 뽑는다.',
    ['last_words'],
  ),
  ash_hound: u('ash_hound', '잿빛 들개', 2, 3, 2, ['fire'], '돌진', ['charge']),
  moth_swarm: u('moth_swarm', '불나방 무리', 3, 3, 1, ['fire'], '기습', ['rush']),
  burning_procession: s(
    'burning_procession', '불타는 행렬', 3, ['fire'],
    '자신의 전장에 있는 불 몬스터 수만큼 자신의 덱 맨 위 카드를 확인한다. 그중 비용 1 이하인 불 몬스터를 자신의 빈 전장만큼 소환할 수 있다. 나머지는 묘지로 보낸다.',
  ),
  ash_pirate_ship: u(
    'ash_pirate_ship', '잿더미 해적선', 3, 3, 1, ['fire', 'water'],
    '출현 - 불 공명 - 이 턴 동안, 자신의 모든 몬스터는 공격력 +2를 얻는다. 출현 - 물 공명 - 양쪽 전장에 다른 몬스터가 셋 이상 존재할 경우, 이 카드는 기습을 얻는다.',
  ),
  wave_reader: u(
    'wave_reader', '물결을 읽는 자', 1, 1, 1, ['water'],
    '출현 - 물 공명 - 자신의 덱 맨 위 카드를 확인한 후, 그 카드를 덱 맨 위로 되돌리거나 묘지로 보낸다.',
  ),
  ebb: s(
    'ebb', '썰물', 2, ['water'],
    '자신의 마나에 물 카드만 있어야 사용할 수 있다. 상대 전장의 소진된 몬스터 하나를 손으로 되돌린다.',
  ),
  ripple_spirit: u('ripple_spirit', '잔물결 정령', 2, 2, 3, ['water'], '없음.'),
  surging_wave: u(
    'surging_wave', '몰아치는 파도', 3, 2, 3, ['water'],
    '출현 - 자신의 덱 맨 위 카드를 확인한 후, 물 몬스터인 경우 소환할 수 있다. 이때, 출현은 발동하지 않는다.',
  ),
  ash_clearing_rain: s(
    'ash_clearing_rain', '잿더미를 치우는 비', 3, ['water'],
    '공격력 혹은 체력이 1인 모든 몬스터를 묘지로 보낸다.',
  ),
  high_tide: s('high_tide', '밀물', 3, ['water'], '카드 2장을 뽑는다.'),
  reverse_current: s(
    'reverse_current', '역류', 3, ['water'],
    '소진된 상대 몬스터 하나를 그 소유자의 손으로 가져온다.',
  ),
  tsunami: s(
    'tsunami', '쓰나미', 2, ['earth', 'water'],
    '물 공명 - 카드 1장을 뽑는다. 땅 공명 - 덱 맨 위 카드를 소진된 상태로 자신의 마나에 놓는다.',
  ),
  seeding_fairy: u(
    'seeding_fairy', '씨 뿌리는 요정', 1, 1, 1, ['earth'],
    '출현 - 자신의 덱에 카드가 있다면, 덱 맨 위 카드를 소진된 상태로 자신의 마나에 놓는다.',
  ),
  tree_fairy: u(
    'tree_fairy', '나무에 사는 요정', 1, 0, 1, ['earth'],
    '이 카드가 마나에 놓일 때, 카드 1장을 뽑는다. 각성 - 이 카드를 소진된 상태로 자신의 마나에 놓는다.',
  ),
  heavy_seed: u(
    'heavy_seed', '너무 무거운 씨앗', 3, 1, 2, ['earth'],
    '자신의 마나에 땅 카드가 세 장 이상인 경우, 마나에 있는 이 카드를 소환할 수 있다.',
  ),
  rock_armor_knight: u('rock_armor_knight', '바위 갑옷 기사', 3, 2, 4, ['earth'], '없음.'),
  desertification: s(
    'desertification', '사막화', 4, ['earth'],
    '상대 전장의 몬스터 하나를 소진된 상태로 그 소유자의 마나에 놓는다. 그 후 이 카드를 소진된 상태로 자신의 마나에 놓는다.',
  ),
  overgrown_sprout: s(
    'overgrown_sprout', '과하게 자라난 새싹', 4, ['earth'],
    '자신의 마나에 땅 카드만 존재할 경우, 이번 턴 동안, 공격력이 1인 자신 몬스터가 직접 공격하면 상대는 라이프를 하나 추가로 잃는다.',
  ),
  floating_mountains: u('floating_mountains', '떠다니는 산맥', 5, 5, 5, ['earth'], '질풍', ['windfury']),
  grave_digging: s(
    'grave_digging', '파묘', 0, ['earth', 'dark'],
    '소진되지 않은 마나 1장을 묘지로 보낸다. 묘지에서 카드 1장을 손으로 되돌린다.',
  ),
  carrion_crow: u(
    'carrion_crow', '시체를 먹는 까마귀', 1, 1, 1, ['dark'],
    '자신의 묘지에 카드가 2장 이상 있으면, 이 카드는 질풍을 얻는다.',
  ),
  corpse_cat: u(
    'corpse_cat', '시체에 숨은 고양이', 1, 1, 1, ['dark'],
    '자신의 전장에 다른 몬스터가 있으면, 이 카드는 잠행을 얻는다.',
  ),
  nameless_shadow: u(
    'nameless_shadow', '이름 없는 그림자', 2, 2, 1, ['dark'],
    '고립 - 이 카드는 잠행을 얻는다.',
  ),
  blue_black_hound: u('blue_black_hound', '검푸른 들개', 2, 4, 1, ['dark'], '없음.'),
  coffin_warrior: u(
    'coffin_warrior', '관 속의 전사', 3, 3, 3, ['dark'],
    '이 카드가 손에 있는 동안, 자신의 어둠 카드가 묘지로 보내질 때마다 이 카드의 비용이 1 감소한다. 이 카드가 손을 떠나면 비용은 3이 된다.',
  ),
  demon_finger: u('demon_finger', '악마의 손가락', 4, 4, 4, ['dark'], ''),
  demon_breath: s(
    'demon_breath', '악마의 숨결', 5, ['dark'],
    '상대 전장에서 체력이 가장 높은 카드를 묘지로 보낸다. (여러 장일 경우 모두 보낸다.) 각성 - 이 카드를 사용한다.',
  ),
  eclipse: s(
    'eclipse', '일식', 5, ['dark', 'light'],
    '빛 공명 - 전장의 모든 몬스터를 소진한다. 어둠 공명 - 전장의 모든 소진된 몬스터를 묘지로 보낸다. (빛 공명이 먼저 발동한다.) 각성 - 전장의 모든 몬스터를 소진한다.',
  ),
  pegasus_rider: u('pegasus_rider', '페가수스 기마병', 1, 1, 1, ['light'], '비행', ['flying']),
  temple_prospect: u(
    'temple_prospect', '신전의 유망주', 1, 1, 1, ['light'],
    '출현 - 자신의 라이프에서 한 장을 손으로 가져온다. (이때, 그 카드의 각성 능력은 발동하지 않는다.) 가져왔을 경우, 자신의 손에서 한 장을 라이프에 뒷면 표시로 놓을 수 있다.',
  ),
  prophet: u(
    'prophet', '예언자', 2, 2, 2, ['light'],
    '이 몬스터가 전장에 있는 동안, 상대의 각성은 발동하지 않는다.',
  ),
  cathedral_guard: u('cathedral_guard', '성당 경비병', 2, 1, 4, ['light'], '없음.'),
  apostle_pigeon: u(
    'apostle_pigeon', '사도의 비둘기', 3, 1, 3, ['light'],
    '이 몬스터가 전장에 있는 동안, 각 플레이어는 턴마다 한 번만 공격할 수 있다. 각성 - 자신의 전장에 빈 슬롯이 있다면 이 카드를 소환한다.',
  ),
  devotion: s(
    'devotion', '헌신', 3, ['light'],
    '라이프가 2 이하일 때 사용할 수 있다. 이 카드를 자신의 라이프에 뒷면 표시로 놓는다.',
  ),
  holy_mirror_wall: s(
    'holy_mirror_wall', '성스러운 거울의 벽', 5, ['light'],
    '상대의 라이프 한 장을 묘지로 보낸다. (이때, 그 카드의 각성 능력은 발동하지 않는다.) 각성 - 이 카드를 발동한다.',
  ),
  battle_campfire: s(
    'battle_campfire', '전장의 모닥불', 2, ['fire', 'light'],
    '불 공명 - 모든 몬스터에게 1 피해를 준다. 빛 공명 - 내 모든 몬스터가 +1 회복한다. (불 공명이 먼저 발동한다.)',
  ),
}

export const ALL_CARD_IDS = [...CARD_IDS]

export const DEFAULT_DECK: CardId[] = [
  'living_flame', 'living_flame', 'living_smoke', 'last_ember',
  'ash_hound', 'moth_swarm', 'pegasus_rider', 'temple_prospect',
  'prophet', 'cathedral_guard', 'battle_campfire', 'holy_mirror_wall',
]

export const getCard = (id: CardId) => CARDS[id]
export const isCardId = (value: unknown): value is CardId =>
  typeof value === 'string' && value in CARDS
