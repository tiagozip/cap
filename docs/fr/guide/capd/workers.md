---
description: "Faites tourner capd sur Cloudflare Workers avec D1 : le même code, le même tableau de bord, les mêmes clés de site et la même API siteverify, sans serveur ni conteneur."
---

# Cloudflare Workers

La prise en charge de Workers est **expérimentale**. Si vous trouvez un bug, [signalez-le](https://github.com/tiagozip/cap/issues).

## Déploiement

Il vous faut Node 22 ou plus récent, [Bun](https://bun.sh) pour construire le tableau de bord, et un compte Cloudflare.

```bash
git clone https://github.com/tiagozip/cap.git
cd cap/workers && npm install
npm run deploy
npx wrangler secret put ADMIN_KEY
```

`npm run deploy` installe les paquets de capd, construit le tableau de bord, déploie le Worker puis applique les migrations D1, car `wrangler deploy` crée la base la première fois. `ADMIN_KEY` est le mot de passe du tableau de bord. Générez-en un avec `openssl rand -hex 24`.

Ouvrez l'URL `workers.dev` affichée par Wrangler et connectez-vous. Pour le servir sur votre propre domaine, ajoutez un [domaine personnalisé](https://developers.cloudflare.com/workers/configuration/routing/custom-domains/) au Worker.

Pour mettre à jour, récupérez le dépôt et relancez les mêmes commandes, sauf `secret put`.

## Différences avec l'image Docker

- **Les réglages mettent quelques secondes à s'appliquer partout.** Chaque isolate recharge les réglages toutes les 10 s, et met en cache la configuration des clés et les listes 5 s et les origines CORS de siteverify 60 s.
- **Le rachat est plus lent.** Chaque écriture D1 va vers la région principale de la base, et le rachat en fait plusieurs à la suite, donc les visiteurs éloignés de la région principale attendent plus longtemps.
- **Les réglages de la base d'IP sont désactivés**, car Cloudflare fournit déjà au Worker le pays et l'ASN de chaque visiteur.
- **Les niveaux d'obfuscation 4 à 10 sautent leur étape de minification**, car esbuild ne peut pas s'exécuter dans un Worker. Le widget résout de la même façon.
- **Les webhooks sont retentés après 1 s et 5 s.** La troisième tentative, 30 s plus tard, tombe après le temps que Cloudflare laisse à un Worker une fois sa réponse envoyée, donc elle n'a généralement pas lieu.
- **Le mode en direct de la page Events cherche de nouveaux événements toutes les 4 s.** L'image Docker les envoie par WebSocket, ce qu'un Worker ne peut pas diffuser à plusieurs connexions sans Durable Object.
- **Il n'y a pas de documentation de l'API sur `/swagger`.** Celle de l'image Docker décrit la même API.
- **Il n'y a pas de migration depuis les données de l'image Docker.** Les clés de site, les réglages et les événements repartent de zéro.

D1 exécute les requêtes d'une base l'une après l'autre, donc un site très fréquenté dépasse la base bien avant le Worker. Au-delà d'environ 50 résolutions par seconde sur l'ensemble des clés de site, utilisez l'image Docker.

## Exécution en local

```bash
cd workers && npm install
echo "ADMIN_KEY=$(openssl rand -hex 24)" > .dev.vars
npm run dev
```

`npm run dev` construit le tableau de bord, applique les migrations à une base locale et lance `wrangler dev`.
