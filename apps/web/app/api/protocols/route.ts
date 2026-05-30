import { protocolScheduleInput } from "@peptide/shared";
import { requireUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { jsonOk, jsonError, parseJson } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// User-built titration schedule (protocol_schedules + weeks).
// Doses are user/clinician-supplied — the app does not prescribe.
export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const data = await parseJson(req, protocolScheduleInput);
    const supabase = await createSupabaseServerClient();

    const { data: schedule, error: schedErr } = await supabase
      .from("protocol_schedules")
      .insert({
        user_id: user.id,
        stack_id: data.stack_id ?? null,
        name: data.name,
        phase: data.phase ?? null,
        start_on: data.start_on ? data.start_on.toISOString().slice(0, 10) : null,
        notes: data.notes ?? null,
        is_active: data.is_active,
      })
      .select("id")
      .single();
    if (schedErr) throw schedErr;

    const weeks = data.weeks.map((w) => ({
      schedule_id: schedule.id,
      user_id: user.id,
      compound_id: w.compound_id,
      week_number: w.week_number,
      dose_value: w.dose_value,
      dose_unit: w.dose_unit,
      route: w.route,
      frequency: w.frequency,
      notes: w.notes ?? null,
    }));
    const { error: weeksErr } = await supabase.from("protocol_schedule_weeks").insert(weeks);
    if (weeksErr) throw weeksErr;

    return jsonOk({ schedule_id: schedule.id });
  } catch (err) {
    return jsonError(err);
  }
}

export async function GET() {
  try {
    const user = await requireUser();
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("protocol_schedules")
      .select(
        "*, protocol_schedule_weeks(*, compounds(slug,name,evidence_level,fda_approved))",
      )
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return jsonOk(data ?? []);
  } catch (err) {
    return jsonError(err);
  }
}
