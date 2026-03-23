import { createAIClient } from './ai.js';
import { initVoiceActivation } from './voice.js';

function formatTime(date = new Date()) {
  return date.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function escapeHtml(value) {
  return String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

document.addEventListener('DOMContentLoaded', () => {
  const root = document.getElementById('assistant-root');
  if (!root) return;

  const toggleBtn = document.getElementById('assistant-toggle');
  const panel = document.getElementById('assistant-panel');
  const closeBtn = document.getElementById('assistant-close');
  const micBtn = document.getElementById('assistant-mic-toggle');
  const statusEl = document.getElementById('assistant-status');
  const form = document.getElementById('assistant-form');
  const input = document.getElementById('assistant-input');
  const messages = document.getElementById('assistant-messages');

  if (!toggleBtn || !panel || !closeBtn || !micBtn || !statusEl || !form || !input || !messages) {
    return;
  }

  const client = createAIClient();
  const history = [];
  const MAX_HISTORY_ITEMS = 12;
  const VOICE_COOLDOWN_MS = 2500;

  let busy = false;
  let isOpen = false;
  let voiceEnabled = false;
  let lastVoiceCommandAt = 0;

  const providerLabel = 'RunAnywhere';

  const trimHistory = () => {
    while (history.length > MAX_HISTORY_ITEMS) {
      history.shift();
    }
  };

  const setOpen = (open) => {
    isOpen = Boolean(open);
    root.classList.toggle('assistant-open', isOpen);
    panel.setAttribute('aria-hidden', String(!isOpen));
    toggleBtn.setAttribute('aria-expanded', String(isOpen));

    if (isOpen) {
      setTimeout(() => {
        input.focus();
      }, 250);
    }
  };

  const setStatus = (text) => {
    statusEl.textContent = text;
  };

  const appendMessage = (role, text) => {
    const safeText = escapeHtml(text);
    const row = document.createElement('div');
    row.className = `assistant-msg assistant-msg-${role}`;
    row.innerHTML = `
      <div class="assistant-msg-bubble">${safeText}</div>
      <div class="assistant-msg-time">${formatTime()}</div>
    `;
    messages.appendChild(row);
    messages.scrollTop = messages.scrollHeight;
  };

  const appendAssistantSystemMessage = (text) => {
    appendMessage('assistant', text);
  };

  const sendMessage = async (text, { fromVoice = false } = {}) => {
    const trimmed = String(text || '').trim();
    if (!trimmed || busy) return false;

    if (fromVoice) {
      const now = Date.now();
      if (now - lastVoiceCommandAt < VOICE_COOLDOWN_MS) {
        return false;
      }
      lastVoiceCommandAt = now;
    }

    busy = true;
    appendMessage('user', trimmed);
    input.value = '';
    setStatus('Thinking...');

    try {
      const assistantText = await client.askAssistant({
        message: trimmed,
        history,
      });

      history.push({ role: 'user', content: trimmed });
      history.push({ role: 'assistant', content: assistantText });
      trimHistory();

      appendMessage('assistant', assistantText);
      setStatus(voiceEnabled ? 'Voice Ready' : 'Online');
      return true;
    } catch (error) {
      console.error('[AI] Assistant request failed:', error);
      appendAssistantSystemMessage('AI temporarily unavailable. Please try again later.');
      setStatus('Temporarily Unavailable');
      return false;
    } finally {
      busy = false;
    }
  };

  const voiceController = initVoiceActivation({
    wakeWord: 'hey runanywhere',
    onWakeWord: () => {
      setOpen(true);
      setStatus('Listening...');
    },
    onCommand: (transcript) => {
      const cleaned = String(transcript || '').trim();
      if (!cleaned) return;

      setOpen(true);
      sendMessage(cleaned, { fromVoice: true });
    },
    onStateChange: ({ supported, running, mode, error }) => {
      if (!supported) {
        micBtn.disabled = true;
        micBtn.classList.remove('assistant-mic-on');
        setStatus('Voice Unavailable');
        return;
      }

      micBtn.disabled = false;
      micBtn.classList.toggle('assistant-mic-on', Boolean(running));

      if (error) {
        voiceEnabled = false;
        setStatus('Voice Error');
        return;
      }

      if (!running) {
        setStatus('Voice Paused');
        return;
      }

      setStatus(mode === 'command' ? 'Listening...' : 'Voice Ready');
    },
  });

  if (!voiceController.supported) {
    micBtn.disabled = true;
    setStatus(client.hasApiKey ? 'Ready' : 'API Key Missing');
  } else {
    micBtn.disabled = false;
    setStatus(client.hasApiKey ? 'Ready' : 'API Key Missing');
  }

  setTimeout(() => {
    appendAssistantSystemMessage(
      client.hasApiKey
        ? `Neural link established. ${providerLabel} AI is online. Say "Hey RunAnywhere" to start voice control.`
        : `Assistant UI initialized. Add your ${providerLabel} AI key to enable cloud reasoning.`
    );
  }, 600);

  toggleBtn.addEventListener('click', () => {
    setOpen(!isOpen);
  });

  closeBtn.addEventListener('click', () => {
    setOpen(false);
  });

  micBtn.addEventListener('click', () => {
    if (!voiceController.supported) return;

    if (voiceEnabled) {
      voiceController.stop();
      voiceEnabled = false;
      micBtn.classList.remove('assistant-mic-on');
      setStatus('Voice Paused');
      return;
    }

    const started = voiceController.start();
    voiceEnabled = Boolean(started);

    if (!started) {
      micBtn.classList.remove('assistant-mic-on');
      setStatus('Voice Blocked');
      return;
    }

    micBtn.classList.add('assistant-mic-on');
    setStatus('Voice Ready');
  });

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    sendMessage(input.value);
  });

  window.addEventListener('beforeunload', () => {
    try {
      voiceController.destroy();
    } catch (_) {}
  });
});
