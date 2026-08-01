---
description: "Ajoutez un Checkpoint Cap à Express avec @cap.js/checkpoint-express. Protégez vos routes avec le CAPTCHA open source auto-hébergé à preuve de travail et une vérification du navigateur."
---

# Checkpoint Express

## Installation

```bash
bun add express cookie-parser @cap.js/checkpoint-express
```

## Utilisation

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

C'est tout ! Vous pouvez maintenant utiliser le middleware pour protéger vos routes.
