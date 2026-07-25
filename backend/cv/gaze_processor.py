import cv2
import numpy as np
from mediapipe.python.solutions import face_mesh

mp_face_mesh = face_mesh.FaceMesh(
    static_image_mode=False, max_num_faces=1, refine_landmarks=True
)

LEFT_IRIS = [468, 469, 470, 471, 472]
RIGHT_IRIS = [473, 474, 475, 476, 477]
LEFT_CORNERS, RIGHT_CORNERS = [33, 133], [362, 263]
LEFT_LIDS = ([159, 158], [145, 153])
RIGHT_LIDS = ([386, 385], [374, 380])
FACE_3D_MODEL = np.array(
    [[0, 0, 0], [0, -63.6, -12.5], [-43.3, 32.7, -26],
     [43.3, 32.7, -26], [-28.9, -28.9, -24.1], [28.9, -28.9, -24.1]],
    dtype=np.float64,
)
FACE_3D_INDICES = [1, 152, 33, 263, 61, 291]


def extract_landmarks(frame):
    results = mp_face_mesh.process(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB))
    if not results.multi_face_landmarks:
        return None
    return np.array(
        [[p.x, p.y, p.z] for p in results.multi_face_landmarks[0].landmark],
        dtype=np.float64,
    )


def _eye_features(landmarks, iris_ids, corner_ids, lid_ids):
    """Return iris coordinates in an eye-local, scale/roll-invariant basis."""
    iris = landmarks[iris_ids, :2].mean(axis=0)
    outer, inner = landmarks[corner_ids, :2]
    horizontal = inner - outer
    width = np.linalg.norm(horizontal)
    if width < 1e-6:
        raise ValueError("Eye landmarks collapsed.")
    x_axis = horizontal / width
    y_axis = np.array([-x_axis[1], x_axis[0]])
    top = landmarks[list(lid_ids[0]), :2].mean(axis=0)
    bottom = landmarks[list(lid_ids[1]), :2].mean(axis=0)
    if np.dot(bottom - top, y_axis) < 0:
        y_axis = -y_axis
    center = (outer + inner) / 2
    u = np.dot(iris - center, x_axis) / width
    v = np.dot(iris - center, y_axis) / width
    openness = abs(np.dot(bottom - top, y_axis)) / width
    return float(u), float(v), float(openness)


def estimate_head_pose(landmarks, frame_w, frame_h):
    face_2d = np.array(
        [[landmarks[i][0] * frame_w, landmarks[i][1] * frame_h] for i in FACE_3D_INDICES],
        dtype=np.float64,
    )
    camera = np.array(
        [[frame_w, 0, frame_w / 2], [0, frame_w, frame_h / 2], [0, 0, 1]],
        dtype=np.float64,
    )
    success, rotation, _ = cv2.solvePnP(
        FACE_3D_MODEL, face_2d, camera, np.zeros((4, 1)), flags=cv2.SOLVEPNP_ITERATIVE
    )
    if not success:
        return 0.0, 0.0, 0.0
    matrix, _ = cv2.Rodrigues(rotation)
    sy = np.sqrt(matrix[0, 0] ** 2 + matrix[1, 0] ** 2)
    return (
        float(np.degrees(np.arctan2(matrix[2, 1], matrix[2, 2]))),
        float(np.degrees(np.arctan2(-matrix[2, 0], sy))),
        float(np.degrees(np.arctan2(matrix[1, 0], matrix[0, 0]))),
    )


def process_frame(frame):
    height, width = frame.shape[:2]
    landmarks = extract_landmarks(frame)
    if landmarks is None:
        return None
    try:
        lu, lv, left_open = _eye_features(landmarks, LEFT_IRIS, LEFT_CORNERS, LEFT_LIDS)
        ru, rv, right_open = _eye_features(landmarks, RIGHT_IRIS, RIGHT_CORNERS, RIGHT_LIDS)
    except ValueError:
        return None
    pitch, yaw, roll = estimate_head_pose(landmarks, width, height)
    eye_distance = np.linalg.norm(landmarks[33, :2] - landmarks[263, :2])
    features = [
        lu, lv, ru, rv, (lu + ru) / 2, (lv + rv) / 2,
        np.clip(yaw / 45, -2, 2), np.clip(pitch / 45, -2, 2),
        np.clip(roll / 45, -2, 2), eye_distance,
    ]
    return {
        "features": [float(value) for value in features],
        "eye_openness": float((left_open + right_open) / 2),
        "pitch": pitch, "yaw": yaw, "roll": roll,
    }
