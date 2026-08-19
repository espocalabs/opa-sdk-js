# @opa.sh/sdk

[![npm version](https://img.shields.io/npm/v/@opa.sh/sdk.svg)](https://www.npmjs.com/package/@opa.sh/sdk)
[![CI](https://github.com/espocalabs/opa-sdk-js/actions/workflows/ci.yml/badge.svg)](https://github.com/espocalabs/opa-sdk-js/actions/workflows/ci.yml)
[![license: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)

Official TypeScript/JavaScript SDK for the [Opa link shortener](https://opa.sh) API (`https://api.opa.sh/v1`).

Resource-oriented, fully typed from the OpenAPI spec, universal runtime (Node, Bun, Browser, Cloudflare Workers, Deno), never throws — errors are always returned as values.

## Install

```bash
npm install @opa.sh/sdk
# or: bun add @opa.sh/sdk
# or: pnpm add @opa.sh/sdk
# or: yarn add @opa.sh/sdk
```

## Quick start

```ts
import { createOpaClient } from "@opa.sh/sdk";

const opa = createOpaClient({ apiKey: process.env.OPA_API_KEY! });

const { data, error } = await opa.links.create({
  destinationUrl: "https://example.com/black-friday",
  domain: "opa.sh",
  tags: ["campaign-2026"],
});

if (error) {
  console.error(error.code, error.message);
  return;
}

console.log(data.shortUrl); // narrowed to success shape
console.log(data.qrCodeUrl);
```

Get your API key at [opa.sh/settings/api-keys](https://app.opa.sh/settings/api-keys).

## Authentication

Two options, both server-side only — never expose a key from a browser bundle:

```ts
// API key (recommended for server integrations)
const opa = createOpaClient({ apiKey: "opa_live_..." });

// Bearer token (for user-scoped JWT sessions)
const opa = createOpaClient({ bearerToken: "eyJhbGci..." });
```

Base URL defaults to `https://api.opa.sh/v1`. Override it for staging or self-hosted instances:

```ts
const opa = createOpaClient({
  apiKey: "...",
  baseUrl: "https://api.staging.opa.sh/v1",
});
```

## Errors — Result pattern

Every method returns `{ data, error }`. The client never throws for HTTP errors — you're forced to handle them at the call site, and TypeScript narrows `data` to the success shape after the error check.

```ts
const { data, error } = await opa.links.get("lnk_xxx");

if (error) {
  // error.code is a typed union: "unauthorized" | "not_found" | ...
  // error.status is the HTTP status
  // error.details may include field-level validation info
  switch (error.code) {
    case "not_found":
      return notFound();
    case "rate_limited":
      return retryLater(error.details?.retryAfter);
    default:
      return internalError(error);
  }
}

// data is narrowed to the success shape here
console.log(data.shortUrl);
```

Network failures (connection reset, DNS, timeout) also come back as `error` with `code: "network_error"` — the client never crashes on transient issues.

## Resources

### Links

```ts
// Create
const { data } = await opa.links.create({
  destinationUrl: "https://example.com",
  domain: "opa.sh",
  key: "custom-slug", // optional
  tags: ["marketing"],
  password: "s3cret",
  expiresAt: "2027-01-01T00:00:00Z",
});

// Read
const { data } = await opa.links.get("lnk_xxx");

// Update
const { data } = await opa.links.update("lnk_xxx", {
  destinationUrl: "https://example.com/new",
});

// Lifecycle
await opa.links.archive("lnk_xxx");
await opa.links.restore("lnk_xxx");
await opa.links.duplicate("lnk_xxx");

// List (single page)
const { data, hasMore, nextCursor } = await opa.links.list({
  tag: "marketing",
  limit: 50,
});

// List (all pages — async iterator, memory-safe)
for await (const link of opa.links.listAll({ tag: "marketing" })) {
  console.log(link.shortUrl, link.clicks);
}

// Bulk operations
await opa.links.bulkArchive({ ids: ["lnk_a", "lnk_b", "lnk_c"] });
await opa.links.bulkTag({ ids: [...], addTags: ["q4-campaign"] });
```

### Analytics

```ts
const { data } = await opa.analytics.query({
  linkId: "lnk_xxx",
  range: "7d", // "24h" | "7d" | "30d" | "90d" | custom
});

const { data } = await opa.analytics.timeseries({
  linkId: "lnk_xxx",
  range: "30d",
  interval: "day",
});

const { data } = await opa.analytics.events({
  linkId: "lnk_xxx",
  limit: 100,
});
```

### Domains

```ts
const { data } = await opa.domains.list();
```

## Retries and rate limiting

Automatic exponential backoff on `5xx` and `429`, respecting the `Retry-After` header. Never retries on `4xx` other than 429 (so idempotent semantics are preserved for `POST`).

```ts
const opa = createOpaClient({
  apiKey: "...",
  retries: 3,          // default: 3
  retryDelay: 1000,    // default: 1000ms base, doubles each attempt
  onRateLimit: (info) => {
    console.warn(`Rate limited. Reset at ${info.resetAt.toISOString()}`);
  },
});
```

Rate limit headers (`x-ratelimit-limit`, `x-ratelimit-remaining`, `x-ratelimit-reset`) are surfaced via the `onRateLimit` callback whenever the API responds with them.

## Idempotency

Pass an `idempotencyKey` on mutating operations to make retries safe. The API deduplicates requests with the same key for 24 hours.

```ts
const { data, error } = await opa.links.create(
  { destinationUrl: "https://example.com", domain: "opa.sh" },
  { idempotencyKey: "req_abc123" }
);
```

Generate one per business operation with `crypto.randomUUID()`.

## Custom fetch

For SSR, RSC, or edge runtimes that need a specific fetch implementation:

```ts
const opa = createOpaClient({
  apiKey: "...",
  fetch: customFetch, // must match the Fetch API signature
});
```

Useful for Next.js `unstable_cache`, Cloudflare Workers with request-scoped `env.fetcher`, or MSW test mocks.

## TypeScript

Types are generated from the live OpenAPI spec (`openapi/v1.json`) via [`openapi-typescript`](https://github.com/openapi-ts/openapi-typescript). Autocomplete covers every path, method, body, query param, and response — a rename on the server surfaces as a compile error in the SDK.

```ts
import type { OpaClient, OpaError, OpaErrorCode } from "@opa.sh/sdk";
```

## Runtime support

- Node.js 18+ (uses global `fetch`)
- Bun
- Deno
- Cloudflare Workers (workerd)
- Modern browsers — **do not expose your API key in the browser bundle**; proxy through your server

No dependencies at runtime beyond [`openapi-fetch`](https://github.com/openapi-ts/openapi-typescript/tree/main/packages/openapi-fetch) (~2KB gzipped).

## Bundle size

| Format | Size | Gzipped |
| --- | --- | --- |
| ESM | 5.6 KB | 2.1 KB |
| CJS | 6.4 KB | 2.4 KB |

Tree-shakes cleanly — you only pay for the resources you import.

## Contributing

The SDK is a wrapper around the auto-generated OpenAPI types. The generator (`bun run generate:types`) runs against `openapi/v1.json`, which is refreshed daily from `https://api.opa.sh/v1/openapi` via the `sync-openapi` workflow. When the spec adds a new endpoint, the sync workflow opens a PR you can extend with a hand-written resource wrapper.

```bash
git clone https://github.com/espocalabs/opa-sdk-js
cd opa-sdk-js
bun install
bun test
bun run build
```

Add a changeset before opening a PR:

```bash
bunx changeset
```

## License

[MIT](./LICENSE) © Espoca Labs
