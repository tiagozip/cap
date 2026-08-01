---
description: "Comment Cap fonctionne en interne : le CAPTCHA auto-hébergé génère des défis de preuve de travail avec graine, les résout en WASM, puis échange un jeton signé sur le serveur."
---

# Comment fonctionne Cap ?

Ceci est une explication plutôt technique du fonctionnement des défis SHA-256 et d'instrumentation de Cap. Elle ne couvre pas les [verrous temporels RSW](./rsw.md). Si vous cherchez une vue d'ensemble plus générale, consultez la page [Efficacité](./effectiveness.md).

---

1. À son initialisation, Cap enregistre automatiquement un élément personnalisé pour le widget dans le navigateur.
2. Le widget crée un shadow DOM et y ajoute tous les éléments nécessaires.

#### Demander le défi

3. Lorsqu'une résolution est demandée, le widget envoie une requête au serveur. Celui-ci renvoie un jeton, la configuration des défis à résoudre et, éventuellement, des données d'instrumentation compressées.

4. Le widget génère ensuite plusieurs défis à partir d'une graine fixée (le jeton de défi) et de la configuration fournie par le serveur. Si des données d'instrumentation sont présentes, elles sont décompressées et résolues dans une iframe isolée.

#### Calculer la solution

5. Le widget s'appuie sur du WASM écrit en Rust et sur des Web Workers pour résoudre les défis en parallèle :
   - Chaque worker tente de trouver un nonce valide en répétant les étapes suivantes :
     - combiner le sel avec différentes valeurs de nonce,
     - calculer le hachage SHA-256 de cette combinaison,
     - vérifier si le hachage obtenu commence par le préfixe cible.
   - Le WASM incrémente le nonce jusqu'à trouver un hachage correspondant.

6. Les défis d'instrumentation sont décompressés et exécutés, s'il y en a.

#### Échanger la solution contre un jeton

7. Une fois une solution valide trouvée, le widget renvoie le résultat au serveur pour validation.
8. Le serveur génère alors lui-même les mêmes défis à partir du jeton et de la configuration fournis, et vérifie les solutions soumises par le widget.
9. Après vérification réussie, le serveur consomme la solution et émet un jeton permettant d'authentifier la requête.
