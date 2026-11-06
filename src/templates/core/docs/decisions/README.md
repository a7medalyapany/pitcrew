# Architecture and Technical Decisions

This directory contains Architecture Decision Records (ADRs): durable records of significant choices and why they were made.

## When to create an ADR

Create an ADR when a decision has meaningful long-term impact, affects system boundaries or interfaces, introduces a major dependency, changes security or data handling, or closes an important architectural trade-off.

Do not create an ADR for every implementation detail, routine refactor, or reversible local choice.

## Naming

Use a sequential number and a short, descriptive title:

```text
0001-use-example-approach.md
0002-separate-example-boundary.md
```

Choose the next unused number. Do not reuse a number, even if an ADR is superseded.

## Lifecycle

1. Create a new file from `ADR-TEMPLATE.md`.
2. Set its status to `Proposed` while the decision is under consideration.
3. Record the alternatives and trade-offs honestly.
4. Obtain the decision-maker's approval when required by the project's workflow and safety policy.
5. Mark the accepted record `Accepted` and record the decision date.
6. If a later decision replaces it, leave the original intact and mark it `Superseded` with a link to the replacement.

Typical statuses: `Proposed`, `Accepted`, `Rejected`, `Superseded`, `Deprecated`.

## Record-keeping rules

- ADRs are append-only in spirit. Do not silently rewrite history.
- Correct factual mistakes transparently.
- Record the context that existed when the decision was made.
- Separate facts, assumptions, and opinions.
- Include consequences, migration considerations, and follow-up work.
- Never include secrets or sensitive production data.
- Link to relevant ADRs from `docs/architecture.md`; do not copy the full decision into it.

## Template

Start with `ADR-TEMPLATE.md` and save the new record beside this README.
