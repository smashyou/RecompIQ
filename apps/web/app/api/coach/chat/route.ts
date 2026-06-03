import { z } from "zod";
import { wrapDoseLike } from "@peptide/peptides";
import { requireUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { jsonOk, jsonError, parseJson } from "@/lib/api";
import { chat, chatStream } from "@/lib/agent";
import {
  retrieveKb,
  userActiveCompoundSlugs,
  detectCompoundsInText,
  type KbHit,
} from "@/lib/rag";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const chatInput = z.object({
  conversation_id: z.string().uuid().nullable().optional(),
  message: z.string().trim().min(1).max(4000),
  // When true, respond as an SSE token stream (web). Omitted = JSON (mobile).
  stream: z.boolean().optional(),
});

const COACH_SYSTEM = `You are RecompIQ Coach — an educational research assistant for body recomposition, peptides, nutrition, training, and biomarkers.

Posture
- You are NOT a doctor. You provide educational summaries and research framing.
- When discussing peptide compounds, you may describe dose ranges that appear in the published literature or that practitioners report — but ALWAYS frame them as educational / research summaries, never as prescriptions or instructions to the user.
- The user is responsible for discussing any protocol with a licensed clinician before initiating, changing, or stopping it.
- Refuse to give individualized dosing recommendations ("you should take X mg"). Re-frame to "the literature describes ranges of Y to Z mg/week, often titrated up from W" and recommend a clinician conversation.
- For non-peptide topics (nutrition, training, sleep, vitals), you may speak more directly — these are not regulated like prescription medications.

Style
- Be terse and substantive. Lead with the answer, then explain.
- Use the provided user profile + recent logs to personalize. Don't ask for information already in the profile.
- Cite specific entries from the provided <context> block when you draw on them. Use bracketed citation numbers like [1], [2] matching the order they appear.
- If the user asks something you don't have evidence for, say so directly.`;

interface UserContextPack {
  display_name: string | null;
  sex: string | null;
  height_in: number | null;
  start_weight_lb: number | null;
  goal_weight_lb_min: number | null;
  goal_weight_lb_max: number | null;
  timeline_weeks: number | null;
  current_weight_lb: number | null;
  conditions: string[];
  medications: string[];
  injuries: string[];
  active_compounds: string[];
}

async function loadUserContext(userId: string): Promise<UserContextPack> {
  const supabase = await createSupabaseServerClient();
  const [profile, goal, conditions, meds, injuries, latestWeight, compoundSlugs] = await Promise.all([
    supabase.from("profiles").select("display_name,sex,height_in").eq("user_id", userId).maybeSingle(),
    supabase
      .from("goals")
      .select("start_weight_lb,goal_weight_lb_min,goal_weight_lb_max,timeline_weeks")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase.from("conditions").select("name").eq("user_id", userId).eq("active", true),
    supabase.from("medications").select("name,dose").eq("user_id", userId).eq("active", true),
    supabase.from("injuries").select("name").eq("user_id", userId).eq("active", true),
    supabase
      .from("weights")
      .select("value_lb")
      .eq("user_id", userId)
      .order("logged_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    userActiveCompoundSlugs(userId),
  ]);
  return {
    display_name: profile.data?.display_name ?? null,
    sex: profile.data?.sex ?? null,
    height_in: profile.data?.height_in ?? null,
    start_weight_lb: goal.data?.start_weight_lb ?? null,
    goal_weight_lb_min: goal.data?.goal_weight_lb_min ?? null,
    goal_weight_lb_max: goal.data?.goal_weight_lb_max ?? null,
    timeline_weeks: goal.data?.timeline_weeks ?? null,
    current_weight_lb: latestWeight.data?.value_lb ?? null,
    conditions: (conditions.data ?? []).map((c) => c.name as string),
    medications: (meds.data ?? []).map((m) =>
      m.dose ? `${m.name} (${m.dose})` : (m.name as string),
    ),
    injuries: (injuries.data ?? []).map((i) => i.name as string),
    active_compounds: compoundSlugs,
  };
}

function formatUserContext(ctx: UserContextPack): string {
  const lines = [
    `Display name: ${ctx.display_name ?? "unknown"}`,
    `Sex: ${ctx.sex ?? "unknown"}, Height: ${ctx.height_in ? `${ctx.height_in} in` : "unknown"}`,
    `Goal: ${ctx.start_weight_lb ?? "?"} lb → ${ctx.goal_weight_lb_min ?? "?"}-${ctx.goal_weight_lb_max ?? "?"} lb over ${ctx.timeline_weeks ?? "?"} weeks`,
    `Current weight: ${ctx.current_weight_lb ?? "no data"} lb`,
    `Active conditions: ${ctx.conditions.join(", ") || "none recorded"}`,
    `Current medications: ${ctx.medications.join(", ") || "none recorded"}`,
    `Active injuries / limits: ${ctx.injuries.join(", ") || "none recorded"}`,
    `Active peptide stack compounds: ${ctx.active_compounds.join(", ") || "none recorded"}`,
  ];
  return lines.join("\n");
}

function formatCitations(hits: KbHit[]): string {
  if (hits.length === 0) return "<context>(no curated evidence found for this query — answer from general knowledge and say so)</context>";
  const blocks = hits.map((h, i) => {
    const source = h.source_url ? ` · ${h.source_url}` : "";
    return `[${i + 1}] ${h.title} (${h.evidence_level}, ${h.source_type}${source})\n${h.text}`;
  });
  return `<context>\n${blocks.join("\n\n")}\n</context>`;
}

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const data = await parseJson(req, chatInput);
    const supabase = await createSupabaseServerClient();

    // Resolve or create conversation
    let conversationId = data.conversation_id ?? null;
    if (!conversationId) {
      const { data: created, error } = await supabase
        .from("ai_conversations")
        .insert({ user_id: user.id, title: data.message.slice(0, 60) })
        .select("id")
        .single();
      if (error) throw error;
      conversationId = created.id;
    }

    // Pull prior turns in this thread
    const { data: priorRows } = await supabase
      .from("ai_messages")
      .select("role,content")
      .eq("conversation_id", conversationId)
      .eq("user_id", user.id)
      .order("created_at", { ascending: true })
      .limit(20);
    const priorMessages = (priorRows ?? []) as { role: string; content: string }[];

    // Build context: user profile + RAG hits
    const ctxPack = await loadUserContext(user.id);
    const mentionedCompounds = await detectCompoundsInText(data.message);
    const compoundSlugs =
      mentionedCompounds.length > 0 ? mentionedCompounds : ctxPack.active_compounds;
    const kbHits = await retrieveKb({
      query: data.message,
      compoundSlugs: compoundSlugs.length > 0 ? compoundSlugs : undefined,
      matchCount: 6,
      userId: user.id,
    });

    const systemPrompt = [
      COACH_SYSTEM,
      "\n## User profile\n",
      formatUserContext(ctxPack),
      "\n\n## Curated evidence relevant to this question\n",
      formatCitations(kbHits),
    ].join("");

    // Persist user message first (so it survives any AI failure)
    await supabase.from("ai_messages").insert({
      conversation_id: conversationId,
      user_id: user.id,
      role: "user",
      content: data.message,
    });

    const llmMessages = [
      { role: "system" as const, content: systemPrompt },
      ...priorMessages.map((m) => ({
        role: m.role as "user" | "assistant" | "system",
        content: m.content,
      })),
      { role: "user" as const, content: data.message },
    ];
    const citations = kbHits.map((h, i) => ({
      n: i + 1,
      compound: h.compound_slug,
      section: h.section,
      title: h.title,
      source_type: h.source_type,
      source_url: h.source_url,
      evidence_level: h.evidence_level,
    }));

    // --- Streaming branch (web) -------------------------------------------
    if (data.stream) {
      const cid = conversationId;
      const enc = new TextEncoder();
      const sse = (o: unknown) => enc.encode(`data: ${JSON.stringify(o)}\n\n`);
      const body = new ReadableStream<Uint8Array>({
        async start(controller) {
          controller.enqueue(sse({ conversation_id: cid }));
          let fullText = "";
          let modelStr = "";
          let streamErr: string | null = null;
          try {
            const gen = chatStream({
              feature: "coach",
              userId: user.id,
              messages: llmMessages,
              max_tokens: 1024,
              temperature: 0.4,
            });
            let next = await gen.next();
            while (!next.done) {
              fullText += next.value;
              controller.enqueue(sse({ delta: next.value }));
              next = await gen.next();
            }
            modelStr = next.value.model;
          } catch (err) {
            streamErr = err instanceof Error ? err.message : String(err);
          }
          const finalText = streamErr
            ? `_AI is currently unavailable: ${streamErr}. Try again once API keys are configured in /admin → Feature config._`
            : wrapDoseLike(fullText).wrappedText;
          const { data: row } = await supabase
            .from("ai_messages")
            .insert({
              conversation_id: cid,
              user_id: user.id,
              role: "assistant",
              content: finalText,
              citations,
              tool_calls: [],
              model_string: modelStr || null,
            })
            .select()
            .single();
          await supabase
            .from("ai_conversations")
            .update({ updated_at: new Date().toISOString() })
            .eq("id", cid);
          controller.enqueue(
            sse({ done: true, conversation_id: cid, message: row ?? null, ai_error: streamErr }),
          );
          controller.close();
        },
      });
      return new Response(body, {
        headers: {
          "Content-Type": "text/event-stream; charset=utf-8",
          "Cache-Control": "no-cache, no-transform",
          Connection: "keep-alive",
          "X-Accel-Buffering": "no",
        },
      });
    }

    // Call the gateway
    let aiText = "";
    let modelString = "";
    let providerSlug = "";
    let inputTokens = 0;
    let outputTokens = 0;
    let latencyMs = 0;
    let aiError: string | null = null;

    try {
      const result = await chat({
        feature: "coach",
        userId: user.id,
        messages: llmMessages,
        max_tokens: 1024,
        temperature: 0.4,
      });
      aiText = result.text;
      modelString = result.model;
      providerSlug = result.provider_slug;
      inputTokens = result.input_tokens;
      outputTokens = result.output_tokens;
      latencyMs = result.latency_ms;
    } catch (err) {
      aiError = err instanceof Error ? err.message : String(err);
    }

    // Wrap dose mentions for the rendered display (Phase 9b loosened safety).
    const finalText = aiError
      ? `_AI is currently unavailable: ${aiError}. Try again once API keys are configured in /admin → Feature config._`
      : wrapDoseLike(aiText).wrappedText;

    // Persist assistant message with citation metadata
    const { data: assistantRow, error: assistErr } = await supabase
      .from("ai_messages")
      .insert({
        conversation_id: conversationId,
        user_id: user.id,
        role: "assistant",
        content: finalText,
        citations,
        tool_calls: [],
        model_string: modelString || null,
        provider_slug: providerSlug || null,
        input_tokens: inputTokens || null,
        output_tokens: outputTokens || null,
        latency_ms: latencyMs || null,
      })
      .select()
      .single();
    if (assistErr) throw assistErr;

    // Touch updated_at on the conversation so it floats to the top of the thread list.
    await supabase
      .from("ai_conversations")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", conversationId);

    return jsonOk({
      conversation_id: conversationId,
      message: assistantRow,
      ai_error: aiError,
    });
  } catch (err) {
    return jsonError(err);
  }
}
