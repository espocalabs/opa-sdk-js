import type { OpaError } from "./errors.js";

/**
 * The shape every SDK call resolves to. Never throws for API-level failures —
 * check `error` before touching `data`.
 *
 * @example
 * ```ts
 * const { data, error } = await opa.links.get("lnk_123");
 * if (error) {
 *   console.error(error.code, error.message);
 *   return;
 * }
 * console.log(data.shortLink);
 * ```
 */
export type Result<T> = { data: T; error?: never } | { data?: never; error: OpaError };

/**
 * Options accepted by every resource method.
 */
export interface RequestOptions {
	/** Abort the request early. Forwarded straight to `fetch`. */
	signal?: AbortSignal;
}

/**
 * A single page of a cursor-paginated list, normalized across every list
 * endpoint regardless of the underlying cursor parameter name.
 */
export interface Page<T> {
	items: T[];
	hasMore: boolean;
	nextCursor: string | null;
}
