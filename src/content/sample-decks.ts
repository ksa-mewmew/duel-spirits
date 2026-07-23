import type { CardAttributeId, CardId } from './cards'
import type { GameFormatId } from './schema'

export const SAMPLE_DECK_IDS = [
  'fire-isolation-charge',
  'water-exhaust-bounce',
  'earth-mana-mountains',
  'dark-grave-discount',
  'light-life-exchange',
] as const

export type SampleDeckId = typeof SAMPLE_DECK_IDS[number]

export interface SampleDeckDefinition {
  id: SampleDeckId
  name: string
  attribute: CardAttributeId
  archetype: string
  formatId: GameFormatId
  goal: string
  playGuide: string
  manaPriority: string
  testPoints: string
  cardIds: readonly CardId[]
}

export const SAMPLE_DECKS: Record<SampleDeckId, SampleDeckDefinition> = {
  'fire-isolation-charge': {
    id: 'fire-isolation-charge',
    name: '불 — 고립 돌진 어그로',
    attribute: 'fire',
    archetype: '고립 돌진 어그로',
    formatId: 'open-v1',
    goal: '돌진으로 상대 몬스터를 치우고 기습 몬스터로 라이프를 빠르게 압박합니다.',
    playGuide: '살아 움직이는 불꽃과 잿빛 들개로 초반 전장을 잡습니다. 마지막 불씨는 가능하면 혼자 남겨 고립의 돌진·공격력 증가와 유언 드로우를 함께 활용합니다. 불타는 행렬은 비용 2 이하 몬스터가 묘지로 간 뒤에도 전장을 다시 채우는 핵심 카드입니다.',
    manaPriority: '두 번째 이후의 불타는 행렬, 화산쥐 한 장, 지금 공격에 참여하기 어려운 저비용 몬스터.',
    testPoints: '화산쥐가 기본 돌진과 조건부 공격력 증가를 함께 가져 초반 교환을 지나치게 지배하지 않는지, 살아 움직이는 연기의 전투 공격력과 각성이 수비 효율을 과도하게 높이지 않는지 확인합니다.',
    cardIds: [
      'volcano_mouse', 'volcano_mouse', 'volcano_mouse',
      'living_flame', 'living_flame', 'living_flame',
      'living_smoke', 'living_smoke',
      'last_ember', 'last_ember', 'last_ember',
      'ash_hound', 'ash_hound', 'ash_hound',
      'moth_swarm', 'moth_swarm', 'moth_swarm',
      'burning_procession', 'burning_procession', 'burning_procession',
    ],
  },
  'water-exhaust-bounce': {
    id: 'water-exhaust-bounce',
    name: '물 — 소진 바운스 컨트롤',
    attribute: 'water',
    archetype: '소진 바운스 컨트롤',
    formatId: 'open-v1',
    goal: '체력이 높은 몬스터로 버티면서 공격해 소진된 상대 몬스터를 손으로 되돌립니다.',
    playGuide: '물결을 읽는 자로 덱 위를 정리하고 잔물결 정령으로 손을 보충합니다. 몰아치는 파도는 덱 위에서 저비용 물 몬스터를 출현 없이 바로 소환해 전장을 늘립니다. 상대가 공격해 소진된 뒤에는 썰물과 역류로 템포를 되찾고, 잿더미를 치우는 비로 작은 몬스터를 정리합니다.',
    manaPriority: '역류 한 장, 두 번째 이후의 밀물, 상대 전장과 맞지 않는 잿더미를 치우는 비.',
    testPoints: '잔물결 정령의 출현 드로우와 몰아치는 파도의 출현 없는 효과 소환이 연쇄될 때 손과 전장이 동시에 지나치게 불어나지 않는지, 썰물과 역류의 역할 차이가 충분한지 확인합니다.',
    cardIds: [
      'wave_reader', 'wave_reader', 'wave_reader',
      'ripple_spirit', 'ripple_spirit', 'ripple_spirit',
      'ebb', 'ebb', 'ebb',
      'surging_wave', 'surging_wave', 'surging_wave',
      'ash_clearing_rain', 'ash_clearing_rain',
      'high_tide', 'high_tide', 'high_tide',
      'reverse_current', 'reverse_current', 'reverse_current',
    ],
  },
  'earth-mana-mountains': {
    id: 'earth-mana-mountains',
    name: '땅 — 마나 성장과 산맥',
    attribute: 'earth',
    archetype: '마나 성장과 산맥',
    formatId: 'open-v1',
    goal: '마나를 빠르게 늘리고 마나에 놓인 너무 무거운 씨앗을 전장으로 꺼낸 뒤, 떠다니는 산맥으로 마무리합니다.',
    playGuide: '씨 뿌리는 요정과 쓰나미 계열 효과로 덱 위 카드를 추가 마나로 만듭니다. 나무에 사는 요정이 손 이외의 곳에서 마나에 놓이면 손을 보충합니다. 땅 마나가 네 장이 되면 너무 무거운 씨앗과 하늘까지 자라난 새싹이 활성화되고, 바위 갑옷 기사로 버틴 뒤 떠다니는 산맥의 질풍으로 마무리합니다.',
    manaPriority: '너무 무거운 씨앗, 두 번째 이후의 떠다니는 산맥, 당장 소환하기 어려운 고비용 카드. 나무에 사는 요정은 손에서 직접 마나로 놓아도 카드를 뽑지 않으므로 상황을 보고 결정합니다.',
    testPoints: '나무에 사는 요정의 드로우가 손에서 직접 놓을 때는 발동하지 않는다는 구분이 직관적인지, 마나 성장 뒤 너무 무거운 씨앗과 떠다니는 산맥이 지나치게 빠르게 이어지지 않는지 확인합니다.',
    cardIds: [
      'tree_fairy', 'tree_fairy', 'tree_fairy',
      'seeding_fairy', 'seeding_fairy', 'seeding_fairy',
      'heavy_seed', 'heavy_seed', 'heavy_seed',
      'rock_armor_knight', 'rock_armor_knight', 'rock_armor_knight',
      'desertification', 'desertification',
      'overgrown_sprout', 'overgrown_sprout', 'overgrown_sprout',
      'floating_mountains', 'floating_mountains', 'floating_mountains',
    ],
  },
  'dark-grave-discount': {
    id: 'dark-grave-discount',
    name: '어둠 — 묘지 연쇄와 암살',
    attribute: 'dark',
    archetype: '묘지 연쇄와 암살',
    formatId: 'open-v1',
    goal: '한 턴에 어둠 카드 두 장을 묘지로 보내 관 속의 전사를 비용 없이 전개하고, 암살과 잠행으로 교환을 유리하게 만듭니다.',
    playGuide: '시체에 숨은 고양이와 시체를 먹는 까마귀의 잠행으로 초반 전장을 통과하고, 묘지 세 장을 채워 이름 없는 그림자의 암살을 활성화합니다. 파묘는 준비된 마나 한 장과 주문 자신을 연달아 묘지로 보내 관 속의 전사를 비용 없이 낼 조건을 만들면서 핵심 카드 두 장을 회수합니다. 검푸른 들개는 직접 공격할 수 없으므로 돌진과 높은 공격력으로 상대 몬스터를 정리합니다.',
    manaPriority: '파묘로 되찾을 어둠 카드, 악마의 숨결 한 장, 당장 잠행이나 암살 조건을 만들기 어려운 몬스터. 관 속의 전사는 무료 전개 가능성을 위해 가급적 손에 남깁니다.',
    testPoints: '파묘 한 장으로 어둠 카드 두 장 묘지 조건을 손쉽게 채워 관 속의 전사가 너무 자주 무료가 되지 않는지, 이름 없는 그림자의 암살이 저비용 교환을 과도하게 유리하게 만들지 않는지 확인합니다.',
    cardIds: [
      'carrion_crow', 'carrion_crow', 'carrion_crow',
      'corpse_cat', 'corpse_cat', 'corpse_cat',
      'nameless_shadow', 'nameless_shadow',
      'blue_black_hound', 'blue_black_hound',
      'grave_digging', 'grave_digging', 'grave_digging',
      'coffin_warrior', 'coffin_warrior', 'coffin_warrior',
      'demon_finger', 'demon_finger',
      'demon_breath', 'demon_breath',
    ],
  },
  'light-life-exchange': {
    id: 'light-life-exchange',
    name: '빛 — 라이프 교환 방어',
    attribute: 'light',
    archetype: '라이프 교환 방어',
    formatId: 'open-v1',
    goal: '라이프와 각성을 통제하면서 비행 몬스터와 성스러운 거울의 벽으로 상대 라이프를 압박합니다.',
    playGuide: '신전의 유망주로 라이프 한 장을 손으로 가져오고, 손의 헌신이나 각성 카드를 다시 라이프로 넣어 이후 구성을 부분적으로 설계합니다. 성당 경비병은 저비용 공격을 막고, 예언자와 사도의 비둘기는 상대의 역전 수단과 공격 횟수를 제한합니다.',
    manaPriority: '성당 경비병 한 장, 두 번째 이후의 헌신, 지금 막을 각성이 없는 상황의 예언자.',
    testPoints: '신전의 유망주의 2/2 능력치와 라이프 교환이 초반 전장을 지나치게 안정시키지 않는지, 비용 4가 된 헌신 때문에 게임이 너무 길어지지 않는지 확인합니다.',
    cardIds: [
      'pegasus_rider', 'pegasus_rider', 'pegasus_rider',
      'temple_prospect', 'temple_prospect', 'temple_prospect',
      'cathedral_guard', 'cathedral_guard', 'cathedral_guard',
      'prophet', 'prophet', 'prophet',
      'apostle_pigeon', 'apostle_pigeon',
      'devotion', 'devotion', 'devotion',
      'holy_mirror_wall', 'holy_mirror_wall', 'holy_mirror_wall',
    ],
  },
}

export const SAMPLE_DECK_LIST = SAMPLE_DECK_IDS.map((id) => SAMPLE_DECKS[id])
