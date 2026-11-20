# Review notes

The architecture review approved a one-feature local MVP and requested changes to execution, isolation, and demo provenance.

| Review item | Implementation |
| --- | --- |
| Long-lived jobs | A separate local worker owns runs independently of Next.js request lifetime. |
| Interrupted runs | Worker startup marks unfinished runs `INTERRUPTED` and preserves committed evidence. |
| Patch and verifier independence | The worker authorizes a static file allowlist. The developer-owned verifier runs offline in rootless Podman. |
| Repair semantics | Repairs build on the most recent accepted source. Each browser attempt starts from a fresh environment. |
| Rehearsal credibility | Candidate origin is visible in the dashboard and manifest. The verification verdict comes from Playwright in both modes. |
| Eve integration checkpoint | Eve reported healthy with `openai/gpt-5.4` and an empty tool list. Credentialed output remains pending. A direct Gateway adapter is available through configuration. |

The rehearsal gives a repeatable demonstration of browser verification. A credentialed run is the remaining evidence for model-generated changes and feedback-driven repair when a browser check fails.
