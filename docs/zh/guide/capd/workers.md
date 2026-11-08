---
description: "在 Cloudflare Workers 上用 D1 运行 capd：同样的代码、仪表板、站点密钥和 siteverify API，无需运行服务器或容器。"
---

# Cloudflare Workers

Workers 支持目前是**实验性**的。如果你发现了 bug，请[提交报告](https://github.com/tiagozip/cap/issues)。

## 部署

你需要 Node 22 或更高版本、用于构建仪表板的 [Bun](https://bun.sh)，以及一个 Cloudflare 账户。

```bash
git clone https://github.com/tiagozip/cap.git
cd cap/workers && npm install
npm run deploy
npx wrangler secret put ADMIN_KEY
```

`npm run deploy` 会安装 capd 的依赖包、构建仪表板、部署 Worker，然后应用 D1 迁移，因为 `wrangler deploy` 会在第一次运行时创建数据库。`ADMIN_KEY` 是仪表板密码，可以用 `openssl rand -hex 24` 生成。

打开 Wrangler 输出的 `workers.dev` 地址并登录。要在自己的域名上提供服务，请给 Worker 添加一个[自定义域名](https://developers.cloudflare.com/workers/configuration/routing/custom-domains/)。

更新时，拉取仓库并重新运行同样的命令，`secret put` 除外。

## 与 Docker 镜像的区别

- **设置需要几秒钟才能在各处生效。** 每个 isolate 每 10 秒重新加载一次设置，密钥配置和列表缓存 5 秒，siteverify 的 CORS 来源缓存 60 秒。
- **兑换更慢。** 每次 D1 写入都会发往数据库的主区域，而兑换会连续写入多次，所以离主区域较远的访客需要等更久。
- **IP 数据库设置已关闭**，因为 Cloudflare 已经向 Worker 提供了每位访客的国家和 ASN。
- **混淆级别 4 到 10 会跳过压缩步骤**，因为 esbuild 无法在 Worker 中运行。验证组件的求解方式不变。
- **Webhook 会在 1 秒和 5 秒后重试。** 第三次重试在 30 秒后，超出了 Cloudflare 在 Worker 返回响应后留给它的时间，所以通常不会执行。
- **Events 页面的实时模式每 4 秒检查一次新事件。** Docker 镜像通过 WebSocket 推送新事件，而 Worker 没有 Durable Object 就无法把消息分发给多个连接。
- **`/swagger` 上没有 API 文档。** Docker 镜像的文档描述的是同一套 API。
- **无法从 Docker 镜像的数据迁移。** 站点密钥、设置和事件都从空白开始。

D1 会逐条执行同一个数据库的查询，所以访问量大的站点会先超出数据库的能力，远早于 Worker。所有站点密钥合计超过每秒约 50 次求解时，请改用 Docker 镜像。

## 在本地运行

```bash
cd workers && npm install
echo "ADMIN_KEY=$(openssl rand -hex 24)" > .dev.vars
npm run dev
```

`npm run dev` 会构建仪表板，把迁移应用到本地数据库，然后启动 `wrangler dev`。
