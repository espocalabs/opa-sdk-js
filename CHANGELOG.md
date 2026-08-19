# @opa.sh/sdk

## 0.3.0

### Minor Changes

- 0bce8a6: Sync with API reality — breaking changes to field names, bulk endpoints, analytics params. See audit doc in main repo.

  - **`analytics.query()` removed** — use `analytics.summary()`, which had been an alias. Same signature.
  - **README rewritten** to match the actual SDK surface: correct API key prefix (`opa_...`, not `opa_live_...`), `Link.shortLink` (not `shortUrl`), `tagIds` (not `tags`) on `create`/bulk-tag, `search` (not `tag`) as the list filter, `from`/`to` ISO-8601 params on `analytics.summary`/`analytics.timeseries` (no `range`/`interval` shorthand), correct bulk-operation bodies (`{ linkIds }` / `{ linkIds, folderId }` / `{ linkIds, tagIds }`), and `X-RateLimit-*` header casing.
  - Refreshed `openapi/v1.json` from the live spec and regenerated `src/generated/openapi.ts` — `domain` is no longer a required field on link creation (falls back to the team's default domain when omitted).

  The hand-written resource wrappers (`src/resources/**`) and their tests already matched the corrected API shapes going into this release; this changeset mainly catches the README and the one remaining `query`/`summary` duplication up to the same standard.

## 0.2.1

### Patch Changes

- a1ab39c: Remove `bearerToken` auth option and `idempotencyKey` request option — the Opa API only accepts `x-api-key` and does not support an `Idempotency-Key` header. Both were exposed by mistake.

## 0.2.0

### Minor Changes

- afd3a52: Initial release — official TypeScript/JavaScript SDK for the Opa link shortener API.

  - Resource-oriented client (`opa.links.*`, `opa.analytics.*`, `opa.domains.*`)
  - Universal runtime (Node 18+, Bun, Browser, Cloudflare Workers, Deno)
  - Fully typed from OpenAPI spec via `openapi-fetch`
  - `Result<T>` error handling — no throws
  - Retry with exponential backoff (5xx + 429, respects `Retry-After`)
  - Async-iterator + eager pagination
  - Idempotency keys on mutating operations
  - API key + bearer token auth
  - Zero runtime dependencies beyond `openapi-fetch`
  - ESM + CJS bundles (~2.1KB gzipped ESM, ~2.4KB gzipped CJS)

## 0.1.0

### Initial release

- Resource-oriented client for the [Opa](https://opa.sh) public API (`https://api.opa.sh/v1`).
- Resources: `links`, `analytics`, `domains`.
- Result-based error handling (`{ data, error }`), never throws on API errors.
- Universal runtime support (Node 18+, Bun, Deno, browsers, Cloudflare Workers) via the global `fetch`.
- Automatic retry with exponential backoff on `5xx`/`429` (honors `Retry-After`).
- Cursor-based pagination via async iterators and an eager `{ data, hasMore, nextCursor }` mode.
- Idempotency key support on mutating methods.
- Full TypeScript types generated from the OpenAPI spec.
