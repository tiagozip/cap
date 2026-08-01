---
description: "Von der Community gepflegte Bibliotheken, um Cap, das selbst gehostete quelloffene CAPTCHA, in weiteren Sprachen und Frameworks zu nutzen. Proof-of-Work-Tokens auch außerhalb der SDKs verifizieren."
---

# Community-Bibliotheken

Du willst Cap ohne den Standalone-Server und in einer anderen Sprache nutzen? Hier sind einige von der Community gepflegte Bibliotheken, die dir helfen könnten. Wenn du eine Bibliothek ergänzen möchtest, öffne gerne einen Pull Request!

**Hinweis:** Diese Bibliotheken unterstützen neuere Funktionen wie Seeded Challenges oder Instrumentation-Challenges häufig **nicht**.

## Widgets

Das sind Wrapper um Caps Widget. Sie sind meist nicht nötig, da das Standard-Widget überall funktionieren sollte, können die Entwicklungserfahrung aber verbessern.

### React

- **[@pitininja/cap-react-widget](https://www.npmjs.com/package/@pitininja/cap-react-widget)**
- **[cap-widget](https://ui.ednesdayw.com/docs/components/cap-widget)**: Eine headless, shadcn-kompatible React-Komponente für CAP

### Angular

- **[@espressotutorialsgmbh/cap-angular-widget](https://www.npmjs.com/package/@espressotutorialsgmbh/cap-angular-widget)**

### Vue

- **[nuxt-cap](https://github.com/dethdkn/nuxt-cap)**

### Sonstige

- **[better-captcha](https://www.better-captcha.dev/docs/provider/cap-widget)**: Ein Framework-unabhängiges Widget, das 6 verschiedene Frameworks unterstützt, darunter React, SolidJS, Vue und Svelte

## Hooks

Das sind React-Hook-Implementierungen der Cap-API, die eine vollständige Anpassung der Nutzererfahrung erlauben.

- **[@takeshape/use-cap](https://www.npmjs.com/package/@takeshape/use-cap)**

## Server

**Warnung:** Diese Bibliotheken werden von der Community gepflegt und sind nicht offiziell unterstützt oder von Cap aktiv auf Sicherheit geprüft. Wir können weder Qualität noch Sicherheit oder Kompatibilität garantieren. Außerdem unterstützen sie neuere Funktionen wie Storage-Hooks oder Seeded Challenges möglicherweise nicht.

### Cloudflare Workers (Serverless/JavaScript)

- **[kaerez/CFCap](https://github.com/kaerez/CFCap)**: Serverless-CAP-CAPTCHA-Implementierung auf Cloudflare Workers mit R2-Buckets (günstiger als Durable Objects), mit anpassbaren TTLs, optionaler Nutzung von gehostetem JS & WASM, globalem Edge-Deployment und Auto-Scaling

### Cloudflare Workers (Serverless/JavaScript/TypeScript)

- **[xyTom/cap-worker](https://github.com/xyTom/cap-worker)**: Serverless-CAP-CAPTCHA-Implementierung auf Cloudflare Workers mit Durable Objects, mit globalem Edge-Deployment und Auto-Scaling

### Java

- **[luckygc/cap-server](https://github.com/luckygc/cap-server)**: Ersatz für wuhunyus Java-Server, der [ein wichtiges Problem](https://github.com/tiagozip/cap/issues/69#issuecomment-3079407189) behebt

- **[wuhunyu/cap-server-java](https://github.com/wuhunyu/cap-server-java)**

- **[schwebke/cap-captcha-keycloak](https://github.com/schwebke/cap-captcha-keycloak)**: Keycloak-Erweiterung, die Cap-Captcha-Validierung für den Registrierungsablauf bereitstellt

### Go

- **[samwafgo/cap_go_server](https://github.com/samwafgo/cap_go_server)**
- **[ackcoder/go-cap](https://github.com/ackcoder/go-cap)**

### Python

- **[capjs-server](https://github.com/vshn/capjs-server)**: Zustandslose Python-Server-Bibliothek zur Verifizierung von Cap-Tokens (ohne Datenbank)
- **[django-cap](https://pypi.org/project/django-cap/)**: Python-Implementierung von Caps Server für Django

### .NET

- **[izanhzh/pow-cap-server](https://github.com/izanhzh/pow-cap-server)**

### PHP

- **[clysss/capito](https://github.com/clysss/capito)**: Capito Cap PHP Server
- **[trilbymedia/cap-php](https://github.com/trilbymedia/cap-php)**: PHP-Portierung des Cap-Proof-of-Work-Captcha-Servers
- **[oliweb-proof-of-work-for-cap](https://github.com/oli217/oliweb-proof-of-work-for-cap)**: WordPress-Plugin, das Cap in Kommentare, Login, Registrierung und den WooCommerce-Checkout integriert, mit sichtbarem Widget und unsichtbarem (programmatischem) Modus
- **[laravel-cap](https://github.com/oli217/laravel-cap)**: Laravel-Integration für Cap mit Blade-Direktiven, Middleware, Validierungsregeln und Facade für die serverseitige Token-Verifizierung (`composer require oliweb/laravel-cap`)
- **[statamic-cap](https://github.com/oli217/statamic-cap)**: Statamic-Addon, das Cap in Formulare integriert: Widget-Rendering, automatische Token-Validierung und flexible Konfiguration im Control Panel (`composer require oliweb/statamic-cap`)
- **[cap-captcha-wordpress](https://github.com/forge28labs/cap-captcha-wordpress)**: Ein WordPress-Plugin, das Cap in die Auth-Abläufe sowie in neue Kommentare integriert. Instanz, Keys und Farben lassen sich im WordPress-Adminbereich konfigurieren.

## Client

**Warnung:** Diese Bibliotheken werden von der Community gepflegt und sind nicht offiziell unterstützt oder von Cap aktiv auf Sicherheit geprüft. Wir können weder Qualität noch Sicherheit oder Kompatibilität garantieren.

### JavaScript

- **[cap-client](https://codeberg.org/sanin/cap-client)**: Client-Bibliothek und Express-Middleware für Verifizierungsanfragen, gedacht für NodeJS
