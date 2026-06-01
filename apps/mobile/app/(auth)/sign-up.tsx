import { useState } from "react";
import { useRouter } from "expo-router";
import { KeyboardAvoidingView, Platform, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { supabase } from "@/lib/supabase";
import { colors } from "@/lib/theme";
import { useResponsive } from "@/lib/responsive";

export default function SignUp() {
  const router = useRouter();
  const { type } = useResponsive();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setError(null);
    if (!consent) {
      setError("Please acknowledge the educational-use statement.");
      return;
    }
    setBusy(true);
    const { data, error: err } = await supabase.auth.signUp({ email: email.trim(), password });
    setBusy(false);
    if (err) {
      setError(err.message);
      return;
    }
    // Record consent if we already have a session (email confirmation disabled).
    if (data.session && data.user) {
      await supabase.from("profiles").update({ educational_consent_at: new Date().toISOString() }).eq("user_id", data.user.id);
      router.replace("/");
      return;
    }
    setDone(true);
  }

  if (done) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-background px-6">
        <View style={{ width: "100%", maxWidth: 440, alignSelf: "center", alignItems: "center" }}>
          <Text className="font-semibold text-foreground" style={{ fontSize: type.xl }}>Check your inbox</Text>
          <Text className="mt-2 text-center text-sm text-muted-foreground">Confirm your email, then sign in to finish setting up your profile.</Text>
          <Button title="Back to sign in" variant="outline" className="mt-6" onPress={() => router.replace("/(auth)/sign-in")} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} className="flex-1 justify-center px-6">
        <View style={{ width: "100%", maxWidth: 440, alignSelf: "center" }}>
        <Text className="font-bold text-foreground" style={{ fontSize: type["3xl"] }}>Create account</Text>
        <Text className="mt-1 text-base text-muted-foreground">Start tracking your recomposition.</Text>

        <View className="mt-8 gap-3">
          <View className="gap-1.5">
            <Text className="text-sm font-medium text-muted-foreground">Email</Text>
            <Input value={email} onChangeText={setEmail} placeholder="you@example.com" autoCapitalize="none" keyboardType="email-address" inputMode="email" />
          </View>
          <View className="gap-1.5">
            <Text className="text-sm font-medium text-muted-foreground">Password</Text>
            <Input value={password} onChangeText={setPassword} placeholder="At least 8 characters" secureTextEntry autoCapitalize="none" />
          </View>

          <Pressable onPress={() => setConsent((c) => !c)} className="mt-1 flex-row gap-3">
            <Ionicons name={consent ? "checkbox" : "square-outline"} size={22} color={consent ? colors.primary : colors.mutedForeground} />
            <Text className="flex-1 text-xs leading-relaxed text-muted-foreground">
              I understand RecompIQ is an <Text className="text-foreground">educational research and tracking tool</Text>, not medical advice, and does not prescribe doses. I'll discuss any protocol with a licensed clinician.
            </Text>
          </Pressable>

          <Pressable onPress={() => router.push("/legal")}>
            <Text className="text-xs text-primary">Terms · Privacy · Medical Disclaimer · Research-Use Statement</Text>
          </Pressable>

          {error ? <Text className="text-sm text-destructive">{error}</Text> : null}

          <Button title="Create account" onPress={submit} loading={busy} disabled={!email || !password} className="mt-2" />
          <Pressable onPress={() => router.replace("/(auth)/sign-in")}><Text className="text-center text-sm text-primary">Already have an account? Sign in</Text></Pressable>
        </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
