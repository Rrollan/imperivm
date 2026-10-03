# Asset manifest schema

`Artifacts/asset-manifest.json` records the provenance of every AI-generated illustration in `public/cards/`, `public/heroes/` and (after 1B) `public/boards/`. The file is public — it **never** contains API keys, prompts with private metadata, or paths to raw generation scratch outside the ignored `.orchestration/imagegen/raw/` tree.

## Top-level fields

| Field | Type | Description |
|---|---|---|
| `version` | string | Schema version, currently `"1.0"`. |
| `summary.scope` | string | Human description of what the current manifest covers (pilot, full set, etc). |
| `summary.engine` | string | Statement that the game engine and content are unchanged by art. |
| `summary.style_reference` | string | Path to the binding style bible. |
| `assets` | array | One entry per accepted final asset. |

## Per-asset entry

```json
{
  "id": "imperator-liquidus",
  "kind": "card | hero | board | card-back",
  "model": "gpt-image-2.5-sunburst",
  "prompt": "...",
  "negative": "...",
  "size": "1024x1536",
  "quality": "high",
  "output_format": "webp",
  "asset_path": "public/cards/imperator-liquidus.webp",
  "raw_path": ".orchestration/imagegen/raw/imperator-liquidus.png",
  "generated_at": "2026-10-03T14:55:00Z",
  "variant_of": null,
  "review_notes": "Accepted as the package-1A pilot DeFi legendary. Strong silhouette, gold-and-violet palette holds, no baked text."
}
```

| Field | Type | Description |
|---|---|---|
| `id` | string | Stable asset id; matches the slug used by the engine (card id or hero id). |
| `kind` | enum | `card` for `public/cards/*.webp`, `hero` for `public/heroes/*.webp`, `board` for `public/boards/*.webp`, `card-back` for the back design. |
| `model` | string | Exact model name used, e.g. `gpt-image-2.5-sunburst` for finals. Never silently downgraded. |
| `prompt` | string | The exact prompt string sent to the API (with augmentations merged in). |
| `negative` | string | The negative/avoid constraints sent to the API. |
| `size` | string | `WIDTHxHEIGHT` passed to the API. |
| `quality` | string | `low`, `medium`, `high`, or `auto`. |
| `output_format` | string | `png`, `jpeg`, or `webp`. The brief mandates WebP finals. |
| `asset_path` | string | Repo-relative path under `public/`. |
| `raw_path` | string | Repo-relative path to the original raw generation under `.orchestration/imagegen/raw/` (gitignored). |
| `generated_at` | string | ISO 8601 UTC timestamp of the accepted generation. |
| `variant_of` | string \| null | If this entry replaced an earlier draft, the `id` of the previous entry. |
| `review_notes` | string | Coordinator-facing acceptance / regeneration notes. |

## Secret policy

- The manifest **must not** contain the API base URL, API key, request IDs, account ids, or any path outside the repo.
- All credentials live outside the repository in `~/.config/opencode/opencode.json` and are loaded by an out-of-tree helper script at generation time, then discarded.