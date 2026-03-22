"""
PyAutoGUI: gesture → OS actions with discrete cooldowns and repeating scroll.
"""

from __future__ import annotations

import logging
import time
from typing import Optional

import pyautogui

logger = logging.getLogger(__name__)

pyautogui.FAILSAFE = False
pyautogui.PAUSE = 0

# 1s between click, PrintScreen, and media play/pause (per user spec).
DISCRETE_COOLDOWN_S = 1.0
# Continuous scroll while palm/fist stable (aligned with renderer repeat interval).
SCROLL_REPEAT_INTERVAL_S = 0.4
SCROLL_CLICKS_PER_TICK = 3


class ActionController:
    def __init__(
        self,
        *,
        smooth_alpha: float = 0.38,
        discrete_cooldown_s: float = DISCRETE_COOLDOWN_S,
        scroll_repeat_interval_s: float = SCROLL_REPEAT_INTERVAL_S,
    ) -> None:
        self._alpha = max(0.05, min(0.95, smooth_alpha))
        self._discrete_cooldown_s = discrete_cooldown_s
        self._scroll_repeat_interval_s = scroll_repeat_interval_s

        self._last_left_click = 0.0
        self._last_screenshot = 0.0
        self._last_playpause = 0.0
        self._last_scroll_up = 0.0
        self._last_scroll_down = 0.0

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

    def _can_discrete(self, last_ts: float) -> bool:
        return time.monotonic() - last_ts >= self._discrete_cooldown_s

    def left_click(self) -> bool:
        if not self._can_discrete(self._last_left_click):
            return False
        self._last_left_click = time.monotonic()
        logger.info("Click triggered (index point)")
        pyautogui.click()
        return True

    def screenshot_printscreen(self) -> bool:
        if not self._can_discrete(self._last_screenshot):
            return False
        self._last_screenshot = time.monotonic()
        logger.info("Screenshot triggered (PrintScreen)")
        pyautogui.press("printscreen")
        return True

    def media_play_pause(self) -> bool:
        if not self._can_discrete(self._last_playpause):
            return False
        self._last_playpause = time.monotonic()
        logger.info("Play/pause triggered")
        pyautogui.press("playpause")
        return True

    def tick_scroll_up(self) -> bool:
        now = time.monotonic()
        if now - self._last_scroll_up < self._scroll_repeat_interval_s:
            return False
        self._last_scroll_up = now
        logger.debug("Scroll up (open palm)")
        pyautogui.scroll(SCROLL_CLICKS_PER_TICK)
        return True

    def tick_scroll_down(self) -> bool:
        now = time.monotonic()
        if now - self._last_scroll_down < self._scroll_repeat_interval_s:
            return False
        self._last_scroll_down = now
        logger.debug("Scroll down (fist)")
        pyautogui.scroll(-SCROLL_CLICKS_PER_TICK)
        return True

    def dispatch_renderer_action(self, name: str) -> bool:
        """
        Kebab-case names from Electron/renderer (src/actions.js gestureToAction).
        Used by HTTP API when the web UI forwards gestures.
        """
        n = (name or "").strip().lower()
        if n == "scroll-up":
            return self.tick_scroll_up()
        if n == "scroll-down":
            return self.tick_scroll_down()
        if n == "left-click":
            return self.left_click()
        if n == "screenshot":
            return self.screenshot_printscreen()
        if n == "play-pause":
            return self.media_play_pause()
        logger.warning("Unknown action: %s", name)
        return False
