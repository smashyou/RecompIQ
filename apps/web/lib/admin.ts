import "server-only";
import { AppError } from "@peptide/shared";
import { requireUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// Throws FORBIDDEN unless the current user has is_admin = true on their profile.
export async function requireAdmin() {
  const user = await requireUser();
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!data?.is_admin) {
    throw new AppError("FORBIDDEN", "Admin only");
  }
  return user;
}
