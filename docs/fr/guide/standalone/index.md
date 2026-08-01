---
description: "Cap Standalone est la façon la plus simple d'auto-héberger le backend du CAPTCHA open source : Docker, instrumentation, une API compatible reCAPTCHA et un tableau de bord web."
---

# Cap Standalone

Cap Standalone est la méthode recommandée pour auto-héberger le backend de Cap. Il tourne sur Bun et consomme environ 50 Mo de mémoire au repos. Il embarque nativement les défis d'instrumentation, qui relèvent nettement la barre pour les bots, une API siteverify compatible avec reCAPTCHA, et un tableau de bord web pour gérer plusieurs clés de site.

Nous recommandons d'utiliser [Docker](https://docs.docker.com/get-docker/) pour faire tourner Cap Standalone.

## Installation

Créez un fichier `docker-compose.yml` :

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

::: tip Conseils

- `ADMIN_KEY` est l'identifiant de connexion à votre tableau de bord. Nous recommandons au moins 32 caractères
- Changez `3000:3000` si ce port est déjà utilisé sur votre hôte.
- Si le tableau de bord est inaccessible, essayez d'ajouter `network_mode: "host"` sous le service `cap`.
  :::

Démarrez le conteneur :

```bash
docker compose up -d
```

Ouvrez `http://localhost:3000` (ou l'IP/le domaine de votre serveur sur le port 3000) pour accéder au tableau de bord. Connectez-vous avec votre clé admin, créez une clé de site, et notez à la fois la **clé de site** et sa **clé secrète** : vous aurez besoin des deux.

Les défis d'instrumentation sont activés par défaut à la création d'une clé de site. Nous recommandons de les laisser actifs, car ils relèvent nettement la barre pour les bots. Vous pouvez aussi activer la détection des navigateurs headless pour une protection supplémentaire.

Votre instance Cap Standalone doit être accessible publiquement depuis Internet pour que le widget puisse communiquer avec elle. Si vous utilisez un reverse proxy, consultez le [guide des options](/fr/guide/standalone/options.md) pour configurer correctement la limitation de débit.

## Utilisation

### Côté client

Faites pointer le widget vers votre instance via l'attribut `data-cap-api-endpoint` :

```
https://<instance_url>/<site_key>/
```

- `<instance_url>` — l'URL publique de votre instance Cap Standalone
- `<site_key>` — la clé de site issue de votre tableau de bord

Exemple :

```html
<cap-widget data-cap-api-endpoint="https://cap.example.com/d9256640cb53/"></cap-widget>
```

Nous vous conseillons de lire notre [documentation du widget](../widget.md) pour plus de détails et des extraits de code pour plusieurs frameworks.

### Côté serveur

Une fois le CAPTCHA résolu par l'utilisateur, votre backend doit vérifier le jeton avant de lui faire confiance. Envoyez une requête `POST` au point d'accès `/siteverify` de votre instance, avec le corps JSON suivant :

```bash
curl "https://<instance_url>/<site_key>/siteverify" \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{ "secret": "<key_secret>", "response": "<captcha_token>" }'
```

Où `<key_secret>` est la clé secrète de votre tableau de bord (et **non** la clé admin), et `<captcha_token>` le jeton de défi généré par le widget.

Une vérification réussie renvoie :

```json
{ "success": true }
```
