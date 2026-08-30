import type { OpaHttpClient } from "../client.js";
import { toResult } from "../errors.js";
import type { IdentifyInput, IdentifyResult } from "../tracking-contract.js";
import type { RequestOptions, Result } from "../types.js";

/** Stateless server-side identity, event and conversion tracking. */
export class TrackResource {
	constructor(private readonly http: OpaHttpClient) {}

	/** Binds an anonymous browser identity to a caller-owned external identity. */
	identify(input: IdentifyInput, options?: RequestOptions): Promise<Result<IdentifyResult>> {
		return toResult(
			this.http.POST("/track/identify", {
				body: input,
				signal: options?.signal,
			}),
		);
	}
}
