# Duel Spirits rules audit — 2026-07-21

## Scope

This audit treats `src/shared/rules.ts`, `src/shared/types.ts`, the public-view filtering in `src/shared/views.ts`, the active format definitions, and the current card data as the source of truth. The in-game rulebook is generated from `src/content/rulebook.ts` and receives the selected format at render time.

## Current life and defeat rule

- A player does not lose when their final life card is moved away.
- A direct attack that begins while the defending player has one or more life cards removes only as many life cards as actually remain, even when the attack requests additional life loss.
- Those removed life cards enter the owner's hand in the chosen order and resolve Awakening normally.
- A player loses only when a later direct attack begins while that player has zero life cards.
- Because no life card is removed by that finishing attack, it cannot create an Awakening.

This matches the intended Duel Masters-style shield rule: removing the final shield and delivering the finishing direct attack are separate attacks.

## Timing corrections in rules version 2026.07.4

1. Temporary attack and health modifiers, temporary Rush, and the temporary additional-life-loss state now expire at the end of the current turn, before the next player's turn begins.
2. Units that become lethal when a temporary health increase expires are moved to the discard at that end-of-turn timing, and Last Words resolve normally.
3. Either player may surrender while the game is active, regardless of whose turn it is or whether a choice is pending.
4. Excess requested life loss no longer causes victory or clears queued Awakening choices.

## What the replacement rulebook specifies

- Dynamic deck, starting-life, starting-hand, starting-deck, field-slot, copy-limit, and restricted-card values for the selected format.
- Hidden-information boundaries for deck, hand, life, public zones, and private top-deck choices.
- The first-turn draw exception and the exact order of later turn starts and turn-end expiration.
- Exact mana payment, multi-attribute mana, resonance, all-mana conditions, effect summons, and arrival timing.
- Discard recycling when drawing from an empty deck, including the absence of deck-out loss.
- Summoning sickness, Charge/Rush/Windfury/Flying/Stealth restrictions, the global Apostle Pigeon attack cap, persistent damage, healing, and death processing.
- Life selection by the attacker, sequential life movement, immediate versus queued Awakening, Prophet suppression, hidden life insertion, and the zero-life finishing attack.
- Global simultaneous-damage death ordering by battlefield entry sequence.

## Follow-up risks not changed in this pass

- `FIELD_LIMIT` is still a client constant while the server rules read `format.fieldSlots`. All current formats use four slots, but a future non-four-slot format would require the client to become format-driven.
- The server-side `grave_digging` resolution validates its discard return target after sacrificing mana. The current UI cannot select the newly sacrificed mana as the return target, but a handcrafted action could potentially do so.
- Damage deaths use global battlefield-entry order. Effects that directly move units to the discard process them through their own loop order, so there is not yet one universal simultaneous-removal queue.
- Ownership/controller metadata is not preserved consistently by every bounce or mana-conversion path. Current cards do not transfer control, so this has no visible effect yet.
