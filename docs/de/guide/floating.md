---
description: "Der Floating-Modus von Caps Widget blendet das quelloffene CAPTCHA aus, bis ein Button gedrückt wird, und startet den Proof-of-Work dann bei Bedarf. Einrichtung über ein einziges Data-Attribut."
---

# Floating-Modus

Im Floating-Modus bleibt das Widget verborgen, bis jemand einen Button drückt. Dann erscheint es neben dem Button, löst die Challenge, blendet sich wieder aus und klickt den Button ein zweites Mal. Ein Submit-Button schickt dadurch das Formular samt Token ab.

Lade das Floating-Skript nach dem Widget:

```html
<script src="https://cdn.jsdelivr.net/npm/cap-widget@<version>"></script>
<script src="https://cdn.jsdelivr.net/npm/cap-widget@<version>/cap-floating.min.js"></script>
```

Beim [Asset-Server](./capd/options.md#asset-server) von capd liegt das Floating-Skript unter `/assets/floating.js`.

Verknüpfe dann einen Button über einen CSS-Selektor mit einem Widget:

```html
<form action="/submit" method="POST">
  <cap-widget id="cap" data-cap-api-endpoint="https://cap.example.com/<site-key>/"></cap-widget>
  <button type="submit" data-cap-floating="#cap">Submit</button>
</form>
```

| Attribut | Beschreibung |
| --- | --- |
| `data-cap-floating` | Selektor des Widgets, das angezeigt werden soll. |
| `data-cap-floating-position` | `top` oder `bottom` des Buttons. Standard ist `top`. |
| `data-cap-floating-offset` | Abstand zwischen Button und Widget in Pixeln. Standard ist `8`. |

Nach dem Lösen trägt der Button das Token auch in `data-cap-token`.

Das Widget beginnt mit dem Lösen, sobald es erscheint, ohne einen Klick darauf. Bei Keys, die [Verhalten bewerten](./instrumentation.md#behavior-scoring) und eine Interaktion verlangen, schlagen Lösungen im Floating-Modus mit `behavior_no_interaction` fehl, genau wie im [unsichtbaren Modus](./invisible.md#keys-with-behavior-scoring).
