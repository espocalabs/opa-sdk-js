#!/usr/bin/env -S node --experimental-strip-types
/**
 * Full-surface smoke test for @opa.sh/sdk against the REAL API.
 *
 * Exercises every public SDK method once, end to end, and reports a
 * ✓/✗ line per call. Every resource it creates is tagged with a unique
 * run id (embedded in the link `key` and `destinationUrl`) so cleanup at
 * the end can find and archive exactly what this run created — nothing
 * else in the account is touched.
 *
 * Usage:
 *   cp .env.example .env   # then fill in OPA_API_KEY
 *   bun install
 *   bun run examples/full-test.ts
 *   # or: bun run test   (from inside examples/)
 *
 * Exit code 0 if every exercised method succeeded (or was intentionally
 * skipped), 1 if anything failed.
 */

import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
	type AnalyticsEvent,
	type AnalyticsSummary,
	type AnalyticsTimeseries,
	createOpaClient,
	type Domain,
	type Link,
	type LinkSummary,
	type OpaError,
} from "@opa.sh/sdk";

// ---------------------------------------------------------------------------
// Env loading — works whether this is run via `bun run`, `tsx`, or plain
// `node`. Bun and tsx-with---env-file already populate process.env from a
// `.env` in cwd; this fallback just makes sure it's honored either way
// without adding a `dotenv` dependency.
// ---------------------------------------------------------------------------
function loadDotEnvFallback(): void {
	if (process.env.OPA_API_KEY) return;
	const here = dirname(fileURLToPath(import.meta.url));
	const envPath = join(here, ".env");
	if (!existsSync(envPath)) return;
	for (const line of readFileSync(envPath, "utf8").split("\n")) {
		const trimmed = line.trim();
		if (!trimmed || trimmed.startsWith("#")) continue;
		const eq = trimmed.indexOf("=");
		if (eq === -1) continue;
		const key = trimmed.slice(0, eq).trim();
		let value = trimmed.slice(eq + 1).trim();
		if (
			(value.startsWith('"') && value.endsWith('"')) ||
			(value.startsWith("'") && value.endsWith("'"))
		) {
			value = value.slice(1, -1);
		}
		if (process.env[key] === undefined) process.env[key] = value;
	}
}
loadDotEnvFallback();

const apiKey = process.env.OPA_API_KEY;
if (!apiKey) {
	console.error("✗ OPA_API_KEY is not set. Copy .env.example to .env and fill it in.");
	process.exit(1);
}

const baseUrl = process.env.OPA_BASE_URL || undefined;
const opa = createOpaClient(baseUrl ? { apiKey, baseUrl } : { apiKey });

// ---------------------------------------------------------------------------
// Test-run identity — every resource this script creates carries this tag,
// both so cleanup can find exactly what it made and so nothing else in the
// account is ever at risk of being touched.
// ---------------------------------------------------------------------------
const RUN_ID = Date.now().toString(36);
const TAG = `sdk-test-${RUN_ID}`;
const createdLinkIds = new Set<string>();

console.log(`Opa SDK full-surface test — run ${TAG}`);
console.log(`Base URL: ${baseUrl ?? "https://api.opa.sh/v1 (default)"}\n`);

// ---------------------------------------------------------------------------
// Step runner: times each call, enforces a 30s soft timeout, logs a ✓/✗
// line, and records the outcome for the final summary. Never throws.
// ---------------------------------------------------------------------------
interface Outcome {
	name: string;
	ok: boolean;
	skipped: boolean;
	ms: number;
	detail: string;
}

const outcomes: Outcome[] = [];
const TIMEOUT_MS = 30_000;

function withTimeout<T>(promise: Promise<T>, label: string): Promise<T> {
	let timer: ReturnType<typeof setTimeout>;
	const timeout = new Promise<never>((_, reject) => {
		timer = setTimeout(
			() => reject(new Error(`"${label}" exceeded ${TIMEOUT_MS}ms — treating as slow/failed`)),
			TIMEOUT_MS,
		);
	});
	return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

async function step<T>(
	name: string,
	fn: () => Promise<{ data?: T; error?: OpaError }>,
	describe: (data: T) => string,
): Promise<T | undefined> {
	const start = Date.now();
	try {
		const result = await withTimeout(fn(), name);
		const ms = Date.now() - start;
		if (result.error) {
			outcomes.push({
				name,
				ok: false,
				skipped: false,
				ms,
				detail: `error.code="${result.error.code}" — ${result.error.message}`,
			});
			console.log(
				`✗ ${name} → error.code="${result.error.code}" (${result.error.message}) [${ms}ms]`,
			);
			return undefined;
		}
		const detail = describe(result.data as T);
		outcomes.push({ name, ok: true, skipped: false, ms, detail });
		console.log(`✓ ${name} → ${detail} [${ms}ms]`);
		return result.data;
	} catch (err) {
		const ms = Date.now() - start;
		const message = err instanceof Error ? err.message : String(err);
		const slow = ms >= TIMEOUT_MS;
		outcomes.push({ name, ok: false, skipped: false, ms, detail: message });
		console.log(`✗ ${name} → threw: ${message} [${ms}ms]${slow ? " (SLOW/timeout)" : ""}`);
		return undefined;
	}
}

async function stepIterate<T>(
	name: string,
	iterable: AsyncIterable<T>,
	describe: (items: T[]) => string,
): Promise<T[]> {
	const start = Date.now();
	const items: T[] = [];
	try {
		await withTimeout(
			(async () => {
				for await (const item of iterable) items.push(item);
			})(),
			name,
		);
		const ms = Date.now() - start;
		const detail = describe(items);
		outcomes.push({ name, ok: true, skipped: false, ms, detail });
		console.log(`✓ ${name} → ${detail} [${ms}ms]`);
		return items;
	} catch (err) {
		const ms = Date.now() - start;
		const message = err instanceof Error ? err.message : String(err);
		const slow = ms >= TIMEOUT_MS;
		outcomes.push({ name, ok: false, skipped: false, ms, detail: message });
		console.log(`✗ ${name} → threw: ${message} [${ms}ms]${slow ? " (SLOW/timeout)" : ""}`);
		return items;
	}
}

function skip(name: string, reason: string): void {
	outcomes.push({ name, ok: true, skipped: true, ms: 0, detail: `skipped — ${reason}` });
	console.log(`… ${name} → skipped (${reason})`);
}

// ---------------------------------------------------------------------------
// Cleanup: archive every link this run created. `archive` (DELETE
// /links/{id}) is the API's soft-delete — there is no hard-delete endpoint,
// so "cleanup" here means archiving, which drops them out of the default
// (non-archived) link list.
// ---------------------------------------------------------------------------
async function cleanup(): Promise<void> {
	const ids = Array.from(createdLinkIds);
	if (ids.length === 0) {
		console.log("\nCleanup: nothing to clean up.");
		return;
	}
	console.log(`\nCleanup: archiving ${ids.length} link(s) created by this run…`);
	const result = await opa.links.bulkArchive({ linkIds: ids });
	if (result.error) {
		console.log(
			`  ✗ bulk cleanup failed (error.code="${result.error.code}") — falling back to per-link archive`,
		);
		for (const id of ids) {
			const single = await opa.links.archive(id);
			console.log(single.error ? `  ✗ archive(${id}) failed` : `  ✓ archive(${id})`);
		}
		return;
	}
	console.log(`  ✓ archived ${ids.length} link(s)`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main(): Promise<void> {
	// --- Links: create ------------------------------------------------------
	const link1 = await step<Link>(
		"opa.links.create (minimal)",
		() =>
			opa.links.create({
				destinationUrl: `https://example.com/${TAG}?scenario=minimal`,
				key: `${TAG}-min`,
			}),
		(d) => `data.shortLink="${d.shortLink}"`,
	);
	if (link1) createdLinkIds.add(link1.id);

	const link2 = await step<Link>(
		"opa.links.create (full options)",
		() =>
			opa.links.create({
				destinationUrl: `https://example.com/${TAG}?scenario=full`,
				key: `${TAG}-full`,
				utmSource: "sdk-test",
				utmMedium: "automation",
				utmCampaign: TAG,
				utmTerm: "full-test",
				utmContent: "variant-a",
				comments: "created by @opa.sh/sdk examples/full-test.ts",
				title: `SDK full-test ${RUN_ID}`,
				description: "Exercises every optional CreateLinkInput field.",
				expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
				expiredUrl: "https://example.com/expired",
				doIndex: false,
				password: `sdkTest-${RUN_ID}`,
			}),
		(d) => `data.shortLink="${d.shortLink}", hasPassword=${d.hasPassword}`,
	);
	if (link2) createdLinkIds.add(link2.id);

	const link3 = await step<Link>(
		"opa.links.create (duplicate source)",
		() =>
			opa.links.create({
				destinationUrl: `https://example.com/${TAG}?scenario=duplicate-source`,
				key: `${TAG}-dup-src`,
			}),
		(d) => `data.shortLink="${d.shortLink}"`,
	);
	if (link3) createdLinkIds.add(link3.id);

	const link4 = await step<Link>(
		"opa.links.create (archive/restore target)",
		() =>
			opa.links.create({
				destinationUrl: `https://example.com/${TAG}?scenario=archive-restore`,
				key: `${TAG}-arc`,
			}),
		(d) => `data.shortLink="${d.shortLink}"`,
	);
	if (link4) createdLinkIds.add(link4.id);

	const link5 = await step<Link>(
		"opa.links.create (bulk-ops target)",
		() =>
			opa.links.create({
				destinationUrl: `https://example.com/${TAG}?scenario=bulk`,
				key: `${TAG}-bulk`,
			}),
		(d) => `data.shortLink="${d.shortLink}"`,
	);
	if (link5) createdLinkIds.add(link5.id);

	// --- Links: get -----------------------------------------------------------
	for (const [label, link] of [
		["link1", link1],
		["link2", link2],
		["link3", link3],
		["link4", link4],
		["link5", link5],
	] as const) {
		if (!link) {
			skip(`opa.links.get (${label})`, "creation failed above");
			continue;
		}
		await step<Link>(
			`opa.links.get (${label})`,
			() => opa.links.get(link.id),
			(d) => `data.id="${d.id}"`,
		);
	}

	// --- Links: update ----------------------------------------------------
	if (link1) {
		await step<Link>(
			"opa.links.update",
			() =>
				opa.links.update(link1.id, {
					destinationUrl: `https://example.com/${TAG}?scenario=minimal-updated`,
					domain: link1.domain,
					comments: "updated by @opa.sh/sdk examples/full-test.ts",
				}),
			(d) => `data.destinationUrl="${d.destinationUrl}"`,
		);
	} else {
		skip("opa.links.update", "link1 creation failed above");
	}

	// --- Links: archive / restore (single) ---------------------------------
	if (link4) {
		await step(
			"opa.links.archive",
			() => opa.links.archive(link4.id),
			(d) => `data=${JSON.stringify(d)}`,
		);
		await step(
			"opa.links.restore",
			() => opa.links.restore(link4.id),
			(d) => `data=${JSON.stringify(d)}`,
		);
	} else {
		skip("opa.links.archive", "link4 creation failed above");
		skip("opa.links.restore", "link4 creation failed above");
	}

	// --- Links: duplicate ----------------------------------------------------
	if (link3) {
		const duplicated = await step<Link>(
			"opa.links.duplicate",
			() => opa.links.duplicate(link3.id),
			(d) => `data.id="${d.id}", data.shortLink="${d.shortLink}"`,
		);
		if (duplicated) createdLinkIds.add(duplicated.id);
	} else {
		skip("opa.links.duplicate", "link3 creation failed above");
	}

	// --- Links: list (single page) -------------------------------------------
	await step<{ items: LinkSummary[]; hasMore: boolean; nextCursor: string | null }>(
		"opa.links.list (single page, search)",
		() => opa.links.list({ search: TAG }),
		(d) => `data.items.length=${d.items.length}, hasMore=${d.hasMore}`,
	);

	// --- Links: list (iterator / "listAll") -----------------------------------
	await stepIterate<LinkSummary>(
		"opa.links.list (for-await, search — listAll)",
		opa.links.list({ search: TAG }),
		(items) => `collected ${items.length} item(s)`,
	);

	// --- Links: bulk archive / restore ---------------------------------------
	const bulkTargets = [link1, link5].filter((l): l is Link => Boolean(l)).map((l) => l.id);
	if (bulkTargets.length > 0) {
		await step(
			"opa.links.bulkArchive",
			() => opa.links.bulkArchive({ linkIds: bulkTargets }),
			(d) => `data=${JSON.stringify(d)}`,
		);
		await step(
			"opa.links.bulkRestore",
			() => opa.links.bulkRestore({ linkIds: bulkTargets }),
			(d) => `data=${JSON.stringify(d)}`,
		);
	} else {
		skip("opa.links.bulkArchive", "no target links available");
		skip("opa.links.bulkRestore", "no target links available");
	}

	// --- Links: bulkTag — no tags resource/endpoint exists in this API ------
	// (no /tags list endpoint in openapi/v1.json, so there is no way to
	// obtain a valid tagId to test against without pre-existing account
	// state). Skipped per instructions: "se opa.tags não existe, pular".
	skip("opa.links.bulkTag", "no tags list endpoint exists — no way to obtain a valid tagId");

	// --- Links: bulkMove — no folder available to move into ------------------
	skip("opa.links.bulkMove", "no folders resource/endpoint to source a folderId from");

	// --- Analytics ------------------------------------------------------------
	const to = new Date();
	const from = new Date(to.getTime() - 7 * 24 * 60 * 60 * 1000);
	const isoDate = (d: Date) => d.toISOString().slice(0, 10);
	const range = { from: isoDate(from), to: isoDate(to) };

	if (link1) {
		await step<AnalyticsSummary>(
			"opa.analytics.summary",
			() => opa.analytics.summary({ ...range, linkId: link1.id }),
			(d) => `data.clicks=${d.clicks}, data.uniqueClicks=${d.uniqueClicks}`,
		);

		await step<AnalyticsTimeseries>(
			"opa.analytics.timeseries",
			() => opa.analytics.timeseries({ ...range, linkId: link1.id }),
			(d) => `data=${JSON.stringify(d).slice(0, 200)}`,
		);

		await stepIterate<AnalyticsEvent>(
			"opa.analytics.events",
			opa.analytics.events({ linkId: link1.id, limit: 10 }),
			(items) => `collected ${items.length} event(s)`,
		);
	} else {
		skip("opa.analytics.summary", "link1 creation failed above");
		skip("opa.analytics.timeseries", "link1 creation failed above");
		skip("opa.analytics.events", "link1 creation failed above");
	}

	// --- Domains ----------------------------------------------------------
	await step<Domain[]>(
		"opa.domains.list",
		() => opa.domains.list(),
		(d) => `data.length=${d.length}`,
	);
}

main()
	.catch((err) => {
		console.error("\nUnexpected top-level failure:", err);
		outcomes.push({
			name: "main()",
			ok: false,
			skipped: false,
			ms: 0,
			detail: err instanceof Error ? err.message : String(err),
		});
	})
	.finally(async () => {
		await cleanup().catch((err) => {
			console.error("Cleanup itself failed:", err);
		});

		const total = outcomes.length;
		const failed = outcomes.filter((o) => !o.ok);
		const skipped = outcomes.filter((o) => o.skipped);
		const succeeded = total - failed.length;

		console.log(`\n${"─".repeat(60)}`);
		console.log(
			`${total} métodos testados, ${succeeded} sucesso (${skipped.length} skipped), ${failed.length} falha`,
		);
		if (failed.length > 0) {
			console.log("\nFailures:");
			for (const f of failed) {
				console.log(`  ✗ ${f.name} — ${f.detail}`);
			}
		}

		process.exit(failed.length > 0 ? 1 : 0);
	});
