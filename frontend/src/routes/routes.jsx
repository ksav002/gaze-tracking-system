import Dashboard from "../pages/Dashboard";
import Profile from "../pages/Profile";
import Calibration from "../pages/Calibration";
import HeatmapViewer from "../pages/HeatmapViewer";

const routes = [
  { path: "", element: <Dashboard />, nav: true, label: "Dashboard", description: "Start tracking and monitor your live gaze signal" },
  { path: "profile", element: <Profile />, nav: true, label: "Profile", description: "Review your account information" },
  {
    path: "calibration",
    element: <Calibration />,
    nav: true,
    label: "Calibration",
    description: "Tune gaze accuracy for your current setup",
  },
  {
    path: "heatmap-viewer",
    element: <HeatmapViewer />,
    nav: true,
    label: "Heatmap Viewer",
    description: "Explore attention patterns from recorded sessions",
  },
];
export default routes;
