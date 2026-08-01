---
title: Cap vs Altcha
description: "Cap vs Altcha : deux CAPTCHA open source, auto-hébergés et fondés sur la preuve de travail, comparés. Voyez ce que Cap ajoute : défis d'instrumentation, widget et tableau de bord."
---

# Cap vs Altcha

Altcha est le projet le plus proche de Cap par l'esprit : open source, preuve de travail, sans fingerprinting, sans dépendance à un tiers. Les deux sont de bons choix. Les différences tiennent aux fonctionnalités et au mode d'exploitation.

Altcha propose aussi un produit commercial, **Altcha Sentinel**, qui ajoute une détection de menaces fondée sur le machine learning par-dessus le widget open source. La comparaison ci-dessous porte principalement sur Cap et le widget Altcha open source ; si vous envisagez Sentinel, vous comparez un SaaS payant à un projet open source auto-hébergé, ce qui est une autre décision.

## Verdict rapide

Si vous voulez un CAPTCHA à preuve de travail minimal, façon bibliothèque, à intégrer dans un projet Node et à oublier, l'Altcha open source est excellent. Si vous voulez un service auto-hébergé clé en main, avec tableau de bord, gestion de plusieurs clés de site, défis d'instrumentation en plus de la preuve de travail et une interface qui affiche la progression de la résolution (sans payer Sentinel), Cap convient mieux.

## Quand Altcha a du sens

- Vous voulez une intégration minuscule, uniquement sous forme de bibliothèque, sans service séparé à faire tourner.
- Vous n'avez pas besoin d'une deuxième couche de vérification au-delà de la preuve de travail, ou vous êtes prêt à payer Sentinel pour obtenir la détection par machine learning.
- Vous êtes déjà intégré à Altcha et le coût de migration dépasse les différences listées ci-dessous.

## Quand Cap est le meilleur choix

- **Deux couches de vérification indépendantes, gratuitement.** Cap exécute en parallèle la preuve de travail *et* des [défis d'instrumentation](../instrumentation.md) JavaScript dynamiques, les deux inclus. Vaincre l'une ne vainc pas l'autre. L'Altcha open source se limite à la preuve de travail ; la seconde couche (par machine learning) exige de payer Sentinel.
- **Serveur standalone avec tableau de bord, gratuitement.** Cap livre un déploiement en un seul conteneur Docker, avec tableau de bord web, gestion multi-clés, statistiques et un point d'accès siteverify compatible reCAPTCHA. Côté open source, Altcha vous laisse tout câbler vous-même ; l'expérience tout-en-un est réservée à Sentinel.
- **Widget plus léger.** Cap fait environ 20 Ko. Altcha environ 34 Ko compressé en gzip.
- **Suivi de progression.** Le widget de Cap indique à l'utilisateur la progression de la résolution en pourcentage : un retour d'interface utile pendant la courte attente.
- **Modes flottant et programmatique.** Cap peut se masquer entièrement ou flotter au-dessus d'un bouton jusqu'à l'envoi du formulaire. Les modes d'affichage d'Altcha sont plus simples.
- **Apparence personnalisable.** Cap expose des variables CSS pour les couleurs, la taille, la position et les icônes. La personnalisation d'Altcha est plus limitée.

## Ce qu'ils ont en commun

- Les deux sont open source (Cap en Apache 2.0, le widget Altcha en MIT) et sans télémétrie.
- Les deux exécutent une preuve de travail côté client pour rendre l'abus coûteux.
- Les deux fonctionnent sans aucun aller-retour réseau vers un tiers en auto-hébergement.
- Les deux sont pensés dès le départ pour le RGPD et le CCPA.

## Voir aussi

- [Démo en direct](../demo.md) : essayez Cap dans votre navigateur
- [Comment Cap détecte les bots](../effectiveness.md) : preuve de travail et instrumentation
- [Toutes les alternatives](../alternatives.md) : la matrice complète des fonctionnalités
- [Les options de CAPTCHA open source](../open-source-captcha.md) : Cap, ALTCHA, mCAPTCHA et Anubis comparés
