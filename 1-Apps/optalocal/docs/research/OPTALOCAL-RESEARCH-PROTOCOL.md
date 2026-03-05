# OPTALOCAL-RESEARCH-PROTOCOL

Last updated: 2026-03-05 (Australia/Melbourne)
Owner: OptaLocal Engineering

## 1) Objective
Create a repeatable, autonomous weekly research loop that produces:
1. evidence-backed recommendations
2. production-safe implementation plans
3. measurable KPI movement for OptaLocal

This protocol is for **production relevance only**. Generic research is excluded unless tied directly to OptaLocal outcomes.

---

## 2) Weekly Autonomous Plan (operating cadence)

## Monday — Prioritize + Hypothesize (60–90 min)
1. Pull queue candidates from `OPTALOCAL-RESEARCH-QUEUE.md`
2. Score each candidate (priority model)
3. Select:
   - 2 primary topics
   - 1 reliability/observability mandatory topic
   - 1 fast-win topic
4. Write hypothesis for each selected topic:
   - "If we implement X, KPI Y should improve by Z range"

**Output:** `WEEK-YYYY-MM-DD-PLAN.md` (in same directory)

## Tuesday — Gather Evidence (90–150 min)
For each selected topic:
- Collect operator-grade sources (vendor docs, postmortems, SRE guides, incident analyses)
- Extract concrete mechanisms, constraints, tradeoffs
- Record implementation prerequisites and risks

**Output:** Evidence entries using template in Section 5

## Wednesday — Fit to OptaLocal Architecture (90–150 min)
- Map findings to current OptaLocal components
- Identify conflict points (tooling, architecture boundaries, rollout risk)
- Define minimum viable pilot

**Output:** `FIT-GAP` notes per topic (adopt/pilot/reject candidates)

## Thursday — Design the Experiment (60–120 min)
- Define pilot scope, rollout guardrails, and rollback plan
- Specify success/failure thresholds
- Attach required telemetry and verification checks

**Output:** Experiment card per topic (Section 6 template)

## Friday — Decision + Handoff (45–90 min)
For each topic, issue one decision:
- **ADOPT** (implementation-ready)
- **PILOT** (time-boxed validation)
- **REJECT** (not worth current constraints)

Publish weekly bundle:
- Decision memo
- Evidence pack
- Next-week carryover list

---

## 3) Research Constraints (must pass)
Before work starts, each topic must satisfy all:
- Direct mapping to OptaLocal component or process
- KPI linkage (at least one target metric)
- Concrete adoption path (owner + effort + risk)
- Verifiable evidence (not opinion-only)

If any condition fails -> defer.

### AIALL Constraint
Generic AI research is blocked unless it provides one of:
- deployment safety improvement
- reliability/observability improvement
- contract quality improvement
- frontend quality/performance improvement
with measurable KPI deltas.

---

## 4) Source Quality Rubric
Use this evidence weighting:
- **Tier A (weight 3):** official architecture/runbook docs, credible incident postmortems, measured benchmark reports
- **Tier B (weight 2):** mature engineering blogs with implementation detail and metrics
- **Tier C (weight 1):** opinion pieces, trend summaries, non-reproducible claims

Decision rule:
- No ADOPT decision without Tier A evidence or strong mixed evidence (>=6 total weight with at least one Tier A source).

---

## 5) Evidence Capture Template (copy/paste)
Use this block for each source reviewed.

```md
### Evidence Entry
- Topic ID: <A1|D2|R3|...>
- Date: <YYYY-MM-DD>
- Source title:
- Source URL:
- Source tier: <A|B|C>
- Claim summary (1-2 lines):
- Mechanism (how it works):
- Preconditions/Dependencies:
- Risks/Failure modes:
- Quantitative results cited:
- Applicability to OptaLocal (High/Med/Low + why):
- Required changes in OptaLocal:
- Observability needed to validate:
- Confidence (0-100%):
- Notes:
```

---

## 6) Experiment Card Template (copy/paste)

```md
## Experiment Card — <Topic ID>
- Objective:
- Hypothesis:
- KPI targets:
  - Metric 1: baseline -> target
  - Metric 2: baseline -> target
- Scope:
- Out of scope:
- Dependencies:
- Rollout plan:
  1)
  2)
  3)
- Guardrails:
- Rollback triggers:
- Rollback procedure:
- Instrumentation/traces/logs required:
- Validation window:
- Decision rule (Adopt/Pilot/Reject criteria):
- Owner:
- ETA:
```

---

## 7) Weekly Decision Memo Template

```md
# OptaLocal Research Decision Memo — Week of <YYYY-MM-DD>

## Topics evaluated
- <Topic ID + title>
- <Topic ID + title>
- <Topic ID + title>

## Decisions
### <Topic ID>
- Decision: ADOPT | PILOT | REJECT
- Why:
- Expected KPI impact:
- Evidence strength:
- Execution effort estimate:
- Risks:
- Next action + owner:

## Carryover to next week
- <items>

## Blockers
- <items>
```

---

## 8) Minimal Artifact Set per Week
Required files (same folder):
1. `WEEK-YYYY-MM-DD-PLAN.md`
2. `WEEK-YYYY-MM-DD-EVIDENCE.md`
3. `WEEK-YYYY-MM-DD-DECISIONS.md`

Completion criteria:
- >=3 topics evaluated
- >=1 topic with implementation-ready output
- explicit adopt/pilot/reject for each topic
- KPI mapping for every decision

---

## 9) Capability Map (what this protocol continuously evaluates)

### Capability Domain → Signals
1. **Architecture quality**
   - boundary clarity, coupling score, change blast radius
2. **Deployment maturity**
   - progressive delivery, rollback latency, post-deploy verification quality
3. **Reliability engineering**
   - SLO coverage, incident recurrence rate, MTTR
4. **Observability maturity**
   - golden signal coverage, trace continuity, alert actionability
5. **Frontend system maturity**
   - token/component consistency, accessibility conformance, performance budget adherence
6. **Contract governance**
   - versioning discipline, CDC coverage, idempotency safety

Score each domain weekly: `0-5`, and track trend.

---

## 10) Done Definition (for each research topic)
A topic is complete only when all are true:
- Evidence captured with quality rating
- OptaLocal fit/gap assessed
- KPI target and validation method specified
- Decision (adopt/pilot/reject) recorded
- Clear next owner/action set

If any is missing, status remains **In Progress**.
