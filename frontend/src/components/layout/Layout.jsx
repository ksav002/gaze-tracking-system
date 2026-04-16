import { Outlet, useNavigate, useLocation, NavLink } from "react-router-dom";
import { useMemo } from "react";
import { useAuth } from "../../context/AuthContext";
import routes from "../../routes/routes";

const Layout = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  // normalize route path -> label
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
    <div className="d-flex vh-100">
      {/* ================= SIDEBAR ================= */}
      <aside
        className="bg-dark text-white p-3 d-flex flex-column"
        style={{ width: "250px" }}
      >
        {/* Brand */}
        <div className="mb-4">
          <h5 className="mb-0">Gaze App</h5>
        </div>

        {/* User info */}
        <div className="mb-3">
          <small className="text-muted">Logged in as</small>
          <div className="fw-bold">{user?.username}</div>
        </div>

        {/* Navigation */}
        <nav className="nav flex-column gap-1">
          {routes
            .filter((r) => r.nav)
            .map((r) => {
              const to = r.path === "" ? "/" : `/${r.path}`;

              return (
                <NavLink
                  key={to}
                  to={to}
                  className={({ isActive }) =>
                    [
                      "nav-link",
                      "text-white",
                      "rounded",
                      isActive ? "bg-primary text-white" : "",
                    ].join(" ")
                  }
                >
                  {r.label}
                </NavLink>
              );
            })}
        </nav>

        {/* Logout */}
        <div className="mt-auto">
          <button className="btn btn-danger w-100" onClick={handleLogout}>
            Logout
          </button>
        </div>
      </aside>

      {/* ================= MAIN ================= */}
      <div className="flex-grow-1 d-flex flex-column">
        {/* Topbar */}
        <header className="border-bottom p-3 d-flex align-items-center">
          <h6 className="mb-0">{pageTitle}</h6>

          <div className="ms-auto text-muted small">{user?.email}</div>
        </header>

        {/* Page content */}
        <main className="p-4 flex-grow-1 overflow-auto bg-light">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default Layout;
