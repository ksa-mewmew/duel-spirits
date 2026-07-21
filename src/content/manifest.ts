import { CARDS } from './cards'
import { GAME_FORMATS } from './formats'
import { CARD_SETS, CONTENT_VERSION, RULES_VERSION } from './sets'
import { CAMPAIGN_SCENARIOS } from './scenarios'

export const CONTENT_MANIFEST = {
  contentVersion: CONTENT_VERSION,
  rulesVersion: RULES_VERSION,
  sets: CARD_SETS,
  cards: CARDS,
  formats: GAME_FORMATS,
  scenarios: CAMPAIGN_SCENARIOS,
} as const
