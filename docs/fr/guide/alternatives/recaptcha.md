---
title: Cap vs reCAPTCHA
description: "Cap vs Google reCAPTCHA v2 et v3 : une alternative open source, auto-hébergée et respectueuse de la vie privée. Sans pistage Google ni puzzles visuels, juste des défis de preuve de travail."
---

# Cap vs reCAPTCHA

reCAPTCHA est le service de CAPTCHA de Google, disponible en deux versions principales : la v2 (« Je ne suis pas un robot ») et la v3 (invisible, fondée sur un score). Les deux impliquent d'envoyer des données de trafic à Google.

## Verdict rapide

Si votre site ne dépend pas déjà de Google pour l'analytique ou la connexion, il y a peu de raisons de conserver reCAPTCHA. Cap offre un niveau de protection équivalent dans la grande majorité des cas, sans envoyer vos utilisateurs chez Google, sans quotas par requête, et sans imposer aux visiteurs des puzzles de feux tricolores dès que le score de risque de Google ne les aime pas.

## Quand reCAPTCHA garde du sens

- Vous êtes déjà profondément intégré à la pile d'identité de Google et voulez une décision d'éditeur en moins.
- Vous avez spécifiquement besoin du score de risque comportemental de Google (v3) et de l'infrastructure pour l'exploiter.
- Votre équipe refuse de faire tourner le moindre service backend, même un unique conteneur Docker.

## Quand Cap est le meilleur choix

- **Vie privée.** reCAPTCHA charge des scripts depuis `google.com` et transmet des signaux utilisateur à Google. Cap tourne entièrement sur votre infrastructure et n'ajoute aucun élément tiers à votre page.
- **Aucun puzzle visuel.** reCAPTCHA v2 plonge régulièrement les utilisateurs dans des puzzles de feux, de bornes à incendie et de passages piétons. Ils deviennent de plus en plus faciles pour les solveurs IA et de plus en plus difficiles pour les humains, surtout sur mobile ou pour les utilisateurs de VPN et de navigateurs axés sur la vie privée.
- **Poids du bundle.** Le client de reCAPTCHA pèse plus de 500 Ko. Le widget de Cap fait environ 20 Ko.
- **Aucun quota.** reCAPTCHA Enterprise est facturé à l'évaluation. Cap n'a pas de frais par requête : il tourne sur un VPS à 5 $ pour la plupart des charges.
- **Aucun blocage des utilisateurs « suspects ».** La v3 pénalise silencieusement les utilisateurs de Tor, de VPN ou de navigateurs respectueux de la vie privée. Avec Cap, c'est vous qui fixez la difficulté ; l'utilisateur a toujours un chemin possible.
- **Open source.** Apache 2.0. Auditez, forkez, déployez.

## Migration

Le point d'accès `/siteverify` de Cap est volontairement compatible avec la forme de l'API reCAPTCHA : la plupart des migrations côté serveur se résument à changer une URL et un secret. Côté client, remplacez `<script src="https://www.google.com/recaptcha/api.js">` et `<div class="g-recaptcha">` par le widget de Cap ; voir le [démarrage rapide](../index.md) pour la marche à suivre complète.

Vous pouvez aussi faire tourner les deux en parallèle pendant la bascule, en montant Cap sur un autre élément et en vérifiant les deux jetons côté serveur jusqu'à ce que vous soyez confiant.

## Voir aussi

- [Démo en direct](../demo.md) : essayez Cap dans votre navigateur
- [Comment Cap détecte les bots](../effectiveness.md) : le modèle preuve de travail et instrumentation
- [Toutes les alternatives](../alternatives.md) : la matrice complète des fonctionnalités
- [Meilleures alternatives aux CAPTCHA en 2026](../best-captcha-alternatives.md) : toutes les alternatives à reCAPTCHA, classées
- [CAPTCHA et taux de conversion](../captcha-conversion-rate.md) : ce que les boucles de puzzles coûtent à vos inscriptions
