import { Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import routes from "../../routes/routes";
import { NavLink } from "react-router-dom";

const Layout = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <div className="d-flex vh-100">
      {/* Sidebar */}
      <div
        className="bg-dark text-white p-3 d-flex flex-column"
        style={{ width: "250px" }}
      >
        <h5 className="mb-4">Gaze App</h5>

        <div className="mb-3">
          <small className="text-muted">Logged in as</small>
          <div className="fw-bold">{user?.username}</div>
        </div>

        <nav className="nav flex-column">
          {routes
            .filter((r) => r.nav)
            .map((r) => (
              <NavLink
                key={r.path}
                to={r.path || "/"}
                className={({ isActive }) =>
                  `nav-link ${isActive ? "active bg-primary text-white" : "text-white"}`
                }
              >
                {r.label}
              </NavLink>
            ))}
        </nav>

        <div className="mt-auto">
          <button className="btn btn-danger w-100" onClick={handleLogout}>
            Logout
          </button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-grow-1 d-flex flex-column">
        {/* Topbar */}
        <div className="border-bottom p-3 d-flex justify-content-between align-items-center">
          <h6 className="mb-0">Dashboard</h6>

          <div className="text-muted small">{user?.email}</div>
        </div>

        {/* Page content */}
        <div className="p-4 flex-grow-1 overflow-auto bg-light">
          <Outlet />
        </div>
      </div>
    </div>
  );
};

export default Layout;
