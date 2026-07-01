const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { app, BrowserWindow, net, protocol, session } = require('electron');

const APP_TITLE = 'KBO GM Manager';
const APP_ROOT = path.resolve(__dirname);
const APP_PROTOCOL = 'app:';
const APP_HOST = 'kbo-gm-manager';
const APP_ENTRY_URL = `${APP_PROTOCOL}//${APP_HOST}/index.html`;
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

function createMainWindow() {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 840,
    minWidth: 1024,
    minHeight: 680,
    title: APP_TITLE,
    backgroundColor: '#101820',
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
      devTools: !app.isPackaged
    }
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  mainWindow.webContents.on('will-navigate', (event, targetUrl) => {
    if (!isAppNavigation(targetUrl)) {
      event.preventDefault();
    }
  });

  return mainWindow.loadURL(APP_ENTRY_URL);
}

app.setAppUserModelId('com.pastahealth.kbogmmanager');

app.whenReady().then(async () => {
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
