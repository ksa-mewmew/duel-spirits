import { createCardFactory } from '../card-factory'
import type { CardDefinition, CardId } from '../cards'

const { unit: u, spell: s } = createCardFactory('foundations-001')

export const FOUNDATIONS_001_CARDS = {
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
    'ebb', '썰물', 2, ['water'],
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
    'reverse_current', '역류', 3, ['water'],
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
  pegasus_rider: u('pegasus_rider', '페가수스 기마병', 1, 1, 1, ['light'], '비행.', ['flying']),
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
    'apostle_pigeon', '사도의 비둘기', 2, 1, 3, ['light'],
    '이 몬스터가 전장에 있는 동안 각 플레이어는 자신의 턴마다 한 번만 공격할 수 있다. 각성 - 자신의 전장에 빈 슬롯이 있다면 이 카드를 소환한다.',
  ),
  devotion: s(
    'devotion', '헌신', 3, ['light'],
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

} satisfies Partial<Record<CardId, CardDefinition>>
