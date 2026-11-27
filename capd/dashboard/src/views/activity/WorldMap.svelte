<script module>
import { url } from "../../lib/api.js";

let world;
const loadWorld = () => {
  world ??= Promise.all([
    fetch(url("public/assets/countries-110m.json")).then((r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json();
    }),
    import("topojson-client"),
  ])
    .then(([topo, { feature }]) => feature(topo, topo.objects.countries))
    .catch((e) => {
      world = null;
      throw e;
    });
  return world;
};
</script>

<script>
  import { onMount, untrack } from "svelte";
  import { createResolver } from "../../components/ui/chart/colors.js";
  import { compact } from "../../lib/format.js";
  import CountryCard from "../../polish/geo/CountryCard.svelte";
  import { countryCentroids, countryName, flagUrl, numericToAlpha2 } from "../../lib/geo.js";

  let { values = {}, color = "var(--chart-3)", diverging = false, describe, onpick, countries, highlight = null, points = [], onpoint } = $props();

  const LAT_MIN = -60;
  const LAT_MAX = 85;

  let wrap = $state();
  let canvas = $state();
  let geojson = $state(null);
  let failed = $state(false);
  let size = $state({ w: 0, h: 0 });
  let theme = $state(0);
  let hover = $state(null);
  let tipSize = $state({ w: 0, h: 0 });
  let tapped = null;
  let view = { k: 1, x: 0, y: 0 };
  let zoom = $state(1);
  let zoomFrame = 0;
  let drag = $state(null);
  let dragged = $state(false);
  const MAX_ZOOM = 8;
  let grow = 1;

  const project = (lat, lon) => [((lon + 180) / 360) * size.w, ((LAT_MAX - lat) / (LAT_MAX - LAT_MIN)) * size.h];

  const dots = $derived.by(() => {
    if (!size.w || !size.h) return [];
    const list = points.filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lon) && p.n > 0);
    const top = Math.max(1, ...list.map((p) => p.n));
    return list
      .map((p) => {
        const [x, y] = project(p.lat, p.lon);
        return { ...p, key: `${p.country}:${p.name}`, x, y, r: 2 + Math.sqrt(p.n / top) * 7 };
      })
      .sort((a, b) => a.n - b.n);
  });

  const fit = (v) => {
    const { w, h } = size;
    const k = Math.min(MAX_ZOOM, Math.max(1, v.k));
    return { k, x: Math.min(0, Math.max(w - k * w, v.x)), y: Math.min(0, Math.max(h - k * h, v.y)) };
  };

  function setView(next, animate = true) {
    const to = fit(next);
    zoom = to.k;
    cancelAnimationFrame(zoomFrame);
    zoomFrame = 0;
    if (!animate || matchMedia("(prefers-reduced-motion: reduce)").matches) {
      view = to;
      if (!frame) draw();
      return;
    }
    const start = view;
    const t0 = performance.now();
    const tick = (now) => {
      const t = Math.min(1, (now - t0) / 280);
      const e = 1 - (1 - t) ** 3;
      view = { k: start.k + (to.k - start.k) * e, x: start.x + (to.x - start.x) * e, y: start.y + (to.y - start.y) * e };
      if (!frame) draw();
      zoomFrame = t < 1 ? requestAnimationFrame(tick) : 0;
    };
    zoomFrame = requestAnimationFrame(tick);
  }

  const zoomAt = (factor, px = size.w / 2, py = size.h / 2, animate = true) => {
    const k = Math.min(MAX_ZOOM, Math.max(1, zoom * factor));
    const r = k / view.k;
    setView({ k, x: px - (px - view.x) * r, y: py - (py - view.y) * r }, animate);
  };

  const rich = $derived(!!countries?.current);

  const legend = $derived.by(() => {
    if (diverging) return null;
    const list = Object.values(values).filter((v) => v > 0);
    if (!list.length) return null;
    const share = list.every((v) => v <= 1) && list.some((v) => !Number.isInteger(v));
    const top = Math.max(...list);
    return {
      min: share ? "0%" : "0",
      max: share ? `${Math.round(top * 100)}%` : compact(top),
      steps: [0, 1, 2, 3, 4].map((k) => `color-mix(in oklab, ${color} ${15 + k * 21.25}%, var(--muted))`),
    };
  });

  const order = $derived(
    Object.entries(values)
      .filter(([code, v]) => v && countryCentroids[code])
      .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
      .map(([code]) => code),
  );

  const tipPos = $derived.by(() => {
    if (!hover) return null;
    const gap = 14;
    const vw = typeof window === "undefined" ? 0 : window.innerWidth;
    const vh = typeof window === "undefined" ? 0 : window.innerHeight;
    const flip = hover.x + gap + tipSize.w > vw - 8;
    const left = flip ? hover.x - gap - tipSize.w : hover.x + gap;
    const top = Math.min(Math.max(8, hover.y - 10), vh - tipSize.h - 8);
    return { left: Math.max(8, left), top, origin: flip ? "top right" : "top left" };
  });

  const announce = $derived(hover?.keyboard ? `${countryName(hover.code)}${describe?.(hover.code) ? `, ${describe(hover.code)}` : ""}` : "");

  function focusCountry(code) {
    const c = countryCentroids[code];
    if (!c || !canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mx = ((c[1] + 180) / 360) * size.w;
    const my = ((LAT_MAX - c[0]) / (LAT_MAX - LAT_MIN)) * size.h;
    let target = fit(view);
    const sx = target.x + target.k * mx;
    const sy = target.y + target.k * my;
    if (zoom > 1 && (sx < 0 || sx > size.w || sy < 0 || sy > size.h)) {
      target = fit({ k: zoom, x: size.w / 2 - zoom * mx, y: size.h / 2 - zoom * my });
      setView(target);
    }
    hover = { code, x: rect.left + target.x + target.k * mx, y: rect.top + target.y + target.k * my, keyboard: true };
  }

  function onkeydown(e) {
    const at = hover ? order.indexOf(hover.code) : -1;
    const next = order.length && { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
    if (next) {
      e.preventDefault();
      focusCountry(order[(at + next + order.length) % order.length] ?? order[0]);
    } else if (e.key === "Home" || e.key === "End") {
      e.preventDefault();
      focusCountry(order[e.key === "Home" ? 0 : order.length - 1]);
    } else if ((e.key === "Enter" || e.key === " ") && hover && onpick) {
      e.preventDefault();
      onpick(hover.code);
    } else if (e.key === "Escape" && hover) {
      e.preventDefault();
      hover = null;
    } else if (e.key === "+" || e.key === "=" || e.key === "-" || e.key === "0") {
      e.preventDefault();
      hover = null;
      if (e.key === "0") setView({ k: 1, x: 0, y: 0 });
      else zoomAt(e.key === "-" ? 0.5 : 2);
    }
  }

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
      view = { k: 1, x: 0, y: 0 };
      zoom = 1;
    });
    if (wrap) ro.observe(wrap);
    const mo = new MutationObserver(() => {
      theme += 1;
    });
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["class", "style", "data-theme"] });
    return () => {
      ro.disconnect();
      mo.disconnect();
      cancelAnimationFrame(frame);
      cancelAnimationFrame(zoomFrame);
    };
  });

  const shapes = $derived.by(() => {
    const { w, h } = size;
    if (!geojson || !w || !h) return [];
    const x = (lon) => ((lon + 180) / 360) * w;
    const y = (lat) => ((LAT_MAX - lat) / (LAT_MAX - LAT_MIN)) * h;
    const out = [];
    for (const f of geojson.features) {
      if (String(f.id) === "010") continue;
      const { type, coordinates } = f.geometry ?? {};
      if (type !== "Polygon" && type !== "MultiPolygon") continue;
      const path = new Path2D();
      for (const poly of type === "Polygon" ? [coordinates] : coordinates) {
        for (const ring of poly) {
          let shift = 0;
          let lo = Infinity;
          let hi = -Infinity;
          const lons = ring.map(([lon], i) => {
            if (i && Math.abs(lon - ring[i - 1][0]) > 180) shift += lon > ring[i - 1][0] ? -360 : 360;
            const v = lon + shift;
            lo = Math.min(lo, v);
            hi = Math.max(hi, v);
            return v;
          });
          const copies = [0];
          if (hi > 180) copies.push(-360);
          if (lo < -180) copies.push(360);
          for (const offset of copies) {
            ring.forEach(([, lat], i) => {
              path[i ? "lineTo" : "moveTo"](x(lons[i] + offset), y(lat));
            });
            path.closePath();
          }
        }
      }
      out.push({ code: numericToAlpha2[String(f.id)], path });
    }
    return out;
  });

  const parse = (rgba) => rgba.match(/[\d.]+/g).map(Number);
  const css = ([r, g, b, a]) => `rgba(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}, ${a})`;

  const palette = $derived.by(() => {
    theme;
    if (!wrap || !shapes.length) return null;
    const resolver = createResolver(wrap);
    const muted = resolver.resolve("var(--muted)");
    const fillFor = (v) => {
      if (v == null || (!diverging && !v)) return muted;
      const tone = diverging ? (v >= 0 ? "var(--info)" : "var(--warning)") : color;
      const mix = Math.round((15 + (Math.abs(v) / max) * 85) / 5) * 5;
      return resolver.resolve(`color-mix(in oklab, ${tone} ${mix}%, var(--muted))`);
    };
    const out = {
      muted: parse(muted),
      fills: shapes.map((s) => parse(fillFor(values[s.code]))),
      stroke: resolver.resolve("var(--card)"),
      lift: parse(resolver.resolve(diverging ? "var(--foreground)" : color)),
      amount: diverging ? 0.12 : 0.28,
      edge: resolver.resolve("color-mix(in oklab, var(--foreground) 45%, transparent)"),
      dot: resolver.resolve("color-mix(in oklab, var(--foreground) 80%, transparent)"),
      dotHover: resolver.resolve("var(--chart-1)"),
    };
    resolver.dispose();
    return out;
  });

  let frame = 0;
  let shown = [];
  let from = [];
  let started = 0;

  const draw = () => {
    const { w, h } = size;
    const ctx = canvas?.getContext("2d");
    if (!ctx || !palette) return;
    const dpr = window.devicePixelRatio || 1;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.setTransform(dpr * view.k, 0, 0, dpr * view.k, dpr * view.x, dpr * view.y);
    ctx.lineWidth = 0.5 / view.k;
    ctx.strokeStyle = palette.stroke;
    let lifted = null;
    shapes.forEach((s, i) => {
      if (s.code && s.code === (hover?.code ?? highlight)) lifted = i;
      ctx.fillStyle = css(shown[i]);
      ctx.fill(s.path);
      ctx.stroke(s.path);
    });
    if (lifted != null && !hover?.dot) {
      const c = shown[lifted];
      ctx.fillStyle = css(c.map((v, k) => (k < 3 ? v + (palette.lift[k] - v) * palette.amount : v)));
      ctx.fill(shapes[lifted].path);
      ctx.strokeStyle = palette.edge;
      ctx.lineWidth = 1 / view.k;
      ctx.stroke(shapes[lifted].path);
    }
    if (!dots.length || !grow) return;
    ctx.lineWidth = 1.25 / view.k;
    ctx.strokeStyle = palette.stroke;
    for (const d of dots) {
      ctx.beginPath();
      ctx.arc(d.x, d.y, (d.r * grow) / view.k, 0, Math.PI * 2);
      ctx.fillStyle = hover?.dot?.key === d.key ? palette.dotHover : palette.dot;
      ctx.fill();
      ctx.stroke();
    }
  };

  const step = (now) => {
    const t = Math.min(1, (now - started) / 520);
    const e = 1 - (1 - t) ** 3;
    grow = Math.min(1, Math.max(0, (t - 0.25) / 0.75)) ** 0.5;
    shown = palette.fills.map((to, i) => to.map((v, k) => from[i][k] + (v - from[i][k]) * e));
    draw();
    frame = t < 1 ? requestAnimationFrame(step) : 0;
  };

  $effect(() => {
    const { w, h } = size;
    if (!canvas || !palette || !w || !h) return;
    const dpr = window.devicePixelRatio || 1;
    if (canvas.width !== Math.round(w * dpr)) canvas.width = Math.round(w * dpr);
    if (canvas.height !== Math.round(h * dpr)) canvas.height = Math.round(h * dpr);
    cancelAnimationFrame(frame);
    const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const resized = shown.length !== palette.fills.length;
    if (still || (resized && shown.length)) {
      grow = 1;
      shown = palette.fills;
      draw();
      return;
    }
    from = resized ? palette.fills.map(() => palette.muted) : shown;
    started = performance.now();
    untrack(() => step(started));
    return () => {
      cancelAnimationFrame(frame);
      frame = 0;
    };
  });

  $effect(() => {
    hover;
    highlight;
    dots;
    if (!frame && shown.length) draw();
  });

  $effect(() => {
    if (!canvas) return;
    const listeners = {
      pointermove: (e) => {
        if (drag) {
          const dx = e.clientX - drag.x;
          const dy = e.clientY - drag.y;
          if (!dragged && Math.hypot(dx, dy) < 4) return;
          dragged = true;
          hover = null;
          setView({ k: view.k, x: drag.vx + dx, y: drag.vy + dy }, false);
          return;
        }
        if (e.pointerType === "mouse") onmove(e);
      },
      pointerleave: (e) => {
        if (e.pointerType === "mouse" && !drag) hover = null;
      },
      pointerdown: (e) => {
        dragged = false;
        if (zoom > 1 && e.button === 0) {
          drag = { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y };
          canvas.setPointerCapture(e.pointerId);
        }
        if (e.pointerType === "mouse") return;
        tapped = hover?.touch ? (hover.dot?.key ?? hover.code) : null;
        onmove(e);
      },
      pointerup: () => {
        drag = null;
      },
      pointercancel: () => {
        drag = null;
      },
      wheel: (e) => {
        if (!e.ctrlKey && !e.metaKey) return;
        e.preventDefault();
        const rect = canvas.getBoundingClientRect();
        hover = null;
        zoomAt(Math.exp(-e.deltaY * 0.01), e.clientX - rect.left, e.clientY - rect.top, false);
      },
      click: () => {
        if (dragged) {
          dragged = false;
          return;
        }
        if (!hover || (hover.touch && tapped !== (hover.dot?.key ?? hover.code))) return;
        if (hover.dot) onpoint?.(hover.dot);
        else onpick?.(hover.code);
      },
    };
    for (const [type, fn] of Object.entries(listeners)) canvas.addEventListener(type, fn, { passive: type !== "wheel" });
    return () => {
      for (const [type, fn] of Object.entries(listeners)) canvas.removeEventListener(type, fn);
    };
  });

  function onmove(e) {
    const { w } = size;
    if (!shapes.length || !w) return;
    const rect = canvas.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    const touch = e.pointerType === "touch";
    let near = null;
    let gap = Infinity;
    for (const d of dots) {
      const dist = Math.hypot(view.x + view.k * d.x - px, view.y + view.k * d.y - py);
      if (dist <= d.r + (touch ? 10 : 2) && dist - d.r < gap) {
        gap = dist - d.r;
        near = d;
      }
    }
    if (near) {
      hover = { code: near.country, dot: near, x: e.clientX, y: e.clientY, touch };
      return;
    }
    const ctx = canvas.getContext("2d");
    const dpr = window.devicePixelRatio || 1;
    ctx.setTransform(dpr * view.k, 0, 0, dpr * view.k, dpr * view.x, dpr * view.y);
    let found = shapes.find((s) => s.code && ctx.isPointInPath(s.path, px * dpr, py * dpr))?.code;
    if (!found) {
      const lon = ((px - view.x) / view.k / w) * 360 - 180;
      const lat = LAT_MAX - ((py - view.y) / view.k / size.h) * (LAT_MAX - LAT_MIN);
      let best = 4 / view.k;
      for (const s of shapes) {
        const c = s.code && countryCentroids[s.code];
        if (!c) continue;
        const dist = Math.abs(lat - c[0]) + Math.abs(lon - c[1]);
        if (dist < best) {
          best = dist;
          found = s.code;
        }
      }
    }
    hover = found ? { code: found, x: e.clientX, y: e.clientY, touch: e.pointerType === "touch" } : null;
  }
</script>

<svelte:window onpointerdown={(e) => hover?.touch && e.target !== canvas && (hover = null)} />

{#if failed}
  <p class="py-6 text-center text-sm text-muted-foreground">Couldn't load the map. Switch to the list view instead.</p>
{:else}
  <div class="relative mx-auto aspect-[2.4] w-full max-w-[57.6rem]" bind:this={wrap}>
    <canvas
      class="absolute inset-0 block size-full rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring {drag && dragged ? 'cursor-grabbing' : hover && onpick ? 'cursor-pointer' : zoom > 1 ? 'cursor-grab' : 'cursor-crosshair'} {zoom > 1 ? 'touch-none' : ''}"
      bind:this={canvas}
      tabindex="0"
      aria-label="World map of traffic by country. Use the arrow keys to move between countries{onpick ? ' and Enter to see their events' : ''}, plus and minus to zoom."
      onblur={() => hover?.keyboard && (hover = null)}
      {onkeydown}
    ></canvas>
    {#if legend}
      <div class="pointer-events-none absolute bottom-[3%] left-0 hidden items-center gap-1.5 text-[11px] text-muted-foreground tabular-nums sm:flex" aria-hidden="true">
        <span>{legend.min}</span>
        <span class="flex gap-px">
          {#each legend.steps as bg, i (i)}<span class="h-1.5 w-3.5 first:rounded-s-sm last:rounded-e-sm" style:background={bg}></span>{/each}
        </span>
        <span>{legend.max}</span>
      </div>
    {/if}
    <div class="absolute right-0 bottom-[3%] flex flex-col overflow-hidden rounded-md border border-border bg-card/90 backdrop-blur-sm">
      {#each [{ label: "Zoom in", factor: 2, off: zoom >= MAX_ZOOM }, { label: "Zoom out", factor: 0.5, off: zoom <= 1 }] as b (b.label)}
        <button
          type="button"
          class="zoom-btn flex size-7 items-center justify-center text-muted-foreground outline-none not-first:border-t not-first:border-border focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset disabled:opacity-40 [@media(hover:hover)]:enabled:hover:bg-foreground/5 [@media(hover:hover)]:enabled:hover:text-foreground"
          aria-label={b.label}
          disabled={b.off}
          onclick={() => {
            hover = null;
            zoomAt(b.factor);
          }}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" aria-hidden="true"><path d="M2 6h8" />{#if b.factor > 1}<path d="M6 2v8" />{/if}</svg>
        </button>
      {/each}
    </div>
    <span class="sr-only" role="status">{announce}</span>
  </div>
  {#if hover && tipPos}
    <div
      bind:offsetWidth={tipSize.w}
      bind:offsetHeight={tipSize.h}
      class="map-tip pointer-events-none fixed z-50 rounded-lg border border-border/50 bg-popover/85 text-xs text-popover-foreground shadow-xl backdrop-blur-md {rich && !hover.dot ? 'w-60 p-2.5' : 'flex items-center gap-1.5 px-2.5 py-1.5 whitespace-nowrap'}"
      style:left="{tipPos.left}px"
      style:top="{tipPos.top}px"
      style:transform-origin={tipPos.origin}
      aria-hidden="true"
    >
      {#if hover.dot}
        {#if hover.code && flagUrl(hover.code)}<img src={flagUrl(hover.code)} alt="" class="h-3.5 w-[18px] rounded-[2px] object-contain" width="18" height="14" />{/if}
        <span class="font-medium">{hover.dot.name}</span>
        <span class="text-muted-foreground tabular-nums">{compact(hover.dot.n)} events</span>
        {#if hover.touch && onpoint}<span class="text-muted-foreground">Tap again to open</span>{/if}
      {:else if rich}
        <CountryCard code={hover.code} {countries} hint={hover.touch && onpick ? "Tap again to see events" : ""} />
      {:else}
        {#if flagUrl(hover.code)}<img src={flagUrl(hover.code)} alt="" class="h-3.5 w-[18px] rounded-[2px] object-contain" width="18" height="14" />{/if}
        <span class="font-medium">{countryName(hover.code)}</span>
        {#if describe?.(hover.code)}<span class="text-muted-foreground tabular-nums">{describe(hover.code)}</span>{/if}
        {#if hover.touch && onpick}<span class="text-muted-foreground">Tap again to open</span>{/if}
      {/if}
    </div>
  {/if}
{/if}

<style>
  @media (prefers-reduced-motion: no-preference) {
    .map-tip {
      animation: tip-in 140ms var(--ease-out);
    }
  }

  @media (prefers-reduced-motion: no-preference) {
    .zoom-btn {
      transition-property: background-color, color, scale;
      transition-duration: 120ms, 120ms, 160ms;
      transition-timing-function: var(--ease-out);
    }

    .zoom-btn:enabled:active {
      scale: 0.94;
    }
  }

  @keyframes tip-in {
    from {
      opacity: 0;
      transform: scale(0.96);
    }
  }
</style>
