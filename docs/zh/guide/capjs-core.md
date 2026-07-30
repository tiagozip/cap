---
outline: [2, 3, 4]
description: "capjs-core 是 Cap 的无状态服务端库，用于生成和验证基于 JWT 的工作量证明质询。在 Workers 或边缘环境自托管这个开源 CAPTCHA。"
---

# Core

Cap 包含一个无状态的服务端库，用于生成和验证基于 JWT 的质询，Standalone 内部也使用它。

对大多数用户，我们推荐使用 [Cap Standalone](./standalone/index.md)，它运行在 Docker 中，开箱即用。只有以下情况才建议直接使用核心库：无法运行 Docker、希望把质询生成嵌入到现有服务中，或需要部署到没有持久化存储的环境（Cloudflare Workers、Lambda、边缘函数）。

## 安装

::: code-group

```sh [bun]
bun add capjs-core
```

```sh [npm]
npm i capjs-core
```

```sh [pnpm]
pnpm i capjs-core
```

:::

## 快速上手

```js
import { generateChallenge, validateChallenge } from "capjs-core";

// 长、随机、高熵。在各进程间保持一致。
const SECRET = process.env.CAP_SECRET;

// 1) 服务端路由：创建质询
const ch = await generateChallenge(SECRET, {
  scope: "signup", // 可选
  instrumentation: true, // 可选，见下文
});
// → { challenge: { c, s, d }, token, expires, instrumentation? }

// 2) 服务端路由：验证已兑换的质询
const result = await validateChallenge(
  SECRET,
  {
    token: req.body.token,
    solutions: req.body.solutions,
    instr: req.body.instr,
  },
  {
    scope: "signup",
    consumeNonce: async (sigHex, ttlMs) => myStore.setIfNotExists(`cap:${sigHex}`, 1, ttlMs),
  },
);

if (result.success) {
  // result.token, result.tokenKey, result.expires, result.scope
}
```

验证组件调用 `generateChallenge` 获取 `{ challenge, token, expires, instrumentation }`，在客户端求解工作量证明，然后把 `{ token, solutions, instr }` POST 回来。你再调用 `validateChallenge` 验证。

## 与 `@cap.js/server` 的区别

| 方面         | `@cap.js/server`               | `capjs-core`                        |
| ------------ | ------------------------------ | ----------------------------------- |
| 状态         | 内存 + 文件系统令牌存储        | 无状态。质询令牌是签名的 JWT        |
| 构造函数     | `new Cap({ ... })`             | 无，每次调用传入 `secret`           |
| 重放防护     | 内置令牌列表并定期清理         | 通过 `consumeNonce` 回调按需开启    |
| 清理钩子     | `SIGINT`/`beforeExit` 时落盘   | 无，TTL 编码在 JWT 的 `exp` 中      |
| 文件系统     | 持久化必需                     | 完全不使用                          |
| Worker 兼容  | 否（依赖文件系统）             | 是                                  |

与旧库不同，`capjs-core` 不会替你验证兑换令牌：它返回一个 `tokenKey` 由你自己存储，再返回一个 `token` 交给用户。之后需要验证时，从用户提交的令牌重新推导出 key 并查询：

```js
import { createHash } from "node:crypto";

// 验证路由
const [id, verToken] = req.body.token.split(":");
const tokenKey = `${id}:${createHash("sha256").update(verToken).digest("hex")}`;
const expires = await myStore.get(`cap-token:${tokenKey}`);
if (!expires || Number(expires) < Date.now()) {
  return res.status(401).end();
}
```

## API

### `generateChallenge(secret, opts?)`

返回 `Promise<{ challenge, token, expires, instrumentation? }>`。

- `secret` — 字符串或 Buffer，≥16 字节。HMAC 主密钥，必须在各进程间保持一致。
- `opts.challengeCount` — PoW 谜题数量。默认 `50`。
- `opts.challengeSize` — 盐的长度（十六进制字符数）。默认 `32`。
- `opts.challengeDifficulty` — 目标前缀长度（十六进制字符数）。默认 `4`。
- `opts.expiresMs` — 质询的 TTL。默认 `600_000`（10 分钟）。
- `opts.scope` — 可选字符串，绑定到该质询。验证时必须传入相同的 `scope`。
- `opts.extra` — 可选对象，嵌入 JWT 载荷（持有令牌的任何人都可见）。
- `opts.instrumentation` — 传 `true` 使用默认值，或传对象：`{ blockAutomatedBrowsers, obfuscationLevel }`。
- `opts.instrumentationGenerator` — 逃生舱口，用于把脚本生成卸载到 worker 池。

`token` 是包含质询配置的签名 JWT。`expires` 是 JWT 过期时间（毫秒）。如果请求了 `instrumentation`，则它是经 deflate+base64 处理的客户端脚本，由验证组件运行。

### `validateChallenge(secret, body, opts?)`

返回 `Promise<{ success: true, token, tokenKey, expires, scope, iat } | { success: false, reason, instr_error? }>`。

`body`：

- `token` — 来自 `generateChallenge` 的质询令牌
- `solutions` — 数字数组，长度必须等于 `challenge.c`
- `instr` — instrumentation 结果（如果你启用了它）
- `instr_blocked`、`instr_timeout` — instrumentation 拒绝该页面时验证组件发来的标志

`opts`：

- `scope` — 必须与原始质询的 scope 一致
- `tokenTtlMs` — 兑换令牌的 TTL。默认 `1_200_000`（20 分钟）。
- `consumeNonce(sigHex, ttlMs)` — 借助你的存储实现重放防护。见下文。
- `signToken(data)` — 异步函数，返回自定义格式的兑换令牌。默认返回 `id:secret`。

#### 失败原因

| `reason`            | 含义                                                  |
| ------------------- | ----------------------------------------------------- |
| `invalid_body`      | body 不是对象                                         |
| `missing_token`     | 未提供令牌                                            |
| `missing_solutions` | solutions 缺失或不是数组                              |
| `invalid_token`     | JWT 签名不匹配 / 格式错误 / 参数越界                  |
| `scope_mismatch`    | 令牌的 scope 与 `opts.scope` 不一致                   |
| `expired`           | 质询 JWT 已过期                                       |
| `invalid_solutions` | 长度不匹配或含非数字                                  |
| `nonce_store_error` | `consumeNonce` 回调抛出了异常                         |
| `already_redeemed`  | `consumeNonce` 返回了 `false`                         |
| `invalid_solution`  | 解不满足 PoW 要求                                     |
| `instr_*`           | instrumentation 校验失败（附带 `instr_error: true`）  |

## 重放防护

该库在设计上是无状态的。为防止被截获的提交被二次兑换，请传入 `consumeNonce` 回调。`capjs-core` 会以 JWT 签名的十六进制值和剩余 TTL 调用它；你以 `SET NX EX` 语义把该十六进制值写入 KV，重复出现时返回 `false`。

::: code-group

```js [redis]
import { Redis } from "ioredis";
const redis = new Redis(process.env.REDIS_URL);

const consumeNonce = async (sigHex, ttlMs) => {
  const ttlSec = Math.ceil(ttlMs / 1000);
  const ok = await redis.set(`cap:${sigHex}`, "1", "NX", "EX", ttlSec);
  return ok === "OK";
};
```

```js [cloudflare-kv]
const consumeNonce = async (sigHex, ttlMs) => {
  const key = `cap:${sigHex}`;
  if (await env.NONCES.get(key)) return false;
  await env.NONCES.put(key, "1", {
    expirationTtl: Math.ceil(ttlMs / 1000),
  });
  return true;
};
```

```js [postgres]
const consumeNonce = async (sigHex, ttlMs) => {
  const expiresAt = new Date(Date.now() + ttlMs).toISOString();
  try {
    await db`INSERT INTO cap_nonces (sig, expires_at) VALUES (${sigHex}, ${expiresAt})`;
    return true;
  } catch (e) {
    if (e.code === "23505") return false; // 唯一约束冲突
    throw e;
  }
};
```

:::

该检查在 PoW 和 instrumentation 验证**之后**运行，因此攻击者即使用垃圾解重放截获的提交，也无法消耗掉正常用户的 nonce。

## Instrumentation

向 `generateChallenge` 传入 `instrumentation: true`（或选项对象）即可获得一段经 deflate+base64 处理的客户端脚本。验证组件运行它并回传一份指纹，再由 `validateChallenge` 校验。

```js
const ch = await generateChallenge(SECRET, {
  instrumentation: {
    blockAutomatedBrowsers: true, // 拒绝 playwright/puppeteer/selenium
    obfuscationLevel: 3, // 1-10，默认 3
  },
});
```

开启 `blockAutomatedBrowsers` 后，脚本会运行 realm 逃逸检测与行为检测，识别 headless Chromium、自动化框架标记以及 JS 沙箱伪装。详见 [Instrumentation](./instrumentation.md)。

混淆级别越高，生成速度越慢。级别 4–7 会加入自定义字符串表间接寻址和 esbuild 压缩。级别 8–10 会叠加 `javascript-obfuscator`（字符串数组、控制流扁平化、死代码注入）。这些级别每次生成质询会阻塞事件循环数十毫秒，只建议用于低流量路由，或自行提供一个运行在 worker 池中的 `instrumentationGenerator`。

## 无状态部署模式

**警告：**以下脚本不包含内置的重放防护，请务必自行添加。

### Cloudflare Workers

```js
import { generateChallenge, validateChallenge } from "capjs-core";

const SECRET = (env) => env.CAP_SECRET;

export default {
  async fetch(req, env) {
    const url = new URL(req.url);

    if (url.pathname === "/challenge" && req.method === "POST") {
      const ch = await generateChallenge(SECRET(env), { instrumentation: true });
      return Response.json(ch);
    }

    if (url.pathname === "/redeem" && req.method === "POST") {
      const body = await req.json();
      const result = await validateChallenge(SECRET(env), body, {
        consumeNonce: async (sigHex, ttlMs) => {
          if (await env.NONCES.get(`cap:${sigHex}`)) return false;
          await env.NONCES.put(`cap:${sigHex}`, "1", {
            expirationTtl: Math.ceil(ttlMs / 1000),
          });
          return true;
        },
      });
      return Response.json(result);
    }

    return new Response("not found", { status: 404 });
  },
};
```

### Bun

```js
import { generateChallenge, validateChallenge } from "capjs-core";
const SECRET = process.env.CAP_SECRET;

Bun.serve({
  port: 3000,
  routes: {
    "/challenge": {
      POST: () => Response.json(generateChallenge(SECRET, { instrumentation: true })),
    },
    "/redeem": {
      POST: async (req) => {
        const body = await req.json();
        return Response.json(await validateChallenge(SECRET, body));
      },
    },
  },
});
```

## RSW 质询

自 v0.1.1 和验证组件 v0.1.51 起，两者都支持一种更丰富的传输格式，可在单个响应中承载多种质询协议：SHA-256 PoW（默认）、新的 [RSW 时间锁谜题](./rsw.md)，以及 instrumentation。

### 最小启用方式

```js
import { generateChallenge, generateRswKeypair, validateChallenge } from "capjs-core";

const SECRET = process.env.CAP_SECRET;
const KEYPAIR = generateRswKeypair(2048); // 启动时生成一次，务必持久化！

app.post("/api/challenge", async () => {
  return await generateChallenge(SECRET, {
    format: 2,
    protocols: ["rsw", "instrumentation"],
    keypair: KEYPAIR,
    t: 75_000, // 可选。我们建议保持 75_000
  });
});

app.post("/api/redeem", async (req) => {
  return await validateChallenge(SECRET, req.body, { consumeNonce });
});
```
