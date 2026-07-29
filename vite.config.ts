import { defineConfig, loadEnv } from 'vite'
import { configDefaults } from 'vitest/config'
import packageJson from './package.json'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '')
  const configuredBase = env.VITE_BASE_PATH?.trim()

  return {
    base: configuredBase || './',
    define: {
      __APP_VERSION__: JSON.stringify(packageJson.version),
    },
    test: {
      exclude: [...configDefaults.exclude, '.sim-build/**'],
    },
  }
})
