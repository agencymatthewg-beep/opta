# Problem-Solving Playbook

## Objective
Preserve concrete reasoning so debugging and implementation quality improve over time instead of resetting each session.

## Required Fields Per Decision
- `hypothesis`: clear statement of what is believed and why it might explain the problem.
- `evidence`: direct observations, logs, traces, tests, or measurements.
- `decision`: explicit action selected from alternatives.
- `outcome`: what happened after action.
- `follow_up_check_date`: absolute date for verification.

## Workflow
1. Capture a scoped hypothesis before changing code.
2. Record evidence from reproducible artifacts.
3. Log decision and rationale, including rejected alternatives.
4. Execute change with narrow scope and verification.
5. Record outcome and schedule follow-up check.
6. Distill lesson into prevention rule.

## Quality Rules
- No anonymous "fixed" entries.
- No missing follow-up date.
- Each entry must map to a verifiable action or test.
- Prefer short, concrete records over long narrative.
