import html2canvas from 'html2canvas';
import { speakFeedback } from './tts.js';
import { logAction, showToast } from './ui.js';

let repeatingGesture = null;
let repeatTimer = null;

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

const lastActionFireAt = new Map();
const repeatableGestures = new Set(['palm', 'fist']);
const repeatDelayByGesture = {
  palm: 400,
  fist: 400,
};

export const DEFAULT_PYTHON_BRIDGE_URL =
  (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_PYTHON_BRIDGE_URL) ||
  'http://127.0.0.1:8765';

let pythonVisionCollective = false;

function canFireAction(action, { bypassCooldown }) {
  if (bypassCooldown) return true;
  const gap = actionCooldownMs[action] ?? 750;
  const last = lastActionFireAt.get(action) ?? 0;
  if (Date.now() - last < gap) return false;
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
  const base = String(baseUrl || DEFAULT_PYTHON_BRIDGE_URL).replace(/\/+$/, '');
  if (window.electronAPI?.pythonBridge) {
    const r = await window.electronAPI.pythonBridge({ op: 'state' });
    return r?.ok ? r.data : null;
  }
  try {
    const res = await fetch(`${base}/api/v1/state`, { method: 'GET', mode: 'cors' });
    return res.ok ? await res.json() : null;
  } catch {
    return null;
  }
}

export function mapPythonStateToOverlay(j) {
  if (!j) {
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
    handDetected: Boolean(j.handDetected),
    gesture: j.gesture || 'none',
    confidence: Number(j.confidence) || 0,
    stable: Boolean(j.stable),
    stability: Number(j.stability) || 0,
    fps: Number(j.fps) || 0,
  };
}

export async function probePythonBridge() {
  if (window.electronAPI?.pythonBridge) {
    const r = await window.electronAPI.pythonBridge({ op: 'bridge' });
    return {
      ok: Boolean(r?.ok),
      via: 'electron',
      data: r?.data ?? null,
      baseUrl: r?.baseUrl || DEFAULT_PYTHON_BRIDGE_URL,
    };
  }

  const base = DEFAULT_PYTHON_BRIDGE_URL;
  try {
    const res = await fetch(`${base}/api/v1/bridge`, { method: 'GET', mode: 'cors' });
    if (res.ok) {
      const data = await res.json().catch(() => null);
      return { ok: true, via: 'renderer', data, baseUrl: base };
    }
    const h = await fetch(`${base}/health`, { method: 'GET', mode: 'cors' });
    return { ok: h.ok, via: 'renderer', data: null, baseUrl: base };
  } catch {
    return { ok: false, via: 'renderer', data: null, baseUrl: base };
  }
}

async function invokePerformAction(action, options = null, { silent = false } = {}) {
  if (pythonVisionCollective) {
    return { ok: true, via: 'python-collective' };
  }

  const bridgeBase = DEFAULT_PYTHON_BRIDGE_URL.replace(/\/+$/, '');
  let executedVia = null;

  if (window.electronAPI?.pythonBridge) {
    try {
      const r = await window.electronAPI.pythonBridge({
        op: 'gesture',
        action,
        options: options ?? null,
      });
      if (r?.ok) {
        executedVia = 'python';
      }
    } catch (error) {
      console.warn('[GestureOS/Renderer] python-bridge IPC failed:', error);
    }
  }

  if (!executedVia) {
    try {
      const res = await fetch(`${bridgeBase}/gesture`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, options: options ?? null, source: 'gestureos-renderer' }),
        mode: 'cors',
      });
      if (res.ok) {
        executedVia = 'python';
      }
    } catch {
      // Fall through to Electron/native fallback.
    }
  }

  if (!executedVia && window.electronAPI?.performAction) {
    await window.electronAPI.performAction(action, options ?? null);
    executedVia = 'electron';
  }

  if (!executedVia && action === 'screenshot') {
    await captureCanvasScreenshot();
    executedVia = 'renderer';
  }

  if (!executedVia) {
    throw new Error(`No action backend available for "${action}".`);
  }

  if (!silent && executedVia !== 'python-collective') {
    const routeLabel =
      executedVia === 'python'
        ? 'Python bridge'
        : executedVia === 'electron'
          ? 'Electron native bridge'
          : 'renderer fallback';
    showToast(`Action "${action}" executed via ${routeLabel}.`);
  }

  return { ok: true, via: executedVia };
}

function buildIndexPointerOptions(state) {
  const tip = state?.landmarks?.[8];
  if (!tip) return null;

  const nx = 1 - Number(tip.x);
  const ny = Number(tip.y);
  if (!Number.isFinite(nx) || !Number.isFinite(ny)) return null;

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
  if (!canFireAction('move-mouse', { bypassCooldown: false })) return false;
  try {
    await invokePerformAction('move-mouse', { nx, ny }, { silent: true });
    return true;
  } catch {
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
  } catch (err) {
    console.error('[GestureOS/Renderer] performAction failed:', err);
    showToast(`Action failed: ${label}`);
    return false;
  }

  if (!silent) {
    logAction(gesture, label);
    speakFeedback(label);
  }
  return true;
}

export function updateGestureActivity(state) {
  const gesture = state?.stable ? state.gesture : 'none';

  if (!pythonVisionCollective && state?.handDetected && state?.gesture === 'index') {
    const options = buildIndexPointerOptions(state);
    if (options) {
      sendPointerMove(options.nx, options.ny).catch((error) => {
        console.error('[GestureOS/Renderer] move-mouse failed:', error);
      });
    }
  }

  if (!repeatableGestures.has(gesture)) {
    stopRepeatingAction();
    return;
  }

  if (repeatingGesture === gesture && repeatTimer) {
    return;
  }

  stopRepeatingAction();
  repeatingGesture = gesture;
  repeatTimer = setInterval(() => {
    triggerGesture(gesture, { silent: true, bypassCooldown: true }).catch((error) => {
      console.error('[GestureOS/Renderer] repeat gesture failed:', error);
      stopRepeatingAction();
    });
  }, repeatDelayByGesture[gesture]);
}

export async function fireAction(gestureStateOrName) {
  const gesture =
    typeof gestureStateOrName === 'string' ? gestureStateOrName : gestureStateOrName?.gesture;

  if (!gestureLabels[gesture]) {
    return false;
  }

  if (gesture === 'index' && typeof gestureStateOrName === 'object' && gestureStateOrName?.landmarks) {
    const options = buildIndexPointerOptions(gestureStateOrName);
    return options ? sendPointerMove(options.nx, options.ny) : false;
  }

  console.log('[GestureOS/Renderer] stable gesture detected ->', gesture, '->', gestureToAction[gesture]);
  return triggerGesture(gesture, { silent: false, bypassCooldown: false });
}
