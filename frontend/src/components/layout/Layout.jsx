import { Outlet, useNavigate, useLocation, NavLink } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import routes from "../../routes/routes";

const EyeIcon = () => (
  <svg width="20" height="20" viewBox="0 0 32 32" fill="none">
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

const Layout = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const currentRoute = routes.find((r) => (r.path ? `/${r.path}` : "/") === location.pathname);
  const pageTitle = currentRoute?.label || "App";
  const pageDescription = currentRoute?.description || "Manage your gaze tracking workspace";

  return (
    <div className="app-shell">
      {/* ── Sidebar ── */}
      <aside className="app-sidebar">
        {/* Brand */}
        <div className="brand">
          <EyeIcon />
          <span>GazeTrack</span>
        </div>

        {/* User */}
        <div className="user-card">
          <div className="avatar">{user?.username?.charAt(0).toUpperCase()}</div>
          <div>
            <div className="user-name">{user?.username}</div>
            <div className="user-email">{user?.email || "No email provided"}</div>
          </div>
        </div>

        {/* Nav */}
        <nav className="app-nav" aria-label="Main navigation">
          {routes
            .filter((r) => r.nav)
            .map((r) => {
              const to = r.path === "" ? "/" : `/${r.path}`;
              return (
                <NavLink
                  key={to}
                  to={to}
                  end={to === "/"}
                  className={({ isActive }) => "nav-link" + (isActive ? " active" : "")}
                >
                  {r.label}
                </NavLink>
              );
            })}
        </nav>

        {/* Logout */}
        <button className="button button-ghost sign-out" onClick={handleLogout}>
          Sign out
        </button>
      </aside>

      {/* ── Main ── */}
      <div className="main-column">
        {/* Topbar */}
        <header className="topbar">
          <div><p className="eyebrow">Workspace</p><h1>{pageTitle}</h1><p>{pageDescription}</p></div>
          <div className="privacy-chip"><span /> Camera data stays local</div>
        </header>

        {/* Page content — Outlet renders here */}
        <main className="page-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default Layout;
