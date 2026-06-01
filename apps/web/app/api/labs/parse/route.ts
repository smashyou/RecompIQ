// Phase 6: labs/biomarkers — parse step.
// Image → vision OCR. PDF → text extraction (unpdf) → text OCR. Either way the
// gateway feature='vision' model transcribes the user's OWN report into
// structured marker readings. Every reading is enriched with a catalog match +
// the effective reference range, then returned for the user to review/confirm.
// Nothing is auto-saved and nothing is interpreted — out-of-range is flagged,
// never diagnosed.

import {
  AppError,
  labParseInput,
  matchMarkerKey,
  effectiveRange,
  rangeStatus,
  LAB_MARKER_BY_KEY,
  type LabOcrMarker,
} from "@peptide/shared";
import { requireUser } from "@/lib/auth";
import { jsonOk, jsonError, parseJson } from "@/lib/api";
import { parseLabsFromContent } from "@/lib/agent";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function extractPdfText(blobUrl: string): Promise<string> {
  const res = await fetch(blobUrl);
  if (!res.ok) throw new AppError("UPSTREAM_FAILED", "Could not download the PDF");
  const buf = new Uint8Array(await res.arrayBuffer());
  const { extractText, getDocumentProxy } = await import("unpdf");
  const pdf = await getDocumentProxy(buf);
  const { text } = await extractText(pdf, { mergePages: true });
  return Array.isArray(text) ? text.join("\n") : text;
}

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const { blob_url, kind, model } = await parseJson(req, labParseInput);

    let parse;
    try {
      if (kind === "pdf") {
        const text = await extractPdfText(blob_url);
        // A scanned (image-only) PDF yields almost no text — tell the user to
        // upload a photo instead rather than feeding the model an empty string.
        if (text.replace(/\s/g, "").length < 40) {
          throw new AppError(
            "VALIDATION_FAILED",
            "This looks like a scanned PDF with no embedded text. Please upload a clear photo of each lab page instead.",
          );
        }
        parse = await parseLabsFromContent({ text, userId: user.id, modelOverride: model });
      } else {
        parse = await parseLabsFromContent({ images: [blob_url], userId: user.id, modelOverride: model });
      }
    } catch (err) {
      if (err instanceof AppError) throw err;
      const message = err instanceof Error ? err.message : String(err);
      throw new AppError("UPSTREAM_FAILED", `Lab parse failed: ${message.slice(0, 200)}`);
    }

    // Enrich each marker with catalog metadata + the effective range + status,
    // so the review UI can render in/out-of-range without re-deriving anything.
    const enriched = parse.result.results.map((m: LabOcrMarker) => {
      const key = m.marker_key ?? matchMarkerKey(m.raw_name);
      const def = key ? LAB_MARKER_BY_KEY[key] : undefined;
      const range = effectiveRange(key, m.ref_low, m.ref_high);
      return {
        marker_key: key ?? null,
        marker: def?.label ?? m.raw_name,
        raw_name: m.raw_name,
        panel: def?.panel ?? null,
        value: m.value,
        unit: m.unit ?? def?.unit ?? null,
        ref_low: range.low,
        ref_high: range.high,
        ref_source: range.source,
        status: rangeStatus(m.value, range.low, range.high),
      };
    });

    return jsonOk({
      collected_on: parse.result.collected_on ?? null,
      results: enriched,
      ocr_raw: parse.result,
      model_used: parse.modelUsed,
      provider_used: parse.providerUsed,
    });
  } catch (err) {
    return jsonError(err);
  }
}
