---
title: Cap vs Cloudflare Turnstile
description: "Cap 对比 Cloudflare Turnstile：一个自托管、可定制、完全由你掌控的开源 CAPTCHA。没有供应商锁定，基于工作量证明和 instrumentation。"
---

# Cap vs Cloudflare Turnstile

Turnstile 是 Cloudflare 推出的免费 CAPTCHA（人机验证）替代品，主打隐形质询，重度依赖 Cloudflare 的网络信号和浏览器指纹追踪。

## 快速结论

如果你已经在用 Cloudflare，并且接受"判定权归他们"这一点，Turnstile 确实很不错。如果你想要自托管、确定性的难度、不依赖第三方，还能为自己的用户推翻判定，那 Cap 更合适。

## Turnstile 合适的场景

- 你的流量已经走 Cloudflare，希望留在同一个生态里。
- 你不想托管任何东西；Turnstile 是全托管的。
- 你能接受 Cloudflare 算法对"可疑"访客的判定，哪怕无法推翻。

## Cap 更胜一筹的场景

- **自托管。** Cap 运行在你自己的服务器上。Turnstile 的每次质询都必须绕道 Cloudflare。
- **策略由你掌控。** 使用 Turnstile 时，如果 Cloudflare 的算法认定某个用户可疑（Brave、Librewolf、Tor 或 VPN 用户很常见），你无法干预。Cap 把难度旋钮交到你手上。
- **对注重隐私的用户误判率更低。** 大量用户反馈 Turnstile 会误判加固过的浏览器。Cap 的工作量证明根本不关心指纹。
- **开源。** Apache 2.0，而 Turnstile 的客户端和服务端都是闭源的。
- **无遥测。** Cap 不会回传数据，也不设置 Cookie。Turnstile 的客户端在每次页面加载时都会与 `challenges.cloudflare.com` 通信。
- **可定制。** Cap 通过 CSS 变量暴露颜色、尺寸和形状。Turnstile 的 iframe 基本是固定的。

## 两者相似之处

两者的客户端都很小（约 20-110 KB）。两者都有"隐形"模式（Cap 称之为[浮动模式](../floating.md)或[编程模式](../programmatic.md)）。两者都在主质询之上叠加了行为检测：Cap 称之为 [instrumentation 质询](../instrumentation.md)，Turnstile 则叫"托管质询（managed challenges）"。

## 迁移

Cap 的 `/siteverify` API 形态与 Cloudflare 的 `siteverify` 兼容，因此服务端验证基本只需换 URL 和密钥。客户端的改动是把 `<div class="cf-turnstile">` 替换为 `<cap-widget>` 并指向你的 Cap 实例；完整代码见[快速上手](../index.md)。

## 另请参阅

- [在线演示](../demo.md)：在浏览器里试用 Cap
- [Cap 如何检测机器人](../effectiveness.md)：工作量证明 + instrumentation
- [所有替代方案](../alternatives.md)：完整功能对比矩阵
- [2026 年最佳 CAPTCHA 替代方案](../best-captcha-alternatives.md)：Turnstile、Cap 及其他方案排名
- [移动端表单的机器人防护](../mobile-form-bot-protection.md)：指纹信号最容易失灵的地方
