---
description: "使用 @cap.js/checkpoint-express 为 Express 添加 Cap Checkpoint，用自托管、开源的工作量证明 CAPTCHA 和浏览器检查保护你的路由。"
---

# Express Checkpoint

## 安装

```bash
bun add express cookie-parser @cap.js/checkpoint-express
```

## 用法

```javascript
import express from "express";
import cookieParser from "cookie-parser";
import path from "path";
import { dirname } from "path";
import { fileURLToPath } from "url";
import { capCheckpoint } from "@cap.js/checkpoint-express";

const app = express();
const __dirname = dirname(fileURLToPath(import.meta.url));

app.use(express.json());
app.use(cookieParser());

app.use(
  capCheckpoint({
    /*
      token_validity_hours: 32,
      tokens_store_path: ".data/tokensList.json",
      token_size: 16,
      verification_template_path: join(__dirname, "./index.html"),
    */
  }),
);

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "success.html"));
});

app.listen(3000, () => {
  console.log(`Server running on http://localhost:3000`);
});
```

就这么简单！现在你就可以使用这个中间件来保护你的路由了。
