import html2canvas from 'html2canvas';
import { speakFeedback } from './tts.js';
import { logAction, showToast } from './ui.js';

let repeatingGesture = null;
let repeatTimer = null;
let pythonVisionCollective = false;

export const gestureLabels = {
  palm: 'Scroll up',
  fist: 'Scroll down',
  peace: 'Screenshot',
  thumb: 'Play or pause media',
  index: 'Move cursor',
  pinch: 'Left click',
};

const gestureToAction = {
  palm: 'scroll-up',
  fist: 'scroll-down',
  peace: 'screenshot',
  thumb: 'play-pause',
  index: 'move-mouse',
  pinch: 'left-click',
};

const actionCooldownMs = {
  'scroll-up': 700,
  'scroll-down': 700,
  'left-click': 900,
  'right-click': 900,
  'play-pause': 1000,
  screenshot: 1400,
  'alt-tab': 1200,
  'volume-up': 400,
  'volume-down': 400,
  'move-mouse': 32,
};

const repeatableGestures = new Set(['palm', 'fist']);
const repeatDelayByGesture = {
  palm: 400,
  fist: 400,
};

const lastActionFireAt = new Map();

export const DEFAULT_PYTHON_BRIDGE_URL =
  (typeof import.meta !== 'undefined' &&
    import.meta.env &&
    import.meta.env.VITE_PYTHON_BRIDGE_URL) ||
  'http://127.0.0.1:8765';

function normalizeBaseUrl(baseUrl) {
  return String(baseUrl || DEFAULT_PYTHON_BRIDGE_URL).replace(/\/+$/, '');
}

function canFireAction(action, { bypassCooldown = false } = {}) {
  if (bypassCooldown) return true;

  const gap = actionCooldownMs[action] ?? 750;
  const last = lastActionFireAt.get(action) ?? 0;

  if (Date.now() - last < gap) {
    return false;
  }

  lastActionFireAt.set(action, Date.now());
  return true;
}

async function captureCanvasScreenshot() {
  const target = document.getElementById('app-container') || document.body;
  const canvas = await html2canvas(target, {
    backgroundColor: '#081121',
    useCORS: true,
    scale: Math.min(window.devicePixelRatio || 1, 2),
  });

  const link = document.createElement('a');
  link.download = `gestureos-${Date.now()}.png`;
  link.href = canvas.toDataURL('image/png');
  link.click();
}

export function setPythonVisionCollective(on) {
  pythonVisionCollective = Boolean(on);
}

export function isPythonVisionCollective() {
  return pythonVisionCollective;
}

export async function fetchPythonHudState(baseUrl) {
  const base = normalizeBaseUrl(baseUrl);

  if (window.electronAPI?.pythonBridge) {
    try {
      const response = await window.electronAPI.pythonBridge({ op: 'state' });
      return response?.ok ? response.data : null;
    } catch {
      return null;
    }
  }

  try {
    const res = await fetch(`${base}/api/v1/state`, {
      method: 'GET',
      mode: 'cors',
    });
    return res.ok ? await res.json() : null;
  } catch {
    return null;
  }
}

export function mapPythonStateToOverlay(data) {
  if (!data) {
    return {
      handDetected: false,
      gesture: 'none',
      confidence: 0,
      stable: false,
      stability: 0,
      fps: 0,
    };
  }

  return {
    handDetected: Boolean(data.handDetected),
    gesture: data.gesture || 'none',
    confidence: Number(data.confidence) || 0,
    stable: Boolean(data.stable),
    stability: Number(data.stability) || 0,
    fps: Number(data.fps) || 0,
    landmarks: Array.isArray(data.landmarks) ? data.landmarks : [],
  };
}

export async function probePythonBridge() {
  if (window.electronAPI?.pythonBridge) {
    try {
      const response = await window.electronAPI.pythonBridge({ op: 'bridge' });
      return {
        ok: Boolean(response?.ok),
        via: 'electron',
        data: response?.data ?? null,
        baseUrl: response?.baseUrl || DEFAULT_PYTHON_BRIDGE_URL,
      };
    } catch {
      return {
        ok: false,
        via: 'electron',
        data: null,
        baseUrl: DEFAULT_PYTHON_BRIDGE_URL,
      };
    }
  }

  const base = DEFAULT_PYTHON_BRIDGE_URL;

  try {
    const bridgeRes = await fetch(`${base}/api/v1/bridge`, {
      method: 'GET',
      mode: 'cors',
    });

    if (bridgeRes.ok) {
      const data = await bridgeRes.json().catch(() => null);
      return { ok: true, via: 'renderer', data, baseUrl: base };
    }

    const healthRes = await fetch(`${base}/health`, {
      method: 'GET',
      mode: 'cors',
    });

    return {
      ok: healthRes.ok,
      via: 'renderer',
      data: null,
      baseUrl: base,
    };
  } catch {
    return {
      ok: false,
      via: 'renderer',
      data: null,
      baseUrl: base,
    };
  }
}

async function tryPythonBridgeAction(action, options, bridgeBase) {
  if (window.electronAPI?.pythonBridge) {
    try {
      const response = await window.electronAPI.pythonBridge({
        op: 'gesture',
        action,
        options: options ?? null,
      });

      if (response?.ok) {
        return { ok: true, via: 'python' };
      }
    } catch (error) {
      console.warn('[GestureOS/Renderer] pythonBridge IPC failed:', error);
    }
  }

  try {
    const res = await fetch(`${bridgeBase}/gesture`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action,
        options: options ?? null,
        source: 'gestureos-renderer',
      }),
      mode: 'cors',
    });

    if (res.ok) {
      return { ok: true, via: 'python' };
    }
  } catch {
    // Fall through.
  }

  return { ok: false, via: null };
}

async function tryElectronAction(action, options) {
  if (!window.electronAPI?.performAction) {
    return { ok: false, via: null };
  }

  try {
    const response = await window.electronAPI.performAction(action, options ?? null);

    if (response?.ok !== false) {
      return { ok: true, via: 'electron' };
    }
  } catch (error) {
    console.warn('[GestureOS/Renderer] electron performAction failed:', error);
  }

  return { ok: false, via: null };
}

async function tryRendererFallback(action) {
  if (action !== 'screenshot') {
    return { ok: false, via: null };
  }

  try {
    await captureCanvasScreenshot();
    return { ok: true, via: 'renderer' };
  } catch (error) {
    console.warn('[GestureOS/Renderer] renderer screenshot fallback failed:', error);
    return { ok: false, via: null };
  }
}

async function invokePerformAction(action, options = null, { silent = false } = {}) {
  if (pythonVisionCollective) {
    const electronResult = await tryElectronAction(action, options);
    if (electronResult.ok) {
      return electronResult;
    }
  }

  const bridgeBase = normalizeBaseUrl(DEFAULT_PYTHON_BRIDGE_URL);

  const pythonResult = await tryPythonBridgeAction(action, options, bridgeBase);
  if (pythonResult.ok) {
    return pythonResult;
  }

  const electronResult = await tryElectronAction(action, options);
  if (electronResult.ok) {
    return electronResult;
  }

  const rendererResult = await tryRendererFallback(action);
  if (rendererResult.ok) {
    return rendererResult;
  }

  if (!silent) {
    console.warn(`[GestureOS/Renderer] No backend available for action "${action}"`);
  }

  throw new Error(`No action backend available for "${action}".`);
}

function buildIndexPointerOptions(state) {
  const tip = state?.landmarks?.[8];
  if (!tip) return null;

  const nx = 1 - Number(tip.x);
  const ny = Number(tip.y);

  if (!Number.isFinite(nx) || !Number.isFinite(ny)) {
    return null;
  }

  return {
    nx: Math.min(1, Math.max(0, nx)),
    ny: Math.min(1, Math.max(0, ny)),
  };
}

function stopRepeatingAction() {
  if (repeatTimer) {
    clearInterval(repeatTimer);
    repeatTimer = null;
  }
  repeatingGesture = null;
}

async function sendPointerMove(nx, ny) {
  if (!canFireAction('move-mouse')) {
    return false;
  }

  try {
    await invokePerformAction('move-mouse', { nx, ny }, { silent: true });
    return true;
  } catch (error) {
    console.error('[GestureOS/Renderer] move-mouse failed:', error);
    return false;
  }
}

async function triggerGesture(gesture, { silent = false, bypassCooldown = false } = {}) {
  const label = gestureLabels[gesture];
  const action = gestureToAction[gesture];

  if (!label || !action) {
    return false;
  }

  if (!canFireAction(action, { bypassCooldown })) {
    return false;
  }

  try {
    await invokePerformAction(action, null, { silent });
  } catch (error) {
    console.error('[GestureOS/Renderer] performAction failed:', error);

    if (!silent) {
      showToast(`Action failed: ${label}`);
    }

    return false;
  }

  if (!silent) {
    logAction(gesture, label);
    speakFeedback(label);
  }

  return true;
}

export function updateGestureActivity(state) {
  const stableGesture = state?.stable ? state.gesture : 'none';

  if (!pythonVisionCollective && state?.handDetected && state?.gesture === 'index') {
    const pointerOptions = buildIndexPointerOptions(state);

    if (pointerOptions) {
      sendPointerMove(pointerOptions.nx, pointerOptions.ny).catch((error) => {
        console.error('[GestureOS/Renderer] pointer move dispatch failed:', error);
      });
    }
  }

  if (!repeatableGestures.has(stableGesture)) {
    stopRepeatingAction();
    return;
  }

  if (repeatingGesture === stableGesture && repeatTimer) {
    return;
  }

  stopRepeatingAction();
  repeatingGesture = stableGesture;

  repeatTimer = setInterval(() => {
    triggerGesture(stableGesture, {
      silent: true,
      bypassCooldown: true,
    }).catch((error) => {
      console.error('[GestureOS/Renderer] repeat gesture failed:', error);
      stopRepeatingAction();
    });
  }, repeatDelayByGesture[stableGesture]);
}

export async function fireAction(gestureStateOrName) {
  const gesture =
    typeof gestureStateOrName === 'string'
      ? gestureStateOrName
      : gestureStateOrName?.gesture;

  if (!gestureLabels[gesture]) {
    return false;
  }

  if (gesture === 'index' && typeof gestureStateOrName === 'object') {
    const pointerOptions = buildIndexPointerOptions(gestureStateOrName);
    return pointerOptions ? sendPointerMove(pointerOptions.nx, pointerOptions.ny) : false;
  }

  return triggerGesture(gesture, {
    silent: false,
    bypassCooldown: false,
  });
}

export async function fireNamedAction(action, options = null) {
  try {
    await invokePerformAction(action, options, { silent: false });
    return true;
  } catch (error) {
    console.error('[GestureOS/Renderer] fireNamedAction failed:', error);
    return false;
  }
}
