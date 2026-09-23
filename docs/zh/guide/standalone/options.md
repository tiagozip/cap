---
description: "Cap Standalone（自托管开源 CAPTCHA）的配置选项与环境变量：CORS、静态资源服务器、验证组件与 WASM 版本等。"
---

# 选项

## CORS

运行服务端时，可以通过设置 `CORS_ORIGIN` 环境变量来更改兑换和生成质询时的默认 CORS 设置。默认值为 `*`，即允许所有来源。可以用逗号分隔添加多个来源，比如 `domain1.tld,domain2.tld,...`。

## 静态资源服务器

静态资源服务器默认关闭。将 `ENABLE_ASSETS_SERVER` 环境变量设置为 `true` 即可开启，资源会从 `/assets` 端点提供。

然后把 `WIDGET_VERSION` 和 `WASM_VERSION` 设为你要提供的验证组件和 WASM 文件版本。默认值 `latest` 会提供最新版本，但可能引入破坏性变更，不建议在生产环境使用。

可用版本即 [`@cap.js/widget`](https://www.npmjs.com/package/@cap.js/widget?activeTab=versions) 和 [`@cap.js/wasm`](https://www.npmjs.com/package/@cap.js/wasm?activeTab=versions) 在 npm 上发布的版本。例如：

```env
ENABLE_ASSETS_SERVER=true
WIDGET_VERSION=0.1.58
WASM_VERSION=0.0.8
```

资源将从以下路径提供：

- `/assets/widget.js`
- `/assets/floating.js`
- `/assets/cap_wasm_bg.wasm`
- `/assets/hashwx.wasm`
- `/assets/cap_wasm.js`

在你的应用中，将验证组件的脚本地址指向相应路径即可使用，例如：

```html
<script src="https://<server url>/assets/widget.js"></script>
```

浮动模式则使用：

```html
<script src="https://<server url>/assets/floating.js"></script>
```

并将 `window.CAP_CUSTOM_WASM_URL` 和 `window.CAP_CUSTOM_HASHWX_URL` 分别设置为 `cap_wasm_bg.wasm` 和 `hashwx.wasm` 文件的路径，例如：

```js
window.CAP_CUSTOM_WASM_URL = "https://<server url>/assets/cap_wasm_bg.wasm";
window.CAP_CUSTOM_HASHWX_URL = "https://<server url>/assets/hashwx.wasm";
```

`hashwx.wasm` 从 `@cap.js/wasm` 0.0.8 起才包含在包里。如果 `WASM_VERSION` 更旧，`/assets/hashwx.wasm` 会返回 503，这时请不要设置 `CAP_CUSTOM_HASHWX_URL`，验证组件会从 jsdelivr 加载它。

默认情况下，这些资源从 `process.env.CACHE_HOST`（默认为 `https://cdn.jsdelivr.net`）获取。运行服务端时可通过设置 `CACHE_HOST` 环境变量来更改。

### 故障排查

服务启动时会从 `CACHE_HOST` 下载资源到 Redis，之后每小时刷新一次。如果资源端点返回 `Asset not cached yet`，说明下载尚未完成。请检查：

- Cap 容器上确实设置了 `ENABLE_ASSETS_SERVER=true`。如果你是在 compose 文件中修改的，需要重建容器。未设置时，`/assets/*` 端点会返回 404，并说明静态资源服务器已禁用。
- 容器有到 `CACHE_HOST` 的出站网络访问权限。如果下载失败，服务端会在启动时输出包含 `[asset server] failed to update assets cache` 的日志，并每小时重试。
- `WIDGET_VERSION` 和 `WASM_VERSION` 指向的版本在 npm 上确实存在。

## 速率限制

质询端点按客户端 IP 进行固定窗口速率限制，默认每 5 秒 30 次请求。你可以在控制台的 **Settings** 中修改全局限制（或通过 `PUT /settings/ratelimit`），也可以在某个站点密钥的 **Configuration** 标签页中单独覆盖。超出限制时，请求会收到 `429` 响应，并带有 `X-RateLimit-Remaining: 0` 响应头。

`/siteverify` 端点面向服务器间调用，因此默认不做速率限制。

### 代理后的客户端 IP

Standalone 通过依次检查 `X-Forwarded-For`、`X-Real-IP` 和 `CF-Connecting-IP` 头来识别客户端，都没有时回退到套接字地址。如果你的反向代理使用其他头，请在环境变量中设置 `RATELIMIT_IP_HEADER`（或在控制台 **Settings > Headers** 中设置 IP 头）。比如在 Cloudflare 后面，可以设置为 `cf-connecting-ip`。

请确保你的代理确实转发了客户端 IP。以 nginx 为例：

```nginx
location / {
    proxy_pass http://localhost:3000;
    proxy_set_header X-Forwarded-For $remote_addr;
}
```

否则，所有请求看起来都来自代理自身的 IP，所有客户端会共用同一个速率限制桶。另外注意，`X-Forwarded-For` 会被原样信任，因此服务端不能直接暴露在公网上，否则客户端可以伪造该头绕过速率限制。

## Redis / Valkey

Cap Standalone 使用 Redis（或 Valkey）存储所有数据。将 `REDIS_URL` 环境变量设置为你的 Redis 连接字符串，默认值为 `redis://localhost:6379`。

推荐的方案是通过[快速开始指南](/zh/guide/standalone/)提供的 docker-compose 文件使用 Valkey（一个兼容 Redis 的存储）。

如果多个 Cap 部署（或其他应用）共用同一个 Redis 实例，请设置 `REDIS_PREFIX` 为所有键添加命名空间。比如 `REDIS_PREFIX=cap:` 会把会话存为 `cap:session:...`、指标存为 `cap:metrics:...` 等。默认值为空，因此现有部署不受影响。

## 健康检查与关闭 {#health-checks-and-shutdown}

Cap Standalone 提供两个无需认证的端点，供编排系统和可用性监控使用：

- `GET /health`：Redis 在 2 秒内响应 `PING` 时返回 `200 {"status":"ok"}`，否则返回 `503 {"status":"unavailable"}`。可用于就绪检查和告警。
- `GET /health/live`：只要进程在运行就返回 `200`，即使 Redis 已宕机。可用于存活检查，避免编排系统在 Redis 故障期间反复重启 Cap。

同一秒内到达的检查共享同一次 `PING`，所以轮询 `/health` 不会给 Redis 增加负担。

在 Kubernetes 中：

```yaml
readinessProbe:
  httpGet:
    path: /health
    port: 3000
livenessProbe:
  httpGet:
    path: /health/live
    port: 3000
```

使用 Docker Compose 时，把下面的配置加到 `cap` 服务里。单独使用 Docker 时，它只会把容器标记为 unhealthy，不会自动重启。

```yaml
healthcheck:
  test: ["CMD", "bun", "-e", "fetch('http://127.0.0.1:3000/health').then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"]
  interval: 30s
  timeout: 5s
  retries: 3
```

收到 `SIGTERM` 或 `SIGINT` 后，Cap 会停止接受新连接，等正在处理的请求完成，关闭 Redis 连接，然后以退出码 0 退出。如果 8 秒后仍有请求在运行，Cap 会以退出码 1 直接退出，这样总能在 Docker 默认的 10 秒停止超时之内结束。再收到一次信号会立即退出。

## 错误信息

错误信息默认会被隐去，转而输出到控制台日志。要禁用错误日志，设置 `DISABLE_ERROR_LOGGING=true`；要禁用错误信息隐去，设置 `SHOW_ERRORS=true`。

## HashWX 工作量证明 {#hashwx-proof-of-work}

Standalone 把抗 GPU 的工作量证明 [HashWX](../hashwx.md) 作为新建密钥的默认质询协议。它按站点密钥配置，因此个别密钥可以用 SHA-256，其余的继续留在 HashWX 上。在 HashWX 成为默认之前创建的密钥会保持原有设置，直到你手动更改。

要更换协议，打开某个密钥的 **Configuration** 标签页，在 **Challenge protocol** 下选择一个。HashWX 不需要任何准备工作：没有密钥对要生成，也没有东西要持久化。

难度由 **HashWX difficulty** 滑块控制，也就是客户端预期要计算的哈希次数。默认值为 `1_000_000`，拆分为四个子质询，在 8 核台式机的 Chrome 上测得中位数为 578 毫秒，在手机上为 1.1 到 5.9 秒。调高之前请先看看[手机上的测量结果](../hashwx.md#phones)。有效范围为 `50_000`-`5_000_000`。

没有 WebAssembly 的客户端解不了 HashWX。如果你需要支持它们，请把那个密钥改用 SHA-256 工作量证明，它有纯 JS 的回退方案。

RSW 时间锁谜题对现有部署仍然可选，但已被弃用：GPU 每秒能清掉的数量大约是 CPU 的 170 倍，所以它并没有带来当初引入时想要的抗 GPU 能力。**RSW difficulty** 滑块设置的是 `t`，即顺序平方的次数，范围为 `10_000`-`300_000`，另外 `RSW_BITS=2048` 可在启动时覆盖模数大小。

::: tip 提示
验证组件会根据传输格式自动识别协议，所以切换密钥是你唯一需要做的改动。在 Standalone 之外，cap-core 的默认仍然是 SHA-256 PoW，除非你手动启用。
:::

## Instrumentation 质询

Cap Standalone 支持 JavaScript instrumentation（浏览器环境检测）质询来对抗工作量证明求解器，还可以选择阻止无头浏览器求解。新建站点密钥时，instrumentation 质询默认开启。

你可以在站点密钥配置中开启或关闭 instrumentation 质询。要阻止无头浏览器，在密钥设置中打开 "Attempt to block headless browsers"。

注意，较高的 instrumentation 级别会显著降低生成吞吐量。除非需要更强的混淆，建议保持在级别 3。如果你觉得级别 3 太慢，级别 1 在单核上要快得多。

## IP 数据库

国家和 ASN 查询可以使用三种提供方之一，在控制台的 `Settings > IP Data > Country & ASN data` 下配置：DB-IP Lite、MaxMind GeoLite2 和 IPInfo 的 API。

对于 DB-IP 和 MaxMind，`.mmdb` 文件会被下载到容器内的 `/usr/src/app/data/`。

### Docker 卷权限

容器以非特权用户 `bun`（UID 1000）运行。如果你把宿主机目录绑定挂载到 `/usr/src/app/data`，该目录必须对 UID 1000 可写，否则下载会失败并报 `EACCES: permission denied`。

```bash
mkdir -p ./cap-data
sudo chown 1000:1000 ./cap-data
```

```yaml
services:
  cap:
    image: tiago2/cap:latest
    volumes:
      - ./cap-data:/usr/src/app/data
    # ...
```

如果你无法在宿主机上更改属主（某些平台如 Coolify 会比较麻烦），最简单的替代方案是：

- 完全不用绑定挂载，让 Docker 自行管理数据目录，镜像已经用正确的属主创建了该目录。
- 用命名卷代替绑定挂载。
- 换用不需要本地文件的 IP 数据提供方。
