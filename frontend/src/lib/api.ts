const API_BASE = (import.meta as any).env?.VITE_API_BASE || (typeof window !== "undefined" && window.location.hostname !== "localhost" ? "" : "http://localhost:8000");

export const api = {
  get: async (path: string) => {
    const res = await fetch(`${API_BASE}${path}`);
    if (!res.ok) throw new Error(`API error: ${res.status}`);
    return res.json();
  },
  post: async (path: string, body?: any) => {
    const res = await fetch(`${API_BASE}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) throw new Error(`API error: ${res.status}`);
    return res.json();
  },
};
