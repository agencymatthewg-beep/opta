# RESEARCH-2026-SUPABASE-LONGEVITY

## Scope
Best practices for **2025–2026** Supabase usage in a SaaS auth platform (security, reliability, ops), with concrete implementation deltas for **Opta Cloud Accounts**.

---

## Executive takeaways (what matters most)
1. **Move fully to modern JWT signing keys + JWKS verification** (stop relying on legacy JWT secret/HS256 verification paths).
2. **Treat RLS as mandatory infrastructure** for every user-facing table and enforce MFA-sensitive actions with `aal` checks.
3. **Harden auth abuse controls**: tuned rate limits, CAPTCHA, OTP TTL, custom SMTP, email confirmation.
4. **Operational resilience**: enable PITR when low RPO is needed; test restore regularly; monitor connection usage and pool sizing.
5. **Production hygiene**: network restrictions, SSL enforcement, staged branch-based deployment, status-page alerting.

---

## 2025–2026 Supabase-aligned best practices

### 1) JWT and key-management posture (longevity + security)
- Prefer Supabase **Signing Keys system** (asymmetric/public-key workflows) over legacy JWT secret.
- Verify JWTs via Supabase-recommended mechanisms (`getClaims()` / JWKS-backed verification), not ad-hoc shared-secret verification.
- Respect JWKS cache behavior (Supabase edge cache + client cache windows) during key rotation/revocation planning.
- Rotate signing keys at least annually and rehearse incident revocation.

**Why this matters:** lower auth-server dependency in token verification, safer revocation/rotation, reduced outage coupling, better compliance posture.

### 2) Session control and token lifecycle
- Keep access tokens short-lived (Supabase generally recommends ~1h default; avoid too-short values causing refresh churn/clock-skew issues).
- Use Supabase refresh-token lifecycle as designed (reuse detection enabled; understand 10s reuse interval behavior).
- For higher-assurance apps, configure: time-boxed sessions, inactivity timeout, and single-session controls.

### 3) MFA as authorization signal (not just login UX)
- Implement MFA enrollment + challenge flows (TOTP and/or phone).
- Enforce sensitive actions with JWT `aal` (`aal2`) checks in backend and RLS where applicable.
- Keep unenroll/recovery UX explicit to avoid lockouts.

### 4) Abuse prevention and email/channel security
- Configure auth rate limits intentionally (don’t leave defaults unreviewed).
- Enable CAPTCHA for signup/signin/recovery paths.
- Keep email confirmation enabled; tune OTP expiry/entropy.
- Use custom SMTP for deliverability, trust, and scale controls.

### 5) Data access and environment safety
- Ensure RLS on all user-facing tables; avoid permissive policies.
- Use branch/staging environments for schema/config experimentation; keep production changes migration-driven.
- Branches are data-less by default: seed only non-sensitive test data.

### 6) Backup, recovery, and durability ops
- Choose backup strategy by RPO:
  - Daily backups: acceptable for up to ~24h data-loss tolerance.
  - PITR: for low-RPO systems, with WAL-based near-continuous recoverability.
- Test restore drills in non-prod on a schedule; document RTO/RPO outcomes.
- Account for backup caveats (e.g., DB backup model details and operational downtime during restore windows).

### 7) Connection and scale reliability
- Monitor Postgres/direct/PostgREST/Auth/Storage connection split.
- Size Supavisor pool conservatively (esp. when heavy PostgREST load).
- Investigate idle/long-lived connections via `pg_stat_activity` and app-level pooling behavior.

### 8) Platform hardening
- Turn on **Network Restrictions** (CIDR allowlists) for DB/pooler routes.
- Ensure SSL enforcement and org/account MFA for admin access.
- Subscribe ops team to Supabase status feed alerts.

---

## Implementation deltas for Opta (concise, priority-ordered)

## P0 (do now, 0–14 days)
1. **JWT hardening migration**
   - Confirm Opta APIs/services verify Supabase JWT via JWKS / `getClaims()` path only.
   - Remove any direct dependency on legacy JWT secret for token verification.
   - Create key-rotation runbook (rotate, wait window, revoke, rollback procedure).
2. **RLS baseline audit**
   - Inventory all auth-exposed tables; enforce RLS everywhere user data can be reached.
   - Add test cases for anon/authenticated/cross-tenant access paths.
3. **Auth abuse baseline**
   - Review/explicitly set rate limits for `/verify`, `/token`, OTP, and MFA challenge endpoints.
   - Enable CAPTCHA on signup/sign-in/recovery.
   - Verify email confirmation + OTP expiry policy.

## P1 (next 15–45 days)
4. **MFA policy upgrade**
   - Add optional MFA enrollment UX now; enforce `aal2` for sensitive operations (account recovery, billing changes, key exports, org-admin actions).
5. **Session governance**
   - Set explicit session controls: max lifetime + inactivity timeout.
   - Decide if single-session mode is required for admin roles.
6. **Network restrictions rollout**
   - Apply CIDR allowlists for DB/pooler access (include IPv4+IPv6 where required).

## P2 (45–90 days)
7. **Backup/restore SLO operations**
   - Enable PITR if Opta’s auth/account data RPO target is <24h.
   - Run quarterly restore drills; track achieved RTO/RPO in ops docs.
8. **Branch-based release discipline**
   - Enforce migration-only schema changes via branches/staging and automated checks before merge.
9. **Connection observability**
   - Dashboard/telemetry alerts for connection saturation and abnormal auth refresh spikes.

---

## Suggested minimum target state for Opta (2026)
- JWT verification: **JWKS/asymmetric-ready only**
- RLS coverage: **100% of user-data tables**
- MFA: **enforced for privileged actions (aal2)**
- Session policy: **explicit lifetime + inactivity controls**
- Abuse protection: **rate limits + CAPTCHA + custom SMTP**
- Recovery: **PITR enabled** (if RPO requirement <24h), tested restores
- Ops hardening: **network restrictions + status alert subscriptions + branch-first deployments**

---

## Sources
1. Supabase Docs — JWTs: https://supabase.com/docs/guides/auth/jwts  
2. Supabase Docs — JWT Signing Keys: https://supabase.com/docs/guides/auth/signing-keys  
3. Supabase Docs — User Sessions: https://supabase.com/docs/guides/auth/sessions  
4. Supabase Docs — PKCE Flow: https://supabase.com/docs/guides/auth/sessions/pkce-flow  
5. Supabase Docs — MFA: https://supabase.com/docs/guides/auth/auth-mfa  
6. Supabase Docs — Auth Rate Limits: https://supabase.com/docs/guides/auth/rate-limits  
7. Supabase Docs — CAPTCHA Protection: https://supabase.com/docs/guides/auth/auth-captcha  
8. Supabase Docs — Production Checklist: https://supabase.com/docs/guides/deployment/going-into-prod  
9. Supabase Docs — Security Overview: https://supabase.com/docs/guides/security  
10. Supabase Docs — Network Restrictions: https://supabase.com/docs/guides/platform/network-restrictions  
11. Supabase Docs — Backups & PITR: https://supabase.com/docs/guides/platform/backups  
12. Supabase Docs — Branching: https://supabase.com/docs/guides/deployment/branching  
13. Supabase Docs — Connection Management: https://supabase.com/docs/guides/database/connection-management
