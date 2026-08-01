---
description: "Cap Checkpoints setzen ein Browser-Check-Interstitial wie bei Cloudflare davor und blocken Bots, bevor sie deine Seite erreichen. Selbst gehostetes, quelloffenes Proof-of-Work-CAPTCHA."
---

# Über Checkpoints

Caps Checkpoints (früher als Middlewares bekannt) erlauben dir, Cloudflares Browser-Check-Interstitial nachzubauen. Das verhindert, dass Bots, LLMs und automatisierter Missbrauch überhaupt bis zu deiner Website vordringen.

Sie sind extrem einfach einzurichten und zu nutzen: Du musst nur ein paar Zeilen Code zu deinem Server hinzufügen, statt deine gesamte Website zu Cloudflare umzuziehen. Beachte, dass das eine Art Holzhammer-Lösung ist, denn sie trifft _auch_ gute Bots wie Suchmaschinen-Crawler.

![Screenshot des Checkpoint-Ablaufs von Cap](/checkpoints_screenshot.webp)
