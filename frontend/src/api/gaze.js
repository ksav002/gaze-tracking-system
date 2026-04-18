import api from "./client";

export const getCalibrationStatus = () => api.get("/calibration/");

export const postCalibration = (samples) =>
  api.post("/calibration/", { samples });
