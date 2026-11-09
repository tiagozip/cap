<script module>
import { feature } from "topojson-client";
import { url } from "../../lib/api.js";

let world;
const loadWorld = () => {
  world ??= fetch(url("public/assets/countries-110m.json"))
    .then((r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json();
    })
    .then((topo) => feature(topo, topo.objects.countries))
    .catch((e) => {
      world = null;
      throw e;
    });
  return world;
};
</script>

<script>
  import { onMount } from "svelte";
  import { createResolver } from "../../components/ui/chart/colors.js";
  import { countryCentroids, countryName, flagUrl, numericToAlpha2 } from "../../lib/geo.js";

  let { values = {}, color = "var(--chart-3)", diverging = false, describe, onpick } = $props();

  const LAT_MIN = -60;
  const LAT_MAX = 85;

  let wrap = $state();
  let canvas = $state();
  let geojson = $state(null);
  let failed = $state(false);
  let size = $state({ w: 0, h: 0 });
  let theme = $state(0);
  let hover = $state(null);

  const max = $derived(Math.max(diverging ? 0.01 : 1, ...Object.values(values).map((v) => Math.abs(v))));

  loadWorld()
    .then((g) => {
      geojson = g;
    })
    .catch(() => {
      failed = true;
    });

  onMount(() => {
    const ro = new ResizeObserver(([entry]) => {
      size = { w: entry.contentRect.width, h: entry.contentRect.height };
    });
    if (wrap) ro.observe(wrap);
    const mo = new MutationObserver(() => {
      theme += 1;
    });
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["class", "style", "data-theme"] });
    return () => {
      ro.disconnect();
      mo.disconnect();
    };
  });

  $effect(() => {
    theme;
    const { w, h } = size;
    if (!canvas || !geojson || !w || !h) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    const resolver = createResolver(wrap);
    const fillFor = (v) => {
      if (v == null || (!diverging && !v)) return resolver.resolve("var(--muted)");
      const tone = diverging ? (v >= 0 ? "var(--info)" : "var(--warning)") : color;
      const mix = Math.round((15 + (Math.abs(v) / max) * 85) / 5) * 5;
      return resolver.resolve(`color-mix(in oklab, ${tone} ${mix}%, var(--muted))`);
    };
    const stroke = resolver.resolve("var(--card)");
    const project = ([lon, lat]) => [((lon + 180) / 360) * w, ((LAT_MAX - lat) / (LAT_MAX - LAT_MIN)) * h];
    const ring = (points) => {
      points.forEach((p, i) => {
        const [x, y] = project(p);
        if (i === 0 || Math.abs(p[0] - points[i - 1][0]) > 170) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
    };
    for (const f of geojson.features) {
      if (String(f.id) === "010") continue;
      const { type, coordinates } = f.geometry ?? {};
      if (type !== "Polygon" && type !== "MultiPolygon") continue;
      ctx.beginPath();
      for (const poly of type === "Polygon" ? [coordinates] : coordinates) for (const r of poly) ring(r);
      ctx.closePath();
      ctx.fillStyle = fillFor(values[numericToAlpha2[String(f.id)]]);
      ctx.fill();
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 0.5;
      ctx.stroke();
    }
    resolver.dispose();
  });

  function onmove(e) {
    const { w, h } = size;
    if (!geojson || !w) return;
    const rect = canvas.getBoundingClientRect();
    const lon = ((e.clientX - rect.left) / w) * 360 - 180;
    const lat = LAT_MAX - ((e.clientY - rect.top) / h) * (LAT_MAX - LAT_MIN);
    let found = null;
    let best = 25;
    for (const f of geojson.features) {
      const code = numericToAlpha2[String(f.id)];
      const c = code && countryCentroids[code];
      if (!c) continue;
      const dist = Math.abs(lat - c[0]) + Math.abs(lon - c[1]);
      if (dist < best) {
        best = dist;
        found = code;
      }
    }
    hover = found ? { code: found, x: e.clientX, y: e.clientY } : null;
  }
</script>

{#if failed}
  <p class="py-6 text-center text-sm text-muted-foreground">Couldn't load the map. Switch to the list view instead.</p>
{:else}
  <div class="relative mx-auto aspect-[2.4] w-full max-w-[57.6rem]" bind:this={wrap}>
    <canvas
      class="absolute inset-0 block size-full {hover && onpick ? 'cursor-pointer' : 'cursor-crosshair'}"
      bind:this={canvas}
      aria-label="World map of traffic by country"
      onmousemove={onmove}
      onmouseleave={() => (hover = null)}
      onclick={() => hover && onpick?.(hover.code)}
    ></canvas>
  </div>
  {#if hover}
    <div
      class="pointer-events-none fixed z-50 flex items-center gap-1.5 rounded-lg border border-border/50 bg-popover/80 px-2.5 py-1.5 text-xs whitespace-nowrap text-popover-foreground shadow-xl backdrop-blur-md"
      style:left="{hover.x + 12}px"
      style:top="{hover.y - 8}px"
    >
      {#if flagUrl(hover.code)}<img src={flagUrl(hover.code)} alt="" class="h-3.5 w-[18px] rounded-[2px] object-contain" width="18" height="14" />{/if}
      <span class="font-medium">{countryName(hover.code)}</span>
      {#if describe?.(hover.code)}<span class="text-muted-foreground tabular-nums">{describe(hover.code)}</span>{/if}
    </div>
  {/if}
{/if}
