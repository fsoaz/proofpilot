# Local runs API

The Next.js dashboard proxies these same-origin routes to the loopback worker. JSON responses use `Cache-Control: no-store`. Client-visible failures return an `error` message in JSON.

| Method and path | Success |
| --- | --- |
| `POST /api/runs` | `202` with `{ id }` after the worker persists the run. Send `Content-Type: application/json` and `{ "mode": "rehearsal" }` or `{ "mode": "live" }`. |
| `GET /api/runs` | `200` with `{ runs, active, live }`. Summaries are sorted newest first. `live` reports whether a Gateway key is configured. |
| `GET /api/runs/{id}` | `200` with the manifest, including events, attempts, checks, and registered artifacts as they become available. |
| `GET /api/runs/{id}/artifacts/{name}` | `200` with the registered PNG, plain-text diff, or downloadable ZIP trace. |

Start errors include `400` for invalid JSON or mode, `409` for an active run, `413` for an oversized body, `415` for an unsupported content type, and `422` when Live AI lacks a Gateway key. A missing run or artifact returns `404`. Requests rejected by the local host or origin checks return `403`. Worker recovery or unavailability returns `503`.

Poll a started run until it reaches `VERIFIED`, `FAILED`, `ERROR`, or `INTERRUPTED`. Use registered artifact names from the manifest to build download links. The API accepts a mode only and uses the fixed feature request from [the shared protocol](../../shared/protocol.ts).
