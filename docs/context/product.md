# Product

**ProofPilot gives developers browser evidence for AI-generated code changes.** A developer starts a feature request, follows the candidate and any repairs, and inspects the exact behavior that passed or failed.

## First demo

ProofPilot ships with Relay, a small task board. The request is **Archive completed tasks**. Completed tasks move to an Archive view, incomplete tasks remain active, and the archive survives a page reload. A newly completed task stays active until the user explicitly archives it.

| Mode | Candidate origin | Demonstration |
| --- | --- | --- |
| **Rehearsal** | Two scripted changes | Archiving initially works in memory, then fails after reload. The repair saves archive state and passes the browser checks. |
| **Live AI** | Model-generated changes | The model proposes edits. If verification fails, it receives the failure and current source for up to two repairs. A first-attempt pass ends the run. |

Both modes use the same patch validator and browser checks. The dashboard shows candidate origin independently of the verdict. **Verified** means all eight acceptance checks passed for the recorded candidate.

## MVP boundary

The first release serves one local user, one active run, and one bundled feature request. The evidence includes before and after screenshots, attempt-level checks, a unified diff, and downloadable Playwright traces. [Local setup and demo walkthrough](../../README.md)
