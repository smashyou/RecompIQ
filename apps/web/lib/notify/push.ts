import "server-only";

export interface PushPayload {
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

interface ExpoTicketResponse {
  data?: { status: "ok" | "error"; details?: { error?: string } }[];
}

/**
 * Send an Expo push to the given tokens. Best-effort: returns the count
 * delivered (status ok). Returns the tokens Expo reports as DeviceNotRegistered
 * so the caller can prune them. No third-party account — uses Expo's push API.
 */
export async function sendPush(
  tokens: string[],
  payload: PushPayload,
): Promise<{ sent: number; invalidTokens: string[] }> {
  const valid = tokens.filter((t) => t.startsWith("ExponentPushToken") || t.startsWith("ExpoPushToken"));
  if (valid.length === 0) return { sent: 0, invalidTokens: [] };
  const messages = valid.map((to) => ({ to, sound: "default", title: payload.title, body: payload.body, data: payload.data ?? {} }));
  const invalidTokens: string[] = [];
  let sent = 0;
  // Expo accepts up to 100 messages per request.
  for (let i = 0; i < messages.length; i += 100) {
    const chunk = messages.slice(i, i + 100);
    try {
      const res = await fetch("https://exp.host/--/api/v2/push/send", {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify(chunk),
      });
      const json = (await res.json()) as ExpoTicketResponse;
      (json.data ?? []).forEach((ticket, idx) => {
        if (ticket.status === "ok") sent++;
        else if (ticket.details?.error === "DeviceNotRegistered") invalidTokens.push(chunk[idx]!.to);
      });
    } catch {
      // best-effort: a push failure must never break the caller
    }
  }
  return { sent, invalidTokens };
}
