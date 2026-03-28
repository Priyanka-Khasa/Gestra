import './style.css';
import {
  initGestureEngine,
  setGestureMinConfidence,
  startGestureEngine,
  stopGestureEngine,
} from './gesture-mediapipe.js';
import {
  DEFAULT_PYTHON_BRIDGE_URL,
  fireAction,
  probePythonBridge,
  resetGestureActivity,
  updateGestureActivity,
  setPythonVisionCollective,
  fetchPythonHudState,
  mapPythonStateToOverlay,
} from './actions.js';
import {
  getCalibration,
  getGestureActionLabel,
  initializeControlState,
  setActiveContext,
  setCalibrationValue,
  subscribeControlState,
} from './control-state.js';
import { initControlUi } from './control-ui.js';
import { initTTS, speakFeedback } from './tts.js';
import { showToast, updateOverlay, updateSystemStatus, logAction, resetRuntimeUi } from './ui.js';

function waitForVideoReady(video, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA && video.videoWidth > 0) {
      resolve();
      return;
    }
    const onDone = () => {
      clearTimeout(timer);
      video.removeEventListener('loadeddata', onDone);
      video.removeEventListener('error', onErr);
      resolve();
    };
    const onErr = () => {
      clearTimeout(timer);
      video.removeEventListener('loadeddata', onDone);
      video.removeEventListener('error', onErr);
      reject(new Error(video.error?.message || 'Video element error'));
    };
    const timer = setTimeout(() => {
      video.removeEventListener('loadeddata', onDone);
      video.removeEventListener('error', onErr);
      reject(new Error('Camera stream timed out (no video frames).'));
    }, timeoutMs);
    video.addEventListener('loadeddata', onDone, { once: true });
    video.addEventListener('error', onErr, { once: true });
  });
}

function waitForImageReady(img, timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    if (img.complete && img.naturalWidth > 0) {
      resolve();
      return;
    }

    const onLoad = () => {
      clearTimeout(timer);
      img.removeEventListener('load', onLoad);
      img.removeEventListener('error', onError);
      resolve();
    };
    const onError = () => {
      clearTimeout(timer);
      img.removeEventListener('load', onLoad);
      img.removeEventListener('error', onError);
      reject(new Error('Python camera stream failed to load.'));
    };
    const timer = setTimeout(() => {
      img.removeEventListener('load', onLoad);
      img.removeEventListener('error', onError);
      reject(new Error('Python camera stream timed out.'));
    }, timeoutMs);

    img.addEventListener('load', onLoad, { once: true });
    img.addEventListener('error', onError, { once: true });
  });
}

async function waitForPythonBridgeReady({ timeoutMs = 20000, intervalMs = 1000 } = {}) {
  const startedAt = Date.now();
  let lastBridge = null;

  while (Date.now() - startedAt < timeoutMs) {
    const bridge = await probePythonBridge();
    lastBridge = bridge;
    if (bridge?.ok) {
      return bridge;
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  return lastBridge;
}

function initAppShell() {
  document.body.dataset.gestraInitialized = '';
  const introScreen = document.getElementById('intro-screen');
  const guideScreen = document.getElementById('guide-screen');
  const loginScreen = document.getElementById('login-screen');
  const licenseScreen = document.getElementById('license-screen');
  const appContainer = document.getElementById('app-container');
  const videoElement = document.getElementById('webcam-feed');
  const pythonVisionImg = document.getElementById('python-vision-feed');
  const clearLogBtn = document.getElementById('clear-log-btn');
  const actionLog = document.getElementById('action-log');
  const slider = document.getElementById('confidence-slider');
  const valLabel = document.getElementById('threshold-value');
  const loadingText = document.getElementById('loading-text');
  const loadingBar = document.getElementById('loading-bar');
  const loadingOverlay = document.getElementById('loading-overlay');
  const overlayModeToggle = document.getElementById('overlay-mode-toggle');
  const overlayModeHint = document.getElementById('overlay-mode-hint');
  const pinWindowBtn = document.getElementById('pin-window-btn');
  const hideWindowBtn = document.getElementById('hide-window-btn');
  const quitAppBtn = document.getElementById('quit-app-btn');
  const startBtn = document.getElementById('start-btn');
  const stopBtn = document.getElementById('stop-btn');
  const runtimeControlNote = document.getElementById('runtime-control-note');

  let pythonVisionPollTimer = null;
  let appContextPollTimer = null;
  let startupInFlight = false;
  let runtimeActive = false;
  let runtimeMode = 'idle';
  let lastPythonBridgeBase = DEFAULT_PYTHON_BRIDGE_URL;

  if (!appContainer || !videoElement) {
    console.error('Missing required DOM elements');
    return;
  }

  const setLoadingState = (message, progress = 0, visible = true) => {
    if (loadingText && typeof message === 'string') loadingText.innerText = message;
    if (loadingBar) loadingBar.style.width = `${Math.max(0, Math.min(progress, 100))}%`;
    if (loadingOverlay) loadingOverlay.classList.toggle('hidden', !visible);
  };

  const syncRuntimeControls = () => {
    if (startBtn) {
      startBtn.disabled = startupInFlight || runtimeActive;
      startBtn.setAttribute('aria-busy', startupInFlight ? 'true' : 'false');
    }

    if (stopBtn) {
      stopBtn.disabled = startupInFlight || !runtimeActive;
    }

    if (!runtimeControlNote) return;
    if (startupInFlight) {
      runtimeControlNote.textContent = 'Starting';
    } else if (runtimeActive) {
      runtimeControlNote.textContent = runtimeMode === 'python' ? 'Python runtime live' : 'Local runtime live';
    } else {
      runtimeControlNote.textContent = 'Manual control';
    }
  };

  const clearPythonVisionPoller = () => {
    if (pythonVisionPollTimer) {
      clearInterval(pythonVisionPollTimer);
      pythonVisionPollTimer = null;
    }
  };

  const clearAppContextPoller = () => {
    if (appContextPollTimer) {
      clearInterval(appContextPollTimer);
      appContextPollTimer = null;
    }
  };

  const startAppContextPolling = () => {
    clearAppContextPoller();
    if (!window.electronAPI?.getActiveAppContext) return;

    const poll = () => {
      window.electronAPI
        .getActiveAppContext()
        .then((context) => setActiveContext(context || {}))
        .catch(() => {});
    };

    poll();
    appContextPollTimer = setInterval(poll, 1800);
  };

  const cleanupVideoStream = () => {
    const existing = videoElement.srcObject;
    if (existing?.getTracks) {
      existing.getTracks().forEach((track) => track.stop());
    }
    videoElement.pause?.();
    videoElement.srcObject = null;
  };

  const resetRuntimeSurface = () => {
    stopGestureEngine();
    resetGestureActivity();
    clearPythonVisionPoller();
    clearAppContextPoller();
    cleanupVideoStream();
    setPythonVisionCollective(false);
    videoElement.classList.remove('hidden');
    pythonVisionImg?.classList.add('hidden');
    if (pythonVisionImg) pythonVisionImg.removeAttribute('src');
  };

  const syncShellControls = async () => {
    if (!window.electronAPI?.getWindowMode) {
      pinWindowBtn?.classList.remove('active');
      if (overlayModeToggle) overlayModeToggle.checked = false;
      return;
    }

    try {
      const mode = await window.electronAPI.getWindowMode();
      pinWindowBtn?.classList.toggle('active', Boolean(mode?.pinWindowAbove));
      if (overlayModeToggle) {
        overlayModeToggle.checked = Boolean(mode?.overlayModeEnabled);
        overlayModeToggle.disabled = true;
      }
      if (overlayModeHint) {
        overlayModeHint.textContent = 'Disabled for stability';
      }
    } catch (error) {
      console.warn('getWindowMode failed:', error);
    }
  };

  const setPausedUi = (detail = 'Press Start Runtime to begin gesture tracking.') => {
    setLoadingState('Runtime paused', 0, true);
    resetRuntimeUi({
      statusText: 'Runtime paused',
      statusDot: 'bg-slate-700',
      detail,
      mode: 'Paused',
      feedbackTitle: 'Runtime paused',
      feedbackDetail: 'Gesture tracking is stopped. Start the runtime when you want camera control again.',
      hintTitle: 'No active gesture',
      hintBody: 'Start the runtime to reconnect the camera feed and resume gesture detection.',
    });
  };

  const setPythonRuntimeEnabled = async (enabled, baseUrl = lastPythonBridgeBase) => {
    const normalizedBase = String(baseUrl || DEFAULT_PYTHON_BRIDGE_URL).replace(/\/+$/, '');
    lastPythonBridgeBase = normalizedBase;

    if (window.electronAPI?.pythonBridge) {
      const response = await window.electronAPI.pythonBridge({ op: 'runtime', enabled: Boolean(enabled) });
      return Boolean(response?.ok);
    }

    try {
      const res = await fetch(`${normalizedBase}/api/v1/runtime`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: Boolean(enabled) }),
        mode: 'cors',
      });
      return res.ok;
    } catch {
      return false;
    }
  };

  const startPythonPolling = (baseUrl) => {
    clearPythonVisionPoller();
    let lastHud = { stable: false, gesture: 'none' };

    pythonVisionPollTimer = setInterval(() => {
      fetchPythonHudState(baseUrl)
        .then((raw) => {
          if (!runtimeActive || runtimeMode !== 'python' || !raw) return;

          const state = mapPythonStateToOverlay(raw);
          updateOverlay(state);
          updateGestureActivity(state);

          if (state.stable && state.gesture !== 'none') {
            if (!lastHud.stable || lastHud.gesture !== state.gesture) {
              const label = getGestureActionLabel(state.gesture) || state.gesture;
              logAction(state.gesture, label);
              speakFeedback(label);
            }
          }

          lastHud = { stable: state.stable, gesture: state.gesture };
        })
        .catch(() => {});
    }, 45);
  };

  const startLocalCameraMode = async () => {
    setPythonVisionCollective(false);
    videoElement.classList.remove('hidden');
    pythonVisionImg?.classList.add('hidden');
    if (pythonVisionImg) pythonVisionImg.removeAttribute('src');

    setLoadingState('Preparing hand tracking...', 30, true);

    if (!navigator.mediaDevices?.getUserMedia) {
      setLoadingState('Desktop shell ready. Camera unavailable in this view.', 100, false);
      updateSystemStatus('Desktop Shell Active', 'bg-amber-500');
      showToast('Camera API unavailable in this Electron view. The app shell is active; start the Python bridge for vision.');
      document.body.dataset.gestraInitialized = '1';
      runtimeActive = false;
      runtimeMode = 'idle';
      setPausedUi('Camera API is unavailable in this view. Start the Python bridge for vision mode.');
      await syncShellControls();
      return;
    }

    const videoConstraints = {
      facingMode: 'user',
      width: { ideal: 1280 },
      height: { ideal: 720 },
      frameRate: { ideal: 60, max: 60 },
    };

    async function openCameraStream() {
      try {
        return await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: videoConstraints,
        });
      } catch (firstError) {
        const retriable =
          firstError?.name === 'OverconstrainedError' || firstError?.name === 'ConstraintNotSatisfiedError';
        if (retriable) {
          return navigator.mediaDevices.getUserMedia({ audio: false, video: true });
        }
        throw firstError;
      }
    }

    const [gestureOutcome, streamOutcome] = await Promise.allSettled([initGestureEngine(), openCameraStream()]);

    if (gestureOutcome.status === 'rejected') {
      if (streamOutcome.status === 'fulfilled') {
        streamOutcome.value.getTracks().forEach((track) => track.stop());
      }
      throw gestureOutcome.reason;
    }

    if (streamOutcome.status === 'rejected') {
      throw streamOutcome.reason;
    }

    const stream = streamOutcome.value;

    setLoadingState('Calibrating camera feed...', 65, true);

    videoElement.muted = true;
    videoElement.setAttribute('playsinline', '');
    videoElement.playsInline = true;
    videoElement.srcObject = stream;

    await waitForVideoReady(videoElement);
    try {
      await videoElement.play();
    } catch (playError) {
      console.warn('video.play():', playError);
      showToast('Could not start camera preview. Try clicking the window or toggling the camera.');
    }

    await new Promise(requestAnimationFrame);
    await new Promise(requestAnimationFrame);

    if (videoElement.videoWidth === 0) {
      throw new Error('Camera opened but returned 0x0 resolution. Try another webcam or update GPU drivers.');
    }

    initTTS().catch((error) => console.warn('TTS init failed:', error));

    startGestureEngine(videoElement, {
      onFrame: (state) => {
        if (!runtimeActive || runtimeMode !== 'local') return;
        updateOverlay(state);
        updateGestureActivity(state);
        if (state.handDetected && state.gesture === 'index' && state.landmarks) {
          fireAction(state);
        }
      },
      onGesture: (state) => {
        if (!runtimeActive || runtimeMode !== 'local') return;
        fireAction(state);
      },
    });

    probePythonBridge()
      .then(({ ok, via, data }) => {
        if (!ok) return;
        const id = data?.electron?.appContainerId;
        const hint = id ? ` (UI root #${id})` : '';
        const route = via === 'electron' ? 'Electron to Python' : 'Browser to Python';
        showToast(`Python bridge online${hint}. Route: ${route}. Gesture relay stays in local camera mode.`);
      })
      .catch(() => {});

    runtimeActive = true;
    runtimeMode = 'local';
    setLoadingState('Runtime ready.', 100, false);
    updateSystemStatus(
      'Camera tracking active',
      'bg-emerald-300',
      'Gestra is reading the local camera feed and can trigger desktop actions from stable gestures.',
      'Live'
    );
    document.body.dataset.gestraInitialized = '1';
    await syncShellControls();
  };

  const handleStop = async ({ silent = false } = {}) => {
    if (startupInFlight) {
      return;
    }

    const stoppingPython = runtimeActive && runtimeMode === 'python';
    if (stoppingPython) {
      await setPythonRuntimeEnabled(false);
    }

    resetRuntimeSurface();
    runtimeActive = false;
    runtimeMode = 'idle';
    document.body.dataset.gestraInitialized = '';
    setPausedUi();
    syncRuntimeControls();

    if (!silent) {
      showToast('Gesture runtime stopped.');
    }
  };

  const handleStart = async () => {
    if (startupInFlight || runtimeActive) {
      return;
    }

    startupInFlight = true;
    syncRuntimeControls();

    try {
      introScreen?.classList.add('hidden');
      introScreen?.classList.remove('flex');
      guideScreen?.classList.add('hidden');
      guideScreen?.classList.remove('flex');
      loginScreen?.classList.add('hidden');
      loginScreen?.classList.remove('flex');
      licenseScreen?.classList.add('hidden');
      licenseScreen?.classList.remove('flex');
      appContainer.classList.remove('hidden');

      resetRuntimeSurface();
      startAppContextPolling();
      setLoadingState('Checking Python vision bridge...', 15, true);
      updateSystemStatus(
        'Starting Gestra runtime',
        'bg-emerald-300',
        'Checking the camera path and local control backend.',
        'Booting'
      );

      if (window.electronAPI?.ensurePythonBackend) {
        await window.electronAPI.ensurePythonBackend().catch(() => null);
      }

      let bridge = await probePythonBridge();
      if (!bridge?.ok && window.electronAPI?.getPythonBackendStatus) {
        const backend = await window.electronAPI.getPythonBackendStatus().catch(() => null);
        if (backend?.running || backend?.launchCommand) {
          setLoadingState('Starting local runtime...', 20, true);
          bridge = await waitForPythonBridgeReady();
        }
      }

      const collective = Boolean(bridge?.ok && bridge.data?.vision?.collective);
      const baseUrl = String(bridge?.baseUrl || DEFAULT_PYTHON_BRIDGE_URL).replace(/\/+$/, '');
      lastPythonBridgeBase = baseUrl;

      if (collective && !pythonVisionImg) {
        showToast('Python collective vision needs #python-vision-feed in index.html. Using the local camera instead.');
      }

      if (collective && pythonVisionImg) {
        const runtimeEnabled = await setPythonRuntimeEnabled(true, baseUrl);
        if (!runtimeEnabled) {
          throw new Error('Python runtime toggle failed.');
        }

        setPythonVisionCollective(true);
        setLoadingState('Linking to live camera stream...', 45, true);

        videoElement.classList.add('hidden');
        pythonVisionImg.classList.remove('hidden');
        const mjpegPath = bridge.data?.vision?.mjpegPath || '/camera.mjpg';
        const path = mjpegPath.startsWith('/') ? mjpegPath : `/${mjpegPath}`;
        pythonVisionImg.src = `${baseUrl}${path}`;

        try {
          await waitForImageReady(pythonVisionImg, 5000);
        } catch (streamError) {
          console.warn('Python MJPEG unavailable, falling back to local camera:', streamError);
          showToast('Python video stream unavailable. Falling back to local webcam preview.');
          await startLocalCameraMode();
          startupInFlight = false;
          syncRuntimeControls();
          return;
        }

        initTTS().catch((error) => console.warn('TTS init failed:', error));
        startPythonPolling(baseUrl);

        const id = bridge.data?.electron?.appContainerId;
        const hint = id ? ` (#${id})` : '';
        showToast(`Collective mode active: video is coming from Python${hint}. Desktop actions stay in Python.`);

        if (window.electronAPI?.yieldFocusToDesktop) {
          setTimeout(() => {
            if (runtimeActive && runtimeMode === 'python') {
              window.electronAPI.yieldFocusToDesktop({ hideWindow: true, delayMs: 120 }).catch(() => {});
            }
          }, 900);
        }

        runtimeActive = true;
        runtimeMode = 'python';
        setLoadingState('Runtime ready (Python vision).', 100, false);
        updateSystemStatus(
          'Python vision active',
          'bg-emerald-300',
          'Camera frames are coming from the Python bridge and actions are routed through the desktop backend.',
          'Live'
        );
        document.body.dataset.gestraInitialized = '1';
        await syncShellControls();
        startupInFlight = false;
        syncRuntimeControls();
        return;
      }

      await startLocalCameraMode();
      startupInFlight = false;
      syncRuntimeControls();
    } catch (error) {
      console.error('App startup failed:', error);
      resetRuntimeSurface();
      runtimeActive = false;
      runtimeMode = 'idle';

      updateSystemStatus(
        'Runtime error',
        'bg-red-500',
        'Gestra could not finish startup. Review the camera and backend status, then try again.',
        'Error'
      );

      const name = error?.name || '';
      const msg = error?.message || 'Initialization failed.';
      setLoadingState(msg, 0, true);

      if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
        showToast(
          'Camera access denied. Enable camera access for this app in Windows Settings > Privacy & security > Camera.'
        );
      } else if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
        showToast('No camera found. Plug in a webcam or enable it in Device Manager.');
      } else if (name === 'NotReadableError' || name === 'TrackStartError') {
        showToast('Camera is in use by another app. Close other apps using the camera and try again.');
      } else if (msg.includes('API unavailable')) {
        showToast(msg);
      } else if (msg.includes('timed out') || msg.includes('0x0') || msg.includes('no resolution')) {
        showToast(msg);
      } else {
        showToast(msg);
      }

      document.body.dataset.gestraInitialized = '';
      startupInFlight = false;
      syncRuntimeControls();
    }
  };

  window.__gestraInitStart = handleStart;
  window.__gestraRuntimeStop = handleStop;
  window.addEventListener('gestra:start-requested', handleStart);

  if (startBtn) {
    startBtn.onclick = handleStart;
    startBtn.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        handleStart();
      }
    });
  }

  stopBtn?.addEventListener('click', () => {
    handleStop();
  });

  if (clearLogBtn && actionLog) {
    clearLogBtn.addEventListener('click', () => {
      actionLog.innerHTML =
        '<div class="text-center text-sm text-gray-600 mt-10 italic">Waiting for gesture input...</div>';
    });
  }

  if (slider && valLabel) {
    const syncThreshold = (raw) => {
      const value = parseFloat(raw);
      valLabel.innerText = Number.isFinite(value) ? value.toFixed(2) : '0.70';
      if (Number.isFinite(value)) {
        setGestureMinConfidence(value);
        setCalibrationValue('minConfidence', value);
      }
    };
    syncThreshold(slider.value);
    slider.addEventListener('input', (event) => {
      syncThreshold(event.target.value);
    });
  }

  if (overlayModeToggle) {
    overlayModeToggle.checked = false;
    overlayModeToggle.disabled = true;
  }

  pinWindowBtn?.addEventListener('click', async () => {
    if (!window.electronAPI?.setPinAbove) {
      showToast('Pinning is available only in the Electron desktop app.');
      return;
    }
    const mode = await window.electronAPI.getWindowMode();
    const next = !Boolean(mode?.pinWindowAbove);
    await window.electronAPI.setPinAbove(next);
    await syncShellControls();
    showToast(next ? 'Window pinned above other apps.' : 'Window pin disabled.');
  });

  hideWindowBtn?.addEventListener('click', async () => {
    await window.electronAPI?.hideWindow?.();
  });

  quitAppBtn?.addEventListener('click', async () => {
    await window.electronAPI?.quitApp?.();
  });

  setPausedUi();
  syncRuntimeControls();
  syncShellControls();

  initializeControlState();
  initControlUi();
  subscribeControlState(() => {
    const calibration = getCalibration();
    setGestureMinConfidence(Number(calibration.minConfidence) || 0.7);
    if (slider && valLabel && document.activeElement !== slider) {
      slider.value = String(calibration.minConfidence);
      valLabel.innerText = Number(calibration.minConfidence).toFixed(2);
    }
  });
  startAppContextPolling();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initAppShell, { once: true });
} else {
  initAppShell();
}
