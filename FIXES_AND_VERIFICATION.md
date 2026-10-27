# Remaining queue issues — fixed

All 12 remaining cases from the last audit have corrective code and passing regression coverage.

| Earlier case | Correction |
| --- | --- |
| A01: simultaneous bookings | The shared server validates and reserves the agency/date/time in a single saved command. Only one request can win. |
| A02: duplicate teller calls | The server ranks the current queue and assigns tickets atomically. Stale counter assignments are rejected. |
| A04: tickets returning after reset | Reset generations invalidate in-flight client results and stale server commands. Browsers no longer push whole ticket snapshots. Portal tracking uses unique ticket identity (and validated creation timestamps for legacy QR links), so a reused number cannot attach an old portal to another customer. |
| A05: cleared logs returning | Audit clearing is saved on the server. Polling replaces the browser's log view with canonical server entries. |
| A06: R-08 ignored | Both its enabled flag and autoCompletePrevious parameter are enforced. With auto-close disabled, the active ticket must be completed first. |
| A07: cancelling a completed ticket | Terminal and in-service tickets cannot be cancelled; a late cancellation cannot rewrite completion. |
| A08: service start overwritten | Repeated start commands preserve the original timestamp and create one start event. |
| A09: silent local tickets on server failure | Creation requires an acknowledged shared-server response. Errors are visible in the existing in-app notification system; no unshared fallback ticket is issued. |
| A10: failed saves reported as success | Commands run on a draft. Failed saving returns an error and leaves memory unchanged. Vite persistence writes a temporary file and replaces the cache atomically before acknowledging success. |
| A11: immediate estimates with closed counters | Unavailable estimates are represented explicitly and shown as Guichets indisponibles rather than zero minutes. Issuance remains possible outside opening hours. |
| A14: invalid appointments | Calendar dates, supported slots and future availability are checked in the store and server. This does not restore opening-hours blocking. |
| A15: unrelated QR confirms presence | Decoded URLs must match the app origin, selected agency and presence action, and carry the current kiosk proof. The server validates that proof; reset rotates it. Invalid scans stay open for retry. |

The previous fixes remain covered: bounded customer names, feedback validation and deduplication, weighted VIP versus configured PMR head-of-line, consistent pending-arrival projections, data-based dashboard figures, agency URL hints and removal of browser-native dialogs.

## Implementation

- server/queueApi.ts: server commands, validation, lifecycle, audit, idempotency and persistence acknowledgment.
- src/services/queuePolicy.ts: the same ranking rules are used by the server and browser estimates.
- src/services/queueStore.ts: acknowledged commands, canonical polling, generation protection and explicit failures.
- Screens await command results before showing success. Counter actions cannot be double-clicked while pending. Existing compact notifications handle errors.
- Existing cache data is read through a legacy loader. Old browser snapshot writes receive a refresh error instead of corrupting state.

## Verification

- 71 automated regression checks passed: 20 queue, 12 API, 16 concurrency/failure, 10 portal/metrics, 7 scanner/interaction, 6 notification checks.
- 3 real localhost HTTP smoke checks passed, including concurrent issuance and failed-save rollback.
- TypeScript and production build passed. The existing bundle-size warning remains.
- Tests use isolated memory fixtures. No live queue reset, audit deletion or deliberately induced real disk failure was performed. A copy of the existing cache and original sources was saved in this chat's work directory before final smoke testing.
- Rendered markup and actual callbacks are checked. Physical phone/camera scanning, responsive screenshots and production hosting/TLS were not verified.

Run npm test, npm run lint and npm run build. npm run test:http separately runs the loopback HTTP test and requires local network access in sandboxed environments.

## Running the update

Refresh every open kiosk, teller, portal and TV tab so all screens use the new command API and fresh kiosk proof. The shared API must be running (npm run dev); a static dist-only deployment does not provide it. Existing client-side authentication remains a separate deployment concern; a kiosk proof validates the issued QR content, not a physical location attestation.


## Called-ticket expiry follow-up

R-09 now expires unpresented called tickets after its configurable timeout (default 180 seconds), releases counters and audits automatic absence. Recalls refresh the window; started services do not expire. The server runs a background sweep every second and reconciles requests/restarts. TV call ordering includes completed calls and avoids old-call animations. Called and serving dashboard counts are separate. VIP weighted priority and PMR head-of-line are explicit in the rule base. Per-agency rule edits persist on the server. No native counter confirmation dialogs exist in the current source.

Validation: 90 regression checks, 3 real HTTP checks, TypeScript and production build passed. Real port-3000 state confirmed C-005/P-001 absent, C-012 completed, with two automatic absence audit entries.
