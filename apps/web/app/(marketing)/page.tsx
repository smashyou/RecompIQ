import Link from "next/link";
import { ArrowRight, LineChart, Syringe, ShieldCheck, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { Wordmark } from "@/components/wordmark";

const FEATURES: { Icon: LucideIcon; title: string; desc: string }[] = [
  {
    Icon: LineChart,
    title: "Weight projection",
    desc: "Conservative, target & aggressive lines with an ETA band — never a promise.",
  },
  {
    Icon: Syringe,
    title: "Protocol tracking",
    desc: "Log what you take. Every compound carries an evidence grade and contraindication check.",
  },
  {
    Icon: ShieldCheck,
    title: "Non-prescribing by design",
    desc: "The coach educates, tracks, and warns. It never prescribes a dose.",
  },
];

const LEGAL_LINKS: { label: string; href: string }[] = [
  { label: "Terms of Use", href: "/legal/terms" },
  { label: "Privacy Policy", href: "/legal/privacy" },
  { label: "Medical Disclaimer", href: "/legal/medical-disclaimer" },
  { label: "Research-Use Statement", href: "/legal/research-use" },
];

export default function LandingPage() {
  return (
    <div
      className="relative flex min-h-screen flex-col overflow-hidden"
      style={{ background: "var(--bg-deep)" }}
    >
      {/* ambient glow */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(90% 50% at 50% -10%, oklch(0.26 0.05 195 / 0.35), transparent 60%), radial-gradient(70% 40% at 80% 110%, oklch(0.24 0.05 152 / 0.22), transparent 55%)",
        }}
      />

      <header className="relative z-10 flex items-center justify-between gap-2 px-5 py-5 sm:px-10">
        <Link href="/" aria-label="RecompIQ home" className="min-w-0 shrink">
          <Wordmark size={20} />
        </Link>
        <div className="flex shrink-0 items-center gap-2 sm:gap-2.5">
          <ThemeToggle compact />
          <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
            <Link href="/signin">Sign in</Link>
          </Button>
          <Button asChild size="sm">
            <Link href="/signup">Get started</Link>
          </Button>
        </div>
      </header>

      <main className="relative z-10 flex flex-1 flex-col items-center justify-center px-6 pb-16 pt-10 text-center">
        <span
          className="mb-7 inline-flex max-w-full items-center gap-2 rounded-[var(--r-pill)] border px-[13px] py-1.5"
          style={{
            borderColor: "var(--primary-line)",
            background: "var(--primary-wash)",
          }}
        >
          <span
            className="h-1.5 w-1.5 rounded-full"
            style={{ background: "var(--primary)", boxShadow: "0 0 8px var(--primary)" }}
          />
          <span
            className="text-2xs font-semibold uppercase"
            style={{ color: "var(--primary-bright)", letterSpacing: "0.14em" }}
          >
            Educational tracking · Not medical advice
          </span>
        </span>

        <h1
          className="font-[family-name:var(--font-display)] text-display font-semibold leading-[1.02] tracking-[-0.025em]"
          style={{ color: "var(--fg)", maxWidth: "min(880px, 100%)", textWrap: "balance" }}
        >
          A coach for your body recomposition <span style={{ color: "var(--primary)" }}>data.</span>
        </h1>

        <p
          className="mt-6 font-[family-name:var(--font-sans)] text-lg leading-[1.55]"
          style={{ color: "var(--fg-muted)", maxWidth: "min(560px, 100%)" }}
        >
          Track peptide protocols, nutrition, biomarkers, and workouts. Get evidence-graded
          insights. Have sharper conversations with your clinician.
        </p>

        <div className="mt-9 flex flex-wrap justify-center gap-3">
          <Button asChild size="lg">
            <Link href="/signup">
              Create account
              <ArrowRight size={17} />
            </Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link href="/signin">See the demo</Link>
          </Button>
        </div>

        <div className="mt-16 flex w-full max-w-[940px] flex-wrap justify-center gap-3.5">
          {FEATURES.map(({ Icon, title, desc }) => (
            <div
              key={title}
              className="flex-[1_1_260px] rounded-[var(--r-lg)] border p-[22px] text-left"
              style={{
                background: "var(--surface-1)",
                borderColor: "var(--border)",
              }}
            >
              <span
                className="grid h-9 w-9 place-items-center rounded-[var(--r-md)] border"
                style={{
                  background: "var(--primary-wash)",
                  borderColor: "var(--primary-line)",
                  color: "var(--primary)",
                }}
              >
                <Icon size={18} />
              </span>
              <h3
                className="mt-3.5 font-[family-name:var(--font-sans)] text-base font-semibold"
                style={{ color: "var(--fg)" }}
              >
                {title}
              </h3>
              <p
                className="mt-1.5 font-[family-name:var(--font-sans)] text-sm leading-[1.5]"
                style={{ color: "var(--fg-subtle)" }}
              >
                {desc}
              </p>
            </div>
          ))}
        </div>
      </main>

      <footer
        className="relative z-10 flex flex-wrap items-center justify-between gap-3 border-t px-5 py-5 sm:px-10"
        style={{ borderColor: "var(--border)" }}
      >
        <span
          className="font-[family-name:var(--font-sans)] text-xs"
          style={{ color: "var(--fg-subtle)" }}
        >
          © {new Date().getFullYear()} RecompIQ · Not a substitute for medical care
        </span>
        <div className="flex gap-[18px]">
          {LEGAL_LINKS.map(({ label, href }) => (
            <Link
              key={href}
              href={href}
              className="font-[family-name:var(--font-sans)] text-xs transition-colors hover:text-[var(--fg)]"
              style={{ color: "var(--fg-muted)" }}
            >
              {label}
            </Link>
          ))}
        </div>
      </footer>
    </div>
  );
}
