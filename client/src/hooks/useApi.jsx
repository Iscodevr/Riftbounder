import { useAuth } from "./useAuth";

export function useApi() {
  const { token, logout } = useAuth();

  const request = async (path, options = {}) => {
    const base = import.meta.env.VITE_API_URL || "";
    const res = await fetch(`${base}/api${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
      },
    });

    if (res.status === 401) {
      logout();
      throw new Error("Session expirée");
    }

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Erreur serveur");
    return data;
  };

  return {
    get: (path, params) => {
      const url = params ? `${path}?${new URLSearchParams(params)}` : path;
      return request(url);
    },
    post: (path, body) => request(path, { method: "POST", body: JSON.stringify(body) }),
    put: (path, body) => request(path, { method: "PUT", body: JSON.stringify(body) }),
    del: (path) => request(path, { method: "DELETE" }),
  };
}
