---
outline: [2, 3]
description: "Richte Cap, das quelloffene, selbst gehostete CAPTCHA, in rund fünf Minuten ein. Starte den Server mit Docker oder in deinem eigenen Backend, bau das Widget ein und verifiziere Tokens. Kein Google, keine Telemetrie, keine Bilderrätsel."
---

# Schnellstart

Cap besteht aus zwei Teilen. Das Widget läuft im Browser deiner Besucher, löst dort Challenges und gibt dir ein Token. Der Server, capd, stellt Challenges aus und verifiziert diese Tokens.

## 1. capd einrichten {#_1-set-up-capd}

Als Erstes richtest du capd ein. Es läuft als selbst gehosteter Server mit Dashboard, Analytics, Regeln und einer API. Keys und Einstellungen liegen in Valkey. Vor dem Start triffst du zwei Entscheidungen:

**1. Wo capd läuft:** Du kannst es mit Docker auf deinem eigenen Server betreiben, [Railway](https://railway.com/deploy/cap-1?referralCode=93HYBZ&utm_medium=integration&utm_source=template&utm_campaign=generic) nutzen oder eine Serverless-Plattform wie [Workers](./capd/workers.md) verwenden. Diese Anleitung zeigt dir den Weg mit Docker.

**2. Wo die Analytics gespeichert werden:** Du kannst DuckDB nutzen, das leichtgewichtig ist und sich am besten für kleine Websites eignet, oder ClickHouse, das besser skaliert. Beide sind eingebaut und schnell eingerichtet.

::: code-group

```bash [DuckDB]
curl -fsSLo docker-compose.yml https://raw.githubusercontent.com/tiagozip/cap/main/capd/docker-compose.duckdb.yml
echo "ADMIN_KEY=$(openssl rand -hex 24)" > .env
docker compose up -d
```

```bash [ClickHouse]
curl -fsSLo docker-compose.yml https://raw.githubusercontent.com/tiagozip/cap/main/capd/docker-compose.yml
echo "ADMIN_KEY=$(openssl rand -hex 24)" > .env
docker compose up -d
```

:::

Öffne `http://localhost:3000` und melde dich mit dem `ADMIN_KEY` aus `.env` an, das ist das Passwort fürs Dashboard. Lege einen Site-Key an und kopiere den Site-Key und sein Secret.

Das Widget spricht aus den Browsern deiner Besucher mit diesem Server, also braucht er in Produktion eine öffentliche URL. Wir empfehlen etwas wie [Tunnels](https://developers.cloudflare.com/tunnel/), aber [die capd-Doku](./capd/index.md) deckt die meisten anderen Fälle ab, auch Reverse Proxies.

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

Der Endpunkt ist `https://<your-instance>/<site-key>/`.

Sobald der Besucher die Challenge gelöst hat, fügt das Widget dem Formular ein verstecktes Feld `cap-token` hinzu. Außerhalb eines Formulars lauschst du stattdessen auf das `solve`-Event:

```js
document.querySelector("cap-widget").addEventListener("solve", (e) => {
  const token = e.detail.token;
});
```

Auf der [Widget-Seite](./widget.md) findest du Snippets für React, Vue, Svelte und andere Frameworks.

## 3. Das Token verifizieren {#_3-verify-the-token}

Bevor du einer Übermittlung traust, schick ihr Token von deinem Server an `/siteverify`:

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

Falls du von reCAPTCHA wechselst, akzeptiert `/siteverify` dasselbe Anfrageformat, also musst du in deinem Verifizierungscode nur den Hostnamen auf deinen Server ändern.

Ein gültiges Token liefert `{ "success": true }`. Jedes Token funktioniert nur einmal, eine zweite Verifizierung desselben Tokens schlägt also fehl. Wenn du es zweimal schickst, kannst du das Setup schnell von Anfang bis Ende prüfen.

## Stattdessen die Core-Bibliothek nutzen {#using-the-core-library-instead}

Wenn du Challenges lieber in deinem eigenen Backend ausstellen und prüfen willst, ist die [Core-Bibliothek](./capjs-core.md) ein minimales npm-Paket, das genau das und sonst nichts macht. Die Tokens speicherst du in deiner eigenen Datenbank, und Dashboard, Analytics und Rate Limiting fallen weg.

## Nächste Schritte {#next-steps}

- [Das Widget anpassen](./widget.md#attributes): Beschriftungen, Sprache und Styling
- [capd konfigurieren](./capd/options.md): Proxys, Widget-Dateien und die API
- Die [Referenz der Core-Bibliothek](./capjs-core.md) lesen
- Lesen, [wie Cap funktioniert](./workings.md)
