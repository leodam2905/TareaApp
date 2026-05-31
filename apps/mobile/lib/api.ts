import { getToken } from "./storage";

export const API_BASE = "http://localhost:3000";

async function request(path: string, options: RequestInit = {}) {
  const token = await getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`${API_BASE}/api${path}`, { ...options, headers });
  return res;
}

export const api = {
  get:    (path: string)                    => request(path),
  post:   (path: string, body: object)      => request(path, { method: "POST",  body: JSON.stringify(body) }),
  patch:  (path: string, body: object)      => request(path, { method: "PATCH", body: JSON.stringify(body) }),
  delete: (path: string)                    => request(path, { method: "DELETE" }),
  upload: async (path: string, form: FormData) => {
    const token = await getToken();
    const headers: Record<string, string> = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;
    return fetch(`${API_BASE}/api${path}`, { method: "POST", body: form, headers });
  },
};
