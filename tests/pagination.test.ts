import { describe, expect, it } from "bun:test";
import { OpaError } from "../src/errors.js";
import { createListPromise } from "../src/pagination.js";
import type { Page, Result } from "../src/types.js";

interface Item {
	id: string;
}

interface Params {
	after?: string;
	[key: string]: unknown;
}

function makePages(pages: Page<Item>[]) {
	let call = 0;
	const calls: Params[] = [];
	const fetchPage = async (params: Params): Promise<Result<Page<Item>>> => {
		calls.push(params);
		const page = pages[call];
		call++;
		if (!page) throw new Error("fetchPage called more times than expected");
		return { data: page };
	};
	return { fetchPage, calls };
}

describe("createListPromise", () => {
	it("resolves eagerly to the first page's Result", async () => {
		const { fetchPage } = makePages([
			{ items: [{ id: "1" }, { id: "2" }], hasMore: false, nextCursor: null },
		]);
		const list = createListPromise<Item, Params>(fetchPage, {}, "after");
		const result = await list;
		expect(result.error).toBeUndefined();
		expect(result.data?.items).toEqual([{ id: "1" }, { id: "2" }]);
		expect(result.data?.hasMore).toBe(false);
	});

	it("iterates a single page fully", async () => {
		const { fetchPage } = makePages([
			{ items: [{ id: "1" }, { id: "2" }], hasMore: false, nextCursor: null },
		]);
		const list = createListPromise<Item, Params>(fetchPage, {}, "after");
		const seen: Item[] = [];
		for await (const item of list) {
			seen.push(item);
		}
		expect(seen).toEqual([{ id: "1" }, { id: "2" }]);
	});

	it("walks multiple pages, advancing the cursor param each time", async () => {
		const { fetchPage, calls } = makePages([
			{ items: [{ id: "1" }], hasMore: true, nextCursor: "cursor-1" },
			{ items: [{ id: "2" }], hasMore: true, nextCursor: "cursor-2" },
			{ items: [{ id: "3" }], hasMore: false, nextCursor: null },
		]);
		const list = createListPromise<Item, Params>(fetchPage, {}, "after");
		const seen: Item[] = [];
		for await (const item of list) {
			seen.push(item);
		}
		expect(seen).toEqual([{ id: "1" }, { id: "2" }, { id: "3" }]);
		expect(calls).toEqual([{}, { after: "cursor-1" }, { after: "cursor-2" }]);
	});

	it("reuses the first page's request between the eager await and iteration", async () => {
		let fetchCount = 0;
		const fetchPage = async (): Promise<Result<Page<Item>>> => {
			fetchCount++;
			return { data: { items: [{ id: "1" }], hasMore: false, nextCursor: null } };
		};
		const list = createListPromise<Item, Params>(fetchPage, {}, "after");
		await list; // eager await
		const seen: Item[] = [];
		for await (const item of list) {
			seen.push(item);
		}
		expect(fetchCount).toBe(1);
		expect(seen).toEqual([{ id: "1" }]);
	});

	it("stops iterating when hasMore is true but nextCursor is null", async () => {
		const { fetchPage } = makePages([{ items: [{ id: "1" }], hasMore: true, nextCursor: null }]);
		const list = createListPromise<Item, Params>(fetchPage, {}, "after");
		const seen: Item[] = [];
		for await (const item of list) {
			seen.push(item);
		}
		expect(seen).toEqual([{ id: "1" }]);
	});

	it("throws the OpaError when a later page fails during iteration", async () => {
		let call = 0;
		const fetchPage = async (): Promise<Result<Page<Item>>> => {
			call++;
			if (call === 1) {
				return { data: { items: [{ id: "1" }], hasMore: true, nextCursor: "cursor-1" } };
			}
			return { error: new OpaError({ code: "rate_limited", message: "Slow down." }) };
		};
		const list = createListPromise<Item, Params>(fetchPage, {}, "after");
		const seen: Item[] = [];
		await expect(
			(async () => {
				for await (const item of list) {
					seen.push(item);
				}
			})(),
		).rejects.toThrow("Slow down.");
		expect(seen).toEqual([{ id: "1" }]);
	});

	it("throws immediately if the first page fails during iteration", async () => {
		const fetchPage = async (): Promise<Result<Page<Item>>> => ({
			error: new OpaError({ code: "unauthorized", message: "Missing API key." }),
		});
		const list = createListPromise<Item, Params>(fetchPage, {}, "after");
		await expect(
			(async () => {
				for await (const _item of list) {
					// no-op
				}
			})(),
		).rejects.toThrow("Missing API key.");
	});
});
