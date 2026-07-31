import type { CardAttributeId, CardId } from './cards'
import type { GameFormatId } from './schema'

export const SAMPLE_DECK_IDS = [
  'procession-ignition',
  'mana-ladder',
  'graveyard-cycle',
  'destined-spirit',
] as const

export type SampleDeckId = typeof SAMPLE_DECK_IDS[number]
export type SampleDeckStyle = 'mountain' | 'earth' | 'light' | 'wave'

export interface SampleDeckDefinition {
  id: SampleDeckId
  name: string
  style: SampleDeckStyle
  styleLabel: string
  buttonLabel: string
  difficulty: '쉬움' | '보통' | '어려움'
  attributes: readonly CardAttributeId[]
  archetype: string
  formatId: GameFormatId
  goal: string
  playGuide: string
  manaPriorityCards: readonly string[]
  keepCards: readonly string[]
  manaGuide: string
  cardIds: readonly CardId[]
}

export const SAMPLE_DECKS: Record<SampleDeckId, SampleDeckDefinition> = {
  'procession-ignition': {
    id: 'procession-ignition',
    name: '행렬 점화',
    style: 'mountain',
    styleLabel: '영구 드로우 엔진',
    buttonLabel: '행렬',
    difficulty: '쉬움',
    attributes: ['fire', 'earth'],
    archetype: '손패를 빠르게 소비한 뒤 매 턴 2장 드로우로 전환',
    formatId: 'open-v1',
    goal: '나무에 사는 요정으로 4마나에 먼저 도달해 불타는 행렬을 사용하고, 덱이 소진되기 전에 저비용 불 카드를 연속 전개해 끝내는 덱입니다.',
    playGuide: '초반에는 저비용 몬스터를 전개하되 불타는 행렬 한 장을 손에 남기십시오. 행렬이 완성된 뒤에는 장기전을 피하고 돌진 교환과 직접 공격으로 빠르게 승부해야 합니다.',
    manaPriorityCards: [
      '나무에 사는 요정과 함께 마나를 앞당길 여분 저비용 카드',
      '두 번째 이후의 불타는 행렬',
      '상대 전장에 교환 대상이 없을 때의 쇠뿔 멧돼지',
      '화산쥐 소환 조건을 이미 충족한 뒤의 여분 불 카드',
      '같은 비용 몬스터가 손에 지나치게 겹친 경우',
    ],
    keepCards: [
      '첫 번째 불타는 행렬',
      '나무에 사는 요정',
      '마지막 불씨',
      '초반에 낼 수 있는 저비용 불 몬스터',
      '돌진으로 유리한 교환을 만들 수 있는 쇠뿔 멧돼지',
    ],
    manaGuide: '나무에 사는 요정을 마나에 놓고 손의 여분 카드 한 장을 추가 마나로 보내 4마나를 앞당깁니다. 행렬 사용 뒤에는 손에 들어오는 비용 2 이하 불 카드를 적극적으로 사용하십시오.',
    cardIds: [
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
    ],
  },
  'mana-ladder': {
    id: 'mana-ladder',
    name: '마나 사다리',
    style: 'earth',
    styleLabel: '기술 단계 상승',
    buttonLabel: '사다리',
    difficulty: '보통',
    attributes: ['earth', 'fire', 'water'],
    archetype: '마나를 빠르게 늘려 5~6비용 결실을 먼저 사용',
    formatId: 'open-v1',
    goal: '손과 덱의 카드를 마나로 바꾸고 속성을 조정해, 상대보다 먼저 화산 폭발·산맥·진화체를 연속 사용하는 성장 덱입니다.',
    playGuide: '초반에는 나무에 사는 요정, 씨 뿌리는 요정, 쓰나미로 가속합니다. 중반에는 용암 정원사와 화염 투창병으로 버티고, 5~6마나부터 무거운 카드의 체급 차이로 전장을 장악하십시오.',
    manaPriorityCards: [
      '나무에 사는 요정',
      '당장 진화 재료가 없는 고비용 진화 몬스터',
      '솟아나는 대지로 다시 사용할 떠다니는 산맥',
      '중복된 고비용 결실',
      '현재 필요한 공명 속성과 맞지 않는 카드',
    ],
    keepCards: [
      '씨 뿌리는 요정',
      '쓰나미',
      '용암 정원사',
      '화염 투창병',
      '현재 마나 단계에서 곧 사용할 피니셔',
    ],
    manaGuide: '불과 땅 마나를 함께 확보해 용암 정원사의 비용 감소와 불 공명을 켜고, 땅을 가는 요정으로 필요 없는 마나를 손으로 되돌려 다음 기술 단계의 속성을 맞추십시오.',
    cardIds: [
      'tree_fairy', 'tree_fairy', 'tree_fairy',
      'seeding_fairy', 'seeding_fairy', 'seeding_fairy',
      'tsunami', 'tsunami', 'tsunami',
      'boulder_carrier', 'boulder_carrier', 'boulder_carrier',
      'mana_flipping_fairy', 'mana_flipping_fairy',
      'lava_gardener', 'lava_gardener', 'lava_gardener',
      'flame_javelin_soldier', 'flame_javelin_soldier', 'flame_javelin_soldier',
      'flame_mane_captain', 'flame_mane_captain',
      'volcanic_eruption', 'volcanic_eruption',
      'exploding_mountain_dragon', 'exploding_mountain_dragon',
      'floating_mountains', 'floating_mountains',
      'walking_hill',
      'rising_earth',
    ],
  },
  'graveyard-cycle': {
    id: 'graveyard-cycle',
    name: '묘지 순환',
    style: 'wave',
    styleLabel: '반복 자원',
    buttonLabel: '순환',
    difficulty: '어려움',
    attributes: ['water', 'dark', 'earth'],
    archetype: '묘지를 두 번째 손패로 만들어 회수·재사용',
    formatId: 'open-v1',
    goal: '덱 위의 불필요한 카드를 묘지로 보내고 저비용 어둠 몬스터를 반복 회수해, 상대보다 같은 카드를 더 오래 사용하는 자원전 덱입니다.',
    playGuide: '물결을 읽는 자와 물밑을 살피는 자로 묘지를 준비하고, 상인과 포식자로 비용 1 몬스터를 회수하십시오. 파묘는 강력하지만 마나를 잃으므로 그 턴과 다음 턴의 행동량을 함께 계산해야 합니다.',
    manaPriorityCards: [
      '파묘로 회수할 가치가 있는 어둠 카드',
      '다른 가라앉은 관지기가 잡혀 있을 때 첫 관지기',
      '장송하는 자로 다시 소환할 비용 2 이하 어둠 몬스터',
      '회수 수단이 이미 손에 있을 때의 비용 1 어둠 몬스터',
      '현재 턴에 쓰기 어려운 중복 진화 몬스터',
    ],
    keepCards: [
      '물결을 읽는 자',
      '물밑을 살피는 자',
      '무덤 안의 상인',
      '묘지가 준비된 뒤의 파묘',
      '무료 조건을 만들 수 있는 관 속의 전사',
    ],
    manaGuide: '물·어둠 공명을 함께 준비해 가라앉은 관지기의 회수와 드로우를 연결하십시오. 덱 소진이 가까우면 묘지 카드를 덱 위에 돌려 다음 드로우를 확보하는 선택이 중요합니다.',
    cardIds: [
      'wave_reader', 'wave_reader', 'wave_reader',
      'underwater_observer', 'underwater_observer', 'underwater_observer',
      'nameless_shadow', 'nameless_shadow', 'nameless_shadow',
      'corpse_cat', 'corpse_cat', 'corpse_cat',
      'grave_merchant', 'grave_merchant', 'grave_merchant',
      'sunken_coffin_keeper', 'sunken_coffin_keeper', 'sunken_coffin_keeper',
      'coffin_warrior', 'coffin_warrior', 'coffin_warrior',
      'grave_digging', 'grave_digging', 'grave_digging',
      'mass_burial', 'mass_burial',
      'blackwing_predator', 'blackwing_predator',
      'mourner', 'mourner',
    ],
  },
  'destined-spirit': {
    id: 'destined-spirit',
    name: '예정된 성령',
    style: 'light',
    styleLabel: '각성 예약',
    buttonLabel: '성령',
    difficulty: '어려움',
    attributes: ['light', 'water', 'earth'],
    archetype: '덱 위와 라이프를 편집해 각성과 진화를 예약',
    formatId: 'open-v1',
    goal: '덱 위와 라이프를 확인하고 원하는 각성 카드를 심은 뒤, 튼튼한 빛 몬스터를 천공의 백마기사와 성령의 대리인으로 진화시키는 계획형 덱입니다.',
    playGuide: '물결을 읽는 자로 다음 드로우를 정리하고, 신전의 유망주와 거울 호수의 예언자로 라이프를 편집하십시오. 돌기둥의 성직자로 예약한 각성을 호출한 뒤 빛 몬스터를 진화 사다리로 연결합니다.',
    manaPriorityCards: [
      '나무에 사는 요정',
      '두 번째 이후의 성령의 대리인',
      '진화 재료가 없는 천공의 백마기사',
      '당장 필요하지 않은 라이프 조작 카드',
      '라이프에 저장할 계획이 없는 중복 각성 카드',
    ],
    keepCards: [
      '신전의 유망주',
      '물결을 읽는 자',
      '돌기둥의 성직자',
      '빛 진화 재료와 함께 잡힌 천공의 백마기사',
      '라이프가 낮을 때의 마지막 기도',
    ],
    manaGuide: '나무에 사는 요정으로 고비용 진화까지의 시간을 줄이고 돌기둥의 성직자의 땅 공명을 준비합니다. 사도의 비둘기와 성스러운 거울의 벽은 라이프에 심을 주요 각성 카드입니다.',
    cardIds: [
      'tree_fairy', 'tree_fairy', 'tree_fairy',
      'wave_reader', 'wave_reader', 'wave_reader',
      'temple_prospect', 'temple_prospect', 'temple_prospect',
      'apostle_pigeon', 'apostle_pigeon',
      'stone_pillar_priest', 'stone_pillar_priest', 'stone_pillar_priest',
      'mirror_lake_prophet', 'mirror_lake_prophet', 'mirror_lake_prophet',
      'silent_shield_soldier', 'silent_shield_soldier', 'silent_shield_soldier',
      'returning_paladin', 'returning_paladin',
      'sky_white_horse_knight', 'sky_white_horse_knight',
      'spirit_agent', 'spirit_agent',
      'last_prayer', 'last_prayer',
      'holy_mirror_wall', 'holy_mirror_wall',
    ],
  },
}

export const SAMPLE_DECK_LIST = SAMPLE_DECK_IDS.map((id) => SAMPLE_DECKS[id])
