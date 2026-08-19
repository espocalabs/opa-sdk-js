# examples/full-test.ts

A full-surface smoke test that exercises every public `@opa.sh/sdk` method
against the **real** Opa API (`https://api.opa.sh/v1` by default). Not
published to npm — this directory exists only for local/manual testing of
the SDK against a live account.

## Setup

```bash
cd examples
cp .env.example .env
# edit .env and set OPA_API_KEY=opa_...
bun install
```

## Run

```bash
bun run test
# or, from the repo root:
bun run examples/full-test.ts
```

## What it does

- Creates 5 tagged test links (key/destinationUrl embed a unique
  `sdk-test-<runId>` marker), then exercises `get`, `update`, `archive`,
  `restore`, `duplicate`, `list` (single page and iterator), `bulkArchive`
  and `bulkRestore`.
- `bulkTag` and `bulkMove` are skipped — the API has no `/tags` or
  `/folders` list endpoint to source a valid `tagId`/`folderId` from
  without pre-existing account state.
- Exercises `opa.analytics.summary`, `.timeseries` and `.events` for one
  of the created links over the last 7 days.
- Exercises `opa.domains.list`.
- **Cleanup**: every link this run created is archived (via `bulkArchive`,
  or one-by-one if that fails) in a `finally` block, so a failed run still
  cleans up. Archiving is the closest thing to delete this API exposes —
  there's no hard-delete endpoint, only the reversible `DELETE
  /links/{id}` → `archive()`.
- Any single call that takes longer than 30s is treated as failed/slow
  rather than hanging the run.
- Prints a `✓`/`✗`/`…` (skipped) line per call, then a summary line and
  exits `1` if anything failed, `0` otherwise.

## Env vars

| Var             | Required | Default                    |
| ---------------- | -------- | --------------------------- |
| `OPA_API_KEY`     | yes      | —                            |
| `OPA_BASE_URL`    | no       | `https://api.opa.sh/v1`     |

`OPA_API_KEY` is never logged or committed — `.env` is gitignored.
