---
description: "Community-maintained libraries for using Cap, the self-hosted open-source CAPTCHA, in more languages and frameworks: widget wrappers, server ports and plugins."
---

# Community libraries

These libraries are maintained by other people, not by Cap. They aren't reviewed for security, and many don't support newer features like HashWX or instrumentation. To add one, open a pull request.

## Widget wrappers

The widget works in any framework on its own, so these are optional.

- [@pitininja/cap-react-widget](https://www.npmjs.com/package/@pitininja/cap-react-widget) for React
- [cap-widget](https://ui.ednesdayw.com/docs/components/cap-widget), a headless, shadcn-compatible React component
- [@takeshape/use-cap](https://www.npmjs.com/package/@takeshape/use-cap), a React hook for building your own UI
- [@espressotutorialsgmbh/cap-angular-widget](https://www.npmjs.com/package/@espressotutorialsgmbh/cap-angular-widget) for Angular
- [nuxt-cap](https://github.com/dethdkn/nuxt-cap) for Nuxt
- [better-captcha](https://www.better-captcha.dev/docs/provider/cap-widget), which supports React, SolidJS, Vue, Svelte and more

## Servers

- Cloudflare Workers: [kaerez/CFCap](https://github.com/kaerez/CFCap) with R2, and [xyTom/cap-worker](https://github.com/xyTom/cap-worker) with Durable Objects
- Java: [luckygc/cap-server](https://github.com/luckygc/cap-server), which replaces [wuhunyu/cap-server-java](https://github.com/wuhunyu/cap-server-java) and fixes [an issue](https://github.com/tiagozip/cap/issues/69#issuecomment-3079407189) in it
- Go: [samwafgo/cap_go_server](https://github.com/samwafgo/cap_go_server), [ackcoder/go-cap](https://github.com/ackcoder/go-cap)
- Python: [capjs-server](https://github.com/vshn/capjs-server), a stateless verifier, and [django-cap](https://pypi.org/project/django-cap/) for Django
- .NET: [izanhzh/pow-cap-server](https://github.com/izanhzh/pow-cap-server)
- PHP: [clysss/capito](https://github.com/clysss/capito), [trilbymedia/cap-php](https://github.com/trilbymedia/cap-php)

## Integrations

- WordPress: [oliweb-proof-of-work-for-cap](https://github.com/oli217/oliweb-proof-of-work-for-cap) for comments, login, registration and WooCommerce checkout, and [cap-captcha-wordpress](https://github.com/forge28labs/cap-captcha-wordpress) for login and comments
- Laravel: [laravel-cap](https://github.com/oli217/laravel-cap), with Blade directives, middleware and validation rules
- Statamic: [statamic-cap](https://github.com/oli217/statamic-cap) for forms
- Symfony: [cap-bundle](https://github.com/silarhi/cap-bundle), with a form type, a validator and Turbo support ([docs](https://cap-bundle.silarhi.dev))
- Keycloak: [schwebke/cap-captcha-keycloak](https://github.com/schwebke/cap-captcha-keycloak) for the registration flow
- Node.js: [cap-client](https://codeberg.org/sanin/cap-client), a client and Express middleware for verifying tokens
