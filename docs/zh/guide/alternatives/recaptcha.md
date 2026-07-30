---
title: Cap vs reCAPTCHA
description: "Cap 对比 Google reCAPTCHA v2 与 v3：一个隐私优先、自托管、开源的替代方案。没有 Google 追踪，没有视觉谜题，只有工作量证明质询。"
---

# Cap vs reCAPTCHA

reCAPTCHA 是 Google 的 CAPTCHA（人机验证）服务，主要有两个版本：v2（"我不是机器人"）和 v3（隐形、基于评分）。两者都需要把流量数据发送给 Google。

## 快速结论

如果你的网站本来就不依赖 Google 的分析或登录服务，那几乎没有理由继续用 reCAPTCHA。对绝大多数使用场景来说，Cap 能提供同等的防护水平，同时不会把用户数据送到 Google，没有请求配额，也不会在 Google 的风险评分判定你可疑时强迫访客去做红绿灯谜题。

## reCAPTCHA 仍然合适的场景

- 你已经深度集成了 Google 的身份体系，想少操心一个供应商。
- 你确实需要 Google 的行为风险评分（v3），并且有配套的基础设施来处理它。
- 你的团队不愿意运行任何后端服务，哪怕只是一个 Docker 容器。

## Cap 更胜一筹的场景

- **隐私。** reCAPTCHA 会从 `google.com` 加载脚本，并把用户信号发送给 Google。Cap 完全运行在你自己的基础设施上，不会给你的页面引入任何第三方内容。
- **没有视觉谜题。** reCAPTCHA v2 动不动就让用户去识别红绿灯、消防栓和人行横道。这些谜题对 AI 求解器来说越来越简单，对人类却越来越难，尤其是移动端用户和用 VPN、隐私浏览器的人。
- **体积。** reCAPTCHA 的客户端超过 500 KB，而 Cap 的验证组件只有约 20 KB。
- **没有配额。** reCAPTCHA Enterprise 按评估次数计费。Cap 没有按请求收费：对大多数负载来说，一台 5 美元的 VPS 就够了。
- **没有"可疑用户"封锁。** v3 会悄悄惩罚使用 Tor、VPN 或注重隐私的浏览器的用户。用 Cap，难度由你设定，用户永远有一条走得通的路。
- **开源。** Apache 2.0 许可证。可审计、可分叉、可部署。

## 迁移

Cap 的 `/siteverify` 端点刻意兼容了 reCAPTCHA 的 API 形态，因此大多数服务端迁移只需要换一个 URL 加一个新密钥。客户端方面，把 `<script src="https://www.google.com/recaptcha/api.js">` 和 `<div class="g-recaptcha">` 替换为 Cap 的验证组件即可；完整步骤见[快速上手](../index.md)。

在切换期间，你也可以让两者并行运行：把 Cap 挂载到另一个元素上，服务端同时校验两种令牌，直到你放心为止。

## 另请参阅

- [在线演示](../demo.md)：在浏览器里试用 Cap
- [Cap 如何检测机器人](../effectiveness.md)：工作量证明 + instrumentation 模型
- [所有替代方案](../alternatives.md)：完整功能对比矩阵
- [2026 年最佳 CAPTCHA 替代方案](../best-captcha-alternatives.md)：所有 reCAPTCHA 替代品排名
- [CAPTCHA 与转化率](../captcha-conversion-rate.md)：谜题循环让你的注册量付出了什么代价
