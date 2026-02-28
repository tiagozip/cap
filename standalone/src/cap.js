import Cap from "@cap.js/server";
import { cors } from "@elysiajs/cors";
import { Elysia } from "elysia";
import { rateLimit } from "elysia-rate-limit";

import { db } from "./db.js";
import {
  generateInstrumentationChallenge,
  verifyInstrumentationResult,
} from "./instrumentation.js";
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
    const [_keyConfig] = await db`SELECT (config) FROM keys WHERE siteKey = ${params.siteKey}`;

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

    await db`
			INSERT INTO challenges (siteKey, token, data, expires)
			VALUES (${params.siteKey}, ${challenge.token}, ${`${challenge.challenge.c},${challenge.challenge.s},${challenge.challenge.d}`}, ${challenge.expires})
		`;

    if (keyConfig.instrumentation) {
      const instr = await generateInstrumentationChallenge(keyConfig);

      const instrMeta = JSON.stringify({
        id: instr.id,
        validStates: instr.validStates,
        vars: instr.vars,
        blockAutomatedBrowsers: instr.blockAutomatedBrowsers,
        expires: instr.expires,
      });

      await db`
				INSERT INTO challenges (siteKey, token, data, expires)
				VALUES (
					${params.siteKey},
					${"instr_" + challenge.token},
					${instrMeta},
					${challenge.expires}
				)
			`;

      return {
        ...challenge,
        instrumentation: instr.instrumentation,
      };
    }

    return challenge;
  })
  .post("/:siteKey/redeem", async ({ body, set, params }) => {
    if (!body || !body.token || !body.solutions) {
      set.status = 400;
      return { error: "Missing required fields" };
    }

    const instrTokenKey = "instr_" + body.token;

    const deleted = await db`
			DELETE FROM challenges
			WHERE siteKey = ${params.siteKey}
			  AND token IN (${body.token}, ${instrTokenKey})
			RETURNING *
		`;

    const challenge = deleted.find((r) => r.token === body.token);
    const instrRow = deleted.find((r) => r.token === instrTokenKey);

    if (!challenge) {
      set.status = 404;
      return { error: "Challenge not found" };
    }

    if (challenge.expires < Date.now()) {
      set.status = 403;
      return { error: "Challenge expired" };
    }

    const cap = new Cap({
      noFSState: true,
      state: {
        challengesList: {
          [challenge.token]: {
            challenge: {
              c: Number(challenge.data.split(",")[0]),
              s: Number(challenge.data.split(",")[1]),
              d: Number(challenge.data.split(",")[2]),
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

    let instrResult = null;

    if (instrRow) {
      let challengeMeta;
      try {
        challengeMeta = JSON.parse(instrRow.data);
      } catch {
        challengeMeta = null;
      }

      if (challengeMeta && body.instr_blocked === true) {
        if (challengeMeta.blockAutomatedBrowsers) {
          set.status = 403;
          return { instr_error: true, error: "Blocked by instrumentation" };
        }

        set.status = 403;
        return { instr_error: true, error: "Blocked by instrumentation" };
      } else if (challengeMeta && body.instr) {
        if (challengeMeta.expires && Date.now() > challengeMeta.expires) {
          instrResult = { valid: false, env: null, reason: "expired" };
        } else {
          instrResult = verifyInstrumentationResult(challengeMeta, body.instr);
        }

        if (!instrResult.valid) {
          set.status = 403;
          return { instr_error: true, error: "Blocked by instrumentation" };
        }
      } else if (challengeMeta && body.instr_timeout === true) {
        set.status = 429;
        return { instr_error: true, error: "Instrumentation timeout" };
      } else if (challengeMeta && !body.instr && !body.instr_blocked) {
        set.status = 403;
        return { instr_error: true, error: "Blocked by instrumentation" };
      } else if (!challengeMeta) {
        set.status = 403;
        return { instr_error: true, error: "Blocked by instrumentation" };
      }
    }

    await db`
			INSERT INTO tokens (siteKey, token, expires)
			VALUES (${params.siteKey}, ${token}, ${expires})
		`;

    const now = Math.floor(Date.now() / 1000);
    const hourlyBucket = Math.floor(now / 3600) * 3600;
    await db`
			INSERT INTO solutions (siteKey, bucket, count)
			VALUES (${params.siteKey}, ${hourlyBucket}, 1)
			ON CONFLICT (siteKey, bucket)
			DO UPDATE SET count = count + 1
		`;

    return {
      success: true,
      token,
      expires,
    };
  });
