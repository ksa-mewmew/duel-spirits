import {
  CARD_ATTRIBUTES,
  CARDS,
} from '../shared/cards'

import type { CardId } from '../shared/cards'
import { getCardArtPresentation } from '../config/visual-assets'

export interface RenderCardOptions {
  instanceId?: string
  classNames?: string[]
  compact?: boolean
  nameOnly?: boolean
  hidden?: boolean
  exhausted?: boolean
  selected?: boolean
  targetable?: boolean
  summonedThisTurn?: boolean
  remainingHealth?: number
  displayAttack?: number
  /** 카드 인스턴스에 적용된 현재 비용입니다. 기본 비용과 다르면 감소 상태를 표시합니다. */
  displayCost?: number
  actionsHtml?: string
  dataAttributes?: Record<string, string>
  interactive?: boolean
  /** 상세 보기에서도 공통 아트 중심 카드 면을 사용합니다. */
  detailLayout?: boolean
}

export interface RenderManaTokenOptions {
  instanceId: string
  exhausted?: boolean
  selected?: boolean
  targetable?: boolean
  actionsHtml?: string
  dataAttributes?: Record<string, string>
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

function renderDataAttributes(
  values: Record<string, string> | undefined,
): string {
  if (!values) return ''

  return Object.entries(values)
    .map(([key, value]) => `data-${key}="${escapeHtml(value)}"`)
    .join(' ')
}

function getCardNameLengthClass(name: string): string {
  const length = Array.from(name.replaceAll(' ', '')).length
  if (length <= 6) return 'game-card--name-short'
  if (length <= 8) return 'game-card--name-medium'
  if (length <= 10) return 'game-card--name-long'
  if (length <= 12) return 'game-card--name-xlong'
  return 'game-card--name-xxlong'
}

export function renderCardBack(
  classNames: string[] = [],
): string {
  return `
    <article class="game-card game-card--back ${classNames.join(' ')}">
      <div class="game-card__back-mark" aria-hidden="true"></div>
      <span class="sr-only">비공개 카드</span>
    </article>
  `
}

export function renderCard(
  cardId: CardId,
  options: RenderCardOptions = {},
): string {
  if (options.hidden) return renderCardBack(options.classNames)

  const card = CARDS[cardId]
  const art = getCardArtPresentation(cardId)
  const primaryAttribute = card.attributes[0]
  const isMultiAttribute = card.attributes.length > 1
  const attributeLabel = card.attributes
    .map((attributeId) => CARD_ATTRIBUTES[attributeId].shortName)
    .join('·')
  const classes = [
    'game-card',
    isMultiAttribute ? 'game-card--multi-attribute' : `game-card--${primaryAttribute}`,
    `game-card--visual-${card.visualKey}`,
    options.compact ? 'game-card--compact' : '',
    options.nameOnly ? 'game-card--name-only' : '',
    !options.nameOnly && !options.detailLayout ? 'game-card--center-name' : '',
    options.detailLayout ? 'game-card--detail-layout' : '',
    'game-card--art-ready',
    getCardNameLengthClass(card.name),
    options.exhausted ? 'is-exhausted' : '',
    options.selected ? 'is-selected' : '',
    options.targetable ? 'is-targetable' : '',
    options.summonedThisTurn ? 'is-summoning' : '',
    ...(options.classNames ?? []),
  ].filter(Boolean)

  const style = `style="--card-art: url('${escapeHtml(art.url)}'); --card-art-position: ${escapeHtml(art.position)}; --card-art-scale: ${art.scale}"`
  const interactive = options.interactive !== false
  const displayCost = options.displayCost ?? card.cost
  const costReduction = Math.max(0, card.cost - displayCost)
  if (costReduction > 0) classes.push('has-reduced-cost')
  const costSummary = costReduction > 0
    ? `현재 비용 ${displayCost}, 기본 비용 ${card.cost}`
    : `비용 ${displayCost}`
  const accessibleSummary = card.type === 'unit'
    ? `${card.name}, ${attributeLabel} 속성 몬스터, ${costSummary}, 공격력 ${options.displayAttack ?? card.attack}, 체력 ${options.remainingHealth ?? card.health}`
    : `${card.name}, ${attributeLabel} 속성 주문, ${costSummary}`

  return `
    <article
      class="${classes.join(' ')}"
      data-card-id="${card.id}"
      ${options.instanceId ? `data-instance-id="${escapeHtml(options.instanceId)}"` : ''}
      ${interactive ? 'tabindex="0" role="group"' : ''}
      aria-label="${escapeHtml(accessibleSummary)}"
      ${renderDataAttributes(options.dataAttributes)}
      ${style}
    >
      <div class="game-card__art" aria-hidden="true"></div>
      <div class="game-card__overlay" aria-hidden="true"></div>
      <div class="game-card__frame" aria-hidden="true"></div>

      ${options.nameOnly ? `
        <div class="game-card__name-only">
          <strong>${escapeHtml(card.name)}</strong>
        </div>
      ` : `
        <header class="game-card__header">
          <span class="game-card__cost-cluster" title="${costReduction > 0 ? `현재 비용 ${displayCost} · 기본 비용 ${card.cost}` : `비용 ${displayCost}`}">
            <span class="game-card__cost">${displayCost}</span>
            ${costReduction > 0 ? `<span class="game-card__cost-reduction" aria-hidden="true">−${costReduction}</span>` : ''}
          </span>
          <span class="game-card__attributes" title="${escapeHtml(card.attributes.map((attributeId) => CARD_ATTRIBUTES[attributeId].name).join(', '))}">
            ${card.attributes.map((attributeId) => `<span class="game-card__attribute">${escapeHtml(CARD_ATTRIBUTES[attributeId].shortName)}</span>`).join('')}
          </span>
        </header>

        <div class="game-card__code">${escapeHtml(card.name)}</div>

        <footer class="game-card__footer">
          ${card.type === 'unit' ? `
          <div class="game-card__stats" aria-label="공격력과 체력">
            <span class="game-card__attack">${options.displayAttack ?? card.attack}</span>
            <span class="game-card__health">${options.remainingHealth ?? card.health}</span>
          </div>
          ` : '<span class="game-card__spell-type">주문</span>'}
        </footer>
      `}

      ${options.actionsHtml
        ? `<div class="game-card__actions">${options.actionsHtml}</div>`
        : ''}
    </article>
  `
}

/**
 * 예전의 가로형 마나 토큰 API를 유지하되, 화면에는 이름만 보이는 카드형으로 렌더링합니다.
 */
export function renderManaToken(
  cardId: CardId,
  options: RenderManaTokenOptions,
): string {
  return renderCard(cardId, {
    instanceId: options.instanceId,
    compact: true,
    exhausted: options.exhausted,
    selected: options.selected,
    targetable: options.targetable,
    classNames: ['mana-card'],
    actionsHtml: options.actionsHtml,
    dataAttributes: options.dataAttributes,
  })
}
