---
description: "Konfigurationsoptionen und Umgebungsvariablen für Cap Standalone, das selbst gehostete quelloffene CAPTCHA: CORS, Asset-Server, Widget- und WASM-Versionen und mehr."
---

# Optionen

## CORS

Du kannst die Standard-CORS-Einstellungen für das Einlösen und Erzeugen von Challenges ändern, indem du beim Start des Servers die Umgebungsvariable `CORS_ORIGIN` setzt. Standard ist `*`, was alle Origins erlaubt. Mehrere Origins trennst du per Komma, etwa `domain1.tld,domain2.tld,...`.

## Asset-Server

Der Asset-Server ist standardmäßig deaktiviert. Aktiviere ihn, indem du die Umgebungsvariable `ENABLE_ASSETS_SERVER` auf `true` setzt. Dann werden die Assets über den Endpunkt `/assets` ausgeliefert.

Setze anschließend `WIDGET_VERSION` und `WASM_VERSION` auf die Version der Widget- und WASM-Dateien, die du ausliefern willst. Standard ist `latest`, was jeweils die neueste Version ausliefert. In der Produktion ist das nicht empfehlenswert, da so Breaking Changes ausgeliefert werden könnten.

Verfügbar sind die veröffentlichten npm-Releases von [`@cap.js/widget`](https://www.npmjs.com/package/@cap.js/widget?activeTab=versions) und [`@cap.js/wasm`](https://www.npmjs.com/package/@cap.js/wasm?activeTab=versions). Zum Beispiel:

```env
ENABLE_ASSETS_SERVER=true
WIDGET_VERSION=0.1.58
WASM_VERSION=0.0.8
```

Deine Assets werden unter folgenden Pfaden ausgeliefert:

- `/assets/widget.js`
- `/assets/floating.js`
- `/assets/cap_wasm_bg.wasm`
- `/assets/hashwx.wasm`
- `/assets/cap_wasm.js`

Du kannst sie in deiner App nutzen, indem du die Script-Quelle des Widgets auf den passenden Pfad setzt:

```html
<script src="https://<server url>/assets/widget.js"></script>
```

Für den Floating-Modus:

```html
<script src="https://<server url>/assets/floating.js"></script>
```

Und indem du `window.CAP_CUSTOM_WASM_URL` und `window.CAP_CUSTOM_HASHWX_URL` auf die Pfade der Dateien `cap_wasm_bg.wasm` und `hashwx.wasm` setzt:

```js
window.CAP_CUSTOM_WASM_URL = "https://<server url>/assets/cap_wasm_bg.wasm";
window.CAP_CUSTOM_HASHWX_URL = "https://<server url>/assets/hashwx.wasm";
```

`hashwx.wasm` ist ab `@cap.js/wasm` 0.0.8 enthalten. Mit einer älteren `WASM_VERSION` antwortet `/assets/hashwx.wasm` mit 503. Lass `CAP_CUSTOM_HASHWX_URL` dann weg, und das Widget lädt die Datei von jsdelivr.

Standardmäßig werden diese von `process.env.CACHE_HOST` geladen (Standard: `https://cdn.jsdelivr.net`). Das änderst du über die Umgebungsvariable `CACHE_HOST` beim Start des Servers.

### Fehlerbehebung

Die Assets werden beim Start von `CACHE_HOST` nach Redis heruntergeladen und danach stündlich aufgefrischt. Antwortet ein Asset-Endpunkt mit `Asset not cached yet`, hat der Download nicht stattgefunden. Prüfe:

- Ob `ENABLE_ASSETS_SERVER=true` am Cap-Container wirklich gesetzt ist. Hast du es in einer Compose-Datei geändert, erstelle den Container neu. Ist es nicht gesetzt, antworten die `/assets/*`-Endpunkte mit einem 404 und dem Hinweis, dass der Asset-Server deaktiviert ist.
- Ob der Container ausgehenden Netzwerkzugriff auf `CACHE_HOST` hat. Schlägt ein Download fehl, loggt der Server beim Start eine Zeile mit `[asset server] failed to update assets cache` und versucht es stündlich erneut.
- Ob `WIDGET_VERSION` und `WASM_VERSION` auf Versionen zeigen, die es auf npm tatsächlich gibt.

## Rate Limiting

Challenge-Endpunkte sind pro Client-IP über ein festes Zeitfenster begrenzt, standardmäßig 30 Requests alle 5 Sekunden. Das globale Limit änderst du im Dashboard unter **Settings** (oder per `PUT /settings/ratelimit`) und überschreibst es pro Site-Key im Tab **Configuration** des Keys. Wird das Limit überschritten, erhalten Requests eine `429`-Antwort mit dem Header `X-RateLimit-Remaining: 0`.

Der Endpunkt `/siteverify` ist für Server-zu-Server-Kommunikation gedacht und daher standardmäßig nicht rate-limitiert.

### Client-IPs hinter einem Proxy

Standalone identifiziert Clients über die Header `X-Forwarded-For`, `X-Real-IP` und `CF-Connecting-IP` (in dieser Reihenfolge) und fällt sonst auf die Socket-Adresse zurück. Sitzt du hinter einem Reverse Proxy, der einen anderen Header nutzt, setze `RATELIMIT_IP_HEADER` in deiner Env (oder den IP-Header im Dashboard unter **Settings > Headers**). Hinter Cloudflare setzt du ihn zum Beispiel auf `cf-connecting-ip`.

Stelle sicher, dass dein Proxy die Client-IP tatsächlich weiterreicht. Für nginx:

```nginx
location / {
    proxy_pass http://localhost:3000;
    proxy_set_header X-Forwarded-For $remote_addr;
}
```

Ohne das sieht jeder Request so aus, als käme er von der IP des Proxys, und alle Clients teilen sich einen einzigen Rate-Limit-Bucket. Beachte außerdem, dass `X-Forwarded-For` unverändert vertraut wird: Der Server darf also nicht direkt aus dem Internet erreichbar sein, sonst können Clients den Header fälschen und das Rate Limiting umgehen.

## Redis / Valkey

Cap Standalone nutzt Redis (oder Valkey) für die gesamte Datenspeicherung. Setze die Umgebungsvariable `REDIS_URL` auf deinen Redis-Connection-String. Standard ist `redis://localhost:6379`.

Das empfohlene Setup nutzt Valkey (einen Redis-kompatiblen Store) über die docker-compose-Datei aus dem [Schnellstart-Guide](/de/guide/standalone/).

Teilst du eine einzelne Redis-Instanz über mehrere Cap-Deployments (oder mit anderen Apps) hinweg, setze `REDIS_PREFIX`, um alle Keys zu namespacen. `REDIS_PREFIX=cap:` speichert Sessions etwa als `cap:session:...`, Metriken als `cap:metrics:...` und so weiter. Standardmäßig ist der Wert leer, bestehende Deployments sind also nicht betroffen.

## Fehlermeldungen

Fehlermeldungen werden standardmäßig redigiert und stattdessen auf die Konsole geloggt. Um das Error-Logging abzuschalten, setze `DISABLE_ERROR_LOGGING=true`. Um die Redigierung abzuschalten, setze `SHOW_ERRORS=true`.

## HashWX-Proof-of-Work {#hashwx-proof-of-work}

Standalone nutzt [HashWX](../hashwx.md), einen GPU-resistenten Proof-of-Work, als Standard-Challenge-Protokoll für neue Keys. Es wird pro Site-Key konfiguriert, einzelne Keys können also SHA-256 nutzen, während andere auf HashWX bleiben. Keys, die vor der Umstellung angelegt wurden, behalten ihr bisheriges Protokoll, bis du es änderst.

Zum Wechseln öffnest du den Tab **Configuration** eines Keys und wählst unter **Challenge protocol** eines aus. HashWX braucht keine Vorbereitung: Es gibt kein Keypair, das erzeugt oder gespeichert werden müsste.

Die Schwierigkeit steuerst du über den Regler **HashWX difficulty**, die erwartete Anzahl Hashes, die ein Client berechnen muss. Standard ist `1_000_000`, aufgeteilt auf vier Teil-Challenges, was auf einem Desktop mit 8 Kernen in Chrome einen Median von 578 ms und auf Smartphones 1,1 bis 5,9 s ergab. Sieh dir [die Messungen auf Smartphones](../hashwx.md#phones) an, bevor du ihn erhöhst. Der gültige Bereich ist `50_000`-`5_000_000`.

Clients ohne WebAssembly können HashWX nicht lösen. Musst du sie unterstützen, stell diesen Key stattdessen auf SHA-256-Proof-of-Work um, der hat einen reinen JS-Fallback.

RSW-Time-Lock-Puzzles lassen sich für bestehende Deployments weiterhin auswählen, sind aber abgekündigt: Eine GPU schafft davon pro Sekunde etwa 170-mal so viele wie eine CPU, sie liefern also nicht die GPU-Resistenz, für die sie eingebaut wurden. Der Regler **RSW difficulty** setzt `t`, die Anzahl sequenzieller Quadrierungen, im Bereich `10_000`-`300_000`, und `RSW_BITS=2048` überschreibt beim Start die Modulus-Größe.

::: tip
Das Widget erkennt das Protokoll automatisch am Wire-Format, das Umstellen eines Keys ist also die einzige nötige Änderung. Außerhalb von Standalone bleibt cap-core bei SHA-256-PoW, solange du nichts anderes aktivierst.
:::

## Instrumentation-Challenges

Cap Standalone unterstützt JavaScript-Instrumentation-Challenges, um Proof-of-Work-Solver auszuhebeln, samt Optionen, um Headless-Browsern das Lösen zu verwehren. Beim Anlegen neuer Site-Keys sind Instrumentation-Challenges standardmäßig aktiviert.

Du kannst sie in der Konfiguration des Site-Keys ein- und ausschalten. Um Headless-Browser zu blockieren, aktiviere in den Key-Einstellungen "Attempt to block headless browsers".

Beachte, dass hohe Instrumentation-Level den Erzeugungsdurchsatz deutlich senken können. Wir empfehlen Level 3, sofern du keine stärkere Obfuskation brauchst. Ist dir Level 3 zu langsam, ist Level 1 auf einem einzelnen Kern deutlich schneller.

## IP-Datenbank

Länder- und ASN-Abfragen können einen von drei Anbietern nutzen, konfigurierbar im Dashboard unter `Settings > IP Data > Country & ASN data`: DB-IP Lite, MaxMind GeoLite2 und die API von IPInfo.

Bei DB-IP und MaxMind werden die `.mmdb`-Dateien im Container nach `/usr/src/app/data/` heruntergeladen.

### Berechtigungen für Docker-Volumes

Der Container läuft als unprivilegierter Nutzer `bun` (UID 1000). Wenn du ein Host-Verzeichnis per Bind-Mount auf `/usr/src/app/data` legst, muss dieses Verzeichnis für UID 1000 beschreibbar sein, sonst schlägt der Download mit `EACCES: permission denied` fehl.

```bash
mkdir -p ./cap-data
sudo chown 1000:1000 ./cap-data
```

```yaml
services:
  cap:
    image: tiago2/cap:latest
    volumes:
      - ./cap-data:/usr/src/app/data
    # ...
```

Kannst du die Eigentümerschaft auf deinem Host nicht ändern (auf manchen Plattformen wie Coolify ist das umständlich), sind die einfachsten Alternativen:

- Den Bind-Mount ganz weglassen und Docker das Datenverzeichnis verwalten lassen, das Image legt es bereits mit den richtigen Rechten an.
- Statt eines Bind-Mounts ein Named Volume verwenden.
- Auf einen IP-Data-Anbieter wechseln, der keine lokalen Dateien braucht.
