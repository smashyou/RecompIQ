import { requireUser } from "@/lib/auth";
import { SectionHeader } from "@/components/kit";
import { Stack } from "@/components/ui/layout";
import { AccountForm } from "./account-form";

export const dynamic = "force-dynamic";

export default async function AccountSettingsPage() {
  const user = await requireUser();

  return (
    <Stack gap="18px" className="w-full">
      <SectionHeader
        title="Account"
        note="Export a copy of your data, or permanently delete your account."
      />

      <AccountForm email={user.email ?? ""} />
    </Stack>
  );
}
