# Opta Init — Guardrails

## Hard Rules (Never Violate)

1. **No auth** — zero login flows, user accounts, or session state ever
2. **No server** — static export only; no API routes, no getServerSideProps
3. **No dashboard** — this site does not duplicate lmx.optalocal.com functionality
4. **No inline styles for animations** — Framer Motion only, no CSS transitions on interactive elements
5. **No pure black backgrounds** — always #09090b minimum, never #000000 (OLED smear)
6. **No light mode default** — dark is canonical; light mode is an optional v2 addition
7. **No content duplication** — never replicate content from other optalocal.com sites
8. **No heavy dependencies** — JS bundle must stay under 150KB gzip for initial load

## Compliance (Inherited)

- C01: No data exfiltration
- C02: No destructive commands without confirmation
- C03: No external posts without approval
- C06: No untrusted code execution

## Aesthetic Non-Negotiables

- Background: #09090b only (not #000, not #111, not #0a0a0a — use the canonical token)
- Primary accent: #8b5cf6 — not blue, not teal, not any other hue
- Font: Sora for UI, JetBrains Mono for code — no substitutions
- Motion: spring physics only — no ease-in-out, no linear timing

## Scope Guard

If a proposed feature would:
- Require a backend → reject
- Add user state / auth → reject
- Duplicate another optalocal.com page's purpose → reject
- Add >30KB to the JS bundle → question carefully

## Performance Floor

Lighthouse scores below these values = do not ship:
- Performance: 95
- Accessibility: 100
- SEO: 100
- Best Practices: 95
