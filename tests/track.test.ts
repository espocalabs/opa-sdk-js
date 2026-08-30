import { describe, expect, it } from "bun:test";
import { createOpaClient } from "../src/client.js";

const CONVERSION_RESULT = {
	event: {
		id: "cnv_1",
		eventType: "lead",
		eventName: "Signup",
		clickId: "clk_1",
		customerId: "cus_1",
		valueCents: null,
		currency: null,
		invoiceId: null,
		paymentProcessor: null,
		metadata: { source: "form" },
		occurredAt: "2026-08-30T12:00:00.000Z",
		createdAt: "2026-08-30T12:00:00.000Z",
	},
	customer: {
		id: "cus_1",
		externalId: "user_1",
		email: "person@example.com",
		name: "Person",
		avatar: null,
		createdAt: "2026-08-30T12:00:00.000Z",
	},
	deduped: false,
};

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

		expect(await requests[0]?.json()).toEqual({
			anonymousId: "anon_previous",
			externalId: "user_previous",
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

	it("tracks a lead with the legacy wire contract", async () => {
		let request: Request | undefined;
		const fetchStub = async (input: RequestInfo | URL) => {
			request = input as Request;
			return new Response(JSON.stringify({ data: CONVERSION_RESULT }), {
				status: 200,
				headers: { "Content-Type": "application/json" },
			});
		};
		const opa = createOpaClient({ apiKey: "opa_test", fetch: fetchStub, retry: false });

		const result = await opa.track.lead({
			clickId: "clk_1",
			eventName: "Signup",
			customerExternalId: "user_1",
			customerEmail: "person@example.com",
			customerName: "Person",
			customerAvatar: "https://example.com/avatar.png",
			metadata: { source: "form" },
		});

		expect(request?.url).toBe("https://api.opa.sh/v1/track/lead");
		expect(await request?.json()).toEqual({
			clickId: "clk_1",
			eventName: "Signup",
			customerExternalId: "user_1",
			customerEmail: "person@example.com",
			customerName: "Person",
			customerAvatar: "https://example.com/avatar.png",
			metadata: { source: "form" },
		});
		expect(result).toEqual({ data: CONVERSION_RESULT });
	});

	it("tracks an idempotent sale with the legacy wire contract", async () => {
		let request: Request | undefined;
		const saleResult = {
			...CONVERSION_RESULT,
			event: {
				...CONVERSION_RESULT.event,
				eventType: "sale",
				eventName: "Purchase",
				valueCents: 14990,
				currency: "brl",
				invoiceId: "inv_1",
				paymentProcessor: "stripe",
			},
		};
		const fetchStub = async (input: RequestInfo | URL) => {
			request = input as Request;
			return new Response(JSON.stringify({ data: saleResult }), {
				status: 200,
				headers: { "Content-Type": "application/json" },
			});
		};
		const opa = createOpaClient({ apiKey: "opa_test", fetch: fetchStub, retry: false });

		const result = await opa.track.sale({
			customerExternalId: "user_1",
			amount: 14990,
			currency: "BRL",
			eventName: "Purchase",
			paymentProcessor: "stripe",
			invoiceId: "inv_1",
			clickId: "clk_1",
			metadata: { orderId: "ord_1" },
		});

		expect(request?.url).toBe("https://api.opa.sh/v1/track/sale");
		expect(await request?.json()).toEqual({
			customerExternalId: "user_1",
			amount: 14990,
			currency: "BRL",
			eventName: "Purchase",
			paymentProcessor: "stripe",
			invoiceId: "inv_1",
			clickId: "clk_1",
			metadata: { orderId: "ord_1" },
		});
		expect(result).toEqual({ data: saleResult });
	});
});
