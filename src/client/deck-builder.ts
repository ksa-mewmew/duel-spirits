import { CARD_ATTRIBUTES, CARDS } from '../shared/cards'
import { DECK_BUILDER_FORMATS, getFormat } from '../content/formats'
import { CARD_SETS } from '../content/sets'
import { createRulebookDocument } from '../content/rulebook'
import {
  DECK_SCHEMA_VERSION,
  createDefaultFormatSelection,
  createDraftPool,
  getAverageCost,
  getCardCopyLimit,
  getCardCounts,
  getCostDistribution,
  getAttributeDistribution,
  getFormatCardPool,
  getAttributeLabel,
  normalizeDeckFormatSelection,
  sortCardIdsForBuilder,
  validateDeck,
} from '../shared/decks'
import { renderCard } from '../components/card-renderer'

import type { CardAttributeId, CardId } from '../shared/cards'
import type { GameFormatId, SetId } from '../content/schema'
import type { SavedDeck } from '../shared/decks'

import {
  deleteDeck,
  getActiveDeckId,
  loadDecks,
  setActiveDeckId,
  upsertDeck,
} from './deck-storage'

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

interface BuilderState {
  decks: SavedDeck[]
  editingDeckId: string
  name: string
  cardIds: CardId[]
  formatId: GameFormatId
  selectedSetIds: SetId[]
  draftPool: SavedDeck['draftPool']
  searchQuery: string
  attributeFilter: CardAttributeId | 'all'
  typeFilter: 'all' | 'unit' | 'spell'
  costFilter: number | 'all'
  message: string
  hoverPreviewCardId: CardId | null
  pinnedPreviewCardId: CardId | null
  rulebookOpen: boolean
}

function cloneDeck(deck: SavedDeck): SavedDeck {
  return structuredClone(deck)
}

function applyDeckToState(state: BuilderState, deck: SavedDeck): void {
  state.editingDeckId = deck.id
  state.name = deck.name
  state.cardIds = [...deck.cardIds]
  state.formatId = deck.formatId
  state.selectedSetIds = [...deck.selectedSetIds]
  state.draftPool = deck.draftPool ? structuredClone(deck.draftPool) : null
}

function getInitialState(): BuilderState {
  const decks = loadDecks()
  const activeId = getActiveDeckId()
  const deck = decks.find((item) => item.id === activeId) ?? decks[0]
  if (!deck) throw new Error('편집할 덱을 찾지 못했습니다.')

  return {
    decks,
    editingDeckId: deck.id,
    name: deck.name,
    cardIds: [...deck.cardIds],
    formatId: deck.formatId,
    selectedSetIds: [...deck.selectedSetIds],
    draftPool: deck.draftPool ? structuredClone(deck.draftPool) : null,
    searchQuery: '',
    attributeFilter: 'all',
    typeFilter: 'all',
    costFilter: 'all',
    message: '',
    hoverPreviewCardId: null,
    pinnedPreviewCardId: null,
    rulebookOpen: false,
  }
}

export function renderDeckBuilder(appElement: HTMLDivElement): void {
  const state = getInitialState()

  function getSelection() {
    return normalizeDeckFormatSelection({
      formatId: state.formatId,
      selectedSetIds: state.selectedSetIds,
      draftPool: state.draftPool,
    })
  }

  function trimDeckToPool(): void {
    const selection = getSelection()
    const allowed = new Set(getFormatCardPool(selection))
    const counts = new Map<CardId, number>()

    state.cardIds = state.cardIds.filter((cardId) => {
      const next = (counts.get(cardId) ?? 0) + 1
      counts.set(cardId, next)
      return allowed.has(cardId) && next <= getCardCopyLimit(cardId, selection)
    })
  }

  function selectDeck(deckId: string): void {
    const deck = state.decks.find((item) => item.id === deckId)
    if (!deck) return
    applyDeckToState(state, deck)
    state.message = ''
    render()
  }

  function createNewDeck(): void {
    const selection = createDefaultFormatSelection()
    state.editingDeckId = crypto.randomUUID()
    state.name = `새 덱 ${state.decks.length + 1}`
    state.cardIds = []
    state.formatId = selection.formatId
    state.selectedSetIds = [...selection.selectedSetIds]
    state.draftPool = null
    state.message = '포맷을 고르고 카드 풀에서 덱을 구성하세요.'
    render()
  }

  function changeFormat(formatId: GameFormatId): void {
    const selection = createDefaultFormatSelection(formatId)
    state.formatId = formatId
    state.selectedSetIds = [...selection.selectedSetIds]
    state.draftPool = null
    state.cardIds = []

    if (getFormat(formatId).deckSource === 'draft') {
      state.draftPool = createDraftPool()
      state.message = '36장의 드래프트 풀이 생성되었습니다.'
    } else {
      state.message = `${getFormat(formatId).name}으로 변경했습니다.`
    }
    render()
  }

  function generateDraft(): void {
    state.draftPool = createDraftPool()
    state.cardIds = []
    state.message = '새 드래프트 풀을 생성했습니다. 이 풀 안에서만 덱을 구성할 수 있습니다.'
    render()
  }

  function addCard(cardId: CardId): void {
    const selection = getSelection()
    const format = getFormat(selection.formatId)
    if (state.cardIds.length >= format.deckSize) {
      state.message = `덱은 ${format.deckSize}장을 넘을 수 없습니다.`
      render()
      return
    }

    const currentCount = state.cardIds.filter((id) => id === cardId).length
    const copyLimit = getCardCopyLimit(cardId, selection)
    const poolCount = selection.draftPool?.cardIds.filter((id) => id === cardId).length
      ?? Number.POSITIVE_INFINITY
    const effectiveLimit = Math.min(copyLimit, poolCount)

    if (currentCount >= effectiveLimit) {
      state.message = `${CARDS[cardId].name}은 이 포맷에서 최대 ${effectiveLimit}장까지 넣을 수 있습니다.`
      render()
      return
    }

    state.cardIds.push(cardId)
    state.message = ''
    render()
  }

  function removeCard(cardId: CardId): void {
    const index = state.cardIds.lastIndexOf(cardId)
    if (index !== -1) state.cardIds.splice(index, 1)
    state.message = ''
    render()
  }

  function saveCurrentDeck(): void {
    const selection = getSelection()
    const validation = validateDeck(state.cardIds, selection)
    if (!validation.valid) {
      state.message = validation.errors.join(' ')
      render()
      return
    }

    const existing = state.decks.find((deck) => deck.id === state.editingDeckId)
    const now = Date.now()
    const deck: SavedDeck = {
      schemaVersion: DECK_SCHEMA_VERSION,
      id: state.editingDeckId,
      name: state.name.trim() || '이름 없는 덱',
      cardIds: [...state.cardIds],
      ...selection,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    }

    try {
      state.decks = upsertDeck(deck).map(cloneDeck)
      setActiveDeckId(deck.id)
      state.message = '저장했고 사용 덱으로 지정했습니다.'
    } catch (error) {
      state.message = error instanceof Error ? error.message : '덱을 저장하지 못했습니다.'
    }
    render()
  }

  function deleteCurrentDeck(): void {
    try {
      state.decks = deleteDeck(state.editingDeckId).map(cloneDeck)
      const nextDeck = state.decks[0]
      if (nextDeck) {
        setActiveDeckId(nextDeck.id)
        applyDeckToState(state, nextDeck)
      }
      state.message = '덱을 삭제했습니다.'
    } catch (error) {
      state.message = error instanceof Error ? error.message : '덱을 삭제하지 못했습니다.'
    }
    render()
  }


  let previewFallbackCardId: CardId | null = null

  function renderCardPreviewContent(cardId: CardId): string {
    const card = CARDS[cardId]
    const attributes = card.attributes.map((attributeId) => CARD_ATTRIBUTES[attributeId].name).join(' · ')
    const cardSet = CARD_SETS[card.setId]
    const mode = state.pinnedPreviewCardId === cardId ? '고정됨' : '미리보기'
    return `<div class="builder-hover-preview__header"><div><span>${mode}</span><strong>카드 상세</strong></div>${state.pinnedPreviewCardId ? '<button type="button" class="builder-hover-preview__close" id="builder-preview-close" aria-label="미리보기 고정 해제">×</button>' : ''}</div>
      <div class="builder-hover-preview__visual">${renderCard(cardId, { interactive: false, classNames: ['builder-hover-preview-card'] })}</div>
      <div class="builder-hover-preview__copy">
        <div class="builder-hover-preview__meta"><span>${escapeHtml(attributes)}</span><span>${card.type === 'unit' ? '몬스터' : '주문'} · 비용 ${card.cost}</span><span>${escapeHtml(cardSet.code)}</span></div>
        <h3>${escapeHtml(card.name)}</h3>
        ${card.type === 'unit' ? `<p class="builder-hover-preview__stats">공격력 ${card.attack} · 체력 ${card.health}</p>` : ''}
        <p class="builder-hover-preview__rules">${escapeHtml(card.rulesText || '능력 없음')}</p>
        <p class="builder-hover-preview__hint">마우스를 올리면 바뀌고, 카드를 클릭하면 고정됩니다. 더블 클릭하거나 ＋를 누르면 덱에 추가됩니다.</p>
      </div>`
  }

  function renderCardPreview(cardId: CardId | null): string {
    return `<section class="panel builder-hover-preview ${cardId ? '' : 'is-empty'}" id="builder-card-preview" aria-live="polite">${cardId ? renderCardPreviewContent(cardId) : '<div class="builder-hover-preview__empty"><strong>카드 상세</strong><p>카드 풀의 카드에 마우스를 올려 확인하세요.</p></div>'}</section>`
  }

  function bindPreviewClose(): void {
    document.querySelector<HTMLButtonElement>('#builder-preview-close')?.addEventListener('click', clearPinnedPreview)
  }

  function updatePreviewPanel(cardId: CardId | null): void {
    const panel = document.querySelector<HTMLElement>('#builder-card-preview')
    if (!panel) return
    panel.classList.toggle('is-empty', cardId === null)
    panel.innerHTML = cardId
      ? renderCardPreviewContent(cardId)
      : '<div class="builder-hover-preview__empty"><strong>카드 상세</strong><p>카드 풀의 카드에 마우스를 올려 확인하세요.</p></div>'
    bindPreviewClose()
  }

  function currentPreviewCardId(): CardId | null {
    return state.pinnedPreviewCardId ?? state.hoverPreviewCardId ?? previewFallbackCardId
  }

  function setHoverPreview(cardId: CardId | null): void {
    state.hoverPreviewCardId = cardId
    updatePreviewPanel(currentPreviewCardId())
  }

  function syncPinnedPreviewState(): void {
    for (const item of document.querySelectorAll<HTMLElement>('.card-pool-item[data-preview-card-id]')) {
      item.classList.toggle('is-preview-pinned', item.dataset.previewCardId === state.pinnedPreviewCardId)
    }
    for (const button of document.querySelectorAll<HTMLButtonElement>('[data-select-card]')) {
      button.setAttribute('aria-pressed', String(button.dataset.selectCard === state.pinnedPreviewCardId))
    }
  }

  function togglePinnedPreview(cardId: CardId): void {
    state.pinnedPreviewCardId = state.pinnedPreviewCardId === cardId ? null : cardId
    state.hoverPreviewCardId = cardId
    syncPinnedPreviewState()
    updatePreviewPanel(currentPreviewCardId())
  }

  function clearPinnedPreview(): void {
    if (!state.pinnedPreviewCardId) return
    state.pinnedPreviewCardId = null
    syncPinnedPreviewState()
    updatePreviewPanel(currentPreviewCardId())
  }

  function renderRulebookBlock(block: ReturnType<typeof createRulebookDocument>['sections'][number]['blocks'][number]): string {
    switch (block.type) {
      case 'paragraph':
        return `<p>${escapeHtml(block.text)}</p>`
      case 'list': {
        const tag = block.ordered ? 'ol' : 'ul'
        return `<${tag}>${block.items.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</${tag}>`
      }
      case 'callout':
        return `<p><strong>${escapeHtml(block.title)}</strong><br>${escapeHtml(block.text)}</p>`
      case 'terms':
        return `<dl class="keyword-list">${block.items.map((item) => `<div><dt>${escapeHtml(item.term)}</dt><dd>${escapeHtml(item.description)}</dd></div>`).join('')}</dl>`
    }
  }

  function renderRulebookModal(): string {
    if (!state.rulebookOpen) return ''
    const format = getFormat(state.formatId)
    const document = createRulebookDocument(format)
    const index = document.sections
      .map((section) => `<button type="button" data-rulebook-target="${escapeHtml(section.id)}">${escapeHtml(section.navLabel)}</button>`)
      .join('')
    const sections = document.sections
      .map((section) => `<section id="${escapeHtml(section.id)}"><h3>${escapeHtml(section.title)}</h3>${section.blocks.map(renderRulebookBlock).join('')}</section>`)
      .join('')

    return `<div class="modal-backdrop rulebook-backdrop" data-modal="builder-rulebook">
      <section class="rulebook-dialog" role="dialog" aria-modal="true" aria-labelledby="builder-rulebook-title">
        <header class="rulebook-dialog__header">
          <div><p class="eyebrow">DUEL SPIRITS</p><h2 id="builder-rulebook-title">${escapeHtml(document.title)}</h2></div>
          <button type="button" data-action="close-builder-rulebook" aria-label="룰북 닫기">닫기</button>
        </header>
        <nav class="rulebook-index" aria-label="룰북 목차">${index}</nav>
        <div class="rulebook-content">${sections}</div>
        <footer class="rulebook-dialog__footer"><span>규칙 ${escapeHtml(document.rulesVersion)} · ${escapeHtml(document.formatName)} · 카드 문구가 일반 규칙보다 우선합니다.</span><button type="button" data-action="close-builder-rulebook">덱 빌더로 돌아가기</button></footer>
      </section>
    </div>`
  }

  function openRulebook(): void {
    state.rulebookOpen = true
    render()
    document.querySelector<HTMLButtonElement>('[data-action="close-builder-rulebook"]')?.focus()
  }

  function closeRulebook(): void {
    if (!state.rulebookOpen) return
    state.rulebookOpen = false
    render()
    document.querySelector<HTMLButtonElement>('#builder-rulebook-button')?.focus()
  }

  function renderDistribution(): string {
    const attributeCounts = getAttributeDistribution(state.cardIds)
    const costCounts = getCostDistribution(state.cardIds)
    const attributeIds: CardAttributeId[] = ['fire', 'water', 'earth', 'dark', 'light']
    const maxCount = Math.max(
      1,
      ...attributeIds.map((attributeId) => attributeCounts[attributeId]),
      ...[0, 1, 2, 3, 4, 5].map((cost) => costCounts[cost] ?? 0),
    )

    const attributeRows = attributeIds.map((attributeId) => {
      const count = attributeCounts[attributeId]
      return `<div class="distribution-row"><span>${escapeHtml(getAttributeLabel(attributeId))}</span><span class="distribution-track"><span style="width:${count / maxCount * 100}%"></span></span><strong>${count}</strong></div>`
    }).join('')

    const costRows = [0, 1, 2, 3, 4, 5].map((cost) => {
      const count = costCounts[cost] ?? 0
      return `<div class="distribution-row"><span>비용 ${cost}</span><span class="distribution-track"><span style="width:${count / maxCount * 100}%"></span></span><strong>${count}</strong></div>`
    }).join('')

    return `<section class="deck-stats"><h3>속성 분포</h3>${attributeRows}<h3>비용 분포</h3>${costRows}<p>평균 비용: <strong>${getAverageCost(state.cardIds).toFixed(2)}</strong></p></section>`
  }

  function render(): void {
    const selection = getSelection()
    const format = getFormat(selection.formatId)
    const counts = getCardCounts(state.cardIds)
    const poolIds = getFormatCardPool(selection)
    const normalizedQuery = state.searchQuery.trim().toLocaleLowerCase('ko-KR')
    const filteredCards = sortCardIdsForBuilder(poolIds).filter((cardId) => {
      const card = CARDS[cardId]
      const matchesQuery = normalizedQuery.length === 0
        || card.name.toLocaleLowerCase('ko-KR').includes(normalizedQuery)
        || card.rulesText.toLocaleLowerCase('ko-KR').includes(normalizedQuery)
      return matchesQuery
        && (state.attributeFilter === 'all' || card.attributes.includes(state.attributeFilter))
        && (state.typeFilter === 'all' || card.type === state.typeFilter)
        && (state.costFilter === 'all' || card.cost === state.costFilter)
    })

    previewFallbackCardId = filteredCards[0] ?? poolIds[0] ?? null

    const poolMarkup = filteredCards.map((cardId) => {
      const count = counts.get(cardId) ?? 0
      const poolCount = selection.draftPool?.cardIds.filter((id) => id === cardId).length
      const copyLimit = Math.min(
        getCardCopyLimit(cardId, selection),
        poolCount ?? Number.POSITIVE_INFINITY,
      )
      const canAdd = copyLimit > 0
        && count < copyLimit
        && state.cardIds.length < format.deckSize
      const copyLabel = Number.isFinite(copyLimit) ? copyLimit : format.maxCopiesPerCard

      return `<article class="card-pool-item ${state.pinnedPreviewCardId === cardId ? 'is-preview-pinned' : ''}" data-preview-card-id="${cardId}">
        <button type="button" class="card-pool-card" data-select-card="${cardId}" aria-pressed="${state.pinnedPreviewCardId === cardId}" aria-label="${escapeHtml(CARDS[cardId].name)} 상세 보기">
          ${renderCard(cardId, { interactive: false, classNames: ['builder-pool-card', 'game-card--center-name'] })}
        </button>
        <div class="card-pool-item__footer">
          <button type="button" class="card-quantity-button" data-remove-card="${cardId}" ${count > 0 ? '' : 'disabled'} aria-label="${escapeHtml(CARDS[cardId].name)} 한 장 빼기">−</button>
          <span class="card-copy-count"><strong>${count}</strong> / ${copyLabel}${poolCount === undefined ? '' : ` · 풀 ${poolCount}`}</span>
          <button type="button" class="card-quantity-button" data-add-card="${cardId}" ${canAdd ? '' : 'disabled'} aria-label="${escapeHtml(CARDS[cardId].name)} 한 장 넣기">＋</button>
        </div>
      </article>`
    }).join('')

    const deckRows = [...counts.entries()].sort(([left], [right]) => {
      const a = CARDS[left]
      const b = CARDS[right]
      return a.cost - b.cost || a.name.localeCompare(b.name)
    }).map(([cardId, count]) => {
      const card = CARDS[cardId]
      const attributeLabel = card.attributes.map((attributeId) => CARD_ATTRIBUTES[attributeId].shortName).join('·')
      const copyLimit = getCardCopyLimit(cardId, selection)
      const canAdd = count < copyLimit && state.cardIds.length < format.deckSize
      return `<li class="deck-list-row" data-preview-card-id="${cardId}">
        <button type="button" class="deck-list-row__card" data-select-card="${cardId}">
          <span class="deck-list-row__cost">${card.cost}</span>
          <span><strong>${escapeHtml(card.name)}</strong><small>${escapeHtml(attributeLabel)} · ${card.type === 'unit' ? '몬스터' : '주문'}</small></span>
        </button>
        <div class="deck-list-row__quantity">
          <button type="button" data-remove-card="${cardId}" aria-label="${escapeHtml(card.name)} 한 장 빼기">−</button>
          <strong>×${count}</strong>
          <button type="button" data-add-card="${cardId}" ${canAdd ? '' : 'disabled'} aria-label="${escapeHtml(card.name)} 한 장 넣기">＋</button>
        </div>
      </li>`
    }).join('')

    const deckOptions = state.decks.map((deck) => `<option value="${escapeHtml(deck.id)}" ${deck.id === state.editingDeckId ? 'selected' : ''}>${escapeHtml(deck.name)} · ${escapeHtml(getFormat(deck.formatId).shortName)}</option>`).join('')
    const validation = validateDeck(state.cardIds, selection)

    const setControls = format.cardPool.type === 'selected-sets'
      ? `<fieldset class="format-set-picker"><legend>사용 세트</legend>${Object.values(CARD_SETS).map((set) => `<label><input type="checkbox" data-set-id="${set.id}" ${state.selectedSetIds.includes(set.id) ? 'checked' : ''}>${escapeHtml(set.name)} <small>${escapeHtml(set.code)}</small></label>`).join('')}</fieldset>`
      : ''

    const restrictionSummary = format.kind === 'restricted'
      ? `<p class="field-help">금지 ${format.bannedCardIds.length}종 · 제한 ${Object.keys(format.restrictedCardLimits).length}종</p>`
      : ''

    const draftControls = format.deckSource === 'draft'
      ? `<div class="draft-pool-summary"><strong>드래프트 풀 ${state.draftPool?.cardIds.length ?? 0}장</strong><span>시드 ${escapeHtml(state.draftPool?.seed ?? '없음')}</span><button id="generate-draft-button" type="button">풀 다시 생성</button></div>`
      : ''

    const previewCardId = currentPreviewCardId()

    appElement.innerHTML = `<main class="app-shell deck-builder-screen">
      <header class="builder-header">
        <div><p class="eyebrow">DUEL SPIRITS · DECK WORKSHOP</p><h1>덱 빌더</h1></div>
        <div class="builder-header__summary"><span>현재 덱</span><strong>${state.cardIds.length} / ${format.deckSize}</strong><button id="builder-rulebook-button" class="button-link" type="button">룰북</button><a class="button-link" href="./">방 화면</a></div>
      </header>
      <section class="panel deck-toolbar">
        <label>저장 덱<select id="deck-select">${deckOptions}</select></label>
        <label>덱 이름<input id="deck-name" value="${escapeHtml(state.name)}" maxlength="40"></label>
        <label>포맷<select id="format-select">${DECK_BUILDER_FORMATS.map((item) => `<option value="${item.id}" ${item.id === state.formatId ? 'selected' : ''}>${escapeHtml(item.name)}</option>`).join('')}</select></label>
        <div class="deck-toolbar__actions"><button id="new-deck-button" type="button">새 덱</button><button id="save-deck-button" type="button" ${validation.valid ? '' : 'disabled'}>저장·사용</button><button id="delete-deck-button" type="button">삭제</button></div>
      </section>
      <section class="panel format-summary"><strong>${escapeHtml(format.name)}</strong><span>${escapeHtml(format.description)}</span>${setControls}${restrictionSummary}${draftControls}</section>
      <section class="deck-builder-layout">
        <aside class="panel deck-filters">
          <div class="section-heading"><h2>찾기</h2><span>${filteredCards.length}종</span></div>
          <label>검색<input id="card-search" type="search" value="${escapeHtml(state.searchQuery)}" placeholder="이름 또는 능력"></label>
          <label>속성<select id="attribute-filter"><option value="all">전체</option>${Object.values(CARD_ATTRIBUTES).map((attribute) => `<option value="${attribute.id}" ${state.attributeFilter === attribute.id ? 'selected' : ''}>${escapeHtml(attribute.name)}</option>`).join('')}</select></label>
          <label>종류<select id="type-filter"><option value="all">전체</option><option value="unit" ${state.typeFilter === 'unit' ? 'selected' : ''}>몬스터</option><option value="spell" ${state.typeFilter === 'spell' ? 'selected' : ''}>주문</option></select></label>
          <label>비용<select id="cost-filter"><option value="all">전체</option>${[0, 1, 2, 3, 4, 5].map((cost) => `<option value="${cost}" ${state.costFilter === cost ? 'selected' : ''}>${cost}</option>`).join('')}</select></label>
          ${renderDistribution()}
        </aside>
        <section class="panel card-pool-panel">
          <header class="section-heading"><div><h2>카드 풀</h2><p>클릭: 상세 고정 · 더블 클릭: 덱에 추가</p></div><span>전 카드 해금</span></header>
          <div class="card-pool-grid">${poolMarkup || '<p class="empty-row">조건에 맞는 카드가 없습니다.</p>'}</div>
        </section>
        <aside class="builder-side-rail">
          ${renderCardPreview(previewCardId)}
          <section class="panel current-deck-panel">
            <header class="section-heading"><div><h2>현재 덱</h2><p>${escapeHtml(getFormat(state.formatId).shortName)}</p></div><strong>${state.cardIds.length}/${format.deckSize}</strong></header>
            <ol class="deck-list">${deckRows || '<li class="empty-row">카드를 추가해 주세요.</li>'}</ol>
            <p class="builder-message" role="status">${escapeHtml(state.message || validation.errors[0] || '덱을 구성하고 저장하세요.')}</p>
          </section>
        </aside>
      </section>
      ${renderRulebookModal()}
    </main>`

    document.querySelector<HTMLButtonElement>('#builder-rulebook-button')?.addEventListener('click', openRulebook)
    for (const control of document.querySelectorAll<HTMLButtonElement>('[data-action="close-builder-rulebook"]')) {
      control.addEventListener('click', closeRulebook)
    }
    document.querySelector<HTMLElement>('[data-modal="builder-rulebook"]')?.addEventListener('click', (event) => {
      if (event.target === event.currentTarget) closeRulebook()
    })
    document.querySelector<HTMLElement>('.rulebook-dialog')?.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') closeRulebook()
    })
    for (const control of document.querySelectorAll<HTMLButtonElement>('[data-rulebook-target]')) {
      control.addEventListener('click', () => {
        const targetId = control.dataset.rulebookTarget
        if (!targetId) return
        document.getElementById(targetId)?.scrollIntoView({ block: 'start' })
      })
    }

    document.querySelector<HTMLSelectElement>('#deck-select')?.addEventListener('change', (event) => selectDeck((event.currentTarget as HTMLSelectElement).value))
    document.querySelector<HTMLInputElement>('#deck-name')?.addEventListener('input', (event) => { state.name = (event.currentTarget as HTMLInputElement).value })
    document.querySelector<HTMLSelectElement>('#format-select')?.addEventListener('change', (event) => changeFormat((event.currentTarget as HTMLSelectElement).value as GameFormatId))
    document.querySelector<HTMLButtonElement>('#new-deck-button')?.addEventListener('click', createNewDeck)
    document.querySelector<HTMLButtonElement>('#save-deck-button')?.addEventListener('click', saveCurrentDeck)
    document.querySelector<HTMLButtonElement>('#delete-deck-button')?.addEventListener('click', deleteCurrentDeck)
    document.querySelector<HTMLButtonElement>('#generate-draft-button')?.addEventListener('click', generateDraft)

    document.querySelector<HTMLInputElement>('#card-search')?.addEventListener('input', (event) => {
      const input = event.currentTarget as HTMLInputElement
      const cursor = input.selectionStart ?? input.value.length
      state.searchQuery = input.value
      render()
      const nextInput = document.querySelector<HTMLInputElement>('#card-search')
      nextInput?.focus()
      nextInput?.setSelectionRange(cursor, cursor)
    })
    document.querySelector<HTMLSelectElement>('#attribute-filter')?.addEventListener('change', (event) => { const value = (event.currentTarget as HTMLSelectElement).value; state.attributeFilter = value === 'all' ? 'all' : value as CardAttributeId; render() })
    document.querySelector<HTMLSelectElement>('#type-filter')?.addEventListener('change', (event) => { const value = (event.currentTarget as HTMLSelectElement).value; state.typeFilter = value === 'unit' || value === 'spell' ? value : 'all'; render() })
    document.querySelector<HTMLSelectElement>('#cost-filter')?.addEventListener('change', (event) => { const value = (event.currentTarget as HTMLSelectElement).value; state.costFilter = value === 'all' ? 'all' : Number(value); render() })

    bindPreviewClose()

    for (const element of document.querySelectorAll<HTMLElement>('[data-preview-card-id]')) {
      const cardId = element.dataset.previewCardId as CardId | undefined
      if (!cardId) continue
      element.addEventListener('pointerenter', () => setHoverPreview(cardId))
      element.addEventListener('pointerleave', () => setHoverPreview(null))
      element.addEventListener('focusin', () => setHoverPreview(cardId))
      element.addEventListener('focusout', (event) => {
        if (!element.contains(event.relatedTarget as Node | null)) setHoverPreview(null)
      })
    }

    for (const button of document.querySelectorAll<HTMLButtonElement>('[data-select-card]')) {
      const cardId = button.dataset.selectCard as CardId | undefined
      if (!cardId) continue
      button.addEventListener('click', () => togglePinnedPreview(cardId))
      button.addEventListener('dblclick', (event) => {
        event.preventDefault()
        addCard(cardId)
      })
    }

    for (const input of document.querySelectorAll<HTMLInputElement>('[data-set-id]')) {
      input.addEventListener('change', () => {
        const setId = input.dataset.setId as SetId
        state.selectedSetIds = input.checked
          ? [...new Set([...state.selectedSetIds, setId])]
          : state.selectedSetIds.filter((id) => id !== setId)
        if (state.selectedSetIds.length === 0) state.selectedSetIds = [setId]
        trimDeckToPool()
        render()
      })
    }
    for (const button of document.querySelectorAll<HTMLButtonElement>('[data-add-card]')) button.addEventListener('click', () => { const id = button.dataset.addCard as CardId | undefined; if (id) addCard(id) })
    for (const button of document.querySelectorAll<HTMLButtonElement>('[data-remove-card]')) button.addEventListener('click', () => { const id = button.dataset.removeCard as CardId | undefined; if (id) removeCard(id) })
  }


  render()
}
