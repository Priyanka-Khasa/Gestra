# RunAnywhere AI (Gestra2)

RunAnywhere AI is a desktop shell for camera-driven control, system actions, and an assistant panel. The app can use a local browser vision flow or a Python bridge, depending on which runtime is available.

## Gesture actions

| Gesture | Action |
|---------|--------|
| Open palm | Scroll up continuously while held |
| Closed fist | Scroll down continuously while held |
| Peace | PrintScreen |
| Thumbs up | Media play/pause |
| Index point | Move cursor |
| Pinch | Left click |

## Run modes

### Collective mode

Python owns the camera and serves:

- `GET /camera.mjpg` for the live preview
- `GET /api/v1/state` for HUD state

The Electron UI shows the MJPEG stream and stays in sync with the state endpoint.

### Local camera mode

The app uses `getUserMedia` and the browser vision engine. It can still `POST /gesture` to Python when the bridge is available, and it falls back to the Electron native action bridge when needed.

## Project layout

- `python-core/main.py` - camera loop, state, actions, API bridge
- `python-core/gesture.py` - landmark classification and gesture stability
- `python-core/actions.py` - PyAutoGUI actions and smoothing
- `electron/main.cjs` - window, tray, assistant bridge, Python startup
- `src/main.js` - startup flow, camera flow, HUD updates
- `src/gesture-mediapipe.js` - browser gesture detection
- `src/actions.js` - gesture routing and action fallback execution

## Scripts

| Command | Purpose |
|--------|---------|
| `npm run dev` | Vite + Electron |
| `npm run build` | Production build |
| `npm run preview` | Static preview only |
