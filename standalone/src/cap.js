import Cap from "@cap.js/server";
import { cors } from "@elysiajs/cors";
import { Elysia } from "elysia";
import { rateLimit } from "elysia-rate-limit";

import { db } from "./db.js";
import { ratelimitGenerator } from "./ratelimit.js";

export const capServer = new Elysia({
	detail: {
		tags: ["Challenges"],
	},
})
	.use(
		rateLimit({
			scoping: "scoped",
			max: 45,
			duration: 5_000,
			generator: ratelimitGenerator,
		}),
	)
	.use(
		cors({
			origin: process.env.CORS_ORIGIN?.split(",") || true,
			methods: ["POST"],
		}),
	)
	.post("/:siteKey/challenge", async ({ set, params }) => {
		const cap = new Cap({
			noFSState: true,
		});
		const [_keyConfig] = await db`SELECT config FROM ${db("keys")} WHERE siteKey = ${params.siteKey} LIMIT 1`;

		if (!_keyConfig) {
			set.status = 404;
			return { error: "Site key not found" };
		}

		const keyConfig = JSON.parse(_keyConfig.config);

		const challenge = await cap.createChallenge({
			challengeCount: keyConfig.challengeCount,
			challengeSize: keyConfig.saltSize,
			challengeDifficulty: keyConfig.difficulty,
		});

		await db`
			INSERT INTO ${db("challenges")} (siteKey, token, data, expires)
			VALUES (${params.siteKey}, ${challenge.token}, ${Object.values(challenge.challenge).join(",")}, ${challenge.expires})
		`;

		return challenge;
	})
	.post("/:siteKey/redeem", async ({ body, set, params }) => {
		const [challenge] = await db`
			SELECT * FROM ${db("challenges")} WHERE siteKey = ${params.siteKey} AND token = ${body.token} LIMIT 1
		`;

		try {
			await db`DELETE FROM ${db("challenges")} WHERE siteKey = ${params.siteKey} AND token = ${body.token}`;
		} catch {
			set.status = 404;
			return { error: "Challenge not found" };
		}

		if (!challenge) {
			set.status = 404;
			return { error: "Challenge not found" };
		}

		const cap = new Cap({
			noFSState: true,
			state: {
				challengesList: {
					[challenge.token]: {
						challenge: {
							c: challenge.data.split(",")[0],
							s: challenge.data.split(",")[1],
							d: challenge.data.split(",")[2],
						},
						expires: challenge.expires,
					},
				},
			},
		});

		const { success, token, expires } = await cap.redeemChallenge(body);

		if (!success) {
			set.status = 403;
			return { error: "Invalid solution" };
		}

		await db`
			INSERT INTO ${db("tokens")} (siteKey, token, expires)
			VALUES (${params.siteKey}, ${token}, ${expires})
		`;

		const now = Math.floor(Date.now() / 1000);
		const hourlyBucket = Math.floor(now / 3600) * 3600;
		if (db.provider === "sqlite" || db.provider === "postgres") {
			await db`
				INSERT INTO solutions (siteKey, bucket, count)
				VALUES (${params.siteKey}, ${hourlyBucket}, 1)
				ON CONFLICT (siteKey, bucket)
			    DO UPDATE SET count = solutions.count + 1
			`;
		} else { // Mysql is special...
			await db`
				INSERT INTO ${db("solutions")} (siteKey, bucket, count)
				VALUES (${params.siteKey}, ${hourlyBucket}, 1)
				ON DUPLICATE KEY UPDATE SET count = ${db("solutions")}.count + 1
			`;
		}

		return {
			success: true,
			token,
			expires,
		};
	});
