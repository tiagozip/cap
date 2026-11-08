---
outline: [2, 3]
description: "Caps Client-Widget fordert Proof-of-Work-Challenges an, löst sie und stellt sie dar, mit einer nativen Web Component und WASM. Installiere es, nutze es in jedem Framework und passe es an."
---

# Widget

Das Widget ist eine `<cap-widget>`-Web-Component. Es fordert eine Challenge von deinem Server an, löst sie in Web Workern mit WebAssembly und gibt dir ein Token zum Verifizieren.

## Installation

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

Pinne bei Nutzung des CDN eine Version von der [Releases-Seite](https://github.com/tiagozip/cap/releases). jsDelivr ist in Teilen Chinas blockiert. Wenn deine Besucher dort sind, installiere über npm oder [hoste das Widget selbst](#self-hosting-the-widget).

## Verwendung {#usage}

Richte `data-cap-api-endpoint` auf deinen Server. Bei capd ist das `https://<instance>/<site-key>/`.

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

Ein paar Hinweise zu den Frameworks:

- React verarbeitet Custom-Element-Events ab Version 19 korrekt. Preact nutzt dieselbe Syntax.
- Vue warnt möglicherweise wegen einer unbekannten Komponente. Sag dem Compiler, dass `cap-`-Tags Custom Elements sind:

  ```js
  vue({ template: { compilerOptions: { isCustomElement: (tag) => tag.startsWith("cap-") } } })
  ```

- Das Svelte-Beispiel nutzt Svelte 5. Unter Svelte 4 verwendest du `on:solve`.

### In einem Formular

Innerhalb eines `<form>` fügt das Widget nach dem Lösen ein verstecktes `cap-token`-Input hinzu. Das Token wird dadurch mit den anderen Feldern übermittelt. Ergänze `required`, um das Absenden des Formulars vorher zu verhindern.

```html
<form action="/submit" method="POST">
  <cap-widget required data-cap-api-endpoint="https://cap.example.com/<site-key>/"></cap-widget>
  <button type="submit">Submit</button>
</form>
```

Nutze den [unsichtbaren Modus](./invisible.md), um ohne sichtbares Widget zu lösen. Nutze den [Floating-Modus](./floating.md), um es erst nach einem Button-Klick anzuzeigen.

## Wann es anfordert und löst

Das Widget wartet nicht auf einen Klick, bevor es mit der Arbeit beginnt. Sobald es auf der Seite sichtbar ist, fordert es eine Challenge an und startet den [Instrumentation](./instrumentation.md)-Frame, der die Seite bis zum Ende des Lösungsvorgangs beobachtet. Einige Zeit vor Ablauf fordert es erneut eine Challenge an. Dafür nutzt es die Lebensdauer aus dem Challenge-Token. Bei einer Challenge mit 10 Minuten Gültigkeit passiert das bei SHA-256 90 Sekunden und bei HashWX 3 Minuten vor Ablauf.

Die erste Mausbewegung, Berührung oder Tastatureingabe auf der Seite startet einen spekulativen Lösungsvorgang. Bei einer Challenge im [Format 2](./capjs-core.md#format-2-hashwx), das HashWX nutzt, lädt das Widget nur das HashWX-Modul vorab herunter. Bei einer SHA-256-Challenge im Format 1 wartet es 2,5 Sekunden und löst dann in einem einzelnen Worker. Ein Klick auf das Widget verteilt den Rest der Arbeit auf alle Worker. Braucht der Key keine Interaktionsdaten, löst das Widget die Lösung auch im Hintergrund ein und hält das Token bereit, sodass der Klick auf das Widget sofort ein Ergebnis liefert. Prüft der Key Interaktionen oder bewertet Verhalten, wartet das Widget mit dem Einlösen auf den Klick, da dieser Teil der Serverprüfung ist. Hat der Server ein Einlösen im Hintergrund abgelehnt, zeigt der Klick diesen Fehler.

## Events {#events}

Jedes Event ist ein `CustomEvent`.

| Event | Ausgelöst, wenn | `detail` |
| --- | --- | --- |
| `solve` | Die Challenge gelöst ist | `{ token }` |
| `progress` | Das Lösen voranschreitet | `{ progress }`, von 0 bis 100 |
| `error` | Etwas fehlschlägt | `{ isCap, code, message }`. Die Codes stehen unter [Fehlerbehebung](./error-codes.md). |
| `reset` | Das Widget zurückgesetzt wird | `{}` |

## Attribute {#attributes}

| Attribut | Beschreibung |
| --- | --- |
| `data-cap-api-endpoint` | Der Endpunkt deines Servers. Erforderlich. |
| `data-cap-worker-count` | Anzahl der Solver-Worker. Standard ist die Anzahl der CPU-Kerne oder 8. |
| `data-cap-hidden-field-name` | Name des versteckten Formular-Inputs. Standard ist `cap-token`. |
| `data-cap-lang` | Erzwingt eine [Sprache](#languages). |
| `data-cap-troubleshooting-url` | Ziel des Fehlerbehebungslinks, wenn ein Besucher blockiert wird. |
| `data-cap-disable-haptics` | Deaktiviert Vibration auf Smartphones. |
| `required` | Verhindert das Absenden des Formulars, bis das Widget gelöst ist. |

## Sprachen {#languages}

Das Widget folgt der Browsersprache für Arabisch, vereinfachtes Chinesisch, Französisch, Deutsch, Hindi, Japanisch, Portugiesisch, Russisch und Spanisch. Sonst nutzt es Englisch. Setze `data-cap-lang="de"` am Widget oder `window.CAP_LANG = "de"` für die gesamte Seite, um selbst eine Sprache zu wählen.

Um eine Beschriftung zu ändern, setze ihr `data-cap-i18n-*`-Attribut:

```html
<cap-widget
  data-cap-api-endpoint="https://cap.example.com/<site-key>/"
  data-cap-i18n-initial-state="I'm not a robot"
  data-cap-i18n-solved-label="Done"
></cap-widget>
```

Die Keys sind `initial-state`, `verifying-label`, `solved-label`, `error-label`, `csp-error-label`, `required-label`, `troubleshooting-label`, `wasm-disabled` sowie die Screenreader-Beschriftungen `group-aria-label`, `verify-aria-label`, `verifying-aria-label`, `verified-aria-label` und `error-aria-label`.

## Styling

Überschreibe diese CSS-Variablen an `cap-widget`. Die gezeigten Werte sind die Standardwerte.

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

## Seitenweite Optionen {#options}

Setze diese auf `window`, bevor das Widget lädt.

| Option | Beschreibung |
| --- | --- |
| `CAP_CUSTOM_FETCH` | Ersetzt `fetch` für die Anfragen des Widgets. |
| `CAP_CSS_NONCE` | Nonce für den eingefügten `<style>`-Tag bei strikter Content Security Policy. Wird auch für Skripte genutzt, wenn `CAP_SCRIPT_NONCE` nicht gesetzt ist. |
| `CAP_SCRIPT_NONCE` | Nonce für eingefügte Skripte, den Dekomprimierungs-Fallback und das Instrumentation-Iframe. |
| `CAP_ISOLATE` | Führt den Instrumentation-Frame ohne die Origin deiner Seite aus. Siehe [Seiten mit einer HTML-Injection-Lücke](#pages-with-an-html-injection-bug). |
| `CAP_PAKO_URL` | URL von `pako_inflate.min.js`, das das Widget nur in Browsern ohne `DecompressionStream` lädt. |
| `CAP_CUSTOM_WASM_URL` | URL von `cap_wasm_bg.wasm`. |
| `CAP_CUSTOM_HASHWX_URL` | URL von `hashwx.wasm`. |
| `CAP_LANG` | Erzwingt eine [Sprache](#languages) für jedes Widget. |
| `CAP_DISABLE_HAPTICS` | Deaktiviert Vibration für jedes Widget. |
| `CAP_DISABLE_WIDGET_REF` | Lässt die Adresse deiner Seite aus dem Link hinter dem Cap-Hinweis des Widgets weg. |
| `CAP_DEBUG` | Loggt jeden Schritt des Anforderns und Lösens auf die Konsole. |
| `CAP_SILENT` | Deaktiviert sämtliche Konsolenausgaben des Widgets. |

## Content Security Policy

Das Widget funktioniert unter einer strikten Content Security Policy. Es braucht diese Quellen:

| Direktive | Quelle | Grund |
| --- | --- | --- |
| `script-src` | `'nonce-...'` oder der Host des Widgets | Lädt das Widget-Skript. |
| `script-src` | `'wasm-unsafe-eval'` | Kompiliert den WebAssembly-Solver. |
| `worker-src` | `blob:` | Führt den Solver in Web Workern aus, die aus einer Blob-URL erstellt werden. |
| `connect-src` | dein Cap-Server und `cdn.jsdelivr.net`, sofern du nicht [selbst hostest](#self-hosting-the-widget) | Fordert Challenges an, löst sie ein und lädt die WASM-Dateien herunter. |
| `style-src` | `'nonce-...'` | Erlaubt den eingefügten `<style>`-Tag des Widgets. Setze `CAP_CSS_NONCE`. |

Das [Instrumentation](./instrumentation.md)-Skript läuft in einem `srcdoc`-Iframe, das die Richtlinie der Seite erbt. Das Widget ergänzt dieses Skript und das pako-Fallback-Skript in älteren Browsern nur dann um eine Nonce, wenn du `window.CAP_SCRIPT_NONCE` vor dem Laden des Widgets auf die Nonce aus deinem `script-src` setzt. Ohne sie blockiert der Browser das Skript, und die Lösung schlägt 250 ms nach dem Laden des Frames fehl. Das Widget zeigt "Blocked by this page", löst ein `error`-Event mit dem Code `instr_csp_blocked` aus und loggt einen Konsolenfehler, der hierher verweist. Der Server erfasst den Fehler unter demselben Code. Wenn du pako von einem anderen Host als jsDelivr lädst, setze `CAP_PAKO_URL` und erlaube diesen Host in `script-src`.

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

Erzeuge für jede Antwort eine neue Nonce. Wenn du das Widget über `/assets` von capd auslieferst, erlaube deinen Cap-Server in `script-src` und `connect-src` und entferne jsDelivr.

Du brauchst kein `'unsafe-eval'`. Einige Instrumentation-Prüfungen nutzen `eval` und `new Function`. Wenn beide einen `EvalError` werfen, überspringt das Skript diese Prüfungen, führt den Rest aus, und der Server ergänzt `riskFlags` um `csp_eval_blocked`. Wirft nur eine der beiden Funktionen einen Fehler, wertet das Skript das als Manipulation und schlägt mit `instr_natives_tampered` fehl. Das Skript hält auch fest, ob der Browser für das blockierte `eval` ein `securitypolicyviolation`-Event ausgelöst hat. Es ignoriert Events, deren `isTrusted` auf `false` steht, damit ein Seitenskript diese Bestätigung nicht fälschen kann. Das Flag dient nur der Information und zählt nie zugunsten des Besuchers.

Widgets aus früheren Versionen funktionieren weiter gegen einen neuen Server, mit den unter [Widgets aus früheren Versionen](./instrumentation.md#widgets-from-earlier-releases) beschriebenen Einschränkungen.

### Seiten mit einer HTML-Injection-Lücke {#pages-with-an-html-injection-bug}

Der Instrumentation-Frame teilt die Origin deiner Seite. Sobald du `CAP_SCRIPT_NONCE` setzt, gibt das Widget deine Nonce an das Skript des Frames weiter. Das Widget führt jedes Skript aus, das der Server in `data-cap-api-endpoint` sendet. Kann ein Angreifer HTML in eine Seite einschleusen, die `CAP_SCRIPT_NONCE` setzt, kann er ein `<cap-widget>` hinzufügen, das auf seinen eigenen Server zeigt. Dessen Skript läuft dann unter der Origin deiner Seite und passiert deine Richtlinie. Auf dieser Seite wird eine Lücke, die deine Richtlinie sonst begrenzen würde, zu Cross-Site-Scripting.

Das betrifft nur Seiten, die sich auf eine Nonce-basierte Richtlinie verlassen, um HTML-Injection einzugrenzen. Ohne eine solche Richtlinie kann eingeschleustes HTML ohnehin Skripte ausführen, und das Widget ändert daran nichts.

Setze auf diesen Seiten `window.CAP_ISOLATE = true` in einem Skript, bevor das Widget lädt:

```html
<script nonce="r4nd0m">
  window.CAP_SCRIPT_NONCE = "r4nd0m";
  window.CAP_ISOLATE = true;
</script>
```

Das Widget führt den Frame dann ohne `allow-same-origin` aus. Sein Skript erhält dadurch eine opake Origin und kann deine Seite, Cookies oder Speicher weder lesen noch verändern, unabhängig davon, welcher Server es gesendet hat. Die Option muss über JavaScript gesetzt werden, da eingeschleustes HTML kein JavaScript ausführen kann und ein Attribut am Widget in der Hand des Angreifers läge.

Die Prüfung verzichtet damit auf die Daten, die sie aus der Seite liest. Sie führt weiterhin die [Prüfungen auf automatisierte Browser](./instrumentation.md#automated-browser-detection) in ihrem eigenen Frame aus, kann aber keine Interaktionen, Verhaltensaufzeichnungen oder Markierungen von KI-Agenten erfassen. Bei Keys, die diese Signale nur melden, akzeptiert der Server solche Lösungen mit dem Risiko-Flag `isolated_frame`. Bei Keys, die automatisierte Interaktionen blockieren, Verhalten im blockierenden Modus bewerten oder Agenten blockieren, lehnt er sie mit `instr_isolated` ab.

## Das Widget selbst hosten {#self-hosting-the-widget}

Das Widget lädt standardmäßig von jsDelivr, ebenso die beiden WASM-Dateien, die sein Solver abruft. So lieferst du alles von deiner eigenen Domain aus:

1. Liefere das Skript selbst aus, entweder durch einen Import von `cap-widget` über deinen Bundler oder vom [Asset-Server](./capd/options.md#asset-server) von capd unter `/assets/widget.js`.
2. Richte den Solver auf deine Kopien der WASM-Dateien, bevor das Widget etwas löst:

```html
<script>
  window.CAP_CUSTOM_WASM_URL = "https://cap.example.com/assets/cap_wasm_bg.wasm";
  window.CAP_CUSTOM_HASHWX_URL = "https://cap.example.com/assets/hashwx.wasm";
</script>
<script src="https://cap.example.com/assets/widget.js"></script>
```

Mit einem Bundler setzt du die beiden globalen Variablen, bevor `import "cap-widget"` ausgeführt wird. Die URLs können auf jeden Ort zeigen, an dem du die Dateien hostest.
