import axios from "axios";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

const api = axios.create({
  baseURL: API_BASE_URL,
});

const refreshAccessToken = async () => {
  try {
    const refresh = localStorage.getItem("refresh");
    if (!refresh) return null;

    const res = await axios.post(`${API_BASE_URL}/auth/refresh/`, {
      refresh,
    });

    const newAccess = res.data.access;

    localStorage.setItem("access", newAccess);

    return newAccess;
  } catch (err) {
    console.error(err);
    return null;
  }
};

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("access");

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error) => Promise.reject(error),
);

api.interceptors.response.use(
  (response) => response,

  async (error) => {
    const originalRequest = error.config;

    if (!error.response) {
      return Promise.reject(error);
    }

    if (error.response.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      const newAccess = await refreshAccessToken();

      if (newAccess) {
        originalRequest.headers.Authorization = `Bearer ${newAccess}`;
        return api(originalRequest);
      }
    }

    localStorage.removeItem("access");
    localStorage.removeItem("refresh");
    // window.location.href = "/login";

    return Promise.reject(error);
  },
);

export default api;
