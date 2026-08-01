---
description: "Caps Instrumentation-Challenges führen servergeneriertes JS aus, um einen echten Browser nachzuweisen, und ergänzen den Proof-of-Work im selbst gehosteten, quelloffenen CAPTCHA."
---

# Instrumentation-Challenges

Instrumentation-Challenges sind Caps zweite Verifizierungsebene. Sie laufen still neben dem Proof-of-Work-System und sind in Cap Standalone enthalten.

Bei jeder Anfrage erzeugen sie ein einzigartiges JavaScript-Programm, das im Browser des Besuchers ausgeführt wird. Die Ausgabe wird serverseitig geprüft, sodass Cap bestätigen kann, dass eine echte Browserumgebung vorliegt, bevor ein Token akzeptiert wird.

## Wie sie funktionieren

Wird eine Challenge ausgestellt, erzeugt der Server ein in sich geschlossenes JavaScript-Bundle. Es führt einige Sonden auf Browser-APIs aus und wertet eine Hauptberechnungskette aus: Mehrere Integer-Variablen werden mit zufälligen Seed-Werten initialisiert und dann über randomisierte Operationen verändert, darunter bitweises AND/OR/XOR/NAND, Tricks mit der Prototypenkette und DOM-basierte Arithmetik, die einen Elementbaum an die Seite anhängt, ihn wieder nach oben durchläuft und dabei Werte akkumuliert und ihn anschließend entfernt.

Der Server verfolgt das erwartete Ergebnis jeder Operation parallel mit und weiß daher, wie die vier finalen Werte aussehen müssen.

All diese Prüfungen laufen in einem Iframe, das die Antworten per `postMessage` an das Elternfenster zurückschickt.

## Warum DOM-Operationen

Reine Arithmetik lässt sich in einer Nicht-Browser-Umgebung schlicht durch Ausführen des JavaScripts nachbilden. DOM-Operationen nicht, jedenfalls nicht billig. Echte Elementbäume aufzubauen, Werte über die Layout-Engine des Browsers auszulesen und sie wieder abzubauen, beansprucht einen Teil des Browsers, den Nicht-Browser-Laufzeiten oft nur als Stub anbieten, falsch umsetzen oder aus Performancegründen ganz auslassen. Das macht die Challenge außerhalb einer echten Rendering-Engine deutlich schwerer nachzuspielen.

Instrumentation-Challenges mischen diese Operationen häufig zusätzlich mit einer vordefinierten Liste von Prüfungen.

## Erkennung automatisierter Browser

Instrumentation-Challenges können optional auch versuchen, automatisierte Webdriver zu blockieren. Wir führen dafür sehr viele Prüfungen durch, aber sie sind nicht unfehlbar. Selbst kommerzielle Closed-Source-CAPTCHAs wie Turnstile lassen sich von Angreifern mit gepatchten Stealth-Browsern umgehen.

## Verhältnis zum Proof-of-Work

Instrumentation-Challenges und Proof-of-Work ergänzen einander, sie sind nicht redundant. Proof-of-Work belegt *Aufwand*: Der Client musste CPU-Zyklen verbrennen, um einen Hash zu finden. Instrumentation belegt *Umgebung*: Die Berechnung fand in einem Browser statt, nicht in einem Skript. Zusammen erhöhen sie die Kosten für Missbrauch auf zwei unabhängigen Achsen. Keines von beiden reicht allein gegen einen entschlossenen Angreifer, aber beide gleichzeitig zu überwinden ist erheblich schwerer.

Instrumentation ist nicht unfehlbar. Auch wenn Challenges dieser Art von Plattformen wie [YouTube](https://www.reddit.com/r/youtubedl/comments/1mkzmp3/what_is_a_po_token/) und [Twitter](https://x.com/i/js_inst) in riesigem Maßstab eingesetzt werden, empfehle ich nicht, sie als Ersatz für Proof-of-Work zu nutzen. Ohne PoW und mit echten Browsern können Angreifer solche Challenges billig durchrechnen.
