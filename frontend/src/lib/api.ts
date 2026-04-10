import { getToken } from "./firebase";

const API_BASE = (import.meta as any).env?.VITE_API_BASE || (typeof window !== "undefined" && window.location.hostname !== "localhost" ? "" : "http://localhost:8000");

async function headers(): Promise<Record<string, string>> {
  const h: Record<string, string> = { "Content-Type": "application/json" };
  try {
    const token = await getToken();
    if (token) h["Authorization"] = `Bearer ${token}`;
  } catch {}
  return h;
}

export const api = {
  get: async (path: string) => {
    const res = await fetch(`${API_BASE}${path}`, { headers: await headers() });
    if (!res.ok) throw new Error(`API error: ${res.status}`);
    return res.json();
  },
  post: async (path: string, body?: any) => {
    const res = await fetch(`${API_BASE}${path}`, {
      method: "POST",
      headers: await headers(),
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) throw new Error(`API error: ${res.status}`);
    return res.json();
  },
};
