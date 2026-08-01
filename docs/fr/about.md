---
title: À propos de Cap
description: "Qui développe Cap, l'alternative aux CAPTCHA open source et auto-hébergée : mainteneur, histoire, licence, financement et contact."
sidebar: false
---

# À propos de Cap

**En bref :** Cap est une alternative aux CAPTCHA, gratuite et open source, qui remplace les puzzles visuels par des défis de preuve de travail et d'instrumentation. Sous licence Apache 2.0, elle tourne entièrement sur votre propre infrastructure : les données des visiteurs n'atteignent jamais un tiers.

## Qu'est-ce que Cap ?

Cap est une protection anti-bot que vous pouvez lire, auditer et auto-héberger :

- Un **widget d'environ 20 Ko** qui affiche une simple case à cocher au lieu de puzzles d'images.
- Un **serveur standalone** livré sous forme d'un seul conteneur Docker, avec tableau de bord et prise en charge de plusieurs clés de site.
- Des **bibliothèques serveur** (`@cap.js/server` et portages communautaires) pour vérifier les défis dans votre propre backend.
- Une **API siteverify compatible avec reCAPTCHA et hCaptcha**, si bien que migrer revient surtout à changer une URL.

Le code source complet est disponible sur [github.com/tiagozip/cap](https://github.com/tiagozip/cap) sous [licence Apache 2.0](https://www.apache.org/licenses/LICENSE-2.0).

## Pourquoi Cap existe-t-il ?

Les CAPTCHA courants interrogent les utilisateurs avec des puzzles ou les profilent avec du fingerprinting et des scores de risque, et ces deux approches font transiter les données de vos visiteurs par un éditeur. Cap adopte une position différente :

- **Déterministe, pas arbitraire.** Chaque utilisateur réel dispose d'un chemin garanti ; aucun classifieur ne peut rejeter silencieusement quelqu'un parce qu'il utilise un VPN ou un navigateur axé sur la vie privée.
- **Auto-hébergé, pas loué.** La vérification a lieu sur vos serveurs, ce qui simplifie les réponses au RGPD et au CCPA. Voir [Conformité](./guide/compliance.md).
- **Ouvert, pas promis.** Les engagements de confidentialité sont auditables, parce que le code qui prend les décisions est public.

## Nous contacter

- Bugs et demandes de fonctionnalités : [issues GitHub](https://github.com/tiagozip/cap/issues)
- Signalements de sécurité et tout le reste : [hi@tiago.zip](mailto:hi@tiago.zip)
