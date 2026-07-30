---
title: 关于 Cap
description: "了解开源、自托管的 CAPTCHA 替代方案 Cap 背后的故事：维护者、历史、许可证、资金来源以及联系方式。"
sidebar: false
---

# 关于 Cap

**太长不看：** Cap 是一个免费、开源的 CAPTCHA（人机验证）替代方案，用工作量证明（PoW）和 instrumentation（浏览器环境检测）质询取代了视觉谜题。它基于 Apache 2.0 许可证发布，完全运行在你自己的基础设施上，访客数据永远不会流向第三方。

## Cap 是什么？

Cap 是一套你可以阅读、审计并自托管的机器人防护方案：

- 一个 **约 20 KB 的验证组件**，只渲染一个复选框，而不是图片谜题。
- 一个 **Standalone 服务端**，以单个 Docker 容器交付，自带管理面板并支持多站点密钥。
- **服务端库**（`@cap.js/server` 及社区移植版本），用于在你自己的后端验证质询。
- 一个 **与 reCAPTCHA、hCaptcha 兼容的 siteverify API**，迁移基本上只需要换个 URL。

完整源码托管在 [github.com/tiagozip/cap](https://github.com/tiagozip/cap)，采用 [Apache 2.0 许可证](https://www.apache.org/licenses/LICENSE-2.0)。

## 为什么会有 Cap？

主流 CAPTCHA 要么用谜题拷问用户，要么用指纹追踪和风险评分给用户画像，而这两种方式都会把你的访客数据交给第三方厂商。Cap 选择了一条不同的路：

- **确定性，而非主观裁决。** 每个真实用户都有一条有保障的通过路径；不会有分类器因为有人使用 VPN 或隐私浏览器就悄悄将其拒之门外。
- **自托管，而非租用。** 验证发生在你自己的服务器上，这让 GDPR 和 CCPA 相关问题变得简单。参见[合规性](./guide/compliance.md)。
- **公开透明，而非口头承诺。** 隐私承诺是可审计的，因为做出决策的代码是公开的。

## 联系我们

- Bug 与功能请求：[GitHub issues](https://github.com/tiagozip/cap/issues)
- 安全报告及其他事宜：[hi@tiago.zip](mailto:hi@tiago.zip)
