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

## Components

Cap consists mainly of the **widget** (can be used invisibly) and **server** (you can use the Standalone server instead). Alternatively, M2M is also supported and there's also a checkpoint middleware similar to Cloudflare.

This guide details how to use the usual setup. You can find guides on using the [Standalone server](./standalone.md), [M2M solver](./solver.md), and [checkpoint middleware](./middleware/index.md) in their respective sections.

## Client-side

Start by adding importing the Cap widget library from a CDN:

::: code-group

```html [jsdelivr]
<script src="https://cdn.jsdelivr.net/npm/@cap.js/widget"></script>
```

```html [unpkg]
<script src="https://unpkg.com/@cap.js/widget"></script>
```

:::

::: warning  
We're using the latest version of the library here for simplicity, but you should optimally pin a specific version to avoid breaking changes in the future.  
:::

Next, add the `<cap-widget>` component to your HTML.

```html
<cap-widget id="cap" data-cap-api-endpoint="<your cap endpoint>"></cap-widget>
```

::: info  
You'll need to start a server with the Cap API running at the same URL as specified in the `data-cap-api-endpoint` attribute. In the server-side example we provided, it's set to `/api`, but you can change this by replacing every `app.post('/api/...', ...)` to `app.post('/<endpoint>/...', ...)`.  
:::

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

Cap is fully self-hosted, so you'll need to start a server exposing an API for Cap's methods running at the same URL as specified in the `data-cap-api-endpoint` attribute. This is easy since we've already pre-made a library to help you generate and validate challenges for you.

At least Node 14 is required. Most modern Bun or Deno versions should work too. If you don't use JavaScript in your server, consider using the [Standalone](standalone.md) server.

Start by installing it:

::: code-group

```bash [bun]
bun add @cap.js/server
```

```bash [npm]
npm i @cap.js/server
```

```bash [pnpm]
pnpm i @cap.js/server
```

:::

::: tip  
Don't use JavaScript on your backend? Try the [Standalone mode](./standalone.md).
:::

Now, you'll need to change your server code to add the routes that Cap needs to work. Here's an example:

::: code-group

```js [elysia]
import { Elysia } from "elysia";
import Cap from "@cap.js/server";

const cap = new Cap({
  tokens_store_path: ".data/tokensList.json",
});

new Elysia()
  .post("/api/challenge", () => {
    return cap.createChallenge();
  })

  .post("/api/redeem", async ({ body, set }) => {
    const { token, solutions } = body;

    if (!token || !solutions) {
      set.status = 400;
      return { success: false };
    }

    return await cap.redeemChallenge({ token, solutions });
  })
  .listen(3000);

console.log(`🦊 Elysia is running at http://localhost:3000`);
```

```js [fastify]
import Fastify from "fastify";
import Cap from "@cap.js/server";

const fastify = Fastify();
const cap = new Cap({
  tokens_store_path: ".data/tokensList.json",
});

fastify.post("/api/challenge", (req, res) => {
  res.send(cap.createChallenge());
});

fastify.post("/api/redeem", async (req, res) => {
  const { token, solutions } = req.body;
  if (!token || !solutions) {
    return res.code(400).send({ success: false });
  }

  res.send(await cap.redeemChallenge({ token, solutions }));
});

fastify.listen({ port: 3000, host: "0.0.0.0" }).then(() => {
  console.log("Server is running on http://localhost:3000");
});
```

```js [bun.serve]
import Cap from "@cap.js/server";

const cap = new Cap({
  tokens_store_path: ".data/tokensList.json",
});

Bun.serve({
  port: 3000,
  routes: {
    "/api/challenge": {
      POST: () => {
        return Response.json(cap.createChallenge());
      },
    },
    "/api/redeem": {
      POST: async (req) => {
        const body = await req.json();
        const { token, solutions } = body;

        if (!token || !solutions) {
          return Response.json({ success: false }, { status: 400 });
        }

        return Response.json(await cap.redeemChallenge({ token, solutions }));
      },
    },
  },
});

console.log(`Server running at http://localhost:3000`);
```

```js [express]
import express from "express";
import Cap from "@cap.js/server";

const app = express();
app.use(express.json());

const cap = new Cap({
  tokens_store_path: ".data/tokensList.json",
});

app.post("/api/challenge", (req, res) => {
  res.json(cap.createChallenge());
});

app.post("/api/redeem", async (req, res) => {
  const { token, solutions } = req.body;
  if (!token || !solutions) {
    return res.status(400).json({ success: false });
  }
  res.json(await cap.redeemChallenge({ token, solutions }));
});

app.listen(3000, () => {
  console.log("Listening on port 3000");
});
```

:::

### Token validation

Once the token is generated and captured, you can use it later to validate the user's identity. You can do this by calling `await cap.validateToken` in your server-side code:

```js
await cap.validateToken("..."); // returns { success: Boolean }
```

Note that the token will immediately be deleted after this. To prevent this, use `await cap.validateToken("...", { keepToken: true })`.