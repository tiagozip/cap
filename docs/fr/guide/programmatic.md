---
description: "Mode programmatique de Cap : appelez new Cap() et solve() pour exécuter le CAPTCHA open source depuis votre propre JavaScript, avec preuve de travail et sans widget visible."
---

# Mode programmatique

Vous pouvez utiliser `new Cap({ ... })` dans votre JavaScript côté client pour créer une instance de Cap, puis la méthode `solve()` pour résoudre le défi.

```js
const cap = new Cap({
  apiEndpoint: "https://<your-instance>/<site-key>/",
  // ou : apiEndpoint: "/api/",
});
const solution = await cap.solve();

console.log(solution.token);
```

Vous pouvez aussi mettre en place des [écouteurs d'événements](widget.md#evenements-pris-en-charge) :

```js
const cap = new Cap({
  apiEndpoint: "https://<your-instance>/<site-key>/",
  // ou : apiEndpoint: "/api/",
});

cap.addEventListener("progress", (event) => {
  console.log(`Résolution... ${event.detail.progress}% terminé`);
});
```

En coulisses, Cap crée un élément `cap-widget` masqué et s'en sert pour résoudre le défi.

## Méthodes et arguments pris en charge

Les méthodes suivantes sont disponibles :

#### `new Cap({ ... })`

Crée une instance de Cap. Si un second argument est fourni, Cap utilisera cet élément au lieu d'en créer un nouveau en mémoire.

**Arguments**

```json
{
  apiEndpoint: ..., // point d'accès API, équivalent à l'attribut `data-cap-api-endpoint` du widget
  workers: navigator.hardwareConcurrency || 8 // nombre de threads de travail à utiliser
}
```

#### `cap.solve()`

Demande un défi et le résout.

**Sortie :** `{ token }`

#### `cap.token`

Renvoie le jeton de la dernière résolution.

#### `cap.reset()`

Réinitialise `cap.token`.

#### `cap.addEventListener(..., function () { ... })`

Écoute un événement du widget Cap. Voir les [événements pris en charge](widget.md#evenements-pris-en-charge).
