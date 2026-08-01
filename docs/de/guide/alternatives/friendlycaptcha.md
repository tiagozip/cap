---
title: Cap vs. FriendlyCaptcha
description: "Cap vs. Friendly Captcha: ein kostenloses, selbst gehostetes, quelloffenes Proof-of-Work-CAPTCHA gegen ein kostenpflichtiges SaaS. Vergleich von Datenschutz, Preisen und dem Ort deiner Besucherdaten."
---

# Cap vs. FriendlyCaptcha

FriendlyCaptcha war eines der ersten Proof-of-Work-CAPTCHAs, mit Fokus auf EU-Datenschutzkonformität. Es ist ein gehosteter kommerzieller Dienst mit einem kostenlosen Tarif für nicht-kommerzielle Nutzung und bezahlten Tarifen für alles andere.

## Kurzes Fazit

Wenn du gezielt ein kostenpflichtiges, in der EU gehostetes Produkt mit Herstellersupport, SLA und Vertriebskontakt brauchst, ist FriendlyCaptcha eine vernünftige Wahl. Willst du dasselbe Proof-of-Work-Modell ohne Rechnung und ohne Request-Quote, ist Cap eine kostenlose, selbst gehostete, quelloffene Alternative, die du von Anfang bis Ende kontrollierst.

## Wo FriendlyCaptcha sinnvoll ist

- Du brauchst einen Anbieter mit Vertrag, SLA und EU-Hosting, um das jemand anderes kümmert.
- Dein Traffic ist vorhersehbar und klein genug, um bequem in einen bezahlten Tarif zu passen.
- Du willst keinerlei Infrastruktur betreiben.

## Wo Cap die bessere Wahl ist

- **Keine Quoten, egal bei welchem Volumen.** Der Starter-Plan von FriendlyCaptcha kostet 9 €/Monat für 1.000 Requests/Monat, mit höheren Stufen, je größer du wirst. Cap ist bei jedem Volumen kostenlos: keine Gebühr pro Request, kein Domain-Limit.
- **Der Server ist quelloffen.** Die Framework-Integrationen von FriendlyCaptcha sind quelloffen, der Server aber proprietär. Cap steht durchgehend unter Apache 2.0.
- **Selbst gehostet.** Cap läuft auf deiner eigenen Infrastruktur, auf einem 5-$-VPS, ganz ohne Round-Trip zu Dritten.
- **Zwei Verifizierungsebenen.** Cap legt [Instrumentation-Challenges](../instrumentation.md) über den Proof-of-Work. FriendlyCaptcha bietet nur PoW.
- **Kein "Anbieterrisiko".** Quelloffen, selbst gehostet, Apache 2.0. Keine überraschenden Preisänderungen, keine überraschenden Abschaltungen.

## Wo sie sich ähneln

- Beide nutzen Proof-of-Work als primären Mechanismus.
- Beide sind von Grund auf DSGVO- und CCPA-freundlich.
- Beide haben eine saubere, barrierearme Widget-UX ohne Bilderrätsel.

## Siehe auch

- [Live-Demo](../demo.md): Cap im Browser ausprobieren
- [Wie Cap Bots erkennt](../effectiveness.md): Proof-of-Work plus Instrumentation
- [Alle Alternativen](../alternatives.md): vollständige Funktionsmatrix
- [Beste CAPTCHA-Alternativen 2026](../best-captcha-alternatives.md): gemanagte und selbst gehostete Optionen im Ranking
