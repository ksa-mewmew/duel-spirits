import { defineConfig, loadEnv } from 'vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '')
  const configuredBase = env.VITE_BASE_PATH?.trim()

  return {
    base: configuredBase || '/',
  }
})
