---
outline: deep
description: "Mettez en place Cap, le CAPTCHA open source auto-hébergé, en cinq minutes environ. Lancez le serveur avec Docker, ajoutez le widget, vérifiez les jetons. Sans Google, sans télémétrie, sans puzzles visuels."
---

# Démarrage rapide

Cap est un CAPTCHA auto-hébergé qui remplace les puzzles d'images par une preuve de travail invisible. Vos utilisateurs cochent une case, le calcul s'exécute silencieusement dans leur navigateur, et aucune de leurs données ne quitte vos serveurs. Sans Google, sans télémétrie, sans frais par requête.

Cap comporte deux parties : un **widget** qui exécute le défi et affiche la case à cocher, et un **serveur** qui émet les défis et vérifie les solutions. Les deux seront opérationnels en cinq minutes environ.

**Voici le widget, en direct :**

<Demo />

::: tip Vous utilisez déjà reCAPTCHA ?
Le `/siteverify` de Cap est compatible avec l'API de reCAPTCHA. Vous pouvez faire pointer votre code de vérification existant vers Cap en changeant une seule URL, faire tourner les deux en parallèle, et basculer quand vous êtes prêt. Aucune réécriture, aucun changement risqué en une fois. Voir le [comparatif des fonctionnalités](./alternatives.md).
:::

## Ce dont vous aurez besoin

- [Docker](https://docs.docker.com/get-docker/) (le moyen le plus rapide de faire tourner le serveur)
- Un hébergement accessible depuis les navigateurs de vos utilisateurs
- Quelques minutes

## 1. Lancer le serveur

Nous recommandons [Cap Standalone](./standalone/index.md), un conteneur unique qui expose une petite API REST et un tableau de bord pour gérer les clés. Il prend en charge plusieurs clés de site et est compatible avec l'API siteverify de reCAPTCHA.

[![Deploy on Railway](https://railway.com/button.svg)](https://railway.com/deploy/cap-1?referralCode=93HYBZ&utm_medium=integration&utm_source=template&utm_campaign=generic)

Créez un `docker-compose.yml` :

```yaml
services:
  cap:
    image: tiago2/cap:latest
    container_name: cap
    ports:
      - "3000:3000"
    environment:
      ADMIN_KEY: your_secret_password
      REDIS_URL: redis://valkey:6379
    depends_on:
      valkey:
        condition: service_healthy
    restart: unless-stopped

  valkey:
    image: valkey/valkey:9-alpine
    container_name: cap-valkey
    volumes:
      - valkey-data:/data
    command: valkey-server --save 60 1 --loglevel warning --maxmemory-policy noeviction
    healthcheck:
      test: ["CMD", "valkey-cli", "ping"]
      interval: 5s
      timeout: 3s
      retries: 5
    restart: unless-stopped

volumes:
  valkey-data:
```

Démarrez-le :

```bash
docker compose up -d
```

Ouvrez `http://localhost:3000` (ou l'IP ou le domaine de votre serveur sur le port 3000), connectez-vous avec votre `ADMIN_KEY` et créez une clé de site. Vous obtiendrez une **clé de site** et une **clé secrète**. Conservez les deux, elles serviront aux étapes suivantes.

::: tip Conseils

- `ADMIN_KEY` est le mot de passe de votre tableau de bord. Faites-le d'au moins 32 caractères.
- Changez `3000:3000` si ce port est déjà utilisé.
- Si le tableau de bord est inaccessible, ajoutez `network_mode: "host"` sous le service `cap`.
  :::

## 2. Ajouter le widget

Le widget est un simple composant web. Si vous ne souhaitez pas épingler de version, remplacez `<version>` par `latest`.

```html
<script src="https://cdn.jsdelivr.net/npm/cap-widget@<version>"></script>
```

::: tip
Consultez la [dernière version publiée](https://github.com/tiagozip/cap/releases) pour savoir quelle version épingler. Dans les configurations à forte exigence de sécurité, vous pouvez héberger ce fichier vous-même plutôt que de le charger depuis le CDN.
:::

### La méthode simple : le placer dans un formulaire

Si votre widget se trouve dans un `<form>`, Cap y injecte automatiquement un champ caché `cap-token` et l'envoie avec le reste des données du formulaire. Aucun JavaScript requis.

```html
<form action="/submit" method="POST">
  <!-- vos champs -->
  <cap-widget data-cap-api-endpoint="https://<your-instance>/<site-key>/"></cap-widget>
  <button type="submit">Envoyer</button>
</form>
```

- `<your-instance>` est l'URL publique de votre serveur Cap, par exemple `cap.example.com`. Elle doit être joignable par vos visiteurs, donc pas `localhost`.
- `<site-key>` est la clé de site issue de votre tableau de bord.

À l'envoi, votre serveur reçoit `cap-token` à côté des autres champs. Passez à l'[étape 3](#_3-verify-the-token) pour le vérifier.

### Avec JavaScript : quand vous avez besoin de contrôle

Pour les SPA, les parcours personnalisés ou tout ce qui n'est pas un formulaire classique, écoutez l'événement `solve` :

```js
const widget = document.querySelector("cap-widget");
widget.addEventListener("solve", (e) => {
  const token = e.detail.token;
  // envoyer le jeton à votre serveur, activer le bouton d'envoi, etc.
});
```

Vous pouvez aussi afficher le widget de manière invisible et le résoudre [par programmation](./programmatic.md), ou utiliser le [mode flottant](./floating.md). Des extraits par framework (React, Vue, Svelte et d'autres) figurent sur la [page du widget](./widget.md#usage).

## 3. Vérifier le jeton {#_3-verify-the-token}

Avant de faire confiance à une soumission, votre serveur doit vérifier le jeton. Envoyez un `POST` au point d'accès `/siteverify` de votre instance :

::: code-group

```sh [curl]
curl "https://<your-instance>/<site-key>/siteverify" \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{ "secret": "<key_secret>", "response": "<captcha_token>" }'
```

```js [fetch]
const { success } = await (
  await fetch("https://<your-instance>/<site-key>/siteverify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ secret: "<key_secret>", response: "<captcha_token>" }),
  })
).json();

if (!success) throw new Error("invalid cap token");
```

```py [python]
import requests

success = requests.post(
    "https://<your-instance>/<site-key>/siteverify",
    json={"secret": "<key_secret>", "response": "<captcha_token>"},
).json().get("success")
```

```php [php]
<?php
$data = json_decode(file_get_contents("https://<your-instance>/<site-key>/siteverify",
  false, stream_context_create([
    "http" => [
      "method" => "POST",
      "header" => "Content-Type: application/json",
      "content" => json_encode(["secret"=>"<key_secret>","response"=>"<captcha_token>"])
    ]
  ])
), true);
var_dump($data['success'] ?? false);
```

:::

- `<key_secret>` est la **clé secrète** de votre tableau de bord, pas l'`ADMIN_KEY` du tableau de bord. Les confondre est l'erreur d'installation la plus fréquente.
- `<captcha_token>` est le jeton produit par le widget (le champ de formulaire `cap-token` ou `e.detail.token`).

Un jeton valide renvoie :

```json
{ "success": true }
```

Les jetons sont à usage unique : vérifiez chacun une seule fois, puis exécutez votre propre logique (créer le compte, envoyer le message, etc.).

## 4. Confirmer que tout fonctionne

Une vérification rapide de bout en bout :

1. Chargez votre page. La case doit se cocher et votre gestionnaire `solve` (ou le champ de formulaire) doit produire un jeton.
2. Envoyez ce jeton à `/siteverify`. Vous devriez recevoir `{ "success": true }`.
3. Renvoyez le même jeton. Il doit maintenant être refusé, ce qui confirme que l'usage unique fonctionne.

Si la vérification échoue systématiquement, assurez-vous d'utiliser la clé secrète (et non la clé admin) et que `<your-instance>` correspond bien à l'URL publique visée par le widget.

Voilà toute l'intégration. Les utilisateurs résolvent les défis dans leur navigateur, votre serveur vérifie les jetons, et vous conservez chaque octet des données.

## Conçu pour la conformité

Parce que Cap est auto-hébergé, sans cookies, sans pistage et sans appels tiers, les données de vos utilisateurs ne quittent jamais votre infrastructure. Cap est conçu pour répondre au RGPD, au CCPA, à HIPAA, à la LGPD et à d'autres régimes de protection des données, et la case à cocher fondée sur la preuve de travail évite les obstacles WCAG 2.2 que rencontrent les puzzles visuels et audio. Tous les détails, et les réglementations autour desquelles Cap est bâti, se trouvent sur la page [Conformité](./compliance.md).

## Étapes suivantes

Vos formulaires sont protégés. À partir d'ici, vous pouvez :

- Intégrer Cap à votre stack avec un [extrait par framework](./widget.md#usage)
- [Personnaliser le widget](./widget.md#options) dans son apparence et son comportement
- Régler l'[instrumentation](./instrumentation.md) et [configurer](./standalone/options.md) le CORS et la limitation de débit
- Voir comment Cap se compare à [reCAPTCHA, Turnstile, hCaptcha et aux autres](./alternatives.md)
- Lire le guide des [meilleures alternatives aux CAPTCHA pour 2026](./best-captcha-alternatives.md) si vous êtes encore en phase d'évaluation
