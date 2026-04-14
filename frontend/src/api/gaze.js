import api from "./client";

// start a new gaze tracking session
export const createSession = () => api.post("/gaze/session/start/");

// send a single gaze coordinate/frame
export const sendGazePoint = (payload) => api.post("/gaze/point/", payload);

// fetch latest session data
export const getLatestSession = () => api.get("/gaze/session/latest/");

// optionally end session
export const endSession = () => api.post("/gaze/session/end/");
