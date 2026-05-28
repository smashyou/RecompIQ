"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useFireToast } from "@/components/ui/toast";
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

export function CoachClient({ conversations }: { conversations: Conversation[] }) {
  const router = useRouter();
  const toast = useFireToast();
  const [threadList, setThreadList] = useState(conversations);
  const [activeId, setActiveId] = useState<string | null>(conversations[0]?.id ?? null);
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

  async function newThread() {
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
    <div className="flex h-[calc(100vh-7rem)] flex-col gap-4 md:flex-row">
      {/* Thread list */}
      <aside className="hidden w-56 shrink-0 overflow-y-auto rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-3 md:block">
        <Button onClick={newThread} variant="outline" size="sm" className="w-full">
          <Plus className="h-3 w-3" /> New thread
        </Button>
        <ul className="mt-3 space-y-1">
          {threadList.map((t) => {
            const active = t.id === activeId;
            return (
              <li key={t.id}>
                <button
                  type="button"
                  onClick={() => setActiveId(t.id)}
                  className={`w-full truncate rounded-md px-2 py-2 text-left text-xs transition-colors ${
                    active
                      ? "bg-[var(--color-muted)] text-[var(--color-foreground)]"
                      : "text-[var(--color-muted-foreground)] hover:bg-[var(--color-muted)]"
                  }`}
                >
                  {t.title ?? "(untitled)"}
                </button>
              </li>
            );
          })}
        </ul>
      </aside>

      {/* Chat panel */}
      <section className="flex flex-1 flex-col overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-card)]">
        <header className="border-b border-[var(--color-border)] px-5 py-3">
          <h1 className="text-sm font-semibold">Coach</h1>
          <p className="text-[10px] text-[var(--color-muted-foreground)]">
            Educational research assistant. Not medical advice.
          </p>
        </header>
        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
          {loadingThread ? (
            <p className="text-sm text-[var(--color-muted-foreground)]">Loading…</p>
          ) : messages.length === 0 ? (
            <EmptyState />
          ) : (
            messages.map((m) => <MessageBubble key={m.id} message={m} />)
          )}
          {sending && (
            <div className="flex items-center gap-2 text-xs text-[var(--color-muted-foreground)]">
              <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--color-primary)]" />
              Thinking…
            </div>
          )}
          <div ref={endRef} />
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
          className="flex gap-2 border-t border-[var(--color-border)] p-3"
        >
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            placeholder="Ask about a compound, your trend, lab markers…"
            rows={2}
            className="flex-1 resize-none rounded-lg border border-[var(--color-border)] bg-[var(--color-input)] px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]"
          />
          <Button type="submit" disabled={sending || !input.trim()} size="icon">
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </section>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="space-y-2 text-sm text-[var(--color-muted-foreground)]">
      <p>Hi. Some things I can help with:</p>
      <ul className="space-y-1 pl-4">
        <li>• Summarize evidence for any compound in your catalog (mechanism, monitoring, contras).</li>
        <li>• Translate a clinical paper or lab result into plain language.</li>
        <li>• Explain how a peptide interacts with your current conditions / meds.</li>
        <li>• Suggest labs to ask your clinician for before starting a protocol.</li>
      </ul>
      <p className="pt-2 text-[10px]">
        Dose values I mention are educational summaries — not medical advice. Always discuss with a
        licensed clinician.
      </p>
    </div>
  );
}

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
          isUser
            ? "bg-[var(--color-primary)] text-[var(--color-primary-foreground)]"
            : "bg-[var(--color-muted)] text-[var(--color-foreground)]"
        }`}
      >
        {isUser ? (
          <span className="whitespace-pre-wrap">{message.content}</span>
        ) : (
          <>
            <DoseAnnotatedText text={message.content} />
            {message.citations && message.citations.length > 0 && (
              <div className="mt-3 space-y-1 border-t border-[var(--color-border)] pt-2 text-[10px] text-[var(--color-muted-foreground)]">
                <p className="font-medium uppercase tracking-wider">Sources</p>
                {message.citations.map((c) => (
                  <p key={c.n}>
                    [{c.n}] <span className="font-medium">{c.title}</span> ·{" "}
                    <span className="uppercase">{c.evidence_level}</span>
                    {c.source_url && (
                      <>
                        {" · "}
                        <a
                          href={c.source_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="underline-offset-2 hover:underline"
                        >
                          source
                        </a>
                      </>
                    )}
                  </p>
                ))}
              </div>
            )}
            {message.model_string && (
              <p className="mt-2 text-[9px] text-[var(--color-muted-foreground)]">
                {message.model_string}
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
