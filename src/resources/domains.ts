import type { OpaHttpClient } from "../client.js";
import { toResult } from "../errors.js";
import type { paths } from "../generated/openapi.js";
import type { RequestOptions, Result } from "../types.js";

type Paths = paths;

/** A domain usable as a link's short-link host. */
export type Domain =
	Paths["/domains"]["get"]["responses"]["200"]["content"]["application/json"]["data"][number];

/** `opa.domains` — the domains available to shorten links under. */
export class DomainsResource {
	constructor(private readonly http: OpaHttpClient) {}

	/**
	 * Lists every domain the organization can shorten links under —
	 * verified custom domains plus the shared `opa.sh`-style app domain.
	 * Not paginated: this list is small by nature.
	 */
	list(options?: RequestOptions): Promise<Result<Domain[]>> {
		return toResult(this.http.GET("/domains", { signal: options?.signal }));
	}
}
