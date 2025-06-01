# Elysia checkpoint

## Installation

```bash
bun add elysia @cap.js/middleware-elysia
```

> [!NOTE]
> The template just needs to have a widget or hidden solver pointing at the `/__cap_clearance` URL. The sample template is [here](https://github.com/tiagorangel1/cap/blob/main/checkpoints/elysia/index.html).

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
