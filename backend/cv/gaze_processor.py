import cv2
import mediapipe as mp
import numpy as np
from mediapipe.python.solutions import face_mesh

mp_face_mesh = face_mesh.FaceMesh(
    static_image_mode=False, max_num_faces=1, refine_landmarks=True
)

# Iris and eye corner landmark indices from MediaPipe Face Mesh topology
LEFT_IRIS = 468
RIGHT_IRIS = 473
LEFT_EYE_CORNERS = [33, 133]
RIGHT_EYE_CORNERS = [362, 263]

# Canonical 3D face model points for PnP solve (in mm)
FACE_3D_MODEL = np.array(
    [
        [0.0, 0.0, 0.0],  # Nose tip
        [0.0, -63.6, -12.5],  # Chin
        [-43.3, 32.7, -26.0],  # Left eye left corner
        [43.3, 32.7, -26.0],  # Right eye right corner
        [-28.9, -28.9, -24.1],  # Left mouth corner
        [28.9, -28.9, -24.1],  # Right mouth corner
    ],
    dtype=np.float64,
)

# Corresponding landmark indices in Face Mesh
FACE_3D_INDICES = [1, 152, 33, 263, 61, 291]


def extract_landmarks(frame: np.ndarray):
    """
    Runs MediaPipe Face Mesh on a BGR frame.
    Returns a (478, 3) array of normalised landmark coordinates,
    or None if no face is detected.
    """
    rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
    results = mp_face_mesh.process(rgb)
    if not results.multi_face_landmarks:
        return None
    lm = results.multi_face_landmarks[0].landmark
    return np.array([[p.x, p.y, p.z] for p in lm], dtype=np.float64)


def compute_gaze_vector(landmarks: np.ndarray, frame_w: int, frame_h: int):
    """
    Derives a normalised (gx, gy) gaze vector from the iris center position
    relative to the eye bounding box defined by the eye corner landmarks.

    Returns (gx, gy) in range [-1, 1]:
        gx: negative = looking left, positive = looking right
        gy: negative = looking up, positive = looking down
    """

    def denorm(lm_idx):
        lm = landmarks[lm_idx]
        return np.array([lm[0] * frame_w, lm[1] * frame_h])

    left_iris = denorm(LEFT_IRIS)
    right_iris = denorm(RIGHT_IRIS)
    ll, lr = denorm(LEFT_EYE_CORNERS[0]), denorm(LEFT_EYE_CORNERS[1])
    rl, rr = denorm(RIGHT_EYE_CORNERS[0]), denorm(RIGHT_EYE_CORNERS[1])

    def iris_offset(iris, corner_a, corner_b):
        eye_w = np.linalg.norm(corner_b - corner_a)
        if eye_w < 1e-6:
            return 0.0, 0.0
        center = (corner_a + corner_b) / 2
        offset = iris - center
        gx = np.clip(offset[0] / (eye_w / 2), -1.0, 1.0)
        gy = np.clip(offset[1] / (eye_w / 4), -1.0, 1.0)
        return float(gx), float(gy)

    lgx, lgy = iris_offset(left_iris, ll, lr)
    rgx, rgy = iris_offset(right_iris, rl, rr)

    gx = (lgx + rgx) / 2
    gy = (lgy + rgy) / 2
    return gx, gy


def estimate_head_pose(landmarks: np.ndarray, frame_w: int, frame_h: int):
    """
    Solves PnP using 6 canonical face points to estimate pitch, yaw, and roll.
    Returns (pitch, yaw, roll) in degrees.
    """
    face_2d = np.array(
        [
            [landmarks[i][0] * frame_w, landmarks[i][1] * frame_h]
            for i in FACE_3D_INDICES
        ],
        dtype=np.float64,
    )

    focal_len = frame_w
    cam_matrix = np.array(
        [[focal_len, 0, frame_w / 2], [0, focal_len, frame_h / 2], [0, 0, 1]],
        dtype=np.float64,
    )
    dist_coeffs = np.zeros((4, 1), dtype=np.float64)

    success, rot_vec, _ = cv2.solvePnP(
        FACE_3D_MODEL, face_2d, cam_matrix, dist_coeffs, flags=cv2.SOLVEPNP_ITERATIVE
    )
    if not success:
        return 0.0, 0.0, 0.0

    rot_mat, _ = cv2.Rodrigues(rot_vec)
    sy = np.sqrt(rot_mat[0, 0] ** 2 + rot_mat[1, 0] ** 2)
    singular = sy < 1e-6

    if not singular:
        pitch = float(np.degrees(np.arctan2(rot_mat[2, 1], rot_mat[2, 2])))
        yaw = float(np.degrees(np.arctan2(-rot_mat[2, 0], sy)))
        roll = float(np.degrees(np.arctan2(rot_mat[1, 0], rot_mat[0, 0])))
    else:
        pitch = float(np.degrees(np.arctan2(-rot_mat[1, 2], rot_mat[1, 1])))
        yaw = float(np.degrees(np.arctan2(-rot_mat[2, 0], sy)))
        roll = 0.0

    return pitch, yaw, roll


def correct_gaze_for_pose(gaze_vec: tuple, pitch: float, yaw: float):
    """
    Applies inverse head rotation to remove head-movement contribution
    from the raw gaze vector.

    Returns corrected (gx, gy).
    """
    gx, gy = gaze_vec
    yaw_rad = np.radians(yaw * 0.4)
    pitch_rad = np.radians(pitch * 0.3)
    corrected_gx = gx - np.sin(yaw_rad)
    corrected_gy = gy - np.sin(pitch_rad)
    corrected_gx = float(np.clip(corrected_gx, -1.0, 1.0))
    corrected_gy = float(np.clip(corrected_gy, -1.0, 1.0))
    return corrected_gx, corrected_gy


def eye_aspect_ratio(landmarks):
    # vertical eye landmarks (approx)
    left_top = landmarks[159]
    left_bottom = landmarks[145]

    right_top = landmarks[386]
    right_bottom = landmarks[374]

    left = abs(left_top[1] - left_bottom[1])
    right = abs(right_top[1] - right_bottom[1])

    return float((left + right) / 2.0)


def process_frame(frame):
    h, w = frame.shape[:2]

    landmarks = extract_landmarks(frame)
    if landmarks is None:
        return None

    raw_gaze = compute_gaze_vector(landmarks, w, h)
    pitch, yaw, roll = estimate_head_pose(landmarks, w, h)

    corrected_gaze = correct_gaze_for_pose(raw_gaze, pitch, yaw)
    eye_aspect = eye_aspect_ratio(landmarks)

    return {
        "features": [
            corrected_gaze[0],
            corrected_gaze[1],
            pitch,
            yaw,
            roll,
            eye_aspect,
        ],
        "pitch": pitch,
        "yaw": yaw,
        "roll": roll,
    }
