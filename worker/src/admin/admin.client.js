// Admin console logic (runs in the browser). Inlined into /admin by
// admin/page.js with a CSP nonce; talks only to this origin's /admin/api/*.
(() => {
  const $ = (id) => document.getElementById(id);
  const origin = location.origin;

  const ERRORS = {
    not_an_admin: "这个 Priestess 账号没有后台权限。",
    app_access_denied: "这个 Priestess 账号没有被授权使用本应用。",
    invalid_state: "登录状态已失效（可能超过了 10 分钟），请重新登录。",
    invalid_login_code: "登录码已失效，请重新登录。",
    missing_login_code: "没有收到登录码，请重新登录。",
    priestess_unreachable: "暂时连不上 Priestess，请稍后再试。",
    network_error: "网络错误，请重新登录。",
  };

  // ── theme ───────────────────────────────────────────────────────────
  $("theme-toggle").addEventListener("click", () => {
    const next =
      document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem("pv-theme", next);
    } catch {}
  });

  // ── helpers ─────────────────────────────────────────────────────────
  let toastTimer = 0;
  function toast(text) {
    const el = $("toast");
    el.textContent = text;
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      el.hidden = true;
    }, 2600);
  }

  async function api(path, { method = "GET", body } = {}) {
    const init = { method, credentials: "same-origin", headers: {} };
    if (method !== "GET") {
      init.headers["Content-Type"] = "application/json";
      init.body = JSON.stringify(body ?? {});
    }
    const res = await fetch(`/admin/api${path}`, init);
    let data = null;
    try {
      data = await res.json();
    } catch {}
    if (res.status === 401) {
      showLogin("登录已过期，请重新登录。");
      throw new Error("unauthenticated");
    }
    if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
    return data;
  }

  function el(tag, props = {}, children = []) {
    const node = document.createElement(tag);
    for (const [key, value] of Object.entries(props)) {
      if (key === "class") node.className = value;
      else if (key === "text") node.textContent = value;
      else if (key.startsWith("data-") || key.startsWith("aria-"))
        node.setAttribute(key, value);
      else node[key] = value;
    }
    for (const child of children) node.append(child);
    return node;
  }

  function button(text, onClick, extraClass = "") {
    const node = el("button", {
      class: `button ${extraClass}`.trim(),
      type: "button",
      text,
      "data-ripple": "",
    });
    node.addEventListener("click", onClick);
    return node;
  }

  // Spelled in two pieces: this file is inlined into a <script> element.
  const SCRIPT_END = "<" + "/script>";

  const SETTING_LABELS = {
    challengeDifficulty: (v) => `难度 ${v}`,
    challengeCount: (v) => `题目 ${v} 道`,
    challengeSize: (v) => `题目长度 ${v}`,
    tokenTtlMs: (v) => `token 有效 ${Math.round(v / 60000)} 分钟`,
    blockAutomatedBrowsers: (v) =>
      v ? "拦截自动化浏览器" : "放行自动化浏览器",
  };

  function describeSettings(settings) {
    return Object.entries(settings)
      .map(([key, value]) => SETTING_LABELS[key]?.(value) ?? `${key}=${value}`)
      .join(" · ");
  }

  function snippets(siteKey) {
    const frontend = [
      "<script>",
      `  window.CAP_CUSTOM_WASM_URL = "${origin}/cap_wasm_bg.wasm";`,
      `  window.CAP_CUSTOM_HASHWX_URL = "${origin}/hashwx.wasm";`,
      `  window.CAP_PAKO_URL = "${origin}/pako_inflate.min.js";`,
      SCRIPT_END,
      `<script src="${origin}/widget.js">${SCRIPT_END}`,
      "",
      `<cap-widget data-cap-api-endpoint="${origin}/${siteKey}/"></cap-widget>`,
    ].join("\n");
    const backend = [
      "// token = the widget's `solve` event detail.token, or the cap-token form field",
      `const res = await fetch("${origin}/${siteKey}/siteverify", {`,
      '  method: "POST",',
      '  headers: { "content-type": "application/json" },',
      "  body: JSON.stringify({ secret: process.env.PRIESTESS_SECRET, response: token }),",
      "});",
      "const { success } = await res.json();",
    ].join("\n");
    return { frontend, backend };
  }

  // ── views ───────────────────────────────────────────────────────────
  function showLogin(message) {
    $("console-view").hidden = true;
    $("logout").hidden = true;
    $("user-name").hidden = true;
    $("login-view").hidden = false;
    const error = $("login-error");
    error.textContent = message || "";
    error.hidden = !message;
  }

  function showConsole(user) {
    $("login-view").hidden = true;
    $("console-view").hidden = false;
    $("logout").hidden = false;
    $("user-name").textContent = user.name;
    $("user-name").hidden = false;
  }

  let sites = [];

  function renderSites() {
    const list = $("site-list");
    list.replaceChildren();
    $("site-empty").hidden = sites.length > 0;
    for (const site of sites) {
      const origins = el(
        "ul",
        { class: "chips", "aria-label": "允许的域名" },
        site.origins.map((o) => el("li", { class: "chip", text: o })),
      );
      const settings = Object.entries(site.settings);
      const card = el(
        "li",
        {
          class: `site-card${site.enabled ? "" : " is-disabled"}`,
          "data-glass": "panel",
        },
        [
          el("div", { class: "site-top" }, [
            el("h2", { class: "site-title", text: site.name }),
            el("code", { class: "site-key", text: site.siteKey }),
            el("span", {
              class: `chip${site.enabled ? "" : " is-muted"}`,
              text: site.enabled ? "启用中" : "已停用",
            }),
          ]),
          origins,
          settings.length
            ? el("p", {
                class: "field-hint",
                text: `自定义设置：${describeSettings(site.settings)}`,
              })
            : "",
          el("div", { class: "site-actions" }, [
            button("接入代码", () => showSecret(site, null)),
            button("编辑", () => openSiteDialog(site)),
            button(site.enabled ? "停用" : "启用", () => toggleSite(site)),
            button("轮换 secret", () => rotateSecret(site)),
            button("删除", () => deleteSite(site), "is-danger"),
          ]),
        ],
      );
      list.append(card);
    }
  }

  async function loadSites() {
    const data = await api("/sites");
    sites = data.sites;
    renderSites();
  }

  // ── dialogs ─────────────────────────────────────────────────────────
  for (const closer of document.querySelectorAll("[data-close]")) {
    closer.addEventListener("click", () => closer.closest("dialog").close());
  }

  for (const copy of document.querySelectorAll("[data-copy]")) {
    copy.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText($(copy.dataset.copy).textContent);
        toast("已复制");
      } catch {
        toast("复制失败，请手动选择");
      }
    });
  }

  function confirmAction(title, text, okLabel) {
    const dialog = $("confirm-dialog");
    $("confirm-title").textContent = title;
    $("confirm-text").textContent = text;
    $("confirm-ok").textContent = okLabel;
    dialog.returnValue = "";
    dialog.showModal();
    return new Promise((resolve) => {
      dialog.addEventListener(
        "close",
        () => resolve(dialog.returnValue === "ok"),
        { once: true },
      );
    });
  }

  function showSecret(site, secret) {
    const { frontend, backend } = snippets(site.siteKey);
    $("secret-section").hidden = !secret;
    $("secret-value").textContent = secret || "";
    $("secret-warning").textContent = secret
      ? "Secret 只显示这一次，关闭后无法再查看，请立刻存进服务器的环境变量（例如 PRIESTESS_SECRET）。丢了只能轮换。"
      : `站点 ${site.name} 的接入代码。Secret 不会再显示，丢了请轮换。`;
    $("snippet-frontend").textContent = frontend;
    $("snippet-backend").textContent = backend;
    $("secret-dialog").showModal();
  }

  let editing = null;

  function openSiteDialog(site) {
    editing = site;
    const form = $("site-form");
    form.reset();
    $("site-form-error").hidden = true;
    $("site-dialog-title").textContent = site ? "编辑站点" : "新建站点";
    if (site) {
      form.elements.name.value = site.name;
      form.elements.origins.value = site.origins.join("\n");
      const s = site.settings;
      form.elements.challengeDifficulty.value = s.challengeDifficulty ?? "";
      form.elements.challengeCount.value = s.challengeCount ?? "";
      form.elements.tokenTtlMinutes.value = s.tokenTtlMs
        ? Math.round(s.tokenTtlMs / 60000)
        : "";
      form.elements.blockAutomatedBrowsers.checked =
        s.blockAutomatedBrowsers === true;
    }
    $("site-dialog").showModal();
  }

  $("site-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const f = form.elements;
    const minutes = f.tokenTtlMinutes.value.trim();
    const body = {
      name: f.name.value,
      origins: f.origins.value.split(/\s+/).filter(Boolean),
      settings: {
        challengeDifficulty: f.challengeDifficulty.value.trim() || null,
        challengeCount: f.challengeCount.value.trim() || null,
        tokenTtlMs: minutes ? Number(minutes) * 60000 : null,
        blockAutomatedBrowsers: f.blockAutomatedBrowsers.checked || null,
      },
    };
    try {
      if (editing) {
        await api(`/sites/${editing.siteKey}`, { method: "PATCH", body });
        $("site-dialog").close();
        toast("已保存，最多 30 秒内生效");
        await loadSites();
      } else {
        const data = await api("/sites", { method: "POST", body });
        $("site-dialog").close();
        await loadSites();
        showSecret(data.site, data.secret);
      }
    } catch (error) {
      if (error.message === "unauthenticated") return;
      const box = $("site-form-error");
      box.textContent = `保存失败：${error.message}`;
      box.hidden = false;
    }
  });

  $("new-site").addEventListener("click", () => openSiteDialog(null));

  async function toggleSite(site) {
    try {
      await api(`/sites/${site.siteKey}`, {
        method: "PATCH",
        body: { enabled: !site.enabled },
      });
      toast(site.enabled ? "已停用" : "已启用");
      await loadSites();
    } catch (error) {
      if (error.message !== "unauthenticated") toast(error.message);
    }
  }

  async function rotateSecret(site) {
    const ok = await confirmAction(
      "轮换 secret",
      `${site.name} 的旧 secret 会立刻失效，接入方的后端要换成新的才能继续校验。`,
      "轮换",
    );
    if (!ok) return;
    try {
      const data = await api(`/sites/${site.siteKey}/rotate`, {
        method: "POST",
      });
      showSecret(site, data.secret);
    } catch (error) {
      if (error.message !== "unauthenticated") toast(error.message);
    }
  }

  async function deleteSite(site) {
    const ok = await confirmAction(
      "删除站点",
      `删除 ${site.name}（${site.siteKey}）后，它的接入代码和 secret 都会失效，无法恢复。`,
      "删除",
    );
    if (!ok) return;
    try {
      await api(`/sites/${site.siteKey}`, { method: "DELETE" });
      toast("已删除");
      await loadSites();
    } catch (error) {
      if (error.message !== "unauthenticated") toast(error.message);
    }
  }

  $("logout").addEventListener("click", async () => {
    try {
      await api("/logout", { method: "POST" });
    } catch {}
    showLogin("已退出。");
  });

  // ── boot ────────────────────────────────────────────────────────────
  (async () => {
    const query = new URLSearchParams(location.search);
    const error = query.get("error");
    if (error) history.replaceState(null, "", location.pathname);
    const res = await fetch("/admin/api/me", { credentials: "same-origin" });
    if (!res.ok) {
      showLogin(error ? ERRORS[error] || `登录失败：${error}` : "");
      return;
    }
    const { user } = await res.json();
    showConsole(user);
    await loadSites();
  })().catch(() => showLogin("加载失败，请刷新重试。"));
})();
