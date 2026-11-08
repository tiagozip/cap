---
description: "capd ist der einfachste Weg, das quelloffene CAPTCHA-Backend selbst zu hosten: ein Docker-Container mit Dashboard, mehreren Site-Keys und einer reCAPTCHA-kompatiblen API."
---

# capd

capd ist der Cap-Server als Docker-Image. Er liefert Challenges an das Widget, verifiziert Tokens für dein Backend und hat ein Dashboard für Site-Keys, Live-Ereignisse, Regeln, Listen und Einstellungen. Er läuft auf Bun, braucht im Leerlauf rund 30 MB Arbeitsspeicher und hält seine Daten in Valkey, die Analytics-Ereignisse in DuckDB oder ClickHouse.

Die Demo unten ist das echte Dashboard, das in deinem Browser mit generiertem Traffic läuft.

<DashboardDemo compact activating="Scrollen wird aktiviert..." />

Um alles samt Dashboard ohne Server auf Cloudflare zu betreiben, siehe [Cloudflare Workers](./workers.md). Wenn du nur Challenges in einem bestehenden Dienst brauchst, erledigt das die [Core-Bibliothek](../capjs-core.md) ohne Dashboard.

## Starten

Der [Schnellstart](../index.md#_1-set-up-capd) lädt eine Compose-Datei herunter und startet Cap. Cap braucht in jedem Setup Valkey für Site-Keys, Einstellungen und Sessions und hält Analytics-Ereignisse entweder in DuckDB oder ClickHouse.

`ADMIN_KEY` ist der einzige Wert, den du setzen musst. Er ist das Dashboard-Passwort. Ohne ihn oder mit weniger als 12 Zeichen verweigert der Server den Start. Alles Weitere steht unter [Konfiguration](./options.md).

Zum Aktualisieren lädst du das neue Image und erstellst die Container neu:

```bash
docker compose pull && docker compose up -d
```

## Analytics-Speicher {#analytics-storage}

DuckDB ist eine Datei im Cap-Container und braucht deshalb keinen zusätzlichen Container. ClickHouse läuft als eigener Container neben Cap und erlaubt mehreren Cap-Containern, sich einen Ereignisverlauf zu teilen.

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

Die DuckDB-Datei startet Cap und Valkey, und Cap schreibt Ereignisse nach `/usr/src/app/data/events.duckdb` auf dem Volume `cap-data`. DuckDB nutzt höchstens 256 MB Arbeitsspeicher und 2 Threads, was du mit `DUCKDB_MEMORY_LIMIT` und `DUCKDB_THREADS` änderst. Die ClickHouse-Datei startet Cap, Valkey und ClickHouse. ClickHouse nutzt `ADMIN_KEY` als Passwort seines Nutzers `cap` und veröffentlicht keinen Port. Du musst also nichts Weiteres setzen. Die Konfiguration deaktiviert ClickHouses eigene Systemlog-Tabellen und begrenzt den Arbeitsspeicher auf 1 GB.

| | DuckDB | ClickHouse |
| --- | --- | --- |
| Zusätzlicher Container | Nein | Ja |
| Arbeitsspeicher des Speicherdienstes | Bis zu 256 MB, während das Dashboard abfragt | Etwa 150 MB im Leerlauf |
| Mehrere Cap-Container | Jeder hält seinen eigenen Verlauf | Teilen sich einen Ereignisverlauf |

Wenn dein Passwort Leerzeichen, `#` oder `$` enthält, setze es in `.env` in einfache Anführungszeichen.

### Eigenes ClickHouse

Nutze die DuckDB-Compose-Datei und ergänze `CLICKHOUSE_URL` in `.env`:

```dotenv
CLICKHOUSE_URL=http://cap:password@clickhouse.internal:8123/cap
```

Cap legt die Datenbank und Tabellen beim ersten Start an. Der Nutzer braucht alle Rechte auf dieser Datenbank und `SELECT` auf `system.parts`. Ist ClickHouse beim Start nicht erreichbar, speichert Cap Ereignisse bis zum nächsten Neustart in DuckDB und zeigt den Fehler unter **Instance settings > Data and storage**.

### Upgrade von einer früheren Version

Compose-Dateien aus der Zeit vor Analytics hatten kein Volume für `/usr/src/app/data`. Docker gibt dem Ordner deshalb ein anonymes Volume, und die Ereignisse gehen bei jeder Neuerstellung des Containers verloren. Ergänze das Volume `cap-data` aus `docker-compose.duckdb.yml`, um sie zu behalten.

### Secrets, API-Keys und Sitzungen aus früheren Versionen

Frühere Versionen haben Site-Secrets, API-Keys und Dashboard-Sitzungen mit argon2 gehasht. Cap speichert sie jetzt alle als SHA-256, da jedes davon ein zufälliges Token mit mindestens 240 Bit ist, und lehnt die alten Hashes ab, statt sie zu prüfen. Beim ersten Start nach dem Upgrade passiert Folgendes:

- Alle werden aus dem Dashboard abgemeldet. Melde dich erneut mit `ADMIN_KEY` an.
- `/siteverify` antwortet mit 403 für Keys, deren Secret von einer früheren Version erzeugt wurde. Ihre **Settings**-Seite weist darauf hin. Setze das Secret unter **Danger zone** zurück und trage das neue in die Umgebung deines Backends ein.
- API-Keys aus einer früheren Version erhalten 401. **Settings > API keys** kennzeichnet sie. Erstelle neue und lösche die alten.

Cap protokolliert beim Start die IDs der Site-Keys und API-Keys, die das noch brauchen. Setze die Secrets zurück, bevor du die Backends aktualisierst, die `/siteverify` aufrufen, denn Anfragen mit dem alten Secret schlagen ab dem Moment fehl, in dem das neue Image startet.

## Öffentlich bereitstellen

Das Widget ruft Cap aus den Browsern deiner Besucher auf, der Server braucht also eine öffentliche HTTPS-URL. Setze ihn hinter deinen üblichen Reverse Proxy und halte Port 3000 gegenüber dem Internet geschlossen.

Cap begrenzt Challenges pro Client-IP. Das funktioniert nur, wenn es die echte IP sieht. Lies vor dem Produktivbetrieb [Client-IPs hinter einem Proxy](./options.md#client-ips-behind-a-proxy), sonst teilen sich alle Besucher einen Rate-Limit-Bucket.

Der Live-Modus auf der Events-Seite nutzt einen WebSocket unter `/server/live`. Die meisten Proxys reichen ihn unverändert durch. Bei nginx brauchst du `proxy_http_version 1.1` und die Header `Upgrade` und `Connection` in der Location für Cap. Ohne sie fragt das Dashboard alle 4 s nach.

## Site-Keys

Jeder Site-Key hat sein eigenes Secret, eigene Statistiken und Einstellungen für Challenge-Protokoll und Schwierigkeit, [Instrumentation](../instrumentation.md), Rate Limits und Blockierregeln. Neue Keys nutzen [HashWX](../hashwx.md) mit aktivierter Instrumentation.

Du kannst das Secret auf der **Settings**-Seite des Keys unter **Add Cap to your site** erneut anzeigen oder kopieren, neben einem `.env`-Snippet mit beiden Keys. Zurücksetzen kannst du es unter **Danger zone**. Cap speichert es verschlüsselt mit einem aus `ADMIN_KEY` abgeleiteten Schlüssel. Eine Kopie der Valkey-Daten allein gibt es deshalb nicht preis. Wenn du `ADMIN_KEY` änderst, werden gespeicherte Secrets unlesbar. Setze das Secret danach zurück, um ein neues zu erhalten, das du wieder anzeigen kannst.

## Adaptive Schwierigkeit {#adaptive-difficulty}

Eine Regel mit der Aktion **Harder puzzle** multipliziert die Schwierigkeit des Keys für passende Anfragen mit 1,5 bis 10, oder mit 2, wenn du keinen Faktor wählst. Bei HashWX-Keys steigt die Schwierigkeit, bei SHA-256-Keys die Anzahl der Challenges, bis höchstens 500. Regeln können auf Challenges pro Minute von einer IP oder einem Besucher, Land, Netz, User-Agent, Header und geteilte Listen prüfen. So zahlen schnelle Wiederholungsbesucher oder Netze, denen du nicht traust, mehr, während alle anderen das übliche Rätsel lösen.

Die Vorlage **Harder puzzles for fast repeat visitors** gibt IPs, die mehr als 20 Challenges pro Minute anfordern, ein 4-mal schwereres Rätsel. Auf der Events-Seite erscheinen diese Anfragen als **Puzzle ×4**.

## Endpunkte

Mit dem Site-Key `abc123` auf `cap.example.com`:

| URL | Aufgerufen von |
| --- | --- |
| `https://cap.example.com/abc123/` | Dem Widget, als `data-cap-api-endpoint` |
| `https://cap.example.com/abc123/siteverify` | Deinem Backend, mit dem Secret und dem Token |
| `https://cap.example.com/` | Dir, für das Dashboard |

`/siteverify` akzeptiert wie bei reCAPTCHA JSON mit `secret` und `response` und liefert für ein gültiges Token `{ "success": true }`. Eine fehlgeschlagene Prüfung liefert `success: false` mit einer `error`-Meldung und einem 4xx-Status. Tokens funktionieren nur einmal.

Das Dashboard hat außerdem eine [REST API](./options.md#api), um Keys über Skripte zu verwalten.
