<script>
import { Chart, registerables } from "chart.js";
import { onMount, untrack } from "svelte";
import { cn } from "../../../lib/utils.js";
import ChartTooltip from "./ChartTooltip.svelte";
import { chartColor, createResolver, deepResolve } from "./colors.js";

Chart.register(...registerables);

let {
  config,
  type = config?.type,
  data = config?.data,
  options = config?.options,
  plugins = config?.plugins,
  tooltip = true,
  indicator = "dot",
  hideLabel = false,
  hideIndicator = false,
  valueFormatter,
  labelFormatter,
  label,
  class: className,
  chart = $bindable(null),
  ...rest
} = $props();

let root = $state(null);
let canvas = $state(null);
let theme = $state(0);
let tip = $state(null);

const perPoint = (kind) =>
  kind === "pie" || kind === "doughnut" || kind === "polarArea";

const build = (resolver) => {
  const plainData = $state.snapshot(data);
  const plainOptions = $state.snapshot(options);
  const datasets = (plainData?.datasets ?? []).map((dataset, index) => {
    const kind = dataset.type ?? type;
    const fallback = perPoint(kind)
      ? (dataset.data ?? []).map((_, at) => chartColor(at))
      : chartColor(index);
    const filled = {
      ...dataset,
      borderColor:
        dataset.borderColor ??
        (perPoint(kind) ? resolver.token("--card") || "#fff" : fallback),
      backgroundColor: dataset.backgroundColor ?? fallback,
    };
    return deepResolve(filled, resolver.resolve, new Set(["data", "label"]));
  });
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const resolvedOptions = deepResolve(plainOptions ?? {}, resolver.resolve);
  const userTooltip = resolvedOptions.plugins?.tooltip ?? {};
  return {
    data: { ...plainData, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      ...(reduced ? { animation: false } : {}),
      ...resolvedOptions,
      plugins: {
        ...resolvedOptions.plugins,
        tooltip: tooltip
          ? {
              ...userTooltip,
              enabled: false,
              external: ({ chart: instance, tooltip: model }) => {
                if (model.opacity === 0) {
                  tip = tip ? { ...tip, visible: false } : null;
                  return;
                }
                tip = {
                  visible: true,
                  x: model.caretX,
                  y: model.caretY,
                  width: instance.width,
                  height: instance.height,
                  title: model.title?.join(" ") ?? "",
                  items: model.dataPoints.map((point, at) => ({
                    label: point.dataset.label ?? point.label,
                    value: point.raw,
                    parsed: point.parsed,
                    color: model.labelColors[at]?.backgroundColor,
                    border: model.labelColors[at]?.borderColor,
                    point,
                  })),
                };
              },
            }
          : resolvedOptions.plugins?.tooltip,
      },
    },
  };
};

const applyDefaults = (resolver) => {
  Chart.defaults.color = resolver.resolve("var(--muted-foreground)");
  Chart.defaults.borderColor = resolver.resolve(
    "color-mix(in oklab, var(--border) 60%, transparent)",
  );
  Chart.defaults.font.family =
    resolver.token("--font-sans") || Chart.defaults.font.family;
  Chart.defaults.font.size = 12;
};

onMount(() => {
  const observer = new MutationObserver(() => {
    theme += 1;
  });
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["class", "style", "data-theme"],
  });
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  const bump = () => {
    theme += 1;
  };
  media.addEventListener("change", bump);
  return () => {
    observer.disconnect();
    media.removeEventListener("change", bump);
  };
});

$effect(() => {
  if (!canvas || !root) return;
  theme;
  const kind = type;
  const resolver = createResolver(root);
  applyDefaults(resolver);
  const built = untrack(() => build(resolver));
  const instance = new Chart(canvas, {
    type: kind,
    data: built.data,
    options: built.options,
    plugins: untrack(() => plugins),
  });
  chart = instance;
  resolver.dispose();
  return () => {
    instance.destroy();
    if (chart === instance) chart = null;
  };
});

$effect(() => {
  data;
  options;
  const instance = untrack(() => chart);
  if (!instance || !root) return;
  const resolver = createResolver(root);
  const built = build(resolver);
  resolver.dispose();
  instance.data = built.data;
  instance.options = built.options;
  instance.update();
});
</script>

<div
  bind:this={root}
  data-slot="chart"
  class={cn("relative flex aspect-video justify-center text-xs", className)}
  {...rest}
>
  <canvas bind:this={canvas} aria-label={label}></canvas>
  {#if tooltip && tip}
    <ChartTooltip {tip} {indicator} {hideLabel} {hideIndicator} {valueFormatter} {labelFormatter} />
  {/if}
</div>
