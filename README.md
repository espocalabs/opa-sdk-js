# @opa.sh/sdk

[![npm version](https://img.shields.io/npm/v/@opa.sh/sdk.svg)](https://www.npmjs.com/package/@opa.sh/sdk)
[![CI](https://github.com/espocalabs/opa-sdk-js/actions/workflows/ci.yml/badge.svg)](https://github.com/espocalabs/opa-sdk-js/actions/workflows/ci.yml)
[![license: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)

SDK oficial em TypeScript/JavaScript para a [API pública do Opa](https://opa.sh) (`https://api.opa.sh/v1`).

**[English version below](#english)**

---

## Início rápido

```bash
npm install @opa.sh/sdk
# ou: bun add @opa.sh/sdk
# ou: pnpm add @opa.sh/sdk
```

```ts
import { createOpaClient } from "@opa.sh/sdk";

const opa = createOpaClient({ apiKey: process.env.OPA_API_KEY! });

const { data, error } = await opa.links.create({
  destinationUrl: "https://example.com",
  domain: "opa.sh",
});

if (error) {
  console.error(error.code, error.message);
} else {
  console.log(data.shortLink); // https://opa.sh/abc123
}
```

Funciona em qualquer runtime com `fetch` global: Node.js 18+, Bun, Deno, navegadores e Cloudflare Workers. Zero dependências de runtime além de [`openapi-fetch`](https://openapi-ts.dev/openapi-fetch/).

## Autenticação

```ts
// Chave de API (recomendado) — Settings → API no dashboard
const opa = createOpaClient({ apiKey: "opa_live_..." });

// Ou um bearer token
const opa = createOpaClient({ bearerToken: "..." });
```

## Exemplos por recurso

### Links

```ts
// Criar
const { data: link } = await opa.links.create({
  destinationUrl: "https://example.com/produto",
  domain: "opa.sh",
  title: "Lançamento",
  tagIds: ["tag_marketing"],
});

// Buscar
const { data: link } = await opa.links.get("lnk_123");

// Atualizar
const { data: link } = await opa.links.update("lnk_123", {
  destinationUrl: "https://example.com/produto-v2",
  domain: "opa.sh",
});

// Arquivar / restaurar / duplicar
await opa.links.archive("lnk_123");
await opa.links.restore("lnk_123");
const { data: copy } = await opa.links.duplicate("lnk_123");

// Operações em lote
await opa.links.bulkArchive({ linkIds: ["lnk_1", "lnk_2"] });
await opa.links.bulkRestore({ linkIds: ["lnk_1", "lnk_2"] });
await opa.links.bulkMove({ linkIds: ["lnk_1"], folderId: "fld_1" });
await opa.links.bulkTag({ linkIds: ["lnk_1"], tagIds: ["tag_1"] });
```

### Analytics

```ts
const { data: summary } = await opa.analytics.query({
  from: "2026-01-01",
  to: "2026-01-31",
  linkId: "lnk_123", // opcional
});
console.log(summary.clicks, summary.uniqueClicks);

const { data: timeseries } = await opa.analytics.timeseries({
  from: "2026-01-01",
  to: "2026-01-31",
});
for (const point of timeseries.points) {
  console.log(point.date, point.clicks);
}

// Eventos brutos de clique, paginados (veja "Paginação" abaixo)
for await (const event of opa.analytics.events({ linkId: "lnk_123" })) {
  console.log(event.timestamp, event.country, event.device);
}
```

### Domains

```ts
const { data: domains } = await opa.domains.list();
for (const domain of domains) {
  console.log(domain.domain, domain.verified);
}
```

## Tratamento de erros

Nenhum método da SDK lança exceção para falhas da API — todos retornam `{ data, error }`. Sempre verifique `error` antes de usar `data`:

```ts
const { data, error } = await opa.links.create({
  destinationUrl: "not-a-url",
  domain: "opa.sh",
});

if (error) {
  if (error.isValidationError) {
    console.error(error.issues); // [{ path, message }]
  } else if (error.isRateLimitError) {
    console.error("retry after ms:", error.retryAfter);
  } else {
    console.error(error.code, error.message);
  }
  return;
}
```

`OpaError` estende `Error` e expõe `code`, `status`, `issues?`, `retryAfter?` e os getters `isAuthError`, `isPermissionError`, `isValidationError`, `isRateLimitError`.

> A única exceção à regra "nunca lança": iterar uma lista paginada (`for await`) lança o `OpaError` se uma página no meio do caminho falhar — é o único canal que `for await` tem para propagar um erro. Use `try/catch` ao redor da iteração se uma página tardia puder falhar.

## Paginação

Todo método de listagem retorna algo que é ao mesmo tempo uma `Promise` (resolve a primeira página) e um `AsyncIterable` (percorre todas as páginas):

```ts
// Modo eager — uma página
const { data, error } = await opa.links.list({ limit: 50 });
if (!error) {
  console.log(data.items, data.hasMore, data.nextCursor);
}

// Modo iterador — todas as páginas, buscadas sob demanda
for await (const link of opa.links.list()) {
  console.log(link.shortLink);
}
```

## Retry

Requisições em `5xx` e `429` são automaticamente re-tentadas com backoff exponencial (3 tentativas por padrão), respeitando o header `Retry-After` quando presente.

```ts
const opa = createOpaClient({
  apiKey: "...",
  retry: { retries: 5, minTimeoutMs: 300, maxTimeoutMs: 10_000 },
});

// Ou desabilitar totalmente
const opa = createOpaClient({ apiKey: "...", retry: false });
```

## Idempotência

Métodos mutativos aceitam uma `idempotencyKey` opcional como último argumento, enviada no header `Idempotency-Key` — seguro para reenviar em caso de timeout ou retry manual:

```ts
await opa.links.create(
  { destinationUrl: "https://example.com", domain: "opa.sh" },
  { idempotencyKey: crypto.randomUUID() },
);
```

## Suporte a TypeScript

A SDK é "types-first": todo tipo de entrada/saída é derivado do OpenAPI spec público (`https://api.opa.sh/v1/openapi`) via [`openapi-typescript`](https://openapi-ts.dev/), então autocomplete e checagem de tipos refletem exatamente o que a API aceita e retorna.

```ts
import type { Link, CreateLinkInput, AnalyticsSummary } from "@opa.sh/sdk";
```

## Contribuindo

```bash
git clone https://github.com/espocalabs/opa-sdk-js.git
cd opa-sdk-js
bun install
bun run generate:types   # regenera src/generated/openapi.ts a partir de openapi/v1.json
bun run typecheck
bun run lint
bun test
bun run build
```

Um workflow diário (`sync-openapi.yml`) puxa o spec público mais recente, regenera os tipos e abre um PR automaticamente quando o spec muda. Ao adicionar um endpoint novo à API, o PR automático avisa — mas o wrapper de recurso correspondente em `src/resources/**` ainda precisa ser escrito à mão.

Mudanças que afetam o pacote publicado precisam de um changeset:

```bash
bunx changeset
```

## Licença

MIT — veja [LICENSE](./LICENSE).

---

<a id="english"></a>

## English

Official TypeScript/JavaScript SDK for the [Opa](https://opa.sh) public API (`https://api.opa.sh/v1`).

### Quick start

```bash
npm install @opa.sh/sdk
# or: bun add @opa.sh/sdk
# or: pnpm add @opa.sh/sdk
```

```ts
import { createOpaClient } from "@opa.sh/sdk";

const opa = createOpaClient({ apiKey: process.env.OPA_API_KEY! });

const { data, error } = await opa.links.create({
  destinationUrl: "https://example.com",
  domain: "opa.sh",
});

if (error) {
  console.error(error.code, error.message);
} else {
  console.log(data.shortLink); // https://opa.sh/abc123
}
```

Works in any runtime with a global `fetch`: Node.js 18+, Bun, Deno, browsers, and Cloudflare Workers. Zero runtime dependencies beyond [`openapi-fetch`](https://openapi-ts.dev/openapi-fetch/).

### Auth

```ts
// API key (recommended) — Settings → API in the dashboard
const opa = createOpaClient({ apiKey: "opa_live_..." });

// Or a bearer token
const opa = createOpaClient({ bearerToken: "..." });
```

### Examples by resource

```ts
// Links
const { data: link } = await opa.links.create({
  destinationUrl: "https://example.com/product",
  domain: "opa.sh",
});
await opa.links.archive(link.id);
await opa.links.restore(link.id);

// Analytics
const { data: summary } = await opa.analytics.query({ from: "2026-01-01", to: "2026-01-31" });
for await (const event of opa.analytics.events()) {
  console.log(event.timestamp, event.country);
}

// Domains
const { data: domains } = await opa.domains.list();
```

### Error handling

No SDK method throws for API-level failures — every call resolves to `{ data, error }`:

```ts
const { data, error } = await opa.links.get("lnk_123");
if (error) {
  if (error.isRateLimitError) console.error("retry after ms:", error.retryAfter);
  return;
}
console.log(data.shortLink);
```

`OpaError` extends `Error` and exposes `code`, `status`, `issues?`, `retryAfter?`, plus `isAuthError`, `isPermissionError`, `isValidationError`, `isRateLimitError` getters.

> The one exception to "never throw": iterating a paginated list (`for await`) throws the `OpaError` if a later page fails — that's the only channel `for await` has to surface it. Wrap iteration in `try/catch` if a later page might fail.

### Pagination

Every list method returns something that is both a `Promise` (resolves the first page) and an `AsyncIterable` (walks every page):

```ts
// Eager — one page
const { data } = await opa.links.list({ limit: 50 });
console.log(data.items, data.hasMore, data.nextCursor);

// Iterator — every page, fetched on demand
for await (const link of opa.links.list()) {
  console.log(link.shortLink);
}
```

### Retry

`5xx` and `429` responses are automatically retried with exponential backoff (3 attempts by default), honoring `Retry-After` when present.

```ts
const opa = createOpaClient({
  apiKey: "...",
  retry: { retries: 5, minTimeoutMs: 300, maxTimeoutMs: 10_000 },
});

// Or disable retries entirely
const opa = createOpaClient({ apiKey: "...", retry: false });
```

### Idempotency

Mutating methods accept an optional `idempotencyKey` as their last argument, sent as the `Idempotency-Key` header — safe to resend after a timeout or manual retry:

```ts
await opa.links.create(
  { destinationUrl: "https://example.com", domain: "opa.sh" },
  { idempotencyKey: crypto.randomUUID() },
);
```

### TypeScript support

Types-first: every input/output type is derived from the public OpenAPI spec (`https://api.opa.sh/v1/openapi`) via [`openapi-typescript`](https://openapi-ts.dev/), so autocomplete and type-checking match exactly what the API accepts and returns.

```ts
import type { Link, CreateLinkInput, AnalyticsSummary } from "@opa.sh/sdk";
```

### Contributing

```bash
git clone https://github.com/espocalabs/opa-sdk-js.git
cd opa-sdk-js
bun install
bun run generate:types   # regenerate src/generated/openapi.ts from openapi/v1.json
bun run typecheck
bun run lint
bun test
bun run build
```

A daily workflow (`sync-openapi.yml`) pulls the latest public spec, regenerates types, and opens a PR automatically when the spec changes. When the API gains a new endpoint, that PR will flag it — but the corresponding resource wrapper under `src/resources/**` still needs to be hand-written.

Changes that affect the published package need a changeset:

```bash
bunx changeset
```

### License

MIT — see [LICENSE](./LICENSE).
