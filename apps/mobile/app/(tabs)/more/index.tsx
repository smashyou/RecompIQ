import { useEffect, useState } from "react";
import { useRouter } from "expo-router";
import { Text, View } from "react-native";
import { Button } from "@/components/ui/Button";
import { Content } from "@/components/ui/Content";
import { ListRow } from "@/components/ui/ListRow";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { Wordmark } from "@/components/ui/Wordmark";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/lib/session";

export default function More() {
  const router = useRouter();
  const { session, signOut } = useSession();
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    if (!session?.user.id) return;
    supabase
      .from("profiles")
      .select("is_admin")
      .eq("user_id", session.user.id)
      .maybeSingle()
      .then(({ data }) => setIsAdmin(Boolean(data?.is_admin)));
  }, [session?.user.id]);

  async function onSignOut() {
    await signOut();
    router.replace("/(auth)/sign-in");
  }

  return (
    <Content className="gap-2">
      <View className="mb-2 flex-row items-center justify-between">
        <Wordmark size={20} />
        <ThemeToggle compact />
      </View>
      <Text className="mb-1 text-sm font-semibold text-foreground">Tracking</Text>
      <ListRow title="Your Goals" subtitle="What we track, suggest & project" icon="flag-outline" onPress={() => router.push("/(tabs)/more/goals")} />
      <ListRow title="Food" subtitle="Meals, search, photo logging" icon="restaurant-outline" onPress={() => router.push("/(tabs)/more/food")} />
      <ListRow title="Workouts" subtitle="Sessions + templates" icon="barbell-outline" onPress={() => router.push("/(tabs)/more/workouts")} />
      <ListRow title="Body Shots" subtitle="Progress photos" icon="camera-outline" onPress={() => router.push("/(tabs)/more/body-shots")} />
      <ListRow title="Projections" subtitle="Weight trajectory" icon="trending-down-outline" onPress={() => router.push("/(tabs)/more/projections")} />
      <ListRow title="Watch & Scale Sync" subtitle="Apple Health / Health Connect" icon="watch-outline" onPress={() => router.push("/(tabs)/more/health")} />

      {isAdmin ? (
        <>
          <Text className="mb-1 mt-3 text-sm font-semibold text-foreground">Admin</Text>
          <ListRow title="Admin" subtitle="AI models + feature config" icon="settings-outline" onPress={() => router.push("/(tabs)/more/admin")} />
        </>
      ) : null}

      <Text className="mb-1 mt-3 text-sm font-semibold text-foreground">Settings</Text>
      <ListRow title="Notifications" subtitle="In-app, email, or both · reminder types" icon="notifications-outline" onPress={() => router.push("/(tabs)/more/notifications")} />
      <ListRow title="Account" subtitle="Export your data · delete account" icon="person-circle-outline" onPress={() => router.push("/(tabs)/more/account")} />

      <Text className="mb-1 mt-3 text-sm font-semibold text-foreground">About</Text>
      <ListRow title="Legal & Safety" subtitle="Disclaimer · Research-use · Terms · Privacy" icon="shield-checkmark-outline" onPress={() => router.push("/legal")} />

      <View className="mt-6">
        <Button title="Sign out" variant="outline" onPress={onSignOut} />
        {session?.user.email ? (
          <Text className="mt-2 text-center text-xs text-muted-foreground">{session.user.email}</Text>
        ) : null}
      </View>
    </Content>
  );
}
