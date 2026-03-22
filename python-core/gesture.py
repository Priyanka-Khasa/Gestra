"""
MediaPipe Tasks Hand Landmarker: index fingertip, thumb tip, pinch, screen cursor.
Compatible with mediapipe>=0.10 (tasks API; legacy `solutions` was removed).
"""

from __future__ import annotations

import urllib.request
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

import cv2
import numpy as np
from mediapipe.tasks.python.core.base_options import BaseOptions
from mediapipe.tasks.python.vision import HandLandmarker, HandLandmarkerOptions
from mediapipe.tasks.python.vision.core import image as mp_image
from mediapipe.tasks.python.vision.core.vision_task_running_mode import VisionTaskRunningMode

# Same model family as the web HandLandmarker (float16 bundle).
_MODEL_URL = (
    "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/"
    "hand_landmarker.task"
)


def _default_model_path() -> Path:
    return Path(__file__).resolve().parent / "models" / "hand_landmarker.task"


def ensure_hand_model(path: Optional[Path] = None) -> Path:
    """Download the .task file once if missing."""
    p = path or _default_model_path()
    p.parent.mkdir(parents=True, exist_ok=True)
    if not p.is_file():
        print(f"[gesture] Downloading hand landmarker model to {p} ...")
        urllib.request.urlretrieve(_MODEL_URL, p)
    return p


@dataclass
class GestureFrame:
    cursor_x: int
    cursor_y: int
    pinch_distance_norm: float
    is_pinching: bool
    hand_detected: bool
    index_tip_norm_y: float


class GestureDetector:
    """Single-hand tracker: mirror X for webcam, pinch with hysteresis."""

    def __init__(
        self,
        screen_width: int,
        screen_height: int,
        *,
        model_path: Optional[Path] = None,
        pinch_on_threshold: float = 0.055,
        pinch_off_threshold: float = 0.085,
        min_hand_detection_confidence: float = 0.7,
        min_hand_presence_confidence: float = 0.5,
        min_tracking_confidence: float = 0.5,
    ) -> None:
        self._sw = max(1, int(screen_width))
        self._sh = max(1, int(screen_height))
        self._pinch_on = pinch_on_threshold
        self._pinch_off = pinch_off_threshold
        self._pinch_latched = False
        self._ts_ms = 0

        mp = ensure_hand_model(model_path)
        options = HandLandmarkerOptions(
            base_options=BaseOptions(model_asset_path=str(mp)),
            running_mode=VisionTaskRunningMode.VIDEO,
            num_hands=1,
            min_hand_detection_confidence=min_hand_detection_confidence,
            min_hand_presence_confidence=min_hand_presence_confidence,
            min_tracking_confidence=min_tracking_confidence,
        )
        self._landmarker = HandLandmarker.create_from_options(options)

        self._prev_index_y: Optional[float] = None

    def close(self) -> None:
        self._landmarker.close()

    @staticmethod
    def _dist_norm(ax: float, ay: float, bx: float, by: float) -> float:
        dx = ax - bx
        dy = ay - by
        return (dx * dx + dy * dy) ** 0.5

    def process_bgr(self, frame_bgr) -> GestureFrame:
        rgb = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2RGB)
        rgb = np.ascontiguousarray(rgb)
        mp_img = mp_image.Image(mp_image.ImageFormat.SRGB, rgb)

        self._ts_ms += 33
        result = self._landmarker.detect_for_video(mp_img, self._ts_ms)

        if not result.hand_landmarks:
            self._prev_index_y = None
            return GestureFrame(
                cursor_x=self._sw // 2,
                cursor_y=self._sh // 2,
                pinch_distance_norm=1.0,
                is_pinching=False,
                hand_detected=False,
                index_tip_norm_y=0.5,
            )

        lm = result.hand_landmarks[0]
        thumb_tip = lm[4]
        index_tip = lm[8]

        nx = 1.0 - float(index_tip.x)
        ny = float(index_tip.y)
        cx = int(max(0, min(self._sw - 1, nx * self._sw)))
        cy = int(max(0, min(self._sh - 1, ny * self._sh)))

        pinch_d = self._dist_norm(thumb_tip.x, thumb_tip.y, index_tip.x, index_tip.y)

        if self._pinch_latched:
            if pinch_d > self._pinch_off:
                self._pinch_latched = False
        else:
            if pinch_d < self._pinch_on:
                self._pinch_latched = True

        return GestureFrame(
            cursor_x=cx,
            cursor_y=cy,
            pinch_distance_norm=pinch_d,
            is_pinching=self._pinch_latched,
            hand_detected=True,
            index_tip_norm_y=ny,
        )

    def vertical_scroll_hint(self, index_tip_norm_y: float, threshold: float = 0.012) -> int:
        if self._prev_index_y is None:
            self._prev_index_y = index_tip_norm_y
            return 0
        dy = index_tip_norm_y - self._prev_index_y
        self._prev_index_y = index_tip_norm_y
        if dy < -threshold:
            return 1
        if dy > threshold:
            return -1
        return 0
