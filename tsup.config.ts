import { defineConfig } from "tsup";

export default defineConfig({
	entry: ["src/index.ts"],
	format: ["esm", "cjs"],
	dts: true,
	clean: true,
	sourcemap: true,
	minify: true,
	splitting: false,
	target: "es2022",
	// "node" (tsup's default) — NOT because this SDK is Node-only (it isn't;
	// it only ever touches global fetch/Request/Response/Headers/AbortSignal,
	// available in Node 18+, Bun, Deno, browsers and Workers), but because
	// esbuild's "neutral" platform mis-handles the CJS/ESM interop for our
	// default import of openapi-fetch, double-wrapping its default export
	// in the CJS build. "node" resolves that without pulling in anything
	// Node-specific.
	platform: "node",
});
