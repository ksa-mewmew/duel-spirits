# Card Group 1 overhaul — 2026-07-23

This revision synchronizes the complete 40-card `foundations-001` set with the supplied Card Group 1 manuscript and replaces the affected rules, card-state tracking, choice flows, UI indicators, sample-deck guidance, and regression coverage.

## New keyword

- **Assassination (`암살`)**: after a monster battles another monster, the opposing combatant is sent to its owner's discard pile. This is resolved separately from combat damage, so the effect still applies when the assassin is destroyed during that battle. If both combatants have Assassination and survive combat damage, both are sent to discard.

## Major mechanical revisions

- **Volcano Mouse** now has Charge and gains +1 attack while its controller has at least two Fire cards in mana.
- **Living Smoke** gains +2 attack only while resolving monster combat; its normal displayed attack remains 0.
- **Ripple Spirit** draws one card on Arrival.
- **Surging Wave** checks the top two cards, may summon one Water monster costing 2 or less without resolving Arrival, and places the remainder on the bottom of the deck in the chosen order.
- **Tree Fairy** draws only when it enters mana from somewhere other than its controller's hand.
- **Nameless Shadow** dynamically gains Assassination while its controller has at least three cards in discard.
- **Carrion Crow** has Stealth and gains Flying while isolated.
- **Blue-Black Hound** may attack ready monsters but cannot attack a player directly.
- **Coffin Warrior** costs 0 for the rest of a turn once at least two Dark cards owned by its controller have been sent to discard that turn. The counter resets at turn end.

## State and compatibility

- Player state now tracks `darkCardsDiscardedThisTurn`.
- Legacy persisted rooms are normalized with a default value of 0.
- The public player view exposes the counter so hand costs, card inspectors, and action controls update immediately.

## Interface updates

- Dynamic card cost rendering now reflects Coffin Warrior's current cost instead of its printed cost.
- Field badges and inspectors expose current conditional states such as Assassination, Fire-mana attack gain, isolated Flying, and Living Smoke's combat-only attack bonus.
- Surging Wave uses an explicit card-and-slot choice interface and explains that the summoned monster's Arrival does not resolve.
- The Dark sample deck guide now describes graveyard chaining, Assassination, Coffin Warrior's free-play condition, and Blue-Black Hound's direct-attack restriction.

## Validation performed

- All 40 card names, attributes, types, costs, attack values, health values, and supplied rules text were checked against a source-lock script.
- Client/shared/content TypeScript sources passed strict no-emit compilation with local dependency declarations.
- Revised mechanics passed focused runtime checks covering dynamic attack, combat-only attack, effect-source mana placement, no-Arrival summons, Assassination, direct-attack restrictions, Coffin Warrior's free-play condition, and end-turn reset behavior.
- Full package-based Vitest/Vite execution was not available in the isolated environment because project dependencies could not be installed there.
