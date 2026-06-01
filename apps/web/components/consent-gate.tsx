"use client";

import { useState, type ReactNode } from "react";
import { Check, Shield, ArrowRight } from "lucide-react";

// RecompIQ Consent + 18+ Age Gate.
// The required gate the user must clear before entering the app. Ported
// faithfully from the design handoff (reference/web/ConsentGate.jsx) onto the
// RecompIQ design tokens. Three acknowledgements + an 18+ confirm; "Agree &
// continue" stays disabled until ALL four are checked. Checkbox rows turn
// primary-wash when checked.

const CONSENTS: { id: string; text: ReactNode }[] = [
  {
    id: "edu",
    text: (
      <>
        I understand RecompIQ is for <b>educational and research purposes only</b>, is{" "}
        <b>not medical advice</b>, and does not prescribe, diagnose, or treat.
      </>
    ),
  },
  {
    id: "research",
    text: (
      <>
        I understand many referenced compounds are{" "}
        <b>research chemicals not approved for human consumption</b>, and nothing here endorses
        purchasing, possessing, or administering any substance.
      </>
    ),
  },
  {
    id: "law",
    text: (
      <>
        I am <b>solely responsible</b> for complying with the laws of my jurisdiction, and will
        discuss any protocol with a <b>licensed clinician</b>.
      </>
    ),
  },
];

function Overline({ children, style }: { children: ReactNode; style?: React.CSSProperties }) {
  return (
    <span
      style={{
        fontFamily: "var(--font-sans)",
        fontSize: "var(--t-overline-size)",
        lineHeight: "var(--t-overline-lh)",
        letterSpacing: "var(--t-overline-ls)",
        fontWeight: 600,
        textTransform: "uppercase",
        color: "var(--fg-subtle)",
        ...style,
      }}
    >
      {children}
    </span>
  );
}

function ConsentRow({
  checked,
  onClick,
  children,
}: {
  checked: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={checked}
      style={{
        display: "flex",
        gap: 12,
        alignItems: "flex-start",
        textAlign: "left",
        width: "100%",
        padding: 14,
        borderRadius: "var(--r-md)",
        cursor: "pointer",
        background: checked ? "var(--primary-wash)" : "var(--surface-2)",
        border: `1px solid ${checked ? "var(--primary-line)" : "var(--border)"}`,
        transition: "background .12s, border .12s",
      }}
    >
      <span
        style={{
          flex: "none",
          width: 22,
          height: 22,
          borderRadius: 6,
          marginTop: 1,
          display: "grid",
          placeItems: "center",
          background: checked ? "var(--primary)" : "transparent",
          border: `1.5px solid ${checked ? "var(--primary)" : "var(--border-strong)"}`,
          color: "var(--primary-foreground)",
        }}
      >
        {checked && <Check size={14} strokeWidth={2.4} />}
      </span>
      <span
        style={{
          fontFamily: "var(--font-sans)",
          fontSize: 13.5,
          lineHeight: 1.5,
          color: "var(--fg)",
        }}
      >
        {children}
      </span>
    </button>
  );
}

export function ConsentGate({
  onEnter,
  onBack,
  submitting = false,
  error = null,
}: {
  onEnter: () => void;
  onBack?: () => void;
  submitting?: boolean;
  error?: string | null;
}) {
  const [checks, setChecks] = useState<Record<string, boolean>>({});
  const [age, setAge] = useState(false);
  const all = age && CONSENTS.every((c) => checks[c.id]);
  const toggle = (id: string) => setChecks((s) => ({ ...s, [id]: !s[id] }));
  const ready = all && !submitting;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 50,
        display: "grid",
        placeItems: "center",
        padding: "clamp(1rem, 4vw, 2rem)",
        background: "var(--bg-deep)",
        overflowY: "auto",
      }}
    >
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          background:
            "radial-gradient(80% 50% at 50% -5%, oklch(0.26 0.05 195 / 0.28), transparent 60%)",
        }}
      />
      <div
        style={{
          width: 540,
          maxWidth: "100%",
          background: "var(--surface-1)",
          border: "1px solid var(--border)",
          borderRadius: "var(--r-xl)",
          padding: 32,
          boxShadow: "var(--shadow-lg)",
          position: "relative",
          zIndex: 1,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span
            style={{
              width: 44,
              height: 44,
              borderRadius: "var(--r-md)",
              background: "var(--surface-2)",
              border: "1px solid var(--primary-line)",
              display: "grid",
              placeItems: "center",
              color: "var(--primary)",
            }}
          >
            <Shield size={22} />
          </span>
          <div>
            <Overline style={{ color: "var(--primary)" }}>Before you enter</Overline>
            <h1
              style={{
                fontFamily: "var(--font-display)",
                fontWeight: 600,
                fontSize: 24,
                letterSpacing: "-0.02em",
                color: "var(--fg)",
                marginTop: 4,
              }}
            >
              Acknowledge &amp; consent
            </h1>
          </div>
        </div>

        <p
          style={{
            fontFamily: "var(--font-sans)",
            fontSize: 13.5,
            lineHeight: 1.55,
            color: "var(--fg-muted)",
            margin: "16px 0 20px",
            textWrap: "pretty",
          }}
        >
          RecompIQ is an information and tracking tool. To continue, confirm you understand its
          scope. You can review the full{" "}
          <a href="/legal/medical-disclaimer" style={{ color: "var(--primary)" }}>
            Medical Disclaimer
          </a>{" "}
          and{" "}
          <a href="/legal/research-use" style={{ color: "var(--primary)" }}>
            Research-Use Statement
          </a>{" "}
          any time in Legal &amp; Safety.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {CONSENTS.map((c) => (
            <ConsentRow key={c.id} checked={!!checks[c.id]} onClick={() => toggle(c.id)}>
              {c.text}
            </ConsentRow>
          ))}
          <ConsentRow checked={age} onClick={() => setAge((a) => !a)}>
            I confirm I am <b>18 years of age or older</b>.
          </ConsentRow>
        </div>

        {error && (
          <p
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: 12.5,
              lineHeight: 1.5,
              color: "var(--danger)",
              marginTop: 14,
            }}
          >
            {error}
          </p>
        )}

        <div style={{ display: "flex", gap: 12, marginTop: 24 }}>
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              style={{
                fontFamily: "var(--font-sans)",
                fontSize: 14,
                fontWeight: 500,
                padding: "0 18px",
                height: 44,
                borderRadius: "var(--r-md)",
                background: "transparent",
                border: "1px solid var(--border)",
                color: "var(--fg-muted)",
                cursor: "pointer",
              }}
            >
              Back
            </button>
          )}
          <button
            type="button"
            onClick={() => ready && onEnter()}
            aria-disabled={!ready}
            style={{
              flex: 1,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              fontFamily: "var(--font-sans)",
              fontSize: 14,
              fontWeight: 600,
              height: 44,
              borderRadius: "var(--r-md)",
              background: "var(--primary)",
              border: "1px solid var(--primary)",
              color: "var(--primary-foreground)",
              cursor: ready ? "pointer" : "default",
              opacity: ready ? 1 : 0.4,
              pointerEvents: ready ? "auto" : "none",
              transition: "opacity .12s",
            }}
          >
            {submitting ? "Saving…" : "Agree & continue"}
            <ArrowRight size={16} />
          </button>
        </div>

        <p
          style={{
            fontFamily: "var(--font-sans)",
            fontSize: 11,
            lineHeight: 1.5,
            color: "var(--fg-faint)",
            marginTop: 16,
            textAlign: "center",
          }}
        >
          By continuing you accept the{" "}
          <a href="/legal/terms" style={{ color: "inherit", textDecoration: "underline" }}>
            Terms of Use
          </a>{" "}
          and{" "}
          <a href="/legal/privacy" style={{ color: "inherit", textDecoration: "underline" }}>
            Privacy Policy
          </a>
          .
        </p>
      </div>
    </div>
  );
}
