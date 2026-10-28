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


## Wait estimates and audit snapshots

Waiting time now projects the workload of each eligible counter using the actual operations ahead and the remaining duration of services already started. The selected customer’s own operation duration does not affect their wait before call. Parallel counters, priority, specialization, overflow, agency isolation and unavailable counters are covered.

The shared estimator runs in the browser and on the server. Ticket issuance and check-in save server-computed estimate snapshots with people ahead, calculation time and context. Check-in preserves the earlier pre-presence projection. Audit rows distinguish estimated and actual waits; inspection and CSV/JSON exports include the calculation metadata. Historical entries are preserved.

Validation: 124 regression checks, 3 local HTTP checks, TypeScript checking and production build passed. Isolated browser fixtures confirmed matching ~8-minute kiosk choices and the audit values/timestamp/context.


## Queue position and parallel service

The portal and kiosk receipt identify the ahead count as queue order. When a customer can be called immediately despite tickets ahead, they explain that an available counter can serve them in parallel. New visits with only one free counter do not label both queued customers immediate. Equal-timestamp tickets retain their existing FIFO order during estimate recalculation.

Validation: 127 regression checks passed. Isolated browser checks verified 0 ahead/immediate and 1 ahead/immediate with two free counters, and 1 ahead/~8 minutes with one free counter.


## Complete kiosk operation catalogue and safe PIN errors

Aligned the published and built-in banking catalogues at 4 caisse, 4 particuliers, 3 professionnels and 3 portefeuille operations. Older saved banking configurations receive missing built-in operations/categories while retaining custom operations and configured values. The kiosk resolves its selected category from the latest configuration, uses a single scrolling area and shows a continuation button when lower choices are off-screen.

Incorrect-PIN responses now use a generic message without credential values or recovery hints.

Validation: 138 regression checks, TypeScript and production build passed. Isolated browser checks compared all phone/kiosk operations, exercised the last operation of each category at 1280x720, 1024x600, 768x1024 in accessibility mode, and 390x844; verified an open category refreshes with catalogue changes; and checked the visible incorrect-PIN error.


## Live phone estimates after kiosk check-in

The phone derives queue position and estimated wait from one copied, timestamped server-state update, including current counter workloads and the latest confirmed version of its tracked ticket. This avoids relying on mutable ticket objects or stale pre-presence copies. The phone requests fresh queue state on focus, return from background, restored pages and reconnection; an older pending request cannot block a refresh after a new resume cycle.

Validation: 149 regression checks passed, including 11 phone state/resume checks. Isolated browser sessions running the real app against the queue API confirmed that normal kiosk check-in updates an open phone projection, and priority check-in updates both a confirmed phone ticket and a pending phone projection, without page reload.

## Configurable app-ticket arrival tolerance (R-13)

Added R-13 to the rule base and automatically upgraded saved twelve-rule configurations without resetting existing values. The configurable integer X defaults to 2 (range 0–50). Count other physical check-ins in the same agency and category after app-ticket issuance and before its presence confirmation, including older remote tickets that arrive later and customers already called, completed or cancelled after checking in. Pending tickets and other queues do not count.

At check-in, an app ticket with N <= X keeps its original FIFO anchor; beyond X, or with R-13 disabled, its FIFO anchor is check-in. The count is frozen at confirmation, while changes to X apply to tickets still waiting. Server-generated issuance and arrival sequences resolve same-millisecond events. Arrivals do not interrupt called or serving customers. PMR/VIP and other priority rules remain applicable. Actual waiting time and SLA escalation use physical presence time.

The shared policy drives dispatch, phone estimates, kiosk receipts and the rule simulator. Phone and kiosk explain the retained or check-in rank; check-in and call audit entries record the count, threshold and decision. Client-supplied ordering facts are overwritten by the server.

Appointment tolerance remains separately configurable in minutes under R-03. It now uses the appointment date and Africa/Algiers time. Early arrivals receive the bonus from the window start; arrivals by the grace deadline keep it while waiting that day, rather than losing it because staff service is delayed. Later arrivals do not receive that bonus.

Validation: all 171 regression checks passed, including 22 new tolerance checks; TypeScript checking and production build passed. Isolated real-app browser sessions with the actual queue middleware verified two later kiosk check-ins, retained phone/kiosk rank, editing X through the rule interface, live estimate changes and matching dispatch. The previous physical-FIFO phone-refresh browser scenario also passed with R-13 explicitly disabled. The separate TCP HTTP smoke test was attempted but blocked by sandbox localhost connection permissions (EACCES); it did not reach its assertions.
