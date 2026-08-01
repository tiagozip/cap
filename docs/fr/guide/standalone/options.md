---
description: "Options de configuration et variables d'environnement de Cap Standalone, le CAPTCHA open source auto-hébergé : CORS, serveur d'assets, versions du widget et du WASM, et plus."
---

# Options

## CORS

Vous pouvez modifier les réglages CORS par défaut pour l'émission et l'échange de défis en définissant la variable d'environnement `CORS_ORIGIN` au lancement du serveur. Sa valeur par défaut est `*`, ce qui autorise toutes les origines. Séparez plusieurs origines par des virgules, par exemple `domain1.tld,domain2.tld,...`.

## Serveur d'assets

Le serveur d'assets est désactivé par défaut. Activez-le en définissant la variable d'environnement `ENABLE_ASSETS_SERVER` sur `true`. Les assets seront alors servis depuis le point d'accès `/assets`.

Pensez ensuite à définir `WIDGET_VERSION` et `WASM_VERSION` sur la version des fichiers widget et WASM que vous voulez servir. La valeur par défaut est `latest`, qui sert la dernière version disponible ; ce n'est pas recommandé en production, car cela peut livrer des changements cassants.

Les versions disponibles sont les publications npm de [`@cap.js/widget`](https://www.npmjs.com/package/@cap.js/widget?activeTab=versions) et [`@cap.js/wasm`](https://www.npmjs.com/package/@cap.js/wasm?activeTab=versions). Par exemple :

```env
ENABLE_ASSETS_SERVER=true
WIDGET_VERSION=0.1.56
WASM_VERSION=0.0.7
```

Vos assets seront servis depuis les chemins suivants :

- `/assets/widget.js`
- `/assets/floating.js`
- `/assets/cap_wasm_bg.wasm`
- `/assets/cap_wasm.js`

Utilisez-les dans votre application en pointant la source du script du widget vers le chemin approprié :

```html
<script src="https://<server url>/assets/widget.js"></script>
```

Pour le mode flottant :

```html
<script src="https://<server url>/assets/floating.js"></script>
```

Et en définissant `window.CAP_CUSTOM_WASM_URL` sur le chemin du fichier `cap_wasm_bg.wasm` :

```js
window.CAP_CUSTOM_WASM_URL = "https://<server url>/assets/cap_wasm_bg.wasm";
```

Par défaut, ces fichiers sont récupérés depuis `process.env.CACHE_HOST` (dont la valeur par défaut est `https://cdn.jsdelivr.net`). Changez-la avec la variable d'environnement `CACHE_HOST` au lancement du serveur.

### Dépannage

Les assets sont téléchargés depuis `CACHE_HOST` vers Redis au démarrage, puis rafraîchis toutes les heures. Si un point d'accès d'asset répond `Asset not cached yet`, c'est que le téléchargement n'a pas eu lieu. Vérifiez que :

- `ENABLE_ASSETS_SERVER=true` est bien défini sur le conteneur Cap. Si vous l'avez changé dans un fichier compose, recréez le conteneur. Sans cette variable, les points d'accès `/assets/*` répondent par un 404 expliquant que le serveur d'assets est désactivé.
- Le conteneur dispose d'un accès réseau sortant vers `CACHE_HOST`. En cas d'échec de téléchargement, le serveur journalise au démarrage une ligne contenant `[asset server] failed to update assets cache` et réessaie toutes les heures.
- `WIDGET_VERSION` et `WASM_VERSION` pointent vers des versions qui existent réellement sur npm.

## Limitation de débit

Les points d'accès de défi sont limités par IP client via une fenêtre fixe, par défaut 30 requêtes toutes les 5 secondes. Vous pouvez changer la limite globale sous **Settings** dans le tableau de bord (ou via `PUT /settings/ratelimit`), et la surcharger par clé de site dans l'onglet **Configuration** de la clé. Au dépassement, les requêtes reçoivent une réponse `429` avec l'en-tête `X-RateLimit-Remaining: 0`.

Le point d'accès `/siteverify` est destiné aux échanges serveur à serveur : il n'est donc pas limité par défaut.

### IP client derrière un proxy

Standalone identifie les clients via les en-têtes `X-Forwarded-For`, `X-Real-IP` et `CF-Connecting-IP` (dans cet ordre), et se rabat sinon sur l'adresse du socket. Si vous êtes derrière un reverse proxy qui utilise un autre en-tête, définissez `RATELIMIT_IP_HEADER` dans votre environnement (ou l'en-tête IP sous **Settings > Headers** dans le tableau de bord). Derrière Cloudflare, par exemple, vous pourriez le régler sur `cf-connecting-ip`.

Assurez-vous que votre proxy transmet bien l'IP du client. Pour nginx :

```nginx
location / {
    proxy_pass http://localhost:3000;
    proxy_set_header X-Forwarded-For $remote_addr;
}
```

Sans cela, toutes les requêtes semblent venir de l'IP du proxy et tous les clients partagent un seul compteur de limitation. Notez aussi que `X-Forwarded-For` est cru sur parole : le serveur ne doit donc pas être directement joignable depuis Internet, sinon des clients peuvent falsifier l'en-tête et contourner la limitation.

## Redis / Valkey

Cap Standalone utilise Redis (ou Valkey) pour tout le stockage de données. Définissez la variable d'environnement `REDIS_URL` sur votre chaîne de connexion Redis. Sa valeur par défaut est `redis://localhost:6379`.

La configuration recommandée utilise Valkey (un magasin compatible Redis) via le fichier docker-compose fourni dans le [guide de démarrage rapide](/fr/guide/standalone/).

Si vous partagez une même instance Redis entre plusieurs déploiements Cap (ou avec d'autres applications), définissez `REDIS_PREFIX` pour préfixer toutes les clés. Par exemple, `REDIS_PREFIX=cap:` stocke les sessions sous `cap:session:...`, les métriques sous `cap:metrics:...`, et ainsi de suite. La valeur est vide par défaut, les déploiements existants ne sont donc pas affectés.

## Messages d'erreur

Les messages d'erreur sont masqués par défaut et journalisés dans la console à la place. Pour désactiver la journalisation des erreurs, définissez `DISABLE_ERROR_LOGGING=true`. Pour désactiver le masquage, définissez `SHOW_ERRORS=true`.

## Verrous temporels RSW {#rsw-time-lock-puzzles}

Standalone prend en charge le [verrou temporel RSW](../rsw.md) comme alternative optionnelle et résistante aux GPU à la preuve de travail SHA-256. Il se configure par clé de site : certaines clés peuvent donc utiliser RSW pendant que d'autres restent sur les défis SHA-256 par défaut.

Pour l'activer, ouvrez l'onglet **Configuration** d'une clé et basculez le **Challenge protocol** sur « RSW time-lock puzzle ». La première fois que vous activez RSW sur une clé, Standalone génère un module de 2048 bits (environ 1 à 3 secondes) et le stocke dans Redis. Le même couple de clés est réutilisé pour toutes les clés RSW ; vous n'avez pas à le gérer manuellement.

La difficulté se règle avec le curseur **RSW squarings** (le paramètre `t`, soit le nombre d'élévations au carré séquentielles que le client doit calculer). La valeur par défaut est `75_000`, soit environ 300 à 800 ms de travail côté client sur du matériel récent. Baissez-la pour des défis moins coûteux, augmentez-la pour un bridage plus fort. La plage valide est `10_000`-`300_000`.

Vous pouvez redéfinir la taille du module au démarrage avec `RSW_BITS=2048` (valeur par défaut). Des tailles plus petites ne servent qu'aux tests.

::: tip
RSW est optionnel et encore expérimental. Le pipeline Cap par défaut utilise toujours la preuve de travail SHA-256. Le widget détecte automatiquement les défis RSW d'après le format d'échange : basculer l'interrupteur est le seul changement à faire.
:::

## Défis d'instrumentation

Cap Standalone prend en charge les défis d'instrumentation JavaScript pour mettre en échec les solveurs de preuve de travail, ainsi que des options pour empêcher les navigateurs headless de les résoudre. Les défis d'instrumentation sont activés par défaut à la création d'une clé de site.

Vous pouvez les activer ou les désactiver dans la configuration de votre clé de site. Pour bloquer les navigateurs headless, activez « Attempt to block headless browsers » dans les réglages de la clé.

Notez que des niveaux d'instrumentation élevés peuvent réduire nettement le débit de génération. Nous recommandons de rester au niveau 3, sauf si vous avez besoin d'une obfuscation plus forte. Si le niveau 3 vous semble trop lent, le niveau 1 est nettement plus rapide sur un seul cœur.

## Base de données IP

Les recherches de pays et d'ASN peuvent s'appuyer sur l'un de trois fournisseurs, configurables sous `Settings > IP Data > Country & ASN data` dans le tableau de bord : DB-IP Lite, MaxMind GeoLite2 et l'API d'IPInfo.

Pour DB-IP et MaxMind, les fichiers `.mmdb` sont téléchargés dans `/usr/src/app/data/` à l'intérieur du conteneur.

### Permissions des volumes Docker

Le conteneur s'exécute sous l'utilisateur non privilégié `bun` (UID 1000). Si vous montez un répertoire de l'hôte sur `/usr/src/app/data`, ce répertoire doit être accessible en écriture par l'UID 1000, sinon le téléchargement échouera avec `EACCES: permission denied`.

```bash
mkdir -p ./cap-data
sudo chown 1000:1000 ./cap-data
```

```yaml
services:
  cap:
    image: tiago2/cap:latest
    volumes:
      - ./cap-data:/usr/src/app/data
    # ...
```

Si vous ne pouvez pas changer le propriétaire sur votre hôte (c'est peu pratique sur certaines plateformes comme Coolify), les solutions les plus simples sont :

- Supprimer complètement le montage et laisser Docker gérer le répertoire de données : l'image le crée déjà avec le bon propriétaire.
- Utiliser un volume nommé plutôt qu'un montage de répertoire hôte.
- Passer à un fournisseur de données IP qui n'a besoin d'aucun fichier local.
