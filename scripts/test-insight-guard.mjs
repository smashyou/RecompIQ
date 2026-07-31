#!/usr/bin/env node
// Test harness for the daily-insight safety guard. Runs via `pnpm test:insight-guard`.
import assert from "node:assert/strict";
import {
  checkInsight,
  findStatedDoses,
  findUnknownCompounds,
  INSIGHT_LIMITS,
} from "../packages/peptides/src/insights.ts";

let passed = 0,
  failed = 0;
function it(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (e) {
    console.log(`  ✗ ${name}\n     ${e.message}`);
    failed++;
  }
}

// John's real situation: on retatrutide + BPC-157, has never logged ipamorelin.
const CTX = {
  knownCompounds: ["retatrutide", "BPC-157"],
  catalogCompounds: ["retatrutide", "BPC-157", "ipamorelin", "tesamorelin", "GHK-Cu", "semaglutide"],
};

const ok = (over = {}) => ({
  headline: "Weight is tracking down steadily",
  body: "You have lost weight in each of the last three weeks and protein has been at target on five of seven days.",
  observations: [{ signal: "weight", detail: "down three weeks running" }],
  clinicianPrompt: null,
  ...over,
});

const rules = (r) => r.violations.map((v) => v.rule);

// ---- baseline ----

it("a clean observational insight passes", () => {
  const r = checkInsight(ok(), CTX);
  assert.equal(r.ok, true, JSON.stringify(r.violations));
});

it("an empty headline or body is rejected", () => {
  assert.ok(rules(checkInsight(ok({ headline: "" }), CTX)).includes("empty"));
  assert.ok(rules(checkInsight(ok({ body: "  " }), CTX)).includes("empty"));
});

// ---- rule: dose_stated ----

it("rejects a stated dose anywhere in the draft", () => {
  assert.ok(rules(checkInsight(ok({ body: "Your 4 mg weekly is working." }), CTX)).includes("dose_stated"));
  assert.ok(rules(checkInsight(ok({ headline: "Consider 250 mcg" }), CTX)).includes("dose_stated"));
});

it("rejects a dose hidden in an observation detail", () => {
  const draft = ok({ observations: [{ signal: "dose", detail: "20 units on Tuesday" }] });
  assert.ok(rules(checkInsight(draft, CTX)).includes("dose_stated"));
});

it("rejects a dose RANGE, the literature format", () => {
  assert.deepEqual(findStatedDoses("typical is 2–4 mg weekly"), ["2–4 mg"]);
  assert.deepEqual(findStatedDoses("0.5-1 mg to start"), ["0.5-1 mg"]);
});

it("ALLOWS a lab concentration — reporting the user's own numbers is the product", () => {
  assert.deepEqual(findStatedDoses("hs-CRP came in at 2.4 mg/L"), []);
  assert.deepEqual(findStatedDoses("fasting glucose 124 mg/dL"), []);
  const r = checkInsight(
    ok({
      body: "Fasting glucose read 124 mg/dL this week, up from 108 mg/dL.",
      clinicianPrompt: "Worth mentioning the glucose trend at your next visit.",
    }),
    CTX,
  );
  assert.equal(r.ok, true, JSON.stringify(r.violations));
});

it("still catches a dose frequency — /day must not be mistaken for /dL", () => {
  assert.deepEqual(findStatedDoses("300 mcg/day"), ["300 mcg"]);
  assert.deepEqual(findStatedDoses("2 mg/wk"), ["2 mg"]);
});

it("does not fire on non-dose units the app uses constantly", () => {
  assert.deepEqual(findStatedDoses("you are 15 lb from target on 2100 kcal and 180 g protein"), []);
});

// ---- rule: unknown_compound ----

it("rejects a compound the user has never logged", () => {
  const r = checkInsight(ok({ body: "Ipamorelin may help with recovery." }), CTX);
  assert.ok(rules(r).includes("unknown_compound"));
});

it("allows the user's OWN compounds by name", () => {
  const r = checkInsight(ok({ body: "Your retatrutide adherence held at every scheduled dose." }), CTX);
  assert.equal(r.ok, true, JSON.stringify(r.violations));
});

it("matches a compound regardless of hyphen/space and case", () => {
  assert.deepEqual(findUnknownCompounds("try GHK Cu", CTX), ["GHK-Cu"]);
  assert.deepEqual(findUnknownCompounds("TESAMORELIN is interesting", CTX), ["tesamorelin"]);
});

it("does not report a substring compound twice", () => {
  const found = findUnknownCompounds("semaglutide and ipamorelin", CTX);
  assert.deepEqual(found.sort(), ["ipamorelin", "semaglutide"]);
});

it("a compound name embedded in a word is not a mention", () => {
  assert.deepEqual(findUnknownCompounds("semaglutides-like effects", CTX), []);
});

// ---- rule: prescribing_verb ----

it("rejects a directive aimed at a compound the user IS taking", () => {
  const r = checkInsight(ok({ body: "You should increase your retatrutide this week." }), CTX);
  assert.ok(rules(r).includes("prescribing_verb"));
});

it("allows the same verb aimed at food — nutrition guidance is in scope", () => {
  const r = checkInsight(ok({ body: "Increase your protein at breakfast to hit the target." }), CTX);
  assert.equal(r.ok, true, JSON.stringify(r.violations));
});

it("past-tense narration is not a directive", () => {
  const r = checkInsight(ok({ body: "Your retatrutide adherence started strong and has held." }), CTX);
  assert.equal(r.ok, true, JSON.stringify(r.violations));
});

// ---- rule: diagnostic_language ----

it("rejects diagnostic phrasing", () => {
  assert.ok(rules(checkInsight(ok({ body: "This is a sign of insulin resistance." }), CTX)).includes("diagnostic_language"));
  assert.ok(rules(checkInsight(ok({ body: "These results diagnose prediabetes." }), CTX)).includes("diagnostic_language"));
});

// ---- rule: missing_clinician_prompt ----

it("a clinical signal without a clinician prompt is rejected", () => {
  const r = checkInsight(ok({ body: "Your blood pressure has been trending up." }), CTX);
  assert.ok(rules(r).includes("missing_clinician_prompt"));
});

it("the same insight passes once the clinician prompt is present", () => {
  const r = checkInsight(
    ok({
      body: "Your blood pressure has been trending up over the last two weeks.",
      clinicianPrompt: "Worth raising the blood-pressure trend with your clinician.",
    }),
    CTX,
  );
  assert.equal(r.ok, true, JSON.stringify(r.violations));
});

it("a non-clinical insight needs no clinician prompt", () => {
  assert.equal(checkInsight(ok(), CTX).ok, true);
});

// ---- rule: too_long ----

it("enforces the length caps", () => {
  assert.ok(rules(checkInsight(ok({ headline: "x".repeat(INSIGHT_LIMITS.headlineMaxChars + 1) }), CTX)).includes("too_long"));
  assert.ok(rules(checkInsight(ok({ body: "x ".repeat(INSIGHT_LIMITS.bodyMaxChars) }), CTX)).includes("too_long"));
  const many = Array.from({ length: INSIGHT_LIMITS.maxObservations + 1 }, () => ({ signal: "s", detail: "d" }));
  assert.ok(rules(checkInsight(ok({ observations: many }), CTX)).includes("too_long"));
});

// ---- reporting ----

it("reports EVERY violated rule, not just the first", () => {
  const r = checkInsight(
    ok({ body: "Start ipamorelin at 250 mcg — this indicates you need it." }),
    CTX,
  );
  const set = new Set(rules(r));
  assert.ok(set.has("dose_stated"));
  assert.ok(set.has("unknown_compound"));
  assert.ok(set.has("diagnostic_language"));
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
