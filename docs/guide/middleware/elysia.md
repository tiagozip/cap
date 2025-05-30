# Elysia checkpoint

## Installation

```bash
bun add @cap.js/middleware-elysia
```

## Usage

```javascript
import { Elysia, file } from "elysia";
import { capMiddleware } from "@cap.js/middleware-elysia";

new Elysia()
  .use(
    capMiddleware({
      token_validity_hours: 32, // how long the token is valid for
      tokens_store_path: ".data/tokensList.json",
      token_size: 16, // token size in bytes
      verification_template_path: join(
        dirname(fileURLToPath(import.meta.url)),
        "./index.html"
      ),
      scoping: "scoped", // 'global' | 'scoped'
    })
  )
  .get("/", () => "Hello Elysia!")
  .listen(3000);
```

That's it! You can now use the middleware to protect your routes.