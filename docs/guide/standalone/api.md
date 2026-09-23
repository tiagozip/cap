---
description: "REST API reference for Cap Standalone: create and manage site keys and sessions for the self-hosted, open-source CAPTCHA using bearer-authenticated requests."
---

# API

Standalone mode offers a simple API for creating, viewing, and managing keys and sessions. First, log in to your Cap Standalone dashboard and get an API key from **Settings** → **API Keys**. Give it a name and tap "Create".

Once your key is created, save it somewhere safe, as you won't be able to see it again.

Now, you can use this key to make API requests to your Standalone server. For each request you make, you'll need to include the `Authorization` header with your API key, like this:

```http
Authorization: Bot YOUR_API_KEY
```

You can see a list of all available API endpoints and their required bodies by going to `http://localhost:3000/swagger`

## Scoped API keys

By default, an API key can read and change every site key on the instance. When creating a key from **Settings** → **API keys**, you can restrict it:

- **Site key access**: pick specific site keys. The key can then only call the `/server/keys/:siteKey/...` endpoints for those keys, and `GET /server/keys` only lists them. Every other endpoint, including the settings endpoints, returns `403`.
- **Read-only**: only `GET` requests are allowed. Creating, updating, rotating or deleting anything returns `403`.

Both restrictions can be combined. A read-only key scoped to a single site key is safe to hand to the owner of that site, for example to pull their own stats into their own dashboard.

The same options are available when creating a key through the API:

```http
POST /server/settings/apikeys
Content-Type: application/json

{ "name": "acme stats", "siteKeys": ["<site key>"], "readonly": true }
```

Keys created before this option existed keep full access.

## Share links

A share link is a public, read-only stats page for a single site key. Open the key in the dashboard, go to **Configuration** → **Share links** and create one. Anyone who has the link sees the challenge and verification counts, the activity chart and the location, network, platform and OS breakdowns for that key. They can't see the key's configuration, secret or block rules, and they can't change anything.

Links can be given a label and an expiry date, and can be revoked at any time from the same section. The token lives in the URL fragment (after the `#`), so the page request itself never carries it and it doesn't leak through referer headers. The two API calls the page makes do include the token in their path, so a reverse proxy that logs request paths will see it.

If you want to embed the numbers somewhere else instead of using the page, the link's token works against two unauthenticated, rate-limited endpoints:

```http
GET /share/:token?chartDuration=last7days
GET /share/:token/geo-stats
```

`chartDuration` accepts `today`, `yesterday`, `last7days`, `last28days`, `last91days` or `alltime`.

When creating a link through `POST /server/keys/:siteKey/shares`, `expiresIn` is in seconds. Omitting it or passing `0` creates a link that never expires.
