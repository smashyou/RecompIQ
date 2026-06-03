import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { EvidenceLevel } from "@peptide/shared";
import { DoseText } from "@/components/peptides/DoseText";
import { EvidenceBadge } from "@/components/ui/EvidenceBadge";
import { apiFetch } from "@/lib/api";
import { colors, radius } from "@/lib/theme";
import { cn } from "@/lib/cn";

const EVIDENCE_LEVELS: ReadonlySet<string> = new Set([
  "FDA_APPROVED",
  "HUMAN_RCT",
  "HUMAN_OBS",
  "ANIMAL",
  "MECHANISTIC",
  "ANECDOTAL",
]);
function asEvidenceLevel(raw: string): EvidenceLevel | null {
  const up = raw?.toUpperCase();
  return EVIDENCE_LEVELS.has(up) ? (up as EvidenceLevel) : null;
}

interface Citation {
  n: number;
  title: string;
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

export default function Coach() {
  const [threads, setThreads] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loadingThread, setLoadingThread] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  // Load conversation list on mount. Stay on the "New chat" main view by default
  // (like claude.ai) — past threads are opened from the chips, not auto-resumed.
  useEffect(() => {
    apiFetch<Conversation[]>("/api/coach/conversations")
      .then((data) => setThreads(data ?? []))
      .catch(() => {});
  }, []);

  const loadMessages = useCallback(async (id: string | null) => {
    if (!id) {
      setMessages([]);
      return;
    }
    setLoadingThread(true);
    try {
      const data = await apiFetch<Message[]>(`/api/coach/conversations/${id}/messages`);
      setMessages(data ?? []);
    } catch {
      setMessages([]);
    } finally {
      setLoadingThread(false);
    }
  }, []);

  useEffect(() => {
    loadMessages(activeId);
  }, [activeId, loadMessages]);

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
    const tempId = `temp-${text.length}-${messages.length}`;
    setMessages((prev) => [
      ...prev,
      { id: tempId, role: "user", content: text, citations: [], created_at: "" },
    ]);
    try {
      const data = await apiFetch<{ conversation_id: string; message: Message; ai_error: string | null }>(
        "/api/coach/chat",
        { method: "POST", body: JSON.stringify({ conversation_id: activeId, message: text }) },
      );
      const convoId = data.conversation_id;
      if (!activeId) {
        setActiveId(convoId);
        setThreads((prev) => [{ id: convoId, title: text.slice(0, 60), updated_at: "" }, ...prev]);
      }
      await loadMessages(convoId);
    } catch (e) {
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      setMessages((prev) => [
        ...prev,
        { id: `err-${tempId}`, role: "assistant", content: e instanceof Error ? e.message : "Coach unavailable.", citations: [], created_at: "" },
      ]);
    } finally {
      setSending(false);
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
      className="flex-1 bg-background"
    >
      {/* Thread chips */}
      <View className="border-b border-border">
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2 px-3 py-2">
          <Pressable
            onPress={newThread}
            className={cn(
              "flex-row items-center gap-1 rounded-full border px-3 py-1.5 active:opacity-70",
              activeId === null ? "border-primary bg-primary" : "border-border bg-card",
            )}
          >
            <Ionicons
              name="add"
              size={14}
              color={activeId === null ? colors.primaryForeground : colors.primary}
            />
            <Text
              className={cn(
                "text-xs font-medium",
                activeId === null ? "text-primary-foreground" : "text-primary",
              )}
            >
              New chat
            </Text>
          </Pressable>
          {threads.map((t) => {
            const active = t.id === activeId;
            return (
              <Pressable
                key={t.id}
                onPress={() => setActiveId(t.id)}
                className={cn("rounded-full border px-3 py-1.5", active ? "border-primary bg-primary" : "border-border bg-card")}
              >
                <Text numberOfLines={1} className={cn("max-w-[160px] text-xs", active ? "text-primary-foreground" : "text-muted-foreground")}>
                  {t.title ?? "(untitled)"}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* Messages */}
      <ScrollView
        ref={scrollRef}
        className="flex-1"
        contentContainerClassName="gap-4 px-4 py-4"
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
        keyboardShouldPersistTaps="handled"
      >
        {loadingThread ? (
          <Text className="text-sm text-muted-foreground">Loading…</Text>
        ) : messages.length === 0 ? (
          <CoachEmpty />
        ) : (
          messages.map((m) => <Bubble key={m.id} message={m} />)
        )}
        {sending ? (
          <View className="flex-row items-center gap-2">
            <ActivityIndicator size="small" color={colors.primary} />
            <Text className="text-xs text-muted-foreground">Thinking…</Text>
          </View>
        ) : null}
      </ScrollView>

      {/* Input — handoff MCoach: pill field + circular send + safety footer */}
      <View className="px-4 pb-2 pt-3">
        <View className="flex-row items-center gap-2 rounded-full border border-border bg-muted py-1.5 pl-4 pr-1.5">
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder="Ask the coach…"
            placeholderTextColor={colors.mutedForeground}
            multiline
            className="max-h-24 flex-1 text-base text-foreground"
          />
          <Pressable
            onPress={send}
            disabled={sending || !input.trim()}
            className={cn("h-9 w-9 items-center justify-center rounded-full", sending || !input.trim() ? "bg-muted" : "bg-primary")}
          >
            <Ionicons name="send" size={15} color={sending || !input.trim() ? colors.mutedForeground : colors.primaryForeground} />
          </Pressable>
        </View>
        <Text className="mt-2 text-center text-[10px] text-muted-foreground">Educates, tracks, warns — never prescribes.</Text>
      </View>
    </KeyboardAvoidingView>
  );
}

function Bubble({ message }: { message: Message }) {
  const isUser = message.role === "user";
  if (isUser) {
    // handoff MCoach: user bubble pinned right, primary wash, tapered corner.
    return (
      <View
        className="max-w-[82%] self-end"
        style={{ borderWidth: 1, borderColor: colors.primaryLine, backgroundColor: colors.primaryWash, borderRadius: 14, borderBottomRightRadius: 4, paddingVertical: 10, paddingHorizontal: 13 }}
      >
        <Text className="text-sm leading-relaxed text-foreground">{message.content}</Text>
      </View>
    );
  }

  // handoff MCoach: assistant row = gradient avatar glyph + content column.
  const hasDose = /\bdose|\bmcg|\bmg\b|\bIU\b|\bunits?\b/i.test(message.content);
  return (
    <View className="max-w-[92%] flex-row gap-2.5 self-start">
      <View
        style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" }}
      >
        <Ionicons name="pulse" size={15} color={colors.primaryForeground} />
      </View>
      <View className="flex-1">
        <DoseText text={message.content} />
        {message.citations?.length ? (
          <View className="mt-2 flex-row flex-wrap gap-1.5">
            {message.citations.map((c) => {
              const lvl = asEvidenceLevel(c.evidence_level);
              return (
                <Pressable
                  key={c.n}
                  onPress={() => c.source_url && Linking.openURL(c.source_url)}
                  disabled={!c.source_url}
                  className="flex-row items-center gap-1.5"
                  style={{ paddingVertical: 4, paddingHorizontal: 8, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface2 }}
                >
                  <Text className="text-[10px] text-primary">[{c.n}]</Text>
                  {lvl ? <EvidenceBadge level={lvl} /> : <Text className="text-[10px] text-muted-foreground">{c.evidence_level.toUpperCase()}</Text>}
                </Pressable>
              );
            })}
          </View>
        ) : null}
        {hasDose ? (
          <View
            className="mt-2 flex-row gap-2"
            style={{ paddingVertical: 9, paddingHorizontal: 11, borderRadius: radius.sm, borderWidth: 1, borderStyle: "dashed", borderColor: colors.primaryLine, backgroundColor: colors.primaryWash }}
          >
            <Ionicons name="shield-outline" size={13} color={colors.primary} style={{ marginTop: 1 }} />
            <Text className="flex-1 text-[11px] leading-snug text-muted-foreground">
              <Text className="font-semibold text-foreground">Educational summary only.</Text> Not a prescription.
            </Text>
          </View>
        ) : (
          <Text className="mt-2 text-[9px] text-muted-foreground">Educational summary only — not medical advice.</Text>
        )}
        {message.model_string ? <Text className="text-[9px] text-muted-foreground">{message.model_string}</Text> : null}
      </View>
    </View>
  );
}

function CoachEmpty() {
  return (
    <View className="gap-2">
      <Text className="text-sm text-muted-foreground">Hi. Some things I can help with:</Text>
      {[
        "Summarize evidence for any compound in your catalog (mechanism, monitoring, contraindications).",
        "Translate a clinical paper or lab result into plain language.",
        "Explain how a peptide interacts with your conditions / meds.",
        "Suggest labs to ask your clinician for before a protocol.",
      ].map((s, i) => (
        <Text key={i} className="pl-2 text-sm text-muted-foreground">• {s}</Text>
      ))}
      <Text className="pt-2 text-[10px] text-muted-foreground">
        Dose values are educational summaries — not medical advice. Always discuss with a licensed clinician.
      </Text>
    </View>
  );
}
