const { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const { fork } = require('child_process');
const net = require('net');
const crypto = require('crypto');

let mainWindow;
let tray;
let serverProcess;
let serverReady = false;

const configPath = path.join(app.getPath('userData'), 'server-config.json');
const DATA_DIR = path.join(__dirname, '..', '..', 'data');
const DIST_PATH = path.join(__dirname, '..', '..', 'dist');

function loadConfig() {
  try {
    if (fs.existsSync(configPath)) return JSON.parse(fs.readFileSync(configPath, 'utf8'));
  } catch {}
  return {
    port: 3000,
    maintenance: false,
    adminDisabled: false,
    autoStart: true,
    jwtSecret: crypto.randomBytes(32).toString('hex')
  };
}

function saveConfig(cfg) {
  fs.writeFileSync(configPath, JSON.stringify(cfg, null, 2));
  const rcPath = path.join(DATA_DIR, 'runtime-config.json');
  try {
    const rc = JSON.parse(fs.readFileSync(rcPath, 'utf8') || '{}');
    rc.maintenance = cfg.maintenance || false;
    rc.adminDisabled = cfg.adminDisabled || false;
    fs.writeFileSync(rcPath, JSON.stringify(rc, null, 2));
  } catch {}
}

function isPortInUse(port) {
  return new Promise((resolve) => {
    const srv = net.createServer();
    srv.once('error', () => resolve(true));
    srv.once('listening', () => { srv.close(); resolve(false); });
    srv.listen(port);
  });
}

function getIcon() {
  const sizes = [16, 24, 32, 48, 64, 128, 256];
  for (const s of sizes) {
    const p = path.join(__dirname, 'assets', `icon_${s}.png`);
    if (fs.existsSync(p)) return nativeImage.createFromPath(p);
  }
  const iconPath = path.join(__dirname, 'assets', 'icon.png');
  const icoPath = path.join(__dirname, 'assets', 'icon.ico');
  if (fs.existsSync(iconPath)) return nativeImage.createFromPath(iconPath);
  if (fs.existsSync(icoPath)) return nativeImage.createFromPath(icoPath);
  return nativeImage.createEmpty();
}

function createTray() {
  if (tray) return;
  tray = new Tray(getIcon());
  tray.setToolTip('IT Ticket System Pro');
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Show App', click: openMainWindow },
    { label: serverReady ? 'Server: Running' : 'Server: Stopped', enabled: false },
    { type: 'separator' },
    { label: 'Restart Server', click: async () => { stopServer(); await startServer(loadConfig().port); } },
    { type: 'separator' },
    { label: 'Quit', click: () => app.quit() }
  ]));
  tray.on('double-click', openMainWindow);
}

function updateTrayMenu() {
  if (!tray) return;
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Show App', click: openMainWindow },
    { label: `Server: ${serverReady ? 'Running' : 'Stopped'}`, enabled: false },
    { type: 'separator' },
    { label: 'Restart Server', click: async () => { stopServer(); await startServer(loadConfig().port); } },
    { type: 'separator' },
    { label: 'Quit', click: () => app.quit() }
  ]));
}

function copyRuntimeConfig(cfg) {
  const rcPath = path.join(DATA_DIR, 'runtime-config.json');
  try {
    let rc = {};
    if (fs.existsSync(rcPath)) rc = JSON.parse(fs.readFileSync(rcPath, 'utf8'));
    rc.maintenance = cfg.maintenance || false;
    fs.writeFileSync(rcPath, JSON.stringify(rc, null, 2));
  } catch {}
}

async function startServer(port) {
  if (serverProcess) return;

  if (await isPortInUse(port)) {
    throw new Error(`Port ${port} is already in use`);
  }

  const cfg = loadConfig();
  copyRuntimeConfig(cfg);

  const serverPath = path.join(__dirname, '..', 'backend', 'server.js');
  const env = {
    ...process.env,
    PORT: String(port),
    JWT_SECRET: cfg.jwtSecret,
    MAINTENANCE_MODE: cfg.maintenance ? 'true' : 'false',
    ADMIN_DISABLED: cfg.adminDisabled ? 'true' : 'false',
    SMTP_ENABLED: cfg.smtpEnabled ? 'true' : 'false',
    SMTP_HOST: cfg.smtpHost || '',
    SMTP_PORT: String(cfg.smtpPort || 587),
    SMTP_USER: cfg.smtpUser || '',
    SMTP_PASS: cfg.smtpPass || '',
    SMTP_FROM: cfg.smtpFrom || '',
    AD_ENABLED: cfg.adEnabled ? 'true' : 'false',
    AD_URL: cfg.adUrl || '',
    AD_BASE_DN: cfg.adBaseDN || '',
    AD_USERNAME: cfg.adUser || '',
    AD_PASSWORD: cfg.adPass || ''
  };

  serverProcess = fork(serverPath, [], { env, stdio: ['pipe', 'pipe', 'pipe', 'ipc'] });
  serverProcess.stdout.on('data', (d) => console.log(`[Server] ${d.toString().trim()}`));
  serverProcess.stderr.on('data', (d) => console.error(`[Server] ${d.toString().trim()}`));
  serverProcess.on('exit', (code) => {
    serverProcess = null;
    serverReady = false;
    updateTrayMenu();
    console.log(`[Server] Process exited (code: ${code})`);
  });

  await new Promise((resolve, reject) => {
    let attempts = 0;
    const check = setInterval(async () => {
      attempts++;
      try {
        const http = require('http');
        const req = http.get(`http://localhost:${port}/api/health`, (res) => {
          if (res.statusCode === 200) {
            clearInterval(check);
            serverReady = true;
            updateTrayMenu();
            resolve();
          }
        });
        req.on('error', () => {});
        req.end();
      } catch {}
      if (attempts > 120) {
        clearInterval(check);
        serverReady = true;
        updateTrayMenu();
        resolve();
      }
    }, 500);
  });
}

function stopServer() {
  if (serverProcess) {
    serverProcess.kill('SIGTERM');
    setTimeout(() => {
      if (serverProcess) {
        try { serverProcess.kill('SIGKILL'); } catch {}
        serverProcess = null;
      }
      serverReady = false;
      updateTrayMenu();
    }, 3000);
  }
}

function showErrorPage(win, port) {
  const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Segoe UI',sans-serif;background:#0f172a;color:#e2e8f0;display:flex;align-items:center;justify-content:center;min-height:100vh;padding:20px}
.card{background:linear-gradient(145deg,#1e293b,#0f172a);border:1px solid rgba(255,255,255,0.06);border-radius:20px;padding:48px 40px;max-width:440px;width:100%;text-align:center}
.icon{font-size:48px;margin-bottom:16px}
h1{font-size:22px;margin-bottom:8px}
p{color:#94a3b8;font-size:14px;margin-bottom:24px;line-height:1.6}
.btn{background:#3b82f6;color:#fff;border:none;padding:12px 32px;border-radius:10px;font-size:14px;cursor:pointer}
.btn:hover{background:#2563eb}
</style></head><body>
<div class="card">
<div class="icon">🔌</div>
<h1>Server Not Running</h1>
<p>The backend server could not be reached on port ${port}.<br>Click Retry to try again, or restart the application.</p>
<button class="btn" onclick="retry()">Retry Connection</button>
</div>
<script>
function retry(){window.location.reload()}
setTimeout(()=>retry(),3000)
</script>
</body></html>`;
  try { win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`); } catch {}
}

async function openMainWindow() {
  if (mainWindow) { mainWindow.focus(); return; }

  const cfg = loadConfig();
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    title: 'IT Ticket System Pro',
    icon: getIcon(),
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false
    }
  });

  mainWindow.once('ready-to-show', () => mainWindow.show());
  mainWindow.on('closed', () => { mainWindow = null; });
  mainWindow.on('page-title-updated', (e) => e.preventDefault());
  let retryCount = 0;
  mainWindow.webContents.on('did-fail-load', (e, code, desc) => {
    if (code === -3) return;
    retryCount++;
    if (retryCount <= 6) {
      setTimeout(() => { try { mainWindow.loadURL(`http://localhost:${cfg.port}`); } catch {} }, 3000);
    } else {
      showErrorPage(mainWindow, cfg.port);
    }
  });

  mainWindow.loadURL(`http://localhost:${cfg.port}`);
}

function showLoadingWindow() {
  const win = new BrowserWindow({
    width: 480,
    height: 360,
    frame: false,
    resizable: false,
    show: false,
    backgroundColor: '#0f172a',
    webPreferences: { nodeIntegration: false, contextIsolation: true }
  });

  win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(`<!DOCTYPE html>
<html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
* { margin:0; padding:0; box-sizing:border-box; }
body {
  font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, sans-serif;
  background: #0f172a;
  display: flex; align-items: center; justify-content: center;
  min-height: 100vh;
}
.card {
  background: linear-gradient(145deg, #0f172a, #1e293b);
  border: 1px solid rgba(255,255,255,0.06);
  border-radius: 20px;
  padding: 40px 36px;
  text-align: center;
  color: #e2e8f0;
  width: 400px;
  box-shadow: 0 25px 60px rgba(0,0,0,0.6);
}
.logo-icon {
  width: 64px; height: 64px;
  background: linear-gradient(135deg, #3b82f6, #8b5cf6);
  border-radius: 18px;
  display: flex; align-items: center; justify-content: center;
  margin: 0 auto 16px;
  font-size: 28px;
  box-shadow: 0 8px 24px rgba(59,130,246,0.3);
}
h1 { font-size: 20px; font-weight: 700; margin-bottom: 4px; }
p { font-size: 13px; color: #94a3b8; margin-bottom: 24px; }
@keyframes spin { to { transform: rotate(360deg); } }
.spinner {
  width: 36px; height: 36px;
  border: 3px solid rgba(255,255,255,0.1);
  border-top-color: #3b82f6;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  margin: 0 auto 16px;
}
.status { font-size: 12px; color: #64748b; }
</style></head><body>
<div class="card">
  <div class="logo-icon">🎫</div>
  <h1>IT Ticket System Pro</h1>
  <p>Starting server, please wait...</p>
  <div class="spinner"></div>
  <div class="status" id="statusText">Initializing...</div>
</div>
</body></html>`)}`);

  win.once('ready-to-show', () => win.show());
  return win;
}

function updateLoadingStatus(win, msg) {
  if (win && !win.isDestroyed()) {
    try {
      win.webContents.executeJavaScript(`document.getElementById('statusText').textContent = ${JSON.stringify(msg)}`);
    } catch {}
  }
}

app.whenReady().then(async () => {
  const loadingWin = showLoadingWindow();

  ipcMain.handle('get-app-path', () => app.getAppPath());
  ipcMain.handle('select-directory', async () => {
    const result = await dialog.showOpenDialog({ properties: ['openDirectory'] });
    return result.canceled ? null : result.filePaths[0];
  });

  const cfg = loadConfig();
  saveConfig(cfg);

  try {
    updateLoadingStatus(loadingWin, 'Starting backend server...');
    await startServer(cfg.port);
    updateLoadingStatus(loadingWin, 'Server ready! Opening app...');
  } catch (err) {
    updateLoadingStatus(loadingWin, `Error: ${err.message}`);
    console.error('[Electron] Server start failed:', err.message);
  }

  openMainWindow();
  createTray();

  setTimeout(() => {
    if (loadingWin && !loadingWin.isDestroyed()) loadingWin.close();
  }, 1500);
});

app.on('window-all-closed', () => {
  // On Windows, keep running in tray
});

app.on('before-quit', () => {
  stopServer();
});

app.on('will-quit', () => {
  stopServer();
});
