import { describe, expect, it } from "bun:test";
import { createOpaClient, DEFAULT_BASE_URL } from "../src/client.js";
import { AnalyticsResource } from "../src/resources/analytics.js";
import { DomainsResource } from "../src/resources/domains.js";
import { LinksResource } from "../src/resources/links.js";

describe("createOpaClient", () => {
	it("throws when neither apiKey nor bearerToken is provided", () => {
		// TS allows `{}` here because both fields are optional in the type —
		// the runtime guard below exists for plain-JS callers without that check.
		expect(() => createOpaClient({})).toThrow(/apiKey.*bearerToken/);
	});

	it("wires up the links, analytics and domains resources", () => {
		const opa = createOpaClient({ apiKey: "opa_test_key" });
		expect(opa.links).toBeInstanceOf(LinksResource);
		expect(opa.analytics).toBeInstanceOf(AnalyticsResource);
		expect(opa.domains).toBeInstanceOf(DomainsResource);
	});

	it("defaults to https://api.opa.sh/v1", () => {
		expect(DEFAULT_BASE_URL).toBe("https://api.opa.sh/v1");
	});

	it("sends the API key via the x-api-key header", async () => {
		let seenHeaders: Headers | undefined;
		const fetchStub = async (input: RequestInfo | URL) => {
			seenHeaders = (input as Request).headers;
			return new Response(JSON.stringify({ data: [] }), {
				status: 200,
				headers: { "Content-Type": "application/json" },
			});
		};

		const opa = createOpaClient({ apiKey: "opa_test_key", fetch: fetchStub, retry: false });
		await opa.domains.list();

		expect(seenHeaders?.get("x-api-key")).toBe("opa_test_key");
		expect(seenHeaders?.has("authorization")).toBe(false);
	});

	it("sends a bearer token via the Authorization header", async () => {
		let seenHeaders: Headers | undefined;
		const fetchStub = async (input: RequestInfo | URL) => {
			seenHeaders = (input as Request).headers;
			return new Response(JSON.stringify({ data: [] }), {
				status: 200,
				headers: { "Content-Type": "application/json" },
			});
		};

		const opa = createOpaClient({ bearerToken: "tok_abc", fetch: fetchStub, retry: false });
		await opa.domains.list();

		expect(seenHeaders?.get("authorization")).toBe("Bearer tok_abc");
	});

	it("merges custom headers into every request", async () => {
		let seenHeaders: Headers | undefined;
		const fetchStub = async (input: RequestInfo | URL) => {
			seenHeaders = (input as Request).headers;
			return new Response(JSON.stringify({ data: [] }), {
				status: 200,
				headers: { "Content-Type": "application/json" },
			});
		};

		const opa = createOpaClient({
			apiKey: "opa_test_key",
			headers: { "X-Client-Name": "test-suite" },
			fetch: fetchStub,
			retry: false,
		});
		await opa.domains.list();

		expect(seenHeaders?.get("x-client-name")).toBe("test-suite");
	});

	it("requests against the configured baseUrl", async () => {
		let seenUrl = "";
		const fetchStub = async (input: RequestInfo | URL) => {
			seenUrl = input instanceof Request ? input.url : String(input);
			return new Response(JSON.stringify({ data: [] }), {
				status: 200,
				headers: { "Content-Type": "application/json" },
			});
		};

		const opa = createOpaClient({
			apiKey: "opa_test_key",
			baseUrl: "https://staging.api.opa.sh/v1",
			fetch: fetchStub,
			retry: false,
		});
		await opa.domains.list();

		expect(seenUrl).toBe("https://staging.api.opa.sh/v1/domains");
	});

	it("returns a Result error (never throws) when the API responds with 401", async () => {
		const fetchStub = async () =>
			new Response(
				JSON.stringify({ error: { code: "unauthorized", message: "Missing API key." } }),
				{
					status: 401,
					headers: { "Content-Type": "application/json" },
				},
			);

		const opa = createOpaClient({ apiKey: "bad_key", fetch: fetchStub, retry: false });
		const result = await opa.links.get("lnk_123");

		expect(result.data).toBeUndefined();
		expect(result.error?.code).toBe("unauthorized");
	});

	it("sends the Idempotency-Key header on mutating calls when provided", async () => {
		let seenHeaders: Headers | undefined;
		const fetchStub = async (input: RequestInfo | URL) => {
			seenHeaders = (input as Request).headers;
			return new Response(JSON.stringify({ data: { archivedCount: 1 } }), {
				status: 200,
				headers: { "Content-Type": "application/json" },
			});
		};

		const opa = createOpaClient({ apiKey: "opa_test_key", fetch: fetchStub, retry: false });
		await opa.links.bulkArchive({ linkIds: ["lnk_1"] }, { idempotencyKey: "idem-key-123" });

		expect(seenHeaders?.get("idempotency-key")).toBe("idem-key-123");
	});
});
