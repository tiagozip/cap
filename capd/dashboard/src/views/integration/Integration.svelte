<script>
import { onDestroy, untrack } from "svelte";
import {
  Button,
  CodeBlock,
  CopyButton,
  CopyText,
  Group,
  Icon,
  Row,
  Segmented,
} from "../../components/cap/index.js";
import {
  CopyCheck,
  createReceipt,
  PasswordEye,
} from "../../components/ui/index.js";
import { ago } from "../../lib/format.js";
import { app, openEvents } from "../../lib/state.svelte.js";
import { provideCommands, toast } from "../../lib/ui.svelte.js";
import { aiPrompt } from "../../polish/first-run/prompt.js";
import {
  currentSecret,
  loadSecret,
  toggleSecret,
} from "../config/secret.svelte.js";
import {
  endpointOf,
  loadWidgetFiles,
  widgetFiles,
  widgetScript,
} from "./embed.svelte.js";
import { highlight } from "./highlight.js";
import { watchProgress } from "./progress.svelte.js";
import { STACKS, stackCode } from "./stacks.js";

let { onreset } = $props();

const sk = app.key.siteKey;
const origin = location.origin;
const endpoint = endpointOf(sk);

loadWidgetFiles();

const widget = $derived(`${widgetScript()}

<form action="/submit" method="POST">
  <cap-widget required data-cap-api-endpoint="${endpoint}"></cap-widget>
  <button type="submit">Submit</button>
</form>`);

const remember = (key, list, fallback) => {
  try {
    const saved = localStorage.getItem(key);
    return list.some(([id]) => id === saved) ? saved : fallback;
  } catch {
    return fallback;
  }
};
const FRAMEWORKS = [
  ["html", "HTML"],
  ["react", "React"],
  ["vue", "Vue"],
  ["svelte", "Svelte"],
];
const FRAMEWORK_KEY = "cap_embed_framework";
let framework = $state(remember(FRAMEWORK_KEY, FRAMEWORKS, "html"));
let switched = $state(false);
const pickFramework = (id) => {
  switched = true;
  try {
    localStorage.setItem(FRAMEWORK_KEY, id);
  } catch {}
};

const install = $derived(`npm i cap-widget@${widgetFiles.widget}`);
const selfHostedLines = (indent) => {
  if (!widgetFiles.selfHosted) return "";
  const base = `${origin}/assets`;
  return `\n\n${indent}window.CAP_CUSTOM_WASM_URL = "${base}/cap_wasm_bg.wasm";\n${indent}window.CAP_CUSTOM_HASHWX_URL = "${base}/hashwx.wasm";`;
};
const component = $derived(
  {
    react: {
      filename: "Form.jsx",
      language: "jsx",
      code: `import "cap-widget";${selfHostedLines("")}

export default function Form() {
  return (
    <form action="/submit" method="POST">
      <cap-widget required data-cap-api-endpoint="${endpoint}" />
      <button type="submit">Submit</button>
    </form>
  );
}`,
    },
    vue: {
      filename: "Form.vue",
      language: "vue",
      code: `<script setup>
import "cap-widget";${selfHostedLines("")}
</${"script"}>

<template>
  <form action="/submit" method="POST">
    <cap-widget required data-cap-api-endpoint="${endpoint}" />
    <button type="submit">Submit</button>
  </form>
</template>`,
    },
    svelte: {
      filename: "Form.svelte",
      language: "svelte",
      code: `<script>
  import "cap-widget";${selfHostedLines("  ")}
</${"script"}>

<form action="/submit" method="POST">
  <cap-widget required data-cap-api-endpoint="${endpoint}"></cap-widget>
  <button type="submit">Submit</button>
</form>`,
    },
  }[framework],
);

const entry = $derived(currentSecret());
const shown = $derived(!!(entry.value && entry.revealed));
const envText = (value) => `CAP_SITE_KEY=${sk}\nCAP_SECRET=${value}\n`;
const envHtml = $derived(
  `<span class="text-muted-foreground">CAP_SITE_KEY=</span>${sk}\n<span class="text-muted-foreground">CAP_SECRET=</span><span class="${shown ? "" : "blur-[5px] select-none"} transition-[filter] duration-200">${shown ? entry.value : "sk-q9Xv2LmT8rWz4KcN7bHd1sYf"}</span>`,
);

const STACK_KEY = "cap_server_stack";
let stack = $state(remember(STACK_KEY, STACKS, "node"));
let stackSwitched = $state(false);
const pickStack = (id) => {
  stackSwitched = true;
  try {
    localStorage.setItem(STACK_KEY, id);
  } catch {}
};
const server = $derived(stackCode(stack, `${endpoint}siteverify`));

const aiPromptText = aiPrompt(sk, location.origin, endpoint);

const progress = watchProgress(sk);
onDestroy(progress.stop);
const live = progress.state;
let settled = $state(false);
$effect(() => {
  if (!live.loaded || settled) return;
  const t = setTimeout(() => {
    settled = true;
  }, 0);
  return () => clearTimeout(t);
});
const since = (ts) => live.now && ago(ts);
const FAILURES = {
  token_not_found: "the token was already used or never issued",
  token_expired: "the token expired",
};
const solveStatus = $derived.by(() => {
  if (!live.loaded) return null;
  const s = live.solve;
  if (!s) return { tone: "waiting", text: "Waiting for the first solve" };
  return {
    tone: "done",
    text: `Last solve ${since(s.ts)}${s.origin ? ` on ${s.origin}` : ""}`,
    events: ["type:redeem", `-origin:${location.host}`, "range:30d"],
  };
});
const verifyStatus = $derived.by(() => {
  if (!live.loaded) return null;
  const v = live.verify;
  if (!v)
    return live.solve
      ? {
          tone: "warn",
          text: "Your server isn't checking tokens yet, so bots can skip the widget",
        }
      : { tone: "waiting", text: "Waiting for your server" };
  if (v.outcome === "pass")
    return {
      tone: "done",
      text: `Last check passed ${since(v.ts)}`,
      events: ["type:siteverify", "range:30d"],
    };
  return {
    tone: "fail",
    events: ["type:siteverify", "outcome:fail", "range:30d"],
    text: `Last check failed ${since(v.ts)}, ${FAILURES[v.reason] ?? "the token was rejected"}`,
  };
});

const prompt = createReceipt(2000);

const copy = async (text, done) => {
  try {
    const value = typeof text === "function" ? await text() : text;
    if (!value) return;
    await navigator.clipboard.writeText(value);
    toast(done);
  } catch {
    toast("Couldn't copy", "error");
  }
};
$effect(() =>
  untrack(() =>
    provideCommands(() => [
      {
        id: "copy-secret",
        label: "Copy secret key",
        icon: "key",
        run: () => copy(loadSecret, "Secret key copied"),
      },
      {
        id: "copy-server-snippet",
        label: `Copy ${STACKS.find(([id]) => id === stack)?.[1]} verification code`,
        icon: "code",
        run: () => copy(server.code, "Code copied"),
      },
      {
        id: "copy-ai-prompt",
        label: "Copy prompt for an AI assistant",
        icon: "copy",
        run: () => copy(aiPromptText, "Prompt copied"),
      },
    ]),
  ),
);
let revealArmed = $state(false);
</script>

{#snippet status(st)}
  <p class="flex min-h-5 items-start pt-1 text-[13px] leading-5 text-pretty {st?.tone === 'warn' ? 'text-warning' : st?.tone === 'fail' ? 'text-destructive' : st?.tone === 'done' ? 'text-foreground/85' : 'text-muted-foreground'}">
    {#if st}
      <span class="min-w-0">
        {st.text}
        {#if st.events}
          <button type="button" class="ms-1.5 rounded-[4px] whitespace-nowrap text-foreground underline-offset-2 outline-none focus-visible:ring-2 focus-visible:ring-ring [@media(hover:hover)]:hover:underline" onclick={() => openEvents(st.events)}>View events</button>
        {/if}
      </span>
    {/if}
  </p>
{/snippet}

<Group
  id="cfgSetup"
  title="Add Cap to your site"
>
  {#snippet action()}
    <Button
      size="sm"
      onclick={async () => {
        try {
          await navigator.clipboard.writeText(aiPromptText);
        } catch {
          return;
        }
        prompt.mark();
      }}
    >
      <CopyCheck copied={prompt.copied} size={15} />
      Copy prompt for an AI assistant
      <span class="sr-only" role="status">{prompt.copied ? "Copied" : ""}</span>
    </Button>
  {/snippet}
  <Row label="Site key" help="Public, it goes in your page.">
    <div class="w-full md:max-w-sm"><CopyText value={sk} label="Copy site key" /></div>
  </Row>
  <Row label="Secret key" help="Private, only your server should have it.">
    {#if app.key?.secretOutdated || entry.error}
      <div class="flex w-full flex-col gap-2 md:max-w-sm">
        <p class="text-sm text-pretty {app.key?.secretOutdated ? 'text-destructive' : 'text-muted-foreground'}" role="status">
          {app.key?.secretOutdated
            ? "This secret is from an older Cap release and /siteverify rejects it. Reset it, then update your server."
            : entry.error}
        </p>
        <Button size="sm" class="self-start" onclick={() => onreset?.()}>Go to reset</Button>
      </div>
    {:else}
      <div class="flex h-9 w-full min-w-0 items-center gap-1 rounded-[10px] bg-muted pr-1 pl-3 md:max-w-sm">
        {#key shown}
          <code
            class="min-w-0 flex-1 truncate font-mono text-sm {revealArmed ? 'secret-swap' : ''}"
            title={shown ? entry.value : undefined}
            aria-live="polite"
          >
            {shown ? entry.value : `sk-${"•".repeat(20)}`}
          </code>
        {/key}
        <Button
          variant="ghost"
          size="sm"
          icon
          class="size-7 rounded-[6px]"
          aria-label={shown ? "Hide secret" : "Reveal secret"}
          aria-pressed={shown}
          disabled={entry.busy}
          onclick={() => {
            revealArmed = true;
            toggleSecret();
          }}
        >
          <PasswordEye revealed={shown} />
        </Button>
        <CopyButton text={loadSecret} label="Copy secret key" class="rounded-[6px]" />
      </div>
    {/if}
  </Row>
  <ol class="flex flex-col">
    <li class="step">
      <span class="step-marker" data-done={solveStatus?.tone === "done"} aria-hidden="true">
        {#key solveStatus?.tone === "done"}
          <span class="step-glyph {settled ? 'glyph-swap' : ''}">{#if solveStatus?.tone === "done"}<Icon name="check" size={12} />{:else}1{/if}</span>
        {/key}
      </span>
      <div class="flex min-w-0 flex-col gap-3">
        <div class="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
          <div class="flex min-w-0 flex-col gap-1">
            <h3 class="text-sm font-medium">Add the widget to your form</h3>
            <p class="text-sm text-pretty text-muted-foreground">
              {framework === "html" ? "Paste this into your page." : "Install the widget, then add it to your form."}
              <a
                class="text-foreground underline underline-offset-2 [@media(hover:hover)]:hover:text-primary"
                href="https://trycap.dev/guide/widget.html#usage"
                target="_blank"
                rel="noreferrer">More details...</a>
            </p>
            {@render status(solveStatus)}
          </div>
          <Segmented label="Framework" size="sm" options={FRAMEWORKS} bind:value={framework} onchange={pickFramework} />
        </div>
        {#key framework}
          <div class="flex min-w-0 flex-col gap-3 {switched ? 'code-swap' : ''}">
            {#if framework === "html"}
              <CodeBlock class="min-w-0" filename="index.html" language="html" download={false} code={widget} html={highlight(widget)} />
            {:else}
              <CodeBlock class="min-w-0" filename="Terminal" language="sh" download={false} lineNumbers={false} code={install} />
              <CodeBlock class="min-w-0" filename={component.filename} language={component.language} download={false} code={component.code} html={highlight(component.code)} />
            {/if}
          </div>
        {/key}
      </div>
    </li>
    <li class="step">
      <span class="step-marker" data-done={verifyStatus?.tone === "done"} aria-hidden="true">
        {#key verifyStatus?.tone === "done"}
          <span class="step-glyph {settled ? 'glyph-swap' : ''}">{#if verifyStatus?.tone === "done"}<Icon name="check" size={12} />{:else}2{/if}</span>
        {/key}
      </span>
      <div class="flex min-w-0 flex-col gap-3">
        <div class="flex flex-col gap-1">
          <h3 class="text-sm font-medium">Check the token on your server</h3>
          <p class="text-sm text-pretty text-muted-foreground">
            Send the <code class="font-mono text-[0.9em] text-foreground">cap-token</code> field to <code class="font-mono text-[0.9em] text-foreground">/siteverify</code> with your secret and only accept the form when
            <code class="font-mono text-[0.9em] text-foreground">success</code> is true.
          </p>
          {@render status(verifyStatus)}
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
                onclick={() => {
                  revealArmed = true;
                  toggleSecret();
                }}
              >
                <PasswordEye revealed={shown} />
              </button>
            {/snippet}
          </CodeBlock>
        {/if}
        <div class="flex min-w-0 flex-col gap-3">
          <div class="-mx-1 -my-1 overflow-x-auto px-1 py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <Segmented label="Server language" size="sm" class="w-max" options={STACKS} bind:value={stack} onchange={pickStack} />
          </div>
          {#key stack}
            <div class="flex min-w-0 flex-col {stackSwitched ? 'code-swap' : ''}">
              <CodeBlock class="min-w-0" filename={server.filename} language={server.language} download={false} lineNumbers={stack !== "curl"} code={server.code} html={highlight(server.code)} />
            </div>
          {/key}
        </div>
      </div>
    </li>
  </ol>
</Group>

<style>
  .step {
    position: relative;
    display: grid;
    grid-template-columns: 1.5rem minmax(0, 1fr);
    column-gap: 1rem;
    padding-block: 1.25rem;
  }

  .step:not(:last-child)::before {
    content: "";
    position: absolute;
    top: calc(1.25rem + 1.5rem + 0.125rem);
    bottom: -0.875rem;
    left: calc(0.75rem - 0.5px);
    width: 1px;
    background: var(--color-border);
    pointer-events: none;
  }

  .step-marker {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 1.5rem;
    height: 1.5rem;
    margin-top: -0.125rem;
    border-radius: 9999px;
    box-shadow: inset 0 0 0 1px var(--color-border);
    background: var(--color-muted);
    color: var(--color-muted-foreground);
    font-size: 0.75rem;
    font-weight: 500;
    font-variant-numeric: tabular-nums;
    line-height: 1;
    transition-property: background-color, color, box-shadow;
    transition-duration: 300ms;
    transition-timing-function: cubic-bezier(0.22, 1, 0.36, 1);
  }

  .step-marker[data-done="true"] {
    color: var(--color-success);
  }

  .step-glyph {
    display: grid;
    place-items: center;
  }


  @media (max-width: 40rem) {
    .step {
      grid-template-columns: minmax(0, 1fr);
    }

    .step::before,
    .step-marker {
      display: none;
    }

    .step + .step {
      border-top: 1px solid var(--color-border);
    }
  }

  @media (prefers-reduced-motion: no-preference) {
    .secret-swap {
      animation: secret-in 220ms cubic-bezier(0.22, 1, 0.36, 1);
    }


    .glyph-swap {
      animation: glyph-in 320ms cubic-bezier(0.22, 1, 0.36, 1);
    }
  }

  @keyframes glyph-in {
    from {
      opacity: 0;
      transform: scale(0.5);
      filter: blur(2px);
    }
  }


  @keyframes secret-in {
    from {
      opacity: 0;
      filter: blur(4px);
    }
  }

</style>
