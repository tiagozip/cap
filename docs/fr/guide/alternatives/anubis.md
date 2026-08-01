---
title: Cap vs Anubis
description: "Cap vs Anubis : Anubis dissuade les scrapers à l'échelle du site, Cap est un CAPTCHA open source auto-hébergé pour les formulaires et les connexions, fondé sur la preuve de travail. Quand choisir l'un ou l'autre."
---

# Cap vs Anubis

Anubis est un dispositif de dissuasion contre les scrapers fondé sur la preuve de travail, populaire dans les communautés d'auto-hébergement pour bloquer en périphérie les robots d'entraînement d'IA et les scrapers agressifs. Anubis et Cap partagent le même cœur de preuve de travail, mais visent des problèmes différents.

## Verdict rapide

Utilisez **Anubis** quand vous voulez protéger un site entier ou un chemin contre les bots et les scrapers au niveau du reverse proxy, généralement parce que des robots dévorent votre bande passante. Utilisez **Cap** quand vous voulez protéger une *action* précise (l'envoi d'un formulaire, un appel d'API, la création d'un compte) tout en laissant la navigation normale se poursuivre librement.

## Quand Anubis a du sens

- Vous voulez dresser un mur de preuve de travail devant un site entier ou un sous-chemin.
- Le modèle de menace est le scraping massif ou les vagues de requêtes pilotées par des bots en périphérie.
- Cela ne vous dérange pas que chaque visiteur résolve un petit défi avant le chargement de la moindre page.

## Quand Cap est le meilleur choix

- **Protection par action, pas par page vue.** Cap protège les formulaires, les inscriptions, les pages de contact et les points d'API, exactement là où l'abus se transforme en coût. Les visiteurs naviguent normalement.
- **La difficulté se règle par action.** Le défi d'Anubis doit rester assez léger pour ne pas pénaliser chaque chargement de page, ce qui limite le niveau atteignable. Cap se configure par action : la difficulté peut être relevée sur les formulaires d'inscription ou de connexion sans gêner la navigation.
- **Deux couches de vérification.** Cap superpose des [défis d'instrumentation](../instrumentation.md) à la preuve de travail : même les bots qui accélèrent la preuve de travail avec un GPU doivent encore simuler un véritable environnement navigateur.
- **Serveur standalone avec tableau de bord.** Cap fournit d'emblée des statistiques, la gestion de plusieurs clés de site et un point d'accès siteverify compatible reCAPTCHA.
- **Interface du widget.** Cap est conçu pour être visible par les humains sur un formulaire : case à cocher, indicateur de progression et espace de marque. Anubis, lui, est un portail transparent.

## Ils peuvent coexister

Si vous faites déjà tourner Anubis devant un site pour vous protéger des robots d'indexation, vous pouvez toujours utiliser Cap sur certains formulaires et points d'API à forte valeur à l'intérieur de ce site. Les deux répondent à des problèmes différents et n'entrent pas en conflit.

## Voir aussi

- [Démo en direct](../demo.md) : essayez Cap dans votre navigateur
- [Comment Cap détecte les bots](../effectiveness.md) : preuve de travail et instrumentation
- [Toutes les alternatives](../alternatives.md) : la matrice complète des fonctionnalités
- [Les options de CAPTCHA open source](../open-source-captcha.md) : Cap, ALTCHA, mCAPTCHA et Anubis comparés
