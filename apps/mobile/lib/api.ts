// Typed client for the deployed RecompIQ API (recompiq.vercel.app/api).
//
// HYBRID ARCHITECTURE: M1 reads/writes go straight to Supabase via supabase-js
// (RLS-enforced). This client is only for server-secret work — AI coach, vision
// food parsing, nutrition lookups — which lands in M2.
//
// NOTE for M2: the web route handlers currently authenticate via Supabase
// cookies (createSupabaseServerClient). To accept this Bearer token, those
// handlers need to also read `Authorization: Bearer <access_token>` — a small
// server-side change to lib/auth.ts on the web. Until then, treat this as
// scaffolding, not a working call path.
import { supabase } from "./supabase";

const BASE = process.env.EXPO_PUBLIC_API_URL ?? "https://recompiq.vercel.app";

interface ApiEnvelope<T> {
  data: T | null;
  error: { code: string; message: string } | null;
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const headers = new Headers(init?.headers);
  headers.set("Content-Type", "application/json");
  if (session?.access_token) {
    headers.set("Authorization", `Bearer ${session.access_token}`);
  }

  const res = await fetch(`${BASE}${path}`, { ...init, headers });
  const json = (await res.json()) as ApiEnvelope<T>;

  if (!res.ok || json.error) {
    throw new Error(json.error?.message ?? `Request failed (${res.status})`);
  }
  return json.data as T;
}

// Multipart upload (food/body photos → Vercel Blob via the server). Do NOT set
// Content-Type — fetch adds the multipart boundary itself.
export async function apiUpload<T>(path: string, form: FormData): Promise<T> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const headers = new Headers();
  if (session?.access_token) {
    headers.set("Authorization", `Bearer ${session.access_token}`);
  }
  const res = await fetch(`${BASE}${path}`, { method: "POST", headers, body: form });
  const json = (await res.json()) as ApiEnvelope<T>;
  if (!res.ok || json.error) {
    throw new Error(json.error?.message ?? `Upload failed (${res.status})`);
  }
  return json.data as T;
}
