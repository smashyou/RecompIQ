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
    const { error } = await supabase.auth.signUp({
      email: values.email,
      password: values.password,
      options: { emailRedirectTo: `${window.location.origin}/dashboard` },
    });
    if (error) {
      setServerError(error.message);
      return;
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
          Educational tracking. Not medical advice.
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
