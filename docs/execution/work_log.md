# Work log

| Milestone | What changed |
| --- | --- |
| Scope and architecture | Chose the bundled Relay board, one archive request, and two execution modes. Adopted a persistent worker and explicit recovery and verdict rules after review. |
| Fixture and verifier | Added deterministic seed data, eight browser checks, screenshot and trace capture, and the offline rootless Podman image. A targeted seccomp adjustment allowed Chromium to start with its sandbox enabled on the test host. |
| Run orchestration | Added structured patch authorization, cumulative candidates, a bounded repair loop, atomic local persistence, and the Eve and direct Gateway adapters. |
| Dashboard | Added mode selection, run history, repair timeline, screenshot comparison, diff, check results, and trace downloads. |
| Verification | Confirmed the production rehearsal's reload failure and passing repair, exclusive run admission, dashboard refresh, and worker interruption recovery. |

See [Test evidence](test_evidence.md) for results and [Current task](current_task.md) for the remaining Live AI smoke test.
