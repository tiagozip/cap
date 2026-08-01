---
description: "REST-API-Referenz für Cap Standalone: Site-Keys und Sessions für das selbst gehostete, quelloffene CAPTCHA über Bearer-authentifizierte Requests anlegen und verwalten."
---

# API

Der Standalone-Modus bietet eine einfache API, um Keys und Sessions zu erstellen, einzusehen und zu verwalten. Melde dich zuerst in deinem Cap-Standalone-Dashboard an und hole dir einen API-Key unter **Settings** → **API Keys**. Gib ihm einen Namen und tippe auf "Create".

Sobald dein Key erstellt ist, speichere ihn an einem sicheren Ort, denn du kannst ihn danach nicht mehr einsehen.

Mit diesem Key kannst du nun API-Requests an deinen Standalone-Server stellen. Bei jedem Request musst du den Header `Authorization` mit deinem API-Key mitschicken, so:

```http
Authorization: Bot YOUR_API_KEY
```

Eine Liste aller verfügbaren API-Endpunkte und der jeweils erwarteten Bodies findest du unter `http://localhost:3000/swagger`.
