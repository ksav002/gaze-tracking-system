import time
from collections import deque
import numpy as np

# I-DT algorithm parameters
DISPERSION_THRESHOLD_PX = 40    # Max spatial spread to classify as fixation
MIN_FIXATION_DURATION_MS = 150  # Minimum window duration in milliseconds

# Dwell-time parameters
DEFAULT_DWELL_THRESHOLD_MS = 800   # Time to hold gaze before click fires
DWELL_REGION_RADIUS_PX     = 30   # Max movement within same dwell region


class FixationDetector:
    """
    Implements the I-DT (Dispersion-Threshold Identification) fixation
    detection algorithm over a sliding time window of gaze points.
    """

    def __init__(
        self,
        dispersion_threshold: float = DISPERSION_THRESHOLD_PX,
        min_duration_ms: float = MIN_FIXATION_DURATION_MS,
    ):
        self.dispersion_threshold = dispersion_threshold
        self.min_duration_ms      = min_duration_ms
        self.buffer: deque        = deque()  # entries: (x, y, timestamp_ms)

    def update(self, x: float, y: float) -> tuple[bool, tuple | None]:
        """
        Adds a new gaze point and evaluates whether the current window
        constitutes a fixation.

        Args:
            x, y: Current screen-space gaze coordinates

        Returns:
            (is_fixation: bool, centroid: (cx, cy) | None)
        """
        now_ms = time.monotonic() * 1000
        self.buffer.append((x, y, now_ms))

        # Purge points older than window
        cutoff = now_ms - self.min_duration_ms
        while self.buffer and self.buffer[0][2] < cutoff:
            self.buffer.popleft()

        if len(self.buffer) < 3:
            return False, None

        xs = np.array([p[0] for p in self.buffer])
        ys = np.array([p[1] for p in self.buffer])
        dispersion = (xs.max() - xs.min()) + (ys.max() - ys.min())

        if dispersion <= self.dispersion_threshold:
            centroid = (float(xs.mean()), float(ys.mean()))
            return True, centroid

        return False, None

    def reset(self):
        self.buffer.clear()


class DwellTimer:
    """
    Tracks how long a fixation remains on the same screen region.
    Fires a click event when the dwell time exceeds the configured threshold.
    """

    def __init__(
        self,
        threshold_ms: float = DEFAULT_DWELL_THRESHOLD_MS,
        region_radius: float = DWELL_REGION_RADIUS_PX,
    ):
        self.threshold_ms   = threshold_ms
        self.region_radius  = region_radius
        self._start_time    = None
        self._last_pt: tuple | None = None
        self._fired         = False

    def update(self, fixation_pt: tuple | None) -> tuple[bool, float]:
        """
        Updates dwell state with the current fixation point.

        Args:
            fixation_pt: (x, y) fixation centroid, or None if no fixation

        Returns:
            (should_click: bool, dwell_progress: float 0.0-1.0)
        """
        if fixation_pt is None:
            self._reset()
            return False, 0.0

        now_ms = time.monotonic() * 1000
        cx, cy = fixation_pt

        # Check if gaze has moved outside the dwell region
        if self._last_pt is not None:
            dist = np.hypot(cx - self._last_pt[0], cy - self._last_pt[1])
            if dist > self.region_radius:
                self._reset()

        if self._start_time is None:
            self._start_time = now_ms
            self._fired      = False

        self._last_pt = fixation_pt
        elapsed       = now_ms - self._start_time
        progress      = min(elapsed / self.threshold_ms, 1.0)

        if elapsed >= self.threshold_ms and not self._fired:
            self._fired = True
            return True, 1.0

        return False, float(progress)

    def _reset(self):
        self._start_time = None
        self._last_pt    = None
        self._fired      = False

    @property
    def is_active(self) -> bool:
        return self._start_time is not None
