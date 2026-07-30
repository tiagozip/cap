---
title: Cap vs hCaptcha
description: "Cap 对比 hCaptcha：一个自托管、无谜题、开源的 CAPTCHA 替代方案。没有图片九宫格，数据不会卖给广告商，靠工作量证明实现任意规模免费。"
---

# Cap vs hCaptcha

hCaptcha 是主打隐私定位、基于谜题的 reCAPTCHA 竞品。它的免费档会激进地弹出图片谜题；付费的 Pro 档（年付每月 99 美元、月付每月 139 美元，含 10 万次评估）才解锁基本无感的被动模式和分析功能。在主流 CAPTCHA 中，它的免费方案是弹可见谜题最激进的。

## 快速结论

如果你用 hCaptcha 主要是为了离开 Google，那 Cap 是更彻底的一步。你不是把 Google 换成另一个第三方，而是彻底不再需要第三方。同时，你也不用再让用户在每次提交表单时缴纳"谜题税"。

## hCaptcha 合适的场景

- 你确实需要 hCaptcha Enterprise 的威胁情报源和大规模风险评分，并且有相应预算。
- 你已经深度集成，迁移成本大于收益。
- 你的合规要求明确规定受监管操作必须有可见谜题的人工验证环节。

## Cap 更胜一筹的场景

- **没有图片谜题。** hCaptcha 谜题的流失率在 **5% 到 15%** 之间，取决于难度。这是你在注册、结账和联系表单上实实在在损失的转化。Cap 从不显示谜题。（hCaptcha Pro 的被动模式能缓解这一点，但那是付费方案。）
- **体积。** hCaptcha 的客户端超过 600 KB。Cap 约 20 KB，小了约 30 倍。
- **没有配额和超额费。** hCaptcha Pro 起价每月 99 美元、含 10 万次评估，超出部分每 1 千次收 0.99 美元。Cap 任何规模都免费，跑在一台 5 美元的 VPS 上，没有按请求收费。
- **自托管。** 不依赖第三方。Cap 不会从 `hcaptcha.com` 加载任何内容。
- **没有指纹追踪。** hCaptcha 依赖浏览器指纹和行为信号，这会伤害使用隐私浏览器的用户。Cap 的工作量证明在任何浏览器上表现都一样。
- **开源。** Apache 2.0。可以审计，可以跑在物理隔离的基础设施上，可以分叉。

## 两者相似之处

两者都在可见质询之外运行了一层 instrumentation/行为检测。两者都提供隐形模式。两者都适用于标准的表单提交模式。

## 迁移

Cap 的 `/siteverify` 与 hCaptcha 的 API 形态兼容。后端改动大多只是换个 URL。客户端方面，把 `<div class="h-captcha">` 和 `https://js.hcaptcha.com/1/api.js` 替换为 Cap 的 `<cap-widget>` 即可；见[快速上手](../index.md)。

如果想渐进式迁移，可以先在新表单上使用 Cap，旧表单继续保留 hCaptcha，然后观察转化率的差异。

## 另请参阅

- [在线演示](../demo.md)：在浏览器里试用 Cap
- [Cap 如何检测机器人](../effectiveness.md)：工作量证明 + instrumentation
- [所有替代方案](../alternatives.md)：完整功能对比矩阵
- [CAPTCHA 与转化率](../captcha-conversion-rate.md)：谜题税背后的完整计算
- [2026 年最佳 CAPTCHA 替代方案](../best-captcha-alternatives.md)：无谜题方案排名
