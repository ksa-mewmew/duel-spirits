# Life defeat and turn-timing correction — 2026-07-21

- Changed defeat to occur only when a player with zero life is directly attacked.
- An attack that requests more life loss than remains now removes only the remaining life and resolves its Awakening without ending the game.
- Moved all “this turn” temporary attack, health, Rush, and extra-life-loss cleanup to the end of the current turn.
- Added lethal-state cleanup when temporary health expires.
- Allowed either player to surrender at any time while the game is active, including while a choice is pending.
- Updated the in-game rulebook and raised `RULES_VERSION` to `2026.07.4`.
- Added regression tests for all four corrections.

# Rules audit and rulebook replacement — 2026-07-21

- Replaced the embedded short rule summary with a structured, format-aware comprehensive rulebook.
- Added exact current-engine rulings for hidden life, turn start, mana payment, resonance, effect summons, deck recycling, combat, persistent damage, death ordering, Awakening queues, and the current life-based victory condition.
- Added rulebook regression tests and raised `RULES_VERSION` to `2026.07.3`.
- Added `RULES-AUDIT.md` for implementation quirks and follow-up risks that were documented but not silently changed.

# Duel Spirits — attribute, slot, and rules update

## Content source

- All 40 current cards are in `foundations-001`.
- Card names, attributes, types, costs, stats, and ability text were synchronized with the supplied card manuscript.
- A source-lock regression test (`src/content/cards.test.ts`) now checks all 40 cards.
- Attribute (`attributes`) and future card-family (`families`) data are separate.

## Game rules

- The first player is randomly selected for every match.
- Battlefield positions are fixed as slots 1–4.
- Normal summons, Heavy Seed, Awakening summons, Surging Wave, and Burning Procession select an open slot.
- Persisted legacy rooms receive slot indices during migration.
- Last Ember uses the revised 2/1 stats, gains Charge and +2 attack while isolated, and draws on Last Words.

## Interface

- Multi-attribute cards use a distinct prismatic color treatment.
- Hand and mana cards show only their names; hover, focus, or click opens the full card inspector.
- Life cards are displayed sideways, with the life count kept above the stack.
- Each battlefield card retains and displays its numbered original slot.
- Exhausted and newly summoned states use faded, slightly tilted artwork while text and stat coordinates remain fixed.
- The rulebook now covers hidden information, fixed slots, random first player, attribute/family separation, timing, combat, Awakening, and all current keywords.

## UI follow-up — hand proportions and mana abilities

- Hand cards now preserve the 5:7 card ratio at every density. Large hands shrink uniformly instead of becoming short, wide tiles.
- The mana rail now includes an always-visible ability row for cards that can activate from mana.
- `너무 무거운 씨앗` displays its current requirement and a direct `마나에서 소환` button.
- Playing a card automatically opens a full mana tray for cost and effect selection.
- The full mana tray separates ready/exhausted mana, uses full 5:7 cards, and only introduces internal scrolling at unusually high mana counts.

## UI usability correction — readable deck, room, and combat surfaces

- Restored a permanently visible `견본 덱` quick-start panel at the top of the deck-builder filter rail.
- Reduced the card-pool grid from five columns to four at 1280×720 and expanded the right rail to reserve readable card-detail and current-deck space.
- Increased deck-detail, deck-list, waiting-room deck selector, player HUD, turn ribbon, and action-button typography.
- Replaced the combat card inspector overlay with a permanent dedicated right-hand column so it never covers mana.
- Tightened field-card spacing aggressively while retaining four fixed battlefield slots.
- Rebuilt the card-use selection panel as a compact horizontal step bar with non-shrinking buttons and no inherited overflow scrollbar.
- Removed the upward translation from selected cards in the expanded mana tray.
