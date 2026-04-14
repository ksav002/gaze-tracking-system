import { createContext, useContext, useEffect, useState } from "react";
import { loginRequest, getMe, logout as logoutApi } from "../api/auth";

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  // login flow
  const login = async (username, password) => {
    try {
      const res = await loginRequest(username, password);

      const { access, refresh } = res.data;

      localStorage.setItem("access", access);
      localStorage.setItem("refresh", refresh);

      const me = await getMe();

      setUser(me.data);
      setIsAuthenticated(true);

      return me.data;
    } catch (err) {
      logout();
      throw err;
    }
  };

  // logout flow
  const logout = () => {
    logoutApi();
    setUser(null);
    setIsAuthenticated(false);
  };

  // restore session on reload
  const loadUser = async () => {
    try {
      const access = localStorage.getItem("access");

      if (!access) {
        setLoading(false);
        return;
      }

      const res = await getMe();

      setUser(res.data);
      setIsAuthenticated(true);
    } catch (err) {
      logout();
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUser();
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated,
        loading,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
