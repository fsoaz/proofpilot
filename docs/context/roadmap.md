# Roadmap

## Implemented in the local MVP

- Fixed Relay archive request and eight Playwright acceptance checks.
- Scripted fail-then-pass rehearsal, plus an Eve generator and a direct Gateway adapter for Live AI.
- Persistent local worker, bounded repairs, independent candidate verification, and interruption recovery.
- Run history, screenshots, source diffs, check results, and trace downloads.

## Pending demo validation

Run `npm run smoke:live` with an AI Gateway key, then complete a Live AI dashboard run. Record the actual model and outcome in [Test evidence](../execution/test_evidence.md). The existing rehearsal can be demonstrated without model access.

## Deferred

- Additional verified feature requests or third-party repositories.
- Multiple simultaneous runs and resuming unfinished work after a worker restart.
- Embedded trace viewer, hosted deployment, and advanced observability.
