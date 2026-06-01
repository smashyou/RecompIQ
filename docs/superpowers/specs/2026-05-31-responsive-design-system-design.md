# Responsive Design System — Design Spec

> Status: DRAFT for review (2026-05-31). No implementation until approved.
> Goal: replace ad-hoc, desktop-density styling with a shared, fluid, responsive
> design system so **web (desktop + mobile)** and **RN mobile** are consistent and
> responsive, and **new features inherit responsiveness automatically**.

## 1. Problem

Styling is hardcoded per element across ~40 web screens and ~30 RN screens:
fixed `text-[13px]` / `px-6` / `gap-[14px]`, inline-`px` kit primitives, no shared
type/space scale, no enforced page scaffold. Symptoms observed:

- **Mobile web** renders desktop-density type/spacing → tiny, cramped (dashboard).
- **Onboarding modal** not horizontally centered (web desktop).
- **Landing header** overflowed/clipped the wordmark on phones (patched).
- **Coach** chat panel forced horizontal overflow via fixed `min-w` (patched).
- **RN dashboard** 2×2 stat grid has **unequal-height cards** per row (Vitals vs
  Protein donut), looking ragged.

Each was a one-off. Root cause: no shared, enforced system. Fix the system.

## 2. Goals / non-goals

**Goals**
- One fluid type + spacing + container scale, shared conceptually across web + RN.
- Layout primitives that make a screen responsive *by construction* (wrap content,
  collapse grids, equal-height cards) with zero per-screen breakpoint bookkeeping.
- Migrate **every** web + RN screen onto the primitives (decided: full migration).
- Keep the dense "instrument" aesthetic; make it *adapt*, not become spacious.

**Non-goals**
- No brand/visual redesign (colors, logo, evidence system unchanged).
- No new product features. No router/data changes.
- Not changing the token *palette* (oklch color tokens stay).

## 3. Mechanism (decided)

- **Web:** fluid sizing via CSS `clamp()` tokens registered in Tailwind v4 `@theme`
  so they're first-class utilities (`text-data`, `p-page`, `gap-grid`). Type and
  key spacing scale smoothly phone→desktop; few/no per-element breakpoints.
- **RN:** no `clamp()`. A `useResponsive()` hook off `useWindowDimensions()` plus a
  mobile-first type/space scale that bumps at a tablet breakpoint. Same scale names
  and intent as web for parity.

## 4. Web design

### 4.1 Scale tokens (`app/recompiq-tokens.css` + `@theme` in `globals.css`)
Fluid type scale (illustrative; tuned during build):
```
--text-2xs:  clamp(0.625rem, 0.6rem + 0.15vw, 0.6875rem);
--text-xs:   clamp(0.6875rem,0.66rem + 0.18vw,0.75rem);
--text-sm:   clamp(0.8125rem,0.78rem + 0.2vw, 0.875rem);
--text-base: clamp(0.875rem, 0.84rem + 0.3vw, 1rem);
--text-lg:   clamp(1rem,     0.95rem + 0.4vw, 1.125rem);
--text-xl:   clamp(1.125rem, 1.05rem + 0.6vw, 1.375rem);
--text-2xl:  clamp(1.375rem, 1.2rem + 1vw,    1.75rem);
--text-3xl:  clamp(1.75rem,  1.4rem + 2vw,    2.5rem);
--text-stat: clamp(1.5rem,   1.2rem + 2.4vw,  2.25rem);
--text-display: clamp(2.25rem, 1.6rem + 4vw,  3.75rem);
```
Spacing tokens:
```
--spacing-page:   clamp(1rem, 4vw, 2rem);     /* page horizontal padding */
--spacing-pagey:  clamp(1rem, 3vw, 1.5rem);   /* page vertical padding */
--spacing-grid:   clamp(0.75rem, 2vw, 1.125rem); /* card-grid gap */
--spacing-card:   clamp(0.875rem, 2.5vw, 1.25rem); /* card inner padding */
--container:        1120px;
--container-narrow: 560px;
```
These are registered as Tailwind utilities: `text-2xs…text-display`, `p-page`,
`px-page`, `py-pagey`, `gap-grid`, `p-card`, `max-w-container`, `max-w-narrow`.

### 4.2 Layout primitives (`components/ui/layout.tsx`)
- **`<Page width="default|narrow">`** — `mx-auto w-full max-w-container px-page py-pagey`
  (narrow = `max-w-narrow`). Wraps every screen's content. Removes per-page
  `mx-auto max-w-[…]`.
- **`<PageHeader title subtitle action>`** — `text-2xl/3xl` fluid title; `action`
  slot wraps below the title on mobile (`flex-col sm:flex-row`).
- **`<AutoGrid min="240px">`** — `grid gap-grid` with
  `grid-template-columns: repeat(auto-fit, minmax(min(<min>,100%), 1fr))`. Collapses
  to one column on narrow screens with no breakpoints. **Items stretch to equal
  height** (`align-items: stretch`, default) — fixes ragged rows.
- **`<Stack gap>` / `<Cluster gap wrap>`** — vertical / horizontal flow helpers on
  the space scale.

### 4.3 Rebuild `kit.tsx` on tokens
`Card`/`Stat`/`SectionHeader`/`Overline`/`Chip`/`MetricBox` switch their inline `px`
font-size/padding to the fluid utilities/tokens. `Card` defaults to `h-full` so it
fills its grid cell (equal-height rows). Public props unchanged → drop-in.

### 4.4 Bug fixes folded in
- Onboarding: center the flow/consent card — the onboarding layout wraps children
  in a centered `<Page width="narrow">` (`flex justify-center` + `max-w-narrow`).
- Modals/overlays audited for `fixed inset-0 grid place-items-center`.

## 5. RN design

### 5.1 Scale (`lib/responsive.ts` + `lib/theme.ts`)
- `useResponsive()` → `{ width, isTablet, type, space }` where `type`/`space` are
  scale objects (e.g. `type.sm`, `type.title`, `space.page`, `space.grid`).
  Mobile-first values; `isTablet` (≥ ~700pt) bumps a step.
- Scale names mirror web (`2xs…display`, `page/grid/card`).

### 5.2 Primitives
- `Screen` / `Content` standardize page padding to `space.page`.
- `Card` defaults to a consistent inner padding +, in a row, equal height.
- **`Row`/`Grid`** helper for the 2×2 stat layout: two equal-width, **equal-height**
  cards per row (`flexDirection:row`, children `flex:1`, `alignItems:stretch`),
  wrapping to one column on small widths. Fixes the Vitals/Protein ragged grid.
- A `Txt` typography helper (or size constants) reading the type scale.

## 6. Migration (full — phased)

1. **Foundation:** web tokens + `@theme` utilities + `layout.tsx` + `kit.tsx`
   rebuild; RN `responsive.ts` + theme scale + primitive updates. Prove on the
   dashboard (web + RN) + onboarding. Fix the known bugs.
2. **Web migration:** every web screen → `<Page>`+`<PageHeader>`+`<AutoGrid>`+fluid
   type. Grouped by area (dashboard, log, food, peptides suite, workouts,
   projections, labs, coach, settings, admin, marketing, auth, onboarding).
3. **RN migration:** every RN screen → standardized `Screen/Content/Card/Grid/Txt`.
4. **Sweep + verify:** per-screen visual pass at 320 / 390 / 768 / 1280 widths
   (web) and phone/tablet (RN); fix stragglers.

Each phase: `pnpm turbo run typecheck` (16/16) + `expo export` clean + visual check;
commit per area; push; update SESSION-STATE.

## 7. Risks

- **Churn/regressions** across ~70 screens. Mitigation: keep primitive public APIs
  stable; migrate area-by-area with typecheck + visual checks; small commits.
- **Local web build broken** on this machine — gate on typecheck + Vercel deploy +
  visual checks, per existing convention.
- **Token tuning** (fluid ranges) needs visual iteration to keep the instrument feel.

## 8. Success criteria

- No horizontal overflow / zoom-out at 320px web; type legible on mobile, scales up
  on desktop.
- Cards in a row are equal height (web + RN).
- Onboarding modal centered.
- New screens built from `<Page>/<PageHeader>/<AutoGrid>/Card` are responsive with
  no extra breakpoint work.
