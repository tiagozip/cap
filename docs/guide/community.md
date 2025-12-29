# Community libraries

Want to use Cap without the standalone server and with a different language? Here are some community-maintained libraries that might help. If you want to add a library, feel free to open a pull request!

## Widgets

These are wrappers around Cap's widget. They're usually not required as the default widget should work everywhere but can result in better development experience.

### React

- **[@pitininja/cap-react-widget](https://www.npmjs.com/package/@pitininja/cap-react-widget)**
- **[cap-widget](https://ui.ednesdayw.com/docs/components/cap-widget)**: A headless, shadcn-compatible React component for CAP

### Angular

- **[@espressotutorialsgmbh/cap-angular-widget](https://www.npmjs.com/package/@espressotutorialsgmbh/cap-angular-widget)**

### Other

- **[better-captcha](https://www.better-captcha.dev/docs/provider/cap-widget)**: A framework-agnostic widget that supports 6 different frameworks including React, SolidJS, Vue, Svelte and more

## Hooks

These are React hook implementations of the Cap API, allowing full customization of the user experience.

- **[@takeshape/use-cap](https://www.npmjs.com/package/@takeshape/use-cap)**

## Server

**Warning:** These libraries are community-maintained and not officially supported or actively monitored for security by Cap. We can't guarantee their quality, security, or compatibility. They also might not support newer features such as storage hooks or seeded challenges.

### Cloudflare Workers (Serverless/JavaScript)

- **[kaerez/CFCap](https://github.com/kaerez/CFCap)**: Serverless CAP CAPTCHA implementation on Cloudflare Workers with R2 Buckets (cheaper than Durable Objects), featuring customizable TTLs, optional use of hosted JS & WASM, global edge deployment and auto-scaling

### Cloudflare Workers (Serverless/JavaScript/TypeScript)

- **[xyTom/cap-worker](https://github.com/xyTom/cap-worker)**: Serverless CAP CAPTCHA implementation on Cloudflare Workers with Durable Objects, featuring global edge deployment and auto-scaling

### Java

- **[luckygc/cap-server](https://github.com/luckygc/cap-server)**: Replacement of wuhunyu's Java server that fixes [an important issue](https://github.com/tiagozip/cap/issues/69#issuecomment-3079407189)

- **[wuhunyu/cap-server-java](https://github.com/wuhunyu/cap-server-java)**

### Go

- **[samwafgo/cap_go_server](https://github.com/samwafgo/cap_go_server)**
- **[ackcoder/go-cap](https://github.com/ackcoder/go-cap)**

### Python

- **[django-cap](https://pypi.org/project/django-cap/)**: Python implementation for Cap's server with Django

### .NET

- **[izanhzh/pow-cap-server](https://github.com/izanhzh/pow-cap-server)**

### PHP

- **[clysss/capito](https://github.com/clysss/capito)**: Capito Cap PHP Server
