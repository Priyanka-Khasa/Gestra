#!/usr/bin/env python3
"""
Camera → MediaPipe Hands (21 landmarks) → gesture classification → PyAutoGUI.

Run:  python main.py
      python main.py --api   # + HTTP bridge for Electron/renderer (POST /gesture)
Exit: ESC in the OpenCV window.
"""

from __future__ import annotations

import argparse
import json
import logging
import sys
import threading
from typing import Optional
from http.server import BaseHTTPRequestHandler, HTTPServer
from urllib.parse import urlparse

import cv2
import pyautogui

from actions import ActionController
from gesture import GestureFrame, GestureDetector

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger(__name__)

# Matches src/actions.js gestureToAction
_GESTURE_TO_ACTION = {
    "palm": "scroll-up",
    "fist": "scroll-down",
    "peace": "screenshot",
    "thumb": "play-pause",
    "index": "left-click",
}


def _optional_api_server(port: int, controller: ActionController) -> HTTPServer:
    class Handler(BaseHTTPRequestHandler):
        def log_message(self, fmt: str, *args) -> None:
            logger.debug("%s - %s", self.address_string(), fmt % args)

        def _cors(self) -> None:
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
            self.send_header("Access-Control-Allow-Headers", "Content-Type")

        def do_OPTIONS(self) -> None:
            self.send_response(204)
            self._cors()
            self.end_headers()

        def do_GET(self) -> None:
            parsed = urlparse(self.path)
            if parsed.path != "/health":
                self.send_error(404, "Not Found")
                return
            body = b'{"ok":true,"service":"gestra-python-bridge"}'
            self.send_response(200)
            self._cors()
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

        def do_POST(self) -> None:
            parsed = urlparse(self.path)
            if parsed.path != "/gesture":
                self.send_error(404, "Not Found")
                return
            length = int(self.headers.get("Content-Length", "0") or 0)
            raw = self.rfile.read(length) if length else b"{}"
            action = None
            try:
                data = json.loads(raw.decode("utf-8"))
                action = data.get("action")
                if not action and data.get("gesture"):
                    action = _GESTURE_TO_ACTION.get(str(data["gesture"]))
                if action:
                    ok = controller.dispatch_renderer_action(str(action))
                    logger.info("POST /gesture → %s (%s)", action, "ok" if ok else "skipped/cooldown")
            except json.JSONDecodeError as exc:
                logger.warning("POST /gesture JSON error: %s", exc)
            self.send_response(204)
            self._cors()
            self.end_headers()

    return HTTPServer(("127.0.0.1", port), Handler)


def _draw_hud(preview, g: GestureFrame) -> None:
    line1 = f"{g.gesture}  conf={g.confidence:.2f}  {'STABLE' if g.stable else '…'}"
    cv2.putText(preview, line1, (10, 28), cv2.FONT_HERSHEY_SIMPLEX, 0.65, (0, 220, 0), 2, cv2.LINE_AA)
    cv2.putText(
        preview,
        "ESC: quit  |  index=aim+click  palm/fist=scroll  peace=prtsc  thumb=media",
        (10, 56),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.45,
        (200, 200, 200),
        1,
        cv2.LINE_AA,
    )


def main() -> int:
    parser = argparse.ArgumentParser(description="Gestra Python gesture → OS control")
    parser.add_argument("--camera", type=int, default=0, help="OpenCV camera index")
    parser.add_argument("--api", action="store_true", help="Listen on 127.0.0.1:8765 (GET /health, POST /gesture)")
    parser.add_argument("--api-port", type=int, default=8765)
    args = parser.parse_args()

    cap = cv2.VideoCapture(args.camera)
    if not cap.isOpened():
        logger.error("Could not open camera index %s", args.camera)
        return 1

    cap.set(cv2.CAP_PROP_FRAME_WIDTH, 1280)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 720)
    cap.set(cv2.CAP_PROP_FPS, 60)

    sw, sh = pyautogui.size()
    detector = GestureDetector(sw, sh)
    actions = ActionController()

    server = None
    if args.api:
        server = _optional_api_server(args.api_port, actions)
        threading.Thread(target=server.serve_forever, daemon=True).start()
        logger.info("Bridge: GET http://127.0.0.1:%s/health  POST /gesture", args.api_port)

    window = "Gestra — Python (ESC to quit)"
    cv2.namedWindow(window, cv2.WINDOW_NORMAL)

    prev_stable_id: Optional[str] = None
    hand_logged = False

    try:
        while True:
            ok, frame = cap.read()
            if not ok or frame is None:
                continue

            g = detector.process_bgr(frame)

            if g.hand_detected:
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
                prev_stable_id = Noned
                actions.reset_smoothing()

            preview = cv2.flip(frame, 1)
            _draw_hud(preview, g)
            cv2.imshow(window, preview)

            key = cv2.waitKey(1) & 0xFF
            if key == 27:
                break
    finally:
        cap.release()
        cv2.destroyAllWindows()
        detector.close()
        if server:
            server.shutdown()

    return 0


if __name__ == "__main__":
    sys.exit(main())
