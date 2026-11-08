<script>
import {
  Button,
  CodeBlock,
  CopyButton,
  CopyText,
  Group,
  Icon,
  Row,
} from "../../components/cap/index.js";
import { PasswordEye } from "../../components/ui/index.js";
import { app } from "../../lib/state.svelte.js";
import {
  currentSecret,
  loadSecret,
  toggleSecret,
} from "../config/secret.svelte.js";
import { endpointOf, loadWidgetFiles, widgetScript } from "./embed.svelte.js";
import { highlight } from "./highlight.js";

let { onreset } = $props();

const sk = app.key.siteKey;
const origin = location.origin;
const endpoint = endpointOf(sk);

loadWidgetFiles();

const widget = $derived(`${widgetScript()}

<cap-widget data-cap-api-endpoint="${endpoint}"></cap-widget>`);

const entry = $derived(currentSecret());
const shown = $derived(!!(entry.value && entry.revealed));
const envText = (value) => `CAP_SITE_KEY=${sk}\nCAP_SECRET=${value}\n`;
const envHtml = $derived(
  `<span class="text-muted-foreground">CAP_SITE_KEY=</span>${sk}\n<span class="text-muted-foreground">CAP_SECRET=</span><span class="${shown ? "" : "blur-[5px] select-none"} transition-[filter] duration-200">${shown ? entry.value : "sk-q9Xv2LmT8rWz4KcN7bHd1sYf"}</span>`,
);

const server = `const res = await fetch("${origin}/siteverify", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ secret: process.env.CAP_SECRET, response: token }),
});
const { success } = await res.json();`;

const aiPrompt = `Implement Cap (self-hosted CAPTCHA) in this codebase, or migrate from the existing CAPTCHA solution if one is present.

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

Wait for nothing and proceed once the plan is written.

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
2. Double-check your secret, endpoint, and that you're sending the token in the right field. Consult the docs
3. Instruct the user to open an issue on GitHub: https://github.com/tiagozip/cap`;

let copied = $state(false);
let copyTimer;
</script>

<Group
  id="cfgSetup"
  title="Add Cap to your site"
>
  {#snippet action()}
    <Button
      size="sm"
      onclick={async () => {
        try {
          await navigator.clipboard.writeText(aiPrompt);
        } catch {
          return;
        }
        copied = true;
        clearTimeout(copyTimer);
        copyTimer = setTimeout(() => (copied = false), 2000);
      }}
    >
      <Icon name={copied ? "check" : "copy"} size={14} />
      {copied ? "Copied prompt" : "Copy prompt for an AI assistant"}
    </Button>
  {/snippet}
  <Row label="Site key" help="Public. It goes in your page next to the widget.">
    <div class="w-full md:max-w-sm"><CopyText value={sk} label="Copy site key" /></div>
  </Row>
  <Row label="Secret key" help="Private. Your server sends it to /siteverify. Only admins can reveal it.">
    {#if app.key?.secretOutdated || entry.error}
      <div class="flex w-full flex-col gap-2 md:max-w-sm">
        <p class="text-sm text-pretty {app.key?.secretOutdated ? 'text-destructive' : 'text-muted-foreground'}" role="status">
          {app.key?.secretOutdated
            ? "This secret is from an older Cap release, and /siteverify rejects it. Reset it, then put the new secret in your server's environment."
            : entry.error}
        </p>
        <Button size="sm" class="self-start" onclick={() => onreset?.()}>Go to reset</Button>
      </div>
    {:else}
      <div class="flex h-9 w-full min-w-0 items-center gap-1 rounded-[10px] bg-muted pr-1 pl-3 md:max-w-sm">
        <code class="min-w-0 flex-1 truncate font-mono text-sm" aria-live="polite">
          {shown ? entry.value : `sk-${"•".repeat(20)}`}
        </code>
        <Button
          variant="ghost"
          size="sm"
          icon
          class="size-7 rounded-[6px]"
          aria-label={shown ? "Hide secret" : "Reveal secret"}
          aria-pressed={shown}
          disabled={entry.busy}
          onclick={toggleSecret}
        >
          <PasswordEye revealed={shown} />
        </Button>
        <CopyButton text={loadSecret} label="Copy secret key" class="rounded-[6px]" />
      </div>
    {/if}
  </Row>
  <ol class="flex flex-col divide-y divide-border">
    <li class="flex flex-col gap-3 py-4">
      <div class="flex flex-col gap-1">
        <h3 class="text-sm font-medium">1. Add the widget to your form</h3>
        <p class="text-sm text-pretty text-muted-foreground">
          Paste this into the page you want to protect. The
          <a
            class="text-foreground underline underline-offset-2 [@media(hover:hover)]:hover:text-primary"
            href="https://trycap.dev/guide/widget.html#usage"
            target="_blank"
            rel="noreferrer">widget guide</a
          >
          covers React, Vue and invisible mode.
        </p>
      </div>
      <CodeBlock class="min-w-0" filename="index.html" language="html" download={false} code={widget} html={highlight(widget)} />
    </li>
    <li class="flex flex-col gap-3 py-4">
      <div class="flex flex-col gap-1">
        <h3 class="text-sm font-medium">2. Check the token on your server</h3>
        <p class="text-sm text-pretty text-muted-foreground">
          Put your keys in the server's environment, then send each token to Cap and only accept the form when
          <code class="font-mono text-[0.9em] text-foreground">success</code> is true.
        </p>
      </div>
      {#if !entry.error}
        <CodeBlock
          class="min-w-0"
          filename=".env"
          language="env"
          download={false}
          lineNumbers={false}
          code={envText(shown ? entry.value : "")}
          html={envHtml}
          copyText={async () => {
            const value = await loadSecret();
            return value ? envText(value) : null;
          }}
        >
          {#snippet actions(action)}
            <button
              type="button"
              class={action}
              aria-label={shown ? "Hide secret" : "Reveal secret"}
              aria-pressed={shown}
              disabled={entry.busy}
              onclick={toggleSecret}
            >
              <PasswordEye revealed={shown} />
            </button>
          {/snippet}
        </CodeBlock>
      {/if}
      <CodeBlock class="min-w-0" filename="server.js" language="js" download={false} code={server} html={highlight(server)} />
    </li>
  </ol>
</Group>
