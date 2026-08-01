---
description: "Le mode flottant du widget Cap masque le CAPTCHA open source jusqu'à l'appui sur un bouton, puis lance la preuve de travail à la demande. Configuration avec un seul attribut data."
---

# Mode flottant

Cap peut masquer automatiquement le CAPTCHA jusqu'à ce qu'un bouton soit pressé. Pour cela, ajoutez l'attribut `data-cap-floating` à votre déclencheur, avec le sélecteur de l'élément `cap-widget` que vous voulez utiliser.

```html
<cap-widget
  id="floating"
  onsolve="console.log(`token: ${event.detail.token}`)"
  data-cap-api-endpoint="<api endpoint>"
></cap-widget>

<button data-cap-floating="#floating" data-cap-floating-position="bottom">
  Déclencher le mode flottant
</button>
```

Vous devrez aussi importer la bibliothèque Cap et le script du mode flottant depuis JSDelivr :

```html{2}
<script src="https://cdn.jsdelivr.net/npm/cap-widget"></script>
<script src="https://cdn.jsdelivr.net/npm/cap-widget/cap-floating.min.js"></script> <!-- [!code ++] -->
```

Ou depuis le serveur standalone :

```html
<script src="https://<server url>/assets/widget.js"></script>
<script src="https://<server url>/assets/floating.js"></script>
<!-- [!code ++] -->
```

Les attributs suivants sont pris en charge :

- `data-cap-floating` : le sélecteur CSS de l'élément `cap-widget` à utiliser.
- `data-cap-floating-position` : la position du widget flottant. Valeurs possibles : `top` ou `bottom`.
- `data-cap-floating-offset` : le décalage du widget flottant par rapport à l'élément déclencheur.
