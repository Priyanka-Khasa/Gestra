// src/components/assistant-panel.component.js

const $ = (id) => document.getElementById(id);

const els = {
  toggleBtn: $("assistant-toggle"),
  panel: $("assistant-panel"),
  closeBtn: $("assistant-close"),

  form: $("assistant-form"),
  input: $("assistant-input"),
  messages: $("assistant-messages"),

  micBtn: $("assistant-mic-toggle"),
  status: $("assistant-status"),
};

function openAssistantPanel() {
  els.panel?.classList.remove("hidden");
}

function closeAssistantPanel() {
  els.panel?.classList.add("hidden");
}

function toggleAssistantPanel() {
  els.panel?.classList.toggle("hidden");
}

function addMessage(text, sender = "user") {
  if (!els.messages) return;

  const bubble = document.createElement("div");

  bubble.className =
    sender === "user"
      ? "ml-auto max-w-[85%] rounded-2xl bg-[#A27B5C]/20 px-4 py-3 text-sm leading-6 text-slate-100"
      : "mr-auto max-w-[85%] rounded-2xl border border-white/[0.08] bg-white/[0.04] px-4 py-3 text-sm leading-6 text-slate-300";

  bubble.textContent = text;

  els.messages.appendChild(bubble);
  els.messages.scrollTop = els.messages.scrollHeight;
}

function handleAssistantSubmit(event) {
  event.preventDefault();

  const message = els.input?.value.trim();
  if (!message) return;

  addMessage(message, "user");
  els.input.value = "";

  setTimeout(() => {
    addMessage(
      "Assistant is connected to the UI. Real AI response logic will be added later.",
      "assistant"
    );
  }, 300);
}

function handleMicToggle() {
  if (!els.status) return;

  const isListening = els.micBtn?.dataset.listening === "true";

  if (isListening) {
    els.micBtn.dataset.listening = "false";
    els.status.textContent = "Voice input off";
  } else {
    els.micBtn.dataset.listening = "true";
    els.status.textContent = "Listening...";
  }
}

function bindAssistantEvents() {
  els.toggleBtn?.addEventListener("click", toggleAssistantPanel);
  els.closeBtn?.addEventListener("click", closeAssistantPanel);
  els.form?.addEventListener("submit", handleAssistantSubmit);
  els.micBtn?.addEventListener("click", handleMicToggle);
}

export function initAssistantPanel() {
  bindAssistantEvents();
}

export function sendAssistantMessage(text, sender = "assistant") {
  addMessage(text, sender);
}

export function showAssistantPanel() {
  openAssistantPanel();
}

export function hideAssistantPanel() {
  closeAssistantPanel();
}