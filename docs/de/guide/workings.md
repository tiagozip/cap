---
description: "Wie Cap funktioniert: Das selbst gehostete CAPTCHA lässt den Browser jedes Besuchers eine Proof-of-Work-Challenge lösen und ein Instrumentation-Skript ausführen und tauscht das Ergebnis dann gegen ein einmalig nutzbares Token."
---

# Wie Cap funktioniert

Cap versucht nicht zu entscheiden, ob ein Besucher ein Mensch ist. Es lässt jede Anfrage Rechenleistung kosten. Für einen einzelnen Besucher ist das günstig, für jemanden mit Tausenden Anfragen teuer. Außerdem prüft es, ob die Berechnung in einem echten Browser lief.

## Was bei einer Anfrage passiert

1. Sobald das Widget sichtbar ist, fordert es bei deinem Server eine Challenge an. Der Server antwortet mit einem signierten Token, das die Challenge beschreibt, und meist auch mit einem Instrumentation-Skript. Das Widget startet das Skript sofort in einem Iframe mit Sandbox.
2. Der Browser löst den Proof-of-Work in Web Workern mit WebAssembly. Je nach Challenge beginnt er bei der ersten Interaktion des Besuchers mit der Seite oder beim Klick auf das Widget.
3. Das Widget sammelt das Instrumentation-Ergebnis und schickt beide Ergebnisse an den Server. Der Server prüft die Signatur des Tokens und den Proof-of-Work, markiert die Challenge als eingelöst und prüft dann das Instrumentation-Ergebnis.
4. Wenn alles stimmt, stellt der Server ein einmalig nutzbares Token aus. Das Widget fügt es deinem Formular hinzu, und dein Backend verifiziert es mit `/siteverify`, bevor es der Übermittlung vertraut.

Der Server hält keinen Zustand für offene Challenges vor, da alles Nötige im signierten Token steht. Er speichert nur eingelöste Challenges und die Tokens, die er ausgestellt hat.

## Warum Proof-of-Work

Jedes CAPTCHA lässt sich irgendwann lösen, ob durch Bildmodelle, Reverse Engineering oder Menschen, die pro Lösung bezahlt werden. Was ein CAPTCHA beeinflussen kann, sind die Kosten jeder Lösung.

Angenommen, ein Spammer zahlt $1 für 10.000 Nachrichten und verdient damit $10. Wenn Cap die Kosten dieser Nachrichten auf $100 erhöht, macht die Kampagne Verlust. Ein Besucher, der ein Formular ausfüllt, zahlt etwa eine halbe Sekunde CPU-Zeit und sieht nie ein Rätsel.

Die Idee stammt von [Hashcash](https://www.researchgate.net/publication/2482110_Hashcash_-_A_Denial_of_Service_Counter-Measure).

## Die beiden Ebenen

**Proof-of-Work** belegt, dass der Client die Rechenarbeit geleistet hat. Mit SHA-256 löst eine GPU pro Sekunde etwa 150-mal so viele Challenges wie eine CPU. Ein Angreifer kann die Hürde dadurch günstig überwinden. [HashWX](./hashwx.md), der Standard, senkt diesen Faktor auf etwa 2.

**[Instrumentation](./instrumentation.md)** belegt, dass die Berechnung in einem Browser lief. Jede Challenge enthält ein frisch erzeugtes Skript, das über das DOM rechnet, und der Server kennt das erwartete Ergebnis. Es außerhalb einer echten Browser-Engine auszuführen ist schwer. Es kann auch gängige Automatisierungswerkzeuge und KI-Agenten erkennen und bewerten, wie die Zeiger- und Tastatureingaben des Besuchers das Widget erreicht haben.

Jede Ebene deckt die Lücke der anderen ab. Proof-of-Work allein kann ein Skript ohne Browser lösen, und Instrumentation allein lässt sich mit vielen echten Browsern günstig abarbeiten. Keine der beiden Ebenen hält eine Farm von Menschen auf, die von Hand lösen, aber der Proof-of-Work lässt jede ihrer Lösungen trotzdem etwas kosten.

## Datenschutz

Cap setzt keine Cookies und sammelt keine Telemetrie. Challenges, Tokens und Statistiken bleiben auf deinem Server. Bei aktivierter Verhaltensbewertung schickt das Widget deinem Server die Zeigerbewegungen und das Timing der Tastatureingaben des Besuchers, aber nie, welche Tasten gedrückt oder welche Texte eingegeben wurden. Das Widget ruft den von dir angegebenen Endpunkt auf und jsDelivr für seine WASM-Dateien, sofern du sie nicht [selbst hostest](./widget.md#self-hosting-the-widget). Siehe [Compliance](./compliance.md) für DSGVO, CCPA und Barrierefreiheit.
