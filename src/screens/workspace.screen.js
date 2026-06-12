// src/screens/workspace-screen.js

const $ = (id) => document.getElementById(id);

const els = {
  app: $("app-container"),

  startBtn: $("start-btn"),
  stopBtn: $("stop-btn"),

  webcam: $("webcam-feed"),
  pythonFeed: $("python-vision-feed"),

  loadingOverlay: $("loading-overlay"),
  loadingText: $("loading-text"),
  loadingBar: $("loading-bar"),

  statusText: $("system-status-text"),
  statusDot: $("system-status-dot"),
  runtimeModeChip: $("runtime-mode-chip"),
  runtimeSubtext: $("runtime-subtext"),

  fpsCounter: $("fps-counter"),
  stabilityCounter: $("stability-counter"),
  handPresence: $("hand-presence"),
  gesturePhase: $("gesture-phase"),
  feedbackChip: $("feedback-chip"),

  detectedGestureLabel: $("detected-gesture-label"),
  confidenceBar: $("confidence-bar"),
  confidenceSlider: $("confidence-slider"),
  thresholdValue: $("threshold-value"),

  actionLog: $("action-log"),
  clearLogBtn: $("clear-log-btn"),

  cooldownLabel: $("action-cooldown-label"),
  cooldownFill: $("action-cooldown-fill"),

  assistantToggle: $("assistant-toggle"),
  assistantPanel: $("assistant-panel"),
  assistantClose: $("assistant-close"),
  assistantForm: $("assistant-form"),
  assistantInput: $("assistant-input"),
  assistantMessages: $("assistant-messages"),
  assistantMicToggle: $("assistant-mic-toggle"),
  assistantStatus: $("assistant-status"),
};

let stream = null;
let runtimeActive = false;

function setText(el, value) {
  if (el) el.textContent = value;
}

function setVisible(el, show) {
  if (!el) return;
  el.classList.toggle("hidden", !show);
}

function addLog(message, type = "info") {
  if (!els.actionLog) return;

  const item = document.createElement("div");
  item.className =
    "rounded-2xl border border-white/[0.08] bg-white/[0.04] px-4 py-3 text-xs leading-6 text-slate-300";

  item.innerHTML = `
    <div class="flex items-center justify-between gap-3">
      <span class="font-semibold text-white">${message}</span>
      <span class="text-[10px] uppercase tracking-[0.16em] text-slate-500">${type}</span>
    </div>
    <p class="mt-1 text-[10px] text-slate-500">${new Date().toLocaleTimeString()}</p>
  `;

  els.actionLog.prepend(item);
}

function updateRuntimeUI(active) {
  runtimeActive = active;

  setText(els.statusText, active ? "Runtime active" : "Runtime offline");
  setText(els.runtimeModeChip, active ? "Camera mode" : "Offline");
  setText(els.runtimeSubtext, active ? "Gesture engine is watching" : "Start runtime to begin");
  setText(els.loadingText, active ? "Runtime active" : "Runtime offline");
  setText(els.handPresence, active ? "Waiting" : "Not visible");
  setText(els.gesturePhase, active ? "Scanning" : "Idle");
  setText(els.feedbackChip, active ? "Ready" : "Stopped");

  if (els.loadingBar) els.loadingBar.style.width = active ? "100%" : "0%";
  if (els.statusDot) {
    els.statusDot.classList.toggle("bg-emerald-400", active);
    els.statusDot.classList.toggle("bg-red-400", !active);
  }

  setVisible(els.loadingOverlay, !active);
  if (els.startBtn) els.startBtn.disabled = active;
  if (els.stopBtn) els.stopBtn.disabled = !active;
}

async function startCamera() {
  if (!els.webcam) return;

  stream = await navigator.mediaDevices.getUserMedia({
    video: {
      width: { ideal: 1280 },
      height: { ideal: 720 },
      facingMode: "user",
    },
    audio: false,
  });

  els.webcam.srcObject = stream;
  await els.webcam.play();
}

function stopCamera() {
  if (stream) {
    stream.getTracks().forEach((track) => track.stop());
    stream = null;
  }

  if (els.webcam) {
    els.webcam.pause();
    els.webcam.srcObject = null;
  }
}

async function startWorkspaceRuntime() {
  try {
    updateRuntimeUI(false);
    setText(els.loadingText, "Starting camera...");
    if (els.loadingBar) els.loadingBar.style.width = "45%";

    await startCamera();

    updateRuntimeUI(true);
    addLog("Runtime started", "system");
  } catch (error) {
    updateRuntimeUI(false);
    setText(els.loadingText, "Camera permission failed");
    addLog("Camera permission failed", "error");
    console.error(error);
  }
}

function stopWorkspaceRuntime() {
  stopCamera();
  updateRuntimeUI(false);
  addLog("Runtime stopped", "system");
}

function setupConfidenceSlider() {
  if (!els.confidenceSlider) return;

  const sync = () => {
    const value = els.confidenceSlider.value;
    setText(els.thresholdValue, `${value}%`);
    addLog(`Confidence threshold set to ${value}%`, "config");
  };

  els.confidenceSlider.addEventListener("input", sync);
  sync();
}

function setupActionLog() {
  els.clearLogBtn?.addEventListener("click", () => {
    if (els.actionLog) els.actionLog.innerHTML = "";
    addLog("Action log cleared", "system");
  });
}

function setupAssistant() {
  els.assistantToggle?.addEventListener("click", () => {
    els.assistantPanel?.classList.toggle("hidden");
  });

  els.assistantClose?.addEventListener("click", () => {
    els.assistantPanel?.classList.add("hidden");
  });

  els.assistantForm?.addEventListener("submit", (event) => {
    event.preventDefault();

    const message = els.assistantInput?.value.trim();
    if (!message || !els.assistantMessages) return;

    const bubble = document.createElement("div");
    bubble.className =
      "ml-auto max-w-[85%] rounded-2xl bg-[#A27B5C]/20 px-4 py-3 text-sm text-slate-100";
    bubble.textContent = message;

    els.assistantMessages.appendChild(bubble);
    els.assistantInput.value = "";
    els.assistantMessages.scrollTop = els.assistantMessages.scrollHeight;
  });

  els.assistantMicToggle?.addEventListener("click", () => {
    setText(els.assistantStatus, "Voice input not connected yet");
  });
}

function setupRuntimeButtons() {
  els.startBtn?.addEventListener("click", startWorkspaceRuntime);
  els.stopBtn?.addEventListener("click", stopWorkspaceRuntime);
}

export function initWorkspaceScreen() {
  setupRuntimeButtons();
  setupConfidenceSlider();
  setupActionLog();
  setupAssistant();
  updateRuntimeUI(false);
  addLog("Workspace loaded", "system");
}

export function destroyWorkspaceScreen() {
  stopWorkspaceRuntime();
}