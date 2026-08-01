---
description: "@cap.js/solver löst Cap-Proof-of-Work-Challenges serverseitig auf Bun für Machine-to-Machine-Abläufe. Ein winziger, abhängigkeitsfreier Baustein des quelloffenen CAPTCHAs."
---

# M2M

`@cap.js/solver` ist eine eigenständige Bibliothek, mit der sich Cap-Challenges vom Server aus lösen lassen. Sie ist extrem einfach (keine Abhängigkeiten, eine einzige Datei) und dabei so schnell und effizient wie das Widget. Beachte, dass sie **nur mit Bun** verwendet werden kann.

Dieses Paket umgeht keinerlei tatsächlichen Proof-of-Work. **Instrumentation-Challenges werden nicht unterstützt.**

## Installation

```bash
bun add @cap.js/solver
```

## Verwendung

#### Aus Seeded Challenges

```js
import solver from "@cap.js/solver";

console.log(
  await solver("challenge token", {
    c: 50, // Anzahl der Challenges
    s: 32, // Salt-Größe
    d: 4, // Schwierigkeit
  }),
);
```

#### Aus einer Challenge-Liste

```js
import solver from "@cap.js/solver";

const challenges = [
  ["a5b6fda4aaed97cf61d7dd9259f733b5", "d455"],
  ["286bcc39249f9ee698314b600c32e40f", "f0ff"],
  ["501350aa7c46573cb604284554045703", "4971"],
  ["a55c02f3b9b4cd088a5a7ee3d4941c14", "eab7"],
  ["5f3362c12e2779f56f4ef75b4494f5e6", "999f"],
  /* ... */
];

console.log(await solver(challenges));
```

**Ausgabe:**

```json
[67302, 64511, 40440, 27959, 71259 /* ... */]
```

Das zweite Argument ist optional, kann aber immer übergeben werden. Es ist stets ein Objekt.

- Für **alle Challenge-Typen** gibt `workerCount` die Anzahl der zu nutzenden Worker an (Standard ist die Anzahl der CPU-Kerne).

- Für **alle Challenge-Typen** kann außerdem `onProgress` genutzt werden, um einen Callback für Fortschrittsmeldungen bereitzustellen.

- **Nur für Seeded Challenges** dient es dazu, die Anzahl der zu erzeugenden Lösungen, die Größe der Challenges und die Schwierigkeit festzulegen.
