export default function GazeCursor({ x, y, dwellProgress, visible }) {
  if (!visible) return null;

  const r = 16;
  const circ = 2 * Math.PI * r;
  const dash = circ * (dwellProgress ?? 0);

  return (
    <div
      style={{
        position: "fixed",
        left: x,
        top: y,
        transform: "translate(-50%, -50%)",
        pointerEvents: "none",
        zIndex: 9999,
      }}
    >
      <svg width={48} height={48} style={{ overflow: "visible" }}>
        {/* outer ring */}
        <circle
          cx={24}
          cy={24}
          r={r}
          fill="none"
          stroke="rgba(99,255,180,0.2)"
          strokeWidth={2}
        />
        {/* dwell progress ring */}
        <circle
          cx={24}
          cy={24}
          r={r}
          fill="none"
          stroke="#63ffb4"
          strokeWidth={2}
          strokeDasharray={`${dash} ${circ}`}
          strokeLinecap="round"
          transform="rotate(-90 24 24)"
          style={{ transition: "stroke-dasharray 0.05s linear" }}
        />
        {/* center dot */}
        <circle cx={24} cy={24} r={3} fill="#63ffb4" />
      </svg>
    </div>
  );
}
