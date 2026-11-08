---
description: "Mode invisible de Cap : appelez new Cap() et solve() pour exécuter le CAPTCHA open source depuis votre propre JavaScript, avec preuve de travail et sans widget visible."
---

# Mode invisible

Le mode invisible résout un défi depuis votre propre code, sans rien afficher sur la page. Il convient aux actions sans formulaire, comme un bouton J'aime ou une requête en arrière-plan.

```js
import Cap from "cap-widget";

const cap = new Cap({ apiEndpoint: "https://cap.example.com/<site-key>/" });
const { token } = await cap.solve();
```

Avec le script du CDN, `Cap` est une variable globale et n'a pas besoin d'import.

## API

### `new Cap(config, element?)`

`config.apiEndpoint` est obligatoire, sauf si vous définissez [`CAP_CUSTOM_FETCH`](./widget.md#options). Toute autre clé devient un attribut du widget, donc les [attributs du widget](./widget.md#attributes) fonctionnent aussi ici :

```js
const cap = new Cap({
  apiEndpoint: "https://cap.example.com/<site-key>/",
  "data-cap-worker-count": "4",
});
```

Sans `element`, Cap crée un `<cap-widget>` masqué avec le retour haptique désactivé. Un widget masqué ne récupère ni ne résout rien à l'avance. Tout le travail a donc lieu quand vous appelez `solve()`. Passez un widget existant pour piloter celui-ci.

### `cap.solve()`

Demande un défi et le résout. La promesse renvoie `{ success, token }`.

Un échec émet un événement `error` et rejette la promesse avec une `Error` dont le `code` est l'un des [codes d'erreur](./troubleshooting/instrumentation.md#error-codes), par exemple `instr_csp_blocked` pour une [iframe bloquée](./widget.md#content-security-policy) :

```js
try {
  const { token } = await cap.solve();
} catch (err) {
  console.error(err.code, err.message);
}
```

Un appel effectué pendant une résolution en cours renvoie une promesse résolue avec `undefined`.

### `cap.token`

Le jeton de la dernière résolution, ou `null`.

### `cap.reset()`

Efface le jeton.

### `cap.addEventListener(type, listener)`

Écoute les [événements](./widget.md#events) du widget :

```js
cap.addEventListener("progress", (e) => {
  console.log(`${e.detail.progress}%`);
});
```

## Clés avec évaluation du comportement {#keys-with-behavior-scoring}

Les résolutions invisibles n'ont pas de clic sur un widget. Avec les clés qui [évaluent le comportement](./instrumentation.md#behavior-scoring), leur verdict est `no_interaction`. Elles échouent donc avec les clés qui bloquent et exigent une interaction. Dans la bibliothèque core, définissez `requireInteraction: false` dans la politique `behavior` de ces routes.
