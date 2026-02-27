# SUPABASE Migration Governance (Opta)

Canonical migration authority:  
`/Users/matthewbyrden/Synced/Opta/1-Apps/1N-Opta-Cloud-Accounts/supabase/migrations`

## Governance Rules

1. **Single source of truth:** all schema/RLS/function changes must be migration files in `1N`.
2. **No dashboard-only drift:** direct SQL in Supabase dashboard must be backfilled immediately into migration.
3. **Forward-fix first:** never edit an already-applied migration in shared/prod.
4. **RLS mandatory:** any new user-owned table must enable RLS and include explicit policies.
5. **Contract sync required:** update impacted files in `contracts/` for behavioral changes.

---

## Change Workflow

### Step 1: Author migration

```bash
cd /Users/matthewbyrden/Synced/Opta/1-Apps/1N-Opta-Cloud-Accounts
supabase migration new <descriptive_name>
```

### Step 2: Local validation

```bash
supabase db reset
supabase db lint
```

### Step 3: Review gates (must pass)

- [ ] SQL review by owner (Matthew) or delegated DB reviewer
- [ ] RLS and policy review completed
- [ ] Backward compatibility reviewed for `1D`, `1M`, `1F`, `1E`, `1L`, `1P`
- [ ] Tests updated if behavior changed

### Step 4: Apply to target project

```bash
supabase link --project-ref "$OPTA_SUPABASE_PROJECT_REF"
supabase db push
```

### Step 5: Post-apply verification

```bash
./tests/cross-app-auth-smoke.sh
supabase migration list
```

---

## Release Ring Order (Opta stack)

1. `1P-Opta-Accounts` (primary account portal)
2. `1F-Opta-Life-Web`
3. `1E-Opta-Life-IOS`
4. `1D-Opta-CLI-TS`
5. `1M-Opta-LMX`
6. `1L-Opta-Local` E2E environment

If any ring fails, halt rollout and open incident.

## Required PR Content for Migration Changes

- Migration filename + intent
- Affected tables/policies/functions
- Backfill/data-mutation details (if any)
- Rollback plan (forward-fix or restore path)
- Verification evidence (smoke test output)

## Forbidden Practices

- Applying schema changes directly in app code at runtime.
- Using service-role key in client-side runtime.
- Disabling RLS “temporarily” without incident ticket + timed rollback.

---

## Owner Cadence

- **Per migration:** enforce workflow + evidence before merge.
- **Weekly:** check migration drift and dashboard/manual changes.
- **Monthly:** sample audit 3 latest migrations for policy correctness.
- **Quarterly:** full governance review and rule tightening based on incidents.
