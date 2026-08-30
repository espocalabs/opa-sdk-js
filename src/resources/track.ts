import type { OpaHttpClient } from "../client.js";
import { toResult } from "../errors.js";
import type {
	IdentifyInput,
	IdentifyResult,
	TrackConversionResult,
	TrackEventInput,
	TrackEventResult,
	TrackLeadInput,
	TrackSaleInput,
} from "../tracking-contract.js";
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

	/** Records an idempotent event for an explicit anonymous or external identity. */
	event(input: TrackEventInput, options?: RequestOptions): Promise<Result<TrackEventResult>> {
		return toResult(
			this.http.POST("/track/event", {
				body: input,
				signal: options?.signal,
			}),
		);
	}

	/** Records a lead using the API's existing conversion wire contract. */
	lead(input: TrackLeadInput, options?: RequestOptions): Promise<Result<TrackConversionResult>> {
		return toResult(
			this.http.POST("/track/lead", {
				body: input,
				signal: options?.signal,
			}),
		);
	}

	/** Records a sale; provide `invoiceId` so automatic retries remain idempotent. */
	sale(input: TrackSaleInput, options?: RequestOptions): Promise<Result<TrackConversionResult>> {
		return toResult(
			this.http.POST("/track/sale", {
				body: input,
				signal: options?.signal,
			}),
		);
	}
}
