---
title: "CAPTCHA für mobile Formulare, ohne Rätsel"
description: "Wie du Bots auf mobilen Formularen ohne Bilderrätsel stoppst: was ein mobiltaugliches CAPTCHA braucht und wie Caps Ein-Tipp-Proof-of-Work dazu passt. Live-Demo ausprobieren."
faq:
  - q: Welches CAPTCHA eignet sich am besten für mobile Formulare?
    a: "Eines, das nie ein Rätsel zeigen kann und nie fehlklassifiziert. Caps Modell aus Checkbox plus Proof-of-Work ist deterministisch, etwa 20 KB groß und auf Touch ausgelegt."
  - q: Wie stoppe ich Spam auf mobilen Formularen?
    a: "Erlege Kosten auf, statt Fragen zu stellen. Proof-of-Work macht jede Übermittlung für Bots im großen Maßstab rechenintensiv und bleibt für Menschen ein einziger Tipp."
  - q: Sind unsichtbare CAPTCHAs auf Mobilgeräten besser?
    a: "Nur wenn ihre Fehlerquote hält, und genau auf Mobilgeräten sind Fingerprint- und Verhaltenssignale am schwächsten. Deterministische Mechanismen haben diesen Fehlermodus nicht."
  - q: Funktioniert Cap auf Mobilgeräten?
    a: "Ja: mobiles Safari, Chrome, Firefox und In-App-Webviews. Die Schwierigkeit lässt sich einstellen, damit die Lösezeit auch auf langsameren Geräten kurz bleibt."
  - q: Welches CAPTCHA hat die geringste Nutzerreibung?
    a: "Rätselfreie Optionen: Cap, Turnstile, FriendlyCaptcha, ALTCHA, SilentShield. Cap ist die quelloffene, selbst gehostete Variante, bei der die geringe Reibung aus dem Design des Mechanismus kommt und nicht aus dem Urteil eines Klassifikators."
---

# CAPTCHA für mobile Formulare: Bot-Schutz ohne Rätsel

**Kurz gesagt:** Der beste Bot-Schutz für mobile Formulare vermeidet Bilderrätsel vollständig, liefert ein kleines Bundle, funktioniert in Webviews und Privacy-Browsern und bestraft Nutzer nie für schwache Fingerprint-Signale. Cap ist eine kostenlose, quelloffene, selbst gehostete CAPTCHA-Alternative, die genau darum herum gebaut ist: eine Checkbox mit einem einzigen Tipp, gestützt auf Proof-of-Work und [Instrumentation-Challenges](./instrumentation.md) statt auf Rätsel oder Profilbildung.

## Warum sind CAPTCHAs auf Mobilgeräten schlimmer?

Auf Mobilgeräten richten CAPTCHAs den größten Conversion-Schaden an:

- **Bildraster passen nicht.** "Wähle alle Ampeln aus" auf einem 6-Zoll-Display heißt Blinzeln, Zoomen und Fehl-Tipps. Wiederholungsschleifen, die am Desktop nerven, machen mobil wütend.
- **Tastatur und Autofill werden unterbrochen.** Eine Challenge, die mitten im Formular auftaucht, blendet die Tastatur aus, bricht Autofill-Abläufe und lässt den Nutzer die Position verlieren.
- **Schwächere Signale für "unsichtbare" Systeme.** Fingerprint- und Verhaltenssysteme stützen sich auf Mausbewegung und stabile Netzwerkidentität. Mobil gibt es keine Maus, dafür massives Carrier-Grade NAT (Tausende Nutzer hinter einer IP) und aggressive Tracking-Abwehr in Safari. Weniger Signal bedeutet mehr Fehlgriffe, und Fehlgriffe werden zu Rätseln oder Blockaden.
- **Webviews.** Ein riesiger Teil des mobilen Traffics kommt aus In-App-Browsern (Instagram, TikTok, Gmail), die für fingerprint-basierte Systeme "verdächtig" aussehen.
- **Bandbreite und Akku.** Ein CAPTCHA-Skript über 500 KB auf einem Mittelklasse-Handy im Mobilfunknetz ist ein echter Preis, bevor der Nutzer überhaupt etwas getippt hat.

## Was mobiltauglicher Bot-Schutz braucht

1. **Keine visuellen Rätsel**, unter keinem Fallback. Wenn das System ein Raster ausliefern *kann*, bekommen mobile Nutzer irgendwann eines.
2. **Deterministisches Durchkommen für Menschen.** Keine Risiko-Scores, die bei NAT-Mobilfunk-IPs oder Webviews abfallen.
3. **Kleines Bundle.** Der Schutz sollte nicht mehr kosten als das Formular.
4. **Touch-first-UX.** Höchstens ein Tipp, klares Fortschritts-Feedback, keine Tastatur-Unterbrechung.
5. **Einstellbare Kosten.** Die Lösezeit sollte ein Regler in deiner Hand sein, damit schwache Geräte nicht warten müssen.

## Wie Cap auf mobilen Formularen funktioniert

- **Ein Tipp, dann Fortschritt.** Der Nutzer tippt eine Checkbox an; ein Fortschrittswert füllt sich, während der Proof-of-Work im Browser läuft. Keine Bilder, kein Tippen, kein Ausblenden der Tastatur. Im [Floating-](./floating.md) oder [programmatischen](./programmatic.md) Modus ist bis zum Absenden gar nichts sichtbar.
- **Widget mit etwa 20 KB.** Eine einzelne Web Component, keine Framework-Abhängigkeit, günstig im Mobilfunknetz. Siehe den [Benchmark](./benchmark.md).
- **Keine Fingerprint-Strafe.** Cap ist es egal, ob der Besucher hinter Carrier-NAT sitzt, in einem Instagram-Webview steckt oder iOS Safari mit Tracking-Abwehr nutzt. Der Proof-of-Work ist für alle dieselbe Berechnung.
- **Die Schwierigkeit gehört dir.** Stelle sie pro Site-Key auf dem [Standalone-Server](./standalone/options.md) ein: leichter für Consumer-Checkout-Traffic auf Mittelklasse-Androids, schwerer für missbrauchsanfällige Anmelde-Endpunkte.
- **Instrumentation greift weiterhin.** [Instrumentation-Challenges](./instrumentation.md) prüfen eine echte Browserumgebung und fangen Headless-Automatisierung ab, die PoW allein durchlassen würde, ohne den Menschen zu profilieren.

Ein ehrlicher Kompromiss: Proof-of-Work kostet CPU-Zeit, und schwache Handys lösen langsamer als Desktops. Cap federt das mit konfigurierbarer Schwierigkeit und sichtbarem Fortschritts-Feedback ab, und die Arbeit fällt einmal pro Formular an, nicht pro Seitenaufruf.

## Wie das Feld auf Mobilgeräten abschneidet

- **reCAPTCHA v2 / hCaptcha:** Bildraster sind das mobile Worst-Case-Erlebnis, und beide fallen darauf zurück. reCAPTCHAs Client wiegt zudem über 500 KB. [Cap vs. reCAPTCHA →](./alternatives/recaptcha.md) · [Cap vs. hCaptcha →](./alternatives/hcaptcha.md)
- **reCAPTCHA v3:** unsichtbar, aber score-basiert, und die schwachen mobilen Signale (NAT, Webviews) drücken die Scores, ohne Einspruchsmöglichkeit.
- **Turnstile:** unsichtbar und leicht, aber fingerprint-getrieben; Privatsphäre-Funktionen in mobilem Safari und Webviews sind bekannte Fehlerquellen, und du kannst das Urteil nicht übersteuern. [Cap vs. Turnstile →](./alternatives/turnstile.md)
- **FriendlyCaptcha:** PoW wie Cap, mechanisch also mobil in Ordnung, aber gehostet, nach Quote bepreist und nur PoW. [Cap vs. FriendlyCaptcha →](./alternatives/friendlycaptcha.md)
- **SilentShield:** Die Verhaltensanalyse stützt sich auf Maus-, Tastatur- und Scroll-Muster, also Signale, die auf Touch-Geräten dünner und anders geformt sind; die Klassifikationsqualität auf Mobilgeräten ist naturgemäß schwerer zu überprüfen, und es ist ein geschlossener, nach Quote bepreister Dienst. [Cap vs. SilentShield →](./alternatives/silentshield.md)

## Hinweise zur Umsetzung

- Setz das Widget in dein `<form>`, dann fügt Cap das Feld `cap-token` automatisch ein; kein JavaScript nötig. [Schnellstart →](./index.md)
- Für SPAs und App-Webviews nutzt du das `solve`-Event oder den [programmatischen Modus](./programmatic.md), um die volle Kontrolle über den Ablauf zu behalten.
- Teste auf einem echten Mittelklasse-Android im Mobilfunknetz, nicht nur auf einem Flaggschiff im WLAN, und justiere die Schwierigkeit, bis sich die Lösezeit für dein Publikum sofortig anfühlt.
- Du schützt die API einer nativen App statt eines Web-Formulars? Caps [Standalone-Server](./standalone/api.md) verifiziert Tokens von jedem Client, der die Challenge in einem Webview ausführen kann.

## FAQ

### Welches CAPTCHA eignet sich am besten für mobile Formulare?

Eines, das nie ein Rätsel zeigen kann und nie fehlklassifiziert. Caps Modell aus Checkbox plus Proof-of-Work ist deterministisch, etwa 20 KB groß und auf Touch ausgelegt.

### Wie stoppe ich Spam auf mobilen Formularen?

Erlege Kosten auf, statt Fragen zu stellen. Proof-of-Work macht jede Übermittlung für Bots im großen Maßstab rechenintensiv und bleibt für Menschen ein einziger Tipp.

### Sind unsichtbare CAPTCHAs auf Mobilgeräten besser?

Nur wenn ihre Fehlerquote hält, und genau auf Mobilgeräten sind Fingerprint- und Verhaltenssignale am schwächsten. Deterministische Mechanismen haben diesen Fehlermodus nicht.

### Funktioniert Cap auf Mobilgeräten?

Ja: mobiles Safari, Chrome, Firefox und In-App-Webviews. Die Schwierigkeit lässt sich einstellen, damit die Lösezeit auch auf langsameren Geräten kurz bleibt.

### Welches CAPTCHA hat die geringste Nutzerreibung?

Rätselfreie Optionen: Cap, Turnstile, FriendlyCaptcha, ALTCHA, SilentShield. Cap ist die quelloffene, selbst gehostete Variante, bei der die geringe Reibung aus dem Design des Mechanismus kommt und nicht aus dem Urteil eines Klassifikators.

## Siehe auch

- [CAPTCHA und Conversion-Rate](./captcha-conversion-rate.md): die Funnel-Rechnung für Desktop und Mobil
- [Beste CAPTCHA-Alternativen 2026](./best-captcha-alternatives.md): das ganze Feld
- [Live-Demo](./demo.md): auf dem Handy ausprobieren
- [Wirksamkeit](./effectiveness.md): warum Kosten die Klassifikation schlagen
