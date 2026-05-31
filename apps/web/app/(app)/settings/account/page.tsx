import { requireUser } from "@/lib/auth";
import { AccountForm } from "./account-form";

export const dynamic = "force-dynamic";

export default async function AccountSettingsPage() {
  const user = await requireUser();

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Account</h1>
        <p className="text-sm text-[var(--color-muted-foreground)]">
          Export a copy of your data, or permanently delete your account.
        </p>
      </header>

      <AccountForm email={user.email ?? ""} />
    </div>
  );
}
