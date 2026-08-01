---
outline: [2, 3, 4]
description: "Caps Client-Widget fordert Proof-of-Work-Challenges an, löst sie und stellt sie dar, mit einer nativen Web Component und WASM. Client-Doku für das quelloffene CAPTCHA."
---

# Widget

Caps clientseitiges Widget übernimmt das Anfordern, Lösen und Darstellen von Challenges mithilfe einer nativen Web Component und Rust-basiertem WASM. Es enthält außerdem den [programmatischen Modus](./programmatic).

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

* In der Produktion solltest du eine bestimmte Version pinnen, um Breaking Changes zu vermeiden. Alternativ kannst du auch den Asset-Server der Standalone-Instanz nutzen.
* `cdn.jsdelivr.net` ist in manchen Rechtsräumen blockiert, etwa in Teilen Chinas. Wenn deine Website von dort erreichbar sein muss, empfehlen wir npm.

-->

<script type="module" src="https://cdn.jsdelivr.net/npm/cap-widget"></script>
```

:::

## Verwendung {#usage}

Das Widget benötigt ein `data-cap-api-endpoint`, das auf dein Cap-Deployment zeigt. Bei Standalone-Instanzen ist das:

```
https://<your-instance>/<site-key>/
```

### Vanilla

```html
<form>
  <cap-widget id="cap" required data-cap-api-endpoint="https://<your-instance>/<site-key>/"></cap-widget>
  <button type="submit">Absenden</button>
</form>

<script type="module">
  import "https://cdn.jsdelivr.net/npm/cap-widget";

  document.getElementById("cap").addEventListener("solve", (e) => {
    console.log("token:", e.detail.token);
  });
</script>
```

::: tip

Liegt das Widget in einem `<form>`, fügt es automatisch ein verstecktes `cap-token`-Input ein, und das Token wird ohne zusätzliches JavaScript zusammen mit deinen anderen Feldern übermittelt.

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
      <button type="submit">Absenden</button>
    </form>
  );
}
```

::: tip

Wir empfehlen React 19 oder neuer, da dort die Event-Behandlung für Custom Elements verbessert wurde.

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
    <button type="submit">Absenden</button>
  </form>
</template>
```

Wenn du eine Warnung wegen einer unbekannten Komponente bekommst, ergänze das in deiner `vite.config.js`:

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
  <button type="submit">Absenden</button>
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
      <button type="submit">Absenden</button>
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
  <button type="submit">Absenden</button>
</form>

<script>
  import "cap-widget";

  document.getElementById("cap").addEventListener("solve", (e) => {
    console.log("token:", e.detail.token);
  });
</script>
```

Wenn du eine React-/Vue-/Svelte-Komponente in Astro renderst, folge dem jeweiligen Framework-Abschnitt oben und ergänze `client:load` an der Komponente.

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
      <button type="submit">Absenden</button>
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
      <button type="submit">Absenden</button>
    </form>
  );
});
```

## Programmatischer Modus

Wenn du kein sichtbares Widget möchtest, etwa beim Absichern einer Hintergrundaktion wie dem Absenden eines Beitrags, nutze den [programmatischen Modus](./programmatic):

```js
import Cap from "cap-widget";

const cap = new Cap({
  apiEndpoint: "https://<your-instance>/<site-key>/",
});

const { token } = await cap.solve();
```

## Unterstützte Events {#supported-events}

Alle Events werden als CustomEvent ausgelöst.

| Event      | Wann es ausgelöst wird              | Detail                 |
| ---------- | ----------------------------------- | ---------------------- |
| `solve`    | Challenge erfolgreich gelöst        | `{ token: string }`    |
| `progress` | Fortschrittsmeldung während des Lösens | `{ progress: number }` |
| `error`    | Ein Fehler ist aufgetreten          | `{ message: string }`  |
| `reset`    | Widget auf den Ausgangszustand zurückgesetzt | `{}`          |

## Optionen {#options}

Mit `window.CAP_CUSTOM_FETCH` kannst du eine eigene Fetch-Funktion angeben:

```js
window.CAP_CUSTOM_FETCH = (url, params) => fetch(url, params);
```

Wenn du das Widget unter einer strikten Content-Security-Policy auslieferst, kannst du Nonces bereitstellen, damit die vom Widget eingefügten `<style>`- und `<script>`-Elemente nicht blockiert werden:

- `window.CAP_CSS_NONCE` — wird auf den `<style>`-Tag des Widgets angewendet. Dient außerdem als Fallback-Nonce für eingefügte Skripte, falls `CAP_SCRIPT_NONCE` nicht gesetzt ist.
- `window.CAP_SCRIPT_NONCE` — wird auf die Skripte angewendet, die das Widget einfügt: den pako-Dekomprimierungs-Fallback und das Iframe für die Instrumentation-Challenge.

Mit `window.CAP_CUSTOM_WASM_URL` kannst du außerdem eine eigene WASM-URL setzen (etwa die des Standalone-Asset-Servers).

Um haptisches Feedback (Vibration auf Mobilgeräten) abzuschalten, setze global `window.CAP_DISABLE_HAPTICS = true` oder ergänze das Attribut `data-cap-disable-haptics` an einzelnen Widgets:

```js
window.CAP_DISABLE_HAPTICS = true;
```

```html
<cap-widget data-cap-disable-haptics data-cap-api-endpoint="..."></cap-widget>
```

Im [programmatischen Modus](./programmatic) ist haptisches Feedback automatisch deaktiviert, da es kein sichtbares Widget gibt, mit dem der Nutzer interagieren könnte.

### Attribute

| Attribut                       | Beschreibung                                                                  |
| ------------------------------ | ----------------------------------------------------------------------------- |
| `data-cap-api-endpoint`        | **Erforderlich.** Dein Cap-Endpunkt: `https://<instance>/<site-key>/`         |
| `data-cap-worker-count`        | Anzahl der Solver-Worker (Standard: `navigator.hardwareConcurrency \|\| 8`)   |
| `data-cap-hidden-field-name`   | Name des versteckten Token-Inputs in einem `<form>` (Standard: `cap-token`)   |
| `data-cap-troubleshooting-url` | Eigene URL für den Link "Fehlerbehebung", der blockierten Nutzern gezeigt wird |
| `data-cap-disable-haptics`     | Haptisches Feedback (Vibration) für dieses Widget deaktivieren                 |

#### i18n

Alle Widget-Beschriftungen lassen sich mit `data-cap-i18n-*`-Attributen überschreiben. Standard ist Englisch.

```html
<cap-widget
  data-cap-api-endpoint="https://<your-instance>/<site-key>/"
  data-cap-i18n-initial-state="Bestätige, dass du ein Mensch bist"
  data-cap-i18n-verifying-label="Wird geprüft..."
  data-cap-i18n-solved-label="Du bist ein Mensch"
  data-cap-i18n-error-label="Fehler"
  data-cap-i18n-troubleshooting-label="Fehlerbehebung"
  data-cap-i18n-wasm-disabled="Aktiviere WASM für deutlich schnelleres Lösen"
  data-cap-i18n-verify-aria-label="Klicken, um zu bestätigen, dass du ein Mensch bist"
  data-cap-i18n-verifying-aria-label="Wird geprüft, bitte warten"
  data-cap-i18n-verified-aria-label="Bestätigt"
  data-cap-i18n-required-label="Bitte bestätige, dass du ein Mensch bist"
  data-cap-i18n-error-aria-label="Ein Fehler ist aufgetreten, bitte versuche es erneut"
></cap-widget>
```

### Styling

Überschreibe beliebige dieser CSS-Variablen am `cap-widget`-Element:

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
