#!/usr/bin/env python3
"""recompiq-insights-generate.py — daily dashboard insights on the $0 CLI path.

Closes audit item P0 #3: RecompIQ never volunteered a recommendation. The
"Coach insight" card was a hardcoded two-sentence template
(apps/web/components/dashboard/derive.ts) that read weight and protein and
nothing else — never a peptide, workout, lab, condition or injury.

Chain (daily):
  1. GET  /api/cron/insights  → de-identified snapshot per user due today
  2. per user: one model call against that snapshot → a structured insight
  3. POST /api/cron/insights  → the app runs the checkInsight safety guard
     (@peptide/peptides/insights) and writes only what passes

WHY THE ENDPOINTS AND NOT THE DATABASE: this box also runs a dozen unrelated
agents. RecompIQ's service-role key here would put 44 tables of health data
behind whatever the weakest thing on the box is. The route pair is the whole
blast radius instead, and the safety guard lives on the app side of it so no
backend — including this one — can write an unguarded insight.

BACKENDS (INSIGHTS_BACKEND):
  cli      — first-party Claude Code CLI. $0 on the Max plan. DEFAULT.
  gateway  — Vercel AI Gateway. Metered.

  The Max plan is a PERSONAL subscription. Today the only RecompIQ user is its
  owner, so `cli` is his own use of his own plan. The moment there is a second
  user, generating THEIR insights is no longer personal use and this must move
  to `gateway` — which is one environment variable, deliberately.

  Note Hermes agents are NOT a $0 path: Anthropic bills third-party apps from
  extra usage ("Third-party apps now draw from your extra usage, not your plan
  limits"). Only the first-party CLI is plan-covered, which is why this script
  shells out to `claude` instead of dispatching a Hermes worker.

Source of truth: RecompIQ repo scripts/vps/recompiq-insights-generate.py
Deployed to:     /srv/recompiq/bin/recompiq-insights-generate.py  (cron daily)
"""
import datetime
import json
import os
import re
import subprocess
import sys
import urllib.error
import urllib.request

LOG = lambda: f"{datetime.datetime.now(datetime.UTC):%F %T} INSIGHTS"

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------


def load_env(path):
    out = {}
    try:
        for line in open(path):
            if "=" in line and not line.strip().startswith("#"):
                k, v = line.split("=", 1)
                out[k.strip()] = v.strip().strip('"').strip("'")
    except FileNotFoundError:
        pass
    return out


cfg = load_env("/srv/recompiq/.env")
APP_URL = (cfg.get("RECOMPIQ_APP_URL") or "https://recompiq.com").rstrip("/")
CRON_SECRET = cfg.get("RECOMPIQ_CRON_SECRET")
BACKEND = (cfg.get("INSIGHTS_BACKEND") or "cli").strip()
CLI_MODEL = cfg.get("INSIGHTS_CLI_MODEL") or "claude-sonnet-4-6"
GATEWAY_MODEL = cfg.get("INSIGHTS_GATEWAY_MODEL") or "anthropic/claude-sonnet-4.6"
GATEWAY_KEY = cfg.get("AI_GATEWAY_API_KEY")
CLI_USER = cfg.get("INSIGHTS_CLI_USER") or "jtexec"

if not CRON_SECRET:
    print(f"{LOG()} FATAL no RECOMPIQ_CRON_SECRET in /srv/recompiq/.env")
    sys.exit(1)
if BACKEND not in ("cli", "gateway"):
    print(f"{LOG()} FATAL INSIGHTS_BACKEND must be 'cli' or 'gateway' (got {BACKEND!r})")
    sys.exit(1)

# The Claude Code OAuth token lives with the exec tier; shared rather than
# duplicated so a rotation is one edit.
TOKEN = None
for line in open("/srv/jt-company/execs/.env"):
    m = re.search(r"CLAUDE_CODE_OAUTH_TOKEN=(\S+)", line)
    if m:
        TOKEN = m.group(1)
        break
if BACKEND == "cli" and not TOKEN:
    print(f"{LOG()} FATAL no CLAUDE_CODE_OAUTH_TOKEN (needed by the cli backend)")
    sys.exit(1)
if BACKEND == "gateway" and not GATEWAY_KEY:
    print(f"{LOG()} FATAL no AI_GATEWAY_API_KEY (needed by the gateway backend)")
    sys.exit(1)

INSIGHT_SCHEMA = {
    "type": "object",
    "properties": {
        "headline": {"type": "string"},
        "body": {"type": "string"},
        "observations": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {"signal": {"type": "string"}, "detail": {"type": "string"}},
                "required": ["signal", "detail"],
                "additionalProperties": False,
            },
        },
        "clinician_prompt": {"type": ["string", "null"]},
        "evidence_level": {"type": ["string", "null"]},
    },
    "required": ["headline", "body", "observations", "clinician_prompt", "evidence_level"],
    "additionalProperties": False,
}


# ---------------------------------------------------------------------------
# App API
# ---------------------------------------------------------------------------


def app(path, method="GET", payload=None):
    data = json.dumps(payload).encode() if payload is not None else None
    headers = {"Authorization": f"Bearer {CRON_SECRET}"}
    if data:
        headers["Content-Type"] = "application/json"
    req = urllib.request.Request(f"{APP_URL}{path}", data=data, headers=headers, method=method)
    with urllib.request.urlopen(req, timeout=120) as r:
        body = r.read().decode()
    return json.loads(body) if body else None


# ---------------------------------------------------------------------------
# Backends
# ---------------------------------------------------------------------------


def call_cli(prompt):
    """First-party Claude Code CLI. $0 on the Max plan.

    The OAuth token is passed through the ENVIRONMENT, never in argv. In argv it
    leaks two ways: `ps` shows it to any local user for the whole run, and
    subprocess.TimeoutExpired prints the full command array — which once wrote a
    live token in plaintext into a log that Syncthing then replicated. Hence
    `sudo --preserve-env` and the deliberate TimeoutExpired catch below.
    """
    env = {**os.environ, "HOME": f"/home/{CLI_USER}", "CLAUDE_CODE_OAUTH_TOKEN": TOKEN}
    try:
        r = subprocess.run(
            [
                "sudo", "--preserve-env=CLAUDE_CODE_OAUTH_TOKEN,HOME", "-u", CLI_USER,
                "/usr/bin/claude", "--print", "--model", CLI_MODEL,
                "--dangerously-skip-permissions", "--max-turns", "3",
                "--json-schema", json.dumps(INSIGHT_SCHEMA),
                "--output-format", "json", prompt,
            ],
            capture_output=True, text=True, cwd="/srv/recompiq",
            stdin=subprocess.DEVNULL, env=env, timeout=600,
        )
    except subprocess.TimeoutExpired:
        # Caught on purpose. An uncaught TimeoutExpired renders the whole argv
        # into the log — and the prompt contains this user's health data.
        print(f"{LOG()} FAIL cli timed out after 600s")
        return None
    try:
        envelope = json.loads(r.stdout.strip())
        if envelope.get("is_error"):
            print(f"{LOG()} FAIL cli error: {str(envelope.get('result'))[:200]}")
            return None
        so = envelope.get("structured_output")
        return so if isinstance(so, dict) else json.loads(so)
    except Exception as e:
        # stderr only — stdout would echo the model's text about a real person.
        print(f"{LOG()} FAIL cli output unparseable ({e}); stderr: {r.stderr[:200]}")
        return None


def call_gateway(prompt):
    """Vercel AI Gateway — the metered swap. OpenAI-compatible surface.

    Uses json_object rather than a strict json_schema response_format: schema
    support varies by upstream provider through the compat endpoint, and a
    provider that ignores it fails the whole call. The shape is enforced by
    extract_json + the app-side Zod schema either way.
    """
    payload = {
        "model": GATEWAY_MODEL,
        "max_tokens": 900,
        "response_format": {"type": "json_object"},
        "messages": [
            {"role": "system", "content": "Reply with a single JSON object and nothing else."},
            {"role": "user", "content": prompt + "\n\nReturn ONLY a JSON object matching:\n"
             + json.dumps(INSIGHT_SCHEMA)},
        ],
    }
    req = urllib.request.Request(
        "https://ai-gateway.vercel.sh/v1/chat/completions",
        data=json.dumps(payload).encode(),
        headers={"Authorization": f"Bearer {GATEWAY_KEY}", "Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=180) as r:
            body = json.loads(r.read().decode())
    except urllib.error.HTTPError as e:
        print(f"{LOG()} FAIL gateway HTTP {e.code}: {e.read().decode()[:200]}")
        return None
    except Exception as e:
        print(f"{LOG()} FAIL gateway {type(e).__name__}: {str(e)[:200]}")
        return None
    return extract_json(body.get("choices", [{}])[0].get("message", {}).get("content", ""))


def extract_json(text):
    try:
        return json.loads(text)
    except Exception:
        pass
    m = re.search(r"\{.*\}", text or "", re.S)
    if not m:
        print(f"{LOG()} FAIL no JSON object in model output")
        return None
    try:
        return json.loads(m.group(0))
    except Exception as e:
        print(f"{LOG()} FAIL JSON parse ({e})")
        return None


generate = call_cli if BACKEND == "cli" else call_gateway


# ---------------------------------------------------------------------------
# Prompt
# ---------------------------------------------------------------------------

# The app-side guard (checkInsight) is the backstop, not the plan. These rules
# are stated here so the model rarely trips it; a rule tripping daily in the
# POST response means this prompt needs the fix, not the guard.
RULES = """HARD RULES — a violation is rejected by the server, not softened:
- NEVER state a dose. No number followed by mg, mcg, iu, units, ml or cc. Not the
  user's own logged dose, not a literature range, not "a typical dose". You may
  say "your logged dose" in words. Lab concentrations (mg/dL, mg/L) ARE allowed —
  reporting the user's own lab numbers is the point of the product.
- NEVER name a compound the user is not already taking. The active list is given
  below and it is exhaustive. Suggesting anything else is prescribing.
- NEVER give a directive about a compound: no "start", "increase", "titrate",
  "stop", "cycle off", "consider adding". Directives about FOOD, PROTEIN, STEPS,
  SLEEP and TRAINING are in scope and welcome — that is the coaching this product
  is for.
- NEVER diagnose. No "you have", "this indicates", "this is a sign of". Observe
  what the numbers did; do not name a condition they imply.
- If you mention any clinical signal (labs, blood pressure, glucose, heart rate,
  numbness, nausea, dizziness), clinician_prompt MUST be a sentence the user can
  take to their clinician. Otherwise set it to null.

STYLE:
- headline: one line, under 120 characters, concrete. Not "Keep it up!".
- body: 2-4 sentences, under 600 characters. Lead with the single most useful
  thing in this data today. Say the number.
- observations: up to 5 {signal, detail} pairs, each traceable to a logged value
  below. This is what makes the card checkable rather than plausible prose.
- Say plainly when the data is thin. Do not manufacture a trend from two points.
- evidence_level: one of OBSERVED_USER_DATA, HUMAN_RCT, HUMAN_OBS, MECHANISTIC,
  ANECDOTAL, or null. Use OBSERVED_USER_DATA when the insight rests only on the
  user's own logs, which is the normal case."""


def build_prompt(snap):
    def series(rows, fmt, limit=14):
        rows = rows[-limit:] if len(rows) > limit else rows
        return "\n".join(fmt(r) for r in rows) or "  (none logged)"

    goal = snap.get("goal")
    goal_txt = (
        f"start {goal['start_weight_lb']} lb → target {goal['goal_weight_lb_min']}-"
        f"{goal['goal_weight_lb_max']} lb over {goal['timeline_weeks']} weeks "
        f"(week {goal['weeks_elapsed']}); phase {goal.get('phase') or 'n/a'}; "
        f"protein target {goal['protein_target_g_min']}-{goal['protein_target_g_max']} g/day"
        if goal else "  (no goal set)"
    )
    energy = snap.get("energy") or {}
    regimen = snap.get("regimen") or []
    regimen_txt = "\n".join(
        f"  - {r['name']} ({r.get('frequency') or 'no schedule recorded'}), "
        f"evidence {r.get('evidence_level') or 'ungraded'}"
        for r in regimen
    ) or "  (no active compounds)"

    doses = snap.get("doses") or []
    taken = sum(1 for d in doses if d.get("adherence") == "taken")

    return f"""You are writing today's single dashboard insight for a RecompIQ user — a body-recomposition and peptide-TRACKING product. RecompIQ educates and tracks. It never prescribes.

This is the ONE thing the app volunteers today, unprompted. Make it worth the interruption: tell them something true about their own data that they would not have noticed themselves.

{RULES}

=== THIS USER'S DATA (all of it self-logged) ===
Profile: age {snap['profile'].get('age') or 'unknown'}, sex {snap['profile'].get('sex') or 'unstated'}
Goal: {goal_txt}
Energy budget: target {energy.get('target_kcal') or 'not established'} kcal/day, \
TDEE {energy.get('tdee_kcal') or 'unknown'}, protein floor {energy.get('protein_g_min') or 'n/a'} g
Average steps/day (logged days only, 14d): {snap.get('avg_steps_per_day') or 'none logged'}

Weight (28d):
{series(snap.get('weights') or [], lambda w: f"  {w['logged_at'][:10]}  {w['value_lb']} lb")}

Daily intake (7d):
{series(snap.get('daily_intake') or [], lambda d: f"  {d['day']}  {d['kcal']} kcal, {d['protein_g']} g protein")}

Training (14d):
{series(snap.get('workouts') or [], lambda w: f"  {str(w['performed_at'])[:10]}  {w['session_type']}, {w.get('duration_min') or '?'} min, RPE {w.get('rpe') or '?'}")}

ACTIVE COMPOUNDS — this list is exhaustive, never name another:
{regimen_txt}
Dose log (28d): {taken} taken of {len(doses)} recorded events

Vitals (14d):
{series(snap.get('vitals') or [], lambda v: f"  {v['logged_at'][:10]}  BP {v.get('bp_systolic') or '-'}/{v.get('bp_diastolic') or '-'}, HR {v.get('hr') or '-'}, glucose {v.get('glucose_mgdl') or '-'}")}

Symptoms (14d):
{series(snap.get('symptoms') or [], lambda s: f"  {s['logged_at'][:10]}  mood {s.get('mood') or '-'}, energy {s.get('energy') or '-'}, pain {s.get('pain') or '-'}, nausea {s.get('nausea')}")}

Recent labs:
{series(snap.get('labs') or [], lambda l: f"  {l['collected_on']}  {l['marker']} {l['value']} {l.get('unit') or ''}", limit=20)}

Conditions: {', '.join(snap.get('conditions') or []) or 'none disclosed'}
Injuries: {', '.join(snap.get('injuries') or []) or 'none disclosed'}
Medications: {', '.join(snap.get('medications') or []) or 'none disclosed'}
Open safety alerts: {', '.join(f"{a['severity']}: {a['title']}" for a in (snap.get('open_alerts') or [])) or 'none'}

Write the insight now."""


# ---------------------------------------------------------------------------
# Run
# ---------------------------------------------------------------------------

try:
    due = app("/api/cron/insights")
except Exception as e:
    detail = getattr(e, "read", lambda: b"")().decode()[:200]
    print(f"{LOG()} FATAL snapshot fetch failed: {e} {detail}")
    sys.exit(1)

snapshots = due.get("snapshots") or []
skipped = due.get("skipped") or []
print(f"{LOG()} START backend={BACKEND} due={len(snapshots)} skipped={len(skipped)}")
if not snapshots:
    sys.exit(0)

drafts = []
for snap in snapshots:
    out = generate(build_prompt(snap))
    if not out:
        # Never log the user id alongside a failure reason that could be joined
        # with anything else; a bare count is enough to notice a broken run.
        print(f"{LOG()} SKIP one user — generation returned nothing")
        continue
    drafts.append({
        "user_id": snap["user_id"],
        "generated_for": snap["generated_for"],
        "headline": str(out.get("headline") or "").strip(),
        "body": str(out.get("body") or "").strip(),
        "observations": [
            {"signal": str(o.get("signal") or "").strip(), "detail": str(o.get("detail") or "").strip()}
            for o in (out.get("observations") or [])
            if o.get("signal") and o.get("detail")
        ],
        "clinician_prompt": (str(out["clinician_prompt"]).strip() or None)
        if out.get("clinician_prompt") else None,
        "evidence_level": out.get("evidence_level") or None,
        "source": "vps_cli" if BACKEND == "cli" else "gateway",
        "model": CLI_MODEL if BACKEND == "cli" else GATEWAY_MODEL,
    })

if not drafts:
    print(f"{LOG()} DONE nothing generated")
    sys.exit(0)

try:
    res = app("/api/cron/insights", "POST", {"insights": drafts})
except Exception as e:
    detail = getattr(e, "read", lambda: b"")().decode()[:300]
    print(f"{LOG()} FAIL write-back: {e} {detail}")
    sys.exit(1)

rejected = res.get("rejected") or []
print(f"{LOG()} DONE written={res.get('written')} rejected={len(rejected)}")
for r in rejected:
    # Rules only — the rejected TEXT is about someone's health and never lands
    # in a log that Syncthing replicates.
    print(f"{LOG()} REJECTED rules={','.join(v['rule'] for v in r['violations'])}")
