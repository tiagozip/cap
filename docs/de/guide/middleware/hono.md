---
description: "Füge einer Hono-App mit @cap.js/checkpoint-hono einen Cap Checkpoint hinzu. Schütze Routen mit dem selbst gehosteten, quelloffenen Proof-of-Work-CAPTCHA und einem Browser-Check."
---

# Hono-Checkpoint

## Installation

```bash
bun add hono @cap.js/checkpoint-hono
```

## Verwendung

```javascript
import { Hono } from "hono";
import { serveStatic } from "hono/bun";
import { capCheckpoint } from "@cap.js/checkpoint-hono";

const app = new Hono();

app.use(
  "*",
  capCheckpoint({
    token_validity_hours: 32, // wie lange das Token gültig ist
    tokens_store_path: ".data/tokensList.json",
    token_size: 16, // Token-Größe in Bytes
    verification_template_path: join(dirname(fileURLToPath(import.meta.url)), "./index.html"),
  }),
);

app.get("/", (c) => c.text("Hello Hono!"));

export default app;
```

Das war's! Du kannst die Middleware jetzt nutzen, um deine Routen zu schützen.
