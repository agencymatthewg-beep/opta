# Google AI Ultra + Veo 3.1 + Flow for OptaLocal
Date: 2026-03-05
Owner: Matthew + Opta

## 1) Gemini 3.1 key test (requested)

### Result
- Gemini CLI is installed (`gemini 0.32.1`) but account auth failed with:
  - `403 PERMISSION_DENIED`
  - `This service has been disabled in this account for violation of Terms of Service. Please submit an appeal...`

### Command run
```bash
gemini -m gemini-3.1-pro -p "Reply exactly: GEMINI_31_OK"
```

### Interpretation
- This is an account/service-state block, not a local CLI install problem.
- Until Google restores account/service access (or a different permitted key/project is used), direct Gemini 3.1 generation via current CLI auth path will fail.

---

## 2) Research findings relevant to your ask

## Verified from sources
1. Google AI Ultra includes very high limits + 30TB storage + access to premium AI tooling (including Flow/Veo tiers depending on region/availability).
2. Veo 3/3.1 positioning emphasizes:
   - improved prompt adherence
   - higher visual quality/realism
   - stronger text-to-video and image-to-video outcomes
   - native audio/dialogue workflows in newer generations.
3. Flow is positioned as a cinematic workflow layer on top of generation models (scene/clip storytelling orchestration).

## Strategic implication for OptaLocal
- You should treat Flow+Veo as a **creative production system**, not a one-off prompt tool.
- Competitive output quality will come from:
  1) strict shot bible,
  2) visual token consistency,
  3) reusable prompt templates,
  4) post pipeline (color/sound/export presets).

---

## 3) Implementation blueprint for your 3 outcomes

## A) Opta Local Marketing Snippets
Goal: weekly short-form snippets (6-20s), cross-platform.

### Snippet system
- Build a `Snippet Matrix` with 5 fixed categories:
  1. Product proof (before/after)
  2. Performance wins (metrics overlays)
  3. Feature drops
  4. Founder POV clips
  5. Ecosystem architecture explainers

### Production rules
- Aspect variants: 9:16, 1:1, 16:9
- Hook in first 1.5s
- Single CTA at end (Install / Try / Join waitlist)
- Same Opta visual token pack each clip:
  - color palette
  - glow intensity
  - motion curve
  - typography pair

### Output target
- 12 clips/week from 4 master concepts (each concept versioned to 3 aspect ratios).

---

## B) Premium Intro Videos (Opta Code + Opta Init)
Goal: "F1 25 style" pre-start cinematic intro before user enters app.

### Asset package per app
For each app (Opta Code, Opta Init), define:
- Logo animation sequence (2-3 variants)
- Signature sound motif (2-4 seconds)
- Intro timeline (8-15 seconds max)
- Loop-safe fallback still frame + subtle motion

### Intro structure (recommended)
1. 0.0-1.5s: ambient reveal + identity tone
2. 1.5-4.5s: logo emergence + energy sweep
3. 4.5-8.5s: app capability montage (abstracted UI motion)
4. 8.5-12.0s: final lockup + "Press X / Continue" compatible hold

### Technical constraints
- Render masters at 4K 16:9 + downscale variants
- Export app-friendly formats:
  - ProRes master archive
  - H.265 runtime asset
- Keep startup budget strict (decode + load budget tested on target devices)

---

## C) Improved animations/transitions/visuals across OptaLocal
Goal: unify motion language and remove visual drift.

### Motion system upgrade
- Define global motion tokens in one source:
  - durations
  - spring curves
  - easing classes
  - blur/glow ramp patterns
- Map tokens into all active apps:
  - Home, Init, Accounts, Learn, Help, Status, LMX Dashboard, Admin

### Priority improvements
1. Route transitions: standardized enter/exit choreography
2. Skeleton/loading states: branded and reduced-jank
3. Micro-interactions: button/hover/focus consistency
4. Modal choreography: depth/blur/scale uniformity

### KPI targets
- perceived smoothness score (internal QA rubric)
- frame pacing stability on target hardware
- drop-off rate during first-run onboarding (expected improvement)

---

## 4) How to work with me (operating model)

## Collaboration mode (recommended)
Use this sequence each cycle:
1. **Brief** (one sentence objective + deadline)
2. I generate:
   - shot list,
   - prompt pack,
   - asset checklist,
   - acceptance criteria.
3. I execute generation/review loops and return top candidates.
4. You approve shortlist.
5. I finalize exports + app integration tasks + validation checklist.

## Prompting format to send me
Use:
```text
Objective:
Audience:
App:
Duration:
Style refs:
Must keep:
Must avoid:
Deadline:
```

---

## 5) Immediate next actions
1. Resolve Gemini account/service block (or provide alternate key/project) so 3.1 execution is available.
2. Approve creation of:
   - `docs/brand/OPTA-VIDEO-STYLE-BIBLE.md`
   - `docs/marketing/SNIPPET-MATRIX.md`
   - `docs/motion/OPTA-MOTION-TOKENS.md`
3. Start with two pilot outputs:
   - Opta Code intro v1
   - Opta Init intro v1

---

## Sources consulted
- Google One Help: AI Ultra benefits page
- Google DeepMind Veo model page
- Google AI Ultra summary references discovered via grounded search

(Notes: some broad Google blog URLs returned low-extract content/404 in this fetch path; verified claims above are limited to retrievable source content during this run.)
