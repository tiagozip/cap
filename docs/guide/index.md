---
outline: deep
---

# Quickstart

[[toc]]

## Requirements

- **Server-side library:** At least Node 14. Most modern Bun or Deno versions should work too. If you're using Glitch, make sure to set Node 14 or higher in your `engines` field in `package.json`. If you don't use a JavaScript runtime, consider using the [Standalone](standalone.md) server.

- **Client-side widget:** All modern browsers should be supported. A [compatibility version](widget.md#compatibility-version) is available too.

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
We're using the latest version of the library here for keeping stuff simple, but you should optimally pin a specific version to avoid breaking changes in the future.  
:::

Next, add the `<cap-widget>` component to your HTML.

```html
<cap-widget
  id="cap"
  data-cap-api-endpoint="<your cap api endpoint>"
></cap-widget>
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

Cap is fully self-hosted, so you'll need to start a server with the Cap API running at the same URL as specified in the `data-cap-api-endpoint` attribute. This is easy since we've already pre-made a library to help you generate and validate challenges for you.

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
It is recommended to use at least Node.js 14 or Bun 1.0.0. You might experience multiple issues on older versions of these runtimes.  

Additionally, always assume that Cap might fail to protect you. **Always** add extra security measures such as ratelimits. It's also important to keep in mind that Cap doesn't stop potential vulnerabilities in your app.  
:::

Now, you'll need to change your server code to add the routes that Cap needs to work. Here's an example:

::: code-group

```js [Elysia]
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

```js [Fastify]
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

```js [Bun.serve]
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

```js [Express]
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

### Token Validation

Once the token is generated and captured, you can use it later to validate the user's identity. You can do this by calling `await cap.validateToken` in your server-side code:

```js
await cap.validateToken("..."); // returns { success: Boolean }
```

Note that the token will immediately be deleted after this. To prevent this, use `await cap.validateToken("...", { keepToken: true })`.
