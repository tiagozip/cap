---
description: "社区维护的 Cap 库：在更多语言和框架中使用这个自托管的开源 CAPTCHA，在官方 SDK 之外验证工作量证明令牌。"
---

# 社区库

想在不使用 Standalone 服务端的情况下，用其他语言使用 Cap？下面这些社区维护的库或许能帮到你。如果你想添加一个库，欢迎提交 pull request！

**注意：** 这些库通常**不**支持种子质询（seeded challenges）或 instrumentation（浏览器环境检测）质询等新特性。

## 验证组件

这些是对 Cap 验证组件的封装。通常并不是必需的——默认的验证组件在任何地方都能用——但它们可以带来更好的开发体验。

### React

- **[@pitininja/cap-react-widget](https://www.npmjs.com/package/@pitininja/cap-react-widget)**
- **[cap-widget](https://ui.ednesdayw.com/docs/components/cap-widget)**：一个 headless、兼容 shadcn 的 CAP React 组件

### Angular

- **[@espressotutorialsgmbh/cap-angular-widget](https://www.npmjs.com/package/@espressotutorialsgmbh/cap-angular-widget)**

### Vue

- **[nuxt-cap](https://github.com/dethdkn/nuxt-cap)**

### 其他

- **[better-captcha](https://www.better-captcha.dev/docs/provider/cap-widget)**：一个框架无关的验证组件，支持 React、SolidJS、Vue、Svelte 等 6 种不同框架

## Hooks

这些是 Cap API 的 React hook 实现，允许完全自定义用户体验。

- **[@takeshape/use-cap](https://www.npmjs.com/package/@takeshape/use-cap)**

## 服务端

**警告：** 这些库由社区维护，并非 Cap 官方支持，也没有针对安全性进行持续监测。我们无法保证它们的质量、安全性或兼容性。它们也可能不支持存储钩子（storage hooks）或种子质询等较新的特性。

### Cloudflare Workers（Serverless/JavaScript）

- **[kaerez/CFCap](https://github.com/kaerez/CFCap)**：基于 Cloudflare Workers 和 R2 Buckets（比 Durable Objects 更便宜）的 Serverless CAP CAPTCHA 实现，支持自定义 TTL、可选使用托管的 JS 与 WASM、全球边缘部署和自动扩缩容

### Cloudflare Workers（Serverless/JavaScript/TypeScript）

- **[xyTom/cap-worker](https://github.com/xyTom/cap-worker)**：基于 Cloudflare Workers 和 Durable Objects 的 Serverless CAP CAPTCHA 实现，支持全球边缘部署和自动扩缩容

### Java

- **[luckygc/cap-server](https://github.com/luckygc/cap-server)**：wuhunyu 版 Java 服务端的替代品，修复了[一个重要问题](https://github.com/tiagozip/cap/issues/69#issuecomment-3079407189)

- **[wuhunyu/cap-server-java](https://github.com/wuhunyu/cap-server-java)**

- **[schwebke/cap-captcha-keycloak](https://github.com/schwebke/cap-captcha-keycloak)**：为注册流程提供 Cap 人机验证校验的 Keycloak 扩展

### Go

- **[samwafgo/cap_go_server](https://github.com/samwafgo/cap_go_server)**
- **[ackcoder/go-cap](https://github.com/ackcoder/go-cap)**

### Python

- **[capjs-server](https://github.com/vshn/capjs-server)**：用于 Cap 令牌验证的无状态 Python 服务端库（无需数据库）
- **[django-cap](https://pypi.org/project/django-cap/)**：基于 Django 的 Cap 服务端 Python 实现

### .NET

- **[izanhzh/pow-cap-server](https://github.com/izanhzh/pow-cap-server)**

### PHP

- **[clysss/capito](https://github.com/clysss/capito)**：Capito Cap PHP 服务端
- **[trilbymedia/cap-php](https://github.com/trilbymedia/cap-php)**：Cap 工作量证明验证服务端的 PHP 移植版
- **[oliweb-proof-of-work-for-cap](https://github.com/oli217/oliweb-proof-of-work-for-cap)**：将 Cap 集成到评论、登录、注册和 WooCommerce 结账流程的 WordPress 插件——同时支持可见的验证组件和不可见（编程模式）两种方式
- **[laravel-cap](https://github.com/oli217/laravel-cap)**：Cap 的 Laravel 集成——提供 Blade 指令、中间件、验证规则和用于服务端令牌验证的 facade（`composer require oliweb/laravel-cap`）
- **[statamic-cap](https://github.com/oli217/statamic-cap)**：将 Cap 集成到表单的 Statamic 插件——支持验证组件渲染、自动令牌校验和灵活的控制面板配置（`composer require oliweb/statamic-cap`）
- **[cap-captcha-wordpress](https://github.com/forge28labs/cap-captcha-wordpress)**：将 Cap 集成到认证流程和新评论中的 WordPress 插件。可通过 WordPress 管理后台配置（实例、密钥和颜色）。

## 客户端

**警告：** 这些库由社区维护，并非 Cap 官方支持，也没有针对安全性进行持续监测。我们无法保证它们的质量、安全性或兼容性。

### JavaScript

- **[cap-client](https://codeberg.org/sanin/cap-client)**：用于发起验证请求的客户端库和 Express 中间件，面向 NodeJS
