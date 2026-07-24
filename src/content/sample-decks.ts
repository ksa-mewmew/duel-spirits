import type { CardAttributeId, CardId } from './cards'
import type { GameFormatId } from './schema'

export const SAMPLE_DECK_IDS = [
  'ash-mountains',
  'crystal-tsunami',
  'moving-earth',
  'funeral-procession',
  'prophecy-garden',
] as const

export type SampleDeckId = typeof SAMPLE_DECK_IDS[number]
export type SampleDeckStyle = 'aggro' | 'control' | 'cycle'

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
  'ash-mountains': {
    id: 'ash-mountains',
    name: '잿더미의 산맥',
    style: 'aggro',
    styleLabel: '불 전투',
    buttonLabel: '산맥',
    difficulty: '쉬움',
    attributes: ['fire', 'earth'],
    archetype: '교환 중심 불 전투',
    formatId: 'open-v1',
    goal: '작은 몬스터를 적극적으로 전투에 사용해 상대 전장을 약화시키고, 화산 폭발과 폭발하는 산맥룡으로 한꺼번에 전장을 뒤집는 불 중심 덱입니다.',
    playGuide: '자신의 몬스터가 죽는 것을 지나치게 두려워하지 않는 것이 중요합니다. 마지막 불씨와 터지지 않은 폭탄쥐는 묘지로 가더라도 각각 카드와 피해를 남기므로, 상대의 더 비싼 몬스터와 교환하면 이득입니다.',
    manaPriorityCards: [
      '두 번째 이후의 화산 폭발',
      '초반에 잡힌 폭발하는 산맥룡',
      '진화시킬 불 몬스터가 없는 상태의 폭발하는 산맥룡',
      '같은 역할이 여러 장 잡힌 화염 투창병',
      '불 마나가 이미 충분하다면 여분의 용암 정원사',
    ],
    keepCards: [
      '마지막 불씨',
      '살아 움직이는 연기',
      '터지지 않은 폭탄쥐',
      '첫 번째 화산 폭발',
      '진화원이 준비된 상태의 폭발하는 산맥룡',
    ],
    manaGuide: '초반에는 불 카드를 우선 마나로 보냅니다. 폭발하는 산맥룡의 진화 조건과 용암 정원사의 불 공명을 안정적으로 준비할 수 있습니다.',
    cardIds: [
      'last_ember', 'last_ember', 'last_ember',
      'living_smoke', 'living_smoke', 'living_smoke',
      'iron_horn_boar', 'iron_horn_boar',
      'unexploded_bomb_mouse', 'unexploded_bomb_mouse', 'unexploded_bomb_mouse',
      'lava_gardener', 'lava_gardener',
      'flame_javelin_soldier', 'flame_javelin_soldier',
      'volcanic_eruption', 'volcanic_eruption', 'volcanic_eruption',
      'exploding_mountain_dragon', 'exploding_mountain_dragon',
    ],
  },
  'crystal-tsunami': {
    id: 'crystal-tsunami',
    name: '수정 해일',
    style: 'control',
    styleLabel: '물·빛 템포',
    buttonLabel: '해일',
    difficulty: '보통',
    attributes: ['water', 'light'],
    archetype: '덱 조작과 반격',
    formatId: 'open-v1',
    goal: '덱 위를 조절하면서 필요한 카드를 꾸준히 확보하고, 상대가 공격해 소진된 순간에 바운스와 진화로 전장을 되찾는 물·빛 템포 덱입니다.',
    playGuide: '먼저 공격하기보다는 상대에게 몬스터를 소진하게 한 뒤 반격하는 운영이 중요합니다.',
    manaPriorityCards: [
      '초반에 잡힌 대환류',
      '초반에 잡힌 마지막 기도',
      '진화원이 없는 수정 해일',
      '진화원이 없는 천공의 백마기사',
      '두 번째 이후의 거울 호수의 예언자',
      '상대 전장에 소진될 만한 몬스터가 아직 없는 역류',
    ],
    keepCards: [
      '물결을 읽는 자',
      '잔물결 정령',
      '물밑을 살피는 자',
      '첫 번째 얼음거울 정령',
      '물 진화원이 있는 상태의 파도의 등지느러미',
    ],
    manaGuide: '초기 마나는 물을 우선 확보합니다. 물 공명과 물 진화를 안정적으로 사용한 뒤, 중반부터 거울 호수의 예언자와 천공의 백마기사를 준비합니다.',
    cardIds: [
      'wave_reader', 'wave_reader', 'wave_reader',
      'ripple_spirit', 'ripple_spirit', 'ripple_spirit',
      'underwater_observer', 'underwater_observer',
      'ice_mirror_spirit', 'ice_mirror_spirit',
      'mirror_lake_prophet', 'mirror_lake_prophet',
      'wave_fin', 'wave_fin',
      'crystal_tsunami', 'crystal_tsunami',
      'reverse_current',
      'grand_reverse_current',
      'last_prayer',
      'sky_white_horse_knight',
    ],
  },
  'moving-earth': {
    id: 'moving-earth',
    name: '움직이는 대지',
    style: 'cycle',
    styleLabel: '땅 마나',
    buttonLabel: '대지',
    difficulty: '보통',
    attributes: ['earth'],
    archetype: '마나 증폭과 대형 전개',
    formatId: 'open-v1',
    goal: '마나를 빠르게 늘리고, 마나에 들어간 몬스터를 다시 손이나 전장으로 꺼내며 큰 몬스터를 연속으로 전개하는 덱입니다.',
    playGuide: '이 덱에서는 마나도 자원 창고입니다. 초반에 중요한 카드를 마나로 보내더라도 나중에 되찾을 수 있습니다. 다만 마나를 너무 많이 늘리느라 전장을 비워두면 빠른 덱에 밀립니다.',
    manaPriorityCards: [
      '너무 무거운 씨앗',
      '초반의 떠다니는 산맥',
      '두 번째 이후의 대지의 수호자',
      '초반에 사용할 수 없는 사막화',
      '진화원이 없는 걸어 다니는 언덕',
      '솟아나는 대지로 다시 꺼낼 수 있는 고비용 몬스터',
    ],
    keepCards: [
      '씨 뿌리는 요정',
      '돌덩이 운반꾼',
      '땅을 가는 요정',
      '첫 번째 걸어 다니는 언덕',
      '마나가 충분할 때의 솟아나는 대지',
    ],
    manaGuide: '너무 무거운 씨앗은 땅 카드가 마나에 4장 이상 있다면 마나에서 직접 소환할 수 있으므로 가장 좋은 초기 마나 후보입니다.',
    cardIds: [
      'tree_fairy', 'tree_fairy', 'tree_fairy',
      'seeding_fairy', 'seeding_fairy', 'seeding_fairy',
      'boulder_carrier', 'boulder_carrier', 'boulder_carrier',
      'mana_flipping_fairy', 'mana_flipping_fairy',
      'heavy_seed', 'heavy_seed',
      'walking_hill', 'walking_hill',
      'earth_guardian', 'earth_guardian',
      'rising_earth',
      'desertification',
      'floating_mountains',
    ],
  },
  'funeral-procession': {
    id: 'funeral-procession',
    name: '장송 행렬',
    style: 'cycle',
    styleLabel: '어둠 묘지',
    buttonLabel: '장송',
    difficulty: '어려움',
    attributes: ['dark', 'earth'],
    archetype: '묘지 회수와 희생',
    formatId: 'open-v1',
    goal: '저비용 몬스터를 상대의 더 비싼 몬스터와 교환하고, 묘지에서 다시 회수하거나 소환하면서 자원 차이를 만드는 어둠 진화 덱입니다.',
    playGuide: '자신의 몬스터가 살아남는 것보다, 상대의 중요한 몬스터와 얼마나 유리하게 교환했는지가 중요합니다.',
    manaPriorityCards: [
      '초반의 장송하는 자',
      '진화원이 없는 검은날개 포식자',
      '초반의 집단 매장',
      '묘지에 카드가 없을 때의 두 번째 무덤 안의 상인',
      '여러 장 잡힌 쇠약한 거인',
      '회수할 카드가 없는 초기 파묘',
    ],
    keepCards: [
      '이름 없는 그림자',
      '시체에 숨은 고양이',
      '독이 발린 해골',
      '첫 번째 무덤 안의 상인',
      '묘지가 어느 정도 쌓인 뒤의 장례식의 초대자',
    ],
    manaGuide: '초반에는 어둠 카드 위주로 마나를 확보합니다. 이 덱은 공명보다 어둠 진화와 묘지 조건이 중요하므로 속성 배치 고민은 비교적 적습니다.',
    cardIds: [
      'nameless_shadow', 'nameless_shadow', 'nameless_shadow',
      'corpse_cat', 'corpse_cat',
      'poisoned_skeleton', 'poisoned_skeleton', 'poisoned_skeleton',
      'grave_merchant', 'grave_merchant',
      'weakened_giant', 'weakened_giant',
      'funeral_inviter', 'funeral_inviter',
      'blackwing_predator', 'blackwing_predator',
      'mourner', 'mourner',
      'mass_burial',
      'grave_digging',
    ],
  },
  'prophecy-garden': {
    id: 'prophecy-garden',
    name: '예언의 정원',
    style: 'control',
    styleLabel: '땅·물·빛',
    buttonLabel: '예언',
    difficulty: '어려움',
    attributes: ['earth', 'water', 'light'],
    archetype: '라이프와 덱 위 설계',
    formatId: 'open-v1',
    goal: '마나를 늘리면서 라이프와 덱 위를 확인하고, 강한 각성 카드를 원하는 위치에 배치하는 땅·물·빛 굿스터프 덱입니다.',
    playGuide: '당장 강한 카드를 내는 것보다, 다음 라이프 손실과 다음 드로우에서 어떤 카드가 나올지를 준비하는 운영이 중요합니다. 마지막 기도는 상대가 공격을 마친 직후 전세를 뒤집고, 천공의 백마기사는 중요한 지원 몬스터를 보호하면서 공격권을 이어 줍니다.',
    manaPriorityCards: [
      '초반의 성스러운 거울의 벽',
      '초반의 마지막 기도',
      '라이프가 3장 이상일 때의 여분 헌신',
      '진화원이 없는 천공의 백마기사',
      '두 번째 이후의 사도의 비둘기',
      '공명 색을 맞추기 위한 여분의 다속성 카드',
    ],
    keepCards: [
      '신전의 유망주',
      '씨 뿌리는 요정',
      '첫 번째 돌기둥의 성직자',
      '거울 호수의 예언자',
      '물·땅 공명을 모두 충족할 수 있는 쓰나미',
    ],
    manaGuide: '초반 마나는 땅을 먼저 확보하고 이후 물과 빛을 추가합니다. 씨 뿌리는 요정과 쓰나미로 마나를 늘리고, 다속성 카드는 필요한 여러 공명의 기반으로 활용합니다.',
    cardIds: [
      'temple_prospect', 'temple_prospect', 'temple_prospect',
      'seeding_fairy', 'seeding_fairy',
      'stone_pillar_priest', 'stone_pillar_priest', 'stone_pillar_priest',
      'mirror_lake_prophet', 'mirror_lake_prophet',
      'apostle_pigeon', 'apostle_pigeon',
      'sky_white_horse_knight', 'sky_white_horse_knight',
      'tsunami', 'tsunami',
      'devotion', 'devotion',
      'last_prayer',
      'holy_mirror_wall',
    ],
  },
}

export const SAMPLE_DECK_LIST = SAMPLE_DECK_IDS.map((id) => SAMPLE_DECKS[id])
