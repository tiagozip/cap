import { cors } from "@elysiajs/cors";
import { Elysia } from "elysia";

import { db } from "./db.js";
import { ratelimitGenerator } from "./ratelimit.js";

const getSitekeyWithSecretQuery = db.query(
	`SELECT * FROM keys WHERE siteKey = ?`,
);

const getTokenQuery = db.query(`
  SELECT * FROM tokens WHERE siteKey = ? AND token = ?
`);
const deleteTokenQuery = db.query(`
  DELETE FROM tokens WHERE siteKey = ? AND token = ?
`);

const blockedIPs = new Map();

setInterval(() => {
	const now = Date.now();
	for (const [ip, unblockTime] of blockedIPs.entries()) {
		if (now >= unblockTime) {
			blockedIPs.delete(ip);
		}
	}
}, 2000);

export const siteverifyServer = new Elysia({
	detail: {
		tags: ["Challenges"],
	},
})
	.use(
		cors({
			origin: process.env.CORS_ORIGIN?.split(",") || true,
			methods: ["POST"],
		}),
	)
	.post("/:siteKey/siteverify", async ({ body, set, params, request, server }) => {
		const ip = ratelimitGenerator(request, server);
		const now = Date.now();
		
		const unblockTime = blockedIPs.get(ip);
		if (unblockTime && now < unblockTime) {
			const retryAfter = Math.ceil((unblockTime - now) / 1000);
			set.status = 429;
			set.headers["Retry-After"] = retryAfter.toString();
			set.headers["X-RateLimit-Limit"] = "1";
			set.headers["X-RateLimit-Remaining"] = "0";
			set.headers["X-RateLimit-Reset"] = Math.ceil(unblockTime / 1000).toString();
			return { error: "You were temporarily for using an invalid secret key. Please try again later." };
		}

		const sitekey = params.siteKey;
		const { secret, response } = body;

		if (!sitekey || !secret || !response) {
			set.status = 400;
			return { error: "Missing required parameters" };
		}

		const keyHash = getSitekeyWithSecretQuery.get(sitekey)?.secretHash;
		if (!keyHash) {
			set.status = 404;
			return { error: "Invalid site key or secret" };
		}

		const isValidSecret = await Bun.password.verify(secret, keyHash);
		
		if (!isValidSecret) {
			blockedIPs.set(ip, now + 250);
			set.status = 403;
			return { error: "Invalid site key or secret" };
		}

		const token = getTokenQuery.get(params.siteKey, response);

		if (!token) {
			set.status = 404;
			return { error: "Token not found" };
		}

		if (token.expires < Date.now()) {
			deleteTokenQuery.run(params.siteKey, response);
			set.status = 403;
			return { error: "Token expired" };
		}

		deleteTokenQuery.run(params.siteKey, response);
		return { success: true };
	});
