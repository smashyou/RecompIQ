import { requireUser } from "@/lib/auth";
import { SectionHeader } from "@/components/kit";
import { AccountForm } from "./account-form";

export const dynamic = "force-dynamic";

export default async function AccountSettingsPage() {
  const user = await requireUser();

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-[18px]">
      <SectionHeader
        title="Account"
        note="Export a copy of your data, or permanently delete your account."
      />

      <AccountForm email={user.email ?? ""} />
    </div>
  );
}
