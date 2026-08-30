import { describe, expect, it } from "bun:test";
import { createOpaClient } from "../src/client.js";

describe("opa.track", () => {
	it("identifies an anonymous visitor with the exact reserved wire contract", async () => {
		let request: Request | undefined;
		const fetchStub = async (input: RequestInfo | URL) => {
			request = input as Request;
			return new Response(
				JSON.stringify({
					data: {
						customerId: "cus_1",
						anonymousId: "anon_1",
						externalId: "user_1",
						merged: false,
					},
				}),
				{ status: 200, headers: { "Content-Type": "application/json" } },
			);
		};
		const opa = createOpaClient({ apiKey: "opa_test", fetch: fetchStub, retry: false });

		const result = await opa.track.identify({
			anonymousId: "anon_1",
			externalId: "user_1",
			traits: { email: "person@example.com", plan: "pro" },
			clickId: "clk_1",
		});

		expect(request?.url).toBe("https://api.opa.sh/v1/track/identify");
		expect(request?.method).toBe("POST");
		expect(await request?.json()).toEqual({
			anonymousId: "anon_1",
			externalId: "user_1",
			traits: { email: "person@example.com", plan: "pro" },
			clickId: "clk_1",
		});
		expect(result).toEqual({
			data: {
				customerId: "cus_1",
				anonymousId: "anon_1",
				externalId: "user_1",
				merged: false,
			},
		});
	});
});
