---
outline: [2, 3]
description: "HashWX est la preuve de travail résistante aux GPU de Cap. Chaque défi génère une nouvelle fonction de hachage, si bien qu'un GPU ne garde qu'un avantage d'environ 2x sur un CPU au lieu de 150x."
---

# Preuve de travail HashWX

**HashWX** est le protocole de défi par défaut de Cap. Au lieu d'une fonction de hachage fixe comme SHA-256, chaque défi génère à partir d'une graine une **nouvelle** fonction à sens unique, construite avec des opérations entières et des branchements choisis pour qu'un GPU ne puisse pas l'exécuter beaucoup plus vite qu'un CPU.

Elle a été conçue par [tevador](https://github.com/tevador/hashwx), également auteur de RandomX et de HashX. Cap embarque la version WebAssembly de référence.

::: tip
HashWX est le protocole par défaut des nouvelles clés Standalone. Dans cap-core, il s'active via l'API format 2, et la preuve de travail SHA-256 y reste le choix par défaut. Voir [Défis HashWX](./capjs-core.md#format-2-hashwx).
:::

## Pourquoi HashWX

Le problème de la preuve de travail SHA-256, c'est le débit. Un GPU exécute la même fonction fixe sur des milliers de voies au même rythme et résout donc bien plus de défis par seconde qu'un CPU. C'est la mesure qui compte pour la protection contre les bots : un attaquant se moque du temps que prend un défi, seul lui importe le nombre qu'il peut traiter par heure.

Cap livrait auparavant des verrous temporels RSW pour cela. RSW gagne sur la **latence**, puisque les élévations au carré séquentielles ne se parallélisent pas au sein d'un même puzzle, mais il perd lourdement sur le **débit**, car un GPU peut mener des milliers de puzzles indépendants de front. Mesuré face à un GPU grand public :

| Algorithme | CPU, Ryzen 3700X, 16 threads | GPU, RTX 5060 Ti | Avantage GPU |
|---|---:|---:|---:|
| SHA-256 | 41 MH/s | 6150 MH/s | ~150x |
| RSW | 26 H/s | 4400 H/s | ~170x |
| **HashWX** | **2,8 MH/s** | **5,8 MH/s** | **~2x** |

Ces chiffres sont ceux de tevador, obtenus avec sa propre implémentation CUDA non publique. Nous avons reproduit la ligne RSW de notre côté : un M3 mesure 2,112 H/s par thread, ce qui donne 26 H/s pour 16 threads Ryzen.

RSW est déprécié. Il reste sélectionnable par clé et les clés existantes continuent de fonctionner, mais il ne faut plus le retenir pour un nouveau déploiement.

## Coût {#cost}

Coût serveur par défi, mesuré sur un cœur d'Apple M3, médiane sur 200 émissions et 40 vérifications via `validateChallenge` :

| Protocole | Émission | Vérification | Total |
|---|---:|---:|---:|
| **HashWX**, 1 défi | **14 µs** | **40 µs** | **54 µs** |
| **HashWX**, 4 sous-défis (par défaut) | **20 µs** | **129 µs** | **149 µs** |
| SHA-256 (50 défis, difficulté 4) | 4 µs | 83 µs | 87 µs |
| RSW (t = 75 000) | 1522 µs | 14 µs | 1536 µs |

Un défi HashWX unique offre l'aller-retour le moins cher des trois. Les quatre sous-défis par défaut coûtent environ 150 µs, plus que SHA-256 mais un dixième de RSW, qui paie quatre vraies exponentiations modulaires à chaque émission. La difficulté ne change rien à ces chiffres : vérifier revient à un hachage par sous-défi, quelle qu'ait été la difficulté pour le trouver.

Le coût côté client est l'autre versant du compromis. Un défi unique a un temps de résolution qui suit une loi exponentielle, ce qui en fait une loterie : la même difficulté prend 30 ms pour un visiteur et trois secondes pour le suivant. Cap répartit donc par défaut la difficulté sur quatre sous-défis, ce qui rend le temps de résolution plus régulier. Mesuré via le widget dans Chrome stable sur un M3 à 8 cœurs, 72 résolutions chacun, les deux difficultés réglées sur à peu près la même médiane :

| | 1 défi, d = 1 330 000 | 4 sous-défis, d = 1 000 000 |
|---|---:|---:|
| Médiane | 536 ms | 490 ms |
| p90 | 1447 ms | 778 ms |
| Plus lent sur 72 | 2378 ms | 1490 ms |

La colonne de droite correspond à la configuration par défaut. Face à une clé Standalone, elle a donné une médiane de 578 ms et un p90 de 0,9 s.

À difficulté donnée, répartir ne change rien à ce que paie un attaquant, puisque le travail attendu reste de `d` hachages quelle que soit la découpe. C'est la forme de la distribution qui change. La médiane d'un défi unique vaut 0,69 fois sa moyenne, alors que quatre sous-défis la portent à environ 0,92 fois la moyenne et raccourcissent la queue. À difficulté égale, la répartition rend donc une résolution typique environ un tiers plus lente et réduit le p90 d'environ un quart. Le tableau fixe plutôt la médiane, ce qui place la répartition à 25% de difficulté en moins et donne à un attaquant 25% de travail en moins par résolution. Le surcoût propre au widget est faible. Ses workers vérifient toutes les 16 ms s'ils doivent s'arrêter, ce qui borne la durée d'un passage de relais entre sous-défis.

### Moteurs de navigateur

La version wasm tourne à environ 60% de la vitesse native. Sur un seul worker, les trois grands moteurs sont proches, et Safari décroche dès que tous les cœurs sont occupés. Mesuré sur le même M3 en une seule session, chaque navigateur en mode headless ou au premier plan :

| Moteur | 1 worker | 8 workers | Repli interprété |
|---|---:|---:|---:|
| Chrome 153 | 440 KH/s | 2050 KH/s | 94 KH/s |
| Firefox 156 | 420 KH/s | 1850 KH/s | 105 KH/s |
| Safari 27.2 | 410 KH/s | 1480 KH/s | 105 KH/s |

Sur un worker, les trois restent à moins de 5% les uns des autres. Sur huit, Safari atteint environ 70% du débit de Chrome : calez donc la difficulté sur Safari. À d = 1 000 000, cela donne une moyenne d'environ 0,5 s sur Chrome et 0,7 s sur Safari.

Si vous faites vos propres mesures, utilisez une version stable de chaque navigateur, avec l'onglet au premier plan. Le Firefox fourni avec Playwright exécute n'importe quelle charge WebAssembly trois à six fois plus lentement qu'un Firefox stable, pas seulement HashWX, et un onglet en arrière-plan peut être relégué sur les cœurs basse consommation, ce qui divise tous les chiffres par deux.

### Téléphones {#phones}

La configuration par défaut sur de vrais téléphones via BrowserStack, 15 résolutions chacun et 30 sur le Vivo. Chaque série a démarré sur une page tout juste chargée, comme lors d'une vraie visite. Une fois que la page avait déjà exécuté HashWX pendant une minute, le Pixel 6 mettait 24% de temps en moins par résolution et le Vivo 29% de moins. Un benchmark avec préchauffage donnera donc de meilleurs chiffres que ceux-ci.

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
| Galaxy M32 | Android 11 | 444 KH/s | 2,8 s | 6,1 s |
| Vivo Y21 | Android 11 | 316 KH/s | 5,9 s | 11,0 s |

Chaque résolution inclut deux allers-retours vers le serveur de test, avec une médiane de 80 à 190 ms selon l'appareil. Le Vivo, un Android d'entrée de gamme, met environ dix fois plus longtemps que l'ordinateur M3. Si l'essentiel de votre trafic vient du mobile, baissez la difficulté. Le temps de résolution évolue linéairement avec elle, donc 500 000 divise à peu près par deux la part de calcul de chaque chiffre de ce tableau.

Les clients sans WebAssembly ne peuvent pas résoudre HashWX du tout et reçoivent une erreur. Si vous devez les prendre en charge, utilisez la preuve de travail SHA-256, qui dispose d'un repli en JavaScript pur. Sur iPhone, le widget nécessite iOS 15 ou plus récent.

## Ce contre quoi HashWX ne protège pas

La même chose que RSW : le silicium sur mesure. Un FPGA ou un ASIC conçu pour cela battrait toujours un CPU. L'équation économique ne tient pas pour l'exploitation industrielle de CAPTCHA, puisqu'un ASIC coûte des millions en frais de conception, mais ce n'est pas une garantie cryptographique.

Cela n'arrête pas non plus les fermes de résolution humaines, et cela ne les arrêtera jamais. La preuve de travail augmente le coût par requête. Associez-la aux [défis d'instrumentation](./instrumentation.md) pour exiger en plus un véritable environnement de navigateur.

## L'essayer

L'API de cap-core est documentée dans [Défis HashWX](./capjs-core.md#format-2-hashwx). Le widget détecte automatiquement les réponses au format 2 : mettre le serveur à jour suffit.

Sur [Cap Standalone](./standalone/options.md#hashwx-proof-of-work), HashWX est le protocole par défaut des nouvelles clés et se change clé par clé dans le tableau de bord.
