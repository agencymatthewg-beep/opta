# Legal Content Governance (Copyright, Trademark, Copy Publication)

Last updated: 2026-03-06 (Australia/Melbourne)  
Owner: OptaLocal Docs + Ops

## Scope

Applies to all copy published on:
- `optalocal.com`
- `init.optalocal.com`
- `lmx.optalocal.com`
- `accounts.optalocal.com`
- `status.optalocal.com`
- `help.optalocal.com`
- `learn.optalocal.com`
- `admin.optalocal.com`

Content types:
- Marketing copy, product descriptions, docs pages, changelogs, blog posts, release notes, onboarding text, and UI microcopy.

## Core Rules (Hard Requirements)

1. No publish if source ownership/licensing is unclear.
2. No publish if trademark usage is ambiguous, misleading, or unapproved.
3. No publish without completing the publication checklist in this document.

## Copyright Controls

## Source Provenance

For each non-original asset or adapted copy block, record:
- Source URL or internal file path.
- License type (or "internal proprietary").
- Required attribution text (if any).
- Modifier and date.

Allowed without extra approval:
- Original internal writing.
- Licensed stock content with valid license proof.
- Internal docs reused with attribution to source path.

Requires legal/product-owner approval before publish:
- Third-party text copied verbatim beyond short quotation.
- Third-party diagrams/screenshots/logos.
- Any content with unknown or conflicting license terms.

Prohibited:
- Copying competitor/site text as "reference then paste".
- Uploading copyrighted material without reuse rights.
- Assuming "public on web" means reusable.

## Trademark Controls

## Opta Marks (Canonical Usage)

Use exact product/surface names from canonical docs:
- `Opta Home`
- `Opta Help`
- `Opta Learn`
- `Opta Admin`

Do not:
- Invent variant names for canonical surfaces.
- Use third-party marks in a way that implies partnership/endorsement without written approval.

## Third-Party Marks

When referencing third-party products/brands:
- Use factual, nominative references only.
- Keep original casing and spelling.
- Include ownership acknowledgment when the context is promotional/comparative.

Template acknowledgment:
- "`<Trademark>` is a trademark of its respective owner."

## Copy Publication Checklist (Go/No-Go)

Publisher must verify all checks before release:

- [ ] Canonical naming matches `docs/PRODUCT-MODEL.md` taxonomy.
- [ ] No unlicensed third-party text, image, logo, or diagram.
- [ ] Source provenance captured for adapted content.
- [ ] Trademark references are factual and non-implying.
- [ ] Required attributions/acknowledgments are present.
- [ ] Security copy does not over-claim guarantees.
- [ ] Final copy reviewed by content owner + surface owner.
- [ ] `npm run docs:check` passes.

Release is `NO-GO` if any checkbox is unchecked.

## Publication Evidence (Minimum)

For each publish event, capture in PR/merge note:
- Surface/domain(s).
- Reviewer names.
- Checklist completion confirmation.
- Links to provenance notes (if applicable).

## Fast Escalation

Escalate to legal/product owner immediately when:
- License status cannot be verified in < 15 minutes.
- A trademark complaint or takedown request is received.
- Content attribution requirements are disputed.
