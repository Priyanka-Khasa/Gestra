import html2canvas from 'html2canvas';
import { speakFeedback } from './tts.js';
import { logAction, showToast } from './ui.js';

let repeatingGesture = null;
let repeatTimer = null;

/** MediaPipe gesture id → human label (UI / TTS) */
const gestureLabels = {
  palm: 'Scroll up',
  fist: 'Scroll down',
  peace: 'Screenshot',
  thumb: 'Play or pause media',
  index: 'Left click',
};

/**
 * MediaPipe → OS action (kebab-case, matches main process).
 * Conceptual names: open_palm → scroll-up, fist → scroll-down, peace → screenshot,
 * thumbs_up → play-pause, point → left-click
 */
const gestureToAction = {
  palm: 'scroll-up',
  fist: 'scroll-down',
  peace: 'screenshot',
  thumb: 'play-pause',
  index: 'left-click',
};

/** Min ms between non-repeating fires of the same action */
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

async function invokePerformAction(action, options = null) {
  console.log(
    '[GestureOS/Renderer] OS automation stubbed — use `python-core` (MediaPipe + PyAutoGUI) for real control.',
    action,
    options ?? ''
  );

  try {
    await fetch('http://127.0.0.1:8765/gesture', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, options: options ?? null, source: 'gestureos-renderer' }),
      mode: 'cors',
    });
  } catch {
    // Optional: start Python with `python main.py --api` to receive events; otherwise ignore.
  }

  if (action === 'screenshot') {
    await captureCanvasScreenshot();
    return;
  }

  showToast(`OS action "${action}" is handled by the Python engine (see README).`);
}

function stopRepeatingAction() {
  if (repeatTimer) {
    clearInterval(repeatTimer);
    repeatTimer = null;
  }
  repeatingGesture = null;
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
    await invokePerformAction(action);
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

  console.log('[GestureOS/Renderer] stable gesture detected →', gesture, '→', gestureToAction[gesture]);
  return triggerGesture(gesture, { silent: false, bypassCooldown: false });
}
