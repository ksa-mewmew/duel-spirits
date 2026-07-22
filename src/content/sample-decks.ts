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
    name: '불·물 — 돌진 파도 어그로',
    attribute: 'fire',
    archetype: '돌진 파도 어그로',
    formatId: 'open-v1',
    goal: '불의 돌진·기습 전개에 물의 손패 보충과 공명 카드를 더해 빠르게 전장을 장악합니다.',
    playGuide: '저비용 불 몬스터로 교환한 뒤 불타는 행렬로 재전개합니다. 잿더미 해적선은 불·물 공명을 함께 받아 공격력 강화와 기습을 노립니다.',
    manaPriority: '불타는 행렬 두 번째 장, 화산쥐 한 장, 상황에 맞지 않는 저비용 몬스터.',
    testPoints: '불타는 행렬의 고정 4장 확인과 최대 2장 소환이 20장 덱에서도 안정적으로 작동하는지 확인합니다.',
    cardIds: [
      'volcano_mouse', 'volcano_mouse',
      'living_flame', 'living_flame',
      'living_smoke', 'living_smoke',
      'last_ember', 'last_ember',
      'ash_hound', 'ash_hound',
      'moth_swarm', 'moth_swarm',
      'burning_procession', 'burning_procession',
      'ash_pirate_ship', 'ash_pirate_ship',
      'wave_reader', 'wave_reader',
      'ripple_spirit', 'ripple_spirit',
    ],
  },
  'water-exhaust-bounce': {
    id: 'water-exhaust-bounce',
    name: '물·땅 — 소진 성장 컨트롤',
    attribute: 'water',
    archetype: '소진 성장 컨트롤',
    formatId: 'open-v1',
    goal: '물의 되돌리기로 시간을 벌고 땅의 마나 성장으로 장기전 우위를 만듭니다.',
    playGuide: '상대가 공격해 몬스터가 소진되면 썰물과 역류를 사용합니다. 물결을 읽는 자로 덱 위를 정리하고, 몰아치는 파도로 다음 물 몬스터를 손에 확보합니다. 밀물은 장기전의 손패를 보충합니다.',
    manaPriority: '역류, 두 번째 잔물결 정령, 상황에 맞지 않는 잿더미를 치우는 비.',
    testPoints: '썰물과 역류가 너무 비슷하게 느껴지는지, 물이 수비는 잘하지만 실제로 게임을 끝내지 못하는지 확인합니다.',
    cardIds: [
      'wave_reader', 'wave_reader',
      'ripple_spirit', 'ripple_spirit',
      'surging_wave', 'surging_wave',
      'ebb', 'ebb',
      'ash_clearing_rain', 'high_tide',
      'high_tide', 'reverse_current',
      'tsunami', 'tsunami',
      'tree_fairy', 'tree_fairy',
      'seeding_fairy', 'seeding_fairy',
      'rock_armor_knight', 'rock_armor_knight',
    ],
  },
  'earth-mana-mountains': {
    id: 'earth-mana-mountains',
    name: '땅·어둠 — 마나와 묘지 성장',
    attribute: 'earth',
    archetype: '마나와 묘지 성장',
    formatId: 'open-v1',
    goal: '마나를 빠르게 늘리고 마나의 너무 무거운 씨앗을 전장으로 꺼낸 뒤, 떠다니는 산맥으로 마무리합니다.',
    playGuide: '나무에 사는 요정은 마나로 놓을 때 손패를 보충합니다. 씨 뿌리는 요정과 쓰나미로 땅 마나를 네 장까지 늘리고, 하늘까지 자라난 새싹으로 공격력 1 몬스터들에게 비행을 부여해 길을 엽니다.',
    manaPriority: '나무에 사는 요정, 너무 무거운 씨앗, 두 번째 떠다니는 산맥.',
    testPoints: '너무 무거운 씨앗을 마나로 놓는 선택이 실제로 흥미로운지, 떠다니는 산맥까지 가는 속도가 지나치게 빠르거나 느리지 않은지 확인합니다.',
    cardIds: [
      'seeding_fairy', 'seeding_fairy',
      'tree_fairy', 'tree_fairy',
      'heavy_seed', 'heavy_seed',
      'rock_armor_knight', 'rock_armor_knight',
      'desertification', 'desertification',
      'overgrown_sprout', 'overgrown_sprout',
      'floating_mountains', 'floating_mountains',
      'grave_digging', 'grave_digging',
      'carrion_crow', 'carrion_crow',
      'coffin_warrior', 'coffin_warrior',
    ],
  },
  'dark-grave-discount': {
    id: 'dark-grave-discount',
    name: '어둠·빛 — 묘지 억제 미드레인지',
    attribute: 'dark',
    archetype: '묘지 억제 미드레인지',
    formatId: 'open-v1',
    goal: '마나와 주문을 묘지로 보내 관 속의 전사 비용을 낮추고, 파묘로 필요한 카드를 회수합니다.',
    playGuide: '파묘는 준비된 마나를 묘지로 보내 관 속의 전사 비용을 낮추고 까마귀의 질풍 조건도 채웁니다. 방금 보낸 마나를 다시 손으로 가져와 마나를 손패로 바꾸는 식으로도 사용할 수 있습니다.',
    manaPriority: '파묘로 나중에 회수할 카드, 악마의 숨결 한 장, 상황에 맞지 않는 잠행 몬스터.',
    testPoints: '관 속의 전사가 너무 쉽게 0비용이 되는지, 3비용과 마나 희생을 함께 요구하는 파묘가 카드 두 장 회수에 알맞은 대가인지 확인합니다.',
    cardIds: [
      'carrion_crow', 'carrion_crow',
      'corpse_cat', 'corpse_cat',
      'nameless_shadow', 'nameless_shadow',
      'blue_black_hound', 'blue_black_hound',
      'coffin_warrior', 'coffin_warrior',
      'grave_digging', 'grave_digging',
      'demon_finger', 'demon_finger',
      'demon_breath', 'demon_breath',
      'eclipse', 'eclipse',
      'prophet', 'prophet',
    ],
  },
  'light-life-exchange': {
    id: 'light-life-exchange',
    name: '빛·불 — 라이프 교환 압박',
    attribute: 'light',
    archetype: '라이프 교환 압박',
    formatId: 'open-v1',
    goal: '라이프와 각성을 통제하면서 비행 몬스터와 성스러운 거울의 벽으로 상대 라이프를 압박합니다.',
    playGuide: '신전의 유망주로 라이프 한 장을 가져오고, 손의 헌신이나 각성 카드를 라이프에 넣어 이후 구성을 부분적으로 설계합니다. 예언자와 사도의 비둘기는 상대의 역전 가능성을 제한합니다.',
    manaPriority: '성당 경비병 한 장, 두 번째 헌신, 당장 필요하지 않은 예언자.',
    testPoints: '예언자가 상대의 재미를 지나치게 막는지, 헌신 두 장으로 게임이 너무 길어지는지, 신전의 유망주의 라이프 교환이 얼마나 강한지 확인합니다.',
    cardIds: [
      'pegasus_rider', 'pegasus_rider',
      'temple_prospect', 'temple_prospect',
      'prophet', 'prophet',
      'cathedral_guard', 'cathedral_guard',
      'apostle_pigeon', 'apostle_pigeon',
      'devotion', 'devotion',
      'holy_mirror_wall', 'holy_mirror_wall',
      'battle_campfire', 'battle_campfire',
      'living_flame', 'living_flame',
      'ash_hound', 'ash_hound',
    ],
  },
}

export const SAMPLE_DECK_LIST = SAMPLE_DECK_IDS.map((id) => SAMPLE_DECKS[id])
