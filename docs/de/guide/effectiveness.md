---
description: "Wie wirksam Cap gegen Bots ist: Das quelloffene CAPTCHA kombiniert Proof-of-Work mit Instrumentation und macht Missbrauch teuer, während es für Nutzer unsichtbar bleibt."
---

# Wirksamkeit

## Datenschutz & Sicherheit

Cap nutzt standardmäßig keine Cookies und keinerlei Telemetrie. Es werden keine Daten erhoben oder auf zentralen Servern gespeichert, da alles vollständig selbst gehostet läuft.

Cap bringt standardmäßig Replay-Schutz und signaturbasierte Challenge-Tokens mit.

## Warum Proof-of-Work?

Jedes CAPTCHA lässt sich irgendwann lösen, sei es durch KIs, Algorithmen, Reverse Engineering und gefälschte Fingerprints oder durch bezahlte Menschen in CAPTCHA-Farmen. Daraus entsteht ein endloses Katz-und-Maus-Spiel zwischen Angreifern und Verteidigern. Der entscheidende Unterschied liegt in den Kosten, die Angreifern entstehen.

Caps Ziel ist es, automatisierten Missbrauch teuer und aufwendig zu machen und die Erfahrung für echte Nutzer gleichzeitig schnell und praktisch unsichtbar zu halten. Proof-of-Work ist dafür die perfekte Balance: Es stoppt Missbrauch, indem es Rechenaufwand verlangt, statt sich allein auf Verifizierungsmethoden zu verlassen, die Bots immer besser nachahmen lernen.

Stell dir vor, 10.000 Spam-Nachrichten zu verschicken kostet 1 $ und bringt potenziell 10 $ ein, ein lohnendes Geschäft. Erhöht Cap die Rechenkosten so, dass dieselben Nachrichten nun 100 $ kosten, macht der Spammer 90 $ Verlust. Damit entfällt der finanzielle Anreiz.

Caps Proof-of-Work ist stark von [Hashcash](https://www.researchgate.net/publication/2482110_Hashcash_-_A_Denial_of_Service_Counter-Measure) inspiriert. Unsere Instrumentation-Challenges sind von den eigenen Challenges von Twitter und YouTube inspiriert.

## GPUs nutzlos machen

SHA-256 ist als allgemeiner PoW-Algorithmus vernünftig, lässt sich auf GPUs aber deutlich optimieren. Deshalb unterstützen wir zusätzlich experimentelle GPU-resistente Algorithmen wie [RSW-Time-Locks](./rsw.md).

## Siehe auch

- [CAPTCHA und Conversion-Rate](./captcha-conversion-rate.md): was Challenge-Reibung bei Anmeldungen kostet
- [Beste CAPTCHA-Alternativen 2026](./best-captcha-alternatives.md): wie andere Mechanismen abschneiden
