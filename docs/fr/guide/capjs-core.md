---
outline: [2, 3, 4]
description: "capjs-core est la bibliothèque serveur sans état de Cap pour générer et vérifier des défis de preuve de travail JWT. Auto-hébergez le CAPTCHA open source sur Workers ou en edge."
---

# Core

Cap inclut une bibliothèque serveur sans état pour générer et vérifier des défis fondés sur des JWT, utilisée en interne par Standalone.

Pour la plupart des utilisateurs, nous recommandons [Cap Standalone](./standalone/index.md), qui tourne sur Docker et embarque tout le nécessaire. Nous ne conseillons d'utiliser directement la bibliothèque core que si vous ne pouvez pas faire tourner Docker, si vous voulez intégrer la génération de défis à un service existant, ou si vous devez déployer dans un environnement sans stockage persistant (Cloudflare Workers, Lambda, fonctions edge).

## Installation

::: code-group

```sh [bun]
bun add capjs-core
```

```sh [npm]
npm i capjs-core
```

```sh [pnpm]
pnpm i capjs-core
```

:::

## Prise en main

```js
import { generateChallenge, validateChallenge } from "capjs-core";

// Long, aléatoire, à forte entropie. Gardez-le identique entre les processus.
const SECRET = process.env.CAP_SECRET;

// 1) Route serveur : créer un défi
const ch = await generateChallenge(SECRET, {
  scope: "signup", // facultatif
  instrumentation: true, // facultatif, voir plus bas
});
// → { challenge: { c, s, d }, token, expires, instrumentation? }

// 2) Route serveur : valider le défi utilisé
const result = await validateChallenge(
  SECRET,
  {
    token: req.body.token,
    solutions: req.body.solutions,
    instr: req.body.instr,
  },
  {
    scope: "signup",
    consumeNonce: async (sigHex, ttlMs) => myStore.setIfNotExists(`cap:${sigHex}`, 1, ttlMs),
  },
);

if (result.success) {
  // result.token, result.tokenKey, result.expires, result.scope
}
```

Le widget appelle `generateChallenge` pour recevoir `{ challenge, token, expires, instrumentation }`, résout la preuve de travail côté client, puis renvoie `{ token, solutions, instr }` en POST. Vous appelez ensuite `validateChallenge` pour vérifier.

## Différences avec `@cap.js/server` {#how-it-differs-from-cap-js-server}

| Aspect               | `@cap.js/server`                              | `capjs-core`                                     |
| -------------------- | --------------------------------------------- | ------------------------------------------------ |
| État                 | Stockage de jetons en mémoire et sur disque    | Sans état. Les jetons de défi sont des JWT signés |
| Constructeur         | `new Cap({ ... })`                             | Aucun — passez `secret` à chaque appel           |
| Anti-rejeu           | Liste de jetons intégrée avec nettoyage périodique | Optionnel via le callback `consumeNonce`     |
| Hooks de nettoyage   | Vidage sur `SIGINT`/`beforeExit`               | Aucun — la TTL est encodée dans le `exp` du JWT  |
| Système de fichiers  | Requis pour la persistance                     | Jamais touché                                    |
| Compatible Workers   | Non (système de fichiers)                      | Oui                                              |

Contrairement à l'ancienne bibliothèque, `capjs-core` ne valide pas les jetons d'échange à votre place : elle renvoie un `tokenKey` que vous stockez vous-même, et un `token` que vous donnez à l'utilisateur. Pour valider plus tard, re-dérivez la clé depuis le jeton soumis et cherchez-la :

```js
import { createHash } from "node:crypto";

// Route de validation
const [id, verToken] = req.body.token.split(":");
const tokenKey = `${id}:${createHash("sha256").update(verToken).digest("hex")}`;
const expires = await myStore.get(`cap-token:${tokenKey}`);
if (!expires || Number(expires) < Date.now()) {
  return res.status(401).end();
}
```

## API

### `generateChallenge(secret, opts?)`

Renvoie `Promise<{ challenge, token, expires, instrumentation? }>`.

- `secret` — chaîne ou Buffer, ≥16 octets. Clé HMAC maîtresse, doit être identique entre les processus.
- `opts.challengeCount` — nombre de puzzles de preuve de travail. Par défaut `50`.
- `opts.challengeSize` — longueur du sel en caractères hexadécimaux. Par défaut `32`.
- `opts.challengeDifficulty` — longueur du préfixe cible en caractères hexadécimaux. Par défaut `4`.
- `opts.expiresMs` — TTL du défi. Par défaut `600_000` (10 min).
- `opts.scope` — chaîne facultative liée au défi. La validation doit passer le même `scope`.
- `opts.extra` — objet facultatif intégré à la charge utile du JWT (visible par quiconque détient le jeton).
- `opts.instrumentation` — `true` pour les valeurs par défaut, ou un objet : `{ blockAutomatedBrowsers, obfuscationLevel }`.
- `opts.instrumentationGenerator` — porte de sortie pour déléguer la génération du script à un pool de workers.

Le `token` est un JWT signé contenant la configuration du défi. `expires` est l'expiration du JWT en ms. `instrumentation`, s'il est demandé, est le script client encodé en deflate+base64 que le widget doit exécuter.

### `validateChallenge(secret, body, opts?)`

Renvoie `Promise<{ success: true, token, tokenKey, expires, scope, iat } | { success: false, reason, instr_error? }>`.

`body` :

- `token` — jeton de défi issu de `generateChallenge`
- `solutions` — tableau de nombres, sa longueur doit être égale à `challenge.c`
- `instr` — résultat d'instrumentation (si vous l'avez activée)
- `instr_blocked`, `instr_timeout` — drapeaux envoyés par le widget quand l'instrumentation a rejeté la page

`opts` :

- `scope` — doit correspondre au scope du défi d'origine
- `tokenTtlMs` — TTL du jeton d'échange. Par défaut `1_200_000` (20 min).
- `consumeNonce(sigHex, ttlMs)` — anti-rejeu via votre stockage. Voir plus bas.
- `signToken(data)` — fonction asynchrone renvoyant un format de jeton d'échange personnalisé. Par défaut `id:secret`.

#### Motifs d'échec

| `reason`            | signification                                                  |
| ------------------- | -------------------------------------------------------------- |
| `invalid_body`      | le corps n'est pas un objet                                    |
| `missing_token`     | aucun jeton fourni                                             |
| `missing_solutions` | solutions absentes ou pas sous forme de tableau                |
| `invalid_token`     | signature JWT invalide / mal formé / paramètres hors bornes    |
| `scope_mismatch`    | le scope du jeton ne correspond pas à `opts.scope`             |
| `expired`           | JWT de défi expiré                                             |
| `invalid_solutions` | longueur incorrecte ou valeurs non numériques                  |
| `nonce_store_error` | le callback `consumeNonce` a levé une erreur                   |
| `already_redeemed`  | `consumeNonce` a renvoyé `false`                               |
| `invalid_solution`  | les solutions ne satisfont pas la preuve de travail            |
| `instr_*`           | échec de l'instrumentation (avec `instr_error: true`)          |

## Anti-rejeu

La bibliothèque est sans état par conception. Pour empêcher qu'une soumission interceptée soit utilisée deux fois, passez un callback `consumeNonce`. `capjs-core` l'appelle avec la signature hexadécimale du JWT et la TTL restante ; vous stockez cet hexadécimal dans votre KV avec une sémantique `SET NX EX` et renvoyez `false` en cas de répétition.

::: code-group

```js [redis]
import { Redis } from "ioredis";
const redis = new Redis(process.env.REDIS_URL);

const consumeNonce = async (sigHex, ttlMs) => {
  const ttlSec = Math.ceil(ttlMs / 1000);
  const ok = await redis.set(`cap:${sigHex}`, "1", "NX", "EX", ttlSec);
  return ok === "OK";
};
```

```js [cloudflare-kv]
const consumeNonce = async (sigHex, ttlMs) => {
  const key = `cap:${sigHex}`;
  if (await env.NONCES.get(key)) return false;
  await env.NONCES.put(key, "1", {
    expirationTtl: Math.ceil(ttlMs / 1000),
  });
  return true;
};
```

```js [postgres]
const consumeNonce = async (sigHex, ttlMs) => {
  const expiresAt = new Date(Date.now() + ttlMs).toISOString();
  try {
    await db`INSERT INTO cap_nonces (sig, expires_at) VALUES (${sigHex}, ${expiresAt})`;
    return true;
  } catch (e) {
    if (e.code === "23505") return false; // unique violation
    throw e;
  }
};
```

:::

La vérification a lieu _après_ celle de la preuve de travail et de l'instrumentation : un attaquant qui rejoue une soumission interceptée avec des solutions bidon ne peut donc pas brûler le nonce de l'utilisateur légitime.

## Instrumentation

Passez `instrumentation: true` (ou un objet d'options) à `generateChallenge` pour recevoir un script client encodé en deflate+base64. Le widget l'exécute, renvoie une empreinte, et `validateChallenge` la vérifie.

```js
const ch = await generateChallenge(SECRET, {
  instrumentation: {
    blockAutomatedBrowsers: true, // rejeter playwright/puppeteer/selenium
    obfuscationLevel: 3, // 1-10, par défaut 3
  },
});
```

Quand `blockAutomatedBrowsers` est activé, le script exécute des contrôles d'évasion de realm et des contrôles comportementaux qui détectent Chromium headless, les marqueurs de frameworks d'automatisation et l'usurpation de bac à sable JS. Voir [Instrumentation](./instrumentation.md) pour les détails.

Les niveaux d'obfuscation élevés sont plus lents à générer. Les niveaux 4 à 7 ajoutent une indirection par table de chaînes maison ainsi qu'une minification esbuild. Les niveaux 8 à 10 superposent `javascript-obfuscator` (tableau de chaînes, aplatissement du flux de contrôle, injection de code mort) : ils bloquent la boucle d'événements pendant des dizaines de millisecondes par défi, réservez-les donc aux routes à faible volume ou fournissez votre propre `instrumentationGenerator` s'exécutant dans un pool de workers.

## Modèles de déploiement sans état

**Avertissement :** ces scripts n'incluent pas de protection anti-rejeu. Pensez à l'ajouter vous-même.

### Cloudflare Workers

```js
import { generateChallenge, validateChallenge } from "capjs-core";

const SECRET = (env) => env.CAP_SECRET;

export default {
  async fetch(req, env) {
    const url = new URL(req.url);

    if (url.pathname === "/challenge" && req.method === "POST") {
      const ch = await generateChallenge(SECRET(env), { instrumentation: true });
      return Response.json(ch);
    }

    if (url.pathname === "/redeem" && req.method === "POST") {
      const body = await req.json();
      const result = await validateChallenge(SECRET(env), body, {
        consumeNonce: async (sigHex, ttlMs) => {
          if (await env.NONCES.get(`cap:${sigHex}`)) return false;
          await env.NONCES.put(`cap:${sigHex}`, "1", {
            expirationTtl: Math.ceil(ttlMs / 1000),
          });
          return true;
        },
      });
      return Response.json(result);
    }

    return new Response("not found", { status: 404 });
  },
};
```

### Bun

```js
import { generateChallenge, validateChallenge } from "capjs-core";
const SECRET = process.env.CAP_SECRET;

Bun.serve({
  port: 3000,
  routes: {
    "/challenge": {
      POST: () => Response.json(generateChallenge(SECRET, { instrumentation: true })),
    },
    "/redeem": {
      POST: async (req) => {
        const body = await req.json();
        return Response.json(await validateChallenge(SECRET, body));
      },
    },
  },
});
```

## Défis RSW

Depuis la v0.1.1 et le widget v0.1.51, les deux parties comprennent un format d'échange plus riche, capable de gérer plusieurs protocoles de défi dans une seule réponse : la preuve de travail SHA-256 (par défaut), le nouveau [verrou temporel RSW](./rsw.md) et l'instrumentation.

### Activation minimale {#format-2-rsw-opt-in}

```js
import { generateChallenge, generateRswKeypair, validateChallenge } from "capjs-core";

const SECRET = process.env.CAP_SECRET;
const KEYPAIR = generateRswKeypair(2048); // une fois au démarrage, pensez à le conserver !

app.post("/api/challenge", async () => {
  return await generateChallenge(SECRET, {
    format: 2,
    protocols: ["rsw", "instrumentation"],
    keypair: KEYPAIR,
    t: 75_000, // facultatif. nous recommandons de le laisser à 75_000
  });
});

app.post("/api/redeem", async (req) => {
  return await validateChallenge(SECRET, req.body, { consumeNonce });
});
```
