import React, { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { postCalibration } from "../api/gaze";
import { useGazeSocket } from "../hooks/useGazeSocket";

// ─── Constants ────────────────────────────────────────────────────────────────
const SAMPLES_PER_DOT = 30;
const SETTLE_DELAY_MS = 800; // wait after dot appears before collecting
const TRANSITION_MS = 500; // dot travel animation duration
const COUNTDOWN_SECS = 3;

const DOTS_NORM = [
  [0.1, 0.1],
  [0.5, 0.1],
  [0.9, 0.1],
  [0.1, 0.5],
  [0.5, 0.5],
  [0.9, 0.5],
  [0.1, 0.9],
  [0.5, 0.9],
  [0.9, 0.9],
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function dotPixels(norm, w, h) {
  return { x: norm[0] * w, y: norm[1] * h };
}

function avg(samples) {
  if (!samples.length) return [0, 0, 0, 0, 0, 0];
  const len = samples[0].length;
  const sum = new Array(len).fill(0);
  for (const s of samples)
    s.forEach((v, i) => {
      sum[i] += v;
    });
  return sum.map((v) => v / samples.length);
}

function useDims() {
  const [dims, setDims] = useState({
    w: window.innerWidth,
    h: window.innerHeight,
  });
  useEffect(() => {
    const handler = () =>
      setDims({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);
  return dims;
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function Calibration() {
  const navigate = useNavigate();
  const dims = useDims();

  const { isConnected, isFaceDetected, rawMessage, startCamera, stopCamera } =
    useGazeSocket();

  // phase: idle | countdown | transition | settling | running | submitting | done | error
  const [phase, setPhase] = useState("idle");
  const [dotIndex, setDotIndex] = useState(0);
  const [collected, setCollected] = useState(0);
  const [countdown, setCountdown] = useState(COUNTDOWN_SECS);
  const [errorMsg, setErrorMsg] = useState("");
  const [dotVisible, setDotVisible] = useState(false); // for fade-in

  // refs so effects always see current values without re-subscribing
  const phaseRef = useRef("idle");
  const dotIndexRef = useRef(0);
  const samplesRef = useRef([]);
  const dotSamplesRef = useRef([]);
  const collectingRef = useRef(false); // true only during "running" phase after settle

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);
  useEffect(() => {
    dotIndexRef.current = dotIndex;
  }, [dotIndex]);

  // ── Sample collection ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!rawMessage) return;
    if (!collectingRef.current) return;
    if (!rawMessage.face_detected) return;

    const gaze =
      Array.isArray(rawMessage.features) && rawMessage.features.length === 6
        ? rawMessage.features
        : null;
    if (!gaze) return;

    if (dotSamplesRef.current.length < SAMPLES_PER_DOT) {
      dotSamplesRef.current.push(gaze);
      setCollected(dotSamplesRef.current.length);
    }
  }, [rawMessage]);

  // ── Advance dot when enough samples collected ───────────────────────────────
  useEffect(() => {
    if (collected < SAMPLES_PER_DOT) return;
    collectingRef.current = false;

    const idx = dotIndexRef.current;
    const { x, y } = dotPixels(DOTS_NORM[idx], dims.w, dims.h);
    samplesRef.current = [
      ...samplesRef.current,
      { gaze: avg(dotSamplesRef.current), target: [x, y] },
    ];

    const next = idx + 1;
    if (next >= DOTS_NORM.length) {
      setPhase("submitting");
      submitCalibration(samplesRef.current);
    } else {
      // Transition: fade out, move, settle, collect
      setPhase("transition");
      setDotVisible(false);

      setTimeout(() => {
        dotSamplesRef.current = [];
        setCollected(0);
        setDotIndex(next);

        // Small delay so CSS position update fires, then fade in
        setTimeout(() => {
          setDotVisible(true);
          setPhase("settling");

          // Wait for user's eyes to land on new dot
          setTimeout(() => {
            collectingRef.current = true;
            setPhase("running");
          }, SETTLE_DELAY_MS);
        }, 60);
      }, TRANSITION_MS);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collected]);

  // ── Submit ──────────────────────────────────────────────────────────────────
  const submitCalibration = useCallback(
    async (samples) => {
      stopCamera();
      try {
        await postCalibration(
          samples.map((s) => ({ gaze: s.gaze, target: s.target })),
        );
        setPhase("done");
      } catch (err) {
        const msg = err?.response?.data
          ? JSON.stringify(err.response.data)
          : err.message;
        setErrorMsg(msg);
        setPhase("error");
      }
    },
    [stopCamera],
  );

  // ── Countdown then begin ────────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== "countdown") return;
    if (countdown <= 0) {
      // Kick off first dot
      setDotIndex(0);
      dotSamplesRef.current = [];
      setCollected(0);
      setDotVisible(true);
      setPhase("settling");
      setTimeout(() => {
        collectingRef.current = true;
        setPhase("running");
      }, SETTLE_DELAY_MS);
      return;
    }
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [phase, countdown]);

  // ── Start flow ──────────────────────────────────────────────────────────────
  const startCalibration = () => {
    samplesRef.current = [];
    dotSamplesRef.current = [];
    collectingRef.current = false;
    setCollected(0);
    setDotIndex(0);
    setCountdown(COUNTDOWN_SECS);
    setDotVisible(false);
    startCamera(dims.w, dims.h);
    setPhase("countdown");
  };

  const retry = () => {
    collectingRef.current = false;
    stopCamera();
    setErrorMsg("");
    setPhase("idle");
  };

  // ── Derived ─────────────────────────────────────────────────────────────────
  const isRunningPhase = ["running", "settling", "transition"].includes(phase);
  const progress = collected / SAMPLES_PER_DOT;
  const currentDotPos = isRunningPhase
    ? dotPixels(DOTS_NORM[dotIndex], dims.w, dims.h)
    : null;

  const settling = phase === "settling";

  return (
    <div style={styles.root}>
      {/* ── Background grid ── */}
      <svg style={styles.grid} width="100%" height="100%">
        <defs>
          <pattern
            id="grid"
            width="60"
            height="60"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M 60 0 L 0 0 0 60"
              fill="none"
              stroke="rgba(255,255,255,0.04)"
              strokeWidth="1"
            />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)" />
      </svg>

      {/* ── IDLE panel ── */}
      {phase === "idle" && (
        <Panel>
          <StatusDot connected={isConnected} />
          <h1 style={styles.title}>Eye Calibration</h1>
          <p style={styles.subtitle}>
            9 targets will appear one at a time.
            <br />
            <strong style={{ color: "#f0f0f0" }}>
              Look directly at each dot
            </strong>{" "}
            and hold until it fills.
          </p>
          <ul style={styles.tipList}>
            <li>Sit 50–70 cm from your screen</li>
            <li>Keep your head still throughout</li>
            <li>Good lighting on your face helps accuracy</li>
            <li>Blink normally — blinks are filtered out</li>
          </ul>
          {!isConnected && (
            <p style={styles.warn}>
              ⚠ CV service not connected — start cv_service.py first
            </p>
          )}
          <button
            style={{ ...styles.btn, opacity: isConnected ? 1 : 0.4 }}
            disabled={!isConnected}
            onClick={startCalibration}
          >
            Begin Calibration
          </button>
        </Panel>
      )}

      {/* ── COUNTDOWN ── */}
      {phase === "countdown" && (
        <Panel>
          <div style={styles.countdownRing}>
            <span style={styles.countdownNum}>{countdown}</span>
          </div>
          <p style={styles.subtitle}>
            {countdown > 0
              ? "Get ready… look at each dot as it appears"
              : "Starting…"}
          </p>
          <FaceStatus detected={isFaceDetected} />
        </Panel>
      )}

      {/* ── SUBMITTING ── */}
      {phase === "submitting" && (
        <Panel>
          <Spinner />
          <p style={styles.subtitle}>Fitting calibration model…</p>
        </Panel>
      )}

      {/* ── DONE ── */}
      {phase === "done" && (
        <Panel>
          <div style={styles.checkmark}>✓</div>
          <h1 style={styles.title}>Calibration Complete</h1>
          <p style={styles.subtitle}>Your gaze model has been saved.</p>
          <button style={styles.btn} onClick={() => navigate("/dashboard")}>
            Go to Dashboard
          </button>
          <button
            style={{ ...styles.btn, ...styles.btnSecondary }}
            onClick={retry}
          >
            Recalibrate
          </button>
        </Panel>
      )}

      {/* ── ERROR ── */}
      {phase === "error" && (
        <Panel>
          <div style={styles.errorIcon}>✕</div>
          <h1 style={styles.title}>Calibration Failed</h1>
          <p style={styles.errorMsg}>{errorMsg}</p>
          <button style={styles.btn} onClick={retry}>
            Try Again
          </button>
        </Panel>
      )}

      {/* ── RUNNING / SETTLING / TRANSITION — dot targets ── */}
      {isRunningPhase && (
        <>
          {/* Ghost dots for upcoming targets */}
          {DOTS_NORM.map((norm, i) => {
            const pos = dotPixels(norm, dims.w, dims.h);
            const done = i < dotIndex;
            const current = i === dotIndex;
            if (current) return null; // rendered separately
            return (
              <div
                key={i}
                style={{
                  ...styles.ghostDot,
                  left: pos.x,
                  top: pos.y,
                  background: done
                    ? "rgba(99,255,180,0.3)"
                    : "rgba(255,255,255,0.07)",
                  border: done
                    ? "1px solid rgba(99,255,180,0.4)"
                    : "1px solid rgba(255,255,255,0.12)",
                  transform: "translate(-50%,-50%)",
                }}
              />
            );
          })}

          {/* Active calibration dot */}
          {currentDotPos && (
            <ActiveDot
              x={currentDotPos.x}
              y={currentDotPos.y}
              progress={progress}
              visible={dotVisible}
              settling={settling}
            />
          )}

          {/* HUD */}
          <div style={styles.hud}>
            <FaceStatus detected={isFaceDetected} compact />
            <span style={styles.hudDot}>
              Dot {dotIndex + 1} / {DOTS_NORM.length}
            </span>
            {settling && (
              <span style={styles.hudHint}>● Hold your gaze here…</span>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Panel({ children }) {
  return <div style={styles.panel}>{children}</div>;
}

function ActiveDot({ x, y, progress, visible, settling }) {
  const r = 22;
  const circ = 2 * Math.PI * r;
  const dash = circ * progress;

  return (
    <div
      style={{
        position: "fixed",
        left: x,
        top: y,
        transform: "translate(-50%,-50%)",
        zIndex: 10,
        opacity: visible ? 1 : 0,
        transition: `opacity ${TRANSITION_MS * 0.6}ms ease`,
      }}
    >
      <svg width={80} height={80} style={{ overflow: "visible" }}>
        {/* Outer pulse ring — only when settling (waiting for gaze) */}
        {settling && (
          <circle
            cx={40}
            cy={40}
            r={36}
            fill="none"
            stroke="rgba(99,255,180,0.18)"
            strokeWidth={2}
          >
            <animate
              attributeName="r"
              values="28;42;28"
              dur="1.2s"
              repeatCount="indefinite"
            />
            <animate
              attributeName="opacity"
              values="0.5;0;0.5"
              dur="1.2s"
              repeatCount="indefinite"
            />
          </circle>
        )}

        {/* Track ring */}
        <circle
          cx={40}
          cy={40}
          r={r}
          fill="none"
          stroke="rgba(99,255,180,0.15)"
          strokeWidth={3}
        />

        {/* Progress arc */}
        <circle
          cx={40}
          cy={40}
          r={r}
          fill="none"
          stroke="#63ffb4"
          strokeWidth={3}
          strokeDasharray={`${dash} ${circ}`}
          strokeLinecap="round"
          transform="rotate(-90 40 40)"
          style={{ transition: "stroke-dasharray 0.06s linear" }}
        />

        {/* Cross-hair lines */}
        <line
          x1={40}
          y1={25}
          x2={40}
          y2={33}
          stroke="rgba(99,255,180,0.4)"
          strokeWidth={1.5}
          strokeLinecap="round"
        />
        <line
          x1={40}
          y1={47}
          x2={40}
          y2={55}
          stroke="rgba(99,255,180,0.4)"
          strokeWidth={1.5}
          strokeLinecap="round"
        />
        <line
          x1={25}
          y1={40}
          x2={33}
          y2={40}
          stroke="rgba(99,255,180,0.4)"
          strokeWidth={1.5}
          strokeLinecap="round"
        />
        <line
          x1={47}
          y1={40}
          x2={55}
          y2={40}
          stroke="rgba(99,255,180,0.4)"
          strokeWidth={1.5}
          strokeLinecap="round"
        />

        {/* Centre dot */}
        <circle cx={40} cy={40} r={5} fill="#63ffb4" />
        <circle cx={40} cy={40} r={2} fill="#0a0c10" />
      </svg>
    </div>
  );
}

function StatusDot({ connected }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        marginBottom: 24,
      }}
    >
      <div
        style={{
          width: 8,
          height: 8,
          borderRadius: "50%",
          background: connected ? "#63ffb4" : "#ff6363",
          boxShadow: connected ? "0 0 8px #63ffb4" : "0 0 8px #ff6363",
        }}
      />
      <span
        style={{
          fontSize: 11,
          color: connected ? "#63ffb4" : "#ff6363",
          letterSpacing: "0.1em",
        }}
      >
        {connected ? "CV SERVICE CONNECTED" : "CV SERVICE OFFLINE"}
      </span>
    </div>
  );
}

function FaceStatus({ detected, compact }) {
  const color = detected ? "#63ffb4" : "#ffb347";
  const label = detected ? "Face detected" : "No face — adjust your position";
  if (compact) {
    return (
      <span
        style={{
          fontSize: 11,
          color,
          letterSpacing: "0.06em",
          display: "flex",
          alignItems: "center",
          gap: 6,
        }}
      >
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: color,
            display: "inline-block",
          }}
        />
        {label}
      </span>
    );
  }
  return (
    <div
      style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}
    >
      <div
        style={{
          width: 8,
          height: 8,
          borderRadius: "50%",
          background: color,
          boxShadow: `0 0 8px ${color}`,
        }}
      />
      <span style={{ fontSize: 12, color, letterSpacing: "0.06em" }}>
        {label}
      </span>
    </div>
  );
}

function Spinner() {
  return (
    <svg width={52} height={52} style={{ marginBottom: 16 }}>
      <circle
        cx={26}
        cy={26}
        r={22}
        fill="none"
        stroke="#63ffb4"
        strokeWidth={3}
        strokeDasharray="80 40"
        strokeLinecap="round"
      >
        <animateTransform
          attributeName="transform"
          type="rotate"
          values="0 26 26;360 26 26"
          dur="0.9s"
          repeatCount="indefinite"
        />
      </circle>
    </svg>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = {
  root: {
    position: "fixed",
    inset: 0,
    background: "#0a0c10",
    fontFamily: "'DM Mono','Fira Mono',monospace",
    overflow: "hidden",
  },
  grid: { position: "absolute", inset: 0, pointerEvents: "none" },
  panel: {
    position: "absolute",
    top: "50%",
    left: "50%",
    transform: "translate(-50%,-50%)",
    background: "rgba(255,255,255,0.03)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 16,
    padding: "48px 56px",
    minWidth: 380,
    maxWidth: 480,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 12,
    backdropFilter: "blur(12px)",
    zIndex: 20,
  },
  title: {
    color: "#f0f0f0",
    fontSize: 26,
    fontWeight: 600,
    margin: 0,
    letterSpacing: "-0.02em",
    textAlign: "center",
  },
  subtitle: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 14,
    lineHeight: 1.7,
    textAlign: "center",
    margin: 0,
  },
  tipList: {
    color: "rgba(255,255,255,0.35)",
    fontSize: 13,
    lineHeight: 2,
    paddingLeft: 18,
    margin: "4px 0",
    alignSelf: "flex-start",
  },
  warn: { color: "#ffb347", fontSize: 12, textAlign: "center", margin: 0 },
  btn: {
    marginTop: 8,
    padding: "12px 32px",
    background: "#63ffb4",
    color: "#0a0c10",
    border: "none",
    borderRadius: 8,
    fontSize: 14,
    fontWeight: 700,
    cursor: "pointer",
    letterSpacing: "0.04em",
    width: "100%",
    transition: "opacity 0.2s",
  },
  btnSecondary: {
    background: "transparent",
    border: "1px solid rgba(255,255,255,0.15)",
    color: "rgba(255,255,255,0.5)",
  },
  checkmark: {
    width: 56,
    height: 56,
    borderRadius: "50%",
    background: "rgba(99,255,180,0.12)",
    border: "1.5px solid #63ffb4",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 26,
    color: "#63ffb4",
    marginBottom: 8,
  },
  errorIcon: {
    width: 56,
    height: 56,
    borderRadius: "50%",
    background: "rgba(255,99,99,0.12)",
    border: "1.5px solid #ff6363",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 26,
    color: "#ff6363",
    marginBottom: 8,
  },
  errorMsg: {
    color: "#ff6363",
    fontSize: 12,
    textAlign: "center",
    wordBreak: "break-all",
    margin: 0,
  },
  ghostDot: {
    position: "fixed",
    width: 14,
    height: 14,
    borderRadius: "50%",
    zIndex: 5,
    transition: "background 0.4s, border 0.4s",
  },
  hud: {
    position: "fixed",
    bottom: 28,
    left: "50%",
    transform: "translateX(-50%)",
    display: "flex",
    alignItems: "center",
    gap: 20,
    background: "rgba(0,0,0,0.45)",
    border: "1px solid rgba(255,255,255,0.07)",
    borderRadius: 40,
    padding: "8px 20px",
    zIndex: 20,
    backdropFilter: "blur(8px)",
  },
  hudDot: {
    color: "rgba(255,255,255,0.35)",
    fontSize: 11,
    letterSpacing: "0.1em",
  },
  hudHint: {
    color: "#ffb347",
    fontSize: 11,
    letterSpacing: "0.06em",
    animation: "pulse 1.2s ease infinite",
  },
  countdownRing: {
    width: 96,
    height: 96,
    borderRadius: "50%",
    border: "2px solid rgba(99,255,180,0.3)",
    background: "rgba(99,255,180,0.05)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
    boxShadow: "0 0 32px rgba(99,255,180,0.08)",
  },
  countdownNum: {
    color: "#63ffb4",
    fontSize: 48,
    fontWeight: 700,
    letterSpacing: "-0.04em",
  },
};
