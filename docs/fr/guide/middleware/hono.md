---
description: "Ajoutez un Checkpoint Cap à une application Hono avec @cap.js/checkpoint-hono. Protégez vos routes avec le CAPTCHA open source auto-hébergé à preuve de travail et une vérification du navigateur."
---

# Checkpoint Hono

## Installation

```bash
bun add hono @cap.js/checkpoint-hono
```

## Utilisation

```javascript
import { Hono } from "hono";
import { serveStatic } from "hono/bun";
import { capCheckpoint } from "@cap.js/checkpoint-hono";

const app = new Hono();

app.use(
  "*",
  capCheckpoint({
    token_validity_hours: 32, // durée de validité du jeton
    tokens_store_path: ".data/tokensList.json",
    token_size: 16, // taille du jeton en octets
    verification_template_path: join(dirname(fileURLToPath(import.meta.url)), "./index.html"),
  }),
);

app.get("/", (c) => c.text("Hello Hono!"));

export default app;
```

C'est tout ! Vous pouvez maintenant utiliser le middleware pour protéger vos routes.
