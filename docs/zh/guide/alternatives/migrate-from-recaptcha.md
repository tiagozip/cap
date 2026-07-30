---
title: 从 reCAPTCHA 迁移到 Cap
description: "Google 正在把 reCAPTCHA 迁入 Google Cloud，并自动迁移 Classic 密钥。不如迁移到 Cap：更快、私密、自托管、开源的 CAPTCHA，提供兼容 reCAPTCHA 的 siteverify API 和 Turnstile 级别的机器人检测。"
---

# 从 reCAPTCHA 迁移到 Cap

Google 正在把 reCAPTCHA 迁入 Google Cloud，并把 Classic 密钥自动迁移到带账单的项目上。也就是说，无论如何你都得调整现有的集成。好消息是：正好借这个机会告别 Google 那套基于追踪的 CAPTCHA（人机验证），换成更快、更私密还免费的方案。

真正关键的那部分，Cap 可以直接替换；其余几乎每一处，都是升级。

## 为什么团队纷纷换用 Cap

- **Turnstile 级别的检测，却不依赖第三方。** Cap 将工作量证明与 instrumentation 质询（浏览器环境检测）结合，后者正是 YouTube 和 Twitter/X 在超大规模下使用的浏览器验证技术。它与 Cloudflare Turnstile 处于同一检测梯队，同时保持完全自托管。
- **经过大规模验证。** 仅 **2026 年第一季度就解决了约 10 亿次质询**（据 JSDelivr 统计），并被 **AdGuard**、**Bunny.net** 等团队用于生产环境。这不是一个实验品。
- **体积不到十分之一，而且是隐形的。** Cap 的验证组件 gzip 后约 21 KB，而 reCAPTCHA 的客户端有 200 到 600 KB，通常能缩小 10 倍以上。默认质询在后台 2 到 3 秒内解完，没有红绿灯谜题，用户不需要点任何东西。
- **真正免费，不计量。** 不需要 Google Cloud 项目，不需要绑定账单账户，没有按评估收费。一个 Docker 容器加一个 Valkey 实例，一台 5 美元的 VPS 就能承载大多数负载。
- **默认私密。** reCAPTCHA 会从 `google.com` 加载脚本并把用户信号发送给 Google。Cap 不向任何地方发送数据，没有任何第三方内容触碰你的页面。
- **控制权在你手里。** reCAPTCHA v3 会悄悄惩罚使用 VPN、Tor 和隐私浏览器的用户，且投诉无门。用 Cap，难度由你设定，每个真实用户永远有一条走得通的路。
- **永远开源。** Apache 2.0。可审计、可分叉、可部署。没有哪家供应商能单方面更改条款。

完整分析见 [Cap vs reCAPTCHA](./recaptcha.md)。

## reCAPTCHA 正在发生什么变化

想知道迁移邮件为什么现在纷纷到来，背景如下：

- 旧版 reCAPTCHA 管理控制台已无法创建新密钥。
- 现有的 reCAPTCHA Classic 密钥正被自动迁移到 Google Cloud 项目中，Google 从 2025 年底一直执行到 2026 年。
- 迁移完成后，密钥的 API 访问将绑定到某个 Google Cloud 项目。超出每月 10,000 次评估的免费额度后，你必须在该项目上启用计费。

现在继续用 reCAPTCHA，意味着一个 Google Cloud 项目、一个登记在案的账单账户和按量计费的评估。而迁移到 Cap，这些统统不需要，节奏还完全由你掌控。

## 迁移过程

Cap 的 `/siteverify` 端点刻意仿照了 reCAPTCHA 的请求形态，因此服务端几乎可以直接替换。验证组件的替换是一比一换标签。总共三步，切换期间还可以两者并行运行。

### 1. 部署一个 Cap 实例

按照[快速上手](../index.md)用 Docker 运行 Cap Standalone 模式。在控制台中创建站点密钥，记下 **site key** 和对应的 **secret key**。保持 [instrumentation 质询](../instrumentation.md)开启（默认即开启）以获得最强的机器人防护。

### 2. 替换客户端验证组件

把 reCAPTCHA 的脚本和元素替换为 Cap 的验证组件。

替换前：

```html
<script src="https://www.google.com/recaptcha/api.js" async defer></script>
<div class="g-recaptcha" data-sitekey="<your-recaptcha-site-key>"></div>
```

替换后：

```html
<script src="https://cdn.jsdelivr.net/npm/cap-widget"></script>
<cap-widget data-cap-api-endpoint="https://<your-instance>/<site-key>/"></cap-widget>
```

如果你的 reCAPTCHA 组件原本放在 `<form>` 里，令牌处理方式可以照搬：reCAPTCHA 会自动注入 `g-recaptcha-response` 字段，Cap 则在提交时自动注入 `cap-token` 字段。如果不在表单内，监听 `solve` 事件即可：

```js
document.querySelector("cap-widget").addEventListener("solve", (e) => {
  const token = e.detail.token;
});
```

### 3. 替换服务端验证

reCAPTCHA 的验证是把 `secret` 和 `response` POST 到 Google 的固定 URL。Cap 接收同样的两个参数，只是 POST 到你自己的实例：

替换前：

```js
const { success } = await (
  await fetch("https://www.google.com/recaptcha/api/siteverify", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ secret: RECAPTCHA_SECRET, response: token }),
  })
).json();
```

替换后：

```js
const { success } = await (
  await fetch("https://<your-instance>/<site-key>/siteverify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ secret: CAP_SECRET, response: token }),
  })
).json();
```

服务端读取的令牌字段名也变了：从提交的表单中取 `cap-token`（或你在 `solve` 事件中捕获的值），而不是 `g-recaptcha-response`。

## 哪些兼容，哪些不兼容

我们更希望你在了解全部差异后再迁移，而不是在生产环境里遇到意外。兼容性是真实的，但并非逐字节一致：

| | reCAPTCHA | Cap |
| --- | --- | --- |
| 请求参数 | `secret`、`response`，可选 `remoteip` | `secret`、`response`（`remoteip` 会被忽略） |
| 端点 | 固定的 `google.com` URL | 你自己的 `/<site-key>/siteverify` |
| 成功字段 | `success`（布尔值） | `success`（布尔值） |
| 错误报告 | `error-codes`（数组） | `error`（字符串） |
| 额外字段 | `challenge_ts`、`hostname`、`score`（v3） | 无 |

实际情况是：

- 只检查 `response.success` 的代码，换掉 URL 和密钥后即可工作。这是最常见的情况，只是一行改动。
- 检查 `error-codes`、`challenge_ts`、`hostname` 或 v3 `score` 的代码需要更新。Cap 是一个验证系统，不是行为风险评分，所以这些字段不存在。
- 如果你的后端 SDK 把 Google 的验证 URL 写死了，换成一个允许自定义端点的 SDK，或者直接调用 `/siteverify`，总共就两个参数。

## 零停机迁移

你完全不必"一键切换然后祈祷"。把 Cap 挂载到一个单独的元素上，让后端在过渡期同时接受有效的 `cap-token` 或有效的 `g-recaptcha-response`。在日志里观察 Cap 的验证通过率，等数据看起来健康了，再删掉 reCAPTCHA 的脚本、元素和服务端调用。大多数团队一个下午就能完成切换。

## 另请参阅

- [在线演示](../demo.md)：亲自解一次 Cap 质询，再与 reCAPTCHA 对比耗时
- [Cap vs reCAPTCHA](./recaptcha.md)：完整对比
- [Cap 如何检测机器人](../effectiveness.md)：工作量证明 + instrumentation 模型
- [快速上手](../index.md)：五分钟从零部署 Cap
