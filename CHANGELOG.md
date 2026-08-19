# @opa.sh/sdk

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
