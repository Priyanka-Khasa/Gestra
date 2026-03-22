import './style.css';
import { initGestureEngine, setGestureMinConfidence, startGestureEngine } from './gesture-mediapipe.js';
import { fireAction, updateGestureActivity } from './actions.js';
import { initTTS } from './tts.js';
import { showToast, updateOverlay, updateSystemStatus } from './ui.js';

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

document.addEventListener('DOMContentLoaded', () => {
  const startBtn = document.getElementById('start-btn');
  const landingPage = document.getElementById('landing-page');
  const appContainer = document.getElementById('app-container');
  const videoElement = document.getElementById('webcam-feed');
  const clearLogBtn = document.getElementById('clear-log-btn');
  const actionLog = document.getElementById('action-log');
  const slider = document.getElementById('confidence-slider');
  const valLabel = document.getElementById('threshold-value');
  const loadingText = document.getElementById('loading-text');
  const loadingBar = document.getElementById('loading-bar');
  const loadingOverlay = document.getElementById('loading-overlay');
  const overlayModeToggle = document.getElementById('overlay-mode-toggle');

  if (!startBtn || !landingPage || !appContainer || !videoElement) {
    console.error('Missing required DOM elements');
    return;
  }

  startBtn.addEventListener('click', async () => {
    try {
      // Chromium often never paints camera frames if the <video> lives under display:none
      // (app was shown only after a delay + long MediaPipe init). Show layout now; landing
      // stays on top via z-index until the fade finishes.
      appContainer.classList.remove('hidden');

      updateSystemStatus('Neural Link Initializing...', 'bg-accent');
      landingPage.style.opacity = '0';
      setTimeout(() => {
        landingPage.classList.add('hidden');
      }, 700);

      if (loadingText) loadingText.innerText = 'Synchronizing Hand Tracking...';
      if (loadingBar) loadingBar.style.width = '30%';

      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('Camera API unavailable. Use the Electron app or a secure context (HTTPS / localhost).');
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

      const [gestureOutcome, streamOutcome] = await Promise.allSettled([
        initGestureEngine(),
        openCameraStream(),
      ]);

      if (gestureOutcome.status === 'rejected') {
        if (streamOutcome.status === 'fulfilled') {
          streamOutcome.value.getTracks().forEach((t) => t.stop());
        }
        throw gestureOutcome.reason;
      }
      if (streamOutcome.status === 'rejected') {
        throw streamOutcome.reason;
      }

      const stream = streamOutcome.value;

      if (loadingText) loadingText.innerText = 'Calibrating Vision Stream...';
      if (loadingBar) loadingBar.style.width = '65%';

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
        throw new Error('Camera opened but video has no resolution (0×0). Try another webcam or update GPU drivers.');
      }

      initTTS().catch((error) => console.warn('TTS init failed:', error));

      startGestureEngine(videoElement, {
        onFrame: (state) => {
          updateOverlay(state);
          updateGestureActivity(state);
        },
        onGesture: (state) => fireAction(state),
      });

      if (loadingText) loadingText.innerText = 'Neural Engine Ready.';
      if (loadingBar) loadingBar.style.width = '100%';
      setTimeout(() => loadingOverlay?.classList.add('hidden'), 500);
      updateSystemStatus('Neural Interface: Active', 'bg-accent');

      if (overlayModeToggle) {
        overlayModeToggle.checked = true;
        window.electronAPI?.toggleOverlayMode(true);
      }
    } catch (error) {
      console.error('App startup failed:', error);
      const v = document.getElementById('webcam-feed');
      const existing = v?.srcObject;
      if (existing?.getTracks) {
        existing.getTracks().forEach((t) => t.stop());
      }
      if (v) v.srcObject = null;

      updateSystemStatus('Fatal Error', 'bg-red-500');
      const name = error?.name || '';
      const msg = error?.message || 'Initialization failed.';
      if (loadingText) loadingText.innerText = msg;

      if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
        showToast(
          'Camera access denied. Enable camera for this app in Windows Settings → Privacy & security → Camera.'
        );
      } else if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
        showToast('No camera found. Plug in a webcam or enable it in Device Manager.');
      } else if (name === 'NotReadableError' || name === 'TrackStartError') {
        showToast('Camera is in use by another app. Close other apps using the camera and try again.');
      } else if (msg.includes('API unavailable')) {
        showToast(msg);
      } else if (msg.includes('timed out') || msg.includes('0×0') || msg.includes('no resolution')) {
        showToast(msg);
      }
    }
  });

  if (clearLogBtn && actionLog) {
    clearLogBtn.addEventListener('click', () => {
      actionLog.innerHTML =
        '<div class="text-center text-sm text-gray-600 mt-10 italic">Waiting for gesture input...</div>';
    });
  }

  if (slider && valLabel) {
    const syncThreshold = (raw) => {
      const v = parseFloat(raw);
      valLabel.innerText = Number.isFinite(v) ? v.toFixed(2) : '0.70';
      if (Number.isFinite(v)) setGestureMinConfidence(v);
    };
    syncThreshold(slider.value);
    slider.addEventListener('input', (event) => {
      syncThreshold(event.target.value);
    });
  }

  if (overlayModeToggle) {
    overlayModeToggle.checked = false;
    window.electronAPI?.toggleOverlayMode(false);
    overlayModeToggle.addEventListener('change', (event) => {
      window.electronAPI?.toggleOverlayMode(Boolean(event.target.checked));
    });
  }
});
