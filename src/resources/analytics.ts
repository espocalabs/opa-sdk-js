import type { OpaHttpClient } from "../client.js";
import { toResult } from "../errors.js";
import type { paths } from "../generated/openapi.js";
import { createListPromise, type ListPromise } from "../pagination.js";
import type { Page, RequestOptions, Result } from "../types.js";

type Paths = paths;

export type AnalyticsQueryParams = NonNullable<
	Paths["/analytics/summary"]["get"]["parameters"]["query"]
>;
export type AnalyticsSummary =
	Paths["/analytics/summary"]["get"]["responses"]["200"]["content"]["application/json"]["data"];
export type AnalyticsTimeseries =
	Paths["/analytics/timeseries"]["get"]["responses"]["200"]["content"]["application/json"]["data"];

export type ListAnalyticsEventsParams = NonNullable<
	Paths["/analytics/events"]["get"]["parameters"]["query"]
>;
export type AnalyticsEvent =
	Paths["/analytics/events"]["get"]["responses"]["200"]["content"]["application/json"]["data"]["items"][number];

/** `opa.analytics` — aggregate and raw-event click analytics. */
export class AnalyticsResource {
	constructor(private readonly http: OpaHttpClient) {}

	/**
	 * Total and unique clicks for a date range (max 366 days), optionally
	 * filtered by link, geo, device, or UTM fields. `from`/`to` are required.
	 */
	query(params: AnalyticsQueryParams, options?: RequestOptions): Promise<Result<AnalyticsSummary>> {
		return toResult(
			this.http.GET("/analytics/summary", { params: { query: params }, signal: options?.signal }),
		);
	}

	/** Alias for {@link query} — kept for readers coming from the dashboard's "Analytics summary". */
	summary(
		params: AnalyticsQueryParams,
		options?: RequestOptions,
	): Promise<Result<AnalyticsSummary>> {
		return this.query(params, options);
	}

	/** Daily click counts across the same filters as {@link query}. */
	timeseries(
		params: AnalyticsQueryParams,
		options?: RequestOptions,
	): Promise<Result<AnalyticsTimeseries>> {
		return toResult(
			this.http.GET("/analytics/timeseries", {
				params: { query: params },
				signal: options?.signal,
			}),
		);
	}

	/**
	 * Raw click events, newest first. Await it for a single page, or
	 * `for await` it to walk every page. See {@link ListPromise}.
	 */
	events(params: ListAnalyticsEventsParams = {}): ListPromise<AnalyticsEvent> {
		return createListPromise<AnalyticsEvent, ListAnalyticsEventsParams>(
			(pageParams) => this.fetchEventsPage(pageParams),
			params,
			"before",
		);
	}

	private async fetchEventsPage(
		params: ListAnalyticsEventsParams,
	): Promise<Result<Page<AnalyticsEvent>>> {
		const result = await toResult(
			this.http.GET("/analytics/events", { params: { query: params } }),
		);
		if (result.error) return result;
		return {
			data: {
				items: result.data.items,
				hasMore: result.data.pagination.hasMore,
				nextCursor: result.data.pagination.next,
			},
		};
	}
}
