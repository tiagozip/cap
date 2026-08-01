---
outline: deep
description: "约五分钟即可搭建好 Cap 这款开源自托管 CAPTCHA。用 Docker 运行服务端，放入验证组件，验证令牌。没有 Google，没有遥测，没有图像谜题。"
---

# 快速开始

Cap 是一款自托管的 CAPTCHA（人机验证），它用不可见的工作量证明取代了图像谜题。用户只需点击一个复选框，计算在浏览器中静默完成，任何数据都不会离开你的服务器。没有 Google，没有遥测，没有按请求计费。

Cap 由两部分组成：负责运行质询并显示复选框的**验证组件**，以及负责签发质询、校验解答的**服务端**。大约五分钟就能把两者都运行起来。

**这就是验证组件，可以试一试：**

<Demo />

::: tip 已经在用 reCAPTCHA？
Cap 的 `/siteverify` 与 reCAPTCHA 的 API 兼容。你只需改一个 URL，就能把现有的验证代码指向 Cap，两者并行运行，随时切换。无需重写代码，也没有孤注一掷的风险。参见[功能对比](./alternatives.md)。
:::

## 你需要准备

- [Docker](https://docs.docker.com/get-docker/)（运行服务端最快的方式）
- 一个用户浏览器可以访问到的托管环境
- 几分钟时间

## 1. 运行服务端

我们推荐使用 [Cap Standalone](./standalone/index.md)：一个单独的容器，提供小巧的 REST API 和用于管理密钥的控制台。它支持多个站点密钥，并兼容 reCAPTCHA 的 siteverify API。

[![Deploy on Railway](https://railway.com/button.svg)](https://railway.com/deploy/cap-1?referralCode=93HYBZ&utm_medium=integration&utm_source=template&utm_campaign=generic)

创建 `docker-compose.yml`：

```yaml
services:
  cap:
    image: tiago2/cap:latest
    container_name: cap
    ports:
      - "3000:3000"
    environment:
      ADMIN_KEY: your_secret_password
      REDIS_URL: redis://valkey:6379
    depends_on:
      valkey:
        condition: service_healthy
    restart: unless-stopped

  valkey:
    image: valkey/valkey:9-alpine
    container_name: cap-valkey
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

启动：

```bash
docker compose up -d
```

打开 `http://localhost:3000`（或你服务器 3000 端口对应的 IP 或域名），用 `ADMIN_KEY` 登录并创建一个站点密钥。你会得到一个**站点密钥（site key）**和一个**秘密密钥（secret key）**。两个都保存好，后面的步骤会用到。

::: tip 提示

- `ADMIN_KEY` 是你的控制台密码，长度至少 32 个字符。
- 如果 3000 端口已被占用，修改 `3000:3000`。
- 如果控制台无法访问，在 `cap` 服务下添加 `network_mode: "host"`。
  :::

## 2. 添加验证组件

验证组件是一个独立的 Web Component。如果你不想固定版本，可以把 `<version>` 替换为 `latest`。

```html
<script src="https://cdn.jsdelivr.net/npm/cap-widget@<version>"></script>
```

::: tip
要固定哪个版本号，可参考[最新版本](https://github.com/tiagozip/cap/releases)。在高安全性场景下，你也可以自托管这个文件，而不是从 CDN 加载。
:::

### 简单方式：直接放进表单

如果验证组件位于 `<form>` 内，Cap 会自动注入一个隐藏的 `cap-token` 字段，并随表单其他数据一起提交。无需任何 JavaScript。

```html
<form action="/submit" method="POST">
  <!-- 你的表单字段 -->
  <cap-widget data-cap-api-endpoint="https://<your-instance>/<site-key>/"></cap-widget>
  <button type="submit">Submit</button>
</form>
```

- `<your-instance>` 是你 Cap 服务端的公开 URL，比如 `cap.example.com`。它必须能被访客访问到，所以不能是 `localhost`。
- `<site-key>` 是控制台中的站点密钥。

提交时，你的服务器会连同其他字段一起收到 `cap-token`。验证方法见[第 3 步](#_3-验证令牌)。

### JavaScript 方式：需要更多控制时

对于 SPA、自定义流程，或任何不是普通表单的场景，监听 `solve` 事件即可：

```js
const widget = document.querySelector("cap-widget");
widget.addEventListener("solve", (e) => {
  const token = e.detail.token;
  // 将令牌发送到你的服务器、启用提交按钮等
});
```

你也可以让组件不可见并以[编程方式](./programmatic.md)求解，或者使用[浮动模式](./floating.md)。各框架（React、Vue、Svelte 等）的代码片段见[验证组件页面](./widget.md#usage)。

## 3. 验证令牌

在信任一次提交之前，你的服务器必须先验证令牌。向你实例的 `/siteverify` 端点发送 `POST` 请求：

::: code-group

```sh [curl]
curl "https://<your-instance>/<site-key>/siteverify" \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{ "secret": "<key_secret>", "response": "<captcha_token>" }'
```

```js [fetch]
const { success } = await (
  await fetch("https://<your-instance>/<site-key>/siteverify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ secret: "<key_secret>", response: "<captcha_token>" }),
  })
).json();

if (!success) throw new Error("invalid cap token");
```

```py [python]
import requests

success = requests.post(
    "https://<your-instance>/<site-key>/siteverify",
    json={"secret": "<key_secret>", "response": "<captcha_token>"},
).json().get("success")
```

```php [php]
<?php
$data = json_decode(file_get_contents("https://<your-instance>/<site-key>/siteverify",
  false, stream_context_create([
    "http" => [
      "method" => "POST",
      "header" => "Content-Type: application/json",
      "content" => json_encode(["secret"=>"<key_secret>","response"=>"<captcha_token>"])
    ]
  ])
), true);
var_dump($data['success'] ?? false);
```

:::

- `<key_secret>` 是控制台中的**秘密密钥**，不是控制台的 `ADMIN_KEY`。混淆这两者是最常见的配置错误。
- `<captcha_token>` 是来自验证组件的令牌（`cap-token` 表单字段或 `e.detail.token`）。

有效令牌会返回：

```json
{ "success": true }
```

令牌是一次性的，因此每个令牌只验证一次，然后再执行你自己的业务逻辑（创建账号、发送消息等）。

## 4. 确认一切正常

一个快速的端到端检查：

1. 加载你的页面。复选框应被勾选，你的 `solve` 处理函数（或表单字段）应产生一个令牌。
2. 将该令牌发送到 `/siteverify`，应返回 `{ "success": true }`。
3. 再次发送同一个令牌，这次应该失败，说明一次性机制在正常工作。

如果验证总是失败，检查你用的是不是秘密密钥（而非管理员密钥），以及 `<your-instance>` 是否与验证组件指向的公开 URL 一致。

整个集成到此完成。用户在浏览器中完成质询，你的服务器验证令牌，所有数据都掌握在你自己手中。

## 为合规而生

由于 Cap 是自托管的，没有 Cookie、没有跟踪、没有第三方调用，用户数据永远不会离开你的基础设施。Cap 的设计满足 GDPR、CCPA、HIPAA、LGPD 等隐私法规，并且工作量证明复选框避免了图像和音频谜题在 WCAG 2.2 下遇到的无障碍问题。完整细节以及 Cap 所遵循的法规，见[合规](./compliance.md)页面。

## 下一步

你的表单已经受到保护。接下来你可以：

- 通过[框架代码片段](./widget.md#usage)把 Cap 集成进你的技术栈
- [自定义验证组件](./widget.md#options)的外观和行为
- 调整 [instrumentation](./instrumentation.md)（浏览器环境检测），并[配置](./standalone/options.md) CORS 和速率限制
- 了解 Cap 与 [reCAPTCHA、Turnstile、hCaptcha 等](./alternatives.md)的对比
- 如果你还在评估选型，可以阅读 [2026 年最佳 CAPTCHA 替代方案](./best-captcha-alternatives.md)指南
