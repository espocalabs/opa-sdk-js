---
"@opa.sh/sdk": minor
---

Initial release — official TypeScript/JavaScript SDK for the Opa link shortener API.

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
