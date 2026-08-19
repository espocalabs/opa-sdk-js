/**
 * Compile-time contract checks between the hand-written resource types
 * (src/resources/**) and the generated OpenAPI types (src/generated/openapi.ts).
 *
 * These fixtures only need to type-check via `satisfies` — if `bun run
 * generate:types` picks up a breaking spec change (a field renamed or
 * removed), `bun run typecheck` fails here before anything ships. The
 * runtime assertions underneath just prove the fixtures are non-trivial.
 */
import { describe, expect, it } from "bun:test";
import type {
	AnalyticsEvent,
	AnalyticsQueryParams,
	AnalyticsSummary,
} from "../src/resources/analytics.js";
import type { Domain } from "../src/resources/domains.js";
import type {
	BulkArchiveInput,
	CreateLinkInput,
	Link,
	LinkSummary,
	ListLinksParams,
	UpdateLinkInput,
} from "../src/resources/links.js";

describe("resource types stay in sync with the OpenAPI spec", () => {
	it("Link (GET /links/{id} detail shape)", () => {
		const link = {
			id: "lnk_123",
			domain: "opa.sh",
			key: "abc123",
			shortLink: "https://opa.sh/abc123",
			destinationUrl: "https://example.com",
			title: null,
			description: null,
			imageUrl: null,
			comments: null,
			folderId: "",
			tagIds: [],
			utmTemplateId: null,
			utmSource: null,
			utmMedium: null,
			utmCampaign: null,
			utmTerm: null,
			utmContent: null,
			utmReferral: null,
			expiresAt: null,
			expiredUrl: null,
			doIndex: false,
			hasPassword: false,
			testVariantsCount: 0,
			testCompletedAt: null,
			targeting: null,
			qrSettings: null,
		} satisfies Link;

		expect(link.id).toBe("lnk_123");
		expect(link.shortLink).toBe("https://opa.sh/abc123");
	});

	it("LinkSummary (GET /links list item shape)", () => {
		const summary = {
			id: "lnk_123",
			domain: "opa.sh",
			key: "abc123",
			shortLink: "https://opa.sh/abc123",
			destinationUrl: "https://example.com",
			title: null,
			description: null,
			imageUrl: null,
			comments: null,
			createdAt: "2026-01-01T00:00:00.000Z",
			expiresAt: null,
			disabledAt: null,
			testCompletedAt: null,
			testVariantsCount: 0,
			qrSettings: null,
			folder: null,
			tags: [{ id: "tag_1", name: "marketing", color: "#0ea5e9" }],
		} satisfies LinkSummary;

		expect(summary.tags).toHaveLength(1);
	});

	it("CreateLinkInput / UpdateLinkInput require destinationUrl + domain", () => {
		const create = {
			destinationUrl: "https://example.com",
			domain: "opa.sh",
		} satisfies CreateLinkInput;
		const update = {
			destinationUrl: "https://example.com/updated",
			domain: "opa.sh",
		} satisfies UpdateLinkInput;

		expect(create.domain).toBe("opa.sh");
		expect(update.destinationUrl).toBe("https://example.com/updated");
	});

	it("ListLinksParams accepts the documented query filters", () => {
		const params = {
			limit: 50,
			archived: false,
			search: "campaign",
		} satisfies ListLinksParams;

		expect(params.limit).toBe(50);
	});

	it("BulkArchiveInput requires linkIds", () => {
		const input = { linkIds: ["lnk_1", "lnk_2"] } satisfies BulkArchiveInput;
		expect(input.linkIds).toHaveLength(2);
	});

	it("AnalyticsQueryParams requires from/to", () => {
		const params = {
			from: "2026-01-01",
			to: "2026-01-31",
			linkId: "lnk_123",
		} satisfies AnalyticsQueryParams;
		expect(params.from).toBe("2026-01-01");
	});

	it("AnalyticsSummary matches the summary response shape", () => {
		const summary = {
			range: { from: "2026-01-01", to: "2026-01-31" },
			clamped: false,
			clicks: 1000,
			uniqueClicks: 800,
		} satisfies AnalyticsSummary;
		expect(summary.clicks).toBeGreaterThan(summary.uniqueClicks - 1);
	});

	it("AnalyticsEvent matches an events list item", () => {
		const event = {
			timestamp: "2026-01-01T12:00:00.000Z",
			linkId: "lnk_123",
			country: "BR",
			city: "São Paulo",
			device: "mobile",
			os: "iOS",
			browser: "Safari",
			refererDomain: "google.com",
			refererUrl: "https://google.com/search",
			utmSource: "newsletter",
			utmCampaign: "launch",
			variantUrl: "",
			clickId: "clk_1",
		} satisfies AnalyticsEvent;
		expect(event.country).toBe("BR");
	});

	it("Domain matches the domains list item shape", () => {
		const domain = {
			id: "dom_1",
			domain: "opa.sh",
			type: "APP_DOMAIN",
			verified: true,
			primary: true,
			allowedHosts: ["opa.sh"],
		} satisfies Domain;
		expect(domain.type).toBe("APP_DOMAIN");
	});
});
