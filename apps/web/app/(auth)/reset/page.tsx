"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

const formSchema = z.object({ email: z.string().email("Enter a valid email") });
type FormValues = z.infer<typeof formSchema>;

export default function ResetPage() {
  const [sent, setSent] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(formSchema) });

  async function onSubmit(values: FormValues) {
    setServerError(null);
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.resetPasswordForEmail(values.email, {
      redirectTo: `${window.location.origin}/signin`,
    });
    if (error) {
      setServerError(error.message);
      return;
    }
    setSent(true);
  }

  if (sent) {
    return (
      <div className="space-y-3">
        <h1 className="text-2xl font-semibold tracking-tight">Check your inbox</h1>
        <p className="text-sm text-[var(--color-muted-foreground)]">
          If that email exists, we sent a reset link.
        </p>
        <Link href="/signin" className="text-sm underline-offset-4 hover:underline">
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Reset your password</h1>
        <p className="text-sm text-[var(--color-muted-foreground)]">
          Enter your email and we&apos;ll send a reset link.
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
        {serverError && <p className="text-xs text-[var(--color-destructive)]">{serverError}</p>}
        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? "Sending…" : "Send reset link"}
        </Button>
      </form>

      <p className="text-center text-sm text-[var(--color-muted-foreground)]">
        Remembered it?{" "}
        <Link href="/signin" className="underline-offset-4 hover:underline">
          Sign in
        </Link>
      </p>
    </>
  );
}
