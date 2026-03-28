#!/usr/bin/env python3
"""
Camera to MediaPipe Hands to gesture classification to PyAutoGUI.

- python main.py                  Standalone: OpenCV preview window only (no HTTP).
- python main.py --api            Collective: camera + MediaPipe in Python; stream video to Electron
                                  over MJPEG and HUD state over JSON (no OpenCV window).
- python main.py --api --window   Also show OpenCV (debug).
"""

from __future__ import annotations

import argparse
import json
import logging
import sys
import threading
import time
from http.server import BaseHTTPRequestHandler, HTTPServer
from socketserver import ThreadingMixIn
from typing import Optional
from urllib.parse import urlparse

import cv2
import numpy as np
import pyautogui

from actions import ActionController
from gesture import GestureFrame, GestureDetector

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
    stream=sys.stdout,
)
logger = logging.getLogger(__name__)

_GESTURE_TO_ACTION = {
    "palm": "scroll-up",
    "fist": "scroll-down",
    "peace": "screenshot",
    "thumb": "play-pause",
    "index": "left-click",
}

_, _ph = cv2.imencode(".jpg", np.zeros((64, 64, 3), dtype=np.uint8), [cv2.IMWRITE_JPEG_QUALITY, 70])
PLACEHOLDER_JPEG = _ph.tobytes()


class VisionBroadcast:
    """Thread-safe latest frame + HUD state for MJPEG and /api/v1/state."""

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self.jpeg: bytes = PLACEHOLDER_JPEG
        self.frame_id: int = 0
        self.state: dict = {}

    def publish(self, jpeg_bytes: bytes, state: dict) -> None:
        with self._lock:
            self.jpeg = jpeg_bytes
            self.frame_id += 1
            self.state = state

    def snapshot_jpeg(self) -> tuple[bytes, int]:
        with self._lock:
            return self.jpeg, self.frame_id

    def snapshot_state(self) -> dict:
        with self._lock:
            return dict(self.state)


class RuntimeControl:
    """Thread-safe on/off switch for Python-owned gesture execution."""

    def __init__(self, enabled: bool = True) -> None:
        self._lock = threading.Lock()
        self._enabled = bool(enabled)

    def set_enabled(self, enabled: bool) -> bool:
        with self._lock:
            self._enabled = bool(enabled)
            return self._enabled

    def is_enabled(self) -> bool:
        with self._lock:
            return self._enabled


class ThreadedHTTPServer(ThreadingMixIn, HTTPServer):
    daemon_threads = True


def _build_bridge_manifest(collective: bool) -> dict:
    return {
        "ok": True,
        "service": "gestra-python-bridge",
        "version": "1.0.0",
        "electron": {
            "appContainerId": "app-container",
            "description": "Renderer root for UI capture; same id as index.html #app-container.",
        },
        "vision": {
            # Only "collective" when the webcam could be opened.
            # If the renderer already owns the webcam (common in local-camera mode),
            # we still serve the HTTP API so `POST /gesture` can execute OS actions.
            "collective": bool(collective),
            "mjpegPath": "/camera.mjpg",
            "statePath": "/api/v1/state",
            "description": "Python owns camera + MediaPipe when possible; Electron shows MJPEG and polls state JSON.",
        },
        "endpoints": {
            "health": {"method": "GET", "path": "/health"},
            "bridge": {"method": "GET", "path": "/api/v1/bridge"},
            "state": {"method": "GET", "path": "/api/v1/state"},
            "camera": {"method": "GET", "path": "/camera.mjpg"},
            "runtime": {"method": "POST", "path": "/api/v1/runtime", "body": {"enabled": "true | false"}},
            "gesture": {
                "method": "POST",
                "path": "/gesture",
                "body": {"action": "scroll-up | scroll-down | left-click | screenshot | play-pause"},
            },
            "gestureV1": {"method": "POST", "path": "/api/v1/gesture", "sameAs": "gesture"},
        },
    }


def _optional_api_server(
    port: int,
    controller: ActionController,
    broadcast: VisionBroadcast,
    manifest: dict,
    runtime_control: RuntimeControl,
) -> ThreadedHTTPServer:
    bc = broadcast
    ctrl = controller
    bridge_manifest = dict(manifest)
    runtime = runtime_control

    class Handler(BaseHTTPRequestHandler):
        def log_message(self, fmt: str, *args) -> None:
            logger.debug("%s - %s", self.address_string(), fmt % args)

        def _cors(self) -> None:
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
            self.send_header("Access-Control-Allow-Headers", "Content-Type")

        def _send_json(self, status: int, obj: dict) -> None:
            body = json.dumps(obj).encode("utf-8")
            try:
                self.send_response(status)
                self._cors()
                self.send_header("Content-Type", "application/json; charset=utf-8")
                self.send_header("Content-Length", str(len(body)))
                self.end_headers()
                self.wfile.write(body)
            except (BrokenPipeError, ConnectionResetError, ConnectionAbortedError):
                return

        def do_OPTIONS(self) -> None:
            self.send_response(204)
            self._cors()
            self.end_headers()

        def do_GET(self) -> None:
            path = urlparse(self.path).path.rstrip("/") or "/"
            if path == "/health":
                self._send_json(200, {"ok": True, "service": "gestra-python-bridge"})
                return
            if path == "/api/v1/bridge":
                self._send_json(200, bridge_manifest)
                logger.info("GET /api/v1/bridge")
                return
            if path == "/api/v1/state":
                self._send_json(200, bc.snapshot_state())
                return
            if path == "/camera.mjpg":
                self.send_response(200)
                self.send_header("Cache-Control", "no-cache, no-store, must-revalidate")
                self.send_header("Pragma", "no-cache")
                self.send_header("Content-Type", "multipart/x-mixed-replace; boundary=frame")
                self._cors()
                self.end_headers()

                boundary = b"--frame\r\nContent-Type: image/jpeg\r\n\r\n"
                suffix = b"\r\n"
                last_id = -1
                try:
                    while True:
                        jpeg, fid = bc.snapshot_jpeg()
                        if fid != last_id:
                            last_id = fid
                            self.wfile.write(boundary + jpeg + suffix)
                            self.wfile.flush()
                        else:
                            time.sleep(0.008)
                except (BrokenPipeError, ConnectionResetError, ConnectionAbortedError):
                    pass
                return

            self.send_error(404, "Not Found")

        def _handle_gesture_post(self) -> None:
            length = int(self.headers.get("Content-Length", "0") or 0)
            raw = self.rfile.read(length) if length else b"{}"
            try:
                data = json.loads(raw.decode("utf-8"))
                source = str(data.get("source") or "").strip().lower()
                action = data.get("action")
                if not action and data.get("gesture"):
                    action = _GESTURE_TO_ACTION.get(str(data["gesture"]))
                collective = bool(bridge_manifest.get("vision", {}).get("collective"))
                if collective and source in {"gestureos-renderer", "electron-main"}:
                    self.send_response(204)
                    self._cors()
                    self.end_headers()
                    return
                if action:
                    ok = ctrl.dispatch_renderer_action(str(action))
                    logger.info("POST gesture -> %s (%s)", action, "ok" if ok else "skipped/cooldown")
            except json.JSONDecodeError as exc:
                logger.warning("POST gesture JSON error: %s", exc)

            self.send_response(204)
            self._cors()
            self.end_headers()

        def _handle_runtime_post(self) -> None:
            length = int(self.headers.get("Content-Length", "0") or 0)
            raw = self.rfile.read(length) if length else b"{}"

            try:
                data = json.loads(raw.decode("utf-8"))
            except json.JSONDecodeError:
                data = {}

            enabled = bool(data.get("enabled"))
            runtime.set_enabled(enabled)
            logger.info("POST runtime -> %s", "enabled" if enabled else "paused")
            self._send_json(200, {"ok": True, "runtimeEnabled": runtime.is_enabled()})

        def do_POST(self) -> None:
            path = urlparse(self.path).path.rstrip("/") or "/"
            if path == "/api/v1/runtime":
                self._handle_runtime_post()
                return
            if path in ("/gesture", "/api/v1/gesture"):
                self._handle_gesture_post()
                return
            self.send_error(404, "Not Found")

    return ThreadedHTTPServer(("127.0.0.1", port), Handler)


def _draw_hud(preview, g: GestureFrame) -> None:
    line1 = f"{g.gesture}  conf={g.confidence:.2f}  {'STABLE' if g.stable else '...'}"
    cv2.putText(preview, line1, (10, 28), cv2.FONT_HERSHEY_SIMPLEX, 0.65, (0, 220, 0), 2, cv2.LINE_AA)
    cv2.putText(
        preview,
        "Electron: MJPEG + /api/v1/state  |  ESC: quit (OpenCV window only)",
        (10, 56),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.45,
        (200, 200, 200),
        1,
        cv2.LINE_AA,
    )


def _gesture_frame_to_state(g: GestureFrame, fps_smooth: float) -> dict:
    return {
        "handDetected": g.hand_detected,
        "gesture": g.gesture,
        "confidence": g.confidence,
        "stable": g.stable,
        "stableCount": g.stable_count,
        "historyLen": g.history_len,
        "stability": g.stability,
        "fps": round(fps_smooth, 1),
        "landmarks": g.landmarks_norm or [],
        "source": "python",
    }


def _runtime_paused_state(fps_smooth: float) -> dict:
    return {
        "handDetected": False,
        "gesture": "none",
        "confidence": 0.0,
        "stable": False,
        "stableCount": 0,
        "historyLen": 0,
        "stability": 0.0,
        "fps": round(fps_smooth, 1),
        "landmarks": [],
        "source": "python",
        "runtimeEnabled": False,
    }


def run_pipeline(
    *,
    camera_index: int,
    show_window: bool,
    api_enabled: bool,
    api_port: int,
) -> int:
    cap = cv2.VideoCapture(camera_index)
    camera_ok = cap.isOpened()
    if not camera_ok:
        logger.error("Could not open camera index %s", camera_index)
    else:
        cap.set(cv2.CAP_PROP_FRAME_WIDTH, 1280)
        cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 720)
        cap.set(cv2.CAP_PROP_FPS, 60)

    actions = ActionController()
    broadcast = VisionBroadcast()
    runtime_control = RuntimeControl(enabled=True)

    server: Optional[ThreadedHTTPServer] = None
    if api_enabled:
        server_manifest = _build_bridge_manifest(collective=camera_ok)
        server = _optional_api_server(api_port, actions, broadcast, server_manifest, runtime_control)
        threading.Thread(target=server.serve_forever, daemon=True).start()
        logger.info(
            "Python bridge @ http://127.0.0.1:%s (collective=%s) - GET /api/v1/bridge  POST /gesture ...",
            api_port,
            camera_ok,
        )

    detector: Optional[GestureDetector] = None
    window = "Gestra - Python (ESC to quit)"

    try:
        if not camera_ok:
            if show_window or not api_enabled:
                return 1

            logger.warning("Camera unavailable; running bridge-only mode (POST /gesture works).")
            while True:
                time.sleep(1.0)

        if show_window:
            cv2.namedWindow(window, cv2.WINDOW_NORMAL)

        sw, sh = pyautogui.size()
        detector = GestureDetector(sw, sh)

        prev_stable_id: Optional[str] = None
        hand_logged = False
        fps_smooth = 0.0
        last_t = time.monotonic()

        while True:
            frame_t0 = time.monotonic()
            ok, frame = cap.read()
            if not ok or frame is None:
                continue

            now = time.monotonic()
            dt = max(1e-6, now - last_t)
            last_t = now
            fps_smooth = fps_smooth * 0.85 + (1.0 / dt) * 0.15

            assert detector is not None
            g = detector.process_bgr(frame)
            runtime_enabled = runtime_control.is_enabled()

            if runtime_enabled and g.hand_detected:
                if not hand_logged:
                    logger.info("Hand detected")
                    hand_logged = True

                if g.gesture == "index":
                    actions.move_cursor(g.cursor_x, g.cursor_y)

                stable_id = g.gesture if g.stable else None

                if stable_id == "palm":
                    actions.tick_scroll_up()
                elif stable_id == "fist":
                    actions.tick_scroll_down()

                if stable_id is not None and stable_id != prev_stable_id:
                    if stable_id == "peace":
                        actions.screenshot_printscreen()
                    elif stable_id == "thumb":
                        actions.media_play_pause()
                    elif stable_id == "index":
                        actions.left_click()

                prev_stable_id = stable_id
            else:
                if hand_logged:
                    logger.info("Hand lost")
                    hand_logged = False
                prev_stable_id = None
                actions.reset_smoothing()

            preview = cv2.flip(frame, 1)
            _draw_hud(preview, g)
            state = _gesture_frame_to_state(g, fps_smooth) if runtime_enabled else _runtime_paused_state(fps_smooth)
            state["runtimeEnabled"] = runtime_enabled

            ok_enc, jpg = cv2.imencode(".jpg", preview, [cv2.IMWRITE_JPEG_QUALITY, 72])
            if ok_enc:
                broadcast.publish(jpg.tobytes(), state)

            if show_window:
                cv2.imshow(window, preview)
                key = cv2.waitKey(1) & 0xFF
                if key == 27:
                    break
            elif api_enabled:
                slip = 1.0 / 45.0 - (time.monotonic() - frame_t0)
                if slip > 0:
                    time.sleep(slip)

    except KeyboardInterrupt:
        return 0
    finally:
        cap.release()
        if show_window:
            cv2.destroyAllWindows()
        if detector:
            detector.close()
        if server:
            server.shutdown()

    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description="Gestra Python gesture to OS control")
    parser.add_argument("--camera", type=int, default=0, help="OpenCV camera index")
    parser.add_argument(
        "--api",
        action="store_true",
        help="HTTP bridge + MJPEG (/camera.mjpg) and JSON state (/api/v1/state) for Electron",
    )
    parser.add_argument("--api-port", type=int, default=8765)
    parser.add_argument(
        "--window",
        action="store_true",
        help="Show OpenCV preview (default with --api: off; without --api: on)",
    )
    args = parser.parse_args()

    show_window = args.window or not args.api
    return run_pipeline(
        camera_index=args.camera,
        show_window=show_window,
        api_enabled=args.api,
        api_port=args.api_port,
    )


if __name__ == "__main__":
    sys.exit(main())

