import type { Page, Result } from "./types.js";

/**
 * What `resource.list()` returns: awaiting it resolves the first page
 * eagerly as a normal {@link Result}; `for await`-ing it walks every page
 * and yields individual items, fetching subsequent pages on demand.
 *
 * @example Eager — one page
 * ```ts
 * const { data, error } = await opa.links.list({ limit: 50 });
 * if (!error) console.log(data.items, data.hasMore, data.nextCursor);
 * ```
 *
 * @example Iterator — every page
 * ```ts
 * for await (const link of opa.links.list()) {
 *   console.log(link.shortLink);
 * }
 * ```
 *
 * Iteration throws the underlying {@link OpaError} if a page fails partway
 * through — this is the one place the SDK breaks from its "never throw"
 * rule, because `for await` has no other channel to surface a mid-stream
 * failure. Wrap iteration in `try/catch` if a later page might fail.
 */
export type ListPromise<T> = Promise<Result<Page<T>>> & AsyncIterable<T>;

/**
 * Builds a {@link ListPromise}. `fetchPage` must accept the same params
 * shape it was first called with, plus the cursor field overwritten with
 * the previous page's `nextCursor`.
 */
export function createListPromise<T, P extends Record<string, unknown>>(
	fetchPage: (params: P) => Promise<Result<Page<T>>>,
	initialParams: P,
	cursorParam: keyof P,
): ListPromise<T> {
	const firstPage = fetchPage(initialParams);
	const listPromise = firstPage as ListPromise<T>;

	listPromise[Symbol.asyncIterator] = async function* asyncIterator() {
		let params = initialParams;
		let result = await firstPage;

		while (true) {
			if (result.error) throw result.error;
			const page = result.data;
			for (const item of page.items) {
				yield item;
			}
			if (!page.hasMore || !page.nextCursor) return;
			params = { ...params, [cursorParam]: page.nextCursor };
			result = await fetchPage(params);
		}
	};

	return listPromise;
}
