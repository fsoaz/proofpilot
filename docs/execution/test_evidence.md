# Test evidence

## Production rehearsal

Run ID `901dfddf-3a40-42fb-952b-6a6923a7cf47` finished **Verified**. Both candidates were scripted and tested in Chromium inside rootless Podman.

| Stage | Observed |
| --- | --- |
| Baseline | Archive control absent as expected. Existing task completion passed. |
| Attempt 1 | Archiving and Archive view passed before reload. Persistence failed. Two dependent checks were skipped. |
| Attempt 2 | All eight acceptance checks passed after saving archive state. |
| Evidence | Baseline and candidate screenshots loaded. The diff included the added persistence call. The candidate trace downloaded and had a ZIP signature. |

The verified candidate hash was `c124e3b700fef4eebaf801337a77a2683622dc24719956dd6b82bf938231dc78`. The original artifacts were saved under `.proofpilot/runs/901dfddf-3a40-42fb-952b-6a6923a7cf47/` in the implementation workspace. This directory is local and ignored by Git. Run Rehearsal to reproduce the evidence in another checkout.

## Other checks

- `npm test` passed all six regression tests. Type checking and the Next.js production build passed.
- Dashboard browser testing covered refresh during a run, concurrent-start rejection, attempt switching, trace download, history, and a 390 px viewport.
- A worker process was stopped during verification and restarted. The run returned `INTERRUPTED` with its saved baseline. A fresh run started from the original fixture, verified, and remained available after another worker restart.
- Eve's health and info endpoints responded locally. Credentialed model generation was unverified because the workspace had no AI Gateway key. [Live AI validation steps](current_task.md)
