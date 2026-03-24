const {
  app,
  BrowserWindow,
  globalShortcut,
  ipcMain,
  Menu,
  Tray,
  nativeImage,
  session,
  shell,
  screen: electronScreen,
} = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const { keyboard, Key, mouse, screen } = require('@nut-tree-fork/nut-js');

mouse.config.mouseSpeed = 2000;

/** Python OS bridge (python-core `python main.py --api`). Override with GESTRA_PYTHON_URL. */
const PYTHON_BRIDGE_BASE = String(process.env.GESTRA_PYTHON_URL || 'http://127.0.0.1:8765').replace(/\/+$/, '');
const PYTHON_ENTRY = process.env.GESTRA_PYTHON_ENTRY || path.join(__dirname, '../python-core/main.py');

let mainWindow = null;
let tray = null;
let pythonProcess = null;
let pythonLaunchCommand = null;

/** When true, window close proceeds and the process exits. */
let appIsQuitting = false;
/** User-toggle: keep window above other apps. */
let pinWindowAbove = false;

const GEMINI_DEFAULT_BASE_URL = 'https://generativelanguage.googleapis.com/v1';
const GEMINI_DEFAULT_MODEL = 'gemini-1.5-flash';
const XAI_DEFAULT_BASE_URL = 'https://api.x.ai/v1';
const XAI_DEFAULT_MODEL = 'grok-3-latest';
const OPENROUTER_DEFAULT_BASE_URL = 'https://openrouter.ai/api/v1';
const OPENROUTER_DEFAULT_MODEL = 'openrouter/auto';

const FLOATING_WIDTH = 1440;
const FLOATING_HEIGHT = 900;
const FLOATING_MARGIN = 16;
const WINDOWS_CHROME_PATHS = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  path.join(process.env.LOCALAPPDATA || '', 'Google\\Chrome\\Application\\chrome.exe'),
];
const WINDOWS_EDGE_PATHS = [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  path.join(process.env.LOCALAPPDATA || '', 'Microsoft\\Edge\\Application\\msedge.exe'),
];
const WINDOWS_VOICE_SCRIPT_CANDIDATES = [
  path.join(__dirname, 'windows-voice-once.ps1'),
  path.join(__dirname, '../electron/windows-voice-once.ps1'),
];

function buildGeminiUrl(baseUrl, model, apiKey) {
  const normalizedBaseUrl = String(baseUrl || GEMINI_DEFAULT_BASE_URL).replace(/\/+$/, '');
  const normalizedModel = String(model || GEMINI_DEFAULT_MODEL)
    .trim()
    .replace(/^models\//, '');

  return `${normalizedBaseUrl}/models/${normalizedModel}:generateContent?key=${apiKey}`;
}

function buildXaiUrl(baseUrl) {
  return `${String(baseUrl || XAI_DEFAULT_BASE_URL).replace(/\/+$/, '')}/chat/completions`;
}

function buildOpenRouterUrl(baseUrl) {
  return `${String(baseUrl || OPENROUTER_DEFAULT_BASE_URL).replace(/\/+$/, '')}/chat/completions`;
}

async function proxyAssistantRequest(payload) {
  const {
    provider = 'gemini',
    baseUrl,
    apiKey,
    model,
    prompt,
    history,
    systemPrompt = 'You are RunAnywhere AI. Keep answers concise.',
  } = payload || {};

  if (!apiKey) {
    throw new Error(
      `Missing ${
        provider === 'openrouter' ? 'OpenRouter' : provider === 'xai' ? 'xAI' : 'Gemini'
      } API key.`
    );
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);

  try {
    if (provider === 'openrouter') {
      const url = buildOpenRouterUrl(baseUrl);

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: model || OPENROUTER_DEFAULT_MODEL,
          messages: [
            { role: 'system', content: systemPrompt },
            ...(history || []).map((item) => ({
              role: item.role === 'assistant' ? 'assistant' : 'user',
              content: item.content,
            })),
            { role: 'user', content: prompt },
          ],
        }),
        signal: controller.signal,
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(
          `OpenRouter request failed (${response.status}): ${JSON.stringify(data?.error || data || {})}`
        );
      }

      return data?.choices?.[0]?.message?.content || 'No response from OpenRouter.';
    }

    if (provider === 'xai') {
      const url = buildXaiUrl(baseUrl);

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: model || XAI_DEFAULT_MODEL,
          messages: [
            { role: 'system', content: systemPrompt },
            ...(history || []).map((item) => ({
              role: item.role === 'assistant' ? 'assistant' : 'user',
              content: item.content,
            })),
            { role: 'user', content: prompt },
          ],
        }),
        signal: controller.signal,
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(`xAI request failed (${response.status}): ${JSON.stringify(data?.error || data || {})}`);
      }

      return data?.choices?.[0]?.message?.content || 'No response from xAI.';
    }

    const url = buildGeminiUrl(baseUrl, model, apiKey);

    const contents = (history || []).map((item) => ({
      role: item.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: item.content }],
    }));

    contents.push({
      role: 'user',
      parts: [{ text: prompt }],
    });

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ contents }),
      signal: controller.signal,
    });

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error(
          `Gemini model "${String(model || GEMINI_DEFAULT_MODEL).trim()}" was not found. Set VITE_GEMINI_MODEL to a supported model such as "${GEMINI_DEFAULT_MODEL}".`
        );
      }
      throw new Error(`Gemini request failed (${response.status}): ${JSON.stringify(data?.error || data || {})}`);
    }

    return data?.candidates?.[0]?.content?.parts?.[0]?.text || 'No response from Gemini.';
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error('Request timed out after 30 seconds.');
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

function normalizeActionName(raw) {
  return String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/_/g, '-');
}

function launchDetached(command, args = []) {
  const child = spawn(command, args, {
    detached: true,
    stdio: 'ignore',
    windowsHide: true,
  });
  child.unref();
}

function findFirstExistingPath(candidates = []) {
  const fs = require('fs');
  for (const candidate of candidates) {
    if (candidate && fs.existsSync(candidate)) {
      return candidate;
    }
  }
  return null;
}

async function yieldFocusToDesktop({ hideWindow = true, delayMs = 180 } = {}) {
  if (!mainWindow || mainWindow.isDestroyed()) return;

  try {
    if (hideWindow && mainWindow.isVisible()) {
      mainWindow.hide();
    } else {
      mainWindow.blur();
    }
  } catch (_) {}

  await new Promise((resolve) => setTimeout(resolve, delayMs));
}

function canUsePythonAction(actionRaw) {
  const action = normalizeActionName(actionRaw);
  return ['scroll-up', 'scroll-down', 'left-click', 'screenshot', 'play-pause'].includes(action);
}

async function executeOsActionWithFallback(actionRaw, options = null) {
  const action = normalizeActionName(actionRaw);

  if (!action) {
    return { ok: false, message: 'No action provided.' };
  }

  try {
    if (canUsePythonAction(action)) {
      const py = await pythonBridgeIpc({
        op: 'gesture',
        action,
        options,
      });

      if (py?.ok) {
        return { ok: true, message: `Executed ${action}.` };
      }
    }

    await runOsAction(action, options);
    return { ok: true, message: `Executed ${action}.` };
  } catch (error) {
    return {
      ok: false,
      message: `Action failed: ${String(error?.message || error)}`,
    };
  }
}

async function executeDesktopLaunch(targetRaw) {
  const target = String(targetRaw || '')
    .trim()
    .toLowerCase();

  if (!target) {
    return { ok: false, message: 'No target provided.' };
  }

  try {
    switch (target) {
      case 'chrome':
      case 'google chrome': {
        await yieldFocusToDesktop({ hideWindow: true });
        const chromePath = findFirstExistingPath(WINDOWS_CHROME_PATHS);
        if (chromePath) {
          launchDetached(chromePath);
          return { ok: true, message: 'Opening Chrome.' };
        }
        launchDetached('cmd.exe', ['/c', 'start', '', 'chrome']);
        return { ok: true, message: 'Opening Chrome.' };
      }

      case 'edge':
      case 'microsoft edge': {
        await yieldFocusToDesktop({ hideWindow: true });
        const edgePath = findFirstExistingPath(WINDOWS_EDGE_PATHS);
        if (edgePath) {
          launchDetached(edgePath);
          return { ok: true, message: 'Opening Microsoft Edge.' };
        }
        launchDetached('cmd.exe', ['/c', 'start', '', 'microsoft-edge:']);
        return { ok: true, message: 'Opening Microsoft Edge.' };
      }

      case 'file explorer':
      case 'explorer':
      case 'folder':
      case 'folders':
        await yieldFocusToDesktop({ hideWindow: true });
        launchDetached('explorer.exe');
        return { ok: true, message: 'Opening File Explorer.' };

      case 'notepad':
        await yieldFocusToDesktop({ hideWindow: true });
        launchDetached('notepad.exe');
        return { ok: true, message: 'Opening Notepad.' };

      case 'calculator':
      case 'calc':
        await yieldFocusToDesktop({ hideWindow: true });
        launchDetached('calc.exe');
        return { ok: true, message: 'Opening Calculator.' };

      case 'settings':
      case 'windows settings':
        await yieldFocusToDesktop({ hideWindow: true });
        await shell.openExternal('ms-settings:');
        return { ok: true, message: 'Opening Windows Settings.' };

      case 'command prompt':
      case 'cmd':
        await yieldFocusToDesktop({ hideWindow: true });
        launchDetached('cmd.exe');
        return { ok: true, message: 'Opening Command Prompt.' };

      case 'powershell':
      case 'terminal':
        await yieldFocusToDesktop({ hideWindow: true });
        launchDetached('powershell.exe');
        return { ok: true, message: 'Opening PowerShell.' };

      default:
        return { ok: false, message: `I cannot open "${target}" yet.` };
    }
  } catch (error) {
    return {
      ok: false,
      message: `Failed to open ${target}: ${String(error?.message || error)}`,
    };
  }
}

async function executeVoiceCommand(payload) {
  const type = String(payload?.type || '').trim().toLowerCase();

  if (type === 'open-app') {
    return executeDesktopLaunch(payload?.target);
  }

  if (type === 'os-action') {
    const action = String(payload?.target || '').trim();
    await yieldFocusToDesktop({ hideWindow: true });
    return executeOsActionWithFallback(action, payload?.options ?? null);
  }

  if (type === 'window-action') {
    const action = String(payload?.target || '').trim().toLowerCase();
    if (action === 'show') {
      mainWindow?.show();
      mainWindow?.focus();
      return { ok: true, message: 'Showing RunAnywhere.' };
    }
    if (action === 'hide') {
      mainWindow?.hide();
      return { ok: true, message: 'Hiding RunAnywhere.' };
    }
    if (action === 'pin') {
      pinWindowAbove = true;
      applyAlwaysOnTopPreference();
      rebuildTrayMenu();
      return { ok: true, message: 'Pinned above other windows.' };
    }
    if (action === 'unpin') {
      pinWindowAbove = false;
      applyAlwaysOnTopPreference();
      rebuildTrayMenu();
      return { ok: true, message: 'Pin disabled.' };
    }
  }

  return { ok: false, message: 'Unknown voice command.' };
}

async function recognizeNativeSpeech(payload = {}) {
  if (process.platform !== 'win32') {
    return { ok: false, reason: 'unsupported', message: 'Native speech fallback is Windows-only.' };
  }

  const timeoutSeconds = Math.max(3, Math.min(15, Math.round(Number(payload?.timeoutSeconds) || 8)));
  const voiceScriptPath = findFirstExistingPath(WINDOWS_VOICE_SCRIPT_CANDIDATES);

  if (!voiceScriptPath) {
    return { ok: false, reason: 'missing-script', message: 'Windows voice script not found.' };
  }

  return await new Promise((resolve) => {
    const child = spawn('powershell.exe', [
      '-NoProfile',
      '-ExecutionPolicy',
      'Bypass',
      '-File',
      voiceScriptPath,
      '-TimeoutSeconds',
      String(timeoutSeconds),
    ], {
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';
    let settled = false;

    const finish = (result) => {
      if (settled) return;
      settled = true;
      resolve(result);
    };

    child.stdout.on('data', (chunk) => {
      stdout += String(chunk || '');
    });

    child.stderr.on('data', (chunk) => {
      stderr += String(chunk || '');
    });

    child.on('error', (error) => {
      finish({ ok: false, reason: 'spawn-failed', message: String(error?.message || error) });
    });

    child.on('exit', () => {
      const text = stdout.trim();
      if (!text) {
        finish({
          ok: false,
          reason: 'empty',
          message: stderr.trim() || 'Native speech recognizer returned no output.',
        });
        return;
      }

      try {
        finish(JSON.parse(text));
      } catch {
        finish({
          ok: false,
          reason: 'invalid-json',
          message: text,
        });
      }
    });
  });
}

async function runOsAction(actionRaw, options) {
  const action = normalizeActionName(actionRaw);

  switch (action) {
    case 'scroll-up':
    case 'scrollup':
      await mouse.scrollUp(1200);
      break;

    case 'scroll-down':
    case 'scrolldown':
      await mouse.scrollDown(1200);
      break;

    case 'left-click':
    case 'leftclick':
      await mouse.leftClick();
      break;

    case 'right-click':
    case 'rightclick':
      await mouse.rightClick();
      break;

    case 'play-pause':
    case 'playpause':
    case 'media-toggle':
      await keyboard.type(Key.AudioPlay);
      break;

    case 'screenshot':
      await keyboard.type(Key.Print);
      break;

    case 'alt-tab':
    case 'alttab':
      await keyboard.pressKey(Key.LeftAlt, Key.Tab);
      await keyboard.releaseKey(Key.LeftAlt, Key.Tab);
      break;

    case 'volume-up':
    case 'volumeup':
      await keyboard.type(Key.AudioVolUp);
      break;

    case 'volume-down':
    case 'volumedown':
      await keyboard.type(Key.AudioVolDown);
      break;

    case 'move-mouse':
    case 'movemouse': {
      const nx = Number(options?.nx);
      const ny = Number(options?.ny);

      if (!Number.isFinite(nx) || !Number.isFinite(ny)) {
        break;
      }

      const w = await screen.width();
      const h = await screen.height();
      const x = Math.round(Math.min(1, Math.max(0, nx)) * Math.max(0, w - 1));
      const y = Math.round(Math.min(1, Math.max(0, ny)) * Math.max(0, h - 1));

      await mouse.setPosition({ x, y });
      break;
    }

    default:
      console.warn('[GestureOS/Main] Unknown action:', actionRaw);
  }
}

async function pythonBridgeIpc(payload) {
  const op = payload?.op;

  const withBase = (obj) => ({ ...obj, baseUrl: PYTHON_BRIDGE_BASE });

  const fetchJson = async (url, timeoutMs = 1800) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(url, { signal: controller.signal });
      const text = await res.text();

      let data = null;
      try {
        data = text ? JSON.parse(text) : null;
      } catch {
        data = { raw: text };
      }

      return { res, data };
    } finally {
      clearTimeout(timer);
    }
  };

  const postJson = async (url, body, timeoutMs = 1500) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      return await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }
  };

  if (!op) {
    return withBase({ ok: false, error: 'python-bridge: missing op' });
  }

  try {
    if (op === 'health') {
      const { res, data } = await fetchJson(`${PYTHON_BRIDGE_BASE}/health`);
      return withBase({ ok: res.ok, status: res.status, data });
    }

    if (op === 'bridge') {
      const { res, data } = await fetchJson(`${PYTHON_BRIDGE_BASE}/api/v1/bridge`);
      return withBase({ ok: res.ok, status: res.status, data });
    }

    if (op === 'state') {
      const { res, data } = await fetchJson(`${PYTHON_BRIDGE_BASE}/api/v1/state`, 1200);
      return withBase({ ok: res.ok, status: res.status, data });
    }

    if (op === 'gesture') {
      const action = payload?.action;
      const options = payload?.options ?? null;

      const res = await postJson(`${PYTHON_BRIDGE_BASE}/gesture`, {
        action,
        options,
        source: 'electron-main',
      });

      return withBase({ ok: res.ok, status: res.status });
    }

    return withBase({ ok: false, error: `python-bridge: unknown op "${op}"` });
  } catch (err) {
    const message =
      err?.name === 'AbortError'
        ? `python bridge timeout for op "${op}"`
        : String(err?.message || err);

    if (!['bridge', 'health', 'state'].includes(String(op))) {
      console.warn('[GestureOS/Main] python-bridge:', message);
    }
    return withBase({ ok: false, error: message });
  }
}

function setupMediaPermissions() {
  const allowMediaPermission = (permission) =>
    permission === 'media' ||
    permission === 'camera' ||
    permission === 'microphone' ||
    permission === 'speaker-selection';

  session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => {
    callback(allowMediaPermission(permission));
  });

  session.defaultSession.setPermissionCheckHandler((_webContents, permission) => {
    if (allowMediaPermission(permission)) {
      return true;
    }
    return null;
  });
}

function placeFloatingWindow(win) {
  const { width: wa, height: wh, x: wx, y: wy } = electronScreen.getPrimaryDisplay().workArea;
  const width = Math.max(1180, Math.floor(wa * 0.94));
  const height = Math.max(760, Math.floor(wh * 0.92));

  win.setBounds({
    x: wx + Math.max(FLOATING_MARGIN, Math.floor((wa - width) / 2)),
    y: wy + Math.max(FLOATING_MARGIN, Math.floor((wh - height) / 2)),
    width,
    height,
  });
}

function applyAlwaysOnTopPreference() {
  if (!mainWindow || mainWindow.isDestroyed()) return;

  if (pinWindowAbove) {
    mainWindow.setAlwaysOnTop(true, 'floating');
    mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  } else {
    mainWindow.setAlwaysOnTop(false);
    mainWindow.setVisibleOnAllWorkspaces(false);
  }
}

function rebuildTrayMenu() {
  if (!tray) return;

  tray.setContextMenu(
    Menu.buildFromTemplate([
      {
        label: 'Show RunAnywhere AI',
        click: () => {
          mainWindow?.show();
          mainWindow?.focus();
        },
      },
      {
        label: 'Hide to background',
        click: () => mainWindow?.hide(),
      },
      { type: 'separator' },
      {
        label: 'Pin above other windows',
        type: 'checkbox',
        checked: pinWindowAbove,
        click: (item) => {
          pinWindowAbove = Boolean(item.checked);
          applyAlwaysOnTopPreference();
          rebuildTrayMenu();
        },
      },
      { type: 'separator' },
      {
        label: 'Quit completely',
        click: () => {
          appIsQuitting = true;
          stopPythonBackend();
          app.quit();
        },
      },
    ])
  );
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: FLOATING_WIDTH,
    height: FLOATING_HEIGHT,
    minWidth: 1100,
    minHeight: 720,
    alwaysOnTop: false,
    autoHideMenuBar: true,
    frame: true,
    backgroundColor: '#081121',
    title: 'RunAnywhere AI',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true,
      backgroundThrottling: false,
    },
  });

  placeFloatingWindow(mainWindow);
  applyAlwaysOnTopPreference();

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  mainWindow.on('close', (event) => {
    if (!appIsQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}

function createTray() {
  tray = new Tray(
    nativeImage.createFromDataURL(
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9s2son8AAAAASUVORK5CYII='
    )
  );

  tray.setToolTip('GestureOS — runs in background; use Quit to exit');
  rebuildTrayMenu();

  tray.on('double-click', () => {
    if (mainWindow?.isVisible()) {
      mainWindow.hide();
    } else {
      mainWindow?.show();
      mainWindow?.focus();
    }
  });
}

function startPythonBackend() {
  if (pythonProcess) return;
  const candidates =
    process.platform === 'win32'
      ? [
          { cmd: 'py', args: ['-3', PYTHON_ENTRY, '--api'] },
          { cmd: 'python', args: [PYTHON_ENTRY, '--api'] },
          { cmd: 'python3', args: [PYTHON_ENTRY, '--api'] },
        ]
      : [
          { cmd: 'python3', args: [PYTHON_ENTRY, '--api'] },
          { cmd: 'python', args: [PYTHON_ENTRY, '--api'] },
        ];

  for (const candidate of candidates) {
    try {
      const child = spawn(candidate.cmd, candidate.args, {
        cwd: path.dirname(PYTHON_ENTRY),
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true,
      });

      pythonProcess = child;
      pythonLaunchCommand = candidate;
      console.log(`[Python] launch attempted via: ${candidate.cmd} ${candidate.args.join(' ')}`);

      child.stdout.on('data', (data) => {
        console.log(`[Python] ${String(data).trim()}`);
      });

      child.stderr.on('data', (data) => {
        console.error(`[Python ERROR] ${String(data).trim()}`);
      });

      child.on('exit', (code) => {
        console.warn(`[Python] exited with code ${code}`);
        if (pythonProcess === child) {
          pythonProcess = null;
          pythonLaunchCommand = null;
        }
      });

      child.on('error', (error) => {
        console.error(`[Python] failed to start via ${candidate.cmd}:`, error);
        if (pythonProcess === child) {
          pythonProcess = null;
          pythonLaunchCommand = null;
        }
      });

      return;
    } catch (error) {
      console.error(`[Python] spawn threw for ${candidate.cmd}:`, error);
    }
  }

  console.error('[GestureOS/Main] startPythonBackend failed: no usable Python launcher found');
}

async function ensurePythonBackend() {
  if (!pythonProcess) {
    startPythonBackend();
  }

  return {
    ok: Boolean(pythonProcess),
    running: Boolean(pythonProcess),
    launchCommand: pythonLaunchCommand
      ? `${pythonLaunchCommand.cmd} ${pythonLaunchCommand.args.join(' ')}`
      : null,
    entry: PYTHON_ENTRY,
    baseUrl: PYTHON_BRIDGE_BASE,
  };
}

function stopPythonBackend() {
  if (!pythonProcess) return;

  try {
    pythonProcess.kill();
  } catch (error) {
    console.warn('[Python] stop failed:', error);
  } finally {
    pythonProcess = null;
    pythonLaunchCommand = null;
  }
}

function registerIpcHandlers() {
  ipcMain.handle('python-bridge', async (_event, payload) => pythonBridgeIpc(payload));

  ipcMain.handle('perform-action', async (_event, payload) => {
    const action = typeof payload === 'string' ? payload : payload?.action;
    const options = typeof payload === 'object' && payload ? payload.options : null;

    await runOsAction(action, options);
    return { ok: true };
  });

  ipcMain.handle('assistant-request', async (_event, payload) => proxyAssistantRequest(payload));
  ipcMain.handle('execute-voice-command', async (_event, payload) => executeVoiceCommand(payload));
  ipcMain.handle('recognize-native-speech', async (_event, payload) => recognizeNativeSpeech(payload));

  ipcMain.handle('set-overlay-mode', async (_event, enabled) => {
    return { ok: false, overlayModeEnabled: false, supported: false, requested: Boolean(enabled) };
  });

  ipcMain.handle('hide-window', async () => {
    mainWindow?.hide();
    return { ok: true };
  });

  ipcMain.handle('show-window', async () => {
    mainWindow?.show();
    mainWindow?.focus();
    return { ok: true };
  });

  ipcMain.handle('quit-app', async () => {
    appIsQuitting = true;
    stopPythonBackend();
    app.quit();
    return { ok: true };
  });

  ipcMain.handle('set-pin-above', async (_event, enabled) => {
    pinWindowAbove = Boolean(enabled);
    applyAlwaysOnTopPreference();
    rebuildTrayMenu();
    return { ok: true, pinWindowAbove };
  });

  ipcMain.handle('get-window-mode', async () => ({
    pinWindowAbove,
    overlayModeEnabled: false,
    floating: { width: FLOATING_WIDTH, height: FLOATING_HEIGHT },
  }));
  ipcMain.handle('get-python-backend-status', async () => ({
    running: Boolean(pythonProcess),
    launchCommand: pythonLaunchCommand
      ? `${pythonLaunchCommand.cmd} ${pythonLaunchCommand.args.join(' ')}`
      : null,
    entry: PYTHON_ENTRY,
    baseUrl: PYTHON_BRIDGE_BASE,
  }));
  ipcMain.handle('ensure-python-backend', async () => ensurePythonBackend());
}

app.whenReady().then(() => {
  if (!app.requestSingleInstanceLock()) {
    app.quit();
    return;
  }

  setupMediaPermissions();

  if (app.isPackaged) {
    app.setLoginItemSettings({ openAtLogin: true });
  }

  startPythonBackend();
  registerIpcHandlers();
  createWindow();
  createTray();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
      return;
    }

    mainWindow?.show();
    mainWindow?.focus();
  });
});

app.on('second-instance', () => {
  if (mainWindow) {
    if (!mainWindow.isVisible()) mainWindow.show();
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    stopPythonBackend();
    app.quit();
  }
});

app.on('before-quit', () => {
  appIsQuitting = true;
  stopPythonBackend();
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});
