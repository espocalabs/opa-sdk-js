---
"@opa.sh/sdk": minor
---

Sync with API reality — breaking changes to field names, bulk endpoints, analytics params. See audit doc in main repo.

- **`analytics.query()` removed** — use `analytics.summary()`, which had been an alias. Same signature.
- **README rewritten** to match the actual SDK surface: correct API key prefix (`opa_...`, not `opa_live_...`), `Link.shortLink` (not `shortUrl`), `tagIds` (not `tags`) on `create`/bulk-tag, `search` (not `tag`) as the list filter, `from`/`to` ISO-8601 params on `analytics.summary`/`analytics.timeseries` (no `range`/`interval` shorthand), correct bulk-operation bodies (`{ linkIds }` / `{ linkIds, folderId }` / `{ linkIds, tagIds }`), and `X-RateLimit-*` header casing.
- Refreshed `openapi/v1.json` from the live spec and regenerated `src/generated/openapi.ts` — `domain` is no longer a required field on link creation (falls back to the team's default domain when omitted).

The hand-written resource wrappers (`src/resources/**`) and their tests already matched the corrected API shapes going into this release; this changeset mainly catches the README and the one remaining `query`/`summary` duplication up to the same standard.
