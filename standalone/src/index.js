import { staticPlugin } from "@elysiajs/static";
import { swagger } from "@elysiajs/swagger";
import { Elysia, file } from "elysia";
import { assetsServer } from "./assets.js";
import { auth } from "./auth.js";
import { capServer } from "./cap.js";
import { server } from "./server.js";

const serverPort = process.env.SERVER_PORT || 3000;
const serverHostname = process.env.SERVER_HOSTNAME || '0.0.0.0'

// Normalize BASE_PATH: optional, defaults to no base path, must start with '/' and not end with '/'
let basePath = process.env.BASE_PATH || '';
if (basePath) {
	if (!basePath.startsWith('/')) basePath = '/' + basePath;
	if (basePath.endsWith('/')) basePath = basePath.slice(0, -1);
}

new Elysia({
	serve: {
		port: serverPort,
		hostname: serverHostname
	},
})
	.use(
		swagger({
			scalarConfig: {
				customCss: `.section-header-wrapper .section-header.tight { margin-top: 10px; }`,
			},
			exclude: [basePath + "/", basePath + "/auth/login"],
			documentation: {
				tags: [
					{
						name: "Keys",
						description:
							"Managing, creating and viewing keys. Requires API or session token",
					},
					{
						name: "Settings",
						description:
							"Managing sessions, API keys, and other settings. Requires API or session token",
					},
					{
						name: "Challenges",
						description: "Creating and managing challenges and tokens",
					},
					{
						name: "Assets",
						description: "Reading static assets from the assets server",
					},
				],
				info: {
					title: "Cap Standalone",
					version: "2.0.0",
					description:
						"API endpoints for Cap Standalone. Both Keys and Settings endpoints require an API key or session token.\n\n[Learn more](https://capjs.js.org)",
				},
				securitySchemes: {
					apiKey: {
						type: "http",
					},
				},
			},
		}),
	)
	.use(staticPlugin({
		assets: "./public",
		prefix: `${basePath}/public`
	}))
	.get(basePath, ({ set }) => {
		// Redirect to add trailing slash when base path is configured
		if (basePath) {
			set.status = 301;
			set.headers.Location = basePath + "/";
			return "Redirecting...";
		}
	})
	.get(basePath + "/", async ({ cookie }) => {
		return file(
			cookie.cap_authed?.value === "yes"
				? "./public/index.html"
				: "./public/login.html",
		);
	})
	.use(auth)
	.use(server)
	.use(assetsServer)
	.use(capServer)
	.listen(serverPort);

console.log(`🧢 Cap running on http://${serverHostname}:${serverPort}${basePath}`);
