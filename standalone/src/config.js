import fs from "node:fs/promises";
import path from "node:path";

async function readEnv(varName) {
	const fileVarName = `${varName}_FILE`;
	const filePath = process.env[fileVarName];
	if (filePath) return (await fs.readFile(filePath, "utf-8")).trim();
	return process.env[varName];
}

const dataPath = path.resolve(await readEnv("DATA_PATH") || ".data");
await fs.mkdir(dataPath, {recursive: true});

const adminKey = await readEnv("ADMIN_KEY");
if (!adminKey) throw new Error("auth: Admin key missing. Please add one");
if (adminKey.length < 12)
	throw new Error(
		"auth: Admin key too short. Please use one that's at least 12 characters"
    );

const dbUrl = await readEnv("DB_URL") || `sqlite://${path.join(dataPath, "db.sqlite")}`;

const corsOrigins = (await readEnv("CORS_ORIGIN"))?.split(",") || true;

const enableAssetsServer = await readEnv("ENABLE_ASSETS_SERVER") === "true";
const widgetAssetVersion = await readEnv("WIDGET_VERSION") || "latest";
const wasmAssetVersion = await readEnv("WASM_VERSION") || "latest";
const cacheHost = await readEnv("CACHE_HOST") || "https://cdn.jsdelivr.net";

const serverPort = await readEnv("SERVER_PORT") || 3000;
const serverHostname = await readEnv("SERVER_HOSTNAME") || "0.0.0.0";

const rateLimitIpHeader = await readEnv("RATELIMIT_IP_HEADER");
const rateLimitHideIpWarning = await readEnv("HIDE_RATELIMIT_IP_WARNING") === "true";

export const config = {
	dataPath,
	dbUrl,
	adminKey,
	corsOrigins,
	assetsServer: {
		enabled: enableAssetsServer,
		cacheHost,
		versions: {
			widget: widgetAssetVersion,
			wasm: wasmAssetVersion,
		},
	},
	server: {
		hostname: serverHostname,
		port: serverPort,
	},
    rateLimiting: {
		ipHeader: rateLimitIpHeader,
		hideWarning: rateLimitHideIpWarning,
	},
};
