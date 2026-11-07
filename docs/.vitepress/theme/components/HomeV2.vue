<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { useData } from "vitepress";
import VPNavBarSearch from "vitepress/dist/client/theme-default/components/VPNavBarSearch.vue";
import VPNavBarTranslations from "vitepress/dist/client/theme-default/components/VPNavBarTranslations.vue";
import HomeDemo from "./HomeDemo.vue";
import HomeOdometer from "./HomeOdometer.vue";
import HomeToolbox from "./HomeToolbox.vue";
import { homeV2Strings } from "./homeV2.strings.js";

const { localeIndex, lang } = useData();
const t = computed(() => ({ ...homeV2Strings.en, ...homeV2Strings[localeIndex.value] }));
const heroLines = computed(() => {
  let i = 0;
  return [t.value.heroTitle, t.value.heroTitleDim].map((line) => line.split(" ").map((w) => ({ w, i: i++ })));
});
const trustParts = computed(() => t.value.trustLine.split("{n}"));
const numLang = computed(() => (localeIndex.value === "root" ? "en" : localeIndex.value));
const lp = computed(() => (localeIndex.value === "root" ? "" : `/${localeIndex.value}`));

const faq = computed(() => {
  const s = t.value;
  const p = lp.value;
  return [
    { q: s.faqAgentsQ, a: s.faqAgentsA },
    { q: s.faqGdprQ, a: s.faqGdprA },
    { q: s.faqMigrateQ, a: s.faqMigrateA },
    { q: s.faqCostQ, a: s.faqCostA },
    {
      q: s.faqOpenQ,
      html: `${s.faqOpenA1}<a href="${p}/guide/standalone/">${s.faqOpenLink}</a>${s.faqOpenA2}`,
    },
    {
      q: s.faqAltQ,
      html: `${s.faqAltA1}<a href="${p}/guide/alternatives/recaptcha.html">reCAPTCHA</a>${s.faqAltSep1}<a href="${p}/guide/alternatives/hcaptcha.html">hCaptcha</a>${s.faqAltSep2}<a href="${p}/guide/alternatives/turnstile.html">Turnstile</a>${s.faqAltA2}`,
    },
  ];
});

const checkIds = [
  "webdriver_true",
  "webdriver_stripped",
  "headless_token",
  "chrome_object_missing",
  "geometry_quantized",
  "juggler_package",
  "gecko_contradiction",
  "window_exceeds_screen",
  "viewport_override",
  "worker_mismatch",
];

const ghPath = "M12 .5C5.73.5.5 5.73.5 12c0 5.08 3.29 9.39 7.86 10.91.58.1.79-.25.79-.56 0-.28-.01-1.02-.02-2-3.2.69-3.87-1.54-3.87-1.54-.52-1.32-1.27-1.67-1.27-1.67-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.18 1.76 1.18 1.02 1.75 2.68 1.24 3.34.95.1-.74.4-1.24.72-1.53-2.55-.29-5.24-1.28-5.24-5.68 0-1.25.45-2.28 1.18-3.08-.12-.29-.51-1.46.11-3.04 0 0 .96-.31 3.15 1.18.91-.25 1.89-.38 2.86-.38.97 0 1.95.13 2.86.38 2.19-1.49 3.15-1.18 3.15-1.18.62 1.58.23 2.75.11 3.04.73.8 1.18 1.83 1.18 3.08 0 4.41-2.69 5.38-5.25 5.67.41.35.78 1.05.78 2.11 0 1.52-.01 2.75-.01 3.12 0 .31.21.67.8.56C20.71 21.38 24 17.08 24 12c0-6.27-5.23-11.5-11.5-11.5z";

const browserChecks = [
  { label: "Verify the browser", hint: "Check the browser environment.", on: true },
  { label: "Block detected browser automation", hint: "Reject detected automation tools.", on: true },
  { label: "Block automated clicks and typing", hint: "Experimental. Blocks repeated synthetic clicks or key presses.", on: false },
];

const fromWidget = ref(false);
const fromWidgetHost = ref("");
const solverHits = ref("");

const quoteText = computed(() => {
  const s = t.value;
  return `${s.quoteLead}${s.quoteHl1}${s.quoteMid1}${s.quoteHl2}${s.quoteMid2}${s.quoteHl3}${s.quoteEnd}`.trim();
});

const statsText = computed(() => t.value.statsLine.replace("{n}", solverHits.value || t.value.statsFallback));

const cleanups = [];

const track = (name, props) => {
  try {
    window.plausible?.(name, props ? { props } : undefined);
  } catch {}
};

const dismissWidgetBanner = () => {
  fromWidget.value = false;
  try {
    sessionStorage.setItem("cap-widget-banner-dismissed", "1");
  } catch {}
  track("widget_banner_dismiss");
};

onMounted(() => {
  document.documentElement.classList.add("home-v2-active");

  try {
    const params = new URLSearchParams(window.location.search);
    if (params.get("utm_source") === "cap_widget" && sessionStorage.getItem("cap-widget-banner-dismissed") !== "1") {
      const host = (params.get("utm_content") || "").trim();
      if (host && /^[a-z0-9.\-]+$/i.test(host) && host.length <= 80) fromWidgetHost.value = host;
      fromWidget.value = true;
      track("widget_banner_shown", { host: fromWidgetHost.value || "(unknown)" });
    }
  } catch {}

  window.CAP_CUSTOM_FETCH = async (url, options) => {
    if (url === "/api/challenge") {
      const hex = (n) =>
        Array.from(window.crypto.getRandomValues(new Uint8Array(n)), (b) => b.toString(16).padStart(2, "0")).join("");
      track("demo");
      return new Response(
        JSON.stringify({
          challenge: Array.from({ length: 50 }, () => [hex(16), hex(2)]),
          token: "",
          expires: Date.now() + 600000,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }
    if (url === "/api/redeem") {
      track("demo-solved");
      return new Response(JSON.stringify({ success: true, token: "", expires: Date.now() + 3600000 }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    return window.fetch(url, options);
  };

  cleanups.push(
    ...[...document.querySelectorAll("#homev2 [data-cta]")].map((el) => {
      const handler = () =>
        track("cta_click", {
          cta: el.getAttribute("data-cta"),
          location: el.getAttribute("data-cta-location") || "unknown",
        });
      el.addEventListener("click", handler);
      return () => el.removeEventListener("click", handler);
    }),
  );

  const trust = document.querySelector("#homev2 .trust");
  if (trust && "IntersectionObserver" in window) {
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        io.disconnect();
        track("trust_view");
      },
      { threshold: 0.6 },
    );
    io.observe(trust);
    cleanups.push(() => io.disconnect());
  }

  (async () => {
    const els = document.querySelectorAll(".homev2-gh-stars");
    const write = (v) => els.forEach((el) => (el.textContent = v));
    try {
      const cached = sessionStorage.getItem("cap-gh-stars");
      if (cached) write(cached);
      const res = await fetch("https://api.github.com/repos/tiagozip/cap", {
        headers: { Accept: "application/vnd.github+json" },
      });
      if (!res.ok) return;
      const n = (await res.json()).stargazers_count;
      if (typeof n !== "number") return;
      const formatted = n >= 1000 ? `${(n / 1000).toFixed(1)}k` : `${n}`;
      write(formatted);
      sessionStorage.setItem("cap-gh-stars", formatted);
    } catch {}
  })();

  (async () => {
    try {
      const res = await fetch(
        "https://data.jsdelivr.com/v1/stats/packages/npm/@cap.js/wasm@0.0.6/files?period=year&by=hits&limit=1&page=1",
      );
      const total = (await res.json())[0]?.hits?.total;
      if (!total) return;
      solverHits.value = new Intl.NumberFormat(lang.value || "en").format(total);
    } catch {}
  })();

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
  <div id="homev2">
    <Transition name="widget-banner">
      <aside v-if="fromWidget" class="widget-banner" role="region" :aria-label="t.bannerRegionLabel">
        <div class="wrap widget-banner-wrap">
          <span class="widget-banner-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">
              <path d="M5 12.5l4.2 4.2L19 7" />
            </svg>
          </span>
          <p class="widget-banner-text">
            <strong
              >{{ t.bannerVerified }}<template v-if="fromWidgetHost">{{ t.bannerHostPrefix }}{{ fromWidgetHost }}</template
              >{{ t.bannerVerifiedEnd }}</strong
            >
            <span class="widget-banner-sub">{{ t.bannerSub }}</span>
          </p>
          <button class="widget-banner-close" type="button" :aria-label="t.bannerDismiss" @click="dismissWidgetBanner">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>
      </aside>
    </Transition>

    <header class="top">
      <div class="wrap">
        <div class="frame top-inner">
          <div class="top-left">
            <a class="brand" :href="`${lp}/`" :aria-label="t.navBrandLabel">
              <img alt="" src="/logo.png" width="22" height="22" />
              <span>Cap</span>
            </a>
            <nav class="top-links">
              <a class="nav-link" :href="`${lp}/guide/`" data-cta="docs" data-cta-location="nav">{{ t.navDocs }}</a>
              <a class="nav-link" :href="`${lp}/guide/demo.html`" data-cta="demo" data-cta-location="nav">{{ t.navDemo }}</a>
              <a class="nav-link" :href="`${lp}/guide/alternatives.html`">{{ t.ftCompareLabel }}</a>
            </nav>
          </div>
          <VPNavBarSearch class="homev2-search" />
          <div class="top-right">
            <VPNavBarTranslations class="homev2-translations" />
            <a class="gh-link nav-link" href="https://github.com/tiagozip/cap" data-cta="github" data-cta-location="nav">
              <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor" aria-hidden="true"><path :d="ghPath" /></svg>
              <span class="sr-only">GitHub, </span>
              <span><span class="homev2-gh-stars">6.2k</span><span class="gh-stars-label">{{ ` ${t.navGithubStars}` }}</span></span>
            </a>
          </div>
        </div>
      </div>
    </header>

    <main>
      <section class="band hero">
        <div class="wrap">
          <div class="frame">
            <HomeDemo :t="t">
              <div class="hero-copy">
                <h1>
                  <span v-for="(line, n) in heroLines" :key="n"
                    ><template v-for="{ w, i } in line" :key="i"><span class="w" :style="`--i: ${i}`">{{ w }}</span>{{ " " }}</template></span
                  >
                </h1>
                <p class="lead">{{ t.heroLead }}</p>
                <div class="actions">
                  <a class="btn btn-ghost" :href="`${lp}/guide/`" data-cta="docs" data-cta-location="hero">{{ t.heroCtaDocs }}</a>
                  <a class="btn btn-primary" :href="`${lp}/guide/`" data-cta="start" data-cta-location="hero">{{ t.heroCtaStart }}</a>
                </div>
              </div>
            </HomeDemo>
          </div>
        </div>
      </section>

      <section class="band trust">
        <div class="wrap">
          <div class="frame trust-inner">
            <p>{{ trustParts[0] }}<HomeOdometer :lang="numLang" />{{ trustParts[1] }}</p>
            <div class="logos">
              <img src="/logos/bunny-duo.svg" alt="bunny.net" width="112" height="43" loading="lazy" />
              <img src="/logos/adguard-duo.svg" alt="AdGuard" width="104" height="24" loading="lazy" />
              <img src="/logos/fraunhofer-duo.svg" alt="Fraunhofer" width="258" height="72" loading="lazy" />
            </div>
          </div>
        </div>
      </section>

      <section id="agents" class="band">
        <div class="wrap">
          <div class="frame section">
            <div class="head">
              <h2>{{ t.agentsTitle }}</h2>
              <div class="head-side">
                <p>{{ t.agentsBody }}</p>
                <a class="text-link" :href="`${lp}/guide/instrumentation.html`" data-cta="instrumentation" data-cta-location="home">{{ t.agentsLink }}</a>
              </div>
            </div>

            <div class="agents">
              <div class="ui-window settings" aria-hidden="true">
                <div class="settings-row">
                  <span class="settings-label">HashWX difficulty</span>
                  <span class="settings-value">1,000,000</span>
                </div>
                <div class="slider"><span></span></div>
                <div class="settings-group">Browser checks</div>
                <div v-for="opt in browserChecks" :key="opt.label" class="toggle-row">
                  <span class="toggle" :class="{ on: opt.on }"><span></span></span>
                  <span>
                    <span class="toggle-label">{{ opt.label }}</span>
                    <span class="toggle-hint">{{ opt.hint }}</span>
                  </span>
                </div>
              </div>

              <div class="agents-result">
                <div class="ui-window">
                  <div class="ui-title">{{ t.agentsResultLabel }}</div>
                  <pre class="json"><code><span class="j-p">{</span>
  <span class="j-k">"success"</span>: <span class="j-b">false</span>,
  <span class="j-k">"reason"</span>: <span class="j-s">"instr_automated_browser"</span>,
  <span class="j-k">"blockedBy"</span>: [
    <span class="j-s">"webdriver_true"</span>,
    <span class="j-s">"headless_token"</span>
  ]
<span class="j-p">}</span></code></pre>
                </div>
                <ul class="checks">
                  <li v-for="id in checkIds" :key="id"><code>{{ id }}</code></li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="dashboard" class="band">
        <div class="wrap">
          <div class="frame section">
            <div class="head">
              <h2>{{ t.dashTitle }}</h2>
              <div class="head-side">
                <p>{{ t.dashBody }}</p>
              </div>
            </div>
            <figure class="shot">
              <img
                src="/assets/home/dashboard.webp"
                srcset="/assets/home/dashboard-1x.webp 1440w, /assets/home/dashboard.webp 2880w"
                sizes="(max-width: 1120px) 100vw, 1024px"
                width="2880"
                height="1800"
                :alt="t.dashAlt"
                loading="lazy"
              />
            </figure>
            <dl class="facts">
              <div v-for="[title, body] in t.dashFacts" :key="title">
                <dt>{{ title }}</dt>
                <dd>{{ body }}</dd>
              </div>
            </dl>
          </div>
        </div>
      </section>

      <section id="toolbox" class="band">
        <div class="wrap">
          <div class="frame section">
            <div class="head">
              <h2>{{ t.gridTitle }}</h2>
              <div class="head-side">
                <p>{{ t.gridBody }}</p>
              </div>
            </div>

            <HomeToolbox :t="t" :lp="lp" />
          </div>
        </div>
      </section>

      <section class="band">
        <div class="wrap">
          <div class="frame section quote-wrap">
            <figure class="quote">
              <blockquote>
                <p>{{ quoteText }}</p>
              </blockquote>
              <figcaption>
                <img src="/logos/adguard.svg" alt="AdGuard" width="104" height="24" loading="lazy" />
                <span>{{ t.quoteRole }}</span>
              </figcaption>
            </figure>
            <p class="stats">{{ statsText }}</p>
          </div>
        </div>
      </section>

      <section id="faq" class="band">
        <div class="wrap">
          <div class="frame section faq-wrap">
            <div class="faq-head">
              <h2>{{ t.faqTitle }}</h2>
              <a class="text-link" :href="`${lp}/guide/`">{{ t.faqMore }}</a>
            </div>
            <dl class="faq">
              <div v-for="item in faq" :key="item.q">
                <dt>{{ item.q }}</dt>
                <dd v-if="item.html" v-html="item.html"></dd>
                <dd v-else>{{ item.a }}</dd>
              </div>
            </dl>
          </div>
        </div>
      </section>

      <section class="band">
        <div class="wrap">
          <div class="frame section start">
            <div class="start-copy">
              <h2>{{ t.startTitle }}</h2>
              <p>{{ t.startBody }}</p>
              <div class="actions">
                <a class="btn btn-primary" :href="`${lp}/guide/`" data-cta="docs" data-cta-location="cta_block">{{ t.startCta }}</a>
                <a class="btn btn-ghost" href="https://github.com/tiagozip/cap" data-cta="github" data-cta-location="cta_block">{{ t.startGithub }}</a>
              </div>
            </div>
            <pre class="code" :aria-label="t.startCodeLabel"><code><span class="c-tag">&lt;script</span> <span class="c-attr">src</span>=<span class="c-str">"https://cdn.jsdelivr.net/npm/@cap.js/widget"</span><span class="c-tag">&gt;&lt;/script&gt;</span>

<span class="c-tag">&lt;form</span> <span class="c-attr">action</span>=<span class="c-str">"/signup"</span> <span class="c-attr">method</span>=<span class="c-str">"POST"</span><span class="c-tag">&gt;</span>
  <span class="c-tag">&lt;input</span> <span class="c-attr">name</span>=<span class="c-str">"email"</span> <span class="c-tag">/&gt;</span>
  <span class="c-tag">&lt;cap-widget</span>
    <span class="c-attr">data-cap-api-endpoint</span>=<span class="c-str">"https://cap.example.com/&lt;site-key&gt;/"</span>
  <span class="c-tag">&gt;&lt;/cap-widget&gt;</span>
  <span class="c-tag">&lt;button&gt;</span>Sign up<span class="c-tag">&lt;/button&gt;</span>
<span class="c-tag">&lt;/form&gt;</span></code></pre>
          </div>
        </div>
      </section>
    </main>

    <footer class="band foot">
      <div class="wrap">
        <div class="frame foot-inner">
          <div class="foot-brand">
            <a class="brand" :href="`${lp}/`" :aria-label="t.navBrandLabel">
              <img alt="" src="/logo.png" width="22" height="22" />
              <span>Cap</span>
            </a>
            <p>{{ t.ftTagline1.trim() }}<br />{{ t.ftTagline2.trim() }}</p>
          </div>
          <nav class="foot-cols">
            <div>
              <h3>{{ t.ftProductLabel }}</h3>
              <a :href="`${lp}/guide/`" data-cta="docs" data-cta-location="footer">{{ t.ftQuickstart }}</a>
              <a :href="`${lp}/guide/standalone/`">Standalone</a>
              <a :href="`${lp}/guide/widget.html`">{{ t.ftWidget }}</a>
              <a :href="`${lp}/guide/demo.html`" data-cta="demo" data-cta-location="footer">{{ t.ftDemo }}</a>
            </div>
            <div>
              <h3>{{ t.ftCompareLabel }}</h3>
              <a :href="`${lp}/guide/alternatives/recaptcha.html`">{{ t.ftVsRecaptcha }}</a>
              <a :href="`${lp}/guide/alternatives/hcaptcha.html`">{{ t.ftVsHcaptcha }}</a>
              <a :href="`${lp}/guide/alternatives/turnstile.html`">{{ t.ftVsTurnstile }}</a>
              <a :href="`${lp}/guide/alternatives.html`">{{ t.ftAllComparisons }}</a>
            </div>
            <div>
              <h3>{{ t.ftLearnLabel }}</h3>
              <a :href="`${lp}/guide/workings.html`">{{ t.ftHowItWorks }}</a>
              <a :href="`${lp}/guide/effectiveness.html`">{{ t.ftEffectiveness }}</a>
              <a :href="`${lp}/guide/compliance.html`">{{ t.ftCompliance }}</a>
              <a :href="`${lp}/guide/community.html`">{{ t.ftCommunity }}</a>
            </div>
          </nav>
          <div class="foot-legal">
            <span>© 2026 <a href="https://tiago.zip">tiago.zip</a>, Apache 2.0</span>
            <span>{{ t.ftLegal.trim() }}</span>
            <a class="foot-gh" href="https://github.com/tiagozip/cap" data-cta="github" data-cta-location="footer">GitHub</a>
          </div>
        </div>
      </div>
    </footer>
  </div>
</template>

<style>
@font-face {
  font-family: "Recife Text";
  src: url("/assets/fonts/recife-text-light.woff2") format("woff2");
  font-weight: 300;
  font-display: swap;
}
@font-face {
  font-family: "Unica77";
  src: url("/assets/fonts/unica77-light.woff2") format("woff2");
  font-weight: 300;
  font-display: swap;
}
@font-face {
  font-family: "Unica77";
  src: url("/assets/fonts/unica77-regular.woff2") format("woff2");
  font-weight: 400;
  font-display: swap;
}
@font-face {
  font-family: "Departure Mono";
  src: url("/assets/fonts/departure-mono.woff2") format("woff2");
  font-display: block;
}
html.home-v2-active {
  --ground: #11111b;
  --panel: #181825;
  --raised: #1e1e2e;
  --edge: #ffffff10;
  --edge-strong: #ffffff1f;
  --text: #cdd6f4;
  --text-secondary: #a6adc8;
  --text-faint: #7f849c;
  --accent: #89b4fa;
  --accent-ink: #11111b;
  --danger: #f38ba8;
  --success: #a6e3a1;
  --caution: #f9e2af;
  --font-serif: "Recife Text", "Iowan Old Style", Georgia, serif;
  --font-sans: "Unica77", "Inter", ui-sans-serif, system-ui, sans-serif;
  --font-code: ui-monospace, "SF Mono", Menlo, Consolas, monospace;
  --ease-out: cubic-bezier(0.23, 1, 0.32, 1);
  --radius: 10px;
  --frame-pad: 48px;
  --wrap-pad: 24px;
  --tick: #585b70;

  background: var(--ground);
  color: var(--text);
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  scrollbar-color: #ffffff24 var(--ground);
  scrollbar-gutter: auto;
}
html.home-v2-active body {
  background: var(--ground);
  color: var(--text);
}
html.home-v2-active .VPNav,
html.home-v2-active .VPLocalNav,
html.home-v2-active .VPSidebar,
html.home-v2-active .VPDocFooter,
html.home-v2-active .VPFooter {
  display: none !important;
}
html.home-v2-active .VPContent,
html.home-v2-active .VPContent.is-home,
html.home-v2-active main.main {
  padding: 0 !important;
  margin: 0 !important;
}
#homev2 {
  background: var(--ground);
  color: var(--text);
  font-family: var(--font-sans);
  font-weight: 300;
  font-size: 1.0625rem;
  line-height: 1.5;
  overflow-x: clip;
}
#homev2 *,
#homev2 *::before,
#homev2 *::after {
  box-sizing: border-box;
}
#homev2 :is(h1, h2, h3, p, figure, blockquote, dl, dd, ul, pre) {
  margin: 0;
  padding: 0;
}
#homev2 :is(h1, h2, h3) {
  font-family: var(--font-serif);
  font-weight: 300;
  color: var(--text);
  border: 0;
  text-wrap: balance;
}
#homev2 p {
  text-wrap: pretty;
}
#homev2 a {
  color: inherit;
  text-decoration: none;
}
#homev2 li {
  margin: 0;
}
#homev2 :focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
  border-radius: 6px;
}
#homev2 code {
  font-family: var(--font-code);
  background: none;
  padding: 0;
  color: inherit;
  font-size: inherit;
}
#homev2 pre code {
  white-space: inherit !important;
}
#homev2 .sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}
#homev2 .wrap {
  width: 100%;
  max-width: 1168px;
  margin-inline: auto;
  padding-inline: var(--wrap-pad);
}
#homev2 .frame {
  padding-inline: var(--frame-pad);
  box-shadow:
    inset 1px 0 var(--edge),
    inset -1px 0 var(--edge);
}
#homev2 .band + .band {
  border-top: 1px solid var(--edge);
}
#homev2 .top {
  box-shadow: inset 0 -1px var(--edge);
}
#homev2 .band + .band > .wrap,
#homev2 .top > .wrap {
  position: relative;
}
#homev2 .band + .band > .wrap::before,
#homev2 .band + .band > .wrap::after,
#homev2 .top > .wrap::before,
#homev2 .top > .wrap::after {
  content: "";
  position: absolute;
  top: -6px;
  z-index: 2;
  width: 6px;
  height: 11px;
  background: var(--tick);
  clip-path: polygon(0 0, 100% 50%, 0 100%);
  pointer-events: none;
}
#homev2 .top > .wrap::before,
#homev2 .top > .wrap::after {
  top: auto;
  bottom: -5px;
}
#homev2 .band + .band > .wrap::before,
#homev2 .top > .wrap::before {
  left: var(--wrap-pad);
}
#homev2 .band + .band > .wrap::after,
#homev2 .top > .wrap::after {
  right: var(--wrap-pad);
  clip-path: polygon(100% 0, 0 50%, 100% 100%);
}
#homev2 .section {
  padding-block: 96px;
}
#homev2 .btn {
  position: relative;
  isolation: isolate;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  height: 40px;
  padding-inline: 16px;
  border: 0;
  border-radius: var(--radius);
  background: none;
  font: 400 1rem/1 var(--font-sans);
  white-space: nowrap;
  cursor: pointer;
  transition: scale 160ms var(--ease-out);
}
#homev2 .btn::before {
  content: "";
  position: absolute;
  inset: 0;
  z-index: -1;
  border-radius: inherit;
  background: var(--btn-fill);
  box-shadow: var(--btn-shadow);
  transition:
    filter 200ms var(--ease-out),
    box-shadow 200ms var(--ease-out);
}
#homev2 .btn:active {
  scale: 0.97;
}
#homev2 .btn:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 3px;
}
#homev2 .btn-sm {
  height: 34px;
  padding-inline: 12px;
  font-size: 0.9375rem;
}
#homev2 .btn-primary {
  color: var(--accent-ink);
  --btn-fill: var(--text);
  --btn-shadow:
    inset 0 1px 0 #fffffff2,
    inset 0 1px 2px -0.5px #fffc,
    inset 0 12px 16px -10px #ffffffb3,
    inset 0 -12px 16px -10px #0000003d,
    inset 0 -1px 2px -1px #00000024,
    0 0 0 1px #0006,
    0 0.5px 0.5px #00000029,
    0 2px 2px -1px #0000001f,
    0 3px 3px -1.5px #0000001a,
    0 5px 5px -2.5px #00000014,
    0 8px 8px -3px #0000000f,
    0 12px 12px -6px #0000000d;
}
#homev2 .btn-ghost {
  color: var(--text);
  --btn-fill: #ffffff0a;
  --btn-shadow:
    inset 0 1px 0 #ffffff0f,
    inset 0 8px 24px -4px #ffffff0a,
    inset 0 -4px 12px -4px #ffffff0a,
    inset 0 0 0 1px #ffffff12;
}
@media (hover: hover) {
  #homev2 .btn-primary:hover::before {
    filter: brightness(1.06);
  }
  #homev2 .btn-ghost:hover::before {
    filter: brightness(1.6);
  }
}
@media (prefers-reduced-motion: reduce) {
  #homev2 .btn,
  #homev2 .btn::before {
    transition: none;
  }
}
#homev2 .actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}
#homev2 .text-link {
  display: inline-flex;
  align-items: center;
  min-height: 32px;
  color: var(--text);
  text-decoration: underline;
  text-decoration-color: #cdd6f466;
  text-underline-offset: 4px;
  text-decoration-thickness: 1px;
  text-decoration-skip-ink: auto;
  transition: text-decoration-color 140ms;
}
#homev2 .text-link.small {
  font-size: 0.9375rem;
  min-height: 28px;
}
@media (hover: hover) {
  #homev2 .text-link:hover {
    text-decoration-color: currentColor;
  }
}
#homev2 .top {
  position: relative;
  z-index: 50;
}
#homev2 .top-inner {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
  align-items: center;
  gap: 24px;
  height: 68px;
}
#homev2 .top-left,
#homev2 .top-right {
  display: flex;
  align-items: center;
}
#homev2 .top-left {
  gap: 20px;
}
#homev2 .top-right {
  justify-self: end;
  gap: 16px;
}
#homev2 .top-links {
  display: flex;
  align-items: center;
  font-size: 0.9375rem;
}
#homev2 .top-links .nav-link {
  display: inline-flex;
  align-items: center;
  height: 32px;
  padding-inline: 7px;
  border-radius: 8px;
  white-space: nowrap;
  transition:
    color 120ms,
    background-color 120ms;
}
@media (hover: hover) {
  #homev2 .top-links .nav-link:hover {
    background: #ffffff0a;
  }
}
@media (max-width: 1000px) {
  #homev2 .top-links {
    display: none;
  }
}
@media (max-width: 600px) {
  #homev2 .gh-link {
    display: none;
  }
}
#homev2 .brand {
  display: inline-flex;
  align-items: center;
  gap: 9px;
  font-weight: 400;
  font-size: 1.125rem;
}
#homev2 .nav-link {
  color: var(--text-secondary);
  transition: color 120ms;
}
@media (hover: hover) {
  #homev2 .nav-link:hover {
    color: var(--text);
  }
}
#homev2 .gh-link {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  font-size: 0.9375rem;
  white-space: nowrap;
}
#homev2 .homev2-search {
  display: inline-flex;
  align-items: center;
  flex-grow: 0;
  padding-left: 0 !important;
}
#homev2 .homev2-search .DocSearch-Button {
  margin: 0;
  width: 300px;
  height: 38px;
  padding-inline: 12px 8px;
  justify-content: space-between;
  border: 1px solid var(--edge);
  border-radius: 10px;
  background: transparent;
  box-shadow: none;
  transition: border-color 120ms;
}
#homev2 .homev2-search .DocSearch-Button-Placeholder {
  flex: 1;
  text-align: start;
  font-size: 0.9375rem;
  color: var(--text-faint);
}
#homev2 .homev2-search .DocSearch-Button-Keys {
  opacity: 0.7;
}
@media (hover: hover) {
  #homev2 .homev2-search .DocSearch-Button:hover {
    border-color: var(--edge-strong);
    background: transparent;
  }
}
@media (max-width: 767px) {
  #homev2 .homev2-search .DocSearch-Button {
    width: 38px;
    padding: 0;
    justify-content: center;
  }
}
#homev2 .homev2-translations {
  display: flex !important;
  align-items: center;
}
#homev2 .homev2-translations .button {
  display: flex;
  align-items: center;
  height: auto;
  padding: 0;
  color: var(--text-secondary);
}
#homev2 .homev2-translations .menu {
  top: calc(100% - 2px);
  padding-top: 10px;
  z-index: 60;
}
#homev2 .hero .frame {
  overflow: clip;
}
#homev2 .top,
#homev2 .hero {
  -webkit-user-select: none;
  user-select: none;
}
#homev2 .hero-copy {
  max-width: 880px;
  margin-inline: auto;
  text-align: center;
  display: grid;
  justify-items: center;
}
#homev2 h1 {
  font-size: clamp(1.875rem, 1.3rem + 1.6vw, 2.75rem);
  line-height: 1.1;
  letter-spacing: -0.03em;
}
#homev2 h1 > span {
  display: block;
  width: fit-content;
  margin-inline: auto;
}
#homev2 .lead {
  margin-top: 18px;
  max-width: 34em;
  font-size: clamp(1.0625rem, 1rem + 0.3vw, 1.1875rem);
  color: var(--text-secondary);
}
#homev2 .hero-copy .actions {
  justify-content: center;
  margin-top: 28px;
}
#homev2 h1 .w {
  display: inline-block;
  transform-origin: 0 100%;
}
@media (prefers-reduced-motion: no-preference) {
  #homev2 .hero .w {
    animation: hero-word 1100ms var(--ease-out) calc(80ms + var(--i) * 42ms) both;
  }
  #homev2 .hero .lead {
    animation: hero-rise 1000ms var(--ease-out) 520ms both;
  }
  #homev2 .hero .actions > a {
    animation: hero-rise 900ms var(--ease-out) 640ms both;
  }
  #homev2 .hero .actions > a + a {
    animation-delay: 710ms;
  }
}
@media (prefers-reduced-motion: reduce) {
  #homev2 .hero .lead,
  #homev2 .hero .actions {
    animation: hero-fade 500ms ease both;
  }
}
@keyframes hero-word {
  from {
    opacity: 0;
    transform: translateY(0.45em) rotate(2deg);
    filter: blur(10px);
  }
  to {
    opacity: 1;
    transform: none;
    filter: blur(0);
  }
}
@keyframes hero-rise {
  from {
    opacity: 0;
    transform: translateY(14px);
    filter: blur(6px);
  }
  to {
    opacity: 1;
    transform: none;
    filter: blur(0);
  }
}
@keyframes hero-fade {
  from {
    opacity: 0;
  }
}
#homev2 .trust-inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px 48px;
  padding-block: 36px;
}
#homev2 .trust p {
  max-width: 25em;
  text-wrap: balance;
  word-break: keep-all;
  font-size: 0.9375rem;
  color: var(--text-secondary);
}
#homev2 .logos {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 20px 48px;
}
#homev2 .logos img,
#homev2 .quote figcaption img {
  height: 24px;
  width: auto;
}
#homev2 .quote figcaption img {
  filter: grayscale(1) brightness(0) invert(0.82);
}
#homev2 .logos img[alt="bunny.net"],
#homev2 .logos img[alt="Fraunhofer"] {
  height: 28px;
}
#homev2 .head {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 24px 64px;
  align-items: start;
}
#homev2 .head h2,
#homev2 .faq-head h2,
#homev2 .start h2 {
  font-size: clamp(1.75rem, 1.2rem + 1.4vw, 2.375rem);
  line-height: 1.1;
  letter-spacing: -0.03em;
}
#homev2 .head-side {
  display: grid;
  gap: 12px;
  justify-items: start;
  padding-top: 6px;
}
#homev2 .head-side p {
  font-size: 1.0625rem;
  color: var(--text-secondary);
}
#homev2 .ui-window {
  border-radius: 12px;
  background: var(--raised);
  box-shadow:
    inset 0 0 0 1px var(--edge),
    0 1px 2px #00000033,
    0 8px 24px #00000033;
  overflow: hidden;
}
#homev2 .ui-title {
  padding: 12px 16px;
  font-size: 0.8125rem;
  color: var(--text-faint);
  box-shadow: inset 0 -1px 0 var(--edge);
}
#homev2 .agents {
  margin-top: 56px;
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 24px;
  align-items: start;
}
#homev2 .settings {
  padding: 22px 22px 12px;
  font-family: Inter, ui-sans-serif, system-ui, sans-serif;
  font-weight: 400;
  font-size: 0.875rem;
}
#homev2 .settings-row {
  display: flex;
  justify-content: space-between;
  color: var(--text);
}
#homev2 .settings-value {
  color: var(--text-faint);
  font-variant-numeric: tabular-nums;
}
#homev2 .slider {
  position: relative;
  height: 6px;
  margin: 14px 0 22px;
  border-radius: 3px;
  background: #ffffff0f;
}
#homev2 .slider span {
  position: absolute;
  inset: 0 auto 0 0;
  width: 20%;
  border-radius: 3px;
  background: var(--accent);
}
#homev2 .slider span::after {
  content: "";
  position: absolute;
  right: -8px;
  top: -5px;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: var(--accent);
}
#homev2 .settings-group {
  padding-top: 18px;
  margin-bottom: 4px;
  color: var(--text-secondary);
  box-shadow: inset 0 1px 0 var(--edge);
}
#homev2 .toggle-row {
  display: flex;
  gap: 14px;
  align-items: flex-start;
  padding-block: 10px;
}
#homev2 .toggle {
  flex-shrink: 0;
  position: relative;
  width: 36px;
  height: 20px;
  margin-top: 1px;
  border-radius: 10px;
  background: #313244;
}
#homev2 .toggle span {
  position: absolute;
  top: 3px;
  left: 3px;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: #6c7086;
}
#homev2 .toggle.on {
  background: var(--accent);
}
#homev2 .toggle.on span {
  left: 19px;
  background: var(--ground);
}
#homev2 .toggle-label {
  display: block;
  color: var(--text);
}
#homev2 .toggle-hint {
  display: block;
  margin-top: 2px;
  color: var(--text-faint);
  font-size: 0.8125rem;
}
#homev2 .agents-result {
  display: grid;
  gap: 14px;
}
#homev2 .json {
  padding: 16px;
  overflow-x: auto;
  font: 0.8125rem/1.7 var(--font-code);
  white-space: pre;
  background: none;
}
#homev2 .j-k {
  color: var(--accent);
}
#homev2 .j-s {
  color: var(--success);
}
#homev2 .j-b {
  color: var(--danger);
}
#homev2 .j-p {
  color: var(--text-faint);
}
#homev2 .checks {
  list-style: none;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
#homev2 .checks li {
  padding: 4px 8px;
  border-radius: 6px;
  background: var(--panel);
  box-shadow: inset 0 0 0 1px var(--edge);
  font-size: 0.75rem;
  color: var(--text-secondary);
}
#homev2 .shot {
  margin-top: 56px;
  padding: 8px;
  border-radius: 18px;
  background: var(--panel);
  box-shadow:
    inset 0 0 0 1px var(--edge),
    0 2px 4px #00000033,
    0 24px 48px #00000040;
}
#homev2 .shot img {
  display: block;
  width: 100%;
  height: auto;
  border-radius: 11px;
  outline: 1px solid #ffffff14;
  outline-offset: -1px;
}
#homev2 .facts {
  margin-top: 40px;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 24px 32px;
}
#homev2 .facts > div {
  padding-left: 16px;
  box-shadow: inset 1px 0 var(--edge-strong);
}
#homev2 .facts dt {
  font-weight: 400;
  color: var(--text);
}
#homev2 .facts dd {
  margin-top: 4px;
  font-size: 0.9375rem;
  color: var(--text-secondary);
}
#homev2 .quote-wrap {
  display: grid;
  justify-items: center;
}
#homev2 .quote {
  max-width: 700px;
  text-align: center;
  display: grid;
  justify-items: center;
  gap: 24px;
}
#homev2 .quote blockquote {
  margin: 0;
  padding: 0;
  border: 0;
}
#homev2 .quote blockquote p {
  font-family: var(--font-serif);
  font-weight: 300;
  font-size: clamp(1.25rem, 1.1rem + 0.4vw, 1.5rem);
  line-height: 1.35;
  letter-spacing: -0.02em;
  color: var(--text);
}
#homev2 .quote figcaption {
  display: flex;
  align-items: center;
  gap: 14px;
  font-size: 0.9375rem;
  color: var(--text-secondary);
}
#homev2 .quote figcaption img {
  height: 22px;
}
#homev2 .stats {
  margin-top: 48px;
  font-size: 0.9375rem;
  color: var(--text-faint);
}
#homev2 .faq-wrap {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 2fr);
  gap: 32px 64px;
  align-items: start;
}
#homev2 .faq-head {
  position: sticky;
  top: 32px;
  display: grid;
  gap: 12px;
  justify-items: start;
}
#homev2 .faq > div {
  padding-block: 22px;
  box-shadow: inset 0 -1px 0 var(--edge);
}
#homev2 .faq > div:first-child {
  padding-top: 0;
}
#homev2 .faq dt {
  font-weight: 400;
  color: var(--text);
}
#homev2 .faq dd {
  margin-top: 6px;
  max-width: 62ch;
  color: var(--text-secondary);
}
#homev2 .faq dd a {
  color: var(--text);
  text-decoration: underline;
  text-decoration-color: #cdd6f466;
  text-underline-offset: 3px;
}
#homev2 .start {
  display: grid;
  grid-template-columns: minmax(0, 5fr) minmax(0, 7fr);
  gap: 40px 56px;
  align-items: center;
}
#homev2 .start-copy {
  display: grid;
  gap: 14px;
  justify-items: start;
}
#homev2 .start-copy p {
  color: var(--text-secondary);
}
#homev2 .start-copy .actions {
  margin-top: 10px;
}
#homev2 .code {
  max-width: 100%;
  overflow-x: auto;
  padding: 20px 22px;
  border-radius: 14px;
  background: var(--panel);
  box-shadow: inset 0 0 0 1px var(--edge);
  font: 0.8125rem/1.75 var(--font-code);
  color: var(--text);
  white-space: pre;
}
#homev2 .c-tag {
  color: var(--accent);
}
#homev2 .c-attr {
  color: var(--caution);
}
#homev2 .c-str {
  color: var(--success);
}
#homev2 .foot-inner {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 2fr);
  gap: 48px 64px;
  padding-block: 64px 40px;
}
#homev2 .foot-brand {
  display: grid;
  gap: 14px;
  align-content: start;
  justify-items: start;
}
#homev2 .foot-brand p {
  font-size: 0.9375rem;
  color: var(--text-faint);
}
#homev2 .foot-cols {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 32px;
}
#homev2 .foot-cols div {
  display: grid;
  gap: 10px;
  align-content: start;
  justify-items: start;
}
#homev2 .foot-cols h3 {
  margin-bottom: 4px;
  font-family: var(--font-sans);
  font-weight: 400;
  font-size: 0.9375rem;
  color: var(--text);
}
#homev2 .foot-cols a,
#homev2 .foot-gh {
  font-size: 0.9375rem;
  color: var(--text-secondary);
  transition: color 120ms;
}
@media (hover: hover) {
  #homev2 .foot-cols a:hover,
  #homev2 .foot-gh:hover {
    color: var(--text);
  }
}
#homev2 .foot-legal {
  grid-column: 1 / -1;
  display: flex;
  flex-wrap: wrap;
  gap: 8px 32px;
  padding-top: 24px;
  font-size: 0.875rem;
  color: var(--text-faint);
  box-shadow: inset 0 1px 0 var(--edge);
}
#homev2 .foot-legal .foot-gh {
  margin-left: auto;
  font-size: 0.875rem;
}
#homev2 .foot-legal a {
  color: var(--text-secondary);
}
.widget-banner {
  background: color-mix(in oklab, var(--accent) 11%, var(--ground));
  color: var(--text);
}
#homev2 .widget-banner-wrap {
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
  font-size: 0.875rem;
  line-height: 1.45;
  color: var(--text-secondary);
  min-width: 0;
}
.widget-banner-text strong {
  color: var(--text);
  font-weight: 400;
}
.widget-banner-sub {
  margin-left: 6px;
}
.widget-banner-close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 6px;
  border: none;
  background: transparent;
  color: var(--text-faint);
  cursor: pointer;
  flex-shrink: 0;
  transition:
    background-color 120ms,
    color 120ms;
}
@media (hover: hover) {
  .widget-banner-close:hover {
    background: #ffffff0f;
    color: var(--text);
  }
}
.widget-banner-leave-active {
  transition:
    opacity 180ms ease,
    filter 180ms ease;
}
.widget-banner-leave-to {
  opacity: 0;
  filter: blur(4px);
}
@media (max-width: 960px) {
  html.home-v2-active {
    --frame-pad: 28px;
  }
  #homev2 .agents,
  #homev2 .start {
    grid-template-columns: minmax(0, 1fr);
  }
  #homev2 .trust-inner {
    flex-direction: column;
    align-items: flex-start;
  }
}
@media (max-width: 760px) {
  #homev2 .nav-extra,
  #homev2 .gh-stars-label {
    display: none;
  }
  #homev2 .head,
  #homev2 .faq-wrap,
  #homev2 .foot-inner {
    grid-template-columns: minmax(0, 1fr);
  }
  #homev2 .faq-head {
    position: static;
  }
  #homev2 .facts {
    grid-template-columns: minmax(0, 1fr);
  }
  #homev2 .section {
    padding-block: 72px;
  }
  #homev2 .agents,
  #homev2 .grid,
  #homev2 .shot {
    margin-top: 36px;
  }
}
@media (max-width: 600px) {
  html.home-v2-active {
    --frame-pad: 16px;
  }
  html.home-v2-active {
    --wrap-pad: 12px;
  }
  #homev2 .top nav {
    gap: 14px;
  }
  #homev2 .homev2-search .DocSearch-Button-Placeholder,
  #homev2 .homev2-search .DocSearch-Button-Keys {
    display: none;
  }
  #homev2 .homev2-search .DocSearch-Button {
    width: 36px;
    padding: 0;
    justify-content: center;
  }
  #homev2 .json {
    font-size: 0.75rem;
  }
  #homev2 .shot {
    padding: 4px;
    border-radius: 12px;
  }
  #homev2 .shot {
    overflow: hidden;
  }
  #homev2 .shot img {
    width: 210%;
    max-width: none;
    margin-left: -50%;
    border-radius: 0;
    outline: 0;
  }
  #homev2 .foot-cols {
    grid-template-columns: 1fr 1fr;
  }
  .widget-banner-sub {
    display: block;
    margin-left: 0;
    margin-top: 2px;
  }
}
@media (prefers-reduced-motion: reduce) {
  #homev2 * {
    transition-duration: 0s !important;
  }
}
</style>
