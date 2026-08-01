---
title: Von reCAPTCHA zu Cap migrieren
description: "Google verschiebt reCAPTCHA in die Google Cloud und migriert Classic-Keys automatisch. Wechsle stattdessen zu Cap: ein schnelleres, privates, selbst gehostetes, quelloffenes CAPTCHA mit reCAPTCHA-kompatibler siteverify-API und Bot-Erkennung auf Turnstile-Niveau."
---

# Von reCAPTCHA zu Cap migrieren

Google verschiebt reCAPTCHA in die Google Cloud und migriert Classic-Keys automatisch in abgerechnete Projekte. Du musst deine Integration also ohnehin anfassen. Die gute Nachricht: Das ist der perfekte Anlass, Googles tracking-basiertes CAPTCHA gegen etwas Schnelleres, Privates und Kostenloses zu tauschen.

Cap ist ein Drop-in-Ersatz für den entscheidenden Teil und ein Upgrade für fast alles andere.

## Warum Teams zu Cap wechseln

- **Erkennung auf Turnstile-Niveau, ohne Dritte.** Cap kombiniert Proof-of-Work mit Instrumentation-Challenges, derselben Browser-Verifizierungstechnik, die YouTube und Twitter/X in riesigem Maßstab fahren. Es liegt in derselben Erkennungsklasse wie Cloudflare Turnstile und bleibt dabei vollständig selbst gehostet.
- **Im großen Maßstab bewährt.** Rund **1 Milliarde gelöste Challenges allein in Q1 2026** (laut JSDelivr), und im Produktivbetrieb bei Teams wie **AdGuard** und **Bunny.net** im Einsatz. Das ist kein Experiment.
- **Ein Bruchteil des Gewichts, und unsichtbar.** Caps Widget wiegt etwa 21 KB gzipped gegenüber reCAPTCHAs Client von 200 bis 600 KB, oft eine Reduktion um den Faktor 10 oder mehr. Standard-Challenges lösen sich im Hintergrund in 2 bis 3 Sekunden, ohne Ampel-Rätsel und ohne dass der Nutzer irgendetwas anklicken muss.
- **Wirklich kostenlos, ohne Zählwerk.** Kein Google-Cloud-Projekt, kein Rechnungskonto, keine Gebühr pro Assessment. Ein Docker-Container und eine Valkey-Instanz bewältigen die meisten Workloads auf einem 5-$-VPS.
- **Von Haus aus privat.** reCAPTCHA lädt Skripte von `google.com` und schickt Nutzersignale an Google. Cap schickt Daten nirgendwohin. Nichts von Dritten berührt deine Seite.
- **Du hast die Kontrolle.** reCAPTCHA v3 bestraft Nutzer mit VPN, Tor und Privacy-Browsern still und ohne Einspruchsmöglichkeit. Bei Cap legst du die Schwierigkeit fest, und jeder echte Nutzer hat immer einen Weg hindurch.
- **Quelloffen, für immer.** Apache 2.0. Prüfen, forken, deployen. Kein Anbieter kann dir die Bedingungen ändern.

Die vollständige Aufschlüsselung findest du unter [Cap vs. reCAPTCHA](./recaptcha.md).

## Was sich bei reCAPTCHA ändert

Falls du den Kontext brauchst, warum die Migrations-Mails gerade jetzt eintrudeln:

- In der alten reCAPTCHA-Admin-Konsole lassen sich keine neuen Keys mehr anlegen.
- Bestehende reCAPTCHA-Classic-Keys werden automatisch in Google-Cloud-Projekte migriert, ein Prozess, den Google ab Ende 2025 bis ins Jahr 2026 gefahren hat.
- Nach der Migration hängt der API-Zugriff eines Keys an einem Google-Cloud-Projekt. Über den kostenlosen Rahmen von 10.000 Assessments pro Monat hinaus musst du für dieses Projekt die Abrechnung aktivieren.

reCAPTCHA jetzt zu behalten bedeutet: ein Google-Cloud-Projekt, ein hinterlegtes Rechnungskonto und gezählte Assessments. Zu Cap zu wechseln bedeutet nichts davon, in einem Zeitplan, den du bestimmst.

## Wie die Migration abläuft

Caps `/siteverify`-Endpunkt spiegelt bewusst die Request-Form von reCAPTCHA, die Serverseite ist also nahe an einem Drop-in. Der Widget-Tausch ist Tag gegen Tag. Drei Schritte, und während der Umstellung kannst du beide parallel betreiben.

### 1. Eine Cap-Instanz aufsetzen

Folge dem [Schnellstart](../index.md), um Cap Standalone mit Docker zu betreiben. Lege im Dashboard einen Site-Key an und notiere sowohl den **Site-Key** als auch seinen **Secret-Key**. Lass die [Instrumentation-Challenges](../instrumentation.md) aktiviert (Standard), um den stärksten Bot-Schutz zu bekommen.

### 2. Das Client-Widget tauschen

Ersetze das reCAPTCHA-Skript und -Element durch Caps Widget.

Vorher:

```html
<script src="https://www.google.com/recaptcha/api.js" async defer></script>
<div class="g-recaptcha" data-sitekey="<your-recaptcha-site-key>"></div>
```

Nachher:

```html
<script src="https://cdn.jsdelivr.net/npm/cap-widget"></script>
<cap-widget data-cap-api-endpoint="https://<your-instance>/<site-key>/"></cap-widget>
```

Lag dein reCAPTCHA-Widget in einem `<form>`, überträgt sich die Token-Behandlung: reCAPTCHA fügte automatisch ein Feld `g-recaptcha-response` ein, Cap fügt beim Absenden automatisch ein Feld `cap-token` ein. Außerhalb eines Formulars lauschst du auf das `solve`-Event:

```js
document.querySelector("cap-widget").addEventListener("solve", (e) => {
  const token = e.detail.token;
});
```

### 3. Die serverseitige Verifizierung tauschen

Die reCAPTCHA-Verifizierung postet `secret` und `response` an eine feste Google-URL. Cap nimmt dieselben zwei Parameter entgegen, gepostet an deine eigene Instanz:

Vorher:

```js
const { success } = await (
  await fetch("https://www.google.com/recaptcha/api/siteverify", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ secret: RECAPTCHA_SECRET, response: token }),
  })
).json();
```

Nachher:

```js
const { success } = await (
  await fetch("https://<your-instance>/<site-key>/siteverify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ secret: CAP_SECRET, response: token }),
  })
).json();
```

Auch das Token, das dein Server ausliest, heißt anders: Hol dir `cap-token` aus dem abgeschickten Formular (oder den Wert aus dem `solve`-Event) statt `g-recaptcha-response`.

## Was kompatibel ist und was nicht

Uns ist lieber, du migrierst mit offenen Augen, als dass du in der Produktion überrascht wirst. Die Kompatibilität ist echt, aber nicht Byte für Byte:

| | reCAPTCHA | Cap |
| --- | --- | --- |
| Request-Parameter | `secret`, `response`, optional `remoteip` | `secret`, `response` (`remoteip` wird ignoriert) |
| Endpunkt | feste `google.com`-URL | deine eigene `/<site-key>/siteverify` |
| Erfolgsfeld | `success` (boolean) | `success` (boolean) |
| Fehlermeldung | `error-codes` (Array) | `error` (String) |
| Zusatzfelder | `challenge_ts`, `hostname`, `score` (v3) | keine |

In der Praxis:

- Code, der nur `response.success` prüft, funktioniert nach einem URL- und Secret-Tausch. Das ist der Normalfall und eine Änderung von einer Zeile.
- Code, der `error-codes`, `challenge_ts`, `hostname` oder den v3-`score` auswertet, muss angepasst werden. Cap ist ein Verifizierungssystem, kein verhaltensbasierter Risiko-Score, diese Felder existieren also nicht.
- Nutzt du ein Backend-SDK, das Googles Verify-URL fest verdrahtet, tausche es gegen eines, mit dem du den Endpunkt setzen kannst, oder rufe `/siteverify` direkt auf. Es sind zwei Parameter.

## Migration ohne Ausfallzeit

Du musst nie einen Schalter umlegen und beten. Hänge Cap an ein separates Element und lass dein Backend während des Übergangs entweder ein gültiges `cap-token` oder ein gültiges `g-recaptcha-response` akzeptieren. Beobachte Caps Verifizierungsrate in deinen Logs, und sobald sie gesund aussieht, entfernst du das reCAPTCHA-Skript, das Element und den Server-Aufruf. Die meisten Teams schließen die Umstellung an einem Nachmittag ab.

## Siehe auch

- [Live-Demo](../demo.md) — löse selbst eine Cap-Challenge und stoppe die Zeit gegen reCAPTCHA
- [Cap vs. reCAPTCHA](./recaptcha.md) — der vollständige Vergleich
- [Wie Cap Bots erkennt](../effectiveness.md) — das Modell aus Proof-of-Work und Instrumentation
- [Schnellstart](../index.md) — Cap in fünf Minuten von null aufsetzen
