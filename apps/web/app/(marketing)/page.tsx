import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { Wordmark } from "@/components/wordmark";

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between px-6 py-4">
        <Link href="/" aria-label="RecompIQ home">
          <Wordmark size={22} />
        </Link>
        <nav className="flex items-center gap-2">
          <ThemeToggle compact />
          <Button asChild variant="ghost" size="sm">
            <Link href="/signin">Sign in</Link>
          </Button>
          <Button asChild size="sm">
            <Link href="/signup">Get started</Link>
          </Button>
        </nav>
      </header>

      <main className="flex flex-1 flex-col items-center justify-center px-6 py-20 text-center">
        <p className="mb-4 text-xs uppercase tracking-[0.2em] text-[var(--color-muted-foreground)]">
          Educational tracking. Not medical advice.
        </p>
        <h1 className="max-w-3xl text-4xl font-semibold tracking-tight md:text-6xl">
          A coach for your body recomposition data.
        </h1>
        <p className="mt-6 max-w-xl text-base text-[var(--color-muted-foreground)] md:text-lg">
          Track peptide protocols, nutrition, biomarkers, and workouts. Get evidence-graded
          insights. Have sharper conversations with your clinician.
        </p>
        <div className="mt-10 flex gap-3">
          <Button asChild size="lg">
            <Link href="/signup">Create account</Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link href="/signin">Sign in</Link>
          </Button>
        </div>
      </main>

      <footer className="space-y-2 border-t border-[var(--color-border)] px-6 py-6 text-center text-xs text-[var(--color-muted-foreground)]">
        <nav className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
          <a href="/legal/medical-disclaimer" className="hover:text-[var(--color-foreground)]">Medical Disclaimer</a>
          <a href="/legal/research-use" className="hover:text-[var(--color-foreground)]">Research-Use</a>
          <a href="/legal/terms" className="hover:text-[var(--color-foreground)]">Terms</a>
          <a href="/legal/privacy" className="hover:text-[var(--color-foreground)]">Privacy</a>
        </nav>
        <p>© {new Date().getFullYear()} RecompIQ · Educational &amp; research tracking only. Not a substitute for medical care.</p>
      </footer>
    </div>
  );
}
