---
description: "Ajoutez un Checkpoint Cap à une application Elysia avec le middleware officiel. Protégez vos routes derrière le CAPTCHA open source auto-hébergé à preuve de travail en quelques lignes."
---

# Checkpoint Elysia

## Installation

```bash
bun add elysia @cap.js/middleware-elysia
```

> [!NOTE] Le template doit simplement contenir un widget ou un solveur masqué pointant vers l'URL `/__cap_clearance`. Le template d'exemple est [ici](https://github.com/tiagozip/cap/blob/main/checkpoints/elysia/index.html).

## Utilisation

```javascript
import { Elysia, file } from "elysia";
import { capMiddleware } from "@cap.js/middleware-elysia";

new Elysia()
  .use(
    capMiddleware({
      token_validity_hours: 32, // durée de validité du jeton
      tokens_store_path: ".data/tokensList.json",
      token_size: 16, // taille du jeton en octets
      verification_template_path: join(dirname(fileURLToPath(import.meta.url)), "./index.html"),
      scoping: "scoped", // 'global' | 'scoped'
    }),
  )
  .get("/", () => "Hello Elysia!")
  .listen(3000);
```

C'est tout ! Vous pouvez maintenant utiliser le middleware pour protéger vos routes.
