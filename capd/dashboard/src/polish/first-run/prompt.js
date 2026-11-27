export const aiPrompt = (
  sk,
  origin,
  endpoint,
) => `Add Cap, a self-hosted CAPTCHA, to this codebase. If the project already uses reCAPTCHA, hCaptcha, Turnstile or another CAPTCHA, replace it.

## This Cap server

The Cap server is already running, so don't deploy another one.

- Cap server: \`${origin}\`
- Site key: \`${sk}\`
- Widget endpoint: \`${endpoint}\`
- Verify URL: \`${endpoint}siteverify\`

The site key is public. The secret key starts with \`sk-\` and must stay on the server. Ask me for it, since I can copy it from the key's Settings page under "Add Cap to your site". Never use the dashboard's ADMIN_KEY in its place.

Store these as environment variables in the project's usual secret store: \`CAP_URL=${origin}\`, \`CAP_SITE_KEY=${sk}\` and \`CAP_SECRET\`.

## 1. Read the guide

Fetch https://trycap.dev/prompt.md and follow it. Skip its deployment and credential steps, since this server and site key already exist. https://trycap.dev/llms.txt indexes the rest of the docs. Don't guess option names or endpoints.

## 2. Audit, then plan

Before you write code, write a short plan that covers:

1. Any existing CAPTCHA and every place it's used: script tags, components, form fields, backend verification, environment variables, CSP entries, tests and mocks.
2. If there's none, the endpoints worth protecting: sign up, sign in, password reset and other email or SMS sends, contact forms, public write endpoints, and unauthenticated routes that call paid APIs.
3. The widget mode for each place: the standard checkbox for forms, floating mode when a checkbox doesn't fit the design, or invisible mode for actions without a form.
4. A file-by-file change list.
5. How you'll prove it works.

Then go ahead without waiting for approval, unless there is no CAPTCHA today and you need me to confirm which endpoints to protect.

## 3. Implement

Frontend:

- Load the widget from \`https://cdn.jsdelivr.net/npm/cap-widget@<version>\` with a pinned version, or \`npm install cap-widget\`.
- Use \`<cap-widget required data-cap-api-endpoint="${endpoint}"></cap-widget>\`. Keep the trailing slash.
- Inside a form, the token arrives in a hidden \`cap-token\` field. Elsewhere, read \`e.detail.token\` from the \`solve\` event, or call \`await new Cap({ apiEndpoint: "${endpoint}" }).solve()\` in invisible mode.
- If the site sends a nonce-based Content Security Policy, set \`window.CAP_SCRIPT_NONCE\` and \`window.CAP_CSS_NONCE\` before the widget loads, and allow \`'wasm-unsafe-eval'\`, \`worker-src blob:\` and \`${origin}\` in \`connect-src\`.

Backend, on every protected route, before any side effect:

- POST JSON \`{ "secret": CAP_SECRET, "response": token }\` to \`${endpoint}siteverify\`.
- Accept the request only when the response has \`"success": true\`. A missing token, a failed check, a timeout or a network error all reject the request.
- Verify each token once. Tokens are single-use and last 2 hours.
- Keep the existing error responses and UX.

When migrating, remove the old provider completely: scripts, packages, verification calls, environment variables, CSP entries, tests and mocks. Tell me which old secrets I can revoke.

## 4. Prove it works

1. The widget solves on the page with no console errors.
2. A real submission still works.
3. A request with no token, and one with a junk token, are both rejected.
4. Verifying the same token twice fails the second time.
5. If ${origin} is unreachable, protected requests are rejected.

If a check fails, look up the error code at https://trycap.dev/guide/error-codes and the troubleshooting table in https://trycap.dev/prompt.md. If ${origin} doesn't allow the site's origin, ask me to add it under the key's Settings, Access, Only allow these websites. If you're sure the bug is in Cap, ask me to open an issue at https://github.com/tiagozip/cap/issues.

When you're done, list the files you changed, the environment variables I need to set in each environment, and anything you couldn't test.`;
