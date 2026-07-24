# Lobby create-panel scroll fix

The create-room form could be clipped before its advanced settings because:

1. `.lobby-actions { display: grid }` overrode the menu's HTML `hidden` state, so the three command buttons remained in the layout after entering create mode.
2. The fixed 16:9 stage and `.lobby-command` used hidden overflow without constraining the command panel to its grid row.
3. The advanced-settings body reused `.lobby-mode-panel`, creating an unnecessary nested scroll/flex panel.

Changes:

- Explicitly hide `.lobby-actions[hidden]`.
- Stretch and constrain `.lobby-command` to its available row.
- Keep the active create/join panel as the single vertical scroll container.
- Give the scrollbar a visible thin treatment and reserve its gutter.
- Keep Back/Create controls sticky at the bottom of the scrolling panel.
- Replace the nested advanced-settings panel class with `.lobby-advanced-fields`.
