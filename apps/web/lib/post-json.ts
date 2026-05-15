"use client";

interface PostResult<T = unknown> {
  ok: true;
  data: T;
}
interface PostError {
  ok: false;
  status: number;
  message: string;
  fieldErrors?: Record<string, string>;
}

interface RouterLike {
  replace: (href: string) => void;
  refresh: () => void;
}

// Client helper: POSTs JSON, surfaces typed errors, and auto-redirects to /signin
// on 401 so the user can recover instead of staring at a dead end.
export async function postJson<T = unknown>(
  url: string,
  body: unknown,
  router?: RouterLike,
): Promise<PostResult<T> | PostError> {
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      credentials: "same-origin",
    });
  } catch (err) {
    return {
      ok: false,
      status: 0,
      message: err instanceof Error ? err.message : "Network error",
    };
  }

  if (res.status === 401 && router) {
    const next = encodeURIComponent(window.location.pathname + window.location.search);
    router.replace(`/signin?next=${next}`);
    router.refresh();
    return { ok: false, status: 401, message: "Session expired. Redirecting…" };
  }

  let parsed: {
    data?: T;
    error?: { code?: string; message?: string; fieldErrors?: Record<string, string> };
  } = {};
  try {
    parsed = await res.json();
  } catch {
    // ignore — fall through to generic error
  }

  if (!res.ok) {
    return {
      ok: false,
      status: res.status,
      message: parsed.error?.message ?? `Request failed (${res.status})`,
      fieldErrors: parsed.error?.fieldErrors,
    };
  }
  return { ok: true, data: parsed.data as T };
}
