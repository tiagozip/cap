---
title: Über Cap
description: "Wer Cap baut, die quelloffene, selbst gehostete CAPTCHA-Alternative: Maintainer, Geschichte, Lizenz, Finanzierung und Kontaktmöglichkeiten."
sidebar: false
---

# Über Cap

**Kurz gesagt:** Cap ist eine kostenlose, quelloffene CAPTCHA-Alternative, die Bilderrätsel durch Proof-of-Work- und Instrumentation-Challenges ersetzt. Es steht unter der Apache-2.0-Lizenz und läuft vollständig auf deiner eigenen Infrastruktur, sodass Besucherdaten nie zu Dritten gelangen.

## Was ist Cap?

Cap ist Bot-Schutz, den du lesen, prüfen und selbst hosten kannst:

- Ein **~20 KB großes Widget**, das statt Bilderrätseln eine einzelne Checkbox rendert.
- Ein **Standalone-Server**, der als ein einziger Docker-Container mit Dashboard und Unterstützung für mehrere Site-Keys ausgeliefert wird.
- **Server-Bibliotheken** (`@cap.js/server` und Community-Portierungen), um Challenges im eigenen Backend zu verifizieren.
- Eine **zu reCAPTCHA und hCaptcha kompatible siteverify-API**, sodass die Migration größtenteils ein URL-Tausch ist.

Der vollständige Quellcode liegt unter [github.com/tiagozip/cap](https://github.com/tiagozip/cap) und steht unter der [Apache-2.0-Lizenz](https://www.apache.org/licenses/LICENSE-2.0).

## Warum gibt es Cap?

Gängige CAPTCHAs verhören ihre Nutzer entweder mit Rätseln oder profilieren sie mit Fingerprinting und Risk-Scores, und beide Ansätze leiten die Daten deiner Besucher über einen Anbieter. Cap bezieht eine andere Position:

- **Deterministisch, nicht urteilend.** Jeder echte Nutzer hat einen garantierten Weg hindurch; kein Klassifikator kann jemanden stillschweigend ablehnen, weil er ein VPN oder einen Privacy-Browser benutzt.
- **Selbst gehostet, nicht gemietet.** Die Verifizierung passiert auf deinen Servern, was Antworten zu DSGVO und CCPA einfach macht. Siehe [Compliance](./guide/compliance.md).
- **Offen, nicht versprochen.** Datenschutzaussagen sind überprüfbar, weil der Code, der die Entscheidungen trifft, öffentlich ist.

## Kontakt

- Bugs und Feature-Wünsche: [GitHub Issues](https://github.com/tiagozip/cap/issues)
- Sicherheitsmeldungen und alles Weitere: [hi@tiago.zip](mailto:hi@tiago.zip)
