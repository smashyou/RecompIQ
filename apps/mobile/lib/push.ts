import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import { Platform } from "react-native";
import { supabase } from "@/lib/supabase";

/**
 * Request permission, get the Expo push token, and upsert it for the user.
 * No-ops on simulators / when permission is denied. Best-effort — never throws.
 * Call on launch once a session exists.
 */
export async function registerPushToken(userId: string): Promise<void> {
  try {
    if (!Device.isDevice) return;

    const { status: existing } = await Notifications.getPermissionsAsync();
    let status = existing;
    if (status !== "granted") {
      status = (await Notifications.requestPermissionsAsync()).status;
    }
    if (status !== "granted") return;

    const tokenResp = await Notifications.getExpoPushTokenAsync();
    const token = tokenResp.data;
    if (!token) return;

    await supabase.from("push_tokens").upsert(
      {
        user_id: userId,
        token,
        platform: Platform.OS === "ios" ? "ios" : "android",
        last_seen_at: new Date().toISOString(),
      },
      { onConflict: "user_id,token" },
    );
  } catch {
    /* best-effort: push registration must never break launch */
  }
}
