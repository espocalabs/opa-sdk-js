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
  tagIds: ["tag_campaign2026"],
});

if (error) {
  console.error(error.code, error.message);
  return;
}

console.log(data.shortLink); // narrowed to success shape
```

Get your API key at [app.opa.sh/settings/api-keys](https://app.opa.sh/settings/api-keys).

## Authentication

Server-side only — never expose a key from a browser bundle:

```ts
const opa = createOpaClient({ apiKey: "opa_..." });
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
  // error.code is a typed union: "unauthorized" | "not_found" | "validation_error" | ...
  // error.status is the HTTP status (validation_error is always 422)
  // error.issues has field-level detail when error.code === "validation_error"
  switch (error.code) {
    case "not_found":
      return notFound();
    case "rate_limited":
      return retryLater(error.retryAfter); // ms, parsed from Retry-After
    default:
      return internalError(error);
  }
}

// data is narrowed to the success shape here
console.log(data.shortLink);
```

`OpaError` also exposes boolean getters for the common cases: `isAuthError`, `isPermissionError`, `isValidationError`, `isRateLimitError`. Use `isOpaError(value)` to narrow an unknown value.

Network failures (connection reset, DNS, timeout) also come back as `error` with `code: "network_error"` — the client never crashes on transient issues.

## Resources

### Links

```ts
// Create — only destinationUrl is required; domain falls back to the
// team's default domain when omitted.
const { data } = await opa.links.create({
  destinationUrl: "https://example.com",
  domain: "opa.sh",
  key: "custom-slug", // optional
  tagIds: ["tag_marketing"],
  password: "s3cret",
  expiresAt: "2027-01-01T00:00:00Z",
});

// Read
const { data } = await opa.links.get("lnk_xxx");

// Update — full-payload PATCH, same schema as create minus the id
const { data } = await opa.links.update("lnk_xxx", {
  destinationUrl: "https://example.com/new",
});

// Lifecycle
await opa.links.archive("lnk_xxx"); // reversible — the link keeps resolving
await opa.links.restore("lnk_xxx");
await opa.links.duplicate("lnk_xxx");

// List — single page (await it)
const { data } = await opa.links.list({ search: "marketing", limit: 50 });
console.log(data.items, data.hasMore, data.nextCursor);

// List — every page (for-await, memory-safe)
for await (const link of opa.links.list({ search: "marketing" })) {
  console.log(link.shortLink);
}

// Bulk operations
await opa.links.bulkArchive({ linkIds: ["lnk_a", "lnk_b", "lnk_c"] });
await opa.links.bulkRestore({ linkIds: ["lnk_a", "lnk_b"] });
await opa.links.bulkMove({ linkIds: ["lnk_a"], folderId: "fld_1" });
await opa.links.bulkTag({ linkIds: ["lnk_a"], tagIds: ["tag_q4campaign"] });
```

There is no `tag` list filter — use `search`, a case-insensitive substring match against the short link, destination URL, folder name, or tag name.

### Analytics

`from`/`to` are required ISO-8601 dates on every analytics call (max 366-day range); there's no `range: "7d"` shorthand or `interval` parameter.

```ts
const { data } = await opa.analytics.summary({
  linkId: "lnk_xxx",
  from: "2026-08-12T00:00:00Z",
  to: "2026-08-19T23:59:59Z",
});

// One point per day over the same range/filters — no interval option.
const { data } = await opa.analytics.timeseries({
  linkId: "lnk_xxx",
  from: "2026-07-20T00:00:00Z",
  to: "2026-08-19T23:59:59Z",
});

// Raw click events — same await-one-page / for-await-every-page shape as opa.links.list
for await (const event of opa.analytics.events({ linkId: "lnk_xxx", limit: 100 })) {
  console.log(event.timestamp, event.country, event.device);
}
```

Both `summary` and `timeseries` accept the same optional filters: `country`, `device`, `os`, `browser`, `refererDomain`, `utmSource`, `utmMedium`, `utmCampaign`, `variantUrl`, `domain` (each a comma-separated "IN" filter).

### Domains

```ts
const { data } = await opa.domains.list();
```

Not paginated — the list of domains an organization can shorten links under is small by nature.

## Retries and rate limiting

Automatic exponential backoff (with jitter) on `5xx` and `429` responses, plus transport-level failures. `Retry-After` (seconds or HTTP-date) is honored when present, taking priority over the computed backoff. 4xx errors other than 429 are never retried.

```ts
const opa = createOpaClient({
  apiKey: "...",
  retry: {
    retries: 3, // default: 3
    minTimeoutMs: 500, // default: 500ms
    maxTimeoutMs: 8000, // default: 8000ms ceiling
  },
});

// Disable retries entirely:
const opa = createOpaClient({ apiKey: "...", retry: false });
```

Every response carries `X-RateLimit-Limit`, `X-RateLimit-Remaining`, and `X-RateLimit-Reset` (Unix seconds) headers — read them off the underlying `Response` if you need to react to them; the SDK doesn't currently surface a dedicated callback for this.

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
| ESM | 5.3 KB | 2.0 KB |
| CJS | 6.1 KB | 2.3 KB |

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
