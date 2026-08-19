import { describe, expect, it } from "bun:test";
import { computeBackoffMs, createRetryFetch, parseRetryAfterMs } from "../src/retry.js";

describe("computeBackoffMs", () => {
	it("grows exponentially with attempt number", () => {
		const a0 = computeBackoffMs(0, 100, 10_000);
		const a1 = computeBackoffMs(1, 100, 10_000);
		const a2 = computeBackoffMs(2, 100, 10_000);
		// jitter is +/-20%, so compare against the un-jittered midpoints with slack
		expect(a0).toBeGreaterThanOrEqual(80);
		expect(a0).toBeLessThanOrEqual(120);
		expect(a1).toBeGreaterThanOrEqual(160);
		expect(a1).toBeLessThanOrEqual(240);
		expect(a2).toBeGreaterThanOrEqual(320);
		expect(a2).toBeLessThanOrEqual(480);
	});

	it("never exceeds maxTimeoutMs even at high attempt counts", () => {
		const delay = computeBackoffMs(20, 100, 5_000);
		expect(delay).toBeLessThanOrEqual(5_000);
	});

	it("never returns a negative delay", () => {
		for (let attempt = 0; attempt < 10; attempt++) {
			expect(computeBackoffMs(attempt, 100, 5_000)).toBeGreaterThanOrEqual(0);
		}
	});
});

describe("parseRetryAfterMs", () => {
	it("parses a numeric (seconds) header", () => {
		expect(parseRetryAfterMs("5")).toBe(5000);
	});

	it("parses an HTTP-date header into a relative delay", () => {
		const future = new Date(Date.now() + 3000).toUTCString();
		const ms = parseRetryAfterMs(future);
		expect(ms).toBeGreaterThan(0);
		expect(ms).toBeLessThanOrEqual(3000);
	});

	it("returns undefined for a null header", () => {
		expect(parseRetryAfterMs(null)).toBeUndefined();
	});

	it("returns undefined for garbage input", () => {
		expect(parseRetryAfterMs("not-a-date-or-number")).toBeUndefined();
	});
});

describe("createRetryFetch", () => {
	it("returns the response as-is on a successful first attempt", async () => {
		let calls = 0;
		const baseFetch = async () => {
			calls++;
			return new Response("ok", { status: 200 });
		};
		const retryFetch = createRetryFetch(baseFetch, { minTimeoutMs: 1, maxTimeoutMs: 5 });
		const response = await retryFetch("https://api.opa.sh/v1/links");
		expect(response.status).toBe(200);
		expect(calls).toBe(1);
	});

	it("retries on 5xx up to the configured limit, then returns the last response", async () => {
		let calls = 0;
		const baseFetch = async () => {
			calls++;
			return new Response("boom", { status: 503 });
		};
		const retryFetch = createRetryFetch(baseFetch, {
			retries: 2,
			minTimeoutMs: 1,
			maxTimeoutMs: 5,
		});
		const response = await retryFetch("https://api.opa.sh/v1/links");
		expect(response.status).toBe(503);
		expect(calls).toBe(3); // initial + 2 retries
	});

	it("retries on 429 and honors Retry-After", async () => {
		let calls = 0;
		const start = Date.now();
		const baseFetch = async () => {
			calls++;
			if (calls === 1) {
				return new Response("slow down", { status: 429, headers: { "Retry-After": "0" } });
			}
			return new Response("ok", { status: 200 });
		};
		const retryFetch = createRetryFetch(baseFetch, {
			retries: 3,
			minTimeoutMs: 1,
			maxTimeoutMs: 5,
		});
		const response = await retryFetch("https://api.opa.sh/v1/links");
		expect(response.status).toBe(200);
		expect(calls).toBe(2);
		expect(Date.now() - start).toBeLessThan(1000);
	});

	it("does not retry on 4xx errors other than 429", async () => {
		let calls = 0;
		const baseFetch = async () => {
			calls++;
			return new Response("bad request", { status: 422 });
		};
		const retryFetch = createRetryFetch(baseFetch, {
			retries: 3,
			minTimeoutMs: 1,
			maxTimeoutMs: 5,
		});
		const response = await retryFetch("https://api.opa.sh/v1/links");
		expect(response.status).toBe(422);
		expect(calls).toBe(1);
	});

	it("retries transport-level failures and eventually rethrows", async () => {
		let calls = 0;
		const baseFetch = async () => {
			calls++;
			throw new TypeError("network down");
		};
		const retryFetch = createRetryFetch(baseFetch, {
			retries: 2,
			minTimeoutMs: 1,
			maxTimeoutMs: 5,
		});
		await expect(retryFetch("https://api.opa.sh/v1/links")).rejects.toThrow("network down");
		expect(calls).toBe(3);
	});

	it("clones Request bodies so a POST can be safely retried", async () => {
		let calls = 0;
		const seenBodies: string[] = [];
		const baseFetch = async (input: RequestInfo | URL) => {
			calls++;
			const req = input as Request;
			seenBodies.push(await req.text());
			return calls < 2
				? new Response("boom", { status: 500 })
				: new Response("ok", { status: 200 });
		};
		const retryFetch = createRetryFetch(baseFetch, {
			retries: 2,
			minTimeoutMs: 1,
			maxTimeoutMs: 5,
		});
		const request = new Request("https://api.opa.sh/v1/links", {
			method: "POST",
			body: JSON.stringify({ destinationUrl: "https://example.com" }),
		});
		const response = await retryFetch(request);
		expect(response.status).toBe(200);
		expect(calls).toBe(2);
		expect(seenBodies).toEqual([
			JSON.stringify({ destinationUrl: "https://example.com" }),
			JSON.stringify({ destinationUrl: "https://example.com" }),
		]);
	});

	it("respects retries: 0 (no retrying at all)", async () => {
		let calls = 0;
		const baseFetch = async () => {
			calls++;
			return new Response("boom", { status: 500 });
		};
		const retryFetch = createRetryFetch(baseFetch, { retries: 0 });
		const response = await retryFetch("https://api.opa.sh/v1/links");
		expect(response.status).toBe(500);
		expect(calls).toBe(1);
	});
});
