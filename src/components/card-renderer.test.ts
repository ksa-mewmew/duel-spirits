import { describe, expect, it } from 'vitest'

import { CARDS } from '../shared/cards'
import { renderCard } from './card-renderer'

describe('renderCard', () => {
  it('keeps unit rules text out of the card body while showing core stats', () => {
    const card = CARDS.seeding_fairy
    const markup = renderCard(card.id)

    expect(markup).toContain(card.name)
    expect(markup).toContain('game-card__cost')
    expect(markup).toContain('game-card__attribute')
    expect(markup).toContain('game-card__attack')
    expect(markup).toContain('game-card__health')
    expect(markup).not.toContain(card.rulesText)
    expect(markup).not.toContain('game-card__text')
    expect(markup).toContain('game-card--center-name')
  })

  it('shows a spell type marker without putting rules text on the card', () => {
    const card = CARDS.demon_breath
    const markup = renderCard(card.id)

    expect(markup).toContain(card.name)
    expect(markup).toContain('game-card__spell-type')
    expect(markup).toContain('주문')
    expect(markup).not.toContain(card.rulesText)
  })

  it('keeps only the in-game detail layout out of the centered-name default', () => {
    const markup = renderCard('seeding_fairy', { detailLayout: true })

    expect(markup).toContain('game-card--detail-layout')
    expect(markup).not.toContain('game-card--center-name')
  })
})
