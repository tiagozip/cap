import fs from "node:fs/promises";
import path from "node:path";
import { cors } from "@elysiajs/cors";
import { Elysia, file } from "elysia";

import { config } from "./config.js";

if (
	config.assetsServer.enabled &&
	(config.assetsServer.versions.widget === "latest" ||
		config.assetsServer.versions.wasm === "latest")
) {
	console.warn(
		"📦 [asset server] using 'latest' version for assets is not recommended for production!\n   make sure to pin it to a set version using the WIDGET_VERSION and WASM_VERSION env variables.",
	);
}

const dataDir = config.dataPath;

const updateCache = async () => {
	if (!config.assetsServer.enabled) return;

	const cacheConfigPath = path.join(dataDir, "assets-cache.json");
	let cacheConfig = {};

	try {
		cacheConfig = JSON.parse(await fs.readFile(cacheConfigPath, "utf-8"));
	} catch {}

	const lastUpdate = cacheConfig.lastUpdate || 0;
	const currentTime = Date.now();
	const updateInterval = 1000 * 60 * 60 * 24; // 1 day
	const intervalExceeded = currentTime - lastUpdate > updateInterval;

	const versions = config.assetsServer.versions;

	if (!cacheConfig.versions) cacheConfig.versions = {};
	const versionsChanged = cacheConfig.versions.widget !== versions.widget
		|| cacheConfig.versions.wasm !== versions.wasm;

	if (!intervalExceeded && !versionsChanged) return;

	const cacheHost = config.assetsServer.cacheHost;

	try {
		const [widgetSource, floatingSource, wasmSource, wasmLoaderSource] =
			await Promise.all([
				fetch(`${cacheHost}/npm/@cap.js/widget@${versions.widget}`).then((r) =>
					r.text(),
				),
				fetch(
					`${cacheHost}/npm/@cap.js/widget@${versions.widget}/cap-floating.min.js`,
				).then((r) => r.text()),
				fetch(
					`${cacheHost}/npm/@cap.js/wasm@${versions.wasm}/browser/cap_wasm_bg.wasm`,
				).then((r) => r.arrayBuffer()),
				fetch(
					`${cacheHost}/npm/@cap.js/wasm@${versions.wasm}/browser/cap_wasm.min.js`,
				).then((r) => r.text()),
			]);

		cacheConfig.lastUpdate = currentTime;
		cacheConfig.versions.widget = versions.widget;
		cacheConfig.versions.wasm = versions.wasm;
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
			origin: config.corsOrigins,
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
