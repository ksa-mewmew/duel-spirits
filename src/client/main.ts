import '../style.css'
import '../room-ui.css'
import '../deck-builder.css'
import '../game-board.css'
import '../ui-overhaul.css'

import { renderDeckBuilder } from './deck-builder'
import { renderLobby } from './lobby'
import { initializeFixedStageScaling } from './stage-scale'
import { renderPatchNotes, renderRulebookPage, renderSupportPage } from './info-pages'

const appElement =
  document.querySelector<HTMLDivElement>('#app')

if (!appElement) {
  throw new Error('App element was not found.')
}

initializeFixedStageScaling()

const url = new URL(window.location.href)
const roomId = url.searchParams.get('room')
const roomKey = url.searchParams.get('key')
const isTutorial = url.searchParams.get('tutorial') === '1'
const isAiMatch = url.searchParams.get('ai') === '1'

if ((roomId && roomKey) || isTutorial || isAiMatch) {
  void import('./game')
} else {
  const renderSurface = (): void => {
    const isDeckBuilder = window.location.hash === '#decks'
    const isRulebook = window.location.hash === '#rulebook'
    const isPatchNotes = window.location.hash === '#patch-notes'
    const isSupport = window.location.hash === '#support'
    document.body.classList.toggle('deck-builder-active', isDeckBuilder)
    document.body.classList.toggle('lobby-active', !isDeckBuilder && !isRulebook && !isPatchNotes && !isSupport)
    if (isDeckBuilder) {
      renderDeckBuilder(appElement)
    } else if (isRulebook) {
      renderRulebookPage(appElement)
    } else if (isPatchNotes) {
      renderPatchNotes(appElement)
    } else if (isSupport) {
      renderSupportPage(appElement)
    } else {
      renderLobby(appElement)
    }
  }

  window.addEventListener('hashchange', renderSurface)
  renderSurface()
}
