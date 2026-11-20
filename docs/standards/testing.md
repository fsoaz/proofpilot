# Testing

| Check | Command or action |
| --- | --- |
| Patch authorization, cumulative repair, attempt limits, and recovery | `npm test` |
| TypeScript interfaces | `npm run typecheck` |
| Production compilation | `npm run build` |
| Real browser verification | Run Rehearsal from the dashboard after `npm run build:verifier`. |
| Credentialed patch generation | Run `npm run smoke:live` with the worker and optional Eve service running, then run Live AI in the dashboard. |

## Browser acceptance

The [trusted verifier](../../verifier/browser.mjs) begins every candidate attempt with deterministic fixture data in a fresh Chromium context. The reload step stays in the same context and origin to exercise the app's actual storage.

| Check | Expected behavior |
| --- | --- |
| `control` | Seeded tasks start on the active board and the archive action can be invoked. |
| `moved` | All initially completed tasks leave the active board. |
| `retained` | Incomplete tasks remain on the active board. |
| `visible` | The Archive view contains exactly the moved tasks. |
| `persistence` | Reload preserves both the active list and the archived list. |
| `completion` | The user can still complete a task. |
| `explicit` | A newly completed task remains active until the user explicitly archives it. |
| `duplicates` | Repeating the archive operation preserves one copy of each archived task. |

For Rehearsal, expect attempt 1 to fail `persistence` and skip its dependent checks. Attempt 2 must pass all eight. Review both attempts and confirm screenshots, the unified diff, and the trace are accessible. To test recovery, interrupt the worker after a baseline has been saved, restart it, and confirm the run is marked **Interrupted** with its baseline evidence available.
