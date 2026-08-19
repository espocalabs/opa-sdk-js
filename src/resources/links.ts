import type { OpaHttpClient } from "../client.js";
import { toResult } from "../errors.js";
import type { paths } from "../generated/openapi.js";
import { createListPromise, type ListPromise } from "../pagination.js";
import type { Page, RequestOptions, Result } from "../types.js";

type Paths = paths;

/** Full link detail — returned by `get`, `create`, `update`, `duplicate`. */
export type Link =
	Paths["/links/{id}"]["get"]["responses"]["200"]["content"]["application/json"]["data"];

/** Summary shape returned by `list` — lighter than {@link Link}. */
export type LinkSummary =
	Paths["/links"]["get"]["responses"]["200"]["content"]["application/json"]["data"]["items"][number];

export type ListLinksParams = NonNullable<Paths["/links"]["get"]["parameters"]["query"]>;
export type CreateLinkInput = Paths["/links"]["post"]["requestBody"]["content"]["application/json"];
export type UpdateLinkInput =
	Paths["/links/{id}"]["patch"]["requestBody"]["content"]["application/json"];

export type ArchiveLinkResult =
	Paths["/links/{id}"]["delete"]["responses"]["200"]["content"]["application/json"]["data"];
export type RestoreLinkResult =
	Paths["/links/{id}/restore"]["post"]["responses"]["200"]["content"]["application/json"]["data"];

export type BulkArchiveInput =
	Paths["/links/bulk-archive"]["post"]["requestBody"]["content"]["application/json"];
export type BulkArchiveResult =
	Paths["/links/bulk-archive"]["post"]["responses"]["200"]["content"]["application/json"]["data"];
export type BulkRestoreInput =
	Paths["/links/bulk-restore"]["post"]["requestBody"]["content"]["application/json"];
export type BulkRestoreResult =
	Paths["/links/bulk-restore"]["post"]["responses"]["200"]["content"]["application/json"]["data"];
export type BulkMoveInput =
	Paths["/links/bulk-move"]["post"]["requestBody"]["content"]["application/json"];
export type BulkMoveResult =
	Paths["/links/bulk-move"]["post"]["responses"]["200"]["content"]["application/json"]["data"];
export type BulkTagInput =
	Paths["/links/bulk-tag"]["post"]["requestBody"]["content"]["application/json"];
export type BulkTagResult =
	Paths["/links/bulk-tag"]["post"]["responses"]["200"]["content"]["application/json"]["data"];

function idempotencyHeaders(options?: RequestOptions): Record<string, string> | undefined {
	return options?.idempotencyKey ? { "Idempotency-Key": options.idempotencyKey } : undefined;
}

/** `opa.links` — create, read, update, archive/restore and bulk-manage short links. */
export class LinksResource {
	constructor(private readonly http: OpaHttpClient) {}

	/**
	 * Lists links, newest first. Await it for a single page, or `for await`
	 * it to walk every page. See {@link ListPromise}.
	 */
	list(params: ListLinksParams = {}): ListPromise<LinkSummary> {
		return createListPromise<LinkSummary, ListLinksParams>(
			(pageParams) => this.fetchPage(pageParams),
			params,
			"after",
		);
	}

	private async fetchPage(params: ListLinksParams): Promise<Result<Page<LinkSummary>>> {
		const result = await toResult(this.http.GET("/links", { params: { query: params } }));
		if (result.error) return result;
		return {
			data: {
				items: result.data.items,
				hasMore: result.data.pagination.hasMore,
				nextCursor: result.data.pagination.next,
			},
		};
	}

	/** Fetches a single link by id. */
	get(id: string, options?: RequestOptions): Promise<Result<Link>> {
		return toResult(
			this.http.GET("/links/{id}", { params: { path: { id } }, signal: options?.signal }),
		);
	}

	/** Creates a link. Only `destinationUrl` and `domain` are required. */
	create(input: CreateLinkInput, options?: RequestOptions): Promise<Result<Link>> {
		return toResult(
			this.http.POST("/links", {
				body: input,
				headers: idempotencyHeaders(options),
				signal: options?.signal,
			}),
		);
	}

	/** Full-payload update — same schema as `create`, minus the id. */
	update(id: string, input: UpdateLinkInput, options?: RequestOptions): Promise<Result<Link>> {
		return toResult(
			this.http.PATCH("/links/{id}", {
				params: { path: { id } },
				body: input,
				headers: idempotencyHeaders(options),
				signal: options?.signal,
			}),
		);
	}

	/** Archives a link (reversible with `restore`). The link keeps resolving. */
	archive(id: string, options?: RequestOptions): Promise<Result<ArchiveLinkResult>> {
		return toResult(
			this.http.DELETE("/links/{id}", {
				params: { path: { id } },
				headers: idempotencyHeaders(options),
				signal: options?.signal,
			}),
		);
	}

	/** Un-archives a link. */
	restore(id: string, options?: RequestOptions): Promise<Result<RestoreLinkResult>> {
		return toResult(
			this.http.POST("/links/{id}/restore", {
				params: { path: { id } },
				headers: idempotencyHeaders(options),
				signal: options?.signal,
			}),
		);
	}

	/** Duplicates a link, returning the newly created copy in full detail. */
	duplicate(id: string, options?: RequestOptions): Promise<Result<Link>> {
		return toResult(
			this.http.POST("/links/{id}/duplicate", {
				params: { path: { id } },
				headers: idempotencyHeaders(options),
				signal: options?.signal,
			}),
		);
	}

	/** Archives up to the given set of links in one call. */
	bulkArchive(
		input: BulkArchiveInput,
		options?: RequestOptions,
	): Promise<Result<BulkArchiveResult>> {
		return toResult(
			this.http.POST("/links/bulk-archive", {
				body: input,
				headers: idempotencyHeaders(options),
				signal: options?.signal,
			}),
		);
	}

	/** Restores a set of previously archived links in one call. */
	bulkRestore(
		input: BulkRestoreInput,
		options?: RequestOptions,
	): Promise<Result<BulkRestoreResult>> {
		return toResult(
			this.http.POST("/links/bulk-restore", {
				body: input,
				headers: idempotencyHeaders(options),
				signal: options?.signal,
			}),
		);
	}

	/** Moves a set of links into a folder in one call. */
	bulkMove(input: BulkMoveInput, options?: RequestOptions): Promise<Result<BulkMoveResult>> {
		return toResult(
			this.http.POST("/links/bulk-move", {
				body: input,
				headers: idempotencyHeaders(options),
				signal: options?.signal,
			}),
		);
	}

	/** Adds a set of tags to a set of links in one call. */
	bulkTag(input: BulkTagInput, options?: RequestOptions): Promise<Result<BulkTagResult>> {
		return toResult(
			this.http.POST("/links/bulk-tag", {
				body: input,
				headers: idempotencyHeaders(options),
				signal: options?.signal,
			}),
		);
	}
}
