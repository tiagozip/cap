---
description: "Cap Standalone ist der einfachste Weg, das quelloffene CAPTCHA-Backend selbst zu hosten: Docker, Instrumentation, eine reCAPTCHA-kompatible API und ein Web-Dashboard."
---

# Cap Standalone

Cap Standalone ist der empfohlene Weg, Caps Backend selbst zu hosten. Es läuft auf Bun und braucht im Leerlauf rund 50 MB Arbeitsspeicher. Es bringt integrierte Unterstützung für Instrumentation-Challenges mit, die die Hürde für Bots deutlich anheben, dazu eine zu reCAPTCHA kompatible siteverify-API und ein Web-Dashboard zur Verwaltung mehrerer Site-Keys.

Wir empfehlen, Cap Standalone mit [Docker](https://docs.docker.com/get-docker/) zu betreiben.

## Installation

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

::: tip Tipps

- `ADMIN_KEY` ist dein Dashboard-Login. Wir empfehlen mindestens 32 Zeichen
- Ändere `3000:3000`, falls der Port auf deinem Host schon belegt ist.
- Ist das Dashboard nicht erreichbar, ergänze `network_mode: "host"` unter dem Service `cap`.
  :::

Starte den Container:

```bash
docker compose up -d
```

Öffne `http://localhost:3000` (oder IP/Domain deines Servers auf Port 3000), um ins Dashboard zu kommen. Melde dich mit deinem Admin-Key an, lege einen Site-Key an und notiere dir sowohl den **Site-Key** als auch seinen **Secret-Key**, du brauchst beide.

Instrumentation-Challenges sind beim Anlegen neuer Site-Keys standardmäßig aktiv. Wir empfehlen, sie eingeschaltet zu lassen, da sie die Hürde für Bots deutlich anheben. Für zusätzlichen Schutz kannst du außerdem die Erkennung von Headless-Browsern aktivieren.

Deine Cap-Standalone-Instanz muss aus dem Internet öffentlich erreichbar sein, damit das Widget mit ihr kommunizieren kann. Wenn du einen Reverse Proxy nutzt, sieh dir den [Optionen-Guide](/de/guide/standalone/options.md) an, um das Rate Limiting korrekt zu konfigurieren.

## Verwendung

### Clientseitig

Richte das Widget über das Attribut `data-cap-api-endpoint` auf deine Instanz aus:

```
https://<instance_url>/<site_key>/
```

- `<instance_url>` — die öffentliche URL deiner Cap-Standalone-Instanz
- `<site_key>` — der Site-Key aus deinem Dashboard

Beispiel:

```html
<cap-widget data-cap-api-endpoint="https://cap.example.com/d9256640cb53/"></cap-widget>
```

Wir empfehlen, unsere [Widget-Dokumentation](../widget.md) für weitere Details und Beispiel-Snippets für mehrere Frameworks zu lesen.

### Serverseitig

Sobald ein Nutzer das CAPTCHA abgeschlossen hat, muss dein Backend das Token verifizieren, bevor du ihm traust. Schicke einen `POST`-Request an den `/siteverify`-Endpunkt deiner Instanz mit folgendem JSON-Body:

```bash
curl "https://<instance_url>/<site_key>/siteverify" \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{ "secret": "<key_secret>", "response": "<captcha_token>" }'
```

Dabei ist `<key_secret>` der Secret-Key aus deinem Dashboard (**nicht** der Admin-Key des Dashboards) und `<captcha_token>` das vom Widget erzeugte Challenge-Token.

Eine erfolgreiche Verifizierung liefert:

```json
{ "success": true }
```
