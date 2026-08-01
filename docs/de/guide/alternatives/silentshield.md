---
title: Cap vs. SilentShield
description: "Cap vs. SilentShield: quelloffenes, selbst gehostetes Proof-of-Work-CAPTCHA gegen einen gehosteten Dienst zur verhaltensbasierten Bot-Erkennung. Datenschutz, Preise und Kontrolle im Vergleich."
faq:
  - q: Ist Cap besser als SilentShield?
    a: "Für Teams, die ein quelloffenes, selbst gehostetes CAPTCHA ohne Gebühren pro Request und mit voller Kontrolle über Schwierigkeit und Daten wollen, ist Cap die stärkere Wahl. SilentShield passt zu Teams, die einen gemanagten, unsichtbaren Dienst mit Verhaltensanalyse wollen und mit einer Request-Quote sowie einer Abhängigkeit von Dritten leben können."
  - q: Ist Cap quelloffen?
    a: "Ja. Cap ist vollständig quelloffen unter der Apache-2.0-Lizenz, inklusive Widget, Server und dem Standalone-Docker-Deployment."
  - q: Ist SilentShield quelloffen?
    a: "Nein. SilentShield ist ein gehosteter Closed-Source-Dienst. Seine Erkennungslogik läuft auf den Servern von SilentShield und lässt sich weder prüfen noch selbst hosten."
  - q: Was eignet sich besser zum Selbst-Hosten?
    a: "Cap. Es kommt als kleines Docker-Deployment, das du auf eigener Infrastruktur betreibst, ganz ohne Round-Trip zu Dritten. SilentShield bietet keine Self-Hosting-Option."
  - q: Was ist besser für datenschutzorientierte Teams?
    a: "Cap behält alles auf deinen Servern: keine Cookies, kein Verhaltensprofil, keine Daten an einen Anbieter. SilentShield ist DSGVO-orientiert mit EU-Servern, aber sein Modell beruht darauf, Interaktionsmuster der Nutzer auf einem Drittdienst zu analysieren."
---

# Cap vs. SilentShield

**Kurz gesagt:** Cap ist die bessere Wahl, wenn du ein quelloffenes (Apache 2.0), selbst gehostetes CAPTCHA ohne Request-Quoten willst: Es ist bei jedem Volumen kostenlos und erlegt Kosten auf, die Bots nicht umgehen können. SilentShield ist ein gehosteter Closed-Source-Dienst mit verhaltensbasierter Bot-Erkennung, kostenlos bis 500 Requests pro Monat und ab 9 €/Monat für 5.000. Es passt zu WordPress-Seiten, die ein gemanagtes, unsichtbares Plugin wollen.

SilentShield ist ein gehosteter, unsichtbarer Bot-Schutz des deutschen Unternehmens Forge12. Es erkennt Bots über Verhaltensanalyse: Ein KI-Modell bewertet Mausbewegung, Tastatureingabe, Scroll-Verhalten und Interaktions-Timing, sodass die meisten Nutzer nie eine Challenge sehen. Über sein Plugin für Contact Form 7, WPForms und Elementor ist es im WordPress-Ökosystem beliebt.

Cap ist eine kostenlose, quelloffene, selbst gehostete CAPTCHA-Alternative, die Bilderrätsel durch Proof-of-Work und [Instrumentation-Challenges](../instrumentation.md) ersetzt. Die beiden verfolgen grundverschiedene Ansätze: SilentShield rät anhand deines Verhaltens, ob du ein Mensch bist; Cap macht Automatisierung teuer, egal wie gut ein Bot einen Menschen imitiert.

## Kurzes Fazit

Cap ist die bessere Wahl für Teams, die ein quelloffenes, selbst gehostetes CAPTCHA ohne Request-Quoten, mit deterministischer Schwierigkeit und voller Kontrolle über die Nutzerdaten wollen. SilentShield kann zu WordPress-Seiten passen, die ein gemanagtes, konfigurationsfreies, unsichtbares Produkt wollen und deren Traffic in einen bezahlten Tarif passt. Der Kern des Trade-offs: SilentShields Urteile fällt ein geschlossenes Modell auf fremden Servern; Caps Challenges laufen auf deinen, und du setzt die Regeln.

## Vergleich

| | Cap | SilentShield |
| :-- | :-- | :-- |
| Quelloffen | ✅ Apache 2.0, Client und Server | ❌ Closed-Source-Dienst |
| Selbst gehostet | ✅ Docker (ein Container plus Valkey) | ❌ Nur gehostet (EU-Server) |
| Kostenlos nutzbar | ✅ Bei jedem Volumen | 🟨 Kostenlos bis 500 Requests/Monat |
| Gebühren pro Request | ✅ Keine | ❌ Gestaffelt: 9 €/Mon. für 5.000, 29 €/Mon. für 25.000 Requests |
| Primärer Mechanismus | Proof-of-Work plus Instrumentation | Verhaltensanalyse (Maus, Tastatur, Scrollen, Timing) |
| Deterministische Schwierigkeit | ✅ Du legst sie fest, pro Site-Key | ❌ Das Modell entscheidet |
| Prüfbare Erkennungslogik | ✅ Code lesbar | ❌ Proprietär |
| Daten verlassen deine Infrastruktur | ✅ Nie | ❌ Interaktionssignale werden von SilentShield verarbeitet |
| Funktioniert ohne Verhaltensprofil | ✅ | ❌ Verhaltenssignale sind das Produkt |
| Widget-Anpassung | ✅ CSS-Variablen für Farben, Größe, Form | entfällt (standardmäßig unsichtbar) |
| reCAPTCHA-kompatibles siteverify | ✅ | ❌ |
| WordPress-Plugin | Community-Integrationen | ✅ Erstanbieter (CF7, WPForms, Elementor, WooCommerce) |

## Wo SilentShield sinnvoll ist

- Du betreibst eine WordPress-Seite und willst ein Plug-and-play-Plugin, ohne selbst zu hosten.
- Du willst vollständig unsichtbaren Schutz und akzeptierst, dass ein fremdes Modell über Durchlassen oder Blocken entscheidet.
- Dein Formularvolumen passt bequem in einen bezahlten Tarif und das Quotenmodell stört dich nicht.
- EU-Verarbeitung (Server in Deutschland) erfüllt deine Compliance-Anforderungen.

## Wo Cap die bessere Wahl ist

- **Quelloffen, von vorn bis hinten.** Cap steht unter Apache 2.0: Widget, Server, Dashboard. Du kannst genau prüfen, was in den Browsern deiner Nutzer und auf deinen Servern läuft. SilentShields Erkennung ist konstruktionsbedingt eine Blackbox.
- **Selbst gehostet, keine Quoten.** Cap läuft auf deiner Infrastruktur (ein 5-$-VPS deckt die meisten Seiten ab), ohne Gebühren pro Request und ohne monatliche Obergrenze. SilentShields kostenloser Tarif liegt bei 500 Requests/Monat, was belebtere Formulare schnell überschreiten.
- **Das Urteil gehört dir.** Verhaltenssysteme liefern einen Score, und wenn das Modell danebenliegt, gibt es für dich keinen Regler. Caps Schwierigkeit ist deterministisch und pro Site-Key konfigurierbar: Du entscheidest, wie teuer eine Challenge ist, und jeder Nutzer hat einen garantierten Weg hindurch.
- **Kostenbasiert statt ratebasiert.** Verhaltensanalyse ist ein Klassifikationsproblem, und Bots, die aufgezeichnete menschliche Eingaben abspielen oder Browser-Automatisierung mit vermenschlichten Cursorbewegungen nutzen, greifen den Klassifikator direkt an. Caps Proof-of-Work erzeugt reale Rechenkosten, die auch gegen einen sich perfekt verhaltenden Bot bestehen, und [Instrumentation-Challenges](../instrumentation.md) legen eine zweite, unabhängige Ebene darüber.
- **Kein Dritter im Request-Pfad.** Mit Cap geht nichts über deine Besucher an einen Anbieter, weder Interaktionsmuster noch IPs. SilentShield ist DSGVO-orientiert und EU-gehostet, aber das Modell verlangt weiterhin, Interaktionssignale an ihre Server zu schicken.
- **Migration im Vorbeigehen.** Caps `/siteverify`-Endpunkt ist zur API-Form von reCAPTCHA kompatibel und passt daher mit einem URL-Tausch in bestehenden Verifizierungscode.

## Wo sie sich ähneln

- Beide verzichten komplett auf Bilderrätsel: keine Ampeln, keine Zebrastreifen, kein verzerrter Text.
- Beide sind mit Blick auf die DSGVO gebaut und setzen keine Tracking-Cookies.
- Beide liefern einen kleinen Client (SilentShield gibt unter 10 KB an, Caps Widget liegt bei etwa 20 KB).
- Beide zielen auf ein nahezu unsichtbares Erlebnis für legitime Nutzer.

## Datenschutz und Datenkontrolle

SilentShield bewirbt eine bessere Datenschutzposition als reCAPTCHA: EU-Server, Verarbeitung ausschließlich in der EU und pseudonymisierte Daten, so die eigenen Angaben von Forge12. Die Architektur setzt aber weiterhin voraus, zu beobachten und zu verarbeiten, wie jeder Besucher die Maus bewegt, tippt und scrollt, auf Infrastruktur, die du nicht kontrollierst. Cap umgeht die Frage: Es gibt kein Verhaltensprofil, weil der Mechanismus keines braucht, und es gibt keinen Anbieter, weil du der Host bist. Eine vollständige Aufschlüsselung der Regelwerke, um die herum Cap gebaut ist, findest du unter [Compliance](../compliance.md).

## FAQ

### Ist Cap besser als SilentShield?

Für Teams, die ein quelloffenes, selbst gehostetes CAPTCHA ohne Gebühren pro Request und mit voller Kontrolle über Schwierigkeit und Daten wollen, ist Cap die stärkere Wahl. SilentShield passt zu Teams, die einen gemanagten, unsichtbaren Dienst mit Verhaltensanalyse wollen und mit einer Request-Quote sowie einer Abhängigkeit von Dritten leben können.

### Ist Cap quelloffen?

Ja. Cap ist vollständig quelloffen unter der Apache-2.0-Lizenz, inklusive Widget, Server und dem Standalone-Docker-Deployment.

### Ist SilentShield quelloffen?

Nein. SilentShield ist ein gehosteter Closed-Source-Dienst. Seine Erkennungslogik läuft auf den Servern von SilentShield und lässt sich weder prüfen noch selbst hosten.

### Was eignet sich besser zum Selbst-Hosten?

Cap. Es kommt als kleines Docker-Deployment, das du auf eigener Infrastruktur betreibst, ganz ohne Round-Trip zu Dritten. SilentShield bietet keine Self-Hosting-Option.

### Was ist besser für datenschutzorientierte Teams?

Cap behält alles auf deinen Servern: keine Cookies, kein Verhaltensprofil, keine Daten an einen Anbieter. SilentShield ist DSGVO-orientiert mit EU-Servern, aber sein Modell beruht darauf, Interaktionsmuster der Nutzer auf einem Drittdienst zu analysieren.

## Siehe auch

- [Live-Demo](../demo.md): Cap im Browser ausprobieren
- [Wie Cap Bots erkennt](../effectiveness.md): Proof-of-Work plus Instrumentation
- [Alle Alternativen](../alternatives.md): vollständige Funktionsmatrix
- [Beste CAPTCHA-Alternativen 2026](../best-captcha-alternatives.md): das weitere Feld im Vergleich
