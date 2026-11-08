---
description: "Le mode flottant du widget Cap masque le CAPTCHA open source jusqu'à l'appui sur un bouton, puis lance la preuve de travail à la demande. Configuration avec un seul attribut data."
---

# Mode flottant

Le mode flottant garde le widget masqué jusqu'à ce qu'un bouton soit pressé. Le widget apparaît alors à côté du bouton, résout le défi, se masque à nouveau et clique une seconde fois sur le bouton. Un bouton d'envoi soumet donc le formulaire avec son jeton.

Chargez le script du mode flottant après le widget :

```html
<script src="https://cdn.jsdelivr.net/npm/cap-widget@<version>"></script>
<script src="https://cdn.jsdelivr.net/npm/cap-widget@<version>/cap-floating.min.js"></script>
```

Sur le [serveur d'assets](./capd/options.md#asset-server) de capd, le script du mode flottant se trouve à `/assets/floating.js`.

Faites ensuite pointer un bouton vers un widget avec un sélecteur CSS :

```html
<form action="/submit" method="POST">
  <cap-widget id="cap" data-cap-api-endpoint="https://cap.example.com/<site-key>/"></cap-widget>
  <button type="submit" data-cap-floating="#cap">Submit</button>
</form>
```

| Attribut | Description |
| --- | --- |
| `data-cap-floating` | Sélecteur du widget à afficher. |
| `data-cap-floating-position` | `top` ou `bottom` du bouton. Valeur par défaut : `top`. |
| `data-cap-floating-offset` | Espace entre le bouton et le widget, en pixels. Valeur par défaut : `8`. |

Après une résolution, le bouton porte aussi le jeton dans `data-cap-token`.

Le widget commence à résoudre le défi dès qu'il apparaît, sans clic dessus. Avec les clés qui [évaluent le comportement](./instrumentation.md#behavior-scoring) et exigent une interaction, les résolutions flottantes échouent avec `behavior_no_interaction`, comme les résolutions [invisibles](./invisible.md#keys-with-behavior-scoring).
