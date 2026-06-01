import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
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

  // Connection status: a provider is "configured" when its API-key env var is
  // present on the server. (e.g. Google Gemini only routes via the gateway, so
  // it shows as configured only if AI_GATEWAY_API_KEY is set on this deploy.)
  const providers = (providersRes.data ?? []).map((p) => ({
    ...p,
    configured: Boolean(
      p.env_key_var && process.env[p.env_key_var] && process.env[p.env_key_var]!.trim() !== "",
    ),
  }));

  return (
    <AdminClient
      providers={providers}
      models={(modelsRes.data ?? []) as unknown as ModelJoinRow[]}
      config={(configRes.data ?? []) as FeatureConfigRow[]}
    />
  );
}
