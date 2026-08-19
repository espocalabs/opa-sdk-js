// Deliberately a namespace import, not `import createFetchClient from
// "openapi-fetch"`. openapi-fetch ships a real dual (ESM + CJS) build, but
// esbuild's default-import interop for *external* CJS requires always
// treats the required value as a plain, unmarked CommonJS export — which
// double-wraps openapi-fetch's already-correct `.default` when this file is
// bundled to CJS, breaking `require("@opa.sh/sdk")` consumers. Resolving it
// by hand here works under every module system this package ships for.

import type { Client, ClientOptions } from "openapi-fetch";
import * as openapiFetchModule from "openapi-fetch";
import type { paths } from "./generated/openapi.js";
import { AnalyticsResource } from "./resources/analytics.js";
import { DomainsResource } from "./resources/domains.js";
import { LinksResource } from "./resources/links.js";
import { createRetryFetch, type FetchLike, type RetryConfig } from "./retry.js";

// The `{}` bound mirrors openapi-fetch's own `createClient<Paths extends {}>` constraint.
type CreateFetchClientFn = <P extends {}>(options?: ClientOptions) => Client<P>;

function resolveCreateFetchClient(): CreateFetchClientFn {
	const mod = openapiFetchModule as unknown as
		| CreateFetchClientFn
		| { default: CreateFetchClientFn | { default: CreateFetchClientFn } };
	if (typeof mod === "function") return mod;
	const inner = mod.default;
	return typeof inner === "function" ? inner : inner.default;
}

const createFetchClient = resolveCreateFetchClient();

export const DEFAULT_BASE_URL = "https://api.opa.sh/v1";

export type OpaHttpClient = Client<paths>;

export interface OpaClientConfig {
	/**
	 * Sent as the `x-api-key` header. Create one in the dashboard under
	 * Settings → API.
	 */
	apiKey: string;
	/** Override the API origin — mainly useful for testing. Default `https://api.opa.sh/v1`. */
	baseUrl?: string;
	/** Custom `fetch` implementation. Defaults to the global `fetch`. */
	fetch?: FetchLike;
	/** Extra headers merged into every request. */
	headers?: Record<string, string>;
	/** Retry/backoff tuning. Pass `false` to disable retries entirely. */
	retry?: RetryConfig | false;
}

export interface OpaClient {
	links: LinksResource;
	analytics: AnalyticsResource;
	domains: DomainsResource;
}

/**
 * Creates an Opa API client. Requires `apiKey`.
 *
 * @example
 * ```ts
 * import { createOpaClient } from "@opa.sh/sdk";
 *
 * const opa = createOpaClient({ apiKey: process.env.OPA_API_KEY! });
 * const { data, error } = await opa.links.create({
 *   destinationUrl: "https://example.com",
 *   domain: "opa.sh",
 * });
 * ```
 */
export function createOpaClient(config: OpaClientConfig): OpaClient {
	const { apiKey, baseUrl = DEFAULT_BASE_URL, headers, retry } = config;
	const baseFetch = config.fetch ?? globalThis.fetch;

	if (!apiKey) {
		throw new Error("createOpaClient: `apiKey` is required.");
	}
	if (typeof baseFetch !== "function") {
		throw new Error(
			"createOpaClient: no global `fetch` was found in this runtime — pass one explicitly via `fetch`.",
		);
	}

	const authHeaders: Record<string, string> = { "x-api-key": apiKey };

	const resolvedFetch = retry === false ? baseFetch : createRetryFetch(baseFetch, retry ?? {});

	const http = createFetchClient<paths>({
		baseUrl,
		fetch: resolvedFetch,
		headers: { ...authHeaders, ...headers },
	});

	return {
		links: new LinksResource(http),
		analytics: new AnalyticsResource(http),
		domains: new DomainsResource(http),
	};
}
