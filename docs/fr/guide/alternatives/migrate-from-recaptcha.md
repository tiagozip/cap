---
title: Migrer de reCAPTCHA vers Cap
description: "Google déplace reCAPTCHA dans Google Cloud et migre automatiquement les clés Classic. Migrez plutôt vers Cap : un CAPTCHA open source, auto-hébergé, plus rapide et respectueux de la vie privée, avec une API siteverify compatible reCAPTCHA et une détection de bots au niveau de Turnstile."
---

# Migrer de reCAPTCHA vers Cap

Google déplace reCAPTCHA dans Google Cloud et migre automatiquement les clés Classic vers des projets facturés. Vous devrez donc toucher à votre intégration de toute façon. La bonne nouvelle : c'est le prétexte parfait pour laisser derrière vous le CAPTCHA de Google fondé sur le pistage, au profit de quelque chose de plus rapide, privé et gratuit.

Cap est un remplacement direct pour la partie qui compte, et une amélioration pour presque tout le reste.

## Pourquoi les équipes passent à Cap

- **Une détection au niveau de Turnstile, sans le tiers.** Cap associe la preuve de travail à des défis d'instrumentation, la même technique de vérification du navigateur que YouTube et Twitter/X exploitent à très grande échelle. Il se situe dans la même catégorie de détection que Cloudflare Turnstile tout en restant entièrement auto-hébergé.
- **Éprouvé à grande échelle.** Environ **1 milliard de défis résolus sur le seul premier trimestre 2026** (selon JSDelivr), et utilisé en production par des équipes comme **AdGuard** et **Bunny.net**. Ce n'est pas une expérimentation.
- **Une fraction du poids, et invisible.** Le widget de Cap pèse environ 21 Ko compressé en gzip, contre 200 à 600 Ko pour le client de reCAPTCHA, souvent une réduction d'un facteur 10 ou plus. Les défis par défaut se résolvent en 2 à 3 secondes en arrière-plan, sans puzzles de feux tricolores et sans rien à cliquer pour l'utilisateur.
- **Réellement gratuit, sans compteur.** Pas de projet Google Cloud, pas de compte de facturation, pas de frais par évaluation. Un conteneur Docker et une instance Valkey suffisent pour la plupart des charges, sur un VPS à 5 $.
- **Privé par défaut.** reCAPTCHA charge des scripts depuis `google.com` et transmet des signaux utilisateur à Google. Cap n'envoie de données nulle part. Aucun élément tiers ne touche votre page.
- **Vous gardez les commandes.** reCAPTCHA v3 pénalise silencieusement les utilisateurs de VPN, de Tor et de navigateurs axés sur la vie privée, sans recours possible. Avec Cap, vous fixez la difficulté, et chaque utilisateur réel dispose toujours d'un chemin possible.
- **Open source, pour toujours.** Apache 2.0. Auditez, forkez, déployez. Aucun éditeur ne peut changer les règles à votre place.

Pour le détail complet, voir [Cap vs reCAPTCHA](./recaptcha.md).

## Ce qui change du côté de reCAPTCHA

Si vous avez besoin du contexte expliquant pourquoi les e-mails de migration arrivent maintenant :

- Il n'est plus possible de créer de nouvelles clés dans l'ancienne console d'administration reCAPTCHA.
- Les clés reCAPTCHA Classic existantes sont migrées automatiquement vers des projets Google Cloud, un processus mené par Google de fin 2025 jusqu'en 2026.
- Une fois migrée, l'accès API d'une clé est lié à un projet Google Cloud. Au-delà de l'offre gratuite de 10 000 évaluations par mois, vous devez activer la facturation sur ce projet.

Garder reCAPTCHA aujourd'hui, c'est accepter un projet Google Cloud, un compte de facturation enregistré et des évaluations comptabilisées. Passer à Cap, c'est se passer de tout cela, selon un calendrier que vous maîtrisez.

## Comment se déroule la migration

Le point d'accès `/siteverify` de Cap reproduit volontairement la forme de requête de reCAPTCHA : côté serveur, on est donc proche du remplacement direct. Le remplacement du widget se fait balise pour balise. Trois étapes, et vous pouvez faire tourner les deux en parallèle pendant la bascule.

### 1. Mettre en place une instance Cap

Suivez le [démarrage rapide](../index.md) pour faire tourner Cap Standalone avec Docker. Créez une clé de site dans le tableau de bord et notez la **clé de site** et sa **clé secrète**. Laissez les [défis d'instrumentation](../instrumentation.md) activés (c'est le défaut) pour la protection anti-bot la plus solide.

### 2. Remplacer le widget côté client

Remplacez le script et l'élément reCAPTCHA par le widget de Cap.

Avant :

```html
<script src="https://www.google.com/recaptcha/api.js" async defer></script>
<div class="g-recaptcha" data-sitekey="<your-recaptcha-site-key>"></div>
```

Après :

```html
<script src="https://cdn.jsdelivr.net/npm/cap-widget"></script>
<cap-widget data-cap-api-endpoint="https://<your-instance>/<site-key>/"></cap-widget>
```

Si votre widget reCAPTCHA se trouvait dans un `<form>`, la gestion du jeton se transpose : reCAPTCHA injectait automatiquement un champ `g-recaptcha-response`, et Cap injecte automatiquement un champ `cap-token` à l'envoi. En dehors d'un formulaire, écoutez l'événement `solve` :

```js
document.querySelector("cap-widget").addEventListener("solve", (e) => {
  const token = e.detail.token;
});
```

### 3. Remplacer la vérification côté serveur

La vérification reCAPTCHA envoie `secret` et `response` à une URL Google fixe. Cap prend les deux mêmes paramètres, envoyés à votre propre instance :

Avant :

```js
const { success } = await (
  await fetch("https://www.google.com/recaptcha/api/siteverify", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ secret: RECAPTCHA_SECRET, response: token }),
  })
).json();
```

Après :

```js
const { success } = await (
  await fetch("https://<your-instance>/<site-key>/siteverify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ secret: CAP_SECRET, response: token }),
  })
).json();
```

Le jeton que lit votre serveur change aussi de nom : récupérez `cap-token` dans le formulaire envoyé (ou la valeur captée depuis l'événement `solve`) au lieu de `g-recaptcha-response`.

## Ce qui est compatible, et ce qui ne l'est pas

Nous préférons que vous migriez en connaissance de cause plutôt que de découvrir une surprise en production. La compatibilité est réelle, mais pas à l'octet près :

| | reCAPTCHA | Cap |
| --- | --- | --- |
| Paramètres de requête | `secret`, `response`, `remoteip` en option | `secret`, `response` (`remoteip` est ignoré) |
| Point d'accès | URL `google.com` fixe | votre propre `/<site-key>/siteverify` |
| Champ de succès | `success` (booléen) | `success` (booléen) |
| Signalement d'erreur | `error-codes` (tableau) | `error` (chaîne) |
| Champs supplémentaires | `challenge_ts`, `hostname`, `score` (v3) | aucun |

En pratique :

- Le code qui vérifie seulement `response.success` fonctionne après un changement d'URL et de secret. C'est le cas courant, et c'est une modification d'une ligne.
- Le code qui inspecte `error-codes`, `challenge_ts`, `hostname` ou le `score` de la v3 doit être adapté. Cap est un système de vérification, pas un score de risque comportemental : ces champs n'existent pas.
- Si vous utilisez un SDK backend qui code en dur l'URL de vérification de Google, remplacez-le par un SDK qui permet de définir le point d'accès, ou appelez `/siteverify` directement. Ce sont deux paramètres.

## Migrer sans interruption de service

Vous n'avez jamais à basculer d'un coup en croisant les doigts. Montez Cap sur un élément distinct et faites en sorte que votre backend accepte, pendant la transition, soit un `cap-token` valide, soit un `g-recaptcha-response` valide. Surveillez le taux de vérification de Cap dans vos journaux, et une fois qu'il vous paraît sain, supprimez le script reCAPTCHA, l'élément et l'appel serveur. La plupart des équipes bouclent la bascule en un après-midi.

## Voir aussi

- [Démo en direct](../demo.md) — résolvez vous-même un défi Cap, puis chronométrez-le face à reCAPTCHA
- [Cap vs reCAPTCHA](./recaptcha.md) — le comparatif complet
- [Comment Cap détecte les bots](../effectiveness.md) — le modèle preuve de travail et instrumentation
- [Démarrage rapide](../index.md) — mettre Cap en place de zéro en cinq minutes
