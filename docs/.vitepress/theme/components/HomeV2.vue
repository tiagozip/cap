<script setup>
import { onMounted, onBeforeUnmount } from "vue";
import VPNavBarSearch from "vitepress/dist/client/theme-default/components/VPNavBarSearch.vue";

const SNIPPETS = {
  html:
    `<!-- drop in anywhere -->\n<scr` +
    `ipt src="https://cdn.jsdelivr.net/npm/@cap.js/widget"></scr` +
    `ipt>\n\n<cap-widget\n  data-cap-api-endpoint="https://your.server/<site-key>/">\n</cap-widget>`,
  react: `import "@cap.js/widget";\n\n<cap-widget
  data-cap-api-endpoint="https://your.server/<site-key>/"
  onsolve={(e) => console.log("token:", e.detail.token)}
  onprogress={(e) => console.log(e.detail.progress)}
  onerror={(e) => console.error(e.detail.message)}
/>`,
  docker: `# self-host in one command\ndocker run -p 3000:3000 \\\n  -e ADMIN_KEY=$(openssl rand -hex 32) \\\n  tiago2/standalone:latest\n\n# includes analytics + multi-site-key support`,
  verify: `// server-side\nconst res = await fetch("https://your.server/siteverify", {\n  method: "POST",\n  body: JSON.stringify({ secret, response: token })\n});\nconst { success } = await res.json();`,
};

const cleanups = [];

function registerCleanup(fn) {
  cleanups.push(fn);
}

function initTabs() {
  const tabEls = Array.from(document.querySelectorAll("#homev2 #tabs button[data-tab]"));
  const tabIndicator = document.querySelector("#homev2 #tabs .tab-indicator");
  let currentSnippet = "html";

  const KEYWORDS = new Set([
    "const", "let", "var", "import", "export", "from", "await", "new", "return",
    "async", "function", "if", "else", "for", "while", "try", "catch", "throw",
    "true", "false", "null", "undefined", "void", "typeof", "in", "of",
  ]);
  const BUILTINS = new Set(["fetch", "JSON", "console", "document", "window", "Math", "Promise"]);

  function renderCode(key) {
    const el = document.getElementById("homev2-code");
    if (!el) return;
    const text = SNIPPETS[key];
    const esc = text.replace(/[&<>]/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[m]);
    const tokenRe = new RegExp(
      [
        "(&lt;!--[\\s\\S]*?--&gt;)",
        "(\\/\\/[^\\n]*)",
        "(#[^\\n]*)",
        "(\"[^\"\\n]*\"|`[^`]*`)",
        "(&lt;\\/?[a-zA-Z][\\w-]*)",
        "([a-zA-Z][\\w-]*)(?==)",
        "\\b([A-Za-z_$][\\w$]*)\\b",
        "\\b(\\d+(?:\\.\\d+)?)\\b",
      ].join("|"),
      "g",
    );
    const painted = esc.replace(
      tokenRe,
      (m, htmlC, slashC, hashC, str, tag, attr, word, num) => {
        if (htmlC) return `<span class="c">${htmlC}</span>`;
        if (slashC) return `<span class="c">${slashC}</span>`;
        if (hashC) return `<span class="c">${hashC}</span>`;
        if (str) return `<span class="s">${str}</span>`;
        if (tag) return `<span class="t">${tag}</span>`;
        if (attr) return `<span class="a">${attr}</span>`;
        if (word) {
          if (KEYWORDS.has(word)) return `<span class="k">${word}</span>`;
          if (BUILTINS.has(word)) return `<span class="p">${word}</span>`;
          return word;
        }
        if (num) return `<span class="n">${num}</span>`;
        return m;
      },
    );
    el.innerHTML = painted;
    currentSnippet = key;
  }

  function positionIndicator(btn) {
    if (!tabIndicator || !btn) return;
    tabIndicator.style.width = btn.offsetWidth + "px";
    tabIndicator.style.transform = `translateX(${btn.offsetLeft}px)`;
  }

  const handlers = [];
  tabEls.forEach((b) => {
    const handler = () => {
      tabEls.forEach((x) => x.classList.remove("active"));
      b.classList.add("active");
      renderCode(b.dataset.tab);
      positionIndicator(b);
    };
    b.addEventListener("click", handler);
    handlers.push([b, handler]);
  });

  renderCode("html");
  requestAnimationFrame(() => positionIndicator(tabEls.find((b) => b.classList.contains("active"))));

  const onResize = () => {
    const active = tabEls.find((b) => b.classList.contains("active"));
    positionIndicator(active);
  };
  window.addEventListener("resize", onResize);

  const copyBtn = document.getElementById("homev2-copy-btn");
  let copyTimer;
  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(SNIPPETS[currentSnippet]);
      copyBtn.classList.add("copied");
      copyBtn.querySelector(".copy-label").textContent = "Copied";
      clearTimeout(copyTimer);
      copyTimer = setTimeout(() => {
        copyBtn.classList.remove("copied");
        copyBtn.querySelector(".copy-label").textContent = "Copy";
      }, 1600);
    } catch {
      copyBtn.querySelector(".copy-label").textContent = "Failed";
    }
  };
  if (copyBtn) copyBtn.addEventListener("click", onCopy);

  registerCleanup(() => {
    handlers.forEach(([b, h]) => b.removeEventListener("click", h));
    window.removeEventListener("resize", onResize);
    if (copyBtn) copyBtn.removeEventListener("click", onCopy);
    clearTimeout(copyTimer);
  });
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
    const dates = Object.entries(hits.dates).sort(([a], [b]) => (a < b ? -1 : 1));
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

    document.getElementById("homev2-stats-from").textContent = fmtDate(chartDates[0][0]);
    document.getElementById("homev2-stats-to").textContent = fmtDate(chartDates[chartDates.length - 1][0]);

    const svg = document.getElementById("homev2-stats-spark");
    const W = 600, H = 40, pad = 2;
    const innerW = W - pad * 2;
    const innerH = H - pad * 2;
    const step = innerW / Math.max(1, values.length - 1);
    const pts = values.map((v, i) => [
      pad + i * step,
      pad + innerH - (v / (peak || 1)) * innerH,
    ]);
    const linePath = pts.map(([x, y], i) => (i === 0 ? `M${x},${y}` : `L${x},${y}`)).join(" ");
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

  const rate = document.getElementById("homev2-pow-rate");
  const target = document.getElementById("homev2-pow-target");
  const hashes = Array.from(document.querySelectorAll("#homev2 .hash-scroller .track span"));
  const probes = Array.from(document.querySelectorAll("#homev2 .probe-log .pt"));
  const ids = [];

  if (rate) {
    ids.push(setInterval(() => {
      const r = 2.28 + Math.random() * 0.22;
      rate.textContent = r.toFixed(2) + "M";
    }, 360));
  }

  if (target) {
    const variants = [
      "0x0000ffff…",
      "0x0000fffe…",
      "0x0000fff8…",
      "0x0000fffd…",
      "0x00010000…"
    ];
    let i = 0;
    ids.push(setInterval(() => {
      i = (i + 1) % variants.length;
      target.textContent = variants[i];
    }, 5200));
  }

  const flashMatch = () => {
    if (!hashes.length) return;
    const idx = Math.floor(Math.random() * hashes.length);
    hashes[idx].classList.add("match");
    setTimeout(() => hashes[idx].classList.remove("match"), 520);
  };

  if (hashes.length) {
    ids.push(setInterval(() => {
      if (Math.random() < 0.7) flashMatch();
    }, 1400));
  }

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
          const p = probes[i];
          const d = defs[i];
          p.classList.remove("ok");
          p.classList.add("running");
          p.textContent = "…";
          await wait(260 + Math.random() * 140);
          p.classList.remove("running");
          if (d.check) {
            p.textContent = "✓";
            p.classList.add("ok");
          } else {
            const v = Math.max(1, d.base + Math.floor((Math.random() - 0.5) * d.jitter * 2));
            p.textContent = `${v}ms`;
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

onMounted(() => {
  document.documentElement.classList.add("home-v2-active");
  initTabs();
  loadStats();
  initCountUp();
  initLiveArchitecture();
});

onBeforeUnmount(() => {
  document.documentElement.classList.remove("home-v2-active");
  while (cleanups.length) {
    try { cleanups.pop()(); } catch {}
  }
});
</script>

<template>
  <div id="homev2">
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
            <a href="/guide/">Docs</a>
            <a href="#features">Features</a>
            <a
              class="gh-link"
              href="https://github.com/tiagozip/cap"
              aria-label="GitHub"
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
              <span>5.2k</span>
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
            No Google. No telemetry. No visual puzzles. <br />Switch from reCAPTCHA in minutes.
          </p>

          <div class="actions">
            <a class="btn primary" href="/guide/">Read the docs <span class="arr">→</span></a>
            <a class="btn" href="/guide/demo.html">Demo <span class="arr">↗</span></a>
            <a class="btn" href="https://github.com/tiagozip/cap">GitHub</a>
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
                src="/assets/screenshot.png"
                alt="Cap admin dashboard screenshot"
                width="2892"
                height="1556"
                style="width: 100%; height: auto"
              />
            </div>
          </div>
        </div>
      </div>

      <div class="wrap">
        <div class="trust">
          <span class="trust-item">5k stars on GitHub</span><span class="trust-sep">·</span>
          <span class="trust-item">Apache 2.0</span>
          <span class="trust-sep">·</span>
          <span class="trust-item">Zero dependencies</span>
          <span class="trust-sep">·</span>
          <span class="trust-item">20kb widget</span>
          <span class="trust-sep">·</span>
          <span class="trust-item">1.1B CDN hits</span>
        </div>
      </div>

      <section class="block" id="features">
        <div class="wrap-wide">
          <div class="head">
            <span class="eyebrow">Features</span>
            <h2>250x smaller than hCaptcha.<br />No puzzles, no tracking.</h2>
          </div>
          <div class="feat-grid">
            <div class="feat-cell">
              <div class="icon">
                <svg width="24px" height="24px" stroke="none" fill="currentColor" version="1.1" id="_x32_" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" 
	 viewBox="0 0 512 512"  xml:space="preserve">
<g>
	<path class="st0" d="M510.831,167.648c-2.954-20.666-2.954-35.432-14.767-26.572c-11.81,8.86-84.65,27.247-162.402,35.433
		c-36.479,3.844-61.048,14.564-77.663,27.262c-16.616-12.697-41.18-23.418-77.663-27.262
		c-77.752-8.186-150.594-26.573-162.403-35.433C4.12,132.216,4.12,146.982,1.17,167.648c-5.43,38.006,5.902,144.691,79.724,183.076
		c77.892,40.502,132.874,17.712,159.45,2.954c5.852-3.256,11.003-6.581,15.654-9.891c4.651,3.31,9.801,6.635,15.654,9.891
		c26.577,14.758,81.562,37.548,159.454-2.954C504.924,312.339,516.257,205.654,510.831,167.648z M159.24,306.471
		c-33.266-2.566-66.535-35.836-66.535-63.981c0,0,51.184,2.557,74.213,5.116c23.03,2.558,40.948,20.472,40.948,30.711
		C207.865,288.549,192.509,309.021,159.24,306.471z M352.757,306.471c-33.266,2.55-48.622-17.922-48.622-28.154
		c0-10.239,17.914-28.154,40.944-30.711c23.03-2.558,74.213-5.116,74.213-5.116C419.292,270.635,386.027,303.905,352.757,306.471z"
		/>
</g>
</svg>
              </div>
              <h3>Privacy-first</h3>
              <p>
                Zero telemetry. No third-party network. Your users' data stays between you and them.
              </p>
            </div>
            <div class="feat-cell">
              <div class="icon">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.6"
                  stroke-linejoin="round"
                >
                  <path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z" />
                </svg>
              </div>
              <h3>~20kb, zero dependencies</h3>
              <p>Loads in milliseconds, not seconds.</p>
            </div>
            <div class="feat-cell">
              <div class="icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">
                  <circle cx="12" cy="12" r="9" />
                  <path d="M8 12l3 3 5-6" />
                </svg>
              </div>
              <h3>No visual puzzles</h3>
              <p>
                PoW and instrumentation run silently in the background. No "click the traffic
                lights."
              </p>
            </div>
            <div class="feat-cell">
              <div class="icon">
                <svg width="24px" height="24px" stroke="none" fill="currentColor" version="1.1" id="_x32_" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" 
	 viewBox="0 0 512 512"  xml:space="preserve">
<g>
	<path class="st0" d="M404.234,197.867H179.418v-79.809c0.014-21.222,8.542-40.23,22.434-54.159
		c13.921-13.891,32.937-22.412,54.145-22.426c21.215,0.014,40.231,8.542,54.159,22.426c13.885,13.929,22.412,32.937,22.427,54.159
		v31.834h41.472v-31.834c0.014-32.537-13.246-62.179-34.578-83.481C318.176,13.246,288.534-0.015,255.997,0
		c-32.531-0.015-62.172,13.246-83.474,34.577c-21.331,21.302-34.584,50.944-34.577,83.481v79.809h-30.178
		c-19.48,0-35.267,15.793-35.267,35.266V345.03C72.5,437.243,154.66,512,256.004,512C357.347,512,439.5,437.243,439.5,345.03
		V233.134C439.5,213.66,423.714,197.867,404.234,197.867z M406.324,345.03c0,73.77-67.434,133.794-150.32,133.794
		c-82.887,0-150.328-60.024-150.328-133.794V233.134c0-1.154,0.944-2.09,2.091-2.09h296.467c1.154,0,2.09,0.936,2.09,2.09V345.03z"
		/>
	<path class="st0" d="M255.997,286.328c-19.843,0-35.941,16.09-35.941,35.941c0,15.118,9.348,28.038,22.572,33.343l-10.756,45.98
		h48.259l-10.757-45.972c13.217-5.312,22.572-18.232,22.572-33.35C291.945,302.418,275.847,286.328,255.997,286.328z"/>
</g>
</svg>
              </div>
              <h3>Apache 2.0</h3>
              <p>Free forever. Audit it, fork it, own it. No vendor can pull the rug.</p>
            </div>
            <div class="feat-cell">
              <div class="icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">
                  <rect x="3" y="4" width="18" height="12" rx="2" />
                  <path d="M7 20h10M12 16v4" />
                </svg>
              </div>
              <h3>Standalone mode</h3>
              <p>
                Deploy anywhere with one Docker container. Includes analytics and multi-site-key
                support.
              </p>
            </div>
            <div class="feat-cell">
              <div class="icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">
                  <path d="M8 6l-4 6 4 6M16 6l4 6-4 6M14 4l-4 16" />
                </svg>
              </div>
              <h3>Programmatic</h3>
              <p>
                Hide the widget entirely and solve challenges silently, ideal for APIs and forms.
              </p>
            </div>
            <div class="feat-cell">
              <div class="icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  <path d="M9 12l2 2 4-4" />
                </svg>
              </div>
              <h3>API protection</h3>
              <p>Block abusive traffic while allow-listing trusted automated clients.</p>
            </div>
            <div class="feat-cell">
              <div class="icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">
                  <circle cx="12" cy="12" r="9" />
                  <path d="M4 12h16M12 3a14 14 0 010 18M12 3a14 14 0 000 18" />
                </svg>
              </div>
              <h3>Fully customizable</h3>
              <p>
                Colors, size, position, icons, all controllable via CSS variables. No iframe
                lock-in.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section class="block" id="compare">
        <div class="wrap-wide">
          <div class="head">
            <span class="eyebrow">Compared</span>
            <h2>How it compares.</h2>
            <p>
              Cap sits in the same detection tier as the big names, without shipping your users'
              data to a third party.
            </p>
          </div>
          <div class="matrix">
            <table>
              <thead>
                <tr>
                  <th style="text-align: left">&nbsp;</th>
                  <th class="cap-col">Cap</th>
                  <th>reCAPTCHA</th>
                  <th>Turnstile</th>
                  <th>hCaptcha</th>
                  <th>Friendly</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td class="label">Self-hosted</td>
                  <td><span class="yes">Yes</span></td>
                  <td><span class="no">-</span></td>
                  <td><span class="no">-</span></td>
                  <td><span class="no">-</span></td>
                  <td><span class="no">-</span></td>
                </tr>
                <tr>
                  <td class="label">Open source</td>
                  <td><span class="yes">Apache 2.0</span></td>
                  <td><span class="no">-</span></td>
                  <td><span class="no">-</span></td>
                  <td><span class="no">-</span></td>
                  <td><span class="no">-</span></td>
                </tr>
                <tr>
                  <td class="label">No visual puzzles</td>
                  <td><span class="yes">Yes</span></td>
                  <td><span class="no">Frequent</span></td>
                  <td><span class="yes">Yes</span></td>
                  <td><span class="no">Frequent</span></td>
                  <td><span class="yes">Yes</span></td>
                </tr>
                <tr>
                  <td class="label">No 3rd-party telemetry</td>
                  <td><span class="yes">Yes</span></td>
                  <td><span class="no">Google</span></td>
                  <td><span class="no">Cloudflare</span></td>
                  <td><span class="no">hCaptcha</span></td>
                  <td><span class="no">Limited</span></td>
                </tr>
                <tr>
                  <td class="label">Bundle size</td>
                  <td><span class="yes">~20 kb</span></td>
                  <td><span class="no">500 kb+</span></td>
                  <td><span class="no">110 kb+</span></td>
                  <td><span class="no">600 kb+</span></td>
                  <td><span class="no">80 kb+</span></td>
                </tr>
                <tr>
                  <td class="label">Free at scale</td>
                  <td><span class="yes">Yes</span></td>
                  <td><span class="no">Quota</span></td>
                  <td><span class="yes">Yes</span></td>
                  <td><span class="no">Quota</span></td>
                  <td><span class="no">Paid</span></td>
                </tr>
                <tr>
                  <td class="label">Instrumentation layer</td>
                  <td><span class="yes">Yes</span></td>
                  <td><span class="yes">Yes</span></td>
                  <td><span class="yes">Yes</span></td>
                  <td><span class="yes">Yes</span></td>
                  <td><span class="no">No</span></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section class="block">
        <div class="wrap">
          <div class="head">
            <span class="eyebrow">Architecture</span>
            <h2>Two independent layers.<br />Bypass one, the other still holds.</h2>
            <p>
              Every challenge solves proof-of-work and runs browser instrumentation at the same
              time. Defeating one layer doesn't defeat the other.
            </p>
          </div>
          <div class="how-grid">
            <div class="how-card">
              <span class="lbl">Layer 01 · Proof-of-work</span>
              <h3>Heavy math, in the browser.</h3>
              <p>
                The client solves parallel SHA-256 hashes in WASM. Tuned against GPU acceleration,
                real CPU time, real money to scale.
              </p>
              <div class="kv-row">
                <div>
                  <span class="kv-k">target</span><span class="kv-v" id="homev2-pow-target">0x0000ffff…</span>
                </div>
                <div>
                  <span class="kv-k">hashes/s</span><span class="kv-v" id="homev2-pow-rate">2.40M</span>
                </div>
                <div>
                  <span class="kv-k">solved</span><span class="kv-v ok" id="homev2-pow-solved">1.82s ✓</span>
                </div>
              </div>
              <div class="viz">
                <code>sha256</code>
                <div class="hash-scroller">
                  <div class="track">
                    <span>a7f3…b19c</span><span>9d4e…3b7f</span><span>2c1a…e88d</span><span>f06b…44a2</span><span>5e9c…d710</span><span>8b22…cc91</span>
                    <span>a7f3…b19c</span><span>9d4e…3b7f</span><span>2c1a…e88d</span><span>f06b…44a2</span><span>5e9c…d710</span><span>8b22…cc91</span>
                  </div>
                </div>
              </div>
            </div>
            <div class="how-card">
              <span class="lbl">Layer 02 · Instrumentation</span>
              <h3>A real browser proves itself.</h3>
              <p>
                A freshly-generated JS program runs DOM-dependent ops a real browser handles
                trivially, and a headless runtime cannot fake cheaply.
              </p>
              <div class="probe-log">
                <div class="pl">
                  <span class="pi">01</span><span class="pn">layout.getComputedStyle</span><span class="pt">4ms</span>
                </div>
                <div class="pl">
                  <span class="pi">02</span><span class="pn">canvas.toDataURL</span><span class="pt">11ms</span>
                </div>
                <div class="pl">
                  <span class="pi">03</span><span class="pn">event.isTrusted</span><span class="pt">2ms</span>
                </div>
                <div class="pl">
                  <span class="pi">04</span><span class="pn">navigator.webdriver</span><span class="pt ok">✓</span>
                </div>
              </div>
              <div class="viz">
                <code>dom</code>
                <div class="dom-probe">
                  <span></span><span></span><span></span><span></span><span></span><span></span><span></span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section class="block">
        <div class="wrap">
          <div class="head">
            <span class="eyebrow">Install</span>
            <h2>Drop it in. Point at your server.<br />Verify server-side.</h2>
          </div>
          <div class="install">
            <div class="tabs" id="tabs">
              <span class="tab-indicator" aria-hidden="true"></span>
              <button data-tab="html" class="active">HTML</button>
              <button data-tab="react">React</button>
              <button data-tab="docker">Docker</button>
              <button data-tab="verify">Verify</button>
              <button id="homev2-copy-btn" class="copy-btn" aria-label="Copy snippet">
                <svg
                  class="ic ic-copy"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.6"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  aria-hidden="true"
                >
                  <rect x="9" y="9" width="11" height="11" rx="2" />
                  <path d="M5 15V6a2 2 0 012-2h9" />
                </svg>
                <svg
                  class="ic ic-check"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  aria-hidden="true"
                >
                  <path d="M5 12l5 5 9-11" />
                </svg>
                <span class="copy-label">Copy</span>
              </button>
            </div>
            <pre id="homev2-code"></pre>
          </div>

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
                  Yes. Cap doesn't phone home, doesn't set cookies, and doesn't fingerprint users.
                  Your server sees the verification, no one else does.
                </dd>
              </div>
              <div>
                <dt>Can I migrate from reCAPTCHA / hCaptcha?</dt>
                <dd>
                  Yes. Cap's siteverify API is compatible with reCAPTCHA and hCaptcha, but you'll
                  need to swap your client-side code to use Cap's widget.
                </dd>
              </div>
              <div>
                <dt>How effective is it against real bots?</dt>
                <dd>
                  Cap's instrumentation combined with proof-of-work is very effective at making
                  abuse extremely difficult to automate at scale.
                </dd>
              </div>
              <div>
                <dt>What does it cost to self-host?</dt>
                <dd>
                  Cap Standalone fits on a $5 VPS for most sites. There are no per-request fees, no
                  egress to a third party, and no API quotas to hit.
                </dd>
              </div>
            </dl>
          </div>
        </div>
      </section>

      <section class="block cta-block">
        <div class="wrap">
          <div class="cta">
            <span class="eyebrow">Get started</span>
            <h2>Ship Cap in 15 minutes.</h2>
            <p>
              Drop the widget into your site, point it at a $5 VPS, and stop paying anyone to see
              your users' traffic.
            </p>
            <div class="actions">
              <a class="btn primary" href="/guide/">Read the docs <span class="arr">→</span></a>
              <a class="btn" href="/guide/demo.html">Try the demo <span class="arr">↗</span></a>
              <a class="btn" href="https://github.com/tiagozip/cap">Star on GitHub</a>
            </div>
          </div>
        </div>
      </section>
    </main>

    <div class="wrap home-ad-wrap">
      <EthicalAd variant="docbottom" />
    </div>

    <footer>
      <div class="wrap">
        <div class="inner">
          <span>© 2026 <a href="https://tiago.zip">tiago.zip</a> · Apache 2.0</span>
          <span>
            <a href="/guide/">Docs</a> ·
            <a href="https://github.com/tiagozip/cap">GitHub</a> ·
            <a href="/guide/demo.html">Demo</a>
          </span>
        </div>
      </div>
    </footer>
  </div>
</template>

<style>
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
  --mono: "TX 02 Data", "JetBrains Mono", ui-monospace, "SF Mono", Menlo, Consolas, monospace;

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
#homev2 .install .tabs button:focus-visible {
  outline-offset: -2px;
  border-radius: 2px;
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
  align-items: baseline;
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
  transition: transform .2s;
}
#homev2 .homev2-search .DocSearch-Button:active {
  transform: scale(.96);
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
  gap: 8px;
  align-items: center;
  flex-wrap: wrap;
}
#homev2 .btn {
  font: inherit;
  font-size: 14px;
  padding: 10px 16px;
  border-radius: 8px;
  border: 1px solid var(--line-strong);
  background: transparent;
  color: var(--fg);
  cursor: pointer;
  text-decoration: none;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  transition: border-color 0.15s, background 0.15s;
}
#homev2 .btn:hover {
  border-color: rgba(255, 255, 255, 0.3);
  background: rgba(255, 255, 255, 0.02);
}
#homev2 .btn.primary {
  background: var(--accent);
  color: #0a0a0b;
  border-color: var(--accent);
  font-weight: 500;
}
#homev2 .btn.primary:hover {
  background: #fff;
  border-color: #fff;
}
#homev2 .btn .arr {
  opacity: 0.6;
  display: inline-block;
  transition: transform 0.22s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.22s ease;
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
  padding: 80px 0 0;
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
#homev2 .hash-scroller {
  flex: 1;
  overflow: hidden;
  height: 14px;
  mask: linear-gradient(90deg, transparent, #000 18%, #000 82%, transparent);
}
#homev2 .hash-scroller .track {
  display: flex;
  gap: 14px;
  white-space: nowrap;
  animation: homev2-hash-scroll 10s linear infinite;
  color: var(--fg-mute);
}
@keyframes homev2-hash-scroll {
  from { transform: translateX(0); }
  to { transform: translateX(-50%); }
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
#homev2 .dom-probe span:nth-child(2) { animation-delay: 0.2s; }
#homev2 .dom-probe span:nth-child(3) { animation-delay: 0.4s; }
#homev2 .dom-probe span:nth-child(4) { animation-delay: 0.6s; }
#homev2 .dom-probe span:nth-child(5) { animation-delay: 0.8s; }
#homev2 .dom-probe span:nth-child(6) { animation-delay: 1s; }
#homev2 .dom-probe span:nth-child(7) { animation-delay: 1.2s; }
@keyframes homev2-probe-pulse {
  0%, 100% { background: var(--line-strong); }
  50% { background: var(--accent); }
}
#homev2 .kv-row {
  display: flex;
  gap: 18px;
  padding: 10px 0;
  border-top: 1px dashed var(--line);
  border-bottom: 1px dashed var(--line);
  margin-top: 4px;
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
#homev2 .pl .pi { color: var(--fg-mute); }
#homev2 .pl .pn { color: var(--fg-dim); }
#homev2 .pl .pt { color: var(--fg-mute); font-size: 10.5px; }
#homev2 .pl .pt.ok { color: var(--accent); }
#homev2 .pl .pt.running {
  color: var(--fg-mute);
  animation: homev2-probe-dots 0.9s ease-in-out infinite;
}
@keyframes homev2-probe-dots {
  0%, 100% { opacity: 0.35; }
  50% { opacity: 1; }
}
#homev2 .hash-scroller .track span {
  transition: color 0.18s ease-out, text-shadow 0.18s ease-out;
}
#homev2 .hash-scroller .track span.match {
  color: var(--accent);
  text-shadow: 0 0 10px color-mix(in oklab, var(--accent) 55%, transparent);
}

#homev2 .feat-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 1px;
  background: var(--line);
  border: 1px solid var(--line);
  border-radius: 12px;
  overflow: hidden;
}
#homev2 .feat-cell {
  background: var(--bg);
  padding: 24px 22px 28px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-height: 180px;
  transition: background 0.2s;
}
#homev2 .feat-cell:hover {
  background: var(--surface);
}
#homev2 .feat-cell .icon {
  color: var(--accent);
  width: 24px;
  height: 24px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  position: relative;
}
#homev2 .feat-cell .icon svg {
  width: 24px;
  height: 24px;
  position: relative;
}
#homev2 .feat-cell h3 {
  margin: 0;
  font-size: 15px;
  font-weight: 500;
  color: var(--fg);
  letter-spacing: -0.005em;
}
#homev2 .feat-cell p {
  margin: 0;
  color: var(--fg-dim);
  font-size: 13.5px;
  line-height: 1.55;
}

#homev2 .matrix {
  border: 1px solid var(--line);
  border-radius: 12px;
  overflow-x: auto;
  overflow-y: hidden;
  -webkit-overflow-scrolling: touch;
  position: relative;
  scrollbar-width: thin;
  scrollbar-color: var(--line-strong) transparent;
}
#homev2 .matrix::-webkit-scrollbar {
  height: 6px;
}
#homev2 .matrix::-webkit-scrollbar-thumb {
  background: var(--line-strong);
  border-radius: 3px;
}
#homev2 .matrix table {
  width: 100%;
  min-width: 640px;
  border-collapse: collapse;
  font-size: 13.5px;
}
#homev2 .matrix th,
#homev2 .matrix td {
  padding: 14px 14px;
  text-align: center;
  border-bottom: 1px solid var(--line);
  border-right: 1px solid var(--line);
}
#homev2 .matrix th:last-child,
#homev2 .matrix td:last-child {
  border-right: none;
}
#homev2 .matrix tr:last-child th,
#homev2 .matrix tr:last-child td {
  border-bottom: none;
}
#homev2 .matrix th {
  font-family: var(--mono);
  font-size: 11px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--fg-dim);
  background: var(--surface);
  font-weight: 500;
}
#homev2 .matrix th.cap-col {
  color: var(--accent);
}
#homev2 .matrix td.label {
  text-align: left;
  color: var(--fg);
  background: rgba(255, 255, 255, 0.015);
  font-weight: 500;
}
#homev2 .matrix td .yes {
  color: var(--accent);
  font-weight: 500;
}
#homev2 .matrix td .no {
  color: var(--fg-mute);
}
#homev2 .matrix tbody tr {
  transition: background 0.2s ease;
}
#homev2 .matrix tbody tr:hover {
  background: rgba(255, 255, 255, 0.015);
}
#homev2 .matrix th.cap-col,
#homev2 .matrix tbody td:nth-child(2) {
  background: color-mix(in oklab, var(--accent) 5%, transparent);
}

#homev2 .install {
  margin-top: 28px;
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: 10px;
  overflow: hidden;
}
#homev2 .install .tabs {
  display: flex;
  position: relative;
  border-bottom: 1px solid var(--line);
  font-family: var(--mono);
  font-size: 12px;
}
#homev2 .install .tab-indicator {
  position: absolute;
  left: 0;
  bottom: -1px;
  height: 1px;
  background: var(--accent);
  transform: translateX(0);
  transition: transform 0.34s cubic-bezier(0.22, 1, 0.36, 1), width 0.34s cubic-bezier(0.22, 1, 0.36, 1);
  pointer-events: none;
  width: 0;
}
#homev2 .install .tabs button {
  background: transparent;
  border: none;
  font-family: inherit;
  color: var(--fg-dim);
  padding: 12px 16px;
  cursor: pointer;
  border-right: 1px solid var(--line);
  transition: color 0.15s, background 0.15s;
}
#homev2 .install .tabs button:hover {
  color: var(--fg);
}
#homev2 .install .tabs button.active {
  color: var(--fg);
  background: rgba(255, 255, 255, 0.03);
}
#homev2 .install .copy-btn {
  margin-left: auto;
  border-right: none;
  border-left: 1px solid var(--line);
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--fg-dim);
  position: relative;
}
#homev2 .install .copy-btn .ic {
  width: 13px;
  height: 13px;
  transition: opacity 0.2s ease, transform 0.24s cubic-bezier(0.22, 1, 0.36, 1);
}
#homev2 .install .copy-btn .ic-check {
  position: absolute;
  left: 16px;
  top: 50%;
  transform: translateY(-50%) scale(0.6);
  opacity: 0;
  color: var(--accent);
}
#homev2 .install .copy-btn.copied .ic-copy {
  opacity: 0;
  transform: scale(0.6);
}
#homev2 .install .copy-btn.copied .ic-check {
  opacity: 1;
  transform: translateY(-50%) scale(1);
}
#homev2 .install .copy-btn.copied {
  color: var(--accent);
}
#homev2 .install pre {
  margin: 0;
  padding: 22px 24px;
  font-family: var(--mono);
  font-size: 13px;
  line-height: 1.7;
  color: var(--fg);
  overflow-x: auto;
  background: transparent;
  white-space: pre;
}
#homev2 .install pre .c { color: var(--fg-mute); font-style: italic; }
#homev2 .install pre .k { color: var(--accent); }
#homev2 .install pre .s { color: #b6e0a7; }
#homev2 .install pre .t { color: #f5c2e7; }
#homev2 .install pre .a { color: #fab387; }
#homev2 .install pre .n { color: #f9e2af; }
#homev2 .install pre .p { color: #cba6f7; }

#homev2 footer {
  margin-top: 120px;
  padding: 40px 0 48px;
  border-top: 1px solid var(--line);
  font-family: var(--mono);
  font-size: 12px;
  color: var(--fg-mute);
}
#homev2 footer .inner {
  display: flex;
  justify-content: space-between;
  gap: 24px;
  flex-wrap: wrap;
}
#homev2 footer a {
  transition: opacity 0.2s;
}
#homev2 footer a:hover {
  color: var(--fg);
}
#homev2 footer .inner span:has(a:hover) a:not(:hover) {
  opacity: 0.6;
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
  #homev2 .matrix th,
  #homev2 .matrix td {
    padding: 10px 12px;
    font-size: 12px;
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
  #homev2 footer {
    margin-top: 80px;
    padding: 32px 0 40px;
  }
  #homev2 .install .tabs {
    overflow-x: auto;
    scrollbar-width: none;
  }
  #homev2 .install .tabs::-webkit-scrollbar {
    display: none;
  }
  #homev2 .install .tabs button {
    padding: 11px 14px;
    white-space: nowrap;
    flex-shrink: 0;
  }
  #homev2 .install .copy-btn {
    position: sticky;
    right: 0;
    background: var(--surface);
  }
  #homev2 .install pre {
    padding: 18px 20px;
    font-size: 12px;
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
  #homev2 footer .inner {
    flex-direction: column;
    gap: 12px;
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
  #homev2 .actions {
    gap: 6px;
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
  from { opacity: 0; transform: translateY(14px); }
  to { opacity: 1; transform: translateY(0); }
}
@keyframes homev2-hero-stage-in {
  from { opacity: 0; transform: translateY(24px) scale(0.985); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}
#homev2 .hero-copy > h1,
#homev2 .hero-copy > .lead,
#homev2 .hero-copy > .actions,
#homev2 .hero-image,
#homev2 .hero-stage,
#homev2 .trust {
  opacity: 0;
  animation: homev2-hero-in 0.7s cubic-bezier(0.2, 0.8, 0.2, 1) both;
}
#homev2 .hero-stage {
  animation-name: homev2-hero-stage-in;
  animation-duration: 0.9s;
}
#homev2 .hero-copy > h1 { animation-delay: 0.05s; }
#homev2 .hero-copy > .lead { animation-delay: 0.2s; }
#homev2 .hero-copy > .actions { animation-delay: 0.34s; }
#homev2 .hero-image { animation-delay: 0.2s; }
#homev2 .hero-stage { animation-delay: 0.48s; }
#homev2 .trust { animation-delay: 0.62s; }

@media (prefers-reduced-motion: reduce) {
  #homev2 .hero-copy > h1,
  #homev2 .hero-copy > .lead,
  #homev2 .hero-copy > .actions,
  #homev2 .hero-image,
  #homev2 .hero-stage,
  #homev2 .trust {
    opacity: 1;
    animation: none;
  }
  #homev2 .hash-scroller .track,
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
</style>
