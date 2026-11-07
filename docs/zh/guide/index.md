---
outline: [2, 3]
description: "约五分钟即可搭建好 Cap 这款开源自托管 CAPTCHA。用 Docker 或在你自己的后端中运行服务端，放入验证组件，验证令牌。没有 Google，没有遥测，没有图像谜题。"
---

# 快速开始

Cap 由两部分组成：验证组件在访客的浏览器中运行并完成质询，然后交给你一个令牌；服务端负责签发质询并验证这些令牌。

## 选择服务端 {#pick-a-server}

- **[Standalone](./standalone/index.md)** 是一个 Docker 容器，自带控制台、数据分析和速率限制。如果你能运行容器，就选它。如果你正在从 reCAPTCHA 迁移，Standalone 的 `/siteverify` 支持相同的请求格式，你的验证代码只需改用你服务器的主机名即可。

- **[核心库](./capjs-core.md)** 是一个精简的 npm 包，负责 Cap 的基础功能。你的代码能在哪里运行，它就能在哪里运行，包括 Workers 这类无服务器平台。令牌存放在你自己的数据库中，但它不提供内置的数据分析。

## 1. 运行服务端 {#_1-run-the-server}

### Standalone {#standalone}

把下面的内容保存为 `docker-compose.yml`，或者[用 Railway 部署](https://railway.com/deploy/cap-1?referralCode=93HYBZ&utm_medium=integration&utm_source=template&utm_campaign=generic)：

```yaml
services:
  cap:
    image: tiago2/cap:latest
    ports:
      - "3000:3000"
    environment:
      ADMIN_KEY: change_me_to_something_long
      REDIS_URL: redis://valkey:6379
    depends_on:
      valkey:
        condition: service_healthy
    restart: unless-stopped

  valkey:
    image: valkey/valkey:9-alpine
    volumes:
      - valkey-data:/data
    command: valkey-server --save 60 1 --loglevel warning --maxmemory-policy noeviction
    healthcheck:
      test: ["CMD", "valkey-cli", "ping"]
      interval: 5s
      timeout: 3s
      retries: 5
    restart: unless-stopped

volumes:
  valkey-data:
```

记得修改管理员密钥，然后启动：

```bash
docker compose up -d
```

打开 `http://localhost:3000`，用 `ADMIN_KEY` 登录，它就是控制台密码。创建一个站点密钥（site key），然后把站点密钥和对应的秘密密钥都复制下来。

验证组件会从访客的浏览器直接访问这个服务端，所以在生产环境中它需要一个公开的 URL。我们推荐使用 [Cloudflare Tunnels](https://developers.cloudflare.com/tunnel/) 这类方案，[Standalone 文档](./standalone/index.md)也介绍了其他大多数情况，包括反向代理。

### 核心库 {#core-library}

安装：

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

在同一个前缀下添加两个路由。这个例子用的是 Hono 和 Redis，不过任何框架都可以，存储只要支持原子性的"不存在时才写入"操作就行：

```js
import { Hono } from "hono";
import { Redis } from "ioredis";
import { generateChallenge, validateChallenge } from "capjs-core";

const SECRET = process.env.CAP_SECRET;
const redis = new Redis(process.env.REDIS_URL);
const app = new Hono();

app.post("/cap/challenge", async (c) =>
  c.json(await generateChallenge(SECRET, { format: 2, protocols: ["hashwx", "instrumentation"] })),
);

app.post("/cap/redeem", async (c) => {
  const result = await validateChallenge(SECRET, await c.req.json(), {
    consumeNonce: async (sig, ttlMs) =>
      (await redis.set(`cap:nonce:${sig}`, "1", "NX", "PX", ttlMs)) === "OK",
  });
  if (result.success) {
    await redis.set(`cap:token:${result.tokenKey}`, "1", "PX", result.expires - Date.now());
  }
  return c.json(result);
});
```

`CAP_SECRET` 用于给每个质询签名。它应该足够长且随机，并且所有进程都要使用同一个值。

## 2. 添加验证组件 {#_2-add-the-widget}

加载脚本，并从[发布页面](https://github.com/tiagozip/cap/releases)选一个版本号固定下来：

```html
<script src="https://cdn.jsdelivr.net/npm/cap-widget@<version>"></script>
```

把验证组件放进你的表单：

```html
<form action="/submit" method="POST">
  <cap-widget data-cap-api-endpoint="https://cap.example.com/<site-key>/"></cap-widget>
  <button type="submit">Submit</button>
</form>
```

使用 Standalone 时，端点是 `https://<your-instance>/<site-key>/`。使用核心库时，端点就是你的路由前缀，比如 `/cap/`。

访客完成验证后，验证组件会往表单里加一个隐藏的 `cap-token` 字段。如果不在表单里，就改为监听 `solve` 事件：

```js
document.querySelector("cap-widget").addEventListener("solve", (e) => {
  const token = e.detail.token;
});
```

[验证组件页面](./widget.md)提供了 React、Vue、Svelte 等框架的代码片段。

## 3. 验证令牌 {#_3-verify-the-token}

在信任一次提交之前，先在你的服务端检查它的令牌。

### Standalone {#standalone-1}

把令牌发送到 `/siteverify`：

::: code-group

```js [fetch]
const res = await fetch("https://cap.example.com/<site-key>/siteverify", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ secret: "<secret>", response: token }),
});
const { success } = await res.json();
```

```py [python]
import requests

success = requests.post(
    "https://cap.example.com/<site-key>/siteverify",
    json={"secret": "<secret>", "response": token},
).json()["success"]
```

```php [php]
$res = file_get_contents("https://cap.example.com/<site-key>/siteverify", false, stream_context_create([
  "http" => [
    "method" => "POST",
    "header" => "Content-Type: application/json",
    "content" => json_encode(["secret" => "<secret>", "response" => $token]),
  ],
]));
$success = json_decode($res, true)["success"] ?? false;
```

```sh [curl]
curl -X POST "https://cap.example.com/<site-key>/siteverify" \
  -H "Content-Type: application/json" \
  -d '{"secret": "<secret>", "response": "<token>"}'
```

:::

`<secret>` 是站点密钥对应的秘密密钥，不是你的 `ADMIN_KEY`。把这两者搞混是最常见的配置错误。

有效的令牌会返回 `{ "success": true }`。每个令牌只能使用一次，所以对同一个令牌进行第二次验证会失败。把同一个令牌发送两次，就能快速地端到端检查整个配置。

### 核心库 {#core-library-1}

在兑换路由写入的存储中查找这个令牌，然后删除它，这样它就不能被重复使用：

```js
import { createHash } from "node:crypto";

app.post("/submit", async (c) => {
  const [id, secret] = String((await c.req.parseBody())["cap-token"] ?? "").split(":");
  const key = `cap:token:${id}:${createHash("sha256")
    .update(secret ?? "")
    .digest("hex")}`;

  if ((await redis.del(key)) !== 1) {
    return c.text("invalid captcha", 403);
  }
});
```

## 下一步 {#next-steps}

- [自定义验证组件](./widget.md#attributes)的文字、语言和样式
- [配置 Standalone](./standalone/options.md) 的 CORS、速率限制和资源服务器
- 阅读[核心库参考](./capjs-core.md)
- 了解 [Cap 的工作原理](./workings.md)
