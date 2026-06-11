import html2canvas from 'html2canvas';
import { speakFeedback } from './tts.js';
import { logAction, showActionFeedback, showToast } from './ui.js';
import { getCalibration, getGestureAction, getGestureActionLabel } from './control-state.js';

let repeatingGesture = null;
let repeatTimer = null;
let pythonVisionCollective = false;
let stableGesture = 'none';
let stableGestureSince = 0;
let stableGestureDispatched = false;
let pointerState = { sx: null, sy: null };

export const defaultGestureLabels = {
  palm: 'Scroll up',
  fist: 'Scroll down',
  peace: 'Screenshot',
  thumb: 'Play or pause',
  index: 'Move pointer',
  pinch: 'Left click',
};

export const actionCooldownMs = {
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
  'browser-back': 900,
  'browser-forward': 900,
  refresh: 900,
  'next-slide': 950,
  'previous-slide': 950,
  'start-slideshow': 1200,
  'end-slideshow': 1200,
  'blackout-slide': 900,
  'laser-pointer': 32,
  'mute-audio': 800,
};

const repeatableGestures = new Set(['palm', 'fist']);
const lastActionFireAt = new Map();

export const DEFAULT_PYTHON_BRIDGE_URL =
  (typeof import.meta !== 'undefined' &&
    import.meta.env &&
    import.meta.env.VITE_PYTHON_BRIDGE_URL) ||
  'http://127.0.0.1:8765';

function normalizeBaseUrl(baseUrl) {
  return String(baseUrl || DEFAULT_PYTHON_BRIDGE_URL).replace(/\/+$/, '');
}

function getBackendUnavailableMessage(actionLabel) {
  const electronAvailable = Boolean(window.electronAPI?.performAction);
  const bridgeBase = normalizeBaseUrl(DEFAULT_PYTHON_BRIDGE_URL);

  if (!electronAvailable) {
    return `Action backend unavailable for ${actionLabel}. Open Gestra in the Electron desktop app, not only in the browser.`;
  }

  return `Action backend unavailable for ${actionLabel}. Check that the desktop bridge or Python bridge at ${bridgeBase} is running.`;
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
  link.download = `gestra-${Date.now()}.png`;
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

      if (response?.ok) { return { ok: true, via: 'python' }; } return { ok: false, via: 'python', message: response?.message };
    } catch (error) {
      console.warn('[Gestra/Renderer] pythonBridge IPC failed:', error);
    }
  }

  try {
    const res = await fetch(`${bridgeBase}/gesture`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action,
        options: options ?? null,
        source: 'gestra-renderer',
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

    if (response?.ok !== false) { return { ok: true, via: 'electron' }; } return { ok: false, via: 'electron', message: response?.message };
  } catch (error) {
    console.warn('[Gestra/Renderer] electron performAction failed:', error);
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
    console.warn('[Gestra/Renderer] renderer screenshot fallback failed:', error);
    return { ok: false, via: null };
  }
}

async function yieldFocusForExternalAction(action) {
  if (!window.electronAPI?.yieldFocusToDesktop) {
    return;
  }

  const normalized = String(action || '').trim().toLowerCase();
  if (!normalized) {
    return;
  }

  try {
    await window.electronAPI.yieldFocusToDesktop({
      hideWindow: true,
      delayMs: normalized === 'move-mouse' ? 60 : 180,
    });
  } catch (error) {
    console.warn('[Gestra/Renderer] yieldFocusToDesktop failed:', error);
  }
}

function prefersElectronDesktopRoute(action) {
  const normalized = String(action || '').trim().toLowerCase();
  return new Set([
    'scroll-up',
    'scroll-down',
    'left-click',
    'right-click',
    'play-pause',
    'media-toggle',
    'browser-back',
    'browser-forward',
    'refresh',
    'screenshot',
    'next-slide',
    'previous-slide',
    'start-slideshow',
    'end-slideshow',
    'blackout-slide',
    'alt-tab',
    'volume-up',
    'volume-down',
    'mute-audio',
  ]).has(normalized);
}

async function invokePerformAction(action, options = null, { silent = false } = {}) {
  await yieldFocusForExternalAction(action);

  if (window.electronAPI?.performAction && prefersElectronDesktopRoute(action)) {
    const electronResult = await tryElectronAction(action, options);
    if (electronResult.ok) {
      return electronResult;
    }
  }

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
    console.warn(`[Gestra/Renderer] No backend available for action "${action}"`);
  }

  throw new Error(`No action backend available for "${action}".`);
}

function buildIndexPointerOptions(state) {
  const tip = state?.landmarks?.[8];
  if (!tip) return null;

  const calibration = getCalibration();
  const frameLeft = Number(calibration.frameLeft ?? 0.08);
  const frameRight = Number(calibration.frameRight ?? 0.92);
  const frameTop = Number(calibration.frameTop ?? 0.08);
  const frameBottom = Number(calibration.frameBottom ?? 0.92);
  const nxRaw = 1 - Number(tip.x) + Number(calibration.horizontalBias || 0);
  const nyRaw = Number(tip.y);

  if (!Number.isFinite(nxRaw) || !Number.isFinite(nyRaw)) {
    return null;
  }

  const nxNormalized = (nxRaw - frameLeft) / Math.max(0.01, frameRight - frameLeft);
  const nyNormalized = (nyRaw - frameTop) / Math.max(0.01, frameBottom - frameTop);

  const deadzone = Number(calibration.deadzone || 0.04);
  const cx = Math.max(0, Math.min(1, nxNormalized));
  const cy = Math.max(0, Math.min(1, nyNormalized));
  const dx = cx - 0.5;
  const dy = cy - 0.5;

  if (Math.abs(dx) < deadzone && Math.abs(dy) < deadzone) {
    return null;
  }

  const smoothness = Math.max(0.1, Math.min(0.95, Number(calibration.pointerSmoothness ?? 0.5)));
  pointerState.sx = pointerState.sx == null ? cx : pointerState.sx + (cx - pointerState.sx) * (1 - smoothness);
  pointerState.sy = pointerState.sy == null ? cy : pointerState.sy + (cy - pointerState.sy) * (1 - smoothness);

  return {
    nx: Math.min(1, Math.max(0, pointerState.sx)),
    ny: Math.min(1, Math.max(0, pointerState.sy)),
  };
}

function stopRepeatingAction() {
  if (repeatTimer) {
    clearInterval(repeatTimer);
    repeatTimer = null;
  }
  repeatingGesture = null;
}

export function resetGestureActivity() {
  stopRepeatingAction();
  stableGesture = 'none';
  stableGestureSince = 0;
  stableGestureDispatched = false;
  pointerState = { sx: null, sy: null };
}

async function sendPointerMove(nx, ny) {
  const action = getGestureAction('index');
  if (!canFireAction(action || 'move-mouse')) {
    return false;
  }

  try {
    await invokePerformAction(action || 'move-mouse', { nx, ny }, { silent: true });
    return true;
  } catch (error) {
    console.error('[Gestra/Renderer] move-mouse failed:', error);
    return false;
  }
}

async function triggerGesture(gesture, { silent = false, bypassCooldown = false } = {}) {
  const label = getGestureActionLabel(gesture);
  const action = getGestureAction(gesture);

  if (!label || !action) {
    return false;
  }

  if (!canFireAction(action, { bypassCooldown })) {
    return false;
  }

  try {
    await invokePerformAction(action, null, { silent });
  } catch (error) {
    console.error('[Gestra/Renderer] performAction failed:', error);

    if (!silent) {
      const detail = String(error?.message || error || '').trim();
      if (detail.includes('No action backend available')) {
        showToast(getBackendUnavailableMessage(label));
      } else if (detail.includes('Action logic failed:')) {
        showToast(`Action failed: ${label} - ${detail.replace(/Error:?\s*Action logic failed:\s*/, '').trim()}`);
      } else {
        showToast(`Action failed: ${label}`);
      }
    }

    return false;
  }

  if (!silent) {
    logAction(gesture, label);
    showActionFeedback(label, `${label} sent through the ${action} route.`, {
      tone: 'ready',
      cooldownMs: actionCooldownMs[action] ?? 0,
    });
    speakFeedback(label);
  }

  return true;
}

export function updateGestureActivity(state) {
  if (pythonVisionCollective) {
    stopRepeatingAction();
    return;
  }

  const nextStableGesture = state?.stable ? state.gesture : 'none';
  const calibration = getCalibration();

  if (state?.handDetected && state?.gesture === 'index') {
    const pointerOptions = buildIndexPointerOptions(state);

    if (pointerOptions) {
      sendPointerMove(pointerOptions.nx, pointerOptions.ny).catch((error) => {
        console.error('[Gestra/Renderer] pointer move dispatch failed:', error);
      });
    }
  }

  if (nextStableGesture !== 'none') {
    if (nextStableGesture !== stableGesture) {
      stableGesture = nextStableGesture;
      stableGestureSince = Date.now();
      stableGestureDispatched = false;
      stopRepeatingAction();
    }
  } else {
    stableGesture = 'none';
    stableGestureSince = 0;
    stableGestureDispatched = false;
    stopRepeatingAction();
  }

  if (!repeatableGestures.has(nextStableGesture)) {
    stopRepeatingAction();
    return;
  }

  if (repeatingGesture === nextStableGesture && repeatTimer) {
    return;
  }

  const holdMs = Math.max(160, Number(calibration.holdMs) || 360);
  if (Date.now() - stableGestureSince < holdMs) {
    return;
  }

  stopRepeatingAction();
  repeatingGesture = nextStableGesture;

  repeatTimer = setInterval(() => {
    triggerGesture(nextStableGesture, {
      silent: true,
      bypassCooldown: true,
    }).catch((error) => {
      console.error('[Gestra/Renderer] repeat gesture failed:', error);
      stopRepeatingAction();
    });
  }, Math.max(220, Number(calibration.repeatDelayMs) || 420));
}

export async function fireAction(gestureStateOrName) {
  const gesture =
    typeof gestureStateOrName === 'string'
      ? gestureStateOrName
      : gestureStateOrName?.gesture;

  if (!defaultGestureLabels[gesture]) {
    return false;
  }

  if (gesture === 'index' && typeof gestureStateOrName === 'object') {
    const pointerOptions = buildIndexPointerOptions(gestureStateOrName);
    return pointerOptions ? sendPointerMove(pointerOptions.nx, pointerOptions.ny) : false;
  }

  const holdMs = Math.max(160, Number(getCalibration().holdMs) || 360);
  const isStateObject = typeof gestureStateOrName === 'object' && gestureStateOrName;
  if (isStateObject) {
    if (!gestureStateOrName.stable || Date.now() - stableGestureSince < holdMs) {
      return false;
    }
    if (stableGestureDispatched && !repeatableGestures.has(gesture)) {
      return false;
    }
  }

  stableGestureDispatched = true;
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
    console.error('[Gestra/Renderer] fireNamedAction failed:', error);
    return false;
  }
}
