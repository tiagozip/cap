---
description: "Betreibe capd auf Cloudflare Workers mit D1: derselbe Code, dasselbe Dashboard, dieselben Site-Keys und dieselbe siteverify-API, ganz ohne Server oder Container."
---

# Cloudflare Workers

Der Ordner `workers/` im Cap-Repository deployt capd als einzelnen Cloudflare Worker. Er führt denselben Code aus wie das Docker-Image, liefert also die Widget-Routen, `/siteverify`, die API und das Dashboard aus, hält seine Daten und Ereignisse aber in D1 statt in Valkey und DuckDB.

Eine Lösung samt siteverify-Aufruf schreibt etwa 15 D1-Zeilen. Die 100.000 Zeilen pro Tag im kostenlosen Tarif decken damit rund 6.500 Lösungen am Tag, die 50 Millionen Zeilen pro Monat im bezahlten Tarif rund 3 Millionen.

## Deployen

Du brauchst Node 22 oder neuer, [Bun](https://bun.sh) zum Bauen des Dashboards und einen Cloudflare-Account.

```bash
git clone https://github.com/tiagozip/cap.git
cd cap/workers && npm install
npm run deploy
npx wrangler secret put ADMIN_KEY
```

`npm run deploy` installiert die Pakete von capd, baut das Dashboard, deployt den Worker und wendet danach die D1-Migrationen an, weil `wrangler deploy` die Datenbank beim ersten Mal anlegt. `ADMIN_KEY` ist das Dashboard-Passwort. Erzeuge eines mit `openssl rand -hex 24`.

Öffne die `workers.dev`-URL, die Wrangler ausgegeben hat, und melde dich an. Um ihn unter deiner eigenen Domain auszuliefern, füge dem Worker eine [Custom Domain](https://developers.cloudflare.com/workers/configuration/routing/custom-domains/) hinzu.

Zum Aktualisieren holst du das Repository neu und führst dieselben Befehle noch einmal aus, außer `secret put`.

## Unterschiede zum Docker-Image

- **Einstellungen brauchen einige Sekunden, bis sie überall gelten.** Jedes Isolate lädt die Einstellungen alle 10 s neu und cacht die Key-Konfiguration und Listen 5 s und die CORS-Origins für siteverify 60 s.
- **Redeem ist langsamer.** Jeder D1-Schreibvorgang geht an die Primärregion der Datenbank, und Redeem schreibt mehrmals hintereinander. Besucher, die weit von der Primärregion entfernt sind, warten deshalb länger.
- **Die Einstellungen der IP-Datenbank sind ausgeschaltet**, weil Cloudflare dem Worker bereits Land und ASN jedes Besuchers liefert.
- **Obfuskierungsstufen 4 bis 10 überspringen ihren Minify-Schritt**, weil esbuild nicht in einem Worker laufen kann. Das Widget löst trotzdem auf dieselbe Weise.
- **Webhooks werden nach 1 s und nach 5 s wiederholt.** Der dritte Versuch nach 30 s liegt nach der Zeit, die Cloudflare einem Worker nach seiner Antwort lässt, und findet deshalb meistens nicht statt.
- **Der Live-Modus auf der Events-Seite fragt alle 4 s nach neuen Events.** Das Docker-Image schickt sie über einen WebSocket, und ein Worker kann ohne Durable Object nicht an mehrere Verbindungen verteilen.
- **Unter `/swagger` gibt es keine API-Doku.** Die Doku des Docker-Images beschreibt dieselbe API.
- **Es gibt keine Migration der Daten aus dem Docker-Image.** Site-Keys, Einstellungen und Ereignisse beginnen leer.

D1 führt die Abfragen einer Datenbank nacheinander aus, daher wächst eine stark besuchte Seite lange vor dem Worker aus der Datenbank heraus. Ab etwa 50 Lösungen pro Sekunde über alle Site-Keys nimmst du besser das Docker-Image.

## Lokal ausführen

```bash
cd workers && npm install
echo "ADMIN_KEY=$(openssl rand -hex 24)" > .dev.vars
npm run dev
```

`npm run dev` baut das Dashboard, wendet die Migrationen auf eine lokale Datenbank an und startet `wrangler dev`.
