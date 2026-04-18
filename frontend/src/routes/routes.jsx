import Dashboard from "../pages/Dashboard";
import Profile from "../pages/Profile";
import Calibration from "../pages/Calibration";

const routes = [
  { path: "", element: <Dashboard />, nav: true, label: "Dashboard" },
  { path: "profile", element: <Profile />, nav: true, label: "Profile" },
  {
    path: "calibration",
    element: <Calibration />,
    nav: true,
    label: "Calibration",
  },
];
export default routes;
