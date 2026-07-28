import '../style.css'
import '../room-ui.css'
import '../deck-builder.css'
import '../game-board.css'
import '../ui-overhaul.css'

import { renderDeckBuilder } from './deck-builder'
import { renderLobby } from './lobby'
import { initializeFixedStageScaling } from './stage-scale'

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

if ((roomId && roomKey) || isTutorial) {
  void import('./game')
} else {
  const renderSurface = (): void => {
    const isDeckBuilder = window.location.hash === '#decks'
    document.body.classList.toggle('deck-builder-active', isDeckBuilder)
    document.body.classList.toggle('lobby-active', !isDeckBuilder)
    if (isDeckBuilder) {
      renderDeckBuilder(appElement)
    } else {
      renderLobby(appElement)
    }
  }

  window.addEventListener('hashchange', renderSurface)
  renderSurface()
}
