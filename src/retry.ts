/**
 * A minimal, structural `fetch` signature — deliberately narrower than
 * `typeof fetch` so runtime-specific augmentations (e.g. Bun's static
 * `fetch.preconnect`) never leak into the SDK's public types.
 */
export type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

/**
 * Retry configuration for the SDK's `fetch` wrapper. Applies to `5xx` and
 * `429` responses, plus transport-level failures (DNS, TCP resets, etc).
 * `Retry-After` (seconds or HTTP-date) is honored when present, taking
 * priority over the computed backoff.
 */
export interface RetryConfig {
	/** Maximum retry attempts after the initial request. Default `3`. */
	retries?: number;
	/** Minimum backoff before the first retry, in ms. Default `500`. */
	minTimeoutMs?: number;
	/** Backoff ceiling, in ms. Default `8000`. */
	maxTimeoutMs?: number;
}

const DEFAULTS: Required<RetryConfig> = {
	retries: 3,
	minTimeoutMs: 500,
	maxTimeoutMs: 8_000,
};

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
	return new Promise((resolve, reject) => {
		if (signal?.aborted) {
			reject(signal.reason ?? new DOMException("Aborted", "AbortError"));
			return;
		}
		const timer = setTimeout(resolve, ms);
		signal?.addEventListener(
			"abort",
			() => {
				clearTimeout(timer);
				reject(signal.reason ?? new DOMException("Aborted", "AbortError"));
			},
			{ once: true },
		);
	});
}

/** Exponential backoff with +/-20% jitter, capped at `maxTimeoutMs`. */
export function computeBackoffMs(
	attempt: number,
	minTimeoutMs: number,
	maxTimeoutMs: number,
): number {
	const exponential = Math.min(maxTimeoutMs, minTimeoutMs * 2 ** attempt);
	const jitter = exponential * 0.2 * (Math.random() * 2 - 1);
	return Math.max(0, Math.min(maxTimeoutMs, Math.round(exponential + jitter)));
}

/** Parses `Retry-After` (seconds or HTTP-date) into a millisecond delay. */
export function parseRetryAfterMs(header: string | null): number | undefined {
	if (!header) return undefined;
	const seconds = Number(header);
	if (!Number.isNaN(seconds)) return Math.max(0, seconds * 1000);
	const dateMs = Date.parse(header);
	if (!Number.isNaN(dateMs)) return Math.max(0, dateMs - Date.now());
	return undefined;
}

function isRetryableStatus(status: number): boolean {
	return status === 429 || status >= 500;
}

/**
 * Wraps a `fetch` implementation with retry + exponential backoff. Requests
 * with a body are retried via `Request.clone()`, so streamed bodies (which
 * can't be re-read) are the one input this can't safely retry — the SDK
 * only ever sends JSON bodies, so this never applies in practice.
 */
export function createRetryFetch(baseFetch: FetchLike, config: RetryConfig = {}): FetchLike {
	const retries = config.retries ?? DEFAULTS.retries;
	const minTimeoutMs = config.minTimeoutMs ?? DEFAULTS.minTimeoutMs;
	const maxTimeoutMs = config.maxTimeoutMs ?? DEFAULTS.maxTimeoutMs;

	return async function retryFetch(input, init) {
		const signal = init?.signal ?? (input instanceof Request ? input.signal : undefined);
		let attempt = 0;

		while (true) {
			const attemptInput = input instanceof Request ? input.clone() : input;
			let response: Response;
			try {
				response = await baseFetch(attemptInput, init);
			} catch (error) {
				if (attempt >= retries || signal?.aborted) throw error;
				await sleep(computeBackoffMs(attempt, minTimeoutMs, maxTimeoutMs), signal);
				attempt++;
				continue;
			}

			if (isRetryableStatus(response.status) && attempt < retries) {
				const retryAfterMs = parseRetryAfterMs(response.headers.get("retry-after"));
				const delayMs = retryAfterMs ?? computeBackoffMs(attempt, minTimeoutMs, maxTimeoutMs);
				await sleep(delayMs, signal);
				attempt++;
				continue;
			}

			return response;
		}
	};
}
