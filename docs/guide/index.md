---
outline: deep
---

# Quickstart

Cap is a modern, lightweight, and self-hosted CAPTCHA alternative using SHA-256 proof-of-work and instrumentation challenges.

Unlike traditional CAPTCHAs, Cap's fast, unobtrusive, has no telemetry or tracking, and uses accessible proof-of-work instead of annoying visual puzzles.

We've found that Cap offers a better balance for site admins than big-tech alternatives because **it puts the levers of control in your hands, not a third party.** You decide the difficulty, you own the data, and you never pay per-request fees.

Cap consists of a client-side widget, which solves challenges and displays the checkbox, and a server-side component, which generates challenges and redeems solutions.

<Demo />

## Widget

In order for your users to be able to solve Cap challenges, you'll need to install the widget library to either use the [invisible mode](./invisible.md) or add the checkbox component.

You can find example snippets for multiple frameworks on the [widget docs](./widget.md#usage). We're gonna assume a basic vanilla implementation here for simplicity

Add the following to your website's HTML:

```html
<script src="https://cdn.jsdelivr.net/npm/@cap.js/widget"></script>
<!-- we recommend pinning a version in production -->
```

Next, you can either add the widget component directly to your code:

```html
<cap-widget data-cap-api-endpoint="https://<your-instance>/<site-key>/"></cap-widget>
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

Alternatively, you can wrap the widget in a `<form></form>`, where Cap will automatically submit the token alongside other form data as `cap-token`.

You can also use get a token programmatically without displaying the widget by using the [invisible mode](./invisible.md):

```js
const cap = new Cap({
  apiEndpoint: "https://<your-instance>/<site-key>/",
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

For most use cases, **we recommend using the Docker [Standalone server](./standalone/index.md)**, as it exposes a simple HTTP API and provides a simple web dashboard with analytics. It also supports our JavaScript instrumentation challenges, which force bots to use real browsers, along with optional headless browser detection.

However, if you can't use Docker or need a more lightweight solution, you can use the [server library](./server.md) on Node and Bun or a [community library](./community.md) in other languages.
