import { randomBytes } from "node:crypto";
import { Elysia, t } from "elysia";
import { rateLimit } from "elysia-rate-limit";
import { authBeforeHandle } from "./auth.js";
import { db } from "./db.js";
import { ratelimitGenerator } from "./ratelimit.js";

const keyDefaults = {
	difficulty: 4,
	challengeCount: 50,
	saltSize: 32,
};

const get24hSolvesQuery = db.query(
	`SELECT SUM(count) as total FROM solutions WHERE siteKey = ? AND bucket >= ?`,
);
const get24hPreviousQuery = db.query(`
  SELECT SUM(count) as total FROM solutions
  WHERE siteKey = ? AND bucket >= ? AND bucket < ?
`);
const getKeysQuery = db.query(`SELECT * FROM keys ORDER BY created DESC`);

export const server = new Elysia({
	prefix: "/server",
	detail: {
		security: [
			{
				apiKey: [],
			},
		],
	},
})
	.use(
		rateLimit({
			scoping: "scoped",
			max: 150,
			duration: 10_000,
			generator: ratelimitGenerator,
		}),
	)
	.onBeforeHandle(authBeforeHandle)
	.get(
		"/keys",
		() => {
			const now = Math.floor(Date.now() / 1000);
			const day = 24 * 60 * 60;

			const currentStart = now - day;
			const previousStart = now - 2 * day;

			return getKeysQuery.all().map((key) => {
				const current =
					get24hSolvesQuery.get(key.siteKey, currentStart).total || 0;

				const previous =
					get24hPreviousQuery.get(key.siteKey, previousStart, currentStart)
						.total || 0;

				let change = 0;
				let direction = "";

				if (previous > 0) {
					change = ((current - previous) / previous) * 100;
					direction =
						current > previous ? "up" : current < previous ? "down" : "";
				} else if (current > 0) {
					change = 100;
					direction = "up";
				}

				return {
					siteKey: key.siteKey,
					name: key.name,
					created: key.created,
					solvesLast24h: current,
					difference: {
						value: change.toFixed(2),
						direction,
					},
				};
			});
		},
		{
			detail: {
				tags: ["Keys"],
			},
		},
	)
	.post(
		"/keys",
		async ({ body }) => {
			const siteKey = randomBytes(5).toString("hex");
			const secretKey = randomBytes(40)
				.toString("base64")
				.replace(/\+/g, "")
				.replace(/\//g, "")
				.replace(/=+$/, "");

			db.query(
				`INSERT INTO keys (siteKey, name, secretHash, config, created) VALUES (?, ?, ?, ?, ?)`,
			).run(
				siteKey,
				body?.name || siteKey,
				await Bun.password.hash(secretKey),
				JSON.stringify(keyDefaults),
				Date.now(),
			);

			return {
				siteKey,
				secretKey,
			};
		},
		{
			body: t.Object({
				name: t.Optional(t.String()),
			}),
			detail: {
				tags: ["Keys"],
			},
		},
	)
	.get(
		"/keys/:siteKey",
		({ params, query }) => {
			const key = db
				.query(`SELECT * FROM keys WHERE siteKey = ?`)
				.get(params.siteKey);
			if (!key) {
				return { success: false, error: "Key not found" };
			}

			const chartDuration = query.chartDuration || "today";

			const now = Math.floor(Date.now() / 1000);
			const day = 24 * 60 * 60;

			const currentStart = now - day;
			let dataQuery;
			let bucketSize;
			let startTime;

			switch (chartDuration) {
				case "today":
					bucketSize = 3600;
					startTime = Math.floor(Date.now() / 1000 / 86400) * 86400;
					dataQuery = db.query(`
            SELECT bucket, SUM(count) as count 
            FROM solutions 
            WHERE siteKey = ? AND bucket >= ? AND bucket <= ?
            GROUP BY bucket 
            ORDER BY bucket
          `);
					break;
				case "yesterday":
					bucketSize = 3600;
					startTime = Math.floor(Date.now() / 1000 / 86400) * 86400 - 86400;
					dataQuery = db.query(`
            SELECT bucket, SUM(count) as count 
            FROM solutions 
            WHERE siteKey = ? AND bucket >= ? AND bucket < ? 
            GROUP BY bucket 
            ORDER BY bucket
          `);
					break;
				case "last7days":
					bucketSize = 86400;
					startTime = Math.floor((now - 7 * 86400) / 86400) * 86400;
					dataQuery = db.query(`
            SELECT (bucket / 86400) * 86400 as bucket, SUM(count) as count 
            FROM solutions 
            WHERE siteKey = ? AND bucket >= ? 
            GROUP BY (bucket / 86400) * 86400
            ORDER BY bucket
          `);
					break;
				case "last28days":
					bucketSize = 86400;
					startTime = Math.floor((now - 28 * 86400) / 86400) * 86400;
					dataQuery = db.query(`
            SELECT (bucket / 86400) * 86400 as bucket, SUM(count) as count 
            FROM solutions 
            WHERE siteKey = ? AND bucket >= ? 
            GROUP BY (bucket / 86400) * 86400
            ORDER BY bucket
          `);
					break;
				case "last91days":
					bucketSize = 86400;
					startTime = Math.floor((now - 91 * 86400) / 86400) * 86400;
					dataQuery = db.query(`
            SELECT (bucket / 86400) * 86400 as bucket, SUM(count) as count 
            FROM solutions 
            WHERE siteKey = ? AND bucket >= ? 
            GROUP BY (bucket / 86400) * 86400
            ORDER BY bucket
          `);
					break;
				case "alltime":
					bucketSize = 86400;
					startTime = 0;
					dataQuery = db.query(`
            SELECT (bucket / 86400) * 86400 as bucket, SUM(count) as count 
            FROM solutions 
            WHERE siteKey = ? AND bucket >= ? 
            GROUP BY (bucket / 86400) * 86400
            ORDER BY bucket
          `);
					break;
				default:
					bucketSize = 3600;
					startTime = currentStart;
					dataQuery = db.query(`
            SELECT bucket, SUM(count) as count 
            FROM solutions 
            WHERE siteKey = ? AND bucket >= ? 
            GROUP BY bucket 
            ORDER BY bucket
          `);
			}

			let historyData;
			if (chartDuration === "yesterday") {
				historyData = dataQuery.all(
					params.siteKey,
					startTime,
					startTime + 86400,
				);
			} else if (chartDuration === "today") {
				const currentHourBucket = Math.floor(now / 3600) * 3600;
				historyData = dataQuery.all(
					params.siteKey,
					startTime,
					currentHourBucket,
				);
			} else {
				historyData = dataQuery.all(params.siteKey, startTime);
			}

			if (
				chartDuration === "last7days" ||
				chartDuration === "last28days" ||
				chartDuration === "last91days"
			) {
				const days =
					chartDuration === "last7days"
						? 7
						: chartDuration === "last28days"
							? 28
							: 91;
				const completeData = [];
				const dataMap = new Map(
					historyData.map((item) => [item.bucket, item.count]),
				);

				const currentDayStart = Math.floor(now / 86400) * 86400;

				for (let i = 0; i < days; i++) {
					const dayBucket = currentDayStart - (days - 1 - i) * 86400;
					completeData.push({
						bucket: dayBucket,
						count: dataMap.get(dayBucket) || 0,
					});
				}

				historyData = completeData;
			} else if (chartDuration === "today") {
				const completeData = [];
				const dataMap = new Map(
					historyData.map((item) => [item.bucket, item.count]),
				);

				const currentHour = Math.floor(now / 3600);
				const startHour = Math.floor(startTime / 3600);

				for (let hour = startHour; hour <= currentHour; hour++) {
					const hourBucket = hour * 3600;
					completeData.push({
						bucket: hourBucket,
						count: dataMap.get(hourBucket) || 0,
					});
				}

				historyData = completeData;
			}

			const currentSolves =
				get24hSolvesQuery.get(params.siteKey, currentStart).total || 0;

			return {
				key: {
					siteKey: key.siteKey,
					name: key.name,
					created: key.created,
					config: JSON.parse(key.config),
				},
				stats: {
					solvesLast24h: currentSolves,
				},
				chartData: {
					duration: chartDuration,
					bucketSize,
					data: historyData,
				},
			};
		},
		{
			params: t.Object({
				siteKey: t.String(),
			}),
			query: t.Object({
				chartDuration: t.Optional(
					t.Union([
						t.Literal("today"),
						t.Literal("yesterday"),
						t.Literal("last7days"),
						t.Literal("last28days"),
						t.Literal("last91days"),
						t.Literal("alltime"),
					]),
				),
			}),
			detail: {
				tags: ["Keys"],
			},
		},
	)
	.put(
		"/keys/:siteKey/config",
		async ({ params, body }) => {
			const key = db
				.query(`SELECT * FROM keys WHERE siteKey = ?`)
				.get(params.siteKey);
			if (!key) {
				return { success: false, error: "Key not found" };
			}

			const { name, difficulty, challengeCount, saltSize } = body;
			const config = {
				...keyDefaults,
				name,
				difficulty,
				challengeCount,
				saltSize,
			};

			db.query(`UPDATE keys SET name = ?, config = ? WHERE siteKey = ?`).run(
				config.name || key.name,
				JSON.stringify(config),
				params.siteKey,
			);

			return { success: true };
		},
		{
			body: t.Object({
				name: t.Optional(t.String()),
				difficulty: t.Optional(t.Number()),
				challengeCount: t.Optional(t.Number()),
				saltSize: t.Optional(t.Number()),
			}),
			detail: {
				tags: ["Keys"],
			},
		},
	)
	.delete(
		"/keys/:siteKey",
		({ params, set }) => {
			const key = db
				.query(`SELECT * FROM keys WHERE siteKey = ?`)
				.get(params.siteKey);
			if (!key) {
				set.status = 404;
				return { success: false, error: "Key not found" };
			}

			db.query(`DELETE FROM keys WHERE siteKey = ?`).run(params.siteKey);
			db.query(`DELETE FROM solutions WHERE siteKey = ?`).run(params.siteKey);

			return { success: true };
		},
		{
			params: t.Object({
				siteKey: t.String(),
			}),
			detail: {
				tags: ["Keys"],
			},
		},
	)
	.post(
		"/keys/:siteKey/rotate-secret",
		async ({ params }) => {
			const key = db
				.query(`SELECT * FROM keys WHERE siteKey = ?`)
				.get(params.siteKey);
			if (!key) {
				return { success: false, error: "Key not found" };
			}
			const newSecretKey = randomBytes(40)
				.toString("base64")
				.replace(/\+/g, "")
				.replace(/\//g, "")
				.replace(/=+$/, "");

			db.query(`UPDATE keys SET secretHash = ? WHERE siteKey = ?`).run(
				await Bun.password.hash(newSecretKey),
				params.siteKey,
			);
			return {
				secretKey: newSecretKey,
			};
		},
		{
			params: t.Object({
				siteKey: t.String(),
			}),
			detail: {
				tags: ["Keys"],
			},
		},
	)
	.get(
		"/settings/sessions",
		() => {
			const sessions = db.query(`SELECT * FROM sessions`).all();
			return sessions.map((session) => ({
				token: session.token.slice(-14),
				expires: new Date(session.expires).toISOString(),
				created: new Date(session.created).toISOString(),
			}));
		},
		{
			detail: {
				tags: ["Settings"],
			},
		},
	)
	.get(
		"/settings/apikeys",
		() => {
			const apikeys = db.query(`SELECT * FROM api_keys`).all();

			return apikeys.map((key) => ({
				name: key.name,
				id: key.id,
				created: new Date(key.created).toISOString(),
			}));
		},
		{
			detail: {
				tags: ["Settings"],
			},
		},
	)
	.post(
		"/settings/apikeys",
		async ({ body }) => {
			const id = randomBytes(16).toString("hex");
			const token = randomBytes(32)
				.toString("base64")
				.replace(/\+/g, "")
				.replace(/\//g, "")
				.replace(/=+$/, "");

			const name = body.name;

			db.query(
				`INSERT INTO api_keys (id, name, tokenHash, created) VALUES (?, ?, ?, ?)`,
			).run(id, name, await Bun.password.hash(token), Date.now());

			return {
				apiKey: `${id}_${token}`,
			};
		},
		{
			body: t.Object({
				name: t.String(),
			}),
			detail: {
				tags: ["Settings"],
			},
		},
	)
	.delete(
		"/settings/apikeys/:id",
		({ params, set }) => {
			const key = db
				.query(`SELECT * FROM api_keys WHERE id = ?`)
				.get(params.id);
			if (!key) {
				set.status = 404;
				return { success: false, error: "API key not found" };
			}
			db.query(`DELETE FROM api_keys WHERE id = ?`).run(params.id);
			return { success: true };
		},
		{
			params: t.Object({
				id: t.String(),
			}),
			detail: {
				tags: ["Settings"],
			},
		},
	)
	.post(
		"/logout",
		async ({ body, headers, set }) => {
			const { authorization } = headers;
			if (!authorization) {
				set.status = 401;
				return { success: false, error: "Unauthorized" };
			}

			const { hash } = JSON.parse(
				atob(authorization.replace("Bearer ", "").trim()),
			);

			let session = hash;

			if (body.session) {
				// body.session are the last characters of the session token
				// e.g. body.session = (...)8KdbcHjqxWPR6Q

				const sessionRow = db
					.query(`SELECT token FROM sessions WHERE token LIKE ?`)
					.get(`%${body.session}`);

				if (!sessionRow) {
					set.status = 404;
					return { success: false, error: "Session not found" };
				}
				session = sessionRow.token;
			}

			db.query(`DELETE FROM sessions WHERE token = ?`).run(session);

			return { success: true };
		},
		{
			body: t.Optional(
				t.Object({
					session: t.Optional(t.String()),
				}),
			),
			detail: {
				tags: ["Settings"],
			},
		},
	);
