---
description: "使用官方中间件为 Elysia 应用添加 Cap Checkpoint，只需几行代码即可让路由受自托管、开源的工作量证明 CAPTCHA 保护。"
---

# Elysia Checkpoint

## 安装

```bash
bun add elysia @cap.js/middleware-elysia
```

> [!NOTE] 模板中只需包含一个指向 `/__cap_clearance` URL 的验证组件或隐藏求解器。示例模板见[这里](https://github.com/tiagozip/cap/blob/main/checkpoints/elysia/index.html)。

## 用法

```javascript
import { Elysia, file } from "elysia";
import { capMiddleware } from "@cap.js/middleware-elysia";

new Elysia()
  .use(
    capMiddleware({
      token_validity_hours: 32, // 令牌有效时长
      tokens_store_path: ".data/tokensList.json",
      token_size: 16, // 令牌大小（字节）
      verification_template_path: join(dirname(fileURLToPath(import.meta.url)), "./index.html"),
      scoping: "scoped", // 'global' | 'scoped'
    }),
  )
  .get("/", () => "Hello Elysia!")
  .listen(3000);
```

就这么简单！现在你就可以使用这个中间件来保护你的路由了。
