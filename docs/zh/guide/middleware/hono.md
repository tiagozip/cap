---
description: "使用 @cap.js/checkpoint-hono 为 Hono 应用添加 Cap Checkpoint，用自托管、开源的工作量证明 CAPTCHA 和浏览器检查保护你的路由。"
---

# Hono Checkpoint

## 安装

```bash
bun add hono @cap.js/checkpoint-hono
```

## 用法

```javascript
import { Hono } from "hono";
import { serveStatic } from "hono/bun";
import { capCheckpoint } from "@cap.js/checkpoint-hono";

const app = new Hono();

app.use(
  "*",
  capCheckpoint({
    token_validity_hours: 32, // 令牌有效时长
    tokens_store_path: ".data/tokensList.json",
    token_size: 16, // 令牌大小（字节）
    verification_template_path: join(dirname(fileURLToPath(import.meta.url)), "./index.html"),
  }),
);

app.get("/", (c) => c.text("Hello Hono!"));

export default app;
```

就这么简单！现在就可以用这个中间件保护你的路由了。
