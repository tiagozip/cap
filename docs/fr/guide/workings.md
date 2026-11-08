---
description: "Comment fonctionne Cap : le CAPTCHA auto-hébergé fait résoudre un défi de preuve de travail au navigateur de chaque visiteur et lui fait exécuter un script d'instrumentation, puis échange le résultat contre un jeton à usage unique."
---

# Comment fonctionne Cap ?

Cap ne cherche pas à décider si un visiteur est humain. Il impose un coût de calcul à chaque requête, faible pour un visiteur et élevé pour quelqu'un qui en envoie des milliers, et vérifie que le calcul a eu lieu dans un vrai navigateur.

## Déroulement d'une requête {#what-happens-on-a-request}

1. Dès que le widget est visible, il demande un défi à votre serveur. Le serveur répond avec un jeton signé qui décrit le défi, et généralement un script d'instrumentation. Le widget lance immédiatement le script dans une iframe isolée.
2. Le navigateur résout la preuve de travail dans des Web Workers avec WebAssembly. Selon le défi, il commence à la première interaction du visiteur avec la page ou quand celui-ci clique sur le widget.
3. Le widget récupère le résultat de l'instrumentation et envoie les deux résultats au serveur. Le serveur vérifie la signature du jeton et la preuve de travail, marque le défi comme utilisé, puis vérifie le résultat de l'instrumentation.
4. Si toutes les vérifications passent, le serveur émet un jeton à usage unique. Le widget l'insère dans votre formulaire, et votre backend le vérifie avec `/siteverify` avant de faire confiance à la soumission.

Le serveur ne conserve aucun état pour un défi en cours, puisque tout ce dont il a besoin se trouve dans le jeton signé. Il ne stocke que les défis utilisés et les jetons qu'il a émis.

## Pourquoi la preuve de travail {#why-proof-of-work}

Tout CAPTCHA finit par être résolu, par des modèles de reconnaissance d'images, par rétro-ingénierie ou par des personnes payées à la résolution. Un CAPTCHA peut contrôler le coût de chaque résolution.

Supposons qu'un spammeur paie 1 $ pour envoyer 10 000 messages et en tire 10 $. Si Cap porte le coût de ces messages à 100 $, la campagne perd de l'argent. Un visiteur qui remplit un seul formulaire paie environ une demi-seconde de CPU et ne voit jamais de puzzle.

L'idée vient de [Hashcash](https://www.researchgate.net/publication/2482110_Hashcash_-_A_Denial_of_Service_Counter-Measure).

## Les deux couches {#the-two-layers}

La **preuve de travail** montre que le client a effectué le calcul. Avec SHA-256, un GPU résout environ 150 fois plus de défis par seconde qu'un CPU, ce qui permet à un attaquant de s'en tirer à faible coût. [HashWX](./hashwx.md), le protocole par défaut, ramène ce rapport à environ 2.

L'**[instrumentation](./instrumentation.md)** montre que le calcul s'est produit dans un navigateur. Chaque défi contient un script nouvellement généré qui effectue des calculs via le DOM, et le serveur connaît la réponse attendue. L'exécuter hors d'un vrai moteur de navigateur est difficile. Il peut aussi détecter les outils d'automatisation courants et les agents IA, et évaluer comment les mouvements du pointeur et les saisies au clavier du visiteur ont atteint le widget.

Chaque couche compense les limites de l'autre. La preuve de travail seule peut être résolue par un script sans navigateur, et l'instrumentation seule peut être résolue à faible coût par de nombreux vrais navigateurs. Aucune n'arrête une ferme de personnes qui résolvent les défis à la main, mais la preuve de travail impose toujours un coût à chacune de leurs résolutions.

## Confidentialité {#privacy}

Cap ne dépose aucun cookie et ne collecte aucune télémétrie. Les défis, les jetons et les statistiques restent sur votre serveur. Avec l'évaluation du comportement activée, le widget envoie à votre serveur les mouvements du pointeur et les temps de frappe du visiteur, mais jamais les touches pressées ni le texte saisi. Le widget appelle le point d'accès que vous lui donnez, ainsi que jsDelivr pour ses fichiers WASM, sauf si vous [les auto-hébergez](./widget.md#self-hosting-the-widget). Consultez la page [Conformité](./compliance.md) pour le RGPD, le CCPA et l'accessibilité.
