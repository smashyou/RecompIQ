import { useState } from "react";
import { useRouter } from "expo-router";
import { Alert, Image, Pressable, Text, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons";
import { Button } from "@/components/ui/Button";
import { Content } from "@/components/ui/Content";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { apiFetch, apiUpload } from "@/lib/api";
import { colors } from "@/lib/theme";

type Angle = "front" | "back" | "left" | "right";

const ANGLES: { id: Angle; label: string; tip: string }[] = [
  { id: "front", label: "Front", tip: "Face the camera, arms slightly out, neutral posture." },
  { id: "back", label: "Back", tip: "Turn around. Same posture." },
  { id: "left", label: "Left side", tip: "Turn 90° so your left side faces the camera." },
  { id: "right", label: "Right side", tip: "Turn 180°. Right side to camera." },
];

interface UploadedPhoto {
  url: string;
  pathname: string;
}

// UUID v4 (matches the web upload route's session_id regex /^[0-9a-f-]{32,40}$/i).
// crypto.randomUUID() isn't available in the RN runtime, so we generate locally.
function newSessionId(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export default function BodyShotsCapture() {
  const router = useRouter();
  const [sessionId] = useState(newSessionId);
  const [photos, setPhotos] = useState<Partial<Record<Angle, UploadedPhoto>>>({});
  const [previews, setPreviews] = useState<Partial<Record<Angle, string>>>({});
  const [uploadingAngle, setUploadingAngle] = useState<Angle | null>(null);
  const [weight, setWeight] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  async function uploadAsset(angle: Angle, uri: string) {
    setUploadingAngle(angle);
    setPreviews((prev) => ({ ...prev, [angle]: uri }));
    try {
      const form = new FormData();
      form.append("file", { uri, name: "shot.jpg", type: "image/jpeg" } as any);
      form.append("angle", angle);
      form.append("session_id", sessionId);
      const data = await apiUpload<UploadedPhoto>("/api/body-shots/upload", form);
      setPhotos((prev) => ({ ...prev, [angle]: data }));
    } catch (e) {
      setPreviews((prev) => {
        const next = { ...prev };
        delete next[angle];
        return next;
      });
      Alert.alert("Upload failed", e instanceof Error ? e.message : "Unknown error");
    } finally {
      setUploadingAngle(null);
    }
  }

  function pickFor(angle: Angle) {
    Alert.alert(`Add ${angle} photo`, undefined, [
      { text: "Take photo", onPress: () => fromCamera(angle) },
      { text: "Choose from library", onPress: () => fromLibrary(angle) },
      { text: "Cancel", style: "cancel" },
    ]);
  }

  async function fromCamera(angle: Angle) {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Camera access needed", "Enable camera permission to take a photo.");
      return;
    }
    const res = await ImagePicker.launchCameraAsync({
      mediaTypes: ["images"],
      quality: 0.8,
    });
    if (!res.canceled && res.assets[0]) uploadAsset(angle, res.assets[0].uri);
  }

  async function fromLibrary(angle: Angle) {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Library access needed", "Enable photo library permission to pick a photo.");
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.8,
    });
    if (!res.canceled && res.assets[0]) uploadAsset(angle, res.assets[0].uri);
  }

  async function save() {
    const completed = Object.values(photos).filter(Boolean).length;
    if (completed === 0) {
      Alert.alert("Add a photo first", "Upload at least one angle before saving.");
      return;
    }
    setSaving(true);
    try {
      await apiFetch("/api/body-shots", {
        method: "POST",
        body: JSON.stringify({
          captured_at: new Date().toISOString(),
          front_url: photos.front?.url ?? null,
          back_url: photos.back?.url ?? null,
          left_url: photos.left?.url ?? null,
          right_url: photos.right?.url ?? null,
          weight_at_capture_lb: weight ? Number(weight) : null,
          notes: notes || null,
        }),
      });
      router.replace("/(tabs)/more/body-shots");
    } catch (e) {
      Alert.alert("Could not save session", e instanceof Error ? e.message : "Unknown error");
    } finally {
      setSaving(false);
    }
  }

  const completed = Object.values(photos).filter(Boolean).length;

  return (
    <Content className="gap-4">
      <View className="gap-2 rounded-xl border border-border bg-card p-4">
        <Text className="text-xs text-muted-foreground">
          Progress · <Text className="font-medium text-foreground">{completed}/4</Text> angles uploaded
        </Text>
        <View className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <View
            className="h-full rounded-full bg-primary"
            style={{ width: `${(completed / 4) * 100}%` }}
          />
        </View>
      </View>

      {ANGLES.map((a) => {
        const uploaded = photos[a.id];
        const preview = previews[a.id];
        const busy = uploadingAngle === a.id;
        return (
          <View key={a.id} className="gap-3 rounded-xl border border-border bg-card p-4">
            <View className="flex-row items-center justify-between gap-3">
              <View className="flex-1">
                <View className="flex-row items-center gap-2">
                  <Text className="text-sm font-semibold text-foreground">{a.label}</Text>
                  {uploaded ? (
                    <Ionicons name="checkmark-circle" size={16} color={colors.accent} />
                  ) : null}
                </View>
                <Text className="text-xs text-muted-foreground">{a.tip}</Text>
              </View>
              <Pressable
                onPress={() => pickFor(a.id)}
                disabled={busy}
                className="flex-row items-center gap-1.5 rounded-md border border-primary px-3 py-1.5"
              >
                <Ionicons
                  name={uploaded ? "refresh-outline" : "camera-outline"}
                  size={14}
                  color={colors.primary}
                />
                <Text className="text-xs font-medium text-primary">
                  {busy ? "Uploading…" : uploaded ? "Replace" : "Add photo"}
                </Text>
              </Pressable>
            </View>
            {preview ? (
              <View
                className="overflow-hidden rounded-lg border border-border bg-muted"
                style={{ opacity: busy ? 0.6 : 1 }}
              >
                <Image
                  source={{ uri: preview }}
                  style={{ width: "100%", height: 260 }}
                  resizeMode="contain"
                />
              </View>
            ) : null}
          </View>
        );
      })}

      <View className="gap-3 rounded-xl border border-border bg-card p-4">
        <Text className="text-sm font-semibold text-foreground">Optional</Text>
        <Field label="Weight at capture (lb)">
          <Input
            value={weight}
            onChangeText={setWeight}
            keyboardType="decimal-pad"
            placeholder="e.g. 212.4"
          />
        </Field>
        <Field label="Notes">
          <Input
            value={notes}
            onChangeText={setNotes}
            placeholder="lighting, time of day, anything to note"
          />
        </Field>
      </View>

      <View className="flex-row gap-3">
        <Button title="Cancel" variant="outline" className="flex-1" onPress={() => router.back()} />
        <Button
          title={saving ? "Saving…" : `Save (${completed}/4)`}
          className="flex-1"
          loading={saving}
          disabled={completed === 0}
          onPress={save}
        />
      </View>
    </Content>
  );
}
