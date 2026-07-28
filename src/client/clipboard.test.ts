import { describe, expect, test, vi } from 'vitest'
import { createClipboardAdapter } from './clipboard'

describe('clipboard adapter', () => {
  test('prefers the Electron preload API', async () => {
    const writeText = vi.fn(async () => {})
    const readText = vi.fn(async () => 'desktop')
    const target = {
      duelDesktop: { clipboard: { writeText, readText } },
      navigator: { clipboard: { writeText: vi.fn(), readText: vi.fn() } },
    } as unknown as Window
    const adapter = createClipboardAdapter(target)
    await adapter.writeText('value')
    expect(writeText).toHaveBeenCalledWith('value')
    await expect(adapter.readText()).resolves.toBe('desktop')
  })

  test('falls back to navigator.clipboard', async () => {
    const writeText = vi.fn(async () => {})
    const readText = vi.fn(async () => 'browser')
    const target = { navigator: { clipboard: { writeText, readText } } } as unknown as Window
    const adapter = createClipboardAdapter(target)
    await adapter.writeText('value')
    expect(writeText).toHaveBeenCalledWith('value')
    await expect(adapter.readText()).resolves.toBe('browser')
  })

  test('reports unsupported clipboard access', async () => {
    const adapter = createClipboardAdapter({ navigator: {} } as unknown as Window)
    await expect(adapter.readText()).rejects.toThrow('클립보드')
    await expect(adapter.writeText('value')).rejects.toThrow('클립보드')
  })
})
