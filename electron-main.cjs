const path = require('node:path');
const { pathToFileURL } = require('node:url');
const fs = require('node:fs');
const { app, BrowserWindow, Menu, net, protocol, screen, session } = require('electron');

const APP_TITLE = 'KBO GM Manager';
const APP_ROOT = path.resolve(__dirname);
const APP_PROTOCOL = 'app:';
const APP_HOST = 'kbo-gm-manager';
const APP_ENTRY_URL = `${APP_PROTOCOL}//${APP_HOST}/index.html`;
const PRELOAD_PATH = path.join(APP_ROOT, 'electron-preload.cjs');
const MIN_WINDOW_SIZE = { width: 1180, height: 760 };
const DEFAULT_WINDOW_SIZE = { width: 1440, height: 920 };
const WINDOW_STATE_FILE = 'window-state.json';
const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'none'",
  "frame-ancestors 'none'"
].join('; ');

let mainWindow = null;
let saveWindowStateTimer = null;

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'app',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
      stream: true
    }
  }
]);

function isInsideAppRoot(filePath) {
  const relativePath = path.relative(APP_ROOT, filePath);
  return relativePath === '' || (!relativePath.startsWith('..') && !path.isAbsolute(relativePath));
}

function resolveAppFile(requestUrl) {
  const url = new URL(requestUrl);

  if (url.protocol !== APP_PROTOCOL || url.host !== APP_HOST) {
    throw new Error(`Blocked unknown app origin: ${requestUrl}`);
  }

  const requestedPath = url.pathname === '/' ? '/index.html' : decodeURIComponent(url.pathname);
  const normalizedPath = path.normalize(requestedPath).replace(/^[/\\]+/, '');
  const filePath = path.resolve(APP_ROOT, normalizedPath);

  if (!isInsideAppRoot(filePath)) {
    throw new Error(`Blocked app protocol path outside root: ${requestedPath}`);
  }

  return filePath;
}

function isAppNavigation(targetUrl) {
  try {
    const url = new URL(targetUrl);
    return url.protocol === APP_PROTOCOL && url.host === APP_HOST;
  } catch {
    return false;
  }
}

function getWindowStatePath() {
  return path.join(app.getPath('userData'), WINDOW_STATE_FILE);
}

function clampNumber(value, min, max, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, Math.round(number)));
}

function readWindowState() {
  try {
    return JSON.parse(fs.readFileSync(getWindowStatePath(), 'utf8'));
  } catch {
    return null;
  }
}

function boundsIntersectDisplay(bounds) {
  if (!Number.isFinite(bounds?.x) || !Number.isFinite(bounds?.y)) return true;
  return screen.getAllDisplays().some(({ workArea }) => {
    const horizontal = Math.min(bounds.x + bounds.width, workArea.x + workArea.width) - Math.max(bounds.x, workArea.x);
    const vertical = Math.min(bounds.y + bounds.height, workArea.y + workArea.height) - Math.max(bounds.y, workArea.y);
    return horizontal >= 160 && vertical >= 120;
  });
}

function resolveWindowState() {
  const state = readWindowState();
  const workArea = screen.getPrimaryDisplay().workArea;
  const maxWidth = Math.max(MIN_WINDOW_SIZE.width, workArea.width);
  const maxHeight = Math.max(MIN_WINDOW_SIZE.height, workArea.height);
  const bounds = {
    width: clampNumber(state?.width, MIN_WINDOW_SIZE.width, maxWidth, Math.min(DEFAULT_WINDOW_SIZE.width, maxWidth)),
    height: clampNumber(state?.height, MIN_WINDOW_SIZE.height, maxHeight, Math.min(DEFAULT_WINDOW_SIZE.height, maxHeight))
  };

  if (Number.isFinite(Number(state?.x)) && Number.isFinite(Number(state?.y))) {
    bounds.x = Math.round(Number(state.x));
    bounds.y = Math.round(Number(state.y));
  }

  if (!boundsIntersectDisplay(bounds)) {
    delete bounds.x;
    delete bounds.y;
  }

  return {
    bounds,
    isMaximized: state?.isMaximized === true
  };
}

function saveWindowState(window) {
  if (!window || window.isDestroyed() || window.isMinimized()) return;
  const state = {
    ...window.getBounds(),
    isMaximized: window.isMaximized()
  };
  fs.mkdirSync(app.getPath('userData'), { recursive: true });
  fs.writeFileSync(getWindowStatePath(), JSON.stringify(state, null, 2));
}

function scheduleWindowStateSave(window) {
  clearTimeout(saveWindowStateTimer);
  saveWindowStateTimer = setTimeout(() => saveWindowState(window), 240);
}

async function handleAppProtocol(request) {
  try {
    const filePath = resolveAppFile(request.url);
    return net.fetch(pathToFileURL(filePath).toString());
  } catch (error) {
    console.error(error);
    return new Response('Not found', { status: 404 });
  }
}

function addSecurityHeaders() {
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    if (!details.url.startsWith('app://')) {
      callback({ responseHeaders: details.responseHeaders });
      return;
    }

    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [CONTENT_SECURITY_POLICY],
        'X-Content-Type-Options': ['nosniff']
      }
    });
  });
}

function lockDownPermissions() {
  session.defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) => {
    callback(false);
  });
  session.defaultSession.setPermissionCheckHandler(() => false);
}

function bindDesktopShortcuts(window) {
  window.webContents.setZoomFactor(1);
  window.webContents.setVisualZoomLevelLimits(1, 1).catch(() => {});
  window.webContents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown') return;
    const key = String(input.key ?? '').toLowerCase();
    const hasAccel = Boolean(input.control || input.meta);

    if (input.key === 'F11') {
      event.preventDefault();
      window.setFullScreen(!window.isFullScreen());
      return;
    }

    if (hasAccel && ['+', '=', '-', '0'].includes(key)) {
      event.preventDefault();
      window.webContents.setZoomFactor(1);
      return;
    }

    if (app.isPackaged && (input.key === 'F5' || (hasAccel && key === 'r'))) {
      event.preventDefault();
    }
  });
}

function createMainWindow() {
  const windowState = resolveWindowState();
  mainWindow = new BrowserWindow({
    ...windowState.bounds,
    minWidth: MIN_WINDOW_SIZE.width,
    minHeight: MIN_WINDOW_SIZE.height,
    title: APP_TITLE,
    backgroundColor: '#07100e',
    autoHideMenuBar: true,
    show: false,
    useContentSize: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
      preload: PRELOAD_PATH,
      spellcheck: false,
      backgroundThrottling: false,
      allowRunningInsecureContent: false,
      devTools: !app.isPackaged
    }
  });

  mainWindow.once('ready-to-show', () => {
    if (windowState.isMaximized) {
      mainWindow.maximize();
    } else if (!Number.isFinite(windowState.bounds.x) || !Number.isFinite(windowState.bounds.y)) {
      mainWindow.center();
    }
    mainWindow.show();
    mainWindow.focus();
  });

  mainWindow.setMenuBarVisibility(false);
  bindDesktopShortcuts(mainWindow);
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  mainWindow.webContents.on('will-navigate', (event, targetUrl) => {
    if (!isAppNavigation(targetUrl)) {
      event.preventDefault();
    }
  });
  mainWindow.on('resize', () => scheduleWindowStateSave(mainWindow));
  mainWindow.on('move', () => scheduleWindowStateSave(mainWindow));
  mainWindow.on('maximize', () => scheduleWindowStateSave(mainWindow));
  mainWindow.on('unmaximize', () => scheduleWindowStateSave(mainWindow));
  mainWindow.on('close', () => saveWindowState(mainWindow));
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  return mainWindow.loadURL(APP_ENTRY_URL);
}

app.setAppUserModelId('com.pastahealth.kbogmmanager');

const hasSingleInstanceLock = app.requestSingleInstanceLock();

if (!hasSingleInstanceLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  });

  app.whenReady().then(async () => {
    Menu.setApplicationMenu(null);
    protocol.handle('app', handleAppProtocol);
    addSecurityHeaders();
    lockDownPermissions();
    await createMainWindow();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createMainWindow();
      }
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });
}
