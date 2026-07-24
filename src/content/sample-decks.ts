import type { CardAttributeId, CardId } from './cards'
import type { GameFormatId } from './schema'

export const SAMPLE_DECK_IDS = [
  'ash-cutting-pirates',
  'mirror-lake-lockdown',
  'graveyard-bloom-garden',
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
  manaPriority: string
  testPoints: string
  cardIds: readonly CardId[]
}

export const SAMPLE_DECKS: Record<SampleDeckId, SampleDeckDefinition> = {
  'ash-cutting-pirates': {
    id: 'ash-cutting-pirates',
    name: '재를 가르는 해적단',
    style: 'aggro',
    styleLabel: '어그로',
    buttonLabel: '공격',
    difficulty: '쉬움',
    attributes: ['fire', 'water'],
    archetype: '불·물 진화 어그로',
    formatId: 'open-v1',
    goal: '저비용 몬스터를 빠르게 전개하고 잿더미 해적선의 공격력 강화로 상대 라이프를 한꺼번에 압박합니다.',
    playGuide: '초반에는 불 마나 두 장을 먼저 확보해 화산쥐의 소환 조건을 갖춥니다. 살아 움직이는 불꽃과 잿빛 들개로 전장을 잡고, 불나방 무리의 기습으로 빈틈을 찌릅니다. 전장에 몬스터가 둘 이상 있을 때 잿더미 해적선을 내면 불 공명으로 전체 공격력을 올리고 물 공명으로 해적선까지 바로 공격할 수 있습니다. 화염갈기 대장은 저비용 불 몬스터 위에 진화해 소환된 턴부터 공격하고, 상대 몬스터를 전투로 쓰러뜨리면 다시 준비됩니다.',
    manaPriority: '초반에는 불 카드 두 장을 최우선으로 마나에 둡니다. 비늘 잠수부 한 장을 물 마나로 확보하면 잿더미 해적선의 물 공명까지 사용할 수 있습니다. 두 번째 이후의 고비용 해적선과 당장 공격에 참여하기 어려운 카드는 마나 후보입니다.',
    testPoints: '저비용 전개와 해적선의 전체 강화가 두 장 드로우 환경에서 지나치게 빠른 승리를 만들지 않는지, 화염갈기 대장의 연속 준비가 과도하지 않은지 확인합니다.',
    cardIds: [
      'volcano_mouse', 'volcano_mouse', 'volcano_mouse',
      'living_flame', 'living_flame', 'living_flame',
      'spark_chasing_lizard', 'spark_chasing_lizard',
      'scale_diver', 'scale_diver',
      'ash_hound', 'ash_hound', 'ash_hound',
      'moth_swarm', 'moth_swarm',
      'flame_mane_captain', 'flame_mane_captain',
      'ash_pirate_ship', 'ash_pirate_ship', 'ash_pirate_ship',
    ],
  },
  'mirror-lake-lockdown': {
    id: 'mirror-lake-lockdown',
    name: '거울 호수 봉쇄선',
    style: 'control',
    styleLabel: '컨트롤',
    buttonLabel: '통제',
    difficulty: '보통',
    attributes: ['water', 'light'],
    archetype: '물·빛 소진 컨트롤',
    formatId: 'open-v1',
    goal: '튼튼한 몬스터로 버티고, 공격해 소진된 상대 몬스터를 준비 봉인과 되돌리기로 제거하면서 비행 진화체로 마무리합니다.',
    playGuide: '비늘 잠수부, 성당 경비병, 침묵하는 방패병으로 초반 공격을 받아냅니다. 상대의 저비용 몬스터가 공격해 소진되면 얼음거울 정령으로 다음 턴 준비를 막고 역류로 손에 되돌립니다. 여러 몬스터가 소진된 상황에서는 대환류로 전장을 크게 비울 수 있습니다. 물 몬스터 위에 파도의 등지느러미나 수정 해일을 진화시키면 소환된 턴에도 공격하면서 출현 효과로 상대의 소진 몬스터를 되돌릴 수 있습니다. 거울 호수의 예언자는 빛·물 공명을 모두 맞췄을 때 라이프와 덱 위를 조정해 이후 드로우와 각성을 설계합니다.',
    manaPriority: '초반에는 물과 빛 마나를 한 장씩 확보한 뒤 물 마나 비중을 높입니다. 대환류와 성스러운 거울의 벽은 당장 사용할 상황이 아니면 마나로 두기 좋고, 진화체를 쓰려면 기반이 될 물 몬스터 한 장은 전장에 남겨 둡니다.',
    testPoints: '방어력이 높은 저비용 몬스터와 바운스가 게임을 지나치게 길게 만들지 않는지, 진화체의 즉시 공격이 컨트롤 덱의 마무리 수단으로 충분한지 확인합니다.',
    cardIds: [
      'scale_diver', 'scale_diver', 'scale_diver',
      'underwater_observer', 'underwater_observer',
      'ice_mirror_spirit', 'ice_mirror_spirit',
      'cathedral_guard', 'cathedral_guard',
      'silent_shield_soldier', 'silent_shield_soldier',
      'mirror_lake_prophet', 'mirror_lake_prophet',
      'reverse_current', 'reverse_current',
      'grand_reverse_current',
      'wave_fin', 'wave_fin',
      'crystal_tsunami',
      'holy_mirror_wall',
    ],
  },
  'graveyard-bloom-garden': {
    id: 'graveyard-bloom-garden',
    name: '묘지에 피는 정원',
    style: 'cycle',
    styleLabel: '자원 순환',
    buttonLabel: '순환',
    difficulty: '어려움',
    attributes: ['earth', 'water', 'dark'],
    archetype: '땅·물·어둠 순환 진화',
    formatId: 'open-v1',
    goal: '마나를 빠르게 늘리고 묘지를 채운 뒤, 저비용 몬스터를 회수하고 진화시키며 마나·묘지·덱을 순환합니다.',
    playGuide: '나무에 사는 요정과 씨 뿌리는 요정으로 마나를 빠르게 늘립니다. 물과 땅 공명을 갖춘 쓰나미는 손과 마나를 동시에 보충하고, 가라앉은 관지기는 물·어둠 공명을 모두 충족하면 묘지와 덱을 순환하면서 카드까지 뽑습니다. 묘지에 들어간 비용 1 몬스터는 무덤 안의 상인이나 검은날개 포식자로 되찾을 수 있습니다. 검은날개 포식자는 이름 없는 그림자 위에 진화해 즉시 암살 공격을 할 수 있고, 장송하는 자는 출현으로 아군을 희생해 상대 몬스터를 제거한 뒤 유언으로 저비용 어둠 몬스터를 다시 전장에 불러옵니다.',
    manaPriority: '초반에는 땅 마나를 두 장 이상 확보하고, 쓰나미와 가라앉은 관지기의 공명을 위해 물과 어둠 카드도 한 장씩 준비합니다. 파묘로 되찾을 핵심 카드와 진화 기반이 될 어둠 몬스터는 무작정 마나로 보내지 않는 편이 좋습니다.',
    testPoints: '다속성 마나 조건이 지나치게 불안정하지 않은지, 저비용 회수와 장송하는 자의 유언이 반복되면서 게임이 끝없이 늘어지지 않는지 확인합니다.',
    cardIds: [
      'tree_fairy', 'tree_fairy', 'tree_fairy',
      'seeding_fairy', 'seeding_fairy', 'seeding_fairy',
      'tsunami', 'tsunami',
      'grave_digging', 'grave_digging',
      'sunken_coffin_keeper', 'sunken_coffin_keeper',
      'nameless_shadow', 'nameless_shadow',
      'grave_merchant', 'grave_merchant',
      'blackwing_predator', 'blackwing_predator',
      'walking_hill',
      'mourner',
    ],
  },
}

export const SAMPLE_DECK_LIST = SAMPLE_DECK_IDS.map((id) => SAMPLE_DECKS[id])
