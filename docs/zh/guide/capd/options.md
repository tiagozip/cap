---
description: "capd 这款自托管开源 CAPTCHA 的配置：环境变量、代理后的客户端 IP、验证组件文件、健康检查和 API。"
---

# 配置

大多数设置都在控制台中，整个服务端的设置位于 **Instance settings** 下，单个站点密钥的设置位于该密钥的 **Settings** 页面。

## 环境变量 {#environment-variables}

| 变量 | 作用 |
| --- | --- |
| `ADMIN_KEY` | 控制台密码，至少 12 个字符。必填。 |
| `VALKEY_URL` | Valkey 连接字符串，默认值为 `redis://localhost:6379`。也可以使用 Redis。 |
| `VALKEY_TLS_CA` | PEM 格式 CA 证书的路径，Cap 通过 TLS 连接 Valkey 时信任它，适用于使用自签名证书的服务器。请使用 `rediss://` URL。服务器要求客户端证书时，用 `VALKEY_TLS_CERT` 和 `VALKEY_TLS_KEY` 提供。 |
| `CLICKHOUSE_URL` | 将事件存入 ClickHouse 而不是 DuckDB，例如 `http://cap:password@clickhouse:8123/cap`。密码按原样填写，不要进行 URL 编码。 |
| `WEBHOOK_ALLOW_PRIVATE` | 设为 `true` 后，Webhook 可以向私有地址和回环地址发送请求，例如局域网内的 n8n。 |
| `DUCKDB_MEMORY_LIMIT`、`DUCKDB_THREADS` | DuckDB 的资源限制，默认值分别为 `256MB` 和 `2`。 |

## 代理后的客户端 IP {#client-ips-behind-a-proxy}

Cap 按客户端 IP 对质询进行速率限制，默认每 5 秒 30 次请求。它使用套接字地址并忽略转发头，除非你在 **Instance settings > Visitor location > Your proxy or CDN** 下选择了你的代理。在 Cloudflare 后面时，选择 Cloudflare。对于 `X-Forwarded-For`，Cap 读取最后一项，也就是你的代理追加的那一项。

使用 nginx 时，这样转发地址：

```nginx
location / {
    proxy_pass http://localhost:3000;
    proxy_set_header X-Forwarded-For $remote_addr;
}
```

如果没有设置代理，所有访客会共用代理的速率限制桶。设置了头之后，不要直接暴露 3000 端口，否则客户端可以随意发送任何 IP。

## 通过代理登录 {#proxy-sign-in}

如果仪表盘放在 Authentik、Authelia、oauth2-proxy 或其他登录代理之后，Cap 可以直接让代理放行的人登录，不用再用 `ADMIN_KEY` 登录一次。在 **Instance settings > Proxy sign-in** 中生成一个密钥，然后让代理在已登录的请求上加上 `X-Cap-Proxy-Secret` 请求头并带上这个密钥。使用 Caddy 时，只需在 forward auth 后面的 `reverse_proxy` 块里加一行：

```txt
reverse_proxy localhost:3000 {
    header_up X-Cap-Proxy-Secret {env.CAP_PROXY_SECRET}
}
```

使用 nginx 时，在受保护的 location 里加上 `proxy_set_header X-Cap-Proxy-Secret $cap_proxy_secret;`。验证组件的路由 `/assets/*`、`/<siteKey>/challenge`、`/<siteKey>/redeem`、`/<siteKey>/siteverify` 和 `/health` 不经过登录代理，也不需要这个请求头。

**Proxy or admin key** 会在请求头存在时自动登录，其他人仍可用管理员密钥登录。**Proxy only** 会关闭管理员密钥登录，并在每个仪表盘请求上检查请求头，因此在身份提供商里被移除的人会立即失去访问权限，即使他保留了会话令牌。两种模式下 API 密钥都照常可用。只有开启它的那个请求带有该请求头时，Cap 才会切换到 Proxy only，所以你不会在仪表盘里把自己锁在外面。

Cap 只保存密钥的哈希值，丢失后请重新生成。如果配置出错的代理还是把你锁在了外面，可以用 `docker compose exec valkey valkey-cli DEL settings:proxy-auth` 删除这项设置。如果设置了 `REDIS_PREFIX`，请把它加在键名前面。

## 验证组件文件 {#asset-server}

默认情况下，验证组件从 jsDelivr 加载脚本和 WebAssembly 文件。开启 **Instance settings > Widget files > Serve widget files from this server** 后，Cap 会把这些文件下载到 Valkey，并在 `/assets/` 下提供，每个密钥的 **Add Cap to your site** 代码片段也会改为指向这里。同一区域还可以选择验证组件和 WASM 的版本。

## IP 数据 {#ip-data}

使用 DB-IP 和 MaxMind 查询时，Cap 会把 `.mmdb` 文件下载到 `/usr/src/app/data`。容器以 UID 1000 运行，因此绑定挂载的目录必须能被该用户写入：

```bash
mkdir -p ./cap-data && sudo chown 1000:1000 ./cap-data
```

## 健康检查 {#health-checks}

`GET /health` 在 Valkey 于 2 秒内响应时返回 `200`，否则返回 `503`，适合用于就绪检查。`GET /health/live` 只要进程在运行就返回 `200`，适合用于存活检查，这样编排系统就不会在 Valkey 故障期间重启 Cap。

## API {#api}

控制台的所有操作都可以通过 REST API 完成，文档位于你实例的 `/swagger`。在 **Instance settings > API keys** 下创建密钥，并以 `Authorization: Bot <api-key>` 的形式发送。

默认情况下，密钥可以执行所有操作。你可以把它设为只读，或限制为部分站点密钥，也可以两者都设置。限定为单个站点密钥的只读密钥可以安全地交给该站点的所有者，让他们查看自己的统计数据。
