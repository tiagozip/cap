---
description: "Les défis d'instrumentation de Cap exécutent du JS généré par le serveur pour vérifier la présence d'un vrai navigateur, en complément de la preuve de travail du CAPTCHA open source auto-hébergé."
---

# Défis d'instrumentation

Les défis d'instrumentation constituent la deuxième couche de vérification de Cap. Ils s'exécutent silencieusement aux côtés du système de preuve de travail et sont présents dans Cap Standalone.

À chaque requête, ils génèrent un programme JavaScript unique, exécuté dans le navigateur du visiteur. La sortie est vérifiée côté serveur, ce qui permet à Cap de confirmer la présence d'un véritable environnement navigateur avant d'accepter un jeton.

## Leur fonctionnement

Lorsqu'un défi est émis, le serveur génère un bundle JavaScript autonome qui exécute quelques sondes sur les API du navigateur et évalue une chaîne de calcul principale : plusieurs variables entières sont initialisées avec des graines aléatoires, puis modifiées par des opérations tirées au hasard, dont des AND/OR/XOR/NAND bit à bit, des astuces sur la chaîne de prototypes et de l'arithmétique fondée sur le DOM qui ajoute un arbre d'éléments à la page, le remonte en accumulant des valeurs, puis le supprime.

Le serveur suit en parallèle le résultat attendu de chaque opération, il sait donc quelles doivent être les quatre valeurs finales.

Toutes ces vérifications s'exécutent dans une iframe, qui renvoie les réponses au parent via `postMessage`.

## Pourquoi des opérations DOM

L'arithmétique pure peut être reproduite hors navigateur en se contentant d'exécuter le JavaScript. Les opérations DOM, non, du moins pas à moindre coût. Construire de véritables arbres d'éléments, lire des valeurs via le moteur de rendu du navigateur, puis les démonter, sollicite une partie du navigateur que les runtimes non-navigateur remplacent souvent par des stubs, implémentent mal, ou ignorent complètement par souci de performance. Le défi devient ainsi bien plus difficile à rejouer en dehors d'un vrai moteur de rendu.

Les défis d'instrumentation combinent souvent ces opérations avec une liste prédéfinie de vérifications.

## Détection des navigateurs automatisés

Les défis d'instrumentation peuvent aussi, en option, tenter de bloquer les webdrivers automatisés. Nous effectuons énormément de vérifications à ce sujet, mais elles ne sont pas infaillibles. Même des CAPTCHA commerciaux et propriétaires comme Turnstile peuvent être contournés par des attaquants au moyen de navigateurs furtifs patchés.

## Relation avec la preuve de travail

Les défis d'instrumentation et la preuve de travail sont complémentaires, pas redondants. La preuve de travail atteste d'un *effort* : le client a dû brûler des cycles CPU pour trouver un hachage. L'instrumentation atteste d'un *environnement* : le calcul s'est produit dans un navigateur, pas dans un script. Ensemble, ils augmentent le coût de l'abus sur deux axes indépendants ; aucun des deux ne suffit seul face à un attaquant déterminé, mais les vaincre tous les deux simultanément est nettement plus difficile.

L'instrumentation n'est pas infaillible. Même si des défis de ce type sont déployés à très grande échelle par des plateformes comme [YouTube](https://www.reddit.com/r/youtubedl/comments/1mkzmp3/what_is_a_po_token/) et [Twitter](https://x.com/i/js_inst), je ne recommande pas de les utiliser en remplacement de la preuve de travail. Sans PoW et avec de vrais navigateurs, des attaquants peuvent résoudre ces défis à faible coût.
