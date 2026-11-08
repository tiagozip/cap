---
outline: [2, 3]
description: "Cap 的 instrumentation 质询在沙箱框架中运行每次质询单独生成的脚本，以确认真实浏览器，与这个自托管开源 CAPTCHA 的工作量证明协同工作。"
---

# Instrumentation

Instrumentation 质询检查质询是否在真实浏览器中求解。它们与工作量证明一起运行，capd 的新密钥默认开启，[核心库](./capjs-core.md#instrumentation)则需要主动启用。

<InstrumentationFlow />

## 工作原理

每个质询都附带一个服务端从未发送过的程序。程序中的算术每次都不同，因此求解器必须解析并运行每个新程序，而不能重放旧答案。程序记录的关于页面的所有信息都会哈希进答案，服务端会重新计算这个答案，因此客户端修改记录就会失败。

框架与页面同源，因此程序能看到框架外的页面。采用严格内容安全策略的页面需要设置 `window.CAP_SCRIPT_NONCE`，[存在 HTML 注入漏洞的页面](./widget.md#pages-with-an-html-injection-bug)可以用 `CAP_ISOLATE` 隔离框架。

## 自动化浏览器检测

在 capd 中开启 **Attempt to block headless browsers**，或在核心库中开启 `blockAutomatedBrowsers` 后，服务端会拦截带有自动化标记的浏览器，包括 `navigator.webdriver`、无头浏览器的 user agent、stealth 插件补丁、Playwright 的 Firefox 协议，以及页面与 Web Worker 对设备信息说法不一致的情况。这些检查寻找自动化工具和篡改痕迹，绝不根据访问者使用哪种浏览器来判断。失败的检查列在 `blockedBy` 中，较弱的迹象只加入 `riskFlags`，不会拦截。

## 交互检测

这是一项实验性功能，默认关闭。开启 **Block automated clicks and typing** 后，程序会统计由脚本而非访问者派发的点击和按键，任意一类达到三次，求解就会失败。它从不读取字段值，并忽略密码、一次性验证码和支付卡字段。

## 行为评分

行为评分默认关闭，按密钥设置。程序记录指针如何到达验证组件以及按键的节奏，绝不记录具体按了哪个键。服务端据此算出一个 0 到 1 的分数和一个判定，判定为 `ok`、`suspicious`、`automated` 或 `agent`，默认在分数达到 0.75 时拦截 `automated`。直线移动的指针轨迹、脚本派发的按下操作，或节奏完全均匀的输入都会推高分数。

[隐形模式](./invisible.md)和[浮动模式](./floating.md)调用 `solve()` 时不会按下验证组件，因此在要求按下的密钥上会失败。

## AI 智能体检测

Cap 根据智能体工具在页面中留下的标记、点击和输入模式，以及 `User-Agent` 和带签名的 `Signature-Agent` 请求头来识别 AI 智能体的名称。检测到的智能体会把 `agent:<name>` 加入 `riskFlags`。密钥可以拦截所有智能体，或只拦截高置信度识别出的智能体，也可以放行带有已验证 [Web Bot Auth](https://datatracker.ietf.org/doc/draft-meunier-web-bot-auth-architecture/) 签名的智能体。

## 无法阻止的情况

程序运行在访问者的浏览器中，所以这些防护的目的是让伪造结果比正常运行程序付出更多代价，具体做法包括冻结内置对象、对每个字段做哈希、把结果绑定到单个质询，以及只会导致失败的失败标记。Cap 仍然无法区分真人与真人操控的真实浏览器，因此无法阻止付费人工求解、通过普通操作系统事件输入的智能体，或从源码重新构建以隐藏自动化的浏览器。工作量证明仍然让这些求解每一次都付出代价。

错误码列在[故障排查](./troubleshooting/instrumentation.md#错误码)中。

## 旧版验证组件

旧版验证组件仍能向新服务端求解，这些求解带有 `legacy_widget` 风险标志。在拦截自动化交互、进行行为评分或拦截智能体的密钥上，它们会以 `instr_widget_outdated` 失败。更新验证组件即可解决。
