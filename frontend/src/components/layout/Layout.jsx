import { Outlet, useNavigate, useLocation, NavLink } from "react-router-dom";
import { useMemo } from "react";
import { useAuth } from "../../context/AuthContext";
import routes from "../../routes/routes";

const EyeIcon = () => (
  <svg width="20" height="20" viewBox="0 0 32 32" fill="none">
    <ellipse
      cx="16"
      cy="16"
      rx="13"
      ry="8"
      stroke="#63ffb4"
      strokeWidth="1.5"
    />
    <circle cx="16" cy="16" r="4" fill="#63ffb4" opacity="0.9" />
    <circle cx="17.5" cy="14.5" r="1.2" fill="#070910" />
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

  const routeMap = useMemo(() => {
    const map = new Map();
    routes.forEach((r) => {
      const path = r.path === "" ? "/" : `/${r.path}`;
      map.set(path, r);
    });
    return map;
  }, []);

  const currentRoute = routeMap.get(location.pathname);
  const pageTitle = currentRoute?.label || "App";

  return (
    <div style={s.root}>
      {/* ── Sidebar ── */}
      <aside style={s.sidebar}>
        {/* Brand */}
        <div style={s.brand}>
          <EyeIcon />
          <span style={s.brandText}>GazeTrack</span>
        </div>

        {/* User */}
        <div style={s.userBlock}>
          <div style={s.avatar}>{user?.username?.charAt(0).toUpperCase()}</div>
          <div>
            <div style={s.userName}>{user?.username}</div>
            <div style={s.userEmail}>{user?.email || "—"}</div>
          </div>
        </div>

        {/* Nav */}
        <nav style={s.nav}>
          {routes
            .filter((r) => r.nav)
            .map((r) => {
              const to = r.path === "" ? "/" : `/${r.path}`;
              return (
                <NavLink
                  key={to}
                  to={to}
                  end={to === "/"}
                  style={({ isActive }) => ({
                    ...s.navLink,
                    color: isActive ? "#63ffb4" : "rgba(255,255,255,0.38)",
                    background: isActive
                      ? "rgba(99,255,180,0.07)"
                      : "transparent",
                    borderColor: isActive
                      ? "rgba(99,255,180,0.2)"
                      : "transparent",
                  })}
                >
                  {r.label}
                </NavLink>
              );
            })}
        </nav>

        {/* Logout */}
        <button style={s.logoutBtn} onClick={handleLogout}>
          Sign out
        </button>
      </aside>

      {/* ── Main ── */}
      <div style={s.mainCol}>
        {/* Topbar */}
        <header style={s.topbar}>
          <h2 style={s.pageTitle}>{pageTitle}</h2>
        </header>

        {/* Page content — Outlet renders here */}
        <main style={s.content}>
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default Layout;

const s = {
  root: {
    display: "flex",
    minHeight: "100vh",
    background: "#070910",
    fontFamily: "'DM Mono','Fira Mono',monospace",
    color: "#f0f0f0",
  },
  sidebar: {
    width: 220,
    flexShrink: 0,
    borderRight: "1px solid rgba(255,255,255,0.05)",
    padding: "24px 16px",
    display: "flex",
    flexDirection: "column",
    gap: 0,
    position: "sticky",
    top: 0,
    height: "100vh",
    overflowY: "auto",
  },
  brand: {
    display: "flex",
    alignItems: "center",
    gap: 9,
    marginBottom: 32,
    paddingLeft: 4,
  },
  brandText: {
    fontSize: 13,
    fontWeight: 700,
    color: "#63ffb4",
    letterSpacing: "0.06em",
  },
  userBlock: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "10px 12px",
    background: "rgba(255,255,255,0.025)",
    border: "1px solid rgba(255,255,255,0.05)",
    borderRadius: 10,
    marginBottom: 24,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: "50%",
    background: "rgba(99,255,180,0.1)",
    border: "1px solid rgba(99,255,180,0.25)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 13,
    fontWeight: 700,
    color: "#63ffb4",
    flexShrink: 0,
  },
  userName: {
    fontSize: 12,
    color: "#f0f0f0",
    fontWeight: 600,
  },
  userEmail: {
    fontSize: 10,
    color: "rgba(255,255,255,0.25)",
    marginTop: 1,
  },
  nav: {
    display: "flex",
    flexDirection: "column",
    gap: 2,
    flex: 1,
  },
  navLink: {
    display: "block",
    padding: "9px 12px",
    fontSize: 12,
    textDecoration: "none",
    borderRadius: 7,
    letterSpacing: "0.04em",
    border: "1px solid",
    transition: "color 0.15s, background 0.15s",
  },
  logoutBtn: {
    marginTop: 16,
    background: "transparent",
    border: "1px solid rgba(255,255,255,0.07)",
    borderRadius: 7,
    padding: "8px 12px",
    fontSize: 11,
    color: "rgba(255,255,255,0.25)",
    cursor: "pointer",
    letterSpacing: "0.04em",
    textAlign: "left",
    transition: "border-color 0.15s, color 0.15s",
  },
  mainCol: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    minWidth: 0,
  },
  topbar: {
    borderBottom: "1px solid rgba(255,255,255,0.05)",
    padding: "18px 40px",
    background: "rgba(7,9,16,0.8)",
    backdropFilter: "blur(12px)",
    position: "sticky",
    top: 0,
    zIndex: 10,
  },
  pageTitle: {
    fontSize: 15,
    fontWeight: 600,
    margin: 0,
    letterSpacing: "-0.01em",
    color: "#f0f0f0",
  },
  content: {
    flex: 1,
    padding: "36px 40px",
    overflowY: "auto",
  },
};
