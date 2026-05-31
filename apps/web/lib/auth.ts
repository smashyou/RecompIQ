import { UnauthorizedError } from "@peptide/shared";
import { createSupabaseServerClient, getBearerAuthHeader } from "@/lib/supabase/server";

export async function getServerUser() {
  const supabase = await createSupabaseServerClient();
  // Native clients pass a Bearer JWT; validate it explicitly. Web clients have
  // no such header and resolve the user from the cookie session.
  const authHeader = await getBearerAuthHeader();
  const token = authHeader?.slice("Bearer ".length);
  const {
    data: { user },
  } = token ? await supabase.auth.getUser(token) : await supabase.auth.getUser();
  return user;
}

export async function requireUser() {
  const user = await getServerUser();
  if (!user) throw new UnauthorizedError();
  return user;
}
