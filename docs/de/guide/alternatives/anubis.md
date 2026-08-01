---
title: Cap vs. Anubis
description: "Cap vs. Anubis: Anubis hält Scraper site-weit fern, Cap ist ein selbst gehostetes, quelloffenes CAPTCHA für Formulare und Logins mit Proof-of-Work. Wann du was wählst."
---

# Cap vs. Anubis

Anubis ist ein Proof-of-Work-Abschreckungsmittel gegen Scraper, beliebt in Self-Hosting-Communities, um KI-Trainings-Crawler und aggressive Scraper am Edge zu blocken. Anubis und Cap teilen den Proof-of-Work-Kern, zielen aber auf unterschiedliche Probleme.

## Kurzes Fazit

Nimm **Anubis**, wenn du eine ganze Website oder einen Pfad auf Reverse-Proxy-Ebene gegen Bots und Scraper abriegeln willst, meist weil Crawler deine Bandbreite auffressen. Nimm **Cap**, wenn du eine bestimmte *Aktion* absichern willst (ein Formular, einen API-Aufruf, eine Kontoerstellung) und normales Browsen frei bleiben soll.

## Wo Anubis sinnvoll ist

- Du willst eine PoW-Mauer vor eine ganze Website oder einen Unterpfad setzen.
- Das Bedrohungsmodell ist massenhaftes Scraping oder bot-getriebene Request-Fluten am Edge.
- Es ist für dich in Ordnung, dass jeder Besucher vor jedem Seitenaufruf eine kleine Challenge löst.

## Wo Cap die bessere Wahl ist

- **Schutz pro Aktion, nicht pro Seitenaufruf.** Cap schützt Formulare, Anmeldungen, Kontaktseiten und API-Endpunkte, also genau dort, wo Missbrauch zu Kosten wird. Besucher surfen normal weiter.
- **Schwierigkeit pro Aktion.** Anubis' Challenge muss klein genug bleiben, um nicht jeden Seitenaufruf auszubremsen, was die mögliche Härte begrenzt. Cap wird pro Aktion konfiguriert, die Schwierigkeit kann bei Anmelde- oder Login-Formularen also höher liegen, ohne das Surfen zu stören.
- **Zwei Verifizierungsebenen.** Cap legt [Instrumentation-Challenges](../instrumentation.md) über den PoW, sodass selbst Bots, die den Proof-of-Work mit GPU beschleunigen, noch eine echte Browserumgebung vortäuschen müssen.
- **Standalone-Server mit Dashboard.** Cap liefert Analytics, Verwaltung mehrerer Site-Keys und einen reCAPTCHA-kompatiblen siteverify-Endpunkt ab Werk.
- **Widget-UX.** Cap ist dafür gedacht, für Menschen an einem Formular sichtbar zu sein: mit Checkbox, Fortschrittsanzeige und Markenfläche. Anubis ist ein transparentes Tor.

## Sie können koexistieren

Läuft Anubis bereits vor deiner Website als Crawler-Schutz, kannst du Cap trotzdem auf einzelnen wertvollen Formularen und API-Endpunkten innerhalb dieser Website einsetzen. Beide lösen unterschiedliche Probleme und stehen sich nicht im Weg.

## Siehe auch

- [Live-Demo](../demo.md): Cap im Browser ausprobieren
- [Wie Cap Bots erkennt](../effectiveness.md): Proof-of-Work plus Instrumentation
- [Alle Alternativen](../alternatives.md): vollständige Funktionsmatrix
- [Open-Source-CAPTCHA-Optionen](../open-source-captcha.md): Cap, ALTCHA, mCAPTCHA und Anubis im Vergleich
