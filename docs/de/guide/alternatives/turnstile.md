---
title: Cap vs. Cloudflare Turnstile
description: "Cap vs. Cloudflare Turnstile: ein selbst gehostetes, anpassbares, quelloffenes CAPTCHA, das du vollständig kontrollierst. Kein Vendor-Lock-in, mit Proof-of-Work und Instrumentation."
---

# Cap vs. Cloudflare Turnstile

Turnstile ist Cloudflares kostenloser CAPTCHA-Ersatz. Er setzt auf unsichtbare Challenges, die sich stark auf Cloudflares Netzwerksignale und Browser-Fingerprinting stützen.

## Kurzes Fazit

Turnstile ist wirklich gut, wenn du ohnehin auf Cloudflare bist und akzeptierst, dass die Entscheidung bei ihnen liegt. Cap passt besser, wenn du Self-Hosting willst, deterministische Schwierigkeit, keine Abhängigkeit von Dritten und die Möglichkeit, Entscheidungen für deine eigenen Nutzer zu übersteuern.

## Wo Turnstile sinnvoll ist

- Du leitest deinen Traffic bereits über Cloudflare und willst in einem Ökosystem bleiben.
- Du willst nichts selbst hosten; Turnstile ist vollständig gemanagt.
- Du akzeptierst Cloudflares algorithmische Entscheidungen für "verdächtige" Besucher, ohne Möglichkeit zum Übersteuern.

## Wo Cap die bessere Wahl ist

- **Selbst gehostet.** Cap läuft auf deinen Servern. Bei Turnstile muss jede Challenge über Cloudflare laufen.
- **Die Policy gehört dir.** Entscheidet Cloudflares Algorithmus bei Turnstile, dass ein Nutzer verdächtig aussieht (häufig bei Brave, Librewolf, Tor oder VPN-Nutzern), gibt es kein Übersteuern. Cap legt den Schwierigkeitsregler in deine Hand.
- **Geringere Fehlerquote bei datenschutzbewussten Nutzern.** Es wird vielfach berichtet, dass Turnstile gehärtete Browser falsch einordnet. Caps Proof-of-Work interessieren Fingerprints nicht.
- **Open Source.** Apache 2.0, gegenüber dem Closed-Source-Client und -Server von Turnstile.
- **Keine Telemetrie.** Cap funkt nicht nach Hause und setzt keine Cookies. Turnstiles Client kommuniziert bei jedem Seitenaufruf mit `challenges.cloudflare.com`.
- **Anpassbar.** Cap bietet CSS-Variablen für Farben, Größe und Form. Turnstiles Iframe ist weitgehend fest.

## Wo sie sich ähneln

Beide liefern einen kleinen Client (~20-110 KB). Beide haben einen "unsichtbaren" Modus (bei Cap heißt er [Floating-Modus](../floating.md) oder [programmatischer Modus](../programmatic.md)). Beide legen Verhaltensprüfungen über eine primäre Challenge: Cap nennt sie [Instrumentation-Challenges](../instrumentation.md), Turnstile nennt sie "Managed Challenges".

## Migration

Die Form von Caps `/siteverify`-API ist zu Cloudflares `siteverify` kompatibel, die serverseitige Verifizierung ist also im Wesentlichen ein Tausch von URL und Secret. Clientseitig ersetzt du `<div class="cf-turnstile">` durch `<cap-widget>` und richtest es auf deine Cap-Instanz aus; vollständigen Code findest du im [Schnellstart](../index.md).

## Siehe auch

- [Live-Demo](../demo.md): Cap im Browser ausprobieren
- [Wie Cap Bots erkennt](../effectiveness.md): Proof-of-Work plus Instrumentation
- [Alle Alternativen](../alternatives.md): vollständige Funktionsmatrix
- [Beste CAPTCHA-Alternativen 2026](../best-captcha-alternatives.md): Turnstile, Cap und der Rest des Felds im Ranking
- [Bot-Schutz für mobile Formulare](../mobile-form-bot-protection.md): wo Fingerprint-Signale am stärksten versagen
