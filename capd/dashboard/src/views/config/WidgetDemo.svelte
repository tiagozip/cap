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
import { t } from "../../lib/i18n.svelte.js";
import { app } from "../../lib/state.svelte.js";
import {
  endpointOf,
  loadWidget,
  loadWidgetFiles,
  widgetScript,
} from "../integration/embed.svelte.js";
import { highlight } from "../integration/highlight.js";

let { open = $bindable(false), dirty = false } = $props();

const COLOR_DEFS = [
  ["--cap-background", "Background", "#fdfdfd"],
  ["--cap-color", "Text", "#212121"],
  ["--cap-border-color", "Border", "#dddddd8f"],
  ["--cap-checkbox-background", "Checkbox", "#fafafa91"],
  ["--cap-spinner-color", "Spinner", "#000000"],
  ["--cap-spinner-background-color", "Spinner track", "#eeeeee"],
  ["--cap-focus-ring", "Focus ring", "#0066cc"],
];
const COLORS = $derived(COLOR_DEFS.map(([k, l, d]) => [k, t(l), d]));

const SIZE_DEFS = [
  ["--cap-widget-width", "Width", 260, 200, 400, "px"],
  ["--cap-widget-height", "Height", 58, 44, 90, "px"],
  ["--cap-border-radius", "Corner radius", 14, 0, 30, "px"],
  ["--cap-widget-padding", "Padding", 14, 4, 24, "px"],
  ["--cap-gap", "Space after checkbox", 15, 4, 30, "px"],
  ["--cap-checkbox-size", "Checkbox size", 25, 16, 36, "px"],
  ["--cap-checkbox-border-radius", "Checkbox radius", 6, 0, 18, "px"],
  ["--cap-spinner-thickness", "Spinner thickness", 3, 1, 6, ""],
];
const SIZES = $derived(
  SIZE_DEFS.map(([k, l, d, min, max, u]) => [k, t(l), d, min, max, u]),
);

const LABEL_DEFS = [
  ["initial-state", "Prompt", "Verify you're human"],
  ["verifying-label", "While solving", "Verifying..."],
  ["solved-label", "When solved", "You're a human"],
  ["error-label", "On error", "Error. Try again."],
];
const LABELS = $derived(LABEL_DEFS.map(([k, l, fb]) => [k, t(l), fb]));

const LANGS = $derived([
  ["", t("Visitor's browser language")],
  ["en", t("English")],
  ["ar", t("Arabic")],
  ["zh-cn", t("Chinese (Simplified)")],
  ["fr", t("French")],
  ["de", t("German")],
  ["hi", t("Hindi")],
  ["ja", t("Japanese")],
  ["pt", t("Portuguese")],
  ["ru", t("Russian")],
  ["es", t("Spanish")],
]);

const defaults = () => ({
  colors: Object.fromEntries(COLOR_DEFS.map(([k, , d]) => [k, d])),
  sizes: Object.fromEntries(SIZE_DEFS.map(([k, , d]) => [k, d])),
  labels: Object.fromEntries(LABEL_DEFS.map(([k]) => [k, ""])),
  lang: "",
  font: "",
});

const MODES = $derived([
  ["checkbox", t("Checkbox"), t("Visitors click the widget to solve.")],
  [
    "programmatic",
    t("Programmatic"),
    t("The widget is on the page, and your code calls its solve() method."),
  ],
  [
    "invisible",
    t("Invisible"),
    t(
      "Nothing shows on the page. Your code creates a Cap instance and calls solve().",
    ),
  ],
]);

let look = $state(defaults());
let mode = $state("checkbox");
let widgetEl = $state(null);
let invisible = null;
let backdrop = $state(
  document.documentElement.classList.contains("dark") ? "dark" : "light",
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
    () => (script = "ready"),
    () => (script = "failed"),
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
  title={t("Try the widget")}
  description={t("Solve a real puzzle with this key's saved settings. Solves here count in its activity.")}
>
  <div class="grid min-w-0 gap-6 {styled ? 'md:grid-cols-[minmax(0,1fr)_minmax(0,20rem)]' : ''} md:gap-8">
    <div class="contents md:sticky md:top-0 md:flex md:min-w-0 md:flex-col md:gap-4 md:self-start">
      <section class="flex min-w-0 flex-col gap-2" aria-label={t("Mode")}>
        <Segmented label={t("Mode")} options={MODES.map(([value, label]) => [value, label])} bind:value={mode} />
        <p class="text-sm text-pretty text-muted-foreground">{MODES.find(([value]) => value === mode)?.[2]}</p>
      </section>

      <section class="flex min-w-0 flex-col gap-3" aria-label={t("Preview")}>
        {#snippet backdropToggle()}
          <Segmented
            label={t("Preview background")}
            size="sm"
            options={[
              ["light", t("Light")],
              ["dark", t("Dark")],
            ]}
            bind:value={backdrop}
          />
        {/snippet}
        {@render heading(t("Preview"), styled ? backdropToggle : undefined)}

        {#if dirty}
          <p class="flex gap-2 text-sm text-pretty text-muted-foreground">
            <Icon name="info" size={16} class="mt-0.5 shrink-0" />
            {t("You have unsaved changes. Save them to try them here.")}
          </p>
        {/if}
        {#if needsClick && mode !== "checkbox"}
          <p class="flex gap-2 text-sm text-pretty text-muted-foreground">
            <Icon name="info" size={16} class="mt-0.5 shrink-0" />
            {t("This key blocks solves without a click on the widget, so solve() called from code fails with behavior_no_interaction.")}
          </p>
        {/if}
        {#if outside}
          <p class="flex gap-2 text-sm text-pretty text-muted-foreground">
            <Icon name="info" size={16} class="mt-0.5 shrink-0" />
            <span>
              {t("Only {origins} can load this key's puzzles. The demo still runs because this dashboard is on the same server as the API, and browsers only apply that list to other websites.", { origins: allowed.join(", ") })}
            </span>
          </p>
        {/if}

        <div
          class="grid min-h-56 place-items-center overflow-x-auto rounded-xl p-3 sm:p-6 shadow-[inset_0_0_0_1px_var(--border)] {!styled
            ? ''
            : backdrop === 'dark'
              ? 'bg-[#0b0b0c]'
              : 'bg-white'}"
        >
          {#if script === "ready" && !styled}
            {@const percent = status.phase === "solved" ? 100 : status.phase === "solving" ? status.progress : 0}
            <div class="flex w-full max-w-xs flex-col gap-1.5">
              <div class="flex items-center justify-between gap-3 text-sm">
                <span class="text-muted-foreground">{t("Progress")}</span>
                <span class="text-muted-foreground tabular-nums">{status.phase === "error" ? t("Failed") : `${percent}%`}</span>
              </div>
              <div
                class="h-1.5 overflow-hidden rounded-[2px] bg-muted"
                role="progressbar"
                aria-label={t("Solve progress")}
                aria-valuemin="0"
                aria-valuemax="100"
                aria-valuenow={percent}
              >
                <div
                  class="h-full rounded-[2px] transition-[width] duration-150 {status.phase === 'error' ? 'bg-destructive' : 'bg-primary'}"
                  style="width: {status.phase === 'error' ? 100 : percent}%"
                ></div>
              </div>
            </div>
          {:else if script === "ready"}
            {#key mount}
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
            {/key}
          {:else if script === "failed"}
            <p class="max-w-sm text-center text-sm text-pretty {!styled ? 'text-muted-foreground' : backdrop === 'dark' ? 'text-white/70' : 'text-black/60'}">
              {t("Couldn't load the widget script from jsDelivr or this server's asset route. Check your connection, or set ENABLE_ASSETS_SERVER=true to serve it from here.")}
            </p>
          {:else}
            <Spinner class="size-5 {backdrop === 'dark' ? 'text-white/60' : 'text-black/50'}" label={t("Loading the widget")} />
          {/if}
        </div>

        <div class="flex min-h-9 items-center justify-between gap-3">
          <p class="min-w-0 text-sm text-pretty" role="status">
            {#if script !== "ready"}
              <span class="text-muted-foreground">{script === "failed" ? t("The widget isn't available.") : t("Loading the widget")}</span>
            {:else if status.phase === "solving"}
              <span class="text-muted-foreground tabular-nums">{t("Solving, {pct}%", { pct: status.progress })}</span>
            {:else if status.phase === "solved"}
              <span class="flex gap-1.5">
                <Icon name="check" size={16} class="mt-0.5 shrink-0 text-success" />
                <span>
                  {t("Solved. The token starts with")}
                  <code class="font-mono text-sm break-all">{status.token.slice(0, 20)}…</code>
                </span>
              </span>
            {:else if status.phase === "error"}
              <span class="text-destructive">
                {t(status.message)}{#if status.code && !status.message.includes(status.code)}{" "}<code class="font-mono text-sm">{status.code}</code>{/if}
              </span>
            {:else if mode === "checkbox"}
              <span class="text-muted-foreground">{t("Click the widget to solve a puzzle.")}</span>
            {:else}
              <span class="text-muted-foreground">{t("Call solve() to run a puzzle.")}</span>
            {/if}
          </p>
          <div class="flex shrink-0 gap-2">
            {#if styled}
              <Button size="sm" disabled={script !== "ready"} onclick={() => run++}>
                <Icon name="refresh" size={14} />
                {t("Reset widget")}
              </Button>
            {/if}
            {#if mode !== "checkbox"}
              <Button
                size="sm"
                variant="primary"
                disabled={script !== "ready" || status.phase === "solving"}
                onclick={solveFromCode}
              >
                {t("Call solve()")}
              </Button>
            {/if}
          </div>
        </div>
      </section>

      <section class="flex min-w-0 flex-col gap-3 max-md:order-last" aria-label={t("Embed code")}>
        {@render heading(t("Embed code"))}
        <CodeBlock class="min-w-0" filename="index.html" language="html" download={false} code={snippet} html={highlight(snippet)} />
      </section>
    </div>

    {#if styled}
    <div class="flex min-w-0 flex-col gap-6">
      <section class="flex flex-col gap-3" aria-label={t("Colors")}>
        {#snippet resetLook()}
          <Button size="sm" variant="ghost" class="-me-2.5" onclick={() => (look = defaults())}>{t("Reset styles")}</Button>
        {/snippet}
        {@render heading(t("Colors"), resetLook)}
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
                      aria-label={t("Pick the {label} color", { label: label.toLowerCase() })}
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

      <section class="flex flex-col gap-3" aria-label={t("Size and shape")}>
        {@render heading(t("Size and shape"))}
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

      <section class="flex flex-col gap-3" aria-label={t("Text")}>
        {@render heading(t("Text"))}
        <div class="flex flex-col gap-3">
          <div class="flex flex-col gap-1.5">
            <label for="demoLang" class="text-sm">{t("Language")}</label>
            <Select id="demoLang" size="sm" class="w-full" options={LANGS} bind:value={look.lang} />
          </div>
          {#each LABELS as [key, label, fallback]}
            <div class="flex flex-col gap-1.5">
              <label for="demoLabel-{key}" class="text-sm">{label}</label>
              <Input id="demoLabel-{key}" size="sm" autocomplete="off" placeholder={t(fallback)} bind:value={look.labels[key]} />
            </div>
          {/each}
          <div class="flex flex-col gap-1.5">
            <label for="demoFont" class="text-sm">{t("Font")}</label>
            <Input id="demoFont" size="sm" autocomplete="off" spellcheck="false" placeholder={t("System font")} bind:value={look.font} />
          </div>
        </div>
      </section>
    </div>
    {/if}
  </div>
</Dialog>
