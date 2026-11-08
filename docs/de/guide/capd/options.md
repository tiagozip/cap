---
description: "Konfiguration für capd, das selbst gehostete quelloffene CAPTCHA: Umgebungsvariablen, Client-IPs hinter einem Proxy, Widget-Dateien, Health-Checks und die API."
---

# Konfiguration

Die meisten Einstellungen liegen im Dashboard, entweder für den gesamten Server unter **Instance settings** oder pro Site-Key auf dessen **Settings**-Seite. Diese Seite behandelt, was sich im Dashboard nicht einstellen lässt.

## Umgebungsvariablen

| Variable | Beschreibung |
| --- | --- |
| `ADMIN_KEY` | Dashboard-Passwort, mindestens 12 Zeichen. Erforderlich. |
| `VALKEY_URL` | Valkey-Connection-String, standardmäßig `redis://localhost:6379`. Redis funktioniert ebenfalls. |
| `VALKEY_TLS_CA` | Pfad zu einem CA-Zertifikat im PEM-Format, dem Cap bei Valkey über TLS vertraut, etwa für einen Server mit selbstsigniertem Zertifikat. Nutze eine `rediss://`-URL. `VALKEY_TLS_CERT` und `VALKEY_TLS_KEY` fügen ein Client-Zertifikat hinzu, wenn der Server eines verlangt. |
| `CLICKHOUSE_URL` | Speichert Ereignisse in ClickHouse statt DuckDB, zum Beispiel `http://cap:password@clickhouse:8123/cap`. Schreibe das Passwort ohne URL-Kodierung. |
| `WEBHOOK_ALLOW_PRIVATE` | Setze den Wert auf `true`, damit Webhooks an private und Loopback-Adressen senden dürfen, etwa an ein n8n in deinem LAN. |
| `DUCKDB_MEMORY_LIMIT`, `DUCKDB_THREADS` | Limits für DuckDB, standardmäßig `256MB` und `2`. |

`CORS_ORIGIN`, `RATELIMIT_IP_HEADER`, `ENABLE_ASSETS_SERVER`, `WIDGET_VERSION` und `WASM_VERSION` aus älteren Versionen sind jetzt Dashboard-Einstellungen. Ist einer dieser Werte noch gesetzt, kopiert Cap ihn beim Start ins Dashboard.

## Client-IPs hinter einem Proxy {#client-ips-behind-a-proxy}

Cap begrenzt Challenges pro Client-IP, standardmäßig auf 30 Anfragen alle 5 Sekunden. Dafür nutzt es die Socket-Adresse und ignoriert Weiterleitungs-Header, solange du deinen Proxy nicht unter **Instance settings > Visitor location > Your proxy or CDN** auswählst. Hinter Cloudflare wählst du Cloudflare. Bei `X-Forwarded-For` liest Cap den letzten Eintrag, also den, den dein Proxy angehängt hat.

Mit nginx reichst du die Adresse so weiter:

```nginx
location / {
    proxy_pass http://localhost:3000;
    proxy_set_header X-Forwarded-For $remote_addr;
}
```

Ohne Proxy-Einstellung teilen sich alle Besucher den Rate-Limit-Bucket des Proxys. Sobald ein Header eingestellt ist, mache Port 3000 nicht mehr direkt erreichbar, sonst können Clients jede beliebige IP mitschicken.

## Anmeldung über einen Proxy {#proxy-sign-in}

Liegt das Dashboard hinter Authentik, Authelia, oauth2-proxy oder einem anderen Anmelde-Proxy, kann Cap jeden anmelden, den der Proxy durchlässt. Dann muss sich niemand ein zweites Mal mit `ADMIN_KEY` anmelden. Erzeuge unter **Instance settings > Proxy sign-in** ein Secret und lass deinen Proxy es als Header `X-Cap-Proxy-Secret` an die Anfragen hängen, die er angemeldet hat. Mit Caddy ist das eine Zeile im `reverse_proxy`-Block hinter deiner Forward-Auth:

```txt
reverse_proxy localhost:3000 {
    header_up X-Cap-Proxy-Secret {env.CAP_PROXY_SECRET}
}
```

Mit nginx ist es `proxy_set_header X-Cap-Proxy-Secret $cap_proxy_secret;` in der geschützten Location. Die Widget-Routen `/assets/*`, `/<siteKey>/challenge`, `/<siteKey>/redeem`, `/<siteKey>/siteverify` und `/health` bleiben außerhalb des Anmelde-Proxys und brauchen den Header nicht.

**Proxy or admin key** meldet dich automatisch an, wenn der Header da ist, und lässt die Anmeldung mit dem Admin-Key für alle anderen bestehen. **Proxy only** schaltet die Anmeldung mit dem Admin-Key ab und prüft den Header bei jeder Dashboard-Anfrage. Wer in deinem Identity Provider entfernt wird, verliert den Zugang sofort, auch mit einem aufbewahrten Session-Token. API-Keys funktionieren in beiden Modi weiter. Cap wechselt nur dann zu Proxy only, wenn die Anfrage, die es einschaltet, den Header mitbringt, damit du dich nicht über das Dashboard aussperrst.

Cap speichert nur einen Hash des Secrets. Geht es verloren, erzeuge ein neues. Sperrt dich ein defekter Proxy trotzdem aus, lösche die Einstellung mit `docker compose exec valkey valkey-cli DEL settings:proxy-auth` und setze dein `REDIS_PREFIX` vor den Schlüssel, falls du eins gesetzt hast.

## Widget-Dateien {#asset-server}

Standardmäßig lädt das Widget sein Skript und seine WebAssembly-Dateien von jsDelivr. Ist **Instance settings > Widget files > Serve widget files from this server** aktiviert, lädt Cap die Dateien nach Valkey herunter und liefert sie unter `/assets/` aus. Das Snippet **Add Cap to your site** jedes Keys verweist dann dorthin. Im selben Abschnitt wählst du die Versionen von Widget und WASM.

## IP-Daten

Für Abfragen über DB-IP und MaxMind lädt Cap `.mmdb`-Dateien nach `/usr/src/app/data` herunter. Der Container läuft als UID 1000, ein per Bind-Mount eingehängter Ordner muss also für diesen Nutzer beschreibbar sein:

```bash
mkdir -p ./cap-data && sudo chown 1000:1000 ./cap-data
```

## Health-Checks

`GET /health` liefert `200`, wenn Valkey innerhalb von 2 Sekunden antwortet, sonst `503`. Nutze es für Readiness-Checks. `GET /health/live` liefert `200`, solange der Prozess läuft. Nutze es für Liveness-Checks, dann startet eine Orchestrierung Cap während eines Valkey-Ausfalls nicht neu.

## API {#api}

Alles, was das Dashboard macht, ist auch über eine REST API verfügbar, dokumentiert unter `/swagger` auf deiner Instanz. Lege unter **Instance settings > API keys** einen Key an und schicke ihn als `Authorization: Bot <api-key>` mit.

Ein Key darf standardmäßig alles. Du kannst ihn schreibgeschützt machen, auf bestimmte Site-Keys beschränken oder beides. Einen schreibgeschützten Key für einen einzelnen Site-Key kannst du bedenkenlos dessen Besitzer geben, damit er seine Statistiken abrufen kann.
