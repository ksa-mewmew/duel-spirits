import type { CardAttributeId, CardId } from './cards'
import type { GameFormatId } from './schema'

export const SAMPLE_DECK_IDS = [
  'ash-mountains',
  'rising-earth',
  'spirit-discipline',
  'swirling-waves',
] as const

export type SampleDeckId = typeof SAMPLE_DECK_IDS[number]
export type SampleDeckStyle = 'mountain' | 'earth' | 'eclipse' | 'wave'

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
    style: 'mountain',
    styleLabel: '교환 전투',
    buttonLabel: '산맥',
    difficulty: '쉬움',
    attributes: ['fire', 'earth'],
    archetype: '교환으로 폭발을 준비하는 불 전투',
    formatId: 'open-v1',
    goal: '작은 몬스터를 적극적으로 전투에 사용해 상대 전장을 약화시키고, 유언 피해와 화산 폭발로 남은 몬스터를 정리한 뒤 폭발하는 산맥룡으로 승부를 끝내는 불 중심 덱입니다.',
    playGuide: '마지막 불씨와 터지지 않은 폭탄쥐는 묘지로 보내져도 각각 카드와 피해를 남기므로, 상대의 더 비싼 몬스터와 망설이지 말고 교환하는 것이 중요합니다. 살아 움직이는 연기는 전투할수록 강해지며, 화염 투창병은 체력 1인 몬스터를 전투 전에 제거할 수 있습니다. 상대가 몬스터를 여러 장 전개했다면 화산 폭발로 전장을 뒤집을 수 있습니다. 자신의 불 몬스터가 첫 피해로 묘지로 보내지면 한 번 더 발동하므로, 유언 몬스터를 함께 정리하면서 상대의 체력 4 이하 몬스터까지 제거하는 것이 이상적입니다.',
    manaPriorityCards: [
      '첫 번째 용암 정원사',
      '두 번째 이후의 화산 폭발',
      '진화시킬 불 몬스터가 없는 초반의 폭발하는 산맥룡',
      '상대에게 체력 1 몬스터가 없는 경우의 여분 화염 투창병',
      '같은 비용의 몬스터가 손에 지나치게 많이 잡힌 경우',
    ],
    keepCards: [
      '마지막 불씨',
      '살아 움직이는 연기',
      '터지지 않은 폭탄쥐',
      '상대가 전개하는 경우 첫 번째 화산 폭발',
      '진화시킬 불 몬스터와 함께 잡힌 폭발하는 산맥룡',
    ],
    manaGuide: '첫 용암 정원사를 마나에 놓으면 이후 용암 정원사가 불·땅 공명을 모두 활용할 수 있습니다. 초반에는 작은 몬스터로 전투를 반복하고, 상대 전장이 충분히 쌓였을 때 화산 폭발이나 폭발하는 산맥룡으로 한꺼번에 정리하십시오.',
    cardIds: [
      'last_ember', 'last_ember', 'last_ember',
      'living_smoke', 'living_smoke', 'living_smoke',
      'iron_horn_boar', 'iron_horn_boar', 'iron_horn_boar',
      'unexploded_bomb_mouse', 'unexploded_bomb_mouse', 'unexploded_bomb_mouse',
      'lava_gardener', 'lava_gardener',
      'flame_javelin_soldier', 'flame_javelin_soldier',
      'volcanic_eruption', 'volcanic_eruption',
      'exploding_mountain_dragon', 'exploding_mountain_dragon',
    ],
  },
  'rising-earth': {
    id: 'rising-earth',
    name: '일어서는 대지',
    style: 'earth',
    styleLabel: '마나 전개',
    buttonLabel: '대지',
    difficulty: '보통',
    attributes: ['earth'],
    archetype: '마나 영역을 두 번째 전장으로 사용하기',
    formatId: 'open-v1',
    goal: '빠르게 마나를 늘리고, 마나에 놓인 몬스터를 다시 전장으로 불러내며 거대한 진화 몬스터를 연속해서 세우는 땅 중심 덱입니다.',
    playGuide: '나무에 사는 요정은 전장에 내기보다 마나에 놓았을 때 진가를 발휘합니다. 함께 마나에 놓을 카드로 너무 무거운 씨앗을 선택하면 마나를 빠르게 늘리는 동시에, 나중에는 씨앗을 마나에서 직접 소환할 수 있습니다. 씨 뿌리는 요정은 전장에 소환해 덱 위 카드를 마나로 보내고, 돌덩이 운반꾼은 공격할 수 없는 대신 걸어 다니는 언덕의 안전한 진화 재료가 됩니다. 대지의 수호자는 마나에 모아 둔 저비용 몬스터를 다시 전장에 세울 수 있으므로, 마나로 보낸 몬스터도 완전히 잃은 카드가 아닙니다.',
    manaPriorityCards: [
      '나무에 사는 요정',
      '너무 무거운 씨앗',
      '대지의 수호자로 불러낼 여분 돌덩이 운반꾼',
      '초반에 두 장 이상 잡힌 떠다니는 산맥',
      '당장 진화 재료가 없는 여분 걸어 다니는 언덕',
    ],
    keepCards: [
      '씨 뿌리는 요정',
      '걸어 다니는 언덕의 재료가 될 돌덩이 운반꾼',
      '걸어 다니는 언덕',
      '상대의 핵심 몬스터를 제거해야 할 때의 사막화',
      '마나에 비용 2 이하 몬스터가 충분히 쌓인 상태의 대지의 수호자',
    ],
    manaGuide: '나무에 사는 요정은 마나용, 씨 뿌리는 요정은 전장용이라고 생각하면 운용이 간단해집니다. 마나만 늘리느라 전장을 완전히 비우지 말고, 걸어 다니는 언덕이나 대지의 수호자가 진화할 땅 몬스터 하나는 남겨 두는 것이 좋습니다.',
    cardIds: [
      'tree_fairy', 'tree_fairy', 'tree_fairy',
      'seeding_fairy', 'seeding_fairy', 'seeding_fairy',
      'boulder_carrier', 'boulder_carrier', 'boulder_carrier',
      'heavy_seed', 'heavy_seed', 'heavy_seed',
      'rock_armor_knight', 'rock_armor_knight',
      'walking_hill', 'walking_hill',
      'desertification',
      'earth_guardian',
      'floating_mountains', 'floating_mountains',
    ],
  },
  'spirit-discipline': {
    id: 'spirit-discipline',
    name: '성령의 계율',
    style: 'eclipse',
    styleLabel: '공격 질서',
    buttonLabel: '계율',
    difficulty: '어려움',
    attributes: ['light'],
    archetype: '공격 횟수를 통제하는 순수 빛 중속 진화',
    formatId: 'open-v1',
    goal: '체력 3의 빛 몬스터를 꾸준히 남겨 진화 재료를 보존하고, 성령의 대리인으로 양쪽의 공격 횟수를 통제하면서 5/7의 크기와 질풍으로 장기전을 장악하는 덱입니다.',
    playGuide: '초반에는 작은 심판관과 구원의 창기사로 전장을 지키고, 돌아오는 성기사는 유리한 교환 공격을 마친 뒤 진화 재료로 사용하십시오. 사도의 비둘기는 양쪽의 공격을 한 번으로 제한하고 각성으로 비용 없이 전장에 나와 성령의 대리인이 등장할 때까지 시간을 법니다. 천공의 백마기사는 소진된 아군을 준비시키고 공격을 자신에게 유도해 다른 진화 재료를 보호합니다. 6마나에는 살아남은 빛 몬스터 위에 성령의 대리인을 진화시키고, 가장 중요한 상대 몬스터를 정리한 뒤 남은 공격을 비행 몬스터나 강화된 구원의 창기사에 배분하십시오.',
    manaPriorityCards: [
      '두 번째 이후의 성령의 대리인',
      '라이프가 3장 이상인 초반의 마지막 기도',
      '진화할 빛 몬스터가 없는 초반의 천공의 백마기사',
      '두 번째 이후의 신전의 유망주',
      '전장에 진화 재료가 충분할 때의 여분 사도의 비둘기',
    ],
    keepCards: [
      '작은 심판관',
      '구원의 창기사',
      '유리한 교환을 만들 수 있는 돌아오는 성기사',
      '빛 몬스터와 함께 잡힌 성령의 대리인',
      '라이프가 2장 이하일 때의 마지막 기도',
    ],
    manaGuide: '성령의 대리인이 두 장 이상 잡히면 한 장은 마나로 두고 6마나까지 전장에 빛 몬스터 하나를 남기는 것을 우선하십시오. 4마나에 천공의 백마기사를 무조건 진화시키기보다 상대 전개가 느리다면 일반 몬스터를 보존해 대리인의 재료와 마나를 함께 준비하는 편이 좋습니다.',
    cardIds: [
      'temple_prospect', 'temple_prospect', 'temple_prospect',
      'returning_paladin', 'returning_paladin', 'returning_paladin',
      'little_judge', 'little_judge', 'little_judge',
      'salvation_lancer', 'salvation_lancer', 'salvation_lancer',
      'apostle_pigeon', 'apostle_pigeon',
      'sky_white_horse_knight', 'sky_white_horse_knight',
      'spirit_agent', 'spirit_agent', 'spirit_agent',
      'last_prayer',
    ],
  },
  'swirling-waves': {
    id: 'swirling-waves',
    name: '소용돌이치는 파도',
    style: 'wave',
    styleLabel: '순환 제어',
    buttonLabel: '파도',
    difficulty: '보통',
    attributes: ['water', 'dark'],
    archetype: '덱 위와 묘지를 하나의 손패처럼 사용하기',
    formatId: 'open-v1',
    goal: '덱 위와 묘지의 카드를 반복해서 옮겨 원하는 카드를 다시 뽑고, 상대의 소진된 몬스터를 손으로 되돌리는 물·어둠 순환 덱입니다.',
    playGuide: '물결을 읽는 자와 물밑을 살피는 자로 덱 위를 정리한 뒤, 필요하지 않은 카드는 묘지로 보내십시오. 가라앉은 관지기가 두 공명을 모두 충족하면 묘지의 원하는 카드를 덱 위에 놓은 다음 바로 뽑을 수 있으므로, 묘지는 버려진 카드 더미가 아니라 다시 사용할 카드를 보관하는 장소가 됩니다. 잔물결 정령과 밀물로 손패를 유지하고, 장례식의 초대자를 교환해 상대의 손을 줄이십시오. 상대가 공격해 핵심 몬스터를 소진했다면 파도의 등지느러미나 수정 해일로 손에 되돌려 전개 속도를 늦출 수 있습니다. 수정 해일의 순간 공격으로 상대의 라이프를 제거합니다.',
    manaPriorityCards: [
      '다른 가라앉은 관지기가 잡혀 있다면 첫 번째 가라앉은 관지기',
      '진화할 물 몬스터가 없는 초반의 수정 해일',
      '손패가 충분할 때의 두 번째 밀물',
      '어둠 마나가 이미 준비된 경우 여분 장례식의 초대자',
      '덱 위를 확인할 카드가 여러 장 겹친 경우 그중 한 장',
    ],
    keepCards: [
      '물밑을 살피는 자',
      '잔물결 정령',
      '양쪽 공명을 활용할 수 있는 가라앉은 관지기',
      '저비용 물 몬스터와 함께 잡힌 진화 몬스터',
      '손패가 부족한 경우의 밀물',
    ],
    manaGuide: '첫 가라앉은 관지기를 마나에 놓으면 물과 어둠 공명을 동시에 준비하기 쉬워집니다. 카드를 뽑기 전에 먼저 덱 위를 정리하고, 효과를 이미 사용한 저비용 물 몬스터는 파도의 등지느러미나 수정 해일의 진화 재료로 재활용하십시오.',
    cardIds: [
      'wave_reader', 'wave_reader', 'wave_reader',
      'underwater_observer', 'underwater_observer', 'underwater_observer',
      'ripple_spirit', 'ripple_spirit', 'ripple_spirit',
      'sunken_coffin_keeper', 'sunken_coffin_keeper', 'sunken_coffin_keeper',
      'high_tide', 'high_tide',
      'funeral_inviter', 'funeral_inviter', 'funeral_inviter',
      'wave_fin',
      'crystal_tsunami', 'crystal_tsunami',
    ],
  },
}

export const SAMPLE_DECK_LIST = SAMPLE_DECK_IDS.map((id) => SAMPLE_DECKS[id])
