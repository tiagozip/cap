---
title: Cap vs FriendlyCaptcha
description: "Cap vs Friendly Captcha : un CAPTCHA à preuve de travail gratuit, auto-hébergé et open source, face à un SaaS payant. Comparez vie privée, tarifs et lieu de stockage des données de vos visiteurs."
---

# Cap vs FriendlyCaptcha

FriendlyCaptcha a été l'un des premiers CAPTCHA à preuve de travail, axé sur la conformité européenne en matière de vie privée. C'est un service commercial hébergé, avec une offre gratuite pour un usage non commercial et des offres payantes pour tout le reste.

## Verdict rapide

Si vous avez précisément besoin d'un produit payant, hébergé en Europe, soutenu par un éditeur avec SLA et contact commercial, FriendlyCaptcha est un choix raisonnable. Si vous voulez le même modèle de preuve de travail sans la facture ni le quota de requêtes, Cap est une alternative gratuite, auto-hébergée et open source que vous contrôlez de bout en bout.

## Quand FriendlyCaptcha a du sens

- Vous avez besoin d'un fournisseur avec un contrat, un SLA et un hébergement européen géré par quelqu'un d'autre.
- Votre trafic est prévisible et assez faible pour tenir confortablement dans une offre payante.
- Vous ne voulez exploiter aucune infrastructure.

## Quand Cap est le meilleur choix

- **Aucun quota, quel que soit le volume.** L'offre Starter de FriendlyCaptcha coûte 9 €/mois pour 1 000 requêtes par mois, avec des paliers supérieurs à mesure que vous grandissez. Cap est gratuit à tout volume : ni frais par requête, ni limite de domaine.
- **Le serveur est open source.** Les intégrations de FriendlyCaptcha pour les frameworks sont open source, mais le serveur est propriétaire. Cap est entièrement sous Apache 2.0, de bout en bout.
- **Auto-hébergé.** Cap tourne sur votre propre infrastructure, sur un VPS à 5 $, sans aucun aller-retour vers un tiers.
- **Deux couches de vérification.** Cap ajoute des [défis d'instrumentation](../instrumentation.md) par-dessus la preuve de travail. FriendlyCaptcha se limite à la preuve de travail.
- **Aucun « risque éditeur ».** Open source, auto-hébergé, Apache 2.0. Pas de changement de tarif surprise, pas d'arrêt surprise.

## Ce qu'ils ont en commun

- Les deux utilisent la preuve de travail comme mécanisme principal.
- Les deux sont pensés dès le départ pour le RGPD et le CCPA.
- Les deux offrent une interface de widget claire et accessible, sans puzzles d'images.

## Voir aussi

- [Démo en direct](../demo.md) : essayez Cap dans votre navigateur
- [Comment Cap détecte les bots](../effectiveness.md) : preuve de travail et instrumentation
- [Toutes les alternatives](../alternatives.md) : la matrice complète des fonctionnalités
- [Meilleures alternatives aux CAPTCHA en 2026](../best-captcha-alternatives.md) : options gérées et auto-hébergées, classées
