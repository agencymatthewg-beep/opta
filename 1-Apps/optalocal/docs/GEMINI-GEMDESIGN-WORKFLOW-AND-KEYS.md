# Gemini "Gemdesign" Workflow and Key Contract

Last updated: 2026-03-02
Scope: Opta Local design-generation and implementation workflow

## 1) What "gemdesign" maps to in this repo

There is no installed skill named `gemdesign` in current Codex/Claude skill directories.

In this codebase, "gemdesign" behavior is implemented as:
- Gemini 3.1 design/spec generation
- plus the `frontend-design` skill family:
  - `frontend-design` (Claude skills)
  - `ai26-3e-frontend-frontend-design` (Codex skills)

## 2) Canonical workflow

Use this sequence for design work:

1. Build prompt/context with Opta aesthetic constraints.
2. Generate design brief/spec with Gemini 3.1.
3. Implement in code using Codex + `frontend-design` skill.
4. Run project build/tests.
5. Deploy and verify.

Primary references already in repo:
- `/Users/matthewbyrden/Synced/Opta/1-Apps/optalocal/1T-Opta-Home/WORKFLOW-DESIGN-ITERATION.md`
- `/Users/matthewbyrden/Synced/Opta/1-Apps/optalocal/1V-Opta-Learn/GUIDE-GENERATION-WORKFLOW.md`
- `/Users/matthewbyrden/Synced/Opta/1-Apps/optalocal/docs/reports/OPTA-AESTHETIC-CONTEXT.md`

## 3) Key requirements

Required environment keys:
- `GEMINI_API_KEY` for Gemini API calls
- `OPENAI_API_KEY` when using Codex/OpenAI model execution paths

Provider identity for Gemini:
- Provider ID: `gemini`
- Format heuristic: `AIza...`
- Env hint: `GEMINI_API_KEY`

Provider references:
- `/Users/matthewbyrden/Synced/Opta/1-Apps/optalocal/1R-Opta-Accounts/src/lib/provider-detection.ts`
- `/Users/matthewbyrden/Synced/Opta/1-Apps/1N-Opta-Cloud-Accounts/contracts/api-keys-contract.md`

## 4) Where keys are documented/stored in Opta

Cloud key contract and resolution order are documented in:
- `/Users/matthewbyrden/Synced/Opta/1-Apps/1N-Opta-Cloud-Accounts/contracts/api-keys-contract.md`

Resolution chain (highest priority first):
1. Environment variables
2. OS keychain
3. Cloud (Supabase, per-user, RLS)
4. Local config file
5. Default cloud key

Opta Accounts UI for key CRUD:
- `/keys` in Opta Accounts app (1R-Opta-Accounts)

## 5) Operational checks (safe)

Check key is loaded in current shell:

```bash
test -n "$GEMINI_API_KEY" && echo "GEMINI_API_KEY is set" || echo "GEMINI_API_KEY is missing"
```

List available Gemini models for this key:

```bash
curl -s "https://generativelanguage.googleapis.com/v1beta/models?key=${GEMINI_API_KEY}"
```

Do not hardcode keys in source, docs, prompts, or commits.

## 6) Security rules

- Never commit raw API keys.
- Never paste raw keys into shared markdown/docs.
- Prefer environment variables or keychain-backed retrieval.
- Treat cloud-stored keys as per-user secrets only (RLS protected).

