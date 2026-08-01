---
description: "Les Checkpoints de Cap ajoutent une page intermédiaire de vérification du navigateur, à la manière de Cloudflare, pour bloquer les bots avant qu'ils n'atteignent votre site. CAPTCHA open source à preuve de travail, auto-hébergé."
---

# À propos des checkpoints

Les Checkpoints de Cap (anciennement appelés middlewares) vous permettent de reproduire la page intermédiaire de vérification du navigateur de Cloudflare. Cela empêche les bots, les LLM et les abus automatisés d'atteindre votre site.

Ils sont extrêmement simples à mettre en place : il suffit d'ajouter quelques lignes de code à votre serveur, au lieu de migrer tout votre site vers Cloudflare. Notez que c'est une solution assez radicale, car elle affectera _aussi_ les bons bots, comme les robots d'indexation des moteurs de recherche.

![Capture d'écran du flux de checkpoint de Cap](/checkpoints_screenshot.webp)
