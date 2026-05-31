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
import { DoseText } from "@/components/peptides/DoseText";
import { apiFetch } from "@/lib/api";
import { colors } from "@/lib/theme";
import { cn } from "@/lib/cn";

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

  // Load conversation list on mount.
  useEffect(() => {
    apiFetch<Conversation[]>("/api/coach/conversations")
      .then((data) => {
        setThreads(data ?? []);
        if (data?.[0]) setActiveId(data[0].id);
      })
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
          <Pressable onPress={newThread} className="flex-row items-center gap-1 rounded-full border border-border bg-card px-3 py-1.5 active:opacity-70">
            <Ionicons name="add" size={14} color={colors.primary} />
            <Text className="text-xs font-medium text-primary">New</Text>
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

      {/* Input */}
      <View className="flex-row items-end gap-2 border-t border-border p-3">
        <TextInput
          value={input}
          onChangeText={setInput}
          placeholder="Ask about a compound, your trend, labs…"
          placeholderTextColor={colors.mutedForeground}
          multiline
          className="max-h-28 flex-1 rounded-lg border border-border bg-input px-3 py-2 text-base text-foreground"
        />
        <Pressable
          onPress={send}
          disabled={sending || !input.trim()}
          className={cn("h-11 w-11 items-center justify-center rounded-lg", sending || !input.trim() ? "bg-muted" : "bg-primary")}
        >
          <Ionicons name="send" size={18} color={sending || !input.trim() ? colors.mutedForeground : colors.primaryForeground} />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

function Bubble({ message }: { message: Message }) {
  const isUser = message.role === "user";
  return (
    <View className={cn("max-w-[88%]", isUser ? "self-end" : "self-start")}>
      <View className={cn("rounded-2xl px-3 py-2", isUser ? "bg-primary" : "bg-muted")}>
        {isUser ? (
          <Text className="text-sm leading-relaxed text-primary-foreground">{message.content}</Text>
        ) : (
          <>
            <DoseText text={message.content} />
            {message.citations?.length ? (
              <View className="mt-3 gap-1 border-t border-border pt-2">
                <Text className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Sources</Text>
                {message.citations.map((c) => (
                  <Pressable key={c.n} onPress={() => c.source_url && Linking.openURL(c.source_url)} disabled={!c.source_url}>
                    <Text className="text-[10px] text-muted-foreground">
                      [{c.n}] <Text className="font-medium text-foreground">{c.title}</Text> · {c.evidence_level.toUpperCase()}
                      {c.source_url ? <Text className="text-primary"> · source</Text> : null}
                    </Text>
                  </Pressable>
                ))}
              </View>
            ) : null}
            <Text className="mt-2 text-[9px] text-muted-foreground">Educational summary only — not medical advice.</Text>
            {message.model_string ? <Text className="text-[9px] text-muted-foreground">{message.model_string}</Text> : null}
          </>
        )}
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
