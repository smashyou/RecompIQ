import { NextResponse } from "next/server";
import { AppError } from "@peptide/shared";
import { requireUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET() {
  try {
    const user = await requireUser();
    const supabase = await createSupabaseServerClient();
    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    return NextResponse.json({
      data: { user: { id: user.id, email: user.email }, profile },
      error: null,
    });
  } catch (err) {
    if (err instanceof AppError) {
      return NextResponse.json(
        { data: null, error: { code: err.code, message: err.message } },
        { status: err.status },
      );
    }
    return NextResponse.json(
      { data: null, error: { code: "INTERNAL", message: "Unexpected error" } },
      { status: 500 },
    );
  }
}
