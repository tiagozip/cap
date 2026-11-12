---
outline: [2, 3]
description: "capjs-core 是 Cap 的无状态服务端库，用于通过签名 JWT 生成和验证工作量证明质询。在 Workers、Lambda 或你自己的后端运行这个开源 CAPTCHA。"
---

# 核心库

`capjs-core` 在你自己的服务器中生成和验证质询。它是无状态的，质询是签名的 JWT，因此不需要数据库、文件系统或内存状态，可以运行在 Cloudflare Workers、Lambda 和其他边缘运行时上。capd 基于它构建。

大多数用户应改为运行 Cap 的服务端 [capd](./capd/index.md)，它还提供控制面板、统计、速率限制和令牌存储。无法运行容器，或想把质询放进现有服务时，再使用这个库。

::: code-group

```sh [npm]
npm i capjs-core
```

```sh [pnpm]
pnpm add capjs-core
```

```sh [bun]
bun add capjs-core
```

:::

## 快速上手

你需要两个路由，一个创建质询，另一个检查解。将验证组件的 `data-cap-api-endpoint` 指向它们的公共前缀，验证组件就会调用 `<prefix>challenge` 和 `<prefix>redeem`。

```js
import { generateChallenge, validateChallenge } from "capjs-core";

const SECRET = process.env.CAP_SECRET;

app.post("/cap/challenge", async () => {
  return await generateChallenge(SECRET, { instrumentation: true });
});

app.post("/cap/redeem", async (req) => {
  return await validateChallenge(SECRET, req.body, { consumeNonce });
});
```

`SECRET` 用于签署每个质询。请使用至少 16 字节的长随机值，并在各进程间保持一致。

`consumeNonce` 防止已求解的质询被二次兑换，需要你通过自己的存储来实现。见[重放防护](#重放防护)。

## 验证令牌

`validateChallenge` 成功时返回交给访问者的 `token` 和交给你的 `tokenKey`。该库不会存储它们，因此需要将 `tokenKey` 与它的 `expires` 一起保存：

```js
const result = await validateChallenge(SECRET, req.body, { consumeNonce });
if (result.success) {
  await store.set(`cap-token:${result.tokenKey}`, result.expires);
}
return result;
```

验证组件把 `token` 交给表单。收到表单时，从提交的令牌推导出 key 并查询：

```js
import { createHash } from "node:crypto";

const [id, secret] = req.body["cap-token"].split(":");
const tokenKey = `${id}:${createHash("sha256").update(secret).digest("hex")}`;
const expires = await store.get(`cap-token:${tokenKey}`);

if (!expires || Number(expires) < Date.now()) {
  return new Response("invalid captcha", { status: 403 });
}
await store.delete(`cap-token:${tokenKey}`);
```

删除 key 后，每个令牌就只能使用一次。

## HashWX {#format-2-hashwx}

`generateChallenge` 默认签发 [HashWX](./hashwx.md) 工作量证明，与 capd 新密钥使用的格式相同。它抵抗 GPU 的能力比 SHA-256 强得多。`instrumentation: true` 和 `behavior` 会额外添加一个检测质询。

如需自行指定协议，请配合 `format: 2` 传入：

```js
return await generateChallenge(SECRET, {
  format: 2,
  protocols: ["hashwx", "instrumentation"],
});
```

`format: 1` 会切回 SHA-256 工作量证明，不传 `format` 却传入 `challengeCount`、`challengeSize` 或 `challengeDifficulty` 时也一样。验证组件会自行检测格式，`validateChallenge` 支持两种格式。HashWX 需要 0.1.58 或更高版本的验证组件，因此请先更新固定版本的验证组件，再更新本库。

| 选项 | 默认值 | 作用 |
| --- | --- | --- |
| `hashwxDifficulty` | `1_000_000` | 每次求解预期计算的哈希总数，涵盖所有子质询。 |
| `hashwxChallengeCount` | `4` | 将难度拆分成的子质询数量。数量越多，求解时间的随机性越小。见[客户端开销](./hashwx.md#成本)。 |
| `hashwxNoncesPerHash` | `65_536` | 每个生成的哈希函数覆盖的 nonce 数量。 |

HashWX 不需要密钥或配置。第一次验证会编译一个小型 WebAssembly 模块，你可以在启动时调用 `await hashwxReady()` 提前完成编译。

某些运行时不允许在运行时编译 WebAssembly。Cloudflare Workers 会自动使用预编译模块。在其他环境中，按平台支持的方式导入，并在第一次验证前传入：

```js
import { setHashwxModule } from "capjs-core";
import hashwxModule from "capjs-core/hashwx.wasm";

setHashwxModule(hashwxModule);
```

## 重放防护

`validateChallenge` 在工作量证明检查通过后、检查 instrumentation 之前调用 `consumeNonce(signature, ttlMs)`。如果签名尚未使用，存储它并返回 `true`。如果已经使用过，返回 `false`。工作量证明错误的请求不会触发这个调用，因此无法消耗正常访问者的质询。工作量证明有效但 instrumentation 结果不通过的请求会消耗质询，因此机器人无法用同一份工作量证明重试 instrumentation 检查。

::: code-group

```js [Redis]
const consumeNonce = async (sig, ttlMs) =>
  (await redis.set(`cap:${sig}`, "1", "NX", "PX", ttlMs)) === "OK";
```

```js [Workers KV]
const consumeNonce = async (sig, ttlMs) => {
  if (await env.NONCES.get(`cap:${sig}`)) return false;
  await env.NONCES.put(`cap:${sig}`, "1", { expirationTtl: Math.max(60, Math.ceil(ttlMs / 1000)) });
  return true;
};
```

```js [Postgres]
const consumeNonce = async (sig, ttlMs) => {
  try {
    await sql`INSERT INTO cap_nonces (sig, expires_at) VALUES (${sig}, ${new Date(Date.now() + ttlMs)})`;
    return true;
  } catch (e) {
    if (e.code === "23505") return false;
    throw e;
  }
};
```

:::

Workers KV 不支持原子操作，因此同时到达的两个请求可能都通过。如果这会影响你，请使用 Durable Object。

## Instrumentation

`instrumentation: true` 为格式 1 的质询添加一个 [instrumentation 质询](./instrumentation.md)。使用格式 2 时，将 `"instrumentation"` 加入 `protocols`。两种情况下都可以用对象代替 `true`：

```js
instrumentation: {
  blockAutomatedBrowsers: true,
  obfuscationLevel: 3,
}
```

| 选项 | 默认值 | 作用 |
| --- | --- | --- |
| `blockAutomatedBrowsers` | `false` | 以 `instr_automated_browser` 拒绝来自[自动化浏览器](./instrumentation.md#自动化浏览器检测)的求解。 |
| `detectAutomatedInteractions` | `false` | 将 `interaction_synthetic_clicks` 和 `interaction_synthetic_keydowns` 加入 `riskFlags`。见[交互检测](./instrumentation.md#交互检测)。 |
| `blockAutomatedInteractions` | `false` | 以 `instr_automated_interaction` 拒绝这些求解，同时开启检测。 |
| `noWasm` | `false` | 当客户端声称无法运行 WebAssembly、你因此下发 SHA-256 时设置它。如果 WebAssembly 能在检查框架里编译，求解以 `instr_wasm_available` 失败，否则带上 `wasm_fallback` 风险标记。 |
| `obfuscationLevel` | `5` | 取值为 1 到 10。级别 1 到 3 移除空白，4 到 7 还会编码字符串并压缩脚本，8 到 10 在安装了 `javascript-obfuscator` 时使用它处理脚本。级别越高，生成越慢。 |

级别 8 到 10 需要可选的 `javascript-obfuscator` 包，每个质询会阻塞事件循环数十毫秒，因此仅用于低流量路由，或通过 `instrumentationGenerator` 在 worker 池中生成脚本。它接收 instrumentation 选项，并且必须解析为 `generateInstrumentation` 返回的内容。

## 行为与智能体

`behavior` 开启[行为评分](./instrumentation.md#行为评分)和[智能体拦截](./instrumentation.md#ai-智能体检测)。如果质询还没有 instrumentation 质询，它会添加一个。策略会签入质询令牌，因此客户端无法关闭它。

```js
await generateChallenge(SECRET, {
  format: 2,
  protocols: ["hashwx", "instrumentation"],
  behavior: { block: true, blockAgents: "identified" },
});
```

`behavior: true` 只评分，不拦截。对象接受以下选项：

| 选项 | 默认值 | 作用 |
| --- | --- | --- |
| `block` | `false` | 以 `behavior_automated` 拒绝 `automated` 判定，以 `behavior_no_interaction` 拒绝 `no_interaction` 判定。 |
| `threshold` | `0.75` | 判定变为 `automated` 的分数阈值，取值为 0.1 到 1。 |
| `strict` | `false` | 取消仅由弱标志构成的分数的 0.6 上限。 |
| `requireInteraction` | `true` | 设为 `false` 后，即使开启 `block`，也允许 `no_interaction` 通过，适用于隐形模式和浮动模式。 |
| `blockAgents` | `false` | `"identified"` 拒绝高置信度检测到的智能体，`"all"` 拒绝所有检测到的智能体，错误码均为 `behavior_agent`。 |
| `allowVerifiedAgents` | `false` | 允许 Web Bot Auth 签名已验证的智能体通过 `blockAgents`。 |

不论策略如何，没有行为轨迹的求解始终以 `behavior_missing` 失败。

要将请求头用作智能体证据，请把 `/redeem` 请求传给 `validateChallenge`：

```js
const result = await validateChallenge(SECRET, body, {
  consumeNonce,
  request: { method: req.method, url: fullUrl, headers: req.headers },
  verifyWebBotAuth: true,
});
```

`url` 必须是完整 URL，因为 Web Bot Auth 会对它签名。设置 `verifyWebBotAuth: true` 后，携带 `Signature-Agent` 请求头的请求会根据智能体的密钥目录进行验证，`validateChallenge` 通过 HTTPS 获取该目录并缓存一小时。它只信任 Cap 已知的签名者和 `trustedSignatureAgents` 中的来源。传入 `webBotAuthNonceCheck(nonce, ttlMs)` 可拒绝重放的签名，它的工作方式与 `consumeNonce` 相同。

`behaviorReplayCheck(digest, ttlMs)` 以相同方式处理行为轨迹。如果摘要曾经出现过，返回 `true`，轨迹就会带上 `bh_replayed`。只有包含至少 8 次指针移动和按键的轨迹才有摘要。

开启行为检测时，成功结果带有 `behavior: { score, verdict, flags, signals, agent }`。关闭时，只要存在证据，就会在顶层返回 `agent`，它仅由页面标记和请求头构成，且不会触发拦截。无论哪种情况，检测到的智能体都会将 `agent:<name>` 加入 `riskFlags`。`agent` 的结构如下：

```js
{
  detected: true,
  name: "claude-in-chrome",
  confidence: "high",
  verified: false,
  evidence: ["artifact:cic_active"],
}
```

## API

### `generateChallenge(secret, options?)`

| 选项 | 默认值 | 作用 |
| --- | --- | --- |
| `challengeCount` | `50` | 每个质询的 SHA-256 谜题数量。 |
| `challengeSize` | `32` | 盐的长度，以十六进制字符数计。 |
| `challengeDifficulty` | `4` | 所需哈希前缀的长度，以十六进制字符数计。 |
| `expiresMs` | `600_000` | 访问者可以用来求解的时间。 |
| `scope` | 无 | 与质询绑定的字符串。验证时必须传入相同值。 |
| `extra` | 无 | 嵌入 JWT 的数据。持有令牌的任何人都能读取。 |
| `instrumentation` | `false` | 见 [instrumentation](#instrumentation)。 |
| `instrumentationGenerator` | `generateInstrumentation` | 生成 instrumentation 脚本的异步函数。 |
| `behavior` | `false` | 见[行为与智能体](#行为与智能体)。 |
| `format`, `protocols` | 格式 2，使用 HashWX | 见 [HashWX](#format-2-hashwx)。传入 `keypair` 或 `rsw` 但不传 `protocols` 时会使用已弃用的 RSW 协议。 |
| `hashwxDifficulty`, `hashwxChallengeCount`, `hashwxNoncesPerHash` | 见 [HashWX](#format-2-hashwx) | 格式 2 的 HashWX 设置。 |
| `keypair`, `t`, `rsw` | 无 | 已弃用的 RSW 协议设置。 |

格式 1 返回 `{ challenge, token, expires, instrumentation? }`，格式 2 返回 `{ token, format: 2, challenges, expires }`。开启行为评分时，两者都会添加 `behavior: true`。请将整个对象发送给验证组件。

### `validateChallenge(secret, body, options?)`

`body` 是验证组件 POST 到 `/redeem` 的内容。选项如下：

| 选项 | 默认值 | 作用 |
| --- | --- | --- |
| `consumeNonce` | 无 | 见[重放防护](#重放防护)。 |
| `scope` | 无 | 必须与质询的 scope 一致。 |
| `tokenTtlMs` | `1_200_000` | 访问者令牌的有效时长。 |
| `signToken` | `id:secret` | 接收 `{ scope, expires, iat }` 并返回你自己的令牌的函数。不再返回 `tokenKey`。 |
| `request` | 无 | 以 `{ method, url, headers }` 形式传入的 `/redeem` 请求。见[行为与智能体](#行为与智能体)。 |
| `verifyWebBotAuth` | `false` | 验证 `request` 上的 Web Bot Auth 签名。 |
| `fetch` | 全局 `fetch` | 用于下载 Web Bot Auth 密钥目录。 |
| `trustedSignatureAgents` | 无 | 额外信任的签名者来源，例如 `"https://agent.example.com"`。 |
| `webBotAuthNonceCheck` | 无 | 拒绝重放的 Web Bot Auth 签名。 |
| `behaviorReplayCheck` | 无 | 标记重放的行为轨迹。 |

成功时返回 `{ success: true, token, tokenKey, expires, scope, iat, riskFlags }`，以及[行为与智能体](#行为与智能体)中描述的 `behavior` 或 `agent`。`riskFlags` 列出不会单独触发拦截的信号，例如 `native_tamper` 或 `legacy_widget`，你可以据此提高该访问者的难度。instrumentation 页面列出了[浏览器检查标志](./instrumentation.md#自动化浏览器检测)和[行为标志](./instrumentation.md#行为评分)。

失败时返回 `{ success: false, reason }`。Instrumentation 失败还带有 `instr_error: true`，`instr_automated_browser` 和 `instr_automated_interaction` 带有 `blockedBy` 列表，行为检测失败带有 `behavior`。[错误码表](./error-codes.md)列出了所有 `reason`。

### 底层导出

capd 和测试使用这些导出。只有在构建自己的处理流程时才需要它们。

| 导出 | 作用 |
| --- | --- |
| `generateInstrumentation(opts?)` | 生成 instrumentation 脚本及验证它所需的元数据。 |
| `verifyInstrumentationResult(meta, payload, now?)` | 根据元数据检查结果。返回 `{ valid, reason?, riskFlags?, blockedBy?, checks?, agent?, trace? }`。 |
| `serializeBound(data)`, `canonicalize(value)` | 按照脚本的方式序列化收集的数据。 |
| `boundValues(binding, serialized)` | 针对这些数据，结果必须包含的数值。 |
| `MAX_BOUND_DATA` | 接受的序列化数据最大长度，为 65,536 个字符。 |
| `detectAutomation(vector)` | 对你自行收集的浏览器信息运行自动化浏览器检查。返回 `{ pass, checks, blockedBy, riskFlags }`。 |
| `analyzeBehavior(trace, ctx?)` | 对行为轨迹评分。`ctx` 接受 `{ replayed, strict, threshold }`。返回 `{ score, verdict, flags, signals, digest }`。 |
| `BEHAVIOR_WEIGHTS`, `DEFAULT_BEHAVIOR_THRESHOLD`, `WEAK_CAP` | 标志权重、`0.75` 和 `0.6`。 |
| `agentFromHeaders(headers)` | 从 `User-Agent`、`Signature-Agent` 和 `Sec-CH-UA-Platform` 获取智能体证据。 |
| `agentFromTrace(trace)` | 从行为轨迹的点击和输入时序获取智能体证据。仅传入未被 `analyzeBehavior` 标记为 `bh_malformed` 的轨迹。 |
| `summarizeAgent(evidence, verification?)` | 将证据与可选的 `verifyWebBotAuth` 结果合并为 `agent` 对象，没有证据时返回 `null`。 |
| `verifyWebBotAuth(req, opts?)` | 验证 Web Bot Auth 签名。解析为 `{ verified, agent?, origin?, keyid?, reason? }`。 |
| `parseSignatureAgent(value)` | 将 `Signature-Agent` 请求头解析为 `{ label, url }` 条目。 |
| `hashwxReady()`, `setHashwxModule(module)` | 提前编译 HashWX 模块，或提供一个模块。见 [HashWX](#format-2-hashwx)。 |
| `hashwxTarget(difficulty)`, `hashwxSeed(challenge, block)`, `hashwxHash(state, seed, nonce)` | HashWX 基础函数。`state` 来自 `hashwxReady()`。 |
| `DEFAULT_HASHWX_DIFFICULTY`, `DEFAULT_HASHWX_CHALLENGE_COUNT`, `DEFAULT_HASHWX_NONCES_PER_HASH` | `1_000_000`、`4` 和 `65_536`。 |
| `generateRswKeypair(bits?)`, `serializeRswKeypair(kp)`, `deserializeRswKeypair(s)`, `buildRswMinter(args, opts?)` | 已弃用的 RSW 协议的密钥和 minter。 |

## 从 `@cap.js/server` 迁移 {#how-it-differs-from-cap-js-server}

`@cap.js/server` 是已被本库取代的旧库。它将质询和令牌保存在你配置的存储中。`capjs-core` 不保存任何状态。质询是签名的 JWT，重放防护通过 `consumeNonce` 实现，你需要按照[验证令牌](#验证令牌)所示自行存储 `tokenKey`。它完全不使用文件系统，因此可以运行在 Workers 和 Lambda 上。
