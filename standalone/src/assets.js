import fs from "node:fs/promises";
import path from "node:path";
import { cors } from "@elysiajs/cors";
import { Elysia, file } from "elysia";

if (
	process.env.ENABLE_ASSETS_SERVER === "true" &&
	(process.env.WIDGET_VERSION === "latest" ||
		process.env.WASM_VERSION === "latest")
) {
	console.warn(
		"📦 [asset server] using 'latest' version for assets is not recommended for production!\n   make sure to pin it to a set version using the WIDGET_VERSION and WASM_VERSION env variables.",
	);
}

const dataDir = process.env.DATA_PATH || "./.data";

const updateCache = async () => {
	if (process.env.ENABLE_ASSETS_SERVER !== "true") return;

	const cacheConfigPath = path.join(dataDir, "assets-cache.json");
	let cacheConfig = {};

	try {
		cacheConfig = JSON.parse(await fs.readFile(cacheConfigPath, "utf-8"));
	} catch {}

	const lastUpdate = cacheConfig.lastUpdate || 0;
	const currentTime = Date.now();
	const updateInterval = 1000 * 60 * 60 * 24; // 1 day
	const intervalExceeded = currentTime - lastUpdate > updateInterval;

	const WIDGET_VERSION = process.env.WIDGET_VERSION || "latest";
	const WASM_VERSION = process.env.WASM_VERSION || "latest";

	if (!cacheConfig.versions) cacheConfig.versions = {};
	const versionsChanged = cacheConfig.versions.widget !== WIDGET_VERSION
		|| cacheConfig.versions.wasm !== WASM_VERSION;

	if (!intervalExceeded && !versionsChanged) return;

	const CACHE_HOST = process.env.CACHE_HOST || "https://cdn.jsdelivr.net";

	try {
		const [widgetSource, floatingSource, wasmSource, wasmLoaderSource] =
			await Promise.all([
				fetch(`${CACHE_HOST}/npm/@cap.js/widget@${WIDGET_VERSION}`).then((r) =>
					r.text(),
				),
				fetch(
					`${CACHE_HOST}/npm/@cap.js/widget@${WIDGET_VERSION}/cap-floating.min.js`,
				).then((r) => r.text()),
				fetch(
					`${CACHE_HOST}/npm/@cap.js/wasm@${WASM_VERSION}/browser/cap_wasm_bg.wasm`,
				).then((r) => r.arrayBuffer()),
				fetch(
					`${CACHE_HOST}/npm/@cap.js/wasm@${WASM_VERSION}/browser/cap_wasm.min.js`,
				).then((r) => r.text()),
			]);

		cacheConfig.lastUpdate = currentTime;
		cacheConfig.versions.widget = WIDGET_VERSION;
		cacheConfig.versions.wasm = WASM_VERSION;
		await fs.writeFile(cacheConfigPath, JSON.stringify(cacheConfig));

		await fs.writeFile(path.join(dataDir, "assets-widget.js"), widgetSource);
		await fs.writeFile(
			path.join(dataDir, "assets-floating.js"),
			floatingSource,
		);
		await fs.writeFile(
			path.join(dataDir, "assets-cap_wasm_bg.wasm"),
			Buffer.from(wasmSource),
		);
		await fs.writeFile(
			path.join(dataDir, "assets-cap_wasm.js"),
			wasmLoaderSource,
		);
	} catch (e) {
		console.error("📦 [asset server] failed to update assets cache:", e);
	}
};

updateCache();
setInterval(updateCache, 1000 * 60 * 60); // 1 hour

export const assetsServer = new Elysia({
	prefix: "/assets",
	detail: { tags: ["Assets"] },
})
	.use(
		cors({
			origin: process.env.CORS_ORIGIN?.split(",") || true,
			methods: ["GET"],
		}),
	)
	.onBeforeHandle(({ set }) => {
		set.headers["Cache-Control"] = "max-age=31536000, immutable";
	})
	.get("/widget.js", ({ set }) => {
		set.headers["Content-Type"] = "text/javascript";
		return file(path.join(dataDir, "assets-widget.js"));
	})
	.get("/floating.js", ({ set }) => {
		set.headers["Content-Type"] = "text/javascript";
		return file(path.join(dataDir, "assets-floating.js"));
	})
	.get("/cap_wasm_bg.wasm", ({ set }) => {
		set.headers["Content-Type"] = "application/wasm";
		return file(path.join(dataDir, "assets-cap_wasm_bg.wasm"));
	})
	.get("/cap_wasm.js", ({ set }) => {
		set.headers["Content-Type"] = "text/javascript";
		return file(path.join(dataDir, "assets-cap_wasm.js"));
	});
