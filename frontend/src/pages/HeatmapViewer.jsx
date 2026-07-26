import { useEffect, useRef, useState } from "react";
import api from "../api/client";

// Colour map: black → purple → red → orange → yellow → white
const COLORMAP = [
  [0, 0, 0],
  [72, 0, 130],
  [200, 0, 0],
  [255, 100, 0],
  [255, 220, 0],
  [255, 255, 255],
];

function densityToRGB(t) {
  // t in [0, 1] — map through COLORMAP stops
  const stops = COLORMAP.length - 1;
  const scaled = t * stops;
  const lo = Math.floor(scaled);
  const hi = Math.min(lo + 1, stops);
  const f = scaled - lo;
  const [r1, g1, b1] = COLORMAP[lo];
  const [r2, g2, b2] = COLORMAP[hi];
  return [
    Math.round(r1 + (r2 - r1) * f),
    Math.round(g1 + (g2 - g1) * f),
    Math.round(b1 + (b2 - b1) * f),
  ];
}

function renderHeatmap(canvas, density, alpha = 0.75) {
  const rows = density.length;
  const cols = density[0].length;
  canvas.width = cols;
  canvas.height = rows;
  const ctx = canvas.getContext("2d");
  const img = ctx.createImageData(cols, rows);

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const t = density[r][c]; // already [0, 1]
      const [red, green, blue] = densityToRGB(t);
      const idx = (r * cols + c) * 4;
      img.data[idx] = red;
      img.data[idx + 1] = green;
      img.data[idx + 2] = blue;
      // Transparent where density is near zero so background shows through
      img.data[idx + 3] = Math.round(t * alpha * 255);
    }
  }
  ctx.putImageData(img, 0, 0);
}

export default function HeatmapViewer() {
  const [sessions, setSessions] = useState([]);
  const [sessionsError, setSessionsError] = useState("");
  const [selected, setSelected] = useState(null);
  const [heatmapData, setHeatmapData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const canvasRef = useRef(null);

  // Load session list
  useEffect(() => {
    api
      .get(`/sessions/`)
      .then((r) => {
        // Handle both plain array and DRF paginated { results: [] }
        const data = r.data;
        setSessions(Array.isArray(data) ? data : (data.results ?? []));
      })
      .catch((e) => {
        setSessions([]);
        setSessionsError(
          e?.response?.data?.detail || e.message || "Failed to load sessions",
        );
      });
  }, []);

  // Fetch heatmap when session selected
  useEffect(() => {
    if (!selected) return;
    setLoading(true);
    setError("");
    setHeatmapData(null);
    api
      .get(`/sessions/${selected}/heatmap/`, {
        params: {
          grid: 100,
          screen_w: window.screen.width,
          screen_h: window.screen.height,
        },
      })
      .then((r) => setHeatmapData(r.data))
      .catch((e) =>
        setError(e?.response?.data?.error || "Failed to load heatmap"),
      )
      .finally(() => setLoading(false));
  }, [selected]);

  // Render to canvas whenever data arrives
  useEffect(() => {
    if (!heatmapData || !canvasRef.current) return;
    renderHeatmap(canvasRef.current, heatmapData.density);
  }, [heatmapData]);

  const fmtDate = (iso) =>
    new Date(iso).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

  return (
    <div className="heatmap-shell" style={styles.root}>
      <div className="session-panel" style={styles.sidebar}>
        <h3 style={styles.sideTitle}>Sessions</h3>
        {sessionsError && (
          <p style={{ ...styles.empty, color: "var(--md-sys-color-error)" }}>{sessionsError}</p>
        )}
        {!sessionsError && sessions.length === 0 && (
          <p style={styles.empty}>No sessions recorded yet.</p>
        )}
        {(() => {
          const ready = sessions.filter((s) => (s.point_count ?? 0) >= 5);
          const sparse = sessions.filter((s) => (s.point_count ?? 0) < 5);
          return (
            <>
              {ready.length === 0 && sessions.length > 0 && (
                <p style={styles.empty}>No sessions with enough data yet.</p>
              )}
              {ready.map((s) => (
                <button
                  key={s.id}
                  style={{
                    ...styles.sessionBtn,
                    background: selected === s.id
                      ? "var(--md-sys-color-primary-container)"
                      : "var(--md-sys-color-surface-container)",
                    borderColor: selected === s.id
                      ? "transparent"
                      : "var(--md-sys-color-outline-variant)",
                    color: selected === s.id
                      ? "var(--md-sys-color-on-primary-container)"
                      : "var(--md-sys-color-on-surface)",
                  }}
                  onClick={() => setSelected(s.id)}
                >
                  <span style={styles.sessionDate}>
                    {fmtDate(s.started_at)}
                  </span>
                  {s.ended_at && (
                    <span style={styles.sessionDuration}>
                      {Math.round(
                        (new Date(s.ended_at) - new Date(s.started_at)) / 1000,
                      )}
                      s{" · "}
                      {s.point_count} pts
                    </span>
                  )}
                </button>
              ))}
              {sparse.length > 0 && (
                <p style={styles.footnote}>
                  {sparse.length} session{sparse.length > 1 ? "s" : ""} hidden —
                  fewer than 5 gaze points recorded
                </p>
              )}
            </>
          );
        })()}
      </div>

      <div className="heatmap-main" style={styles.main}>
        {!selected && (
          <div style={styles.placeholder}>
            <p style={styles.placeholderText}>
              ← Select a session to view its heatmap
            </p>
          </div>
        )}

        {loading && <Spinner />}

        {error && <p style={styles.error}>{error}</p>}

        {heatmapData && !loading && (
          <>
            <div style={styles.meta}>
              <MetaPill label="Points" value={heatmapData.n_points} />
              <MetaPill
                label="Grid"
                value={`${heatmapData.grid_size}×${heatmapData.grid_size}`}
              />
              <MetaPill
                label="Screen"
                value={`${heatmapData.screen_w}×${heatmapData.screen_h}`}
              />
            </div>

            {/* Canvas fills the screen aspect ratio */}
            <div style={styles.canvasWrapper}>
              <canvas
                ref={canvasRef}
                style={{
                  width: "100%",
                  height: "100%",
                  borderRadius: 12,
                  border: "1px solid rgba(255,255,255,0.08)",
                  imageRendering: "pixelated",
                }}
              />
            </div>

            <Legend />
          </>
        )}
      </div>
    </div>
  );
}

function MetaPill({ label, value }) {
  return (
    <div style={styles.pill}>
      <span style={styles.pillLabel}>{label}</span>
      <span style={styles.pillVal}>{value}</span>
    </div>
  );
}

function Legend() {
  // Small gradient bar showing the colour scale
  const stops = COLORMAP.map((rgb, i) => {
    const pct = Math.round((i / (COLORMAP.length - 1)) * 100);
    return `rgb(${rgb.join(",")}) ${pct}%`;
  }).join(", ");

  return (
    <div style={styles.legend}>
      <span style={styles.legendLabel}>Low</span>
      <div
        style={{
          ...styles.legendBar,
          background: `linear-gradient(to right, ${stops})`,
        }}
      />
      <span style={styles.legendLabel}>High</span>
    </div>
  );
}

function Spinner() {
  return (
    <div style={{ display: "flex", justifyContent: "center", marginTop: 80 }}>
      <svg width={48} height={48}>
        <circle
          cx={24}
          cy={24}
          r={20}
          fill="none"
          stroke="var(--md-sys-color-warning)"
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
    </div>
  );
}

const styles = {
  root: {
    display: "flex",
    minHeight: 560,
    background: "var(--md-sys-color-surface)",
    fontFamily: "Roboto, system-ui, sans-serif",
    color: "var(--md-sys-color-on-surface)",
  },
  sidebar: {
    width: 220,
    borderRight: "1px solid var(--md-sys-color-outline-variant)",
    background: "var(--md-sys-color-surface-container-low)",
    borderRadius: 16,
    padding: "32px 16px",
    display: "flex",
    flexDirection: "column",
    gap: 8,
    flexShrink: 0,
  },
  sideTitle: {
    fontSize: 15,
    letterSpacing: "0.1em",
    color: "var(--md-sys-color-on-surface-variant)",
    margin: "0 0 16px",
  },
  empty: { fontSize: 14, color: "var(--md-sys-color-on-surface-variant)", margin: 0 },
  footnote: {
    fontSize: 12,
    color: "var(--md-sys-color-outline)",
    margin: "12px 0 0",
    lineHeight: 1.5,
    fontStyle: "italic",
  },
  sessionBtn: {
    minHeight: 52,
    background: "var(--md-sys-color-surface-container)",
    border: "1px solid",
    borderRadius: 12,
    padding: "10px 12px",
    cursor: "pointer",
    display: "flex",
    flexDirection: "column",
    gap: 4,
    textAlign: "left",
    transition: "border-color 0.2s, color 0.2s",
  },
  sessionDate: { fontSize: 12 },
  sessionDuration: { fontSize: 13, color: "var(--md-sys-color-on-surface-variant)" },
  main: {
    flex: 1,
    padding: "32px 40px",
    display: "flex",
    flexDirection: "column",
    gap: 20,
  },
  placeholder: {
    flex: 1,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  placeholderText: { color: "var(--md-sys-color-outline)", fontSize: 14 },
  meta: { display: "flex", gap: 12 },
  pill: {
    background: "var(--md-sys-color-secondary-container)",
    border: "none",
    borderRadius: 8,
    padding: "6px 12px",
    display: "flex",
    gap: 8,
    alignItems: "center",
  },
  pillLabel: {
    fontSize: 13,
    color: "var(--md-sys-color-on-surface-variant)",
    letterSpacing: "0.08em",
  },
  pillVal: { fontSize: 13 },
  canvasWrapper: {
    flex: 1,
    aspectRatio: "16/9",
    maxHeight: "60vh",
    background: "var(--md-sys-color-surface-container-lowest)",
    borderRadius: 12,
  },
  error: { color: "var(--md-sys-color-error)", fontSize: 13 },
  legend: { display: "flex", alignItems: "center", gap: 12 },
  legendBar: { flex: 1, height: 8, borderRadius: 4 },
  legendLabel: { fontSize: 13, color: "var(--md-sys-color-on-surface-variant)" },
};
