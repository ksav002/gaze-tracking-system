import api from "./client";

export const loginRequest = (username, password) =>
  api.post("/auth/login/", { username, password });

export const registerRequest = (data) => api.post("/auth/register/", data);

export const getMe = () => api.get("/auth/me/");

export const logout = () => {
  localStorage.removeItem("access");
  localStorage.removeItem("refresh");
};
