"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useFireToast } from "@/components/ui/toast";
import { Card, Overline } from "@/components/kit";

// ~30-second cognition mini-test: 5-trial reaction time + a digit-span memory
// test. Results post as goal_metrics (cognition_reaction_ms, cognition_memory_score)
// — an objective number beside the focus self-rating. Educational self-tracking,
// not a clinical assessment.

const REACTION_TRIALS = 5;

type Phase = "intro" | "reaction" | "memory" | "done";

export function CognitionTest({ onClose }: { onClose?: () => void }) {
  const router = useRouter();
  const toast = useFireToast();
  const [phase, setPhase] = useState<Phase>("intro");

  // reaction
  const [trial, setTrial] = useState(0);
  const [light, setLight] = useState<"wait" | "go">("wait");
  const [rts, setRts] = useState<number[]>([]);
  const goAtRef = useRef<number>(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // memory
  const [span, setSpan] = useState(3);
  const [showing, setShowing] = useState<string | null>(null);
  const [answer, setAnswer] = useState("");
  const [memoryBest, setMemoryBest] = useState(0);
  const [memTarget, setMemTarget] = useState("");

  const [saving, setSaving] = useState(false);

  const scheduleGo = useCallback(() => {
    setLight("wait");
    const delay = 1200 + Math.random() * 1800;
    timerRef.current = setTimeout(() => {
      goAtRef.current = Date.now();
      setLight("go");
    }, delay);
  }, []);

  useEffect(() => {
    if (phase === "reaction" && light === "wait") scheduleGo();
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, trial]);

  function tapReaction() {
    if (light === "wait") {
      // too early — restart this trial
      if (timerRef.current) clearTimeout(timerRef.current);
      toast.error("Too early — wait for green.");
      scheduleGo();
      return;
    }
    const rt = Date.now() - goAtRef.current;
    const next = [...rts, rt];
    setRts(next);
    if (next.length >= REACTION_TRIALS) {
      startMemory();
    } else {
      setTrial((t) => t + 1);
      setLight("wait");
    }
  }

  function startMemory() {
    setPhase("memory");
    presentSpan(3);
  }

  function presentSpan(len: number) {
    setSpan(len);
    setAnswer("");
    let digits = "";
    for (let i = 0; i < len; i++) digits += Math.floor(Math.random() * 10);
    setMemTarget(digits);
    setShowing(digits);
    setTimeout(() => setShowing(null), 600 + len * 250);
  }

  function submitMemory() {
    if (answer === memTarget) {
      setMemoryBest(span);
      presentSpan(span + 1);
    } else {
      finish(memoryBest);
    }
  }

  const avgRt = rts.length ? Math.round(rts.reduce((a, b) => a + b, 0) / rts.length) : 0;

  async function finish(memScore: number) {
    setPhase("done");
    setSaving(true);
    const res = await fetch("/api/goal-metrics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        metrics: [
          { metric_key: "cognition_reaction_ms", value: avgRt, unit: "ms", goal_key: "cognition" },
          { metric_key: "cognition_memory_score", value: memScore, unit: "score", goal_key: "cognition" },
        ],
      }),
    });
    setSaving(false);
    if (res.ok) {
      toast.success("Cognition check saved");
      router.refresh();
    } else {
      toast.error("Could not save result");
    }
  }

  return (
    <Card title="Cognition check · ~30 sec">
      {phase === "intro" && (
        <div className="space-y-3">
          <p className="font-[family-name:var(--font-sans)] text-[12.5px] leading-[1.5] text-[var(--fg-muted)]">
            Two quick tasks: tap as fast as you can when the box turns green (5×), then recall a
            growing string of digits. An objective number to track beside your focus rating —
            educational self-tracking, not a clinical assessment.
          </p>
          <Button onClick={() => setPhase("reaction")}>Start</Button>
        </div>
      )}

      {phase === "reaction" && (
        <div className="space-y-3">
          <Overline>Reaction · {rts.length + 1}/{REACTION_TRIALS}</Overline>
          <button
            type="button"
            onClick={tapReaction}
            className="grid h-44 w-full place-items-center rounded-[var(--r-lg)] font-[family-name:var(--font-display)] text-[18px] font-semibold text-white transition-colors"
            style={{ background: light === "go" ? "var(--ok, #2FDB92)" : "var(--danger, #e5484d)" }}
          >
            {light === "go" ? "TAP!" : "Wait for green…"}
          </button>
        </div>
      )}

      {phase === "memory" && (
        <div className="space-y-3">
          <Overline>Memory · span {span}</Overline>
          {showing !== null ? (
            <div className="grid h-44 w-full place-items-center rounded-[var(--r-lg)] border border-[var(--border)] bg-[var(--surface-2)] font-[family-name:var(--font-mono)] text-[40px] font-bold tracking-[0.15em] text-[var(--fg)]">
              {showing}
            </div>
          ) : (
            <div className="space-y-3">
              <p className="font-[family-name:var(--font-sans)] text-[13px] text-[var(--fg-muted)]">
                Type the digits you saw:
              </p>
              <input
                autoFocus
                inputMode="numeric"
                value={answer}
                onChange={(e) => setAnswer(e.target.value.replace(/\D/g, ""))}
                onKeyDown={(e) => e.key === "Enter" && submitMemory()}
                className="w-full rounded-[var(--r-md)] border border-[var(--border)] bg-[var(--surface-2)] p-3 text-center font-[family-name:var(--font-mono)] text-[24px] tracking-[0.1em] text-[var(--fg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary-line)]"
              />
              <Button onClick={submitMemory} className="w-full">
                Submit
              </Button>
            </div>
          )}
        </div>
      )}

      {phase === "done" && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-[var(--r-md)] border border-[var(--border)] bg-[var(--surface-1)] p-3 text-center">
              <Overline>Reaction</Overline>
              <p className="mt-1 font-[family-name:var(--font-mono)] text-[22px] font-semibold tabular-nums text-[var(--fg)]">
                {avgRt}
                <span className="text-[12px] text-[var(--fg-subtle)]"> ms</span>
              </p>
            </div>
            <div className="rounded-[var(--r-md)] border border-[var(--border)] bg-[var(--surface-1)] p-3 text-center">
              <Overline>Memory span</Overline>
              <p className="mt-1 font-[family-name:var(--font-mono)] text-[22px] font-semibold tabular-nums text-[var(--fg)]">
                {memoryBest}
              </p>
            </div>
          </div>
          <p className="font-[family-name:var(--font-sans)] text-[11px] text-[var(--fg-subtle)]">
            {saving ? "Saving…" : "Saved. Self-tracked trend, not a clinical measure."}
          </p>
          {onClose && (
            <Button variant="outline" onClick={onClose} className="w-full">
              Done
            </Button>
          )}
        </div>
      )}
    </Card>
  );
}
