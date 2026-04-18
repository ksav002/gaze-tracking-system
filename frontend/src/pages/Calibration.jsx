import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { postCalibration } from "../api/gaze";
import { useGazeSocket } from "../hooks/useGazeSocket";

const SAMPLES_PER_DOT = 30;

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

export default function Calibration() {
  const navigate = useNavigate();
  const dims = { w: window.innerWidth, h: window.innerHeight };

  const { isConnected, rawMessage, startCamera, stopCamera } = useGazeSocket();

  const [phase, setPhase] = useState("idle");
  const [dotIndex, setDotIndex] = useState(0);
  const [collected, setCollected] = useState(0);
  const [errorMsg, setErrorMsg] = useState("");

  const samplesRef = useRef([]);
  const dotSamplesRef = useRef([]);
  const dotIndexRef = useRef(0);
  const phaseRef = useRef("idle");

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);
  useEffect(() => {
    dotIndexRef.current = dotIndex;
  }, [dotIndex]);

  // ── sample collection — react to each new rawMessage ──────────────────────
  useEffect(() => {
    if (!rawMessage) return;
    if (phaseRef.current !== "running") return;
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
  }, [rawMessage]); // fires on every new packet

  // ── advance dot ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (collected < SAMPLES_PER_DOT) return;

    const idx = dotIndexRef.current;
    const { x, y } = dotPixels(DOTS_NORM[idx], dims.w, dims.h);
    const newEntry = { gaze: avg(dotSamplesRef.current), target: [x, y] };

    samplesRef.current = [...samplesRef.current, newEntry];

    const next = idx + 1;
    if (next >= DOTS_NORM.length) {
      setPhase("submitting");
      submit(samplesRef.current);
    } else {
      dotSamplesRef.current = [];
      setCollected(0);
      setDotIndex(next);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collected]);

  // ── submit ─────────────────────────────────────────────────────────────────
  const submit = async (samples) => {
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
  };

  const startCalibration = () => {
    samplesRef.current = [];
    dotSamplesRef.current = [];
    setCollected(0);
    setDotIndex(0);
    setPhase("running");
    startCamera();
  };

  const retry = () => {
    stopCamera();
    setErrorMsg("");
    setPhase("idle");
  };

  const progress = collected / SAMPLES_PER_DOT;
  const currentDot =
    phase === "running" ? dotPixels(DOTS_NORM[dotIndex], dims.w, dims.h) : null;

  return (
    <div style={styles.root}>
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

      {phase === "idle" && (
        <Panel>
          <StatusDot connected={isConnected} />
          <h1 style={styles.title}>Eye Calibration</h1>
          <p style={styles.subtitle}>
            9 targets will appear one at a time.
            <br />
            <strong>Look directly at each dot</strong> and hold until it fills.
          </p>
          <ul style={styles.tipList}>
            <li>Sit ~50–70 cm from your screen</li>
            <li>Keep your head still</li>
            <li>Good lighting on your face</li>
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

      {phase === "submitting" && (
        <Panel>
          <Spinner />
          <p style={styles.subtitle}>Fitting model…</p>
        </Panel>
      )}

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

      {phase === "running" && (
        <>
          {DOTS_NORM.map((norm, i) => {
            const pos = dotPixels(norm, dims.w, dims.h);
            const done = i < dotIndex;
            return (
              <div
                key={i}
                style={{
                  ...styles.ghostDot,
                  left: pos.x,
                  top: pos.y,
                  background: done
                    ? "rgba(99,255,180,0.25)"
                    : "rgba(255,255,255,0.08)",
                  transform: "translate(-50%,-50%)",
                }}
              />
            );
          })}
          {currentDot && (
            <ActiveDot x={currentDot.x} y={currentDot.y} progress={progress} />
          )}
          <div style={styles.counter}>
            Dot {dotIndex + 1} / {DOTS_NORM.length}
          </div>
        </>
      )}
    </div>
  );
}

function Panel({ children }) {
  return <div style={styles.panel}>{children}</div>;
}

function ActiveDot({ x, y, progress }) {
  const r = 20,
    circ = 2 * Math.PI * r,
    dash = circ * progress;
  return (
    <div
      style={{
        position: "fixed",
        left: x,
        top: y,
        transform: "translate(-50%,-50%)",
        zIndex: 10,
      }}
    >
      <svg width={60} height={60} style={{ overflow: "visible" }}>
        <circle
          cx={30}
          cy={30}
          r={28}
          fill="none"
          stroke="rgba(99,255,180,0.15)"
          strokeWidth={2}
        >
          <animate
            attributeName="r"
            values="22;34;22"
            dur="1.4s"
            repeatCount="indefinite"
          />
          <animate
            attributeName="opacity"
            values="0.6;0;0.6"
            dur="1.4s"
            repeatCount="indefinite"
          />
        </circle>
        <circle
          cx={30}
          cy={30}
          r={r}
          fill="none"
          stroke="rgba(99,255,180,0.3)"
          strokeWidth={3}
        />
        <circle
          cx={30}
          cy={30}
          r={r}
          fill="none"
          stroke="#63ffb4"
          strokeWidth={3}
          strokeDasharray={`${dash} ${circ}`}
          strokeLinecap="round"
          transform="rotate(-90 30 30)"
          style={{ transition: "stroke-dasharray 0.05s linear" }}
        />
        <circle cx={30} cy={30} r={6} fill="#63ffb4" />
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
          fontSize: 12,
          color: connected ? "#63ffb4" : "#ff6363",
          letterSpacing: "0.08em",
        }}
      >
        {connected ? "CV SERVICE CONNECTED" : "CV SERVICE OFFLINE"}
      </span>
    </div>
  );
}

function Spinner() {
  return (
    <svg width={48} height={48} style={{ marginBottom: 16 }}>
      <circle
        cx={24}
        cy={24}
        r={20}
        fill="none"
        stroke="#63ffb4"
        strokeWidth={3}
        strokeDasharray="80 40"
        strokeLinecap="round"
      >
        <animateTransform
          attributeName="transform"
          type="rotate"
          values="0 24 24;360 24 24"
          dur="0.9s"
          repeatCount="indefinite"
        />
      </circle>
    </svg>
  );
}

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
    width: 10,
    height: 10,
    borderRadius: "50%",
    zIndex: 5,
    transition: "background 0.3s",
  },
  counter: {
    position: "fixed",
    bottom: 32,
    left: "50%",
    transform: "translateX(-50%)",
    color: "rgba(255,255,255,0.3)",
    fontSize: 12,
    letterSpacing: "0.1em",
    zIndex: 20,
  },
};
