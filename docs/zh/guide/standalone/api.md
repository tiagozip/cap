---
description: "Cap Standalone 的 REST API 参考：通过 Bearer 鉴权请求，为这款自托管开源 CAPTCHA 创建和管理站点密钥与会话。"
---

# API

Standalone 模式提供了一套简单的 API，用于创建、查看和管理密钥与会话。首先登录你的 Cap Standalone 控制台，在 **Settings** → **API Keys** 中获取一个 API 密钥。给它起个名字，然后点击 "Create"。

密钥创建后请妥善保存，之后将无法再次查看。

现在，你就可以用这个密钥向你的 Standalone 服务端发起 API 请求了。每次请求都需要在 `Authorization` 头中携带你的 API 密钥，格式如下：

```http
Authorization: Bot YOUR_API_KEY
```

访问 `http://localhost:3000/swagger` 可以查看所有可用的 API 端点及其所需的请求体。
