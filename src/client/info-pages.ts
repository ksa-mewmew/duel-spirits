import { DEFAULT_FORMAT_ID, getFormat } from '../content/formats'
import { PATCH_NOTES } from '../content/patch-notes'
import { createRulebookDocument } from '../content/rulebook'
import { getAppVersion } from '../shared/version'

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

function pageShell(title: string, body: string): string {
  return `<main class="app-shell info-screen">
    <header class="info-header"><a class="button-link" href="./">← 로비</a><div><p class="eyebrow">DUEL SPIRITS v${escapeHtml(getAppVersion())}</p><h1>${escapeHtml(title)}</h1></div></header>
    <section class="panel info-content">${body}</section>
  </main>`
}

export function renderPatchNotes(appElement: HTMLDivElement): void {
  const notes = PATCH_NOTES.map((note) => `<article class="patch-note">
    <header><div><strong>v${escapeHtml(note.version)}</strong><time>${escapeHtml(note.date)}</time></div><h2>${escapeHtml(note.title)}</h2></header>
    <ul>${note.changes.map((change) => `<li>${escapeHtml(change)}</li>`).join('')}</ul>
  </article>`).join('')
  appElement.innerHTML = pageShell('패치 노트', notes)
}

export function renderRulebookPage(appElement: HTMLDivElement): void {
  const document = createRulebookDocument(getFormat(DEFAULT_FORMAT_ID))
  const index = document.sections
    .map((section) => `<a href="#${escapeHtml(section.id)}">${escapeHtml(section.navLabel)}</a>`)
    .join('')
  const sections = document.sections.map((section) => `<section id="${escapeHtml(section.id)}">
    <h3>${escapeHtml(section.title)}</h3>
    ${section.blocks.map((block) => {
      if (block.type === 'paragraph') return `<p>${escapeHtml(block.text)}</p>`
      if (block.type === 'callout') return `<p><strong>${escapeHtml(block.title)}</strong><br>${escapeHtml(block.text)}</p>`
      if (block.type === 'terms') return `<dl class="keyword-list">${block.items.map((item) => `<div><dt>${escapeHtml(item.term)}</dt><dd>${escapeHtml(item.description)}</dd></div>`).join('')}</dl>`
      const tag = block.ordered ? 'ol' : 'ul'
      return `<${tag}>${block.items.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</${tag}>`
    }).join('')}
  </section>`).join('')
  appElement.innerHTML = `<div class="modal-backdrop rulebook-backdrop rulebook-backdrop--page">
    <section class="rulebook-dialog" role="dialog" aria-labelledby="rulebook-page-title">
      <header class="rulebook-dialog__header">
        <div><p class="eyebrow">DUEL SPIRITS</p><h2 id="rulebook-page-title">${escapeHtml(document.title)}</h2></div>
        <a class="button-link" href="./" aria-label="룰북 닫기">닫기</a>
      </header>
      <nav class="rulebook-index" aria-label="룰북 목차">${index}</nav>
      <div class="rulebook-content">${sections}</div>
      <footer class="rulebook-dialog__footer"><span>규칙 ${escapeHtml(document.rulesVersion)} · ${escapeHtml(document.formatName)} · 카드 문구가 일반 규칙보다 우선합니다.</span><a class="button-link" href="./">로비로 돌아가기</a></footer>
    </section>
  </div>`
}

export function renderSupportPage(appElement: HTMLDivElement): void {
  appElement.innerHTML = pageShell('버그 신고', `
    <article class="support-card">
      <h2>문제를 재현할 수 있게 알려주세요</h2>
      <p>게임 버전, 사용한 덱 코드, 어떤 행동을 했는지, 기대한 결과와 실제 결과를 적어주시면 가장 빠르게 확인할 수 있습니다.</p>
      <a class="button-link is-primary" href="https://github.com/ksa-mewmew/duel-spirits/issues/new" target="_blank" rel="noreferrer">GitHub에서 버그 신고</a>
    </article>`)
}
