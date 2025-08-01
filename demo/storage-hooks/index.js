import { Database } from "bun:sqlite";
import fs from "node:fs/promises";
import { Elysia, file } from "elysia";
import Cap from "../../server/index.js";

const db = new Database("./.data/cap.db");

db.exec(`
  CREATE TABLE IF NOT EXISTS challenges (
    token TEXT PRIMARY KEY,
    data TEXT NOT NULL,
    expires INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS tokens (
    key TEXT PRIMARY KEY,
    expires INTEGER NOT NULL
  );
`);

const cap = new Cap({
	storage: {
		challenges: {
			store: async (token, challengeData) => {
				db.prepare(
					"INSERT OR REPLACE INTO challenges (token, data, expires) VALUES (?, ?, ?)",
				).run(
					token,
					JSON.stringify(challengeData.challenge),
					challengeData.expires,
				);
			},
			read: async (token) => {
				const row = db
					.prepare(
						"SELECT data, expires FROM challenges WHERE token = ? AND expires > ?",
					)
					.get(token, Date.now());

				return row
					? { challenge: JSON.parse(row.data), expires: row.expires }
					: null;
			},
			delete: async (token) => {
				db.prepare("DELETE FROM challenges WHERE token = ?").run(token);
			},
			listExpired: async () => {
				const rows = db
					.prepare("SELECT token FROM challenges WHERE expires <= ?")
					.all(Date.now());

				return rows.map((row) => row.token);
			},
		},
		tokens: {
			store: async (tokenKey, expires) => {
				db.prepare(
					"INSERT OR REPLACE INTO tokens (key, expires) VALUES (?, ?)",
				).run(tokenKey, expires);
			},
			get: async (tokenKey) => {
				const row = db
					.prepare("SELECT expires FROM tokens WHERE key = ? AND expires > ?")
					.get(tokenKey, Date.now());

				return row ? row.expires : null;
			},
			delete: async (tokenKey) => {
				db.prepare("DELETE FROM tokens WHERE key = ?").run(tokenKey);
			},
			listExpired: async () => {
				const rows = db
					.prepare("SELECT key FROM tokens WHERE expires <= ?")
					.all(Date.now());

				return rows.map((row) => row.key);
			},
		},
	},
});

const app = new Elysia();

app.get("/", () => file("./index.html"));

app.get("/cap.js", async ({ set }) => {
	// in the newest version, the worker is injected into the main file
	// by a build script. since we don't have a build script here,
	// we'll need to run a minimal build ourselves.

	const main = await fs.readFile("../../widget/src/src/cap.js", "utf-8");
	const worker = await fs.readFile("../../widget/src/src/worker.js", "utf-8");

	const bundle = main.replace("%%workerScript%%", worker);

	set.headers = {
		"Content-Type": "application/javascript",
	};

	return bundle;
});

app.get("/cap-floating.js", () => file("../../widget/src/src/cap-floating.js"));

app.post("/api/challenge", () => cap.createChallenge());

app.post("/api/redeem", async ({ body, set }) => {
	const { token, solutions } = body;
	if (!token || !solutions) {
		set.status = 400;
		return { success: false };
	}

	const answer = await cap.redeemChallenge({ token, solutions });

	console.log("new challenge redeemed", {
		...answer,
		isValid: (await cap.validateToken(answer.token)).success,
	});

	return answer;
});

app.listen(3000);
console.log("Server is running on http://localhost:3000");
