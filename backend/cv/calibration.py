from __future__ import annotations

from typing import Optional

import numpy as np
from sklearn.linear_model import Ridge
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

MODEL_VERSION = 2
FEATURE_COUNT = 10


class GazeCalibrationModel:
    """Regularised mapping from stable eye/head features to normalised screen space."""

    def __init__(self, alpha: float = 8.0):
        self.alpha = alpha
        self.model_x: Optional[Pipeline] = None
        self.model_y: Optional[Pipeline] = None

    def _make_pipeline(self):
        return Pipeline([("scale", StandardScaler()), ("reg", Ridge(alpha=self.alpha))])

    def fit(self, gaze_samples, screen_targets):
        X = np.asarray(gaze_samples, dtype=np.float64)
        y = np.asarray(screen_targets, dtype=np.float64)
        if X.ndim != 2 or X.shape[1] != FEATURE_COUNT:
            raise ValueError(f"Expected samples with {FEATURE_COUNT} features.")
        if len(X) < 80:
            raise ValueError("At least 80 valid calibration samples are required.")
        if y.shape != (len(X), 2):
            raise ValueError("Each sample must have a two-dimensional target.")
        if not np.isfinite(X).all() or not np.isfinite(y).all():
            raise ValueError("Calibration samples must contain finite numbers.")
        if y.min() < 0 or y.max() > 1:
            raise ValueError("Calibration targets must be normalised to 0..1.")
        self.model_x = self._make_pipeline()
        self.model_y = self._make_pipeline()
        self.model_x.fit(X, y[:, 0])
        self.model_y.fit(X, y[:, 1])

    def predict_normalised(self, features):
        if self.model_x is None or self.model_y is None:
            raise RuntimeError("Calibration model has not been fitted.")
        X = np.asarray(features, dtype=np.float64).reshape(1, -1)
        if X.shape[1] != FEATURE_COUNT:
            raise ValueError(f"Expected {FEATURE_COUNT} features, got {X.shape[1]}.")
        x = float(np.clip(self.model_x.predict(X)[0], 0.0, 1.0))
        y = float(np.clip(self.model_y.predict(X)[0], 0.0, 1.0))
        return x, y

    def map_gaze_to_screen(self, features, screen_w, screen_h):
        x, y = self.predict_normalised(features)
        return int(x * (screen_w - 1)), int(y * (screen_h - 1))

    @staticmethod
    def _dump_pipeline(pipe):
        scaler, reg = pipe.named_steps["scale"], pipe.named_steps["reg"]
        return {
            "mean": scaler.mean_.tolist(), "scale": scaler.scale_.tolist(),
            "coef": reg.coef_.tolist(), "intercept": float(reg.intercept_),
        }

    def to_dict(self):
        if self.model_x is None or self.model_y is None:
            raise RuntimeError("Model not fitted.")
        return {
            "version": MODEL_VERSION, "feature_count": FEATURE_COUNT,
            "alpha": self.alpha, "x": self._dump_pipeline(self.model_x),
            "y": self._dump_pipeline(self.model_y),
        }

    @classmethod
    def from_dict(cls, data):
        if data.get("version") != MODEL_VERSION:
            raise ValueError("Saved calibration is obsolete; recalibrate.")
        model = cls(alpha=float(data.get("alpha", 8.0)))

        def restore(values):
            pipe = model._make_pipeline()
            pipe.fit(np.zeros((2, FEATURE_COUNT)), np.zeros(2))
            scaler, reg = pipe.named_steps["scale"], pipe.named_steps["reg"]
            scaler.mean_ = np.asarray(values["mean"], dtype=np.float64)
            scaler.scale_ = np.asarray(values["scale"], dtype=np.float64)
            scaler.var_ = scaler.scale_ ** 2
            scaler.n_features_in_ = FEATURE_COUNT
            reg.coef_ = np.asarray(values["coef"], dtype=np.float64)
            reg.intercept_ = float(values["intercept"])
            reg.n_features_in_ = FEATURE_COUNT
            return pipe

        model.model_x, model.model_y = restore(data["x"]), restore(data["y"])
        return model


def reject_target_outliers(features, targets):
    keep = np.zeros(len(features), dtype=bool)
    for target in np.unique(targets, axis=0):
        indices = np.flatnonzero(np.all(np.isclose(targets, target), axis=1))
        group = features[indices]
        median = np.median(group, axis=0)
        mad = np.median(np.abs(group - median), axis=0)
        robust_z = np.abs(group - median) / np.maximum(1.4826 * mad, 1e-4)
        keep[indices] = (robust_z < 4.0).all(axis=1)
    return features[keep], targets[keep]


def cross_validated_error(features, targets, alpha=8.0):
    errors = []
    for target in np.unique(targets, axis=0):
        test = np.all(np.isclose(targets, target), axis=1)
        if (~test).sum() < 80:
            continue
        model = GazeCalibrationModel(alpha=alpha)
        model.fit(features[~test], targets[~test])
        predictions = np.array([model.predict_normalised(row) for row in features[test]])
        errors.extend(np.linalg.norm(predictions - targets[test], axis=1) / np.sqrt(2))
    if not errors:
        raise ValueError("Not enough distinct calibration targets.")
    values = np.asarray(errors)
    return {"mean_error": float(values.mean()), "p90_error": float(np.percentile(values, 90))}
