---
title: Cap vs FriendlyCaptcha
description: "Cap 对比 Friendly Captcha：免费、自托管、开源的工作量证明 CAPTCHA 与付费 SaaS 的较量。对比隐私、定价，以及访客数据的去向。"
---

# Cap vs FriendlyCaptcha

FriendlyCaptcha 是早期的工作量证明 CAPTCHA（人机验证）之一，主打欧盟隐私合规。它是一个托管的商业服务，为非商业用途提供免费档，其他一切用途都需要付费。

## 快速结论

如果你确实需要一个付费的、托管在欧盟的、有供应商支持的产品，附带 SLA 和销售对接人，FriendlyCaptcha 是个合理的选择。如果你想要同样的工作量证明模型，但不想付账单、不想受请求配额限制，Cap 是一个免费、自托管、开源、由你端到端掌控的替代方案。

## FriendlyCaptcha 合适的场景

- 你需要一个有合同、有 SLA 的供应商，欧盟托管也由供应商负责。
- 你的流量可预测且足够小，一个付费档位就绰绰有余。
- 你不想运维任何基础设施。

## Cap 更胜一筹的场景

- **任何用量都没有配额。** FriendlyCaptcha 的 Starter 套餐为每月 9 欧元、限 1,000 次请求/月，用量增加还要升级更高档位。Cap 在任何用量下都免费：没有按请求收费，没有域名数量限制。
- **服务端开源。** FriendlyCaptcha 的框架集成是开源的，但服务端是专有的。Cap 从头到尾都是 Apache-2.0。
- **自托管。** Cap 运行在你自己的基础设施上，一台 5 美元的 VPS 即可，没有第三方网络往返。
- **两层验证。** Cap 在工作量证明之上增加了 [instrumentation 质询](../instrumentation.md)。FriendlyCaptcha 只有 PoW。
- **没有"供应商风险"。** 开源、自托管、Apache 2.0。不会突然涨价，也不会突然停服。

## 两者相似之处

- 都以工作量证明为主要机制。
- 在设计上都符合 GDPR/CCPA。
- 验证组件的体验都简洁、无障碍友好，没有图片谜题。

## 另请参阅

- [在线演示](../demo.md)：在浏览器里试用 Cap
- [Cap 如何检测机器人](../effectiveness.md)：工作量证明 + instrumentation
- [所有替代方案](../alternatives.md)：完整功能对比矩阵
- [2026 年最佳 CAPTCHA 替代方案](../best-captcha-alternatives.md)：托管与自托管方案排名
