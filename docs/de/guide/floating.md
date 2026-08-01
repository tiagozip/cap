---
description: "Der Floating-Modus von Caps Widget blendet das quelloffene CAPTCHA aus, bis ein Button gedrückt wird, und startet den Proof-of-Work dann bei Bedarf. Einrichtung über ein einziges Data-Attribut."
---

# Floating-Modus

Cap kann das CAPTCHA automatisch ausblenden, bis ein Button gedrückt wird. Füge dafür das Attribut `data-cap-floating` zu deinem Trigger hinzu, mit dem Query-Selektor des `cap-widget`-Elements, das du verwenden möchtest.

```html
<cap-widget
  id="floating"
  onsolve="console.log(`token: ${event.detail.token}`)"
  data-cap-api-endpoint="<api endpoint>"
></cap-widget>

<button data-cap-floating="#floating" data-cap-floating-position="bottom">
  Floating-Modus auslösen
</button>
```

Außerdem musst du sowohl die Cap-Bibliothek als auch das Floating-Mode-Skript von JSDelivr einbinden:

```html{2}
<script src="https://cdn.jsdelivr.net/npm/cap-widget"></script>
<script src="https://cdn.jsdelivr.net/npm/cap-widget/cap-floating.min.js"></script> <!-- [!code ++] -->
```

Oder vom Standalone-Server:

```html
<script src="https://<server url>/assets/widget.js"></script>
<script src="https://<server url>/assets/floating.js"></script>
<!-- [!code ++] -->
```

Die folgenden Attribute werden unterstützt:

- `data-cap-floating`: Der CSS-Selektor des `cap-widget`-Elements, das du verwenden möchtest.
- `data-cap-floating-position`: Die Position des Floating-Widgets. Möglich sind `top` oder `bottom`.
- `data-cap-floating-offset`: Der Abstand des Floating-Widgets zum Trigger-Element.
