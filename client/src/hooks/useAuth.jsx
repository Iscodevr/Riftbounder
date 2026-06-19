import { useState, useEffect, createContext, useContext } from "react";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem("rb_token"));
  const [user, setUser] = useState(() => {
    const stored = localStorage.getItem("rb_user");
    const tok = localStorage.getItem("rb_token");
    return stored && tok ? JSON.parse(stored) : null;
  });

  const login = (data) => {
    localStorage.setItem("rb_token", data.token);
    localStorage.setItem("rb_user", JSON.stringify(data.user));
    setToken(data.token);
    setUser(data.user);
  };

  const logout = () => {
    localStorage.removeItem("rb_token");
    localStorage.removeItem("rb_user");
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
