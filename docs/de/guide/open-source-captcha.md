---
title: "Die besten Open-Source-CAPTCHA-Optionen 2026"
description: "Die besten quelloffenen, selbst gehosteten CAPTCHA-Optionen für Entwickler im Vergleich: Cap, ALTCHA, mCAPTCHA und Anubis, mit Lizenzen, Architektur und Auswahlhilfe."
faq:
  - q: Was ist das beste Open-Source-CAPTCHA?
    a: "Cap, wenn du einen kompletten Stack willst: zwei Verifizierungsebenen, Dashboard, kompatible siteverify-API. ALTCHA, wenn du eine minimale Bibliothek willst."
  - q: Kann ich ein CAPTCHA selbst hosten?
    a: "Ja, und es ist einfacher, als es klingt. Cap läuft als ein Docker-Container plus Valkey, passt auf einen 5-$-VPS und ist in etwa fünf Minuten eingerichtet."
  - q: Ist Cap kostenlos?
    a: "Vollständig. Apache 2.0, keine Quoten, kein bezahlter Tarif, bei jedem Volumen."
  - q: Ist Cap besser als ALTCHA?
    a: "Cap bringt mehr mit (Instrumentation-Ebene, Standalone-Server, Dashboard, Fortschritts-UX, kleineres Widget); ALTCHA bringt absichtlich weniger mit. Entscheide danach, wie viel du selbst bauen willst."
  - q: Schützt ein Open-Source-CAPTCHA die Privatsphäre?
    a: "Es macht Datenschutz überprüfbar statt versprochen. Selbst gehosteter Proof-of-Work braucht kein Fingerprinting, keine Verhaltensprofile und keine Drittanbieter-Aufrufe, und du kannst es im Code nachlesen."
---

# Die besten Open-Source-CAPTCHA-Optionen 2026

**Kurz gesagt:** Cap ist eine kostenlose, quelloffene, selbst gehostete CAPTCHA-Alternative unter Apache 2.0, die Proof-of-Work und [Instrumentation-Challenges](./instrumentation.md) statt visueller Rätsel nutzt. Die anderen ernstzunehmenden Open-Source-Optionen sind **ALTCHA** (minimale PoW-Bibliothek), **mCAPTCHA** (PoW, vor 1.0 und langsam in der Entwicklung) und **Anubis** (PoW-Mauer gegen Scraper für ganze Seiten statt für Formulare).

## Was macht ein CAPTCHA quelloffen?

Ein öffentliches Widget-Repo allein reicht nicht. Bei Bot-Schutz bedeutet "quelloffen" nur dann etwas, wenn du die entscheidungstragenden Teile prüfen und selbst betreiben kannst:

- **Client- und Servercode veröffentlicht** unter einer OSI-Lizenz, damit die Challenge-Logik keine Blackbox ist.
- **Selbst hostbare Verifizierung**, damit das Durchlassen oder Ablehnen eines Nutzers nie davon abhängt, dass die API eines Anbieters läuft, ehrlich oder bezahlbar ist.
- **Kein verstecktes Nach-Hause-Funken**, was du überprüfen kannst, weil du den Code liest.

Mehrere kommerzielle CAPTCHAs stellen ihre Client-Integrationen quelloffen und behalten den Server proprietär (etwa FriendlyCaptcha). Das ist Source-available-Bequemlichkeit, kein Open-Source-CAPTCHA: Die Entscheidungs-Engine bleibt eine Blackbox, die du mietest.

## Warum ein CAPTCHA selbst hosten?

- **Datenschutz, den du belegen kannst.** Besucherdaten erreichen nie einen Anbieter, was Antworten zu DSGVO und CCPA einfach macht. Siehe [Compliance](./compliance.md).
- **Keine Quoten und keine Gebühren pro Request.** Traffic-Spitzen und Bot-Fluten werden nicht zu Rechnungen.
- **Kein Anbieterrisiko.** Keine überraschenden Preisänderungen, keine Abkündigungen, kein Übernahme-Schock.
- **Kontrolle.** Du legst die Challenge-Schwierigkeit pro Site-Key fest, statt dem Urteil eines fremden Modells über deine Nutzer zu vertrauen.
- **Verfügbarkeit.** Deine Formulare brechen nicht, wenn ein fremder Challenge-Endpunkt ausfällt.

## Die Optionen

### Cap

Cap ist ein vollständiger Open-Source-CAPTCHA-Stack unter Apache 2.0: ein Widget als Web Component mit etwa 20 KB plus [Cap Standalone](./standalone/index.md), ein kleines Docker-Deployment (ein Container plus Valkey) mit REST-API, einem Dashboard zur Verwaltung mehrerer Site-Keys und einem `/siteverify`-Endpunkt, der zur API-Form von reCAPTCHA kompatibel ist.

Der Schutz kommt aus zwei unabhängigen Ebenen: SHA-256-Proof-of-Work (mit experimentellen, GPU-resistenten [RSW-Time-Locks](./rsw.md)) und dynamischen [Instrumentation-Challenges](./instrumentation.md), die prüfen, dass die Umgebung ein echter Browser ist. Eine Ebene zu überwinden überwindet die andere nicht.

Willst du lieber einbetten als deployen: [capjs-core](./capjs-core.md) ist Caps zustandslose Server-Bibliothek. Sie erzeugt und verifiziert Challenges innerhalb deines eigenen Dienstes und läuft auf Cloudflare Workers, Lambda und anderen Edge-Umgebungen ohne persistenten Speicher.

- **Lizenz:** Apache 2.0, Client und Server
- **Mechanismus:** Proof-of-Work plus Instrumentation
- **Deployment:** Docker-Container plus CDN oder selbst gehostetes Widget
- **Am besten für:** Teams, die einen schlüsselfertigen, selbst gehosteten CAPTCHA-Dienst mit echter UX wollen

### ALTCHA

ALTCHA ist ein minimales, gut gepflegtes Proof-of-Work-Widget (MIT), das du an dein eigenes Backend anbindest. Kein Dashboard, kein Standalone-Server in der Open-Source-Stufe; die zweite, ML-basierte Ebene gehört zum kostenpflichtigen Produkt Sentinel.

- **Lizenz:** MIT (Widget)
- **Mechanismus:** Proof-of-Work
- **Am besten für:** Entwickler, die eine kleine Bibliothek wollen und die Serverseite gern selbst bauen

[Vollständiger Vergleich: Cap vs. ALTCHA →](./alternatives/altcha.md)

### mCAPTCHA

mCAPTCHA hat dieselbe Idee variabler PoW-Schwierigkeit vorangebracht. Es ist vollständig quelloffen (der Kern unter AGPL-3.0, die Client-Bibliotheken unter permissiven Lizenzen), aber weiterhin vor 1.0 mit langsamer Release-Kadenz, und sein Widget-Bundle ist größer als das von Cap oder ALTCHA. Zum Studieren gut, aber wäge die Reife ab, bevor du darauf aufbaust.

### Anubis

Anubis ist eine quelloffene Proof-of-Work-*Scraper-Mauer*: Sie riegelt eine ganze Website oder einen Pfad auf Reverse-Proxy-Ebene ab, vor allem gegen KI-Crawler. Es ist kein Formular-CAPTCHA und bringt keinen eigenständigen Verifizierungsserver mit, lässt sich aber gut mit einem kombinieren. Du kannst Anubis vor eine Website stellen und Cap auf den wertvollen Formularen darin einsetzen.

[Vollständiger Vergleich: Cap vs. Anubis →](./alternatives/anubis.md)

## Gegenüberstellung

| | Cap | ALTCHA | mCAPTCHA | Anubis |
| :-- | :-- | :-- | :-- | :-- |
| Lizenz | Apache 2.0 | MIT (Widget) | AGPL | MIT |
| Aktiv gepflegt | ✅ | ✅ | 🟨 vor 1.0, langsame Releases | ✅ |
| Mechanismus | PoW plus Instrumentation | PoW | PoW | PoW |
| Geltungsbereich | Pro Aktion (Formulare, APIs) | Pro Aktion | Pro Aktion | Ganze Website |
| Standalone-Server plus Dashboard | ✅ | ❌ | ✅ | ❌ |
| reCAPTCHA-kompatibles siteverify | ✅ | ❌ | ❌ | ❌ |
| Widget-Größe | ~20 KB | ~34 KB | größer | entfällt (transparent) |
| GPU-resistente PoW-Option | ✅ [RSW](./rsw.md) | ❌ | ❌ | ❌ |

## Wie du wählst

- **Willst du einen Dienst, den du einmal deployst und im Dashboard verwaltest?** Cap. [Schnellstart →](./index.md)
- **Willst du die kleinstmögliche Abhängigkeit und baust den Backend-Kleber selbst?** Caps Bibliothek [capjs-core](./capjs-core.md) oder ALTCHA.
- **Kämpfst du gegen Scraper auf einer ganzen Website statt gegen Formular-Spam?** Anubis, optional mit Cap auf den Formularen.
- **Wechselst du von reCAPTCHA oder hCaptcha?** Caps kompatibles siteverify macht daraus einen URL-Tausch. [Migrationsanleitung →](./alternatives/migrate-from-recaptcha.md)

## FAQ

### Was ist das beste Open-Source-CAPTCHA?

Cap, wenn du einen kompletten Stack willst: zwei Verifizierungsebenen, Dashboard, kompatible siteverify-API. ALTCHA, wenn du eine minimale Bibliothek willst.

### Kann ich ein CAPTCHA selbst hosten?

Ja, und es ist einfacher, als es klingt. Cap läuft als ein Docker-Container plus Valkey, passt auf einen 5-$-VPS und ist in etwa fünf Minuten eingerichtet.

### Ist Cap kostenlos?

Vollständig. Apache 2.0, keine Quoten, kein bezahlter Tarif, bei jedem Volumen.

### Ist Cap besser als ALTCHA?

Cap bringt mehr mit (Instrumentation-Ebene, Standalone-Server, Dashboard, Fortschritts-UX, kleineres Widget); ALTCHA bringt absichtlich weniger mit. Entscheide danach, wie viel du selbst bauen willst.

### Schützt ein Open-Source-CAPTCHA die Privatsphäre?

Es macht Datenschutz überprüfbar statt versprochen. Selbst gehosteter PoW braucht kein Fingerprinting, keine Verhaltensprofile und keine Drittanbieter-Aufrufe, und du kannst es im Code nachlesen.

## Siehe auch

- [Beste CAPTCHA-Alternativen 2026](./best-captcha-alternatives.md): inklusive des Closed-Source-Felds
- [Funktionsvergleich](./alternatives.md): die vollständige Matrix
- [Wie funktioniert Cap?](./workings.md): die Architektur im Detail
- [Live-Demo](./demo.md): das Widget ausprobieren
