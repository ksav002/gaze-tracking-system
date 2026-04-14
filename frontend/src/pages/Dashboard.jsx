import { useEffect, useState } from "react";
import { getLatestSession } from "../api/gaze";
import { useAuth } from "../context/AuthContext";

const Dashboard = () => {
  const { user } = useAuth();

  const [latestSession, setLatestSession] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchSession = async () => {
    try {
      const res = await getLatestSession();
      setLatestSession(res.data);
    } catch (err) {
      console.error("Failed to fetch session", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSession();
  }, []);

  return (
    <div className="container-fluid">
      {/* Header */}
      <div className="mb-4">
        <h3 className="fw-bold">Dashboard</h3>
        <p className="text-muted mb-0">Welcome back, {user?.username}</p>
      </div>

      {/* Stats cards */}
      <div className="row g-3 mb-4">
        <div className="col-12 col-md-4">
          <div className="card shadow-sm border-0">
            <div className="card-body">
              <h6 className="text-muted">Active Sessions</h6>
              <h3 className="mb-0">1</h3>
            </div>
          </div>
        </div>

        <div className="col-12 col-md-4">
          <div className="card shadow-sm border-0">
            <div className="card-body">
              <h6 className="text-muted">Last Session ID</h6>
              <h3 className="mb-0">
                {loading ? "..." : latestSession?.id || "None"}
              </h3>
            </div>
          </div>
        </div>

        <div className="col-12 col-md-4">
          <div className="card shadow-sm border-0">
            <div className="card-body">
              <h6 className="text-muted">Status</h6>
              <h3 className="mb-0 text-success">
                {loading ? "Loading..." : "Active"}
              </h3>
            </div>
          </div>
        </div>
      </div>

      {/* Session details */}
      <div className="card shadow-sm border-0">
        <div className="card-body">
          <h5 className="mb-3">Latest Gaze Session</h5>

          {loading ? (
            <div className="text-muted">Loading session data...</div>
          ) : latestSession ? (
            <div>
              <p className="mb-1">
                <strong>Session ID:</strong> {latestSession.id}
              </p>
              <p className="mb-1">
                <strong>Started:</strong> {latestSession.start_time}
              </p>
              <p className="mb-1">
                <strong>Status:</strong>{" "}
                <span className="badge bg-success">
                  {latestSession.status || "active"}
                </span>
              </p>
            </div>
          ) : (
            <div className="text-muted">No session found</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
