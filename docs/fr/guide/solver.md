---
description: "@cap.js/solver résout les défis de preuve de travail Cap côté serveur sur Bun, pour les flux machine à machine. Une brique minuscule et sans dépendances du CAPTCHA open source."
---

# M2M

`@cap.js/solver` est une bibliothèque autonome qui permet de résoudre des défis Cap depuis le serveur. Elle est extrêmement simple (aucune dépendance, un seul fichier) tout en étant aussi rapide et efficace que le widget. Notez qu'elle **ne fonctionne qu'avec Bun**.

Ce paquet ne contourne aucune preuve de travail réelle. **Il ne prend pas en charge les défis d'instrumentation.**

## Installation

```bash
bun add @cap.js/solver
```

## Utilisation

#### À partir de défis avec graine

```js
import solver from "@cap.js/solver";

console.log(
  await solver("challenge token", {
    c: 50, // nombre de défis
    s: 32, // taille du sel
    d: 4, // difficulté
  }),
);
```

#### À partir d'une liste de défis

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

**Sortie :**

```json
[67302, 64511, 40440, 27959, 71259 /* ... */]
```

Le second argument est facultatif mais peut toujours être fourni. C'est toujours un objet.

- Pour **tous les types de défis**, `workerCount` indique le nombre de workers à utiliser (par défaut, le nombre de cœurs CPU).

- Pour **tous les types de défis**, `onProgress` permet aussi de fournir un callback de suivi de progression.

- Pour les **défis avec graine uniquement**, il sert à préciser le nombre de solutions à générer, la taille des défis et la difficulté.
