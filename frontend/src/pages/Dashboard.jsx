import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useGazeSocket } from "../hooks/useGazeSocket";
import GazeCursor from "../components/GazeCursor";

const Dashboard = () => {
  const { user } = useAuth();
  const {
    isConnected,
    isFaceDetected,
    isCalibrated,
    gazePoint,
    dwellProgress,
    shouldClick,
    startCamera,
    stopCamera,
  } = useGazeSocket();

  const [cameraOn, setCameraOn] = useState(false);

  const toggleCamera = () => {
    if (cameraOn) {
      stopCamera();
      setCameraOn(false);
    } else {
      startCamera();
      setCameraOn(true);
    }
  };

  return (
    <div style={styles.root}>
      {/* Gaze cursor — always rendered, only visible when face detected */}
      <GazeCursor
        x={gazePoint.x}
        y={gazePoint.y}
        dwellProgress={dwellProgress}
        visible={cameraOn && isFaceDetected}
      />

      <div style={styles.content}>
        {/* Header */}
        <div style={styles.header}>
          <div>
            <h2 style={styles.title}>Dashboard</h2>
            <p style={styles.subtitle}>Welcome back, {user?.username}</p>
          </div>
          <button
            style={{
              ...styles.btn,
              background: cameraOn ? "#ff6363" : "#63ffb4",
            }}
            onClick={toggleCamera}
            disabled={!isConnected}
          >
            {cameraOn ? "Stop Tracking" : "Start Tracking"}
          </button>
        </div>

        {/* Status row */}
        <div style={styles.statusRow}>
          <StatusPill label="WebSocket" active={isConnected} />
          <StatusPill label="Face" active={isFaceDetected} />
          <StatusPill label="Calibrated" active={isCalibrated} />
        </div>

        {/* Gaze coords */}
        {cameraOn && isFaceDetected && (
          <div style={styles.gazeBox}>
            <span style={styles.gazeLabel}>Gaze</span>
            <span style={styles.gazeVal}>
              x: {Math.round(gazePoint.x)}px &nbsp; y: {Math.round(gazePoint.y)}
              px
            </span>
            {!isCalibrated && (
              <span style={styles.warn}>
                ⚠ Not calibrated — gaze position is approximate
              </span>
            )}
          </div>
        )}

        {!isConnected && (
          <p style={styles.warn}>
            CV service offline — start cv_service.py first
          </p>
        )}
      </div>
    </div>
  );
};

function StatusPill({ label, active }) {
  return (
    <div
      style={{
        ...styles.pill,
        background: active ? "rgba(99,255,180,0.12)" : "rgba(255,255,255,0.05)",
        border: `1px solid ${active ? "#63ffb4" : "rgba(255,255,255,0.1)"}`,
      }}
    >
      <div
        style={{
          width: 6,
          height: 6,
          borderRadius: "50%",
          background: active ? "#63ffb4" : "#555",
          boxShadow: active ? "0 0 6px #63ffb4" : "none",
        }}
      />
      <span
        style={{
          fontSize: 12,
          color: active ? "#63ffb4" : "rgba(255,255,255,0.3)",
          letterSpacing: "0.06em",
        }}
      >
        {label.toUpperCase()}
      </span>
    </div>
  );
}

const styles = {
  root: {
    minHeight: "100vh",
    background: "#0a0c10",
    fontFamily: "'DM Mono','Fira Mono',monospace",
    position: "relative",
  },
  content: { maxWidth: 800, margin: "0 auto", padding: "48px 24px" },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 32,
  },
  title: { color: "#f0f0f0", fontSize: 24, fontWeight: 600, margin: 0 },
  subtitle: {
    color: "rgba(255,255,255,0.35)",
    fontSize: 13,
    margin: "4px 0 0",
  },
  btn: {
    padding: "10px 24px",
    border: "none",
    borderRadius: 8,
    fontSize: 13,
    fontWeight: 700,
    cursor: "pointer",
    color: "#0a0c10",
    letterSpacing: "0.04em",
    transition: "background 0.2s",
  },
  statusRow: { display: "flex", gap: 12, marginBottom: 32, flexWrap: "wrap" },
  pill: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    padding: "6px 14px",
    borderRadius: 20,
  },
  gazeBox: {
    background: "rgba(255,255,255,0.03)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 12,
    padding: "20px 24px",
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },
  gazeLabel: {
    color: "rgba(255,255,255,0.3)",
    fontSize: 11,
    letterSpacing: "0.1em",
  },
  gazeVal: { color: "#f0f0f0", fontSize: 20, fontFamily: "monospace" },
  warn: { color: "#ffb347", fontSize: 12, margin: 0 },
};

export default Dashboard;
