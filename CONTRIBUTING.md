# Contributing to IMPERIVM

Current development is on `rebirth`. Start with the [README](README.md), [product](docs/product.md) and [architecture](docs/architecture.md).

Keep game rules in the shared deterministic engine; client animation must not decide multiplayer outcomes. Preserve card IDs, owned collections and saved-deck compatibility. Treat wallet identity, native iDos balances and demo currency as distinct.

Never commit `.env.local`, wallet keys, session tickets, refresh tokens or Supabase server keys. Financial operations must use the official SDK, explicit amount review, durable receipts and account-scoped recovery. Never retry an uncertain payment as a new debit.

Run the checks relevant to a change:

```sh
npx tsc --noEmit
npm run smoke
npm run test:integrations
npm run build
```

For server changes also run `npm run test --prefix server` and `npm run build --prefix server`. Test embedded UI in an iframe without `allow-forms`, as well as at landscape phone dimensions. Use local mocks for payment regressions; real transactions require player confirmation.

A pull request should explain the problem, resulting behavior and actual validation. Distinguish automated tests from observed live wallet behavior. Preserve original artwork and unfinished user assets; do not include generated builds in source commits.
