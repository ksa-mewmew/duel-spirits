const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('duelDesktop', {
  clipboard: {
    writeText: (value) => ipcRenderer.invoke('clipboard:write-text', value),
    readText: () => ipcRenderer.invoke('clipboard:read-text'),
  },
  storage: {
    loadDecks: () => ipcRenderer.sendSync('decks:load-sync'),
    saveDecks: (serializedDecks) => ipcRenderer.invoke('decks:save', serializedDecks),
  },
  app: {
    getVersion: () => ipcRenderer.invoke('app:get-version'),
    getPlatform: () => ipcRenderer.invoke('app:get-platform'),
  },
  window: {
    getResolution: () => ipcRenderer.invoke('window:get-resolution'),
    setResolution: (resolution) => ipcRenderer.invoke('window:set-resolution', resolution),
    close: () => ipcRenderer.invoke('window:close'),
  },
  updates: {
    check: () => ipcRenderer.invoke('updates:check'),
    openDownloadPage: () => ipcRenderer.invoke('updates:open-download-page'),
  },
})
