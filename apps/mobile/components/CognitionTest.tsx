import { useEffect, useRef, useState } from "react";
import { Alert, Pressable, Text, TextInput, View } from "react-native";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/lib/session";
import { useTheme } from "@/lib/theme-context";

// ~30-sec cognition mini-test (reaction + digit-span memory) → goal_metrics.
// Educational self-tracking, not a clinical assessment.

const TRIALS = 5;
type Phase = "intro" | "reaction" | "memory" | "done";

export function CognitionTest({ onClose }: { onClose: () => void }) {
  const { session } = useSession();
  const uid = session?.user.id;
  const { colors } = useTheme();
  const [phase, setPhase] = useState<Phase>("intro");

  const [light, setLight] = useState<"wait" | "go">("wait");
  const [rts, setRts] = useState<number[]>([]);
  const goAt = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [span, setSpan] = useState(3);
  const [showing, setShowing] = useState<string | null>(null);
  const [answer, setAnswer] = useState("");
  const [best, setBest] = useState(0);
  const target = useRef("");

  function scheduleGo() {
    setLight("wait");
    const delay = 1200 + Math.random() * 1800;
    timer.current = setTimeout(() => {
      goAt.current = Date.now();
      setLight("go");
    }, delay);
  }

  useEffect(() => {
    if (phase === "reaction" && light === "wait") scheduleGo();
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, rts.length]);

  function tap() {
    if (light === "wait") {
      if (timer.current) clearTimeout(timer.current);
      scheduleGo();
      return;
    }
    const next = [...rts, Date.now() - goAt.current];
    setRts(next);
    if (next.length >= TRIALS) startMemory();
    else setLight("wait");
  }

  function present(len: number) {
    setSpan(len);
    setAnswer("");
    let d = "";
    for (let i = 0; i < len; i++) d += Math.floor(Math.random() * 10);
    target.current = d;
    setShowing(d);
    setTimeout(() => setShowing(null), 600 + len * 250);
  }
  function startMemory() {
    setPhase("memory");
    present(3);
  }
  function submit() {
    if (answer === target.current) {
      setBest(span);
      present(span + 1);
    } else {
      finish(best);
    }
  }

  const avgRt = rts.length ? Math.round(rts.reduce((a, b) => a + b, 0) / rts.length) : 0;

  async function finish(mem: number) {
    setPhase("done");
    if (!uid) return;
    await supabase.from("goal_metrics").insert([
      { user_id: uid, metric_key: "cognition_reaction_ms", value: avgRt, unit: "ms", goal_key: "cognition" },
      { user_id: uid, metric_key: "cognition_memory_score", value: mem, unit: "score", goal_key: "cognition" },
    ]);
  }

  return (
    <Card className="gap-3">
      <Text style={{ fontSize: 14, fontWeight: "600", color: colors.foreground }}>Cognition check · ~30 sec</Text>

      {phase === "intro" && (
        <>
          <Text style={{ fontSize: 12, color: colors.fgSubtle }}>
            Tap when the box turns green (5×), then recall the digits. An objective number beside your
            focus rating — not a clinical assessment.
          </Text>
          <Button title="Start" onPress={() => setPhase("reaction")} />
          <Button title="Cancel" variant="ghost" onPress={onClose} />
        </>
      )}

      {phase === "reaction" && (
        <>
          <Text style={{ fontSize: 11, color: colors.fgSubtle }}>Reaction · {rts.length + 1}/{TRIALS}</Text>
          <Pressable
            onPress={tap}
            style={{
              height: 170,
              borderRadius: 14,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: light === "go" ? "#2FDB92" : "#e5484d",
            }}
          >
            <Text style={{ color: "#fff", fontSize: 18, fontWeight: "700" }}>
              {light === "go" ? "TAP!" : "Wait for green…"}
            </Text>
          </Pressable>
        </>
      )}

      {phase === "memory" && (
        <>
          <Text style={{ fontSize: 11, color: colors.fgSubtle }}>Memory · span {span}</Text>
          {showing !== null ? (
            <View style={{ height: 170, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface2 }}>
              <Text style={{ fontSize: 40, fontWeight: "800", letterSpacing: 6, color: colors.foreground }}>{showing}</Text>
            </View>
          ) : (
            <>
              <Text style={{ fontSize: 13, color: colors.fgSubtle }}>Type the digits you saw:</Text>
              <TextInput
                autoFocus
                keyboardType="number-pad"
                value={answer}
                onChangeText={(v) => setAnswer(v.replace(/\D/g, ""))}
                style={{
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: 10,
                  padding: 14,
                  fontSize: 24,
                  textAlign: "center",
                  letterSpacing: 4,
                  color: colors.foreground,
                  backgroundColor: colors.surface2,
                }}
              />
              <Button title="Submit" onPress={submit} />
            </>
          )}
        </>
      )}

      {phase === "done" && (
        <>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <View style={{ flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 12, alignItems: "center" }}>
              <Text style={{ fontSize: 10, color: colors.fgSubtle }}>REACTION</Text>
              <Text style={{ fontSize: 22, fontWeight: "700", color: colors.foreground }}>{avgRt} ms</Text>
            </View>
            <View style={{ flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 12, alignItems: "center" }}>
              <Text style={{ fontSize: 10, color: colors.fgSubtle }}>MEMORY SPAN</Text>
              <Text style={{ fontSize: 22, fontWeight: "700", color: colors.foreground }}>{best}</Text>
            </View>
          </View>
          <Text style={{ fontSize: 10.5, color: colors.fgSubtle }}>Saved. Self-tracked trend, not a clinical measure.</Text>
          <Button title="Done" variant="outline" onPress={onClose} />
        </>
      )}
    </Card>
  );
}
