# Runbooks

This directory contains repeatable procedures for operating, maintaining, diagnosing, or recovering this project.

A runbook is for a task that someone may need to perform reliably, including someone unfamiliar with the system.

## When to create a runbook

Create one for recurring operational tasks, deployment or release procedures, backup and restore, incident response, maintenance, recovery, or other procedures where missing a step could cause meaningful impact.

Do not create a runbook for a one-off development task or duplicate a general tutorial.

## Recommended structure

Each runbook should include the sections that apply:

1. **Purpose and scope:** What this procedure does and does not do.
2. **Owner:** Responsible team or role.
3. **Risk:** Expected impact and approval requirements.
4. **Prerequisites:** Access, permissions, dependencies, and required state.
5. **Inputs:** Required values, with secrets retrieved through approved secure channels rather than written into the document.
6. **Procedure:** Ordered, explicit steps with expected outcomes.
7. **Verification:** How to confirm success.
8. **Failure handling:** Safe stopping conditions and diagnostic steps.
9. **Rollback / recovery:** How to restore a safe state, or state clearly if rollback is unavailable.
10. **Escalation:** Who to contact and when.
11. **Last reviewed:** Date and reviewer.

## Execution and safety

- Follow `workflow/safety-policy.md` and any applicable approval process.
- Never assume that documenting a command authorizes running it.
- Identify destructive, irreversible, externally visible, or production-impacting steps before execution.
- Use placeholders for environment-specific values. Never write credentials or secrets into a runbook.
- Include expected results and stop conditions, not just commands.
- Test procedures safely before relying on them in a critical situation.

## Maintenance

Review a runbook after the procedure, infrastructure, permissions, or dependencies change. Mark unverified or outdated procedures clearly; do not leave them looking authoritative.
