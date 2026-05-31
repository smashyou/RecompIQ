import { useEffect, useState } from "react";
import { Alert, Platform, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Content } from "@/components/ui/Content";
import { Field } from "@/components/ui/Field";
import { Segmented } from "@/components/ui/Segmented";
import { StatBox } from "@/components/ui/StatBox";
import { Loading } from "@/components/ui/States";
import { useSession } from "@/lib/session";
import { colors } from "@/lib/theme";
import {
  HEALTH_SOURCE_LABEL,
  getLastSync,
  healthEnvironment,
  isHealthAvailable,
  requestHealthPermissions,
  syncHealth,
  type SyncResult,
} from "@/lib/health";

const WINDOWS = [
  { value: "14", label: "14 days" },
  { value: "30", label: "30 days" },
  { value: "90", label: "90 days" },
];

export default function Health() {
  const { session } = useSession();
  const env = healthEnvironment();
  const [available, setAvailable] = useState<boolean | null>(null);
  const [connected, setConnected] = useState(false);
  const [days, setDays] = useState("14");
  const [busy, setBusy] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [result, setResult] = useState<SyncResult | null>(null);

  useEffect(() => {
    getLastSync().then(setLastSync);
    if (env === "ios" || env === "android") isHealthAvailable().then(setAvailable);
    else setAvailable(false);
  }, [env]);

  async function connect() {
    setBusy(true);
    try {
      setConnected(await requestHealthPermissions());
    } catch (e) {
      Alert.alert("Couldn't connect", e instanceof Error ? e.message : "Unknown error");
    } finally {
      setBusy(false);
    }
  }

  async function sync() {
    if (!session) return;
    setBusy(true);
    try {
      const r = await syncHealth(session.user.id, Number(days));
      setResult(r);
      setLastSync(new Date().toISOString());
      Alert.alert("Synced", `Imported ${r.weights} weigh-ins, ${r.steps} step days, ${r.vitals} HR, ${r.sleep} sleep nights.`);
    } catch (e) {
      Alert.alert("Sync failed", e instanceof Error ? e.message : "Unknown error");
    } finally {
      setBusy(false);
    }
  }

  if (env === "expo-go" || env === "unsupported") return <NeedsDevBuild />;
  if (available === null) return <Loading />;
  if (available === false) return <NotAvailable />;

  return (
    <Content className="gap-4">
      <Card className="gap-2">
        <View className="flex-row items-center gap-2">
          <Ionicons name={Platform.OS === "ios" ? "heart-outline" : "fitness-outline"} size={20} color={colors.primary} />
          <Text className="text-base font-semibold text-foreground">{HEALTH_SOURCE_LABEL}</Text>
        </View>
        <Text className="text-sm leading-relaxed text-muted-foreground">
          Imports weight, body-fat %, lean mass, steps, resting heart rate, and sleep. Your scale app
          (Arboleaf, Renpho, Withings…) and watch already feed {HEALTH_SOURCE_LABEL} — RecompIQ reads
          from there, and the data shows up on web automatically.
        </Text>
      </Card>

      {!connected ? (
        <Button title={`Connect ${HEALTH_SOURCE_LABEL}`} onPress={connect} loading={busy} />
      ) : (
        <Card className="gap-4">
          <Field label="Sync window">
            <Segmented options={WINDOWS} value={days} onChange={setDays} />
          </Field>
          <Button title="Sync now" onPress={sync} loading={busy} />
          {result ? (
            <View className="flex-row flex-wrap gap-3">
              <StatBox label="Weigh-ins" value={String(result.weights)} />
              <StatBox label="Step days" value={String(result.steps)} />
              <StatBox label="HR days" value={String(result.vitals)} />
              <StatBox label="Sleep nights" value={String(result.sleep)} />
            </View>
          ) : null}
        </Card>
      )}

      {lastSync ? (
        <Text className="text-xs text-muted-foreground">Last sync: {new Date(lastSync).toLocaleString()}</Text>
      ) : null}

      <Text className="text-[10px] leading-relaxed text-muted-foreground">
        Imported values are tagged so re-syncing won't duplicate. Health data is for tracking only,
        not medical advice.
      </Text>
    </Content>
  );
}

function NeedsDevBuild() {
  return (
    <Content className="gap-4">
      <View className="items-center gap-3 pt-6">
        <Ionicons name="watch-outline" size={36} color={colors.primary} />
        <Text className="text-center text-xl font-semibold text-foreground">Watch & scale sync</Text>
      </View>
      <Card className="gap-2">
        <Text className="text-sm leading-relaxed text-muted-foreground">
          This connects to <Text className="text-foreground">Apple Health</Text> (iOS) and{" "}
          <Text className="text-foreground">Health Connect</Text> (Android) to auto-import weight,
          body composition, steps, heart rate, and sleep — including data from smart scales like
          Arboleaf, Renpho, and Withings that sync into them.
        </Text>
        <Text className="text-sm leading-relaxed text-muted-foreground">
          The integration is built and wired, but Apple Health / Health Connect are native modules
          that <Text className="text-foreground">don't run in Expo Go</Text>. It activates once the
          app runs as a development build (the EAS/dev-build setup is the next step).
        </Text>
      </Card>
      <Card className="gap-2">
        <Text className="text-sm font-semibold text-foreground">When it's live, it will</Text>
        {[
          "Read weight + body-fat % + lean mass from your scale app",
          "Pull steps, resting HR, and sleep from your watch",
          "Write everything into your tracking — visible on web too",
          "De-dupe automatically so re-syncing is safe",
        ].map((t, i) => (
          <View key={i} className="flex-row gap-2">
            <Ionicons name="checkmark-circle-outline" size={16} color={colors.accent} />
            <Text className="flex-1 text-sm text-muted-foreground">{t}</Text>
          </View>
        ))}
      </Card>
    </Content>
  );
}

function NotAvailable() {
  return (
    <Content className="gap-4">
      <Card className="gap-2">
        <Text className="text-base font-semibold text-foreground">{HEALTH_SOURCE_LABEL} unavailable</Text>
        <Text className="text-sm leading-relaxed text-muted-foreground">
          {Platform.OS === "android"
            ? "Health Connect isn't available on this device. Install it from the Play Store (built in on Android 14+), then return here."
            : "Apple Health isn't available on this device (e.g. iPad). Use an iPhone with the Health app."}
        </Text>
      </Card>
    </Content>
  );
}
