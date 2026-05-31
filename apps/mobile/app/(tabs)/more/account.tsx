import { useState } from "react";
import { useRouter } from "expo-router";
import { ActivityIndicator, Alert, Linking, Pressable, Text, View } from "react-native";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Content } from "@/components/ui/Content";
import { Input } from "@/components/ui/Input";
import { apiFetch } from "@/lib/api";
import { useSession } from "@/lib/session";
import { colors } from "@/lib/theme";

interface ExportResult {
  url: string;
  expiresAt: string;
}

export default function Account() {
  const router = useRouter();
  const { session, signOut } = useSession();
  const email = session?.user.email ?? "";

  const [exporting, setExporting] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);

  const canDelete = confirmText === "DELETE";

  async function onExport() {
    setExporting(true);
    try {
      const res = await apiFetch<ExportResult>("/api/me/export", { method: "POST", body: "{}" });
      Alert.alert(
        "Export ready",
        "We've emailed you the download link. You can also open it now.",
        [
          { text: "Later", style: "cancel" },
          { text: "Open", onPress: () => void Linking.openURL(res.url) },
        ],
      );
    } catch (err) {
      Alert.alert("Export failed", err instanceof Error ? err.message : "Please try again.");
    } finally {
      setExporting(false);
    }
  }

  async function onDelete() {
    if (!canDelete) return;
    setDeleting(true);
    try {
      await apiFetch("/api/me", { method: "DELETE" });
      await signOut();
      router.replace("/(auth)/sign-in");
    } catch (err) {
      Alert.alert("Couldn't delete", err instanceof Error ? err.message : "Please try again.");
      setDeleting(false);
    }
  }

  function confirmDelete() {
    Alert.alert(
      "Delete account?",
      "This permanently deletes your account and all your data. This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: () => void onDelete() },
      ],
    );
  }

  return (
    <Content className="gap-4">
      <Card className="gap-2">
        <Text className="text-sm font-semibold text-foreground">Account</Text>
        <View>
          <Text className="text-xs text-muted-foreground">Email</Text>
          <Text className="text-base font-medium text-foreground">{email}</Text>
        </View>
      </Card>

      <Card className="gap-3">
        <Text className="text-sm font-semibold text-foreground">Export your data</Text>
        <Text className="text-xs text-muted-foreground">
          Download a complete copy of everything you&apos;ve logged as a single
          JSON file. We&apos;ll also email you the download link.
        </Text>
        <Button
          title={exporting ? "Preparing…" : "Export my data"}
          onPress={onExport}
          loading={exporting}
        />
      </Card>

      <Card className="gap-3" style={{ borderColor: colors.destructive }}>
        <Text className="text-sm font-semibold" style={{ color: colors.destructive }}>
          Delete account
        </Text>
        <Text className="text-xs text-muted-foreground">
          This permanently deletes your account and all associated data —
          protocols, logs, photos, and AI conversations. This cannot be undone.
          Consider exporting your data first.
        </Text>
        <View className="gap-1">
          <Text className="text-xs font-medium text-foreground">Type DELETE to confirm</Text>
          <Input
            value={confirmText}
            onChangeText={setConfirmText}
            autoCapitalize="characters"
            autoCorrect={false}
            placeholder="DELETE"
          />
        </View>
        <Pressable
          onPress={confirmDelete}
          disabled={!canDelete || deleting}
          className="h-12 flex-row items-center justify-center rounded-xl"
          style={{
            backgroundColor: colors.destructive,
            opacity: !canDelete || deleting ? 0.4 : 1,
          }}
        >
          {deleting ? (
            <ActivityIndicator color={colors.destructiveForeground} />
          ) : (
            <Text className="text-base font-semibold" style={{ color: colors.destructiveForeground }}>
              Delete my account
            </Text>
          )}
        </Pressable>
      </Card>
    </Content>
  );
}
