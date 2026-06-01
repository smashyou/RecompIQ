import { useState } from "react";
import { useRouter } from "expo-router";
import { KeyboardAvoidingView, Platform, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { supabase } from "@/lib/supabase";
import { useResponsive } from "@/lib/responsive";

export default function Reset() {
  const router = useRouter();
  const { type } = useResponsive();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setError(null);
    setBusy(true);
    const { error: err } = await supabase.auth.resetPasswordForEmail(email.trim());
    setBusy(false);
    if (err) {
      setError(err.message);
      return;
    }
    setDone(true);
  }

  if (done) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-background px-6">
        <View style={{ width: "100%", maxWidth: 440, alignSelf: "center", alignItems: "center" }}>
          <Text className="font-semibold text-foreground" style={{ fontSize: type.xl }}>Check your inbox</Text>
          <Text className="mt-2 text-center text-sm text-muted-foreground">We sent a password-reset link to {email}.</Text>
          <Button title="Back to sign in" variant="outline" className="mt-6" onPress={() => router.replace("/(auth)/sign-in")} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} className="flex-1 justify-center px-6">
        <View style={{ width: "100%", maxWidth: 440, alignSelf: "center" }}>
        <Text className="font-bold text-foreground" style={{ fontSize: type["3xl"] }}>Reset password</Text>
        <Text className="mt-1 text-base text-muted-foreground">We'll email you a reset link.</Text>
        <View className="mt-8 gap-3">
          <View className="gap-1.5">
            <Text className="text-sm font-medium text-muted-foreground">Email</Text>
            <Input value={email} onChangeText={setEmail} placeholder="you@example.com" autoCapitalize="none" keyboardType="email-address" inputMode="email" />
          </View>
          {error ? <Text className="text-sm text-destructive">{error}</Text> : null}
          <Button title="Send reset link" onPress={submit} loading={busy} disabled={!email} className="mt-2" />
          <Pressable onPress={() => router.replace("/(auth)/sign-in")}><Text className="text-center text-sm text-primary">Back to sign in</Text></Pressable>
        </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
