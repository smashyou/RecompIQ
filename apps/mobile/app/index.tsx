import { useEffect, useState } from "react";
import { Redirect } from "expo-router";
import { ActivityIndicator, View } from "react-native";
import { useSession } from "@/lib/session";
import { supabase } from "@/lib/supabase";
import { colors } from "@/lib/theme";

// Entry gate: wait for the persisted session, then route to onboarding (if not
// completed), the tabs, or sign-in.
export default function Index() {
  const { session, loading } = useSession();
  const [onboarded, setOnboarded] = useState<boolean | null>(null);

  useEffect(() => {
    if (!session) {
      setOnboarded(null);
      return;
    }
    let active = true;
    supabase
      .from("profiles")
      .select("onboarding_done")
      .eq("user_id", session.user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (active) setOnboarded(Boolean(data?.onboarding_done));
      });
    return () => {
      active = false;
    };
  }, [session]);

  if (loading || (session && onboarded === null)) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!session) return <Redirect href="/(auth)/sign-in" />;
  return <Redirect href={onboarded ? "/(tabs)" : "/(onboarding)/onboarding"} />;
}
