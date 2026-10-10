# API and protocol

The game uses official iDos SDK methods for wallet identity, currency state, Items, packs and marketplace contracts. No client-created balance ledger or custom escrow is implemented. See [the iDos integration configuration](idos/SI4IPS8B-integration.md).

## Node service

Routes are implemented in `server/src/service.ts`. Default local endpoint is `http://127.0.0.1:3102`; the deployed browser uses the configured Render service.

| Route | Purpose |
| --- | --- |
| `GET /health` | Service health, room/queue counts and available capabilities |
| `GET /market/prices` | Reference statistics from verified completed sales |
| `POST /market/prices` | Synchronize the authenticated user's confirmed sale history; server verifies iDos records |
| `GET /wallet/imp?owner=<address>` | Exact mainnet IMP balance for a validated public Solana address |
| `POST /wallet/rpc` | Bounded, allowlisted Solana RPC relay for wallet operations |

Origin checks, request-size limits and rate limits apply. Session tickets are transient request data, never URL parameters or public logs. A Supabase service key is server-only. There is no public endpoint that accepts a caller's claimed trade price as a completed sale.

The WebSocket protocol defines room creation/joining, public matchmaking, mulligan, game actions and reconnect snapshots. The server applies the shared engine and filters each snapshot to hide opponent cards. Public room codes do not grant another player's seat. [Protocol and examples](../server/README.md) and `lib/net/protocol.ts` are authoritative.

## Local checks

```sh
curl http://127.0.0.1:3102/health
npm run test --prefix server
npm run test:integrations
```

Tests use isolated state and mock SDK responses for commerce; they do not issue real wallet transactions. Mainnet smoke checks must be performed and confirmed by a player.
