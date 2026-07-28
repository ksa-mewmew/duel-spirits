module.exports = {
  packagerConfig: {
    name: 'Duel Spirits',
    executableName: 'DuelSpirits',
    asar: true,
    ignore: [
      /^\/src/,
      /^\/worker/,
      /^\/scripts/,
      /^\/\.github/,
      /^\/\.wrangler/,
      /^\/\.git/,
      /^\/node_modules/,
      /^\/out/,
      /^\/public/,
      /^\/tsconfig/,
      /^\/vite\.config/,
    ],
  },
  rebuildConfig: {},
  makers: [
    {
      name: '@electron-forge/maker-squirrel',
      config: {
        name: 'DuelSpirits',
        authors: 'Duel Spirits',
        description: '친구와 즐기는 1대1 전략 카드 게임',
      },
    },
  ],
}
