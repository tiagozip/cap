---
description: "Füge einer Elysia-App mit der offiziellen Middleware einen Cap Checkpoint hinzu. Sichere Routen mit dem selbst gehosteten, quelloffenen Proof-of-Work-CAPTCHA in wenigen Zeilen ab."
---

# Elysia-Checkpoint

## Installation

```bash
bun add elysia @cap.js/middleware-elysia
```

> [!NOTE] Das Template muss lediglich ein Widget oder einen versteckten Solver enthalten, der auf die URL `/__cap_clearance` zeigt. Das Beispiel-Template findest du [hier](https://github.com/tiagozip/cap/blob/main/checkpoints/elysia/index.html).

## Verwendung

```javascript
import { Elysia, file } from "elysia";
import { capMiddleware } from "@cap.js/middleware-elysia";

new Elysia()
  .use(
    capMiddleware({
      token_validity_hours: 32, // wie lange das Token gültig ist
      tokens_store_path: ".data/tokensList.json",
      token_size: 16, // Token-Größe in Bytes
      verification_template_path: join(dirname(fileURLToPath(import.meta.url)), "./index.html"),
      scoping: "scoped", // 'global' | 'scoped'
    }),
  )
  .get("/", () => "Hello Elysia!")
  .listen(3000);
```

Das war's! Du kannst die Middleware jetzt nutzen, um deine Routen zu schützen.
