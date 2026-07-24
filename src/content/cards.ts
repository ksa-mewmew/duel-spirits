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
  'spark_chasing_lizard', 'unexploded_bomb_mouse', 'iron_horn_boar', 'flame_javelin_soldier', 'volcanic_eruption', 'flame_mane_captain', 'exploding_mountain_dragon',
  'scale_diver', 'underwater_observer', 'returning_jellyfish', 'ice_mirror_spirit', 'grand_reverse_current', 'wave_fin', 'crystal_tsunami',
  'hard_seed_bug', 'boulder_carrier', 'mana_flipping_fairy', 'cliff_hunter', 'rising_earth', 'walking_hill', 'earth_guardian',
  'poisoned_skeleton', 'grave_merchant', 'weakened_giant', 'funeral_inviter', 'mass_burial', 'blackwing_predator', 'mourner',
  'silent_shield_soldier', 'returning_paladin', 'little_judge', 'salvation_lancer', 'last_prayer', 'sky_white_horse_knight', 'spirit_agent',
  'lava_gardener', 'stone_pillar_priest', 'mirror_lake_prophet', 'sunken_coffin_keeper', 'crematory_smoke',
] as const

export type CardId = typeof CARD_IDS[number]

export type CardKeyword =
  | 'rush'
  | 'charge'
  | 'windfury'
  | 'flying'
  | 'stealth'
  | 'last_words'
  | 'assassination'

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
  /** 이 속성의 내 몬스터 위에 겹쳐서 사용할 수 있는 진화 몬스터입니다. */
  evolutionAttribute?: CardAttributeId
}

export interface SpellCard extends CardBase {
  type: 'spell'
}

export type CardDefinition = UnitCard | SpellCard

export const SOF_CARD_IDS = [
  'spark_chasing_lizard', 'unexploded_bomb_mouse', 'iron_horn_boar', 'flame_javelin_soldier', 'volcanic_eruption', 'flame_mane_captain', 'exploding_mountain_dragon',
  'scale_diver', 'underwater_observer', 'returning_jellyfish', 'ice_mirror_spirit', 'grand_reverse_current', 'wave_fin', 'crystal_tsunami',
  'hard_seed_bug', 'boulder_carrier', 'mana_flipping_fairy', 'cliff_hunter', 'rising_earth', 'walking_hill', 'earth_guardian',
  'poisoned_skeleton', 'grave_merchant', 'weakened_giant', 'funeral_inviter', 'mass_burial', 'blackwing_predator', 'mourner',
  'silent_shield_soldier', 'returning_paladin', 'little_judge', 'salvation_lancer', 'last_prayer', 'sky_white_horse_knight', 'spirit_agent',
  'lava_gardener', 'stone_pillar_priest', 'mirror_lake_prophet', 'sunken_coffin_keeper', 'crematory_smoke',
] as const satisfies readonly CardId[]

const sofCardIds = new Set<CardId>(SOF_CARD_IDS)

const getMetadata = (id: CardId) => {
  const setId: SetId = sofCardIds.has(id) ? 'evolution-begins-001' : 'foundations-001'
  const code = CARD_SETS[setId].code
  const setCards = setId === 'evolution-begins-001' ? SOF_CARD_IDS : CARD_IDS.filter((cardId) => !sofCardIds.has(cardId))
  const number = String(setCards.indexOf(id as never) + 1).padStart(3, '0')
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
  evolutionAttribute?: CardAttributeId,
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
  evolutionAttribute,
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
    '자신의 마나에 불 카드가 2장 이상 있는 경우에만 소환할 수 있다.',
  ),
  living_flame: u('living_flame', '살아 움직이는 불꽃', 1, 2, 1, ['fire'], '없음.'),
  living_smoke: u(
    'living_smoke', '살아 움직이는 연기', 2, 0, 3, ['fire'],
    '전투할 때마다, 이 몬스터는 공격력 +2를 얻는다. 각성 - 자신의 전장에 빈 슬롯이 있다면 이 카드를 소환한다.',
  ),
  last_ember: u(
    'last_ember', '마지막 불씨', 2, 2, 1, ['fire'],
    '고립 - 이 몬스터는 돌진을 얻는다. 유언 - 카드 1장을 뽑는다.',
    ['last_words'],
  ),
  ash_hound: u('ash_hound', '잿빛 들개', 2, 3, 2, ['fire'], '돌진.', ['charge']),
  moth_swarm: u('moth_swarm', '불나방 무리', 3, 3, 1, ['fire'], '기습.', ['rush']),
  burning_procession: s(
    'burning_procession', '불타는 행렬', 4, ['fire'],
    '자신의 덱 맨 위 카드 3장을 확인한다. 그중 비용이 2 이하인 불 몬스터를 최대 2장까지 소환한다. 나머지는 묘지로 보낸다.',
  ),
  ash_pirate_ship: u(
    'ash_pirate_ship', '잿더미 해적선', 4, 3, 2, ['fire', 'water'],
    '출현 - 불 공명 - 이번 턴 동안 자신의 모든 몬스터는 공격력 +2를 얻는다. 출현 - 물 공명 - 이 몬스터는 기습을 얻는다.',
  ),
  wave_reader: u(
    'wave_reader', '물결을 읽는 자', 1, 1, 2, ['water'],
    '출현 - 물 공명 - 자신의 덱 맨 위 카드를 확인한다. 그 카드를 덱 맨 위로 되돌리거나 묘지로 보낸다.',
  ),
  ripple_spirit: u(
    'ripple_spirit', '잔물결 정령', 2, 1, 2, ['water'],
    '출현 - 카드를 1장 뽑는다.',
  ),
  ebb: s(
    'ebb', '썰물', 3, ['water'],
    '자신의 마나에 물 카드만 있을 때 사용할 수 있다. (속성이 여러 개인 경우, 물 속성이 있으면 물 카드로 취급한다.) 상대 전장의 소진된 몬스터 하나를 그 소유자의 손으로 가져온다.',
  ),
  surging_wave: u(
    'surging_wave', '몰아치는 파도', 3, 2, 3, ['water'],
    '출현 - 자신의 덱 맨 위 카드 2장을 확인한다. 그중 비용 2 이하의 물 몬스터 한 장을 공개하고 소환할 수 있다. (이때, 출현은 발동하지 않는다.) 나머지는 원하는 순서로 덱 맨 아래에 놓는다.',
  ),
  ash_clearing_rain: s(
    'ash_clearing_rain', '잿더미를 치우는 비', 3, ['water'],
    '공격력이 1이거나 남은 체력이 1인 모든 몬스터를 묘지로 보낸다.',
  ),
  high_tide: s('high_tide', '밀물', 3, ['water'], '카드 2장을 뽑는다.'),
  reverse_current: s(
    'reverse_current', '역류', 4, ['water'],
    '상대 전장의 소진된 몬스터 하나를 그 소유자의 손으로 가져온다.',
  ),
  tsunami: s(
    'tsunami', '쓰나미', 2, ['water', 'earth'],
    '물 공명 - 카드 1장을 뽑는다. 땅 공명 - 자신의 덱 맨 위 카드를 소진된 상태로 자신의 마나에 놓는다.',
  ),
  tree_fairy: u(
    'tree_fairy', '나무에 사는 요정', 1, 1, 1, ['earth'],
    '이 카드가 마나에 놓일 때, 손에서 마나에 카드를 한 장 놓을 수 있다.',
  ),
  seeding_fairy: u(
    'seeding_fairy', '씨 뿌리는 요정', 1, 1, 1, ['earth'],
    '출현 - 자신의 덱에 카드가 있다면, 덱 맨 위 카드를 소진된 상태로 자신의 마나에 놓는다.',
  ),
  heavy_seed: u(
    'heavy_seed', '너무 무거운 씨앗', 3, 1, 3, ['earth'],
    '자신의 마나에 땅 카드가 4장 이상 있다면, 마나에 있는 이 카드를 소환할 수 있다.',
  ),
  rock_armor_knight: u('rock_armor_knight', '바위 갑옷 기사', 3, 2, 4, ['earth'], '없음.'),
  desertification: s(
    'desertification', '사막화', 5, ['earth'],
    '상대 전장의 몬스터 하나를 소진된 상태로 그 소유자의 마나에 놓는다. 그 후 이 카드를 소진된 상태로 자신의 마나에 놓는다.',
  ),
  overgrown_sprout: s(
    'overgrown_sprout', '하늘까지 자라난 새싹', 4, ['earth'],
    '자신의 마나에 땅 카드가 4장 이상 있다면, 이번 턴 동안 공격력이 1인 자신의 몬스터가 비행을 얻는다.',
  ),
  floating_mountains: u('floating_mountains', '떠다니는 산맥', 6, 5, 6, ['earth'], '질풍.', ['windfury']),
  grave_digging: s(
    'grave_digging', '파묘', 3, ['earth', 'dark'],
    '자신의 준비된 마나 하나를 묘지로 보낸다. 그 후 자신의 묘지에서 카드 2장을 손으로 가져올 수 있다.',
  ),
  nameless_shadow: u(
    'nameless_shadow', '이름 없는 그림자', 1, 1, 2, ['dark'],
    '자신의 묘지에 카드가 3장 이상 있다면, 이 몬스터는 암살을 얻는다.',
  ),
  corpse_cat: u(
    'corpse_cat', '시체에 숨은 고양이', 1, 1, 2, ['dark'],
    '자신의 전장에 다른 몬스터가 있다면, 이 몬스터는 잠행을 얻는다.',
  ),
  carrion_crow: u(
    'carrion_crow', '시체를 먹는 까마귀', 2, 1, 1, ['dark'],
    '잠행. 고립 - 이 몬스터는 비행을 얻는다.',
    ['stealth'],
  ),
  blue_black_hound: u(
    'blue_black_hound', '검푸른 들개', 2, 4, 2, ['dark'],
    '어둠 공명 - 이 몬스터는 돌진을 얻는다. 이 몬스터는 직접 공격할 수 없다.',
  ),
  coffin_warrior: u(
    'coffin_warrior', '관 속의 전사', 4, 3, 3, ['dark'],
    '어둠 카드가 2장 이상 묘지로 보내진 턴에, 이 카드는 비용 없이 낼 수 있다.',
  ),
  demon_finger: u(
    'demon_finger', '악마의 손가락', 4, 4, 4, ['dark'],
    '유언 - 상대는 손에서 카드 1장을 선택해 묘지로 보낸다.',
    ['last_words'],
  ),
  demon_breath: s(
    'demon_breath', '악마의 숨결', 5, ['dark'],
    '상대 전장에서 남은 체력이 가장 높은 몬스터 중 1장을 골라 묘지로 보낸다. 각성 - 이 카드를 사용한다.',
  ),
  eclipse: s(
    'eclipse', '일식', 6, ['dark', 'light'],
    '빛 공명 - 전장의 모든 몬스터를 소진한다. 어둠 공명 - 전장의 모든 소진된 몬스터를 묘지로 보낸다. 빛 공명을 먼저 처리한다. 각성 - 전장의 모든 몬스터를 소진한다.',
  ),
  pegasus_rider: u('pegasus_rider', '페가수스 기마병', 2, 1, 2, ['light'], '비행.', ['flying']),
  temple_prospect: u(
    'temple_prospect', '신전의 유망주', 2, 2, 2, ['light'],
    '출현 - 자신의 라이프 카드 하나를 선택해 손으로 가져온다. 이때 그 카드의 각성은 발동하지 않는다. 카드를 가져왔다면, 자신의 손에서 카드 하나를 자신의 라이프에 뒷면으로 놓을 수 있다.',
  ),
  cathedral_guard: u(
    'cathedral_guard', '성당 경비병', 2, 1, 4, ['light'],
    '이 몬스터가 준비된 상태라면, 상대는 비용 1 이하 몬스터로 공격할 수 없다.',
  ),
  prophet: u(
    'prophet', '예언자', 3, 2, 3, ['light'],
    '이 몬스터가 전장에 있는 동안 상대의 각성은 발동하지 않는다.',
  ),
  apostle_pigeon: u(
    'apostle_pigeon', '사도의 비둘기', 3, 1, 3, ['light'],
    '이 몬스터가 전장에 있는 동안 각 플레이어는 자신의 턴마다 한 번만 공격할 수 있다. 각성 - 자신의 전장에 빈 슬롯이 있다면 이 카드를 소환한다.',
  ),
  devotion: s(
    'devotion', '헌신', 4, ['light'],
    '자신의 라이프가 2장 이하일 때만 사용할 수 있다. 이 카드를 자신의 라이프 영역에 뒷면으로 놓는다.',
  ),
  holy_mirror_wall: s(
    'holy_mirror_wall', '성스러운 거울의 벽', 6, ['light'],
    '상대의 라이프 카드 하나를 묘지로 보낸다. 이때 그 카드의 각성은 발동하지 않는다. 각성 - 이 카드를 사용한다.',
  ),
  battle_campfire: s(
    'battle_campfire', '전장의 모닥불', 3, ['fire', 'light'],
    '불 공명 - 전장의 모든 몬스터에게 피해 1을 준다. 빛 공명 - 자신의 모든 몬스터가 받은 피해를 1씩 회복한다. 불 공명을 먼저 처리한다.',
  ),

  // 진화의 시작 (SOF) · 불
  spark_chasing_lizard: u(
    'spark_chasing_lizard', '불똥을 쫓는 도마뱀', 1, 0, 1, ['fire'],
    '이 몬스터가 공격하는 동안 공격력 +3을 얻는다.',
  ),
  unexploded_bomb_mouse: u(
    'unexploded_bomb_mouse', '터지지 않은 폭탄쥐', 2, 2, 1, ['fire'],
    '유언 - 상대 몬스터 하나에게 피해 2를 준다.', ['last_words'],
  ),
  iron_horn_boar: u(
    'iron_horn_boar', '쇠뿔 멧돼지', 2, 4, 2, ['fire'],
    '불 공명 - 돌진. 이 몬스터는 직접 공격할 수 없다.',
  ),
  flame_javelin_soldier: u(
    'flame_javelin_soldier', '화염 투창병', 3, 1, 4, ['fire'],
    '이 몬스터가 전투할 때, 전투 전에 상대 몬스터에게 피해 1을 준다. 그 피해로 상대 몬스터가 묘지로 보내졌다면 전투는 일어나지 않는다.',
  ),
  volcanic_eruption: s(
    'volcanic_eruption', '화산 폭발', 5, ['fire'],
    '모든 몬스터에게 피해 2를 준다. 이 효과로 자신의 불 몬스터가 묘지로 보내졌다면, 한 번 더 발동한다.',
  ),
  flame_mane_captain: u(
    'flame_mane_captain', '화염갈기 대장', 3, 3, 3, ['fire'],
    '진화 - 불 몬스터. 이 몬스터가 전투로 상대 몬스터를 묘지로 보냈다면, 이 몬스터를 준비한다.',
    [], 'rings', [], 'fire',
  ),
  exploding_mountain_dragon: u(
    'exploding_mountain_dragon', '폭발하는 산맥룡', 6, 5, 3, ['fire'],
    '진화 - 불 몬스터. 출현 - 상대의 모든 몬스터에게 피해 2를 준다. 이 몬스터가 직접 공격할 때 상대의 라이프가 3장 이상이라면, 상대는 라이프를 하나 추가로 잃는다.',
    [], 'rings', [], 'fire',
  ),

  // 물
  scale_diver: u(
    'scale_diver', '비늘 잠수부', 1, 1, 2, ['water'],
    '이 몬스터는 공격력이 3 이상인 몬스터에게 공격받지 않는다. 이 효과로 인해 공격할 수 있는 몬스터가 없는 경우, 상대는 직접 공격할 수 있다.',
  ),
  underwater_observer: u(
    'underwater_observer', '물밑을 살피는 자', 2, 2, 3, ['water'],
    '출현 - 자신의 덱 맨 위 카드 2장을 확인한다. 원하는 순서로 덱 맨 위에 되돌리거나, 그중 한 장을 묘지로 보낼 수 있다.',
  ),
  returning_jellyfish: u(
    'returning_jellyfish', '되돌아오는 해파리', 2, 2, 4, ['water'],
    '이 몬스터가 전투한 뒤 살아 있다면, 이 몬스터를 소유자의 손으로 가져온다.',
  ),
  ice_mirror_spirit: u(
    'ice_mirror_spirit', '얼음거울 정령', 3, 2, 3, ['water'],
    '출현 - 상대의 소진된 비용 2 이하인 몬스터 하나를 선택한다. 그 몬스터는 다음 턴에 준비되지 않는다.',
  ),
  grand_reverse_current: s(
    'grand_reverse_current', '대환류', 5, ['water'],
    '전장의 모든 소진된 몬스터를 각각 그 소유자의 손으로 가져온다.',
  ),
  wave_fin: u(
    'wave_fin', '파도의 등지느러미', 3, 3, 4, ['water'],
    '진화 - 물 몬스터. 출현 - 상대의 소진된 비용 2 이하 몬스터 하나를 그 소유자의 손으로 가져올 수 있다. 이 몬스터가 직접 공격한 뒤, 카드 1장을 뽑을 수 있다. 그렇게 한 경우, 손에서 카드 한 장을 덱 맨 아래에 놓는다.',
    [], 'waves', [], 'water',
  ),
  crystal_tsunami: u(
    'crystal_tsunami', '수정 해일', 5, 4, 4, ['water'],
    '진화 - 물 몬스터. 비행. 출현 - 상대의 소진된 몬스터 하나를 그 소유자의 손으로 가져올 수 있다.',
    ['flying'], 'waves', [], 'water',
  ),

  // 땅
  hard_seed_bug: u(
    'hard_seed_bug', '단단한 씨앗벌레', 1, 1, 2, ['earth'],
    '자신의 마나에 땅 카드가 5장 이상 있다면, 이 몬스터는 공격력 +1과 체력 +1을 얻는다.',
  ),
  boulder_carrier: u(
    'boulder_carrier', '돌덩이 운반꾼', 2, 2, 4, ['earth'],
    '이 몬스터는 직접 공격할 수 없다.',
  ),
  mana_flipping_fairy: u(
    'mana_flipping_fairy', '땅을 가는 요정', 2, 1, 3, ['earth'],
    '출현 - 자신의 마나 하나를 손으로 가져올 수 있다. 그렇게 했다면, 자신의 손에서 카드 한 장을 소진된 상태로 마나에 놓는다.',
  ),
  cliff_hunter: u(
    'cliff_hunter', '절벽의 사냥꾼', 3, 1, 4, ['earth'],
    '이 몬스터가 몬스터를 공격하는 동안 공격력 +2를 얻는다.',
  ),
  rising_earth: s(
    'rising_earth', '솟아나는 대지', 5, ['earth'],
    '자신의 마나에서 비용 5 이하이며 진화 몬스터가 아닌 몬스터 하나를 소환한다. 그 몬스터의 출현은 발동하지 않는다. 그 몬스터가 땅 몬스터라면 이번 턴 동안 돌진을 얻는다.',
  ),
  walking_hill: u(
    'walking_hill', '걸어 다니는 언덕', 4, 5, 5, ['earth'],
    '진화 - 땅 몬스터. 이 몬스터는 상대 효과로 손으로 돌아가지 않는다.',
    [], 'rings', [], 'earth',
  ),
  earth_guardian: u(
    'earth_guardian', '대지의 수호자', 6, 4, 4, ['earth'],
    '진화 - 땅 몬스터. 이 몬스터가 진화해서 소환되었을 때, 자신의 마나에서 비용 2 이하인 몬스터를 최대 2장까지 빈 전장에 소환할 수 있다. 그 몬스터들의 출현은 발동하지 않는다.',
    [], 'rings', [], 'earth',
  ),

  // 어둠
  poisoned_skeleton: u(
    'poisoned_skeleton', '독이 발린 해골', 2, 1, 1, ['dark'],
    '암살.', ['assassination'],
  ),
  grave_merchant: u(
    'grave_merchant', '무덤 안의 상인', 2, 2, 2, ['dark'],
    '출현 - 자신의 묘지에서 비용 1 이하인 몬스터 하나를 손으로 가져온다.',
  ),
  weakened_giant: u(
    'weakened_giant', '쇠약한 거인', 2, 4, 4, ['dark'],
    '이 몬스터는 직접 공격할 수 없다. 자신의 턴 종료 시 자신의 묘지에 어둠 카드가 없다면 이 몬스터를 묘지로 보낸다.',
  ),
  funeral_inviter: u(
    'funeral_inviter', '장례식의 초대자', 3, 2, 3, ['dark'],
    '유언 - 상대는 자신의 손에서 카드 한 장을 선택해 묘지로 보낸다. 자신의 묘지에 카드가 4장 이상 있다면 이 몬스터는 잠행을 얻는다.',
    ['last_words'],
  ),
  mass_burial: s(
    'mass_burial', '집단 매장', 4, ['dark'],
    '상대는 자신의 전장에서 몬스터 하나를 선택해 묘지로 보낸다. 자신의 전장에 몬스터가 있다면, 자신의 몬스터 하나를 묘지로 보낼 수 있다. 그렇게 했다면 상대는 몬스터 하나를 추가로 선택해 묘지로 보낸다.',
  ),
  blackwing_predator: u(
    'blackwing_predator', '검은날개 포식자', 3, 1, 4, ['dark'],
    '진화 - 어둠 몬스터. 암살. 출현 - 자신의 묘지에서 비용 1 이하인 어둠 몬스터 하나를 손으로 가져올 수 있다.',
    ['assassination'], 'rings', [], 'dark',
  ),
  mourner: u(
    'mourner', '장송하는 자', 5, 4, 5, ['dark'],
    '진화 - 어둠 몬스터. 출현 - 자신의 다른 몬스터 하나를 묘지로 보낼 수 있다. 그렇게 했다면 상대 몬스터 하나를 묘지로 보낸다. 유언 - 자신의 묘지에서 비용 2 이하인 어둠 몬스터 하나를 소환할 수 있다. 그 몬스터의 출현은 발동하지 않는다.',
    ['last_words'], 'rings', [], 'dark',
  ),

  // 빛
  silent_shield_soldier: u(
    'silent_shield_soldier', '침묵하는 방패병', 2, 2, 4, ['light'],
    '이 몬스터는 공격할 수 없다.',
  ),
  returning_paladin: u(
    'returning_paladin', '돌아오는 성기사', 2, 2, 2, ['light'],
    '이 몬스터가 몬스터를 공격한 뒤 살아 있다면 이 몬스터를 준비한다.',
  ),
  little_judge: u(
    'little_judge', '작은 심판관', 2, 2, 3, ['light'],
    '상대의 비용 1 이하인 몬스터는 이 몬스터를 공격할 수 없다.',
  ),
  salvation_lancer: u(
    'salvation_lancer', '구원의 창기사', 2, 2, 3, ['light'],
    '자신의 라이프가 2장 이하라면, 이 몬스터는 공격력 +1을 얻는다.',
  ),
  last_prayer: s(
    'last_prayer', '마지막 기도', 5, ['light'],
    '자신의 라이프가 2장 이하일 때만 사용할 수 있다. 상대의 모든 몬스터를 소진한다. 자신의 모든 몬스터를 준비한다.',
  ),
  sky_white_horse_knight: u(
    'sky_white_horse_knight', '천공의 백마기사', 4, 3, 4, ['light'],
    '진화 - 빛 몬스터. 비행. 출현 - 자신의 다른 소진된 몬스터 하나를 준비할 수 있다. 상대는 가능하다면 이 몬스터부터 공격해야 한다.',
    ['flying'], 'rings', [], 'light',
  ),
  spirit_agent: u(
    'spirit_agent', '성령의 대리인', 6, 5, 7, ['light'],
    '진화 - 빛 몬스터. 이 몬스터가 전장에 있는 동안 각 플레이어는 자신의 턴에 최대 두 번만 공격할 수 있다.',
    [], 'rings', [], 'light',
  ),

  // 레인보우
  lava_gardener: u(
    'lava_gardener', '용암 정원사', 3, 2, 3, ['fire', 'earth'],
    '출현 - 불 공명 - 상대 몬스터 하나에게 피해 1을 준다. 출현 - 땅 공명 - 자신의 소진된 마나 하나를 준비한다.',
  ),
  stone_pillar_priest: u(
    'stone_pillar_priest', '돌기둥의 성직자', 3, 1, 4, ['earth', 'light'],
    '출현 - 땅 공명 - 자신의 손에서 카드 한 장을 소진된 상태로 마나에 놓을 수 있다. 출현 - 빛 공명 - 자신의 라이프 카드 하나를 확인할 수 있다. 각성 카드일 경우, 그 카드를 손으로 가져온 후 각성 효과를 발동할 수 있다.',
  ),
  mirror_lake_prophet: u(
    'mirror_lake_prophet', '거울 호수의 예언자', 3, 2, 3, ['light', 'water'],
    '출현 - 빛 공명 - 자신의 라이프 카드 하나를 확인한다. 출현 - 물 공명 - 자신의 덱 맨 위 카드를 확인하고 덱 맨 위로 되돌리거나 묘지로 보낸다. 두 공명을 모두 충족했다면 확인한 라이프 카드와 덱 맨 위 카드를 서로 바꿀 수 있다.',
  ),
  sunken_coffin_keeper: u(
    'sunken_coffin_keeper', '가라앉은 관지기', 3, 2, 2, ['water', 'dark'],
    '출현 - 물 공명 - 자신의 묘지 카드 한 장을 덱 맨 아래에 놓을 수 있다. 출현 - 어둠 공명 - 자신의 덱 맨 위 카드 한 장을 묘지로 보낼 수 있다. 두 공명을 모두 충족했다면 카드 1장을 뽑는다.',
  ),
  crematory_smoke: s(
    'crematory_smoke', '화장터의 연기', 3, ['dark', 'fire'],
    '불 공명 - 상대 몬스터 하나에게 피해 2를 준다. 어둠 공명을 충족했다면, 대신 상대의 모든 몬스터에게 준다.',
  ),
}
export const ALL_CARD_IDS = [...CARD_IDS]

export const DEFAULT_DECK: CardId[] = [
  'living_flame', 'living_flame',
  'living_smoke', 'living_smoke',
  'last_ember', 'last_ember',
  'ash_hound', 'ash_hound',
  'moth_swarm', 'moth_swarm',
  'pegasus_rider', 'pegasus_rider',
  'temple_prospect', 'temple_prospect',
  'cathedral_guard', 'cathedral_guard',
  'battle_campfire', 'battle_campfire',
  'holy_mirror_wall', 'holy_mirror_wall',
]

export const getCard = (id: CardId) => CARDS[id]
export const isCardId = (value: unknown): value is CardId =>
  typeof value === 'string' && value in CARDS
