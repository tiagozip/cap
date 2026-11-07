---
outline: [2, 3]
description: "Mettez en place Cap, le CAPTCHA open source auto-hébergé, en cinq minutes environ. Lancez le serveur avec Docker ou dans votre propre backend, ajoutez le widget, vérifiez les jetons. Sans Google, sans télémétrie, sans puzzles visuels."
---

# Démarrage rapide

Cap comporte deux parties : un widget, qui s'exécute et résout les défis dans le navigateur du visiteur puis vous remet un jeton, et le serveur, qui émet les défis et vérifie ces jetons.

## Choisir un serveur {#pick-a-server}

- **[Standalone](./standalone/index.md)** est un conteneur Docker avec un tableau de bord, des statistiques et une limitation de débit. Choisissez-le si vous pouvez faire tourner un conteneur. Si vous venez de reCAPTCHA, le `/siteverify` de Standalone accepte le même format de requête, il suffit donc que votre code de vérification utilise le nom d'hôte de votre serveur.

- **La [bibliothèque core](./capjs-core.md)** est un paquet npm minimal qui gère les fonctions de base de Cap. Elle tourne partout où tourne votre code, y compris sur des plateformes serverless comme Workers, et vous stockez les jetons dans votre propre base de données. Elle ne propose en revanche pas de statistiques intégrées.

## 1. Lancer le serveur {#_1-run-the-server}

### Standalone {#standalone}

Enregistrez ceci sous `docker-compose.yml`, ou [déployez avec Railway](https://railway.com/deploy/cap-1?referralCode=93HYBZ&utm_medium=integration&utm_source=template&utm_campaign=generic) :

```yaml
services:
  cap:
    image: tiago2/cap:latest
    ports:
      - "3000:3000"
    environment:
      ADMIN_KEY: change_me_to_something_long
      REDIS_URL: redis://valkey:6379
    depends_on:
      valkey:
        condition: service_healthy
    restart: unless-stopped

  valkey:
    image: valkey/valkey:9-alpine
    volumes:
      - valkey-data:/data
    command: valkey-server --save 60 1 --loglevel warning --maxmemory-policy noeviction
    healthcheck:
      test: ["CMD", "valkey-cli", "ping"]
      interval: 5s
      timeout: 3s
      retries: 5
    restart: unless-stopped

volumes:
  valkey-data:
```

Pensez à changer votre clé admin. Puis démarrez-le :

```bash
docker compose up -d
```

Ouvrez `http://localhost:3000` et connectez-vous avec votre `ADMIN_KEY`, qui est le mot de passe du tableau de bord. Créez une clé de site et copiez à la fois la clé de site et sa clé secrète.

Le widget communique avec ce serveur depuis le navigateur de vos visiteurs, il lui faut donc une URL publique en production. Nous recommandons une solution comme [Tunnels](https://developers.cloudflare.com/tunnel/), mais [la documentation de Standalone](./standalone/index.md) couvre la plupart des autres cas, y compris les reverse proxies.

### Bibliothèque core {#core-library}

Installez-la :

::: code-group

```sh [npm]
npm i capjs-core
```

```sh [pnpm]
pnpm add capjs-core
```

```sh [bun]
bun add capjs-core
```

:::

Ajoutez deux routes sous un préfixe commun. Cet exemple utilise Hono et Redis, mais n'importe quel framework et n'importe quel stockage proposant un « set if missing » atomique conviennent :

```js
import { Hono } from "hono";
import { Redis } from "ioredis";
import { generateChallenge, validateChallenge } from "capjs-core";

const SECRET = process.env.CAP_SECRET;
const redis = new Redis(process.env.REDIS_URL);
const app = new Hono();

app.post("/cap/challenge", async (c) =>
  c.json(await generateChallenge(SECRET, { format: 2, protocols: ["hashwx", "instrumentation"] })),
);

app.post("/cap/redeem", async (c) => {
  const result = await validateChallenge(SECRET, await c.req.json(), {
    consumeNonce: async (sig, ttlMs) =>
      (await redis.set(`cap:nonce:${sig}`, "1", "NX", "PX", ttlMs)) === "OK",
  });
  if (result.success) {
    await redis.set(`cap:token:${result.tokenKey}`, "1", "PX", result.expires - Date.now());
  }
  return c.json(result);
});
```

`CAP_SECRET` signe chaque défi. Choisissez-le long et aléatoire, et utilisez le même dans tous vos processus.

## 2. Ajouter le widget {#_2-add-the-widget}

Chargez le script en épinglant une version issue de la [page des versions](https://github.com/tiagozip/cap/releases) :

```html
<script src="https://cdn.jsdelivr.net/npm/cap-widget@<version>"></script>
```

Placez le widget dans votre formulaire :

```html
<form action="/submit" method="POST">
  <cap-widget data-cap-api-endpoint="https://cap.example.com/<site-key>/"></cap-widget>
  <button type="submit">Submit</button>
</form>
```

Avec Standalone, le point d'accès est `https://<your-instance>/<site-key>/`. Avec la bibliothèque core, c'est le préfixe de vos routes, par exemple `/cap/`.

Quand le visiteur résout le défi, le widget ajoute un champ caché `cap-token` au formulaire. En dehors d'un formulaire, écoutez plutôt l'événement `solve` :

```js
document.querySelector("cap-widget").addEventListener("solve", (e) => {
  const token = e.detail.token;
});
```

La [page du widget](./widget.md) contient des extraits pour React, Vue, Svelte et d'autres frameworks.

## 3. Vérifier le jeton {#_3-verify-the-token}

Avant de faire confiance à une soumission, vérifiez son jeton sur votre serveur.

### Standalone {#standalone-1}

Envoyez le jeton à `/siteverify` :

::: code-group

```js [fetch]
const res = await fetch("https://cap.example.com/<site-key>/siteverify", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ secret: "<secret>", response: token }),
});
const { success } = await res.json();
```

```py [python]
import requests

success = requests.post(
    "https://cap.example.com/<site-key>/siteverify",
    json={"secret": "<secret>", "response": token},
).json()["success"]
```

```php [php]
$res = file_get_contents("https://cap.example.com/<site-key>/siteverify", false, stream_context_create([
  "http" => [
    "method" => "POST",
    "header" => "Content-Type: application/json",
    "content" => json_encode(["secret" => "<secret>", "response" => $token]),
  ],
]));
$success = json_decode($res, true)["success"] ?? false;
```

```sh [curl]
curl -X POST "https://cap.example.com/<site-key>/siteverify" \
  -H "Content-Type: application/json" \
  -d '{"secret": "<secret>", "response": "<token>"}'
```

:::

`<secret>` est la clé secrète de la clé de site, pas votre `ADMIN_KEY`. Confondre les deux est l'erreur d'installation la plus fréquente.

Un jeton valide renvoie `{ "success": true }`. Chaque jeton ne fonctionne qu'une fois, donc une seconde vérification du même jeton échoue. L'envoyer deux fois permet de tester rapidement l'installation de bout en bout.

### Bibliothèque core {#core-library-1}

Cherchez le jeton dans le stockage où votre route de rachat l'a écrit, puis supprimez-le pour qu'il ne puisse pas servir deux fois :

```js
import { createHash } from "node:crypto";

app.post("/submit", async (c) => {
  const [id, secret] = String((await c.req.parseBody())["cap-token"] ?? "").split(":");
  const key = `cap:token:${id}:${createHash("sha256")
    .update(secret ?? "")
    .digest("hex")}`;

  if ((await redis.del(key)) !== 1) {
    return c.text("invalid captcha", 403);
  }
});
```

## Étapes suivantes {#next-steps}

- [Personnaliser le widget](./widget.md#attributes) : ses libellés, sa langue et son style
- [Configurer Standalone](./standalone/options.md) : CORS, limites de débit et serveur d'assets
- Lire la [référence de la bibliothèque core](./capjs-core.md)
- Lire [comment fonctionne Cap](./workings.md)
