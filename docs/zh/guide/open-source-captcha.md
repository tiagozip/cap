---
title: "2026 年最佳开源 CAPTCHA 选项"
description: "面向开发者的最佳开源、自托管 CAPTCHA 选项对比：Cap、ALTCHA、mCAPTCHA 和 Anubis，涵盖许可证、架构以及如何选择。"
faq:
  - q: 最好的开源 CAPTCHA 是什么？
    a: "想要一套完整的方案（两层验证、仪表盘、兼容的 siteverify API），选 Cap。只想要一个极简的库，选 ALTCHA。"
  - q: 我可以自托管 CAPTCHA 吗？
    a: "可以，而且比听起来简单。Cap 只需一个 Docker 容器加 Valkey，一台 5 美元的 VPS 就能运行，大约五分钟即可完成部署。"
  - q: Cap 是免费的吗？
    a: "完全免费。Apache 2.0 许可，无配额，无付费版本，不限流量。"
  - q: Cap 比 ALTCHA 更好吗？
    a: "Cap 提供的更多（instrumentation 层、独立服务端、仪表盘、进度体验、更小的验证组件）；ALTCHA 则刻意保持精简。按你想自己动手的程度来选。"
  - q: 开源 CAPTCHA 能保护隐私吗？
    a: "它让隐私变得可审计，而不是只靠承诺。自托管的工作量证明不需要指纹追踪、不需要行为画像、不需要第三方调用，而且你可以直接读代码来确认这一点。"
---

# 2026 年最佳开源 CAPTCHA 选项

**简短回答：** Cap 是一个免费、开源、自托管的 CAPTCHA（人机验证）替代方案，采用 Apache 2.0 许可证，用工作量证明和 [instrumentation 质询](./instrumentation.md)取代视觉谜题。其他值得认真考虑的开源选项还有 **ALTCHA**（极简 PoW 库）、**mCAPTCHA**（PoW，仍处 1.0 之前、进展缓慢）和 **Anubis**（面向整站而非表单的 PoW 反爬虫墙）。

## 什么才算开源 CAPTCHA？

仅有一个公开的验证组件仓库并不算数。对机器人防护而言，做出裁决的那部分代码你能审计、能自行运行，"开源"才有意义：

- **客户端和服务端代码均已发布**，且采用 OSI 认可的许可证，质询逻辑不是黑盒。
- **验证环节可自托管**，用户能不能通过，永远不取决于某家供应商的 API 是否在线、是否诚实、你是否付得起。
- **没有隐藏的数据回传**，而且因为代码可读，你可以亲自验证这一点。

不少商业 CAPTCHA 只开源客户端集成，服务端仍是专有的（比如 FriendlyCaptcha）。那只是源码可见的便利，不是开源 CAPTCHA：决策引擎依然是一个你租来的黑盒。

## 为什么要自托管 CAPTCHA？

- **可证明的隐私。** 访客数据永远不会到达任何供应商，GDPR/CCPA 的问题因此变得简单。见[合规性](./compliance.md)。
- **没有配额和按请求计费。** 流量高峰和机器人洪流不会变成账单。
- **没有供应商风险。** 不会有突然的涨价、功能下线或被收购后的釜底抽薪。
- **掌控权。** 你按站点密钥自行设置质询难度，而不是把对用户的裁决托付给一个远端模型。
- **可用性。** 第三方质询端点宕机时，你的表单不会跟着坏掉。

## 可选方案

### Cap

Cap 是一套 Apache 2.0 许可下的完整开源 CAPTCHA 方案：约 20 KB 的 Web Component 验证组件，加上 [Cap Standalone](./standalone/index.md)：一个小巧的 Docker 部署（一个容器加 Valkey），提供 REST API、支持多站点密钥管理的仪表盘，以及与 reCAPTCHA API 形式兼容的 `/siteverify` 端点。

防护来自两个相互独立的层：SHA-256 工作量证明（另有实验性的抗 GPU [RSW 时间锁](./rsw.md)），以及验证运行环境是真实浏览器的动态 [instrumentation 质询](./instrumentation.md)。攻破其中一层并不等于攻破另一层。

如果你更想嵌入而非部署，[capjs-core](./capjs-core.md) 是 Cap 的无状态服务端库：它在你自己的服务内部生成和验证质询，可运行于 Cloudflare Workers、Lambda 等无持久化存储的边缘环境。

- **许可证：** Apache 2.0，客户端与服务端均是
- **机制：** 工作量证明 + instrumentation
- **部署：** Docker 容器 + CDN 或自托管验证组件
- **最适合：** 想要一个开箱即用、自托管、体验良好的 CAPTCHA 服务的团队

### ALTCHA

ALTCHA 是一个极简且维护良好的工作量证明验证组件（MIT 许可），需要你自己接入后端。开源版没有仪表盘，也没有独立服务端；基于机器学习的第二层防护属于付费产品 Sentinel。

- **许可证：** MIT（验证组件）
- **机制：** 工作量证明
- **最适合：** 想要一个小巧的库、并乐于自己构建服务端的开发者

[完整对比：Cap vs ALTCHA →](./alternatives/altcha.md)

### mCAPTCHA

mCAPTCHA 率先实践了同样的可变难度 PoW 思路。它是完全开源的（核心为 AGPL-3.0，客户端库使用宽松许可证），但至今仍处于 1.0 之前，发布节奏缓慢，验证组件体积也比 Cap 和 ALTCHA 更大。作为研究对象没问题，但要在它之上构建，请先评估其成熟度。

### Anubis

Anubis 是一个开源的工作量证明*反爬虫墙*：它在反向代理层面为整个站点或路径设置门槛，主要对抗 AI 爬虫。它不是表单 CAPTCHA，也不提供独立的验证服务端，但和后者搭配使用效果很好。你可以在整站前面部署 Anubis，同时在站内的高价值表单上使用 Cap。

[完整对比：Cap vs Anubis →](./alternatives/anubis.md)

## 并排对比

| | Cap | ALTCHA | mCAPTCHA | Anubis |
| :-- | :-- | :-- | :-- | :-- |
| 许可证 | Apache 2.0 | MIT（验证组件） | AGPL | MIT |
| 活跃维护 | ✅ | ✅ | 🟨 1.0 之前，发布缓慢 | ✅ |
| 机制 | PoW + instrumentation | PoW | PoW | PoW |
| 作用范围 | 按操作（表单、API） | 按操作 | 按操作 | 整站门禁 |
| 独立服务端 + 仪表盘 | ✅ | ❌ | ✅ | ❌ |
| 兼容 reCAPTCHA 的 siteverify | ✅ | ❌ | ❌ | ❌ |
| 验证组件体积 | 约 20 KB | 约 34 KB | 更大 | 不适用（透明） |
| 抗 GPU 的 PoW 选项 | ✅ [RSW](./rsw.md) | ❌ | ❌ | ❌ |

## 如何选择

- **想要一个部署一次、之后在仪表盘里管理的服务？** Cap。[快速上手 →](./index.md)
- **想要尽可能小的依赖、后端胶水代码自己写？** Cap 的 [capjs-core](./capjs-core.md) 库，或 ALTCHA。
- **要对抗的是整站爬虫，而不是表单垃圾信息？** Anubis，可选择在表单上搭配 Cap。
- **正在从 reCAPTCHA 或 hCaptcha 迁移？** Cap 兼容的 siteverify 让迁移只是换个 URL。[迁移指南 →](./alternatives/migrate-from-recaptcha.md)

## 常见问题

### 最好的开源 CAPTCHA 是什么？

想要一套完整的方案（两层验证、仪表盘、兼容的 siteverify API），选 Cap。只想要一个极简的库，选 ALTCHA。

### 我可以自托管 CAPTCHA 吗？

可以，而且比听起来简单。Cap 只需一个 Docker 容器加 Valkey，一台 5 美元的 VPS 就能运行，大约五分钟即可完成部署。

### Cap 是免费的吗？

完全免费。Apache 2.0 许可，无配额，无付费版本，不限流量。

### Cap 比 ALTCHA 更好吗？

Cap 提供的更多（instrumentation 层、独立服务端、仪表盘、进度体验、更小的验证组件）；ALTCHA 则刻意保持精简。按你想自己动手的程度来选。

### 开源 CAPTCHA 能保护隐私吗？

它让隐私变得可审计，而不是只靠承诺。自托管的工作量证明（PoW）不需要指纹追踪、不需要行为画像、不需要第三方调用，而且你可以直接读代码来确认这一点。

## 另请参阅

- [2026 年最佳 CAPTCHA 替代方案](./best-captcha-alternatives.md)：包含闭源方案的完整视野
- [功能对比](./alternatives.md)：完整矩阵
- [Cap 是如何工作的？](./workings.md)：架构详解
- [在线演示](./demo.md)：试用验证组件
