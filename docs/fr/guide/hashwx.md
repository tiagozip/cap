---
outline: [2, 3]
description: "HashWX est la preuve de travail résistante aux GPU de Cap. Chaque défi génère une nouvelle fonction de hachage, si bien qu'un GPU ne garde qu'un avantage d'environ 2x sur un CPU au lieu de 150x."
---

# HashWX

HashWX est la preuve de travail par défaut de Cap. Là où SHA-256 utilise une fonction de hachage fixe, HashWX en génère une nouvelle pour chaque bloc de nonces, construite avec des opérations entières et des branchements que les GPU exécutent mal. Elle a été conçue par [tevador](https://github.com/tevador/hashwx), également auteur de RandomX, et son [document de conception](https://github.com/tevador/hashwx/blob/master/doc/design.md) explique son fonctionnement. Cap utilise sa version WebAssembly de référence.

C'est le protocole par défaut des nouvelles clés dans capd. Dans la bibliothèque core, il [s'active explicitement](./capjs-core.md#format-2-hashwx).

## Pourquoi pas SHA-256 {#why-not-sha-256}

Ce qui compte pour la protection contre les bots, c'est le nombre de défis qu'un attaquant résout par heure, pas le temps qu'en prend un seul. Un GPU exécute une fonction fixe comme SHA-256 sur des milliers de voies à la fois. Cap utilisait des verrous temporels RSW avant HashWX. Ils ne peuvent pas être parallélisés au sein d'un même puzzle, mais un GPU exécute quand même des milliers de puzzles indépendants en parallèle. Mesuré face à un GPU grand public :

| Algorithme | CPU, Ryzen 3700X, 16 threads | GPU, RTX 5060 Ti | Avantage GPU |
|---|---:|---:|---:|
| SHA-256 | 41 MH/s | 6150 MH/s | ~150x |
| RSW | 26 H/s | 4400 H/s | ~170x |
| HashWX | 2,8 MH/s | 5,8 MH/s | ~2x |

Ces chiffres sont ceux de tevador, obtenus avec sa propre implémentation CUDA non publique. Cap a reproduit la ligne RSW : un M3 atteint 2,11 H/s par thread, ce qui donne 26 H/s sur 16 threads Ryzen.

RSW est déprécié. capd sert désormais HashWX aux clés réglées sur RSW. La bibliothèque core émet toujours des défis RSW sur demande, mais ne le choisissez pas pour de nouvelles installations.

## Coût {#cost}

Temps serveur par défi sur un cœur d'Apple M3, médiane sur 200 émissions et 40 vérifications :

| Protocole | Émission | Vérification | Total |
|---|---:|---:|---:|
| HashWX, 1 défi | 14 µs | 40 µs | 54 µs |
| HashWX, 4 sous-défis par défaut | 20 µs | 129 µs | 149 µs |
| SHA-256, 50 défis à la difficulté 4 | 4 µs | 83 µs | 87 µs |
| RSW, t = 75 000 | 1522 µs | 14 µs | 1536 µs |

La difficulté ne change rien à ces chiffres, puisque la vérification demande un hachage par sous-défi, quel que soit le temps passé à le trouver.

Côté client, un défi unique a un temps de résolution aléatoire. La même difficulté peut prendre 30 ms pour un visiteur et 3 s pour le suivant. Cap répartit la difficulté sur quatre sous-défis par défaut, ce qui rend les temps plus réguliers. Mesuré via le widget dans Chrome sur un M3 à 8 cœurs, 72 résolutions chacun, les deux difficultés réglées sur à peu près la même médiane :

| | 1 défi, d = 1 330 000 | 4 sous-défis, d = 1 000 000 |
|---|---:|---:|
| Médiane | 536 ms | 490 ms |
| p90 | 1447 ms | 778 ms |
| Plus lent sur 72 | 2378 ms | 1490 ms |

La colonne de droite correspond à la configuration par défaut. Face à une clé capd, elle a donné une médiane de 578 ms et un p90 de 0,9 s. La répartition ne change rien à ce que paie un attaquant, puisque le travail attendu reste de `d` hachages dans les deux cas.

### Navigateurs {#browsers}

La version WebAssembly tourne à environ 60% de la vitesse native. Mesuré sur le même M3 :

| Navigateur | 1 worker | 8 workers | Repli interprété |
|---|---:|---:|---:|
| Chrome 153 | 440 KH/s | 2050 KH/s | 94 KH/s |
| Firefox 156 | 420 KH/s | 1850 KH/s | 105 KH/s |
| Safari 27.2 | 410 KH/s | 1480 KH/s | 105 KH/s |

Safari atteint environ 70% du débit de Chrome sur tous les cœurs, donc calez la difficulté sur Safari. Avec la valeur par défaut, cela donne environ 0,5 s sur Chrome et 0,7 s sur Safari.

Si vous faites vos propres mesures, utilisez des versions stables avec l'onglet au premier plan. Le Firefox fourni avec Playwright exécute tout WebAssembly trois à six fois plus lentement qu'un vrai Firefox, et un onglet en arrière-plan peut se retrouver sur les cœurs basse consommation.

### Téléphones {#phones}

La difficulté par défaut sur de vrais téléphones via BrowserStack, 15 résolutions chacun et 30 sur le Vivo, chaque résolution démarrant sur une page tout juste chargée :

| Appareil | Système | Tous les cœurs | Médiane | Plus lent |
|---|---|---:|---:|---:|
| Galaxy S24 | Android 14 | 1238 KH/s | 1,1 s | 1,8 s |
| Pixel 9 | Android 15 | 837 KH/s | 1,4 s | 2,0 s |
| Pixel 6 | Android 12 | 746 KH/s | 1,9 s | 2,4 s |
| iPhone 15 | iOS 17 | non mesuré | 1,9 s | 4,3 s |
| iPhone 12 | iOS 17 | 620 KH/s | 2,0 s | 3,3 s |
| iPhone 13 | iOS 15 | 678 KH/s | 2,2 s | 4,1 s |
| iPhone SE 2022 | iOS 15 | 588 KH/s | 2,4 s | 4,0 s |
| Redmi Note 11 | Android 11 | 456 KH/s | 2,4 s | 4,8 s |

Chaque résolution inclut deux allers-retours vers le serveur de test, de 80 à 190 ms chacun. Une page qui exécutait déjà HashWX depuis une minute résolvait les défis 24% à 29% plus vite. Les benchmarks avec préchauffage donnent donc de meilleurs résultats que ceux des visiteurs.

Si l'essentiel de votre trafic vient du mobile, baissez la difficulté. Le temps de résolution évolue avec elle, donc 500 000 divise à peu près par deux la part de calcul de ces chiffres.

HashWX exige WebAssembly, et iOS 15 ou plus récent sur iPhone. Pour les navigateurs sans WebAssembly, utilisez SHA-256, qui dispose d'un repli en JavaScript.

## Limites {#limits}

Du matériel sur mesure battrait toujours un CPU. Un FPGA ou un ASIC conçu pour HashWX coûte des millions à concevoir, ce qui n'a pas de sens pour résoudre des CAPTCHA, mais c'est un argument économique, pas cryptographique.

Cela n'arrête pas non plus les personnes payées pour résoudre les défis à la main. Associez-le à l'[instrumentation](./instrumentation.md) pour exiger aussi un vrai navigateur.
