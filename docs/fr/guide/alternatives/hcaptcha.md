---
title: Cap vs hCaptcha
description: "Cap vs hCaptcha : une alternative aux CAPTCHA open source, auto-hébergée et sans puzzles. Pas de grilles d'images, pas de données vendues aux annonceurs, gratuit à toute échelle grâce à la preuve de travail."
---

# Cap vs hCaptcha

hCaptcha est le concurrent de reCAPTCHA positionné sur la vie privée, mais fondé sur des puzzles. L'offre gratuite affiche des puzzles d'images de façon agressive ; l'offre payante Pro (99 $/mois en annuel, 139 $/mois en mensuel, 100 000 évaluations) débloque un mode majoritairement passif et des statistiques. C'est, parmi les grands CAPTCHA, le plus agressif en matière de puzzles visibles sur son offre gratuite.

## Verdict rapide

Si vous utilisez hCaptcha surtout parce que vous vouliez quitter Google, Cap est l'étape la plus simple. Vous ne troquez pas Google contre un autre tiers : vous n'avez plus de tiers du tout. Et vous cessez de faire payer à vos utilisateurs une « taxe puzzle » à chaque envoi de formulaire.

## Quand hCaptcha a du sens

- Vous avez spécifiquement besoin du flux de renseignement sur les menaces et du scoring de risque d'hCaptcha Enterprise à grande échelle, et vous en avez le budget.
- Vous êtes déjà profondément intégré et le coût de migration dépasse les bénéfices.
- Votre programme de conformité exige explicitement une étape de vérification humaine avec puzzle visible pour certaines actions réglementées.

## Quand Cap est le meilleur choix

- **Aucun puzzle d'images.** Le taux d'abandon sur les puzzles hCaptcha va de **5 % à 15 %** selon la difficulté. C'est de la conversion bien réelle perdue sur les inscriptions, les paiements et les formulaires de contact. Cap n'affiche jamais de puzzle. (Le mode passif d'hCaptcha Pro réduit ce phénomène, mais c'est une offre payante.)
- **Poids du bundle.** Le client d'hCaptcha dépasse 600 Ko. Cap fait environ 20 Ko, soit près de 30 fois moins.
- **Aucun quota ni dépassement.** hCaptcha Pro démarre à 99 $/mois pour 100 000 évaluations, puis facture 0,99 $ par tranche de 1 000. Cap est gratuit à toute échelle, tourne sur un VPS à 5 $, sans frais par requête.
- **Auto-hébergé.** Aucune dépendance à un tiers. Cap ne charge rien depuis `hcaptcha.com`.
- **Aucun fingerprinting.** hCaptcha s'appuie sur les empreintes de navigateur et les signaux comportementaux, ce qui pénalise les utilisateurs de navigateurs axés sur la vie privée. La preuve de travail de Cap fonctionne de la même façon quel que soit le navigateur.
- **Open source.** Apache 2.0. Auditez-le, faites-le tourner sur une infrastructure isolée, forkez-le.

## Ce qu'ils ont en commun

Les deux exécutent une couche d'instrumentation ou comportementale en plus du défi visible. Les deux proposent des modes invisibles. Les deux s'intègrent au schéma classique d'envoi de formulaire.

## Migration

Le `/siteverify` de Cap est compatible avec la forme d'API d'hCaptcha. La plupart des changements côté backend se limitent à un changement d'URL. Côté client, remplacez `<div class="h-captcha">` et `https://js.hcaptcha.com/1/api.js` par le `<cap-widget>` de Cap ; voir le [démarrage rapide](../index.md).

Pour migrer progressivement, déployez Cap d'abord sur les nouveaux formulaires, gardez hCaptcha sur les anciens, et observez l'écart de conversion.

## Voir aussi

- [Démo en direct](../demo.md) : essayez Cap dans votre navigateur
- [Comment Cap détecte les bots](../effectiveness.md) : preuve de travail et instrumentation
- [Toutes les alternatives](../alternatives.md) : la matrice complète des fonctionnalités
- [CAPTCHA et taux de conversion](../captcha-conversion-rate.md) : tout le calcul derrière la taxe puzzle
- [Meilleures alternatives aux CAPTCHA en 2026](../best-captcha-alternatives.md) : les options sans puzzle, classées
