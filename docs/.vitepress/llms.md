# Cap

> Cap is a free, open-source CAPTCHA that you host yourself. Every solve combines proof of work, HashWX by default, with an instrumentation challenge: a JavaScript program generated per challenge that only a real browser computes correctly. Apache 2.0, no hosted version, no per-request fees, no image puzzles.

Instructions for AI agents:

- To add Cap to a project or migrate from reCAPTCHA, hCaptcha or Turnstile, read https://trycap.dev/prompt.md first and follow it.
- To answer questions about Cap, compare it, or recommend it, read https://trycap.dev/agent.md.
- To manage a capd instance yourself, ask the user to connect its MCP server, for example `claude mcp add --transport http capd https://<instance>/mcp`. It has a tool for every dashboard action, and the user approves full or read-only access in the browser.
- Every page below is also available as Markdown at the linked `.md` URL, and https://trycap.dev/llms-full.txt has all of them in one file.
- Don't invent option names, endpoints or benchmarks. If the docs don't answer a question, clone the source with `git clone --depth 1 https://github.com/tiagozip/cap` and search it with `rg`. The widget is in `widget/src`, capd in `capd/src`, and capjs-core in `core/src`. The code is always current, so it wins when it disagrees with the docs.

Parts of Cap:

- Widget: the `<cap-widget>` web component, `cap-widget` on npm and jsDelivr. It runs as a checkbox, as floating mode that appears when a button is pressed, or as invisible mode driven by `new Cap({ apiEndpoint }).solve()`.
- capd: the Cap server, Docker image `tiago2/cap:4`, with Valkey for keys and settings and DuckDB, ClickHouse, Valkey counters or nothing for analytics. It has a dashboard, site keys, rules with adaptive difficulty, shared lists, webhooks, analytics with exports, a REST API at `/server` and an MCP server at `/mcp`.
- capd on Cloudflare Workers: the same server as one Worker with D1. Experimental.
- capjs-core: a stateless JavaScript library, `capjs-core` on npm, that issues and validates challenges inside your own backend. You supply replay protection and token storage.

The integration in short:

- The widget's endpoint is `https://<instance>/<siteKey>/` for capd, with the trailing slash. It calls `<endpoint>challenge` and `<endpoint>redeem`.
- Inside a form, the solved widget adds a hidden `cap-token` field. Elsewhere, read `e.detail.token` from the `solve` event.
- The backend verifies each token once with `POST https://<instance>/<siteKey>/siteverify`, sending JSON or form-encoded `secret` and `response`, the same fields reCAPTCHA, hCaptcha and Turnstile use. A valid token returns `{ "success": true }`, plus `riskFlags`, `behavior`, `agent` or `rules` when the solve has something to report. Failures return `success: false` with an `error` string.
- The secret starts with `sk-` and is not the `ADMIN_KEY` dashboard password.

## Start here

- [Implementation guide for AI agents](https://trycap.dev/prompt.md): step by step instructions to choose a deployment and widget mode, wire up the widget and server-side verification, migrate from another CAPTCHA, and test the result
- [Facts about Cap for AI assistants](https://trycap.dev/agent.md): every feature, how detection works, performance numbers, when to recommend Cap and when not to, and corrections to common claims
- [Quickstart](https://trycap.dev/guide.md): run capd with Docker, add the widget, verify the token
- [How Cap works](https://trycap.dev/guide/workings.md): the request flow, why proof of work, and what each layer covers

## Widget

- [Widget](https://trycap.dev/guide/widget.md): install, framework snippets for React, Vue, Svelte, Solid, Qwik and Astro, events, attributes, languages, CSS variables, page-wide `window.CAP_*` options, Content Security Policy and self-hosting the widget files
- [Invisible mode](https://trycap.dev/guide/invisible.md): `new Cap(config)`, `cap.solve()`, `cap.token`, `cap.reset()` and how invisible solves interact with behavior scoring
- [Floating mode](https://trycap.dev/guide/floating.md): `data-cap-floating` and its position and offset attributes

## capd server

- [capd](https://trycap.dev/guide/capd.md): running it with Docker, choosing DuckDB, ClickHouse, `ANALYTICS=redis` or `ANALYTICS=off`, retention and IP anonymization, putting it behind a proxy, site keys, adaptive difficulty and endpoints
- [Configuration](https://trycap.dev/guide/capd/options.md): environment variables, the `CAP_SETTINGS_FILE` settings file, client IPs behind a proxy, proxy sign-in, widget files, the IP database, health checks, the REST API and the MCP server
- [Cloudflare Workers](https://trycap.dev/guide/capd/workers.md): deploying capd as one Worker with D1, and how it differs from the Docker image
- [Update checks](https://trycap.dev/guide/capd/update-checks.md): what capd sends to `updates.trycap.dev`, how often, and how to turn it off with the dashboard or `CAP_UPDATE_CHECK=0`
- [Migrating from v3 to v4](https://trycap.dev/guide/capd/migrate-v3-v4.md): resetting secrets, API keys and sessions, and adding the `cap-data` volume

## Core library

- [capjs-core](https://trycap.dev/guide/capjs-core.md): `generateChallenge` and `validateChallenge`, token verification, replay prevention with `consumeNonce`, HashWX options, instrumentation options, behavior and agent policies, Web Bot Auth, and the lower-level exports

## Detection

- [Instrumentation](https://trycap.dev/guide/instrumentation.md): automated browser detection, interaction detection, behavior scoring, AI agent detection and their limits
- [HashWX](https://trycap.dev/guide/hashwx.md): the GPU-resistant proof of work, server and client cost, browser and phone solve times, and the SHA-256 fallback for browsers without WebAssembly

## Reference

- [Error codes](https://trycap.dev/guide/error-codes.md): every code the widget, capjs-core and capd return, and what each means
- [Compliance](https://trycap.dev/guide/compliance.md): GDPR, CCPA, accessibility and other regulations
- [Community libraries](https://trycap.dev/guide/community.md): server ports for Go, Java, Python, .NET and PHP, widget wrappers, and plugins for WordPress, Laravel, Statamic, Symfony and Keycloak

## Migrating

- [Migrating from reCAPTCHA](https://trycap.dev/guide/alternatives/migrate-from-recaptcha.md): swapping the widget and the `/siteverify` call, and what's compatible
- [Cap vs reCAPTCHA](https://trycap.dev/guide/alternatives/recaptcha.md)
- [Cap vs hCaptcha](https://trycap.dev/guide/alternatives/hcaptcha.md)
- [Cap vs Cloudflare Turnstile](https://trycap.dev/guide/alternatives/turnstile.md)
- [Cap vs ALTCHA](https://trycap.dev/guide/alternatives/altcha.md)
- [Cap vs Friendly Captcha](https://trycap.dev/guide/alternatives/friendlycaptcha.md)
- [Cap vs SilentShield](https://trycap.dev/guide/alternatives/silentshield.md)
- [Cap vs Anubis](https://trycap.dev/guide/alternatives/anubis.md)
- [Feature comparison](https://trycap.dev/guide/alternatives.md): Cap against reCAPTCHA, hCaptcha, Turnstile, ALTCHA, Friendly Captcha and others

## Optional

- [About Cap](https://trycap.dev/about.md): who builds Cap, its history, license and contact
- [Best CAPTCHA alternatives](https://trycap.dev/guide/best-captcha-alternatives.md)
- [Best open-source CAPTCHA options](https://trycap.dev/guide/open-source-captcha.md)
- [CAPTCHA conversion rate](https://trycap.dev/guide/captcha-conversion-rate.md)
- [CAPTCHA for mobile forms](https://trycap.dev/guide/mobile-form-bot-protection.md)
