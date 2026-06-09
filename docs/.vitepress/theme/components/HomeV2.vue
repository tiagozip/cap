<script setup>
import { onMounted, onBeforeUnmount, ref } from "vue";
import VPNavBarSearch from "vitepress/dist/client/theme-default/components/VPNavBarSearch.vue";

const fromWidget = ref(false);
const fromWidgetHost = ref("");

function initFromWidgetBanner() {
  try {
    const params = new URLSearchParams(window.location.search);
    if (params.get("utm_source") !== "cap_widget") return;
    if (sessionStorage.getItem("cap-widget-banner-dismissed") === "1") return;
    const host = (params.get("utm_content") || "").trim();
    if (host && /^[a-z0-9.\-]+$/i.test(host) && host.length <= 80) {
      fromWidgetHost.value = host;
    }
    fromWidget.value = true;
    if (typeof window.plausible === "function") {
      window.plausible("widget_banner_shown", {
        props: { host: fromWidgetHost.value || "(unknown)" },
      });
    }
  } catch {}
}

function dismissWidgetBanner() {
  fromWidget.value = false;
  try {
    sessionStorage.setItem("cap-widget-banner-dismissed", "1");
  } catch {}
  if (typeof window.plausible === "function") {
    window.plausible("widget_banner_dismiss");
  }
}

const cleanups = [];

function registerCleanup(fn) {
  cleanups.push(fn);
}

async function loadStats() {
  const root = document.getElementById("homev2-stats");
  if (!root) return;
  try {
    const res = await fetch(
      "https://data.jsdelivr.com/v1/stats/packages/npm/@cap.js/wasm@0.0.6/files?period=year&by=hits&limit=1&page=1",
    );
    const json = await res.json();
    const hits = json[0]?.hits;
    if (!hits) return;
    const dates = Object.entries(hits.dates).sort(([a], [b]) =>
      a < b ? -1 : 1,
    );
    const total = hits.total;

    const fmtDate = (s) =>
      new Date(s + "T00:00:00Z").toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        timeZone: "UTC",
      });

    const chartDates = dates.slice(-183);
    const values = chartDates.map(([, v]) => v);
    const peak = values.reduce((a, b) => Math.max(a, b), 0);

    document.getElementById("homev2-stats-from").textContent = fmtDate(
      chartDates[0][0],
    );
    document.getElementById("homev2-stats-to").textContent = fmtDate(
      chartDates[chartDates.length - 1][0],
    );

    const svg = document.getElementById("homev2-stats-spark");
    const W = 600,
      H = 40,
      pad = 2;
    const innerW = W - pad * 2;
    const innerH = H - pad * 2;
    const step = innerW / Math.max(1, values.length - 1);
    const pts = values.map((v, i) => [
      pad + i * step,
      pad + innerH - (v / (peak || 1)) * innerH,
    ]);
    const linePath = pts
      .map(([x, y], i) => (i === 0 ? `M${x},${y}` : `L${x},${y}`))
      .join(" ");
    const areaPath =
      `M${pad},${pad + innerH} ` +
      pts.map(([x, y]) => `L${x},${y}`).join(" ") +
      ` L${pad + innerW},${pad + innerH} Z`;
    svg.innerHTML = `<path class="area" d="${areaPath}" /><path class="line" d="${linePath}" />`;

    const wrap = document.getElementById("homev2-stats-total");
    const ratePerTick = (total / (365 * 24 * 60 * 60 * 1000)) * 20;
    let displayed = Math.max(0, total - Math.round(ratePerTick * 120));
    let shown = -1;
    let cells = [];

    const buildCells = (str) => {
      wrap.innerHTML = "";
      cells = [];
      for (const ch of str) {
        if (ch >= "0" && ch <= "9") {
          const col = document.createElement("span");
          col.className = "od-col";
          const strip = document.createElement("span");
          strip.className = "od-strip";
          strip.innerHTML = "01234567890"
            .split("")
            .map((d) => `<span class="od-d">${d}</span>`)
            .join("");
          col.appendChild(strip);
          wrap.appendChild(col);
          cells.push({ kind: "d", strip, pos: 0 });
        } else {
          const sep = document.createElement("span");
          sep.className = "od-sep";
          sep.textContent = ch;
          wrap.appendChild(sep);
          cells.push({ kind: "s" });
        }
      }
    };

    const setNumber = (n, instant) => {
      const str = n.toLocaleString("en-US");
      if (str.length !== cells.length) buildCells(str);
      for (let i = 0; i < str.length; i++) {
        const ch = str[i];
        const cell = cells[i];
        if (cell.kind !== "d") continue;
        const d = ch.charCodeAt(0) - 48;
        if (cell.pos === 10) {
          cell.strip.style.transition = "none";
          cell.strip.style.transform = "translateY(0)";
          cell.strip.offsetHeight;
          cell.strip.style.transition = "";
          cell.pos = 0;
        }
        if (cell.pos === d) continue;
        if (instant) {
          cell.strip.style.transition = "none";
          cell.strip.style.transform = `translateY(-${d}em)`;
          cell.strip.offsetHeight;
          cell.strip.style.transition = "";
          cell.pos = d;
        } else if (cell.pos === 9 && d === 0) {
          cell.strip.style.transform = `translateY(-10em)`;
          cell.pos = 10;
        } else {
          cell.strip.style.transform = `translateY(-${d}em)`;
          cell.pos = d;
        }
      }
    };

    shown = Math.floor(displayed);
    setNumber(shown, true);

    const id = setInterval(() => {
      displayed += ratePerTick;
      const next = Math.floor(displayed);
      if (next !== shown) {
        shown = next;
        setNumber(shown, false);
      }
    }, 20);
    registerCleanup(() => clearInterval(id));
  } catch {
    root.style.display = "none";
  }
}

function initCountUp() {
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const cells = document.querySelectorAll("#homev2 .closer-cell .cv");
  if (!cells.length) return;
  const animate = (cell) => {
    const match = cell.textContent.match(/^(\d+)/);
    if (!match) return;
    const target = parseInt(match[1], 10);
    const suffix = cell.innerHTML.slice(match[1].length);
    if (reduced) return;
    const dur = 900;
    const start = performance.now();
    const tick = (now) => {
      const t = Math.min(1, (now - start) / dur);
      const eased = 1 - Math.pow(1 - t, 3);
      const n = Math.round(target * eased);
      cell.innerHTML = n + suffix;
      if (t < 1) requestAnimationFrame(tick);
    };
    cell.innerHTML = "0" + suffix;
    requestAnimationFrame(tick);
  };
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          animate(e.target);
          io.unobserve(e.target);
        }
      });
    },
    { threshold: 0.4 },
  );
  cells.forEach((c) => io.observe(c));
  registerCleanup(() => io.disconnect());
}

function initLiveArchitecture() {
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduced) return;

  const ids = [];
  const variants = [
    "0x0000ffff…",
    "0x0000fffe…",
    "0x0000fff8…",
    "0x0000fffd…",
    "0x00010000…",
  ];

  document.querySelectorAll("#homev2 .how-card .kv-rate").forEach((el, i) => {
    ids.push(
      setInterval(
        () => {
          el.textContent = (2.18 + Math.random() * 0.4).toFixed(2) + "M";
        },
        280 + i * 90,
      ),
    );
  });

  document.querySelectorAll("#homev2 .how-card .kv-target").forEach((el, i) => {
    let ti = i % variants.length;
    ids.push(
      setInterval(
        () => {
          ti = (ti + 1) % variants.length;
          el.textContent = variants[ti];
        },
        4200 + i * 760,
      ),
    );
  });

  const probes = Array.from(
    document.querySelectorAll("#homev2 .probe-log .pt"),
  );
  let probeLoopActive = true;
  if (probes.length) {
    const defs = [
      { base: 4, jitter: 3 },
      { base: 11, jitter: 4 },
      { base: 2, jitter: 2 },
      { check: true },
    ];
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const run = async () => {
      while (probeLoopActive) {
        for (let i = 0; i < probes.length; i++) {
          if (!probeLoopActive) return;
          const pr = probes[i];
          const d = defs[i];
          pr.classList.remove("ok");
          pr.classList.add("running");
          pr.textContent = "…";
          await wait(260 + Math.random() * 140);
          pr.classList.remove("running");
          if (d.check) {
            pr.textContent = "✓";
            pr.classList.add("ok");
          } else {
            const v = Math.max(
              1,
              d.base + Math.floor((Math.random() - 0.5) * d.jitter * 2),
            );
            pr.textContent = `${v}ms`;
          }
          await wait(140 + Math.random() * 100);
        }
        await wait(1600);
      }
    };
    run();
  }

  registerCleanup(() => {
    ids.forEach(clearInterval);
    probeLoopActive = false;
  });
}
function track(name, props) {
  try {
    if (typeof window === "undefined" || typeof window.plausible !== "function")
      return;
    window.plausible(name, props ? { props } : undefined);
  } catch {}
}

function initTrustView() {
  const el = document.querySelector("#homev2 .trust-zone");
  if (!el || typeof IntersectionObserver === "undefined") return;
  let fired = false;
  const io = new IntersectionObserver(
    (entries) => {
      if (fired) return;
      if (entries.some((e) => e.isIntersecting)) {
        fired = true;
        io.disconnect();
        track("trust_view");
      }
    },
    { threshold: 0.6 },
  );
  io.observe(el);
  registerCleanup(() => io.disconnect());
}

function initCtaTracking() {
  const handlers = [];
  document.querySelectorAll("#homev2 [data-cta]").forEach((el) => {
    const handler = () => {
      track("cta_click", {
        cta: el.getAttribute("data-cta"),
        location: el.getAttribute("data-cta-location") || "unknown",
      });
    };
    el.addEventListener("click", handler);
    handlers.push([el, handler]);
  });
  registerCleanup(() =>
    handlers.forEach(([el, h]) => el.removeEventListener("click", h)),
  );
}

function initCtaBlockView() {
  const el = document.querySelector("#homev2 .cta-block");
  if (!el || typeof IntersectionObserver === "undefined") return;
  let fired = false;
  const io = new IntersectionObserver(
    (entries) => {
      if (fired) return;
      if (entries.some((e) => e.isIntersecting)) {
        fired = true;
        io.disconnect();
        track("cta_block_view");
      }
    },
    { threshold: 0.4 },
  );
  io.observe(el);
  registerCleanup(() => io.disconnect());
}

async function loadGithubStars() {
  const els = document.querySelectorAll(".homev2-gh-stars");
  if (!els.length) return;
  const write = (v) =>
    els.forEach((el) => {
      el.textContent = v;
    });
  try {
    const cached = sessionStorage.getItem("cap-gh-stars");
    if (cached) write(cached);
    const res = await fetch("https://api.github.com/repos/tiagozip/cap", {
      headers: { Accept: "application/vnd.github+json" },
    });
    if (!res.ok) return;
    const data = await res.json();
    const n = data.stargazers_count;
    if (typeof n !== "number") return;
    const formatted = n >= 1000 ? `${(n / 1000).toFixed(1)}k` : `${n}`;
    write(formatted);
    sessionStorage.setItem("cap-gh-stars", formatted);
  } catch {}
}

function initSizeBars() {
  const root = document.querySelector("#homev2 #speed .sizebars");
  if (!root) return;
  const bars = Array.from(root.querySelectorAll(".sizebar"));
  if (!bars.length) return;
  const data = bars.map((bar) => {
    const fill = bar.querySelector(".sb-fill");
    const num = bar.querySelector(".sb-num");
    return {
      fill,
      num,
      width: fill ? fill.style.width || "0%" : "0%",
      value: num ? parseInt(num.textContent, 10) || 0 : 0,
    };
  });
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  data.forEach((d) => {
    if (d.fill) d.fill.style.width = "0%";
    if (d.num) d.num.textContent = "0";
  });
  const timeouts = [];
  let started = false;
  const run = () => {
    if (started) return;
    started = true;
    data.forEach((d, i) => {
      const t = setTimeout(() => {
        if (d.fill) {
          d.fill.style.transition = "width 1s cubic-bezier(0.22, 1, 0.36, 1)";
          d.fill.style.width = d.width;
        }
        const dur = 1000;
        const start = performance.now();
        const tick = (now) => {
          const p = Math.min(1, (now - start) / dur);
          const eased = 1 - Math.pow(1 - p, 3);
          if (d.num) d.num.textContent = Math.round(d.value * eased).toString();
          if (p < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      }, i * 150);
      timeouts.push(t);
    });
  };
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          io.disconnect();
          run();
        }
      });
    },
    { threshold: 0.35 },
  );
  io.observe(root);
  registerCleanup(() => {
    io.disconnect();
    timeouts.forEach(clearTimeout);
  });
}

onMounted(() => {
  document.documentElement.classList.add("home-v2-active");
  initFromWidgetBanner();
  loadStats();
  initCountUp();
  initLiveArchitecture();
  initCtaTracking();
  initCtaBlockView();
  initTrustView();
  loadGithubStars();
  initSizeBars();
  track("hero_view");
});

onBeforeUnmount(() => {
  document.documentElement.classList.remove("home-v2-active");
  while (cleanups.length) {
    try {
      cleanups.pop()();
    } catch {}
  }
});
</script>

<template>
  <div id="homev2" :class="{ 'has-widget-banner': fromWidget }">
    <Transition name="widget-banner">
      <aside
        v-if="fromWidget"
        class="widget-banner"
        role="region"
        aria-label="From the Cap widget"
      >
        <div class="wrap widget-banner-wrap">
          <span class="widget-banner-icon" aria-hidden="true">
            <svg
              viewBox="0 0 24 24"
              width="16"
              height="16"
              fill="none"
              stroke="currentColor"
              stroke-width="2.6"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path d="M5 12.5l4.2 4.2L19 7" />
            </svg>
          </span>
          <p class="widget-banner-text">
            <strong
              >You just verified you're human with Cap<template
                v-if="fromWidgetHost"
                >&nbsp;on {{ fromWidgetHost }}</template
              >.</strong
            >
            <span class="widget-banner-sub"
              >You can close this tab. Or stick around if you're curious what
              Cap is.</span
            >
          </p>
          <button
            class="widget-banner-close"
            type="button"
            aria-label="Dismiss"
            @click="dismissWidgetBanner"
          >
            <svg
              viewBox="0 0 24 24"
              width="14"
              height="14"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
            >
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>
      </aside>
    </Transition>
    <header class="top">
      <div class="wrap wrap-hero">
        <div class="inner">
          <div class="left">
            <a class="brand" href="/" aria-label="Cap home">
              <img alt="" src="/logo.png" width="20" height="20" />
              <strong>Cap</strong>
            </a>
            <VPNavBarSearch class="homev2-search" />
          </div>
          <nav>
            <a href="/guide/" data-cta="docs" data-cta-location="nav">Docs</a>
            <a href="#features" data-cta="features" data-cta-location="nav"
              >Features</a
            >
            <a
              class="gh-link"
              href="https://github.com/tiagozip/cap"
              aria-label="GitHub"
              data-cta="github"
              data-cta-location="nav"
            >
              <svg
                viewBox="0 0 24 24"
                width="14"
                height="14"
                fill="currentColor"
                aria-hidden="true"
              >
                <path
                  d="M12 .5C5.73.5.5 5.73.5 12c0 5.08 3.29 9.39 7.86 10.91.58.1.79-.25.79-.56 0-.28-.01-1.02-.02-2-3.2.69-3.87-1.54-3.87-1.54-.52-1.32-1.27-1.67-1.27-1.67-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.18 1.76 1.18 1.02 1.75 2.68 1.24 3.34.95.1-.74.4-1.24.72-1.53-2.55-.29-5.24-1.28-5.24-5.68 0-1.25.45-2.28 1.18-3.08-.12-.29-.51-1.46.11-3.04 0 0 .96-.31 3.15 1.18.91-.25 1.89-.38 2.86-.38.97 0 1.95.13 2.86.38 2.19-1.49 3.15-1.18 3.15-1.18.62 1.58.23 2.75.11 3.04.73.8 1.18 1.83 1.18 3.08 0 4.41-2.69 5.38-5.25 5.67.41.35.78 1.05.78 2.11 0 1.52-.01 2.75-.01 3.12 0 .31.21.67.8.56C20.71 21.38 24 17.08 24 12c0-6.27-5.23-11.5-11.5-11.5z"
                />
              </svg>
              <span class="homev2-gh-stars">6.2k</span>
            </a>
          </nav>
        </div>
      </div>
    </header>

    <main>
      <div class="wrap hero-wrap">
        <div class="hero-copy">
          <h1>
            Self-hosted CAPTCHA<br />
            <span class="dim">for the modern web.</span>
          </h1>

          <p class="lead">
            No Google. No telemetry. No visual puzzles. <br />Switch from
            reCAPTCHA in minutes.
          </p>

          <div class="actions">
            <a
              class="btn primary"
              href="/guide/"
              data-cta="docs"
              data-cta-location="hero"
              >Get started in 5 minutes <span class="arr">→</span></a
            >
            <a
              class="btn"
              href="/guide/demo.html"
              data-cta="demo"
              data-cta-location="hero"
              >Try the demo <span class="arr">↗</span></a
            >
          </div>
        </div>

        <div class="hero-image" aria-hidden="true">
          <div class="image-bg"></div>
          <img class="image-src" src="/logo.png" alt="" />
        </div>
      </div>

      <div class="hero-stage">
        <div class="variant v-dashboard">
          <div class="dash-wrap">
            <div class="dash-frame">
              <img
                src="/assets/screenshot.webp"
                alt="Cap admin dashboard screenshot"
                width="2892"
                height="1556"
                fetchpriority="high"
                style="width: 100%; height: auto"
              />
            </div>
          </div>
        </div>
      </div>

      <div class="wrap">
        <div class="trust-zone">
          <div class="logoimg">
            <span class="logobar-label">Trusted in production by</span>
            <span class="logoimg-row">
              <img
                class="li li-bunny"
                src="/logos/bunny.svg"
                alt="bunny.net"
                width="112"
                height="43"
                loading="lazy"
              />
              <img
                class="li li-adguard"
                src="/logos/adguard.svg"
                alt="AdGuard"
                width="120"
                height="60"
                loading="lazy"
              />
              <img
                class="li li-fraunhofer"
                src="/logos/fraunhofer.svg"
                alt="Fraunhofer"
                width="258"
                height="72"
                loading="lazy"
              />
            </span>
          </div>
        </div>
      </div>

      <section class="block" id="features">
        <div class="wrap-wide">
          <div class="feat-grid">
            <div class="feat-cell">
              <div class="icon">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="32"
                  height="32"
                  fill="currentColor"
                  viewBox="0 0 256 256"
                >
                  <path
                    d="M208,80H176V56a48,48,0,0,0-96,0V80H48A16,16,0,0,0,32,96V208a16,16,0,0,0,16,16H208a16,16,0,0,0,16-16V96A16,16,0,0,0,208,80ZM96,56a32,32,0,0,1,64,0V80H96ZM208,208H48V96H208V208Zm-68-56a12,12,0,1,1-12-12A12,12,0,0,1,140,152Z"
                  ></path>
                </svg>
              </div>
              <h3>Privacy-first. No tracking.</h3>
              <p>
                Zero telemetry. No third-party network. Your users' data stays
                between you and them.
              </p>
            </div>
            <div class="feat-cell">
              <div class="icon">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="32"
                  height="32"
                  fill="currentColor"
                  viewBox="0 0 256 256"
                >
                  <path
                    d="M215.79,118.17a8,8,0,0,0-5-5.66L153.18,90.9l14.66-73.33a8,8,0,0,0-13.69-7l-112,120a8,8,0,0,0,3,13l57.63,21.61L88.16,238.43a8,8,0,0,0,13.69,7l112-120A8,8,0,0,0,215.79,118.17ZM109.37,214l10.47-52.38a8,8,0,0,0-5-9.06L62,132.71l84.62-90.66L136.16,94.43a8,8,0,0,0,5,9.06l52.8,19.8Z"
                  ></path>
                </svg>
              </div>
              <h3>250x smaller than hCaptcha.</h3>
              <p>
                ~20kb, zero dependencies. Loads in milliseconds, not seconds.
              </p>
            </div>
            <div class="feat-cell">
              <div class="icon">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="32"
                  height="32"
                  fill="currentColor"
                  viewBox="0 0 256 256"
                >
                  <path
                    d="M173.66,98.34a8,8,0,0,1,0,11.32l-56,56a8,8,0,0,1-11.32,0l-24-24a8,8,0,0,1,11.32-11.32L112,148.69l50.34-50.35A8,8,0,0,1,173.66,98.34ZM232,128A104,104,0,1,1,128,24,104.11,104.11,0,0,1,232,128Zm-16,0a88,88,0,1,0-88,88A88.1,88.1,0,0,0,216,128Z"
                  ></path>
                </svg>
              </div>
              <h3>No visual puzzles. Always invisible.</h3>
              <p>
                PoW, time-lock challenges and instrumentation run silently in
                the background.
              </p>
            </div>
            <div class="feat-cell">
              <div class="icon">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.6"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  class="icon icon-tabler icons-tabler-outline icon-tabler-brand-open-source"
                >
                  <path stroke="none" d="M0 0h24v24H0z" fill="none" />
                  <path
                    d="M12 3a9 9 0 0 1 3.618 17.243l-2.193 -5.602a3 3 0 1 0 -2.849 0l-2.193 5.603a9 9 0 0 1 3.617 -17.244"
                  />
                </svg>
              </div>
              <h3>Free &amp; open-source</h3>
              <p>
                Apache 2.0 licensed. Audit it, fork it, self-host it. No vendor
                can pull the rug.
              </p>
            </div>
            <div class="feat-cell">
              <div class="icon">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="32"
                  height="32"
                  fill="currentColor"
                  viewBox="0 0 256 256"
                >
                  <path
                    d="M208,40H48A16,16,0,0,0,32,56v56c0,52.72,25.52,84.67,46.93,102.19,23.06,18.86,46,25.26,47,25.53a8,8,0,0,0,4.2,0c1-.27,23.91-6.67,47-25.53C198.48,196.67,224,164.72,224,112V56A16,16,0,0,0,208,40Zm0,72c0,37.07-13.66,67.16-40.6,89.42A129.3,129.3,0,0,1,128,223.62a128.25,128.25,0,0,1-38.92-21.81C61.82,179.51,48,149.3,48,112l0-56,160,0ZM82.34,141.66a8,8,0,0,1,11.32-11.32L112,148.69l50.34-50.35a8,8,0,0,1,11.32,11.32l-56,56a8,8,0,0,1-11.32,0Z"
                  ></path>
                </svg>
              </div>
              <h3>Built for privacy laws.</h3>
              <p>
                Designed to help you meet GDPR, CCPA, LGPD and more, with strict
                privacy and accessibility standards baked in.
              </p>
            </div>
            <div class="feat-cell">
              <div class="icon">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="32"
                  height="32"
                  fill="currentColor"
                  viewBox="0 0 256 256"
                >
                  <path
                    d="M232,32a8,8,0,0,0-8-8c-44.08,0-89.31,49.71-114.43,82.63A60,60,0,0,0,32,164c0,30.88-19.54,44.73-20.47,45.37A8,8,0,0,0,16,224H92a60,60,0,0,0,57.37-77.57C182.3,121.31,232,76.08,232,32ZM92,208H34.63C41.38,198.41,48,183.92,48,164a44,44,0,1,1,44,44Zm32.42-94.45q5.14-6.66,10.09-12.55A76.23,76.23,0,0,1,155,121.49q-5.9,4.94-12.55,10.09A60.54,60.54,0,0,0,124.42,113.55Zm42.7-2.68a92.57,92.57,0,0,0-22-22c31.78-34.53,55.75-45,69.9-47.91C212.17,55.12,201.65,79.09,167.12,110.87Z"
                  ></path>
                </svg>
              </div>
              <h3>Fully customizable</h3>
              <p>
                Colors, size, position, icons, all controllable via CSS
                variables. No iframe lock-in.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section class="block home-ad-block">
        <div class="wrap-wide">
          <div class="home-ad-slot">
            <EthicalAd
              variant="homemid"
              position="top"
              :skip-on-mobile="true"
            />
          </div>
        </div>
      </section>
      <HomeStickyAd />

      <section class="block" id="compliance">
        <div class="wrap-wide">
          <div class="head">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="32"
              height="32"
              fill="currentColor"
              class="shield"
              viewBox="0 0 256 256"
            >
              <path
                d="M208,40H48A16,16,0,0,0,32,56v56c0,52.72,25.52,84.67,46.93,102.19,23.06,18.86,46,25.26,47,25.53a8,8,0,0,0,4.2,0c1-.27,23.91-6.67,47-25.53C198.48,196.67,224,164.72,224,112V56A16,16,0,0,0,208,40Zm-34.32,69.66-56,56a8,8,0,0,1-11.32,0l-24-24a8,8,0,0,1,11.32-11.32L112,148.69l50.34-50.35a8,8,0,0,1,11.32,11.32Z"
              ></path>
            </svg>
            <h2>Compliant out of the box.</h2>
            <p>
              Open-source, self-hosted and privacy-first. We don't use cookies
              or tracking and no data leaves your servers.
            </p>

            <a
              class="cmpl-link"
              href="/guide/compliance.html"
              data-cta="compliance"
              data-cta-location="home_compliance"
              >See how Cap complies <span class="arr">↗</span></a
            >
          </div>

          <div class="cmpl">
            <div class="cmpl-row">
              <span class="cmpl-label">Privacy &amp; data</span>
              <div class="cmpl-chips">
                <span class="cmpl-chip"
                  ><img
                    src="/assets/flags/eu.svg"
                    alt=""
                    width="18"
                    height="18"
                    loading="lazy"
                  />GDPR</span
                >
                <span class="cmpl-chip"
                  ><img
                    src="/assets/flags/us.svg"
                    alt=""
                    width="18"
                    height="18"
                    loading="lazy"
                  />CCPA / CPRA</span
                >
                <span class="cmpl-chip"
                  ><img
                    src="/assets/flags/us.svg"
                    alt=""
                    width="18"
                    height="18"
                    loading="lazy"
                  />HIPAA</span
                >
                <span class="cmpl-chip"
                  ><img
                    src="/assets/flags/ca.svg"
                    alt=""
                    width="18"
                    height="18"
                    loading="lazy"
                  />PIPEDA / CPPA</span
                >
                <span class="cmpl-chip"
                  ><img
                    src="/assets/flags/br.svg"
                    alt=""
                    width="18"
                    height="18"
                    loading="lazy"
                  />LGPD</span
                >
                <span class="cmpl-chip"
                  ><img
                    src="/assets/flags/in.svg"
                    alt=""
                    width="18"
                    height="18"
                    loading="lazy"
                  />DPDPA</span
                >
                <span class="cmpl-chip"
                  ><img
                    src="/assets/flags/cn.svg"
                    alt=""
                    width="18"
                    height="18"
                    loading="lazy"
                  />PIPL</span
                >
                <span class="cmpl-chip"
                  ><img
                    src="/assets/flags/ru.svg"
                    alt=""
                    width="18"
                    height="18"
                    loading="lazy"
                  />152-FZ</span
                >
              </div>
            </div>
            <div class="cmpl-row">
              <span class="cmpl-label">Accessibility</span>
              <div class="cmpl-chips">
                <span class="cmpl-chip"
                  ><span class="cmpl-globe" aria-hidden="true"
                    ><svg viewBox="0 0 32 32">
                      <rect
                        x="1"
                        y="1"
                        width="30"
                        height="30"
                        rx="7"
                        fill="#1f6feb"
                      />
                      <g
                        fill="none"
                        stroke="#fff"
                        stroke-width="1.7"
                        stroke-linecap="round"
                      >
                        <circle cx="16" cy="16" r="10" />
                        <ellipse cx="16" cy="16" rx="4.2" ry="10" />
                        <path d="M6.4 13h19.2M6.4 19h19.2M16 6v20" />
                      </g></svg></span
                  >WCAG 2.2 AA</span
                >
                <span class="cmpl-chip"
                  ><img
                    src="/assets/flags/eu.svg"
                    alt=""
                    width="18"
                    height="18"
                    loading="lazy"
                  />EAA / EN 301 549</span
                >
                <span class="cmpl-chip"
                  ><img
                    src="/assets/flags/us.svg"
                    alt=""
                    width="18"
                    height="18"
                    loading="lazy"
                  />Section 508</span
                >
                <span class="cmpl-chip"
                  ><span class="cmpl-globe" aria-hidden="true"
                    ><svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="32"
                      height="32"
                      fill="currentColor"
                      viewBox="0 0 256 256"
                    >
                      <path
                        d="M229.66,77.66l-128,128a8,8,0,0,1-11.32,0l-56-56a8,8,0,0,1,11.32-11.32L96,188.69,218.34,66.34a8,8,0,0,1,11.32,11.32Z"
                      ></path></svg></span
                  >Internationalization (i18n)</span
                >

                <span class="cmpl-chip"
                  ><span class="cmpl-globe" aria-hidden="true"
                    ><svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="32"
                      height="32"
                      fill="currentColor"
                      viewBox="0 0 256 256"
                    >
                      <path
                        d="M229.66,77.66l-128,128a8,8,0,0,1-11.32,0l-56-56a8,8,0,0,1,11.32-11.32L96,188.69,218.34,66.34a8,8,0,0,1,11.32,11.32Z"
                      ></path></svg></span
                  >RTL support</span
                >
              </div>
            </div>
          </div>
        </div>
      </section>

      <section class="block" id="speed">
        <div class="wrap-wide speed-box">
          <div class="speed-chart">
            <div class="sizebars">
              <div class="sizebar is-cap">
                <span class="sb-name">Cap</span>
                <span class="sb-bar">
                  <span class="sb-fill" style="width: 2.4%"></span>
                  <span class="sb-val"><b class="sb-num">20</b> kB</span>
                </span>
              </div>
              <div class="sizebar">
                <span class="sb-name">ALTCHA</span>
                <span class="sb-bar">
                  <span class="sb-fill" style="width: 4.1%"></span>
                  <span class="sb-val"><b class="sb-num">34</b> kB</span>
                </span>
              </div>
              <div class="sizebar">
                <span class="sb-name">Turnstile</span>
                <span class="sb-bar">
                  <span class="sb-fill" style="width: 13.2%"></span>
                  <span class="sb-val"><b class="sb-num">110</b> kB</span>
                </span>
              </div>
              <div class="sizebar">
                <span class="sb-name">reCAPTCHA</span>
                <span class="sb-bar">
                  <span class="sb-fill" style="width: 60%"></span>
                  <span class="sb-val"><b class="sb-num">500</b> kB</span>
                </span>
              </div>
              <div class="sizebar">
                <span class="sb-name">hCaptcha</span>
                <span class="sb-bar">
                  <span class="sb-fill" style="width: 72%"></span>
                  <span class="sb-val"><b class="sb-num">600</b> kB</span>
                </span>
              </div>
            </div>
          </div>
          <div class="speed-copy">
            <h2>A fraction of the weight</h2>
            <p>
              Cap's widget is extremely lightweight and runs invisibly, shipping
              only about 20 kB of JavaScript with no third-party scripts.
            </p>
            <p class="sizebars-note">Client bundle sizes (minified gzip)</p>
          </div>
        </div>
      </section>

      <section class="block" id="testimonial">
        <figure class="quote-card wrap-wide">
          <blockquote class="quote-text">
            Cap has been a good fit for AdGuard Temp Mail. We use it as an
            <span class="hl">invisible, self-hosted CAPTCHA layer</span> with
            <span class="hl"
              >proof-of-work and browser instrumentation challenges</span
            >, which helps us add abuse protection while keeping the experience
            <span class="hl">lightweight and unobtrusive</span> for regular
            users.
          </blockquote>
          <figcaption class="quote-by">
            <img
              class="quote-logo"
              src="/logos/adguard.svg"
              alt="AdGuard"
              width="120"
              height="60"
              loading="lazy"
            />
            <span class="quote-sep" aria-hidden="true"></span>
            <span class="quote-role">Head of PR, AdGuard</span>
          </figcaption>
        </figure>
      </section>

      <section class="block" id="compare">
        <div class="wrap-wide">
          <div class="head">
            <h2>How it compares</h2>
            <p>
              Cap is the free, open-source, self-hosted option, same detection
              tier as the big names, without shipping your users' data to a
              third party.
            </p>
            <a
              class="cmpl-link"
              href="/guide/alternatives.html"
              data-cta="compare"
              data-cta-location="home_compare"
              >See the full comparison <span class="arr">↗</span></a
            >
          </div>
          <div class="cmp">
            <div class="cmp-row">
              <h3>Self-hosted</h3>
              <p>
                Runs entirely on your own server. reCAPTCHA, hCaptcha and
                Turnstile are cloud-only.
              </p>
            </div>
            <div class="cmp-row">
              <h3>Open source</h3>
              <p>
                Apache 2.0. Read it, fork it, own it. The big three are closed
                source.
              </p>
            </div>
            <div class="cmp-row">
              <h3>No visual puzzles</h3>
              <p>
                Invisible proof-of-work, no crosswalks. reCAPTCHA and hCaptcha
                still show puzzles.
              </p>
            </div>
            <div class="cmp-row">
              <h3>Zero third-party telemetry</h3>
              <p>
                Your visitors' data never leaves your server. Google, Cloudflare
                and hCaptcha all phone home.
              </p>
            </div>
            <div class="cmp-row">
              <h3>Free at scale</h3>
              <p>
                No quotas, no per-request fees. reCAPTCHA and hCaptcha meter or
                charge.
              </p>
            </div>
            <div class="cmp-row">
              <h3>Layered defense</h3>
              <p>
                Proof-of-work layered with dynamic JavaScript instrumentation
                challenges
              </p>
            </div>
          </div>
        </div>
      </section>

      <section class="block" id="widget-demo">
        <div class="wrap-wide">
          <div class="widget-demo-box">
            <span class="widget-demo-title">Try solving a Cap challenge</span>
            <div class="widget-demo-stage">
              <span class="wd-widget-wrap">
                <Demo />
              </span>
            </div>
          </div>
        </div>
      </section>

      <section class="block">
        <div class="wrap">
          <div class="head">
            <h2>
              Two independent layers.<br />Bypass one, the other still holds.
            </h2>
            <p>
              Every challenge solves proof-of-work and runs browser
              instrumentation at the same time. Defeating one layer doesn't
              defeat the other.
            </p>
          </div>
          <div class="how-grid">
            <div class="how-card">
              <span class="lbl">Layer 01</span>
              <h3>PoW and time-locks</h3>
              <p>
                The client solves parallel SHA-256 hashes and time-lock
                challenges tuned against GPU acceleration in WASM.
              </p>
              <div class="kv-stack">
                <div class="kv-row">
                  <div>
                    <span class="kv-k">hashes/s</span
                    ><span class="kv-v kv-rate">2.41M</span>
                  </div>
                  <div>
                    <span class="kv-k">target</span
                    ><span class="kv-v kv-target">0x0000fffd…</span>
                  </div>
                </div>
                <div class="kv-row">
                  <div>
                    <span class="kv-k">hashes/s</span
                    ><span class="kv-v kv-rate">2.36M</span>
                  </div>
                  <div>
                    <span class="kv-k">target</span
                    ><span class="kv-v kv-target">0x0000ffff…</span>
                  </div>
                </div>
                <div class="kv-row">
                  <div>
                    <span class="kv-k">hashes/s</span
                    ><span class="kv-v kv-rate">2.44M</span>
                  </div>
                  <div>
                    <span class="kv-k">target</span
                    ><span class="kv-v kv-target">0x0000fff8…</span>
                  </div>
                </div>
              </div>
            </div>
            <div class="how-card">
              <span class="lbl">Layer 02</span>
              <h3>JS instrumentation</h3>
              <p>
                A freshly-generated JS program runs complex JavaScript, DOM and
                browser checks.
              </p>
              <div class="probe-log">
                <div class="pl">
                  <span class="pi">01</span
                  ><span class="pn">layout.getComputedStyle</span
                  ><span class="pt">4ms</span>
                </div>
                <div class="pl">
                  <span class="pi">02</span
                  ><span class="pn">canvas.toDataURL</span
                  ><span class="pt">11ms</span>
                </div>
                <div class="pl">
                  <span class="pi">03</span
                  ><span class="pn">event.isTrusted</span
                  ><span class="pt">2ms</span>
                </div>
                <div class="pl">
                  <span class="pi">04</span
                  ><span class="pn">navigator.webdriver</span
                  ><span class="pt ok">✓</span>
                </div>
              </div>
              <div class="viz">
                <code>dom</code>
                <div class="dom-probe">
                  <span></span><span></span><span></span><span></span
                  ><span></span><span></span><span></span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section class="block">
        <div class="wrap">
          <div class="stats" id="homev2-stats" aria-live="polite">
            <div class="stats-row">
              <span class="stats-label">CDN hits · 12mo</span>
              <span class="stats-num odometer" id="homev2-stats-total"></span>
            </div>
            <svg
              class="stats-spark"
              id="homev2-stats-spark"
              viewBox="0 0 600 40"
              preserveAspectRatio="none"
              aria-hidden="true"
            ></svg>
            <div class="stats-axis">
              <span id="homev2-stats-from">—</span>
              <span id="homev2-stats-to">—</span>
            </div>
          </div>

          <div class="closer">
            <div class="closer-strip">
              <div class="closer-cell">
                <span class="ck">size</span>
                <span class="cv">20<i>kb</i></span>
                <span class="cd">vs 600 kb+ hCaptcha</span>
              </div>
              <div class="closer-cell">
                <span class="ck">trackers</span>
                <span class="cv">0</span>
                <span class="cd">vs reCAPTCHA</span>
              </div>
              <div class="closer-cell">
                <span class="ck">cost</span>
                <span class="cv">$0<i>/mo</i></span>
                <span class="cd">vs $1k+ hCaptcha</span>
              </div>
              <div class="closer-cell">
                <span class="ck">setup</span>
                <span class="cv">15<i>min</i></span>
                <span class="cd">docker container</span>
              </div>
            </div>

            <dl class="faq">
              <div>
                <dt>Is it GDPR-friendly?</dt>
                <dd>
                  Yes. Cap doesn't phone home, doesn't set cookies, and doesn't
                  fingerprint users. Your server sees the verification, no one
                  else does.
                </dd>
              </div>
              <div>
                <dt>Can I migrate from reCAPTCHA / hCaptcha?</dt>
                <dd>
                  Yes. Cap's siteverify API is compatible with reCAPTCHA and
                  hCaptcha, but you'll need to swap your client-side code to use
                  Cap's widget.
                </dd>
              </div>
              <div>
                <dt>How effective is it against real bots?</dt>
                <dd>
                  Cap's instrumentation combined with proof-of-work is very
                  effective at making abuse extremely difficult to automate at
                  scale.
                </dd>
              </div>
              <div>
                <dt>What does it cost to self-host?</dt>
                <dd>
                  Cap Standalone fits on a $5 VPS for most sites. There are no
                  per-request fees, no egress to a third party, and no API
                  quotas to hit.
                </dd>
              </div>
              <div>
                <dt>What is an open-source CAPTCHA?</dt>
                <dd>
                  An open-source CAPTCHA is bot protection whose code you can
                  read, audit, and
                  <a href="/guide/standalone/">self-host</a>, rather than a
                  closed third-party service. Cap is licensed under Apache 2.0
                  and runs entirely on your own infrastructure, so visitor data
                  never reaches a vendor.
                </dd>
              </div>
              <div>
                <dt>What is the best open-source alternative to reCAPTCHA?</dt>
                <dd>
                  Cap is a privacy-first, self-hosted alternative to Google
                  reCAPTCHA that uses proof-of-work and instrumentation instead
                  of visual puzzles or tracking. Compare it against
                  <a href="/guide/alternatives/recaptcha.html">reCAPTCHA</a>,
                  <a href="/guide/alternatives/hcaptcha.html">hCaptcha</a>, and
                  <a href="/guide/alternatives/turnstile.html">Turnstile</a> to
                  find what fits your stack.
                </dd>
              </div>
            </dl>
          </div>
        </div>
      </section>

      <section class="block cta-block">
        <div class="wrap">
          <div class="cta">
            <h2>Ditch reCAPTCHA this afternoon.</h2>
            <p>
              Drop the widget into your site, point it at a $5 VPS, and stop
              paying anyone to see your users' traffic.
            </p>
            <div class="actions">
              <a
                class="btn primary"
                href="/guide/"
                data-cta="docs"
                data-cta-location="cta_block"
                >Get started in 5 minutes</a
              >
              <a
                class="btn"
                href="/guide/demo.html"
                data-cta="demo"
                data-cta-location="cta_block"
                >Try the demo <span class="arr">↗</span></a
              >
              <a
                class="btn"
                href="https://github.com/tiagozip/cap"
                data-cta="github"
                data-cta-location="cta_block"
                >Star on GitHub</a
              >
            </div>
          </div>
        </div>
      </section>
    </main>

    <div class="wrap home-ad-wrap">
      <EthicalAd variant="docbottom" />
    </div>

    <footer>
      <div class="wrap-wide ft-wrap">
        <div class="ft-top">
          <div class="ft-brand">
            <a class="ft-logo" href="/" aria-label="Cap home">
              <img alt="" src="/logo.png" width="26" height="26" />
              <strong>Cap</strong>
            </a>
            <p class="ft-tagline">
              Self-hosted, open-source CAPTCHA.<br />
              No Google. No telemetry. No puzzles.
            </p>
            <div class="ft-social">
              <a
                class="ft-soc gh-link"
                href="https://github.com/tiagozip/cap"
                aria-label="GitHub"
                data-cta="github"
                data-cta-location="footer"
              >
                <svg
                  viewBox="0 0 24 24"
                  width="15"
                  height="15"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path
                    d="M12 .5C5.73.5.5 5.73.5 12c0 5.08 3.29 9.39 7.86 10.91.58.1.79-.25.79-.56 0-.28-.01-1.02-.02-2-3.2.69-3.87-1.54-3.87-1.54-.52-1.32-1.27-1.67-1.27-1.67-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.18 1.76 1.18 1.02 1.75 2.68 1.24 3.34.95.1-.74.4-1.24.72-1.53-2.55-.29-5.24-1.28-5.24-5.68 0-1.25.45-2.28 1.18-3.08-.12-.29-.51-1.46.11-3.04 0 0 .96-.31 3.15 1.18.91-.25 1.89-.38 2.86-.38.97 0 1.95.13 2.86.38 2.19-1.49 3.15-1.18 3.15-1.18.62 1.58.23 2.75.11 3.04.73.8 1.18 1.83 1.18 3.08 0 4.41-2.69 5.38-5.25 5.67.41.35.78 1.05.78 2.11 0 1.52-.01 2.75-.01 3.12 0 .31.21.67.8.56C20.71 21.38 24 17.08 24 12c0-6.27-5.23-11.5-11.5-11.5z"
                  />
                </svg>
                <span class="homev2-gh-stars">6.2k</span>
              </a>
            </div>
          </div>

          <div class="ft-cols">
            <nav class="ft-col" aria-label="Product">
              <span class="ft-col-title">Product</span>
              <a href="/guide/" data-cta="docs" data-cta-location="footer"
                >Quickstart</a
              >
              <a
                href="/guide/standalone/"
                data-cta="standalone"
                data-cta-location="footer"
                >Standalone</a
              >
              <a
                href="/guide/widget.html"
                data-cta="widget"
                data-cta-location="footer"
                >Widget</a
              >
              <a
                href="/guide/demo.html"
                data-cta="demo"
                data-cta-location="footer"
                >Demo</a
              >
            </nav>
            <nav class="ft-col" aria-label="Compare">
              <span class="ft-col-title">Compare</span>
              <a href="/guide/alternatives/recaptcha.html">vs reCAPTCHA</a>
              <a href="/guide/alternatives/turnstile.html">vs Turnstile</a>
              <a href="/guide/alternatives/hcaptcha.html">vs hCaptcha</a>
              <a href="/guide/alternatives.html">All comparisons</a>
            </nav>
            <nav class="ft-col" aria-label="Learn">
              <span class="ft-col-title">Learn</span>
              <a href="/guide/workings.html">How it works</a>
              <a href="/guide/effectiveness.html">Effectiveness</a>
              <a href="/guide/compliance.html">Compliance</a>
              <a href="/guide/community.html">Community</a>
            </nav>
          </div>
        </div>

        <div class="ft-bottom">
          <span class="ft-copy"
            >© 2026 <a href="https://tiago.zip">tiago.zip</a></span
          >

          <p style="font-family: system-ui; opacity: 0.8">
            Not legal advice. Compliance depends on your deployment.
          </p>
        </div>
      </div>
    </footer>
  </div>
</template>

<style>
.widget-banner {
  background: color-mix(in oklab, var(--accent) 11%, transparent);
  border-bottom: 1px solid color-mix(in oklab, var(--accent) 26%, transparent);
  color: var(--fg);
  font-family: var(--font);
}
#homev2 .wrap.widget-banner-wrap {
  display: flex;
  align-items: center;
  gap: 12px;
  padding-block: 11px;
}
.widget-banner-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  flex-shrink: 0;
  border-radius: 999px;
  background: color-mix(in oklab, var(--accent) 22%, transparent);
  color: var(--accent);
}
.widget-banner-text {
  flex: 1;
  margin: 0;
  font-size: 13.5px;
  line-height: 1.45;
  color: var(--fg-dim);
  min-width: 0;
}
.widget-banner-text strong {
  color: var(--fg);
  font-weight: 600;
}
.widget-banner-sub {
  margin-left: 6px;
}
.widget-banner-close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 6px;
  border: none;
  background: transparent;
  color: var(--fg-mute);
  cursor: pointer;
  flex-shrink: 0;
  transition:
    background 120ms,
    color 120ms;
}
.widget-banner-close:hover {
  background: rgba(255, 255, 255, 0.06);
  color: var(--fg);
}
.widget-banner-enter-active,
.widget-banner-leave-active {
  transition:
    max-height 260ms ease,
    opacity 180ms ease;
  overflow: hidden;
}
.widget-banner-enter-from,
.widget-banner-leave-to {
  max-height: 0;
  opacity: 0;
}
.widget-banner-enter-to,
.widget-banner-leave-from {
  max-height: 120px;
  opacity: 1;
}

@media (max-width: 720px) {
  #homev2 .wrap.widget-banner-wrap {
    gap: 10px;
    align-items: flex-start;
    padding-block: 10px;
  }
  .widget-banner-icon {
    margin-top: 2px;
  }
  .widget-banner-text {
    font-size: 13px;
  }
  .widget-banner-sub {
    display: block;
    margin-left: 0;
    margin-top: 2px;
  }
}

html.home-v2-active {
  --bg: #11111b;
  --surface: #181825;
  --line: #313244;
  --line-strong: rgba(255, 255, 255, 0.14);
  --fg: #e8e8e8;
  --fg-dim: #9399b2;
  --fg-mute: #7f849c;
  --accent: #89b4fa;
  --font: "Inter", ui-sans-serif, -apple-system, BlinkMacSystemFont, sans-serif;
  --mono:
    "TX 02 Data", "JetBrains Mono", ui-monospace, "SF Mono", Menlo, Consolas,
    monospace;

  background: var(--bg);
  color: var(--fg);
  font-family: var(--font);
  font-size: 15px;
  line-height: 1.55;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  font-feature-settings: "ss01";
  scrollbar-width: thin;
  scrollbar-color: rgba(255, 255, 255, 0.14) #11111b;
}
html.home-v2-active body {
  background: var(--bg);
  color: var(--fg);
  font-family: var(--font);
  font-size: 15px;
  line-height: 1.55;
  font-feature-settings: "ss01";
}
html.home-v2-active .VPNav,
html.home-v2-active .VPLocalNav,
html.home-v2-active .VPSidebar,
html.home-v2-active .VPDocFooter,
html.home-v2-active .VPFooter {
  display: none !important;
}
html.home-v2-active .VPContent {
  padding: 0 !important;
  margin: 0 !important;
}
html.home-v2-active .VPContent.is-home {
  padding: 0 !important;
}
html.home-v2-active main.main {
  padding: 0 !important;
}

#homev2 * {
  box-sizing: border-box;
}
#homev2 {
  background: var(--bg);
  color: var(--fg);
  font-family: var(--font);
  font-size: 15px;
  line-height: 1.55;
  font-feature-settings: "ss01";
}
#homev2 a {
  color: var(--fg);
  text-decoration: none;
}
#homev2 ::selection {
  background: color-mix(in oklab, var(--accent) 45%, transparent);
  color: #fff;
}
#homev2 :focus {
  outline: none;
}
#homev2 a:focus-visible,
#homev2 button:focus-visible,
#homev2 summary:focus-visible,
#homev2 [tabindex]:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 3px;
  border-radius: 4px;
  transition: none;
}
#homev2 .btn:focus-visible {
  outline-offset: 2px;
  border-radius: 8px;
}

#homev2 .wrap {
  max-width: 760px;
  margin: 0 auto;
  padding: 0 32px;
}
#homev2 .wrap.hero-wrap,
#homev2 .wrap.wrap-hero {
  max-width: 1040px;
}
#homev2 .wrap.hero-wrap {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 48px;
}
#homev2 .hero-copy {
  min-width: 0;
}
#homev2 .hero-image {
  position: relative;
  width: 280px;
  height: 280px;
  flex-shrink: 0;
}
#homev2 .hero-image .image-bg {
  position: absolute;
  top: 50%;
  left: 50%;
  border-radius: 50%;
  width: 220px;
  height: 220px;
  background-image: -webkit-linear-gradient(-45deg, #38c2fe, #0279db);
  filter: blur(56px);
  transform: translate(-50%, -50%);
  opacity: 0.2;
}
#homev2 .hero-image .image-src {
  position: absolute;
  top: 50%;
  left: 50%;
  max-width: 260px;
  max-height: 260px;
  transform: translate(-50%, -50%);
  filter: drop-shadow(0 18px 40px rgba(2, 121, 219, 0.3));
  border-radius: 0 !important;
}
@media (max-width: 860px) {
  #homev2 .wrap.hero-wrap {
    grid-template-columns: 1fr;
    gap: 24px;
  }
  #homev2 .hero-image {
    display: none;
  }
}
#homev2 .wrap-wide {
  max-width: 1040px;
  margin: 0 auto;
  padding: 0 32px;
}

#homev2 header.top {
  padding: 28px 0 0;
}
#homev2 header.top .inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}
#homev2 header.top .left {
  display: flex;
  align-items: center;
  gap: 20px;
}
#homev2 header.top .brand {
  display: flex;
  align-items: baseline;
  gap: 10px;
}
#homev2 header.top .brand img {
  width: 20px;
  height: 20px;
  transform: translateY(4px);
  border-radius: 0 !important;
}
#homev2 header.top .brand strong {
  font-weight: 600;
  letter-spacing: -0.01em;
}
#homev2 header.top .brand {
  color: var(--fg);
}
#homev2 header.top nav {
  display: flex;
  gap: 22px;
  align-items: center;
  font-family: var(--mono);
  font-size: 12px;
  color: var(--fg-dim);
}
#homev2 header.top nav a {
  position: relative;
  color: var(--fg-dim);
  transition: color 0.18s ease;
}
#homev2 header.top nav a::after {
  content: "";
  position: absolute;
  left: 0;
  right: 0;
  bottom: -4px;
  height: 1px;
  background: var(--accent);
  transform: scaleX(0);
  transform-origin: left center;
  transition: transform 0.28s cubic-bezier(0.22, 1, 0.36, 1);
}
#homev2 header.top nav a:hover {
  color: var(--fg);
}
#homev2 header.top nav a:hover::after {
  transform: scaleX(1);
}
#homev2 header.top nav a.gh-link {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-variant-numeric: tabular-nums;
}
#homev2 header.top nav a.gh-link svg {
  transform: translateY(1px);
  color: var(--fg-dim);
  transition: color 0.18s ease;
}
#homev2 header.top nav a.gh-link:hover svg {
  color: var(--fg);
}

#homev2 .homev2-search {
  display: inline-flex;
  align-items: center;
  flex-grow: 0;
  padding-left: 0 !important;
}
#homev2 .homev2-search .DocSearch-Button {
  margin: 0;
  background: var(--surface);
  transition: transform 0.2s;
}
#homev2 .homev2-search .DocSearch-Button:active {
  transform: scale(0.96);
}
@media (max-width: 720px) {
  #homev2 .homev2-search .DocSearch-Button-Placeholder,
  #homev2 .homev2-search .DocSearch-Button-Keys {
    display: none;
  }
  #homev2 .homev2-search .DocSearch-Button {
    width: 36px;
    height: 36px;
    padding: 0;
    justify-content: center;
  }
}

#homev2 main {
  padding: 60px 0 0;
}

#homev2 h1 {
  font-size: 38px;
  line-height: 1.15;
  letter-spacing: -0.01em;
  font-weight: 500;
  margin: 0 0 24px;
  text-wrap: balance;
}
#homev2 section.block > .wrap > .head h2,
#homev2 section.block > .wrap-wide > .head h2,
#homev2 .cta h2 {
  text-wrap: balance;
}
#homev2 h1 .dim {
  color: var(--fg-dim);
  font-weight: 400;
}

#homev2 .lead {
  font-size: 17px;
  line-height: 1.6;
  color: var(--fg-dim);
  max-width: 60ch;
  margin: 0;
}
#homev2 .lead strong {
  color: var(--fg);
  font-weight: 500;
}

#homev2 .actions {
  margin-top: 32px;
  display: flex;
  gap: 6px;
  align-items: center;
  flex-wrap: wrap;
}
#homev2 .btn {
  font: inherit;
  font-size: 15px;
  padding: 12px 18px;
  border-radius: 10px;
  background: #3132446b;
  color: var(--fg);
  cursor: pointer;
  text-decoration: none;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  transition:
    border-color 0.15s,
    background 0.15s,
    transform 0.2s;
}
#homev2 .btn:hover {
  border-color: rgba(255, 255, 255, 0.3);
  background: rgba(255, 255, 255, 0.02);
  text-decoration: underline;
  text-underline-offset: 3px;

  span {
    text-decoration: underline;
    text-decoration-color: var(--accent);
  }

  &:not(.primary) span {
    text-decoration-color: #00000000;
  }
}
#homev2 .btn:active {
  transform: scale(0.96);
}
#homev2 .btn.primary {
  background: var(--accent);
  color: #0a0a0b;
  border-color: var(--accent);
  font-weight: 500;
}

#homev2 .btn .arr {
  opacity: 0.6;
  display: inline-block;
  transition:
    transform 0.22s cubic-bezier(0.22, 1, 0.36, 1),
    opacity 0.22s ease;
}
#homev2 .btn.primary .arr {
  opacity: 1;
}
#homev2 .btn:hover .arr {
  opacity: 1;
  transform: translateX(3px);
}

#homev2 .hero-stage {
  margin: 64px 0 0;
  position: relative;
  min-height: 360px;
  display: flex;
  align-items: center;
  justify-content: center;
}
#homev2 .v-dashboard {
  min-height: 480px;
}
#homev2 .v-dashboard .dash-wrap {
  position: relative;
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 48px;
}
#homev2 .v-dashboard .dash-frame {
  position: relative;
  width: 100%;
  max-width: 1100px;
  margin-top: 8px;
  border-radius: 14px 14px 0 0;
  border: 1px solid var(--line-strong);
  background: #0e1015;
  border-bottom: none;
  height: fit-content;
}
#homev2 .v-dashboard .dash-frame::after {
  content: "";
  position: absolute;
  inset: 0;
  background: linear-gradient(180deg, transparent 60%, var(--bg) 100%);
  pointer-events: none;
  margin-left: -1px;
  width: calc(100% + 2px);
}
#homev2 .v-dashboard .dash-frame img {
  display: block;
  width: 100%;
  height: auto;
  border-radius: 14px 14px 0 0 !important;
}

#homev2 section.block {
  padding: 60px 0 0;
}
#homev2 section.home-ad-block {
  padding: 56px 0 0;
}
#homev2 .home-ad-slot {
  max-width: 520px;
  margin: 0 auto;
  --vp-c-bg-soft: var(--surface);
  --vp-c-bg-alt: var(--bg);
  --vp-c-border: var(--line);
  --vp-c-text-1: var(--fg);
  --vp-c-text-2: var(--fg-dim);
  --vp-c-text-3: var(--fg-mute);
  --vp-c-brand-1: var(--accent);
  --carbon-bg-primary: var(--surface);
  --carbon-bg-secondary: var(--bg);
  --carbon-text-color: var(--fg);
}
#homev2 .home-ad-slot .ea-wrap--homemid {
  width: 100%;
  margin: 0;
}
@media (max-width: 768px) {
  #homev2 section.home-ad-block {
    display: none;
  }
}
#homev2 section.block.cta-block {
  padding: 120px 0 80px;
  padding-bottom: 0;
}
#homev2 .cta {
  position: relative;
  text-align: center;
  padding: 64px 32px;
  border: 1px solid var(--line-strong);
  border-radius: 16px;
  overflow: hidden;
}
#homev2 .cta .eyebrow {
  display: block;
  margin-bottom: 12px;
  position: relative;
}
#homev2 .cta h2 {
  font-size: 32px;
  font-weight: 500;
  letter-spacing: -0.015em;
  line-height: 1.2;
  margin: 0 0 12px;
  position: relative;
}
#homev2 .cta p {
  margin: 0 auto 28px;
  color: var(--fg-dim);
  font-size: 16px;
  max-width: 52ch;
  position: relative;
}
#homev2 .cta .actions {
  justify-content: center;
  position: relative;
}
@media (max-width: 640px) {
  #homev2 .cta {
    padding: 48px 20px;
  }
  #homev2 .cta h2 {
    font-size: 24px;
  }
}
#homev2 .eyebrow {
  font-family: var(--mono);
  font-size: 11px;
  letter-spacing: 0.14em;
  color: var(--accent);
  text-transform: uppercase;
}
#homev2 section.block > .wrap > .head,
#homev2 section.block > .wrap-wide > .head {
  display: block;
  margin-bottom: 36px;
}
#homev2 section.block > .wrap > .head .eyebrow,
#homev2 section.block > .wrap-wide > .head .eyebrow {
  display: block;
  margin-bottom: 10px;
}
#homev2 section.block > .wrap > .head h2,
#homev2 section.block > .wrap-wide > .head h2 {
  font-size: 28px;
  font-weight: 500;
  letter-spacing: -0.015em;
  margin: 0 0 8px;
  line-height: 1.2;
}
#homev2 section.block > .wrap > .head p,
#homev2 section.block > .wrap-wide > .head p {
  margin: 0;
  color: var(--fg-dim);
  font-size: 15px;
  max-width: 54ch;
}

#homev2 .trust {
  margin-top: 40px;
  padding-top: 24px;
  border-top: 1px dashed var(--line);
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: space-around;
  gap: 10px 14px;
  font-family: var(--mono);
  font-size: 12px;
  color: var(--fg-dim);
}
#homev2 .trust-item {
  color: var(--fg);
  font-family: var(--font);
  font-weight: 500;
  font-size: 13px;
}
#homev2 .trust-sep {
  color: var(--fg-mute);
}

#homev2 .logobar {
  margin-top: 40px;
  padding-top: 24px;
  border-top: 1px dashed var(--line);
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: center;
  gap: 8px 13px;
  font-family: var(--mono);
  font-size: 12px;
  color: var(--fg-dim);
}
#homev2 .logobar-label {
  font-size: 14px;
  color: var(--fg-mute);
  margin-bottom: 2px;
}
#homev2 .logobar-item {
  color: var(--fg);
  font-family: var(--font);
  font-weight: 500;
  font-size: 13px;
}
#homev2 .logobar-sep {
  color: var(--fg-mute);
}
#homev2 .logobar-more {
  font-family: var(--mono);
  font-weight: 400;
  font-size: 11px;
  color: var(--fg-mute);
}

#homev2 .logoimg {
  margin-top: 40px;
  padding-top: 24px;
  border-top: 1px dashed var(--line);
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 14px 30px;
  flex-direction: column;
}
#homev2 .logoimg-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 18px 34px;
}
#homev2 img.li {
  width: auto;
  object-fit: contain;
  opacity: 0.9;
  transition: opacity 0.18s ease;

  --scale: 1.2;
}
#homev2 img.li.li-bunny {
  height: calc(32px * var(--scale));
}
#homev2 img.li.li-adguard {
  height: calc(30px * var(--scale));
}
#homev2 img.li.li-fraunhofer {
  height: calc(22px * var(--scale));
}
#homev2 img.li:hover {
  opacity: 1;
}

#homev2 .how-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}
#homev2 .how-card {
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: 12px;
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  min-height: 260px;
  position: relative;
  overflow: hidden;
}
#homev2 .how-card .lbl {
  font-family: var(--mono);
  font-size: 11px;
  letter-spacing: 0.1em;
  color: var(--fg-mute);
  text-transform: uppercase;
}
#homev2 .how-card h3 {
  margin: 0;
  font-size: 18px;
  font-weight: 500;
  letter-spacing: -0.01em;
}
#homev2 .how-card p {
  margin: 0;
  color: var(--fg-dim);
  font-size: 14px;
  line-height: 1.6;
}
#homev2 .how-card .viz {
  margin-top: auto;
  border-top: 1px dashed var(--line);
  padding-top: 14px;
  font-family: var(--mono);
  font-size: 11px;
  color: var(--fg-mute);
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 36px;
}
#homev2 .how-card .viz code {
  color: var(--fg);
  background: rgba(255, 255, 255, 0.04);
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 11px;
}
#homev2 .dom-probe {
  display: flex;
  gap: 6px;
  flex: 1;
}
#homev2 .dom-probe span {
  width: 8px;
  height: 8px;
  border-radius: 2px;
  background: var(--line-strong);
  animation: homev2-probe-pulse 2.4s ease-in-out infinite;
}
#homev2 .dom-probe span:nth-child(2) {
  animation-delay: 0.2s;
}
#homev2 .dom-probe span:nth-child(3) {
  animation-delay: 0.4s;
}
#homev2 .dom-probe span:nth-child(4) {
  animation-delay: 0.6s;
}
#homev2 .dom-probe span:nth-child(5) {
  animation-delay: 0.8s;
}
#homev2 .dom-probe span:nth-child(6) {
  animation-delay: 1s;
}
#homev2 .dom-probe span:nth-child(7) {
  animation-delay: 1.2s;
}
@keyframes homev2-probe-pulse {
  0%,
  100% {
    background: var(--line-strong);
  }
  50% {
    background: var(--accent);
  }
}
#homev2 .kv-stack {
  margin-top: auto;
}
#homev2 .kv-row {
  display: flex;
  gap: 18px;
  padding: 9px 0;
  border-top: 1px dashed var(--line);
  flex-wrap: wrap;
}
#homev2 .kv-row > div {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}
#homev2 .kv-k {
  font-family: var(--mono);
  font-size: 9.5px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--fg-mute);
}
#homev2 .kv-v {
  font-family: var(--mono);
  font-size: 12px;
  color: var(--fg);
  font-variant-numeric: tabular-nums;
  transition: color 0.25s ease-out;
}
#homev2 .kv-v.ok {
  color: var(--accent);
}
#homev2 .probe-log {
  border-top: 1px dashed var(--line);
  padding: 6px 0;
  margin-top: 4px;
  padding-bottom: 0;
}
#homev2 .pl {
  display: grid;
  grid-template-columns: 20px 1fr auto;
  gap: 10px;
  align-items: center;
  padding: 3px 0;
  font-family: var(--mono);
  font-size: 11.5px;
}
#homev2 .pl .pi {
  color: var(--fg-mute);
}
#homev2 .pl .pn {
  color: var(--fg-dim);
}
#homev2 .pl .pt {
  color: var(--fg-mute);
  font-size: 10.5px;
}
#homev2 .pl .pt.ok {
  color: var(--accent);
}
#homev2 .pl .pt.running {
  color: var(--fg-mute);
  animation: homev2-probe-dots 0.9s ease-in-out infinite;
}
@keyframes homev2-probe-dots {
  0%,
  100% {
    opacity: 0.35;
  }
  50% {
    opacity: 1;
  }
}

#homev2 .feat-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1px;
  overflow: hidden;
}
#homev2 .feat-cell {
  background: var(--bg);
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-height: 180px;
  padding-right: 30px;
  padding-top: 30px;
}
#homev2 .feat-cell .icon {
  color: var(--accent);
  width: 38px;
  height: 38px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  position: relative;
}
#homev2 .feat-cell .icon svg {
  width: 38px;
  height: 38px;
  position: relative;
}
#homev2 .feat-cell h3 {
  margin: 0;
  font-size: 18px;
  font-weight: 500;
  color: var(--fg);
  letter-spacing: -0.005em;
  margin-top: 12px;
}
#homev2 .feat-cell p {
  margin: 0;
  color: var(--fg-dim);
  font-size: 14px;
  line-height: 1.55;
}

#homev2 #compare .wrap-wide {
  display: flex;
  padding: 0;
  border: 1px solid var(--line);
  border-radius: 12px;
}
#homev2 #compare .head {
  flex: 0 0 38%;
  display: flex;
  flex-direction: column;
  justify-content: center;
  margin-bottom: 0;
  padding: 40px 32px;
  border-right: 1px solid var(--line);
}
#homev2 .cmp {
  flex: 1;
  min-width: 0;
  padding: 6px 32px;
}
#homev2 .cmp-row {
  padding: 17px 0;
}
#homev2 .cmp-row + .cmp-row {
  border-top: 1px solid var(--line);
}
#homev2 .cmp-row h3 {
  margin: 0 0 5px;
  font-size: 15px;
  font-weight: 500;
  letter-spacing: -0.005em;
  color: var(--fg);
}
#homev2 .cmp-row p {
  margin: 0;
  font-size: 13.5px;
  line-height: 1.55;
  color: var(--fg-dim);
}
@media (max-width: 860px) {
  #homev2 #compare .wrap-wide {
    flex-direction: column;
  }
  #homev2 #compare .head {
    flex: none;
    border-right: none;
    border-bottom: 1px solid var(--line);
    padding: 28px;
  }
  #homev2 .cmp {
    padding: 6px 28px 18px;
  }
}

#homev2 #widget-demo .wrap-wide {
  padding: 0;
}
#homev2 #widget-demo .widget-demo-box {
  text-align: center;
  padding: 32px 32px 36px;
  border: 1px solid var(--line);
  border-radius: 12px;
}
#homev2 #widget-demo .widget-demo-title {
  display: block;
  font-size: 16px;
  font-weight: 500;
  letter-spacing: -0.01em;
  color: var(--fg);
  margin-bottom: 8px;
}
#homev2 #widget-demo .widget-demo-stage {
  position: relative;
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 10px 0 24px;
}
#homev2 #widget-demo .wd-widget-wrap {
  display: inline-block;
  transform: scale(1.1);
  transform-origin: center;
}
@media (max-width: 640px) {
  #homev2 #widget-demo .widget-demo-box {
    padding: 36px 20px 34px;
  }
  #homev2 #widget-demo .widget-demo-stage {
    padding: 28px 0 12px;
  }
  #homev2 #widget-demo .wd-widget-wrap {
    transform: scale(1);
  }
}

#homev2 footer {
  position: relative;
  margin-top: 20px;
  padding: 36px 0 0;
  overflow: hidden;
}
#homev2 .ft-wrap {
  position: relative;
  z-index: 1;
}

#homev2 .ft-top {
  display: grid;
  grid-template-columns: minmax(0, 1.1fr) minmax(0, 1.4fr);
  gap: 56px;
  padding-bottom: 56px;
}

#homev2 .ft-logo {
  display: inline-flex;
  align-items: baseline;
  gap: 10px;
  font-size: 18px;
}
#homev2 .ft-logo img {
  width: 26px;
  height: 26px;
  transform: translateY(5px);
  border-radius: 0 !important;
}
#homev2 .ft-logo strong {
  font-weight: 600;
  letter-spacing: -0.01em;
}
#homev2 .ft-tagline {
  margin: 18px 0 0;
  max-width: 30ch;
  font-size: 13.5px;
  line-height: 1.6;
  color: var(--fg-dim);
}
#homev2 .ft-social {
  display: flex;
  gap: 10px;
  margin-top: 22px;
}
#homev2 .ft-soc {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  height: 34px;
  padding: 0 13px;
  border: 1px solid var(--line);
  border-radius: 100px;
  background: color-mix(in oklab, var(--surface) 60%, transparent);
  color: var(--fg-dim);
  font-family: var(--mono);
  font-size: 12px;
  font-variant-numeric: tabular-nums;
  transition:
    color 0.18s ease,
    border-color 0.18s ease,
    background 0.18s ease;
}
#homev2 .ft-soc:hover {
  color: var(--fg);
  border-color: color-mix(in oklab, var(--accent) 45%, var(--line));
  background: color-mix(in oklab, var(--accent) 9%, transparent);
}

#homev2 .ft-cols {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 32px;
}
#homev2 .ft-col {
  display: flex;
  flex-direction: column;
  gap: 13px;
}
#homev2 .ft-col-title {
  font-family: var(--mono);
  font-size: 10.5px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--fg-mute);
  margin-bottom: 3px;
}
#homev2 .ft-col a {
  position: relative;
  width: fit-content;
  font-size: 13.5px;
  color: var(--fg-dim);
  transition:
    color 0.18s ease,
    transform 0.18s ease;
}
#homev2 .ft-col a::after {
  content: "";
  position: absolute;
  left: 0;
  right: 0;
  bottom: -2px;
  height: 1px;
  background: var(--accent);
  transform: scaleX(0);
  transform-origin: left center;
  transition: transform 0.28s cubic-bezier(0.22, 1, 0.36, 1);
}
#homev2 .ft-col a:hover {
  color: var(--fg);
}
#homev2 .ft-col a:hover::after {
  transform: scaleX(1);
}

#homev2 .ft-bottom {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  flex-wrap: wrap;
  margin-top: 22px;
  padding: 22px 0 36px;
  border-top: 1px solid var(--line);
  font-family: var(--mono);
  font-size: 12px;
  color: var(--fg-mute);
}
#homev2 .ft-copy a {
  color: var(--fg-dim);
  transition: color 0.18s ease;
}
#homev2 .ft-copy a:hover {
  color: var(--fg);
}
@media (prefers-reduced-motion: reduce) {
  #homev2 .ft-hashtrack {
    animation: none;
  }
}

#homev2 .stats {
  margin-top: 40px;
  padding-top: 24px;
  border-top: 1px dashed var(--line);
}
#homev2 .stats-row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
}
#homev2 .stats-label {
  font-family: var(--mono);
  font-size: 10.5px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--fg-mute);
}
#homev2 .stats-num {
  font-family: var(--mono);
  font-size: 24px;
  line-height: 1;
  letter-spacing: -0.01em;
  color: var(--fg);
  font-variant-numeric: tabular-nums;
  font-feature-settings: "tnum";
}
#homev2 .odometer {
  display: inline-flex;
  align-items: flex-end;
  line-height: 1;
}
#homev2 .od-col {
  display: inline-block;
  overflow: hidden;
  height: 1em;
  width: 1ch;
  text-align: center;
  position: relative;
}
#homev2 .od-strip {
  display: block;
  transition: transform 0.28s cubic-bezier(0.22, 1, 0.36, 1);
  will-change: transform;
}
#homev2 .od-d {
  display: block;
  height: 1em;
  line-height: 1;
}
#homev2 .od-sep {
  display: inline-block;
  line-height: 1;
}
#homev2 .stats-spark {
  display: block;
  width: 100%;
  height: 84px;
  margin-top: 12px;
}
#homev2 .stats-spark .line {
  fill: none;
  stroke: var(--accent);
  stroke-width: 1.25;
  vector-effect: non-scaling-stroke;
  opacity: 0.9;
}
#homev2 .stats-spark .area {
  fill: var(--accent);
  opacity: 0.08;
}
#homev2 .stats-axis {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  margin-top: 8px;
  font-family: var(--mono);
  font-size: 10.5px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--fg-mute);
  gap: 12px;
}

#homev2 .closer {
  margin-top: 64px;
}
#homev2 .closer-strip {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 0;
  border-top: 1px dashed var(--line);
  border-bottom: 1px dashed var(--line);
}
#homev2 .closer-cell {
  padding: 22px 20px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  border-right: 1px dashed var(--line);
}
#homev2 .closer-cell:last-child {
  border-right: none;
}
#homev2 .closer-cell .ck {
  font-family: var(--mono);
  font-size: 10.5px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--fg-mute);
}
#homev2 .closer-cell .cv {
  font-family: var(--mono);
  font-size: 26px;
  line-height: 1;
  letter-spacing: -0.01em;
  color: var(--fg);
  font-variant-numeric: tabular-nums;
  font-feature-settings: "tnum";
}
#homev2 .closer-cell .cv i {
  font-style: normal;
  color: var(--fg-mute);
  font-size: 16px;
  margin-left: 2px;
}
#homev2 .closer-cell .cd {
  font-family: var(--mono);
  font-size: 11px;
  color: var(--fg-mute);
  letter-spacing: 0.005em;
  margin-top: 2px;
}

#homev2 .faq {
  margin: 48px 0 0;
  padding: 0;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 28px 40px;
}
#homev2 .faq > div {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
#homev2 .faq dt {
  font-size: 15px;
  font-weight: 500;
  color: var(--fg);
  letter-spacing: -0.005em;
}
#homev2 .faq dd {
  margin: 0;
  font-size: 14px;
  color: var(--fg-dim);
  line-height: 1.6;
  max-width: 44ch;
}

@media (max-width: 860px) {
  #homev2 .feat-grid {
    grid-template-columns: repeat(2, 1fr);
  }
  #homev2 .how-grid {
    grid-template-columns: 1fr;
  }
  #homev2 .closer-strip {
    grid-template-columns: 1fr 1fr;
  }
  #homev2 .closer-cell:nth-child(2) {
    border-right: none;
  }
  #homev2 .closer-cell:nth-child(-n + 2) {
    border-bottom: 1px dashed var(--line);
  }
  #homev2 .faq {
    grid-template-columns: 1fr;
    gap: 24px;
  }
  #homev2 section.block {
    padding: 64px 0 0;
  }
  #homev2 section.block.cta-block {
    padding: 88px 0 0;
  }
  #homev2 .hero-stage {
    margin-top: 48px;
    min-height: 0;
  }
  #homev2 .v-dashboard {
    min-height: 0;
  }
  #homev2 section.block > .wrap > .head h2,
  #homev2 section.block > .wrap-wide > .head h2 {
    font-size: 24px;
  }
}
@media (max-width: 640px) {
  #homev2 .wrap,
  #homev2 .wrap-wide {
    padding: 0 20px;
  }
  #homev2 main {
    padding: 40px 0 0;
  }
  #homev2 header.top {
    padding: 20px 0 0;
  }
  #homev2 header.top .left {
    gap: 14px;
  }
  #homev2 header.top nav {
    gap: 16px;
  }
  #homev2 .feat-grid {
    grid-template-columns: 1fr;
  }
  #homev2 h1 {
    font-size: 28px;
  }
  #homev2 .lead {
    font-size: 15px;
  }
  #homev2 .actions {
    margin-top: 24px;
  }
  #homev2 .btn {
    padding: 9px 14px;
    font-size: 13.5px;
  }
  #homev2 section.block {
    padding: 48px 0 0;
  }
  #homev2 section.block.cta-block {
    padding: 64px 0 0;
  }
  #homev2 .cta {
    padding: 40px 20px;
  }
  #homev2 .cta h2 {
    font-size: 22px;
  }
  #homev2 .cta p {
    font-size: 14px;
  }
  #homev2 .closer {
    margin-top: 48px;
  }
  #homev2 .closer-cell {
    padding: 18px 16px;
  }
  #homev2 .closer-cell .cv {
    font-size: 22px;
  }
  #homev2 .closer-cell .cv i {
    font-size: 14px;
  }
  #homev2 .trust {
    margin-top: 32px;
    justify-content: center;
    gap: 8px 12px;
    font-size: 12px;
  }
  #homev2 .trust-item {
    font-size: 12px;
  }
  #homev2 .trust-sep {
    display: none;
  }
  #homev2 .logobar {
    margin-top: 32px;
    gap: 7px 11px;
  }
  #homev2 .logoimg {
    margin-top: 32px;
    gap: 12px 18px;
  }
  #homev2 .logoimg-row {
    gap: 14px 24px;
  }
  #homev2 img.li.li-bunny {
    height: 23px;
  }
  #homev2 img.li.li-adguard {
    height: 25px;
  }
  #homev2 img.li.li-fraunhofer {
    height: 16px;
  }
  #homev2 footer {
    margin-top: 12px;
    padding-top: 56px;
  }
  #homev2 .ft-top {
    grid-template-columns: 1fr;
    gap: 40px;
    padding-bottom: 40px;
  }
  #homev2 .how-card {
    padding: 20px;
    min-height: 0;
  }
  #homev2 section.block > .wrap > .head,
  #homev2 section.block > .wrap-wide > .head {
    margin-bottom: 28px;
  }
  #homev2 section.block > .wrap > .head h2,
  #homev2 section.block > .wrap-wide > .head h2 {
    font-size: 22px;
  }
  #homev2 .hero-stage {
    margin-top: 40px;
  }
  #homev2 .ft-cols {
    gap: 24px 20px;
  }
}
@media (max-width: 480px) {
  #homev2 .ft-cols {
    grid-template-columns: 1fr 1fr;
  }
}
@media (max-width: 420px) {
  #homev2 .wrap,
  #homev2 .wrap-wide {
    padding: 0 16px;
  }
  #homev2 h1 {
    font-size: 26px;
  }
  #homev2 .btn {
    padding: 9px 12px;
    font-size: 13px;
  }
  #homev2 header.top nav {
    gap: 14px;
    font-size: 11.5px;
  }
  #homev2 .closer-strip {
    grid-template-columns: 1fr;
  }
  #homev2 .closer-cell {
    border-right: none !important;
    border-bottom: 1px dashed var(--line);
  }
  #homev2 .closer-cell:last-child {
    border-bottom: none;
  }
  #homev2 .closer-cell:nth-child(-n + 2) {
    border-bottom: 1px dashed var(--line);
  }
  #homev2 .kv-row {
    gap: 12px;
  }
}

@keyframes homev2-hero-in {
  from {
    opacity: 0;
    transform: translateY(14px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
@keyframes homev2-hero-stage-in {
  from {
    opacity: 0;
    transform: translateY(24px) scale(0.985);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}
#homev2 .hero-copy > h1,
#homev2 .hero-copy > .lead,
#homev2 .hero-copy > .actions,
#homev2 .hero-image,
#homev2 .hero-stage,
#homev2 .trust,
#homev2 .logobar,
#homev2 .logoimg {
  opacity: 0;
  animation: homev2-hero-in 0.7s cubic-bezier(0.2, 0.8, 0.2, 1) both;
}
#homev2 .hero-stage {
  animation-name: homev2-hero-stage-in;
  animation-duration: 0.9s;
}
#homev2 .hero-copy > h1 {
  animation-delay: 0.05s;
}
#homev2 .hero-copy > .lead {
  animation-delay: 0.2s;
}
#homev2 .hero-copy > .actions {
  animation-delay: 0.34s;
}
#homev2 .hero-image {
  animation-delay: 0.2s;
}
#homev2 .hero-stage {
  animation-delay: 0.48s;
}
#homev2 .trust,
#homev2 .logobar,
#homev2 .logoimg {
  animation-delay: 0.62s;
}

@media (prefers-reduced-motion: reduce) {
  #homev2 .hero-copy > h1,
  #homev2 .hero-copy > .lead,
  #homev2 .hero-copy > .actions,
  #homev2 .hero-image,
  #homev2 .hero-stage,
  #homev2 .trust,
  #homev2 .logobar,
  #homev2 .logoimg {
    opacity: 1;
    animation: none;
  }
  #homev2 .dom-probe span,
  #homev2 .pl .pt.running {
    animation: none;
  }
}

@font-face {
  font-family: "TX 02 Data";
  src: url("/assets/tx-02-data-regular.woff2") format("woff2");
  font-weight: 400;
  font-display: swap;
}

@font-face {
  font-family: "Inter";
  src: url("/assets/inter.woff2") format("woff2");
  font-display: swap;
}

#homev2 #compliance {
  .wrap-wide {
    display: flex;
    gap: 0px;
    border: 1px solid var(--line);
    padding-top: 0px;
    padding-bottom: 0px;
    border-radius: 12px;

    .head {
      flex: 0 0 38%;
      padding-top: 48px;
      padding-bottom: 48px;
      border-right: 1px solid var(--line);
      margin-bottom: 0px;
      padding-right: 30px;

      .shield {
        color: var(--accent);
        width: 48px;
        height: 48px;
      }

      h2 {
        margin-top: 1em;
      }
    }
  }
}

#homev2 .cmpl {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding: 18px 32px;
}
#homev2 .cmpl-row {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 12px;
  padding: 20px 0;
}
#homev2 .cmpl-row + .cmpl-row {
  border-top: 1px solid var(--line);
}
#homev2 .cmpl-label {
  color: var(--fg-mute);
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}
#homev2 .cmpl-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
#homev2 .cmpl-chip {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 5px 12px;
  border: 1px solid var(--line);
  border-radius: 999px;
  background: var(--surface);
  font-size: 13px;
  color: var(--fg);
  white-space: nowrap;
}
#homev2 .cmpl-chip img,
#homev2 .cmpl-chip .cmpl-globe,
#homev2 .cmpl-chip .cmpl-globe svg {
  width: 18px;
  height: 18px;
  display: block;
  flex-shrink: 0;
  border-radius: 4px;
}
#homev2 .cmpl-link {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-top: 28px;
  font-size: 14px;
  color: var(--accent);
  text-decoration: none;
}
#homev2 .cmpl-link:hover {
  text-decoration: underline;
}

@media (max-width: 860px) {
  #homev2 #compliance .wrap-wide {
    flex-direction: column;
  }
  #homev2 #compliance .wrap-wide .head {
    flex: none;
    border-right: none;
    border-bottom: 1px solid var(--line);
    padding: 32px 28px;
  }
  #homev2 .cmpl {
    padding: 8px 28px 24px;
  }
}

#homev2 .speed-box {
  display: flex;
  border: 1px solid var(--line);
  border-radius: 12px;
  overflow: hidden;
}
#homev2 .speed-chart {
  flex: 1;
  min-width: 0;
  padding: 34px 36px;
  border-right: 1px solid var(--line);
}
#homev2 .speed-copy {
  flex: 0 0 39%;
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding: 34px 36px;
}
#homev2 .speed-copy h2 {
  font-size: 26px;
  font-weight: 500;
  letter-spacing: -0.015em;
  line-height: 1.2;
  margin: 0 0 12px;
}
#homev2 .speed-copy p {
  margin: 0;
  font-size: 14.5px;
  line-height: 1.6;
  color: var(--fg-dim);
}
#homev2 .speed-copy .sizebars-note {
  margin: 16px 0 0;
  font-size: 12.5px;
  color: var(--fg-mute);
}
#homev2 .sizebars {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
#homev2 .sizebar {
  display: grid;
  grid-template-columns: 78px 1fr;
  align-items: center;
  gap: 14px;
}
#homev2 .sb-name {
  text-align: right;
  font-size: 13px;
  font-weight: 500;
  color: var(--fg-dim);
}
#homev2 .sb-bar {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}
#homev2 .sb-fill {
  flex: none;
  height: 26px;
  min-width: 8px;
  border-radius: 7px;
  background: color-mix(in oklab, var(--fg-mute) 26%, var(--surface));
}
#homev2 .sb-val {
  font-family: var(--mono);
  font-size: 13px;
  color: var(--fg-mute);
  white-space: nowrap;
}
#homev2 .sb-num {
  font-weight: 600;
  color: var(--fg-dim);
}
#homev2 .sizebar.is-cap .sb-name {
  color: var(--accent);
  font-weight: 600;
}
#homev2 .sizebar.is-cap .sb-fill {
  background: var(--accent);
}
#homev2 .sizebar.is-cap .sb-val,
#homev2 .sizebar.is-cap .sb-num {
  color: var(--accent);
}

#homev2 #compare,
#homev2 #speed,
#homev2 #widget-demo,
#homev2 #testimonial {
  padding-top: 32px;
}
@media (max-width: 640px) {
  #homev2 .sizebar {
    grid-template-columns: 64px 1fr;
    gap: 10px;
  }
  #homev2 .sb-name {
    font-size: 12px;
  }
}
@media (max-width: 860px) {
  #homev2 .speed-box {
    flex-direction: column-reverse;
  }
  #homev2 .speed-chart {
    border-right: none;
    border-bottom: 1px solid var(--line);
    padding: 26px 24px;
  }
  #homev2 .speed-copy {
    flex: none;
    padding: 28px 24px;
  }
}

#homev2 #testimonial .quote-card {
  display: flex;
  flex-direction: column;
  gap: 32px;
  padding: 40px 36px;
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: 12px;
}
#homev2 .quote-text {
  margin: 0;
  font-size: 27px;
  font-weight: 400;
  line-height: 1.42;
  letter-spacing: -0.015em;
  color: var(--fg-dim);
  text-wrap: balance;
}
#homev2 .quote-text .hl {
  color: var(--fg);
  font-weight: 500;
}
#homev2 .quote-by {
  display: flex;
  align-items: center;
  gap: 18px;
}
#homev2 .quote-logo {
  height: 30px;
  width: auto;
  object-fit: contain;
  opacity: 0.95;
}
#homev2 .quote-sep {
  width: 1px;
  height: 22px;
  background: var(--line);
}
#homev2 .quote-role {
  font-size: 14px;
  color: var(--fg-mute);
}
@media (max-width: 860px) {
  #homev2 #testimonial .quote-card {
    gap: 26px;
    padding: 28px 24px;
  }
  #homev2 .quote-text {
    font-size: 22px;
  }
}
</style>
