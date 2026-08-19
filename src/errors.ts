import type { Result } from "./types.js";

/**
 * Error codes the Opa API is known to return. The union is left open
 * (`string & {}`) so a code the SDK doesn't know about yet still type-checks
 * instead of breaking callers when the API adds one.
 */
export type OpaErrorCode =
	| "unauthorized"
	| "forbidden"
	| "validation_error"
	| "rate_limited"
	| "not_found"
	| "network_error"
	| "timeout"
	| "unknown_error"
	| (string & Record<never, never>);

export interface OpaErrorIssue {
	path: string;
	message: string;
}

export interface OpaErrorInit {
	code: OpaErrorCode;
	message: string;
	/** HTTP status code, when the error came from a response. */
	status?: number;
	/** Field-level validation issues (present on `validation_error`). */
	issues?: OpaErrorIssue[];
	/** Milliseconds to wait before retrying, when known (from `Retry-After`). */
	retryAfter?: number;
	cause?: unknown;
}

/**
 * The error shape every failed SDK call resolves to. Always available on
 * `result.error` — never thrown by resource methods (list iteration is the
 * one documented exception; see `pagination.ts`).
 */
export class OpaError extends Error {
	readonly code: OpaErrorCode;
	readonly status?: number;
	readonly issues?: OpaErrorIssue[];
	readonly retryAfter?: number;

	constructor(init: OpaErrorInit) {
		super(init.message, init.cause !== undefined ? { cause: init.cause } : undefined);
		this.name = "OpaError";
		this.code = init.code;
		this.status = init.status;
		this.issues = init.issues;
		this.retryAfter = init.retryAfter;
	}

	/** True for `unauthorized` (401) — the API key is missing or invalid. */
	get isAuthError(): boolean {
		return this.code === "unauthorized";
	}

	/** True for `forbidden` (403) — the key lacks the required capability. */
	get isPermissionError(): boolean {
		return this.code === "forbidden";
	}

	/** True for `validation_error` (422) — check `.issues` for field detail. */
	get isValidationError(): boolean {
		return this.code === "validation_error";
	}

	/** True for `rate_limited` (429) — back off, ideally by `.retryAfter`. */
	get isRateLimitError(): boolean {
		return this.code === "rate_limited";
	}

	static network(cause: unknown): OpaError {
		const message = cause instanceof Error ? cause.message : "Network request failed.";
		return new OpaError({ code: "network_error", message, cause });
	}
}

export function isOpaError(value: unknown): value is OpaError {
	return value instanceof OpaError;
}

function parseRetryAfterHeader(response?: Response): number | undefined {
	const header = response?.headers.get("retry-after");
	if (!header) return undefined;
	const seconds = Number(header);
	if (!Number.isNaN(seconds)) return seconds * 1000;
	const dateMs = Date.parse(header);
	if (!Number.isNaN(dateMs)) return Math.max(0, dateMs - Date.now());
	return undefined;
}

interface ApiErrorBody {
	error?: {
		code?: string;
		message?: string;
		issues?: OpaErrorIssue[];
	};
}

function isApiErrorBody(value: unknown): value is ApiErrorBody {
	return typeof value === "object" && value !== null && "error" in value;
}

/** Builds an {@link OpaError} from a non-2xx openapi-fetch result. */
export function parseError(status: number, body: unknown, response?: Response): OpaError {
	const retryAfter = parseRetryAfterHeader(response);
	if (isApiErrorBody(body) && body.error) {
		return new OpaError({
			code: body.error.code ?? "unknown_error",
			message: body.error.message ?? `Request failed with status ${status}.`,
			status,
			issues: body.error.issues,
			retryAfter,
		});
	}
	return new OpaError({
		code: "unknown_error",
		message: `Request failed with status ${status}.`,
		status,
		retryAfter,
	});
}

/**
 * Normalizes an openapi-fetch call into a {@link Result}. Every resource
 * method funnels through this so callers never see a thrown exception.
 *
 * Every Opa API response wraps its payload as `{ data: T }` — this unwraps
 * that envelope, so callers get `T` directly on `result.data`.
 */
export async function toResult<T>(
	call: Promise<{ data?: { data: T }; error?: unknown; response: Response }>,
): Promise<Result<T>> {
	let outcome: { data?: { data: T }; error?: unknown; response: Response };
	try {
		outcome = await call;
	} catch (cause) {
		return { error: OpaError.network(cause) };
	}
	if (outcome.error !== undefined) {
		return { error: parseError(outcome.response.status, outcome.error, outcome.response) };
	}
	return { data: (outcome.data as { data: T }).data };
}
