---
outline: deep
---

# Quickstart

Cap is a modern, lightweight, open-source CAPTCHA alternative using SHA-256 proof-of-work.

Unlike traditional CAPTCHAs, Cap:

- Is fast and unobtrusive
- Uses no tracking or cookies
- Uses proof-of-work instead of intrusive puzzles
- Is fully accessible and self-hostable

Here, try it yourself:

<Demo />

## Components

Cap consists mainly of the **widget** (can be used invisibly) and **server** (you can use the Standalone server instead). Alternatively, M2M is also supported and there's also a checkpoint middleware similar to Cloudflare.

This guide details how to use the usual setup. You can find guides on using the [Standalone server](./standalone/index.md), [M2M solver](./solver.md), and [checkpoint middleware](./middleware/index.md) in their respective sections.

We highly recommend checking out the [Standalone mode](./standalone/index.md) as it's complete, fast, simple to set up, and works with any language that can make HTTP requests. It also includes a dashboard, API key support, and more.

## Client-side

Start by adding importing the Cap widget library from a CDN:

::: code-group

```html [jsdelivr]
<script src="https://cdn.jsdelivr.net/npm/@cap.js/widget@0.1.25"></script>
```

```html [unpkg]
<script src="https://unpkg.com/@cap.js/widget@0.1.25"></script>
```

:::

You can also just add it with `npm i @cap.js/widget` if your setup supports it, using a CDN isn't really required.

Next, add the `<cap-widget>` component to your HTML.

```html
<cap-widget id="cap" data-cap-api-endpoint="<your cap endpoint>"></cap-widget>
```

You'll need to start a server with the Cap API running at the same URL as specified in the `data-cap-api-endpoint` attribute. We'll tell you how to set this up in the next section.

Then, in your JavaScript, listen for the `solve` event to capture the token when generated:

```js{3}
const widget = document.querySelector("#cap");

widget.addEventListener("solve", function (e) {
  const token = e.detail.token;

  // Handle the token as needed
});
```

Alternatively, you can use `onsolve=""` directly within the widget or wrap the widget in a `<form></form>` (where Cap will automatically submit the token alongside other form data. for this, it'll create a hidden field with name set to its `data-cap-hidden-field-name` attribute or `cap-token`).

## Server-side

Cap is fully self-hosted, so you'll need to start a server exposing an API for Cap's methods running at the same URL as specified in the `data-cap-api-endpoint` attribute.

You can choose between using the Standalone server or implementing your own server using the `@cap.js/server` package.

- For most use cases, we recommend using the **[Standalone server](./standalone/index.md)** as it provides a complete solution with built-in features like token storage, ratelimiting, analytics, and a pretty nice dashboard. However, it does require docker and exposing the server port.

- However, if you prefer to implement your own server, you can use the `@cap.js/server` package. This package provides the necessary methods to create and validate challenges, as well as redeem solutions, but it only works with a JavaScript backend.

  It also gives you a small, simple JSON token storage, but you'll probably want to use a more robust solution like SQLite or Redis, but don't worry, we'll tell you everything about that [on the server guide](./server.md).

- If you would like the simplicity of the server package but with another language, check out the [community packages](./community.md)
