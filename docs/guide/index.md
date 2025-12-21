---
outline: deep
---

# Quickstart

Cap is a modern, lightweight, and self-hosted CAPTCHA alternative using SHA-256 proof-of-work.

Unlike traditional CAPTCHAs, Cap's fast, unobtrusive, has no telemetry or tracking, and uses accessible proof-of-work instead of annoying visual puzzles.

Cap consists of a client-side widget, which solves challenges and displays the checkbox, and a server-side component, which generates challenges and redeems solutions.

## Integration

### Widget

In order for your users to be able to solve Cap challenges, you'll need to install the widget library to either use the invisible mode or add the checkbox custom component, which looks like this:

<Demo />

Add the following to your website's HTML:

```html
<script src="https://cdn.jsdelivr.net/npm/@cap.js/widget@0.1.32"></script>
```

::: tip Using the scripts without a CDN

Using `cdn.jsdelivr.net` is optional. If preferred, you can self-host the scripts by either [downloading the latest release files](https://cdn.jsdelivr.net/npm/@cap.js/widget@latest) or, if you're using a framework, installing them with `npm add @cap.js/widget` and serving them from your own server. Remember to update these regularly.

`cdn.jsdelivr.net` is blocked in some jurisdictions, like some parts of China. If your website needs to be reachable from these jurisdictions, we recommend that you self-host the scripts.

:::


Next, you can either add the widget component directly to your code:

```html
<cap-widget data-cap-api-endpoint="<your cap endpoint>"></cap-widget>
```

You'll need to start a server with the Cap API running at the same URL as specified in the `data-cap-api-endpoint` attribute. We'll tell you how to set this up in the next section.

Then, in your JavaScript, listen for the `solve` event to capture the token when generated:

```js{3}
const widget = document.querySelector("cap-widget");

widget.addEventListener("solve", function (e) {
  const token = e.detail.token;

  // Handle the token as needed
});
```

Alternatively, you can wrap the widget in a `<form></form>` (where Cap will automatically submit the token alongside other form data as `cap-token`.

You can also use get a token programmatically without displaying the widget by using the invisible mode:

```js
const cap = new Cap({
  apiEndpoint: "/api/"
});
const solution = await cap.solve();

// you can attach event listeners to track progress
cap.addEventListener("progress", (event) => { 
  console.log(`Solving... ${event.detail.progress}% done`);
});

console.log(solution.token);
```

## Server-side

Cap is fully self-hosted, so you'll need to start a server exposing an API for Cap's protocol.

For most use cases, we recommend using the Docker **[Standalone server](./standalone/index.md)**, as it exposes a simple HTTP API and provides a simple web dashboard with analytics.

However, if you can't use Docker or need a more lightweight solution, you can use the [server library](./server.md) on Node and Bun or a [community library](./community.md) in other languages.