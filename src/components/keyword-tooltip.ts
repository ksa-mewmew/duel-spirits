import { CARDS } from '../shared/cards'

import type { CardId, CardKeyword } from '../shared/cards'

interface KeywordHelp {
  id: CardKeyword | 'resonance'
  name: string
  description: string
  className: string
  textPattern: RegExp
}

const KEYWORD_HELP: KeywordHelp[] = [
  { id: 'resonance', name: '공명', description: '자신의 마나 영역에 지정 속성 카드가 있으면 적용됩니다. 준비·소진 여부는 관계없습니다.', className: 'resonance', textPattern: /공명/ },
  { id: 'stealth', name: '잠행', description: '상대 몬스터의 공격 대상으로 선택되지 않습니다.', className: 'stealth', textPattern: /잠행/ },
  { id: 'flying', name: '비행', description: '공격 가능한 상대 몬스터가 있어도 플레이어를 직접 공격할 수 있습니다.', className: 'flying', textPattern: /비행/ },
  { id: 'assassination', name: '암살', description: '몬스터와 전투한 뒤, 전투한 상대 몬스터를 묘지로 보냅니다.', className: 'assassination', textPattern: /암살/ },
  { id: 'guard', name: '수호', description: '준비 상태라면 상대는 공격 가능한 수호 몬스터 중 하나를 먼저 공격해야 합니다.', className: 'guard', textPattern: /수호/ },
  { id: 'windfury', name: '질풍', description: '한 턴에 최대 두 번 공격할 수 있습니다.', className: 'windfury', textPattern: /질풍/ },
  { id: 'rush', name: '기습', description: '소환한 턴에도 몬스터와 플레이어를 공격할 수 있습니다.', className: 'rush', textPattern: /기습/ },
  { id: 'charge', name: '돌진', description: '소환한 턴에는 상대 몬스터를 공격할 수 있습니다.', className: 'charge', textPattern: /돌진/ },
  { id: 'last_words', name: '유언', description: '이 몬스터가 전장에서 묘지로 간 직후 발동합니다.', className: 'last-words', textPattern: /유언/ },
]

let activeTarget: HTMLElement | null = null
let tooltip: HTMLElement | null = null

function keywordHelpFor(target: HTMLElement, cardId: CardId): KeywordHelp[] {
  const card = CARDS[cardId]
  const staticKeywords = new Set(card.type === 'unit' ? card.keywords ?? [] : [])
  const frame = target.closest<HTMLElement>('.field-slot-frame')

  return KEYWORD_HELP.filter((keyword) => (
    keyword.id === 'resonance'
      ? keyword.textPattern.test(card.rulesText)
      : card.type === 'unit' && (
          staticKeywords.has(keyword.id)
          || keyword.textPattern.test(card.rulesText)
          || frame?.classList.contains(`has-keyword-${keyword.className}`)
        )
  ))
}

function positionTooltip(): void {
  if (!activeTarget || !tooltip) return
  const target = activeTarget.getBoundingClientRect()
  const tooltipRect = tooltip.getBoundingClientRect()
  const gap = 14
  const roomOnRight = window.innerWidth - target.right
  const left = roomOnRight >= tooltipRect.width + gap
    ? target.right + gap
    : target.left - tooltipRect.width - gap
  const top = Math.min(
    Math.max(12, target.top + target.height / 2 - tooltipRect.height / 2),
    window.innerHeight - tooltipRect.height - 12,
  )
  tooltip.style.left = `${Math.max(12, left)}px`
  tooltip.style.top = `${top}px`
  tooltip.classList.toggle('keyword-tooltip--left', roomOnRight < tooltipRect.width + gap)
}

function hideKeywordTooltip(target?: HTMLElement): void {
  if (target && activeTarget !== target) return
  activeTarget = null
  tooltip?.remove()
  tooltip = null
}

function showKeywordTooltip(target: HTMLElement): void {
  const rawCardId = target.dataset.cardId
  if (!rawCardId || !(rawCardId in CARDS)) return
  const keywords = keywordHelpFor(target, rawCardId as CardId)
  if (keywords.length === 0) {
    hideKeywordTooltip()
    return
  }

  hideKeywordTooltip()
  activeTarget = target
  tooltip = document.createElement('aside')
  tooltip.className = 'keyword-tooltip'
  tooltip.setAttribute('role', 'tooltip')
  tooltip.innerHTML = keywords.map((keyword) => `
    <section class="keyword-tooltip__item keyword-tooltip__item--${keyword.className}">
      <strong>${keyword.name}</strong>
      <p>${keyword.description}</p>
    </section>
  `).join('')
  document.body.append(tooltip)
  positionTooltip()
}

export function bindCardKeywordTooltips(root: ParentNode = document): void {
  hideKeywordTooltip()
  for (const card of root.querySelectorAll<HTMLElement>('.game-card[data-card-id]')) {
    card.addEventListener('pointerenter', () => showKeywordTooltip(card))
    card.addEventListener('pointerleave', () => hideKeywordTooltip(card))
    card.addEventListener('focusin', () => showKeywordTooltip(card))
    card.addEventListener('focusout', (event) => {
      if (!card.contains(event.relatedTarget as Node | null)) hideKeywordTooltip(card)
    })
  }
}

window.addEventListener('resize', positionTooltip)
window.addEventListener('scroll', positionTooltip, true)
