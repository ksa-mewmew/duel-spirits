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
    testPoints: '핵심 저비용 몬스터와 불타는 행렬을 3장씩 쓸 때 전개가 지나치게 끊기지 않는지, 마지막 불씨가 2비용치고 너무 많은 교환 이득을 만드는지 확인합니다.',
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
    playGuide: '물결을 읽는 자로 덱 위를 정리하고 잔물결 정령과 몰아치는 파도로 전장을 버팁니다. 상대가 공격해 소진된 뒤에는 썰물과 역류로 템포를 되찾습니다. 밀물은 장기전의 손패를 책임지고, 잿더미를 치우는 비는 작은 몬스터가 많이 깔렸을 때 사용합니다.',
    manaPriority: '역류 한 장, 두 번째 이후의 밀물, 상대 전장과 맞지 않는 잿더미를 치우는 비.',
    testPoints: '썰물과 역류를 각각 3장 쓸 때 역할 차이가 충분한지, 물이 수비는 잘하지만 실제로 게임을 끝내지 못하는지 확인합니다.',
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
    playGuide: '나무에 사는 요정은 직접 마나로 놓아 손을 보충하고, 씨 뿌리는 요정은 덱 위 카드를 추가 마나로 만듭니다. 땅 마나가 네 장이 되면 너무 무거운 씨앗과 하늘까지 자라난 새싹이 활성화됩니다. 바위 갑옷 기사로 시간을 벌고 떠다니는 산맥의 질풍으로 게임을 끝냅니다.',
    manaPriority: '나무에 사는 요정, 너무 무거운 씨앗, 두 번째 이후의 떠다니는 산맥.',
    testPoints: '마나 성장 카드와 너무 무거운 씨앗을 3장씩 쓸 때 선택이 반복적으로 느껴지지 않는지, 떠다니는 산맥까지 가는 속도가 지나치게 빠르거나 느리지 않은지 확인합니다.',
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
    name: '어둠 — 묘지 비용 감소',
    attribute: 'dark',
    archetype: '묘지 비용 감소',
    formatId: 'open-v1',
    goal: '마나와 어둠 카드를 묘지로 보내 관 속의 전사 비용을 낮추고, 파묘로 필요한 카드를 다시 손에 넣습니다.',
    playGuide: '시체를 먹는 까마귀와 잠행 몬스터로 초반 피해를 누적합니다. 파묘는 준비된 마나를 묘지로 보내 관 속의 전사를 줄이고 까마귀의 질풍 조건을 채우며, 그 뒤 묘지의 핵심 카드 두 장을 회수합니다. 검푸른 들개는 소진된 몬스터를 강하게 교환하는 용도로 사용합니다.',
    manaPriority: '파묘로 되찾을 카드, 악마의 숨결 한 장, 당장 잠행 조건을 만들기 어려운 몬스터.',
    testPoints: '파묘와 관 속의 전사를 3장씩 쓸 때 관 속의 전사가 너무 자주 0비용이 되는지, 파묘가 사실상 만능 회수 카드로 굳어지는지 확인합니다.',
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
    testPoints: '신전의 유망주·예언자·헌신을 3장씩 쓸 때 라이프 통제가 지나치게 안정적인지, 헌신 때문에 게임이 너무 길어지는지 확인합니다.',
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
