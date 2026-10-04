# Genesis NFT devnet setup and acceptance

IMPERIVM keeps demo play and demo packs as its default experience. The optional Genesis path uses **Metaplex Core NFTs and Core Candy Machine**, with no mint price, payment guards or bot tax. A wallet pays only account rent and network fees in test SOL after a visible simulation and individual Phantom approval.

The demo edition has **40 original artworks, one NFT of each card type**. `audit` is a later gameplay card and is excluded from `GENESIS_IDS`. Non-sequential config lines provide pseudo-random mint order; they do not provide cryptographic randomness guarantees. The edition has 40 total mint slots, rather than unlimited copies of every artwork.

Compressed Bubblegum NFTs were considered as a separate distribution option. This release does not create a Bubblegum tree or submit compressed mints: Bubblegum's tree/proof workflow is a separate pipeline from this Core Candy Machine implementation. The DAS ownership parser understands a compression flag, but that does not make the current mint path compressed.

## Required configuration

Publish the app and all card images at its actual public HTTPS origin. Then build/deploy with:

```dotenv
# The actual origin only: HTTPS, no path, query, credentials or placeholder domain.
NEXT_PUBLIC_NFT_METADATA_BASE_URL=https://YOUR_ACTUAL_PUBLIC_APP_HOST

# Add these confirmed public addresses after completing setup.
NEXT_PUBLIC_GENESIS_COLLECTION=CONFIRMED_CORE_COLLECTION_ADDRESS
NEXT_PUBLIC_GENESIS_CANDY_MACHINE=CONFIRMED_CORE_CANDY_MACHINE_ADDRESS

# Optional server-only ownership indexer credential. Never use a NEXT_PUBLIC prefix.
HELIUS_DEVNET_API_KEY=YOUR_SERVER_ONLY_DEVNET_KEY
```

Replace the placeholders with real operator values. These examples are not configured deployments. The client refuses collection creation without a validated origin and successful public metadata/art reads. The Solana RPC and wallet chain are fixed to devnet; there is no mainnet RPC switch.

Without Helius, with an unavailable/throttled proxy, or for a different locally selected collection, ownership falls back to Metaplex Core RPC reads. Locally saved deployment records contain public account addresses, authority and origin only. An environment-configured collection takes precedence over a locally selected collection.

Before collection creation, the browser checks `/api/nft/metadata/genesis` and all 40 card JSON routes against canonical names, descriptions, symbols, images, external URLs and attributes. It also fetches the WebP headers of the collection cover and every card image. Reads use four workers, exact configured-origin routes, timeouts and rejected redirects; NFT-supplied URLs are not followed. Failed workers are drained before the verification returns.

## Operator workflow

1. Open the deployed `/devnet` page. Connect the intended Phantom authority wallet and obtain test SOL from the [Solana devnet faucet](https://faucet.solana.com/).
2. Prepare the collection. Review the simulated rent/fee, destination, new public address and devnet network. Click the visible approval button and approve that exact transaction in Phantom.
3. After confirmed collection creation, prepare and separately approve the free Core Candy Machine. Its collection, authority, supply and non-sequential configuration are checked against Genesis.
4. Load the config lines in five batches of eight, with one simulation and approval for each batch. Progress is read from the machine. Existing lines are checked before a resumed batch is prepared.
5. Copy the confirmed collection and machine public addresses into the environment values above and rebuild/redeploy. Retain Explorer receipts and public recovery addresses.
6. Open `/packs`, prepare one NFT pack, review the simulation, and separately approve the mint. The asset is verified as a Core account owned by the connected wallet, linked to the configured collection and a canonical Genesis card URI before the card is unlocked.

No resource, wallet or funded transaction is created by merely opening a page. SDK new-account signers for collection/machine/asset accounts are ephemeral browser-memory signers; their secrets are never stored, copied into configuration, or sent to a server. The user's wallet key is not generated, imported or handled by the app. Wallet signing and broadcasting occur only through the visible approval flow. Returned wallet messages and payer signatures are checked before broadcasting.

## Interrupted transactions and changes of wallet/deployment

The first signature is derived from the signed wire transaction before broadcast. A transport failure, wrong RPC signature or confirmation timeout retains that signature and the new public account address as **unresolved**, rather than claiming confirmation or automatically sending a new mint. A confirmed on-chain error is shown as failed.

Pending mint/recovery records contain public data only and are stored per wallet, metadata origin, collection and Candy Machine. They block replacement preparation until read-only recovery verifies ownership/resources or a signature-status read proves confirmed failure. A retry reads status/ownership; it never signs or resends. An absent signature remains unresolved. Copy the displayed public addresses and Explorer receipts if browser storage is unavailable; in-memory guards do not survive a reload in that case.

Switching wallets, collections, Candy Machines or origins invalidates pending UI plans and in-flight read results. The scope is rechecked after Phantom returns, before broadcast, and before accepting a card or saving a resumed deployment. A confirmed receipt remains visible while setup inputs refresh after saving a deployment. Late ownership reads cannot overwrite a just-verified mint.

Setup recovery checks existing accounts from the displayed addresses and verifies the collection and machine authorities. Collection/machine recovery can use the confirmed existence of the exact new account; an unresolved config batch waits for a confirmed signature before clearing its guard. A retry never automatically creates a duplicate resource.

## Public DAS proxy limits

`/api/nft/owned` validates the wallet address and uses the fixed Helius **devnet** endpoint with a server-only key. It bounds requests to eight per client/minute, three distinct in-flight reads, five pages of 100 assets, 30 upstream page requests/minute and 1 MiB per upstream response. Identical in-flight scope reads share one request; results cache for 30 seconds by owner, collection and metadata origin. Capacity/rate rejection returns 429 with a retry delay so the client can use Core RPC.

These controls are in process memory. A deployment with multiple instances or restarts needs host/provider-wide quota limits or a shared rate limiter to enforce one global account budget. The forwarded client address is an additional throttle, not an authentication boundary; the global per-instance upstream cap does not depend on its authenticity. The proxy never signs transactions or accepts caller-provided RPC/metadata endpoints.

## Verified offline

Run the installed tools without package downloads:

```sh
./node_modules/.bin/tsx scripts/tests/metaplex.test.ts
./node_modules/.bin/tsx scripts/tests/integrations.test.ts
./node_modules/.bin/tsc --noEmit --incremental false
```

The SDK compatibility fixtures build and serialize collection creation, achievement creation/update, Core Candy Machine creation, all five config batches and a mint as v0 transactions within the packet size limit. RPC methods are mocked; browser wallet approvals are never invoked.

The deterministic recovery cases cover successful confirmation, uncertain broadcast, RPC-signature mismatch, confirmation timeout, confirmed failure, invalid payer signature, and wallet/deployment changes before or during signing. Signature-status reads distinguish processed/absent results from confirmed success/failure. Integration fixtures cover exact owner/deployment acceptance, DAS network/malformed-response fallback, all 41 metadata/art checks including split image-header chunks, invalid/missing metadata/art, in-flight deduplication, cache hits, concurrency rejection and upstream/client quotas. These fixtures perform no live RPC, funding, real wallet signing, broadcasting or minting.

## Live acceptance still required

The following have not been demonstrated with a real public metadata origin and user-approved devnet transactions:

- Successful public-origin verification in the deployed browser.
- Phantom display and separate approval of collection, machine, each config batch and a mint.
- Confirmed Core/Candy Machine accounts, all 40 loaded entries, free guards and minted-count progression.
- A real random Genesis NFT in Phantom/Explorer with verified artwork, collection and owner.
- Ownership refresh/unlock in the collection and deck UI after that mint.
- User rejection, interrupted confirmation and recovery across reload/account/deployment changes against the live network.
- A sold-out 40-card edition while demo packs remain available.

No live Genesis collection, machine address, mint signature or Phantom ownership result is claimed by the offline checks. Mainnet resources, paid sales and compressed minting remain outside this implemented release.

References: [Core Candy Machine](https://www.metaplex.com/docs/en/smart-contracts/core-candy-machine), [Core Candy Machine minting](https://www.metaplex.com/docs/smart-contracts/core-candy-machine/mint), [Umi public keys and signers](https://www.metaplex.com/docs/dev-tools/umi/public-keys-and-signers), [Metaplex Core JavaScript SDK](https://www.metaplex.com/docs/smart-contracts/core/sdk/javascript).
