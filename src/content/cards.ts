import { EVOLUTION_BEGINS_001_CARDS } from './card-sets/evolution-begins-001'
import { FOUNDATIONS_001_CARDS } from './card-sets/foundations-001'
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

export type CardPlaySelectionField = 'unitId' | 'lifeIndex' | 'effectManaId' | 'fieldSlot'

export interface CardSimulationHints {
  /** 봇이 PLAY_CARD 후보를 만들 때 조합해야 하는 선택 필드입니다. 실제 합법성은 규칙 엔진이 판정합니다. */
  playSelectionFields?: CardPlaySelectionField[]
}

export type CardDeckHintRole =
  | 'early_unit'
  | 'pressure'
  | 'defender'
  | 'tempo'
  | 'removal'
  | 'board_clear'
  | 'draw'
  | 'ramp'
  | 'mana_payoff'
  | 'graveyard_enabler'
  | 'graveyard_payoff'
  | 'recursion'
  | 'life_control'
  | 'awakening'
  | 'evolution'
  | 'resonance'
  | 'finisher'
  | 'utility'

export interface CardDeckHints {
  /** 자동 역할 추정이 부족한 새 카드에만 선택적으로 덧붙입니다. */
  roles?: CardDeckHintRole[]
  /** 같은 엔진이나 콤보에 속하는 카드를 함께 탐색하도록 유도합니다. */
  packageIds?: string[]
  /** 강제가 아니라 초기 매수와 변이 방향에 쓰이는 선호입니다. */
  copyClass?: 'core' | 'support' | 'tech' | 'finisher'
}

export type CardKeyword =
  | 'rush'
  | 'charge'
  | 'windfury'
  | 'flying'
  | 'stealth'
  | 'last_words'
  | 'assassination'
  | 'guard'

export interface CardBase {
  artUrl?: string
  id: CardId
  name: string
  cost: number
  attributes: CardAttributeId[]
  families: CardFamilyId[]
  rulesText: string
  /** 덱빌더와 게임 내 상세 보기에서 규칙 문구 아래에 표시되는 서사 문구입니다. */
  flavorText: string
  visualKey: string
  setId: SetId
  collectorNumber: string
  contentVersion: string
  /** 카드 풀이 바뀌어도 시뮬레이터가 대상 선택을 자동 생성하기 위한 최소 메타데이터입니다. */
  simulationHints?: CardSimulationHints
  /** 카드 풀이 바뀌어도 덱 생성기가 역할·패키지를 이해하기 위한 선택적 힌트입니다. */
  deckHints?: CardDeckHints
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

export const CARDS: Record<CardId, CardDefinition> = {
  ...FOUNDATIONS_001_CARDS,
  ...EVOLUTION_BEGINS_001_CARDS,
} as Record<CardId, CardDefinition>


/**
 * 카드의 실제 효과 판정은 rules.ts에만 존재합니다.
 * 아래 힌트는 시뮬레이터가 가능한 PLAY_CARD 입력을 만드는 데만 사용하며,
 * 잘못 만든 후보는 applyAction이 제거합니다. 새 카드가 플레이 시 대상을 요구한다면
 * 해당 필드만 추가하면 덱 생성기와 봇은 카드 풀 크기와 무관하게 자동으로 처리합니다.
 */
const CARD_SIMULATION_HINTS: Partial<Record<CardId, CardSimulationHints>> = {
  ebb: { playSelectionFields: ['unitId'] },
  reverse_current: { playSelectionFields: ['unitId'] },
  desertification: { playSelectionFields: ['unitId'] },
  grave_digging: { playSelectionFields: ['effectManaId'] },
  demon_breath: { playSelectionFields: ['unitId'] },
  holy_mirror_wall: { playSelectionFields: ['lifeIndex'] },
  rising_earth: { playSelectionFields: ['effectManaId', 'fieldSlot'] },
  lava_gardener: { playSelectionFields: ['unitId'] },
  crematory_smoke: { playSelectionFields: ['unitId'] },
}

for (const cardId of CARD_IDS) {
  const hints = CARD_SIMULATION_HINTS[cardId]
  if (hints) CARDS[cardId].simulationHints = hints
}

export const ALL_CARD_IDS = [...CARD_IDS]

export const DEFAULT_DECK: CardId[] = [
  'volcano_mouse', 'volcano_mouse', 'volcano_mouse',
  'living_flame', 'living_flame', 'living_flame',
  'spark_chasing_lizard', 'spark_chasing_lizard', 'spark_chasing_lizard',
  'living_smoke', 'living_smoke', 'living_smoke',
  'last_ember', 'last_ember', 'last_ember',
  'ash_hound', 'ash_hound', 'ash_hound',
  'unexploded_bomb_mouse', 'unexploded_bomb_mouse', 'unexploded_bomb_mouse',
  'iron_horn_boar', 'iron_horn_boar', 'iron_horn_boar',
  'tree_fairy', 'tree_fairy', 'tree_fairy',
  'burning_procession', 'burning_procession', 'burning_procession',
]

export const getCard = (id: CardId) => CARDS[id]
export const isCardId = (value: unknown): value is CardId =>
  typeof value === 'string' && value in CARDS
