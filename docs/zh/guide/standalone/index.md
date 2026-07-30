---
description: "Cap Standalone 是自托管这款开源 CAPTCHA 后端的最简单方式：Docker、instrumentation、兼容 reCAPTCHA 的 API，以及一个 Web 控制台。"
---

# Cap Standalone

Cap Standalone 是自托管 Cap 后端的推荐方式。它运行在 Bun 上，空闲内存占用约 50 MB，内置 instrumentation（浏览器环境检测）质询，能显著提高机器人的作弊门槛；提供兼容 reCAPTCHA 的 siteverify API；还带有一个管理多个站点密钥的 Web 控制台。

我们推荐使用 [Docker](https://docs.docker.com/get-docker/) 来运行 Cap Standalone。

## 安装

创建 `docker-compose.yml` 文件：

```yaml
services:
  cap:
    image: tiago2/cap:latest
    container_name: cap
    ports:
      - "3000:3000"
    environment:
      ADMIN_KEY: your_secret_password
      REDIS_URL: redis://valkey:6379
    depends_on:
      valkey:
        condition: service_healthy
    restart: unless-stopped

  valkey:
    image: valkey/valkey:9-alpine
    container_name: cap-valkey
    volumes:
      - valkey-data:/data
    command: valkey-server --save 60 1 --loglevel warning --maxmemory-policy noeviction
    healthcheck:
      test: ["CMD", "valkey-cli", "ping"]
      interval: 5s
      timeout: 3s
      retries: 5
    restart: unless-stopped

volumes:
  valkey-data:
```

::: tip 提示

- `ADMIN_KEY` 是登录控制台的密码，建议长度至少 32 个字符
- 如果主机上 3000 端口已被占用，修改 `3000:3000`。
- 如果控制台无法访问，尝试在 `cap` 服务下添加 `network_mode: "host"`。
  :::

启动容器：

```bash
docker compose up -d
```

打开 `http://localhost:3000`（或你服务器 3000 端口对应的 IP/域名）进入控制台。用管理员密钥登录，创建一个站点密钥，并记下**站点密钥（site key）**和对应的**秘密密钥（secret key）**，两者都会用到。

新建站点密钥时，instrumentation 质询默认开启。我们建议保持开启，因为它能显著提高机器人的作弊门槛。如需额外防护，可以启用无头浏览器检测。

你的 Cap Standalone 实例必须能从公网访问，验证组件才能与它通信。如果部署在反向代理后面，请按[选项指南](/zh/guide/standalone/options.md)配置速率限制。

## 使用

### 客户端

通过设置 `data-cap-api-endpoint` 属性，让验证组件指向你的实例：

```
https://<instance_url>/<site_key>/
```

- `<instance_url>`：你的 Cap Standalone 实例的公开 URL
- `<site_key>`：控制台中的站点密钥

示例：

```html
<cap-widget data-cap-api-endpoint="https://cap.example.com/d9256640cb53/"></cap-widget>
```

更多细节和各框架的示例代码，见[验证组件文档](../widget.md)。

### 服务端

用户完成 CAPTCHA 后，你的后端必须先验证令牌，才能信任它。向你实例的 `/siteverify` 端点发送 `POST` 请求，JSON 请求体如下：

```bash
curl "https://<instance_url>/<site_key>/siteverify" \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{ "secret": "<key_secret>", "response": "<captcha_token>" }'
```

其中 `<key_secret>` 是控制台中的秘密密钥（**不是**控制台的管理员密钥），`<captcha_token>` 是验证组件生成的质询令牌。

验证成功会返回：

```json
{ "success": true }
```
