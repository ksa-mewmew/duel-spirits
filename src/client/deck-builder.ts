import { CARD_ATTRIBUTES, CARDS } from '../shared/cards'
import { DECK_BUILDER_FORMATS, getFormat } from '../content/formats'
import { CARD_SETS } from '../content/sets'
import {
  DECK_SCHEMA_VERSION,
  createDefaultFormatSelection,
  createDraftPool,
  getAverageCost,
  getCardCopyLimit,
  getCardCounts,
  getCostDistribution,
  getFormatCardPool,
  getAttributeDistribution,
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
  attributeFilter: CardAttributeId | 'all'
  costFilter: number | 'all'
  message: string
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
    attributeFilter: 'all',
    costFilter: 'all',
    message: '',
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
      state.message = '24장의 드래프트 풀이 생성되었습니다.'
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

  function openCardPreview(cardId: CardId): void {
    document.querySelector<HTMLElement>('[data-builder-card-preview]')?.remove()

    const card = CARDS[cardId]
    const attributes = card.attributes
      .map((attributeId) => CARD_ATTRIBUTES[attributeId].name)
      .join(' · ')
    const preview = document.createElement('div')
    preview.className = 'builder-card-preview-backdrop'
    preview.dataset.builderCardPreview = ''
    preview.innerHTML = `<section class="builder-card-preview-dialog" role="dialog" aria-modal="true" aria-labelledby="builder-card-preview-title">
      <button type="button" class="builder-card-preview-close" data-close-builder-card-preview aria-label="카드 상세 닫기">×</button>
      <div class="builder-card-preview-visual">
        ${renderCard(cardId, { interactive: false, classNames: ['builder-card-preview-card'] })}
      </div>
      <div class="builder-card-preview-copy">
        <p class="builder-card-preview-meta">속성: ${escapeHtml(attributes)} · 카드군: ${escapeHtml(card.families.join(' · ') || '없음')} · ${card.type === 'unit' ? '몬스터' : '주문'} · 비용 ${card.cost}</p>
        <h2 id="builder-card-preview-title">${escapeHtml(card.name)}</h2>
        ${card.type === 'unit' ? `<p class="builder-card-preview-stats">공격력 ${card.attack} · 체력 ${card.health}</p>` : ''}
        <p class="builder-card-preview-rules">${escapeHtml(card.rulesText)}</p>
        <p class="builder-card-preview-hint">바깥 영역이나 Esc를 눌러 닫습니다.</p>
      </div>
    </section>`

    const close = (): void => {
      preview.remove()
      document.removeEventListener('keydown', onKeyDown)
    }
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') close()
    }

    preview.addEventListener('click', (event) => {
      if (event.target === preview) close()
    })
    preview.querySelector<HTMLButtonElement>('[data-close-builder-card-preview]')
      ?.addEventListener('click', close)
    document.addEventListener('keydown', onKeyDown)
    document.body.append(preview)
    preview.querySelector<HTMLButtonElement>('[data-close-builder-card-preview]')?.focus()
  }

  function renderDistribution(): string {
    const attributeCounts = getAttributeDistribution(state.cardIds)
    const costCounts = getCostDistribution(state.cardIds)
    const maxCount = Math.max(1, ...Object.values(attributeCounts), ...Object.values(costCounts))

    const attributeRows = Object.entries(CARD_ATTRIBUTES).map(([attributeId, group]) => {
      const count = attributeCounts[attributeId as CardAttributeId]
      return `<div class="distribution-row"><span>${escapeHtml(group.name)}</span><span class="distribution-track"><span style="width:${count / maxCount * 100}%"></span></span><strong>${count}</strong></div>`
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
    const filteredCards = sortCardIdsForBuilder(poolIds).filter((cardId) => {
      const card = CARDS[cardId]
      return (state.attributeFilter === 'all' || card.attributes.includes(state.attributeFilter))
        && (state.costFilter === 'all' || card.cost === state.costFilter)
    })

    const poolMarkup = filteredCards.map((cardId) => {
      const count = counts.get(cardId) ?? 0
      const poolCount = selection.draftPool?.cardIds.filter((id) => id === cardId).length
      const copyLimit = Math.min(
        getCardCopyLimit(cardId, selection),
        poolCount ?? Number.POSITIVE_INFINITY,
      )
      const disabled = copyLimit === 0
        || count >= copyLimit
        || state.cardIds.length >= format.deckSize

      return `<article class="card-pool-item">
        <button type="button" class="card-pool-add" data-add-card="${cardId}" ${disabled ? 'disabled' : ''} aria-label="${escapeHtml(CARDS[cardId].name)} 덱에 추가">
          ${renderCard(cardId, { compact: true, interactive: false })}
        </button>
        <div class="card-pool-item__footer">
          <span class="card-copy-count">덱 ${count}/${Number.isFinite(copyLimit) ? copyLimit : format.maxCopiesPerCard}${poolCount === undefined ? '' : ` · 풀 ${poolCount}`}</span>
          <button type="button" class="card-preview-button" data-preview-card="${cardId}" aria-label="${escapeHtml(CARDS[cardId].name)} 크게 보기">크게 보기</button>
        </div>
      </article>`
    }).join('')

    const deckRows = [...counts.entries()].sort(([left], [right]) => {
      const a = CARDS[left]
      const b = CARDS[right]
      return a.cost - b.cost || a.name.localeCompare(b.name)
    }).map(([cardId, count]) => `<li class="deck-list-row"><span><strong>${escapeHtml(CARDS[cardId].name)}</strong><small>${escapeHtml(CARD_SETS[CARDS[cardId].setId].code)} · 비용 ${CARDS[cardId].cost}</small></span><span>×${count}</span><button type="button" data-remove-card="${cardId}">−</button></li>`).join('')

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

    appElement.innerHTML = `<main class="app-shell deck-builder-screen">
      <header class="builder-header"><div><p class="eyebrow">DUEL SPIRITS · DECK WORKSHOP</p><h1>덱 빌더</h1></div><nav class="builder-nav"><a class="button-link" href="./">방 화면</a></nav></header>
      <section class="panel deck-toolbar">
        <label>저장 덱<select id="deck-select">${deckOptions}</select></label>
        <label>덱 이름<input id="deck-name" value="${escapeHtml(state.name)}" maxlength="40"></label>
        <label>포맷<select id="format-select">${DECK_BUILDER_FORMATS.map((item) => `<option value="${item.id}" ${item.id === state.formatId ? 'selected' : ''}>${escapeHtml(item.name)}</option>`).join('')}</select></label>
        <button id="new-deck-button" type="button">새 덱</button>
        <button id="save-deck-button" type="button" ${validation.valid ? '' : 'disabled'}>저장·사용</button>
        <button id="delete-deck-button" type="button">삭제</button>
      </section>
      <section class="panel format-summary"><strong>${escapeHtml(format.name)}</strong><span>${escapeHtml(format.description)}</span>${setControls}${restrictionSummary}${draftControls}</section>
      <section class="deck-builder-layout">
        <aside class="panel deck-filters"><h2>필터</h2><label>속성<select id="attribute-filter"><option value="all">전체</option>${Object.values(CARD_ATTRIBUTES).map((group) => `<option value="${group.id}" ${state.attributeFilter === group.id ? 'selected' : ''}>${escapeHtml(group.name)}</option>`).join('')}</select></label><label>비용<select id="cost-filter"><option value="all">전체</option>${[0, 1, 2, 3, 4, 5].map((cost) => `<option value="${cost}" ${state.costFilter === cost ? 'selected' : ''}>${cost}</option>`).join('')}</select></label>${renderDistribution()}</aside>
        <section class="panel card-pool-panel"><header class="section-heading"><h2>카드 풀</h2><span>${filteredCards.length}종 · 전 카드 해금</span></header><div class="card-pool-grid">${poolMarkup || '<p>이 포맷에서 표시할 카드가 없습니다.</p>'}</div></section>
        <aside class="panel current-deck-panel"><header class="section-heading"><h2>현재 덱</h2><strong>${state.cardIds.length}/${format.deckSize}</strong></header><ol class="deck-list">${deckRows || '<li class="empty-row">카드를 추가해 주세요.</li>'}</ol><p class="builder-message" role="status">${escapeHtml(state.message || validation.errors[0] || '덱을 구성하고 저장하세요.')}</p></aside>
      </section>
    </main>`

    document.querySelector<HTMLSelectElement>('#deck-select')?.addEventListener('change', (event) => selectDeck((event.currentTarget as HTMLSelectElement).value))
    document.querySelector<HTMLInputElement>('#deck-name')?.addEventListener('input', (event) => { state.name = (event.currentTarget as HTMLInputElement).value })
    document.querySelector<HTMLSelectElement>('#format-select')?.addEventListener('change', (event) => changeFormat((event.currentTarget as HTMLSelectElement).value as GameFormatId))
    document.querySelector<HTMLButtonElement>('#new-deck-button')?.addEventListener('click', createNewDeck)
    document.querySelector<HTMLButtonElement>('#save-deck-button')?.addEventListener('click', saveCurrentDeck)
    document.querySelector<HTMLButtonElement>('#delete-deck-button')?.addEventListener('click', deleteCurrentDeck)
    document.querySelector<HTMLButtonElement>('#generate-draft-button')?.addEventListener('click', generateDraft)
    document.querySelector<HTMLSelectElement>('#attribute-filter')?.addEventListener('change', (event) => { const value = (event.currentTarget as HTMLSelectElement).value; state.attributeFilter = value === 'all' ? 'all' : value as CardAttributeId; render() })
    document.querySelector<HTMLSelectElement>('#cost-filter')?.addEventListener('change', (event) => { const value = (event.currentTarget as HTMLSelectElement).value; state.costFilter = value === 'all' ? 'all' : Number(value); render() })

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
    for (const button of document.querySelectorAll<HTMLButtonElement>('[data-preview-card]')) button.addEventListener('click', () => { const id = button.dataset.previewCard as CardId | undefined; if (id) openCardPreview(id) })
    for (const button of document.querySelectorAll<HTMLButtonElement>('[data-add-card]')) button.addEventListener('click', () => { const id = button.dataset.addCard as CardId | undefined; if (id) addCard(id) })
    for (const button of document.querySelectorAll<HTMLButtonElement>('[data-remove-card]')) button.addEventListener('click', () => { const id = button.dataset.removeCard as CardId | undefined; if (id) removeCard(id) })
  }

  render()
}
