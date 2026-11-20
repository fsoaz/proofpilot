# Repository Guidelines

## Project Structure

- `app/` contains the Next.js dashboard, styles, and local runs API.
- `runner/` contains the persistent worker, candidate generators, patch validation, run storage, and Node tests. `agent/` configures Eve for Live AI.
- `fixture/` contains the Relay task board. `rehearsal/` supplies the scripted candidates. `shared/` defines the run protocol and deterministic task seed.
- `verifier/` contains the trusted Playwright checks. `Containerfile` builds the isolated Chromium image. See [architecture](docs/context/architecture.md) for the run lifecycle.

## Build, Test, and Development

Use the Node version in `.node-version` and rootless Podman on Linux.

- `npm ci` installs locked dependencies.
- `npm run build:verifier` builds the verifier image. Rebuild it after changing the verifier or seed.
- `npm run dev` starts the worker and dashboard at `http://127.0.0.1:3000`.
- `npm test` runs Node regression tests. `npm run typecheck` checks TypeScript. `npm run build` builds the production dashboard.
- `npm run smoke:live` validates a real structured patch with AI Gateway credentials and the worker running.

## Coding Style

Match nearby code. Use two-space indentation, double quotes, and semicolons in TypeScript and JavaScript. Use camelCase for functions and variables, PascalCase for components and types, and `.mts` for Node runner modules. Reuse statuses and check IDs from `shared/protocol.ts`. The repository provides a type-check command.

## Testing and Evidence

Name runner tests `*.test.mts` and place them in `runner/`. For changes to the fixture, verifier, or run flow, run Rehearsal. Confirm attempt 1 fails the reload check and attempt 2 passes all eight checks. Keep acceptance checks and seed data outside candidate-controlled files.

## Commits and Pull Requests

Follow the existing `feat: implement candidate generation and patching system` example with a short, imperative subject. In the PR, summarize the behavior change and list the checks you ran. Link related issues when available and include screenshots for dashboard changes. Keep credentials in `.env.local` and generated evidence in the ignored `.proofpilot/` directory.
