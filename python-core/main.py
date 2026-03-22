#!/usr/bin/env python3
"""
Camera → MediaPipe Hands → gesture metrics → PyAutoGUI.

Run:  python main.py
Exit: ESC in the OpenCV window (or close the window).
"""

from __future__ import annotations

import argparse
import logging
import sys
import threading
from http.server import BaseHTTPRequestHandler, HTTPServer
from urllib.parse import urlparse

import cv2
import pyautogui

from actions import ActionController
from gesture import GestureDetector

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger(__name__)


def _optional_api_server(port: int, controller: ActionController) -> HTTPServer:
    class Handler(BaseHTTPRequestHandler):
        def log_message(self, fmt: str, *args) -> None:
            logger.debug("%s - %s", self.address_string(), fmt % args)

        def _cors(self) -> None:
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
            self.send_header("Access-Control-Allow-Headers", "Content-Type")

        def do_OPTIONS(self) -> None:
            self.send_response(204)
            self._cors()
            self.end_headers()

        def do_POST(self) -> None:
            parsed = urlparse(self.path)
            if parsed.path != "/gesture":
                self.send_error(404, "Not Found")
                return
            length = int(self.headers.get("Content-Length", "0") or 0)
            raw = self.rfile.read(length) if length else b"{}"
            try:
                # Placeholder: log body; extend to drive actions from the web UI if needed.
                text = raw.decode("utf-8", errors="replace")
                logger.info('POST /gesture (placeholder): %s', text[:500])
            except Exception as exc:  # noqa: BLE001
                logger.warning("POST /gesture parse error: %s", exc)
            self.send_response(204)
            self._cors()
            self.end_headers()

    return HTTPServer(("127.0.0.1", port), Handler)


def main() -> int:
    parser = argparse.ArgumentParser(description="Gestra Python gesture → OS control")
    parser.add_argument("--camera", type=int, default=0, help="OpenCV camera index")
    parser.add_argument("--api", action="store_true", help="Listen on 127.0.0.1:8765 for POST /gesture")
    parser.add_argument("--api-port", type=int, default=8765)
    parser.add_argument(
        "--no-scroll",
        action="store_true",
        help="Disable vertical motion → scroll heuristic",
    )
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
    actions = ActionController(smooth_alpha=0.38, click_cooldown_s=1.0)

    server = None
    if args.api:
        server = _optional_api_server(args.api_port, actions)
        threading.Thread(target=server.serve_forever, daemon=True).start()
        logger.info("Optional API: POST http://127.0.0.1:%s/gesture", args.api_port)

    window = "Gestra — Python (ESC to quit)"
    cv2.namedWindow(window, cv2.WINDOW_NORMAL)

    was_pinching = False
    scroll_accum = 0
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
                actions.move_cursor(g.cursor_x, g.cursor_y)

                # Pinch edge → click (with 1s cooldown inside click())
                if g.is_pinching and not was_pinching:
                    actions.click()
                was_pinching = g.is_pinching

                if not args.no_scroll:
                    scroll_accum += detector.vertical_scroll_hint(g.index_tip_norm_y)
                    if scroll_accum >= 4:
                        if actions.scroll_up():
                            logger.info("Scroll up (hand motion)")
                        scroll_accum = 0
                    elif scroll_accum <= -4:
                        if actions.scroll_down():
                            logger.info("Scroll down (hand motion)")
                        scroll_accum = 0
            else:
                if hand_logged:
                    logger.info("Hand lost")
                    hand_logged = False
                was_pinching = False
                scroll_accum = 0
                actions.reset_smoothing()

            # Lightweight preview (no extra work on the hot path beyond draw + imshow)
            preview = cv2.flip(frame, 1)
            cv2.putText(
                preview,
                "ESC: quit",
                (10, 28),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.7,
                (0, 220, 0),
                2,
                cv2.LINE_AA,
            )
            cv2.imshow(window, preview)

            key = cv2.waitKey(1) & 0xFF
            if key == 27:  # ESC
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
