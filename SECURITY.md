# Security Policy

Super-Doctor is a demonstration project, but it handles authentication, session data and a
streaming API. If you find a way to break any of those, please report it privately.

## Reporting a vulnerability

Use GitHub's private vulnerability reporting: **Security** tab → **Report a vulnerability**.
Please do not open a public issue for an unfixed vulnerability.

Include: what you did, what happened, and what you expected. A short reproduction is worth more
than a long write-up. Do not include real patient data, real credentials, or a working exploit
against a deployment you do not own.

## What to expect

This is a personal project, so support is best-effort: a first reply within ~7 days, and an honest
"this is out of scope for now" when that is the answer. Fixes land on `main` and are noted in
[CHANGELOG.md](CHANGELOG.md); the reporter is credited unless they prefer otherwise.

## In scope

- Authentication and authorization: JWT handling, session ownership, reading another user's
  consultations or profile.
- The SSE endpoint and the output guard: leaking hidden instructions, bypassing the sentence-level
  guard, or injecting content into streamed events.
- The red-flag screen: making a genuine emergency bypass the deterministic gate.
- Prompt injection that changes behaviour across users or persists into the profile/memory layers.
- Dependency vulnerabilities with a plausible path through this codebase.
- Secrets accidentally committed to the repository.

## Out of scope

- The quality or medical accuracy of model answers — that is an evaluation concern, please open a
  normal issue or see [docs/evaluation.md](docs/evaluation.md).
- Anything requiring a live `DEEPSEEK_API_KEY` you do not own, or a third-party service outage.
- Missing hardening that the README already lists under known limitations.

## Supported versions

Only `main` is maintained. There are no backport branches.
