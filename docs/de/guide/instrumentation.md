---
outline: [2, 3]
description: "Caps Instrumentation-Challenges führen ein pro Challenge erzeugtes Skript in einem Frame mit Sandbox aus, um einen echten Browser nachzuweisen. Sie ergänzen den Proof-of-Work im selbst gehosteten, quelloffenen CAPTCHA."
---

# Instrumentation

Instrumentation-Challenges prüfen, ob eine Challenge in einem echten Browser gelöst wurde. Sie laufen neben dem Proof-of-Work, sind in capd für neue Keys standardmäßig aktiv und in der [Core-Bibliothek](./capjs-core.md#instrumentation) opt-in.

<InstrumentationFlow />

## Wie sie funktionieren {#how-it-works}

Jede Challenge bringt ein Programm mit, das der Server noch nie zuvor gesendet hat. Seine Arithmetik ändert sich jedes Mal, ein Solver muss also jedes neue Programm auswerten und ausführen, statt eine alte Antwort zu wiederholen. Alles, was das Programm über die Seite festhält, fließt gehasht in seine Antwort ein. Der Server berechnet diese Antwort neu, ein Client kann die Notizen also nicht verändern, ohne durchzufallen.

Der Frame teilt die Origin der Seite, damit das Programm die umgebende Seite sehen kann. Seiten mit einer strikten Content Security Policy brauchen `window.CAP_SCRIPT_NONCE`, und [Seiten mit einer HTML-Injection-Lücke](./widget.md#pages-with-an-html-injection-bug) können den Frame mit `CAP_ISOLATE` isolieren.

## Erkennung automatisierter Browser {#automated-browser-detection}

Mit aktiviertem **Attempt to block headless browsers** in capd oder `blockAutomatedBrowsers` in der Core-Bibliothek blockiert der Server Browser mit Automatisierungsmarkern: `navigator.webdriver`, Headless-User-Agents, Patches von Stealth-Plugins, das Firefox-Protokoll von Playwright oder eine Seite und ein Web Worker, die sich über das Gerät widersprechen. Die Prüfungen suchen nach Automatisierung und Manipulation, nie nach dem verwendeten Browser. Fehlgeschlagene Prüfungen stehen in `blockedBy`, schwächere Hinweise kommen ohne Blockierung in `riskFlags`.

## Interaktionserkennung {#interaction-detection}

Diese Funktion ist experimentell und standardmäßig aus. Mit aktiviertem **Block automated clicks and typing** zählt das Programm Klicks und Tastendrücke, die ein Skript statt des Besuchers ausgelöst hat. Nach drei Events einer der beiden Arten schlägt die Lösung fehl. Es liest nie Feldwerte und ignoriert Passwort-, Einmalcode- und Zahlungskartenfelder.

## Verhaltensbewertung {#behavior-scoring}

Die Verhaltensbewertung ist standardmäßig aus und wird pro Key eingestellt. Das Programm zeichnet auf, wie der Zeiger das Widget erreicht hat, und den Rhythmus der Tastendrücke, nie welche Tasten es waren. Der Server macht daraus einen Score von 0 bis 1 und ein Urteil `ok`, `suspicious`, `automated` oder `agent` und blockiert standardmäßig `automated` ab 0,75. Ein geradliniger Zeigerweg, ein von einem Skript ausgelöster Tastendruck oder Tippen in perfekt gleichmäßigem Tempo erhöhen den Score.

Der [unsichtbare Modus](./invisible.md) und der [Floating-Modus](./floating.md) rufen `solve()` ohne Betätigung des Widgets auf und schlagen deshalb bei Keys fehl, die eine verlangen.

## Erkennung von KI-Agenten {#ai-agent-detection}

Cap benennt KI-Agenten anhand von Markierungen, die ihre Werkzeuge in der Seite hinterlassen, anhand von Klick- und Tippmustern sowie anhand von `User-Agent` und signierten `Signature-Agent`-Headern. Ein erkannter Agent ergänzt `riskFlags` um `agent:<name>`. Keys können jeden Agenten blockieren, nur die mit hoher Konfidenz identifizierten, oder Agenten mit verifizierter [Web Bot Auth](https://datatracker.ietf.org/doc/draft-meunier-web-bot-auth-architecture/)-Signatur durchlassen.

## Was sie nicht aufhalten kann {#what-it-cant-stop}

Das Programm läuft im Browser des Besuchers. Die Schutzmaßnahmen machen das Fälschen deshalb teurer als die Ausführung: eingefrorene eingebaute Funktionen, Hashes über jedes Feld, Ergebnisse, die an eine Challenge gebunden sind, und Fehlermarker, die immer zum Fehlschlagen führen. Cap kann trotzdem keinen Menschen von einem echten Browser unterscheiden, den ein Mensch steuert. Es hält also keine bezahlten menschlichen Löser auf, keine Agenten, deren Eingaben als gewöhnliche Betriebssystem-Events ankommen, und keine aus dem Quellcode neu gebauten Browser, die Automatisierung verstecken. Der Proof-of-Work lässt jede dieser Lösungen weiterhin etwas kosten.

Die Fehlercodes stehen unter [Fehlerbehebung](./error-codes.md).

## Widgets aus früheren Versionen {#widgets-from-earlier-releases}

Ältere Widgets lösen weiter gegen einen neuen Server, und ihre Lösungen tragen das Risiko-Flag `legacy_widget`. Bei Keys, die automatisierte Interaktionen blockieren, Verhalten bewerten oder Agenten blockieren, schlagen sie mit `instr_widget_outdated` fehl. Ein Widget-Update behebt das.
