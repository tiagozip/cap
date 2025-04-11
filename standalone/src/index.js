import { Elysia, file } from "elysia";
import { staticPlugin } from "@elysiajs/static";
import { rateLimit } from "elysia-rate-limit";
import Cap from "@cap.js/server";
import crypto from "crypto";
import fs from "fs/promises";

const { ADMIN_KEY } = process.env;

if (!ADMIN_KEY?.trim()) {
  console.error(
    `\nNo admin key has been set. Make sure to set it using the \n\`ADMIN_KEY\` environment variable.\n\nWe've generated this one for you to use: \n\n${crypto
      .randomBytes(30)
      .toString("hex")}\n\nThen, restart this process.\n\n`
  );
  process.exit(1);
}

if (ADMIN_KEY?.trim() === "your_secret_key") {
  console.error(
    `\nDon't leave the admin key as default! Make sure to set it \nusing the \`ADMIN_KEY\` environment variable.\n\nWe've generated this one for you to use: \n\n${crypto
      .randomBytes(30)
      .toString("hex")}\n\nThen, restart this process.\n\n`
  );
  process.exit(1);
}

if (ADMIN_KEY.length < 12) {
  console.warn(
    `\n${"*".repeat(
      60
    )}\n\nThe admin key you're using is quite short. We recommend \nusing a longer one.\n\nWe've generated this one for you to use: \n\n${crypto
      .randomBytes(30)
      .toString("hex")}\n\nThen, restart this process.\n\n${"*".repeat(60)}\n`
  );
}

const keysStorePath = "./.data/keys.json";
const cap = new Cap({
  tokens_store_path: ".data/tokens-auth.json",
});

let keys = [];
let capInstances = {};

const checkAuth = async (cookie) => {
  const authCookie = cookie["cap-admin-key"]?.value;

  if (!authCookie) return false;

  return await Bun.password.verify(ADMIN_KEY, authCookie);
};

const auth = new Elysia({
  prefix: "/internal/auth",
})
  .use(
    rateLimit({
      scoping: "scoped",
      number: 100,
      duration: 10000,
    })
  )
  .post("/cap/challenge", () => cap.createChallenge())
  .post("/cap/redeem", async (ctx) => {
    const { token, solutions } = ctx.body;

    if (!token || !solutions) {
      ctx.status = 400;
      return { success: false };
    }
    return await cap.redeemChallenge({ token, solutions });
  })
  .post("/", async ({ body: { password, "cap-token": token }, cookie }) => {
    if (
      !password ||
      password !== ADMIN_KEY ||
      !token ||
      !(await cap.validateToken(token)).success
    ) {
      return { success: false };
    }

    cookie["cap-admin-key"].value = await Bun.password.hash(password);
    cookie["cap-admin-key"].httpOnly = true;
    cookie["cap-admin-key"].secure = true;

    return { success: true };
  })
  .get("/logout", ({ cookie, redirect }) => {
    cookie["cap-admin-key"].remove();

    return redirect("/");
  });

const internal = new Elysia()
  .use(
    rateLimit({
      scoping: "scoped",
      number: 5,
      duration: 1000,
    })
  )
  .post(
    "/internal/createKey",
    async ({
      body: {
        keyName,
        challengesCount = 18,
        challengeSize = 32,
        challengeDifficulty = 4,
        expiresMs = 600000,
      },
      cookie,
    }) => {
      if (!(await checkAuth(cookie))) return "Unauthorized";

      if (!keyName.trim())
        return { success: false, message: "Key name is required" };

      const publicKey = crypto.randomBytes(6).toString("hex");
      const privateKey = crypto.randomBytes(25).toString("hex");

      keys.push({
        name: keyName,
        publicKey,
        privateKey: (await Bun.password.hash(privateKey)).toString(),
        challengesCount,
        challengeSize,
        challengeDifficulty,
        expiresMs,
      });

      await fs.writeFile(keysStorePath, JSON.stringify(keys));

      capInstances[publicKey] = new Cap({
        tokens_store_path: `.data/tokens-${publicKey}.json`,
      });

      return {
        publicKey,
        privateKey,
      };
    }
  )
  .post(
    "/internal/editKey",
    async ({
      body: {
        publicKey,
        keyName,
        challengesCount = 18,
        challengeSize = 32,
        challengeDifficulty = 4,
        expiresMs = 600000,
      },
      cookie,
    }) => {
      if (!(await checkAuth(cookie))) return "Unauthorized";

      if (!keyName.trim())
        return { success: false, message: "Key name is required" };

      if (
        !keys.find((key) => {
          return key?.publicKey === publicKey;
        })
      ) {
        return { success: false, message: "Key not found" };
      }

      keys = keys.map((key) => {
        if (key.publicKey === publicKey) {
          return {
            ...key,
            name: keyName,
            challengesCount,
            challengeSize,
            challengeDifficulty,
            expiresMs,
          };
        }

        return key;
      });

      await fs.writeFile(keysStorePath, JSON.stringify(keys));

      return {};
    }
  )
  .get("/internal/listKeys", async ({ cookie }) => {
    if (!(await checkAuth(cookie))) return "Unauthorized";

    return {
      keys: keys.map((key) => {
        delete key.privateKey;
        return key;
      }),
    };
  })
  .post("/internal/deleteKey", async ({ body: { publicKey }, cookie }) => {
    if (!(await checkAuth(cookie))) return "Unauthorized";

    keys = keys.filter((key) => {
      return key.publicKey !== publicKey;
    });

    await fs.writeFile(keysStorePath, JSON.stringify(keys));

    try {
      await fs.unlink(`.data/tokens-${publicKey}.json`);
    } catch {}

    delete capInstances[publicKey];

    return {};
  })
  .post("/internal/rotateKey", async ({ body: { publicKey }, cookie }) => {
    if (!(await checkAuth(cookie))) return "Unauthorized";

    const privateKey = crypto.randomBytes(25).toString("hex");
    const privateKeyHash = (await Bun.password.hash(privateKey)).toString();

    keys = keys.map((key) => {
      if (key.publicKey === publicKey) {
        return {
          ...key,
          privateKey: privateKeyHash,
        };
      }
      return key;
    });

    await fs.writeFile(keysStorePath, JSON.stringify(keys));

    return { privateKey };
  });

const api = new Elysia({
  prefix: "/:key",
})
  .use(
    rateLimit({
      scoping: "scoped",
      number: 80,
      duration: 1000,
    })
  )
  .post("/api/challenge", async ({ params, status }) => {
    const { key } = params;

    const foundKey = keys.find((k) => k.publicKey === key);

    if (!foundKey) {
      status = 404;
      return { success: false, message: "Key ID not found" };
    }

    return await capInstances[key].createChallenge({
      challengeSize: parseInt(foundKey.challengeSize),
      challengeDifficulty: parseInt(foundKey.challengeDifficulty),
      challengeCount: parseInt(foundKey.challengesCount),
      expiresMs: parseInt(foundKey.expiresMs),
    });
  })
  .post("/api/redeem", async ({ params, body, status }) => {
    const { key } = params;

    const foundKey = keys.find((k) => k.publicKey === key);

    if (!foundKey) {
      status = 404;
      return { success: false, message: "Key ID not found" };
    }

    const { token, solutions } = body;

    if (!token || !solutions) {
      status = 400;
      return { success: false, message: "Missing solutions and/or token" };
    }

    return await capInstances[key].redeemChallenge({ token, solutions });
  })
  .post("/siteverify", async ({ params, body, status }) => {
    const { key } = params;

    const foundKey = keys.find((k) => k.publicKey === key);

    if (!foundKey) {
      status = 404;
      return { success: false, message: "Key ID not found" };
    }

    const { secret, response } = body;

    if (!secret || !response) {
      status = 400;
      return { success: false, message: "Missing secret or/and response" };
    }

    if (!(await Bun.password.verify(secret, foundKey.privateKey))) {
      status = 400;
      return { success: false, message: "Invalid secret" };
    }

    console.log(capInstances[key]);

    return await capInstances[key].validateToken(response);
  });

const app = new Elysia()
  .use(staticPlugin())
  .use(auth)
  .use(internal)
  .use(api)
  .get("/", async (ctx) => {
    if (!(await checkAuth(ctx.cookie))) {
      return file("./public/lock.html");
    }

    return file("./public/index.html");
  })
  .listen(3000);

fs.mkdir(".data", {
  recursive: true,
});

fs.readFile(keysStorePath, "utf-8")
  .then((data) => {
    keys = JSON.parse(data);
    keys.forEach((key) => {
      capInstances[key.publicKey] = new Cap({
        tokens_store_path: `.data/tokens-${key.publicKey}.json`,
      });
    });
  })
  .catch(() => {
    fs.writeFile(keysStorePath, "[]");
  });

console.log(
  `🧢 Cap is running at http://${app.server?.hostname}:${app.server?.port}`
);
