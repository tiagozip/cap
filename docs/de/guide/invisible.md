---
description: "Unsichtbarer Modus für Cap: new Cap() und solve() aufrufen, um das quelloffene CAPTCHA aus eigenem JavaScript heraus laufen zu lassen, mit Proof-of-Work und ohne sichtbares Widget."
---

# Unsichtbarer Modus

Der unsichtbare Modus löst eine Challenge aus deinem eigenen Code heraus, ohne etwas auf der Seite anzuzeigen. Er eignet sich für Aktionen ohne Formular, etwa einen Like-Button oder eine Hintergrundanfrage.

```js
import Cap from "cap-widget";

const cap = new Cap({ apiEndpoint: "https://cap.example.com/<site-key>/" });
const { token } = await cap.solve();
```

Mit dem CDN-Skript ist `Cap` global verfügbar und braucht keinen Import.

## API

### `new Cap(config, element?)`

`config.apiEndpoint` ist erforderlich, sofern du nicht [`CAP_CUSTOM_FETCH`](./widget.md#options) setzt. Jeder andere Key wird als Attribut am Widget gesetzt, die [Widget-Attribute](./widget.md#attributes) funktionieren also auch hier:

```js
const cap = new Cap({
  apiEndpoint: "https://cap.example.com/<site-key>/",
  "data-cap-worker-count": "4",
});
```

Ohne `element` erzeugt Cap ein verstecktes `<cap-widget>` mit deaktivierter Vibration. Ein verstecktes Widget fordert nichts vorab an und löst auch nichts vorab. Die gesamte Arbeit beginnt erst mit deinem Aufruf von `solve()`. Übergib ein bestehendes Widget, um dieses zu steuern.

### `cap.solve()`

Fordert eine Challenge an und löst sie. Das Promise liefert `{ success, token }`.

Ein Fehler löst ein `error`-Event aus und lehnt das Promise mit einem `Error` ab, dessen `code` einer der [Fehlercodes](./troubleshooting/instrumentation.md#error-codes) ist, etwa `instr_csp_blocked` für einen [blockierten Frame](./widget.md#content-security-policy):

```js
try {
  const { token } = await cap.solve();
} catch (err) {
  console.error(err.code, err.message);
}
```

Ein Aufruf während eines laufenden Lösungsvorgangs liefert `undefined`.

### `cap.token`

Das Token des letzten Lösungsvorgangs oder `null`.

### `cap.reset()`

Löscht das Token.

### `cap.addEventListener(type, listener)`

Lauscht auf die [Events](./widget.md#events) des Widgets:

```js
cap.addEventListener("progress", (e) => {
  console.log(`${e.detail.progress}%`);
});
```

## Keys mit Verhaltensbewertung {#keys-with-behavior-scoring}

Beim unsichtbaren Lösen gibt es keinen Klick auf ein Widget. Bei Keys, die [Verhalten bewerten](./instrumentation.md#behavior-scoring), lautet das Urteil `no_interaction`. Die Lösung schlägt also bei Keys fehl, die blockieren und eine Interaktion verlangen. Setze in der Core-Bibliothek für solche Routen `requireInteraction: false` in der `behavior`-Richtlinie.
