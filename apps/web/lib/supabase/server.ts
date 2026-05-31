import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies, headers } from "next/headers";
import { serverEnv } from "@/lib/env";

type CookieToSet = { name: string; value: string; options: CookieOptions };

// Reads an `Authorization: Bearer <jwt>` header if present. Native clients (the
// Expo app) authenticate this way instead of with cookies. Returns the full
// header value ("Bearer …") or undefined.
export async function getBearerAuthHeader(): Promise<string | undefined> {
  try {
    const h = await headers();
    const value = h.get("authorization") ?? h.get("Authorization");
    return value?.startsWith("Bearer ") ? value : undefined;
  } catch {
    // headers() isn't available in every context — fall back to cookies.
    return undefined;
  }
}

export async function createSupabaseServerClient() {
  const cookieStore = await cookies();
  const authHeader = await getBearerAuthHeader();

  return createServerClient(
    serverEnv.NEXT_PUBLIC_SUPABASE_URL,
    serverEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      // When a Bearer token is present (mobile), forward it so RLS-scoped
      // queries run as that user. Web requests have no such header and keep
      // using the cookie session below.
      ...(authHeader ? { global: { headers: { Authorization: authHeader } } } : {}),
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Called from a Server Component — middleware refreshes the session, ignore.
          }
        },
      },
    },
  );
}
