---
outline: [2, 3]
description: "HashWX ist Caps GPU-resistenter Proof-of-Work. Jede Challenge erzeugt eine frische Hash-Funktion, damit liegt eine GPU nur noch etwa 2x statt 150x vor einer CPU."
---

# HashWX-Proof-of-Work

**HashWX** ist Caps Standard-Challenge-Protokoll. Statt einer festen Hash-Funktion wie SHA-256 erzeugt jede Challenge aus einem Seed eine **neue** Einwegfunktion, gebaut aus Integer-Operationen und Verzweigungen, die so gewählt sind, dass eine GPU sie nicht wesentlich schneller ausführen kann als eine CPU.

Entworfen hat sie [tevador](https://github.com/tevador/hashwx), von dem auch RandomX und HashX stammen. Cap liefert den WebAssembly-Referenz-Build mit.

::: tip
HashWX ist der Standard für neue Standalone-Keys. In cap-core ist es über die Format-2-API opt-in, dort bleibt SHA-256-Proof-of-Work der Standard. Siehe [HashWX-Challenges](./capjs-core.md#format-2-hashwx).
:::

## Warum HashWX

Das Problem mit SHA-256-Proof-of-Work ist der Durchsatz. Eine GPU fährt dieselbe feste Funktion über Tausende Lanes im Gleichschritt und löst damit weit mehr Challenges pro Sekunde als eine CPU. Genau darauf kommt es beim Bot-Schutz an: Einem Angreifer ist egal, wie lange eine einzelne Challenge dauert, ihn interessiert nur, wie viele er pro Stunde schafft.

Cap hat dafür früher RSW-Time-Lock-Puzzles ausgeliefert. RSW gewinnt bei der **Latenz**, weil sich sequenzielles Quadrieren innerhalb eines Puzzles nicht parallelisieren lässt, verliert aber klar beim **Durchsatz**, weil eine GPU Tausende unabhängige Puzzles gleichzeitig rechnet. Gemessen gegen eine Consumer-GPU:

| Algorithmus | CPU, Ryzen 3700X, 16 Threads | GPU, RTX 5060 Ti | GPU-Vorteil |
|---|---:|---:|---:|
| SHA-256 | 41 MH/s | 6150 MH/s | ~150x |
| RSW | 26 H/s | 4400 H/s | ~170x |
| **HashWX** | **2,8 MH/s** | **5,8 MH/s** | **~2x** |

Die Zahlen stammen von tevador und beruhen auf seiner eigenen, nicht öffentlichen CUDA-Implementierung. Die RSW-Zeile haben wir unabhängig nachgemessen: Ein M3 schafft 2,112 H/s pro Thread, was für 16 Ryzen-Threads auf 26 H/s hinausläuft.

RSW ist deprecated. Es lässt sich weiterhin pro Key auswählen und bestehende Keys laufen unverändert weiter, für neue Deployments sollte es aber nicht mehr eingesetzt werden.

## Wie das Protokoll funktioniert

### Erzeugung

Der Server zieht 32 zufällige Bytes als Challenge `C` und legt eine Schwierigkeit `d` fest. Es gibt kein Schlüsselmaterial und keine Vorberechnung, die Erzeugung ist also ein Random-Read plus eine JWT-Signatur.

Der Client bekommt `C`, `d` und `n`, die Anzahl der Nonces, die jede erzeugte Funktion abdeckt.

### Lösen auf dem Client

Der Client sucht eine 64-Bit-Nonce `N`, für die gilt

```
H(N) <= (2^64 - 1) / d      where H = hashwx_make(sha256(C || u64le(N / n)))
```

Jeder Block aus `n` aufeinanderfolgenden Nonces teilt sich eine erzeugte Hash-Funktion. Der Client baut diese Funktion, lässt sie über den Block laufen und geht zum nächsten Block, wenn nichts unter der Zielmarke landet. Der Erwartungswert der Arbeit sind `d` Hashes.

Cap nutzt `n = 65536`. Das Referenzprotokoll verwendet 463 für native Clients; im Browser muss die Funktion für jeden Block per `WebAssembly.Module` JIT-kompiliert werden, ein größerer Block amortisiert diese Kosten also. tevador benennt den Tradeoff ausdrücklich: Mehr Nonces pro Funktion machen das Protokoll etwas anfälliger für JIT-kompilierte GPU-Kernel, und bei dieser Einstellung trägt die divergente Verzweigung die GPU-Resistenz. Die ~2x oben sind bei 65536 gemessen, das ist also schon berücksichtigt.

### Was es GPU-resistent macht

Vier Eigenschaften, alle aus dem [Design-Dokument](https://github.com/tevador/hashwx/blob/master/doc/design.md):

Jede Instanz besteht aus 32 Programmen, jedes davon eine Schleife, die mit Wahrscheinlichkeit 1/2 an den eigenen Anfang zurückspringt, was exakt 256 Verzweigungen pro Hash ergibt. Auf einer CPU sind das eine Handvoll Fehlvorhersagen. Auf einer GPU spaltet das einen Warp in divergente Pfade, die nacheinander abgearbeitet werden müssen.

Es gibt einen 16 KB großen Scratchpad, dessen Zugriffe absichtlich unaligned sind. Eine CPU hält ihn im L1 und versteckt die 3 bis 4 Zyklen Latenz durch Umsortieren. Eine GPU muss ihn im Local Memory hinter dem L2 halten, bei rund 100 Zyklen, und die meisten GPU-Architekturen müssen unaligned Loads emulieren, indem sie zwei benachbarte kombinieren.

Die Quellregister stammen aus verschränkten "flachen" und "tiefen" Listen, eine CPU kommt damit auf durchschnittlich 2,75 abhängige Loads. Ein GPU-Interpreter muss auf die tiefe Liste hin spezialisieren, denn in etwa 95% der Fälle läuft mindestens ein Thread im Warp ein tiefes Programm, also frisst er jedes Mal die volle Kette aus 6 abhängigen Loads.

Der Befehlssatz ist auf das beschränkt, was WebAssembly 1.0 bietet: 64-Bit-Multiplikation, Addition, Subtraktion, XOR, OR, Rotation und Shift, mit 6-Bit-Immediates. Genau das macht es überhaupt erst möglich, denselben Algorithmus im Browser laufen zu lassen.

### Verifizierung auf dem Server

Der Server berechnet den Seed aus `C` und dem Blockindex, der sich aus der eingereichten Nonce ergibt, erzeugt diese eine Hash-Funktion, lässt sie einmal laufen und vergleicht mit der Zielmarke. Die Programmerzeugung ist rund 5x günstiger als bei HashX, deshalb bleibt die Verifizierung im Bereich einiger Dutzend Mikrosekunden.

## Kosten {#cost}

Serverkosten pro Challenge, gemessen auf einem Kern eines Apple M3, Median über 200 Erzeugungen und 40 Verifizierungen durch `validateChallenge`:

| Protokoll | Erzeugung | Verifizierung | Gesamt |
|---|---:|---:|---:|
| **HashWX**, 1 Challenge | **14 µs** | **40 µs** | **54 µs** |
| **HashWX**, 4 Teil-Challenges (Standard) | **20 µs** | **129 µs** | **149 µs** |
| SHA-256 (50 Challenges, Schwierigkeit 4) | 4 µs | 83 µs | 87 µs |
| RSW (t = 75.000) | 1522 µs | 14 µs | 1536 µs |

Eine einzelne HashWX-Challenge hat von den dreien den günstigsten Roundtrip. Die standardmäßigen vier Teil-Challenges kosten etwa 150 µs, mehr als SHA-256, aber ein Zehntel von RSW, das bei jedem Erzeugen vier echte modulare Exponentiationen bezahlt. Die Schwierigkeit ändert an diesen Zahlen nichts: Verifizieren ist ein Hash pro Teil-Challenge, egal wie schwer er zu finden war.

Die Kosten auf dem Client sind die andere Seite dieses Tauschs. Eine einzelne Challenge hat eine exponentialverteilte Lösungszeit und ist damit eine Lotterie: Dieselbe Schwierigkeit dauert für einen Besucher 30 ms und für den nächsten drei Sekunden. Deshalb teilt Cap die Schwierigkeit standardmäßig auf vier Teil-Challenges auf, was die Lösungszeit gleichmäßiger macht. Gemessen durch das Widget im Release-Chrome auf einem M3 mit 8 Kernen, je 72 Lösungen, beide Schwierigkeiten auf ungefähr denselben Median abgestimmt:

| | 1 Challenge, d = 1.330.000 | 4 Teil-Challenges, d = 1.000.000 |
|---|---:|---:|
| Median | 536 ms | 490 ms |
| p90 | 1447 ms | 778 ms |
| Langsamste von 72 | 2378 ms | 1490 ms |

Die rechte Spalte ist der Standard. Gegen einen Standalone-Key ergab er einen Median von 578 ms und ein p90 von 0,9 s.

Bei gegebener Schwierigkeit ändert das Aufteilen nichts daran, was ein Angreifer bezahlt, denn die erwartete Arbeit bleibt `d` Hashes, egal wie sie aufgeteilt wird. Was sich ändert, ist die Form der Verteilung. Der Median einer einzelnen Challenge liegt bei 0,69 ihres Mittelwerts, vier Teil-Challenges schieben ihn auf etwa 0,92 und kürzen den Ausläufer. Bei gleicher Schwierigkeit wird die typische Lösung also etwa ein Drittel langsamer, und das p90 sinkt um etwa ein Viertel. Die Tabelle hält stattdessen den Median fest, was die Aufteilung auf 25% weniger Schwierigkeit setzt und einem Angreifer 25% weniger Arbeit pro Lösung abverlangt. Der eigene Overhead des Widgets ist gering. Seine Worker prüfen alle 16 ms, ob sie anhalten sollen, und das begrenzt, wie lange eine Übergabe zwischen Teil-Challenges dauern kann.

### Browser-Engines

Der wasm-Build läuft mit etwa 60% der nativen Geschwindigkeit. Auf einem einzelnen Worker liegen die drei großen Engines dicht beieinander, sobald alle Kerne ausgelastet sind, fällt Safari zurück. Gemessen auf demselben M3 in einer Sitzung, jeder Browser headless oder im Vordergrund:

| Engine | 1 Worker | 8 Worker | Interpretierter Fallback |
|---|---:|---:|---:|
| Chrome 153 | 440 KH/s | 2050 KH/s | 94 KH/s |
| Firefox 156 | 420 KH/s | 1850 KH/s | 105 KH/s |
| Safari 27.2 | 410 KH/s | 1480 KH/s | 105 KH/s |

Auf einem Worker liegen alle drei innerhalb von 5% zueinander. Auf acht erreicht Safari etwa 70% der Rate von Chrome, stimme die Schwierigkeit also auf Safari ab: Bei d = 1.000.000 sind das im Mittel etwa 0,5 s auf Chrome und 0,7 s auf Safari.

Wenn du selbst misst, nimm jeweils einen Release-Build des Browsers und lass den Tab im Vordergrund. Das von Playwright mitgelieferte Firefox führt jede WebAssembly-Last drei- bis sechsmal langsamer aus als ein Release-Firefox, nicht nur HashWX, und ein Tab im Hintergrund kann auf den Effizienzkernen landen und jede Zahl halbieren.

### Smartphones {#phones}

Der Standard auf echten Smartphones über BrowserStack, je 15 Lösungen und 30 auf dem Vivo. Jeder Lauf begann auf einer frisch geladenen Seite, so wie ein Besucher ankommt. Nachdem die Seite schon eine Minute lang HashWX ausgeführt hatte, brauchte das Pixel 6 pro Lösung 24% weniger Zeit und das Vivo 29% weniger. Ein Benchmark mit Aufwärmphase sieht also besser aus als diese Zahlen.

| Gerät | System | Alle Kerne | Median | Langsamste |
|---|---|---:|---:|---:|
| Galaxy S24 | Android 14 | 1238 KH/s | 1,1 s | 1,8 s |
| Pixel 9 | Android 15 | 837 KH/s | 1,4 s | 2,0 s |
| Pixel 6 | Android 12 | 746 KH/s | 1,9 s | 2,4 s |
| iPhone 15 | iOS 17 | nicht gemessen | 1,9 s | 4,3 s |
| iPhone 12 | iOS 17 | 620 KH/s | 2,0 s | 3,3 s |
| iPhone 13 | iOS 15 | 678 KH/s | 2,2 s | 4,1 s |
| iPhone SE 2022 | iOS 15 | 588 KH/s | 2,4 s | 4,0 s |
| Redmi Note 11 | Android 11 | 456 KH/s | 2,4 s | 4,8 s |
| Galaxy M32 | Android 11 | 444 KH/s | 2,8 s | 6,1 s |
| Vivo Y21 | Android 11 | 316 KH/s | 5,9 s | 11,0 s |

Jede Lösung enthält zwei Roundtrips zum Testserver, im Median 80 bis 190 ms je Gerät. Das Vivo, ein günstiges Android, braucht etwa zehnmal so lange wie der M3-Desktop. Kommt der Großteil deines Traffics von Mobilgeräten, senke die Schwierigkeit. Die Lösungszeit wächst linear mit ihr, 500.000 halbiert also ungefähr den Rechenanteil jeder Zahl hier.

Clients ohne WebAssembly können HashWX gar nicht lösen und bekommen einen Fehler. Musst du sie unterstützen, nimm SHA-256-Proof-of-Work, der hat einen reinen JS-Fallback. Auf iPhones braucht das Widget iOS 15 oder neuer.

## Wogegen HashWX nicht schützt

Gegen dasselbe wie RSW: eigenes Silizium. Ein FPGA oder ASIC, der dafür gebaut ist, schlägt eine CPU weiterhin. Für CAPTCHA-Farming geht die Rechnung nicht auf, da ein ASIC Millionen an Entwicklungskosten verschlingt, eine kryptografische Garantie ist das aber nicht.

Eine Solving-Farm mit echten Menschen hält es ebenfalls nicht auf, und das wird es nie. Proof-of-Work erhöht die Kosten pro Anfrage. Kombiniere es mit [Instrumentation-Challenges](./instrumentation.md), damit zusätzlich eine echte Browser-Umgebung verlangt wird.

## Ausprobieren

Die cap-core-API ist unter [HashWX-Challenges](./capjs-core.md#format-2-hashwx) dokumentiert. Das Widget erkennt Format-2-Antworten automatisch, ein Upgrade des Servers genügt also.

In [Cap Standalone](./standalone/options.md#hashwx-proof-of-work) ist HashWX der Standard für neue Keys und lässt sich pro Key im Dashboard umstellen.
