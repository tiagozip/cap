---
title: Cap vs. reCAPTCHA
description: "Cap vs. Google reCAPTCHA v2 und v3: eine datenschutzfreundliche, selbst gehostete, quelloffene Alternative. Kein Google-Tracking, keine Bilderrätsel, nur Proof-of-Work-Challenges."
---

# Cap vs. reCAPTCHA

reCAPTCHA ist Googles CAPTCHA-Dienst, verfügbar in zwei Hauptversionen: v2 ("Ich bin kein Roboter") und v3 (unsichtbar, score-basiert). Beide erfordern, dass Traffic-Daten an Google gehen.

## Kurzes Fazit

Wenn deine Seite nicht ohnehin für Analytics oder Login von Google abhängt, gibt es wenig Grund, bei reCAPTCHA zu bleiben. Cap erreicht für die allermeisten Anwendungsfälle dasselbe Schutzniveau, ohne Nutzer zu Google zu schicken, ohne Quoten pro Request und ohne Besucher durch Ampel-Rätsel zu zwingen, sobald Googles Risiko-Score sie nicht mag.

## Wo reCAPTCHA weiterhin sinnvoll ist

- Du bist bereits tief in Googles Identity-Stack integriert und willst eine Anbieterentscheidung weniger treffen.
- Du brauchst gezielt Googles verhaltensbasierten Risiko-Score (v3) und hast die Infrastruktur, um darauf zu reagieren.
- Dein Team will keinerlei Backend-Dienst betreiben, nicht einmal einen einzelnen Docker-Container.

## Wo Cap die bessere Wahl ist

- **Datenschutz.** reCAPTCHA lädt Skripte von `google.com` und schickt Nutzersignale an Google. Cap läuft vollständig auf deiner Infrastruktur und fügt deiner Seite nichts von Dritten hinzu.
- **Keine Bilderrätsel.** reCAPTCHA v2 wirft Nutzer regelmäßig in Ampel-, Hydranten- und Zebrastreifen-Rätsel. Für KI-Solver werden die immer leichter, für Menschen immer schwerer, besonders mobil oder für Nutzer mit VPN und Privacy-Browsern.
- **Bundle-Größe.** reCAPTCHAs Client wiegt über 500 KB. Caps Widget liegt bei etwa 20 KB.
- **Keine Quoten.** reCAPTCHA Enterprise rechnet pro Assessment ab. Cap hat keine Gebühr pro Request und läuft für die meisten Workloads auf einem 5-$-VPS.
- **Keine Aussperrung "verdächtiger" Nutzer.** v3 bestraft Nutzer von Tor, VPNs oder datenschutzfreundlichen Browsern still und leise. Bei Cap legst du die Schwierigkeit fest; der Nutzer hat immer einen Weg hindurch.
- **Open Source.** Apache 2.0. Prüfen, forken, deployen.

## Migration

Caps `/siteverify`-Endpunkt ist bewusst zur API-Form von reCAPTCHA kompatibel, die meisten serverseitigen Migrationen sind also ein einzelner URL-Tausch plus neues Secret. Clientseitig ersetzt du `<script src="https://www.google.com/recaptcha/api.js">` und `<div class="g-recaptcha">` durch Caps Widget; eine vollständige Anleitung findest du im [Schnellstart](../index.md).

Du kannst beide während der Umstellung auch parallel betreiben, indem du Cap an einem anderen Element einhängst und serverseitig beide Tokens prüfst, bis du sicher bist.

## Siehe auch

- [Live-Demo](../demo.md): Cap im Browser ausprobieren
- [Wie Cap Bots erkennt](../effectiveness.md): das Modell aus Proof-of-Work und Instrumentation
- [Alle Alternativen](../alternatives.md): vollständige Funktionsmatrix
- [Beste CAPTCHA-Alternativen 2026](../best-captcha-alternatives.md): jede reCAPTCHA-Alternative im Ranking
- [CAPTCHA und Conversion-Rate](../captcha-conversion-rate.md): was Rätselschleifen dich an Anmeldungen kosten
