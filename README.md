# ProofPilot

**AI that proves its own work.** ProofPilot gives a coding model a feature request for a bundled task board, runs the resulting changes in Chromium, and records browser checks, screenshots, diffs, and traces. The worker can send a failed assertion back to the model for two repair attempts.

## Run locally

Prerequisites are Node.js **26.13.1**, npm, and rootless Podman on Linux with seccomp enabled and Chromium user namespaces available. The verifier image contains the pinned Playwright Chromium build.

```sh
npm ci
npm run build:verifier
npm run dev
```

Open [the dashboard](http://127.0.0.1:3000) and choose **Run rehearsal**. Rehearsal requires no model credentials. All services bind to loopback.

To restart the dashboard independently of an active run, start `npm run worker` and `npm run dashboard` in separate terminals. For a production build on the same machine, use `npm run build` followed by `npm start`.

## Live AI

1. Copy `.env.example` to `.env.local` and set `AI_GATEWAY_API_KEY` to a Vercel AI Gateway key. Restart the worker. The default generator is Eve with `openai/gpt-5.4`.
2. With the worker running, run `npm run smoke:live`. It requests one real structured patch, checks it, and prints its model, file names, and candidate hash.
3. Select **Live AI** and run the request. A first-try pass ends the run. An assertion failure is sent back with the current candidate source.

If Eve remains unavailable, set `PROOFPILOT_GENERATOR=gateway` in `.env.local` and restart the worker to use Gateway’s structured-output HTTP adapter. The manifest records which generator produced each attempt.

## Three-minute walkthrough

1. Start **Rehearsal** and open the baseline screenshot of the original Relay task board.
2. Select **Attempt 1** and open **Checks**. The scripted candidate moves completed tasks into Archive. The browser reload restores those tasks to the active board, and Playwright records the failed persistence assertion.
3. Select **Attempt 2**. The scripted repair saves the archived state. Compare the screenshots, open **Code diff** to find the persistence call, and download the browser trace.
4. If model access is configured, start **Live AI** and follow its own timeline. Candidate origin and browser verdict appear separately for every run.

## How the evidence is produced

The Next.js dashboard starts jobs through a separate local Node worker. The worker owns the run lifecycle, authorizes full-file replacements for the three demo files, and stages a cumulative candidate in memory. The candidate executes as static assets in a fresh offline rootless Podman container with an immutable verifier and deterministic task seed. The reload check preserves storage in the same Chromium context. The container keeps Chromium’s sandbox enabled, uses Podman’s deny-by-default seccomp profile with a targeted allowance for Chromium’s sandbox chroot, and drops container capabilities.

A run is verified only after all eight required checks pass and the worker commits the artifacts for the exact tested source hash. Run history is stored under `.proofpilot/runs`. Restarting the worker marks unfinished runs **Interrupted** and retains committed evidence. The app supports one active run at a time and one fixed feature request.

`npm test` covers patch authorization, repair sequencing, attempt exhaustion, infrastructure errors, and recovery. `npm run typecheck` checks the TypeScript interfaces.
