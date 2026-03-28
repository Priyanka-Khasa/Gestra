import { createAIClient } from './ai.js';
import { initVoiceActivation } from './voice.js';
import { initTTS, speakFeedback } from './tts.js';
import { resolveLocalAssistantCommand } from './control-state.js';

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
  const voiceOrb = document.getElementById('assistant-voice-orb');
  const voiceCaption = document.getElementById('assistant-voice-caption');

  if (!toggleBtn || !panel || !closeBtn || !micBtn || !statusEl || !form || !input || !messages || !voiceOrb || !voiceCaption) {
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
  let voiceState = 'idle';
  let nativeVoiceLoopAbort = false;

  const providerLabel = 'Gestra';
  const canUseNativeVoice =
    Boolean(window.electronAPI?.recognizeNativeSpeech) &&
    typeof navigator !== 'undefined' &&
    /win/i.test(String(navigator.platform || ''));

  initTTS().catch((error) => {
    console.warn('Assistant TTS init failed:', error);
  });

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

  const setVoiceVisualState = (nextState, caption) => {
    voiceState = nextState;
    voiceOrb.classList.remove('is-active', 'is-listening', 'is-thinking', 'is-error');

    if (nextState === 'ready') {
      voiceOrb.classList.add('is-active');
    }
    if (nextState === 'listening') {
      voiceOrb.classList.add('is-listening');
    }
    if (nextState === 'thinking') {
      voiceOrb.classList.add('is-thinking');
    }
    if (nextState === 'error') {
      voiceOrb.classList.add('is-error');
    }

    voiceCaption.textContent = caption;
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

  const directVoiceMatchers = [
    { pattern: /\b(open|launch|start)\s+(google\s+chrome|chrome)\b/, payload: { type: 'open-app', target: 'chrome' } },
    { pattern: /\b(open|launch|start)\s+(microsoft\s+edge|edge)\b/, payload: { type: 'open-app', target: 'edge' } },
    { pattern: /\b(open|launch|start)\s+(file\s+explorer|explorer|folder|folders)\b/, payload: { type: 'open-app', target: 'file explorer' } },
    { pattern: /\b(open|launch|start)\s+(notepad)\b/, payload: { type: 'open-app', target: 'notepad' } },
    { pattern: /\b(open|launch|start)\s+(calculator|calc)\b/, payload: { type: 'open-app', target: 'calculator' } },
    { pattern: /\b(open|launch|start)\s+(settings|windows settings)\b/, payload: { type: 'open-app', target: 'settings' } },
    { pattern: /\b(open|launch|start)\s+(command prompt|cmd)\b/, payload: { type: 'open-app', target: 'cmd' } },
    { pattern: /\b(open|launch|start)\s+(powershell|terminal)\b/, payload: { type: 'open-app', target: 'powershell' } },
    { pattern: /\b(scroll\s+up)\b/, payload: { type: 'os-action', target: 'scroll-up' } },
    { pattern: /\b(scroll\s+down)\b/, payload: { type: 'os-action', target: 'scroll-down' } },
    { pattern: /\b(left\s+click|click)\b/, payload: { type: 'os-action', target: 'left-click' } },
    { pattern: /\b(right\s+click)\b/, payload: { type: 'os-action', target: 'right-click' } },
    { pattern: /\b(play|pause|play\s+pause)\b/, payload: { type: 'os-action', target: 'play-pause' } },
    { pattern: /\b(screenshot|take\s+a\s+screenshot)\b/, payload: { type: 'os-action', target: 'screenshot' } },
    { pattern: /\b(volume\s+up)\b/, payload: { type: 'os-action', target: 'volume-up' } },
    { pattern: /\b(volume\s+down)\b/, payload: { type: 'os-action', target: 'volume-down' } },
    { pattern: /\b(alt\s+tab|switch\s+window)\b/, payload: { type: 'os-action', target: 'alt-tab' } },
    { pattern: /\b(show|open)\s+(gestra|assistant|app)\b/, payload: { type: 'window-action', target: 'show' } },
    { pattern: /\b(hide|minimize)\s+(gestra|assistant|app)\b/, payload: { type: 'window-action', target: 'hide' } },
    { pattern: /\b(pin)\s+(gestra|assistant|app)\b/, payload: { type: 'window-action', target: 'pin' } },
    { pattern: /\b(unpin)\s+(gestra|assistant|app)\b/, payload: { type: 'window-action', target: 'unpin' } },
    { pattern: /\b(switch to|use)\s+(browser|desktop|presentation|creator|coding)\s+(mode|pack)?\b/, payload: { type: 'gestra-local', target: 'pack' } },
    { pattern: /\b(use|apply)\s+(balanced|accessibility|presentation|creator)\s+profile\b/, payload: { type: 'gestra-local', target: 'profile' } },
    { pattern: /\b(enable|turn on)\s+automation\b/, payload: { type: 'gestra-local', target: 'automation-on' } },
    { pattern: /\b(disable|turn off)\s+automation\b/, payload: { type: 'gestra-local', target: 'automation-off' } },
  ];

  const resolveDirectVoiceCommand = (transcript) => {
    const cleaned = String(transcript || '').trim().toLowerCase();
    for (const matcher of directVoiceMatchers) {
      if (matcher.pattern.test(cleaned)) {
        return matcher.payload;
      }
    }
    return null;
  };

  const executeDirectVoiceCommand = async (transcript) => {
    const voiceCommand = resolveDirectVoiceCommand(transcript);
    if (voiceCommand?.type === 'gestra-local') {
      appendMessage('user', transcript);
      const message = resolveLocalAssistantCommand(transcript) || 'That local Gestra command did not match a workflow setting.';
      appendAssistantSystemMessage(message);
      speakFeedback(message);
      setStatus('Voice Ready');
      setVoiceVisualState('ready', 'Voice standby');
      return true;
    }

    if (!voiceCommand || !window.electronAPI?.executeVoiceCommand) {
      return false;
    }

    appendMessage('user', transcript);
    input.value = '';
    setVoiceVisualState('thinking', 'Executing command');
    setStatus('Executing...');

    try {
      const result = await window.electronAPI.executeVoiceCommand(voiceCommand);
      const message = result?.message || (result?.ok ? 'Command completed.' : 'Command failed.');
      appendAssistantSystemMessage(message);
      speakFeedback(message);
      setStatus(result?.ok ? 'Voice Ready' : 'Voice Error');
      setVoiceVisualState(result?.ok ? 'ready' : 'error', result?.ok ? 'Voice standby' : 'Voice error');
      return Boolean(result?.ok);
    } catch (error) {
      const message = `Voice command failed: ${String(error?.message || error)}`;
      appendAssistantSystemMessage(message);
      setStatus('Voice Error');
      setVoiceVisualState('error', 'Voice error');
      return false;
    }
  };

  const handleRecognizedVoiceText = async (transcript) => {
    const cleaned = String(transcript || '').trim();
    if (!cleaned) return false;

    setOpen(true);
    input.value = cleaned;
    const handled = await executeDirectVoiceCommand(cleaned);
    if (!handled) {
      await sendMessage(cleaned, { fromVoice: true });
    }
    return true;
  };

  const runNativeVoiceLoop = async () => {
    nativeVoiceLoopAbort = false;

    while (voiceEnabled && !nativeVoiceLoopAbort) {
      setStatus('Listening...');
      setVoiceVisualState('listening', 'Listening now');

      let result = null;
      try {
        result = await window.electronAPI.recognizeNativeSpeech({ timeoutSeconds: 8 });
      } catch (error) {
        result = { ok: false, reason: 'exception', message: String(error?.message || error) };
      }

      if (!voiceEnabled || nativeVoiceLoopAbort) {
        break;
      }

      if (result?.ok && result?.text) {
        const spokenText = String(result.text).trim();
        if (spokenText) {
          voiceCaption.textContent = `Heard: ${spokenText}`;
          await handleRecognizedVoiceText(spokenText);
        }
        continue;
      }

      if (result?.reason === 'timeout') {
        setStatus('Listening...');
        setVoiceVisualState('ready', 'Voice standby');
        continue;
      }

      if (result?.message) {
        appendAssistantSystemMessage(`Voice input error: ${result.message}`);
      }
      setStatus('Voice Error');
      setVoiceVisualState('error', 'Voice error');
      voiceEnabled = false;
      micBtn.classList.remove('assistant-mic-on');
      break;
    }
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
    if (fromVoice) {
      setVoiceVisualState('thinking', 'Generating reply');
    }

    try {
      const localReply = resolveLocalAssistantCommand(trimmed);
      if (localReply) {
        history.push({ role: 'user', content: trimmed });
        history.push({ role: 'assistant', content: localReply });
        trimHistory();
        appendMessage('assistant', localReply);
        setStatus(voiceEnabled ? 'Voice Ready' : 'Ready');
        if (fromVoice) {
          speakFeedback(localReply);
          setVoiceVisualState(voiceEnabled ? 'ready' : 'idle', voiceEnabled ? 'Voice standby' : 'Voice offline');
        }
        return true;
      }

      const assistantText = await client.askAssistant({
        message: trimmed,
        history,
      });

      history.push({ role: 'user', content: trimmed });
      history.push({ role: 'assistant', content: assistantText });
      trimHistory();

      appendMessage('assistant', assistantText);
      setStatus(voiceEnabled ? 'Voice Ready' : 'Online');
      if (fromVoice) {
        speakFeedback(assistantText);
        setVoiceVisualState(voiceEnabled ? 'ready' : 'idle', voiceEnabled ? 'Voice standby' : 'Voice offline');
      }
      return true;
    } catch (error) {
      console.error('[AI] Assistant request failed:', error);
      appendAssistantSystemMessage('AI temporarily unavailable. Please try again later.');
      setStatus('Temporarily Unavailable');
      if (fromVoice) {
        setVoiceVisualState('error', 'Voice error');
      }
      return false;
    } finally {
      busy = false;
    }
  };

  const voiceController = initVoiceActivation({
    wakeWord: 'hey gestra',
    onWakeWord: () => {
      setOpen(true);
      setStatus('Listening...');
      setVoiceVisualState('listening', 'Wake word detected');
    },
    onCommand: (transcript) => {
      const cleaned = String(transcript || '').trim();
      if (!cleaned) return;

      setOpen(true);
      input.value = cleaned;
      executeDirectVoiceCommand(cleaned).then((handled) => {
        if (!handled) {
          sendMessage(cleaned, { fromVoice: true });
        }
      });
    },
    onSpeechStart: () => {
      setVoiceVisualState('listening', 'Listening now');
    },
    onSpeechEnd: () => {
      if (!busy && voiceState !== 'error') {
        setVoiceVisualState(voiceEnabled ? 'ready' : 'idle', voiceEnabled ? 'Voice standby' : 'Voice offline');
      }
    },
    onStateChange: ({ supported, running, mode, error }) => {
      if (!supported) {
        micBtn.disabled = true;
        micBtn.classList.remove('assistant-mic-on');
        setStatus('Voice Unavailable');
        setVoiceVisualState('error', 'Voice unavailable');
        return;
      }

      micBtn.disabled = false;
      micBtn.classList.toggle('assistant-mic-on', Boolean(running));

      if (error) {
        setStatus('Voice Error');
        setVoiceVisualState('error', 'Voice error');
        return;
      }

      if (!running) {
        setStatus('Voice Paused');
        setVoiceVisualState('idle', 'Voice paused');
        return;
      }

      setStatus(mode === 'command' ? 'Listening...' : 'Voice Ready');
      setVoiceVisualState(mode === 'command' ? 'listening' : 'ready', mode === 'command' ? 'Listening now' : 'Voice standby');
    },
  });

  if (!voiceController.supported) {
    micBtn.disabled = true;
    setStatus(client.hasApiKey ? 'Ready' : 'API Key Missing');
    setVoiceVisualState('error', 'Voice unavailable');
  } else {
    micBtn.disabled = false;
    setStatus(client.hasApiKey ? 'Ready' : 'API Key Missing');
    setVoiceVisualState('idle', 'Voice standby');
  }

  setTimeout(() => {
    appendAssistantSystemMessage(
      client.hasApiKey
        ? `Gestra Assistant is online. Say "Hey Gestra" to start voice control.`
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
    if (canUseNativeVoice) {
      if (voiceEnabled) {
        nativeVoiceLoopAbort = true;
        voiceEnabled = false;
        micBtn.classList.remove('assistant-mic-on');
        setStatus('Voice Paused');
        setVoiceVisualState('idle', 'Voice paused');
        return;
      }

      voiceEnabled = true;
      micBtn.classList.add('assistant-mic-on');
      setStatus('Listening...');
      setVoiceVisualState('listening', 'Listening now');
      runNativeVoiceLoop();
      return;
    }

    if (!voiceController.supported) return;

    if (voiceEnabled) {
      voiceController.stop();
      voiceEnabled = false;
      micBtn.classList.remove('assistant-mic-on');
      setStatus('Voice Paused');
      setVoiceVisualState('idle', 'Voice paused');
      return;
    }

    const started = voiceController.start();
    voiceEnabled = Boolean(started);

    if (!started) {
      micBtn.classList.remove('assistant-mic-on');
      setStatus('Voice Blocked');
      setVoiceVisualState('error', 'Voice blocked');
      return;
    }

    micBtn.classList.add('assistant-mic-on');
    setStatus('Voice Ready');
    voiceController.activateCommandMode?.(20000);
    setVoiceVisualState('listening', 'Listening now');
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
