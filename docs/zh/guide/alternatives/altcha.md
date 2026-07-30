---
title: Cap vs Altcha
description: "Cap 对比 Altcha：两个开源、自托管的工作量证明 CAPTCHA。看看 Cap 额外提供的 instrumentation 质询、验证组件和托管控制台。"
---

# Cap vs Altcha

Altcha 是理念上与 Cap 最接近的项目：开源、工作量证明、无指纹追踪、不依赖第三方。两者都是不错的选择，差异主要在功能和运维形态上。

Altcha 还有一个名为 **Altcha Sentinel** 的商业产品，在开源验证组件之上叠加了基于机器学习的威胁检测。下面的对比主要针对 Cap 与开源版 Altcha 验证组件；如果你在考虑 Sentinel，那就是在比较付费 SaaS 和自托管开源项目，是另一个层面的决策了。

## 快速结论

如果你想要一个极简、库形态的 PoW CAPTCHA（人机验证），集成进 Node 项目后基本不用再过问，开源版 Altcha 很棒。如果你想要一个开箱即用的自托管服务，带控制台、多站点密钥支持、在 PoW 之上叠加 instrumentation 质询，还有能显示求解进度的界面（并且不用为 Sentinel 付费），那 Cap 更合适。

## Altcha 合适的场景

- 你只想要一个极小的、纯库形式的集成，不想额外运行任何服务。
- 你不需要工作量证明之外的第二层验证，或者你愿意付费购买 Sentinel 来获得基于机器学习的检测。
- 你已经集成了 Altcha，迁移成本大于下面列出的这些差异。

## Cap 更胜一筹的场景

- **两层独立验证，免费。** Cap 同时运行工作量证明*和*动态 JavaScript [instrumentation 质询](../instrumentation.md)，两者都包含在内。攻破其中一层并不等于攻破另一层。开源版 Altcha 只有 PoW；第二层（基于机器学习）需要为 Sentinel 付费。
- **带控制台的 Standalone 服务端，免费。** Cap 一个 Docker 容器就能部署，自带 Web 控制台、多站点密钥管理、数据分析，以及兼容 reCAPTCHA 的 siteverify 端点。Altcha 的开源部分需要你自己拼装这些；一体化的体验只有 Sentinel 才有。
- **验证组件更小。** Cap 约 20 KB，Altcha gzip 后约 34 KB。
- **进度显示。** Cap 的验证组件会以百分比向用户展示求解进度，短暂的等待中也有明确的反馈。
- **浮动模式和编程模式。** Cap 可以完全隐藏，或悬浮在按钮上直到表单提交。Altcha 的展示模式更简单。
- **外观可定制。** Cap 通过 CSS 变量暴露颜色、尺寸、位置和图标。Altcha 的定制能力更有限。

## 两者相似之处

- 都是开源项目（Cap 采用 Apache-2.0，Altcha 的验证组件采用 MIT），都没有遥测。
- 都在客户端运行工作量证明，让滥用行为付出代价。
- 自托管时都不需要任何第三方网络往返。
- 在设计上都符合 GDPR/CCPA。

## 另请参阅

- [在线演示](../demo.md)：在浏览器里试用 Cap
- [Cap 如何检测机器人](../effectiveness.md)：工作量证明 + instrumentation
- [所有替代方案](../alternatives.md)：完整功能对比矩阵
- [开源 CAPTCHA 选项](../open-source-captcha.md)：Cap、ALTCHA、mCAPTCHA 与 Anubis 对比
