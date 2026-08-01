---
outline: [2, 3, 4]
description: "Le widget client de Cap demande, résout et affiche les défis de preuve de travail avec un composant web natif et du WASM. Documentation côté client du CAPTCHA open source."
---

# Widget

Le widget côté client de Cap se charge de demander, résoudre et afficher les défis à l'aide d'un composant web natif et de WASM écrit en Rust. Il inclut également le [mode programmatique](./programmatic).

## Installation

::: code-group

```sh [pnpm]
pnpm add cap-widget
```

```sh [npm]
npm i cap-widget
```

```sh [bun]
bun add cap-widget
```

```html [cdn]
<!--

* En production, épinglez une version précise pour éviter les changements cassants. Vous pouvez aussi utiliser le serveur d'assets de l'instance standalone.
* `cdn.jsdelivr.net` est bloqué dans certaines juridictions, comme certaines régions de Chine. Si votre site doit y rester accessible, nous recommandons npm.

-->

<script type="module" src="https://cdn.jsdelivr.net/npm/cap-widget"></script>
```

:::

## Utilisation {#usage}

Le widget requiert un `data-cap-api-endpoint` pointant vers votre déploiement Cap. Pour les instances standalone, il s'agit de :

```
https://<your-instance>/<site-key>/
```

### Vanilla

```html
<form>
  <cap-widget id="cap" required data-cap-api-endpoint="https://<your-instance>/<site-key>/"></cap-widget>
  <button type="submit">Envoyer</button>
</form>

<script type="module">
  import "https://cdn.jsdelivr.net/npm/cap-widget";

  document.getElementById("cap").addEventListener("solve", (e) => {
    console.log("token:", e.detail.token);
  });
</script>
```

::: tip

Lorsque le widget se trouve dans un `<form>`, il injecte automatiquement un champ caché `cap-token`, et le jeton est envoyé avec vos autres champs sans aucun JavaScript supplémentaire.

:::

### React

```jsx
import "cap-widget";

export default function ContactForm() {
  return (
    <form>
      <cap-widget
        data-cap-api-endpoint="https://<your-instance>/<site-key>/"
        onsolve={(e) => console.log("token:", e.detail.token)}
        onprogress={(e) => console.log(e.detail.progress)}
        onerror={(e) => console.error(e.detail.message)}
      />
      <button type="submit">Envoyer</button>
    </form>
  );
}
```

::: tip

Nous recommandons React 19 ou une version ultérieure, qui améliore la gestion des événements des éléments personnalisés.

:::

### Vue

```vue
<script setup>
import "cap-widget";
</script>

<template>
  <form>
    <cap-widget
      data-cap-api-endpoint="https://<your-instance>/<site-key>/"
      @solve="(e) => console.log('token:', e.detail.token)"
      @progress="(e) => console.log(e.detail.progress)"
      @error="(e) => console.error(e.detail.message)"
    />
    <button type="submit">Envoyer</button>
  </form>
</template>
```

Si vous obtenez un avertissement de composant inconnu, ajoutez ceci à votre `vite.config.js` :

```js
export default defineConfig({
  plugins: [
    vue({
      template: {
        compilerOptions: { isCustomElement: (tag) => tag.startsWith("cap-") },
      },
    }),
  ],
});
```

### Svelte 5

```svelte
<script>
  import "cap-widget";
</script>

<form>
  <cap-widget
    data-cap-api-endpoint="https://<your-instance>/<site-key>/"
    on:solve={(e) => console.log("token:", e.detail.token)}
    on:progress={(e) => console.log(e.detail.progress)}
    on:error={(e) => console.error(e.detail.message)}
  />
  <button type="submit">Envoyer</button>
</form>
```

### SolidJS

```jsx
import "cap-widget";

export default function ContactForm() {
  return (
    <form>
      <cap-widget
        data-cap-api-endpoint="https://<your-instance>/<site-key>/"
        on:solve={(e) => console.log("token:", e.detail.token)}
        on:progress={(e) => console.log(e.detail.progress)}
        on:error={(e) => console.error(e.detail.message)}
      />
      <button type="submit">Envoyer</button>
    </form>
  );
}
```

### Astro

```astro
---
// ContactForm.astro
---

<form>
  <cap-widget id="cap" data-cap-api-endpoint="https://<your-instance>/<site-key>/" />
  <button type="submit">Envoyer</button>
</form>

<script>
  import "cap-widget";

  document.getElementById("cap").addEventListener("solve", (e) => {
    console.log("token:", e.detail.token);
  });
</script>
```

Si vous affichez un composant React/Vue/Svelte dans Astro, suivez le guide du framework correspondant ci-dessus et ajoutez `client:load` au composant.

### Preact

```jsx
import "cap-widget";

export default function ContactForm() {
  return (
    <form>
      <cap-widget
        data-cap-api-endpoint="https://<your-instance>/<site-key>/"
        onsolve={(e) => console.log("token:", e.detail.token)}
        onprogress={(e) => console.log(e.detail.progress)}
        onerror={(e) => console.error(e.detail.message)}
      />
      <button type="submit">Envoyer</button>
    </form>
  );
}
```

### Qwik

```tsx
import { component$ } from "@builder.io/qwik";
import "cap-widget";

export default component$(() => {
  return (
    <form>
      <cap-widget
        data-cap-api-endpoint="https://<your-instance>/<site-key>/"
        on:solve$={(e: CustomEvent) => console.log("token:", e.detail.token)}
        on:progress$={(e: CustomEvent) => console.log(e.detail.progress)}
        on:error$={(e: CustomEvent) => console.error(e.detail.message)}
      />
      <button type="submit">Envoyer</button>
    </form>
  );
});
```

## Mode programmatique

Si vous ne voulez pas de widget visible, par exemple pour protéger une action d'arrière-plan comme la publication d'un message, utilisez le [mode programmatique](./programmatic) :

```js
import Cap from "cap-widget";

const cap = new Cap({
  apiEndpoint: "https://<your-instance>/<site-key>/",
});

const { token } = await cap.solve();
```

## Événements pris en charge {#supported-events}

Tous les événements sont émis sous forme de CustomEvent.

| Événement  | Quand il se déclenche                    | Détail                 |
| ---------- | ---------------------------------------- | ---------------------- |
| `solve`    | Défi résolu avec succès                  | `{ token: string }`    |
| `progress` | Mise à jour de progression pendant la résolution | `{ progress: number }` |
| `error`    | Une erreur s'est produite                | `{ message: string }`  |
| `reset`    | Widget remis à son état initial          | `{}`                   |

## Options {#options}

Vous pouvez aussi indiquer une fonction fetch personnalisée avec `window.CAP_CUSTOM_FETCH` :

```js
window.CAP_CUSTOM_FETCH = (url, params) => fetch(url, params);
```

Si vous servez le widget sous une Content-Security-Policy stricte, vous pouvez fournir des nonces pour que les éléments `<style>` et `<script>` injectés par le widget ne soient pas bloqués :

- `window.CAP_CSS_NONCE` — appliqué à la balise `<style>` du widget. Sert aussi de nonce de repli pour les scripts injectés si `CAP_SCRIPT_NONCE` n'est pas défini.
- `window.CAP_SCRIPT_NONCE` — appliqué aux scripts injectés par le widget : le repli de décompression pako et l'iframe du défi d'instrumentation.

Vous pouvez également définir une URL WASM personnalisée (celle du serveur d'assets standalone, par exemple) avec `window.CAP_CUSTOM_WASM_URL`.

Pour désactiver le retour haptique (vibrations sur mobile), définissez `window.CAP_DISABLE_HAPTICS = true` globalement, ou ajoutez l'attribut `data-cap-disable-haptics` sur des widgets particuliers :

```js
window.CAP_DISABLE_HAPTICS = true;
```

```html
<cap-widget data-cap-disable-haptics data-cap-api-endpoint="..."></cap-widget>
```

Le retour haptique est automatiquement désactivé en [mode programmatique](./programmatic), puisqu'aucun widget visible n'est proposé à l'utilisateur.

### Attributs

| Attribut                       | Description                                                                   |
| ------------------------------ | ----------------------------------------------------------------------------- |
| `data-cap-api-endpoint`        | **Obligatoire.** Votre point d'accès Cap : `https://<instance>/<site-key>/`   |
| `data-cap-worker-count`        | Nombre de workers de résolution (par défaut `navigator.hardwareConcurrency \|\| 8`) |
| `data-cap-hidden-field-name`   | Nom du champ caché du jeton dans un `<form>` (par défaut : `cap-token`)       |
| `data-cap-troubleshooting-url` | URL personnalisée du lien « Dépannage » affiché quand un utilisateur est bloqué |
| `data-cap-disable-haptics`     | Désactiver le retour haptique (vibrations) sur ce widget                       |

#### i18n

Tous les libellés du widget peuvent être remplacés avec les attributs `data-cap-i18n-*`. Ils sont en anglais par défaut.

```html
<cap-widget
  data-cap-api-endpoint="https://<your-instance>/<site-key>/"
  data-cap-i18n-initial-state="Confirmez que vous êtes humain"
  data-cap-i18n-verifying-label="Vérification..."
  data-cap-i18n-solved-label="Vous êtes humain"
  data-cap-i18n-error-label="Erreur"
  data-cap-i18n-troubleshooting-label="Dépannage"
  data-cap-i18n-wasm-disabled="Activez WASM pour une résolution nettement plus rapide"
  data-cap-i18n-verify-aria-label="Cliquez pour confirmer que vous êtes humain"
  data-cap-i18n-verifying-aria-label="Vérification en cours, veuillez patienter"
  data-cap-i18n-verified-aria-label="Vérifié"
  data-cap-i18n-required-label="Veuillez confirmer que vous êtes humain"
  data-cap-i18n-error-aria-label="Une erreur s'est produite, veuillez réessayer"
></cap-widget>
```

### Personnalisation du style

Redéfinissez n'importe laquelle de ces variables CSS sur l'élément `cap-widget` :

```css
cap-widget {
  --cap-background: #fdfdfd;
  --cap-border-color: #dddddd8f;
  --cap-border-radius: 14px;
  --cap-widget-height: 30px;
  --cap-widget-width: 230px;
  --cap-widget-padding: 14px;
  --cap-gap: 15px;
  --cap-color: #212121;
  --cap-checkbox-size: 25px;
  --cap-checkbox-border: 1px solid #aaaaaad1;
  --cap-checkbox-border-radius: 6px;
  --cap-checkbox-background: #fafafa91;
  --cap-checkbox-margin: 2px;
  --cap-font: system-ui, -apple-system, sans-serif;
  --cap-spinner-color: #000;
  --cap-spinner-background-color: #eee;
  --cap-spinner-thickness: 5px;
}
```
