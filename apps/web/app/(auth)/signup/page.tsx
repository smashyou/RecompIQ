"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

const formSchema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(8, "At least 8 characters"),
  consent: z.literal(true, {
    errorMap: () => ({ message: "You must acknowledge the educational disclaimer" }),
  }),
});
type FormValues = z.infer<typeof formSchema>;

export default function SignupPage() {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(formSchema) });

  async function onSubmit(values: FormValues) {
    setServerError(null);
    const supabase = createSupabaseBrowserClient();
    const { data, error } = await supabase.auth.signUp({
      email: values.email,
      password: values.password,
      options: {
        emailRedirectTo: `${window.location.origin}/dashboard`,
        data: { educational_consent_at: new Date().toISOString() },
      },
    });
    if (error) {
      setServerError(error.message);
      return;
    }
    // Record consent on the profile row (handle_new_user trigger created it).
    // If the user has an immediate session (email auto-confirm projects), we can
    // patch profiles directly. Otherwise the timestamp lives in user_metadata
    // and an admin process can sync it later, but for the typical sign-up-into-
    // unconfirmed-state we just store the metadata flag.
    if (data?.user && data?.session) {
      await supabase
        .from("profiles")
        .update({ educational_consent_at: new Date().toISOString() })
        .eq("user_id", data.user.id);
    }
    setSentTo(values.email);
    router.refresh();
  }

  if (sentTo) {
    return (
      <div className="space-y-3">
        <h1 className="text-2xl font-semibold tracking-tight">Check your inbox</h1>
        <p className="text-sm text-[var(--color-muted-foreground)]">
          We sent a confirmation link to <span className="font-medium">{sentTo}</span>.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Create your account</h1>
        <p className="text-sm text-[var(--color-muted-foreground)]">
          Educational research summary tool. Not medical advice.
        </p>
      </div>

      <form className="space-y-4" onSubmit={handleSubmit(onSubmit)} noValidate>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" autoComplete="email" {...register("email")} />
          {errors.email && (
            <p className="text-xs text-[var(--color-destructive)]">{errors.email.message}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            {...register("password")}
          />
          {errors.password && (
            <p className="text-xs text-[var(--color-destructive)]">{errors.password.message}</p>
          )}
        </div>

        <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-muted)] p-3">
          <input
            type="checkbox"
            className="mt-1"
            {...register("consent")}
          />
          <span className="text-xs leading-relaxed text-[var(--color-muted-foreground)]">
            I understand that RecompIQ is an{" "}
            <strong className="text-[var(--color-foreground)]">educational and research tool</strong>,
            not a medical service. The AI coach and compound catalog summarize published research
            and community practice — they do not prescribe doses or provide medical advice.
            I will discuss any protocol with a licensed clinician. I agree to the{" "}
            <a href="/legal/terms" target="_blank" className="underline">Terms of Use</a>,{" "}
            <a href="/legal/privacy" target="_blank" className="underline">Privacy Policy</a>,{" "}
            <a href="/legal/medical-disclaimer" target="_blank" className="underline">Medical Disclaimer</a>, and{" "}
            <a href="/legal/research-use" target="_blank" className="underline">Research-Use Statement</a>.
          </span>
        </label>
        {errors.consent && (
          <p className="text-xs text-[var(--color-destructive)]">{errors.consent.message}</p>
        )}

        {serverError && <p className="text-xs text-[var(--color-destructive)]">{serverError}</p>}
        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? "Creating…" : "Create account"}
        </Button>
      </form>

      <p className="text-center text-sm text-[var(--color-muted-foreground)]">
        Already have an account?{" "}
        <Link href="/signin" className="underline-offset-4 hover:underline">
          Sign in
        </Link>
      </p>
    </>
  );
}
