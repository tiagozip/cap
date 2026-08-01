---
description: "Référence de l'API REST de Cap Standalone : créez et gérez les clés de site et les sessions du CAPTCHA open source auto-hébergé via des requêtes authentifiées par bearer."
---

# API

Le mode standalone propose une API simple pour créer, consulter et gérer les clés et les sessions. Connectez-vous d'abord à votre tableau de bord Cap Standalone et récupérez une clé d'API dans **Settings** → **API Keys**. Donnez-lui un nom et cliquez sur « Create ».

Une fois la clé créée, conservez-la en lieu sûr : vous ne pourrez plus la consulter ensuite.

Vous pouvez désormais utiliser cette clé pour envoyer des requêtes API à votre serveur standalone. Chaque requête doit inclure l'en-tête `Authorization` avec votre clé d'API, comme ceci :

```http
Authorization: Bot YOUR_API_KEY
```

La liste de tous les points d'accès disponibles et des corps de requête attendus est consultable sur `http://localhost:3000/swagger`.
