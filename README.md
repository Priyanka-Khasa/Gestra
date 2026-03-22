# GestureOS (Gestra2)

Webcam **hand tracking** (MediaPipe) mapped to **OS control** (cursor, click, scroll). The **recommended MVP** is the **Python** pipeline below: **MediaPipe + OpenCV + PyAutoGUI**. It avoids native Node bindings (`robotjs`), **nut-js**, and fragile Electron-side automation.

The **Electron / Vite** UI remains optional for preview and assistant features; **renderer OS actions are stubbed** — they log to the console and may `POST` to an optional local Python listener. **The Electron-based OS control path is deprecated** due to install and OS-level limitations; use **python-core** for real desktop automation.

## Python gesture engine (working MVP)

1. **Install**

   ```bash
   cd python-core
   pip install -r requirements.txt
   python main.py
   ```

   On first run, a **hand landmarker** `.task` model is downloaded into `python-core/models/` (official MediaPipe storage URL).

2. **Use**

   - Allow the camera when prompted (OpenCV).
   - **Index fingertip** moves the cursor (smoothed).
   - **Pinch** (thumb + index close) triggers a **left click** (1 second cooldown).
   - Optional: quick **up/down** motion of the index finger accumulates into **scroll** (disable with `python main.py --no-scroll`).
   - Press **ESC** in the preview window to exit.

3. **Optional bridge from the web UI**

   ```bash
   python main.py --api
   ```

   Listens on `http://127.0.0.1:8765` — `POST /gesture` with JSON body (logged; extend to drive actions).

### Python layout

- `python-core/main.py` — camera loop, pipeline wiring, optional HTTP API.
- `python-core/gesture.py` — MediaPipe Hands, fingertip positions, pinch state.
- `python-core/actions.py` — PyAutoGUI: smoothed `moveTo`, click cooldown, scroll.

Console logs include **Hand detected**, **Cursor moving** (throttled), and **Click triggered**.

## Legacy Electron app (optional)

- **Node.js** 18+ recommended.
- **Internet** on first run for MediaPipe WASM (browser tasks) CDN assets.

```bash
npm install
npm run dev
```

Gesture labels in the UI still appear, but **system actions from the renderer are stubs**; run **python-core** for actual OS control.

### Scripts

| Command | Purpose |
|--------|---------|
| `npm run dev` | Vite + Electron (legacy). |
| `npm run build` | Production Vite build. |
| `npm run preview` | Static preview only. |

### Project layout

- `python-core/` — **supported** gesture → OS pipeline.
- `electron/main.cjs` — legacy window / tray (automation not required for MVP).
- `src/main.js` — UI + browser MediaPipe gesture preview.
- `src/gesture-mediapipe.js` — `@mediapipe/tasks-vision` hand gestures (browser).
- `src/actions.js` — stubbed OS calls + optional `POST /gesture` to Python.

## License

See repository license if present; dependencies have their own licenses.
