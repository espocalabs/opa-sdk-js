import { describe, expect, it } from "bun:test";
import { isOpaError, OpaError, parseError, toResult } from "../src/errors.js";

describe("OpaError", () => {
	it("exposes the code, message, status and issues it was built with", () => {
		const error = new OpaError({
			code: "validation_error",
			message: "The request did not pass validation.",
			status: 422,
			issues: [{ path: "destinationUrl", message: "Required" }],
		});

		expect(error).toBeInstanceOf(Error);
		expect(error.name).toBe("OpaError");
		expect(error.code).toBe("validation_error");
		expect(error.message).toBe("The request did not pass validation.");
		expect(error.status).toBe(422);
		expect(error.issues).toEqual([{ path: "destinationUrl", message: "Required" }]);
	});

	it.each([
		["unauthorized", "isAuthError"],
		["forbidden", "isPermissionError"],
		["validation_error", "isValidationError"],
		["rate_limited", "isRateLimitError"],
	] as const)("flags %s via .%s", (code, flag) => {
		const error = new OpaError({ code, message: "x" });
		expect(error[flag]).toBe(true);
	});

	it("does not flag unrelated codes", () => {
		const error = new OpaError({ code: "unauthorized", message: "x" });
		expect(error.isPermissionError).toBe(false);
		expect(error.isValidationError).toBe(false);
		expect(error.isRateLimitError).toBe(false);
	});

	it("OpaError.network wraps a thrown cause with code network_error", () => {
		const cause = new TypeError("fetch failed");
		const error = OpaError.network(cause);
		expect(error.code).toBe("network_error");
		expect(error.message).toBe("fetch failed");
		expect(error.cause).toBe(cause);
	});

	it("OpaError.network falls back to a generic message for non-Error causes", () => {
		const error = OpaError.network("boom");
		expect(error.code).toBe("network_error");
		expect(error.message).toBe("Network request failed.");
	});
});

describe("isOpaError", () => {
	it("narrows OpaError instances", () => {
		expect(isOpaError(new OpaError({ code: "unauthorized", message: "x" }))).toBe(true);
		expect(isOpaError(new Error("plain"))).toBe(false);
		expect(isOpaError(null)).toBe(false);
		expect(isOpaError(undefined)).toBe(false);
	});
});

describe("parseError", () => {
	it("builds an OpaError from the API's { error: { code, message } } shape", () => {
		const error = parseError(401, { error: { code: "unauthorized", message: "Missing API key." } });
		expect(error.code).toBe("unauthorized");
		expect(error.message).toBe("Missing API key.");
		expect(error.status).toBe(401);
	});

	it("carries validation issues through", () => {
		const error = parseError(422, {
			error: {
				code: "validation_error",
				message: "Invalid.",
				issues: [{ path: "domain", message: "Unknown domain." }],
			},
		});
		expect(error.issues).toEqual([{ path: "domain", message: "Unknown domain." }]);
	});

	it("falls back to unknown_error for an unrecognized body", () => {
		const error = parseError(500, "<html>Internal Server Error</html>");
		expect(error.code).toBe("unknown_error");
		expect(error.status).toBe(500);
	});

	it("reads retryAfter from the Retry-After header (seconds)", () => {
		const response = new Response(null, { headers: { "Retry-After": "2" } });
		const error = parseError(
			429,
			{ error: { code: "rate_limited", message: "Slow down." } },
			response,
		);
		expect(error.retryAfter).toBe(2000);
	});

	it("reads retryAfter from an HTTP-date Retry-After header", () => {
		const future = new Date(Date.now() + 5000).toUTCString();
		const response = new Response(null, { headers: { "Retry-After": future } });
		const error = parseError(
			429,
			{ error: { code: "rate_limited", message: "Slow down." } },
			response,
		);
		expect(error.retryAfter).toBeGreaterThan(0);
		expect(error.retryAfter).toBeLessThanOrEqual(5000);
	});

	it("leaves retryAfter undefined when the header is absent", () => {
		const error = parseError(500, { error: { code: "unknown_error", message: "x" } });
		expect(error.retryAfter).toBeUndefined();
	});
});

describe("toResult", () => {
	it("unwraps the API's { data: T } envelope into Result.data", async () => {
		const result = await toResult(
			Promise.resolve({
				data: { data: { id: "lnk_123" } },
				response: new Response(null, { status: 200 }),
			}),
		);
		expect(result.error).toBeUndefined();
		expect(result.data).toEqual({ id: "lnk_123" });
	});

	it("converts an openapi-fetch error result into Result.error", async () => {
		const result = await toResult(
			Promise.resolve({
				error: { error: { code: "forbidden", message: "Nope." } },
				response: new Response(null, { status: 403 }),
			}),
		);
		expect(result.data).toBeUndefined();
		expect(result.error).toBeInstanceOf(OpaError);
		expect(result.error?.code).toBe("forbidden");
	});

	it("catches a rejected promise (network failure) into Result.error", async () => {
		const result = await toResult(Promise.reject(new TypeError("fetch failed")));
		expect(result.error?.code).toBe("network_error");
	});
});
