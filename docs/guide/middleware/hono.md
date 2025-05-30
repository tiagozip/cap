# Hono checkpoint

## Installation

```bash
bun add @cap.js/checkpoint-hono
```

## Usage

```javascript
import { Hono } from "hono";
import { serveStatic } from "hono/bun";
import { capCheckpoint } from "@cap.js/checkpoint-hono";

const app = new Hono();

app.use(
  "*",
  capCheckpoint({
    token_validity_hours: 32, // how long the token is valid for
    tokens_store_path: ".data/tokensList.json",
    token_size: 16, // token size in bytes
    verification_template_path: join(
      dirname(fileURLToPath(import.meta.url)),
      "./index.html"
    ),
  })
);

app.get("/", (c) => c.text("Hello Hono!"));

export default app;
```

That's it! You can now use the middleware to protect your routes.
