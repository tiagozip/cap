---
outline: [2, 3, 4]
description: "capjs-core ist Caps zustandslose Server-Bibliothek zum Erzeugen und Verifizieren von JWT-Proof-of-Work-Challenges. Hoste das quelloffene CAPTCHA selbst, auf Workers oder am Edge."
---

# Core

Cap enthält eine zustandslose serverseitige Bibliothek zum Erzeugen und Verifizieren JWT-basierter Challenges, die intern auch von Standalone genutzt wird.

Den meisten Nutzern empfehlen wir [Cap Standalone](./standalone/index.md), das auf Docker läuft und alles Nötige mitbringt. Die Core-Bibliothek direkt zu verwenden empfehlen wir nur, wenn du Docker nicht betreiben kannst, die Challenge-Erzeugung in einen bestehenden Dienst einbetten willst oder in eine Umgebung ohne persistenten Speicher deployen musst (Cloudflare Workers, Lambda, Edge Functions).

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

## Erste Schritte

```js
import { generateChallenge, validateChallenge } from "capjs-core";

// Lang, zufällig, hohe Entropie. Halte das über alle Prozesse hinweg konsistent.
const SECRET = process.env.CAP_SECRET;

// 1) Server-Route: eine Challenge erzeugen
const ch = await generateChallenge(SECRET, {
  scope: "signup", // optional
  instrumentation: true, // optional, siehe unten
});
// → { challenge: { c, s, d }, token, expires, instrumentation? }

// 2) Server-Route: die eingelöste Challenge validieren
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

Das Widget ruft `generateChallenge` auf, erhält `{ challenge, token, expires, instrumentation }`, löst den Proof-of-Work clientseitig und schickt `{ token, solutions, instr }` per POST zurück. Anschließend rufst du `validateChallenge` zur Prüfung auf.

## Unterschiede zu `@cap.js/server` {#how-it-differs-from-cap-js-server}

| Aspekt              | `@cap.js/server`                             | `capjs-core`                                     |
| ------------------- | -------------------------------------------- | ------------------------------------------------ |
| State               | In-Memory- plus Dateisystem-Token-Store       | Zustandslos. Challenge-Tokens sind signierte JWTs |
| Konstruktor         | `new Cap({ ... })`                            | Keiner — `secret` pro Aufruf übergeben           |
| Replay-Schutz       | Eingebaute Token-Liste mit Aufräumintervall   | Opt-in über `consumeNonce`-Callback              |
| Cleanup-Hooks       | Flush bei `SIGINT`/`beforeExit`               | Keine — TTL steckt im JWT-`exp`                  |
| Dateisystem         | Für Persistenz erforderlich                   | Wird nie angefasst                               |
| Worker-kompatibel   | Nein (Dateisystem)                            | Ja                                               |

Anders als die alte Bibliothek validiert `capjs-core` Redeem-Tokens nicht für dich: Es liefert einen `tokenKey`, den du selbst speicherst, und ein `token`, das du dem Nutzer gibst. Zum späteren Validieren leitest du den Key aus dem eingereichten Token erneut ab und schlägst ihn nach:

```js
import { createHash } from "node:crypto";

// Validierungs-Route
const [id, verToken] = req.body.token.split(":");
const tokenKey = `${id}:${createHash("sha256").update(verToken).digest("hex")}`;
const expires = await myStore.get(`cap-token:${tokenKey}`);
if (!expires || Number(expires) < Date.now()) {
  return res.status(401).end();
}
```

## API

### `generateChallenge(secret, opts?)`

Liefert `Promise<{ challenge, token, expires, instrumentation? }>`.

- `secret` — String oder Buffer, ≥16 Bytes. Master-HMAC-Key, muss über alle Prozesse hinweg gleich sein.
- `opts.challengeCount` — Anzahl der PoW-Puzzles. Standard `50`.
- `opts.challengeSize` — Salt-Länge in Hex-Zeichen. Standard `32`.
- `opts.challengeDifficulty` — Länge des Zielpräfixes in Hex-Zeichen. Standard `4`.
- `opts.expiresMs` — TTL der Challenge. Standard `600_000` (10 Min.).
- `opts.scope` — optionaler String, der an die Challenge gebunden wird. Die Validierung muss denselben `scope` übergeben.
- `opts.extra` — optionales Objekt, das in die JWT-Payload eingebettet wird (für jeden mit dem Token sichtbar).
- `opts.instrumentation` — `true` für Standardwerte, oder ein Objekt: `{ blockAutomatedBrowsers, obfuscationLevel }`.
- `opts.instrumentationGenerator` — Notausgang, um die Skripterzeugung an einen Worker-Pool auszulagern.

Das `token` ist ein signiertes JWT mit der Challenge-Konfiguration. `expires` ist der JWT-Ablauf in ms. `instrumentation` ist, falls angefordert, das mit deflate+base64 kodierte Client-Skript, das das Widget ausführt.

### `validateChallenge(secret, body, opts?)`

Liefert `Promise<{ success: true, token, tokenKey, expires, scope, iat } | { success: false, reason, instr_error? }>`.

`body`:

- `token` — Challenge-Token aus `generateChallenge`
- `solutions` — Zahlen-Array, Länge muss `challenge.c` entsprechen
- `instr` — Instrumentation-Ergebnis (falls aktiviert)
- `instr_blocked`, `instr_timeout` — Flags des Widgets, wenn die Instrumentation die Seite abgelehnt hat

`opts`:

- `scope` — muss zum Scope der ursprünglichen Challenge passen
- `tokenTtlMs` — TTL des Redeem-Tokens. Standard `1_200_000` (20 Min.).
- `consumeNonce(sigHex, ttlMs)` — Replay-Schutz über deinen Speicher. Siehe unten.
- `signToken(data)` — asynchrone Funktion, die ein eigenes Redeem-Token-Format liefert. Standardmäßig `id:secret`.

#### Fehlergründe

| `reason`            | Bedeutung                                                       |
| ------------------- | --------------------------------------------------------------- |
| `invalid_body`      | Body ist kein Objekt                                            |
| `missing_token`     | kein Token übergeben                                            |
| `missing_solutions` | Solutions fehlen oder sind kein Array                           |
| `invalid_token`     | JWT-Signatur passt nicht / fehlerhaft / Parameter außerhalb des Bereichs |
| `scope_mismatch`    | Scope des Tokens passt nicht zu `opts.scope`                    |
| `expired`           | Challenge-JWT abgelaufen                                        |
| `invalid_solutions` | Längenkonflikt oder keine Zahlen                                |
| `nonce_store_error` | `consumeNonce`-Callback hat geworfen                            |
| `already_redeemed`  | `consumeNonce` hat `false` geliefert                            |
| `invalid_solution`  | Solutions erfüllen den PoW nicht                                |
| `instr_*`           | Instrumentation fehlgeschlagen (mit `instr_error: true`)        |

## Replay-Schutz

Die Bibliothek ist bewusst zustandslos. Damit eine abgefangene Übermittlung nicht zweimal eingelöst werden kann, übergib einen `consumeNonce`-Callback. `capjs-core` ruft ihn mit dem Signatur-Hex des JWT und der verbleibenden TTL auf; du speicherst dieses Hex in deinem KV mit `SET NX EX`-Semantik und gibst bei Wiederholungen `false` zurück.

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

Die Prüfung läuft _nach_ der PoW- und Instrumentation-Verifizierung. Ein Angreifer, der eine abgefangene Übermittlung mit Unsinn-Solutions wiederholt, kann die Nonce des legitimen Nutzers also nicht verbrennen.

## Instrumentation

Übergib `instrumentation: true` (oder ein Options-Objekt) an `generateChallenge`, um ein mit deflate+base64 kodiertes Client-Skript zu erhalten. Das Widget führt es aus, schickt einen Fingerprint zurück, und `validateChallenge` prüft ihn.

```js
const ch = await generateChallenge(SECRET, {
  instrumentation: {
    blockAutomatedBrowsers: true, // playwright/puppeteer/selenium ablehnen
    obfuscationLevel: 3, // 1-10, Standard 3
  },
});
```

Ist `blockAutomatedBrowsers` aktiv, führt das Skript Realm-Escape- und Verhaltensprüfungen aus, die Headless-Chromium, Marker von Automatisierungs-Frameworks und JS-Sandbox-Imitationen erkennen. Details siehe [Instrumentation](./instrumentation.md).

Höhere Obfuskationsstufen sind langsamer zu erzeugen. Die Stufen 4–7 ergänzen eine eigene String-Table-Indirektion plus esbuild-Minifizierung. Die Stufen 8–10 legen `javascript-obfuscator` obendrauf (String-Array, Control-Flow-Flattening, Dead-Code-Injection). Diese blockieren die Event-Loop pro Challenge um mehrere zehn Millisekunden, nutze sie also nur für Routen mit geringem Volumen oder liefere einen eigenen `instrumentationGenerator`, der in einem Worker-Pool läuft.

## Zustandslose Deployment-Muster

**Warnung:** Diese Skripte enthalten keinen eingebauten Replay-Schutz. Ergänze ihn unbedingt selbst.

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

## RSW-Challenges

Seit v0.1.1 und Widget v0.1.51 verstehen beide Seiten ein reicheres Wire-Format, das mehrere Challenge-Protokolle in einer Antwort unterstützt: SHA-256-PoW (der Standard), das neue [RSW-Time-Lock-Puzzle](./rsw.md) und Instrumentation.

### Minimales Opt-in {#format-2-rsw-opt-in}

```js
import { generateChallenge, generateRswKeypair, validateChallenge } from "capjs-core";

const SECRET = process.env.CAP_SECRET;
const KEYPAIR = generateRswKeypair(2048); // einmal beim Start, unbedingt persistieren!

app.post("/api/challenge", async () => {
  return await generateChallenge(SECRET, {
    format: 2,
    protocols: ["rsw", "instrumentation"],
    keypair: KEYPAIR,
    t: 75_000, // optional. wir empfehlen, es bei 75_000 zu belassen
  });
});

app.post("/api/redeem", async (req) => {
  return await validateChallenge(SECRET, req.body, { consumeNonce });
});
```
