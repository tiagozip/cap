/**
 * Showcase page client. Inlined verbatim into the `/` page by
 * `src/demo-page.js` (wrangler's Text rule for `*.client.js`), so it must stay
 * a plain classic script and must never contain a literal closing script tag.
 *
 * The page is a hash router with two always-mounted views: `#home` lists the
 * variants as glass buttons, `#scene` shows one of them. Entering a scene
 * mounts a fresh `<cap-widget>` (or a programmatic `new Cap()`), and every
 * token it produces is sent to the same-origin `/demo/siteverify` route.
 */
(() => {
  const ENDPOINT = "/demo/";
  // Written in two halves so the inlined page never sees a script tag here.
  const OPEN_SCRIPT = "<" + "script>";
  const CLOSE_SCRIPT = "<" + "/script>";

  const STRINGS = {
    zh: {
      htmlLang: "zh-CN",
      capLang: "zh-cn",
      langToggle: "English",
      langToggleLabel: "Switch to English",
      themeToggleLabel: "切换深色 / 浅色",
      heroEyebrow: "Priestess Verification",
      heroTitle: "七种样子，挑一个进去看看",
      heroLede:
        "自托管、不用识图的工作量证明验证码。点下面任意一个按钮，进去看它在网页里实际的样子——每个版本都会真的解一道题，再把 token 交给服务器核验。",
      gridLabel: "演示版本",
      back: "全部版本",
      stageLabel: "你的网页",
      replay: "重来一次",
      prev: "上一个",
      next: "下一个",
      statusTitle: "验证状态",
      resultSummary: "服务器返回（/demo/siteverify）",
      resultEmpty: "还没有结果",
      codeTitle: "嵌入代码",
      copy: "复制",
      copied: "已复制",
      copyFailed: "复制失败",
      codeNote:
        "本页用 --cap-* 变量把组件配色接到了 Rakko Design，所以会跟着深浅色变化；直接嵌入时是组件默认的浅色样式。",
      snippetComment: "// 把 token 交给你的后端，由后端调用 /siteverify 核验",
      ghostTitle: "这里什么都不会出现",
      ghostNote: "验证正在后台悄悄进行…",
      ghostDoneTitle: "验证成功",
      ghostDoneNote: "整个过程页面上没有出现任何组件。",
      idleClick: "等你点一下组件",
      idleAuto: "组件一出现在屏幕上就会自己开始",
      idleInvisible: "马上在后台开始…",
      progress: (p) => `正在计算 · ${p}%`,
      checking: "拿到 token，正在请服务器核验…",
      ok: "服务器核验通过",
      okSub: (s) => `用时 ${s} 秒 · token 已在服务器端核销`,
      rejected: "服务器没有通过这个 token",
      widgetError: (m) => `组件出错：${m}`,
      network: (m) => `核验请求失败：${m}`,
      tags: {
        auto: "自动",
        click: "需要点击",
        invisible: "隐形",
        mascot: "看板娘",
        bare: "无背景",
      },
      demos: {
        auto: {
          title: "自动验证",
          short: "显示图标，自己转圈，然后变成成功，全程不用点。",
          long: "加上 data-cap-auto，组件一进入视口就开始计算：进度圈自己转完，服务器确认后变成成功。",
        },
        invisible: {
          title: "隐形验证",
          short: "页面上什么都没有，等一会儿自己就成功了。",
          long: "用 JavaScript 的 new Cap() 在后台解题，页面上不渲染任何组件，适合在提交表单前悄悄拿到 token。",
        },
        click: {
          title: "点击验证",
          short: "经典样式：点一下复选框，转完圈就通过。",
          long: "默认的 <cap-widget>：用户点一下才开始计算，完成后把 token 写进表单的隐藏字段。",
        },
        mascot: {
          title: "看板娘 · 点击",
          short: "带看板娘的卡片，点一下，她会跟着状态换表情。",
          long: "data-cap-mascot 把组件变成竖版卡片：上面是看板娘，下面是原来的复选框；检查中、成功、出错各有一张图。",
        },
        "mascot-auto": {
          title: "看板娘 · 自动",
          short: "看板娘卡片加自动验证，出现就开始，不用点。",
          long: "data-cap-mascot 和 data-cap-auto 一起用：卡片一出现就开始验证，看板娘从“检查中”换成“成功”。",
        },
        bare: {
          title: "看板娘 · 无背景",
          short: "卡片没有底色和边框，直接用网页自己的背景；点一下验证。",
          long: "把 --cap-background 和 --cap-border-color 设成 transparent，看板娘就直接站在你的网页上——她身后的点阵就是页面自己的背景。",
        },
        "bare-auto": {
          title: "看板娘 · 无背景 · 自动",
          short: "无背景的看板娘，自己开始验证，不用点。",
          long: "透明底加 data-cap-auto：没有卡片，也不用点，看板娘出现后自己完成验证。",
        },
      },
    },
    en: {
      htmlLang: "en",
      capLang: "en",
      langToggle: "中文",
      langToggleLabel: "切换到中文",
      themeToggleLabel: "Toggle dark mode",
      heroEyebrow: "Priestess Verification",
      heroTitle: "Seven looks, pick one",
      heroLede:
        "A self-hosted proof-of-work CAPTCHA with no image puzzles. Open any variant below to see how it behaves on a real page — each one solves a real challenge and has the server verify the token.",
      gridLabel: "Variants",
      back: "All variants",
      stageLabel: "your page",
      replay: "Replay",
      prev: "Previous",
      next: "Next",
      statusTitle: "Status",
      resultSummary: "Server response (/demo/siteverify)",
      resultEmpty: "No result yet",
      codeTitle: "Embed code",
      copy: "Copy",
      copied: "Copied",
      copyFailed: "Copy failed",
      codeNote:
        "This page themes the widget onto Rakko Design through its --cap-* variables, so it follows light and dark mode; embedded as-is it uses the widget's default light look.",
      snippetComment:
        "// send the token to your backend, which checks it with /siteverify",
      ghostTitle: "Nothing will appear here",
      ghostNote: "Verification is running quietly in the background…",
      ghostDoneTitle: "Verified",
      ghostDoneNote: "No widget was shown at any point.",
      idleClick: "Waiting for you to click the widget",
      idleAuto: "Starts by itself once the widget is on screen",
      idleInvisible: "Starting in the background…",
      progress: (p) => `Solving · ${p}%`,
      checking: "Got a token, asking the server to verify it…",
      ok: "Verified by the server",
      okSub: (s) => `Took ${s}s · the token was consumed server-side`,
      rejected: "The server rejected this token",
      widgetError: (m) => `Widget error: ${m}`,
      network: (m) => `Verification request failed: ${m}`,
      tags: {
        auto: "Automatic",
        click: "Click",
        invisible: "Invisible",
        mascot: "Mascot",
        bare: "No background",
      },
      demos: {
        auto: {
          title: "Automatic",
          short:
            "Shows the widget, spins by itself and turns into a success. No click.",
          long: "With data-cap-auto the widget starts solving as soon as it is in view: the ring fills up on its own and flips to success once the server accepts the solution.",
        },
        invisible: {
          title: "Invisible",
          short:
            "Nothing on the page at all — after a moment it just succeeds.",
          long: "new Cap() solves in the background without rendering anything, which is handy for fetching a token right before a form submits.",
        },
        click: {
          title: "Click to verify",
          short: "The classic: click the checkbox, watch it spin, done.",
          long: "The default <cap-widget>: solving starts on click, and the token lands in a hidden form field once it is done.",
        },
        mascot: {
          title: "Mascot · click",
          short: "The mascot card: click it and she reacts to every state.",
          long: "data-cap-mascot turns the widget into a vertical card: the mascot on top, the usual checkbox row below, with its own art for checking, success and error.",
        },
        "mascot-auto": {
          title: "Mascot · automatic",
          short: "The mascot card in auto mode — it starts on its own.",
          long: "data-cap-mascot together with data-cap-auto: the card starts as soon as it is visible and the mascot switches from checking to success.",
        },
        bare: {
          title: "Mascot · no background",
          short:
            "No card fill or border — it sits on the page's own background. Click to verify.",
          long: "Set --cap-background and --cap-border-color to transparent and the mascot stands right on your page: the dot grid behind her is the page's own background.",
        },
        "bare-auto": {
          title: "Mascot · no background · auto",
          short: "The background-free mascot, verifying by itself.",
          long: "A transparent card plus data-cap-auto: no card and no click — she verifies on her own once she is on screen.",
        },
      },
    },
  };

  /**
   * The variants, in the order they appear on the page. `attrs` are copied
   * onto the `<cap-widget>`; `invisible` uses `new Cap()` instead.
   */
  const DEMOS = [
    { id: "auto", tags: ["auto"], attrs: { "data-cap-auto": "" } },
    { id: "invisible", tags: ["auto", "invisible"], invisible: true },
    { id: "click", tags: ["click"], attrs: {} },
    {
      id: "mascot",
      tags: ["click", "mascot"],
      attrs: { "data-cap-mascot": "" },
    },
    {
      id: "mascot-auto",
      tags: ["auto", "mascot"],
      attrs: { "data-cap-mascot": "", "data-cap-auto": "" },
    },
    {
      id: "bare",
      tags: ["click", "mascot", "bare"],
      attrs: { "data-cap-mascot": "" },
      bare: true,
    },
    {
      id: "bare-auto",
      tags: ["auto", "mascot", "bare"],
      attrs: { "data-cap-mascot": "", "data-cap-auto": "" },
      bare: true,
    },
  ];

  const BARE_STYLE =
    "--cap-background: transparent; --cap-border-color: transparent";
  const BASE_TITLE = "Priestess Verification";

  const ICONS = {
    eyeOff:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 3l18 18"/><path d="M10.6 5.1A10.4 10.4 0 0 1 12 5c5 0 8.5 4.2 9.5 7-0.4 1.1-1.2 2.5-2.4 3.8"/><path d="M6.5 6.6C4.5 8 3.1 10 2.5 12c1 2.8 4.5 7 9.5 7 1.9 0 3.6-0.6 5-1.5"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/></svg>',
    check:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
    cursor:
      '<svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round" aria-hidden="true"><path d="M5 3l14 8.2-6.1 1.3 3.6 6.6-2.6 1.4-3.6-6.6L5.8 18z"/></svg>',
  };

  // ---- small helpers ------------------------------------------------------

  const $ = (id) => document.getElementById(id);

  function storageGet(key) {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  }

  function storageSet(key, value) {
    try {
      window.localStorage.setItem(key, value);
    } catch {
      // Private mode or blocked storage: the preference just isn't kept.
    }
  }

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function pickLang() {
    const saved = storageGet("pv-lang");
    if (saved === "zh" || saved === "en") return saved;
    for (const pref of navigator.languages || [navigator.language || ""]) {
      const code = String(pref || "").toLowerCase();
      if (code.startsWith("zh")) return "zh";
      if (code.startsWith("en")) return "en";
    }
    return "en";
  }

  let lang = pickLang();
  const t = () => STRINGS[lang];

  // ---- theme --------------------------------------------------------------

  const darkQuery = window.matchMedia("(prefers-color-scheme: dark)");

  function currentTheme() {
    const saved = storageGet("pv-theme");
    if (saved === "light" || saved === "dark") return saved;
    return darkQuery.matches ? "dark" : "light";
  }

  function applyTheme() {
    document.documentElement.dataset.theme = currentTheme();
  }

  darkQuery.addEventListener?.("change", applyTheme);
  $("theme-toggle").addEventListener("click", () => {
    storageSet("pv-theme", currentTheme() === "dark" ? "light" : "dark");
    applyTheme();
  });

  // ---- home ---------------------------------------------------------------

  function miniBox(auto) {
    return `<span class="mini-box${auto ? " is-auto" : ""}"></span>`;
  }

  function previewHtml(demo) {
    const auto = demo.tags.includes("auto");
    if (demo.invisible) {
      return `<span class="mini-pill is-ghost">${ICONS.eyeOff}</span>`;
    }
    if (demo.attrs["data-cap-mascot"] !== undefined) {
      const art = auto ? "done" : "checking";
      return (
        `<span class="mini-card${demo.bare ? " is-bare" : ""}">` +
        `<img src="/mascot/${art}.webp" alt="" loading="lazy" decoding="async">` +
        `<span class="mini-row">${miniBox(auto)}<span class="mini-bar"></span></span>` +
        "</span>"
      );
    }
    return (
      `<span class="mini-pill">${miniBox(auto)}<span class="mini-bar"></span>` +
      (auto ? "" : `<span class="mini-cursor">${ICONS.cursor}</span>`) +
      "</span>"
    );
  }

  function tagList(demo, extraClass) {
    const list = el("ul", `tags${extraClass ? ` ${extraClass}` : ""}`);
    for (const tag of demo.tags) list.append(el("li", "tag", t().tags[tag]));
    return list;
  }

  function renderHome() {
    const grid = $("demo-grid");
    grid.replaceChildren();
    DEMOS.forEach((demo, index) => {
      const copy = t().demos[demo.id];
      const item = el("li");
      const card = el("a", "demo-card");
      card.href = `#${demo.id}`;
      card.id = `card-${demo.id}`;
      card.dataset.ripple = "";

      const preview = el("span", "card-preview");
      preview.setAttribute("aria-hidden", "true");
      preview.innerHTML = previewHtml(demo);

      const meta = el("span", "card-meta");
      meta.append(
        el("span", "card-index", String(index + 1).padStart(2, "0")),
        el("span", "card-title", copy.title),
      );

      card.append(
        preview,
        meta,
        el("span", "card-desc", copy.short),
        tagList(demo, "card-tags"),
      );
      item.append(card);
      grid.append(item);
    });
  }

  // ---- scene --------------------------------------------------------------

  const stage = $("stage");
  const slot = $("stage-slot");
  const statusBox = $("status");
  let current = null; // { demo, run }
  let runSeq = 0;
  let status = { state: "idle", text: () => "", sub: () => "" };
  let lastResult = null;
  let homeScroll = 0;

  function setStatus(state, text, sub) {
    status = { state, text, sub: sub || (() => "") };
    paintStatus();
  }

  function paintStatus() {
    statusBox.dataset.state = status.state;
    $("status-text").textContent = status.text();
    $("status-sub").textContent = status.sub();
    $("result").textContent = lastResult
      ? JSON.stringify(lastResult, null, 2)
      : t().resultEmpty;
  }

  function idleStatus(demo) {
    if (demo.invisible) return () => t().idleInvisible;
    return demo.tags.includes("auto")
      ? () => t().idleAuto
      : () => t().idleClick;
  }

  // The same three self-hosting variables this page sets before loading the
  // widget: without them an embedder's visitors fetch the wasm (and, on old
  // browsers, pako) from jsDelivr.
  function selfHostLines(origin) {
    const lines = [];
    for (const name of [
      "CAP_CUSTOM_WASM_URL",
      "CAP_CUSTOM_HASHWX_URL",
      "CAP_PAKO_URL",
    ]) {
      if (typeof window[name] !== "string") continue;
      const url = new URL(window[name], origin).href;
      lines.push(`  window.${name} = ${JSON.stringify(url)};`);
    }
    return lines.length ? [OPEN_SCRIPT, ...lines, CLOSE_SCRIPT] : [];
  }

  function snippet(demo) {
    const origin = window.location.origin;
    const script = [
      ...selfHostLines(origin),
      `${OPEN_SCRIPT.slice(0, -1)} src="${origin}/widget.js">${CLOSE_SCRIPT}`,
    ].join("\n");
    if (demo.invisible) {
      return [
        script,
        OPEN_SCRIPT,
        `  const cap = new Cap({ apiEndpoint: "${origin}/" });`,
        '  cap.addEventListener("solve", (event) => {',
        `    ${t().snippetComment}`,
        "    console.log(event.detail.token);",
        "  });",
        "  cap.solve();",
        CLOSE_SCRIPT,
      ].join("\n");
    }
    const attrs = [`data-cap-api-endpoint="${origin}/"`];
    for (const [name, value] of Object.entries(demo.attrs)) {
      attrs.push(value ? `${name}="${value}"` : name);
    }
    if (demo.bare) attrs.push(`style="${BARE_STYLE}"`);
    return `${script}\n<cap-widget\n  ${attrs.join("\n  ")}\n></cap-widget>`;
  }

  function paintSceneText() {
    if (!current) return;
    const { demo } = current;
    const copy = t().demos[demo.id];
    const index = DEMOS.indexOf(demo);
    $("scene-index").textContent = `No. ${String(index + 1).padStart(2, "0")}`;
    $("scene-title").textContent = copy.title;
    $("scene-desc").textContent = copy.long;
    $("scene-tags").replaceWith(
      Object.assign(tagList(demo), { id: "scene-tags" }),
    );
    $("snippet").textContent = snippet(demo);

    const prev = DEMOS[(index - 1 + DEMOS.length) % DEMOS.length];
    const next = DEMOS[(index + 1) % DEMOS.length];
    $("prev").href = `#${prev.id}`;
    $("prev-label").textContent = `${t().prev} · ${t().demos[prev.id].title}`;
    $("next").href = `#${next.id}`;
    $("next-label").textContent = `${t().next} · ${t().demos[next.id].title}`;

    document.title = `${copy.title} · ${BASE_TITLE}`;
    const ghost = slot.querySelector(".ghost");
    if (ghost) paintGhost(ghost, ghost.classList.contains("is-done"));
  }

  function paintGhost(ghost, done) {
    ghost.classList.toggle("is-done", done);
    ghost.querySelector(".ghost-icon").innerHTML = done
      ? ICONS.check
      : ICONS.eyeOff;
    ghost.querySelector(".ghost-title").textContent = done
      ? t().ghostDoneTitle
      : t().ghostTitle;
    ghost.querySelector(".ghost-note").textContent = done
      ? t().ghostDoneNote
      : t().ghostNote;
  }

  function teardown() {
    if (!current) return;
    current.run.cancelled = true;
    current.run.dispose?.();
    slot.replaceChildren();
  }

  async function verify(token, run) {
    if (run.cancelled) return;
    setStatus("running", () => t().checking);
    const seconds = run.startedAt
      ? ((performance.now() - run.startedAt) / 1000).toFixed(1)
      : null;
    try {
      const res = await fetch("/demo/siteverify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ response: token }),
      });
      const data = await res.json();
      if (run.cancelled) return;
      lastResult = { status: res.status, ...data };
      if (res.ok && data.success) {
        setStatus(
          "ok",
          () => t().ok,
          seconds ? () => t().okSub(seconds) : undefined,
        );
        run.onVerified?.();
      } else {
        setStatus("fail", () => t().rejected);
      }
    } catch (error) {
      if (run.cancelled) return;
      setStatus("fail", () => t().network(error.message));
    }
  }

  function wire(target, run) {
    target.addEventListener("progress", (event) => {
      if (run.cancelled) return;
      const progress = Math.round(event.detail?.progress ?? 0);
      if (progress === 0 || !run.startedAt) run.startedAt = performance.now();
      if (progress < 100) setStatus("running", () => t().progress(progress));
    });
    target.addEventListener("solve", (event) => {
      verify(event.detail.token, run);
    });
    target.addEventListener("error", (event) => {
      if (run.cancelled) return;
      const message = event.detail?.message || "unknown";
      setStatus("fail", () => t().widgetError(message));
    });
  }

  function mount(demo) {
    teardown();
    const run = { id: ++runSeq, cancelled: false, startedAt: 0 };
    current = { demo, run };
    lastResult = null;
    stage.classList.toggle("is-bare", Boolean(demo.bare));
    setStatus("idle", idleStatus(demo));

    if (demo.invisible) {
      const ghost = el("div", "ghost");
      ghost.append(
        el("span", "ghost-icon"),
        el("p", "ghost-title"),
        el("p", "ghost-note"),
      );
      slot.append(ghost);
      paintGhost(ghost, false);

      // Programmatic mode: Cap appends a hidden widget to <html>.
      const cap = new window.Cap({ apiEndpoint: ENDPOINT });
      wire(cap, run);
      run.onVerified = () => paintGhost(ghost, true);
      // Give the empty stage a moment on screen before the work starts.
      const timer = setTimeout(() => {
        if (!run.cancelled) cap.solve();
      }, 900);
      run.dispose = () => {
        clearTimeout(timer);
        cap.widget.remove();
      };
      return;
    }

    const widget = document.createElement("cap-widget");
    widget.setAttribute("data-cap-api-endpoint", ENDPOINT);
    widget.setAttribute("data-cap-lang", t().capLang);
    for (const [name, value] of Object.entries(demo.attrs)) {
      widget.setAttribute(name, value);
    }
    wire(widget, run);
    slot.append(widget);
    run.dispose = () => widget.remove();
  }

  // ---- routing ------------------------------------------------------------

  const home = $("home");
  const scene = $("scene");

  function setView(name) {
    const toScene = name === "scene";
    home.classList.toggle("is-active", !toScene);
    scene.classList.toggle("is-active", toScene);
    home.inert = toScene;
    scene.inert = !toScene;
  }

  function route() {
    const id = decodeURIComponent(window.location.hash.replace(/^#\/?/, ""));
    const demo = DEMOS.find((d) => d.id === id);
    if (demo) {
      if (!current) homeScroll = window.scrollY;
      teardown();
      current = { demo, run: { cancelled: true } };
      setView("scene");
      paintSceneText();
      mount(demo);
      window.scrollTo(0, 0);
      $("scene-title").focus({ preventScroll: true });
      return;
    }

    const leaving = current?.demo;
    teardown();
    current = null;
    setView("home");
    document.title = BASE_TITLE;
    window.scrollTo(0, homeScroll);
    if (leaving) $(`card-${leaving.id}`)?.focus({ preventScroll: true });
  }

  // ---- static text & controls --------------------------------------------

  function paintStatic() {
    const s = t();
    document.documentElement.lang = s.htmlLang;
    for (const node of document.querySelectorAll("[data-i18n]")) {
      node.textContent = s[node.dataset.i18n];
    }
    const langButton = $("lang-toggle");
    langButton.textContent = s.langToggle;
    langButton.setAttribute("aria-label", s.langToggleLabel);
    $("theme-toggle").setAttribute("aria-label", s.themeToggleLabel);
    $("demo-grid").setAttribute("aria-label", s.gridLabel);
  }

  $("lang-toggle").addEventListener("click", () => {
    lang = lang === "zh" ? "en" : "zh";
    storageSet("pv-lang", lang);
    paintStatic();
    renderHome();
    if (current) {
      paintSceneText();
      // The widget reads its language once, on connect: start it again.
      mount(current.demo);
    }
    paintStatus();
  });

  $("replay").addEventListener("click", () => {
    if (current) mount(current.demo);
  });

  let copyTimer = 0;
  $("copy").addEventListener("click", async () => {
    const label = $("copy-label");
    try {
      await navigator.clipboard.writeText($("snippet").textContent);
      label.textContent = t().copied;
    } catch {
      label.textContent = t().copyFailed;
    }
    clearTimeout(copyTimer);
    copyTimer = setTimeout(() => {
      label.textContent = t().copy;
    }, 1600);
  });

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape" || !current || event.defaultPrevented) return;
    window.location.hash = "";
  });

  window.addEventListener("hashchange", route);

  applyTheme();
  paintStatic();
  renderHome();
  route();
})();
