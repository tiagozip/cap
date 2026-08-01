---
outline: deep
description: "Richte Cap, das quelloffene, selbst gehostete CAPTCHA, in rund fünf Minuten ein. Server per Docker starten, Widget einbauen, Tokens verifizieren. Kein Google, keine Telemetrie, keine Bilderrätsel."
---

# Schnellstart

Cap ist ein selbst gehostetes CAPTCHA, das Bilderrätsel durch unsichtbaren Proof-of-Work ersetzt. Deine Nutzer klicken eine Checkbox an, die Arbeit läuft still in ihrem Browser, und keine ihrer Daten verlassen jemals deine Server. Kein Google, keine Telemetrie, keine Gebühren pro Anfrage.

Cap besteht aus zwei Teilen: einem **Widget**, das die Challenge ausführt und die Checkbox zeigt, und einem **Server**, der Challenges ausstellt und Lösungen verifiziert. Beides läuft in etwa fünf Minuten.

**Hier ist das Widget, live:**

<Demo />

::: tip Du nutzt bereits reCAPTCHA?
Caps `/siteverify` ist zur API von reCAPTCHA kompatibel. Du kannst deinen bestehenden Verifizierungscode mit einer einzigen URL-Änderung auf Cap zeigen lassen, beide parallel betreiben und umschalten, wann du bereit bist. Kein Rewrite, kein riskanter Big-Bang-Wechsel. Siehe den [Funktionsvergleich](./alternatives.md).
:::

## Was du brauchst

- [Docker](https://docs.docker.com/get-docker/) (der schnellste Weg, den Server zu betreiben)
- Einen Hosting-Ort, der aus den Browsern deiner Nutzer erreichbar ist
- Ein paar Minuten

## 1. Den Server starten

Wir empfehlen [Cap Standalone](./standalone/index.md), einen einzelnen Container mit einer kleinen REST-API und einem Dashboard zur Key-Verwaltung. Er unterstützt mehrere Site-Keys und ist zur siteverify-API von reCAPTCHA kompatibel.

[![Deploy on Railway](https://railway.com/button.svg)](https://railway.com/deploy/cap-1?referralCode=93HYBZ&utm_medium=integration&utm_source=template&utm_campaign=generic)

Lege eine `docker-compose.yml` an:

```yaml
services:
  cap:
    image: tiago2/cap:latest
    container_name: cap
    ports:
      - "3000:3000"
    environment:
      ADMIN_KEY: your_secret_password
      REDIS_URL: redis://valkey:6379
    depends_on:
      valkey:
        condition: service_healthy
    restart: unless-stopped

  valkey:
    image: valkey/valkey:9-alpine
    container_name: cap-valkey
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

Starte sie:

```bash
docker compose up -d
```

Öffne `http://localhost:3000` (oder die IP bzw. Domain deines Servers auf Port 3000), melde dich mit deinem `ADMIN_KEY` an und lege einen Site-Key an. Du bekommst einen **Site-Key** und einen **Secret-Key**. Behalte beide, du brauchst sie in den nächsten Schritten.

::: tip Tipps

- `ADMIN_KEY` ist dein Dashboard-Passwort. Nimm mindestens 32 Zeichen.
- Ändere `3000:3000`, falls der Port schon belegt ist.
- Ist das Dashboard nicht erreichbar, ergänze `network_mode: "host"` unter dem Service `cap`.
  :::

## 2. Das Widget einbauen

Das Widget ist eine einzelne Web Component. Wenn du keine Versionen pinnen möchtest, ersetze `<version>` durch `latest`.

```html
<script src="https://cdn.jsdelivr.net/npm/cap-widget@<version>"></script>
```

::: tip
Schau im [neuesten Release](https://github.com/tiagozip/cap/releases) nach, welche Version du pinnen solltest. In Setups mit hohen Sicherheitsanforderungen kannst du diese Datei selbst hosten, statt sie vom CDN zu laden.
:::

### Der einfache Weg: ins Formular einsetzen

Liegt dein Widget in einem `<form>`, fügt Cap automatisch ein verstecktes Feld `cap-token` ein und schickt es mit den übrigen Formulardaten mit. Kein JavaScript nötig.

```html
<form action="/submit" method="POST">
  <!-- deine Felder -->
  <cap-widget data-cap-api-endpoint="https://<your-instance>/<site-key>/"></cap-widget>
  <button type="submit">Absenden</button>
</form>
```

- `<your-instance>` ist die öffentliche URL deines Cap-Servers, z. B. `cap.example.com`. Sie muss für deine Besucher erreichbar sein, also nicht `localhost`.
- `<site-key>` ist der Site-Key aus deinem Dashboard.

Beim Absenden erhält dein Server `cap-token` neben den anderen Feldern. Spring zu [Schritt 3](#_3-verify-the-token), um es zu prüfen.

### Mit JavaScript: wenn du Kontrolle brauchst

Für SPAs, eigene Abläufe oder alles, was kein simples Formular ist, lausche auf das `solve`-Event:

```js
const widget = document.querySelector("cap-widget");
widget.addEventListener("solve", (e) => {
  const token = e.detail.token;
  // Token an deinen Server schicken, Submit-Button aktivieren usw.
});
```

Du kannst das Widget auch unsichtbar rendern und [programmatisch](./programmatic.md) lösen oder den [Floating-Modus](./floating.md) nutzen. Framework-Snippets (React, Vue, Svelte und mehr) findest du auf der [Widget-Seite](./widget.md#usage).

## 3. Das Token verifizieren {#_3-verify-the-token}

Bevor du einer Übermittlung traust, muss dein Server das Token verifizieren. Schicke ein `POST` an den `/siteverify`-Endpunkt deiner Instanz:

::: code-group

```sh [curl]
curl "https://<your-instance>/<site-key>/siteverify" \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{ "secret": "<key_secret>", "response": "<captcha_token>" }'
```

```js [fetch]
const { success } = await (
  await fetch("https://<your-instance>/<site-key>/siteverify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ secret: "<key_secret>", response: "<captcha_token>" }),
  })
).json();

if (!success) throw new Error("invalid cap token");
```

```py [python]
import requests

success = requests.post(
    "https://<your-instance>/<site-key>/siteverify",
    json={"secret": "<key_secret>", "response": "<captcha_token>"},
).json().get("success")
```

```php [php]
<?php
$data = json_decode(file_get_contents("https://<your-instance>/<site-key>/siteverify",
  false, stream_context_create([
    "http" => [
      "method" => "POST",
      "header" => "Content-Type: application/json",
      "content" => json_encode(["secret"=>"<key_secret>","response"=>"<captcha_token>"])
    ]
  ])
), true);
var_dump($data['success'] ?? false);
```

:::

- `<key_secret>` ist der **Secret-Key** aus deinem Dashboard, nicht der `ADMIN_KEY` des Dashboards. Die beiden zu verwechseln ist der häufigste Einrichtungsfehler.
- `<captcha_token>` ist das Token aus dem Widget (das Formularfeld `cap-token` oder `e.detail.token`).

Ein gültiges Token liefert:

```json
{ "success": true }
```

Tokens sind einmalig nutzbar. Verifiziere jedes also genau einmal und führe danach deine eigene Logik aus (Konto anlegen, Nachricht senden und so weiter).

## 4. Prüfen, ob es funktioniert

Ein schneller End-to-End-Check:

1. Lade deine Seite. Die Checkbox sollte anhaken und dein `solve`-Handler (oder das Formularfeld) sollte ein Token liefern.
2. Schicke dieses Token an `/siteverify`. Du solltest `{ "success": true }` zurückbekommen.
3. Schicke dasselbe Token erneut. Jetzt sollte es fehlschlagen, was bestätigt, dass die Einmalnutzung greift.

Schlägt die Verifizierung immer fehl, prüfe, ob du den Secret-Key (nicht den Admin-Key) verwendest und ob `<your-instance>` dieselbe öffentliche URL ist, auf die das Widget zeigt.

Das ist die komplette Integration. Nutzer lösen Challenges in ihrem Browser, dein Server verifiziert Tokens, und jedes Byte der Daten bleibt bei dir.

## Für Compliance gebaut

Weil Cap selbst gehostet ist, ohne Cookies, ohne Tracking und ohne Drittanbieter-Aufrufe, verlassen die Daten deiner Nutzer nie deine Infrastruktur. Cap ist darauf ausgelegt, DSGVO, CCPA, HIPAA, LGPD und weitere Datenschutzregime zu erfüllen, und die Proof-of-Work-Checkbox umgeht die WCAG-2.2-Hürden, an denen Bild- und Audiorätsel scheitern. Alle Details und die Regelwerke, um die herum Cap gebaut ist, findest du auf der Seite [Compliance](./compliance.md).

## Nächste Schritte

Deine Formulare sind geschützt. Von hier aus kannst du:

- Cap mit einem [Framework-Snippet](./widget.md#usage) in deinen Stack einbauen
- [Aussehen und Verhalten des Widgets anpassen](./widget.md#options)
- [Instrumentation](./instrumentation.md) feinjustieren sowie CORS und Rate Limiting [konfigurieren](./standalone/options.md)
- Nachsehen, wie Cap im Vergleich zu [reCAPTCHA, Turnstile, hCaptcha und anderen](./alternatives.md) abschneidet
- Den Guide [beste CAPTCHA-Alternativen 2026](./best-captcha-alternatives.md) lesen, falls du noch evaluierst
