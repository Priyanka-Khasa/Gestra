import { getCalibration, getGestureActionLabel } from './control-state.js';

const labelMap = {
  palm: 'Open palm',
  fist: 'Closed fist',
  peace: 'Peace sign',
  thumb: 'Thumbs up',
  index: 'Pointing',
  pinch: 'Pinch',
  none: 'Searching',
};

let cooldownTimer = null;

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.innerText = value;
}

function setFeedbackState(title, detail, tone = 'idle') {
  setText('feedback-chip', title);
  setText('feedback-detail', detail);

  const dot = document.getElementById('feedback-status-dot');
  if (!dot) return;

  const tones = {
    idle: 'bg-slate-700',
    active: 'bg-amber-400',
    ready: 'bg-emerald-300',
    error: 'bg-rose-400',
  };
  dot.className = `h-3 w-3 rounded-full ${tones[tone] || tones.idle}`;
}

function setInteractionHint(title, body) {
  setText('interaction-hint-title', title);
  setText('interaction-hint-body', body);
}

export function startActionCooldown(ms = 0) {
  const fill = document.getElementById('action-cooldown-fill');
  const label = document.getElementById('action-cooldown-label');
  if (!fill || !label || !Number.isFinite(ms) || ms <= 0) {
    if (fill) fill.style.width = '0%';
    if (label) label.innerText = 'Idle';
    return;
  }

  if (cooldownTimer) {
    clearInterval(cooldownTimer);
    cooldownTimer = null;
  }

  const startedAt = Date.now();
  label.innerText = `${(ms / 1000).toFixed(1)}s`;
  fill.style.width = '100%';

  cooldownTimer = setInterval(() => {
    const elapsed = Date.now() - startedAt;
    const left = Math.max(0, ms - elapsed);
    const pct = (left / ms) * 100;
    fill.style.width = `${pct}%`;
    label.innerText = left > 0 ? `${(left / 1000).toFixed(1)}s` : 'Ready';

    if (left <= 0) {
      clearInterval(cooldownTimer);
      cooldownTimer = null;
    }
  }, 80);
}

export function showActionFeedback(title, detail, { tone = 'ready', cooldownMs = 0 } = {}) {
  setFeedbackState(title, detail, tone);
  startActionCooldown(cooldownMs);
}

export function updateOverlay(state) {
  const fpsCounter = document.getElementById('fps-counter');
  const stabilityCounter = document.getElementById('stability-counter');
  const labelEl = document.getElementById('detected-gesture-label');
  const barEl = document.getElementById('confidence-bar');
  const camContainer = document.getElementById('camera-container');

  if (fpsCounter) fpsCounter.innerText = Math.round(state.fps || 0);
  if (stabilityCounter) stabilityCounter.innerText = `${Math.round((state.stability || 0) * 100)}%`;

  const visible = state.handDetected && state.gesture !== 'none';
  const stable = visible && state.stable;
  const gestureLabel = labelMap[state?.gesture] || state?.gesture || 'Searching';

  if (labelEl && barEl) {
    if (visible) {
      labelEl.classList.toggle('stable', stable);
      labelEl.innerText = stable ? `${gestureLabel} locked` : `${gestureLabel} detected`;
      barEl.style.width = `${Math.max(0, Math.min((state.confidence || 0) * 100, 100))}%`;
    } else {
      labelEl.classList.remove('stable');
      labelEl.innerText = 'Show a gesture';
      barEl.style.width = '0%';
    }
  }

  setText('hand-presence', state.handDetected ? 'Visible' : 'Not visible');
  setText('gesture-phase', stable ? 'Locked' : visible ? 'Tracking' : 'Waiting');

  if (!state.handDetected) {
    setFeedbackState('Waiting for input', 'Camera is live but no hand is confidently visible yet.', 'idle');
    setInteractionHint('No active gesture', 'Keep one hand inside frame with clear lighting and enough contrast.');
  } else if (stable) {
    const holdMs = Math.max(160, Number(getCalibration().holdMs) || 360);
    setFeedbackState('Gesture locked', `${gestureLabel} is stable. Gestra will fire ${getGestureActionLabel(state.gesture)} after ${holdMs}ms.`, 'ready');
  } else {
    setFeedbackState('Tracking hand', `${gestureLabel} is visible but not stable enough yet.`, 'active');
  }

  if (state.gesture === 'index') {
    const deadzone = Math.round((Number(getCalibration().deadzone) || 0.04) * 100);
    setInteractionHint('Pointer mode', `Move your index finger slowly for precise cursor control. Current deadzone: ${deadzone}%.`);
  } else if (state.gesture === 'pinch') {
    setInteractionHint('Click mode', `Pinch is mapped to ${getGestureActionLabel('pinch')}. Use a short hold to avoid accidental repeats.`);
  } else if (state.gesture === 'palm' || state.gesture === 'fist') {
    setInteractionHint('Hold gesture', `Keep the pose steady to repeat ${getGestureActionLabel(state.gesture).toLowerCase()} without re-triggering jitter.`);
  }

  camContainer?.classList.toggle('glow-border', stable);
  updateSystemStatus(
    stable ? `${gestureLabel} ready` : state.handDetected ? 'Tracking hand' : 'Waiting for camera input',
    stable ? 'bg-emerald-300' : state.handDetected ? 'bg-amber-400' : 'bg-slate-700',
    stable ? 'Gesture confidence is high enough to act.' : state.handDetected ? 'Keep the hand steady to lock the gesture.' : 'Show a hand to begin tracking.',
    stable ? 'Ready' : state.handDetected ? 'Tracking' : 'Idle'
  );
  updateGestureReferenceCards(state.gesture, stable);
}

function updateGestureReferenceCards(activeGesture, isStable) {
  ['palm', 'fist', 'peace', 'thumb', 'index', 'pinch'].forEach((gesture) => {
    const card = document.getElementById(`gesture-${gesture}`);
    if (!card) return;

    const active = gesture === activeGesture && isStable;
    card.classList.toggle('pulse-active', active);
  });
}

export function logAction(gesture, actionDesc) {
  const logContainer = document.getElementById('action-log');
  if (!logContainer) return;

  const time = new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' });
  const logEntry = document.createElement('div');
  logEntry.className = 'flex items-center gap-3 p-3 bg-white/[0.03] border border-white/5 rounded-xl animate-[slideInUp_0.3s_ease-out] pointer-events-auto';
  logEntry.innerHTML = `
    <div class="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center text-accent">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M20 6 9 17l-5-5"/></svg>
    </div>
    <div class="flex-1">
      <div class="text-[10px] font-black text-slate-500 uppercase tracking-tighter">${time}</div>
      <div class="text-xs font-bold text-slate-200">${actionDesc}</div>
      <div class="text-[11px] text-slate-500">${labelMap[gesture] || gesture}</div>
    </div>
  `;

  logContainer.prepend(logEntry);
  if (logContainer.children.length > 20) logContainer.lastChild.remove();
}

export function updateSystemStatus(text, dotColor, detail = '', mode = '') {
  const textEl = document.getElementById('system-status-text');
  const dot = document.getElementById('system-status-dot');
  const subtext = document.getElementById('runtime-subtext');
  const modeChip = document.getElementById('runtime-mode-chip');
  if (textEl) textEl.innerText = text;
  if (dot) dot.className = `h-2 w-2 rounded-full ${dotColor}`;
  if (subtext && detail) subtext.innerText = detail;
  if (modeChip && mode) modeChip.innerText = mode;
}

export function resetRuntimeUi({
  statusText = 'Runtime paused',
  statusDot = 'bg-slate-700',
  detail = 'Press Start Runtime to begin gesture tracking.',
  mode = 'Paused',
  feedbackTitle = 'Runtime paused',
  feedbackDetail = 'Gesture tracking is stopped. Start the runtime when you want camera control again.',
  hintTitle = 'No active gesture',
  hintBody = 'Start the runtime to reconnect the camera feed and resume gesture detection.',
} = {}) {
  updateOverlay({
    handDetected: false,
    gesture: 'none',
    confidence: 0,
    stable: false,
    stability: 0,
    fps: 0,
  });
  updateSystemStatus(statusText, statusDot, detail, mode);
  setFeedbackState(feedbackTitle, feedbackDetail, 'idle');
  setInteractionHint(hintTitle, hintBody);
  startActionCooldown(0);
}

export function showToast(message) {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const el = document.createElement('div');
  el.className =
    'bg-slate-900/90 backdrop-blur text-white px-4 py-2 mb-2 rounded-lg shadow-xl outline outline-1 outline-white/10 transition-opacity duration-300';
  el.textContent = message;
  container.appendChild(el);

  setTimeout(() => {
    el.style.opacity = '0';
    setTimeout(() => el.remove(), 300);
  }, 2600);
}

document.addEventListener('DOMContentLoaded', () => {
  const testBtn = document.getElementById('test-bridge-btn');
  if (!testBtn) return;

  testBtn.onclick = async () => {
    if (window.electronAPI?.performAction) {
      await window.electronAPI.performAction('scroll-up');
    } else {
      showToast('Electron bridge is unavailable in browser mode.');
    }
  };
});
