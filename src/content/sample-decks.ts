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
  cardIds: readonly CardId[]
}

export const SAMPLE_DECKS: Record<SampleDeckId, SampleDeckDefinition> = {
  'fire-isolation-charge': {
    id: 'fire-isolation-charge',
    name: '불 — 고립 돌진 어그로',
    attribute: 'fire',
    archetype: '고립 돌진 어그로',
    formatId: 'open-v1',
    goal: '돌진으로 상대 몬스터를 치우고 기습 몬스터로 라이프를 압박합니다.',
    playGuide: '초반에는 살아 움직이는 불꽃과 잿빛 들개를 전개합니다. 마지막 불씨는 가능하면 혼자 남겨 4공격력 돌진과 유언을 함께 활용하고, 불타는 행렬로 화산쥐와 살아 움직이는 불꽃을 다시 전개합니다.',
    manaPriority: '불타는 행렬 두 번째 장, 화산쥐 한 장, 상황에 맞지 않는 저비용 몬스터.',
    cardIds: [
      'volcano_mouse', 'volcano_mouse',
      'living_flame', 'living_flame',
      'last_ember', 'last_ember',
      'ash_hound', 'ash_hound',
      'moth_swarm', 'moth_swarm',
      'burning_procession', 'burning_procession',
    ],
  },
  'water-exhaust-bounce': {
    id: 'water-exhaust-bounce',
    name: '물 — 소진 바운스 컨트롤',
    attribute: 'water',
    archetype: '소진 바운스 컨트롤',
    formatId: 'open-v1',
    goal: '체력 높은 몬스터로 버티면서 공격한 상대 몬스터를 손으로 되돌립니다.',
    playGuide: '상대가 공격해 몬스터가 소진되면 썰물과 역류를 사용합니다. 물결을 읽는 자로 덱 위를 정리하고, 몰아치는 파도로 추가 전개를 노립니다. 밀물은 장기전의 손패를 보충합니다.',
    manaPriority: '역류, 두 번째 잔물결 정령, 상황에 맞지 않는 잿더미를 치우는 비.',
    cardIds: [
      'wave_reader', 'wave_reader',
      'ripple_spirit', 'ripple_spirit',
      'surging_wave', 'surging_wave',
      'ebb', 'ebb',
      'ash_clearing_rain',
      'high_tide', 'high_tide',
      'reverse_current',
    ],
  },
  'earth-mana-mountains': {
    id: 'earth-mana-mountains',
    name: '땅 — 마나 성장과 산맥',
    attribute: 'earth',
    archetype: '마나 성장과 산맥',
    formatId: 'open-v1',
    goal: '마나를 빠르게 늘리고 너무 무거운 씨앗을 전장으로 꺼낸 뒤, 떠다니는 산맥으로 마무리합니다.',
    playGuide: '나무에 사는 요정은 직접 마나로 놓아도 손해가 적고, 각성되면 마나와 드로우를 함께 줍니다. 공격력 1 몬스터가 많으므로 과하게 자라난 새싹의 추가 라이프 손실도 노릴 수 있습니다.',
    manaPriority: '나무에 사는 요정, 너무 무거운 씨앗, 두 번째 떠다니는 산맥.',
    cardIds: [
      'seeding_fairy', 'seeding_fairy',
      'tree_fairy', 'tree_fairy',
      'heavy_seed', 'heavy_seed',
      'rock_armor_knight', 'rock_armor_knight',
      'desertification',
      'overgrown_sprout',
      'floating_mountains', 'floating_mountains',
    ],
  },
  'dark-grave-discount': {
    id: 'dark-grave-discount',
    name: '어둠 — 묘지 비용 감소',
    attribute: 'dark',
    archetype: '묘지 비용 감소',
    formatId: 'open-v1',
    goal: '마나와 주문을 묘지로 보내 관 속의 전사 비용을 낮추고, 파묘로 필요한 카드를 회수합니다.',
    playGuide: '파묘는 준비된 마나를 묘지로 보내 관 속의 전사 비용을 낮추고 까마귀의 질풍 조건도 채웁니다. 방금 보낸 마나를 다시 손으로 가져와 마나를 손패로 바꾸는 식으로도 사용할 수 있습니다.',
    manaPriority: '파묘로 나중에 회수할 카드, 악마의 숨결 한 장, 상황에 맞지 않는 잠행 몬스터.',
    cardIds: [
      'carrion_crow', 'carrion_crow',
      'corpse_cat', 'corpse_cat',
      'nameless_shadow',
      'coffin_warrior', 'coffin_warrior',
      'grave_digging', 'grave_digging',
      'demon_finger',
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
    playGuide: '신전의 유망주로 라이프 한 장을 가져오고, 손의 헌신이나 각성 카드를 라이프에 넣어 이후 구성을 부분적으로 설계합니다. 예언자와 사도의 비둘기는 상대의 역전 가능성을 제한합니다.',
    manaPriority: '성당 경비병 한 장, 두 번째 헌신, 당장 필요하지 않은 예언자.',
    cardIds: [
      'pegasus_rider', 'pegasus_rider',
      'temple_prospect', 'temple_prospect',
      'prophet', 'prophet',
      'cathedral_guard', 'cathedral_guard',
      'apostle_pigeon',
      'devotion', 'devotion',
      'holy_mirror_wall',
    ],
  },
}

export const SAMPLE_DECK_LIST = SAMPLE_DECK_IDS.map((id) => SAMPLE_DECKS[id])
