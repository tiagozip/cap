<script setup>
import { useData } from "vitepress";
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { evaluateInstr, instrumentationFor, signalNames } from "../demoCheck.js";
import { domSignatures } from "../troubleshootDomSignatures.js";
import { troubleshootStrings } from "./troubleshoot.strings.js";

const REPORT_URL = import.meta.env.DEV ? "http://localhost:8787/report" : "https://report.trycap.dev/report";
const DETAILS_URL = REPORT_URL.replace(/\/report$/, "/details");
const ENDPOINT = "/troubleshoot-api/";

const TAMPER = new Set([
  "native_tamper",
  "stealth_patches",
  "attach_shadow_patched",
  "engine_mismatch",
  "os_mismatch",
  "languages_inconsistent",
  "frame_mismatch",
  "worker_mismatch",
  "geometry_quantized",
]);

const { lang, localeIndex } = useData();
const t = computed(() => troubleshootStrings[lang.value?.slice(0, 2)] ?? troubleshootStrings.en);
const ownersLink = computed(() => `${localeIndex.value === "root" ? "" : `/${localeIndex.value}`}/guide/error-codes`);

const phase = ref("checking");
const category = ref(null);
const agentName = ref(null);
const noticed = ref([]);
const report = ref({ state: "idle", id: null });
const sent = ref(null);
const hostEl = ref(null);
const extensions = ref(null);
const domUnknown = ref([]);
const copied = ref(false);
const fromUrl = ref(null);
const cleanups = [];

const fromHost = computed(() => {
  try {
    const host = new URL(fromUrl.value).host;
    return host && host !== location.host ? host : null;
  } catch {
    return null;
  }
});

const privateKeys = computed(() => {
  if (typeof navigator === "undefined") return null;
  const ua = navigator.userAgent;
  if (/Android|iPhone|iPad|Mobile/.test(ua)) return null;
  const mac = /Mac OS X|Macintosh/.test(ua);
  const firefox = /Firefox\//.test(ua);
  const safari = /Safari\//.test(ua) && !/Chrome\/|Chromium\//.test(ua);
  if (mac) return firefox ? "⌘ Shift P" : "⌘ Shift N";
  if (safari) return null;
  return firefox ? "Ctrl Shift P" : "Ctrl Shift N";
});

const guessSetup = () => {
  const ua = navigator.userAgent;
  const version = (re) => ua.match(re)?.[1]?.split(".")[0];
  const browser = /Edg\//.test(ua)
    ? `Edge ${version(/Edg\/([\d.]+)/)}`
    : /OPR\//.test(ua)
      ? `Opera ${version(/OPR\/([\d.]+)/)}`
      : /Firefox\//.test(ua)
        ? `Firefox ${version(/Firefox\/([\d.]+)/)}`
        : navigator.brave
          ? `Brave ${version(/Chrome\/([\d.]+)/)}`
          : /Chrome\//.test(ua)
            ? `Chrome ${version(/Chrome\/([\d.]+)/)}`
            : /Safari\//.test(ua)
              ? `Safari ${version(/Version\/([\d.]+)/) ?? ""}`.trim()
              : "";
  const os = /Windows/.test(ua)
    ? "Windows"
    : /iPhone|iPad/.test(ua)
      ? "iOS"
      : /Android/.test(ua)
        ? "Android"
        : /Mac OS X|Macintosh/.test(ua)
          ? navigator.maxTouchPoints > 1
            ? "iPadOS"
            : "macOS"
          : /CrOS/.test(ua)
            ? "ChromeOS"
            : /Linux/.test(ua)
              ? "Linux"
              : "";
  const device = /iPad|Tablet/.test(ua) || os === "iPadOS" ? "tablet" : /Mobile|iPhone|Android/.test(ua) ? "phone" : "computer";
  return { browser, os, deviceType: device };
};

const form = ref({ device: "", network: "", note: "", contact: "" });
const setup = ref({ browser: "", os: "", deviceType: "" });
const formState = ref("idle");
const deviceGuess = ref({ mode: "field", label: "" });
const editingDevice = ref(false);
const deviceInput = ref(null);
const techOpen = ref(false);
const idCopied = ref(false);

const IOS_SCREENS = {
  "375x667@2": "iPhone SE, 8, 7 or 6s",
  "414x736@3": "iPhone 8 Plus, 7 Plus or 6s Plus",
  "375x812@3": "iPhone X, XS, 11 Pro, 12 mini or 13 mini",
  "414x896@2": "iPhone XR or 11",
  "414x896@3": "iPhone XS Max or 11 Pro Max",
  "390x844@3": "iPhone 12, 12 Pro, 13, 13 Pro or 14",
  "428x926@3": "iPhone 12 Pro Max, 13 Pro Max or 14 Plus",
  "393x852@3": "iPhone 14 Pro, 15, 15 Pro or 16",
  "430x932@3": "iPhone 14 Pro Max, 15 Plus, 15 Pro Max or 16 Plus",
  "402x874@3": "iPhone 16 Pro, 17 or 17 Pro",
  "420x912@3": "iPhone Air",
  "440x956@3": "iPhone 16 Pro Max or 17 Pro Max",
  "768x1024@2": "iPad or iPad mini",
  "744x1133@2": "iPad mini",
  "810x1080@2": "iPad 10.2-inch",
  "820x1180@2": "iPad 10.9-inch or iPad Air",
  "834x1112@2": "iPad Pro 10.5-inch or iPad Air",
  "834x1194@2": "iPad Pro 11-inch",
  "834x1210@2": "iPad Pro 11-inch",
  "1024x1366@2": "iPad Pro 12.9-inch",
  "1032x1376@2": "iPad Pro 13-inch or iPad Air 13-inch",
};

const plainAgent = (id, label) => {
  const vendors = [
    [/^claude/, "Claude"],
    [/^(chatgpt|codex)/, "ChatGPT"],
    [/^(google|gemini)/, "Gemini"],
    [/^perplexity/, "Perplexity"],
    [/^grok/, "Grok"],
    [/^brave-leo/, "Leo"],
  ];
  const hit = vendors.find(([re]) => re.test(id ?? ""));
  if (hit) return hit[1];
  const base = label?.split(" (")[0]?.trim();
  if (!base || base === id || /[()]/.test(base)) return null;
  return base;
};

const editDevice = async () => {
  editingDevice.value = true;
  await nextTick();
  deviceInput.value?.focus();
};

const copyText = async (text) => {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const area = document.createElement("textarea");
    area.value = text;
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    document.execCommand("copy");
    area.remove();
  }
};

let idCopiedTimer = null;
const copyId = async () => {
  await copyText(report.value.id);
  idCopied.value = true;
  clearTimeout(idCopiedTimer);
  idCopiedTimer = setTimeout(() => {
    idCopied.value = false;
  }, 2000);
};

const sendDetails = async () => {
  if (formState.value === "sending") return;
  formState.value = "sending";
  if (report.value.state === "sending") {
    await new Promise((resolve) => {
      const stop = watch(
        () => report.value.state,
        (state) => {
          if (state === "sending") return;
          stop();
          resolve();
        },
      );
    });
  }
  if (!report.value.id) {
    formState.value = "failed";
    return;
  }
  try {
    const res = await fetch(DETAILS_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: report.value.id, ...form.value, ...setup.value, extensions: extensions.value ?? [], domUnknown: domUnknown.value }),
    });
    formState.value = res.ok ? "sent" : "failed";
  } catch {
    formState.value = "failed";
  }
};

const goBack = () => {
  if (fromUrl.value) {
    location.href = fromUrl.value;
    return;
  }
  history.back();
};

const kind = computed(() => (phase.value === "failed" ? category.value : phase.value));

const headline = computed(() => {
  if (kind.value === "agent" && agentName.value) return t.value.heads.agentNamed.replace("{agent}", agentName.value);
  return t.value.heads[kind.value];
});

const instruction = computed(() => {
  if (kind.value !== "tamper") return t.value.dos[kind.value];
  return privateKeys.value ? t.value.dos.tamperKeys.replace("{keys}", privateKeys.value) : t.value.dos.tamper;
});

const action = computed(() => {
  if (["agent", "automation", "tamper"].includes(kind.value)) return fromUrl.value ? "copy" : null;
  if (["site", "unfinished"].includes(kind.value)) return "retry";
  return null;
});

let copiedTimer = null;
const runAction = async () => {
  if (action.value === "retry") {
    location.reload();
    return;
  }
  await copyText(fromUrl.value);
  copied.value = true;
  clearTimeout(copiedTimer);
  copiedTimer = setTimeout(() => {
    copied.value = false;
  }, 2000);
};
cleanups.push(() => {
  clearTimeout(copiedTimer);
  clearTimeout(idCopiedTimer);
});

const sentJson = computed(() => (sent.value ? JSON.stringify(sent.value, null, 2) : ""));

const withTimeout = (p, ms) => Promise.race([p, new Promise((r) => setTimeout(() => r("timeout"), ms))]);

const collect = async () => {
  const safe = async (fn) => {
    try {
      return await fn();
    } catch (e) {
      return `error: ${e?.message ?? e}`;
    }
  };
  const n = navigator;
  const gl = await safe(() => {
    const c = document.createElement("canvas");
    const ctx = c.getContext("webgl2") ?? c.getContext("webgl");
    if (!ctx) return null;
    const dbg = ctx.getExtension("WEBGL_debug_renderer_info");
    return {
      version: ctx.getParameter(ctx.VERSION),
      vendor: dbg ? ctx.getParameter(dbg.UNMASKED_VENDOR_WEBGL) : ctx.getParameter(ctx.VENDOR),
      renderer: dbg ? ctx.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : ctx.getParameter(ctx.RENDERER),
      maxTexture: ctx.getParameter(ctx.MAX_TEXTURE_SIZE),
      extensions: ctx.getSupportedExtensions()?.length ?? 0,
    };
  });
  const voices = await safe(async () => {
    if (!("speechSynthesis" in window)) return null;
    let list = speechSynthesis.getVoices();
    if (!list.length) {
      await withTimeout(new Promise((r) => speechSynthesis.addEventListener("voiceschanged", r, { once: true })), 800);
      list = speechSynthesis.getVoices();
    }
    return { count: list.length, google: list.filter((v) => v.name.startsWith("Google")).length, local: list.filter((v) => v.localService).length };
  });
  const extraGlobals = await safe(() => {
    const f = document.createElement("iframe");
    f.style.display = "none";
    document.body.appendChild(f);
    const base = new Set(Object.getOwnPropertyNames(f.contentWindow));
    f.remove();
    return Object.getOwnPropertyNames(window)
      .filter((k) => !base.has(k) && !/^(__VP|__vite|__VUE|__vue|_fullres|__cf|CAP_|__capHIS)/.test(k))
      .slice(0, 80);
  });
  const nanArch = (() => {
    const f = new Float32Array(1);
    const u = new Uint8Array(f.buffer);
    f[0] = Number.POSITIVE_INFINITY;
    f[0] -= f[0];
    return u[3];
  })();
  return {
    page: {
      url: location.href,
      referrer: document.referrer,
      visibility: document.visibilityState,
      secure: isSecureContext,
      crossOriginIsolated: window.crossOriginIsolated,
      at: new Date().toISOString(),
    },
    navigator: {
      userAgent: n.userAgent,
      appVersion: n.appVersion,
      platform: n.platform,
      vendor: n.vendor,
      productSub: n.productSub,
      language: n.language,
      languages: n.languages,
      cookieEnabled: n.cookieEnabled,
      doNotTrack: n.doNotTrack,
      globalPrivacyControl: n.globalPrivacyControl,
      hardwareConcurrency: n.hardwareConcurrency,
      deviceMemory: n.deviceMemory,
      maxTouchPoints: n.maxTouchPoints,
      pdfViewerEnabled: n.pdfViewerEnabled,
      webdriver: n.webdriver,
      onLine: n.onLine,
      brave: !!n.brave,
      plugins: [...(n.plugins ?? [])].map((p) => p.name),
      mimeTypes: [...(n.mimeTypes ?? [])].map((m) => m.type),
    },
    uaBrands: n.userAgentData?.brands,
    uaHints: await safe(() =>
      n.userAgentData?.getHighEntropyValues(["architecture", "bitness", "model", "platformVersion", "fullVersionList", "wow64", "formFactors"]),
    ),
    nanArch,
    screen: {
      width: screen.width,
      height: screen.height,
      availWidth: screen.availWidth,
      availHeight: screen.availHeight,
      colorDepth: screen.colorDepth,
      orientation: screen.orientation?.type,
      extended: screen.isExtended,
    },
    window: {
      inner: [innerWidth, innerHeight],
      outer: [outerWidth, outerHeight],
      position: [screenX, screenY],
      devicePixelRatio,
      visualViewport: visualViewport && [visualViewport.width, visualViewport.height, visualViewport.scale],
    },
    intl: {
      ...Intl.DateTimeFormat().resolvedOptions(),
      offset: new Date().getTimezoneOffset(),
    },
    media: Object.fromEntries(
      [
        "(prefers-color-scheme: dark)",
        "(prefers-reduced-motion: reduce)",
        "(prefers-contrast: more)",
        "(forced-colors: active)",
        "(pointer: coarse)",
        "(any-pointer: fine)",
        "(hover: hover)",
        "(display-mode: standalone)",
        "(color-gamut: p3)",
        "(dynamic-range: high)",
      ].map((q) => [q, matchMedia(q).matches]),
    ),
    connection: n.connection && {
      type: n.connection.type,
      effectiveType: n.connection.effectiveType,
      rtt: n.connection.rtt,
      downlink: n.connection.downlink,
      saveData: n.connection.saveData,
    },
    webgl: gl,
    webgpu: await safe(async () => {
      const adapter = await withTimeout(n.gpu?.requestAdapter() ?? Promise.resolve(null), 600);
      if (!adapter || adapter === "timeout") return adapter ?? null;
      const info = adapter.info ?? {};
      return { vendor: info.vendor, architecture: info.architecture, description: info.description, fallback: adapter.isFallbackAdapter ?? info.isFallbackAdapter };
    }),
    voices,
    storage: await safe(async () => ({ ...(await n.storage?.estimate()), persisted: await n.storage?.persisted?.() })),
    permissions: await safe(async () =>
      Object.fromEntries(
        await Promise.all(
          ["notifications", "geolocation", "camera", "microphone", "persistent-storage"].map(async (name) => [
            name,
            await n.permissions?.query({ name }).then((p) => p.state, () => "unsupported"),
          ]),
        ),
      ),
    ),
    features: {
      webAssembly: typeof WebAssembly,
      worker: typeof Worker,
      sharedWorker: typeof SharedWorker,
      serviceWorker: "serviceWorker" in n,
      compressionStream: typeof CompressionStream,
      decompressionStream: typeof DecompressionStream,
      subtleCrypto: !!crypto.subtle,
      sharedArrayBuffer: typeof SharedArrayBuffer,
      offscreenCanvas: typeof OffscreenCanvas,
    },
    performance: {
      memory: performance.memory && {
        limit: performance.memory.jsHeapSizeLimit,
        total: performance.memory.totalJSHeapSize,
        used: performance.memory.usedJSHeapSize,
      },
      navigation: performance.getEntriesByType?.("navigation")?.[0]?.type,
      sincePageLoad: Math.round(performance.now()),
    },
    htmlAttributes: document.documentElement.getAttributeNames(),
    extraGlobals,
    errorStack: new Error("probe").stack?.slice(0, 600),
  };
};

const categorize = (widgetError, r, agent) => {
  const code = widgetError?.code;
  if (code === "instr_blocked") return "automation";
  if (code === "instr_natives_tampered") return "tamper";
  if (code === "instr_csp_blocked") return "site";
  if (code) return "unfinished";
  if (!r) return "unfinished";
  if (!r.valid) {
    if (r.reason === "instr_automated_browser") return (r.blockedBy ?? []).some((id) => TAMPER.has(id)) ? "tamper" : "automation";
    if (r.reason === "instr_automated_interaction") return "automation";
    if (["instr_host_unreachable", "instr_isolated"].includes(r.reason)) return "site";
    if (r.reason === "failed_challenge") return "tamper";
    return "unfinished";
  }
  if (agent?.detected) return "agent";
  return null;
};

const runCheck = () =>
  new Promise((resolve) => {
    let redeemBody = null;
    let settled = false;
    const finish = (out) => {
      if (settled) return;
      settled = true;
      resolve(out);
    };
    const prev = window.CAP_CUSTOM_FETCH;
    const hex = (n) => Array.from(crypto.getRandomValues(new Uint8Array(n)), (b) => b.toString(16).padStart(2, "0")).join("");
    const json = (b) => new Response(JSON.stringify(b), { status: 200, headers: { "Content-Type": "application/json" } });
    const mine = async (url, options) => {
      if (!url.startsWith(ENDPOINT)) return prev ? prev(url, options) : fetch(url, options);
      if (url.endsWith("challenge")) {
        return json({
          challenge: Array.from({ length: 4 }, () => [hex(16), hex(2)]),
          token: "",
          expires: Date.now() + 600000,
          ...(await instrumentationFor("check")),
        });
      }
      try {
        redeemBody = JSON.parse(options?.body ?? "{}");
      } catch {}
      setTimeout(() => finish({ redeemBody }), 0);
      return json({ success: true, token: "", expires: Date.now() + 3600000 });
    };
    window.CAP_CUSTOM_FETCH = mine;
    cleanups.push(() => {
      if (window.CAP_CUSTOM_FETCH === mine) window.CAP_CUSTOM_FETCH = prev;
    });

    const widget = document.createElement("cap-widget");
    widget.setAttribute("data-cap-api-endpoint", ENDPOINT);
    widget.style.display = "none";
    widget.addEventListener("error", (e) => finish({ widgetError: { code: e.detail?.code, message: e.detail?.message } }));
    hostEl.value.appendChild(widget);
    cleanups.push(() => widget.remove());

    const deadline = setTimeout(() => finish({ widgetError: { code: "page_timeout", message: "No result within 40 seconds" } }), 40000);
    cleanups.push(() => clearTimeout(deadline));

    customElements
      .whenDefined("cap-widget")
      .then(() => widget.solve())
      .catch(() => {});
  });

const readWidgetContext = () => {
  const m = location.hash.match(/(?:^#|&)r=([A-Za-z0-9_-]+)/);
  if (!m) return null;
  try {
    const bin = atob(m[1].replace(/-/g, "+").replace(/_/g, "/"));
    const ctx = JSON.parse(new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0))));
    history.replaceState(history.state, "", location.pathname + location.search);
    return ctx;
  } catch {
    return { raw: m[1].slice(0, 8000) };
  }
};

onMounted(async () => {
  const started = performance.now();
  const widgetContext = readWidgetContext();
  fromUrl.value = widgetContext?.from ?? (document.referrer || null);
  setup.value = guessSetup();
  {
    const { os, deviceType } = setup.value;
    const short = Math.min(screen.width, screen.height);
    const long = Math.max(screen.width, screen.height);
    const ios = ["iOS", "iPadOS"].includes(os) ? IOS_SCREENS[`${short}x${long}@${Math.round(devicePixelRatio)}`] : null;
    const computer = deviceType === "computer" && t.value.computers[os];
    if (ios) {
      form.value.device = ios;
      deviceGuess.value = { mode: "confirm", label: ios };
    } else if (computer) {
      form.value.device = computer;
      deviceGuess.value = { mode: "line", label: computer };
    }
  }
  navigator.userAgentData
    ?.getHighEntropyValues(["model"])
    .then(({ model }) => {
      if (!model || !/Android/.test(navigator.userAgent) || editingDevice.value) return;
      form.value.device = model;
      deviceGuess.value = { mode: "line", label: model };
    })
    .catch(() => {});
  const resourceDone = (async () => {
    if (!(window.chrome || navigator.userAgentData)) return [];
    const { default: list } = await import("../troubleshootExtensions.json");
    const found = [];
    let next = 0;
    await Promise.all(
      Array.from({ length: 20 }, async () => {
        while (next < list.length) {
          const [id, name, file] = list[next++];
          try {
            await fetch(`chrome-extension://${id}/${file}`, { cache: "no-store" });
            found.push({ id, name });
          } catch {}
        }
      }),
    );
    return found.map((e) => ({ ...e, via: "resource" }));
  })().catch(() => []);
  const domDone = new Promise((resolve) => {
    const found = new Set();
    const unknown = new Set();
    const selectorText = domSignatures.map(([, selector]) => selector).join(",");
    const scan = () => {
      for (const [name, selector] of domSignatures) {
        if (!found.has(name) && document.querySelector(selector)) found.add(name);
      }
      const roots = [document.documentElement, document.body].filter(Boolean);
      for (const el of roots) {
        for (const attr of el.getAttributeNames()) {
          if (attr.startsWith("data-") && !attr.startsWith("data-v-") && !selectorText.includes(attr)) unknown.add(attr.slice(0, 48));
        }
      }
      for (const el of document.querySelectorAll("*")) {
        const stray = el.parentElement === document.documentElement && !["head", "body"].includes(el.localName) && !el.matches("iframe[srcdoc]");
        if (!stray && (!el.localName.includes("-") || el.localName === "cap-widget")) continue;
        if (!el.matches(selectorText)) unknown.add(el.localName.slice(0, 48));
      }
    };
    let queued = false;
    const observer = new MutationObserver(() => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(() => {
        queued = false;
        scan();
      });
    });
    observer.observe(document.documentElement, { attributes: true, childList: true, subtree: true });
    scan();
    const stopTimer = setTimeout(() => {
      observer.disconnect();
      scan();
      resolve({ found: [...found].map((name) => ({ id: null, name, via: "dom" })), unknown: [...unknown].slice(0, 20) });
    }, 3500);
    cleanups.push(() => {
      clearTimeout(stopTimer);
      observer.disconnect();
    });
  });
  domDone.then(({ found, unknown }) => {
    domUnknown.value = unknown;
    extensions.value = found;
  });
  const extensionsDone = Promise.all([resourceDone, domDone]).then(([resource, { found }]) => {
    const merged = [...found, ...resource].filter((e, i, all) => all.findIndex((other) => other.name === e.name) === i);
    extensions.value = merged;
    return merged;
  });
  const out = await runCheck();
  const evaluation = out.redeemBody?.instr ? await evaluateInstr(out.redeemBody.instr, "check").catch(() => null) : null;
  const r = evaluation?.result ?? null;
  const agent = evaluation?.agent ?? null;
  const cat = categorize(out.widgetError, r, agent);
  const names = await signalNames().catch(() => ({ checks: new Map(), agents: new Map() }));

  if (!cat) {
    phase.value = "passed";
    return;
  }

  const failedIds = [
    ...(r?.blockedBy ?? []),
    ...(Array.isArray(r?.checks) ? r.checks : []).filter((c) => c?.passed === false).map((c) => c.id),
  ].filter((id, i, all) => id !== "cdp_console_trap" && all.indexOf(id) === i);
  const agentLabel = agent?.detected ? (names.agents.get(agent.name) ?? agent.name) : null;
  agentName.value = agent?.detected ? plainAgent(agent.name, agentLabel) : null;
  noticed.value = [
    ...(agentLabel ? [{ id: "agent", name: agentLabel }] : []),
    ...failedIds.map((id) => ({ id, name: names.checks.get(id) ?? id })),
  ];
  category.value = cat;
  phase.value = "failed";

  let instrData = null;
  try {
    instrData = out.redeemBody?.instr?.d ? JSON.parse(out.redeemBody.instr.d) : null;
  } catch {}
  const payload = {
    reason: out.widgetError?.code ?? r?.reason ?? (agent?.detected ? "behavior_agent" : "unknown"),
    category: cat,
    blockedBy: failedIds,
    agent: agent?.detected ? agent.name : null,
    referrer: widgetContext?.from ?? (document.referrer || null),
    widgetContext,
    checkMs: Math.round(performance.now() - started),
    widgetError: out.widgetError ?? null,
    verdict: r && { valid: r.valid, reason: r.reason ?? null, riskFlags: r.riskFlags ?? [], checks: r.checks ?? null },
    agentSummary: agent,
    telemetry: await collect(),
    instr: instrData,
    domUnknown: await Promise.race([domDone.then(({ unknown }) => unknown), new Promise((r) => setTimeout(() => r(null), Math.max(0, 4000 - (performance.now() - started))))]),
    extensions: await Promise.race([extensionsDone, new Promise((r) => setTimeout(() => r(null), Math.max(0, 4000 - (performance.now() - started))))]),
  };
  sent.value = payload;
  report.value = { state: "sending", id: null };
  try {
    const res = await fetch(REPORT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    report.value = res.ok && data.id ? { state: "sent", id: data.id } : { state: "failed", id: null };
  } catch {
    report.value = { state: "failed", id: null };
  }
});

onBeforeUnmount(() => {
  for (const fn of cleanups) fn();
});
</script>

<template>
  <main class="ts" :data-phase="phase">
    <div ref="hostEl" class="ts-host" aria-hidden="true"></div>
    <div class="ts-inner">
      <nav class="ts-nav">
        <a v-if="fromUrl" class="ts-back" :href="fromUrl">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19 12H5m6-6-6 6 6 6" /></svg>
          {{ fromHost ? t.backTo.replace("{host}", fromHost) : t.back }}
        </a>
        <button v-else type="button" class="ts-back" @click="goBack">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19 12H5m6-6-6 6 6 6" /></svg>
          {{ t.back }}
        </button>
      </nav>

      <section class="ts-card" :data-kind="kind" role="status" aria-live="polite">
        <span class="ts-gutter" aria-hidden="true">
          <svg v-if="kind === 'checking'" class="ts-spin" viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5" /></svg>
          <svg v-else-if="kind === 'passed'" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" /><path d="m8 12.3 2.7 2.7L16.2 9.5" /></svg>
          <svg v-else-if="kind === 'automation'" viewBox="0 0 24 24">
            <rect x="4.5" y="8" width="15" height="11" rx="3" />
            <path d="M12 8V4.5" />
            <circle cx="12" cy="3.8" r=".8" />
            <path d="M9.5 12.5v1.5m5-1.5v1.5" />
            <path d="M2.5 12.5v2.5m19-2.5v2.5" />
          </svg>
          <svg v-else-if="kind === 'tamper'" viewBox="0 0 24 24">
            <path d="M9 4.5a2 2 0 0 1 4 0V6h3.5a1.5 1.5 0 0 1 1.5 1.5V11h-1.5a2 2 0 0 0 0 4H18v3.5a1.5 1.5 0 0 1-1.5 1.5H13v-1.5a2 2 0 0 0-4 0V20H5.5A1.5 1.5 0 0 1 4 18.5V15h1.5a2 2 0 0 0 0-4H4V7.5A1.5 1.5 0 0 1 5.5 6H9Z" />
          </svg>
          <svg v-else-if="kind === 'site'" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="9" />
            <path d="M3 12h18M12 3c2.5 2.6 3.7 5.6 3.7 9s-1.2 6.4-3.7 9c-2.5-2.6-3.7-5.6-3.7-9S9.5 5.6 12 3Z" />
          </svg>
          <svg v-else-if="kind === 'unfinished'" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" /><path d="M12 7.5V12l3 2" /></svg>
          <svg v-else viewBox="0 0 24 24">
            <rect x="3" y="6" width="18" height="7" rx="1.5" />
            <path d="m7.5 6-4.5 6m10-6-6 7m11.5-7-6 7m9-4-3 4" />
            <path d="M6.5 13v6m11-6v6M4.5 19h4m7 0h4" />
          </svg>
        </span>
        <div class="ts-card-body">
          <h1 class="ts-headline">{{ kind === "checking" ? t.checking : headline }}</h1>
          <p class="ts-instruction">{{ kind === "checking" ? t.checkingBody : instruction }}</p>
          <button v-if="kind !== 'checking' && action" type="button" class="ts-primary" @click="runAction">
            <span class="ts-swap" aria-hidden="true">
              <template v-if="action === 'copy'">
                <svg viewBox="0 0 24 24" :class="{ out: copied }">
                  <path d="M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1 1" />
                  <path d="M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1-1" />
                </svg>
                <svg viewBox="0 0 24 24" :class="{ out: !copied }"><path d="m5.5 12.5 4 4 9-9" /></svg>
              </template>
              <svg v-else viewBox="0 0 24 24"><path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3L19.5 9" /><path d="M19.5 4v5h-5" /></svg>
            </span>
            <span>{{ action === "copy" ? (copied ? t.copied : t.copy) : t.tryAgain }}</span>
          </button>
        </div>
      </section>

      <Transition name="ts-rise">
        <div v-if="phase === 'failed'" class="ts-rest">
          <section class="ts-sec">
            <span class="ts-gutter" aria-hidden="true">
              <svg viewBox="0 0 24 24">
                <circle cx="10.5" cy="10.5" r="7.5" />
                <path d="m16 16 5 5" />
                <path d="M8.6 8.7a2 2 0 1 1 2.7 1.9c-.5.2-.8.6-.8 1.1v.4" />
                <path d="M10.5 14.4h.01" />
              </svg>
            </span>
            <div class="ts-sec-body">
              <h2 class="ts-ask">{{ t.asks[category] }}</h2>
              <p class="ts-ask-body">{{ ["site", "unfinished"].includes(category) ? t.askBodyPlain : t.askBody }}</p>

              <p v-if="report.state === 'failed'" class="ts-quiet">
                {{ t.reportFailed }}
                <a href="https://github.com/tiagozip/cap/issues/new" target="_blank" rel="noopener">{{ t.reportManual }}</a>
              </p>
              <p v-else-if="formState === 'sent'" class="ts-form-done" role="status">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m7 12.5 3.2 3.2L17 9" /></svg>
                {{ t.formSent }}
              </p>
              <form v-else class="ts-form" @submit.prevent="sendDetails">
                <p class="ts-quiet">{{ t.alreadySent }}</p>
                <p v-if="deviceGuess.mode === 'line' && !editingDevice" class="ts-device-line">
                  {{ t.deviceIs.replace("{device}", deviceGuess.label) }}
                  <span aria-hidden="true">·</span>
                  <button type="button" class="ts-link" @click="editDevice">{{ t.change }}</button>
                </p>
                <label v-else class="ts-field">
                  <span>{{ t.fDevice }} <span class="ts-opt">{{ t.optional }}</span></span>
                  <span v-if="deviceGuess.mode === 'confirm'" class="ts-hint">{{ t.iosGuess.replace("{device}", deviceGuess.label) }}</span>
                  <input ref="deviceInput" v-model="form.device" type="text" maxlength="120" :placeholder="t.fDeviceHint" autocomplete="off" />
                </label>
                <label class="ts-field">
                  <span>{{ t.fNetwork }} <span class="ts-opt">{{ t.optional }}</span></span>
                  <span class="ts-select">
                    <select v-model="form.network">
                      <option value="" disabled>{{ t.choose }}</option>
                      <option v-for="(label, key) in t.networks" :key="key" :value="key">{{ label }}</option>
                    </select>
                    <svg viewBox="0 0 16 16" aria-hidden="true"><path d="m4.5 6.5 3.5 3.5 3.5-3.5" /></svg>
                  </span>
                </label>
                <label class="ts-field">
                  <span>{{ t.fNote }} <span class="ts-opt">{{ t.optional }}</span></span>
                  <textarea v-model="form.note" rows="2" maxlength="2000"></textarea>
                </label>
                <label class="ts-field">
                  <span>{{ t.fContact }} <span class="ts-opt">{{ t.optional }}</span></span>
                  <input v-model="form.contact" type="email" maxlength="200" autocomplete="email" inputmode="email" />
                </label>
                <div class="ts-form-foot">
                  <button type="submit" class="ts-primary" :disabled="formState === 'sending'">
                    {{ formState === "sending" ? t.sending : ["site", "unfinished"].includes(category) ? t.sendPlain : t.send }}
                  </button>
                  <p v-if="formState === 'failed'" class="ts-form-error" role="alert">{{ t.formFailed }}</p>
                </div>
                <p class="ts-privacy">{{ t.privacy }}</p>
              </form>
            </div>
          </section>

          <footer class="ts-foot">
            <div class="ts-foot-row">
              <button type="button" class="ts-tech-toggle" :aria-expanded="techOpen" aria-controls="ts-tech" @click="techOpen = !techOpen">
                <svg viewBox="0 0 16 16" aria-hidden="true"><path d="m6 4 4 4-4 4" /></svg>
                {{ t.technical }}
              </button>
              <span v-if="report.id" class="ts-ref">
                {{ t.reportId.replace("{id}", report.id) }}
                <button type="button" class="ts-copy-id" :aria-label="idCopied ? t.copied : t.copyId" @click="copyId">
                  <span class="ts-swap small" aria-hidden="true">
                    <svg viewBox="0 0 24 24" :class="{ out: idCopied }"><rect x="8.5" y="8.5" width="11" height="11" rx="2" /><path d="M15.5 8.5V6a1.5 1.5 0 0 0-1.5-1.5H6A1.5 1.5 0 0 0 4.5 6v8A1.5 1.5 0 0 0 6 15.5h2.5" /></svg>
                    <svg viewBox="0 0 24 24" :class="{ out: !idCopied }"><path d="m5.5 12.5 4 4 9-9" /></svg>
                  </span>
                </button>
              </span>
            </div>
            <div v-show="techOpen" id="ts-tech" class="ts-tech">
              <ul v-if="noticed.length" class="ts-noticed">
                <li v-for="n in noticed" :key="n.id">{{ n.name }}</li>
              </ul>
              <template v-if="extensions?.length">
                <p class="ts-tech-label">{{ t.extensionsFound }}</p>
                <ul class="ts-noticed">
                  <li v-for="e in extensions" :key="e.name">{{ e.name }}</li>
                </ul>
              </template>
              <template v-if="domUnknown.length">
                <p class="ts-tech-label">{{ t.domUnknown }}</p>
                <ul class="ts-noticed">
                  <li v-for="name in domUnknown" :key="name">{{ name }}</li>
                </ul>
              </template>
              <template v-if="sent">
                <p class="ts-tech-label">{{ t.sentLabel }}</p>
                <pre>{{ sentJson }}</pre>
              </template>
            </div>
            <a class="ts-owners" :href="ownersLink">{{ t.owners }}</a>
          </footer>
        </div>
      </Transition>

      <footer v-if="phase === 'passed'" class="ts-foot solo">
        <a class="ts-owners" :href="ownersLink">{{ t.owners }}</a>
      </footer>
    </div>
  </main>
</template>

<style scoped>
:global(html:has(.ts)) {
  color-scheme: light;
  background: #ffffff;
}

.ts {
  --ts-bg: #ffffff;
  --ts-text: #171717;
  --ts-head: #262626;
  --ts-muted: #737373;
  --ts-icon: #555555;
  --ts-ok: #2f8a4c;
  --ts-card: #fafafa;
  --ts-border: #e5e5e5;
  --ts-line: #0000001f;
  --ts-field: #ffffff;
  --ts-accent: #1a73d9;
  --ts-accent-hover: #1666c1;
  --ts-on-accent: #ffffff;
  --ts-focus: #1a73d9;
  --ts-error: #b91c1c;
  --ts-soft: #f4f4f5;
  color-scheme: light;
  min-height: 100dvh;
  display: flex;
  justify-content: center;
  padding: 40px 24px 64px;
  background: var(--ts-bg);
  color: var(--ts-text);
  font: 400 17px/26px system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

.ts-host {
  position: absolute;
  width: 0;
  height: 0;
  overflow: hidden;
}

.ts-inner {
  width: 100%;
  max-width: 680px;
}

.ts-nav {
  margin-bottom: 24px;
  padding-left: 20px;
}

.ts-back {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-left: -8px;
  padding: 8px;
  border: 0;
  border-radius: 8px;
  background: none;
  color: var(--ts-text);
  font: inherit;
  font-size: 16px;
  line-height: 24px;
  text-decoration: none;
  cursor: pointer;
  transition: scale 200ms ease-out;
}

.ts-back svg {
  width: 18px;
  height: 18px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.75;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.ts-back:active {
  scale: 0.97;
}

.ts-card,
.ts-sec {
  display: grid;
  grid-template-columns: 36px minmax(0, 1fr);
  column-gap: 20px;
  align-items: start;
}

.ts-card {
  padding: 28px 32px 32px 20px;
  border: 1px solid var(--ts-border);
  border-radius: 14px;
  background: var(--ts-card);
}

.ts-sec {
  padding: 0 20px;
}

.ts-gutter {
  display: block;
  width: 36px;
  height: 36px;
  margin-top: 1px;
  color: var(--ts-icon);
}

.ts-card[data-kind="passed"] .ts-gutter {
  color: var(--ts-ok);
}

.ts-gutter svg {
  display: block;
  width: 36px;
  height: 36px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.6;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.ts-spin circle {
  stroke-dasharray: 36 100;
}

@media (prefers-reduced-motion: no-preference) {
  .ts-spin {
    animation: ts-spin 900ms linear infinite;
  }

  .ts-rise-enter-active {
    transition:
      opacity 400ms cubic-bezier(0.22, 1, 0.36, 1),
      transform 400ms cubic-bezier(0.22, 1, 0.36, 1);
  }

  .ts-rise-enter-from {
    opacity: 0;
    transform: translateY(8px);
  }
}

@keyframes ts-spin {
  to {
    transform: rotate(360deg);
  }
}

.ts-headline {
  margin: 0;
  font-size: 20px;
  line-height: 28px;
  font-weight: 600;
  letter-spacing: -0.01em;
  color: var(--ts-head);
  text-wrap: pretty;
}

.ts-instruction {
  margin: 6px 0 0;
  font-size: 16px;
  line-height: 24px;
  color: var(--ts-text);
  text-wrap: pretty;
}

.ts-primary {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  height: 44px;
  margin-top: 18px;
  padding: 0 20px 0 15px;
  border: 0;
  border-radius: 10px;
  background: var(--ts-accent);
  color: var(--ts-on-accent);
  font: inherit;
  font-size: 17px;
  font-weight: 500;
  cursor: pointer;
  transition:
    scale 200ms ease-out,
    background-color 150ms ease-out;
}

.ts-primary:active {
  scale: 0.97;
}

.ts-swap {
  display: grid;
  width: 20px;
  height: 20px;
}

.ts-swap svg {
  grid-area: 1 / 1;
  width: 20px;
  height: 20px;
  fill: none;
  stroke: currentColor;
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
  transition:
    opacity 200ms ease-out,
    scale 200ms ease-out,
    filter 200ms ease-out;
}

.ts-swap svg.out {
  opacity: 0;
  scale: 0.25;
  filter: blur(4px);
}

.ts-rest {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 48px;
  margin-top: 48px;
}

.ts-ask {
  margin: 4px 0 0;
  font-size: 22px;
  line-height: 30px;
  font-weight: 400;
  color: var(--ts-head);
  text-wrap: balance;
}

.ts-ask-body {
  margin: 8px 0 0;
  color: var(--ts-text);
  text-wrap: pretty;
}

.ts-quiet {
  margin: 20px 0 0;
  font-size: 15px;
  line-height: 22px;
  color: var(--ts-muted);
}

.ts-quiet a,
.ts-owners {
  color: inherit;
  text-decoration: underline;
  text-underline-offset: 3px;
  text-underline-position: from-font;
  text-decoration-skip-ink: auto;
  border-radius: 4px;
}

.ts-quiet a {
  color: var(--ts-text);
}

.ts-form {
  display: grid;
  gap: 16px;
  margin-top: 24px;
}

.ts-field {
  display: grid;
  gap: 6px;
  min-width: 0;
}

.ts-field > span:first-child {
  font-size: 15px;
  line-height: 22px;
  font-weight: 500;
  color: var(--ts-text);
}

.ts-opt {
  margin-left: 4px;
  font-weight: 400;
  color: var(--ts-muted);
}

.ts-field input,
.ts-field textarea,
.ts-field select {
  width: 100%;
  min-width: 0;
  padding: 9px 12px;
  border: 0;
  border-radius: 10px;
  background: var(--ts-field);
  box-shadow: inset 0 0 0 1px var(--ts-line);
  color: var(--ts-text);
  font: inherit;
  font-size: 16px;
  line-height: 24px;
}

.ts-field textarea {
  resize: vertical;
}

.ts-field input::placeholder {
  color: var(--ts-muted);
}

.ts-select {
  position: relative;
  display: block;
}

.ts-select select {
  appearance: none;
  padding-right: 36px;
  cursor: pointer;
}

.ts-select svg {
  position: absolute;
  right: 12px;
  top: 50%;
  width: 16px;
  height: 16px;
  translate: 0 -50%;
  fill: none;
  stroke: var(--ts-muted);
  stroke-width: 1.5;
  stroke-linecap: round;
  stroke-linejoin: round;
  pointer-events: none;
}

.ts-form-foot {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 4px;
}

.ts-form-foot .ts-primary {
  margin-top: 0;
  padding: 0 20px;
}

.ts-primary:disabled {
  opacity: 0.6;
  cursor: default;
}

.ts-form-error {
  margin: 0;
  color: var(--ts-error);
  font-size: 15px;
}

.ts-form-done {
  display: flex;
  gap: 8px;
  align-items: flex-start;
  margin: 20px 0 0;
}

.ts-form-done svg {
  flex: none;
  width: 20px;
  height: 20px;
  margin-top: 3px;
  fill: none;
  stroke: var(--ts-ok);
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.ts-foot {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 12px;
  justify-items: start;
  margin: 0 20px;
  padding-top: 24px;
  box-shadow: inset 0 1px 0 var(--ts-line);
  font-size: 14px;
  line-height: 20px;
  color: var(--ts-muted);
}

.ts-foot-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px 16px;
}

.ts-tech-toggle {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  margin-left: -4px;
  padding: 4px;
  border: 0;
  border-radius: 6px;
  background: none;
  color: inherit;
  font: inherit;
  cursor: pointer;
}

.ts-tech-toggle svg {
  width: 14px;
  height: 14px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.75;
  stroke-linecap: round;
  stroke-linejoin: round;
  transition: rotate 200ms ease-out;
}

.ts-tech-toggle[aria-expanded="true"] svg {
  rotate: 90deg;
}

.ts-ref {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  font-variant-numeric: tabular-nums;
}

.ts-copy-id {
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  border: 0;
  border-radius: 6px;
  background: none;
  color: inherit;
  cursor: pointer;
  transition: scale 200ms ease-out;
}

.ts-copy-id:active {
  scale: 0.95;
}

.ts-swap.small,
.ts-swap.small svg {
  width: 16px;
  height: 16px;
}

.ts-swap.small svg {
  stroke-width: 1.75;
}

.ts-device-line {
  margin: 0;
  font-size: 15px;
  line-height: 22px;
  color: var(--ts-text);
}

.ts-device-line > span {
  color: var(--ts-muted);
}

.ts-link {
  padding: 0;
  border: 0;
  border-radius: 4px;
  background: none;
  color: var(--ts-accent);
  font: inherit;
  text-decoration: underline;
  text-underline-offset: 3px;
  text-decoration-skip-ink: auto;
  cursor: pointer;
}

.ts-hint {
  font-size: 15px;
  line-height: 22px;
  color: var(--ts-muted);
}

.ts-form .ts-quiet {
  margin: 0;
}

.ts-privacy {
  margin: -6px 0 0;
  font-size: 13px;
  line-height: 18px;
  color: var(--ts-muted);
  text-wrap: pretty;
}

.ts-foot.solo {
  margin-top: 48px;
}

.ts-tech {
  width: 100%;
  min-width: 0;
}

.ts-noticed {
  margin: 8px 0 0;
  padding-left: 20px;
  display: grid;
  gap: 4px;
}

.ts-tech-label {
  margin: 16px 0 0;
}

.ts-tech pre {
  margin: 8px 0 0;
  max-height: 320px;
  overflow: auto;
  padding: 12px;
  border-radius: 10px;
  background: var(--ts-soft);
  font: 12px/18px ui-monospace, "SF Mono", Menlo, Consolas, monospace;
  color: var(--ts-text);
  white-space: pre;
}

.ts-back:focus-visible,
.ts-primary:focus-visible,
.ts-link:focus-visible,
.ts-tech-toggle:focus-visible,
.ts-copy-id:focus-visible,
.ts-field input:focus-visible,
.ts-field textarea:focus-visible,
.ts-field select:focus-visible,
.ts-quiet a:focus-visible,
.ts-owners:focus-visible {
  outline: 2px solid var(--ts-focus);
  outline-offset: 2px;
}

@media (hover: hover) {
  .ts-back:hover {
    text-decoration: underline;
    text-underline-offset: 4px;
  }

  .ts-primary:not(:disabled):hover {
    background: var(--ts-accent-hover);
  }

  .ts-copy-id:hover,
  .ts-tech-toggle:hover,
  .ts-owners:hover {
    color: var(--ts-text);
  }
}

@media (max-width: 560px) {
  .ts {
    padding: 20px 16px 48px;
  }

  .ts-nav {
    padding-left: 0;
    margin-bottom: 16px;
  }

  .ts-card,
  .ts-sec {
    grid-template-columns: minmax(0, 1fr);
  }

  .ts-card {
    padding: 20px 18px 22px;
  }

  .ts-sec {
    padding: 0;
  }

  .ts-foot {
    margin: 0;
  }

  .ts-gutter,
  .ts-gutter svg {
    width: 30px;
    height: 30px;
  }

  .ts-gutter {
    margin: 0 0 12px;
  }

  .ts-ask {
    font-size: 20px;
    line-height: 28px;
  }

  .ts-primary {
    width: 100%;
    justify-content: center;
  }
}
</style>
