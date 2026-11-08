---
outline: [2, 3]
description: "Le widget client de Cap demande, résout et affiche les défis de preuve de travail avec un composant web natif et du WASM. Installez-le, utilisez-le dans n'importe quel framework et personnalisez-le."
---

# Widget

Le widget est un composant web `<cap-widget>`. Il récupère un défi auprès de votre serveur, le résout dans des Web Workers avec WebAssembly et vous remet un jeton à vérifier.

## Installation {#install}

::: code-group

```sh [npm]
npm i cap-widget
```

```sh [pnpm]
pnpm add cap-widget
```

```sh [bun]
bun add cap-widget
```

```html [cdn]
<script src="https://cdn.jsdelivr.net/npm/cap-widget@<version>"></script>
```

:::

Épinglez une version de la [page des versions](https://github.com/tiagozip/cap/releases) lorsque vous utilisez le CDN. jsDelivr est bloqué dans certaines régions de Chine. Si vos visiteurs s'y trouvent, installez le paquet depuis npm ou [auto-hébergez le widget](#self-hosting-the-widget).

## Utilisation {#usage}

Faites pointer `data-cap-api-endpoint` vers votre serveur. Pour capd, il s'agit de `https://<instance>/<site-key>/`.

::: code-group

```html [HTML]
<cap-widget id="cap" data-cap-api-endpoint="https://cap.example.com/<site-key>/"></cap-widget>

<script>
  document.getElementById("cap").addEventListener("solve", (e) => {
    console.log(e.detail.token);
  });
</script>
```

```jsx [React]
import "cap-widget";

export default function Form() {
  return (
    <cap-widget
      data-cap-api-endpoint="https://cap.example.com/<site-key>/"
      onsolve={(e) => console.log(e.detail.token)}
    />
  );
}
```

```vue [Vue]
<script setup>
import "cap-widget";
</script>

<template>
  <cap-widget
    data-cap-api-endpoint="https://cap.example.com/<site-key>/"
    @solve="(e) => console.log(e.detail.token)"
  />
</template>
```

```svelte [Svelte]
<script>
  import "cap-widget";
</script>

<cap-widget
  data-cap-api-endpoint="https://cap.example.com/<site-key>/"
  onsolve={(e) => console.log(e.detail.token)}
></cap-widget>
```

```jsx [Solid]
import "cap-widget";

export default function Form() {
  return (
    <cap-widget
      data-cap-api-endpoint="https://cap.example.com/<site-key>/"
      on:solve={(e) => console.log(e.detail.token)}
    />
  );
}
```

```tsx [Qwik]
import { component$ } from "@builder.io/qwik";
import "cap-widget";

export default component$(() => (
  <cap-widget
    data-cap-api-endpoint="https://cap.example.com/<site-key>/"
    on:solve$={(e: CustomEvent) => console.log(e.detail.token)}
  />
));
```

```astro [Astro]
<cap-widget id="cap" data-cap-api-endpoint="https://cap.example.com/<site-key>/" />

<script>
  import "cap-widget";

  document.getElementById("cap").addEventListener("solve", (e) => {
    console.log(e.detail.token);
  });
</script>
```

:::

Quelques remarques sur les frameworks :

- React gère correctement les événements des éléments personnalisés à partir de la version 19. Preact utilise la même syntaxe.
- Vue peut signaler un composant inconnu. Indiquez à son compilateur que les balises `cap-` sont des éléments personnalisés :

  ```js
  vue({ template: { compilerOptions: { isCustomElement: (tag) => tag.startsWith("cap-") } } })
  ```

- L'exemple Svelte utilise Svelte 5. Avec Svelte 4, utilisez `on:solve`.

### Dans un formulaire {#in-a-form}

Dans un `<form>`, le widget ajoute un champ caché `cap-token` une fois le défi résolu, donc le jeton est soumis avec les autres champs. Ajoutez `required` pour empêcher l'envoi du formulaire avant la résolution.

```html
<form action="/submit" method="POST">
  <cap-widget required data-cap-api-endpoint="https://cap.example.com/<site-key>/"></cap-widget>
  <button type="submit">Submit</button>
</form>
```

Pour résoudre sans afficher de widget, utilisez le [mode invisible](./invisible.md). Pour ne l'afficher qu'à l'appui sur un bouton, utilisez le [mode flottant](./floating.md).

## Quand le widget récupère et résout les défis {#when-it-fetches-and-solves}

Le widget n'attend pas un clic pour commencer à travailler. Dès qu'il est visible sur la page, il récupère un défi et lance l'iframe d'[instrumentation](./instrumentation.md), qui observe la page jusqu'à la fin de la résolution. Il récupère un nouveau défi un peu avant l'expiration du précédent, d'après la durée de vie indiquée dans son jeton. Pour un défi de 10 minutes, cela se produit 90 secondes avant l'expiration pour SHA-256 et 3 minutes avant pour HashWX.

Le premier mouvement de souris, toucher ou appui sur une touche dans la page lance une résolution anticipée. Pour un défi au [format 2](./capjs-core.md#format-2-hashwx), utilisé par HashWX, le widget télécharge seulement le module HashWX à l'avance. Pour un défi SHA-256 au format 1, il attend 2,5 secondes puis résout dans un seul worker. Un clic sur le widget répartit le reste de la résolution sur tous ses workers. Lorsque la clé n'a pas besoin de données d'interaction, le widget échange aussi la solution en arrière-plan et conserve le jeton, donc le clic sur le widget renvoie immédiatement le résultat. Lorsque la clé vérifie les interactions ou évalue le comportement, il attend le clic pour échanger la solution, car le clic fait partie de ce que le serveur vérifie. Si le serveur a rejeté un échange en arrière-plan, le clic affiche cette erreur.

## Événements {#events}

Chaque événement est un `CustomEvent`.

| Événement | Quand il se déclenche | `detail` |
| --- | --- | --- |
| `solve` | Le défi est résolu | `{ token }` |
| `progress` | La résolution progresse | `{ progress }`, de 0 à 100 |
| `error` | Un échec survient | `{ isCap, code, message }`. Les codes figurent dans le [dépannage](./error-codes.md). |
| `reset` | Le widget se réinitialise | `{}` |

## Attributs {#attributes}

| Attribut | Description |
| --- | --- |
| `data-cap-api-endpoint` | Le point d'accès de votre serveur. Obligatoire. |
| `data-cap-worker-count` | Nombre de workers de résolution. Par défaut, le nombre de cœurs du CPU, ou 8. |
| `data-cap-hidden-field-name` | Nom du champ caché du formulaire. Valeur par défaut : `cap-token`. |
| `data-cap-lang` | Impose une [langue](#languages). |
| `data-cap-troubleshooting-url` | Cible du lien de dépannage lorsqu'un visiteur est bloqué. |
| `data-cap-disable-haptics` | Désactive les vibrations sur téléphone. |
| `required` | Bloque l'envoi du formulaire jusqu'à la résolution du widget. |

## Langues {#languages}

Le widget suit la langue du navigateur pour l'arabe, le chinois simplifié, le français, l'allemand, l'hindi, le japonais, le portugais, le russe et l'espagnol, et utilise l'anglais sinon. Définissez `data-cap-lang="de"` sur un widget, ou `window.CAP_LANG = "de"` pour toute la page, pour choisir vous-même la langue.

Pour changer un libellé, définissez son attribut `data-cap-i18n-*` :

```html
<cap-widget
  data-cap-api-endpoint="https://cap.example.com/<site-key>/"
  data-cap-i18n-initial-state="I'm not a robot"
  data-cap-i18n-solved-label="Done"
></cap-widget>
```

Les clés sont `initial-state`, `verifying-label`, `solved-label`, `error-label`, `csp-error-label`, `required-label`, `troubleshooting-label`, `wasm-disabled`, ainsi que les libellés pour lecteurs d'écran `group-aria-label`, `verify-aria-label`, `verifying-aria-label`, `verified-aria-label` et `error-aria-label`.

## Personnalisation du style {#styling}

Redéfinissez ces variables CSS sur `cap-widget`. Les valeurs affichées sont celles par défaut.

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

## Options pour toute la page {#options}

Définissez-les sur `window` avant le chargement du widget.

| Option | Description |
| --- | --- |
| `CAP_CUSTOM_FETCH` | Remplace `fetch` pour les requêtes du widget. |
| `CAP_CSS_NONCE` | Nonce de la balise `<style>` injectée, pour une Content Security Policy stricte. Sert aussi pour les scripts si `CAP_SCRIPT_NONCE` n'est pas défini. |
| `CAP_SCRIPT_NONCE` | Nonce des scripts injectés : le repli de décompression et l'iframe d'instrumentation. |
| `CAP_ISOLATE` | Exécute l'iframe d'instrumentation sans l'origine de votre page. Voir [Pages avec une faille d'injection HTML](#pages-with-an-html-injection-bug). |
| `CAP_PAKO_URL` | URL de `pako_inflate.min.js`, que le widget charge uniquement dans les navigateurs sans `DecompressionStream`. |
| `CAP_CUSTOM_WASM_URL` | URL de `cap_wasm_bg.wasm`. |
| `CAP_CUSTOM_HASHWX_URL` | URL de `hashwx.wasm`. |
| `CAP_LANG` | Impose une [langue](#languages) sur chaque widget. |
| `CAP_DISABLE_HAPTICS` | Désactive les vibrations sur chaque widget. |
| `CAP_DISABLE_WIDGET_REF` | Omet l'adresse de votre page dans le lien de crédit Cap du widget. |
| `CAP_DEBUG` | Journalise chaque étape de récupération et de résolution dans la console. |
| `CAP_SILENT` | Désactive toute sortie du widget dans la console. |

## Content Security Policy

Le widget fonctionne sous une Content Security Policy stricte. Il a besoin des sources suivantes :

| Directive | Source | Raison |
| --- | --- | --- |
| `script-src` | `'nonce-...'` ou l'hôte du widget | Charge le script du widget. |
| `script-src` | `'wasm-unsafe-eval'` | Compile le solveur WebAssembly. |
| `worker-src` | `blob:` | Exécute le solveur dans des Web Workers créés à partir d'une URL de blob. |
| `connect-src` | votre serveur Cap, et `cdn.jsdelivr.net` sauf en cas d'[auto-hébergement](#self-hosting-the-widget) | Récupère les défis, les échange et télécharge les fichiers WASM. |
| `style-src` | `'nonce-...'` | Autorise la balise `<style>` injectée par le widget. Définissez `CAP_CSS_NONCE`. |

Le script d'[instrumentation](./instrumentation.md) s'exécute dans une iframe `srcdoc`, qui hérite de la politique de la page. Le widget ajoute un nonce à ce script, ainsi qu'au script de repli pako dans les anciens navigateurs, uniquement si vous définissez `window.CAP_SCRIPT_NONCE` sur le nonce de votre `script-src` avant le chargement du widget. Sans cela, le navigateur bloque le script, et la résolution échoue 250 ms après le chargement de l'iframe. Le widget affiche "Blocked by this page", émet un événement `error` avec le code `instr_csp_blocked` et journalise dans la console une erreur qui renvoie ici. Le serveur enregistre l'échec sous le même code. Si vous chargez pako ailleurs que sur jsDelivr, définissez `CAP_PAKO_URL` et autorisez cet hôte dans `script-src`.

```html
<script nonce="r4nd0m">
  window.CAP_SCRIPT_NONCE = "r4nd0m";
  window.CAP_CSS_NONCE = "r4nd0m";
</script>
<script nonce="r4nd0m" src="https://cdn.jsdelivr.net/npm/cap-widget@<version>"></script>
```

```
Content-Security-Policy: script-src 'nonce-r4nd0m' 'wasm-unsafe-eval'; worker-src blob:; style-src 'nonce-r4nd0m'; connect-src 'self' https://cdn.jsdelivr.net
```

Générez un nouveau nonce pour chaque réponse. Si vous servez le widget depuis le `/assets` de capd, autorisez votre serveur Cap dans `script-src` et `connect-src` et retirez jsDelivr.

Vous n'avez pas besoin de `'unsafe-eval'`. Certaines vérifications d'instrumentation utilisent `eval` et `new Function`. Lorsque les deux lèvent une `EvalError`, le script ignore ces vérifications, exécute les autres, et le serveur ajoute `csp_eval_blocked` à `riskFlags`. Si une seule des deux lève une erreur, le script considère cela comme une altération et échoue avec `instr_natives_tampered`. Le script note aussi si le navigateur a émis un événement `securitypolicyviolation` pour l'`eval` bloqué, et ignore les événements dont `isTrusted` vaut `false`, donc un script de la page ne peut pas falsifier cette confirmation. Cet indicateur est informatif et ne compte jamais en faveur du visiteur.

Les widgets antérieurs à cette version continuent de fonctionner avec un nouveau serveur, avec les limites décrites dans [Widgets de versions antérieures](./instrumentation.md#widgets-from-earlier-releases).

### Pages avec une faille d'injection HTML {#pages-with-an-html-injection-bug}

L'iframe d'instrumentation partage l'origine de votre page, et dès que vous définissez `CAP_SCRIPT_NONCE`, le widget transmet votre nonce au script de l'iframe. Le widget exécute tout script envoyé par le serveur indiqué dans `data-cap-api-endpoint`. Si un attaquant peut injecter du HTML dans une page qui définit `CAP_SCRIPT_NONCE`, il peut ajouter un `<cap-widget>` pointant vers son propre serveur. Le script de ce serveur s'exécute alors avec l'origine de votre page et passe votre politique. Sur cette page, une faille que votre politique aurait autrement contenue devient une faille de cross-site scripting.

Cela ne concerne que les pages qui s'appuient sur une politique fondée sur un nonce pour contenir les injections HTML. Sans une telle politique, le HTML injecté peut déjà exécuter des scripts, et le widget n'y change rien.

Sur ces pages, définissez `window.CAP_ISOLATE = true` dans un script avant le chargement du widget :

```html
<script nonce="r4nd0m">
  window.CAP_SCRIPT_NONCE = "r4nd0m";
  window.CAP_ISOLATE = true;
</script>
```

Le widget exécute alors l'iframe sans `allow-same-origin`. Son script reçoit donc une origine opaque et ne peut ni lire ni modifier votre page, vos cookies ou votre stockage, quel que soit le serveur qui l'a envoyé. Cette option doit être définie en JavaScript, car le HTML injecté ne peut pas en exécuter et un attribut du widget serait sous le contrôle de l'attaquant.

La vérification renonce aux données qu'elle lit dans la page. Elle exécute toujours les [vérifications de navigateur automatisé](./instrumentation.md#automated-browser-detection) dans sa propre iframe, mais ne peut pas enregistrer les interactions, une trace de comportement ou les marques d'agents IA. Le serveur accepte ces résolutions avec l'indicateur de risque `isolated_frame` pour les clés qui se limitent à signaler ces informations. Il les rejette avec `instr_isolated` pour les clés qui bloquent les interactions automatisées, évaluent le comportement en mode bloquant ou bloquent les agents.

## Auto-hébergement du widget {#self-hosting-the-widget}

Par défaut, le widget se charge depuis jsDelivr, tout comme les deux fichiers WASM récupérés par son solveur. Pour tout servir depuis votre propre domaine :

1. Servez le script vous-même, soit en important `cap-widget` via votre bundler, soit depuis le [serveur d'assets](./capd/options.md#asset-server) de capd à `/assets/widget.js`.
2. Faites pointer le solveur vers vos copies des fichiers WASM avant toute résolution du widget :

```html
<script>
  window.CAP_CUSTOM_WASM_URL = "https://cap.example.com/assets/cap_wasm_bg.wasm";
  window.CAP_CUSTOM_HASHWX_URL = "https://cap.example.com/assets/hashwx.wasm";
</script>
<script src="https://cap.example.com/assets/widget.js"></script>
```

Avec un bundler, définissez les deux variables globales avant l'exécution de `import "cap-widget"`. Les URL peuvent pointer vers n'importe quel emplacement où vous hébergez les fichiers.
