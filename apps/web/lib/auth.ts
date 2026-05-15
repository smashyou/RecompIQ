import { UnauthorizedError } from "@peptide/shared";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function getServerUser() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

export async function requireUser() {
  const user = await getServerUser();
  if (!user) throw new UnauthorizedError();
  return user;
}
