<script>
import { untrack } from "svelte";
import {
  Button,
  CodeBlock,
  Dialog,
  Icon,
  Input,
  Segmented,
  Select,
  Slider,
  Spinner,
} from "../../components/cap/index.js";
import { CopyButton } from "../../components/ui/index.js";
import { app } from "../../lib/state.svelte.js";
import {
  endpointOf,
  loadWidget,
  loadWidgetFiles,
  widgetScript,
} from "../integration/embed.svelte.js";
import { highlight } from "../integration/highlight.js";

let { open = $bindable(false), dirty = false, onsave } = $props();

const COLORS = [
  ["--cap-background", "Background", "#fdfdfd"],
  ["--cap-color", "Text", "#212121"],
  ["--cap-border-color", "Border", "#dddddd8f"],
  ["--cap-checkbox-background", "Checkbox", "#fafafa91"],
  ["--cap-spinner-color", "Spinner", "#000000"],
  ["--cap-spinner-background-color", "Spinner track", "#eeeeee"],
  ["--cap-focus-ring", "Focus ring", "#0066cc"],
];

const SIZES = [
  ["--cap-widget-width", "Width", 260, 200, 400, "px"],
  ["--cap-widget-height", "Height", 58, 44, 90, "px"],
  ["--cap-border-radius", "Corner radius", 14, 0, 30, "px"],
  ["--cap-widget-padding", "Padding", 14, 4, 24, "px"],
  ["--cap-gap", "Space after checkbox", 15, 4, 30, "px"],
  ["--cap-checkbox-size", "Checkbox size", 25, 16, 36, "px"],
  ["--cap-checkbox-border-radius", "Checkbox radius", 6, 0, 18, "px"],
  ["--cap-spinner-thickness", "Spinner thickness", 3, 1, 6, ""],
];

const LABELS = [
  ["initial-state", "Prompt", "Verify you're human"],
  ["verifying-label", "While solving", "Verifying..."],
  ["solved-label", "When solved", "You're a human"],
  ["error-label", "On error", "Error. Try again."],
];

const LANGS = [
  ["", "Visitor's browser language"],
  ["en", "English"],
  ["ar", "Arabic"],
  ["zh-cn", "Chinese (Simplified)"],
  ["fr", "French"],
  ["de", "German"],
  ["hi", "Hindi"],
  ["ja", "Japanese"],
  ["pt", "Portuguese"],
  ["ru", "Russian"],
  ["es", "Spanish"],
];

const defaults = () => ({
  colors: Object.fromEntries(COLORS.map(([k, , d]) => [k, d])),
  sizes: Object.fromEntries(SIZES.map(([k, , d]) => [k, d])),
  labels: Object.fromEntries(LABELS.map(([k]) => [k, ""])),
  lang: "",
  font: "",
});

const PRESETS = [
  ["light", "Light", {}],
  [
    "dark",
    "Dark",
    {
      "--cap-background": "#18181b",
      "--cap-color": "#f4f4f5",
      "--cap-border-color": "#ffffff1f",
      "--cap-checkbox-background": "#ffffff0d",
      "--cap-spinner-color": "#f4f4f5",
      "--cap-spinner-background-color": "#ffffff26",
      "--cap-focus-ring": "#60a5fa",
    },
  ],
  [
    "clear",
    "Transparent",
    {
      "--cap-background": "#00000000",
      "--cap-border-color": "#8080804d",
      "--cap-checkbox-background": "#80808014",
    },
  ],
].map(([id, label, colors]) => [
  id,
  label,
  {
    ...Object.fromEntries(COLORS.map(([k, , d]) => [k, d])),
    ...colors,
  },
]);

const MODES = [
  ["checkbox", "Checkbox", "Visitors click the widget to solve."],
  [
    "programmatic",
    "Programmatic",
    "The widget is on the page, and your code calls its solve() method.",
  ],
  [
    "invisible",
    "Invisible",
    "Nothing shows on the page. Your code creates a Cap instance and calls solve().",
  ],
];

const stored = (() => {
  try {
    return JSON.parse(
      localStorage.getItem(`cap-demo:${app.key.siteKey}`) ?? "null",
    );
  } catch {
    return null;
  }
})();
const base = defaults();

let look = $state({
  ...base,
  ...stored?.look,
  colors: { ...base.colors, ...stored?.look?.colors },
  sizes: { ...base.sizes, ...stored?.look?.sizes },
  labels: { ...base.labels, ...stored?.look?.labels },
});
let mode = $state(
  MODES.some(([m]) => m === stored?.mode) ? stored.mode : "checkbox",
);
let page = $state(
  /^#[\da-f]{6}$/i.test(stored?.page ?? "") ? stored.page : "#f1efe9",
);
let widgetEl = $state(null);
let invisible = null;
let backdrop = $state(
  ["light", "dark", "custom"].includes(stored?.backdrop)
    ? stored.backdrop
    : document.documentElement.classList.contains("dark")
      ? "dark"
      : "light",
);

$effect(() => {
  const value = JSON.stringify({ look, mode, backdrop, page });
  try {
    localStorage.setItem(`cap-demo:${app.key.siteKey}`, value);
  } catch {}
});

const preset = $derived(
  PRESETS.find(([, , colors]) =>
    COLORS.every(([k]) => look.colors[k].toLowerCase() === colors[k]),
  )?.[0],
);
let script = $state("idle");
let run = $state(0);
let events = $state({ mount: "", phase: "ready" });

const siteKey = $derived(app.key.siteKey);
const endpoint = $derived(endpointOf(siteKey));
const mount = $derived(`${siteKey}:${look.lang}:${mode}:${run}`);
const styled = $derived(mode !== "invisible");
const needsClick = $derived(
  app.key.config?.behavior === "block" &&
    app.key.config?.requireInteraction === true,
);
const status = $derived(events.mount === mount ? events : { phase: "ready" });
const statusKey = $derived(script === "ready" ? status.phase : script);

const allowed = $derived(
  app.key.config?.corsOrigins?.length
    ? app.key.config.corsOrigins
    : (app.settings.cors?.origins ?? []),
);
const outside = $derived(
  allowed.length > 0 &&
    !allowed.includes(location.origin) &&
    !allowed.includes(location.host),
);

const clean = (v) =>
  String(v)
    .replace(/[;{}<>]/g, "")
    .trim();

const changed = $derived([
  ...COLORS.flatMap(([k, , d]) => {
    const v = clean(look.colors[k]);
    return v && v.toLowerCase() !== d ? [[k, v]] : [];
  }),
  ...SIZES.flatMap(([k, , d, , , unit]) =>
    look.sizes[k] === d ? [] : [[k, `${look.sizes[k]}${unit}`]],
  ),
  ...(clean(look.font) ? [["--cap-font", clean(look.font)]] : []),
]);

const pristine = $derived(
  COLORS.every(([k, , d]) => look.colors[k] === d) &&
    SIZES.every(([k, , d]) => look.sizes[k] === d) &&
    LABELS.every(([k]) => !look.labels[k]) &&
    !look.lang &&
    !look.font,
);

const styleText = $derived(changed.map(([k, v]) => `${k}: ${v}`).join("; "));

const attrs = $derived([
  ["data-cap-api-endpoint", endpoint],
  ...(look.lang ? [["data-cap-lang", look.lang]] : []),
  ...LABELS.flatMap(([k]) =>
    look.labels[k].trim()
      ? [[`data-cap-i18n-${k}`, look.labels[k].trim()]]
      : [],
  ),
]);

const snippet = $derived.by(() => {
  if (mode === "invisible") {
    return `${widgetScript()}

<script type="module">
  const cap = new Cap({ apiEndpoint: ${JSON.stringify(endpoint)} });

  cap.addEventListener("progress", (e) => {
    console.log(\`\${e.detail.progress}%\`);
  });

  try {
    const { token } = await cap.solve();
    console.log(token);
  } catch (err) {
    console.error(err.code, err.message);
  }
</${"script"}>`;
  }
  const esc = (v) =>
    v.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
  const all = mode === "programmatic" ? [["id", "cap"], ...attrs] : attrs;
  const tag =
    all.length === 1
      ? `<cap-widget ${all[0][0]}="${esc(all[0][1])}"></cap-widget>`
      : `<cap-widget\n${all.map(([k, v]) => `  ${k}="${esc(v)}"`).join("\n")}\n></cap-widget>`;
  const button =
    mode === "programmatic"
      ? `\n<button id="verify" type="button">Verify</button>

<script>
  const widget = document.getElementById("cap");

  document.getElementById("verify").addEventListener("click", async () => {
    try {
      const { token } = await widget.solve();
      console.log(token);
    } catch (err) {
      console.error(err.code, err.message);
    }
  });
</${"script"}>`
      : "";
  const css = changed.length
    ? `\n\n<style>\n  cap-widget {\n${changed.map(([k, v]) => `    ${k}: ${v};`).join("\n")}\n  }\n</style>`
    : "";
  return `${widgetScript()}\n\n${tag}${button}${css}`;
});

const hexOf = (v) => {
  const m = /^#([\da-f]{3,4}|[\da-f]{6}|[\da-f]{8})$/i.exec(String(v).trim());
  if (!m) return null;
  const full = m[1].length < 5 ? [...m[1]].map((c) => c + c).join("") : m[1];
  return { rgb: `#${full.slice(0, 6).toLowerCase()}`, alpha: full.slice(6) };
};

$effect(() => {
  if (!open) return;
  loadWidgetFiles();
  script = customElements.get("cap-widget") ? "ready" : "loading";
  loadWidget().then(
    () => {
      script = "ready";
    },
    () => {
      script = "failed";
    },
  );
});

$effect(() => {
  if (!open || mode !== "invisible") return;
  return () => {
    invisible?.widget.remove();
    invisible = null;
  };
});

const failure = (err) => ({
  phase: "error",
  code: typeof err?.code === "string" ? err.code : "",
  message: err?.message || "The widget couldn't finish the puzzle.",
});

const wire = (el) => {
  const id = untrack(() => mount);
  const set = (next) => {
    if (!el.isConnected) return;
    events = { mount: id, ...next };
  };
  const handlers = {
    progress: (e) => {
      if (events.mount === id && events.phase === "solved") return;
      set({ phase: "solving", progress: Math.round(e.detail?.progress ?? 0) });
    },
    solve: (e) => set({ phase: "solved", token: e.detail?.token ?? "" }),
    error: (e) => set(failure(e.detail)),
    reset: () => set({ phase: "ready" }),
  };
  for (const [name, fn] of Object.entries(handlers))
    el.addEventListener(name, fn);
  return () => {
    for (const [name, fn] of Object.entries(handlers))
      el.removeEventListener(name, fn);
  };
};

const settle = (id, promise) =>
  promise.then(
    (r) => {
      if (r?.token && untrack(() => mount) === id)
        events = { mount: id, phase: "solved", token: r.token };
    },
    (err) => {
      if (untrack(() => mount) === id) events = { mount: id, ...failure(err) };
    },
  );

const solveFromCode = () => {
  if (mode === "programmatic") {
    if (widgetEl) settle(mount, widgetEl.solve());
    return;
  }
  invisible?.widget.remove();
  run++;
  const id = mount;
  try {
    invisible = new window.Cap({ apiEndpoint: endpoint });
  } catch (err) {
    events = { mount: id, ...failure(err) };
    return;
  }
  untrack(() => wire(invisible.widget));
  events = { mount: id, phase: "solving", progress: 0 };
  settle(id, invisible.solve());
};
</script>

{#snippet heading(text, action)}
  <div class="flex min-h-8 items-center justify-between gap-3">
    <h3 class="text-sm font-medium">{text}</h3>
    {@render action?.()}
  </div>
{/snippet}

<Dialog
  bind:open
  size="xl"
  title="Try the widget"
  description="Solves here count in this key's stats."
>
  <div class="grid min-w-0 gap-6 {styled ? 'md:grid-cols-[minmax(0,1fr)_minmax(0,20rem)]' : ''} md:gap-8">
    <div class="contents md:sticky md:top-0 md:flex md:min-w-0 md:flex-col md:gap-4 md:self-start">
      <section class="flex min-w-0 flex-col gap-2" aria-label="Mode">
        <Segmented label="Mode" options={MODES.map(([value, label]) => [value, label])} bind:value={mode} />
        <p class="text-sm text-pretty text-muted-foreground">{MODES.find(([value]) => value === mode)?.[2]}</p>
      </section>

      <section class="flex min-w-0 flex-col gap-3" aria-label="Preview">
        {#snippet backdropToggle()}
          <div class="flex items-center gap-2">
            <Segmented
              label="Preview background"
              size="sm"
              options={[
                ["light", "Light"],
                ["dark", "Dark"],
                ["custom", "Custom"],
              ]}
              bind:value={backdrop}
            />
            {#if backdrop === "custom"}
              <span
                class="cm-swatch relative block size-7 shrink-0 overflow-hidden rounded-md shadow-[inset_0_0_0_1px_color-mix(in_oklch,var(--foreground)_15%,transparent)]"
                style="background: {page}"
              >
                <input
                  type="color"
                  class="absolute inset-0 size-full cursor-pointer opacity-0"
                  aria-label="Pick the preview background color"
                  bind:value={page}
                />
              </span>
            {/if}
          </div>
        {/snippet}
        {@render heading("Preview", styled ? backdropToggle : undefined)}

        {#if dirty}
          <div class="flex items-center gap-3 text-sm text-pretty text-muted-foreground">
            <Icon name="info" size={16} class="shrink-0" />
            <span class="me-auto">The widget uses your saved settings, not the unsaved ones.</span>
            {#if onsave}
              <Button size="sm" class="-my-1 shrink-0" onclick={async () => {
                await onsave();
                run++;
              }}>Save changes</Button>
            {/if}
          </div>
        {/if}
        {#if needsClick && mode !== "checkbox"}
          <p class="flex gap-2 text-sm text-pretty text-muted-foreground">
            <Icon name="info" size={16} class="mt-0.5 shrink-0" />
            This key requires a click on the widget, so solve() from code fails with behavior_no_interaction.
          </p>
        {/if}
        {#if outside}
          <p class="flex gap-2 text-sm text-pretty text-muted-foreground">
            <Icon name="info" size={16} class="mt-0.5 shrink-0" />
            <span>Only {allowed.join(", ")} can use this key. The demo still works because it runs on the same server.</span>
          </p>
        {/if}
      </section>

      <section
        class="flex min-w-0 flex-col gap-3 max-md:sticky max-md:-top-1 max-md:z-10 max-md:-mx-7 max-md:-mt-4 max-md:bg-popover max-md:px-7 max-md:pt-1 max-md:pb-2 {styled ? 'max-md:border-b max-md:border-border' : ''}"
        aria-label="Live preview"
      >
        <div
          class="cm-stage grid {styled ? 'min-h-36 md:min-h-56' : 'min-h-40'} place-items-center overflow-x-auto rounded-xl p-3 sm:p-6 shadow-[inset_0_0_0_1px_var(--border)] {!styled
            ? ''
            : backdrop === 'dark'
              ? 'cm-dark bg-[#0b0b0c]'
              : backdrop === 'custom'
                ? ''
                : 'cm-light bg-white'}"
          style={styled && backdrop === "custom" ? `background-color: ${page}` : undefined}
        >
          {#if script === "ready" && !styled}
            {@const percent = status.phase === "solved" ? 100 : status.phase === "solving" ? status.progress : 0}
            <div class="flex w-full max-w-xs flex-col gap-1.5">
              <div class="flex items-center justify-between gap-3 text-sm">
                <span class="text-muted-foreground">Progress</span>
                <span class="tabular-nums {status.phase === 'error' ? 'text-destructive' : 'text-muted-foreground'}">{status.phase === "error" ? "Failed" : `${percent}%`}</span>
              </div>
              <div
                class="h-1.5 overflow-hidden rounded-[2px] bg-muted"
                role="progressbar"
                aria-label="Solve progress"
                aria-valuemin="0"
                aria-valuemax="100"
                aria-valuenow={percent}
              >
                <div
                  class="cm-fill h-full origin-left rounded-[2px] {status.phase === 'error' ? 'bg-destructive' : 'bg-primary'}"
                  style="transform: scaleX({status.phase === 'error' ? 1 : percent / 100})"
                ></div>
              </div>
            </div>
          {:else if script === "ready"}
            {#key mount}
              <div class="cm-enter grid max-w-full place-items-center">
              <cap-widget
                data-cap-api-endpoint={endpoint}
                data-cap-lang={look.lang || undefined}
                data-cap-i18n-initial-state={look.labels["initial-state"].trim() || undefined}
                data-cap-i18n-verifying-label={look.labels["verifying-label"].trim() || undefined}
                data-cap-i18n-solved-label={look.labels["solved-label"].trim() || undefined}
                data-cap-i18n-error-label={look.labels["error-label"].trim() || undefined}
                style={styleText}
                bind:this={widgetEl}
                {@attach wire}
              ></cap-widget>
              </div>
            {/key}
          {:else if script === "failed"}
            <p class="max-w-sm text-center text-sm text-pretty {!styled ? 'text-muted-foreground' : backdrop === 'dark' ? 'text-white/70' : 'text-black/60'}">
              Couldn't load the widget script. Check your connection, or set ENABLE_ASSETS_SERVER=true to serve it from
              this server.
            </p>
          {:else}
            <Spinner class="size-5 {backdrop === 'dark' ? 'text-white/60' : 'text-black/50'}" label="Loading the widget" />
          {/if}
        </div>

        <div class="flex min-h-9 items-center justify-between gap-3">
          <p class="grid min-w-0 text-sm text-pretty" role="status">
            {#key statusKey}
            <span class="cm-status col-start-1 row-start-1">
            {#if script !== "ready"}
              <span class="text-muted-foreground">{script === "failed" ? "The widget isn't available." : "Loading the widget"}</span>
            {:else if status.phase === "solving"}
              <span class="text-muted-foreground tabular-nums">Solving, {status.progress}%</span>
            {:else if status.phase === "solved"}
              <span class="flex items-center gap-1.5">
                <Icon name="check" size={16} class="cm-pop shrink-0 text-success" />
                <span>
                  Solved with token
                  <code class="font-mono text-[0.8125rem] break-all">{status.token.slice(0, 16)}…</code>
                </span>
                <CopyButton text={status.token} label="Copy token" copiedLabel="Token copied" class="-my-1" />
              </span>
            {:else if status.phase === "error"}
              <span class="text-destructive">
                {status.message}{#if status.code && !status.message.includes(status.code)}{" "}<code class="font-mono text-xs text-muted-foreground">{status.code}</code>{/if}
              </span>
            {:else if mode === "checkbox"}
              <span class="text-muted-foreground">Click the widget to solve.</span>
            {:else}
              <span class="text-muted-foreground">Call solve() to run a puzzle.</span>
            {/if}
            </span>
            {/key}
          </p>
          <div class="flex shrink-0 gap-2">
            {#if styled}
              <Button size="sm" disabled={script !== "ready"} onclick={() => run++}>
                <Icon name="refresh" size={14} />
                Reset widget
              </Button>
            {/if}
            {#if mode !== "checkbox"}
              <Button
                size="sm"
                variant="primary"
                disabled={script !== "ready" || status.phase === "solving"}
                onclick={solveFromCode}
              >
                Call solve()
              </Button>
            {/if}
          </div>
        </div>
      </section>

      <section class="flex min-w-0 flex-col gap-3 max-md:order-last" aria-label="Embed code">
        {@render heading("Embed code")}
        <CodeBlock class="min-w-0" filename="index.html" language="html" download={false} code={snippet} html={highlight(snippet)} />
      </section>
    </div>

    {#if styled}
    <div class="flex min-w-0 flex-col gap-6">
      <section class="flex flex-col gap-3" aria-label="Colors">
        {#snippet resetLook()}
          <Button size="sm" variant="ghost" class="-me-2.5" disabled={pristine} onclick={() => (look = defaults())}>Reset styles</Button>
        {/snippet}
        {@render heading("Colors", resetLook)}
        <div class="grid grid-cols-3 gap-2" role="group" aria-label="Color presets">
          {#each PRESETS as [id, label, colors] (id)}
            <button
              type="button"
              class="cm-preset group flex cursor-pointer flex-col items-start gap-1.5 rounded-lg p-1.5 pb-2 text-start text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring {preset === id ? 'shadow-[inset_0_0_0_1.5px_var(--foreground)]' : 'shadow-[inset_0_0_0_1px_var(--border)]'}"
              aria-pressed={preset === id}
              onclick={() => (look.colors = { ...colors })}
            >
              <span
                class="flex h-8 w-full items-center gap-1.5 rounded-[5px] px-1.5 {id === 'clear' ? 'cm-checker' : ''}"
                style="background-color: {colors['--cap-background']}; box-shadow: inset 0 0 0 1px {colors['--cap-border-color']}"
              >
                <span class="size-2.5 shrink-0 rounded-[3px]" style="background: {colors['--cap-checkbox-background']}; box-shadow: inset 0 0 0 1px {colors['--cap-border-color']}"></span>
                <span class="h-1 w-8 rounded-full opacity-80" style="background: {colors['--cap-color']}"></span>
              </span>
              <span class="ps-0.5 text-muted-foreground {preset === id ? 'text-foreground' : ''}">{label}</span>
            </button>
          {/each}
        </div>
        <div class="grid grid-cols-2 gap-x-3 gap-y-3">
          {#each COLORS as [key, label]}
            {@const hex = hexOf(look.colors[key])}
            <div class="flex min-w-0 flex-col gap-1.5">
              <label for="demo{key}" class="text-sm">{label}</label>
              <Input
                id="demo{key}"
                size="sm"
                mono
                spellcheck="false"
                autocomplete="off"
                bind:value={look.colors[key]}
              >
                {#snippet suffix()}
                  <span
                    class="relative mr-0.5 block size-6 overflow-hidden rounded-[5px] shadow-[inset_0_0_0_1px_color-mix(in_oklch,var(--foreground)_15%,transparent)]"
                    style="background: {clean(look.colors[key]) || 'transparent'}"
                  >
                    <input
                      type="color"
                      class="absolute inset-0 size-full cursor-pointer opacity-0"
                      aria-label="Pick the {label.toLowerCase()} color"
                      value={hex?.rgb ?? "#000000"}
                      oninput={(e) => (look.colors[key] = `${e.currentTarget.value}${hex?.alpha ?? ""}`)}
                    />
                  </span>
                {/snippet}
              </Input>
            </div>
          {/each}
        </div>
      </section>

      <section class="flex flex-col gap-3" aria-label="Size and shape">
        {@render heading("Size and shape")}
        <div class="flex flex-col gap-4">
          {#each SIZES as [key, label, , min, max, unit]}
            <div class="flex flex-col gap-2">
              <div class="flex items-center justify-between gap-3 text-sm">
                <span>{label}</span>
                <output class="text-muted-foreground tabular-nums">{look.sizes[key]}{unit}</output>
              </div>
              <Slider
                {min}
                {max}
                step={1}
                size="sm"
                thumbLabel={label}
                bind:value={() => look.sizes[key], (v) => (look.sizes[key] = v)}
              />
            </div>
          {/each}
        </div>
      </section>

      <section class="flex flex-col gap-3" aria-label="Text">
        {@render heading("Text")}
        <div class="flex flex-col gap-3">
          <div class="flex flex-col gap-1.5">
            <label for="demoLang" class="text-sm">Language</label>
            <Select id="demoLang" size="sm" class="w-full" options={LANGS} bind:value={look.lang} />
          </div>
          {#each LABELS as [key, label, fallback]}
            <div class="flex flex-col gap-1.5">
              <label for="demoLabel-{key}" class="text-sm">{label}</label>
              <Input id="demoLabel-{key}" size="sm" autocomplete="off" placeholder={fallback} bind:value={look.labels[key]} />
            </div>
          {/each}
          <div class="flex flex-col gap-1.5">
            <label for="demoFont" class="text-sm">Font</label>
            <Input id="demoFont" size="sm" autocomplete="off" spellcheck="false" placeholder="System font" bind:value={look.font} />
          </div>
        </div>
      </section>
    </div>
    {/if}
  </div>
</Dialog>

<style>
  .cm-checker {
    background-image: conic-gradient(
      color-mix(in oklch, var(--foreground) 10%, transparent) 25%,
      transparent 0 50%,
      color-mix(in oklch, var(--foreground) 10%, transparent) 0 75%,
      transparent 0
    );
    background-size: 8px 8px;
  }

  @media (hover: hover) {
    .cm-preset:hover {
      background-color: var(--accent);
    }
  }

  @media (prefers-reduced-motion: no-preference) {
    .cm-preset {
      transition:
        background-color 120ms ease-out,
        box-shadow 160ms ease-out;
    }

    .cm-stage {
      transition: background-color 240ms ease-out;
    }

    .cm-fill {
      transition: transform 180ms ease-out;
    }

    .cm-enter {
      animation: cm-enter 380ms cubic-bezier(0.22, 1, 0.36, 1) both;
    }

    .cm-status {
      animation: cm-status 240ms cubic-bezier(0.22, 1, 0.36, 1) both;
    }

    .cm-status :global(.cm-pop) {
      animation: cm-pop 360ms cubic-bezier(0.34, 1.4, 0.64, 1) 60ms both;
    }
  }

  @keyframes cm-enter {
    from {
      opacity: 0;
      transform: translateY(6px) scale(0.98);
      filter: blur(3px);
    }
  }

  @keyframes cm-status {
    from {
      opacity: 0;
      transform: translateY(3px);
      filter: blur(2px);
    }
  }

  @keyframes cm-pop {
    from {
      opacity: 0;
      transform: scale(0.25);
      filter: blur(4px);
    }
  }
</style>
