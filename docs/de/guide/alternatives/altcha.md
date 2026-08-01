---
title: Cap vs. Altcha
description: "Cap vs. Altcha: zwei quelloffene, selbst gehostete Proof-of-Work-CAPTCHAs im Vergleich. Wie Cap Instrumentation-Challenges, ein Widget und ein Dashboard ergänzt."
---

# Cap vs. Altcha

Altcha ist im Geist das Cap am nächsten stehende Projekt: quelloffen, Proof-of-Work, kein Fingerprinting, keine Abhängigkeit von Dritten. Beide sind gute Optionen. Die Unterschiede liegen bei Funktionsumfang und Betriebsform.

Altcha hat außerdem ein kommerzielles Produkt namens **Altcha Sentinel**, das ML-basierte Bedrohungserkennung über das quelloffene Widget legt. Der folgende Vergleich bezieht sich überwiegend auf Cap und das quelloffene Altcha-Widget. Wenn du Sentinel erwägst, vergleichst du ein bezahltes SaaS mit einem selbst gehosteten OSS-Projekt, was eine andere Entscheidung ist.

## Kurzes Fazit

Willst du ein minimales, bibliotheksartiges PoW-CAPTCHA, das du in ein Node-Projekt einbaust und dann vergisst, ist das quelloffene Altcha großartig. Willst du einen schlüsselfertigen, selbst gehosteten Dienst mit Dashboard, Unterstützung mehrerer Site-Keys, Instrumentation-Challenges über dem PoW und einer UI, die den Lösefortschritt anzeigt (ohne für Sentinel zu zahlen), passt Cap besser.

## Wo Altcha sinnvoll ist

- Du willst eine winzige Integration rein als Bibliothek, ohne separaten Dienst.
- Du brauchst keine zweite Verifizierungsebene über den Proof-of-Work hinaus, oder du bist bereit, für Sentinel zu zahlen, um ML-basierte Erkennung zu bekommen.
- Du bist bereits mit Altcha integriert und die Migrationskosten überwiegen die unten genannten Unterschiede.

## Wo Cap die bessere Wahl ist

- **Zwei unabhängige Verifizierungsebenen, kostenlos.** Cap fährt Proof-of-Work *und* dynamische JavaScript-[Instrumentation-Challenges](../instrumentation.md) parallel, beides inklusive. Eine zu überwinden überwindet die andere nicht. Das quelloffene Altcha bietet nur PoW; die zweite (ML-basierte) Ebene erfordert das kostenpflichtige Sentinel.
- **Standalone-Server mit Dashboard, kostenlos.** Cap liefert ein Deployment in einem Docker-Container mit Web-Dashboard, Verwaltung mehrerer Site-Keys, Analytics und einem reCAPTCHA-kompatiblen siteverify-Endpunkt. Auf der Open-Source-Seite von Altcha musst du das selbst zusammenbauen; das Rundum-Erlebnis gibt es nur mit Sentinel.
- **Kleineres Widget.** Cap liegt bei etwa 20 KB. Altcha bei etwa 34 KB gzipped.
- **Fortschrittsanzeige.** Caps Widget meldet den Lösefortschritt als Prozentwert an den Nutzer, sinnvolles UX-Feedback während der kurzen Wartezeit.
- **Floating- und programmatischer Modus.** Cap kann sich komplett verstecken oder bis zum Absenden über einem Button schweben. Altchas Anzeigemodi sind einfacher gehalten.
- **Anpassbares Aussehen.** Cap bietet CSS-Variablen für Farben, Größe, Position und Icons. Altchas Anpassbarkeit ist begrenzter.

## Wo sie sich ähneln

- Beide sind quelloffen (Cap unter Apache 2.0, Altchas Widget unter MIT) und ohne Telemetrie.
- Beide fahren clientseitigen Proof-of-Work, um Missbrauch teuer zu machen.
- Beide kommen selbst gehostet ohne jeden Round-Trip zu Dritten aus.
- Beide sind von Grund auf DSGVO- und CCPA-freundlich.

## Siehe auch

- [Live-Demo](../demo.md): Cap im Browser ausprobieren
- [Wie Cap Bots erkennt](../effectiveness.md): Proof-of-Work plus Instrumentation
- [Alle Alternativen](../alternatives.md): vollständige Funktionsmatrix
- [Open-Source-CAPTCHA-Optionen](../open-source-captcha.md): Cap, ALTCHA, mCAPTCHA und Anubis im Vergleich
