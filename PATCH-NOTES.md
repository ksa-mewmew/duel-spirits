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
