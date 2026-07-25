import numpy as np
from django.test import SimpleTestCase

from cv.calibration import (
    FEATURE_COUNT,
    GazeCalibrationModel,
    cross_validated_error,
    reject_target_outliers,
)
from gaze.serializers import CalibrationInputSerializer


class CalibrationModelTests(SimpleTestCase):
    def setUp(self):
        rng = np.random.default_rng(42)
        axis = np.array([0.1, 0.37, 0.63, 0.9])
        targets = np.array([(x, y) for y in axis for x in axis])
        self.targets = np.repeat(targets, 12, axis=0)
        x, y = self.targets[:, 0], self.targets[:, 1]
        noise = lambda scale=0.003: rng.normal(0, scale, len(x))
        self.features = np.column_stack(
            [
                x + noise(), y + noise(), x + noise(), y + noise(),
                x + noise(), y + noise(), noise(0.01), noise(0.01),
                noise(0.01), 0.3 + noise(),
            ]
        )

    def test_round_trip_preserves_predictions(self):
        model = GazeCalibrationModel()
        model.fit(self.features, self.targets)
        restored = GazeCalibrationModel.from_dict(model.to_dict())
        expected = model.predict_normalised(self.features[0])
        actual = restored.predict_normalised(self.features[0])
        np.testing.assert_allclose(actual, expected)

    def test_cross_validation_reports_generalisation_error(self):
        quality = cross_validated_error(self.features, self.targets)
        self.assertLess(quality["mean_error"], 0.1)

    def test_outlier_rejection_removes_spike(self):
        features = self.features.copy()
        features[0] += 100
        filtered, _ = reject_target_outliers(features, self.targets)
        self.assertLess(len(filtered), len(features))

    def test_serializer_accepts_raw_samples(self):
        samples = [
            {"gaze": [0.0] * FEATURE_COUNT, "target": [0.1, 0.1]}
            for _ in range(80)
        ]
        serializer = CalibrationInputSerializer(data={"samples": samples})
        self.assertTrue(serializer.is_valid(), serializer.errors)
