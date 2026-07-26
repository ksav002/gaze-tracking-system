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
      stroke="var(--md-sys-color-primary)"
      strokeWidth="1.5"
    />
    <circle cx="16" cy="16" r="4" fill="var(--md-sys-color-primary)" opacity="0.9" />
    <circle cx="17.5" cy="14.5" r="1.2" fill="var(--md-sys-color-surface)" />
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
          <Link to="/register">
            Register
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="form-stack">
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
          <Link to="/login">
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="form-stack">
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
    <div className="auth-shell">
      <section className="auth-story" aria-label="About GazeTrack">
        <div className="brand">{EYE_SVG}<span>GazeTrack</span></div>
        <div>
          <p className="eyebrow">Private by design</p>
          <h1>Precision that feels effortless.</h1>
          <p>Calibrate, track, and understand visual attention through one focused workspace.</p>
        </div>
      </section>
      <main className="auth-panel">
        <div className="auth-card">
          <h2>{title}</h2>
          <p>{subtitle}</p>
          {children}
          <p className="auth-footer">{footer}</p>
        </div>
      </main>
    </div>
  );
}

function Field({ label, value, onChange, placeholder, type = "text" }) {
  return (
    <div className="field">
      <label>{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required
      />
    </div>
  );
}

function SubmitBtn({ loading, children }) {
  return (
    <button type="submit" disabled={loading} className="button button-primary">
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
        stroke="var(--md-sys-color-on-primary)"
        strokeWidth={2}
        strokeDasharray="24 12"
        strokeLinecap="round"
      />
    </svg>
  );
}
