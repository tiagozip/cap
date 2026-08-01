---
description: "Bibliothèques maintenues par la communauté pour utiliser Cap, le CAPTCHA open source auto-hébergé, dans davantage de langages et de frameworks. Vérifiez les jetons de preuve de travail hors des SDK."
---

# Bibliothèques communautaires

Vous voulez utiliser Cap sans le serveur standalone et dans un autre langage ? Voici quelques bibliothèques maintenues par la communauté qui pourraient vous aider. Pour en ajouter une, n'hésitez pas à ouvrir une pull request !

**Remarque :** ces bibliothèques ne prennent souvent **pas** en charge les fonctionnalités récentes comme les défis avec graine ou les défis d'instrumentation.

## Widgets

Ce sont des surcouches du widget de Cap. Elles ne sont généralement pas nécessaires, le widget par défaut devant fonctionner partout, mais elles peuvent améliorer le confort de développement.

### React

- **[@pitininja/cap-react-widget](https://www.npmjs.com/package/@pitininja/cap-react-widget)**
- **[cap-widget](https://ui.ednesdayw.com/docs/components/cap-widget)** : un composant React headless et compatible shadcn pour CAP

### Angular

- **[@espressotutorialsgmbh/cap-angular-widget](https://www.npmjs.com/package/@espressotutorialsgmbh/cap-angular-widget)**

### Vue

- **[nuxt-cap](https://github.com/dethdkn/nuxt-cap)**

### Autres

- **[better-captcha](https://www.better-captcha.dev/docs/provider/cap-widget)** : un widget agnostique qui prend en charge 6 frameworks différents, dont React, SolidJS, Vue et Svelte

## Hooks

Ce sont des implémentations de l'API Cap sous forme de hooks React, permettant de personnaliser entièrement l'expérience utilisateur.

- **[@takeshape/use-cap](https://www.npmjs.com/package/@takeshape/use-cap)**

## Serveur

**Avertissement :** ces bibliothèques sont maintenues par la communauté ; elles ne sont pas officiellement prises en charge ni activement surveillées côté sécurité par Cap. Nous ne pouvons garantir ni leur qualité, ni leur sécurité, ni leur compatibilité. Elles peuvent aussi ne pas gérer les fonctionnalités récentes comme les hooks de stockage ou les défis avec graine.

### Cloudflare Workers (serverless/JavaScript)

- **[kaerez/CFCap](https://github.com/kaerez/CFCap)** : implémentation serverless du CAPTCHA CAP sur Cloudflare Workers avec des buckets R2 (moins cher que les Durable Objects), avec TTL personnalisables, usage optionnel de JS et WASM hébergés, déploiement edge mondial et auto-scaling

### Cloudflare Workers (serverless/JavaScript/TypeScript)

- **[xyTom/cap-worker](https://github.com/xyTom/cap-worker)** : implémentation serverless du CAPTCHA CAP sur Cloudflare Workers avec Durable Objects, déploiement edge mondial et auto-scaling

### Java

- **[luckygc/cap-server](https://github.com/luckygc/cap-server)** : remplacement du serveur Java de wuhunyu, qui corrige [un problème important](https://github.com/tiagozip/cap/issues/69#issuecomment-3079407189)

- **[wuhunyu/cap-server-java](https://github.com/wuhunyu/cap-server-java)**

- **[schwebke/cap-captcha-keycloak](https://github.com/schwebke/cap-captcha-keycloak)** : extension Keycloak apportant la validation du captcha Cap au parcours d'inscription

### Go

- **[samwafgo/cap_go_server](https://github.com/samwafgo/cap_go_server)**
- **[ackcoder/go-cap](https://github.com/ackcoder/go-cap)**

### Python

- **[capjs-server](https://github.com/vshn/capjs-server)** : bibliothèque serveur Python sans état pour vérifier les jetons Cap (aucune base de données requise)
- **[django-cap](https://pypi.org/project/django-cap/)** : implémentation Python du serveur Cap pour Django

### .NET

- **[izanhzh/pow-cap-server](https://github.com/izanhzh/pow-cap-server)**

### PHP

- **[clysss/capito](https://github.com/clysss/capito)** : serveur PHP Capito pour Cap
- **[trilbymedia/cap-php](https://github.com/trilbymedia/cap-php)** : portage PHP du serveur de captcha à preuve de travail Cap
- **[oliweb-proof-of-work-for-cap](https://github.com/oli217/oliweb-proof-of-work-for-cap)** : extension WordPress intégrant Cap aux commentaires, à la connexion, à l'inscription et au paiement WooCommerce, avec widget visible ou mode invisible (programmatique)
- **[laravel-cap](https://github.com/oli217/laravel-cap)** : intégration Laravel pour Cap, avec directives Blade, middleware, règles de validation et façade pour la vérification côté serveur (`composer require oliweb/laravel-cap`)
- **[statamic-cap](https://github.com/oli217/statamic-cap)** : module Statamic intégrant Cap aux formulaires, avec rendu du widget, validation automatique des jetons et configuration souple dans le panneau de contrôle (`composer require oliweb/statamic-cap`)
- **[cap-captcha-wordpress](https://github.com/forge28labs/cap-captcha-wordpress)** : une extension WordPress qui intègre Cap aux parcours d'authentification ainsi qu'aux nouveaux commentaires. Instance, clés et couleurs se configurent depuis l'administration WordPress.

## Client

**Avertissement :** ces bibliothèques sont maintenues par la communauté ; elles ne sont pas officiellement prises en charge ni activement surveillées côté sécurité par Cap. Nous ne pouvons garantir ni leur qualité, ni leur sécurité, ni leur compatibilité.

### JavaScript

- **[cap-client](https://codeberg.org/sanin/cap-client)** : bibliothèque cliente et middleware Express pour effectuer des requêtes de vérification, prévue pour NodeJS
