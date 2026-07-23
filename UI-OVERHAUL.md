# 16:9 UI Overhaul

## What changed

- All main surfaces now render inside a fixed 16:9 stage that scales to the browser without changing the internal composition.
- The first screen is now action-led: active deck, create room, join room, and deck builder are separated instead of displaying every form at once.
- Room creation and invite joining open inside the command panel. Advanced room settings remain collapsed until needed.
- The waiting room now presents two opposing seats, visible connection/readiness states, a prominent invite action, and one compact deck control row.
- The deck builder is a fixed workstation: persistent header controls, fixed filters, independently scrolling card pool and deck list, and a persistent card preview.
- Sample decks were moved into a compact collapsible picker.
- Combat uses horizontal life slots, a slimmer turn line, enlarged battlefield cards, an overlay card inspector, a compact decision dock, and compressed mana tiles.
- Mana layout adapts without adding combat-screen scrolling: 1–8 cards use two columns, 9–12 use three, and 13+ use four.

## Key implementation files

- `src/ui-overhaul.css`: final visual/layout layer imported after the existing styles.
- `src/client/lobby.ts`: action-led main screen.
- `src/client/deck-builder.ts`: fixed workstation markup.
- `src/client/game.ts`: waiting-room presentation and adaptive mana metadata.
- `src/client/main.ts`: imports the overhaul stylesheet and applies surface body classes.

## Resolution target

- Primary: 1920×1080
- Minimum desktop target: 1280×720
- Other aspect ratios are letterboxed by scaling the 16:9 stage.

## Follow-up: hand ratio and mana-origin abilities

- Hand cards are now always rendered at the original 5:7 ratio. Large hands reduce card height rather than compressing card width.
- The mana rail remains a compact overview, but every mana-origin activated ability receives an always-visible action row.
- `너무 무거운 씨앗` shows its live requirement (`땅 마나 n/4`, open-slot state, or `발동 가능`) and can be activated without hovering over a tiny card.
- Opening a card from hand automatically opens the expanded mana tray for cost/effect selection.
- The expanded tray shows full 5:7 mana cards, separates ready and exhausted cards, and exposes action buttons persistently. Only this tray scrolls when the mana count is unusually high.
