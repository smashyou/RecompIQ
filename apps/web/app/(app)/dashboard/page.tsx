import { requireUser } from "@/lib/auth";

export default async function DashboardPage() {
  const user = await requireUser();
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Welcome back</h1>
        <p className="text-sm text-[var(--color-muted-foreground)]">
          Signed in as {user.email}. Dashboard cards arrive in Phase 2.
        </p>
      </div>
      <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {[
          "Weight",
          "Projection",
          "Today's macros",
          "Vitals",
          "Peptide adherence",
          "Symptoms",
          "AI insight",
          "Safety alerts",
          "Today's workout",
        ].map((title) => (
          <div
            key={title}
            className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-5"
          >
            <p className="text-sm font-medium">{title}</p>
            <p className="mt-2 text-xs text-[var(--color-muted-foreground)]">
              No data yet — empty state.
            </p>
          </div>
        ))}
      </section>
    </div>
  );
}
