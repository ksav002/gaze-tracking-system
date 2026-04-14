import { useAuth } from "../context/AuthContext";

const Profile = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="container-fluid">
        <div className="text-muted">Loading profile...</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="container-fluid">
        <div className="text-danger">Failed to load user profile</div>
      </div>
    );
  }

  return (
    <div className="container-fluid">
      {/* Header */}
      <div className="mb-4">
        <h3 className="fw-bold">Profile</h3>
        <p className="text-muted mb-0">Manage your account information</p>
      </div>

      {/* Profile card */}
      <div className="row justify-content-center">
        <div className="col-12 col-md-6">
          <div className="card shadow-sm border-0">
            <div className="card-body p-4">
              {/* Avatar */}
              <div className="text-center mb-4">
                <div
                  className="rounded-circle bg-secondary text-white d-flex align-items-center justify-content-center mx-auto"
                  style={{
                    width: "80px",
                    height: "80px",
                    fontSize: "28px",
                  }}
                >
                  {user.username?.charAt(0).toUpperCase()}
                </div>
              </div>

              {/* User info */}
              <div className="mb-3">
                <label className="form-label text-muted">Username</label>
                <div className="form-control bg-light">{user.username}</div>
              </div>

              <div className="mb-3">
                <label className="form-label text-muted">Email</label>
                <div className="form-control bg-light">
                  {user.email || "Not provided"}
                </div>
              </div>

              <div className="mb-3">
                <label className="form-label text-muted">User ID</label>
                <div className="form-control bg-light">{user.id}</div>
              </div>

              <div className="text-center mt-3">
                <span className="badge bg-success">Active</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile;
