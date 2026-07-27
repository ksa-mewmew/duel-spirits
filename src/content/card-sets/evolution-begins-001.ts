import { createCardFactory } from '../card-factory'
import type { CardDefinition, CardId } from '../cards'

const { unit: u, spell: s } = createCardFactory('evolution-begins-001')

export const EVOLUTION_BEGINS_001_CARDS = {
  spark_chasing_lizard: u(
    'spark_chasing_lizard', '불똥을 쫓는 도마뱀', 1, 0, 1, ['fire'],
    '이 몬스터가 공격하는 동안 공격력 +3을 얻는다.',
    {
      flavorText: '만지면 의외로 뜨겁지 않다. 물리면 손가락을 잃겠지만.',
    },
  ),
  unexploded_bomb_mouse: u(
    'unexploded_bomb_mouse', '터지지 않은 폭탄쥐', 2, 2, 1, ['fire'],
    '유언 - 상대 몬스터 하나에게 피해 2를 준다.', {
      keywords: ['last_words'],
      flavorText: '언젠가 터지는 걸 알면서도 기르는 이가 많다.',
    },
  ),
  iron_horn_boar: u(
    'iron_horn_boar', '쇠뿔 멧돼지', 2, 4, 1, ['fire'],
    '돌진. 이 몬스터는 직접 공격할 수 없다.',
    {
      keywords: ['charge'],
      flavorText: '쇠뿔처럼 보이는 게 뚫고 나온 엄니라는 말이 있다.',
    },
  ),
  flame_javelin_soldier: u(
    'flame_javelin_soldier', '화염 투창병', 3, 1, 4, ['fire'],
    '이 몬스터가 전투할 때, 전투 전에 상대 몬스터에게 피해 1을 준다. 그 피해로 상대 몬스터가 묘지로 보내졌다면 전투는 일어나지 않는다.',
    {
      flavorText: '바늘로도 죽일 수 있습니다!',
    },
  ),
  volcanic_eruption: s(
    'volcanic_eruption', '화산 폭발', 5, ['fire'],
    '모든 몬스터에게 피해 2를 준다. 이 효과로 자신의 불 몬스터가 묘지로 보내졌다면, 한 번 더 발동한다.',
    {
      flavorText: '결국 이 앞에서 모두 무의미하다.',
    },
  ),
  flame_mane_captain: u(
    'flame_mane_captain', '화염갈기 대장', 3, 3, 3, ['fire'],
    '진화 - 불 몬스터. 이 몬스터가 전투로 상대 몬스터를 묘지로 보냈다면, 이 몬스터를 준비한다.',
    {
      evolutionAttribute: 'fire',
      flavorText: '불꽃을 두르고 일어난 존재.',
    },
  ),
  exploding_mountain_dragon: u(
    'exploding_mountain_dragon', '폭발하는 산맥룡', 6, 5, 3, ['fire'],
    '진화 - 불 몬스터. 출현 - 상대의 모든 몬스터에게 피해 2를 준다.',
    {
      evolutionAttribute: 'fire',
      flavorText: '화산보다 강한 무언가가 화산 안에서 태어났다고 전해진다.',
    },
  ),

  // 물
  scale_diver: u(
    'scale_diver', '비늘 잠수부', 1, 1, 2, ['water'],
    '이 몬스터는 공격력이 3 이상인 몬스터에게 공격받지 않는다. 이 효과로 인해 공격할 수 있는 몬스터가 없는 경우, 상대는 직접 공격할 수 있다.',
    {
      flavorText: '물에서 살아남기!',
    },
  ),
  underwater_observer: u(
    'underwater_observer', '물밑을 살피는 자', 2, 2, 3, ['water'],
    '출현 - 자신의 덱 맨 위 카드 2장을 확인한다. 원하는 순서로 덱 맨 위에 되돌리거나, 그중 한 장을 묘지로 보낼 수 있다.',
    {
      flavorText: '어디든 생명은 존재하니까.',
    },
  ),
  returning_jellyfish: u(
    'returning_jellyfish', '되돌아오는 해파리', 2, 2, 4, ['water'],
    '이 몬스터가 전투한 뒤 살아 있다면, 이 몬스터를 소유자의 손으로 가져온다.',
    {
      flavorText: '다시 보고 싶지 않았어.',
    },
  ),
  ice_mirror_spirit: u(
    'ice_mirror_spirit', '얼음거울 정령', 3, 2, 3, ['water'],
    '출현 - 상대의 소진된 비용 2 이하인 몬스터 하나를 선택한다. 그 몬스터는 다음 턴에 준비되지 않는다.',
    {
      flavorText: '얼음을 섬세하게 깎았다고 탐험가들은 생각했다.',
    },
  ),
  grand_reverse_current: s(
    'grand_reverse_current', '대환류', 5, ['water'],
    '전장의 모든 소진된 몬스터를 각각 그 소유자의 손으로 가져온다.',
    {
      flavorText: '물도 시간도 멈추지 않으므로.',
    },
  ),
  wave_fin: u(
    'wave_fin', '파도의 등지느러미', 3, 3, 4, ['water'],
    '진화 - 물 몬스터. 출현 - 상대의 소진된 비용 2 이하 몬스터 하나를 그 소유자의 손으로 가져올 수 있다. 이 몬스터가 직접 공격한 뒤, 카드 1장을 뽑을 수 있다. 그렇게 한 경우, 손에서 카드 한 장을 덱 맨 아래에 놓는다.',
    {
      visualKey: 'waves',
      evolutionAttribute: 'water',
      flavorText: '파도에 찢긴 적이 있는가?',
    },
  ),
  crystal_tsunami: u(
    'crystal_tsunami', '수정 해일', 5, 4, 4, ['water'],
    '진화 - 물 몬스터. 출현 - 상대의 소진된 몬스터 하나를 그 소유자의 손으로 가져올 수 있다.',
    {
      visualKey: 'waves',
      evolutionAttribute: 'water',
      flavorText: '온다.',
    },
  ),

  // 땅
  hard_seed_bug: u(
    'hard_seed_bug', '단단한 씨앗벌레', 1, 1, 2, ['earth'],
    '자신의 마나에 땅 카드가 5장 이상 있다면, 이 몬스터는 공격력 +1과 체력 +1을 얻는다.',
    {
      flavorText: '땅이 단단할수록 자라는 벌레.',
    },
  ),
  boulder_carrier: u(
    'boulder_carrier', '돌덩이 운반꾼', 2, 2, 4, ['earth'],
    '이 몬스터는 공격할 수 없다.',
    {
      flavorText: '몸도 돌이다.',
    },
  ),
  mana_flipping_fairy: u(
    'mana_flipping_fairy', '땅을 가는 요정', 2, 1, 3, ['earth'],
    '출현 - 자신의 마나 하나를 손으로 가져올 수 있다. 그렇게 했다면, 자신의 손에서 카드 한 장을 소진된 상태로 마나에 놓는다.',
    {
      flavorText: '농사는 쉽지 않습니다. 늘 전쟁이지요.',
    },
  ),
  cliff_hunter: u(
    'cliff_hunter', '절벽의 사냥꾼', 3, 1, 4, ['earth'],
    '이 몬스터가 몬스터를 공격하는 동안 공격력 +2를 얻는다.',
    {
      flavorText: '불의 병사들은 하나둘 이유도 모른 채 죽었다.',
    },
  ),
  rising_earth: s(
    'rising_earth', '솟아나는 대지', 5, ['earth'],
    '자신의 마나에서 비용 5 이하이며 진화 몬스터가 아닌 몬스터 하나를 소환한다. 그 몬스터의 출현은 발동하지 않는다. 그 몬스터가 땅 몬스터라면 이번 턴 동안 돌진을 얻는다.',
    {
      flavorText: '그것은 기어코 산이 되었다.',
    },
  ),
  walking_hill: u(
    'walking_hill', '걸어 다니는 언덕', 4, 5, 5, ['earth'],
    '진화 - 땅 몬스터. 이 몬스터는 상대 효과로 손으로 돌아가지 않는다.',
    {
      evolutionAttribute: 'earth',
      flavorText: '잠시 앉아 쉴 때마다 마을 하나가 사라진다.',
    },
  ),
  earth_guardian: u(
    'earth_guardian', '대지의 수호자', 6, 4, 4, ['earth'],
    '진화 - 땅 몬스터. 이 몬스터가 진화해서 소환되었을 때, 자신의 마나에서 비용 2 이하인 몬스터를 최대 2장까지 빈 전장에 소환할 수 있다. 그 몬스터들의 출현은 발동하지 않는다.',
    {
      evolutionAttribute: 'earth',
      flavorText: '당신이 수호자인데 왜 우리가 싸웁니까?',
    },
  ),

  // 어둠
  poisoned_skeleton: u(
    'poisoned_skeleton', '독이 발린 해골', 2, 1, 1, ['dark'],
    '암살.', {
      keywords: ['assassination'],
      flavorText: '그 독에 스스로 죽어버렸다고 한다.',
    },
  ),
  grave_merchant: u(
    'grave_merchant', '무덤 안의 상인', 2, 2, 2, ['dark'],
    '출현 - 자신의 묘지에서 비용 1 이하인 몬스터 하나를 손으로 가져온다.',
    {
      flavorText: '싸게 팝니다! 저는 주웠지만.',
    },
  ),
  weakened_giant: u(
    'weakened_giant', '쇠약한 거인', 2, 3, 3, ['dark'],
    '이 몬스터는 직접 공격할 수 없다. 자신의 턴 종료 시 자신의 묘지에 어둠 카드가 없다면 이 몬스터를 묘지로 보낸다.',
    {
      flavorText: '문드러지고 있다. 아직 살아있다.',
    },
  ),
  funeral_inviter: u(
    'funeral_inviter', '장례식의 초대자', 3, 2, 2, ['dark'],
    '유언 - 상대는 자신의 손에서 카드 한 장을 선택해 묘지로 보낸다. 자신의 묘지에 카드가 4장 이상 있다면 이 몬스터는 잠행을 얻는다.',
    {
      keywords: ['last_words'],
      flavorText: '마지막으로 남긴 말은 다음에 보자는 말.',
    },
  ),
  mass_burial: s(
    'mass_burial', '집단 매장', 3, ['dark'],
    '상대는 자신의 전장에서 몬스터 하나를 선택해 묘지로 보낸다. 자신의 전장에 몬스터가 있다면, 자신의 몬스터 하나를 묘지로 보낼 수 있다. 그렇게 했다면 상대는 몬스터 하나를 추가로 선택해 묘지로 보낸다.',
    {
      flavorText: '모두가 죽어야 진정한 평화가 옵니다.',
    },
  ),
  blackwing_predator: u(
    'blackwing_predator', '검은날개 포식자', 3, 0, 4, ['dark'],
    '진화 - 어둠 몬스터. 암살. 출현 - 자신의 묘지에서 비용 1 이하인 어둠 몬스터 하나를 손으로 가져올 수 있다.',
    {
      keywords: ['assassination'],
      evolutionAttribute: 'dark',
      flavorText: '그 말 그대로, 어둠이 삼킨다.',
    },
  ),
  mourner: u(
    'mourner', '장송하는 자', 5, 4, 6, ['dark'],
    '진화 - 어둠 몬스터. 출현 - 자신의 다른 몬스터 하나를 묘지로 보낼 수 있다. 그렇게 했다면 상대 몬스터 하나를 묘지로 보낸다. 유언 - 자신의 묘지에서 비용 2 이하인 어둠 몬스터 하나를 소환할 수 있다. 그 몬스터의 출현은 발동하지 않는다.',
    {
      keywords: ['last_words'],
      evolutionAttribute: 'dark',
      flavorText: '결국 보고 말았군.',
    },
  ),

  // 빛
  silent_shield_soldier: u(
    'silent_shield_soldier', '침묵하는 방패병', 2, 2, 4, ['light'],
    '이 몬스터는 공격할 수 없다.',
    {
      flavorText: '침묵은 힘.',
    },
  ),
  returning_paladin: u(
    'returning_paladin', '돌아오는 성기사', 2, 2, 3, ['light'],
    '이 몬스터가 몬스터를 공격한 뒤 살아 있다면 이 몬스터를 준비한다.',
    {
      flavorText: '생각보다 빨리 만났네요!',
    },
  ),
  little_judge: u(
    'little_judge', '작은 심판관', 2, 2, 3, ['light'],
    '상대의 비용 1 이하인 몬스터는 이 몬스터를 공격할 수 없다.',
    {
      flavorText: '정숙!',
    },
  ),
  salvation_lancer: u(
    'salvation_lancer', '구원의 창기사', 2, 2, 3, ['light'],
    '자신의 라이프가 2장 이하라면, 이 몬스터는 공격력 +1을 얻는다.',
    {
      flavorText: '위기에 빠진 병사는 늘 누군가를 기다린다.',
    },
  ),
  last_prayer: s(
    'last_prayer', '마지막 기도', 5, ['light'],
    '자신의 라이프가 2장 이하일 때만 사용할 수 있다. 상대의 모든 몬스터를 소진한다. 자신의 모든 몬스터를 준비한다. 이번 턴에 소환된 몬스터도 이번 턴에 공격할 수 있다.',
    {
      flavorText: '마지막이라는 건 이전에도 기도했다는 것이지요.',
    },
  ),
  sky_white_horse_knight: u(
    'sky_white_horse_knight', '천공의 백마기사', 4, 3, 4, ['light'],
    '진화 - 빛 몬스터. 비행. 출현 - 자신의 다른 소진된 몬스터 하나를 준비할 수 있다. 상대는 가능하다면 이 몬스터부터 공격해야 한다.',
    {
      keywords: ['flying'],
      evolutionAttribute: 'light',
      flavorText: '기어코 바다는 하늘의 아래가 되었다.',
    },
  ),
  spirit_agent: u(
    'spirit_agent', '성령의 대리인', 6, 5, 7, ['light'],
    '진화 - 빛 몬스터. 질풍. 이 몬스터가 전장에 있는 동안 각 플레이어는 자신의 턴에 최대 두 번만 공격할 수 있다.',
    {
      keywords: ['windfury'],
      evolutionAttribute: 'light',
      flavorText: '누가 이곳을 지나갈 수 있겠는가?',
    },
  ),

  // 레인보우
  lava_gardener: u(
    'lava_gardener', '용암 정원사', 3, 2, 3, ['fire', 'earth'],
    '출현 - 불 공명 - 상대 몬스터 하나에게 피해 1을 준다. 출현 - 땅 공명 - 자신의 소진된 마나 하나를 준비한다.',
    {
      flavorText: '용암은 따뜻하죠.',
    },
  ),
  stone_pillar_priest: u(
    'stone_pillar_priest', '돌기둥의 성직자', 3, 1, 4, ['earth', 'light'],
    '출현 - 땅 공명 - 자신의 손에서 카드 한 장을 소진된 상태로 마나에 놓을 수 있다. 출현 - 빛 공명 - 자신의 라이프 카드 하나를 확인할 수 있다. 각성 카드일 경우, 그 카드를 손으로 가져온 후 각성 효과를 발동할 수 있다.',
    {
      flavorText: '돌은 무엇도 듣지 않는다.',
    },
  ),
  mirror_lake_prophet: u(
    'mirror_lake_prophet', '거울 호수의 예언자', 3, 2, 3, ['light', 'water'],
    '출현 - 빛 공명 - 자신의 라이프 카드 하나를 확인한다. 출현 - 물 공명 - 자신의 덱 맨 위 카드를 확인하고 덱 맨 위로 되돌리거나 묘지로 보낸다. 두 공명을 모두 충족했다면 확인한 라이프 카드와 덱 맨 위 카드를 서로 바꿀 수 있다.',
    {
      flavorText: '비친 게 늘 진실은 아니다.',
    },
  ),
  sunken_coffin_keeper: u(
    'sunken_coffin_keeper', '가라앉은 관지기', 3, 2, 3, ['water', 'dark'],
    '출현 - 어둠 공명 - 자신의 덱 맨 위 카드 한 장을 확인하고 묘지로 보낼 수 있다. 출현 - 물 공명 - 자신의 묘지 카드 한 장을 덱 맨 위에 놓을 수 있다. 두 공명을 모두 충족했다면 카드 1장을 뽑는다.',
    {
      flavorText: '가라앉은 기억들.',
    },
  ),
  crematory_smoke: s(
    'crematory_smoke', '그림자 낀 산맥', 3, ['dark', 'fire'],
    '불 공명 - 상대 몬스터 하나에게 피해 2를 준다. 어둠 공명을 충족했다면, 대신 상대의 모든 몬스터에게 준다.',
    {
      flavorText: '그림자는 진실입니다. 일부라서 그렇지.',
    },
  ),
} satisfies Partial<Record<CardId, CardDefinition>>
