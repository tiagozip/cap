---
title: "Les meilleures options de CAPTCHA open source en 2026"
description: "Les meilleures options de CAPTCHA open source et auto-hébergées pour développeurs, comparées : Cap, ALTCHA, mCAPTCHA et Anubis, avec licences, architecture et critères de choix."
faq:
  - q: Quel est le meilleur CAPTCHA open source ?
    a: "Cap, si vous voulez une pile complète : deux couches de vérification, un tableau de bord, une API siteverify compatible. ALTCHA, si vous voulez une bibliothèque minimale."
  - q: Puis-je auto-héberger un CAPTCHA ?
    a: "Oui, et c'est plus simple qu'il n'y paraît. Cap tourne avec un conteneur Docker plus Valkey, tient sur un VPS à 5 $, et se met en place en cinq minutes environ."
  - q: Cap est-il gratuit ?
    a: "Entièrement. Apache 2.0, sans quotas, sans offre payante, quel que soit le volume."
  - q: Cap est-il meilleur qu'ALTCHA ?
    a: "Cap fournit davantage (couche d'instrumentation, serveur standalone, tableau de bord, retour de progression, widget plus léger) ; ALTCHA en fournit moins, volontairement. Choisissez selon ce que vous voulez construire vous-même."
  - q: Un CAPTCHA open source protège-t-il la vie privée ?
    a: "Il rend la confidentialité vérifiable au lieu d'être promise. La preuve de travail auto-hébergée n'a besoin ni de fingerprinting, ni de profilage comportemental, ni d'appels tiers, et vous pouvez lire le code pour le confirmer."
---

# Les meilleures options de CAPTCHA open source en 2026

**Réponse courte :** Cap est une alternative aux CAPTCHA, gratuite, open source et auto-hébergée, sous licence Apache 2.0, qui utilise la preuve de travail et des [défis d'instrumentation](./instrumentation.md) au lieu de puzzles visuels. Les autres options open source sérieuses sont **ALTCHA** (bibliothèque de preuve de travail minimale), **mCAPTCHA** (preuve de travail, pré-1.0 et peu actif) et **Anubis** (mur de preuve de travail contre les scrapers, pour des sites entiers plutôt que pour des formulaires).

## Qu'est-ce qui rend un CAPTCHA open source ?

Un dépôt public pour le seul widget ne suffit pas. Pour de la protection anti-bot, « open source » n'a de sens que si vous pouvez auditer et exécuter les composants qui prennent les décisions :

- **Code client et serveur publiés** sous une licence OSI, pour que la logique des défis ne soit pas une boîte noire.
- **Vérification auto-hébergeable**, pour que le fait de laisser passer ou de refuser un utilisateur ne dépende jamais de la disponibilité, de l'honnêteté ou du prix de l'API d'un éditeur.
- **Aucun envoi caché vers l'extérieur**, ce que vous pouvez vérifier puisque vous pouvez lire le code.

Plusieurs CAPTCHA commerciaux ouvrent le code de leurs intégrations client tout en gardant le serveur propriétaire (FriendlyCaptcha, par exemple). C'est du confort en source ouverte, pas un CAPTCHA open source : le moteur de décision reste une boîte noire que vous louez.

## Pourquoi auto-héberger son CAPTCHA ?

- **Une confidentialité démontrable.** Les données des visiteurs n'atteignent jamais un éditeur, ce qui simplifie les réponses au RGPD et au CCPA. Voir [Conformité](./compliance.md).
- **Ni quotas ni frais par requête.** Les pics de trafic et les vagues de bots ne se transforment pas en factures.
- **Aucun risque éditeur.** Pas de changement de tarif surprise, pas d'abandon de produit, pas de rachat qui tire le tapis.
- **Le contrôle.** Vous fixez la difficulté des défis par clé de site, au lieu de vous en remettre au verdict d'un modèle distant sur vos utilisateurs.
- **La disponibilité.** Vos formulaires ne cassent pas quand un point d'accès tiers tombe en panne.

## Les options

### Cap

Cap est une pile CAPTCHA open source complète sous Apache 2.0 : un widget en composant web d'environ 20 Ko, plus [Cap Standalone](./standalone/index.md), un petit déploiement Docker (un conteneur plus Valkey) exposant une API REST, un tableau de bord avec gestion multi-clés, et un point d'accès `/siteverify` compatible avec la forme de l'API reCAPTCHA.

La protection repose sur deux couches indépendantes : la preuve de travail SHA-256 (avec les [verrous temporels RSW](./rsw.md) expérimentaux, résistants aux GPU) et des [défis d'instrumentation](./instrumentation.md) dynamiques qui vérifient que l'environnement est un véritable navigateur. Vaincre une couche ne vainc pas l'autre.

Si vous préférez intégrer plutôt que déployer, [capjs-core](./capjs-core.md) est la bibliothèque serveur sans état de Cap : elle génère et vérifie les défis dans votre propre service et fonctionne sur Cloudflare Workers, Lambda et d'autres environnements edge sans stockage persistant.

- **Licence :** Apache 2.0, client et serveur
- **Mécanisme :** preuve de travail et instrumentation
- **Déploiement :** conteneur Docker plus CDN ou widget auto-hébergé
- **Idéal pour :** les équipes qui veulent un service CAPTCHA auto-hébergé clé en main, avec une vraie expérience utilisateur

### ALTCHA

ALTCHA est un widget de preuve de travail minimal et bien entretenu (MIT), que vous branchez sur votre propre backend. Pas de tableau de bord, pas de serveur standalone dans la version open source ; la seconde couche par machine learning fait partie du produit payant Sentinel.

- **Licence :** MIT (widget)
- **Mécanisme :** preuve de travail
- **Idéal pour :** les développeurs qui veulent une petite bibliothèque et acceptent de construire eux-mêmes la partie serveur

[Comparatif complet : Cap vs ALTCHA →](./alternatives/altcha.md)

### mCAPTCHA

mCAPTCHA a été pionnier de la même idée de preuve de travail à difficulté variable. Il est entièrement open source (le cœur en AGPL-3.0 ; les bibliothèques client sous licences permissives), mais reste en pré-1.0 avec un rythme de publication lent, et son widget est plus lourd que ceux de Cap ou d'ALTCHA. Intéressant à étudier, mais pesez sa maturité avant de bâtir dessus.

### Anubis

Anubis est un *mur anti-scrapers* open source fondé sur la preuve de travail : il protège un site entier ou un chemin au niveau du reverse proxy, principalement contre les robots d'IA. Ce n'est pas un CAPTCHA de formulaire et il ne fournit pas de serveur de vérification autonome, mais il s'associe bien avec un tel serveur. Vous pouvez faire tourner Anubis devant un site et Cap sur les formulaires à forte valeur à l'intérieur.

[Comparatif complet : Cap vs Anubis →](./alternatives/anubis.md)

## Côte à côte

| | Cap | ALTCHA | mCAPTCHA | Anubis |
| :-- | :-- | :-- | :-- | :-- |
| Licence | Apache 2.0 | MIT (widget) | AGPL | MIT |
| Activement maintenu | ✅ | ✅ | 🟨 pré-1.0, publications lentes | ✅ |
| Mécanisme | PoW et instrumentation | PoW | PoW | PoW |
| Portée | Par action (formulaires, API) | Par action | Par action | Site entier |
| Serveur standalone et tableau de bord | ✅ | ❌ | ✅ | ❌ |
| siteverify compatible reCAPTCHA | ✅ | ❌ | ❌ | ❌ |
| Taille du widget | ~20 Ko | ~34 Ko | plus lourd | sans objet (transparent) |
| Option de PoW résistante aux GPU | ✅ [RSW](./rsw.md) | ❌ | ❌ | ❌ |

## Comment choisir

- **Vous voulez un service à déployer une fois et à gérer depuis un tableau de bord ?** Cap. [Démarrage rapide →](./index.md)
- **Vous voulez la dépendance la plus légère possible et vous assumez la plomberie backend ?** La bibliothèque [capjs-core](./capjs-core.md) de Cap, ou ALTCHA.
- **Vous luttez contre des scrapers sur tout un site, pas contre le spam de formulaires ?** Anubis, éventuellement avec Cap sur les formulaires.
- **Vous quittez reCAPTCHA ou hCaptcha ?** Le siteverify compatible de Cap réduit l'opération à un changement d'URL. [Guide de migration →](./alternatives/migrate-from-recaptcha.md)

## FAQ

### Quel est le meilleur CAPTCHA open source ?

Cap, si vous voulez une pile complète : deux couches de vérification, un tableau de bord, une API siteverify compatible. ALTCHA, si vous voulez une bibliothèque minimale.

### Puis-je auto-héberger un CAPTCHA ?

Oui, et c'est plus simple qu'il n'y paraît. Cap tourne avec un conteneur Docker plus Valkey, tient sur un VPS à 5 $, et se met en place en cinq minutes environ.

### Cap est-il gratuit ?

Entièrement. Apache 2.0, sans quotas, sans offre payante, quel que soit le volume.

### Cap est-il meilleur qu'ALTCHA ?

Cap fournit davantage (couche d'instrumentation, serveur standalone, tableau de bord, retour de progression, widget plus léger) ; ALTCHA en fournit moins, volontairement. Choisissez selon ce que vous voulez construire vous-même.

### Un CAPTCHA open source protège-t-il la vie privée ?

Il rend la confidentialité vérifiable au lieu d'être promise. La preuve de travail auto-hébergée n'a besoin ni de fingerprinting, ni de profilage comportemental, ni d'appels tiers, et vous pouvez lire le code pour le confirmer.

## Voir aussi

- [Meilleures alternatives aux CAPTCHA en 2026](./best-captcha-alternatives.md) : y compris le champ propriétaire
- [Comparatif des fonctionnalités](./alternatives.md) : la matrice complète
- [Comment fonctionne Cap ?](./workings.md) : l'architecture en détail
- [Démo en direct](./demo.md) : essayez le widget
