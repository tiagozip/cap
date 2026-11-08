---
description: "capd est la façon la plus simple d'auto-héberger le backend du CAPTCHA open source : un conteneur Docker avec un tableau de bord, plusieurs clés de site et une API compatible reCAPTCHA."
---

# capd

capd est le serveur Cap sous forme d'image Docker. Il sert des défis au widget, vérifie les jetons pour votre backend et dispose d'un tableau de bord pour les clés de site, les événements en direct, les règles, les listes et les réglages. Il tourne sur Bun, consomme environ 30 Mo de mémoire au repos et conserve ses données dans Valkey, avec les événements statistiques dans DuckDB ou ClickHouse.

La démo ci-dessous est le vrai tableau de bord, qui tourne dans votre navigateur avec du trafic généré.

<DashboardDemo compact activating="Activation du défilement..." />

Pour exécuter l'ensemble, tableau de bord compris, sur Cloudflare sans serveur, consultez [Cloudflare Workers](./workers.md). Si vous voulez seulement des défis dans un service existant, la [bibliothèque core](../capjs-core.md) le fait sans tableau de bord.

## Démarrage {#running-it}

Le [guide de démarrage rapide](../index.md#_1-set-up-capd) télécharge un fichier compose et lance Cap. Cap a besoin de Valkey dans toutes les configurations pour les clés de site, les réglages et les sessions, et conserve les événements statistiques dans DuckDB ou ClickHouse.

`ADMIN_KEY` est la seule valeur obligatoire. C'est le mot de passe du tableau de bord. Le serveur refuse de démarrer sans cette valeur ou si elle fait moins de 12 caractères. Tout le reste est dans [Configuration](./options.md).

Pour mettre à jour, récupérez la nouvelle image et recréez les conteneurs :

```bash
docker compose pull && docker compose up -d
```

## Stockage des statistiques {#analytics-storage}

DuckDB est un fichier à l'intérieur du conteneur Cap et ne demande donc aucun conteneur supplémentaire. ClickHouse tourne dans son propre conteneur à côté de Cap et permet à plusieurs conteneurs Cap de partager un même historique d'événements.

::: code-group

```bash [DuckDB]
curl -fsSLo docker-compose.yml https://raw.githubusercontent.com/tiagozip/cap/main/capd/docker-compose.duckdb.yml
echo "ADMIN_KEY=$(openssl rand -hex 24)" > .env
docker compose up -d
```

```bash [ClickHouse]
curl -fsSLo docker-compose.yml https://raw.githubusercontent.com/tiagozip/cap/main/capd/docker-compose.yml
echo "ADMIN_KEY=$(openssl rand -hex 24)" > .env
docker compose up -d
```

:::

Le fichier DuckDB lance Cap et Valkey, et Cap écrit les événements dans `/usr/src/app/data/events.duckdb` sur le volume `cap-data`. DuckDB utilise au plus 256 Mo de mémoire et 2 threads, ce que `DUCKDB_MEMORY_LIMIT` et `DUCKDB_THREADS` permettent de modifier. Le fichier ClickHouse lance Cap, Valkey et ClickHouse. ClickHouse utilise `ADMIN_KEY` comme mot de passe de son utilisateur `cap` et n'expose aucun port, il n'y a donc rien d'autre à régler. Sa configuration désactive ses propres tables de journaux système et limite sa mémoire à 1 Go.

| | DuckDB | ClickHouse |
| --- | --- | --- |
| Conteneur supplémentaire | Non | Oui |
| Mémoire du stockage | Jusqu'à 256 Mo pendant les requêtes du tableau de bord | Environ 150 Mo au repos |
| Plusieurs conteneurs Cap | Chacun conserve son propre historique | Partagent un historique d'événements |

Si votre mot de passe contient des espaces, `#` ou `$`, entourez-le de guillemets simples dans `.env`.

### Votre propre ClickHouse {#your-own-clickhouse}

Utilisez le fichier compose DuckDB et ajoutez `CLICKHOUSE_URL` à `.env` :

```dotenv
CLICKHOUSE_URL=http://cap:password@clickhouse.internal:8123/cap
```

Cap crée la base de données et les tables au premier démarrage. L'utilisateur doit avoir tous les privilèges sur cette base et `SELECT` sur `system.parts`. Si ClickHouse est inaccessible au démarrage, Cap stocke les événements dans DuckDB jusqu'à son prochain redémarrage et affiche l'erreur sous **Instance settings > Data and storage**.

### Mise à jour depuis une version antérieure {#upgrading-from-an-earlier-release}

Les fichiers compose antérieurs aux statistiques n'avaient pas de volume pour `/usr/src/app/data`. Docker attribue donc un volume anonyme à ce dossier, et les événements sont perdus à chaque recréation du conteneur. Ajoutez le volume `cap-data` de `docker-compose.duckdb.yml` pour les conserver.

### Secrets, clés d'API et sessions des versions antérieures {#secrets-api-keys-and-sessions-from-older-releases}

Les versions antérieures hachaient les secrets de site, les clés d'API et les sessions du tableau de bord avec argon2. Cap les stocke désormais tous en SHA-256, puisque chacun est un jeton aléatoire d'au moins 240 bits, et il rejette les anciens hachages au lieu de les vérifier. Au premier démarrage après la mise à jour :

- Tout le monde est déconnecté du tableau de bord. Reconnectez-vous avec `ADMIN_KEY`.
- `/siteverify` renvoie 403 pour les clés dont le secret a été créé par une version antérieure. Leur page **Settings** l'indique. Réinitialisez le secret sous **Danger zone** et placez le nouveau dans l'environnement de votre backend.
- Les clés d'API d'une version antérieure reçoivent 401. **Settings > API keys** les signale. Créez-en de nouvelles et supprimez les anciennes.

Cap consigne au démarrage les identifiants des clés de site et des clés d'API qui doivent encore être traitées. Réinitialisez les secrets avant de mettre à jour les backends qui appellent `/siteverify`, car les requêtes avec l'ancien secret échouent dès le démarrage de la nouvelle image.

## Mise en ligne {#putting-it-online}

Le widget appelle Cap depuis le navigateur de vos visiteurs, donc le serveur a besoin d'une URL HTTPS publique. Placez-le derrière votre reverse proxy habituel et gardez le port 3000 fermé à Internet.

Cap limite le débit des défis par IP client, ce qui ne fonctionne que s'il voit la vraie IP. Lisez [IP client derrière un proxy](./options.md#client-ips-behind-a-proxy) avant la mise en ligne, sinon tous les visiteurs partageront un seul compteur de limitation.

Le mode en direct de la page Events utilise un WebSocket sur `/server/live`. La plupart des proxys le laissent passer tel quel. Avec nginx, ajoutez `proxy_http_version 1.1` et les en-têtes `Upgrade` et `Connection` à la location de Cap. Sans eux, le tableau de bord revient à une vérification toutes les 4 s.

## Clés de site {#site-keys}

Chaque clé de site a son propre secret, ses statistiques et ses réglages : le protocole et la difficulté des défis, l'[instrumentation](../instrumentation.md), les limites de débit et les règles de blocage. Les nouvelles clés utilisent [HashWX](../hashwx.md) avec l'instrumentation activée.

Vous pouvez à nouveau afficher ou copier le secret sous **Add Cap to your site**, sur la page **Settings** de la clé, à côté d'un extrait `.env` contenant les deux clés. La réinitialisation se trouve sous **Danger zone**. Cap le stocke chiffré avec une clé dérivée de `ADMIN_KEY`, donc une copie des seules données Valkey ne le révèle pas. Changer `ADMIN_KEY` rend les secrets stockés illisibles, réinitialisez donc le secret ensuite pour en obtenir un nouveau que vous pourrez afficher.

## Difficulté adaptative {#adaptive-difficulty}

Une règle avec l'action **Harder puzzle** multiplie la difficulté de la clé pour les requêtes qu'elle cible, par 1,5 à 10, ou par 2 si vous ne choisissez pas de facteur. Sur les clés HashWX, elle augmente la difficulté, et sur les clés SHA-256, le nombre de défis, jusqu'à 500. Les règles peuvent porter sur les défis par minute d'une IP ou d'un visiteur, le pays, le réseau, le user agent, les en-têtes et les listes partagées. Les visiteurs trop pressés ou les réseaux douteux paient donc plus cher, pendant que tous les autres résolvent le défi habituel.

Le modèle **Harder puzzles for fast repeat visitors** donne un défi 4 fois plus difficile aux IP qui demandent plus de 20 défis par minute. La page Events affiche ces requêtes comme **Puzzle ×4**.

## Points d'accès {#endpoints}

Avec une clé de site `abc123` sur `cap.example.com` :

| URL | Appelée par |
| --- | --- |
| `https://cap.example.com/abc123/` | Le widget, comme `data-cap-api-endpoint` |
| `https://cap.example.com/abc123/siteverify` | Votre backend, avec le secret et le jeton |
| `https://cap.example.com/` | Vous, pour le tableau de bord |

`/siteverify` accepte du JSON avec `secret` et `response`, comme celui de reCAPTCHA, et renvoie `{ "success": true }` pour un jeton valide. Une vérification échouée renvoie `success: false` avec un message `error` et un statut 4xx. Les jetons ne fonctionnent qu'une fois.

Le tableau de bord dispose aussi d'une [API REST](./options.md#api) pour gérer les clés depuis des scripts.
