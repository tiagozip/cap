const fs = require("fs");
const Koa = require("koa");
const path = require("path");
const crypto = require("crypto");
const json = require("koa-json");
const send = require("koa-send");
const mount = require("koa-mount");
const Router = require("@koa/router");
const compress = require("koa-compress");
const ratelimit = require("koa-ratelimit");
const bodyParser = require("koa-bodyparser");

const fsp = fs.promises;

const app = new Koa();
const router = new Router();

app.proxy = true;

const serve = require("koa-static");
app.use(mount("/docs", serve(path.join(__dirname, "/docs/.vitepress/dist/"))));

const TOKENS_PATH = path.join(__dirname, ".data", "tokensList.json");
const state = {
  challengesList: {},
  tokensList: {},
  requestCounts: {}
};

app.use(bodyParser());
app.use(json());
app.use(compress());

app.use(async (ctx, next) => {
  const start = Date.now();
  await next();
  const ms = Date.now() - start;
  ctx.set("X-Response-Time", `${ms}ms`);
});

const db = new Map();

const createRateLimit = () =>
  ratelimit({
    driver: "memory",
    db: db,
    duration: 60 * 1000,
    max: 30,
    errorMessage: "Too many requests, please try again later.",
  });

const nid = function (l) {
  return crypto
    .randomBytes(Math.ceil(l / 2))
    .toString("hex")
    .slice(0, l);
};

router.post("/api/challenge", createRateLimit(), async (ctx) => {
  state.requestCounts[ctx.ip] = {
    counts: (state.requestCounts[ctx.ip]?.counts + 1) || 1,
    timestamp: Date.now()
  };
  const config = { challengeCount: 18, challengeSize: 32, challengeDifficulty: 4 };
  const challenges = Array.from({ length: config.challengeCount }, () => [
    nid(config.challengeSize),
    nid(config.challengeDifficulty),
  ]);
  const token = crypto.randomBytes(25).toString("hex");
  const expires = Date.now() + 600000;

  state.challengesList[token] = {
    challenge: challenges,
    expires,
    ip: ctx.ip,
  };

  ctx.body = { challenge: challenges, token, expires };
});

router.post("/api/redeem", createRateLimit(), async (ctx) => {
  const { token, solutions } = ctx.request.body;
  const challengeData = state.challengesList[token];
  delete state.challengesList[token];

  if (
    !challengeData ||
    challengeData.expires < Date.now() ||
    !(challengeData.ip === ctx.ip)
  ) {
    ctx.body = { success: false };
    return;
  }

  const isValid = challengeData.challenge.every(([salt, target]) => {
    const solution = solutions.find(([s, t]) => s === salt && t === target);
    return (
      solution &&
      crypto
        .createHash("sha256")
        .update(salt + solution[2])
        .digest("hex")
        .startsWith(target)
    );
  });

  if (!isValid) {
    ctx.body = { success: false };
    return;
  }

  const encodeBigInt = (num, base = 62) => {
    const chars = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
    let res = "", n = BigInt(num);
    while (n > 0) (res = chars[Number(n % BigInt(base))] + res), (n /= BigInt(base));
    return res || "0";
  };

  const vertoken = crypto.randomBytes(15).toString("hex");
  const expires = Date.now() + 20 * 60 * 1000;
  const hash = encodeBigInt(Bun.hash(vertoken));
  const id = crypto.randomBytes(8).toString("hex");

  state.tokensList[`${id}:${hash}`] = expires;

  await fsp.writeFile(TOKENS_PATH, JSON.stringify(state.tokensList), "utf8");

  ctx.body = { success: true, token: `${id}:${vertoken}`, expires };
});

router.post("/api/validate", createRateLimit(), async (ctx) => {
  const encodeBigInt = (num, base = 62) => {
    const chars = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
    let res = "", n = BigInt(num);
    while (n > 0) (res = chars[Number(n % BigInt(base))] + res), (n /= BigInt(base));
    return res || "0";
  };

  const { token } = ctx.request.body;
  const [id, vertoken] = token.split(":");
  const hash = encodeBigInt(Bun.hash(vertoken));

  if (state.tokensList[`${id}:${hash}`]) {
    delete state.tokensList[`${id}:${hash}`];
    ctx.body = { success: true };
  } else {
    ctx.body = { success: false };
  }
})

router.get("/", async (ctx) => {
  ctx.redirect("/docs");
});
router.get("/demo", async (ctx) => {
  await send(ctx, "src/index.html", { root: __dirname });
});

router.get("/wasm-hashes.min.js", async (ctx) => {
  ctx.type = "application/javascript";
  await send(ctx, "src/js/min/wasm-hashes.min.js", { root: __dirname });
});

setInterval(async () => {
  const now = Date.now();
  let tokensChanged = false;

  for (const k in state.challengesList) {
    if (state.challengesList[k].expires < now) delete state.challengesList[k];
  }

  for (const k in state.tokensList) {
    if (state.tokensList[k] < now) {
      delete state.tokensList[k];
      tokensChanged = true;
    }
  }

  if (tokensChanged) {
    await fsp.writeFile(TOKENS_PATH, JSON.stringify(state.tokensList), "utf8");
  }
}, 1000);

setInterval(function () {
  const now = Date.now();

  Object.entries(state.requestCounts).forEach(([ip, { counts, timestamp }]) => {
    if (now - timestamp > 30 * 60 * 1000) {
      delete state.requestCounts[ip];
    }
  });
}, 1000);

state.tokensList = JSON.parse(fs.readFileSync(TOKENS_PATH, "utf-8").toString()) || {};

app.use(router.routes()).use(router.allowedMethods());

app.listen(process.env.PORT || 3000, () => {
  console.log("Server running on http://localhost:3000");
  require("./build.js");
});
