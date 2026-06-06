import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useGazeSocket } from "../hooks/useGazeSocket";
import GazeCursor from "../components/GazeCursor";

// ── Viewport dimensions — what the browser actually renders into ─────────────
// window.innerWidth/Height excludes the OS taskbar and browser chrome,
// giving the correct coordinate space that matches what cv_service maps to.
function getViewport() {
  return { w: window.innerWidth, h: window.innerHeight };
}

const NAV_ITEMS = [
  { label: "Dashboard", to: "/dashboard" },
  { label: "Calibrate", to: "/calibration" },
  { label: "Heatmap", to: "/heatmap" },
  { label: "Profile", to: "/profile" },
];

export default function Dashboard() {
  const { user, logout } = useAuth();
  const {
    isConnected,
    isFaceDetected,
    isCalibrated,
    gazePoint,
    dwellProgress,
    startCamera,
    stopCamera,
  } = useGazeSocket();

  const [cameraOn, setCameraOn] = useState(false);
  const [viewport, setViewport] = useState(getViewport);
  const vpRef = useRef(getViewport());

  // Keep viewport in sync and pass accurate dimensions to cv_service via
  // a data attribute so the parent app can read them if needed
  useEffect(() => {
    const update = () => {
      const vp = getViewport();
      setViewport(vp);
      vpRef.current = vp;
    };
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  const toggle = () => {
    if (cameraOn) {
      stopCamera();
      setCameraOn(false);
    } else {
      // Pass current viewport to cv_service via a custom WS message
      // so it maps gaze to the actual renderable area, not full screen res
      startCamera(vpRef.current.w, vpRef.current.h);
      setCameraOn(true);
    }
  };

  const statusItems = [
    { label: "WebSocket", active: isConnected },
    { label: "Face", active: isFaceDetected },
    { label: "Calibrated", active: isCalibrated },
  ];

  return (
    <div style={s.root}>
      <GazeCursor
        x={gazePoint.x}
        y={gazePoint.y}
        dwellProgress={dwellProgress}
        visible={cameraOn && isFaceDetected}
      />

      {/* Sidebar */}
      <aside style={s.sidebar}>
        <div style={s.logo}>
          <EyeIcon />
          <span style={s.logoText}>GazeTrack</span>
        </div>

        <nav style={s.nav}>
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              style={s.navLink}
              className="nav-link"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <button style={s.logoutBtn} onClick={logout}>
          Sign out
        </button>
      </aside>

      {/* Main */}
      <main style={s.main}>
        {/* Top bar */}
        <div style={s.topbar}>
          <div>
            <h1 style={s.pageTitle}>Dashboard</h1>
            <p style={s.pageSubtitle}>
              Viewport {viewport.w} × {viewport.h}px
            </p>
          </div>
          <button
            style={{
              ...s.trackBtn,
              background: cameraOn ? "#ff6363" : "#63ffb4",
            }}
            onClick={toggle}
            disabled={!isConnected}
          >
            {cameraOn ? "Stop tracking" : "Start tracking"}
          </button>
        </div>

        {/* Status pills */}
        <div style={s.pills}>
          {statusItems.map(({ label, active }) => (
            <StatusPill key={label} label={label} active={active} />
          ))}
        </div>

        {/* Gaze readout */}
        {cameraOn && (
          <div style={s.readout}>
            <div style={s.readoutGrid}>
              <Metric label="X" value={`${Math.round(gazePoint.x)}px`} />
              <Metric label="Y" value={`${Math.round(gazePoint.y)}px`} />
              <Metric
                label="Face"
                value={isFaceDetected ? "detected" : "—"}
                dim={!isFaceDetected}
              />
              <Metric
                label="Dwell"
                value={`${Math.round(dwellProgress * 100)}%`}
              />
            </div>
            {!isCalibrated && (
              <div style={s.warn}>
                ⚠ Not calibrated — run calibration for accurate tracking
              </div>
            )}
          </div>
        )}

        {!isConnected && (
          <div style={s.warn}>CV service offline — run cv_service.py first</div>
        )}
      </main>
    </div>
  );
}

function StatusPill({ label, active }) {
  return (
    <div
      style={{
        ...s.pill,
        borderColor: active ? "rgba(99,255,180,0.3)" : "rgba(255,255,255,0.06)",
        background: active ? "rgba(99,255,180,0.06)" : "transparent",
      }}
    >
      <div
        style={{
          width: 6,
          height: 6,
          borderRadius: "50%",
          background: active ? "#63ffb4" : "#333",
          boxShadow: active ? "0 0 8px #63ffb4" : "none",
        }}
      />
      <span
        style={{
          fontSize: 11,
          color: active ? "#63ffb4" : "rgba(255,255,255,0.2)",
          letterSpacing: "0.08em",
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
      <span style={{ ...s.metricVal, opacity: dim ? 0.3 : 1 }}>{value}</span>
    </div>
  );
}

function EyeIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 32 32" fill="none">
      <ellipse
        cx="16"
        cy="16"
        rx="13"
        ry="8"
        stroke="#63ffb4"
        strokeWidth="1.5"
      />
      <circle cx="16" cy="16" r="4" fill="#63ffb4" opacity="0.9" />
      <circle cx="17.5" cy="14.5" r="1.2" fill="#0a0c10" />
    </svg>
  );
}

const s = {
  root: {
    display: "flex",
    minHeight: "100vh",
    background: "#070910",
    fontFamily: "'DM Mono','Fira Mono',monospace",
    color: "#f0f0f0",
  },
  sidebar: {
    width: 200,
    flexShrink: 0,
    borderRight: "1px solid rgba(255,255,255,0.05)",
    padding: "28px 20px",
    display: "flex",
    flexDirection: "column",
    gap: 0,
  },
  logo: { display: "flex", alignItems: "center", gap: 8, marginBottom: 40 },
  logoText: {
    fontSize: 13,
    fontWeight: 700,
    color: "#63ffb4",
    letterSpacing: "0.06em",
  },
  nav: { display: "flex", flexDirection: "column", gap: 2, flex: 1 },
  navLink: {
    display: "block",
    padding: "9px 12px",
    fontSize: 12,
    color: "rgba(255,255,255,0.4)",
    textDecoration: "none",
    borderRadius: 7,
    letterSpacing: "0.04em",
    transition: "color 0.2s, background 0.2s",
  },
  logoutBtn: {
    marginTop: 24,
    background: "transparent",
    border: "1px solid rgba(255,255,255,0.07)",
    borderRadius: 7,
    padding: "8px 12px",
    fontSize: 11,
    color: "rgba(255,255,255,0.25)",
    cursor: "pointer",
    letterSpacing: "0.04em",
    textAlign: "left",
  },
  main: { flex: 1, padding: "40px 48px" },
  topbar: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 32,
  },
  pageTitle: {
    fontSize: 22,
    fontWeight: 600,
    margin: 0,
    letterSpacing: "-0.02em",
  },
  pageSubtitle: {
    fontSize: 11,
    color: "rgba(255,255,255,0.2)",
    margin: "4px 0 0",
  },
  trackBtn: {
    padding: "10px 22px",
    border: "none",
    borderRadius: 8,
    fontSize: 12,
    fontWeight: 700,
    cursor: "pointer",
    color: "#070910",
    letterSpacing: "0.05em",
    transition: "opacity 0.2s",
  },
  pills: { display: "flex", gap: 10, marginBottom: 32, flexWrap: "wrap" },
  pill: {
    display: "flex",
    alignItems: "center",
    gap: 7,
    padding: "6px 14px",
    borderRadius: 20,
    border: "1px solid",
  },
  readout: {
    background: "rgba(255,255,255,0.02)",
    border: "1px solid rgba(255,255,255,0.06)",
    borderRadius: 12,
    padding: "24px 28px",
    display: "flex",
    flexDirection: "column",
    gap: 16,
  },
  readoutGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(4,1fr)",
    gap: 20,
  },
  metric: { display: "flex", flexDirection: "column", gap: 4 },
  metricLabel: {
    fontSize: 10,
    color: "rgba(255,255,255,0.25)",
    letterSpacing: "0.1em",
    textTransform: "uppercase",
  },
  metricVal: {
    fontSize: 18,
    fontWeight: 600,
    fontVariantNumeric: "tabular-nums",
  },
  warn: {
    fontSize: 11,
    color: "#ffb347",
    background: "rgba(255,179,71,0.06)",
    border: "1px solid rgba(255,179,71,0.15)",
    borderRadius: 6,
    padding: "8px 12px",
  },
};
