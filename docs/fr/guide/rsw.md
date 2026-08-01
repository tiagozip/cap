---
outline: [2, 3]
description: "Les verrous temporels RSW sont l'alternative résistante aux GPU de Cap face à la preuve de travail SHA-256. Comment le CAPTCHA open source utilise les défis Rivest-Shamir-Wagner."
---

# Verrous temporels RSW

Les versions récentes de Cap ajoutent un type de défi expérimental appelé **verrou temporel RSW** (Rivest-Shamir-Wagner). Il existe comme alternative plus résistante aux GPU à la preuve de travail SHA-256 par défaut.

::: tip
RSW est **optionnel**. Le pipeline Cap par défaut continue d'utiliser la preuve de travail SHA-256. Les widgets et serveurs existants ne changent pas de comportement tant que vous ne l'[activez pas explicitement](./capjs-core.md#format-2-rsw-opt-in).
:::

## Pourquoi RSW

La preuve de travail SHA-256 par défaut de Cap est rapide et peu coûteuse à vérifier, mais chaque puzzle peut théoriquement être accéléré par des GPU ou des ASIC. Nous n'avons pas encore observé cela en conditions réelles, mais à mesure que les GPU deviennent moins chers et plus accessibles, la marge de sécurité d'une preuve de travail fondée sur le hachage s'érode.

RSW est un puzzle séquentiel, conçu pour résister à l'accélération GPU. Nous continuons de le tester et de le mesurer avant de le déclarer prêt pour la production, mais les résultats sont pour l'instant très prometteurs.

De fait, d'après nos tests, RSW est **plus lent** sur une A100 que sur un téléphone récent comme l'iPhone Air. Nous avons mesuré cela sur quelques GPU loués (avec la bibliothèque [CGBN](https://github.com/NVlabs/CGBN) de NVIDIA elle-même) et sur des appareils grand public :

| Matériel | µs / élévation au carré sur 2048 bits (chaîne unique) |
|---|---:|
| Apple M3 Air, Chrome 148 | **2,39** |
| Apple iPhone Air, iOS 26 + Chrome | 3,07 |
| Pixel 9, Chrome 145 | 5,14 |
| iPhone 12, iOS 17 (WebKit) | 8,57 |
| **NVIDIA H100, 32 threads coopérant sur une chaîne** | **2,70** |
| NVIDIA L4, 32 threads coopérant | 2,69 |
| NVIDIA A100, 32 threads coopérant | 4,82 |

## Fonctionnement du protocole

### Initialisation (une fois au démarrage)

Le serveur génère un module de 2048 bits de type RSA, `N = p·q`. Il garde `p` et `q` secrets et ne publie que `N`. La génération de la paire de clés prend environ 0,5 à 3 secondes selon la chance au tirage des nombres premiers : le serveur doit donc conserver le résultat et le réutiliser d'un processus à l'autre.

### Émission d'un défi (≈ 2 ms)

Naïvement, émettre un défi obligerait le serveur à calculer `y = x^(2^t) mod N` depuis zéro, c'est-à-dire exactement le travail coûteux que fait le client. Nous l'évitons grâce à l'astuce de l'exposant court :

1. À l'initialisation, le serveur précalcule une fois `h = g^(2^t) mod N` à l'aide de la trappe `φ(N) = (p-1)(q-1)`. C'est **une seule** exponentiation modulaire pleine puissance.
2. Pour chaque défi, le serveur tire un scalaire aléatoire de 256 bits `r`, puis calcule :
   - `x = g^r mod N`
   - `y = h^r mod N`
3. Algébriquement, `x^(2^t) = (g^r)^(2^t) = (g^(2^t))^r = h^r = y`

`g^r` et `h^r` sont deux exponentiations modulaires à exposant de 256 bits, environ 4 multiplications courtes chacune. Avec l'accélération par théorème des restes chinois sur `p` et `q`, l'émission complète prend environ 2 millisecondes sur un CPU moderne.

Le client ne voit que `(N, x, t)`. Retrouver `r` à partir de `x` revient à un logarithme discret dans `(Z/N)*`, aussi difficile que factoriser `N`. L'exposant de 256 bits n'ouvre aucun raccourci (aucune attaque sous-exponentielle connue sur le DLP dans un sous-groupe à module de 2048 bits avec exposant court).

### Résolution côté client

Tout ce que le client doit faire, à partir de `(N, x, t)`, c'est calculer :

```js
let y = x;
for (let i = 0; i < t; i++) y = (y * y) % N;
```

Cela prend environ 300 à 800 ms sur la plupart des machines.

### Vérification côté serveur (≈ 100 µs)

Le jeton d'état chiffré du serveur contient déjà le `y` attendu (placé là au moment de l'émission). La vérification est une comparaison `BigInt` en temps constant avec le `y` soumis. Aucun recalcul n'est nécessaire.

## Ce contre quoi RSW ne protège *pas*

RSW ne protège pas contre le matériel FPGA ou ASIC. Du silicium dédié réalise une élévation au carré modulaire sur 2048 bits en 50 à 100 ns sur FPGA (environ 15 à 20 fois un cœur CPU), et en quelques nanosecondes sur ASIC (environ 200 à 300 fois). L'équation économique reste défavorable pour l'exploitation industrielle de CAPTCHA, puisqu'un ASIC sur mesure coûte des millions en frais de conception, mais si votre modèle de menace inclut des attaquants de niveau étatique, vous avez de toute façon un problème.

## L'essayer

L'API de cap-core pour RSW est documentée dans [Défis RSW](./capjs-core.md#format-2-rsw-opt-in). Le widget détecte automatiquement les réponses au format 2 : une simple mise à jour du binaire côté serveur suffit.

Si vous utilisez [Cap Standalone](./standalone/options.md#rsw-time-lock-puzzles), RSW est exposé comme une bascule par clé dans le tableau de bord. Voir la page des options standalone pour les détails.
