import { useEffect, useState } from "react";
import { useGazeSocket } from "../hooks/useGazeSocket";
import LiveGazeHeatmap from "../components/LiveGazeHeatmap";
import api from "../api/client";
import { getViewportSize } from "../utils/viewport";

export default function Dashboard() {
  const {
    isConnected,
    isFaceDetected,
    isCalibrated,
    gazePoint,
    dwellProgress,
    cameraError,
    rawMessage,
    startCamera,
    stopCamera,
  } = useGazeSocket();

  const [cameraOn, setCameraOn] = useState(false);
  const [cameraStarting, setCameraStarting] = useState(false);
  const [startTimedOut, setStartTimedOut] = useState(false);
  const [viewport, setViewport] = useState(getViewportSize);
  // True if the user has any saved calibration in the DB.
  // Checked on mount so returning users aren't blocked before
  // the WebSocket session has confirmed calibration.
  const [hasCalibration, setHasCalibration] = useState(null); // null = loading

  useEffect(() => {
    api
      .get("/calibration/status/")
      .then((r) => setHasCalibration(!!r.data.active))
      .catch(() => setHasCalibration(false));
  }, []);

  useEffect(() => {
    const update = () => setViewport(getViewportSize());
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  // If cv_service reports a camera error, flip back to stopped state
  useEffect(() => {
    if (cameraError) {
      setCameraOn(false);
      setCameraStarting(false);
    }
  }, [cameraError]);

  // Once tracking actually starts, clear any previous timeout notice
  useEffect(() => {
    if (cameraOn) setStartTimedOut(false);
  }, [cameraOn]);

  // Confirm camera is actually running when cv_service sends first packet.
  // rawMessage changes on every packet — any packet (face or no face)
  // means cv_service is alive and the camera request was received.
  useEffect(() => {
    if (rawMessage && cameraStarting) {
      setCameraOn(true);
      setCameraStarting(false);
    }
  }, [rawMessage, cameraStarting]);

  // Also confirm on any non-error socket message while starting
  useEffect(() => {
    if (cameraStarting && isConnected) {
      // If cv_service is not running, no packets ever arrive.
      // Time out after 4s and show an error.
      const timeout = setTimeout(() => {
        setCameraStarting(false);
        setCameraOn(false);
        setStartTimedOut(true);
      }, 4000);
      return () => clearTimeout(timeout);
    }
  }, [cameraStarting, isConnected]);

  const toggle = () => {
    if (cameraOn) {
      stopCamera();
      setCameraOn(false);
    } else {
      setStartTimedOut(false);
      const { w, h } = getViewportSize();
      startCamera(w, h);
      setCameraStarting(true);
    }
  };

  return (
    <>
      <LiveGazeHeatmap
        x={gazePoint.x}
        y={gazePoint.y}
        visible={cameraOn && isFaceDetected}
      />

      {/* Status + action row */}
      <div style={s.topRow}>
        <div style={s.pills}>
          <Pill label="WebSocket" active={isConnected} />
          <Pill label="Face" active={isFaceDetected} />
          <Pill label="Calibrated" active={isCalibrated} />
        </div>
        <button
          style={{
            ...s.btn,
            background: cameraOn
              ? "var(--md-sys-color-error-container)"
              : "var(--md-sys-color-tertiary)",
            borderColor: "transparent",
            color: cameraOn ? "var(--md-sys-color-error)" : "var(--md-sys-color-on-tertiary)",
            opacity: isConnected && (cameraOn || hasCalibration) ? 1 : 0.35,
            cursor:
              !isConnected || (!cameraOn && !hasCalibration) || cameraStarting
                ? "not-allowed"
                : "pointer",
          }}
          onClick={toggle}
          disabled={
            !isConnected || (!cameraOn && !hasCalibration) || cameraStarting
          }
          title={
            !hasCalibration && !cameraOn
              ? "Complete calibration before tracking"
              : ""
          }
        >
          {cameraOn
            ? "Stop tracking"
            : cameraStarting
              ? "Connecting…"
              : "Start tracking"}
        </button>
      </div>

      {/* Not connected warning */}
      {!isConnected && (
        <Banner color="var(--md-sys-color-warning)">
          CV service offline — run cv_service.py first
        </Banner>
      )}

      {/* Camera hardware error */}
      {cameraError && (
        <Banner color="var(--md-sys-color-error)">
          📷 Camera unavailable — {cameraError}. Check that no other application
          is using it.
        </Banner>
      )}

      {/* cv_service connected but no packets arrived — wrong token or service crashed */}
      {startTimedOut && !cameraOn && !cameraError && (
        <Banner color="var(--md-sys-color-warning)">
          ⏱ No response from cv_service — check your token is valid and the
          service is running
        </Banner>
      )}

      {/* Not calibrated — block start, show hint only for new users */}
      {!cameraOn && isConnected && hasCalibration === false && (
        <Banner color="var(--md-sys-color-error)">
          ⚠ Calibration required — go to <strong>Calibration</strong> first to
          set up eye tracking
        </Banner>
      )}

      {/* Gaze readout */}
      {cameraOn && (
        <div style={s.readout}>
          <div style={s.readoutHeader}>Live gaze</div>
          <div style={s.metricGrid}>
            <Metric label="X" value={`${Math.round(gazePoint.x)} px`} />
            <Metric label="Y" value={`${Math.round(gazePoint.y)} px`} />
            <Metric
              label="Face"
              value={isFaceDetected ? "detected" : "—"}
              dim={!isFaceDetected}
            />
            <Metric
              label="Dwell"
              value={`${Math.round(dwellProgress * 100)}%`}
            />
            <Metric label="Viewport" value={`${viewport.w} × ${viewport.h}`} />
          </div>
        </div>
      )}

      {/* Idle state */}
      {!cameraOn && (
        <div style={s.idleBox}>
          <div style={s.idleEye}>
            <svg width="48" height="48" viewBox="0 0 32 32" fill="none">
              <ellipse
                cx="16"
                cy="16"
                rx="13"
                ry="8"
                stroke={
                  isConnected ? "rgba(67,198,179,0.3)" : "rgba(255,255,255,0.1)"
                }
                strokeWidth="1.5"
              />
              <circle
                cx="16"
                cy="16"
                r="4"
                fill={
                  isConnected
                    ? "rgba(67,198,179,0.15)"
                    : "rgba(255,255,255,0.05)"
                }
              />
            </svg>
          </div>

          {!isConnected ? (
            <div style={{ textAlign: "center" }}>
              <p style={s.idleText}>cv_service is not running</p>
              <div style={s.codeBlock}>
                cd backend/cv &amp;&amp; python cv_service.py
              </div>
              <p style={{ ...s.idleText, fontSize: 13, marginTop: 8 }}>
                No token or screen-size arguments are required.
              </p>
            </div>
          ) : (
            <p style={s.idleText}>
              Press <strong style={{ color: "var(--md-sys-color-tertiary)" }}>Start tracking</strong>{" "}
              to begin a gaze session
            </p>
          )}
        </div>
      )}
    </>
  );
}

function Pill({ label, active }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        padding: "5px 12px",
        borderRadius: 8,
        border: active ? "1px solid var(--md-sys-color-tertiary-container)" : "1px solid var(--md-sys-color-outline-variant)",
        background: active ? "var(--md-sys-color-tertiary-container)" : "transparent",
      }}
    >
      <div
        style={{
          width: 5,
          height: 5,
          borderRadius: "50%",
          background: active ? "var(--md-sys-color-tertiary)" : "#2a2a2a",
          boxShadow: active ? "0 0 6px var(--md-sys-color-tertiary)" : "none",
        }}
      />
      <span
        style={{
          fontSize: 12,
          letterSpacing: "0.08em",
          color: active ? "var(--md-sys-color-on-tertiary-container)" : "var(--md-sys-color-on-surface-variant)",
        }}
      >
        {label.toUpperCase()}
      </span>
    </div>
  );
}

function Metric({ label, value, dim }) {
  return (
    <div style={s.metric}>
      <span style={s.metricLabel}>{label}</span>
      <span style={{ ...s.metricVal, opacity: dim ? 0.25 : 1 }}>{value}</span>
    </div>
  );
}

function Banner({ color, children }) {
  return (
    <div
      style={{
        fontSize: 13,
        color,
        background: "var(--md-sys-color-surface-container-high)",
        border: "1px solid " + color,
        borderRadius: 12,
        padding: "14px 16px",
        marginBottom: 16,
      }}
    >
      {children}
    </div>
  );
}

const s = {
  topRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
    flexWrap: "wrap",
    gap: 12,
  },
  pills: { display: "flex", gap: 8, flexWrap: "wrap" },
  btn: {
    padding: "12px 22px",
    minHeight: 48,
    border: "none",
    borderRadius: 24,
    fontSize: 14,
    fontWeight: 500,
    cursor: "pointer",
    letterSpacing: "0.05em",
    fontFamily: "inherit",
    transition: "opacity 0.2s",
  },
  readout: {
    background: "var(--md-sys-color-surface-container)",
    border: "none",
    borderRadius: 12,
    padding: "20px 24px",
  },
  readoutHeader: {
    fontSize: 12,
    color: "var(--md-sys-color-on-surface-variant)",
    letterSpacing: "0.1em",
    textTransform: "uppercase",
    marginBottom: 16,
  },
  metricGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))",
    gap: 16,
  },
  metric: { display: "flex", flexDirection: "column", gap: 4 },
  metricLabel: {
    fontSize: 12,
    color: "rgba(255,255,255,0.62)",
    letterSpacing: "0.1em",
    textTransform: "uppercase",
  },
  metricVal: {
    fontSize: 16,
    fontWeight: 600,
    fontVariantNumeric: "tabular-nums",
  },
  idleBox: {
    marginTop: 40,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 16,
    padding: "48px 24px",
    border: "1px solid var(--md-sys-color-outline-variant)",
    borderRadius: 12,
  },
  idleEye: { opacity: 0.5 },
  idleText: {
    fontSize: 15,
    color: "var(--md-sys-color-on-surface-variant)",
    textAlign: "center",
    margin: 0,
  },
  codeBlock: {
    marginTop: 12,
    padding: "10px 16px",
    background: "var(--md-sys-color-surface-container-lowest)",
    border: "1px solid var(--md-sys-color-outline-variant)",
    borderRadius: 8,
    fontSize: 14,
    color: "var(--md-sys-color-tertiary)",
    fontFamily: "monospace",
    letterSpacing: "0.03em",
    userSelect: "all",
  },
  inlineCode: {
    fontSize: 13,
    color: "rgba(67,198,179,0.7)",
    background: "rgba(67,198,179,0.08)",
    padding: "1px 5px",
    borderRadius: 3,
    fontFamily: "monospace",
  },
};
