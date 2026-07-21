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
