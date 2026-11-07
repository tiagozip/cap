---
outline: [2, 3]
description: "Richte Cap, das quelloffene, selbst gehostete CAPTCHA, in rund fünf Minuten ein. Starte den Server mit Docker oder in deinem eigenen Backend, bau das Widget ein und verifiziere Tokens. Kein Google, keine Telemetrie, keine Bilderrätsel."
---

# Schnellstart

Cap besteht aus zwei Teilen. Das Widget läuft im Browser deiner Besucher, löst dort Challenges und gibt dir ein Token. Der Server stellt Challenges aus und verifiziert diese Tokens.

## Server wählen {#pick-a-server}

- **[Standalone](./standalone/index.md)** ist ein Docker-Container mit Dashboard, Analytics und Rate Limiting. Nimm ihn, wenn du einen Container betreiben kannst. Falls du von reCAPTCHA wechselst: Der `/siteverify`-Endpunkt von Standalone akzeptiert dasselbe Anfrageformat, also musst du in deinem Verifizierungscode nur den Hostnamen auf deinen Server ändern.

- **Die [Core-Bibliothek](./capjs-core.md)** ist ein minimales npm-Paket, das die Grundfunktionen von Cap abdeckt. Sie läuft überall, wo dein Code läuft, auch auf Serverless-Plattformen wie Workers. Die Tokens speicherst du in deiner eigenen Datenbank, eingebaute Analytics gibt es nicht.

## 1. Den Server starten {#_1-run-the-server}

### Standalone {#standalone}

Speichere das hier als `docker-compose.yml` oder [deploye mit Railway](https://railway.com/deploy/cap-1?referralCode=93HYBZ&utm_medium=integration&utm_source=template&utm_campaign=generic):

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

Ändere unbedingt deinen Admin-Key. Dann starte den Container:

```bash
docker compose up -d
```

Öffne `http://localhost:3000` und melde dich mit deinem `ADMIN_KEY` an, das ist das Passwort fürs Dashboard. Lege einen Site-Key an und kopiere den Site-Key und sein Secret.

Das Widget spricht aus den Browsern deiner Besucher mit diesem Server, also braucht er in Produktion eine öffentliche URL. Wir empfehlen etwas wie [Cloudflare Tunnels](https://developers.cloudflare.com/tunnel/), aber [die Standalone-Doku](./standalone/index.md) deckt die meisten anderen Fälle ab, auch Reverse Proxies.

### Core-Bibliothek {#core-library}

Installiere sie:

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

Lege zwei Routen unter einem gemeinsamen Präfix an. Dieses Beispiel nutzt Hono und Redis, aber jedes Framework und jeder Store mit einem atomaren "set if missing" funktioniert:

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

`CAP_SECRET` signiert jede Challenge. Mach es lang und zufällig und nutze in jedem Prozess dasselbe.

## 2. Das Widget einbauen {#_2-add-the-widget}

Lade das Skript und pinne dabei eine Version von der [Releases-Seite](https://github.com/tiagozip/cap/releases):

```html
<script src="https://cdn.jsdelivr.net/npm/cap-widget@<version>"></script>
```

Setz das Widget in dein Formular:

```html
<form action="/submit" method="POST">
  <cap-widget data-cap-api-endpoint="https://cap.example.com/<site-key>/"></cap-widget>
  <button type="submit">Submit</button>
</form>
```

Mit Standalone ist der Endpunkt `https://<your-instance>/<site-key>/`. Mit der Core-Bibliothek ist es dein Routen-Präfix, zum Beispiel `/cap/`.

Sobald der Besucher die Challenge gelöst hat, fügt das Widget dem Formular ein verstecktes Feld `cap-token` hinzu. Außerhalb eines Formulars lauschst du stattdessen auf das `solve`-Event:

```js
document.querySelector("cap-widget").addEventListener("solve", (e) => {
  const token = e.detail.token;
});
```

Auf der [Widget-Seite](./widget.md) findest du Snippets für React, Vue, Svelte und andere Frameworks.

## 3. Das Token verifizieren {#_3-verify-the-token}

Bevor du einer Übermittlung traust, prüf ihr Token auf deinem Server.

### Standalone {#standalone-1}

Schick das Token an `/siteverify`:

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

`<secret>` ist das Secret des Site-Keys, nicht dein `ADMIN_KEY`. Die beiden zu verwechseln ist der häufigste Einrichtungsfehler.

Ein gültiges Token liefert `{ "success": true }`. Jedes Token funktioniert nur einmal, eine zweite Verifizierung desselben Tokens schlägt also fehl. Wenn du es zweimal schickst, kannst du das Setup schnell von Anfang bis Ende prüfen.

### Core-Bibliothek {#core-library-1}

Schlag das Token in dem Store nach, in den deine Redeem-Route geschrieben hat, und lösch es danach, damit es nicht zweimal genutzt werden kann:

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

## Nächste Schritte {#next-steps}

- [Das Widget anpassen](./widget.md#attributes): Beschriftungen, Sprache und Styling
- [Standalone konfigurieren](./standalone/options.md): CORS, Rate Limits und der Asset-Server
- Die [Referenz der Core-Bibliothek](./capjs-core.md) lesen
- Lesen, [wie Cap funktioniert](./workings.md)
