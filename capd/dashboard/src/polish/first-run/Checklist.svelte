<script>
import { tick, untrack } from "svelte";
import { cubicOut } from "svelte/easing";
import { slide } from "svelte/transition";
import {
  Button,
  CodeBlock,
  Icon,
  Segmented,
} from "../../components/cap/index.js";
import {
  Card,
  CopyCheck,
  createReceipt,
  PasswordEye,
} from "../../components/ui/index.js";
import { api, liveEvents, qs } from "../../lib/api.js";
import { reasonLabel } from "../../lib/catalog.svelte.js";
import { latency } from "../../lib/format.js";
import { app, navigate, openEvents } from "../../lib/state.svelte.js";
import { undoable } from "../../lib/ui.svelte.js";
import {
  currentSecret,
  loadSecret,
  toggleSecret,
} from "../../views/config/secret.svelte.js";
import {
  endpointOf,
  loadWidgetFiles,
  widgetFiles,
  widgetScript,
} from "../../views/integration/embed.svelte.js";
import { highlight } from "../../views/integration/highlight.js";
import {
  FRAMEWORKS,
  frameworkComponent,
  installCommand,
  savedFramework,
  saveFramework,
} from "./embeds.js";
import { aiPrompt } from "./prompt.js";
import { LANGS, verifySnippet } from "./verify.js";

const siteKey = app.key.siteKey;
const store = `cap_onboarded:${siteKey}`;

let counts = $state(null);
let hidden = $state(
  (() => {
    try {
      return localStorage.getItem(store) === "1";
    } catch {
      return false;
    }
  })(),
);
let startedDone = $state(null);
let seenDone = $state(null);

loadWidgetFiles();

const widget = $derived(`${widgetScript()}

<cap-widget data-cap-api-endpoint="${endpointOf(siteKey)}"></cap-widget>`);

const prompt = createReceipt(2000);
const copyPrompt = async () => {
  try {
    await navigator.clipboard.writeText(
      aiPrompt(siteKey, location.origin, endpointOf(siteKey)),
    );
  } catch {
    return;
  }
  prompt.mark();
};

let framework = $state(savedFramework());
let frameworkSwitched = $state(false);
const component = $derived(
  framework === "html"
    ? null
    : frameworkComponent(
        framework,
        endpointOf(siteKey),
        widgetFiles,
        location.origin,
      ),
);

const LANG_KEY = "cap_verify_lang";
let lang = $state(
  (() => {
    try {
      const saved = localStorage.getItem(LANG_KEY);
      return LANGS.some(([id]) => id === saved) ? saved : "node";
    } catch {
      return "node";
    }
  })(),
);
let langSwitched = $state(false);
const server = $derived(verifySnippet(lang, location.origin));
const pickLang = (value) => {
  langSwitched = true;
  try {
    localStorage.setItem(LANG_KEY, value);
  } catch {}
};

const entry = $derived(currentSecret());
const shown = $derived(!!(entry.value && entry.revealed));
const envText = (value) => `CAP_SECRET=${value}\n`;
const envHtml = $derived(
  `<span class="text-muted-foreground">CAP_SECRET=</span><span class="${shown ? "" : "blur-[5px] select-none"} transition-[filter] duration-200">${shown ? entry.value : "sk-q9Xv2LmT8rWz4KcN7bHd1sYf"}</span>`,
);

const done = $derived([
  !!counts && counts.challenges + counts.solved + counts.verified > 0,
  !!counts && counts.solved + counts.verified > 0,
  !!counts && counts.verified > 0,
]);
const current = $derived(done.indexOf(false));
const finished = $derived(current === -1);

const STEPS = [
  "Add the widget to your page",
  "Solve it once",
  "Check the token on your server",
];

const calm = matchMedia("(prefers-reduced-motion: reduce)");
const reveal = (node) =>
  slide(node, { duration: calm.matches ? 0 : 320, easing: cubicOut });
const grow = (node) =>
  slide(node, { duration: calm.matches ? 0 : 520, easing: cubicOut });
const shrink = (node) => {
  const h = node.offsetHeight;
  return calm.matches
    ? { duration: 0 }
    : {
        duration: 520,
        easing: cubicOut,
        css: (t) => `height:${t * h}px;opacity:${t * t};overflow:hidden`,
      };
};
const collapse = (node) =>
  slide(node, { duration: calm.matches ? 0 : 200, easing: cubicOut });

const announce = $derived(
  finished
    ? "Setup complete. Your server verified its first token."
    : current > 0
      ? `${STEPS[current - 1]}: done.`
      : "",
);

const TYPES = ["challenge", "redeem", "siteverify"];
const RECENT = 30 * 60_000;
let receipts = $state([null, null, null]);
let problem = $state(null);
let problemAt = 0;

const newest = async (filters) =>
  (
    await api(
      "GET",
      `/keys/${siteKey}/events${qs({ range: "90d", f: filters, limit: 1 })}`,
    )
  )?.events?.[0] ?? null;

const hostOf = (origin) => {
  try {
    return new URL(origin).host;
  } catch {
    return origin;
  }
};

const client = (e) =>
  e.browser && e.os ? `${e.browser} on ${e.os}` : e.browser || e.os || "";

const receiptText = (i, e) => {
  if (!e) return "";
  if (i === 0) {
    const where = e.origin ? `From ${hostOf(e.origin)}` : "";
    const who = client(e);
    return where && who ? `${where} in ${who}` : where || who;
  }
  if (i === 1) {
    const who = client(e);
    if (!e.solve_ms) return who;
    return `Solved in ${latency(e.solve_ms)}${who ? ` by ${who}` : ""}`;
  }
  return "";
};

const HINTS = {
  token_not_found: "Each token can only be checked once.",
  token_expired: "Tokens expire 2 hours after solving.",
};

const lowerFirst = (t) =>
  /^[A-Z][a-z]/.test(t) ? `${t[0].toLowerCase()}${t.slice(1)}` : t;

const problemText = $derived(
  !problem || problem.step !== current
    ? ""
    : problem.step === 1
      ? `Cap rejected a solve: ${lowerFirst(reasonLabel(problem.event.reason))}.`
      : `Your server reached Cap, but the token was rejected: ${lowerFirst(reasonLabel(problem.event.reason))}.${HINTS[problem.event.reason] ? ` ${HINTS[problem.event.reason]}` : ""}`,
);

async function inspect() {
  for (const i of [0, 1]) {
    if (done[i] && receipts[i] === null)
      receipts[i] =
        (await newest([`type:${TYPES[i]}`, "outcome:pass"])) ?? false;
  }
  if (current !== 1 && current !== 2) {
    problem = null;
    return;
  }
  if (Date.now() - problemAt < 5000) return;
  problemAt = Date.now();
  const e = await newest([`type:${TYPES[current]}`, "-outcome:pass"]);
  problem =
    e?.reason && Date.now() - e.ts < RECENT
      ? { step: current, event: e }
      : null;
}

let busy = false;
async function check() {
  if (busy || document.hidden) return;
  busy = true;
  try {
    const res = await api(
      "GET",
      `/keys/${siteKey}/analytics${qs({ range: "90d" })}`,
    );
    if (res?.error || res?.storage === "off") return;
    counts = res.summary;
    startedDone ??= counts.verified > 0;
    if (startedDone) remember();
    seenDone ??= [...done];
    if (startedDone === false) await inspect();
  } finally {
    busy = false;
  }
}

const review = () => {
  dismiss();
  navigate({ view: "key", siteKey, tab: "protection" });
};

const took = $derived.by(() => {
  const created = Number(app.key?.created);
  if (!finished || !created) return "";
  const minutes = Math.max(1, Math.round((Date.now() - created) / 60_000));
  if (minutes > 120) return "";
  return minutes === 1 ? "1 minute" : `${minutes} minutes`;
});

let closeButton = $state(null);
$effect(() => {
  if (!finished) return;
  tick().then(() => {
    const lost =
      document.activeElement === document.body ||
      !document.activeElement?.isConnected;
    if (lost) closeButton?.focus({ preventScroll: true });
  });
});

const remember = () => {
  try {
    localStorage.setItem(store, "1");
  } catch {}
};

const dismiss = () => {
  hidden = true;
  remember();
};

const skip = () => {
  hidden = true;
  undoable({
    message: "Setup skipped for this key",
    commit: remember,
    undo: () => {
      hidden = false;
    },
  });
};

let stalled = $state(false);
$effect(() => {
  if (!watching || current !== 0) return;
  const timer = setTimeout(() => {
    stalled = true;
  }, 90_000);
  return () => clearTimeout(timer);
});

const watching = $derived(!hidden && startedDone !== true && !finished);

$effect(() => {
  if (!watching) return;
  untrack(check);
  const timer = setInterval(check, 5000);
  const stop = liveEvents(siteKey, check);
  return () => {
    clearInterval(timer);
    stop();
  };
});
</script>

{#if !hidden && startedDone === false}
  {#snippet tick(size, draw)}
    <svg class="tick" class:draw width={size} height={size} viewBox="0 0 256 256" fill="none" aria-hidden="true">
      <path d="M44 140l52 52L212 76" pathLength="1" stroke="currentColor" stroke-width="30" stroke-linecap="round" stroke-linejoin="round" />
    </svg>
  {/snippet}
  <div out:shrink>
  <Card variant="layered" role="region" aria-labelledby="onboardTitle" class="overflow-hidden">
    <p class="sr-only" role="status">{announce}</p>
    {#if finished}
      <div class="flex flex-col items-center gap-4 px-6 py-10 text-center" in:grow>
        <div class="relative grid size-12 place-items-center" aria-hidden="true">
          <span class="ring"></span>
          <span class="badge grid size-12 place-items-center rounded-full bg-success text-background">
            {@render tick(22, true)}
          </span>
        </div>
        <div class="copy flex flex-col gap-1.5">
          <h2 id="onboardTitle" class="text-base font-semibold text-balance">Your first token is verified</h2>
          <p class="max-w-md text-sm text-pretty text-muted-foreground">
            {took ? `Set up in ${took}.` : "Your form is protected."} The charts below fill in as people use it.
          </p>
        </div>
        <div class="cta flex flex-wrap justify-center gap-2">
          <Button variant="primary" bind:ref={closeButton} onclick={dismiss}>Close setup</Button>
          <Button onclick={review}>Review protection</Button>
        </div>
      </div>
    {:else}
      <div out:shrink>
      <div class="flex flex-col gap-1 px-5 pt-5">
        <div class="flex items-center justify-between gap-4">
          <h2 id="onboardTitle" class="text-base font-semibold">Set up this key</h2>
          <Button variant="ghost" size="sm" class="-my-0.5 -mr-2.5 text-muted-foreground focus-visible:text-foreground [@media(hover:hover)]:hover:text-foreground" onclick={skip}>Skip setup</Button>
        </div>
        <p class="text-sm text-pretty text-muted-foreground">Each step ticks off as soon as Cap sees it.</p>
      </div>
      <ol class="flex flex-col px-5 pt-4 pb-1">
        {#each STEPS as step, i}
          {@const isDone = done[i]}
          {@const active = i === current}
          <li class="step relative flex gap-3 pb-4" class:last={i === STEPS.length - 1} class:filled={isDone}>
            <span
              class="mark relative z-10 transition-colors duration-200 grid size-6 shrink-0 place-items-center rounded-full text-xs font-medium tabular-nums
                {isDone ? 'bg-success text-background' : active ? 'text-foreground' : 'border-2 border-foreground/10 text-muted-foreground'}"
              class:landed={isDone && !seenDone?.[i]}
              aria-hidden="true"
            >
              {#if active}
                <span class="spinner absolute inset-0 rounded-full border-2 border-foreground/15 border-t-foreground"></span>
              {/if}
              {#if isDone}
                {@render tick(14, !seenDone?.[i])}
              {:else}
                {i + 1}
              {/if}
            </span>
            <div class="flex min-w-0 flex-1 flex-col gap-2 pt-0.5">
              <h3 class="text-sm font-medium transition-colors duration-200 {isDone ? 'text-muted-foreground' : active ? 'text-foreground' : 'text-muted-foreground'}">
                {step}<span class="sr-only">{isDone ? ", done" : active ? ", waiting for this" : ""}</span>
              </h3>
              {#if isDone && receiptText(i, receipts[i])}
                <p class="receipt -mt-1.5 truncate text-[13px] text-muted-foreground" class:fresh={!seenDone?.[i]}>{receiptText(i, receipts[i])}</p>
              {/if}
              {#if active && problemText}
                <div class="problem flex items-start gap-2 rounded-lg bg-warning/10 px-3 py-2 text-sm text-pretty text-foreground" role="status" in:reveal out:collapse>
                  <Icon name="info" size={15} class="mt-0.5 shrink-0 text-warning" />
                  <span class="min-w-0 flex-1">{problemText} <button type="button" class="rounded-sm font-medium underline underline-offset-2 transition-colors duration-150 [@media(hover:hover)]:hover:text-warning" onclick={() => openEvents([`type:${problem.event.type}`, `outcome:${problem.event.outcome}`])}>See events</button></span>
                </div>
              {/if}
              {#if active}
                <div class="body flex min-w-0 flex-col gap-2" in:reveal out:collapse>
                {#if i === 0}
                  <p class="text-sm text-pretty text-muted-foreground">
                    {framework === "html" ? "Paste this into your page, with the widget inside your form." : "Install the widget, then add it to your form."}
                  </p>
                  <Segmented
                    label="Framework"
                    size="sm"
                    class="self-start"
                    options={FRAMEWORKS}
                    bind:value={framework}
                    onchange={(id) => {
                      frameworkSwitched = true;
                      saveFramework(id);
                    }}
                  />
                  {#key framework}
                    <div class="flex min-w-0 flex-col gap-2" class:swap={frameworkSwitched}>
                      {#if component}
                        <CodeBlock class="min-w-0" filename="Terminal" language="sh" download={false} lineNumbers={false} code={installCommand(widgetFiles)} />
                        <CodeBlock class="min-w-0" filename={component.filename} language={component.language} download={false} code={component.code} html={highlight(component.code)} />
                      {:else}
                        <CodeBlock class="min-w-0" filename="index.html" language="html" download={false} code={widget} html={highlight(widget)} />
                      {/if}
                    </div>
                  {/key}
                  <Button size="sm" class="self-start" onclick={copyPrompt}>
                    <CopyCheck copied={prompt.copied} size={15} />
                    Copy prompt for an AI assistant
                    <span class="sr-only" role="status">{prompt.copied ? "Copied" : ""}</span>
                  </Button>
                  {#if stalled}
                    <p class="stalled text-sm text-pretty text-muted-foreground">
                      Still nothing? Check your page's browser console. If the page sets a Content Security Policy, it needs
                      <a class="text-foreground underline underline-offset-2 transition-colors duration-150 [@media(hover:hover)]:hover:text-primary" href="https://trycap.dev/guide/widget.html#content-security-policy" target="_blank" rel="noreferrer">a few additions</a> for the widget.
                    </p>
                  {/if}
                {:else if i === 1}
                  <p class="text-sm text-pretty text-muted-foreground">
                    Open your page and complete the check.
                    {#if counts?.challenges}
                      Cap has issued <span class="text-foreground tabular-nums">{counts.challenges}</span> {counts.challenges === 1 ? "challenge" : "challenges"} so far.
                    {/if}
                  </p>
                {:else}
                  <p class="text-sm text-pretty text-muted-foreground">
                    Send the token to /siteverify with your secret key, and only accept the form when <code class="font-mono text-[0.9em] text-foreground">success</code> is true.
                    {#if counts?.solved}
                      <span class="text-foreground tabular-nums">{counts.solved}</span> {counts.solved === 1 ? "token is" : "tokens are"} waiting for your server.
                    {/if}
                  </p>
                  {#if app.key?.secretOutdated || entry.error}
                    <Button size="sm" class="self-start" onclick={() => navigate({ view: "key", siteKey, tab: "configuration" })}>Get the secret key</Button>
                  {:else}
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
                  <Segmented label="Server language" size="sm" class="self-start" options={LANGS} bind:value={lang} onchange={pickLang} />
                  {#key lang}
                    <div class="grid min-w-0" class:swap={langSwitched}>
                      <CodeBlock class="min-w-0" filename={server.filename} language={server.language} download={false} code={server.code} html={highlight(server.code)} />
                    </div>
                  {/key}
                {/if}
                </div>
              {/if}
            </div>
          </li>
        {/each}
      </ol>
      </div>
    {/if}
  </Card>
  </div>
{/if}

<style>
  @media (prefers-reduced-motion: no-preference) {
    .spinner {
      animation: spin 1.6s linear infinite;
    }
  }

  @keyframes spin {
    to {
      rotate: 360deg;
    }
  }

  .tick {
    display: block;
    overflow: visible;
  }

  .step:not(.last)::before,
  .step:not(.last)::after {
    content: "";
    position: absolute;
    top: 1.75rem;
    bottom: 0.25rem;
    left: calc(0.75rem - 1px);
    width: 2px;
    border-radius: 1px;
    background: var(--border);
  }

  .step:not(.last)::after {
    background: color-mix(in oklab, var(--success) 55%, transparent);
    transform: scaleY(0);
    transform-origin: top;
  }

  .step.filled::after {
    transform: scaleY(1);
  }

  .ring {
    position: absolute;
    inset: 0;
    border: 1.5px solid var(--success);
    border-radius: 50%;
    opacity: 0;
  }

  @media (prefers-reduced-motion: no-preference) {
    .step:not(.last)::after {
      transition: transform 480ms cubic-bezier(0.2, 0.7, 0.3, 1) 140ms;
    }

    .landed {
      animation: settle 460ms cubic-bezier(0.34, 1.4, 0.64, 1);
    }

    .tick.draw path {
      stroke-dasharray: 1;
      animation: draw 320ms cubic-bezier(0.65, 0, 0.35, 1) 90ms both;
    }

    .badge {
      animation: land 560ms cubic-bezier(0.34, 1.5, 0.64, 1) both;
    }

    .badge .tick.draw path {
      animation-duration: 380ms;
      animation-delay: 220ms;
    }

    .ring {
      animation: ring 900ms cubic-bezier(0.2, 0.7, 0.3, 1) 120ms;
    }
  }

  @keyframes land {
    from {
      scale: 0.5;
      opacity: 0;
    }
  }

  @keyframes settle {
    from {
      scale: 0.6;
    }
  }

  @keyframes draw {
    from {
      stroke-dashoffset: 1;
    }
  }

  @keyframes ring {
    from {
      opacity: 0.45;
      scale: 1;
    }
    to {
      opacity: 0;
      scale: 1.8;
    }
  }

</style>
