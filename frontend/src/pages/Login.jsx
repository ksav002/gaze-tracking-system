import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useNavigate, Link } from "react-router-dom";
import { toast } from "react-toastify";
import api from "../api/client";

const EYE_SVG = (
  <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
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

export function Login() {
  const { login } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(username, password);
      toast.success("Authenticated");
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title="Sign in"
      subtitle="to your gaze session"
      footer={
        <>
          No account?{" "}
          <Link to="/register" style={linkStyle}>
            Register
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} style={formStyle}>
        <Field
          label="Username"
          value={username}
          onChange={setUsername}
          placeholder="username"
        />
        <Field
          label="Password"
          value={password}
          onChange={setPassword}
          placeholder="••••••••"
          type="password"
        />
        <SubmitBtn loading={loading}>Sign in</SubmitBtn>
      </form>
    </AuthShell>
  );
}

export function Register() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    username: "",
    email: "",
    password: "",
    confirm: "",
  });
  const [loading, setLoading] = useState(false);

  const set = (k) => (val) => setForm((f) => ({ ...f, [k]: val }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.password !== form.confirm) {
      toast.error("Passwords don't match");
      return;
    }
    setLoading(true);
    try {
      await api.post("/auth/register/", {
        username: form.username,
        email: form.email,
        password: form.password,
      });
      toast.success("Account created — sign in");
      navigate("/login");
    } catch (err) {
      const data = err?.response?.data;
      toast.error(
        data ? Object.values(data).flat().join(" ") : "Registration failed",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title="Create account"
      subtitle="start tracking your gaze"
      footer={
        <>
          Have an account?{" "}
          <Link to="/login" style={linkStyle}>
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} style={formStyle}>
        <Field
          label="Username"
          value={form.username}
          onChange={set("username")}
          placeholder="username"
        />
        <Field
          label="Email"
          value={form.email}
          onChange={set("email")}
          placeholder="you@example.com"
          type="email"
        />
        <Field
          label="Password"
          value={form.password}
          onChange={set("password")}
          placeholder="••••••••"
          type="password"
        />
        <Field
          label="Confirm password"
          value={form.confirm}
          onChange={set("confirm")}
          placeholder="••••••••"
          type="password"
        />
        <SubmitBtn loading={loading}>Create account</SubmitBtn>
      </form>
    </AuthShell>
  );
}

// ── Shared components ────────────────────────────────────────────────────────

function AuthShell({ title, subtitle, footer, children }) {
  return (
    <div style={shellStyle}>
      {/* Background grid */}
      <svg style={gridStyle} width="100%" height="100%">
        <defs>
          <pattern id="g" width="48" height="48" patternUnits="userSpaceOnUse">
            <path
              d="M 48 0 L 0 0 0 48"
              fill="none"
              stroke="rgba(99,255,180,0.04)"
              strokeWidth="1"
            />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#g)" />
      </svg>

      {/* Ambient glow */}
      <div style={glowStyle} />

      <div style={cardStyle}>
        {/* Logo */}
        <div style={logoRowStyle}>
          {EYE_SVG}
          <span style={logoTextStyle}>GazeTrack</span>
        </div>

        <div style={{ marginBottom: 28 }}>
          <h1 style={titleStyle}>{title}</h1>
          <p style={subtitleStyle}>{subtitle}</p>
        </div>

        {children}

        <p style={footerStyle}>{footer}</p>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, placeholder, type = "text" }) {
  const [focused, setFocused] = useState(false);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <label style={labelStyle}>{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          ...inputStyle,
          borderColor: focused
            ? "rgba(99,255,180,0.5)"
            : "rgba(255,255,255,0.08)",
          boxShadow: focused ? "0 0 0 3px rgba(99,255,180,0.08)" : "none",
        }}
      />
    </div>
  );
}

function SubmitBtn({ loading, children }) {
  return (
    <button type="submit" disabled={loading} style={btnStyle}>
      {loading ? (
        <span
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
          }}
        >
          <Spinner /> Processing…
        </span>
      ) : (
        children
      )}
    </button>
  );
}

function Spinner() {
  return (
    <svg
      width={16}
      height={16}
      style={{ animation: "spin 0.8s linear infinite" }}
    >
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      <circle
        cx={8}
        cy={8}
        r={6}
        fill="none"
        stroke="#0a0c10"
        strokeWidth={2}
        strokeDasharray="24 12"
        strokeLinecap="round"
      />
    </svg>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────

const shellStyle = {
  position: "fixed",
  inset: 0,
  background: "#070910",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontFamily: "'DM Mono','Fira Mono',monospace",
  overflow: "hidden",
};
const gridStyle = { position: "absolute", inset: 0, pointerEvents: "none" };
const glowStyle = {
  position: "absolute",
  width: 600,
  height: 600,
  borderRadius: "50%",
  background:
    "radial-gradient(circle, rgba(99,255,180,0.04) 0%, transparent 70%)",
  top: "50%",
  left: "50%",
  transform: "translate(-50%,-50%)",
  pointerEvents: "none",
};
const cardStyle = {
  position: "relative",
  zIndex: 1,
  width: 380,
  background: "rgba(255,255,255,0.025)",
  border: "1px solid rgba(255,255,255,0.07)",
  borderRadius: 20,
  padding: "40px 36px",
  backdropFilter: "blur(20px)",
};
const logoRowStyle = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  marginBottom: 32,
};
const logoTextStyle = {
  fontSize: 15,
  fontWeight: 700,
  color: "#63ffb4",
  letterSpacing: "0.06em",
};
const titleStyle = {
  fontSize: 22,
  fontWeight: 600,
  color: "#f0f0f0",
  margin: 0,
  letterSpacing: "-0.02em",
};
const subtitleStyle = {
  fontSize: 12,
  color: "rgba(255,255,255,0.3)",
  margin: "6px 0 0",
  letterSpacing: "0.03em",
};
const formStyle = { display: "flex", flexDirection: "column", gap: 16 };
const labelStyle = {
  fontSize: 11,
  color: "rgba(255,255,255,0.4)",
  letterSpacing: "0.08em",
  textTransform: "uppercase",
};
const inputStyle = {
  background: "rgba(255,255,255,0.04)",
  border: "1px solid",
  borderRadius: 8,
  padding: "10px 14px",
  fontSize: 13,
  color: "#f0f0f0",
  fontFamily: "inherit",
  outline: "none",
  transition: "border-color 0.2s, box-shadow 0.2s",
};
const btnStyle = {
  marginTop: 8,
  padding: "12px",
  background: "#63ffb4",
  border: "none",
  borderRadius: 8,
  fontSize: 13,
  fontWeight: 700,
  color: "#070910",
  cursor: "pointer",
  letterSpacing: "0.05em",
  transition: "opacity 0.2s",
};
const footerStyle = {
  marginTop: 24,
  textAlign: "center",
  fontSize: 12,
  color: "rgba(255,255,255,0.25)",
};
const linkStyle = { color: "#63ffb4", textDecoration: "none" };
