const SpeechRecognitionCtor =
  window.SpeechRecognition || window.webkitSpeechRecognition || null;

function normalize(text) {
  return (text || '')
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function initVoiceActivation({
  wakeWord = 'hey runanywhere',
  commandWindowMs = 5000,
  onWakeWord = () => {},
  onCommand = () => {},
  onSpeechStart = () => {},
  onSpeechEnd = () => {},
  onStateChange = () => {}
} = {}) {
  if (!SpeechRecognitionCtor) {
    onStateChange({ supported: false, running: false, mode: 'unsupported' });
    return {
      supported: false,
      start: () => false,
      stop: () => false,
      destroy: () => {}
    };
  }

  const recognition = new SpeechRecognitionCtor();
  recognition.continuous = true;
  recognition.interimResults = false;
  recognition.lang = 'en-US';
  recognition.maxAlternatives = 1;

  let shouldRun = false;
  let mode = 'wake';
  let commandTimer = null;
  let restartTimer = null;
  let lastWakeAt = 0;
  let speechActive = false;
  let isStarting = false;

  const wakeWordNormalized = normalize(wakeWord);

  const emitState = (extra = {}) => {
    onStateChange({ supported: true, running: shouldRun, mode, speechActive, ...extra });
  };

  const clearRestartTimer = () => {
    if (restartTimer) {
      clearTimeout(restartTimer);
      restartTimer = null;
    }
  };

  const clearCommandTimer = () => {
    if (commandTimer) {
      clearTimeout(commandTimer);
      commandTimer = null;
    }
  };

  const resetToWakeMode = () => {
    mode = 'wake';
    clearCommandTimer();
    emitState();
  };

  const enterCommandMode = (overrideWindowMs) => {
    mode = 'command';
    clearCommandTimer();

    const windowMs = Number.isFinite(overrideWindowMs) ? overrideWindowMs : commandWindowMs;
    commandTimer = setTimeout(() => {
      resetToWakeMode();
    }, windowMs);

    emitState();
  };

  const safeStart = () => {
    if (!shouldRun || isStarting) return;

    isStarting = true;

    try {
      recognition.start();
    } catch (_) {
    } finally {
      setTimeout(() => {
        isStarting = false;
      }, 250);
    }
  };

  const scheduleRestart = (delayMs = 350) => {
    if (!shouldRun) return;
    clearRestartTimer();
    restartTimer = setTimeout(() => {
      safeStart();
    }, delayMs);
  };

  const processTranscript = (text) => {
    const cleaned = normalize(text);
    if (!cleaned) return;

    if (mode === 'wake') {
      if (cleaned.includes(wakeWordNormalized)) {
        const now = Date.now();
        if (now - lastWakeAt < 1000) return;

        lastWakeAt = now;
        onWakeWord(text);
        enterCommandMode();
      }
      return;
    }

    if (mode === 'command') {
      onCommand(cleaned);
      resetToWakeMode();
    }
  };

  recognition.onresult = (event) => {
    const result = event.results[event.resultIndex || 0];
    const transcript = result?.[0]?.transcript || '';
    processTranscript(transcript);
  };

  recognition.onspeechstart = () => {
    speechActive = true;
    emitState();
    onSpeechStart();
  };

  recognition.onspeechend = () => {
    speechActive = false;
    emitState();
    onSpeechEnd();
  };

  recognition.onend = () => {
    speechActive = false;

    if (!shouldRun) {
      clearRestartTimer();
      resetToWakeMode();
      return;
    }

    emitState();
    scheduleRestart(300);
  };

  recognition.onerror = (e) => {
    const error = e?.error || 'unknown';
    console.warn('Voice error:', error);
    speechActive = false;

    if (error === 'not-allowed' || error === 'service-not-allowed' || error === 'audio-capture') {
      shouldRun = false;
      clearRestartTimer();
      emitState({ error });
      return;
    }

    if (error === 'no-speech' || error === 'aborted' || error === 'network') {
      emitState();
      scheduleRestart(500);
      return;
    }

    shouldRun = false;
    clearRestartTimer();
    emitState({ error });
  };

  const start = () => {
    if (shouldRun) return true;

    shouldRun = true;
    emitState();
    safeStart();
    return true;
  };

  const stop = () => {
    shouldRun = false;
    speechActive = false;
    clearRestartTimer();

    try {
      recognition.stop();
    } catch (_) {}

    resetToWakeMode();
    return true;
  };

  const destroy = () => {
    shouldRun = false;
    speechActive = false;
    clearRestartTimer();
    clearCommandTimer();

    try {
      recognition.abort();
    } catch (_) {}

    resetToWakeMode();
  };

  emitState();

  return {
    supported: true,
    start,
    activateCommandMode: (overrideWindowMs) => {
      enterCommandMode(overrideWindowMs);
      return true;
    },
    stop,
    destroy
  };
}
