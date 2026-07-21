import { CARDS } from './cards'
import { RULES_VERSION } from './sets'

import type { CardId } from './cards'
import type { GameFormat } from './schema'

export type RulebookBlock =
  | { type: 'paragraph'; text: string }
  | { type: 'list'; ordered?: boolean; items: string[] }
  | { type: 'callout'; title: string; text: string }
  | { type: 'terms'; items: Array<{ term: string; description: string }> }

export interface RulebookSection {
  id: string
  navLabel: string
  title: string
  blocks: RulebookBlock[]
}

export interface RulebookDocument {
  title: string
  subtitle: string
  rulesVersion: string
  formatName: string
  formatSummary: string
  sections: RulebookSection[]
}

function formatCopyRule(format: GameFormat<CardId>): string {
  if (format.deckSource === 'draft') {
    return '드래프트에서 받은 카드만 쓸 수 있습니다. 같은 카드도 받은 수량보다 많이 넣을 수 없습니다.'
  }

  const restricted = Object.entries(format.restrictedCardLimits)
    .map(([cardId, limit]) => `${CARDS[cardId as CardId].name} ${limit}장`)

  if (restricted.length > 0) {
    return `같은 카드는 보통 ${format.maxCopiesPerCard}장까지 넣을 수 있습니다. 예외로 ${restricted.join(', ')}까지 넣을 수 있습니다.`
  }

  return `같은 카드는 최대 ${format.maxCopiesPerCard}장까지 넣을 수 있습니다.`
}

export function createRulebookDocument(format: GameFormat<CardId>): RulebookDocument {
  const drawDeckSize = format.deckSize - format.startingLife - format.startingHand
  const copyRule = formatCopyRule(format)

  return {
    title: '룰북',
    subtitle: '처음 하는 사람을 위한 기본 규칙',
    rulesVersion: RULES_VERSION,
    formatName: format.name,
    formatSummary: `${format.description} 덱 ${format.deckSize}장 · 시작 라이프 ${format.startingLife}장 · 시작 손 ${format.startingHand}장 · 시작 덱 ${drawDeckSize}장 · 전장 ${format.fieldSlots}슬롯`,
    sections: [
      {
        id: 'rules-goal',
        navLabel: '게임의 목표',
        title: '1. 어떻게 이기나요?',
        blocks: [
          {
            type: 'paragraph',
            text: '상대의 라이프를 모두 없앤 뒤, 상대 플레이어를 한 번 더 직접 공격하면 이깁니다. 마지막 라이프를 잃는 것만으로는 게임이 끝나지 않습니다.',
          },
          {
            type: 'callout',
            title: '첫 판에는 이것만 기억하세요',
            text: '내 턴에는 마나를 늘리고, 그 마나로 몬스터와 주문을 사용합니다. 몬스터로 상대의 라이프를 모두 없앤 다음, 라이프가 없는 상대를 직접 공격하면 승리합니다.',
          },
          {
            type: 'paragraph',
            text: '게임 도중에는 어느 플레이어나 언제든 항복할 수 있습니다. 항복하면 그 즉시 패배합니다.',
          },
        ],
      },
      {
        id: 'rules-setup',
        navLabel: '게임 준비',
        title: '2. 게임 준비',
        blocks: [
          {
            type: 'paragraph',
            text: `현재 포맷은 ‘${format.name}’입니다. 덱은 정확히 ${format.deckSize}장으로 만듭니다. ${copyRule}`,
          },
          {
            type: 'list',
            ordered: true,
            items: [
              '각자 덱을 섞습니다.',
              `덱 위에서 ${format.startingLife}장을 뒷면으로 놓아 라이프로 삼습니다. 자기 라이프도 어떤 카드인지 볼 수 없습니다.`,
              `그 다음 ${format.startingHand}장을 손으로 가져옵니다. 남은 ${drawDeckSize}장은 덱으로 둡니다.`,
              '선공은 무작위로 정합니다. 시작 손은 다시 뽑지 않습니다.',
              '선공은 첫 턴에 카드를 뽑지 않습니다.',
            ],
          },
        ],
      },
      {
        id: 'rules-turn',
        navLabel: '내 턴',
        title: '3. 내 턴에는 무엇을 하나요?',
        blocks: [
          {
            type: 'list',
            ordered: true,
            items: [
              '내 마나와 몬스터를 모두 준비 상태로 돌립니다.',
              '카드 1장을 뽑습니다. 단, 경기의 첫 턴에는 뽑지 않습니다.',
              '원하는 순서로 카드를 사용하거나 공격합니다.',
              '할 일을 마쳤으면 턴을 종료합니다.',
            ],
          },
          {
            type: 'paragraph',
            text: '내 턴에는 손의 카드 한 장을 마나로 놓기, 몬스터 소환하기, 주문 사용하기, 몬스터로 공격하기를 할 수 있습니다. 마나로 놓는 행동은 턴마다 한 번만 할 수 있지만, 카드 사용과 공격은 조건이 되는 만큼 반복할 수 있습니다.',
          },
          {
            type: 'callout',
            title: '“이번 턴 동안”은 언제 끝나나요?',
            text: '턴 종료를 누르면 다음 플레이어의 턴이 시작되기 전에 사라집니다. 임시 체력이 사라져 피해가 체력 이상이 된 몬스터는 그때 묘지로 갑니다.',
          },
        ],
      },
      {
        id: 'rules-mana',
        navLabel: '마나·카드',
        title: '4. 마나와 카드 사용',
        blocks: [
          {
            type: 'paragraph',
            text: '손의 카드 한 장을 마나로 놓으면 그 카드는 준비 상태가 됩니다. 마나는 다음 턴에도 남으며, 놓을 수 있는 수량에는 제한이 없습니다.',
          },
          {
            type: 'list',
            items: [
              '카드를 사용하려면 카드의 비용만큼 준비된 마나를 골라 소진합니다.',
              '한 장의 마나는 한 번의 비용 지불에서 한 번만 셉니다.',
              '비용이 0인 카드는 마나를 고르지 않고 사용할 수 있습니다.',
              '비용 감소가 여러 번 적용되어도 최종 비용은 0보다 낮아지지 않습니다.',
              '몬스터는 빈 전장 슬롯을 골라 소환합니다.',
              '주문은 문구를 처리한 뒤 묘지로 갑니다.',
            ],
          },
          {
            type: 'terms',
            items: [
              { term: '속성', description: '불, 물, 땅, 어둠, 빛이 있습니다. 두 속성을 가진 카드는 두 속성을 모두 가진 것으로 봅니다.' },
              { term: '공명', description: '그 카드를 쓰기 위해 실제로 소진한 마나에 적힌 속성이 있으면 발동합니다.' },
              { term: '효과 소환', description: '카드 효과로 몬스터를 전장에 놓는 일입니다. 따로 적혀 있지 않으면 비용을 내지 않고, 출현도 발동하지 않습니다.' },
            ],
          },
        ],
      },
      {
        id: 'rules-combat',
        navLabel: '공격',
        title: '5. 몬스터로 공격하기',
        blocks: [
          {
            type: 'paragraph',
            text: '준비 상태인 내 몬스터를 골라 공격합니다. 보통 소환한 턴에는 공격할 수 없습니다. 공격한 몬스터는 소진됩니다.',
          },
          {
            type: 'list',
            items: [
              '상대 전장에 공격할 수 있는 몬스터가 있으면 먼저 그 몬스터를 공격해야 합니다.',
              '상대 전장의 몬스터가 모두 잠행이라 공격할 수 없다면 상대 플레이어를 직접 공격할 수 있습니다.',
              '비행 몬스터는 상대 전장에 공격 가능한 몬스터가 있어도 직접 공격할 수 있습니다.',
              '몬스터끼리 싸우면 두 몬스터가 서로에게 자신의 공격력만큼 동시에 피해를 줍니다.',
              '질풍 몬스터는 한 턴에 두 번 공격할 수 있으며, 첫 공격 뒤에는 준비 상태로 남습니다.',
              '전장 어느 쪽에든 사도의 비둘기가 있으면 각 플레이어는 그 턴에 공격을 한 번만 할 수 있습니다.',
            ],
          },
          {
            type: 'callout',
            title: '소환한 턴에 공격하는 능력',
            text: '기습은 몬스터와 플레이어를 모두 공격할 수 있습니다. 돌진은 상대 몬스터만 공격할 수 있고, 플레이어를 직접 공격할 수는 없습니다.',
          },
        ],
      },
      {
        id: 'rules-life',
        navLabel: '라이프·각성',
        title: '6. 라이프를 잃으면 어떻게 되나요?',
        blocks: [
          {
            type: 'list',
            ordered: true,
            items: [
              '직접 공격한 플레이어가 상대의 뒷면 라이프 가운데 잃게 할 카드를 고릅니다. 카드 내용을 보고 고를 수는 없습니다.',
              '고른 라이프를 한 장씩 그 소유자의 손으로 가져옵니다.',
              '손에 들어온 카드에 각성이 있으면 그 자리에서 처리합니다.',
              '선택이 필요한 각성이 여러 개라면 생긴 순서대로 하나씩 해결합니다.',
              '마지막 라이프를 잃어도 게임은 계속됩니다.',
            ],
          },
          {
            type: 'callout',
            title: '패배 판정',
            text: '라이프가 공격 시작 시점에 0장이면 그 직접 공격으로 즉시 패배합니다. 라이프가 1장일 때 라이프 2장을 잃게 하는 공격을 받아도 남은 1장만 손으로 가져오고 계속합니다. 마지막 라이프를 잃게 한 공격과 패배를 만드는 직접 공격은 서로 다른 공격이어야 합니다.',
          },
          {
            type: 'list',
            items: [
              '각성은 상대 턴에도 발동합니다.',
              '패배가 확정된 직접 공격에서는 잃는 라이프가 없으므로 각성도 발동하지 않습니다.',
              '각성 카드의 소유자 기준 상대 전장에 예언자가 있으면 그 각성은 발동하지 않습니다.',
              '카드가 라이프에서 손이 아니라 묘지로 가거나, 문구에 각성이 발동하지 않는다고 적혀 있으면 각성하지 않습니다.',
              '각성으로 몬스터를 소환하려는데 빈 슬롯이 없으면 그 카드는 손에 남습니다.',
            ],
          },
        ],
      },
      {
        id: 'rules-zones',
        navLabel: '카드 영역',
        title: '7. 카드가 놓이는 곳',
        blocks: [
          {
            type: 'terms',
            items: [
              { term: '덱', description: '카드 내용과 순서는 양쪽 모두 볼 수 없습니다. 남은 장수만 공개됩니다.' },
              { term: '손', description: '소유자만 카드 내용을 봅니다. 상대는 장수만 알 수 있습니다.' },
              { term: '라이프', description: '소유자도 카드 내용을 볼 수 없습니다. 뒷면 카드의 위치와 장수만 공개됩니다.' },
              { term: '마나', description: '양쪽 모두 카드 내용을 볼 수 있습니다. 각 카드는 준비 또는 소진 상태입니다.' },
              { term: '전장', description: `양쪽 모두 카드 내용을 볼 수 있습니다. 각 플레이어에게 ${format.fieldSlots}개의 고정 슬롯이 있습니다.` },
              { term: '묘지', description: '양쪽 모두 카드 내용을 볼 수 있습니다.' },
            ],
          },
          {
            type: 'list',
            items: [
              '전장의 몬스터가 사라져도 다른 몬스터가 빈 슬롯으로 자동 이동하지 않습니다.',
              '소환할 자리가 따로 정해져 있지 않다면 소환하는 플레이어가 빈 슬롯을 고릅니다.',
              '전장 슬롯의 위치는 공격 가능 여부에 영향을 주지 않습니다.',
              '덱 맨 위 카드를 확인하는 효과는 그 효과를 해결하는 플레이어만 봅니다.',
              '카드가 전장을 떠나면 누적 피해, 소진 상태, 공격 횟수, 임시 능력치가 모두 사라집니다.',
            ],
          },
        ],
      },
      {
        id: 'rules-draw',
        navLabel: '드로우·묘지',
        title: '8. 덱이 비면 어떻게 되나요?',
        blocks: [
          {
            type: 'list',
            items: [
              '카드를 뽑을 때는 덱 맨 위 카드를 손으로 가져옵니다.',
              '덱이 비어 있고 묘지에 카드가 있다면 묘지를 섞어 새 덱으로 만든 뒤 뽑습니다.',
              '덱과 묘지가 모두 비어 있으면 아무것도 뽑지 않습니다. 덱이 비었다는 이유로 패배하지는 않습니다.',
              '여러 장을 뽑을 때는 한 장씩 차례로 뽑습니다.',
              '전장의 몬스터가 묘지로 가면 카드 소유자의 묘지에 놓고 유언을 확인합니다.',
            ],
          },
        ],
      },
      {
        id: 'rules-damage',
        navLabel: '피해·사망',
        title: '9. 피해, 회복, 사망',
        blocks: [
          {
            type: 'list',
            items: [
              '몬스터가 받은 피해는 턴이 끝나도 남습니다.',
              '누적 피해가 현재 체력 이상이 되면 그 몬스터는 묘지로 갑니다.',
              '회복은 누적 피해를 줄입니다. 체력 자체를 올리지는 않습니다.',
              '여러 몬스터가 동시에 죽으면 먼저 전장에 나온 몬스터부터 묘지로 보내고 유언을 처리합니다.',
              '카드 효과로 몬스터를 바로 묘지로 보내도 유언은 발동합니다.',
              '손이나 마나로 되돌리는 것은 묘지로 보내는 일이 아니므로 유언이 발동하지 않습니다.',
            ],
          },
        ],
      },
      {
        id: 'rules-keywords',
        navLabel: '키워드',
        title: '10. 자주 나오는 키워드',
        blocks: [
          {
            type: 'terms',
            items: [
              { term: '출현', description: '손에서 비용을 내고 정상 소환했을 때 발동합니다. 다른 효과로 소환하면 발동하지 않습니다.' },
              { term: '각성', description: '라이프에서 손으로 들어온 직후 발동합니다.' },
              { term: '공명', description: '그 카드를 쓰기 위해 실제로 소진한 마나에 지정 속성이 있으면 발동합니다.' },
              { term: '고립', description: '내 전장에 그 몬스터 외의 아군 몬스터가 없을 때 적용됩니다.' },
              { term: '기습', description: '소환한 턴에도 몬스터와 플레이어를 공격할 수 있습니다.' },
              { term: '돌진', description: '소환한 턴에는 상대 몬스터만 공격할 수 있습니다.' },
              { term: '질풍', description: '한 턴에 두 번 공격할 수 있습니다.' },
              { term: '비행', description: '상대 전장에 공격 가능한 몬스터가 있어도 직접 공격할 수 있습니다.' },
              { term: '잠행', description: '상대 몬스터의 공격 대상으로 고를 수 없습니다. 주문과 다른 효과는 카드 문구를 따릅니다.' },
              { term: '유언', description: '그 몬스터가 전장에서 묘지로 간 직후 발동합니다.' },
            ],
          },
        ],
      },
      {
        id: 'rules-details',
        navLabel: '세부 판정',
        title: '11. 헷갈릴 때 확인할 규칙',
        blocks: [
          {
            type: 'paragraph',
            text: '대부분의 상황은 카드 문구를 위에서 아래로 읽으면 해결됩니다. 카드 문구가 일반 규칙과 다르면 카드 문구를 따릅니다.',
          },
          {
            type: 'list',
            items: [
              '필요한 대상이나 비용을 고를 수 없는 행동은 시작할 수 없습니다.',
              '행동을 시작한 뒤 일부 카드가 사라지거나 영역이 비었다면, 남은 문구는 가능한 만큼 처리합니다.',
              '선택해야 하는 효과가 생기면 그 선택을 끝내기 전까지 다른 카드를 쓰거나 공격하거나 턴을 끝낼 수 없습니다.',
              '상대 행동에 끼어들어 카드를 쓰는 별도의 대응 단계는 없습니다.',
              '“가장 높은” 값을 가진 카드가 여러 장이면 조건에 맞는 카드를 모두 처리합니다.',
              '“확인한 후 덱 위로 되돌린다”는 그 카드의 순서를 바꾸지 않는다는 뜻입니다.',
              '“소환할 수 있다”는 하지 않아도 되는 선택입니다.',
              '앞선 피해로 죽은 몬스터는 즉시 전장을 떠나므로, 뒤에 적힌 회복을 받을 수 없습니다.',
              '한 카드에 공명이 여러 개 있으면 카드에 적힌 순서대로 하나씩 처리합니다.',
              '잠행은 몬스터의 공격만 막습니다. 주문이나 효과의 대상이 되는지는 카드 문구를 따릅니다.',
              '마나의 ‘너무 무거운 씨앗’을 소환하는 특수 행동은 비용을 내지 않으며 출현도 발동하지 않습니다.',
              '각성 문구가 “이 카드를 사용한다” 또는 “발동한다”고 하면 마나 비용을 다시 내지 않습니다.',
            ],
          },
        ],
      },
    ],
  }
}
