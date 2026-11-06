# Definition of Done

A change is done when the applicable requirements below are satisfied or when remaining gaps are explicitly disclosed and accepted by the responsible human.

The installed workflow profile is **{{PROFILE}}**. Apply its additional requirements where they are defined. A profile does not override the project's safety policy or grant permissions.

## 1. Scope and requirements

- [ ] The delivered change addresses the agreed request.
- [ ] The implementation stays within the approved scope.
- [ ] Unresolved assumptions or requirement gaps are documented.
- [ ] Relevant existing behavior and compatibility expectations were considered.

## 2. Implementation quality

- [ ] The change follows established project conventions and architecture.
- [ ] Error cases and relevant edge cases are handled.
- [ ] No unnecessary dependency, service, permission, or configuration was introduced.
- [ ] No unrelated changes were included without justification.

## 3. Verification

- [ ] Relevant project-defined checks were identified.
- [ ] Authorized checks were run where feasible.
- [ ] Results are reported accurately, including failures.
- [ ] Checks not run, and the reason they were not run, are disclosed.
- [ ] No claim of success is made without observed evidence.

Project-specific commands and verification procedures must be confirmed from authoritative project documentation or the responsible human. This checklist does not prescribe universal commands.

## 4. Review and safety

- [ ] The change was reviewed against the request and plan.
- [ ] Security, privacy, data handling, and failure behavior were considered where relevant.
- [ ] Required approvals were obtained before approval-gated actions.
- [ ] No secrets or sensitive data were added to source code, logs, or documentation.
- [ ] External side effects and destructive actions stayed within approved scope.

## 5. Documentation and handoff

- [ ] Canonical documentation was updated when materially affected.
- [ ] Significant decisions have an ADR when appropriate.
- [ ] Reusable debugging or operational knowledge was recorded when useful.
- [ ] Remaining risks, limitations, and follow-up work are disclosed.
- [ ] The completion report describes the changes and actual verification evidence.

## 6. Profile guidance

The selected profile may add review depth, planning detail, evidence requirements, or approval checkpoints. It must not weaken this baseline or imply that a capability is enforced when the selected AI tool cannot enforce it.

## Completion status

Choose one:

- **Done:** Applicable requirements are satisfied and evidence is available.
- **Done with accepted gaps:** Remaining gaps are explicit and accepted by the responsible human.
- **Not done:** Required work, verification, or approval remains outstanding.
