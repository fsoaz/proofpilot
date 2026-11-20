# Development conventions

- Use the Node version in [`.node-version`](../../.node-version), npm, and the committed lockfiles. Rebuild the Podman image after editing the browser verifier, its dependencies, or the task seed.
- Use [the shared protocol](../../shared/protocol.ts) for run statuses and check IDs. Keep model output, authorization, browser checks, and evidence rendering in their existing components.
- Authorize full-file replacements for `index.html`, `styles.css`, and `app.js` only. Reject duplicate paths, malformed replacements, symlinks in the fixture, unchanged candidates, files over 32 KiB, and patches over 64 KiB in total.
- Keep generated code in the candidate browser runtime. Keep acceptance definitions, seed data, verifier configuration, and reporting in developer-owned code.
- Store model credentials in `.env.local` and use [`.env.example`](../../.env.example) to document optional configuration. Run manifests and artifacts belong in the ignored run directory.
- Use [the work log](../execution/work_log.md) for decisions and completed milestones and [test evidence](../execution/test_evidence.md) for observed results and gaps.
