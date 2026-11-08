---
outline: [2, 3]
description: "Mettez en place Cap, le CAPTCHA open source auto-hébergé, en cinq minutes environ. Lancez le serveur avec Docker ou dans votre propre backend, ajoutez le widget, vérifiez les jetons. Sans Google, sans télémétrie, sans puzzles visuels."
---

# Démarrage rapide

Cap comporte deux parties : un widget, qui s'exécute et résout les défis dans le navigateur du visiteur puis vous remet un jeton, et le serveur (capd), qui émet les défis et vérifie ces jetons.

## 1. Installer capd {#_1-set-up-capd}

Vous devez d'abord installer capd. Il s'exécute comme un serveur auto-hébergé avec un tableau de bord, des statistiques, des règles et une API. Les clés et les réglages sont stockés dans Valkey. Avant de commencer, vous avez deux choix à faire :

**1. Où exécuter capd :** vous pouvez l'exécuter sur votre propre serveur avec Docker, utiliser [Railway](https://railway.com/deploy/cap-1?referralCode=93HYBZ&utm_medium=integration&utm_source=template&utm_campaign=generic), ou passer par une plateforme serverless comme [Workers](./capd/workers.md). Ce guide utilise Docker.

**2. Où stocker les statistiques :** vous pouvez utiliser DuckDB (léger, idéal pour les petits sites) ou ClickHouse (plus adapté à la montée en charge). Les deux sont intégrés et simples à mettre en place.

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

Ouvrez `http://localhost:3000` et connectez-vous avec le `ADMIN_KEY` de `.env`, qui est le mot de passe du tableau de bord. Créez une clé de site et copiez à la fois la clé de site et sa clé secrète.

Le widget communique avec ce serveur depuis le navigateur de vos visiteurs, il lui faut donc une URL publique en production. Nous recommandons une solution comme [Tunnels](https://developers.cloudflare.com/tunnel/), mais [la documentation de capd](./capd/index.md) couvre la plupart des autres cas, y compris les reverse proxies.

## 2. Ajouter le widget {#_2-add-the-widget}

Chargez le script en épinglant une version issue de la [page des versions](https://github.com/tiagozip/cap/releases) :

```html
<script src="https://cdn.jsdelivr.net/npm/cap-widget@<version>"></script>
```

Placez le widget dans votre formulaire :

```html
<form action="/submit" method="POST">
  <cap-widget data-cap-api-endpoint="https://cap.example.com/<site-key>/"></cap-widget>
  <button type="submit">Submit</button>
</form>
```

Le point d'accès est `https://<your-instance>/<site-key>/`.

Quand le visiteur résout le défi, le widget ajoute un champ caché `cap-token` au formulaire. En dehors d'un formulaire, écoutez plutôt l'événement `solve` :

```js
document.querySelector("cap-widget").addEventListener("solve", (e) => {
  const token = e.detail.token;
});
```

La [page du widget](./widget.md) contient des extraits pour React, Vue, Svelte et d'autres frameworks.

## 3. Vérifier le jeton {#_3-verify-the-token}

Avant de faire confiance à une soumission, envoyez son jeton à `/siteverify` depuis votre serveur :

::: code-group

```js [fetch]
const res = await fetch("https://cap.example.com/<site-key>/siteverify", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ secret: "<secret>", response: token }),
});
const { success } = await res.json();
```

```py [python]
import requests

success = requests.post(
    "https://cap.example.com/<site-key>/siteverify",
    json={"secret": "<secret>", "response": token},
).json()["success"]
```

```php [php]
$res = file_get_contents("https://cap.example.com/<site-key>/siteverify", false, stream_context_create([
  "http" => [
    "method" => "POST",
    "header" => "Content-Type: application/json",
    "content" => json_encode(["secret" => "<secret>", "response" => $token]),
  ],
]));
$success = json_decode($res, true)["success"] ?? false;
```

```sh [curl]
curl -X POST "https://cap.example.com/<site-key>/siteverify" \
  -H "Content-Type: application/json" \
  -d '{"secret": "<secret>", "response": "<token>"}'
```

:::

`<secret>` est la clé secrète de la clé de site, pas votre `ADMIN_KEY`. Confondre les deux est l'erreur d'installation la plus fréquente.

Si vous venez de reCAPTCHA, `/siteverify` accepte le même format de requête, il suffit donc que votre code de vérification utilise le nom d'hôte de votre serveur.

Un jeton valide renvoie `{ "success": true }`. Chaque jeton ne fonctionne qu'une fois, donc une seconde vérification du même jeton échoue. L'envoyer deux fois permet de tester rapidement l'installation de bout en bout.

## Utiliser la bibliothèque core à la place {#using-the-core-library-instead}

Si vous préférez émettre et vérifier les défis dans votre propre backend, la [bibliothèque core](./capjs-core.md) est un paquet npm minimal qui ne fait que cela. Vous stockez les jetons dans votre propre base de données, et vous n'avez ni tableau de bord, ni statistiques, ni limitation de débit.

## Étapes suivantes {#next-steps}

- [Personnaliser le widget](./widget.md#attributes) : ses libellés, sa langue et son style
- [Configurer capd](./capd/options.md) : proxies, fichiers du widget et API
- Lire la [référence de la bibliothèque core](./capjs-core.md)
- Lire [comment fonctionne Cap](./workings.md)
