---
title: Cap vs Cloudflare Turnstile
description: "Cap vs Cloudflare Turnstile : un CAPTCHA open source, auto-hébergé et personnalisable que vous contrôlez entièrement. Sans dépendance à un éditeur, avec preuve de travail et instrumentation."
---

# Cap vs Cloudflare Turnstile

Turnstile est le remplaçant gratuit des CAPTCHA proposé par Cloudflare. Il repose sur des défis invisibles qui s'appuient largement sur les signaux réseau de Cloudflare et sur le fingerprinting du navigateur.

## Verdict rapide

Turnstile est réellement bon si vous êtes déjà chez Cloudflare et acceptez que le verdict leur appartienne. Cap convient mieux quand vous voulez l'auto-hébergement, une difficulté déterministe, aucune dépendance à un tiers, et la possibilité de passer outre les décisions pour vos propres utilisateurs.

## Quand Turnstile a du sens

- Votre trafic passe déjà par Cloudflare et vous voulez rester dans un seul écosystème.
- Vous ne voulez rien héberger ; Turnstile est entièrement géré.
- Vous acceptez les décisions algorithmiques de Cloudflare sur les visiteurs « suspects », sans possibilité de les contredire.

## Quand Cap est le meilleur choix

- **Auto-hébergé.** Cap tourne sur vos serveurs. Turnstile exige que chaque défi fasse un aller-retour par Cloudflare.
- **La politique vous appartient.** Avec Turnstile, si l'algorithme de Cloudflare juge un utilisateur suspect (fréquent pour les utilisateurs de Brave, Librewolf, Tor ou VPN), il n'y a aucun recours. Cap vous confie le bouton de difficulté.
- **Moins d'erreurs pour les utilisateurs soucieux de leur vie privée.** De nombreux retours indiquent que Turnstile classe mal les navigateurs durcis. La preuve de travail de Cap se moque des empreintes.
- **Open source.** Apache 2.0, face au client et au serveur propriétaires de Turnstile.
- **Aucune télémétrie.** Cap ne renvoie rien vers l'extérieur et ne pose pas de cookies. Le client de Turnstile communique avec `challenges.cloudflare.com` à chaque chargement de page.
- **Personnalisable.** Cap expose des variables CSS pour les couleurs, la taille et la forme. L'iframe de Turnstile est pour l'essentiel figée.

## Ce qu'ils ont en commun

Les deux livrent un client léger (environ 20 à 110 Ko). Les deux proposent un mode « invisible » (Cap l'appelle [mode flottant](../floating.md) ou [mode programmatique](../programmatic.md)). Les deux ajoutent des contrôles comportementaux par-dessus un défi principal : Cap les nomme [défis d'instrumentation](../instrumentation.md), Turnstile les appelle « managed challenges ».

## Migration

La forme de l'API `/siteverify` de Cap est compatible avec le `siteverify` de Cloudflare : la vérification côté serveur se résume donc pour l'essentiel à changer une URL et un secret. Côté client, il s'agit de remplacer `<div class="cf-turnstile">` par `<cap-widget>` et de le pointer vers votre instance Cap ; voir le [démarrage rapide](../index.md) pour le code complet.

## Voir aussi

- [Démo en direct](../demo.md) : essayez Cap dans votre navigateur
- [Comment Cap détecte les bots](../effectiveness.md) : preuve de travail et instrumentation
- [Toutes les alternatives](../alternatives.md) : la matrice complète des fonctionnalités
- [Meilleures alternatives aux CAPTCHA en 2026](../best-captcha-alternatives.md) : Turnstile, Cap et le reste du paysage, classés
- [Protection anti-bot des formulaires mobiles](../mobile-form-bot-protection.md) : là où les signaux d'empreinte échouent le plus
