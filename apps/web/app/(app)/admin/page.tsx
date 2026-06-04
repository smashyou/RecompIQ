import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { secretsEnabled } from "@/lib/secrets";
import { AdminClient } from "./admin-client";

export const dynamic = "force-dynamic";

interface ModelJoinRow {
  id: string;
  model_id: string;
  display_name: string;
  modality: "chat" | "vision" | "embedding";
  context_window: number | null;
  input_cost_per_1m: number | null;
  output_cost_per_1m: number | null;
  notes: string | null;
  ai_providers: { slug: string; name: string; kind: string };
}

interface FeatureConfigRow {
  feature: string;
  primary_model_id: string;
  fallback_ids: string[];
}

export default async function AdminPage() {
  const user = await requireUser();
  const supabase = await createSupabaseServerClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!profile?.is_admin) redirect("/dashboard");

  const [providersRes, modelsRes, configRes] = await Promise.all([
    supabase.from("ai_providers").select("*").eq("active", true).order("name"),
    supabase
      .from("ai_models")
      .select(
        "id,model_id,display_name,modality,context_window,input_cost_per_1m,output_cost_per_1m,notes, ai_providers(slug,name,kind)",
      )
      .eq("active", true)
      .order("modality")
      .order("display_name"),
    supabase
      .from("ai_feature_config")
      .select("feature,primary_model_id,fallback_ids")
      .order("feature"),
  ]);

  // Admin-set keys (encrypted) — surface only presence + last4, never plaintext.
  const admin = createSupabaseAdminClient();
  const { data: secretRows } = await admin
    .from("ai_provider_secrets")
    .select("provider_id, last4");
  const secretByProvider = new Map(
    (secretRows ?? []).map((s) => [s.provider_id as string, (s.last4 as string | null) ?? null]),
  );

  // A provider is "configured" when an admin-set key OR its env var is present.
  const providers = (providersRes.data ?? []).map((p) => {
    const envSet = Boolean(
      p.env_key_var && process.env[p.env_key_var] && process.env[p.env_key_var]!.trim() !== "",
    );
    const hasDbKey = secretByProvider.has(p.id);
    return {
      ...p,
      configured: hasDbKey || envSet,
      key_managed: hasDbKey,
      key_last4: secretByProvider.get(p.id) ?? null,
      key_source: hasDbKey ? ("db" as const) : envSet ? ("env" as const) : null,
    };
  });

  return (
    <AdminClient
      providers={providers}
      models={(modelsRes.data ?? []) as unknown as ModelJoinRow[]}
      config={(configRes.data ?? []) as FeatureConfigRow[]}
      secretsEnabled={secretsEnabled()}
    />
  );
}
