"use client";

// RecompIQ branded splash / launch screen.
// Self-contained CSS/SVG animation ported from the design handoff
// (reference/brand-splash.html). Stays DARK regardless of the active theme
// (forced via color-scheme:dark + data-theme="dark" on the root element) so
// the brand mark always renders against the dark gradient void.
//
// The 18+ line + the verbatim compliance disclaimer are first-class footer
// content. Drop this in as a launch / loading screen.

export function BrandSplash() {
  return (
    <div className="ri-splash" data-theme="dark">
      <div className="ri-splash-center">
        <div className="ri-splash-markwrap">
          <span className="ri-splash-bloom" />
          <svg className="ri-splash-mark" viewBox="0 0 64 64" fill="none" aria-label="RecompIQ">
            <defs>
              <linearGradient
                id="riSplashPulse"
                x1="15"
                y1="35"
                x2="51"
                y2="21"
                gradientUnits="userSpaceOnUse"
              >
                <stop stopColor="#1FC2CE" />
                <stop offset="1" stopColor="#2FDB92" />
              </linearGradient>
            </defs>
            {/* molecular hexagon (peptide cell) */}
            <path
              className="ri-splash-draw ri-splash-hex"
              d="M32 10 L51 21 V43 L32 54 L13 43 V21 Z"
              pathLength={100}
              stroke="#3E939A"
              strokeWidth={2.6}
              strokeLinejoin="round"
            />
            {/* vital pulse resolving upward */}
            <path
              className="ri-splash-draw ri-splash-pulse"
              d="M15 35 H24 L27 35 L30 25 L33 43 L36 33 L40 33 L51 21"
              pathLength={100}
              stroke="url(#riSplashPulse)"
              strokeWidth={3.4}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {/* rising end node, seated on the vertex */}
            <circle className="ri-splash-node" cx={51} cy={21} r={3.6} fill="#2FDB92" />
          </svg>
        </div>

        <div className="ri-splash-wordmark">
          Recomp<span className="ri-splash-iq">IQ</span>
        </div>
        <div className="ri-splash-tagline">
          Evidence-graded tracking for body recomposition, metabolic health &amp; peptide research.
        </div>
        <div className="ri-splash-loader" aria-hidden="true" />
      </div>

      <div className="ri-splash-footer">
        <span className="ri-splash-gate">
          <span className="ri-splash-dot" />
          18+ · Educational &amp; research use only
        </span>
        <p className="ri-splash-disclaimer">
          <strong>For educational and research purposes only. Not medical advice.</strong>{" "}
          RecompIQ does not prescribe, sell, supply, or recommend any compound. Always consult a
          licensed clinician.
        </p>
      </div>

      <style jsx>{`
        .ri-splash {
          color-scheme: dark;
          position: fixed;
          inset: 0;
          z-index: 100;
          display: grid;
          place-items: center;
          overflow: hidden;
          text-align: center;
          color: var(--fg);
          font-family: var(--font-sans);
          background:
            radial-gradient(120% 80% at 50% -10%, oklch(0.26 0.05 195 / 0.45), transparent 60%),
            radial-gradient(90% 70% at 50% 110%, oklch(0.24 0.05 152 / 0.3), transparent 55%),
            var(--bg-deep);
        }
        /* faint molecular grid */
        .ri-splash::before {
          content: "";
          position: absolute;
          inset: 0;
          background-image:
            linear-gradient(oklch(0.3 0.012 240 / 0.22) 1px, transparent 1px),
            linear-gradient(90deg, oklch(0.3 0.012 240 / 0.22) 1px, transparent 1px);
          background-size: 44px 44px;
          -webkit-mask-image: radial-gradient(72% 56% at 50% 42%, #000 0%, transparent 76%);
          mask-image: radial-gradient(72% 56% at 50% 42%, #000 0%, transparent 76%);
          pointer-events: none;
          opacity: 0;
          animation: riGridFade 1.2s ease forwards;
        }
        @keyframes riGridFade {
          to {
            opacity: 1;
          }
        }

        .ri-splash-center {
          position: relative;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 30px;
          z-index: 1;
          margin-top: -40px;
        }

        /* mark tile */
        .ri-splash-markwrap {
          width: 116px;
          height: 116px;
          border-radius: 30px;
          background: linear-gradient(155deg, var(--surface-1), var(--bg-deep));
          border: 1px solid var(--border-strong);
          display: grid;
          place-items: center;
          position: relative;
          box-shadow: var(--shadow-lg);
          transform: scale(0.86);
          opacity: 0;
          animation: riTileIn 0.7s cubic-bezier(0.2, 0.8, 0.2, 1) 0.05s forwards;
        }
        @keyframes riTileIn {
          to {
            transform: scale(1);
            opacity: 1;
          }
        }
        .ri-splash-bloom {
          position: absolute;
          inset: 0;
          border-radius: 30px;
          pointer-events: none;
          box-shadow: 0 0 0 0 oklch(0.74 0.13 195 / 0);
          animation: riBloom 1.1s ease-out 1.2s forwards;
        }
        @keyframes riBloom {
          0% {
            box-shadow:
              0 0 0 0 oklch(0.78 0.15 175 / 0.55),
              0 0 0 1px var(--border-strong);
          }
          60% {
            box-shadow:
              0 0 50px 10px oklch(0.78 0.15 175 / 0),
              0 0 0 1px var(--primary-line);
          }
          100% {
            box-shadow:
              var(--shadow-lg),
              0 0 36px -6px oklch(0.74 0.13 195 / 0.4),
              0 0 0 1px var(--border-strong);
          }
        }

        /* SVG mark */
        .ri-splash-mark {
          width: 70px;
          height: 70px;
          overflow: visible;
        }
        .ri-splash-draw {
          stroke-dasharray: 100;
          stroke-dashoffset: 100;
        }
        .ri-splash-hex {
          animation: riDraw 0.75s cubic-bezier(0.5, 0, 0.2, 1) 0.28s forwards;
        }
        .ri-splash-pulse {
          animation: riDraw 0.85s cubic-bezier(0.45, 0, 0.25, 1) 0.62s forwards;
        }
        @keyframes riDraw {
          to {
            stroke-dashoffset: 0;
          }
        }
        .ri-splash-node {
          transform-origin: 51px 21px;
          transform: scale(0);
          animation:
            riNodePop 0.5s cubic-bezier(0.3, 1.4, 0.4, 1) 1.18s forwards,
            riNodePulse 2.6s ease-in-out 1.9s infinite;
        }
        @keyframes riNodePop {
          to {
            transform: scale(1);
          }
        }
        @keyframes riNodePulse {
          0%,
          100% {
            filter: drop-shadow(0 0 2px oklch(0.8 0.17 152 / 0.6));
          }
          50% {
            filter: drop-shadow(0 0 8px oklch(0.8 0.17 152 / 0.95));
          }
        }

        /* wordmark */
        .ri-splash-wordmark {
          font-family: var(--font-display);
          font-weight: 600;
          font-size: 42px;
          letter-spacing: -0.03em;
          line-height: 1;
          opacity: 0;
          transform: translateY(10px);
          animation: riRise 0.6s cubic-bezier(0.2, 0.8, 0.2, 1) 1.05s forwards;
        }
        .ri-splash-iq {
          color: var(--primary);
        }
        @keyframes riRise {
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .ri-splash-tagline {
          font-size: 15px;
          color: var(--fg-muted);
          letter-spacing: 0.01em;
          max-width: 290px;
          line-height: 1.5;
          opacity: 0;
          transform: translateY(8px);
          animation: riRise 0.6s cubic-bezier(0.2, 0.8, 0.2, 1) 1.25s forwards;
        }

        /* loader */
        .ri-splash-loader {
          width: 180px;
          height: 3px;
          border-radius: 999px;
          background: var(--surface-2);
          overflow: hidden;
          position: relative;
          opacity: 0;
          animation: riRise 0.5s ease 1.45s forwards;
        }
        .ri-splash-loader::after {
          content: "";
          position: absolute;
          left: 0;
          top: 0;
          height: 100%;
          width: 45%;
          border-radius: 999px;
          background: linear-gradient(90deg, var(--primary), var(--positive));
          animation: riSlide 1.6s cubic-bezier(0.4, 0, 0.2, 1) 1.6s infinite;
        }
        @keyframes riSlide {
          0% {
            transform: translateX(-110%);
          }
          60%,
          100% {
            transform: translateX(340%);
          }
        }

        /* compliance footer */
        .ri-splash-footer {
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          padding: 0 32px 40px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 14px;
          z-index: 1;
          opacity: 0;
          animation: riRise 0.6s ease 1.55s forwards;
        }
        .ri-splash-gate {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 7px 14px;
          border: 1px solid var(--primary-line);
          background: var(--primary-wash);
          border-radius: var(--r-pill);
          font: 600 11px/1 var(--font-sans);
          letter-spacing: 0.16em;
          text-transform: uppercase;
          color: var(--primary-bright);
        }
        .ri-splash-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: var(--primary);
          box-shadow: 0 0 8px var(--primary);
        }
        .ri-splash-disclaimer {
          font-size: 11.5px;
          line-height: 1.5;
          color: var(--fg-subtle);
          max-width: 340px;
          text-wrap: pretty;
        }
        .ri-splash-disclaimer strong {
          color: var(--fg-muted);
          font-weight: 600;
        }

        @media (prefers-reduced-motion: reduce) {
          .ri-splash *,
          .ri-splash::before {
            animation-duration: 0.001s !important;
            animation-delay: 0s !important;
          }
        }
      `}</style>
    </div>
  );
}
