// Lab report OCR parser — turns an uploaded lab report (photo or extracted PDF
// text) into structured marker readings. Routes through the gateway with
// feature='vision' so model selection + fallback + usage logging match every
// other AI call. The model only READS the user's own report; it never invents
// values and never interprets them (no diagnosis, no advice) — out-of-range
// flagging happens in the UI against catalog/report ranges, not here.

import { chat } from "./gateway";
import type { GatewayDeps } from "./gateway";
import type { ChatRequest, ChatContentPart } from "./types/index";
import {
  LAB_MARKER_DEFS,
  labOcrParseResult,
  matchMarkerKey,
  type LabOcrParseResult,
} from "@peptide/shared";

function markerReference(): string {
  // Compact catalog reference so the model maps names → our stable keys.
  return LAB_MARKER_DEFS.map((m) => `${m.key} (${m.label}, ${m.unit})`).join("; ");
}

const SYSTEM_PROMPT = `You are a careful medical-records transcription assistant. You extract lab test results EXACTLY as printed on a user's own lab report. You do not diagnose, interpret, or give advice — you only transcribe what is written.

Map each result's name to one of these known marker keys when it clearly matches; otherwise set marker_key to null and keep the printed name in raw_name:
${markerReference()}

Return ONLY a JSON object that conforms to this schema. No prose, no markdown code fences:

{
  "collected_on": "YYYY-MM-DD or null (the specimen collection / draw date printed on the report)",
  "results": [
    {
      "marker_key": "one of the keys above, or null if no clear match",
      "raw_name": "string (the test name exactly as printed)",
      "value": number (the numeric result exactly as printed. If a cell shows ONLY a detection-limit sentinel like '<5' or '<0.01' with no measured number, record just the numeric portion; never apply this to a normal printed value),
      "unit": "string or null (units exactly as printed, e.g. mg/dL, %)",
      "ref_low": number or null (the report's printed reference-range low, if shown),
      "ref_high": number or null (the report's printed reference-range high, if shown),
      "flag": "low" | "high" | "normal" | null (only if the report explicitly flags it, e.g. H / L)
    }
  ]
}

Rules:
- Transcribe only numeric quantitative results. Skip qualitative/text results (e.g. "Negative", "Not detected") and section headers.
- Never invent or estimate a value, unit, or reference range. If a field isn't printed, use null.
- If the same marker appears twice, keep the one with a real numeric value.
- Maximum 80 results.`;

export interface ParseLabsOpts {
  images?: string[]; // Blob URLs of report page images
  text?: string; // extracted text from a PDF report
  userId?: string;
  modelOverride?: string;
}

export interface ParseLabsResult {
  result: LabOcrParseResult;
  modelUsed: string;
  providerUsed: string;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
}

export async function parseLabsFromContent(
  opts: ParseLabsOpts,
  deps: GatewayDeps,
): Promise<ParseLabsResult> {
  void opts.modelOverride; // carried for parity; routing uses feature config

  const parts: ChatContentPart[] = [
    {
      type: "text",
      text: "Transcribe every numeric lab result from this report into the JSON schema.",
    },
  ];

  for (const url of opts.images ?? []) {
    parts.push({ type: "image_url", image_url: { url } });
  }
  if (opts.text && opts.text.trim()) {
    // Cap the text we forward so a huge PDF can't blow the context window.
    parts.push({
      type: "text",
      text: `Lab report text:\n\n${opts.text.trim().slice(0, 24000)}`,
    });
  }

  if ((opts.images?.length ?? 0) === 0 && !(opts.text && opts.text.trim())) {
    throw new Error("No image or text content to parse");
  }

  const req: ChatRequest = {
    feature: "vision",
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: parts },
    ],
    max_tokens: 3000,
    temperature: 0.1,
    userId: opts.userId,
  };

  const response = await chat(req, deps);

  const cleaned = response.text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/, "")
    .trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    // Do NOT echo the raw model text — it may contain transcribed lab values
    // that must not reach logs/error envelopes (safety.local.md rule 5).
    throw new Error("Lab OCR model returned a non-JSON response");
  }

  const validated = labOcrParseResult.safeParse(parsed);
  if (!validated.success) {
    throw new Error(
      `Lab OCR response failed schema validation: ${validated.error.issues
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .slice(0, 3)
        .join("; ")}`,
    );
  }

  // Re-derive marker_key from raw_name server-side — don't trust the model's
  // mapping blindly. The model's key is honored only if it's a real catalog key.
  const result: LabOcrParseResult = {
    collected_on: validated.data.collected_on ?? null,
    results: validated.data.results.map((r) => ({
      ...r,
      marker_key: matchMarkerKey(r.raw_name) ?? r.marker_key ?? null,
    })),
  };

  return {
    result,
    modelUsed: response.model,
    providerUsed: response.provider_slug,
    inputTokens: response.input_tokens,
    outputTokens: response.output_tokens,
    latencyMs: response.latency_ms,
  };
}
