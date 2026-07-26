import { useAuth } from "../context/AuthContext";

export default function Profile() {
  const { user, loading } = useAuth();

  if (loading) return <p style={s.muted}>Loading…</p>;
  if (!user)
    return (
      <p style={{ color: "var(--md-sys-color-error)", fontSize: 13 }}>Failed to load profile</p>
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
    background: "var(--md-sys-color-surface-container)",
    border: "none",
    borderRadius: 12,
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
    background: "var(--md-sys-color-primary-container)",
    border: "none",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 20,
    fontWeight: 500,
    color: "var(--md-sys-color-on-primary-container)",
  },
  username: {
    fontSize: 16,
    fontWeight: 600,
    color: "var(--md-sys-color-on-surface)",
    marginBottom: 4,
  },
  badge: {
    fontSize: 12,
    color: "var(--md-sys-color-on-primary-container)",
    background: "var(--md-sys-color-tertiary-container)",
    border: "none",
    borderRadius: 8,
    padding: "2px 8px",
    letterSpacing: "0.06em",
  },
  divider: {
    height: 1,
    background: "var(--md-sys-color-outline-variant)",
    margin: "4px 0 20px",
  },
  fields: { display: "flex", flexDirection: "column", gap: 10 },
  row: {
    display: "flex",
    flexDirection: "column",
    gap: 3,
    padding: "10px 12px",
    background: "var(--md-sys-color-surface-container-high)",
    borderRadius: 12,
  },
  rowLabel: {
    fontSize: 12,
    color: "var(--md-sys-color-on-surface-variant)",
    letterSpacing: "0.1em",
    textTransform: "uppercase",
  },
  rowVal: { fontSize: 15, color: "var(--md-sys-color-on-surface)" },
  muted: { color: "var(--md-sys-color-on-surface-variant)", fontSize: 13 },
};
