"""
OS control via PyAutoGUI: smoothed cursor, click cooldown, scroll helpers.
"""

from __future__ import annotations

import logging
import time
from typing import Optional

import pyautogui

logger = logging.getLogger(__name__)

# Gesture-driven cursor can hug edges; disable corner failsafe for demo stability on Windows.
pyautogui.FAILSAFE = False
pyautogui.PAUSE = 0


class ActionController:
    def __init__(
        self,
        *,
        smooth_alpha: float = 0.35,
        click_cooldown_s: float = 1.0,
        scroll_cooldown_s: float = 0.35,
    ) -> None:
        self._alpha = max(0.05, min(0.95, smooth_alpha))
        self._click_cooldown_s = click_cooldown_s
        self._scroll_cooldown_s = scroll_cooldown_s
        self._last_click = 0.0
        self._last_scroll = 0.0
        self._sx: Optional[float] = None
        self._sy: Optional[float] = None
        self._last_move_log = 0.0

    def reset_smoothing(self) -> None:
        self._sx = None
        self._sy = None

    def move_cursor(self, x: int, y: int) -> None:
        if self._sx is None or self._sy is None:
            self._sx, self._sy = float(x), float(y)
        else:
            self._sx = self._alpha * x + (1.0 - self._alpha) * self._sx
            self._sy = self._alpha * y + (1.0 - self._alpha) * self._sy

        now = time.monotonic()
        if now - self._last_move_log >= 0.4:
            self._last_move_log = now
            ix, iy = int(round(self._sx)), int(round(self._sy))
            logger.info("Cursor moving → (%d, %d)", ix, iy)

        ix, iy = int(round(self._sx)), int(round(self._sy))
        pyautogui.moveTo(ix, iy, duration=0)

    def click(self) -> bool:
        now = time.monotonic()
        if now - self._last_click < self._click_cooldown_s:
            return False
        self._last_click = now
        logger.info("Click triggered")
        pyautogui.click()
        return True

    def scroll_up(self) -> bool:
        return self._scroll(1)

    def scroll_down(self) -> bool:
        return self._scroll(-1)

    def _scroll(self, direction: int) -> bool:
        now = time.monotonic()
        if now - self._last_scroll < self._scroll_cooldown_s:
            return False
        self._last_scroll = now
        clicks = 3 * direction
        pyautogui.scroll(clicks)
        return True
