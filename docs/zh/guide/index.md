---
outline: [2, 3]
description: "约五分钟即可搭建好 Cap 这款开源自托管 CAPTCHA。用 Docker 或在你自己的后端中运行服务端，放入验证组件，验证令牌。没有 Google，没有遥测，没有图像谜题。"
---

# 快速开始

Cap 由两部分组成：验证组件在访客的浏览器中运行并完成质询，然后交给你一个令牌；服务端（capd）负责签发质询并验证这些令牌。

## 1. 搭建 capd {#_1-set-up-capd}

首先需要搭建 capd。它是一个自托管的服务端，自带控制台、数据分析、规则和 API。密钥和设置保存在 Valkey 中。开始之前，你需要做两个选择：

**1. 在哪里运行 capd：** 你可以用 Docker 在自己的服务器上运行，也可以使用 [Railway](https://railway.com/deploy/cap-1?referralCode=93HYBZ&utm_medium=integration&utm_source=template&utm_campaign=generic)，或者使用 [Workers](./capd/workers.md) 这样的无服务器平台。本指南以 Docker 为例。

**2. 把数据分析存在哪里：** 你可以使用 DuckDB（轻量，适合小型网站）或 ClickHouse（扩展性更好）。两者都已内置，配置起来也都很简单。

::: code-group

```bash [DuckDB]
curl -fsSLo docker-compose.yml https://raw.githubusercontent.com/tiagozip/cap/main/capd/docker-compose.duckdb.yml
echo "ADMIN_KEY=$(openssl rand -hex 24)" > .env
docker compose up -d
```

```bash [ClickHouse]
curl -fsSLo docker-compose.yml https://raw.githubusercontent.com/tiagozip/cap/main/capd/docker-compose.yml
echo "ADMIN_KEY=$(openssl rand -hex 24)" > .env
docker compose up -d
```

:::

打开 `http://localhost:3000`，用 `.env` 中的 `ADMIN_KEY` 登录，它就是控制台密码。创建一个站点密钥，然后把站点密钥和对应的秘密密钥都复制下来。

验证组件会从访客的浏览器直接访问这个服务端，所以在生产环境中它需要一个公开的 URL。我们推荐使用 [Tunnels](https://developers.cloudflare.com/tunnel/) 这类方案，[capd 文档](./capd/index.md)也介绍了其他大多数情况，包括反向代理。

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

端点是 `https://<your-instance>/<site-key>/`。

访客完成验证后，验证组件会往表单里加一个隐藏的 `cap-token` 字段。如果不在表单里，就改为监听 `solve` 事件：

```js
document.querySelector("cap-widget").addEventListener("solve", (e) => {
  const token = e.detail.token;
});
```

[验证组件页面](./widget.md)提供了 React、Vue、Svelte 等框架的代码片段。

## 3. 验证令牌 {#_3-verify-the-token}

在信任一次提交之前，先从你的服务端把它的令牌发送到 `/siteverify`：

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

如果你正在从 reCAPTCHA 迁移，`/siteverify` 接受相同的请求格式，你的验证代码只需改用你服务器的主机名即可。

有效的令牌会返回 `{ "success": true }`。每个令牌只能使用一次，所以对同一个令牌进行第二次验证会失败。把同一个令牌发送两次，就能快速地端到端检查整个配置。

## 改用核心库 {#using-the-core-library-instead}

如果你更想在自己的后端里签发和检查质询，[核心库](./capjs-core.md)是一个只做这件事的精简 npm 包。令牌存放在你自己的数据库中，也没有控制台、数据分析和速率限制。

## 下一步 {#next-steps}

- [自定义验证组件](./widget.md#属性)：文字、语言和样式
- [配置 capd](./capd/options.md)：代理、验证组件文件和 API
- 阅读[核心库参考](./capjs-core.md)
- 了解 [Cap 的工作原理](./workings.md)
