// src/components/status-card.component.js

const $ = (id) => document.getElementById(id);

const els = {
  statusDot: $("system-status-dot"),
  statusText: $("system-status-text"),

  runtimeMode: $("runtime-mode-chip"),
  runtimeSubtext: $("runtime-subtext"),

  fps: $("fps-counter"),
  stability: $("stability-counter"),
  handPresence: $("hand-presence"),
  gesturePhase: $("gesture-phase"),

  feedbackChip: $("feedback-chip"),
};

function updateStatus(type) {
  if (!els.statusDot || !els.statusText) return;

  els.statusDot.classList.remove(
    "bg-emerald-400",
    "bg-red-400",
    "bg-yellow-400"
  );

  switch (type) {
    case "active":
      els.statusDot.classList.add("bg-emerald-400");
      els.statusText.textContent = "Runtime Active";
      break;

    case "warning":
      els.statusDot.classList.add("bg-yellow-400");
      els.statusText.textContent = "Waiting For Hand";
      break;

    default:
      els.statusDot.classList.add("bg-red-400");
      els.statusText.textContent = "Runtime Offline";
  }
}

export function setRuntimeActive() {
  updateStatus("active");

  if (els.runtimeMode)
    els.runtimeMode.textContent = "Camera Mode";

  if (els.runtimeSubtext)
    els.runtimeSubtext.textContent =
      "Gesture engine is running";
}

export function setRuntimeWaiting() {
  updateStatus("warning");

  if (els.runtimeMode)
    els.runtimeMode.textContent = "Scanning";

  if (els.runtimeSubtext)
    els.runtimeSubtext.textContent =
      "Searching for visible hand";
}

export function setRuntimeOffline() {
  updateStatus("offline");

  if (els.runtimeMode)
    els.runtimeMode.textContent = "Offline";

  if (els.runtimeSubtext)
    els.runtimeSubtext.textContent =
      "Runtime not started";
}

export function updateFPS(value) {
  if (els.fps)
    els.fps.textContent = `${value}`;
}

export function updateStability(value) {
  if (els.stability)
    els.stability.textContent = `${value}%`;
}

export function updateHandPresence(text) {
  if (els.handPresence)
    els.handPresence.textContent = text;
}

export function updateGesturePhase(text) {
  if (els.gesturePhase)
    els.gesturePhase.textContent = text;
}

export function updateFeedback(text) {
  if (els.feedbackChip)
    els.feedbackChip.textContent = text;
}

export function updateStatusCard({
  fps,
  stability,
  handPresence,
  gesturePhase,
  feedback,
} = {}) {
  if (fps !== undefined) updateFPS(fps);
  if (stability !== undefined)
    updateStability(stability);

  if (handPresence)
    updateHandPresence(handPresence);

  if (gesturePhase)
    updateGesturePhase(gesturePhase);

  if (feedback)
    updateFeedback(feedback);
}

export function initStatusCard() {
  setRuntimeOffline();
}