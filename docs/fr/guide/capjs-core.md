---
outline: [2, 3]
description: "capjs-core est la bibliothèque serveur sans état de Cap pour générer et vérifier des défis de preuve de travail avec des JWT signés. Exécutez le CAPTCHA open source sur Workers, Lambda ou votre propre backend."
---

# Bibliothèque core

`capjs-core` génère et vérifie les défis dans votre propre serveur. Elle est sans état. Un défi est un JWT signé, donc elle n'a besoin d'aucune base de données, d'aucun système de fichiers ni d'aucun état en mémoire, et fonctionne sur Cloudflare Workers, Lambda et d'autres runtimes edge. capd est bâti dessus.

La plupart des utilisateurs devraient plutôt utiliser [capd](./capd/index.md), le serveur de Cap, qui ajoute un tableau de bord, des statistiques, une limitation de débit et un stockage de jetons. Utilisez la bibliothèque si vous ne pouvez pas faire tourner un conteneur ou si vous voulez intégrer les défis dans un service existant.

::: code-group

```sh [npm]
npm i capjs-core
```

```sh [pnpm]
pnpm add capjs-core
```

```sh [bun]
bun add capjs-core
```

:::

## Prise en main {#getting-started}

Il vous faut deux routes, l'une pour créer un défi et l'autre pour vérifier la solution. Faites pointer le `data-cap-api-endpoint` du widget vers leur préfixe commun, et le widget appellera `<prefix>challenge` et `<prefix>redeem`.

```js
import { generateChallenge, validateChallenge } from "capjs-core";

const SECRET = process.env.CAP_SECRET;

app.post("/cap/challenge", async () => {
  return await generateChallenge(SECRET, { instrumentation: true });
});

app.post("/cap/redeem", async (req) => {
  return await validateChallenge(SECRET, req.body, { consumeNonce });
});
```

`SECRET` signe chaque défi. Choisissez-le long et aléatoire, avec au moins 16 octets, et utilisez le même dans tous les processus.

`consumeNonce` empêche qu'un défi résolu soit échangé deux fois. Vous le fournissez à partir de votre propre stockage. Voir la [prévention du rejeu](#replay-prevention).

## Vérification des jetons {#verifying-tokens}

Un appel réussi à `validateChallenge` renvoie un `token` pour le visiteur et un `tokenKey` pour vous. La bibliothèque ne stocke ni l'un ni l'autre, donc enregistrez `tokenKey` avec son `expires` :

```js
const result = await validateChallenge(SECRET, req.body, { consumeNonce });
if (result.success) {
  await store.set(`cap-token:${result.tokenKey}`, result.expires);
}
return result;
```

Le widget transmet `token` à votre formulaire. À la réception du formulaire, dérivez la clé à partir du jeton soumis et cherchez-la :

```js
import { createHash } from "node:crypto";

const [id, secret] = req.body["cap-token"].split(":");
const tokenKey = `${id}:${createHash("sha256").update(secret).digest("hex")}`;
const expires = await store.get(`cap-token:${tokenKey}`);

if (!expires || Number(expires) < Date.now()) {
  return new Response("invalid captcha", { status: 403 });
}
await store.delete(`cap-token:${tokenKey}`);
```

Supprimer la clé rend chaque jeton à usage unique.

## HashWX {#format-2-hashwx}

`generateChallenge` émet par défaut une preuve de travail [HashWX](./hashwx.md), le même format que capd utilise pour les nouvelles clés. Il résiste bien mieux aux GPU que SHA-256. `instrumentation: true` et `behavior` ajoutent un défi d'instrumentation.

Pour choisir les protocoles vous-même, passez-les avec `format: 2` :

```js
return await generateChallenge(SECRET, {
  format: 2,
  protocols: ["hashwx", "instrumentation"],
});
```

`format: 1` revient à la preuve de travail SHA-256, tout comme passer `challengeCount`, `challengeSize` ou `challengeDifficulty` sans `format`. Le widget détecte le format automatiquement, et `validateChallenge` gère les deux. HashWX nécessite le widget 0.1.58 ou plus récent, donc mettez à jour un widget épinglé avant la bibliothèque.

| Option | Valeur par défaut | Description |
| --- | --- | --- |
| `hashwxDifficulty` | `1_000_000` | Nombre de hachages attendu par résolution, tous sous-défis confondus. |
| `hashwxChallengeCount` | `4` | Nombre de sous-défis entre lesquels la difficulté est répartie. En augmenter le nombre rend les temps de résolution moins aléatoires. Voir le [coût côté client](./hashwx.md#cost). |
| `hashwxNoncesPerHash` | `65_536` | Nonces couverts par chaque fonction de hachage générée. |

HashWX ne nécessite aucune clé ni préparation. La première vérification compile un petit module WebAssembly. Vous pouvez appeler `await hashwxReady()` au démarrage pour le faire à l'avance.

Certains runtimes n'autorisent pas la compilation de WebAssembly à l'exécution. Cloudflare Workers reçoit automatiquement un module précompilé. Ailleurs, importez-le de la manière prise en charge par votre plateforme et fournissez-le avant la première vérification :

```js
import { setHashwxModule } from "capjs-core";
import hashwxModule from "capjs-core/hashwx.wasm";

setHashwxModule(hashwxModule);
```

## Prévention du rejeu {#replay-prevention}

`validateChallenge` appelle `consumeNonce(signature, ttlMs)` une fois la preuve de travail vérifiée, et avant de vérifier l'instrumentation. Stockez la signature si elle est nouvelle et renvoyez `true`. Renvoyez `false` si elle a déjà été utilisée. Une requête avec une preuve de travail incorrecte n'atteint jamais cet appel, elle ne peut donc pas consommer le défi d'un vrai visiteur. Une requête avec une preuve de travail valide mais un résultat d'instrumentation invalide le consomme. Un bot ne peut donc pas retenter la vérification d'instrumentation avec la même preuve de travail.

::: code-group

```js [Redis]
const consumeNonce = async (sig, ttlMs) =>
  (await redis.set(`cap:${sig}`, "1", "NX", "PX", ttlMs)) === "OK";
```

```js [Workers KV]
const consumeNonce = async (sig, ttlMs) => {
  if (await env.NONCES.get(`cap:${sig}`)) return false;
  await env.NONCES.put(`cap:${sig}`, "1", { expirationTtl: Math.max(60, Math.ceil(ttlMs / 1000)) });
  return true;
};
```

```js [Postgres]
const consumeNonce = async (sig, ttlMs) => {
  try {
    await sql`INSERT INTO cap_nonces (sig, expires_at) VALUES (${sig}, ${new Date(Date.now() + ttlMs)})`;
    return true;
  } catch (e) {
    if (e.code === "23505") return false;
    throw e;
  }
};
```

:::

Workers KV n'est pas atomique, donc deux requêtes simultanées peuvent toutes deux passer. Utilisez un Durable Object si cela compte pour vous.

## Instrumentation

`instrumentation: true` ajoute un [défi d'instrumentation](./instrumentation.md) aux défis au format 1. Avec le format 2, ajoutez `"instrumentation"` à `protocols`. Dans les deux cas, vous pouvez passer un objet à la place de `true` :

```js
instrumentation: {
  blockAutomatedBrowsers: true,
  obfuscationLevel: 3,
}
```

| Option | Valeur par défaut | Description |
| --- | --- | --- |
| `blockAutomatedBrowsers` | `false` | Fait échouer les résolutions de [navigateurs automatisés](./instrumentation.md#automated-browser-detection) avec `instr_automated_browser`. |
| `detectAutomatedInteractions` | `false` | Ajoute `interaction_synthetic_clicks` et `interaction_synthetic_keydowns` à `riskFlags`. Voir la [détection des interactions](./instrumentation.md#interaction-detection). |
| `blockAutomatedInteractions` | `false` | Fait échouer ces résolutions avec `instr_automated_interaction`. Active aussi la détection. |
| `noWasm` | `false` | À activer quand vous émettez du SHA-256 parce que le client dit ne pas pouvoir exécuter WebAssembly. Les résolutions échouent avec `instr_wasm_available` si WebAssembly compile dans le cadre de la vérification, et reçoivent sinon l'indicateur de risque `wasm_fallback`. |
| `obfuscationLevel` | `5` | De 1 à 10. Les niveaux 1 à 3 suppriment les espaces, les niveaux 4 à 7 encodent aussi les chaînes et minifient le script, et les niveaux 8 à 10 le font passer par `javascript-obfuscator` lorsque ce paquet est installé. Les niveaux élevés sont plus lents à générer. |

Les niveaux 8 à 10 nécessitent le paquet facultatif `javascript-obfuscator` et bloquent la boucle d'événements pendant des dizaines de millisecondes par défi. Réservez-les donc aux routes à faible trafic, ou générez les scripts dans un pool de workers avec `instrumentationGenerator`. Cette fonction reçoit les options d'instrumentation et doit renvoyer une promesse résolue avec le résultat de `generateInstrumentation`.

## Comportement et agents {#behavior-and-agents}

`behavior` active l'[évaluation du comportement](./instrumentation.md#behavior-scoring) et le [blocage des agents](./instrumentation.md#ai-agent-detection). Il ajoute un défi d'instrumentation si le défi n'en a pas, et la politique est signée dans le jeton du défi, donc le client ne peut pas la désactiver.

```js
await generateChallenge(SECRET, {
  format: 2,
  protocols: ["hashwx", "instrumentation"],
  behavior: { block: true, blockAgents: "identified" },
});
```

`behavior: true` évalue sans bloquer. L'objet accepte :

| Option | Valeur par défaut | Description |
| --- | --- | --- |
| `block` | `false` | Fait échouer les verdicts `automated` avec `behavior_automated`, et les verdicts `no_interaction` avec `behavior_no_interaction`. |
| `threshold` | `0.75` | Score de 0,1 à 1 à partir duquel le verdict devient `automated`. |
| `strict` | `false` | Lève le plafond de 0,6 pour les scores composés uniquement d'indicateurs faibles. |
| `requireInteraction` | `true` | Définissez-le sur `false` pour laisser passer `no_interaction` lorsque `block` est activé, pour les modes invisible et flottant. |
| `blockAgents` | `false` | `"identified"` fait échouer les agents détectés avec une confiance élevée, et `"all"` tous les agents détectés, avec `behavior_agent`. |
| `allowVerifiedAgents` | `false` | Laisse passer les agents ayant une signature Web Bot Auth vérifiée malgré `blockAgents`. |

Une résolution sans trace de comportement échoue toujours avec `behavior_missing`, quelle que soit la politique.

Pour utiliser les en-têtes de requête comme indices d'agent, passez la requête `/redeem` à `validateChallenge` :

```js
const result = await validateChallenge(SECRET, body, {
  consumeNonce,
  request: { method: req.method, url: fullUrl, headers: req.headers },
  verifyWebBotAuth: true,
});
```

`url` doit être l'URL complète, puisque Web Bot Auth la signe. Avec `verifyWebBotAuth: true`, une requête contenant un en-tête `Signature-Agent` est vérifiée auprès du répertoire de clés de l'agent, que `validateChallenge` récupère en HTTPS et met en cache pendant une heure. Il ne fait confiance qu'aux signataires connus de Cap et aux origines de `trustedSignatureAgents`. Passez `webBotAuthNonceCheck(nonce, ttlMs)` pour rejeter les signatures rejouées. Il fonctionne comme `consumeNonce`.

`behaviorReplayCheck(digest, ttlMs)` fonctionne de la même façon pour les traces de comportement. Renvoyez `true` si l'empreinte a déjà été vue, et la trace recevra `bh_replayed`. Seules les traces comptant au moins 8 mouvements du pointeur et pressions de touches ont une empreinte.

Avec le comportement activé, un résultat réussi contient `behavior: { score, verdict, flags, signals, agent }`. Sinon, `agent` est renvoyé au premier niveau dès qu'il existe des indices, à partir des marques dans la page et des en-têtes uniquement, et n'est jamais bloqué. Dans les deux cas, un agent détecté ajoute `agent:<name>` à `riskFlags`. `agent` ressemble à ceci :

```js
{
  detected: true,
  name: "claude-in-chrome",
  confidence: "high",
  verified: false,
  evidence: ["artifact:cic_active"],
}
```

## API

### `generateChallenge(secret, options?)`

| Option | Valeur par défaut | Description |
| --- | --- | --- |
| `challengeCount` | `50` | Puzzles SHA-256 par défi. |
| `challengeSize` | `32` | Longueur du sel en caractères hexadécimaux. |
| `challengeDifficulty` | `4` | Longueur requise du préfixe de hachage en caractères hexadécimaux. |
| `expiresMs` | `600_000` | Temps accordé au visiteur pour résoudre le défi. |
| `scope` | aucune | Chaîne liée au défi. La validation doit fournir la même. |
| `extra` | aucune | Données intégrées au JWT. Toute personne disposant du jeton peut les lire. |
| `instrumentation` | `false` | Voir l'[instrumentation](#instrumentation). |
| `instrumentationGenerator` | `generateInstrumentation` | Fonction asynchrone qui génère le script d'instrumentation. |
| `behavior` | `false` | Voir [Comportement et agents](#behavior-and-agents). |
| `format`, `protocols` | format 2 avec HashWX | Voir [HashWX](#format-2-hashwx). Passer `keypair` ou `rsw` sans `protocols` choisit le protocole RSW déprécié. |
| `hashwxDifficulty`, `hashwxChallengeCount`, `hashwxNoncesPerHash` | voir [HashWX](#format-2-hashwx) | Réglages HashWX pour le format 2. |
| `keypair`, `t`, `rsw` | aucune | Réglages du protocole RSW déprécié. |

Le format 1 renvoie `{ challenge, token, expires, instrumentation? }`, et le format 2 renvoie `{ token, format: 2, challenges, expires }`. Les deux ajoutent `behavior: true` lorsque l'évaluation du comportement est activée. Envoyez l'objet entier au widget.

### `validateChallenge(secret, body, options?)`

`body` est ce que le widget envoie à `/redeem`. Les options sont :

| Option | Valeur par défaut | Description |
| --- | --- | --- |
| `consumeNonce` | aucune | Voir la [prévention du rejeu](#replay-prevention). |
| `scope` | aucune | Doit correspondre à la portée du défi. |
| `tokenTtlMs` | `1_200_000` | Durée de validité du jeton du visiteur. |
| `signToken` | `id:secret` | Fonction qui reçoit `{ scope, expires, iat }` et renvoie votre propre jeton. `tokenKey` est omis. |
| `request` | aucune | La requête `/redeem` sous la forme `{ method, url, headers }`. Voir [Comportement et agents](#behavior-and-agents). |
| `verifyWebBotAuth` | `false` | Vérifie les signatures Web Bot Auth sur `request`. |
| `fetch` | `fetch` global | Sert à télécharger les répertoires de clés Web Bot Auth. |
| `trustedSignatureAgents` | aucune | Origines de signataires supplémentaires auxquelles faire confiance, comme `"https://agent.example.com"`. |
| `webBotAuthNonceCheck` | aucune | Rejette les signatures Web Bot Auth rejouées. |
| `behaviorReplayCheck` | aucune | Signale les traces de comportement rejouées. |

En cas de succès, elle renvoie `{ success: true, token, tokenKey, expires, scope, iat, riskFlags }`, ainsi que `behavior` ou `agent` comme décrit dans [Comportement et agents](#behavior-and-agents). `riskFlags` liste les signaux qui ne bloquent pas à eux seuls, comme `native_tamper` ou `legacy_widget`, afin que vous puissiez augmenter la difficulté pour ce visiteur. La page sur l'instrumentation liste les [indicateurs de vérification du navigateur](./instrumentation.md#automated-browser-detection) et les [indicateurs de comportement](./instrumentation.md#behavior-scoring).

En cas d'échec, elle renvoie `{ success: false, reason }`. Les échecs d'instrumentation contiennent aussi `instr_error: true`, `instr_automated_browser` et `instr_automated_interaction` contiennent une liste `blockedBy`, et les échecs de comportement contiennent `behavior`. Chaque `reason` figure dans le [tableau des codes d'erreur](./error-codes.md).

### Exports de bas niveau {#lower-level-exports}

capd et les tests les utilisent. Vous n'en avez besoin que pour construire votre propre chaîne de traitement.

| Export | Description |
| --- | --- |
| `generateInstrumentation(opts?)` | Génère un script d'instrumentation et les métadonnées pour le vérifier. |
| `verifyInstrumentationResult(meta, payload, now?)` | Vérifie un résultat à partir de ces métadonnées. Renvoie `{ valid, reason?, riskFlags?, blockedBy?, checks?, agent?, trace? }`. |
| `serializeBound(data)`, `canonicalize(value)` | Sérialisent les données collectées de la même façon que le script. |
| `boundValues(binding, serialized)` | Les nombres qu'un résultat doit contenir pour ces données. |
| `MAX_BOUND_DATA` | Longueur maximale acceptée des données sérialisées, 65 536 caractères. |
| `detectAutomation(vector)` | Exécute les vérifications de navigateur automatisé sur des données de navigateur que vous avez collectées vous-même. Renvoie `{ pass, checks, blockedBy, riskFlags }`. |
| `analyzeBehavior(trace, ctx?)` | Évalue une trace de comportement. `ctx` accepte `{ replayed, strict, threshold }`. Renvoie `{ score, verdict, flags, signals, digest }`. |
| `BEHAVIOR_WEIGHTS`, `DEFAULT_BEHAVIOR_THRESHOLD`, `WEAK_CAP` | Les poids des indicateurs, `0.75` et `0.6`. |
| `agentFromHeaders(headers)` | Indices d'agent tirés de `User-Agent`, `Signature-Agent` et `Sec-CH-UA-Platform`. |
| `agentFromTrace(trace)` | Indices d'agent tirés des temps de clic et de frappe d'une trace de comportement. Ne passez que des traces que `analyzeBehavior` n'a pas marquées `bh_malformed`. |
| `summarizeAgent(evidence, verification?)` | Combine les indices et un éventuel résultat de `verifyWebBotAuth` dans l'objet `agent`, ou renvoie `null` s'il n'y a aucun indice. |
| `verifyWebBotAuth(req, opts?)` | Vérifie une signature Web Bot Auth. Renvoie une promesse résolue avec `{ verified, agent?, origin?, keyid?, reason? }`. |
| `parseSignatureAgent(value)` | Analyse un en-tête `Signature-Agent` en entrées `{ label, url }`. |
| `hashwxReady()`, `setHashwxModule(module)` | Compilent le module HashWX à l'avance ou en fournissent un. Voir [HashWX](#format-2-hashwx). |
| `hashwxTarget(difficulty)`, `hashwxSeed(challenge, block)`, `hashwxHash(state, seed, nonce)` | Fonctions de base de HashWX. `state` provient de `hashwxReady()`. |
| `DEFAULT_HASHWX_DIFFICULTY`, `DEFAULT_HASHWX_CHALLENGE_COUNT`, `DEFAULT_HASHWX_NONCES_PER_HASH` | `1_000_000`, `4` et `65_536`. |
| `generateRswKeypair(bits?)`, `serializeRswKeypair(kp)`, `deserializeRswKeypair(s)`, `buildRswMinter(args, opts?)` | Clés et générateurs du protocole RSW déprécié. |

## Migration depuis `@cap.js/server` {#how-it-differs-from-cap-js-server}

`@cap.js/server` est l'ancienne bibliothèque, remplacée par celle-ci. Elle conservait les défis et les jetons dans un stockage que vous configuriez. `capjs-core` ne conserve rien. Les défis sont des JWT signés, la prévention du rejeu passe par `consumeNonce`, et vous stockez vous-même `tokenKey` comme décrit dans [Vérification des jetons](#verifying-tokens). Elle ne touche jamais au système de fichiers, donc elle fonctionne sur Workers et Lambda.
