import {
  CARD_GROUPS,
  CARDS,
} from '../shared/cards'

import type { CardId } from '../shared/cards'

export interface RenderCardOptions {
  instanceId?: string
  classNames?: string[]
  compact?: boolean
  hidden?: boolean
  exhausted?: boolean
  selected?: boolean
  targetable?: boolean
  summonedThisTurn?: boolean
  remainingHealth?: number
  displayAttack?: number
  statusBadges?: Array<{
    label: string
    tone?: 'active' | 'inactive' | 'warning'
  }>
  actionsHtml?: string
  dataAttributes?: Record<string, string>
  interactive?: boolean
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
  const primaryGroup = card.groups[0]
  const group = CARD_GROUPS[primaryGroup]
  const classes = [
    'game-card',
    `game-card--${primaryGroup}`,
    `game-card--visual-${card.visualKey}`,
    options.compact ? 'game-card--compact' : '',
    options.exhausted ? 'is-exhausted' : '',
    options.selected ? 'is-selected' : '',
    options.targetable ? 'is-targetable' : '',
    options.summonedThisTurn ? 'is-summoning' : '',
    ...(options.classNames ?? []),
  ].filter(Boolean)

  const style = card.artUrl
    ? `style="--card-art: url('${escapeHtml(card.artUrl)}')"`
    : ''
  const interactive = options.interactive !== false

  return `
    <article
      class="${classes.join(' ')}"
      data-card-id="${card.id}"
      ${options.instanceId ? `data-instance-id="${escapeHtml(options.instanceId)}"` : ''}
      ${interactive ? 'tabindex="0" role="group"' : ''}
      ${renderDataAttributes(options.dataAttributes)}
      ${style}
    >
      <div class="game-card__art" aria-hidden="true"></div>
      <div class="game-card__overlay" aria-hidden="true"></div>

      <header class="game-card__header">
        <span class="game-card__cost">${card.cost}</span>
        <span class="game-card__group" title="${escapeHtml(group.name)}">
          ${escapeHtml(group.shortName)}
        </span>
      </header>

      <div class="game-card__code">${escapeHtml(card.name)}</div>

      ${options.statusBadges?.length
        ? `<div class="game-card__badges">${options.statusBadges.map((badge) => `<span class="game-card__badge game-card__badge--${badge.tone ?? 'active'}">${escapeHtml(badge.label)}</span>`).join('')}</div>`
        : ''}

      <footer class="game-card__footer">
        <p class="game-card__text">
          ${escapeHtml(card.rulesText || '효과 없음')}
        </p>
        <div class="game-card__stats" aria-label="공격력과 생명력">
          ${card.type === 'unit' ? `
          <span class="game-card__attack">${options.displayAttack ?? card.attack}</span>
          <span class="game-card__health">${options.remainingHealth ?? card.health}</span>
          ` : '<span class="game-card__spell-type">주문</span>'}
        </div>
      </footer>

      ${options.actionsHtml
        ? `<div class="game-card__actions">${options.actionsHtml}</div>`
        : ''}
    </article>
  `
}

export function renderManaToken(
  cardId: CardId,
  options: RenderManaTokenOptions,
): string {
  const card = CARDS[cardId]
  const classes = [
    'mana-token',
    `mana-token--${card.groups[0]}`,
    options.exhausted ? 'is-exhausted' : '',
    options.selected ? 'is-selected' : '',
    options.targetable ? 'is-targetable' : '',
  ].filter(Boolean)
  const groups = card.groups
    .map((groupId) => `<span class="mana-token__group mana-token__group--${groupId}">${escapeHtml(CARD_GROUPS[groupId].shortName)}</span>`)
    .join('')

  return `
    <article
      class="${classes.join(' ')}"
      data-card-id="${card.id}"
      data-instance-id="${escapeHtml(options.instanceId)}"
      tabindex="0"
      role="group"
      ${renderDataAttributes(options.dataAttributes)}
      aria-label="${escapeHtml(card.name)}${options.exhausted ? ', 소진됨' : ', 준비됨'}"
    >
      <div class="mana-token__groups">${groups}</div>
      <strong class="mana-token__name">${escapeHtml(card.name)}</strong>
      <span class="mana-token__cost">${card.cost}</span>
      <span class="mana-token__state">${options.exhausted ? '소진' : '준비'}</span>
      ${options.actionsHtml ? `<div class="mana-token__actions">${options.actionsHtml}</div>` : ''}
    </article>
  `
}
