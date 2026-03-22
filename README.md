# GestureOS (Gestra2)

Desktop **Electron** app that maps **webcam hand gestures** (MediaPipe) to **system actions** (scroll, click, media keys, screenshot hotkey) and includes an optional **Gemini** or **xAI** assistant with voice wake (“Hey Gesture”).

## Requirements

- **Windows** (primary target; `electron-builder` is configured for NSIS).
- **Node.js** 18+ recommended.
- **Webcam** and microphone (for assistant voice) permissions when prompted.
- **Internet** on first run for MediaPipe WASM/model CDN assets.

## Quick start

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Environment (optional — for the AI assistant)**

   Copy `.env.example` to `.env` and set at least one API key:

   - `VITE_GEMINI_API_KEY` — default provider.
   - Or `VITE_XAI_API_KEY` — if set, xAI is used instead of Gemini.

3. **Run the full app (Vite + Electron)**

   ```bash
   npm run dev
   ```

   This is the same as `npm run electron:dev` (both run Vite with `vite-plugin-electron`, which launches the Electron window).

4. **Use the app**

   - Click **Initialize System**, allow camera access.
   - Use **Overlay click-through** so the window does not block clicks on other apps (optional).
   - Open **Assistant Engine** for chat; say **“Hey Gesture”** then your command if voice is supported in your environment.

## Scripts

| Command | Purpose |
|--------|---------|
| `npm run dev` | Development: Vite + Electron with hot reload. |
| `npm run electron:dev` | Same as `dev`. |
| `npm run build` | Production Vite build for renderer; copies `electron/*.cjs` into `dist-electron/`. |
| `npm run preview` | Static preview server only (no Electron bridge — gestures fall back to browser behavior). |
| `npm run dist` | Build then package Windows installer via `electron-builder`. |

## Gesture → action map

| Gesture | Action (Electron) |
|--------|-------------------|
| Open palm | Scroll up (repeat while held) |
| Closed fist | Scroll down (repeat while held) |
| Peace sign | Print Screen key (OS-defined screenshot behavior) |
| Thumbs up | Media play/pause |
| Index point | Left click |

In **browser-only** mode (no `electronAPI`), “screenshot” saves a canvas capture of the app UI via `html2canvas`; other actions show a toast.

## Project layout

- `electron/main.cjs` — window, tray, IPC, `nut-js` automation, assistant API proxy.
- `electron/preload.cjs` — exposes `electronAPI` to the renderer.
- `src/main.js` — gesture pipeline startup, webcam, overlay toggle.
- `src/gesture-mediapipe.js` — MediaPipe hand landmarker + gesture classification.
- `src/actions.js` — gesture → action execution and cooldowns.
- `src/assistant.js` / `src/ai.js` — assistant UI and provider routing.
- `src/voice.js` — Web Speech API wake word + commands.

## License

See repository license if present; dependencies have their own licenses.
