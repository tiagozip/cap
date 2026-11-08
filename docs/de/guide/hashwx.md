---
outline: [2, 3]
description: "HashWX ist Caps GPU-resistenter Proof-of-Work. Jede Challenge erzeugt eine frische Hash-Funktion, damit liegt eine GPU nur noch etwa 2x statt 150x vor einer CPU."
---

# HashWX

HashWX ist Caps Standard-Proof-of-Work. Während SHA-256 eine feste Hash-Funktion nutzt, erzeugt HashWX für jeden Nonce-Block eine neue, gebaut aus Integer-Operationen und Verzweigungen, die GPUs schlecht ausführen. Entworfen hat es [tevador](https://github.com/tevador/hashwx), von dem auch RandomX stammt. Sein [Designdokument](https://github.com/tevador/hashwx/blob/master/doc/design.md) erklärt die Funktionsweise. Cap nutzt seinen WebAssembly-Referenz-Build.

Es ist in capd der Standard für neue Keys. In der Core-Bibliothek ist es [opt-in](./capjs-core.md#format-2-hashwx).

## Warum nicht SHA-256

Beim Bot-Schutz zählt, wie viele Challenges ein Angreifer pro Stunde löst, nicht wie lange eine einzelne dauert. Eine GPU führt eine feste Funktion wie SHA-256 gleichzeitig auf Tausenden Lanes aus. Vor HashWX nutzte Cap RSW-Time-Lock-Puzzles, die sich innerhalb eines Puzzles nicht parallelisieren lassen. Eine GPU rechnet aber trotzdem Tausende unabhängige Puzzles nebeneinander. Gemessen gegen eine Consumer-GPU:

| Algorithmus | CPU, Ryzen 3700X, 16 Threads | GPU, RTX 5060 Ti | GPU-Vorteil |
|---|---:|---:|---:|
| SHA-256 | 41 MH/s | 6150 MH/s | ~150x |
| RSW | 26 H/s | 4400 H/s | ~170x |
| HashWX | 2,8 MH/s | 5,8 MH/s | ~2x |

Die Zahlen stammen von tevador und beruhen auf seiner eigenen, nicht veröffentlichten CUDA-Implementierung. Cap hat die RSW-Zeile nachgemessen. Ein M3 schafft 2,11 H/s pro Thread, was für 16 Ryzen-Threads auf 26 H/s hinausläuft.

RSW ist abgekündigt. capd liefert jetzt HashWX an Keys aus, die auf RSW eingestellt waren. Die Core-Bibliothek stellt auf Anfrage weiterhin RSW-Challenges aus, wähle es aber nicht für neue Setups.

## Kosten {#cost}

Serverzeit pro Challenge auf einem Kern eines Apple M3, Median über 200 Erzeugungen und 40 Verifizierungen:

| Protokoll | Erzeugung | Verifizierung | Gesamt |
|---|---:|---:|---:|
| HashWX, 1 Challenge | 14 µs | 40 µs | 54 µs |
| HashWX, 4 Teil-Challenges (Standard) | 20 µs | 129 µs | 149 µs |
| SHA-256, 50 Challenges mit Schwierigkeit 4 | 4 µs | 83 µs | 87 µs |
| RSW, t = 75.000 | 1522 µs | 14 µs | 1536 µs |

Die Schwierigkeit ändert an diesen Zahlen nichts. Verifizieren ist ein Hash pro Teil-Challenge, egal wie lange es gedauert hat, ihn zu finden.

Auf dem Client hat eine einzelne Challenge eine zufällige Lösungszeit. Dieselbe Schwierigkeit kann bei einem Besucher 30 ms und beim nächsten 3 s dauern. Cap teilt die Schwierigkeit standardmäßig auf vier Teil-Challenges auf, was die Lösungszeit gleichmäßiger macht. Gemessen durch das Widget in Chrome auf einem M3 mit 8 Kernen, je 72 Lösungen, beide Schwierigkeiten auf ungefähr denselben Median abgestimmt:

| | 1 Challenge, d = 1.330.000 | 4 Teil-Challenges, d = 1.000.000 |
|---|---:|---:|
| Median | 536 ms | 490 ms |
| p90 | 1447 ms | 778 ms |
| Langsamste von 72 | 2378 ms | 1490 ms |

Die rechte Spalte ist der Standard. Gegen einen capd-Key ergab er einen Median von 578 ms und ein p90 von 0,9 s. Das Aufteilen ändert nichts daran, was ein Angreifer bezahlt, denn die erwartete Arbeit bleibt in beiden Fällen `d` Hashes.

### Browser

Der WebAssembly-Build läuft mit etwa 60% der nativen Geschwindigkeit. Gemessen auf demselben M3:

| Browser | 1 Worker | 8 Worker | Interpretierter Fallback |
|---|---:|---:|---:|
| Chrome 153 | 440 KH/s | 2050 KH/s | 94 KH/s |
| Firefox 156 | 420 KH/s | 1850 KH/s | 105 KH/s |
| Safari 27.2 | 410 KH/s | 1480 KH/s | 105 KH/s |

Safari erreicht auf allen Kernen etwa 70% der Geschwindigkeit von Chrome. Stimme die Schwierigkeit also auf Safari ab. Beim Standard sind das etwa 0,5 s auf Chrome und 0,7 s auf Safari.

Wenn du selbst misst, nutze Release-Builds und lass den Tab im Vordergrund. Playwrights Firefox führt WebAssembly drei- bis sechsmal langsamer aus als echtes Firefox, und ein Tab im Hintergrund kann auf den Effizienzkernen laufen.

### Smartphones {#phones}

Die Standardschwierigkeit auf echten Smartphones über BrowserStack, je 15 Lösungen, jeweils mit einer frisch geladenen Seite:

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

Jede Lösung enthält zwei Roundtrips zum Testserver von je 80 bis 190 ms. Eine Seite, auf der HashWX bereits eine Minute lief, löste 24% bis 29% schneller. Benchmarks mit Aufwärmphase sehen also besser aus als das, was Besucher erleben.

Kommt der Großteil deines Traffics von Mobilgeräten, senke die Schwierigkeit. Die Lösungszeit skaliert mit ihr. 500.000 halbiert also ungefähr den Rechenanteil dieser Zahlen.

HashWX braucht WebAssembly und auf iPhones iOS 15 oder neuer. Für Browser ohne WebAssembly nutze SHA-256, das einen JavaScript-Fallback hat.

## Grenzen

Spezialhardware würde eine CPU weiterhin schlagen. Ein für HashWX gebauter FPGA oder ASIC kostet Millionen in der Entwicklung, was sich fürs CAPTCHA-Lösen nicht rechnet. Das ist aber ein wirtschaftliches Argument und kein kryptografisches.

Menschen, die fürs manuelle Lösen von Challenges bezahlt werden, hält es ebenfalls nicht auf. Kombiniere es mit [Instrumentation](./instrumentation.md), damit zusätzlich ein echter Browser erforderlich ist.
