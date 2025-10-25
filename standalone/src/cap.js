import Cap from "@cap.js/server";
import { cors } from "@elysiajs/cors";
import { Elysia } from "elysia";
import { rateLimit } from "elysia-rate-limit";

import { db } from "./db.js";
import { ratelimitGenerator } from "./ratelimit.js";

const getSitekeyConfigQuery = db.prepare(
	`SELECT (config) FROM keys WHERE siteKey = ?`,
);

const insertChallengeQuery = db.prepare(`
  INSERT INTO challenges (siteKey, token, data, expires)
  VALUES (?, ?, ?, ?)
`);
const getChallengeQuery = db.prepare(`
  SELECT * FROM challenges WHERE siteKey = ? AND token = ?
`);
const deleteChallengeQuery = db.prepare(`
  DELETE FROM challenges WHERE siteKey = ? AND token = ?
`);

const insertTokenQuery = db.prepare(`
  INSERT INTO tokens (siteKey, token, expires)
  VALUES (?, ?, ?)
`);

const upsertSolutionQuery = db.prepare(`
  INSERT INTO solutions (siteKey, bucket, count)
  VALUES (?, ?, 1)
  ON CONFLICT (siteKey, bucket)
  DO UPDATE SET count = count + 1
`);

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
		const _keyConfig = await getSitekeyConfigQuery.get(params.siteKey);

		if (!_keyConfig) {
			set.status = 404;
			return { error: "Invalid site key or secret" };
		}

		const keyConfig = JSON.parse(_keyConfig.config);

		const challenge = await cap.createChallenge({
			challengeCount: keyConfig.challengeCount,
			challengeSize: keyConfig.saltSize,
			challengeDifficulty: keyConfig.difficulty,
		});

		insertChallengeQuery.run(
			params.siteKey,
			challenge.token,
			Object.values(challenge.challenge).join(","),
			challenge.expires,
		);

		return challenge;
	})
	.post("/:siteKey/redeem", async ({ body, set, params }) => {
		const challenge = await getChallengeQuery.get(params.siteKey, body.token);

		try {
			deleteChallengeQuery.run(params.siteKey, body.token);
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

		insertTokenQuery.run(params.siteKey, token, expires);

		const now = Math.floor(Date.now() / 1000);
		const hourlyBucket = Math.floor(now / 3600) * 3600;
		upsertSolutionQuery.run(params.siteKey, hourlyBucket);

		return {
			success: true,
			token,
			expires,
		};
	});
