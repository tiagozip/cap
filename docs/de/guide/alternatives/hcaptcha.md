---
title: Cap vs. hCaptcha
description: "Cap vs. hCaptcha: eine selbst gehostete, rätselfreie, quelloffene CAPTCHA-Alternative. Keine Bildraster, keine an Werbetreibende verkauften Daten, kostenlos in jeder Größenordnung dank Proof-of-Work."
---

# Cap vs. hCaptcha

hCaptcha ist der datenschutzpositionierte, rätselbasierte Konkurrent zu reCAPTCHA. Der kostenlose Tarif zeigt Bilderrätsel aggressiv; der bezahlte Pro-Tarif (99 $/Monat jährlich, 139 $/Monat monatlich, 100.000 Auswertungen) schaltet einen weitgehend passiven Modus und Analytics frei. Unter den großen CAPTCHAs geht es im Gratis-Plan am aggressivsten mit sichtbaren Rätseln um.

## Kurzes Fazit

Wenn du hCaptcha vor allem nutzt, weil du weg von Google wolltest, ist Cap der einfachere Schritt. Du tauschst Google nicht gegen einen anderen Dritten, du hast schlicht keinen Dritten mehr. Und du hörst auf, deinen Nutzern bei jedem Formular eine "Rätselsteuer" zu berechnen.

## Wo hCaptcha sinnvoll ist

- Du brauchst gezielt den Threat-Intel-Feed und das Risk-Scoring von hCaptcha Enterprise im großen Maßstab und hast das Budget dafür.
- Du bist bereits tief integriert und die Migrationskosten überwiegen den Nutzen.
- Dein Compliance-Programm verlangt für regulierte Aktionen ausdrücklich einen sichtbaren Rätselschritt zur Verifizierung.

## Wo Cap die bessere Wahl ist

- **Keine Bilderrätsel.** Die Abbruchrate bei hCaptcha-Rätseln liegt je nach Schwierigkeit zwischen **5 % und 15 %**. Das ist echte Conversion, die du bei Anmeldungen, Checkouts und Kontaktformularen verlierst. Cap zeigt nie ein Rätsel. (Der passive Modus von hCaptcha Pro reduziert das, ist aber kostenpflichtig.)
- **Bundle-Größe.** hCaptchas Client wiegt über 600 KB. Cap liegt bei etwa 20 KB, also rund 30-mal kleiner.
- **Keine Quote, keine Überschreitungskosten.** hCaptcha Pro startet bei 99 $/Monat für 100.000 Auswertungen und berechnet danach 0,99 $ je 1.000. Cap ist in jeder Größenordnung kostenlos, läuft auf einem 5-$-VPS, ohne Gebühr pro Request.
- **Selbst gehostet.** Keine Abhängigkeit von Dritten. Cap lädt nichts von `hcaptcha.com`.
- **Kein Fingerprinting.** hCaptcha stützt sich auf Browser-Fingerprints und Verhaltenssignale, was Nutzern von Privacy-Browsern schadet. Caps Proof-of-Work funktioniert unabhängig vom Browser gleich.
- **Open Source.** Apache 2.0. Prüfen, auf abgeschotteter Infrastruktur betreiben, forken.

## Wo sie sich ähneln

Beide fahren zusätzlich zur sichtbaren Challenge eine Instrumentation- bzw. Verhaltensebene. Beide bieten unsichtbare Modi. Beide funktionieren mit dem üblichen Formular-Absende-Muster.

## Migration

Caps `/siteverify` ist in der API-Form zu dem von hCaptcha kompatibel. Die meisten Backend-Änderungen sind ein URL-Tausch. Im Client ersetzt du `<div class="h-captcha">` und `https://js.hcaptcha.com/1/api.js` durch Caps `<cap-widget>`; siehe [Schnellstart](../index.md).

Willst du schrittweise migrieren, setze Cap zuerst auf neuen Formularen ein, lass hCaptcha auf den alten und beobachte den Conversion-Unterschied.

## Siehe auch

- [Live-Demo](../demo.md): Cap im Browser ausprobieren
- [Wie Cap Bots erkennt](../effectiveness.md): Proof-of-Work plus Instrumentation
- [Alle Alternativen](../alternatives.md): vollständige Funktionsmatrix
- [CAPTCHA und Conversion-Rate](../captcha-conversion-rate.md): die ganze Rechnung hinter der Rätselsteuer
- [Beste CAPTCHA-Alternativen 2026](../best-captcha-alternatives.md): rätselfreie Optionen im Ranking
