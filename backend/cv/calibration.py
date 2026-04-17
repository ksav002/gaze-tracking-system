from typing import Optional

import numpy as np
from sklearn.linear_model import LinearRegression
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import PolynomialFeatures


class GazeCalibrationModel:
    """
    Holds two independent polynomial regression models:
    one for screen-x and one for screen-y.
    Fitted from (gaze_vector -> screen_pixel) sample pairs.
    """

    def __init__(self, degree: int = 2):
        self.degree = degree
        self.model_x: Optional[Pipeline] = None
        self.model_y: Optional[Pipeline] = None

    def _make_pipeline(self) -> Pipeline:
        return Pipeline(
            [
                ("poly", PolynomialFeatures(degree=self.degree, include_bias=False)),
                ("reg", LinearRegression()),
            ]
        )

    def fit(self, gaze_samples, screen_targets):
        if len(gaze_samples) < 6:
            raise ValueError("At least 6 calibration points required.")

        X = np.array(gaze_samples, dtype=np.float64)
        y = np.array(screen_targets, dtype=np.float64)

        if X.shape[1] != 6:
            raise ValueError(f"Expected 6 features, got {X.shape[1]}")

        self.model_x = self._make_pipeline()
        self.model_y = self._make_pipeline()

        self.model_x.fit(X, y[:, 0])
        self.model_y.fit(X, y[:, 1])

    def map_gaze_to_screen(self, features, screen_w, screen_h):
        features = np.asarray(features, dtype=np.float64)

        if features.shape[0] != 6:
            raise ValueError(f"Expected 6 features, got {features.shape[0]}")

        X = features.reshape(1, 6)

        x = self.model_x.predict(X)[0]
        y = self.model_y.predict(X)[0]

        px = int(np.clip(x, 0, screen_w - 1))
        py = int(np.clip(y, 0, screen_h - 1))

        return px, py

    def to_dict(self) -> dict:
        """Serialises model coefficients to a JSON-safe dict for API storage."""
        if self.model_x is None or self.model_y is None:
            raise RuntimeError("Model not fitted.")
        return {
            "degree": self.degree,
            "coef_x": self.model_x.named_steps["reg"].coef_.tolist(),
            "coef_y": self.model_y.named_steps["reg"].coef_.tolist(),
            "intercept_x": float(self.model_x.named_steps["reg"].intercept_),
            "intercept_y": float(self.model_y.named_steps["reg"].intercept_),
        }

    @classmethod
    def from_dict(cls, data: dict) -> "GazeCalibrationModel":
        """Reconstructs a calibration model from stored coefficient dict."""
        model = cls(degree=data["degree"])

        def restore(coef, intercept):
            pipe = Pipeline(
                [
                    (
                        "poly",
                        PolynomialFeatures(degree=data["degree"], include_bias=False),
                    ),
                    ("reg", LinearRegression()),
                ]
            )
            pipe.fit(np.zeros((1, 6)), np.zeros(1))  # initialise internal state
            pipe.named_steps["reg"].coef_ = np.array(coef)
            pipe.named_steps["reg"].intercept_ = intercept
            return pipe

        model.model_x = restore(data["coef_x"], data["intercept_x"])
        model.model_y = restore(data["coef_y"], data["intercept_y"])
        return model


# 9-point calibration target positions as normalised (0-1) screen fractions
CALIBRATION_TARGETS_NORM = [
    (0.1, 0.1),
    (0.5, 0.1),
    (0.9, 0.1),
    (0.1, 0.5),
    (0.5, 0.5),
    (0.9, 0.5),
    (0.1, 0.9),
    (0.5, 0.9),
    (0.9, 0.9),
]


def get_calibration_targets(screen_w: int, screen_h: int) -> list[tuple[int, int]]:
    """Returns the 9 pixel-coordinate calibration targets for a given screen size."""
    return [
        (int(nx * screen_w), int(ny * screen_h)) for nx, ny in CALIBRATION_TARGETS_NORM
    ]
