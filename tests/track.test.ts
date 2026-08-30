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

	it("tracks an anonymous-only event and omits every absent optional field", async () => {
		let request: Request | undefined;
		const fetchStub = async (input: RequestInfo | URL) => {
			request = input as Request;
			return new Response(
				JSON.stringify({ data: { eventId: "evt_1", customerId: "cus_1", deduped: false } }),
				{ status: 200, headers: { "Content-Type": "application/json" } },
			);
		};
		const opa = createOpaClient({ apiKey: "opa_test", fetch: fetchStub, retry: false });

		const result = await opa.track.event({
			eventId: "evt_1",
			eventName: "checkout_started",
			anonymousId: "anon_1",
		});

		expect(request?.url).toBe("https://api.opa.sh/v1/track/event");
		expect(await request?.json()).toEqual({
			eventId: "evt_1",
			eventName: "checkout_started",
			anonymousId: "anon_1",
		});
		expect(result).toEqual({
			data: { eventId: "evt_1", customerId: "cus_1", deduped: false },
		});
	});

	it("keeps identity stateless when an external-only event follows identify", async () => {
		const requests: Request[] = [];
		const fetchStub = async (input: RequestInfo | URL) => {
			const request = input as Request;
			requests.push(request);
			const isIdentify = request.url.endsWith("/track/identify");
			return new Response(
				JSON.stringify({
					data: isIdentify
						? {
								customerId: "cus_1",
								anonymousId: "anon_previous",
								externalId: "user_previous",
								merged: false,
							}
						: { eventId: "evt_2", customerId: "cus_2", deduped: false },
				}),
				{ status: 200, headers: { "Content-Type": "application/json" } },
			);
		};
		const opa = createOpaClient({ apiKey: "opa_test", fetch: fetchStub, retry: false });
		await opa.track.identify({
			anonymousId: "anon_previous",
			externalId: "user_previous",
		});

		await opa.track.event({
			eventId: "evt_2",
			eventName: "purchase_completed",
			externalId: "user_2",
			clickId: "clk_2",
			properties: { total: 14990 },
			occurredAt: "2026-08-30T12:00:00.000Z",
		});

		expect(await requests[1]?.json()).toEqual({
			eventId: "evt_2",
			eventName: "purchase_completed",
			externalId: "user_2",
			clickId: "clk_2",
			properties: { total: 14990 },
			occurredAt: "2026-08-30T12:00:00.000Z",
		});
	});
});
