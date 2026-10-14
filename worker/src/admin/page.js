/**
 * The admin console (`GET /admin`) and the Priestess callback page
 * (`GET /admin/callback`).
 *
 * Both pages are served with a per-request CSP nonce (see `admin/index.js`):
 * every inline `<style>` and `<script>` carries it, nothing else inline runs.
 * The console itself is static; `admin.client.js` asks `/admin/api/me`
 * whether a session exists and shows either the sign-in panel or the site
 * list. Styling follows the showcase page: Rakko Design's tokens, glass and
 * state layer from `vendor/rakko-design/`, then `admin.css`.
 */

import glassCss from "../../../vendor/rakko-design/design-system/src/glass.css";
import stateLayerCss from "../../../vendor/rakko-design/design-system/src/state-layer.css";
import tokensCss from "../../../vendor/rakko-design/tokens.generated.css";
import adminScript from "./admin.client.js";
import adminCss from "./admin.css";

function jsonForScript(value) {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

function rawText(source, tag) {
  if (new RegExp(`</${tag}`, "i").test(source)) {
    throw new Error(`admin page: inlined ${tag} contains a closing </${tag}>`);
  }
  return source;
}

const VENDOR_CSS = rawText(
  [tokensCss, glassCss, stateLayerCss].join("\n"),
  "style",
);
const PAGE_CSS = rawText(adminCss, "style");
const APP_SCRIPT = rawText(adminScript, "script");

const THEME_BOOT = `(() => {
        let theme = null;
        try { theme = localStorage.getItem("pv-theme"); } catch {}
        if (theme !== "light" && theme !== "dark") {
          theme = matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
        }
        document.documentElement.dataset.theme = theme;
      })();`;

const ICON_MARK =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3l7 3v5.5c0 4.4-3 8-7 9.5-4-1.5-7-5.1-7-9.5V6z"/><path d="M8.8 12.2l2.2 2.2 4.2-4.4"/></svg>';
const ICON_SUN =
  '<svg class="icon-light" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M4.6 4.6L6 6M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4L6 18M18 6l1.4-1.4"/></svg>';
const ICON_MOON =
  '<svg class="icon-dark" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/></svg>';
const ICON_PLUS =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>';
const ICON_LOGOUT =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3"/><path d="M10 16l-4-4 4-4M6 12h10"/></svg>';

function head(nonce, title) {
  return `<meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="robots" content="noindex" />
    <title>${title}</title>
    <link rel="icon" href="data:," />
    <script nonce="${nonce}">
      ${THEME_BOOT}
    </script>
    <style nonce="${nonce}" data-vendor="rakko-design">
${VENDOR_CSS}
    </style>
    <style nonce="${nonce}" data-page>
${PAGE_CSS}
    </style>`;
}

function topbar(extra = "", themeToggle = true) {
  return `<header class="topbar" data-glass="chrome">
      <div class="topbar-inner">
        <a class="brand" href="/admin">
          <span class="brand-mark">${ICON_MARK}</span>
          <span>Priestess Verification <span class="brand-sub">· 后台</span></span>
        </a>
        ${extra}
        ${themeToggle ? `<button id="theme-toggle" class="icon-button" type="button" data-ripple data-ripple-centered aria-label="切换深色模式">${ICON_SUN}${ICON_MOON}</button>` : ""}
      </div>
    </header>`;
}

export function renderAdminPage({ nonce, ripple }) {
  return `<!DOCTYPE html>
<html lang="zh-CN" data-theme="light">
  <head>
    ${head(nonce, "Priestess Verification 后台")}
  </head>
  <body>
    ${topbar(`<span class="user-name" id="user-name" hidden></span>
        <button id="logout" class="icon-button" type="button" data-ripple hidden>${ICON_LOGOUT}<span>退出</span></button>`)}

    <main class="main">
      <section id="login-view" hidden>
        <div class="login-panel" data-glass="panel">
          <h1>站点后台</h1>
          <p>用 Priestess 账号登录后管理接入站点、域名和密钥。</p>
          <p class="notice" id="login-error" role="alert" hidden></p>
          <a class="button is-primary" href="/admin/login" data-ripple>用 Priestess 登录</a>
        </div>
      </section>

      <section id="console-view" hidden>
        <div class="console-head">
          <div>
            <h1>站点</h1>
            <p>每个站点有自己的 site key、密钥和允许的域名。改动最多 30 秒内生效。</p>
          </div>
          <button id="new-site" class="button is-primary" type="button" data-ripple>${ICON_PLUS}<span>新建站点</span></button>
        </div>
        <ul class="site-list" id="site-list"></ul>
        <p class="empty" id="site-empty" hidden>还没有站点。新建一个，把接入代码放进你的网站。</p>
      </section>
    </main>

    <dialog class="dialog" id="site-dialog" data-glass="panel" aria-labelledby="site-dialog-title">
      <form class="dialog-body" id="site-form" method="dialog">
        <h2 id="site-dialog-title">新建站点</h2>
        <label class="field">
          <span class="field-label">名称</span>
          <input class="input" name="name" maxlength="80" required autocomplete="off" />
        </label>
        <label class="field">
          <span class="field-label">允许的域名</span>
          <textarea class="input" name="origins" required spellcheck="false" placeholder="https://example.com"></textarea>
          <span class="field-hint">一行一个，只写协议和域名（例如 https://blog.rakko.cn），不带路径。本地调试可以写 http://localhost:5173。</span>
        </label>
        <details class="advanced">
          <summary>高级设置（留空则使用全局默认值）</summary>
          <div class="advanced-grid">
            <label class="field">
              <span class="field-label">难度</span>
              <input class="input" name="challengeDifficulty" type="number" min="1" max="16" placeholder="4" />
            </label>
            <label class="field">
              <span class="field-label">题目数量</span>
              <input class="input" name="challengeCount" type="number" min="1" max="1000" placeholder="50" />
            </label>
            <label class="field">
              <span class="field-label">token 有效期（分钟）</span>
              <input class="input" name="tokenTtlMinutes" type="number" min="1" max="1440" placeholder="20" />
            </label>
            <label class="check">
              <input name="blockAutomatedBrowsers" type="checkbox" />
              <span>拦截自动化浏览器</span>
            </label>
          </div>
        </details>
        <p class="notice" id="site-form-error" role="alert" hidden></p>
        <div class="dialog-actions">
          <button class="button" type="button" data-close data-ripple>取消</button>
          <button class="button is-primary" type="submit" data-ripple>保存</button>
        </div>
      </form>
    </dialog>

    <dialog class="dialog" id="secret-dialog" data-glass="panel" aria-labelledby="secret-dialog-title">
      <div class="dialog-body">
        <h2 id="secret-dialog-title">接入信息</h2>
        <p class="secret-warning" id="secret-warning"></p>
        <div id="secret-section">
          <div class="code-head">
            <span class="field-label">Secret（只显示这一次）</span>
            <button class="icon-button" type="button" data-copy="secret-value" data-ripple>复制</button>
          </div>
          <pre class="code-block"><code id="secret-value"></code></pre>
        </div>
        <div>
          <div class="code-head">
            <span class="field-label">前端：放进你的页面</span>
            <button class="icon-button" type="button" data-copy="snippet-frontend" data-ripple>复制</button>
          </div>
          <pre class="code-block"><code id="snippet-frontend"></code></pre>
        </div>
        <div>
          <div class="code-head">
            <span class="field-label">后端：校验 token</span>
            <button class="icon-button" type="button" data-copy="snippet-backend" data-ripple>复制</button>
          </div>
          <pre class="code-block"><code id="snippet-backend"></code></pre>
        </div>
        <div class="dialog-actions">
          <button class="button is-primary" type="button" data-close data-ripple>完成</button>
        </div>
      </div>
    </dialog>

    <dialog class="dialog" id="confirm-dialog" data-glass="panel" aria-labelledby="confirm-title">
      <form class="dialog-body" method="dialog">
        <h2 id="confirm-title"></h2>
        <p id="confirm-text"></p>
        <div class="dialog-actions">
          <button class="button" value="cancel" data-ripple>取消</button>
          <button class="button is-danger" value="ok" id="confirm-ok" data-ripple></button>
        </div>
      </form>
    </dialog>

    <p class="toast" id="toast" role="status" hidden></p>

    <script type="module" nonce="${nonce}">
      import { installRippleFeedback } from ${jsonForScript(ripple)};
      installRippleFeedback(document);
    </script>
    <script nonce="${nonce}">
${APP_SCRIPT}
    </script>
  </body>
</html>
`;
}

/**
 * `/admin/callback`: Priestess puts `login_code` and `state` in the URL
 * fragment. This page takes them out of the address bar straight away, posts
 * them to `/admin/api/session` and moves on to the console; on any error it
 * sends the browser to `/admin?error=<code>` instead of starting another
 * login, so a denied user never loops.
 */
const CALLBACK_SCRIPT = `(() => {
        const params = new URLSearchParams(location.hash.slice(1));
        history.replaceState(null, "", location.pathname);
        const done = (error) => {
          location.replace(error ? "/admin?error=" + encodeURIComponent(error) : "/admin");
        };
        const authError = params.get("auth_error");
        if (authError) return done(authError);
        const loginCode = params.get("login_code");
        if (!loginCode) return done("missing_login_code");
        fetch("/admin/api/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ login_code: loginCode, state: params.get("state") || "" }),
          credentials: "same-origin",
        })
          .then((res) => res.json().then((body) => (res.ok ? done(null) : done(body.error || "sign_in_failed"))))
          .catch(() => done("network_error"));
      })();`;

export function renderCallbackPage({ nonce }) {
  return `<!DOCTYPE html>
<html lang="zh-CN" data-theme="light">
  <head>
    ${head(nonce, "正在登录…")}
  </head>
  <body>
    ${topbar("", false)}
    <main class="main">
      <div class="login-panel" data-glass="panel">
        <h1>正在登录…</h1>
        <p>正在和 Priestess 确认身份。</p>
      </div>
    </main>
    <script nonce="${nonce}">
      ${CALLBACK_SCRIPT}
    </script>
  </body>
</html>
`;
}
