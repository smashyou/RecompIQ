"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Activity, Check, Plus, Send, Shield } from "lucide-react";
import type { EvidenceLevel } from "@peptide/shared";
import { Button } from "@/components/ui/button";
import { useFireToast } from "@/components/ui/toast";
import { EvidenceBadge } from "@/components/peptides/evidence-badge";
import { DoseAnnotatedText } from "@/components/peptides/dose-disclaimer";

interface Citation {
  n: number;
  compound: string;
  section: string;
  title: string;
  source_type: string;
  source_url: string | null;
  evidence_level: string;
}

interface Message {
  id: string;
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  citations: Citation[];
  created_at: string;
  model_string?: string | null;
}

interface Conversation {
  id: string;
  title: string | null;
  updated_at: string;
}

const SLASH_HINTS = ["/log", "/explain", "/labs"] as const;

const TODAY_PLAN: [label: string, done: boolean][] = [
  ["Weigh-in", true],
  ["Protein ≥ 175 g", false],
  ["Zone-2 walk 35 min", false],
  ["Log evening dose", false],
];

const CLINICIAN_POINTS = [
  "Resting HR +9 bpm vs baseline",
  "Protein adherence dipping",
  "Request A1c + lipid panel",
];

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const diffMs = Date.now() - then;
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

export function CoachClient({ conversations }: { conversations: Conversation[] }) {
  const router = useRouter();
  const toast = useFireToast();
  const [threadList, setThreadList] = useState(conversations);
  // Land on the "new chat" main view by default (like claude.ai) rather than
  // auto-opening the most recent thread. Past threads are opened from the rail.
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loadingThread, setLoadingThread] = useState(false);
  const endRef = useRef<HTMLDivElement | null>(null);

  // Load messages whenever the active conversation changes.
  useEffect(() => {
    if (!activeId) {
      setMessages([]);
      return;
    }
    let cancelled = false;
    setLoadingThread(true);
    fetch(`/api/coach/conversations/${activeId}/messages`)
      .then((res) => res.json())
      .then((body: { data?: Message[] }) => {
        if (!cancelled) setMessages(body.data ?? []);
      })
      .finally(() => {
        if (!cancelled) setLoadingThread(false);
      });
    return () => {
      cancelled = true;
    };
  }, [activeId]);

  // Auto-scroll to bottom on new messages.
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, sending]);

  function newThread() {
    setActiveId(null);
    setMessages([]);
    setInput("");
  }

  async function send() {
    const text = input.trim();
    if (!text || sending) return;
    setSending(true);
    setInput("");

    // Optimistic user message
    const tempId = `temp-${Date.now()}`;
    setMessages((prev) => [
      ...prev,
      {
        id: tempId,
        role: "user",
        content: text,
        citations: [],
        created_at: new Date().toISOString(),
      },
    ]);

    const res = await fetch("/api/coach/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ conversation_id: activeId, message: text }),
    });
    setSending(false);
    if (res.status === 401) {
      router.replace("/signin?next=/coach");
      return;
    }
    if (!res.ok) {
      const body = (await res.json()) as { error?: { message: string } };
      toast.error(body.error?.message ?? "Coach call failed");
      // Remove the optimistic message
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      return;
    }
    const body = (await res.json()) as {
      data: { conversation_id: string; message: Message; ai_error: string | null };
    };

    // If this was a fresh thread, lift the new id into state + thread list
    if (!activeId) {
      setActiveId(body.data.conversation_id);
      setThreadList((prev) => [
        {
          id: body.data.conversation_id,
          title: text.slice(0, 60),
          updated_at: new Date().toISOString(),
        },
        ...prev,
      ]);
    }
    // Refetch full thread so the user's persisted message replaces the temp
    const reload = await fetch(`/api/coach/conversations/${body.data.conversation_id}/messages`);
    const reloadBody = (await reload.json()) as { data?: Message[] };
    setMessages(reloadBody.data ?? []);
    if (body.data.ai_error) toast.error(`AI unavailable: ${body.data.ai_error}`);
  }

  return (
    <div className="flex max-w-[1180px] gap-4 lg:h-[calc(100vh-108px)] flex-col lg:flex-row">
      {/* Thread rail */}
      <aside className="flex w-full shrink-0 flex-col gap-2 lg:w-[196px]">
        <Button
          onClick={newThread}
          variant={activeId === null ? "default" : "outline"}
          size="sm"
          className="w-full justify-start"
        >
          <Plus size={15} /> New chat
        </Button>
        {threadList.map((t) => {
          const active = t.id === activeId;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setActiveId(t.id)}
              className="rounded-[var(--r-md)] px-3 py-[10px] text-left transition-colors"
              style={{
                background: active ? "var(--surface-1)" : "transparent",
                border: active ? "1px solid var(--border)" : "1px solid transparent",
              }}
            >
              <div
                className="truncate font-[family-name:var(--font-sans)] text-xs"
                style={{
                  fontWeight: active ? 600 : 500,
                  color: active ? "var(--fg)" : "var(--fg-muted)",
                }}
              >
                {t.title ?? "(untitled)"}
              </div>
              <div className="mt-[2px] font-[family-name:var(--font-sans)] text-2xs text-[var(--fg-faint)]">
                {relativeTime(t.updated_at)}
              </div>
            </button>
          );
        })}
      </aside>

      {/* Chat column */}
      <section className="flex min-w-0 flex-1 flex-col rounded-[var(--r-lg)] border border-border bg-[var(--surface-1)] lg:min-w-[340px]">
        <div className="flex flex-1 flex-col gap-5 overflow-y-auto p-[22px]">
          {loadingThread ? (
            <p className="font-[family-name:var(--font-sans)] text-sm text-[var(--fg-muted)]">
              Loading…
            </p>
          ) : messages.length === 0 ? (
            <EmptyState />
          ) : (
            messages.map((m) =>
              m.role === "user" ? (
                <UserBubble key={m.id} content={m.content} />
              ) : (
                <AssistantBubble key={m.id} message={m} />
              ),
            )
          )}
          {sending && (
            <div className="flex items-center gap-2 font-[family-name:var(--font-sans)] text-xs text-[var(--fg-faint)]">
              <span className="h-[6px] w-[6px] animate-pulse rounded-full bg-[var(--primary)]" />
              Thinking…
            </div>
          )}
          <div ref={endRef} />
        </div>

        {/* Composer */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
          className="border-t border-border p-[14px]"
        >
          <div className="mb-[10px] flex gap-[7px]">
            {SLASH_HINTS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setInput((v) => (v ? `${v} ${s}` : `${s} `))}
                className="rounded-[var(--r-sm)] border border-border bg-[var(--surface-2)] px-2 py-[3px] font-[family-name:var(--font-mono)] text-2xs text-[var(--primary)] transition-colors hover:bg-[var(--surface-1)]"
              >
                {s}
              </button>
            ))}
          </div>
          <div className="flex items-end gap-[10px] rounded-[var(--r-md)] border border-border bg-[var(--surface-2)] py-2 pl-[14px] pr-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              rows={1}
              placeholder="Ask the coach, or type / for a command…"
              className="h-[30px] max-h-[120px] flex-1 resize-none bg-transparent font-[family-name:var(--font-sans)] text-sm text-[var(--fg)] outline-none placeholder:text-[var(--fg-faint)]"
            />
            <Button
              type="submit"
              size="sm"
              disabled={sending || !input.trim()}
              className="w-9 p-0"
            >
              <Send size={15} />
            </Button>
          </div>
          <p className="mt-2 text-center font-[family-name:var(--font-sans)] text-2xs text-[var(--fg-faint)]">
            The coach educates, tracks, and warns &mdash; it never prescribes. Not medical advice.
          </p>
        </form>
      </section>

      {/* Right rail */}
      <aside className="flex w-full shrink-0 flex-col gap-3 lg:w-[212px]">
        <RailCard title="Today's plan">
          <ul className="flex list-none flex-col gap-[9px]">
            {TODAY_PLAN.map(([label, done]) => (
              <li key={label} className="flex items-center gap-[9px]">
                <span
                  className="grid h-4 w-4 flex-none place-items-center rounded-[5px]"
                  style={{
                    border: `1.5px solid ${done ? "var(--positive)" : "var(--border-strong)"}`,
                    background: done ? "var(--positive)" : "transparent",
                    color: "var(--positive-foreground)",
                  }}
                >
                  {done && <Check size={11} strokeWidth={2.6} />}
                </span>
                <span
                  className="font-[family-name:var(--font-sans)] text-xs"
                  style={{
                    color: done ? "var(--fg-subtle)" : "var(--fg)",
                    textDecoration: done ? "line-through" : "none",
                  }}
                >
                  {label}
                </span>
              </li>
            ))}
          </ul>
        </RailCard>
        <RailCard title="For your clinician">
          <ul className="flex list-none flex-col gap-2">
            {CLINICIAN_POINTS.map((t) => (
              <li
                key={t}
                className="flex gap-2 font-[family-name:var(--font-sans)] text-xs leading-[1.45] text-[var(--fg-muted)]"
              >
                <span className="flex-none text-[var(--primary)]">&bull;</span>
                {t}
              </li>
            ))}
          </ul>
        </RailCard>
      </aside>
    </div>
  );
}

function RailCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-[var(--r-lg)] border border-border bg-[var(--surface-1)] p-[14px]">
      <h2 className="mb-3 font-[family-name:var(--font-sans)] text-sm font-medium text-foreground">
        {title}
      </h2>
      {children}
    </section>
  );
}

function EmptyState() {
  return (
    <div className="flex max-w-[86%] gap-[11px] self-start">
      <CoachAvatar />
      <div className="min-w-0">
        <p className="font-[family-name:var(--font-sans)] text-sm leading-[1.6] text-[var(--fg)]">
          Hi. I summarize evidence, track what you log, and surface discussion points for your
          clinician &mdash; I won&apos;t prescribe a protocol. A few things I can help with:
        </p>
        <ul className="mt-3 flex list-none flex-col gap-2">
          {[
            "Summarize the evidence for any compound in your catalog — mechanism, monitoring, contraindications.",
            "Translate a clinical paper or lab result into plain language.",
            "Explain how a peptide interacts with your conditions and medications.",
            "Suggest labs to ask your clinician for before starting a protocol.",
          ].map((t) => (
            <li
              key={t}
              className="flex gap-2 font-[family-name:var(--font-sans)] text-xs leading-[1.5] text-[var(--fg-muted)]"
            >
              <span className="flex-none text-[var(--primary)]">&bull;</span>
              {t}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function CoachAvatar() {
  return (
    <span
      className="grid h-[30px] w-[30px] flex-none place-items-center rounded-[9px] text-[var(--primary-foreground)]"
      style={{ background: "linear-gradient(150deg,var(--primary),var(--positive))" }}
    >
      <Activity size={16} />
    </span>
  );
}

function UserBubble({ content }: { content: string }) {
  return (
    <div
      className="max-w-[78%] self-end px-[14px] py-[11px]"
      style={{
        background: "var(--primary-wash)",
        border: "1px solid var(--primary-line)",
        borderRadius: "14px 14px 4px 14px",
      }}
    >
      <p className="whitespace-pre-wrap font-[family-name:var(--font-sans)] text-sm leading-[1.55] text-[var(--fg)]">
        {content}
      </p>
    </div>
  );
}

function AssistantBubble({ message }: { message: Message }) {
  const hasCitations = message.citations && message.citations.length > 0;
  return (
    <div className="flex max-w-[86%] gap-[11px] self-start">
      <CoachAvatar />
      <div className="min-w-0">
        {/* DoseAnnotatedText renders [edu]…[/edu] dose quarantine + the
            educational-summary-only footer when a dose is present. */}
        <div className="font-[family-name:var(--font-sans)] text-sm leading-[1.6] text-[var(--fg)]">
          <DoseAnnotatedText text={message.content} />
        </div>

        {hasCitations && (
          <div className="mt-3 flex flex-wrap gap-2">
            {message.citations.map((c) => (
              <CitationChip key={c.n} citation={c} />
            ))}
          </div>
        )}

        {message.model_string && (
          <p className="mt-2 font-[family-name:var(--font-mono)] text-2xs text-[var(--fg-faint)]">
            {message.model_string}
          </p>
        )}
      </div>
    </div>
  );
}

function CitationChip({ citation }: { citation: Citation }) {
  const chip = (
    <span
      className="inline-flex items-center gap-[7px] rounded-[var(--r-sm)] border border-border bg-[var(--surface-2)] px-[9px] py-[5px]"
    >
      <span className="font-[family-name:var(--font-mono)] text-2xs font-semibold text-[var(--primary)]">
        [{citation.n}]
      </span>
      <span className="max-w-[200px] truncate font-[family-name:var(--font-sans)] text-2xs text-[var(--fg-muted)]">
        {citation.title}
      </span>
      <EvidenceBadge level={citation.evidence_level as EvidenceLevel} />
    </span>
  );
  if (citation.source_url) {
    return (
      <a
        href={citation.source_url}
        target="_blank"
        rel="noopener noreferrer"
        className="transition-[filter] hover:brightness-110"
      >
        {chip}
      </a>
    );
  }
  return chip;
}
