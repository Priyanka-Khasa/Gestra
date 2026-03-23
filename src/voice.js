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

  // 🔥 FIX 1: NO continuous loop
  recognition.continuous = false;
  recognition.interimResults = false;
  recognition.lang = 'en-US';

  let shouldRun = false;
  let mode = 'wake';
  let commandTimer = null;
  let lastWakeAt = 0;

  const wakeWordNormalized = normalize(wakeWord);

  const emitState = () => {
    onStateChange({ supported: true, running: shouldRun, mode });
  };

  const resetToWakeMode = () => {
    mode = 'wake';
    if (commandTimer) {
      clearTimeout(commandTimer);
      commandTimer = null;
    }
    emitState();
  };

  const enterCommandMode = () => {
    mode = 'command';
    if (commandTimer) clearTimeout(commandTimer);

    commandTimer = setTimeout(() => {
      resetToWakeMode();
    }, commandWindowMs);

    emitState();
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
    const result = event.results[0];
    const transcript = result[0]?.transcript || '';
    processTranscript(transcript);
  };

  // 🔥 FIX 2: SAFE restart (no infinite loop)
  recognition.onend = () => {
    if (!shouldRun) {
      resetToWakeMode();
      return;
    }

    // controlled restart
    setTimeout(() => {
      try {
        recognition.start();
      } catch (_) {}
    }, 800);
  };

  recognition.onerror = (e) => {
    console.warn('Voice error:', e.error);
    onStateChange({ supported: true, running: false, mode, error: e.error });
    shouldRun = false;
  };

  const start = () => {
    if (shouldRun) return true;

    shouldRun = true;
    emitState();

    try {
      recognition.start();
      return true;
    } catch (_) {
      shouldRun = false;
      emitState();
      return false;
    }
  };

  const stop = () => {
    shouldRun = false;

    try {
      recognition.stop();
    } catch (_) {}

    resetToWakeMode();
    return true;
  };

  const destroy = () => {
    shouldRun = false;

    if (commandTimer) clearTimeout(commandTimer);

    try {
      recognition.abort();
    } catch (_) {}

    resetToWakeMode();
  };

  emitState();

  return {
    supported: true,
    start,
    stop,
    destroy
  };
}
