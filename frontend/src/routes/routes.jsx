import Dashboard from "../pages/Dashboard";
import Profile from "../pages/Profile";
import Calibration from "../pages/Calibration";
import HeatmapViewer from "../pages/HeatmapViewer";

const routes = [
  { path: "", element: <Dashboard />, nav: true, label: "Dashboard" },
  { path: "profile", element: <Profile />, nav: true, label: "Profile" },
  {
    path: "calibration",
    element: <Calibration />,
    nav: true,
    label: "Calibration",
  },
  {
    path: "heatmap-viewer",
    element: <HeatmapViewer />,
    nav: true,
    label: "Heatmap Viewer",
  },
];
export default routes;
