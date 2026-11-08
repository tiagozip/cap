---
description: "Configuration de capd, le CAPTCHA open source auto-hébergé : variables d'environnement, IP client derrière un proxy, fichiers du widget, contrôles de santé et API."
---

# Configuration

La plupart des réglages se trouvent dans le tableau de bord, soit pour tout le serveur sous **Instance settings**, soit par clé de site sur sa page **Settings**. Cette page couvre ce que le tableau de bord ne permet pas de régler.

## Variables d'environnement {#environment-variables}

| Variable | Description |
| --- | --- |
| `ADMIN_KEY` | Mot de passe du tableau de bord, d'au moins 12 caractères. Obligatoire. |
| `VALKEY_URL` | Chaîne de connexion Valkey, `redis://localhost:6379` par défaut. Redis fonctionne aussi. |
| `VALKEY_TLS_CA` | Chemin vers un certificat d'autorité au format PEM auquel Cap fait confiance pour Valkey en TLS, par exemple pour un serveur avec un certificat auto-signé. Utilisez une URL `rediss://`. `VALKEY_TLS_CERT` et `VALKEY_TLS_KEY` ajoutent un certificat client quand le serveur en demande un. |
| `CLICKHOUSE_URL` | Stocke les événements dans ClickHouse plutôt que DuckDB, par exemple `http://cap:password@clickhouse:8123/cap`. Écrivez le mot de passe sans encodage URL. |
| `WEBHOOK_ALLOW_PRIVATE` | Définissez-la à `true` pour autoriser les webhooks à envoyer des requêtes vers des adresses privées et de bouclage, comme un n8n sur votre réseau local. |
| `DUCKDB_MEMORY_LIMIT`, `DUCKDB_THREADS` | Limites de DuckDB, `256MB` et `2` par défaut. |

`CORS_ORIGIN`, `RATELIMIT_IP_HEADER`, `ENABLE_ASSETS_SERVER`, `WIDGET_VERSION` et `WASM_VERSION`, issues des versions antérieures, sont désormais des réglages du tableau de bord. Si l'une d'elles est encore définie, Cap copie sa valeur dans le tableau de bord au démarrage.

## IP client derrière un proxy {#client-ips-behind-a-proxy}

Cap limite le débit des défis par IP client, à 30 requêtes toutes les 5 secondes par défaut. Il utilise l'adresse du socket et ignore les en-têtes de transfert, sauf si vous sélectionnez votre proxy sous **Instance settings > Visitor location > Your proxy or CDN**. Derrière Cloudflare, choisissez Cloudflare. Pour `X-Forwarded-For`, Cap lit la dernière entrée, celle que votre proxy a ajoutée.

Avec nginx, transmettez l'adresse ainsi :

```nginx
location / {
    proxy_pass http://localhost:3000;
    proxy_set_header X-Forwarded-For $remote_addr;
}
```

Sans réglage de proxy, tous les visiteurs partagent le compteur de limitation du proxy. Une fois un en-tête configuré, n'exposez pas directement le port 3000, sinon les clients peuvent envoyer l'IP de leur choix.

## Connexion via un proxy {#proxy-sign-in}

Si le tableau de bord se trouve derrière Authentik, Authelia, oauth2-proxy ou un autre proxy d'authentification, Cap peut connecter toute personne que le proxy laisse passer, sans seconde connexion avec `ADMIN_KEY`. Dans **Instance settings > Proxy sign-in**, générez un secret, puis demandez à votre proxy de l'ajouter dans l'en-tête `X-Cap-Proxy-Secret` des requêtes qu'il a authentifiées. Avec Caddy, c'est une ligne dans le bloc `reverse_proxy` placé derrière votre forward auth :

```txt
reverse_proxy localhost:3000 {
    header_up X-Cap-Proxy-Secret {env.CAP_PROXY_SECRET}
}
```

Avec nginx, c'est `proxy_set_header X-Cap-Proxy-Secret $cap_proxy_secret;` dans la location protégée. Les routes du widget, `/assets/*`, `/<siteKey>/challenge`, `/<siteKey>/redeem`, `/<siteKey>/siteverify` et `/health`, restent hors du proxy d'authentification et n'ont pas besoin de l'en-tête.

**Proxy or admin key** vous connecte automatiquement quand l'en-tête est présent et garde la connexion par clé d'administration pour les autres. **Proxy only** désactive la connexion par clé d'administration et vérifie l'en-tête sur chaque requête du tableau de bord, donc une personne retirée de votre fournisseur d'identité perd l'accès tout de suite, même avec un jeton de session conservé. Les clés d'API continuent de fonctionner dans les deux modes. Cap ne passe en Proxy only que si la requête qui l'active porte l'en-tête, pour que vous ne puissiez pas vous bloquer depuis le tableau de bord.

Cap ne garde qu'un hachage du secret. Si vous le perdez, générez-en un nouveau. Si un proxy mal configuré vous bloque malgré tout, supprimez le réglage avec `docker compose exec valkey valkey-cli DEL settings:proxy-auth`, en ajoutant votre `REDIS_PREFIX` devant la clé si vous en avez défini un.

## Fichiers du widget {#asset-server}

Par défaut, le widget charge son script et ses fichiers WebAssembly depuis jsDelivr. Si vous activez **Instance settings > Widget files > Serve widget files from this server**, Cap les télécharge dans Valkey et les sert sous `/assets/`, et l'extrait **Add Cap to your site** de chaque clé pointe vers ces fichiers. La même section permet de choisir les versions du widget et du WASM.

## Données IP {#ip-data}

Les recherches DB-IP et MaxMind téléchargent des fichiers `.mmdb` dans `/usr/src/app/data`. Le conteneur s'exécute avec l'UID 1000, donc un dossier monté depuis l'hôte doit être accessible en écriture par cet utilisateur :

```bash
mkdir -p ./cap-data && sudo chown 1000:1000 ./cap-data
```

## Contrôles de santé {#health-checks}

`GET /health` renvoie `200` quand Valkey répond en moins de 2 secondes, et `503` sinon. Utilisez-le pour les contrôles de disponibilité. `GET /health/live` renvoie `200` tant que le processus tourne. Utilisez-le pour les contrôles de vivacité, et un orchestrateur ne redémarrera pas Cap pendant une panne de Valkey.

## API {#api}

Tout ce que fait le tableau de bord est accessible via une API REST, documentée à `/swagger` sur votre instance. Créez une clé sous **Instance settings > API keys** et envoyez-la sous la forme `Authorization: Bot <api-key>`.

Par défaut, une clé peut tout faire. Vous pouvez la passer en lecture seule, la limiter à certaines clés de site, ou les deux. Vous pouvez confier sans risque une clé en lecture seule limitée à une clé de site au propriétaire de ce site, pour qu'il consulte ses statistiques.
