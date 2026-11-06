# Debugging Notes

Use this directory for durable troubleshooting knowledge that is likely to help with future incidents or investigations.

## When to add a note

Create a note when an investigation reveals a non-obvious root cause, a recurring failure mode, an important diagnostic technique, or a fix with useful prevention or recovery guidance.

Do not save every transient error, speculative diagnosis, routine log excerpt, or unverified workaround.

## Suggested file naming

Use a date and a short topic:

```text
YYYY-MM-DD-short-problem-description.md
```

## Recommended note structure

Each note should include, when relevant:

1. **Summary:** What failed and its observed impact.
2. **Environment:** Relevant versions and conditions, without sensitive identifiers.
3. **Symptoms:** What was observed, including exact safe error messages.
4. **Reproduction:** Reliable steps, if known.
5. **Investigation:** Checks performed and evidence gathered.
6. **Root cause:** Confirmed cause, or clearly labelled unknown.
7. **Resolution:** What changed and who approved consequential actions.
8. **Verification:** How the fix was checked and the observed result.
9. **Prevention:** Monitoring, tests, documentation, or process changes that reduce recurrence.
10. **References:** Related issues, commits, runbooks, or ADRs.

## Evidence and safety

- Separate observations from hypotheses.
- Do not present an unverified workaround as a confirmed fix.
- Redact tokens, passwords, private keys, personal data, and sensitive production values.
- Prefer small, relevant excerpts over large logs or dumps.
- Record commands only when they are safe, relevant, and appropriate for the intended audience.
- Never include secrets even if they appeared in an error message.

## Maintenance

Keep notes that remain useful. Correct outdated guidance transparently and link to a replacement when a note is no longer applicable.
