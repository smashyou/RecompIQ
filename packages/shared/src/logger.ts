const PII_FIELD_NAMES = new Set([
  "weight",
  "value_lb",
  "value_kg",
  "glucose_mgdl",
  "bp_systolic",
  "bp_diastolic",
  "dob",
  "email",
  "phone",
  "ssn",
  "dose_value",
  "lab_value",
]);

function redactValue(key: string, value: unknown): unknown {
  if (PII_FIELD_NAMES.has(key)) return "<redacted>";
  if (value && typeof value === "object") return redact(value as Record<string, unknown>);
  return value;
}

function redact(input: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(input)) out[k] = redactValue(k, v);
  return out;
}

export const redactedLogger = {
  info(message: string, ctx?: Record<string, unknown>): void {
    console.log(JSON.stringify({ level: "info", message, ...(ctx ? redact(ctx) : {}) }));
  },
  warn(message: string, ctx?: Record<string, unknown>): void {
    console.warn(JSON.stringify({ level: "warn", message, ...(ctx ? redact(ctx) : {}) }));
  },
  error(message: string, ctx?: Record<string, unknown>): void {
    console.error(JSON.stringify({ level: "error", message, ...(ctx ? redact(ctx) : {}) }));
  },
};
