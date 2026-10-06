# WebSocket PvP verification — 2026-10-06

Scope: authoritative free custom games, six-character room codes, existing engine/content unchanged.

## Automated checks

- `npm run build --prefix server`: strict Node-only compilation of the service and shared engine, with no DOM library.
- `npm test --prefix server`: strict compilation of tests plus 10 actual WebSocket integration tests; all passed. Includes a real 10-second socket break, resume-token authentication, current-state recovery after the other player moves, illegal foreign attacks, third-seat/name takeover denial, stale revisions, full match through all eight engine actions, 75-second deadline, reversed mulligan picks, payload/origin/deck/rate validation, expiry and departure cleanup.
- `npm run build`: production Next.js build passed.
- `npm run smoke`: existing engine, AI, HTTP matchmaking, card/action/presentation regressions passed.
- Protected files and existing card/hero/deck/rules modules are unchanged. The pure deck validator and room-code helpers were moved without changing behavior.

## Browser checks against the production build

Two independent in-app browser tabs joined a server-created code. Both displayed their own hand and synchronized moves. A reload restored the same seat and current match. Cards, queued spells, attacks, ruler power, staking/unstaking, surrender and return to the lobby were exercised through ordinary UI controls.

The final complete match used Builder against Whale, reached block 17, and finished with matching victory/defeat results. The second run performed 63 moves through the browser controls; the winner had 25 treasury and the defeated opponent had -1 in the unmodified engine state. See `full-match-victory.jpg`.

A browser run exposed the risk of a 35-second JS watchdog closing healthy background sockets after a delayed timer. The client now tolerates hidden documents and scheduler pauses; server control-frame ping/pong still checks transport liveness. Returning to a visible tab requests ping/sync. The complete browser match above passed after this fix. Close code 4001 also stops retries after another tab resumes the seat.

The viewport override did not resize this browser, so narrow layout was checked using a temporary same-origin iframe containing the actual `/play` page at 390 × 844. The saved seat automatically resumed in that frame. Two long legal player names wrapped, the turn indicator moved below the ruler, and the rendered document measured `clientWidth=390`, `scrollWidth=390`. See `mobile-390.jpg`. The temporary public harness was removed after verification.

## Practical limits

The service follows the requested one-process in-memory architecture. Deployments/restarts lose rooms. If both claimed seats disconnect, the room is deleted; the ten-second reconnect test keeps the other player connected. Only custom games use this WS service; random matchmaking remains on the existing HTTP transport. Render/Vercel deployment was documented, not performed.
