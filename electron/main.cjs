const path = require('node:path')
const fs = require('node:fs')
const childProcess = require('node:child_process')
const { pathToFileURL } = require('node:url')
const { app, BrowserWindow, clipboard, ipcMain, net, protocol, shell } = require('electron')
const { UPDATE_CONFIG, checkForUpdates } = require('./update-service.cjs')

function handleSquirrelEvent() {
  const event = process.argv[1]
  if (!event?.startsWith('--squirrel-')) return false

  if (event === '--squirrel-obsolete') {
    app.quit()
    return true
  }

  const appDirectory = path.dirname(process.execPath)
  const updateExe = path.resolve(appDirectory, '..', 'Update.exe')
  const executableName = path.basename(process.execPath)
  const shortcutAction = event === '--squirrel-install' || event === '--squirrel-updated'
    ? '--createShortcut'
    : event === '--squirrel-uninstall'
      ? '--removeShortcut'
      : null

  if (!shortcutAction) return false
  try {
    const child = childProcess.spawn(
      updateExe,
      [shortcutAction, executableName],
      { detached: true, windowsHide: true, stdio: 'ignore' },
    )
    child.unref()
  } catch {
    // Squirrel will still finish installing; users can create a shortcut
    // manually if Windows blocks Update.exe.
  }
  setTimeout(() => app.quit(), 1_000)
  return true
}

// Handle install/update/uninstall before normal startup. This implementation
// intentionally uses only Node built-ins because production packaging excludes
// node_modules from app.asar.
if (handleSquirrelEvent()) return

const isDevelopment = !app.isPackaged
let mainWindow = null
const DEFAULT_RESOLUTION = '1600x900'
const WINDOW_RESOLUTIONS = Object.freeze({
  '1280x720': { width: 1280, height: 720 },
  '1600x900': { width: 1600, height: 900 },
  '1920x1080': { width: 1920, height: 1080 },
})

function settingsPath() {
  return path.join(app.getPath('userData'), 'desktop-settings.json')
}

function decksPath() {
  return path.join(app.getPath('userData'), 'decks.json')
}

function decksBackupPath() {
  return path.join(app.getPath('userData'), 'decks.backup.json')
}

function readDecksFile() {
  const readValidDeckArray = (target) => {
    try {
      const raw = fs.readFileSync(target, 'utf8')
      if (!Array.isArray(JSON.parse(raw))) return null
      return raw
    } catch {
      return null
    }
  }
  return readValidDeckArray(decksPath()) ?? readValidDeckArray(decksBackupPath())
}

function writeDecksFile(serializedDecks) {
  if (typeof serializedDecks !== 'string' || serializedDecks.length > 2_000_000) {
    throw new Error('덱 데이터가 올바르지 않습니다.')
  }
  const parsed = JSON.parse(serializedDecks)
  if (!Array.isArray(parsed)) throw new Error('덱 데이터가 올바르지 않습니다.')

  const target = decksPath()
  const backup = decksBackupPath()
  const temporary = `${target}.tmp`
  fs.mkdirSync(path.dirname(target), { recursive: true })
  if (fs.existsSync(target)) fs.copyFileSync(target, backup)
  fs.writeFileSync(temporary, serializedDecks, 'utf8')
  fs.renameSync(temporary, target)
}

function readResolution() {
  try {
    const saved = JSON.parse(fs.readFileSync(settingsPath(), 'utf8'))
    return Object.hasOwn(WINDOW_RESOLUTIONS, saved.resolution) ? saved.resolution : DEFAULT_RESOLUTION
  } catch {
    return DEFAULT_RESOLUTION
  }
}

function writeResolution(resolution) {
  fs.mkdirSync(path.dirname(settingsPath()), { recursive: true })
  fs.writeFileSync(settingsPath(), JSON.stringify({ resolution }), 'utf8')
}

function applyWindowResolution(window, resolution) {
  const size = WINDOW_RESOLUTIONS[resolution]
  if (!window || !size) return

  if (window.isFullScreen()) window.setFullScreen(false)
  if (window.isMaximized()) window.unmaximize()

  // Windows can treat a 1920x1080 fixed window as maximized. A maximized or
  // non-resizable window may ignore a later setSize(), so restore it and allow
  // the resize only for the duration of this operation.
  window.setResizable(true)
  window.setSize(size.width, size.height, false)
  window.center()
  window.setResizable(false)
}

protocol.registerSchemesAsPrivileged([{
  scheme: 'duel',
  privileges: {
    standard: true,
    secure: true,
    supportFetchAPI: true,
    corsEnabled: true,
  },
}])

function registerAppProtocol() {
  const distRoot = path.resolve(__dirname, '..', 'dist')
  protocol.handle('duel', (request) => {
    const requestUrl = new URL(request.url)
    const relativePath = decodeURIComponent(requestUrl.pathname).replace(/^\/+/, '') || 'index.html'
    const target = path.resolve(distRoot, relativePath)
    if (target !== distRoot && !target.startsWith(`${distRoot}${path.sep}`)) {
      return new Response('Forbidden', { status: 403 })
    }
    return net.fetch(pathToFileURL(target).toString())
  })
}

function registerIpc() {
  ipcMain.handle('clipboard:write-text', (_event, value) => {
    if (typeof value !== 'string' || value.length > 100_000) throw new Error('클립보드 텍스트가 올바르지 않습니다.')
    clipboard.writeText(value)
  })
  ipcMain.handle('clipboard:read-text', () => clipboard.readText())
  ipcMain.on('decks:load-sync', (event) => {
    event.returnValue = readDecksFile()
  })
  ipcMain.handle('decks:save', (_event, serializedDecks) => {
    writeDecksFile(serializedDecks)
  })
  ipcMain.handle('app:get-version', () => app.getVersion())
  ipcMain.handle('app:get-platform', () => process.platform)
  ipcMain.handle('window:get-resolution', () => readResolution())
  ipcMain.handle('window:set-resolution', (_event, resolution) => {
    if (typeof resolution !== 'string' || !Object.hasOwn(WINDOW_RESOLUTIONS, resolution)) {
      throw new Error('지원하지 않는 화면 해상도입니다.')
    }
    writeResolution(resolution)
    applyWindowResolution(mainWindow, resolution)
    return resolution
  })
  ipcMain.handle('window:close', (event) => {
    BrowserWindow.fromWebContents(event.sender)?.close()
  })
  ipcMain.handle('updates:check', () => checkForUpdates(app.getVersion()))
  ipcMain.handle('updates:open-download-page', () => shell.openExternal(UPDATE_CONFIG.releasesUrl))
}

async function createWindow() {
  const preload = path.join(__dirname, 'preload.cjs')
  const initialResolution = WINDOW_RESOLUTIONS[readResolution()]
  mainWindow = new BrowserWindow({
    width: initialResolution.width,
    height: initialResolution.height,
    resizable: false,
    maximizable: false,
    show: false,
    backgroundColor: '#080b10',
    autoHideMenuBar: true,
    webPreferences: {
      preload,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://github.com/ksa-mewmew/duel-spirits/')) void shell.openExternal(url)
    return { action: 'deny' }
  })
  mainWindow.webContents.on('will-navigate', (event, url) => {
    const current = mainWindow?.webContents.getURL()
    if (current && new URL(url).origin !== new URL(current).origin) event.preventDefault()
  })
  mainWindow.once('ready-to-show', () => mainWindow?.show())

  if (isDevelopment) {
    await mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL || 'http://localhost:5173')
  } else {
    await mainWindow.loadURL('duel://app/index.html')
  }
}

app.whenReady().then(async () => {
  registerAppProtocol()
  registerIpc()
  await createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) void createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
