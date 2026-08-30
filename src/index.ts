import type { paths as GeneratedPaths } from "./generated/openapi.js";
import type { TrackingPaths } from "./tracking-contract.js";

export type { OpaClient, OpaClientConfig, OpaHttpClient } from "./client.js";
export { createOpaClient, DEFAULT_BASE_URL } from "./client.js";
export type { OpaErrorCode, OpaErrorInit, OpaErrorIssue } from "./errors.js";
export { isOpaError, OpaError, parseError, toResult } from "./errors.js";
export type OpaPaths = GeneratedPaths & TrackingPaths;
export type { ListPromise } from "./pagination.js";
export { createListPromise } from "./pagination.js";
export type {
	AnalyticsEvent,
	AnalyticsQueryParams,
	AnalyticsSummary,
	AnalyticsTimeseries,
	ListAnalyticsEventsParams,
} from "./resources/analytics.js";
export { AnalyticsResource } from "./resources/analytics.js";
export type { Domain } from "./resources/domains.js";
export { DomainsResource } from "./resources/domains.js";
export type {
	ArchiveLinkResult,
	BulkArchiveInput,
	BulkArchiveResult,
	BulkMoveInput,
	BulkMoveResult,
	BulkRestoreInput,
	BulkRestoreResult,
	BulkTagInput,
	BulkTagResult,
	CreateLinkInput,
	Link,
	LinkSummary,
	ListLinksParams,
	RestoreLinkResult,
	UpdateLinkInput,
} from "./resources/links.js";
export { LinksResource } from "./resources/links.js";
export { TrackResource } from "./resources/track.js";
export type { RetryConfig } from "./retry.js";
export { computeBackoffMs, createRetryFetch, parseRetryAfterMs } from "./retry.js";
export type {
	ConversionCustomer,
	ConversionEvent,
	IdentifyInput,
	IdentifyResult,
	IdentifyTraits,
	TrackConversionResult,
	TrackEventInput,
	TrackEventResult,
	TrackLeadInput,
	TrackSaleInput,
} from "./tracking-contract.js";
export type { Page, RequestOptions, Result } from "./types.js";
