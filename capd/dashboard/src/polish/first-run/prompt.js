export const aiPrompt = (
  sk,
  origin,
  endpoint,
) => `Implement Cap (self-hosted CAPTCHA) in this codebase, or migrate from the existing CAPTCHA solution if one is present.

## Configuration

- Site key: \`${sk}\`
- Server URL: \`${origin}\`
- API endpoint: \`${endpoint}\`

## Step 1: Read the docs

Fetch these first:
- https://trycap.dev/llms.txt
- https://trycap.dev/agent.md

## Step 2: Plan before coding

Before writing code, output a short plan covering:
1. What CAPTCHA solution (if any) exists today and every place it's used (frontend mounts, backend verification, env vars, config files)
2. Which Cap mode fits best: standard widget, invisible, or floating (check the docs for tradeoffs)
3. File-by-file change list
4. How you'll verify it works end-to-end

Don't wait for approval, proceed once the plan is written.

## Step 3: Migration rules (if replacing an existing solution)

- Remove the old library, scripts, env vars, and verification calls completely. No dead code.
- Match the old solution's UX placement (same forms, same trigger points).
- Preserve existing error handling and failure UX.
- Update any tests, mocks, or fixtures that referenced the old CAPTCHA.

## Step 4: Implement

- Secrets go in env vars, never hardcoded.
- Token must be verified server-side on every protected route. Frontend-only checks don't count.
- Handle: missing token, invalid token, network failure to the Cap server, expired token.

## Step 5: Test it

Execute a basic test to make sure everything works. Check valid token, missing token, and invalid token cases.

If anything fails and you are sure it's Cap's issue:

1. Double-check that you're using the latest widget and capd version.
2. Double-check your secret, endpoint, and that you're sending the token in the right field. Consult the docs.
3. Instruct the user to open an issue on GitHub: https://github.com/tiagozip/cap`;
