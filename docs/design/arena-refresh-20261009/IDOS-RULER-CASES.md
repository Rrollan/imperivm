# iDos ruler cases — operator handoff

No Title, payment catalogue, token or deployment was modified in this implementation. No real checkout, wallet signature, token issue or mint was performed.

## Backend definition

Reuse CollectionID IMPERIVM_AGORA. Preserve all 99 card IDs and the normal Agora pack definition/odds. Add four separate ruler collectibles:

| Collectible ID | Ruler | Rarity |
| --- | --- | --- |
| ruler-athena | Athena | 5 |
| ruler-hermes | Hermes | 5 |
| ruler-hephaestus | Hephaestus | 5 |
| ruler-poseidon | Poseidon | 5 |

Define pack `OLYMPUS_RULER_CASE`: one drop, exact price 200 virtual IMP, rarity 5 weight 100, all other rarity weights 0, minimum rarity 5. No maximum-rarity restriction, pity, bonus drops or alternative currency prices. Duplicate conversion for rarity 5 is 100 **collection currency**, not IMP. Each ruler is intended to have a 25% chance. Do not change the normal pack's card probabilities or let rulers appear in it: its rarity-5 weight remains zero.

The local gateway samples the four rulers uniformly and serializes purchases. The live gateway validates the definition before calling the SDK, then re-reads server-owned collectibles to verify the award. An invalid response does not trigger a second automatic purchase. Backend ownership, not localStorage or a client `verifiedHero` field, authorizes a case ruler in WS and HTTP play.

## Activation gate

```
NEXT_PUBLIC_IDOS_RULER_CASE_TYPE_ID=OLYMPUS_RULER_CASE
NEXT_PUBLIC_IDOS_RULER_CASE_ENABLED=false
```

Default is false. Keep it false until an operator verifies that the configured iDos Title supports rarity 5, the intended pool has exactly these four eligible rulers, and the backend guarantees equal 25% selection within that rarity. SDK numeric Rarity types alone do not establish this distribution. Confirm response/count/duplicate behaviour in a non-paid test. Only after the user's authorization and the existing checkout acceptance should an operator enable this flag in the frontend and run a paid test. Frontend and authoritative server need the same Title/Collection IDs; see the root economy guide. Server uses IDOS_TITLE_ID and IDOS_COLLECTION_ID, never a client-selected backend.

For the iDos host, use a responsive iframe at width 100%, max-width 1280px. The child fills its viewport. Check landscape on an actual phone and verify storage/wallet/login under the host's iframe policies. The local embed-preview harness has no SDK credentials and cannot prove those permissions.

The UI is available in local demo now. Real case purchases remain disabled and labelled “Coming to iDos”. Local free rulers can always play online with legal free decks. A demo-only case ruler cannot bypass server entitlements.
