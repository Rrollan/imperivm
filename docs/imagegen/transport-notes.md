# Image generation transport — Clodex SSE

Provider `clodex` (declared in `~/.config/opencode/opencode.json`) exposes
`gpt-image-2.5-sunburst` (and the related `gpt-image-2.5-flare`) only over
Server-Sent Events. The bundled imagegen skill (`scripts/image_gen.py`) is
non-streaming and refuses these models with HTTP 400 unless the request body
includes `stream=true`. That skill is frozen by the project brief, so we
built a separate streaming adapter at
`.orchestration/imagegen/sse_generate.py` (gitignored under
`.info/exclude`).

## Credentials

The adapter reads `provider.clodex.options.baseURL` and `provider.clodex.options.apiKey`
from the user's OpenCode config and forwards them only as an HTTP
`Authorization` header. Two transports have been used:

1. **`urllib.request.urlopen`** — original adapter. Authorization was passed
   through a `urllib.request.Request` header. This is what produced the
   first pilot (`imperator-liquidus`).
2. **`curl --http1.1 --no-buffer -K -`** — second adapter. The
   `Authorization` header is provided through curl's stdin config file, so
   the key is never present in the curl command's argv, in `ps` output,
   or in our stdout/stderr logs.

In both transports the key is never written to disk, never included in
subprocess argv, and never appears in any captured response file (responses
contain only the SSE body, never the request headers).

## Observed behaviour during 1A

The following is reported as data, not as a verified rule. Different
parameter combinations produced visibly different responses, and the
underlying cause was not investigated beyond what was required to keep
the package moving.

### Behaviour A — PNG streaming, b64_json, large encoded payload

Two attempts were made on `genesis-pfp` requesting a 1024×1536 PNG at
`quality=high`. In both attempts the SSE gateway delivered a valid PNG
header followed by several IDAT chunks, but the response ended mid-chunk
with no IEND. The client observed `json.JSONDecodeError: Unterminated
string starting at: line 1 column 12` because the closing JSON delimiter
was missing from the truncated body.

| attempt | transport                              | partial_images | event                       | bytes received |
| ------- | -------------------------------------- | -------------- | --------------------------- | -------------: |
| 1       | urllib SSE                             | 1              | `image_generation.partial_image` | 1,089,733 |
| 2       | curl `--http1.1 --no-buffer`           | 0              | `image_generation.completed` | 1,202,569 |

Evidence (mode 0600, response body only, no headers, no credentials):
`.orchestration/imagegen/raw/genesis-pfp.sse.txt` (and the second
copy written from the curl attempt).

The earlier pilot `imperator-liquidus` succeeded under the same urllib
transport with `partial_images=1` and a 2.4 MB raw payload. So the SSE
transport is not categorically broken on this provider; the difference
between the two attempts is not yet characterised.

### Behaviour B — JPEG streaming, b64_json, output_compression 80

Five pilots (the four blocked + one re-attempted) succeeded when the
request asked for JPEG with `output_compression=80`. Bodies were 290–340
KB, completed cleanly with `image_generation.completed`, and produced
JPEG files that Pillow could verify. The emitted JPEG dimensions did not
always match the requested size: some pilots came back at the requested
1024×1536, others at 1145×1374 (a 5:6 ratio). The cause of the dimension
difference between prompts was not investigated.

### Behaviour C — `response_format: "url"`

One attempt was made on `genesis-pfp` asking for a public URL instead
of b64_json. The gateway ignored the parameter and continued to return
b64_json in the SSE body. Behaviour-A truncation repeated. This option
is therefore treated as not effective at present.

## Effect on the 1A package

All five pilots are delivered as WebP files in `public/cards/` and
`public/heroes/`:

* `imperator-liquidus` (1024×1536) — urllib SSE, PNG, original.
* `genesis-pfp` (1145×1374) — curl SSE, JPEG q80, fallback model
  `gpt-image-2.5-flare` after `sunburst` returned 1145×1374 too.
* `the-grand-cartographer` (1024×1536) — curl SSE, JPEG q80, sunburst.
* `fud-hydra` (1024×1536) — curl SSE, JPEG q80, sunburst.
* `whale` (1145×1374) — curl SSE, JPEG q80, flare fallback.

Two pilots (`genesis-pfp`, `whale`) came back at 1145×1374 instead of the
requested portrait / square sizes. Per coordinator direction these are
shipped as observed; downstream UI work in package 1B will need to
decide whether to letterbox, crop, or downscale before final packaging.

## Mitigation paths observed in this run

* **`output_format: "jpeg"` + `output_compression: 80`** — confirmed
  working for these prompts; produced the bodies.
* **`gpt-image-2.5-flare`** — confirmed working for `genesis-pfp` and
  `whale` after `sunburst` returned the unexpected 1145×1374 dimension.
  Recorded in `asset-manifest.json` per brief.
* **`response_format: "url"`** — not effective on this endpoint in this
  run.

No claim is made about which transport will work for which future
prompt. Future packages should re-validate the working combination
before relying on it.