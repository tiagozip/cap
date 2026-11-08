---
description: "capd 是自托管这款开源 CAPTCHA 后端的最简单方式：一个 Docker 容器，自带控制台、多个站点密钥和兼容 reCAPTCHA 的 API。"
---

# capd

capd 是打包成 Docker 镜像的 Cap 服务端。它向验证组件提供质询，为你的后端验证令牌，并提供管理站点密钥、实时事件、规则、列表和设置的控制台。它运行在 Bun 上，空闲内存占用约 30 MB，数据保存在 Valkey 中，数据分析事件则保存在 DuckDB 或 ClickHouse 中。

下面的演示就是真实的控制台，在你的浏览器里用生成的流量运行。

<DashboardDemo compact activating="正在启用滚动..." />

如果想在 Cloudflare 上运行包括控制台在内的整套服务而不用服务器，请参阅 [Cloudflare Workers](./workers.md)。如果只想在现有服务中提供质询，[核心库](../capjs-core.md)可以做到，但没有控制台。

## 运行

[快速开始](../index.md#_1-set-up-capd)会下载 compose 文件并启动 Cap。所有配置都需要 Valkey 来保存站点密钥、设置和会话，数据分析事件则保存在 DuckDB 或 ClickHouse 中。

`ADMIN_KEY` 是唯一必须设置的值。它是控制台密码，未设置或不足 12 个字符时，服务端会拒绝启动。其他设置见[配置](./options.md)。

要更新，请拉取新镜像并重建容器：

```bash
docker compose pull && docker compose up -d
```

## 数据分析存储

DuckDB 是 Cap 容器内的一个文件，不需要额外的容器。ClickHouse 作为独立容器运行在 Cap 旁边，可以让多个 Cap 容器共享同一份事件历史。

::: code-group

```bash [DuckDB]
curl -fsSLo docker-compose.yml https://raw.githubusercontent.com/tiagozip/cap/main/capd/docker-compose.duckdb.yml
echo "ADMIN_KEY=$(openssl rand -hex 24)" > .env
docker compose up -d
```

```bash [ClickHouse]
curl -fsSLo docker-compose.yml https://raw.githubusercontent.com/tiagozip/cap/main/capd/docker-compose.yml
echo "ADMIN_KEY=$(openssl rand -hex 24)" > .env
docker compose up -d
```

:::

DuckDB 文件会运行 Cap 和 Valkey，Cap 把事件写入 `cap-data` 卷上的 `/usr/src/app/data/events.duckdb`。DuckDB 最多使用 256 MB 内存和 2 个线程，可以通过 `DUCKDB_MEMORY_LIMIT` 和 `DUCKDB_THREADS` 修改。ClickHouse 文件会运行 Cap、Valkey 和 ClickHouse。ClickHouse 使用 `ADMIN_KEY` 作为其 `cap` 用户的密码，不向宿主机开放任何端口，因此不需要其他设置。它的配置关闭了 ClickHouse 自身的系统日志表，并将内存限制为 1 GB。

| | DuckDB | ClickHouse |
| --- | --- | --- |
| 额外容器 | 无 | 有 |
| 存储的内存占用 | 控制台查询时最多 256 MB | 空闲时约 150 MB |
| 多个 Cap 容器 | 各自保留自己的历史 | 共享同一份事件历史 |

如果密码包含空格、`#` 或 `$`，请在 `.env` 中用单引号括起来。

### 使用自己的 ClickHouse

使用 DuckDB compose 文件，并在 `.env` 中添加 `CLICKHOUSE_URL`：

```dotenv
CLICKHOUSE_URL=http://cap:password@clickhouse.internal:8123/cap
```

Cap 会在首次启动时创建数据库和表。该用户需要对这个数据库拥有全部权限，并对 `system.parts` 拥有 `SELECT` 权限。如果启动时无法连接 ClickHouse，Cap 会把事件存入 DuckDB，直到下次重启，并在 **Instance settings > Data and storage** 下显示错误。

### 从旧版本升级

数据分析功能加入之前的 compose 文件没有为 `/usr/src/app/data` 配置卷，因此 Docker 会为该文件夹分配一个匿名卷，每次重建容器时事件都会丢失。添加 `docker-compose.duckdb.yml` 中的 `cap-data` 卷即可保留它们。

### 旧版本的秘密密钥、API 密钥和会话

旧版本使用 argon2 对站点秘密密钥、API 密钥和控制台会话做哈希。Cap 现在把它们全部存为 SHA-256，因为每一项都是 240 位或更长的随机令牌，同时它会拒绝旧的哈希，而不是去验证它们。升级后第一次启动时：

- 所有人都会退出控制台登录。请用 `ADMIN_KEY` 重新登录。
- 对于秘密密钥由旧版本生成的密钥，`/siteverify` 会返回 403。它们的 **Settings** 页面会给出提示。请在 **Danger zone** 下重置秘密密钥，并把新的秘密密钥放进后端的环境变量。
- 旧版本的 API 密钥会得到 401。**Settings > API keys** 会标出它们。请创建新的并删除旧的。

Cap 会在启动时记录仍需处理的站点密钥和 API 密钥的 id。请在更新调用 `/siteverify` 的后端之前重置秘密密钥，因为从新镜像启动的那一刻起，使用旧秘密密钥的请求就会失败。

## 上线

验证组件从访客的浏览器调用 Cap，因此服务端需要一个公开的 HTTPS URL。把它放在你常用的反向代理后面，并禁止从互联网直接访问 3000 端口。

Cap 按客户端 IP 对质询进行速率限制，只有获取到真实 IP 才能正常生效。上线前请阅读[代理后的客户端 IP](./options.md#client-ips-behind-a-proxy)，否则所有访客会共用同一个速率限制桶。

Events 页面的实时模式使用 `/server/live` 上的 WebSocket。大多数代理会直接转发它。使用 nginx 时，请在 Cap 的 location 中加上 `proxy_http_version 1.1` 以及 `Upgrade` 和 `Connection` 请求头。没有这些设置时，控制台会改为每 4 秒检查一次。

## 站点密钥

每个站点密钥都有自己的秘密密钥、统计和设置，包括质询协议与难度、[instrumentation](../instrumentation.md)、速率限制和拦截规则。新密钥默认使用 [HashWX](../hashwx.md)，并开启 instrumentation。

在密钥的 **Settings** 页面中，你可以在 **Add Cap to your site** 下再次显示或复制秘密密钥，旁边的 `.env` 代码片段包含两个密钥。重置功能位于 **Danger zone** 下。Cap 使用从 `ADMIN_KEY` 派生的密钥加密存储秘密密钥，因此仅获取 Valkey 数据的副本无法得到它。更改 `ADMIN_KEY` 会使已存储的秘密密钥无法读取，之后请重置秘密密钥，生成一个可以再次显示的新值。

## 端点

假设站点密钥为 `abc123`，服务位于 `cap.example.com`：

| URL | 调用方 |
| --- | --- |
| `https://cap.example.com/abc123/` | 验证组件，用作 `data-cap-api-endpoint` |
| `https://cap.example.com/abc123/siteverify` | 你的后端，携带秘密密钥和令牌 |
| `https://cap.example.com/` | 你，用于访问控制台 |

`/siteverify` 与 reCAPTCHA 一样，接受包含 `secret` 和 `response` 的 JSON，有效令牌会返回 `{ "success": true }`。验证失败时返回 `success: false`、一条 `error` 消息和 4xx 状态码。每个令牌只能使用一次。

控制台也提供 [REST API](./options.md#api)，可通过脚本管理密钥。
