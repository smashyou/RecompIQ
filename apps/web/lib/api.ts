import { NextResponse } from "next/server";
import type { ZodSchema } from "zod";
import { AppError } from "@peptide/shared";

export function jsonOk<T>(data: T) {
  return NextResponse.json({ data, error: null });
}

export function jsonError(err: unknown) {
  if (err instanceof AppError) {
    return NextResponse.json(
      {
        data: null,
        error: { code: err.code, message: err.message, fieldErrors: err.fieldErrors },
      },
      { status: err.status },
    );
  }
  console.error("[api] unexpected error", err);
  return NextResponse.json(
    { data: null, error: { code: "INTERNAL", message: "Unexpected error" } },
    { status: 500 },
  );
}

export async function parseJson<T>(req: Request, schema: ZodSchema<T>): Promise<T> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      fieldErrors[issue.path.join(".") || "_"] = issue.message;
    }
    const { ValidationError } = await import("@peptide/shared");
    throw new ValidationError("Request body failed validation", fieldErrors);
  }
  return parsed.data;
}
