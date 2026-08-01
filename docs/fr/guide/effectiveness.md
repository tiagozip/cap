---
description: "L'efficacité de Cap face aux bots : ce CAPTCHA open source associe preuve de travail et instrumentation pour rendre l'abus coûteux tout en restant invisible pour les utilisateurs."
---

# Efficacité

## Vie privée et sécurité

Par défaut, Cap n'utilise ni cookies ni aucune forme de télémétrie. Aucune donnée n'est collectée ni stockée sur des serveurs centraux, puisque tout est entièrement auto-hébergé.

Cap inclut par défaut une protection contre le rejeu et des jetons de défi signés.

## Pourquoi la preuve de travail ?

Tout CAPTCHA finit par être résolu, que ce soit par des IA, des algorithmes, de la rétro-ingénierie et des empreintes falsifiées, ou par des humains payés dans des fermes à CAPTCHA. Il en résulte un interminable jeu du chat et de la souris entre attaquants et défenseurs. La différence décisive tient au coût imposé aux attaquants.

L'objectif de Cap est de rendre l'abus automatisé coûteux et difficile, tout en gardant une expérience rapide et quasi invisible pour les vrais utilisateurs. La preuve de travail est l'équilibre parfait pour cela : elle bloque l'abus en exigeant un effort de calcul, plutôt que de reposer uniquement sur des méthodes de vérification humaine que les bots apprennent sans cesse à imiter.

Imaginez qu'envoyer 10 000 messages de spam coûte 1 $ et rapporte potentiellement 10 $ : l'opération est rentable. Si Cap augmente le coût de calcul au point que ces mêmes messages coûtent désormais 100 $, le spammeur perd 90 $. L'incitation financière disparaît.

La preuve de travail de Cap s'inspire largement de [Hashcash](https://www.researchgate.net/publication/2482110_Hashcash_-_A_Denial_of_Service_Counter-Measure). Nos défis d'instrumentation s'inspirent des défis maison de Twitter et de YouTube.

## Rendre les GPU inutiles

SHA-256 est un choix raisonnable comme algorithme de preuve de travail générique, mais il peut être fortement optimisé sur GPU. C'est pourquoi nous prenons aussi en charge des algorithmes expérimentaux résistants aux GPU, comme les [verrous temporels RSW](./rsw.md).

## Voir aussi

- [CAPTCHA et taux de conversion](./captcha-conversion-rate.md) : ce que la friction des défis coûte en inscriptions
- [Meilleures alternatives aux CAPTCHA en 2026](./best-captcha-alternatives.md) : comment les autres mécanismes se comparent
