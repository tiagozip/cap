---
layout: home
title: Cap – 开源、可自托管的 reCAPTCHA 替代方案
titleTemplate: false
description: "Cap 是一个免费、开源的 CAPTCHA 替代方案。可自托管、隐私优先、无 Google。基于工作量证明与 instrumentation，无视觉谜题。Apache 2.0 许可。"

hero:
  name: "Cap"
  text: "开源、可自托管的现代 CAPTCHA 替代方案"
  tagline: 基于工作量证明与 instrumentation 质询，无视觉谜题、无跟踪、隐私优先。Apache 2.0 许可。
  image:
    src: /logo.png
    alt: Cap
  actions:
    - theme: brand
      text: 快速开始
      link: /zh/guide/
    - theme: alt
      text: 工作原理
      link: /zh/guide/workings
    - theme: alt
      text: GitHub
      link: https://github.com/tiagozip/cap

features:
  - icon: 🔒
    title: 隐私优先
    details: 不设 Cookie、不做指纹追踪、不向第三方回传数据。验证只发生在你自己的服务器上，GDPR 友好。
  - icon: ⚙️
    title: 双层防护
    details: 工作量证明（SHA-256 WASM 或抗 GPU 的时间锁质询）加上服务端生成的 instrumentation 浏览器环境检测。
  - icon: 🧩
    title: 无视觉谜题
    details: 用户无需辨认红绿灯或斑马线，正常访客几乎无感通过，机器人却难以大规模自动化绕过。
  - icon: 🔁
    title: 轻松迁移
    details: siteverify API 与 reCAPTCHA、hCaptcha 兼容，只需替换前端验证组件即可完成切换。
  - icon: 🖥️
    title: 完全自托管
    details: Standalone 模式在一台 5 美元的 VPS 上即可运行大多数站点，没有按请求计费，也没有第三方配额。
  - icon: 📖
    title: 真正开源
    details: 基于 Apache 2.0 许可，代码可阅读、可审计，运行在你自己的基础设施上。
---
