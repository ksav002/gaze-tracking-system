import { useAuth } from "../context/AuthContext";

export default function Profile() {
  const { user, loading } = useAuth();

  if (loading) return <p style={s.muted}>Loading…</p>;
  if (!user)
    return (
      <p style={{ color: "#ff6363", fontSize: 13 }}>Failed to load profile</p>
    );

  return (
    <div style={s.card}>
      {/* Avatar row */}
      <div style={s.avatarRow}>
        <div style={s.avatar}>{user.username?.charAt(0).toUpperCase()}</div>
        <div>
          <div style={s.username}>{user.username}</div>
          <span style={s.badge}>Active</span>
        </div>
      </div>

      <div style={s.divider} />

      {/* Fields */}
      <div style={s.fields}>
        <InfoRow label="Username" value={user.username} />
        <InfoRow label="Email" value={user.email || "Not provided"} />
        <InfoRow label="User ID" value={user.id} mono />
      </div>
    </div>
  );
}

function InfoRow({ label, value, mono }) {
  return (
    <div style={s.row}>
      <span style={s.rowLabel}>{label}</span>
      <span style={{ ...s.rowVal, fontFamily: mono ? "monospace" : "inherit" }}>
        {value}
      </span>
    </div>
  );
}

const s = {
  card: {
    background: "rgba(255,255,255,0.02)",
    border: "1px solid rgba(255,255,255,0.06)",
    borderRadius: 14,
    padding: "28px 32px",
    maxWidth: 460,
  },
  avatarRow: {
    display: "flex",
    alignItems: "center",
    gap: 16,
    marginBottom: 24,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: "50%",
    background: "rgba(99,255,180,0.08)",
    border: "1.5px solid rgba(99,255,180,0.25)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 20,
    fontWeight: 700,
    color: "#63ffb4",
  },
  username: {
    fontSize: 16,
    fontWeight: 600,
    color: "#f0f0f0",
    marginBottom: 4,
  },
  badge: {
    fontSize: 10,
    color: "#63ffb4",
    background: "rgba(99,255,180,0.08)",
    border: "1px solid rgba(99,255,180,0.2)",
    borderRadius: 4,
    padding: "2px 8px",
    letterSpacing: "0.06em",
  },
  divider: {
    height: 1,
    background: "rgba(255,255,255,0.05)",
    margin: "4px 0 20px",
  },
  fields: { display: "flex", flexDirection: "column", gap: 10 },
  row: {
    display: "flex",
    flexDirection: "column",
    gap: 3,
    padding: "10px 12px",
    background: "rgba(255,255,255,0.02)",
    borderRadius: 7,
  },
  rowLabel: {
    fontSize: 10,
    color: "rgba(255,255,255,0.22)",
    letterSpacing: "0.1em",
    textTransform: "uppercase",
  },
  rowVal: { fontSize: 13, color: "#f0f0f0" },
  muted: { color: "rgba(255,255,255,0.3)", fontSize: 13 },
};
