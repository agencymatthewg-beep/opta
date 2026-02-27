# Opta Init — Knowledge Base

## Research References

### Web Design & Animation (from Opta research folder)

**Crafting Opta's Ultra HD App Design.md** (~/Synced/Opta/docs/research/All-Platforms/UI-UX/)
- Spring physics via Reanimated/Framer Motion — stiffness/damping over duration
- Film grain overlay at 2-4% opacity — eliminates AI/generic look
- Glassmorphism: BackdropBlur + noise texture + specular highlight
- Staggered entry animations — 10-20ms per child
- Interruptible animations — essential for premium feel

**Premium App UI_UX Investigation.md** (same folder)
- "Deep Glass" trend: blur + noise texture + progressive opacity
- Spring overshoot (bounce) signals premium iOS quality
- Command palette blur-back effect (content recedes as overlay opens)
- Shared element transitions maintain mental model
- Linear app, Arc Browser, Resend.com as design benchmarks

### Opta Visual Identity
**VISUAL-IDENTITY.md** (1K-Optamize-Web/brand/)
- #8b5cf6 Electric Violet rationale (ambition without aggression)
- Satoshi for display, Sora for body — consider Satoshi for hero headlines
- Film grain + mesh gradients = anti-AI-look
- Glassmorphism: 1px border at 10% white opacity + inner shadow + noise

### Existing Design Tokens (canonical)
**globals.css** (1L-Opta-Local/web/src/app/)
- Complete --opta-* token set — copy directly into this project

## Relevant Ecosystem Files

| File | Location | Why Relevant |
|------|----------|-------------|
| APP.md | 1D-Opta-CLI-TS/ | Opta CLI purpose + install info |
| APP.md | 1M-Opta-LMX/ | Opta LMX purpose + install info |
| globals.css | 1L-Opta-Local/web/src/app/ | Canonical design tokens |
| VISUAL-IDENTITY.md | 1K-Optamize-Web/brand/ | Brand rationale |

## Key Technical References

- Framer Motion docs: https://www.framer.com/motion/
- Next.js static export: https://nextjs.org/docs/app/building-your-application/deploying/static-exports
- Tailwind CSS v4: https://tailwindcss.com/docs
