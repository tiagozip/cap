---
outline: [2, 3]
description: "RSW-Time-Lock-Puzzles sind Caps GPU-resistente Alternative zum SHA-256-Proof-of-Work. Wie das quelloffene CAPTCHA Rivest-Shamir-Wagner-Challenges nutzt."
---

# RSW-Time-Lock-Puzzles

Neuere Cap-Versionen bringen einen experimentellen Challenge-Typ mit: das **RSW**-Time-Lock-Puzzle (Rivest-Shamir-Wagner). Es existiert als GPU-resistentere Alternative zum standardmäßigen SHA-256-Proof-of-Work.

::: tip
RSW ist **opt-in**. Die Standard-Pipeline von Cap nutzt weiterhin SHA-256-PoW. Bestehende Widgets und Server ändern ihr Verhalten nicht, solange du es nicht [explizit aktivierst](./capjs-core.md#format-2-rsw-opt-in).
:::

## Warum RSW

Caps standardmäßiger SHA-256-PoW ist schnell und günstig zu verifizieren, aber jedes Puzzle lässt sich theoretisch mit GPUs oder ASICs beschleunigen. In freier Wildbahn haben wir das bisher nicht gesehen, doch je günstiger und verfügbarer GPUs werden, desto mehr erodiert der Sicherheitsspielraum hash-basierter PoW.

RSW ist ein sequenzielles Puzzle. Es ist darauf ausgelegt, GPU-Beschleunigung zu widerstehen. Wir testen und benchmarken es aktuell noch, bevor es produktionsreif ist, aber die bisherigen Ergebnisse sind ziemlich vielversprechend.

Tatsächlich ist RSW nach unseren Tests auf einer A100 **langsamer** als auf einem modernen Smartphone wie dem iPhone Air. Wir haben das auf einigen gemieteten GPUs (mit NVIDIAs eigener [CGBN](https://github.com/NVlabs/CGBN)-Bibliothek) und auf Endgeräten gemessen:

| Hardware | µs / 2048-Bit-Quadrierung (einzelne Kette) |
|---|---:|
| Apple M3 Air, Chrome 148 | **2,39** |
| Apple iPhone Air, iOS 26 + Chrome | 3,07 |
| Pixel 9, Chrome 145 | 5,14 |
| iPhone 12, iOS 17 (WebKit) | 8,57 |
| **NVIDIA H100, 32 Threads kooperieren an einer Kette** | **2,70** |
| NVIDIA L4, 32 Threads kooperierend | 2,69 |
| NVIDIA A100, 32 Threads kooperierend | 4,82 |

## Wie das Protokoll funktioniert

### Setup (einmalig beim Start)

Der Server erzeugt einen 2048-Bit-Modulus im RSA-Stil, `N = p·q`. Er hält `p` und `q` geheim und veröffentlicht nur `N`. Die Schlüsselerzeugung dauert je nach Primzahlglück etwa 0,5 bis 3 Sekunden, der Server sollte das Ergebnis also persistieren und prozessübergreifend wiederverwenden.

### Challenge-Erzeugung (≈ 2 ms)

Naiv gedacht müsste der Server zum Erzeugen einer Challenge `y = x^(2^t) mod N` von Grund auf berechnen, also genau die teure Arbeit, die der Client leistet. Das umgehen wir mit dem Short-Exponent-Trick:

1. Beim Setup berechnet der Server einmalig `h = g^(2^t) mod N` mithilfe der Falltür `φ(N) = (p-1)(q-1)`. Das ist **eine** Modexp voller Länge.
2. Für jede Challenge wählt der Server einen zufälligen 256-Bit-Skalar `r` und berechnet:
   - `x = g^r mod N`
   - `y = h^r mod N`
3. Algebraisch gilt: `x^(2^t) = (g^r)^(2^t) = (g^(2^t))^r = h^r = y`

Sowohl `g^r` als auch `h^r` sind Modexps mit 256-Bit-Exponent, jeweils rund 4 kurze Multiplikationen. Mit CRT-Beschleunigung über `p` und `q` dauert die gesamte Erzeugung auf einer modernen CPU etwa 2 Millisekunden.

Der Client sieht nur `(N, x, t)`. `r` aus `x` zurückzugewinnen ist ein diskreter Logarithmus in `(Z/N)*` und damit so schwer wie das Faktorisieren von `N`. Der 256-Bit-Exponent eröffnet keine Abkürzung (es ist kein subexponentieller Angriff auf DLP in einer Untergruppe mit 2048-Bit-Modulus und kurzem Exponenten bekannt).

### Lösen auf dem Client

Alles, was der Client mit `(N, x, t)` tun muss, ist Folgendes zu berechnen:

```js
let y = x;
for (let i = 0; i < t; i++) y = (y * y) % N;
```

Das dauert auf den meisten Geräten etwa 300 bis 800 ms.

### Verifizierung auf dem Server (≈ 100 µs)

Das verschlüsselte State-Token des Servers enthält das erwartete `y` bereits (es wurde beim Erzeugen hineingeschrieben). Die Verifizierung ist ein `BigInt`-Vergleich in konstanter Zeit gegen das eingereichte `y`. Eine erneute Herleitung ist nicht nötig.

## Wogegen RSW *nicht* schützt

RSW schützt nicht gegen FPGA- oder ASIC-Hardware. Spezialsilizium schafft eine 2048-Bit-Modularquadrierung in 50 bis 100 ns auf FPGA (etwa 15- bis 20-mal so schnell wie ein CPU-Kern) und in einstelligen Nanosekunden auf ASIC (etwa 200- bis 300-mal). Wirtschaftlich lohnt sich das für CAPTCHA-Farming weiterhin nicht, da eigene ASICs Millionen an Entwicklungskosten verschlingen. Wenn dein Bedrohungsmodell aber Angreifer auf Staatsebene umfasst, hast du ohnehin ein Problem.

## Ausprobieren

Die cap-core-API für RSW ist unter [RSW-Challenges](./capjs-core.md#format-2-rsw-opt-in) dokumentiert. Das Widget erkennt Format-2-Antworten automatisch, ein Upgrade derselben Binary auf dem Server genügt also.

Wenn du [Cap Standalone](./standalone/options.md#rsw-time-lock-puzzles) betreibst, ist RSW als Schalter pro Key im Dashboard verfügbar. Details findest du auf der Seite mit den Standalone-Optionen.
