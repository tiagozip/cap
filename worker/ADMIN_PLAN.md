# 多站点 + 后台管理 计划（草案）

目标：在 `verify.rakko.cn` 上加一个 `/admin` 后台，用 Priestess SSO 登录后可以新建站点、管理每个站点允许的域名、轮换 secret、调难度；
其他网站用自己的 site key 接入，互相隔离。现有 `/challenge` `/redeem` `/siteverify` 和展示页行为不变。

## 0. 登录：Priestess SSO（经 Phainon）

后台不自己管账号密码，登录全部交给 Priestess；worker 自己就是后端，所以按 RakkoPresenter 的做法走 **Priestess 原生流**，
token 交换和 `/me` 校验都在服务端完成，浏览器拿不到 Priestess 的 token。

**Phainon 侧**：2026-10-14 Rakko 已在 Phainon 管理台建好 APP `priestess-verification`
（PKCE S256 required；allowed origin `https://verify.rakko.cn`；return URL `https://verify.rakko.cn/admin/callback`），
不需要再写 migration。它的 Default access 现在是 **Open**：worker 侧还有 `ADMIN_ALLOWED_SUBS` 把关，
所以不会放进陌生人，但建议在 Phainon 的 Access 页把它切成默认关闭，两道门都关上。

**worker 侧**：新增 `vars.PRIESTESS_API_BASE = "https://api.rakko.cn/auth/priestess/oidc"`、`vars.PRIESTESS_APP_ID = "priestess-verification"`、
`vars.ADMIN_ALLOWED_SUBS = "plu_UUHsG7WuUqDXh4R6"`（逗号分隔；为空时一律拒绝，不做“空 = 全放行”）。不需要新 secret。

## 1. 数据：新 Durable Object `SiteRegistry`（单实例，SQLite）

```sql
sites(site_key TEXT PRIMARY KEY,      -- 10 位 hex，和上游 standalone 一致
      name TEXT NOT NULL,
      secret_hash TEXT NOT NULL,      -- siteverify secret 的 sha256，明文只在创建/轮换时显示一次
      origins TEXT NOT NULL,          -- JSON 数组，裸 origin
      settings TEXT NOT NULL,         -- JSON：difficulty/count/size/protocols 等，缺省继承全局 vars
      enabled INTEGER NOT NULL DEFAULT 1,
      created_at INTEGER, updated_at INTEGER) WITHOUT ROWID;
admin_sessions(id_hash TEXT PRIMARY KEY, sub TEXT, expires INTEGER) WITHOUT ROWID;
```

`wrangler.jsonc` 加 binding `SITE_REGISTRY` 和 migration `{ "tag": "v2", "new_sqlite_classes": ["SiteRegistry"] }`。
`TokenStore` 不动。

## 2. 站点 API（给其他网站用）

路由沿用上游 standalone 的形状，上游文档和 dashboard 片段可以直接套用：

| 路由 | 说明 |
| --- | --- |
| `POST /<siteKey>/challenge` | 用该站点的设置出题，scope = `site:<siteKey>` |
| `POST /<siteKey>/redeem` | 同上，token 存储键 = `<signature>@<siteKey>` |
| `POST /<siteKey>/siteverify` | `{ secret, response }`，secret 和该站点的哈希比对 |

- **隔离**：challenge JWT 带站点 scope（capjs-core 已有 `scope` 选项），存储键带站点后缀，A 站的 token 拿到 B 站校验必失败。
- **分片**：键用后缀而不是前缀，首字符仍是签名的 hex，分片保持均匀。
  （顺带发现：现有 `demo:` 前缀让所有 demo token 都落在 `'d'` → shard-1，这次一起改成后缀。）
- **CORS**：`/<siteKey>/challenge|redeem` 的预检和响应按该站点的 `origins` 放行；`siteverify` 不发 CORS 头。
- **配置缓存**：isolate 内存里缓存站点配置 30 秒（找不到的 key 也缓存 30 秒，并先校验格式），
  命中缓存时不访问 DO；未命中时多一次只读 DO 请求，**不产生 rows written**。后台改动最长 30 秒生效。
- **旧路由**：`/challenge` `/redeem` `/siteverify` 继续走 env 里的 `CAP_SECRET` / `SITEVERIFY_SECRET` / `ALLOWED_ORIGINS`，
  `verify.rakko.cn` 和已经接入的地方不受影响。
- **静态资源**（`widget.js`、wasm、pako）改成 `Access-Control-Allow-Origin: *`：本来就是公开文件（jsDelivr 上也有），
  否则每加一个站点都要同步全局白名单。这是一个行为变更，需要你点头。

## 3. 后台登录流程

1. `GET /admin`：没有 session 就显示登录页，只有一个“用 Priestess 登录”按钮。
2. `GET /admin/login`：生成 `state` 和 PKCE `code_verifier`，存进 10 分钟有效的 cookie `__Host-pv_oauth`
   （HttpOnly; Secure; SameSite=Lax，用 `CAP_SECRET` 派生的 HMAC 签名），再跳到
   `<PRIESTESS_API_BASE>/login?app_id=…&return_to=https://verify.rakko.cn/admin/callback&state=…&code_challenge=…&code_challenge_method=S256`。
3. `GET /admin/callback`：Priestess 把 `login_code` 放在 `#hash` 里，服务端看不到，所以这个页面只带一小段脚本：
   读出 hash，立刻清掉，然后同源 `POST /admin/api/session { login_code, state }`。hash 里有 `auth_error` 时直接显示错误，
   `app_access_denied` 显示“你没有这个后台的权限”，不能回到登录页死循环。
4. `POST /admin/api/session`：
   - 校验 `state` 和 cookie 一致，并立刻作废这个 cookie（一次性）；
   - 服务端 `POST /exchange { login_code, code_verifier }`（服务端请求不带 `Origin`，不受 allowed_origins 限制）；
   - 用 access token 调 `/me`，要求 `app_id` 对得上，并且 `user.sub` 在 `ADMIN_ALLOWED_SUBS` 里（在 Priestess 访问控制之外再加一道放行）；
   - 立刻用 refresh token 调 `/logout`，worker 不保存任何 Priestess token；
   - 发自己的 session cookie `__Host-pv_admin`（HttpOnly; Secure; SameSite=Strict; Path=/），32 字节随机 id，DO 里只存它的哈希，**8 小时**过期。
5. `POST /admin/api/logout`：删除 session。

代价：在 Priestess 里撤销权限后，已经登录的后台 session 最长还能用 8 小时。
要做到立即生效，就得保存 refresh token 并定期复核，v1 不做；需要时可以把 `ADMIN_ALLOWED_SUBS` 清空再部署，作为紧急停用。

- **CSRF**：SameSite=Strict，并且所有写操作要求 `Origin` 等于本站、`Content-Type: application/json`。
- `/admin*` 一律 `Cache-Control: no-store`，加 `X-Frame-Options: DENY` 和严格 CSP（`connect-src 'self'`，因为 token 交换在服务端）。

## 4. 管理 API（全部需要 session）

| 路由 | 说明 |
| --- | --- |
| `GET /admin/api/sites` | 站点列表（不含 secret） |
| `POST /admin/api/sites` | 新建 `{ name, origins }` → 返回 `siteKey` + 一次性明文 `secret` |
| `PATCH /admin/api/sites/<key>` | 改名称 / origins / settings / 启用开关 |
| `POST /admin/api/sites/<key>/rotate` | 轮换 secret，返回新明文一次 |
| `DELETE /admin/api/sites/<key>` | 删除站点（已签发的 token 随之失效） |

origins 校验复用 `parseAllowedOrigins` 的规则（必须是裸 origin，只允许 https，开发时允许 `http://localhost:*`）。

## 5. 后台页面

- 站点卡片列表：名称、site key、域名、启用状态。
- 新建 / 编辑对话框：域名可以逐条增删，难度等高级设置折叠起来。
- 创建和轮换后弹出 secret（只显示一次，带复制按钮），并给出完整接入代码：前端 `<script>` + `<cap-widget data-cap-api-endpoint="https://verify.rakko.cn/<siteKey>/">`，以及后端 siteverify 的 fetch 示例。
- 右上角显示当前登录的 Priestess 账号和退出按钮。
- Rakko Design 规则：只用 vendored tokens/primitive；缺的组件（对话框、开关）记下来，改上游再 sync，不在这里 fork。

## 6. 测试与验收

- vitest（`@cloudflare/vitest-pool-workers`）：
  - 登录（用 mock 的 Priestess 端点）：state 不匹配 / 被重放、PKCE verifier 正确传递、`/me` 的 sub 不在白名单、
    `ADMIN_ALLOWED_SUBS` 为空时拒绝、exchange 失败、成功后调用了 `/logout`、cookie 属性、session 过期、跨源 POST 被拒；
  - 站点增删改、secret 只出现一次、轮换后旧 secret 失效；
  - 每站点的 challenge → redeem → siteverify 全流程；**A 站 token 在 B 站失败**；
  - 未知 / 停用的 site key 返回 404，并且被负缓存；
  - 旧路由和展示页回归测试保持全绿。
- `scripts/acceptance.mjs` 加一个站点流程；`scripts/browser-e2e.mjs` 加后台流程（本地用 mock Priestess）+ 新建站点 + 外站接入的真浏览器测试（仍然要求不访问 jsDelivr）。
- `node scripts/check-design.mjs` 覆盖后台页面。
- README 更新：后台用法、新路由、部署步骤；修掉 `your-site-key/` 的误导写法。
- 交付前另起子 agent 做一次只查 P0 的反方审查。

## 7. 部署顺序（公网操作，Rakko 点头后再做）

1. Phainon：APP 已建好（见第 0 节），可选：切成默认关闭。
2. PriestessVerification：`cd worker && npx wrangler deploy`（带 v2 migration 和新的 vars）。
3. 浏览器走一遍：登录、新建一个测试站点、在外站页面接入、后端 siteverify 成功。

本地已验证（2026-10-14）：vitest 86 项全绿；`wrangler dev --local-protocol https` + 模拟 Phainon + 无头 Chrome
跑通了登录 → 新建站点 → 外站嵌入组件 → 外站后端 siteverify `success: true` → 退出，全程没有请求外网。

## 8. 免费额度影响

- 旧路由：零变化。
- 站点路由：缓存未命中才多一次 DO 读请求（每个 isolate 每个站点每 30 秒最多一次），rows written 和旧路由相同（每次验证 3 行）。
- 后台：登录 / 改配置是个位数写入，可以忽略。

## 不做（v1）

- 按站点统计图表（每次验证都会多写一行，会把免费额度从约 3.3 万次/天压到约 2.5 万次/天）。
- 保存 Priestess refresh token 来实时复核权限（见第 3 节的代价）。
- 旧 secret 的轮换宽限期。
