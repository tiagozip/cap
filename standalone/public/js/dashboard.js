let keys = [];
let selectedKey;
let chart;
let currentTab = "activity";
let headerSettings = null;
let ratelimitSettings = null;
let corsSettings = null;
let filteringSettings = null;
let hasGeoSource = false;
let demoMode = false;

const keysList = document.getElementById("keysList");
const searchInput = document.getElementById("searchInput");
const welcomeScreen = document.getElementById("welcomeScreen");
const keyDetail = document.getElementById("keyDetail");

const escapeHtml = (s) =>
  String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

function normalizeOrigin(val) {
  val = (val || "").trim();
  if (!val) return "";
  let withScheme = val;
  if (!/^https?:\/\//i.test(val)) {
    const isLocal = /^(localhost|127\.\d+\.\d+\.\d+|\[::1\]|0\.0\.0\.0)(:|\/|$)/i.test(val);
    withScheme = (isLocal ? "http://" : "https://") + val;
  }
  try {
    return new URL(withScheme).origin;
  } catch {
    return "";
  }
}

const api = async (method, path, body) => {
  try {
    const auth = JSON.parse(localStorage.getItem("cap_auth"));
    if (!auth && !demoMode) throw new Error("Not authenticated");
    const opts = { method, headers: {} };
    if (auth) {
      opts.headers.Authorization = `Bearer ${btoa(JSON.stringify({ token: auth.token, hash: auth.hash }))}`;
    }
    if (body) {
      opts.headers["Content-Type"] = "application/json";
      opts.body = JSON.stringify(body);
    }
    return await (await fetch(`/server${path}`, opts)).json();
  } catch (e) {
    console.error("standalone:", e);
    return { error: e.message };
  }
};

const formatCompact = (n) => {
  if (n >= 1e6) return (n / 1e6).toFixed(n >= 10e6 ? 0 : 1).replace(/\.0$/, "") + "M";
  if (n >= 1e3) return Math.round(n / 1e3) + "k";
  return String(n);
};

const formatRelative = (date) => {
  const diff = new Date(date) - Date.now();
  const past = diff < 0;
  const d = Math.abs(diff);
  const ms = {
    year: 365 * 24 * 60 * 60 * 1000,
    month: 30 * 24 * 60 * 60 * 1000,
    week: 7 * 24 * 60 * 60 * 1000,
    day: 24 * 60 * 60 * 1000,
    hour: 60 * 60 * 1000,
    minute: 60 * 1000,
  };
  for (const [u, v] of Object.entries(ms)) {
    if (d >= v) {
      const val = Math.floor(d / v);
      return past ? `${val} ${u}${val > 1 ? "s" : ""} ago` : `in ${val} ${u}${val > 1 ? "s" : ""}`;
    }
  }
  return past ? "just now" : "in a moment";
};

const formatDate = (ts) => {
  if (!ts) return "\u2014";
  return new Date(ts).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
};

const formatLatency = (ms) => {
  if (ms === 0) return "\u2014";
  return `${Math.max(ms / 1000, 0.1)
    .toFixed(1)
    .replace(/\.0$/, "")}s`;
};

const trendHtml = (current, previous) => {
  if (previous === null || previous === undefined) return "";
  if (previous === 0 && current === 0) return "";
  let pct;
  if (previous === 0) pct = 100;
  else pct = Math.round(((current - previous) / previous) * 100);
  const dir = pct > 0 ? "up" : pct < 0 ? "down" : "neutral";
  const svg = dir === "up"
    ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17L17 7M17 7H7M17 7v10"/></svg>'
    : dir === "down"
      ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M7 7L17 17M17 17H7M17 17V7"/></svg>'
      : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/></svg>';
  return `<span class="stat-trend ${dir}">${svg} ${Math.abs(pct)}%</span>`;
};

const getDateRange = (chartData) => {
  if (!chartData?.data?.length) return "";
  const first = new Date(chartData.data[0].bucket * 1000);
  const last = new Date(chartData.data[chartData.data.length - 1].bucket * 1000);
  const fmt = (d) =>
    d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  return `${fmt(first)} <span>\u2014</span> ${fmt(last)}`;
};

async function init() {
  try {
    const aboutRes = await fetch("/server/about");
    const aboutData = await aboutRes.json();
    if (aboutData.demo) demoMode = true;
  } catch {}

  if (!demoMode && !localStorage.getItem("cap_auth")) {
    document.cookie = "cap_authed=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
    return;
  }

  if (demoMode) hasGeoSource = true;

  api("GET", "/settings/headers").then((res) => {
    headerSettings = res?.error ? null : res;
    hasGeoSource = !!(
      headerSettings?.countryHeader ||
      (ipdbStatus?.mode && ipdbStatus.mode !== "")
    );
  });

  api("GET", "/settings/ratelimit").then((res) => {
    ratelimitSettings = res?.error ? null : res;
  });

  api("GET", "/settings/cors").then((res) => {
    corsSettings = res?.error ? null : res;
  });

  api("GET", "/settings/filtering").then((res) => {
    filteringSettings = res?.error ? null : res;
  });

  api("GET", "/settings/ipdb").then((res) => {
    ipdbStatus = res;
    hasGeoSource = !!(
      headerSettings?.countryHeader ||
      (ipdbStatus?.mode && ipdbStatus.mode !== "")
    );
  });

  loadKeys();
}

async function loadKeys() {
  keys = await api("GET", "/keys");
  if (keys.error?.includes?.("Unauthorized")) {
    localStorage.removeItem("cap_auth");
    document.cookie = "cap_authed=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
    location.reload();
    return;
  }
  if (keys?.error) {
    keysList.innerHTML = '<div class="keys-empty"><p>Error loading keys</p></div>';
    return;
  }
  renderKeysList();
}

function renderKeysList(filter = "") {
  const filtered = keys.filter((k) => k.name.toLowerCase().includes(filter.toLowerCase()));
  if (filtered.length === 0) {
    keysList.innerHTML = `
      <div class="keys-empty">
        <p>${filter ? "No matching keys" : "No keys yet!"}</p>
      </div>`;
    return;
  }
  keysList.innerHTML = filtered
    .map(
      (key) => `
    <div class="key-item ${selectedKey?.siteKey === key.siteKey ? "active" : ""}" data-key="${key.siteKey}">
      <div class="key-item-name">${escapeHtml(key.name)}</div>
      <div class="key-item-stats ${key.difference?.direction === "up" ? "trend-up" : key.difference?.direction === "down" ? "trend-down" : "trend-neutral"}">
        ${
          key.difference?.direction === "down"
            ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M7 7L17 17M17 17H7M17 17V7"/></svg>'
            : key.difference?.direction === "up"
              ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17L17 7M17 7H7M17 7v10"/></svg>'
              : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/></svg>'
        }
        ${formatCompact(key.solvesLast24h || 0)} recent solves
      </div>
    </div>`,
    )
    .join("");

  keysList.querySelectorAll(".key-item").forEach((el) => {
    el.addEventListener("click", () => {
      keysList.querySelectorAll(".key-item").forEach((e) => e.classList.remove("active"));
      el.classList.add("active");
      selectKey(el.dataset.key);
    });
  });
}

const spinnerSvg =
  '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="icon icon-tabler icons-tabler-outline icon-tabler-loader-2"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M12 3a9 9 0 1 0 9 9" /></svg>';

async function selectKey(siteKey) {
  welcomeScreen.style.display = "none";
  keyDetail.style.display = "flex";

  if (keyDetail.children.length === 0) {
    keyDetail.innerHTML = '<div class="key-detail-loading">' + spinnerSvg + "</div>";
  } else {
    keyDetail.querySelectorAll(".stat-value").forEach((el) => el.classList.add("shimmer-text"));
    keyDetail.querySelectorAll(".stat-label").forEach((el) => el.classList.add("shimmer-text"));
    const cl = document.getElementById("chartLoading");
    if (cl) cl.classList.add("visible");
    ["locationBody", "networksBody", "platformBody", "osBody"].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.innerHTML = '<div class="insight-loading">' + spinnerSvg + "</div>";
    });
  }

  const data = await api("GET", `/keys/${siteKey}`);
  if (data.error) {
    showModal(
      "Error",
      `<div class="modal-body"><p>Failed to load key: ${escapeHtml(data.error)}</p></div>`,
    );
    return;
  }
  selectedKey = data.key;
  selectedKey.stats = data.stats;
  selectedKey.prevStats = data.prevStats;
  selectedKey.chartData = data.chartData;
  currentTab = "activity";
  renderKeyDetail();
  keysList.querySelectorAll(".key-item").forEach((el) => {
    el.classList.toggle("active", el.dataset.key === siteKey);
  });
}

const HL_KEYWORDS = new Set([
  "const", "let", "var", "import", "export", "from", "await", "new", "return",
  "async", "function", "if", "else", "for", "while", "try", "catch", "throw",
  "true", "false", "null", "undefined", "void", "typeof", "in", "of",
]);
const HL_BUILTINS = new Set(["fetch", "JSON", "console", "document", "window", "Math", "Promise"]);

function highlight(text) {
  const esc = text.replace(/[&<>]/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[m]);
  const re = new RegExp(
    [
      "(&lt;!--[\\s\\S]*?--&gt;)",
      "(\\/\\/[^\\n]*)",
      "(#[^\\n]*)",
      "(\"[^\"\\n]*\"|'[^'\\n]*'|`[^`]*`)",
      "(&lt;\\/?[a-zA-Z][\\w-]*)",
      "([a-zA-Z][\\w-]*)(?==)",
      "\\b([A-Za-z_$][\\w$]*)\\b",
      "\\b(\\d+(?:\\.\\d+)?)\\b",
    ].join("|"),
    "g",
  );
  return esc.replace(re, (m, htmlC, slashC, hashC, str, tag, attr, word, num) => {
    if (htmlC) return `<span class="c">${htmlC}</span>`;
    if (slashC) return `<span class="c">${slashC}</span>`;
    if (hashC) return `<span class="c">${hashC}</span>`;
    if (str) return `<span class="s">${str}</span>`;
    if (tag) return `<span class="t">${tag}</span>`;
    if (attr) return `<span class="a">${attr}</span>`;
    if (word) {
      if (HL_KEYWORDS.has(word)) return `<span class="k">${word}</span>`;
      if (HL_BUILTINS.has(word)) return `<span class="p">${word}</span>`;
      return word;
    }
    if (num) return `<span class="n">${num}</span>`;
    return m;
  });
}

function renderIntegrationTab(key) {
  const sk = key.siteKey;
  const origin = location.origin;
  const endpoint = `${origin}/${sk}/`;
  const widget = `<scr` + `ipt src="https://cdn.jsdelivr.net/npm/@cap.js/widget"></scr` + `ipt>
<!-- pin a version in production, e.g. @cap.js/widget@3 -->

<cap-widget data-cap-api-endpoint="${endpoint}"></cap-widget>`;
  const nodeSnippet = `const res = await fetch("${origin}/siteverify", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ secret: process.env.CAP_SECRET, response: token }),
});
const { success } = await res.json();`;
  return `
    <div class="integration-layout">
      <h3 class="config-section-title">Frontend</h3>
      <p class="integration-hint">Check our <a href="https://capjs.js.org/guide/widget.html#usage" style="color:var(--blue)" target="_blank">documentation</a> for more frameworks and details.</p>
      <div class="code-block" data-raw="${escapeHtml(widget)}">
        <button class="code-copy">Copy</button>
        <pre><code class="hl">${highlight(widget)}</code></pre>
      </div>

      <h3 class="config-section-title" style="margin-top: 24px;">Server verification</h3>
      <div class="code-block" data-raw="${escapeHtml(nodeSnippet)}" style="margin-top: 12px;">
        <button class="code-copy">Copy</button>
        <pre><code class="hl">${highlight(nodeSnippet)}</code></pre>
      </div>
    </div>
  `;
}

function wireIntegrationCopy(root) {
  root.querySelectorAll(".code-copy").forEach((btn) => {
    btn.addEventListener("click", () => {
      const block = btn.closest(".code-block");
      const text = block.dataset.raw || block.querySelector("pre")?.textContent || "";
      navigator.clipboard.writeText(text).then(() => {
        const prev = btn.textContent;
        btn.textContent = "Copied";
        setTimeout(() => (btn.textContent = prev), 1200);
      });
    });
  });
}

function renderKeyDetail() {
  welcomeScreen.style.display = "none";
  keyDetail.style.display = "flex";
  const key = selectedKey;
  const s = key.stats;

  keyDetail.innerHTML = `
    <div class="detail-header">
      <div class="detail-tabs">
        <div class="detail-tabs-indicator"></div>
        <button class="detail-tab ${currentTab === "activity" ? "active" : ""}" data-tab="activity">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
          Activity
        </button>
        <button class="detail-tab ${currentTab === "integration" ? "active" : ""}" data-tab="integration">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>
          Integration
        </button>
        <button class="detail-tab ${currentTab === "configuration" ? "active" : ""}" data-tab="configuration">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37 1 .608 2.296.07 2.572-1.065"/><circle cx="12" cy="12" r="3"/></svg>
          Configuration
        </button>
      </div>
      <button class="copy-site-key-btn" id="copyKeyBtn">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
        Copy site key
      </button>
    </div>

    <div class="tab-content ${currentTab === "activity" ? "active" : ""}" id="activityTab">
      <div class="activity-layout">
        <div class="activity-main">
          <div class="filters-row">
            <select class="time-select" id="timeSelect">
              <option value="today" ${key.chartData?.duration === "today" ? "selected" : ""}>Today</option>
              <option value="yesterday" ${key.chartData?.duration === "yesterday" ? "selected" : ""}>Yesterday</option>
              <option value="last7days" ${key.chartData?.duration === "last7days" ? "selected" : ""}>Last 7 days</option>
              <option value="last28days" ${key.chartData?.duration === "last28days" ? "selected" : ""}>Last 30 days</option>
              <option value="last91days" ${key.chartData?.duration === "last91days" ? "selected" : ""}>Last 3 months</option>
              <option value="alltime" ${key.chartData?.duration === "alltime" ? "selected" : ""}>All time</option>
            </select>
            <span class="date-range" id="dateRange">${getDateRange(key.chartData)}</span>
            <button class="refresh-btn" id="refreshBtn">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0118.8-4.3M22 12.5a10 10 0 01-18.8 4.2"/></svg>
            </button>
          </div>

          <div class="stats-row">
            <div class="stat-item">
              <div class="stat-bar blue"></div>
              <div class="stat-label">Challenges</div>
              <div class="stat-value" id="statChallenges">${formatCompact(s.challenges || 0)}</div>
              <div id="trendChallenges">${trendHtml(s.challenges, key.prevStats?.challenges)}</div>
            </div>
            <div class="stat-item">
              <div class="stat-bar green"></div>
              <div class="stat-label">Verified</div>
              <div class="stat-value" id="statVerified">${formatCompact(s.verified || 0)}</div>
              <div id="trendVerified">${trendHtml(s.verified, key.prevStats?.verified)}</div>
            </div>
            <div class="stat-item">
              <div class="stat-bar red"></div>
              <div class="stat-label">Failed</div>
              <div class="stat-value" id="statFailed">${formatCompact(s.failed || 0)}</div>
              <div id="trendFailed">${trendHtml(s.failed, key.prevStats?.failed)}</div>
            </div>
            <div class="stat-item">
              <div class="stat-bar purple"></div>
              <div class="stat-label">Avg. duration</div>
              <div class="stat-value" id="statLatency">${formatLatency(s.avgLatency || 0)}</div>
            </div>
          </div>

          <div class="chart-container">
            <canvas id="chart"></canvas>
            <div class="chart-loading" id="chartLoading">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="icon icon-tabler icons-tabler-outline icon-tabler-loader-2"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M12 3a9 9 0 1 0 9 9" /></svg>
            </div>
          </div>

          <div class="insights-grid" id="insightsGrid">
            <div class="insight-panel" id="locationPanel">
              <div class="insight-panel-header">
                <h3 class="insight-panel-title">Location</h3>
                <div class="insight-view-toggle" id="locationViewToggle">
                  <button class="insight-toggle-btn ${!locationMapMode ? "active" : ""}" data-view="list" title="List view">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/></svg>
                  </button>
                  <button class="insight-toggle-btn ${locationMapMode ? "active" : ""}" data-view="map" title="Map view">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
                  </button>
                </div>
              </div>
              <div class="insight-panel-body" id="locationBody">
                <div class="insight-loading"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="icon icon-tabler icons-tabler-outline icon-tabler-loader-2"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M12 3a9 9 0 1 0 9 9" /></svg></div>
              </div>
            </div>
            <div class="insight-panel" id="networksPanel">
              <div class="insight-panel-header">
                <h3 class="insight-panel-title">Networks</h3>
                <button class="insight-search-btn" id="networksSearchBtn" title="Search networks">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
                </button>
              </div>
              <div class="insight-search-bar" id="networksSearchBar" style="display:none">
                <input type="text" id="networksSearchInput" placeholder="Filter networks\u2026">
              </div>
              <div class="insight-panel-body" id="networksBody">
                <div class="insight-loading"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="icon icon-tabler icons-tabler-outline icon-tabler-loader-2"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M12 3a9 9 0 1 0 9 9" /></svg></div>
              </div>
            </div>
            <div class="insight-panel" id="platformPanel">
              <div class="insight-panel-header">
                <h3 class="insight-panel-title">Platform</h3>
              </div>
              <div class="insight-panel-body" id="platformBody">
                <div class="insight-loading">${spinnerSvg}</div>
              </div>
            </div>
            <div class="insight-panel" id="osPanel">
              <div class="insight-panel-header">
                <h3 class="insight-panel-title">OS</h3>
              </div>
              <div class="insight-panel-body" id="osBody">
                <div class="insight-loading">${spinnerSvg}</div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>

    <div class="tab-content ${currentTab === "integration" ? "active" : ""}" id="integrationTab">
      ${renderIntegrationTab(key)}
    </div>

    <div class="tab-content ${currentTab === "configuration" ? "active" : ""}" id="configurationTab">
      <div class="config-panel">
        <h3 class="config-section-title">Main</h3>
        <div class="config-card">
          <div class="edit-field">
            <label>Name</label>
            <input type="text" id="cfgName" value="${escapeHtml(key.name)}">
          </div>
          <div class="edit-row">
            <div class="edit-field">
              <label>Difficulty</label>
              <input type="number" id="cfgDifficulty" value="${key.config.difficulty}" min="1" max="8">
            </div>
            <div class="edit-field">
              <label>Challenge count</label>
              <input type="number" id="cfgChallengeCount" value="${key.config.challengeCount}" min="1" max="500">
            </div>
          </div>
          <h3 class="config-section-title" style="margin-top:16px">Instrumentation</h3>
          <div class="switch-field">
            <label class="switch">
              <input type="checkbox" id="cfgInstrumentation" ${key.config.instrumentation ? "checked" : ""}>
              <span class="switch-track"></span>
            </label>
            <label for="cfgInstrumentation" class="switch-label">Enable instrumentation challenges</label>
          </div>
          <div class="switch-field" id="blockAutomatedBrowsersField" style="display:${key.config.instrumentation ? "flex" : "none"}">
            <label class="switch">
              <input type="checkbox" id="cfgBlockAutomatedBrowsers" ${key.config.blockAutomatedBrowsers ? "checked" : ""}>
              <span class="switch-track"></span>
            </label>
            <label for="cfgBlockAutomatedBrowsers" class="switch-label">
              Attempt to block headless browsers
              <span class="hint">This may cause issues with testing or agent browsers and is not entirely foolproof.</span>
            </label>
          </div>
          <div class="config-row" id="obfuscationLevelField" style="display:${key.config.instrumentation ? "flex" : "none"}">
            <div class="range-field" style="flex:1">
              <label>Obfuscation level <span class="range-value" id="obfuscationLevelHint">${key.config.obfuscationLevel ?? 5}</span></label>
              <span class="range-hint">Higher obfuscation may result in higher CPU usage.</span>
              <input type="range" id="cfgObfuscationLevel" min="1" max="10" value="${key.config.obfuscationLevel ?? 5}">
            </div>
          </div>
          <div class="config-save-row">
            <button class="save-btn" id="saveMainConfigBtn" disabled>Save</button>
          </div>
        </div>

        <h3 class="config-section-title">Security</h3>
        <div class="config-card">
          <h4 class="config-subsection-title">Rate limiting</h4>
          <p class="headers-description" style="margin:-4px 0 8px">Override the global rate limit for this key. Leave empty to use the global defaults${ratelimitSettings ? ` (${ratelimitSettings.max} reqs / ${ratelimitSettings.duration / 1000}s)` : ""}.</p>
          <div class="edit-row">
            <div class="edit-field">
              <label>Max requests</label>
              <input type="number" id="cfgRatelimitMax" value="${key.config.ratelimitMax ?? ""}" min="1" max="10000" placeholder="${ratelimitSettings?.max ?? 30}">
            </div>
            <div class="edit-field">
              <label>Window (ms)</label>
              <input type="number" id="cfgRatelimitDuration" value="${key.config.ratelimitDuration ?? ""}" min="1000" max="3600000" step="1000" placeholder="${ratelimitSettings?.duration ?? 5000}">
            </div>
          </div>

          <hr class="settings-divider">

          <h4 class="config-subsection-title">CORS</h4>
          <div class="switch-field">
            <label class="switch">
              <input type="checkbox" id="cfgCorsEnabled" ${key.config.corsOrigins?.length ? "checked" : ""}>
              <span class="switch-track"></span>
            </label>
            <label for="cfgCorsEnabled" class="switch-label">Restrict allowed origins</label>
          </div>
          <div id="keyCorsPanel" style="display:${key.config.corsOrigins?.length ? "block" : "none"}">
            <p class="headers-description" style="margin:0 0 8px">Only these origins will be able to request challenges for this key.</p>
            <div id="keyCorsOriginsList" class="origin-list">
              ${(key.config.corsOrigins || []).map((o) => `<div class="origin-entry"><input type="text" class="key-cors-origin-input" value="${escapeHtml(o)}" placeholder="Add an origin\u2026"><button class="origin-remove-btn" title="Remove">&times;</button></div>`).join("")}
            </div>
          </div>

          <hr class="settings-divider">

          <h4 class="config-subsection-title">Request filtering</h4>
          <p class="headers-description" style="margin:-4px 0 8px">Override the global filtering for this key. Leave unchecked to use global defaults.</p>
          <div class="switch-field">
            <label class="switch">
              <input type="checkbox" id="cfgBlockNonBrowserUA" ${key.config.blockNonBrowserUA ? "checked" : ""}>
              <span class="switch-track"></span>
            </label>
            <label for="cfgBlockNonBrowserUA" class="switch-label">
              Block non-browser user agents
              <span class="hint">Blocks requests from bots, scripts, and other non-browser clients (e.g. python-requests, curl).</span>
            </label>
          </div>
          <div class="switch-field">
            <label class="switch">
              <input type="checkbox" id="cfgRequiredHeadersEnabled" ${key.config.requiredHeaders?.length ? "checked" : ""}>
              <span class="switch-track"></span>
            </label>
            <label for="cfgRequiredHeadersEnabled" class="switch-label">
              Require browser headers
              <span class="hint">Block requests missing common browser headers.</span>
            </label>
          </div>
          <div id="keyRequiredHeadersPanel" style="display:${key.config.requiredHeaders?.length ? "block" : "none"}">
            <div class="header-checks">
              ${["accept-encoding", "accept-language", "cache-control", "referer", "sec-ch-ua", "sec-ch-ua-mobile", "sec-ch-ua-platform"].map((h) => `<label class="header-check-label"><input type="checkbox" class="key-required-header-check" value="${h}" ${(key.config.requiredHeaders || []).includes(h) ? "checked" : ""}> <code>${escapeHtml(h)}</code></label>`).join("")}
            </div>
          </div>

          <div class="config-save-row">
            <button class="save-btn" id="saveSecurityConfigBtn" disabled>Save</button>
          </div>
        </div>

        <div class="config-section-header">
          <h3 class="config-section-title">Block rules</h3>
          <button class="add-block-rule-btn" id="addBlockRuleBtn">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>
            Add rule
          </button>
        </div>
        <div class="config-card">
          <div id="blockedIpsList" class="blocked-ips-list">
            <div class="blocked-ips-loading"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="icon icon-tabler icons-tabler-outline icon-tabler-loader-2"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M12 3a9 9 0 1 0 9 9" /></svg></div>
          </div>
        </div>

        <div class="danger-zone">
          <h3 class="config-section-title danger">Danger zone</h3>
          <div class="danger-actions-col">
            <button class="danger-action-btn" id="rotateSecretBtn">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0118.8-4.3M22 12.5a10 10 0 01-18.8 4.2"/></svg>
              Reset site secret
            </button>
            <button class="danger-action-btn red" id="deleteKeyBtn">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
              Delete key
            </button>
          </div>
        </div>

      </div>
    </div>
  `;

  const tabsContainer = keyDetail.querySelector(".detail-tabs");
  const tabIndicator = tabsContainer.querySelector(".detail-tabs-indicator");
  const tabs = tabsContainer.querySelectorAll(".detail-tab");

  function updateTabIndicator(animate = true) {
    const activeTab = tabsContainer.querySelector(".detail-tab.active");
    if (!activeTab || !tabIndicator) return;
    if (!animate) tabIndicator.style.transition = "none";
    tabIndicator.style.width = activeTab.offsetWidth + "px";
    tabIndicator.style.transform = `translateX(${activeTab.offsetLeft - 3}px)`;
    if (!animate)
      requestAnimationFrame(() => {
        tabIndicator.style.transition = "";
      });
  }

  updateTabIndicator(false);

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      currentTab = tab.dataset.tab;
      tabs.forEach((t) => t.classList.toggle("active", t.dataset.tab === currentTab));
      updateTabIndicator();
      keyDetail.querySelectorAll(".tab-content").forEach((c) => {
        if (c.id === currentTab + "Tab") {
          c.classList.add("active");
        } else {
          c.classList.remove("active");
        }
      });
      if (currentTab === "configuration") loadBlockedIps();
      if (currentTab === "integration") {
        const t = document.getElementById("integrationTab");
        if (t) wireIntegrationCopy(t);
      }
    });
  });
  const _intTab = document.getElementById("integrationTab");
  if (_intTab && currentTab === "integration") wireIntegrationCopy(_intTab);

  document.getElementById("copyKeyBtn").addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(key.siteKey);
      const btn = document.getElementById("copyKeyBtn");
      btn.innerHTML =
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg> Copied!';
      setTimeout(() => {
        btn.innerHTML =
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg> Copy site key';
      }, 2000);
    } catch {
      showModal(
        "Site Key",
        `<div class="modal-body"><div class="modal-field"><label>Site Key</label><input type="text" value="${key.siteKey}" readonly onclick="this.select()"></div></div>`,
      );
    }
  });

  document
    .getElementById("timeSelect")
    .addEventListener("change", (e) => loadChartData(e.target.value));

  document.getElementById("refreshBtn").addEventListener("click", () => {
    const sel = document.getElementById("timeSelect");
    if (sel) loadChartData(sel.value);
  });

  renderChart(key.chartData);

  loadGeoStats();

  if (currentTab === "configuration") loadBlockedIps();

  function getKeyCorsEntries() {
    return [...document.querySelectorAll("#keyCorsOriginsList .key-cors-origin-input")]
      .map((i) => normalizeOrigin(i.value))
      .filter(Boolean);
  }

  function corsArraysEqual(a, b) {
    if (!a && !b) return true;
    if (!a || !b) return false;
    if (a.length !== b.length) return false;
    return a.every((v, i) => v === b[i]);
  }

  function getKeyRequiredHeaders() {
    return [
      ...document.querySelectorAll("#keyRequiredHeadersPanel .key-required-header-check:checked"),
    ].map((c) => c.value);
  }

  function checkMainDirty() {
    const name = document.getElementById("cfgName").value.trim();
    const difficulty = parseInt(document.getElementById("cfgDifficulty").value, 10);
    const challengeCount = parseInt(document.getElementById("cfgChallengeCount").value, 10);
    const instrumentation = document.getElementById("cfgInstrumentation").checked;
    const obfuscationLevel = parseInt(document.getElementById("cfgObfuscationLevel").value, 10);
    const blockAutomatedBrowsers = document.getElementById("cfgBlockAutomatedBrowsers").checked;
    const dirty =
      name !== key.name ||
      difficulty !== key.config.difficulty ||
      challengeCount !== key.config.challengeCount ||
      instrumentation !== key.config.instrumentation ||
      obfuscationLevel !== (key.config.obfuscationLevel ?? 5) ||
      blockAutomatedBrowsers !== key.config.blockAutomatedBrowsers;
    document.getElementById("saveMainConfigBtn").disabled = !dirty;
  }

  function checkSecurityDirty() {
    const rlMaxVal = document.getElementById("cfgRatelimitMax").value;
    const rlDurVal = document.getElementById("cfgRatelimitDuration").value;
    const ratelimitMax = rlMaxVal === "" ? null : parseInt(rlMaxVal, 10);
    const ratelimitDuration = rlDurVal === "" ? null : parseInt(rlDurVal, 10);
    const corsEnabled = document.getElementById("cfgCorsEnabled").checked;
    const keyCorsOrigins = corsEnabled ? getKeyCorsEntries() : [];
    const keyCorsOriginsVal = keyCorsOrigins.length ? keyCorsOrigins : null;
    const blockNonBrowserUA = document.getElementById("cfgBlockNonBrowserUA").checked;
    const reqHeadersEnabled = document.getElementById("cfgRequiredHeadersEnabled").checked;
    const requiredHeaders = reqHeadersEnabled ? getKeyRequiredHeaders() : [];
    const requiredHeadersVal = requiredHeaders.length ? requiredHeaders : null;
    const dirty =
      ratelimitMax !== (key.config.ratelimitMax ?? null) ||
      ratelimitDuration !== (key.config.ratelimitDuration ?? null) ||
      !corsArraysEqual(keyCorsOriginsVal, key.config.corsOrigins ?? null) ||
      blockNonBrowserUA !== (key.config.blockNonBrowserUA ?? false) ||
      !corsArraysEqual(requiredHeadersVal, key.config.requiredHeaders ?? null);
    document.getElementById("saveSecurityConfigBtn").disabled = !dirty;
  }

  function checkDirty() {
    checkMainDirty();
    checkSecurityDirty();
  }

  for (const id of ["cfgName", "cfgDifficulty", "cfgChallengeCount"]) {
    document.getElementById(id)?.addEventListener("input", checkMainDirty);
  }
  for (const id of ["cfgRatelimitMax", "cfgRatelimitDuration"]) {
    document.getElementById(id)?.addEventListener("input", checkSecurityDirty);
  }

  function ensureKeyCorsEmptyRow() {
    const entries = [...document.querySelectorAll("#keyCorsOriginsList .origin-entry")];
    const empties = entries.filter((e) => !e.querySelector(".key-cors-origin-input").value.trim());
    if (empties.length === 0) {
      addKeyCorsRow();
      return;
    }
    while (empties.length > 1) {
      empties.pop().remove();
    }
  }

  function addKeyCorsRow(value = "") {
    const div = document.createElement("div");
    div.className = "origin-entry";
    div.innerHTML = `<input type="text" class="key-cors-origin-input" value="${escapeHtml(value)}" placeholder="Add an origin\u2026"><button class="origin-remove-btn" title="Remove">&times;</button>`;
    const input = div.querySelector(".key-cors-origin-input");
    div.querySelector(".origin-remove-btn").addEventListener("click", () => {
      div.remove();
      ensureKeyCorsEmptyRow();
      checkSecurityDirty();
    });
    input.addEventListener("input", () => {
      ensureKeyCorsEmptyRow();
      checkSecurityDirty();
    });
    input.addEventListener("blur", () => {
      const normalized = normalizeOrigin(input.value);
      if (normalized && normalized !== input.value.trim()) input.value = normalized;
    });
    document.getElementById("keyCorsOriginsList").appendChild(div);
    return input;
  }

  document.querySelectorAll("#keyCorsOriginsList .origin-remove-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      btn.parentElement.remove();
      ensureKeyCorsEmptyRow();
      checkSecurityDirty();
    });
  });
  document.querySelectorAll("#keyCorsOriginsList .key-cors-origin-input").forEach((input) => {
    input.addEventListener("input", () => {
      ensureKeyCorsEmptyRow();
      checkSecurityDirty();
    });
    input.addEventListener("blur", () => {
      const normalized = normalizeOrigin(input.value);
      if (normalized && normalized !== input.value.trim()) input.value = normalized;
    });
  });
  ensureKeyCorsEmptyRow();

  document.getElementById("cfgCorsEnabled")?.addEventListener("change", (e) => {
    const panel = document.getElementById("keyCorsPanel");
    panel.style.display = e.target.checked ? "block" : "none";
    if (e.target.checked) ensureKeyCorsEmptyRow();
    checkSecurityDirty();
  });

  document.getElementById("cfgBlockNonBrowserUA")?.addEventListener("change", checkSecurityDirty);
  document.getElementById("cfgRequiredHeadersEnabled")?.addEventListener("change", (e) => {
    document.getElementById("keyRequiredHeadersPanel").style.display = e.target.checked
      ? "block"
      : "none";
    checkSecurityDirty();
  });
  document.querySelectorAll(".key-required-header-check").forEach((cb) => {
    cb.addEventListener("change", checkSecurityDirty);
  });

  document.getElementById("cfgInstrumentation")?.addEventListener("change", (e) => {
    const show = e.target.checked ? "flex" : "none";
    document.getElementById("obfuscationLevelField").style.display = show;
    document.getElementById("blockAutomatedBrowsersField").style.display = show;
    if (!e.target.checked) {
      document.getElementById("cfgBlockAutomatedBrowsers").checked = false;
      const sl = document.getElementById("cfgObfuscationLevel");
      sl.value = 5;
      updateRangeFill(sl);
      document.getElementById("obfuscationLevelHint").textContent = "5";
    } else {
      const sl = document.getElementById("cfgObfuscationLevel");
      if (sl) updateRangeFill(sl);
    }
    checkMainDirty();
  });
  function updateRangeFill(el) {
    const min = +el.min || 0,
      max = +el.max || 10;
    const pct = ((el.value - min) / (max - min)) * 100;
    el.style.background = `linear-gradient(to right, var(--blue) ${pct}%, var(--border) ${pct}%)`;
  }
  const obfSlider = document.getElementById("cfgObfuscationLevel");
  if (obfSlider) {
    updateRangeFill(obfSlider);
    obfSlider.addEventListener("input", (e) => {
      document.getElementById("obfuscationLevelHint").textContent = e.target.value;
      updateRangeFill(e.target);
      checkMainDirty();
    });
  }
  document.getElementById("cfgBlockAutomatedBrowsers")?.addEventListener("change", checkMainDirty);

  document.getElementById("saveMainConfigBtn")?.addEventListener("click", saveMainConfig);
  document.getElementById("saveSecurityConfigBtn")?.addEventListener("click", saveSecurityConfig);
  document.getElementById("rotateSecretBtn")?.addEventListener("click", rotateSecret);
  document.getElementById("deleteKeyBtn")?.addEventListener("click", deleteKey);
  document.getElementById("addBlockRuleBtn")?.addEventListener("click", openAddBlockRuleModal);
}

async function loadChartData(duration) {
  const refreshBtn = document.getElementById("refreshBtn");
  refreshBtn?.classList.add("spinning");
  document.getElementById("chartLoading")?.classList.add("visible");

  const data = await api("GET", `/keys/${selectedKey.siteKey}?chartDuration=${duration}`);

  refreshBtn?.classList.remove("spinning");
  document.getElementById("chartLoading")?.classList.remove("visible");

  if (data.chartData) {
    selectedKey.stats = data.stats;
    selectedKey.prevStats = data.prevStats;
    selectedKey.chartData = data.chartData;
    const s = data.stats;
    const ps = data.prevStats;

    const el = (id) => document.getElementById(id);
    if (el("statChallenges")) el("statChallenges").textContent = formatCompact(s.challenges || 0);
    if (el("statVerified")) el("statVerified").textContent = formatCompact(s.verified || 0);
    if (el("statFailed"))
      el("statFailed").textContent = formatCompact(
        Math.max(0, (s.challenges || 0) - (s.verified || 0)),
      );
    if (el("statLatency")) el("statLatency").textContent = formatLatency(s.avgLatency || 0);
    if (el("trendChallenges")) el("trendChallenges").innerHTML = trendHtml(s.challenges, ps?.challenges);
    if (el("trendVerified")) el("trendVerified").innerHTML = trendHtml(s.verified, ps?.verified);
    if (el("trendFailed")) el("trendFailed").innerHTML = trendHtml(Math.max(0, (s.challenges || 0) - (s.verified || 0)), ps ? Math.max(0, (ps.challenges || 0) - (ps.verified || 0)) : null);
    if (el("dateRange")) el("dateRange").innerHTML = getDateRange(data.chartData);

    renderChart(data.chartData);

    loadGeoStats();
  }
}

function externalTooltipHandler(context) {
  const { chart: c, tooltip } = context;
  let el = document.getElementById("chartjs-tooltip");
  if (!el) {
    el = document.createElement("div");
    el.id = "chartjs-tooltip";
    document.body.appendChild(el);
  }

  if (tooltip.opacity === 0) {
    el.style.opacity = "0";
    return;
  }

  let html = "";
  if (tooltip.title?.length) {
    html += `<div class="tooltip-title">${tooltip.title[0]}</div>`;
  }
  if (tooltip.body) {
    for (const item of tooltip.dataPoints) {
      const color = item.dataset.borderColor;
      html += `<div class="tooltip-row">
        <span class="tooltip-dot" style="background:${color}"></span>
        <span class="tooltip-label">${item.dataset.label}</span>
        <span class="tooltip-value">${item.formattedValue}</span>
      </div>`;
    }
  }
  el.innerHTML = html;
  el.style.opacity = "1";

  const rect = c.canvas.getBoundingClientRect();
  const left = rect.left + window.scrollX + tooltip.caretX;
  const top = rect.top + window.scrollY + tooltip.caretY;
  el.style.left = left + "px";
  el.style.top = top + "px";
  el.style.transform = "translate(-50%, -110%)";
}

function renderChart(chartData) {
  const canvas = document.getElementById("chart");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  if (chart) chart.destroy();

  const { data, duration } = chartData;

  if (!data || data.length === 0) {
    chart = null;
    return;
  }

  const labels = data.map((d) => {
    if (duration === "today" || duration === "yesterday") {
      return new Date(d.bucket * 1000).toLocaleTimeString("en-US", {
        hour: "numeric",
        hour12: true,
      });
    }
    return new Date(d.bucket * 1000).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  });

  const mkDataset = (label, key, color, opts = {}) => ({
    label,
    data: typeof key === "function" ? data.map(key) : data.map((d) => d[key] || 0),
    borderColor: color,
    fill: false,
    borderWidth: 2,
    pointRadius: 0,
    pointHoverRadius: 4,
    pointHoverBackgroundColor: color,
    tension: 0.1,
    ...opts,
  });

  chart = new Chart(ctx, {
    type: "line",
    data: {
      labels,
      datasets: [
        mkDataset("Challenges", "challenges", "#89b4fa"),
        mkDataset("Verified", "verified", "#a6e3a1"),
        mkDataset("Failed", "failed", "#f38ba8"),
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      onResize(c) {
        const w = c.width;
        const max = w < 400 ? 6 : w < 720 ? 10 : 14;
        c.options.scales.x.ticks.maxTicksLimit = max;
      },
      animation: {
        duration: 0,
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: {
            color: "#5a5a63",
            maxTicksLimit: 12,
            font: { size: 11, family: "'IBM Plex Sans', system-ui, sans-serif" },
          },
        },
        y: {
          beginAtZero: true,
          border: { display: false },
          grid: { color: "rgba(255,255,255,.04)" },
          ticks: {
            color: "#5a5a63",
            font: { size: 11, family: "'IBM Plex Sans', system-ui, sans-serif" },
            callback: (v) => {
              if (v === 0) return "0";

              if (v < 10000) {
                return v % 1000 === 0 ? v / 1000 + "k" : v.toLocaleString();
              }
              if (v < 1_000_000) {
                const k = v / 1000;
                return (Number.isInteger(k) ? k : k.toFixed(1).replace(/\.0$/, "")) + "k";
              }
              const m = v / 1_000_000;
              return (Number.isInteger(m) ? m : m.toFixed(1).replace(/\.0$/, "")) + "M";
            },
          },
        },
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          enabled: false,
          mode: "index",
          intersect: false,
          position: "average",
          external: externalTooltipHandler,
        },
      },
    },
  });
}

const countryNames = {
  AD: "Andorra",
  AE: "United Arab Emirates",
  AF: "Afghanistan",
  AG: "Antigua and Barbuda",
  AL: "Albania",
  AM: "Armenia",
  AO: "Angola",
  AR: "Argentina",
  AT: "Austria",
  AU: "Australia",
  AZ: "Azerbaijan",
  BA: "Bosnia and Herzegovina",
  BB: "Barbados",
  BD: "Bangladesh",
  BE: "Belgium",
  BF: "Burkina Faso",
  BG: "Bulgaria",
  BH: "Bahrain",
  BI: "Burundi",
  BJ: "Benin",
  BN: "Brunei",
  BO: "Bolivia",
  BR: "Brazil",
  BS: "Bahamas",
  BT: "Bhutan",
  BW: "Botswana",
  BY: "Belarus",
  BZ: "Belize",
  CA: "Canada",
  CD: "Democratic Republic of the Congo",
  CF: "Central African Republic",
  CG: "Republic of the Congo",
  CH: "Switzerland",
  CI: "Ivory Coast",
  CL: "Chile",
  CM: "Cameroon",
  CN: "China",
  CO: "Colombia",
  CR: "Costa Rica",
  CU: "Cuba",
  CV: "Cape Verde",
  CY: "Cyprus",
  CZ: "Czech Republic",
  DE: "Germany",
  DJ: "Djibouti",
  DK: "Denmark",
  DM: "Dominica",
  DO: "Dominican Republic",
  DZ: "Algeria",
  EC: "Ecuador",
  EE: "Estonia",
  EG: "Egypt",
  ER: "Eritrea",
  ES: "Spain",
  ET: "Ethiopia",
  FI: "Finland",
  FJ: "Fiji",
  FM: "Micronesia",
  FR: "France",
  GA: "Gabon",
  GB: "United Kingdom",
  GD: "Grenada",
  GE: "Georgia",
  GH: "Ghana",
  GM: "Gambia",
  GN: "Guinea",
  GQ: "Equatorial Guinea",
  GR: "Greece",
  GT: "Guatemala",
  GW: "Guinea-Bissau",
  GY: "Guyana",
  HK: "Hong Kong",
  HN: "Honduras",
  HR: "Croatia",
  HT: "Haiti",
  HU: "Hungary",
  ID: "Indonesia",
  IE: "Ireland",
  IL: "Israel",
  IN: "India",
  IQ: "Iraq",
  IR: "Iran",
  IS: "Iceland",
  IT: "Italy",
  JM: "Jamaica",
  JO: "Jordan",
  JP: "Japan",
  KE: "Kenya",
  KG: "Kyrgyzstan",
  KH: "Cambodia",
  KI: "Kiribati",
  KM: "Comoros",
  KN: "Saint Kitts and Nevis",
  KP: "North Korea",
  KR: "South Korea",
  KW: "Kuwait",
  KZ: "Kazakhstan",
  LA: "Laos",
  LB: "Lebanon",
  LC: "Saint Lucia",
  LI: "Liechtenstein",
  LK: "Sri Lanka",
  LR: "Liberia",
  LS: "Lesotho",
  LT: "Lithuania",
  LU: "Luxembourg",
  LV: "Latvia",
  LY: "Libya",
  MA: "Morocco",
  MC: "Monaco",
  MD: "Moldova",
  ME: "Montenegro",
  MG: "Madagascar",
  MH: "Marshall Islands",
  MK: "North Macedonia",
  ML: "Mali",
  MM: "Myanmar",
  MN: "Mongolia",
  MO: "Macau",
  MR: "Mauritania",
  MT: "Malta",
  MU: "Mauritius",
  MV: "Maldives",
  MW: "Malawi",
  MX: "Mexico",
  MY: "Malaysia",
  MZ: "Mozambique",
  NA: "Namibia",
  NE: "Niger",
  NG: "Nigeria",
  NI: "Nicaragua",
  NL: "Netherlands",
  NO: "Norway",
  NP: "Nepal",
  NR: "Nauru",
  NZ: "New Zealand",
  OM: "Oman",
  PA: "Panama",
  PE: "Peru",
  PG: "Papua New Guinea",
  PH: "Philippines",
  PK: "Pakistan",
  PL: "Poland",
  PR: "Puerto Rico",
  PS: "Palestine",
  PT: "Portugal",
  PW: "Palau",
  PY: "Paraguay",
  QA: "Qatar",
  RO: "Romania",
  RS: "Serbia",
  RU: "Russia",
  RW: "Rwanda",
  SA: "Saudi Arabia",
  SB: "Solomon Islands",
  SC: "Seychelles",
  SD: "Sudan",
  SE: "Sweden",
  SG: "Singapore",
  SI: "Slovenia",
  SK: "Slovakia",
  SL: "Sierra Leone",
  SM: "San Marino",
  SN: "Senegal",
  SO: "Somalia",
  SR: "Suriname",
  SS: "South Sudan",
  ST: "São Tomé and Príncipe",
  SV: "El Salvador",
  SY: "Syria",
  SZ: "Eswatini",
  TD: "Chad",
  TG: "Togo",
  TH: "Thailand",
  TJ: "Tajikistan",
  TL: "East Timor",
  TM: "Turkmenistan",
  TN: "Tunisia",
  TO: "Tonga",
  TR: "Turkey",
  TT: "Trinidad and Tobago",
  TV: "Tuvalu",
  TW: "Taiwan",
  TZ: "Tanzania",
  UA: "Ukraine",
  UG: "Uganda",
  US: "United States",
  UY: "Uruguay",
  UZ: "Uzbekistan",
  VA: "Vatican City",
  VC: "Saint Vincent and the Grenadines",
  VE: "Venezuela",
  VN: "Vietnam",
  VU: "Vanuatu",
  WS: "Samoa",
  XK: "Kosovo",
  YE: "Yemen",
  ZA: "South Africa",
  ZM: "Zambia",
  ZW: "Zimbabwe",
};

const countryFlags = (code) => {
  if (!code || code.length !== 2) return "";
  return `<img src="/public/assets/flags/${code.toLowerCase()}.svg" alt="${code}" class="country-flag" onerror="this.style.display='none'">`;
};

const countryFlagEmoji = (code) => {
  if (!code || code.length !== 2) return "";
  const offset = 0x1f1e6;
  return String.fromCodePoint(code.charCodeAt(0) - 65 + offset, code.charCodeAt(1) - 65 + offset);
};

const countryCentroids = {
  US: [39, -98],
  GB: [54, -2],
  DE: [51, 10],
  FR: [47, 2],
  IT: [43, 12],
  ES: [40, -4],
  PT: [39, -8],
  NL: [52, 5],
  BE: [51, 4],
  AT: [48, 14],
  CH: [47, 8],
  SE: [62, 15],
  NO: [62, 10],
  DK: [56, 10],
  FI: [64, 26],
  PL: [52, 20],
  CZ: [50, 15],
  RO: [46, 25],
  HU: [47, 20],
  BG: [43, 25],
  HR: [45, 16],
  SK: [49, 20],
  SI: [46, 15],
  LT: [56, 24],
  LV: [57, 25],
  EE: [59, 26],
  IE: [53, -8],
  GR: [39, 22],
  CY: [35, 33],
  MT: [36, 14],
  LU: [50, 6],
  CA: [56, -106],
  MX: [23, -102],
  BR: [-14, -51],
  AR: [-38, -64],
  CO: [4, -72],
  CL: [-35, -71],
  PE: [-10, -76],
  VE: [7, -66],
  EC: [-2, -78],
  UY: [-33, -56],
  CN: [35, 105],
  JP: [36, 138],
  KR: [36, 128],
  IN: [21, 78],
  ID: [-5, 120],
  TH: [15, 101],
  VN: [16, 108],
  PH: [13, 122],
  MY: [4, 102],
  SG: [1, 104],
  TW: [24, 121],
  HK: [22, 114],
  AU: [-27, 133],
  NZ: [-42, 174],
  RU: [62, 105],
  UA: [49, 32],
  TR: [39, 35],
  IL: [31, 35],
  AE: [24, 54],
  SA: [24, 45],
  EG: [27, 30],
  ZA: [-29, 24],
  NG: [10, 8],
  KE: [-1, 38],
  IS: [65, -18],
  RS: [44, 21],
  BA: [44, 18],
  AL: [41, 20],
  MK: [41, 22],
  ME: [43, 19],
  XK: [43, 21],
  MD: [47, 29],
  BY: [54, 28],
  GE: [42, 44],
  AM: [40, 45],
  AZ: [41, 48],
  KZ: [48, 67],
  UZ: [41, 65],
  PK: [30, 70],
  BD: [24, 90],
  MM: [22, 96],
  KH: [13, 105],
  LA: [18, 105],
  NP: [28, 84],
  LK: [7, 81],
  MA: [32, -5],
  TN: [34, 9],
  DZ: [28, 3],
  LY: [27, 17],
  SD: [16, 30],
  ET: [9, 38],
  TZ: [-6, 35],
  UG: [1, 32],
  GH: [8, -2],
  CI: [8, -5],
  SN: [14, -14],
  CM: [6, 12],
  AO: [-12, 18],
  MZ: [-18, 35],
  MG: [-20, 47],
  PA: [9, -80],
  CR: [10, -84],
  GT: [15, -90],
  HN: [15, -87],
  SV: [14, -89],
  NI: [13, -85],
  DO: [19, -70],
  CU: [22, -80],
  JM: [18, -77],
  TT: [10, -61],
  PR: [18, -67],
  QA: [25, 51],
  KW: [29, 48],
  BH: [26, 51],
  OM: [21, 57],
  JO: [31, 36],
  LB: [34, 36],
  IQ: [33, 44],
  IR: [33, 53],
  AF: [34, 66],
};

let locationMapMode = false;
let locationCountries = null;
let worldTopoData = null;

async function loadWorldMap() {
  if (worldTopoData) return worldTopoData;
  if (!window.topojson) {
    await new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = "/public/assets/topojson-client.min.js";
      s.onload = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }
  worldTopoData = await (await fetch("/public/assets/countries-110m.json")).json();
  return worldTopoData;
}

const GEO_LAT_MIN = -60;
const GEO_LAT_MAX = 85;

function projectGeo(coords, w, h) {
  const x = ((coords[0] + 180) / 360) * w;
  const y = ((GEO_LAT_MAX - coords[1]) / (GEO_LAT_MAX - GEO_LAT_MIN)) * h;
  return [x, y];
}

function drawGeoPath(ctx, geometry, w, h) {
  const drawRing = (ring) => {
    let moved = false;
    for (let i = 0; i < ring.length; i++) {
      const [x, y] = projectGeo(ring[i], w, h);
      if (i > 0 && Math.abs(ring[i][0] - ring[i - 1][0]) > 170) {
        ctx.moveTo(x, y);
        moved = true;
        continue;
      }
      if (!moved && i === 0) ctx.moveTo(x, y);
      else if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
      moved = true;
    }
  };

  if (geometry.type === "Polygon") {
    ctx.beginPath();
    for (const ring of geometry.coordinates) drawRing(ring);
    ctx.closePath();
  } else if (geometry.type === "MultiPolygon") {
    ctx.beginPath();
    for (const polygon of geometry.coordinates) {
      for (const ring of polygon) drawRing(ring);
    }
    ctx.closePath();
  }
}

const numericToAlpha2 = {
  "004": "AF",
  "008": "AL",
  "012": "DZ",
  "020": "AD",
  "024": "AO",
  "028": "AG",
  "032": "AR",
  "036": "AU",
  "040": "AT",
  "044": "BS",
  "048": "BH",
  "050": "BD",
  "051": "AM",
  "056": "BE",
  "060": "BM",
  "064": "BT",
  "068": "BO",
  "070": "BA",
  "072": "BW",
  "076": "BR",
  "084": "BZ",
  "090": "SB",
  "096": "BN",
  100: "BG",
  104: "MM",
  108: "BI",
  112: "BY",
  116: "KH",
  120: "CM",
  124: "CA",
  140: "CF",
  144: "LK",
  148: "TD",
  152: "CL",
  156: "CN",
  158: "TW",
  170: "CO",
  174: "KM",
  178: "CG",
  180: "CD",
  188: "CR",
  191: "HR",
  192: "CU",
  196: "CY",
  203: "CZ",
  204: "BJ",
  208: "DK",
  214: "DO",
  218: "EC",
  818: "EG",
  222: "SV",
  226: "GQ",
  232: "ER",
  233: "EE",
  231: "ET",
  242: "FJ",
  246: "FI",
  250: "FR",
  258: "PF",
  266: "GA",
  270: "GM",
  268: "GE",
  276: "DE",
  288: "GH",
  300: "GR",
  308: "GD",
  320: "GT",
  324: "GN",
  328: "GY",
  332: "HT",
  340: "HN",
  348: "HU",
  352: "IS",
  356: "IN",
  360: "ID",
  364: "IR",
  368: "IQ",
  372: "IE",
  376: "IL",
  380: "IT",
  384: "CI",
  388: "JM",
  392: "JP",
  398: "KZ",
  400: "JO",
  404: "KE",
  408: "KP",
  410: "KR",
  414: "KW",
  417: "KG",
  418: "LA",
  422: "LB",
  426: "LS",
  428: "LV",
  430: "LR",
  434: "LY",
  440: "LT",
  442: "LU",
  450: "MG",
  454: "MW",
  458: "MY",
  462: "MV",
  466: "ML",
  470: "MT",
  478: "MR",
  480: "MU",
  484: "MX",
  496: "MN",
  498: "MD",
  504: "MA",
  508: "MZ",
  512: "OM",
  516: "NA",
  520: "NR",
  524: "NP",
  528: "NL",
  540: "NC",
  554: "NZ",
  558: "NI",
  562: "NE",
  566: "NG",
  578: "NO",
  586: "PK",
  591: "PA",
  598: "PG",
  600: "PY",
  604: "PE",
  608: "PH",
  616: "PL",
  620: "PT",
  630: "PR",
  634: "QA",
  642: "RO",
  643: "RU",
  646: "RW",
  682: "SA",
  686: "SN",
  688: "RS",
  694: "SL",
  702: "SG",
  703: "SK",
  704: "VN",
  705: "SI",
  706: "SO",
  710: "ZA",
  716: "ZW",
  724: "ES",
  728: "SS",
  729: "SD",
  740: "SR",
  752: "SE",
  756: "CH",
  760: "SY",
  762: "TJ",
  764: "TH",
  768: "TG",
  780: "TT",
  784: "AE",
  788: "TN",
  792: "TR",
  795: "TM",
  800: "UG",
  804: "UA",
  807: "MK",
  826: "GB",
  834: "TZ",
  840: "US",
  858: "UY",
  860: "UZ",
  862: "VE",
  887: "YE",
  894: "ZM",
  "-99": "XK",
};

function renderCountryMap(canvas, countries) {
  if (!worldTopoData || !window.topojson) return;

  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.parentElement.getBoundingClientRect();
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  canvas.style.width = rect.width + "px";
  canvas.style.height = rect.height + "px";

  const ctx = canvas.getContext("2d");
  ctx.scale(dpr, dpr);
  const w = rect.width;
  const h = rect.height;

  const geojson = topojson.feature(worldTopoData, worldTopoData.objects.countries);

  const countMap = {};
  for (const c of countries || []) countMap[c.code] = c.count;
  const maxCount = Math.max(...(countries || []).map((c) => c.count), 1);

  for (const feature of geojson.features) {
    if (String(feature.id) === "010") continue;
    const alpha2 = numericToAlpha2[String(feature.id)] || "";
    const count = countMap[alpha2] || 0;
    const pct = count / maxCount;

    drawGeoPath(ctx, feature.geometry, w, h);

    if (count > 0) {
      ctx.fillStyle = `rgba(137,180,250,${0.15 + pct * 0.7})`;
    } else {
      ctx.fillStyle = "rgba(255,255,255,0.03)";
    }
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.08)";
    ctx.lineWidth = 0.5;
    ctx.stroke();
  }

  canvas._geoData = { geojson, countMap, w, h };
}

function setupMapTooltip(canvas) {
  let tooltip = document.getElementById("map-tooltip");
  if (!tooltip) {
    tooltip = document.createElement("div");
    tooltip.id = "map-tooltip";
    document.body.appendChild(tooltip);
  }

  canvas.addEventListener("mousemove", (e) => {
    if (!canvas._geoData) return;
    const { geojson, countMap, w, h } = canvas._geoData;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    const lon = (mx / w) * 360 - 180;
    const lat = GEO_LAT_MAX - (my / h) * (GEO_LAT_MAX - GEO_LAT_MIN);

    let found = null;
    let bestDist = Infinity;
    for (const feature of geojson.features) {
      const alpha2 = numericToAlpha2[String(feature.id)] || "";
      if (!alpha2) continue;

      const centroid = countryCentroids[alpha2];
      if (centroid) {
        const dist = Math.abs(lat - centroid[0]) + Math.abs(lon - centroid[1]);
        if (dist < 25 && dist < bestDist) {
          bestDist = dist;
          found = alpha2;
        }
      }
    }

    if (found) {
      const name = countryNames[found] || found;
      const count = countMap[found] || 0;
      const flag = countryFlags(found);
      tooltip.innerHTML = `${flag} <b>${escapeHtml(name)}</b>${count > 0 ? ` \u2022 ${formatCompact(count)} challenges` : ""}`;
      tooltip.style.opacity = "1";
      tooltip.style.left = e.clientX + 12 + "px";
      tooltip.style.top = e.clientY - 8 + "px";
    } else {
      tooltip.style.opacity = "0";
    }
  });

  canvas.addEventListener("mouseleave", () => {
    tooltip.style.opacity = "0";
  });
}

async function loadGeoStats() {
  const data = await api("GET", `/keys/${selectedKey.siteKey}/geo-stats`);
  if (data.error) return;

  locationCountries = data.countries || [];
  renderLocationPanel(
    document.getElementById("locationBody"),
    data.countries || [],
    data.totalCountry || 0,
  );

  document
    .getElementById("locationViewToggle")
    ?.querySelectorAll(".insight-toggle-btn")
    .forEach((btn) => {
      btn.addEventListener("click", () => {
        locationMapMode = btn.dataset.view === "map";
        document
          .querySelectorAll("#locationViewToggle .insight-toggle-btn")
          .forEach((b) =>
            b.classList.toggle("active", b.dataset.view === (locationMapMode ? "map" : "list")),
          );
        const body = document.getElementById("locationBody");
        if (body)
          renderLocationPanel(
            body,
            locationCountries,
            locationCountries.reduce((s, c) => s + c.count, 0),
          );
      });
    });

  const netEl = document.getElementById("networksBody");
  if (netEl) {
    if (!data.asns || data.asns.length === 0) {
      netEl.innerHTML = `<div class="insight-empty">${hasGeoSource ? "No network data yet." : "Configure a lookup source in IP data settings to store network data."}</div>`;
    } else {
      const total = data.totalAsn || 1;
      const allAsns = data.asns;
      const placeholderSvg =
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z"/><path d="M2 12h20"/><path d="M12 2a15 15 0 0 1 4 10 15 15 0 0 1-4 10 15 15 0 0 1-4-10 15 15 0 0 1 4-10z"/></svg>';
      const BATCH = 20;
      let rendered = 0;
      const entriesEl = document.createElement("div");
      entriesEl.className = "insight-entries";
      netEl.innerHTML = "";
      netEl.appendChild(entriesEl);

      function renderNetBatch() {
        const batch = allAsns.slice(rendered, rendered + BATCH);
        if (!batch.length) return;
        const newEls = [];
        batch.forEach((a) => {
          const pct = Math.round((a.count / total) * 100);
          const asnMatch = a.name.match(/^AS(\d+)\s*(.*)/i);
          const asnNum = asnMatch ? asnMatch[1] : null;
          const asnName = asnMatch ? asnMatch[2] || `AS${asnMatch[1]}` : a.name;
          const asnTag = asnNum ? `AS${asnNum}` : "";
          const div = document.createElement("div");
          div.className = "insight-entry";
          div.innerHTML = `<div class="insight-entry-bar asn" style="width:${Math.max(pct, 2)}%"></div>
              <span class="asn-icon" ${asnNum ? `data-asn="${asnNum}"` : ""}>${placeholderSvg}</span>
              <span class="insight-entry-label" style="font-weight:400">${escapeHtml(asnName)}${asnTag ? ` <span class="asn-number">(${asnTag})</span>` : ""}</span>
              <span class="insight-entry-value">${formatCompact(a.count)}</span>
              <span class="insight-entry-pct">${pct}%</span>`;
          entriesEl.appendChild(div);
          newEls.push(div);
        });
        rendered += batch.length;
        newEls.forEach((div) => {
          div.querySelectorAll(".asn-icon[data-asn]").forEach((iconEl) => loadAsnIcon(iconEl));
        });
      }

      renderNetBatch();

      netEl.addEventListener("scroll", () => {
        if (rendered >= allAsns.length) return;
        if (netEl.scrollTop + netEl.clientHeight >= netEl.scrollHeight - 50) {
          renderNetBatch();
        }
      });

      function loadAsnIcon(iconEl) {
        iconEl.classList.add("shimmer");
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.src = `https://tiagozip.github.io/asn-data/logos/${iconEl.dataset.asn}.png`;
        img.onload = () => {
          try {
            const c = document.createElement("canvas");
            const s = Math.max(img.naturalWidth, img.naturalHeight, 1);
            c.width = s;
            c.height = s;
            const cx = c.getContext("2d");
            cx.drawImage(img, (s - img.naturalWidth) / 2, (s - img.naturalHeight) / 2);
            const id = cx.getImageData(0, 0, s, s);
            const px = id.data;
            const visited = new Uint8Array(s * s);
            const thresh = 240;
            const queue = [];
            const enqueue = (x, y) => {
              const i = y * s + x;
              if (x >= 0 && x < s && y >= 0 && y < s && !visited[i]) {
                const o = i * 4;
                if (px[o] >= thresh && px[o + 1] >= thresh && px[o + 2] >= thresh) {
                  visited[i] = 1;
                  px[o + 3] = 0;
                  queue.push(x, y);
                }
              }
            };
            for (let x = 0; x < s; x++) {
              enqueue(x, 0);
              enqueue(x, s - 1);
            }
            for (let y = 0; y < s; y++) {
              enqueue(0, y);
              enqueue(s - 1, y);
            }
            while (queue.length) {
              const qx = queue.shift(),
                qy = queue.shift();
              enqueue(qx - 1, qy);
              enqueue(qx + 1, qy);
              enqueue(qx, qy - 1);
              enqueue(qx, qy + 1);
            }

            let removed = 0;
            for (let i = 0; i < s * s; i++) {
              if (visited[i]) removed++;
            }
            const removedPct = removed / (s * s);
            if (removedPct > 0.05) {
              const strokeR = Math.max(1, Math.round(s / 18));
              const opaque = new Uint8Array(s * s);
              for (let i = 0; i < s * s; i++) {
                opaque[i] = px[i * 4 + 3] > 0 ? 1 : 0;
              }
              for (let y = 0; y < s; y++) {
                for (let x = 0; x < s; x++) {
                  const i = y * s + x;
                  if (opaque[i]) continue;
                  let near = false;
                  for (let dy = -strokeR; dy <= strokeR && !near; dy++) {
                    for (let dx = -strokeR; dx <= strokeR && !near; dx++) {
                      if (dx * dx + dy * dy > strokeR * strokeR) continue;
                      const nx = x + dx,
                        ny = y + dy;
                      if (nx >= 0 && nx < s && ny >= 0 && ny < s && opaque[ny * s + nx])
                        near = true;
                    }
                  }
                  if (near) {
                    const o = i * 4;
                    px[o] = 255;
                    px[o + 1] = 255;
                    px[o + 2] = 255;
                    px[o + 3] = 255;
                  }
                }
              }
            }
            cx.putImageData(id, 0, 0);
            const result = new Image();
            result.className = "asn-icon-img";
            result.src = c.toDataURL();
            iconEl.innerHTML = "";
            iconEl.appendChild(result);
          } catch {
            img.className = "asn-icon-img";
            iconEl.innerHTML = "";
            iconEl.appendChild(img);
          }
          iconEl.classList.remove("shimmer");
        };
        img.onerror = () => {
          iconEl.classList.remove("shimmer");
        };
      }
    }
  }

  // Networks search
  const netSearchBtn = document.getElementById("networksSearchBtn");
  const netSearchBar = document.getElementById("networksSearchBar");
  const netSearchField = document.getElementById("networksSearchInput");
  if (netSearchBtn && netSearchBar && netSearchField) {
    netSearchBtn.addEventListener("click", () => {
      const visible = netSearchBar.style.display !== "none";
      netSearchBar.style.display = visible ? "none" : "";
      if (!visible) netSearchField.focus();
      else {
        netSearchField.value = "";
        const entries = netEl?.querySelectorAll(".insight-entry") || [];
        entries.forEach((e) => (e.style.display = ""));
      }
    });
    netSearchField.addEventListener("input", () => {
      const q = netSearchField.value.toLowerCase();
      const entries = netEl?.querySelectorAll(".insight-entry") || [];
      entries.forEach((e) => {
        const label = e.querySelector(".insight-entry-label")?.textContent?.toLowerCase() || "";
        e.style.display = label.includes(q) ? "" : "none";
      });
    });
  }

  // Platform donut
  renderPlatformDonut(
    document.getElementById("platformBody"),
    data.platforms || [],
    data.totalPlatform || 0,
  );

  renderOsPanel(
    document.getElementById("osBody"),
    data.oses || [],
    data.totalOs || 0,
  );
}

const platformColors = {
  Desktop: "#89b4fa",
  Phone: "#a6e3a1",
  Tablet: "#cba6f7",
};

function renderPlatformDonut(el, items, total) {
  if (!el) return;
  if (!items || items.length === 0) {
    el.innerHTML = '<div class="insight-empty">No platform data yet.</div>';
    return;
  }
  el.innerHTML = '<div class="donut-layout"><canvas id="platformDonut"></canvas><div class="donut-legend" id="platformLegend"></div></div>';

  const canvas = document.getElementById("platformDonut");
  const dpr = window.devicePixelRatio || 1;
  const size = 160;
  canvas.width = size * dpr;
  canvas.height = size * dpr;
  canvas.style.width = size + "px";
  canvas.style.height = size + "px";
  const ctx = canvas.getContext("2d");
  ctx.scale(dpr, dpr);

  const cx = size / 2, cy = size / 2, r = 58, lineW = 18;
  const gapAngle = 0.14;
  const capInset = (lineW / 2) / r;
  const totalArc = 2 * Math.PI - gapAngle * items.length;
  let angle = -Math.PI / 2;

  items.forEach((item) => {
    const sweep = (item.count / (total || 1)) * totalArc;
    const color = platformColors[item.name] || "#5a5a63";
    const inset = Math.min(capInset, sweep / 2 - 0.01);
    ctx.beginPath();
    ctx.arc(cx, cy, r, angle + inset, angle + sweep - inset);
    ctx.strokeStyle = color;
    ctx.lineWidth = lineW;
    ctx.lineCap = "round";
    ctx.stroke();
    angle += sweep + gapAngle;
  });

  const legend = document.getElementById("platformLegend");
  if (legend) {
    legend.innerHTML = items.map((item) => {
      const pct = Math.round((item.count / (total || 1)) * 100);
      const color = platformColors[item.name] || "#5a5a63";
      return `<div class="donut-legend-item"><span class="donut-dot" style="background:${color}"></span><span class="donut-legend-label">${escapeHtml(item.name)}</span><span class="donut-legend-count">${formatCompact(item.count)}</span><span class="donut-legend-pct">${pct}%</span></div>`;
    }).join("");
  }
}

const appleSvg = '<svg viewBox="0 0 24 24" fill="#b0b0b8"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M15.079 5.999l.239 .012c1.43 .097 3.434 1.013 4.508 2.586a1 1 0 0 1 -.344 1.44c-.05 .028 -.372 .158 -.497 .217a4.15 4.15 0 0 0 -.722 .431c-.614 .461 -.948 1.009 -.942 1.694c.01 .885 .339 1.454 .907 1.846c.208 .143 .436 .253 .666 .33c.126 .043 .426 .116 .444 .122a1 1 0 0 1 .662 .942c0 2.621 -3.04 6.381 -5.286 6.381c-.79 0 -1.272 -.091 -1.983 -.315l-.098 -.031c-.463 -.146 -.702 -.192 -1.133 -.192c-.52 0 -.863 .06 -1.518 .237l-.197 .053c-.575 .153 -.964 .226 -1.5 .248c-2.749 0 -5.285 -5.093 -5.285 -9.072c0 -3.87 1.786 -6.92 5.286 -6.92c.297 0 .598 .045 .909 .128c.403 .107 .774 .26 1.296 .508c.787 .374 .948 .44 1.009 .44h.016c.03 -.003 .128 -.047 1.056 -.457c1.061 -.467 1.864 -.685 2.746 -.616l-.24 -.012z"/><path d="M14 1a1 1 0 0 1 1 1a3 3 0 0 1 -3 3a1 1 0 0 1 -1 -1a3 3 0 0 1 3 -3z"/></svg>';
const osIcons = {
  macOS: appleSvg,
  Windows: '<svg viewBox="0 0 24 24" fill="#5bb8f5"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M21 13v5c0 1.57 -1.248 2.832 -2.715 2.923l-.113 .003l-.042 .018a1 1 0 0 1 -.336 .056l-.118 -.008l-4.676 -.585v-7.407zm-10 0v7.157l-5.3 -.662c-1.514 -.151 -2.7 -1.383 -2.7 -2.895v-3.6zm0 -9.158v7.158h-8v-3.6c0 -1.454 1.096 -2.648 2.505 -2.87zm10 2.058v5.1h-8v-7.409l4.717 -.589c1.759 -.145 3.283 1.189 3.283 2.898"/></svg>',
  Linux: '<svg viewBox="0 0 24 24" fill="none" stroke="#b0b0b8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M12 3l8 4.5l0 9l-8 4.5l-8 -4.5l0 -9l8 -4.5"/><path d="M12 12l8 -4.5"/><path d="M12 12l0 9"/><path d="M12 12l-8 -4.5"/></svg>',
  Android: '<svg viewBox="0 0 24 24" fill="#32DE84"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M17.523 15.341a1.024 1.024 0 010-2.047 1.024 1.024 0 010 2.047m-11.046 0a1.024 1.024 0 010-2.047 1.024 1.024 0 010 2.047m11.405-6.02l1.997-3.46a.416.416 0 00-.152-.567.416.416 0 00-.567.152l-2.024 3.506A12.2 12.2 0 0012 8.02c-1.82 0-3.543.406-5.136 1.132L4.84 5.646a.416.416 0 00-.567-.152.416.416 0 00-.152.567l1.997 3.46C2.688 11.59.343 15.55.049 20.02h23.902c-.293-4.47-2.638-8.43-6.069-10.499"/></svg>',
  iOS: appleSvg,
  iPadOS: appleSvg,
};

function renderOsPanel(el, items, total) {
  if (!el) return;
  if (!items || items.length === 0) {
    el.innerHTML = '<div class="insight-empty">No OS data yet.</div>';
    return;
  }
  const t = total || 1;
  const entriesEl = document.createElement("div");
  entriesEl.className = "insight-entries";
  el.innerHTML = "";
  el.appendChild(entriesEl);
  items.forEach((item) => {
    const pct = Math.round((item.count / t) * 100);
    const icon = osIcons[item.name] || "";
    const div = document.createElement("div");
    div.className = "insight-entry";
    div.innerHTML = `<div class="insight-entry-bar" style="width:${Math.max(pct, 2)}%"></div>
        ${icon ? `<span class="os-icon">${icon}</span>` : ""}
        <span class="insight-entry-label">${escapeHtml(item.name)}</span>
        <span class="insight-entry-value">${formatCompact(item.count)}</span>
        <span class="insight-entry-pct">${pct}%</span>`;
    entriesEl.appendChild(div);
  });
}

function renderLocationPanel(el, countries, total) {
  if (!countries || countries.length === 0) {
    el.innerHTML = `<div class="insight-empty">${hasGeoSource ? "No location data yet." : "Configure a lookup source in IP data settings to store location data."}</div>`;
    return;
  }

  if (locationMapMode) {
    el.innerHTML = `<div class="location-map-wrap"><canvas id="locationMapCanvas"></canvas></div>`;
    const canvas = document.getElementById("locationMapCanvas");
    if (canvas) {
      loadWorldMap()
        .then(() => {
          renderCountryMap(canvas, countries);
          setupMapTooltip(canvas);
        })
        .catch(() => {
          el.innerHTML = '<div class="insight-empty">Failed to load map data</div>';
        });
    }
  } else {
    const t = total || 1;
    const BATCH = 20;
    let rendered = 0;
    const entriesEl = document.createElement("div");
    entriesEl.className = "insight-entries";
    el.innerHTML = "";
    el.appendChild(entriesEl);

    function renderBatch() {
      const batch = countries.slice(rendered, rendered + BATCH);
      if (!batch.length) return;
      batch.forEach((c) => {
        const pct = Math.round((c.count / t) * 100);
        const name = countryNames[c.code] || c.code;
        const flag = countryFlags(c.code);
        const div = document.createElement("div");
        div.className = "insight-entry";
        div.innerHTML = `<div class="insight-entry-bar" style="width:${Math.max(pct, 2)}%"></div>
            <span class="insight-entry-flag">${flag}</span>
            <span class="insight-entry-label">${escapeHtml(name)}</span>
            <span class="insight-entry-value">${formatCompact(c.count)}</span>
            <span class="insight-entry-pct">${pct}%</span>`;
        entriesEl.appendChild(div);
      });
      rendered += batch.length;
    }

    renderBatch();

    el.addEventListener("scroll", () => {
      if (rendered >= countries.length) return;
      if (el.scrollTop + el.clientHeight >= el.scrollHeight - 50) {
        renderBatch();
      }
    });
  }
}

async function loadBlockedIps() {
  const container = document.getElementById("blockedIpsList");
  if (!container) return;
  container.innerHTML =
    '<div class="blocked-ips-loading"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="icon icon-tabler icons-tabler-outline icon-tabler-loader-2"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M12 3a9 9 0 1 0 9 9" /></svg></div>';

  const data = await api("GET", `/keys/${selectedKey.siteKey}/blocked-ips`);

  if (!Array.isArray(data) || data.length === 0) {
    container.innerHTML = '<div class="blocked-ips-empty">No block rules yet</div>';
    return;
  }

  const typeLabels = { ip: "IP", cidr: "Range", asn: "ASN", country: "Country" };
  const typeColors = { ip: "", cidr: "blue", asn: "purple", country: "blue" };

  container.innerHTML = data
    .map((b) => {
      const type = b.type || "ip";
      const label = typeLabels[type] || type;
      const colorClass = typeColors[type] || "";
      const displayValue =
        type === "country"
          ? `${countryFlags(b.ip)} ${countryNames[b.ip] || b.ip}`
          : escapeHtml(b.ip);
      return `<div class="blocked-ip-row">
      <div class="blocked-ip-info">
        <span class="blocked-ip-addr">${type !== "ip" ? `<span class="block-type-badge ${colorClass}">${label}</span>` : ""}${displayValue}</span>
        <span class="blocked-ip-meta">${b.permanent ? "Permanent" : `Expires ${formatDate(b.expires)}`}</span>
      </div>
      <button class="blocked-ip-unblock" data-type="${type}" data-value="${escapeHtml(b.ip)}">Remove</button>
    </div>`;
    })
    .join("");

  container.querySelectorAll(".blocked-ip-unblock").forEach((btn) => {
    btn.addEventListener("click", async () => {
      btn.disabled = true;
      await api("POST", `/keys/${selectedKey.siteKey}/unblock-ip`, {
        type: btn.dataset.type,
        value: btn.dataset.value,
      });
      loadBlockedIps();
    });
  });
}

function openAddBlockRuleModal() {
  const modal = createModal(
    "Add block rule",
    `
    <div class="modal-body">
      <div class="modal-field">
        <label>Type</label>
        <select id="blockRuleType">
          <option value="ip">IP address</option>
          <option value="cidr">IP range (CIDR)</option>
          <option value="asn">ASN</option>
          <option value="country">Country</option>
        </select>
      </div>
      <div class="modal-field" id="blockRuleValueField">
        <label id="blockRuleValueLabel">IP address</label>
        <input type="text" id="blockRuleValue" placeholder="e.g. 1.2.3.4">
      </div>
      <div class="modal-field" id="blockRuleCountryField" style="display:none">
        <label>Country code</label>
        <select id="blockRuleCountry">
          <option value="">Select country...</option>
          ${Object.entries(countryNames)
            .sort((a, b) => a[1].localeCompare(b[1]))
            .map(
              ([code, name]) =>
                `<option value="${code}">${countryFlagEmoji(code)} ${escapeHtml(name)}</option>`,
            )
            .join("")}
        </select>
      </div>
      <div class="modal-field">
        <label>Duration</label>
        <select id="blockRuleDuration">
          <option value="0">Permanent</option>
          <option value="3600">1 hour</option>
          <option value="86400">24 hours</option>
          <option value="604800">7 days</option>
          <option value="2592000">30 days</option>
        </select>
      </div>
    </div>
    <div class="modal-footer">
      <button class="modal-btn secondary" id="blockRuleCancelBtn">Cancel</button>
      <button class="modal-btn danger" id="blockRuleSubmitBtn">Block</button>
    </div>`,
  );

  const typeSelect = modal.querySelector("#blockRuleType");
  const valueField = modal.querySelector("#blockRuleValueField");
  const countryField = modal.querySelector("#blockRuleCountryField");
  const valueLabel = modal.querySelector("#blockRuleValueLabel");
  const valueInput = modal.querySelector("#blockRuleValue");

  const placeholders = { ip: "e.g. 1.2.3.4", cidr: "e.g. 10.0.0.0/8", asn: "e.g. AS15169" };
  const labels = { ip: "IP address", cidr: "IP range (CIDR)", asn: "ASN number or name" };

  typeSelect.addEventListener("change", () => {
    const t = typeSelect.value;
    if (t === "country") {
      valueField.style.display = "none";
      countryField.style.display = "";
    } else {
      valueField.style.display = "";
      countryField.style.display = "none";
      valueLabel.textContent = labels[t] || "Value";
      valueInput.placeholder = placeholders[t] || "";
    }
  });

  modal.querySelector("#blockRuleCancelBtn").addEventListener("click", closeModal);
  modal.querySelector("#blockRuleSubmitBtn").addEventListener("click", async () => {
    const type = typeSelect.value;
    let value;
    if (type === "country") {
      value = modal.querySelector("#blockRuleCountry").value;
    } else {
      value = valueInput.value.trim();
    }
    if (!value) return;

    modal.querySelector("#blockRuleSubmitBtn").disabled = true;
    const duration = parseInt(modal.querySelector("#blockRuleDuration").value);
    await api("POST", `/keys/${selectedKey.siteKey}/block-ip`, { type, value, duration });
    closeModal();
    loadBlockedIps();
  });
}

async function saveMainConfig() {
  const btn = document.getElementById("saveMainConfigBtn");
  btn.disabled = true;
  const name = document.getElementById("cfgName").value.trim();
  const difficulty = parseInt(document.getElementById("cfgDifficulty").value, 10);
  const challengeCount = parseInt(document.getElementById("cfgChallengeCount").value, 10);
  const instrumentation = document.getElementById("cfgInstrumentation").checked;
  const obfuscationLevel = parseInt(document.getElementById("cfgObfuscationLevel").value, 10);
  const blockAutomatedBrowsers = document.getElementById("cfgBlockAutomatedBrowsers").checked;

  if (!name || difficulty < 1 || challengeCount < 1) {
    showModal(
      "Validation error",
      '<div class="modal-body"><p>Please check your input values.</p></div>',
    );
    btn.disabled = false;
    return;
  }

  const res = await api("PUT", `/keys/${selectedKey.siteKey}/config`, {
    name,
    difficulty,
    challengeCount,
    instrumentation,
    obfuscationLevel,
    blockAutomatedBrowsers,
  });

  if (res.success) {
    await loadKeys();
    selectedKey.name = name;
    selectedKey.config = {
      ...selectedKey.config,
      difficulty,
      challengeCount,
      instrumentation,
      obfuscationLevel,
      blockAutomatedBrowsers,
    };
    renderKeysList(searchInput.value);
  } else {
    showModal("Error", '<div class="modal-body"><p>Failed to save configuration.</p></div>');
    btn.disabled = false;
  }
}

async function saveSecurityConfig() {
  const btn = document.getElementById("saveSecurityConfigBtn");
  btn.disabled = true;
  const rlMaxVal = document.getElementById("cfgRatelimitMax").value;
  const rlDurVal = document.getElementById("cfgRatelimitDuration").value;
  const ratelimitMax = rlMaxVal === "" ? null : parseInt(rlMaxVal, 10);
  const ratelimitDuration = rlDurVal === "" ? null : parseInt(rlDurVal, 10);
  const corsEnabled = document.getElementById("cfgCorsEnabled").checked;
  const keyCorsEntries = corsEnabled
    ? [...document.querySelectorAll("#keyCorsOriginsList .key-cors-origin-input")]
        .map((i) => {
          let v = i.value.trim();
          if (!v) return "";
          try {
            v = new URL(v.includes("://") ? v : "https://" + v).host;
          } catch {}
          return v.replace(/\/+$/, "");
        })
        .filter(Boolean)
    : [];
  const corsOrigins = keyCorsEntries.length ? keyCorsEntries : null;
  const blockNonBrowserUA = document.getElementById("cfgBlockNonBrowserUA").checked;
  const reqHeadersEnabled = document.getElementById("cfgRequiredHeadersEnabled").checked;
  const requiredHeaders = reqHeadersEnabled
    ? [
        ...document.querySelectorAll("#keyRequiredHeadersPanel .key-required-header-check:checked"),
      ].map((c) => c.value)
    : [];
  const requiredHeadersVal = requiredHeaders.length ? requiredHeaders : null;

  const res = await api("PUT", `/keys/${selectedKey.siteKey}/config`, {
    ratelimitMax,
    ratelimitDuration,
    corsOrigins,
    blockNonBrowserUA,
    requiredHeaders: requiredHeadersVal,
  });

  if (res.success) {
    selectedKey.config = {
      ...selectedKey.config,
      ratelimitMax,
      ratelimitDuration,
      corsOrigins,
      blockNonBrowserUA,
      requiredHeaders: requiredHeadersVal,
    };
  } else {
    showModal("Error", '<div class="modal-body"><p>Failed to save security settings.</p></div>');
    btn.disabled = false;
  }
}

function rotateSecret() {
  showConfirmModal(
    "Rotate Secret?",
    "This will generate a new secret key. Your existing integrations will stop working until updated.",
    "Rotate",
    async () => {
      const res = await api("POST", `/keys/${selectedKey.siteKey}/rotate-secret`);
      if (res.secretKey) {
        showModal(
          "Rotated secret key",
          `<div class="modal-body"><div class="modal-field"><label>New secret key</label>
          <input type="text" value="${res.secretKey}" readonly onclick="this.select()">
          <p class="hint">Make sure to copy this \u2014 it won\u2019t be shown again.</p></div></div>`,
        );
      } else {
        showModal("Error", '<div class="modal-body"><p>Failed to rotate secret key.</p></div>');
      }
    },
  );
}

function deleteKey() {
  showConfirmModal(
    "Delete Key?",
    "This will permanently delete this key and all associated data. This cannot be undone.",
    "Delete",
    async () => {
      const res = await api("DELETE", `/keys/${selectedKey.siteKey}`);
      if (res.success) {
        selectedKey = null;
        welcomeScreen.style.display = "flex";
        keyDetail.style.display = "none";
        await loadKeys();
      } else {
        showModal("Error", '<div class="modal-body"><p>Failed to delete key.</p></div>');
      }
    },
    true,
  );
}

function createModal(title, content, isSettings = false, isWide = false) {
  closeModal();
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.innerHTML = `
    <div class="modal ${isSettings ? "wide" : ""} ${isWide ? "wide" : ""}">
      <div class="modal-header">
        <h2>${title}</h2>
        <button class="modal-close">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>
      ${content}
    </div>`;
  document.body.appendChild(overlay);
  overlay.querySelector(".modal-close").addEventListener("click", closeModal);
  overlay.addEventListener("mousedown", (e) => {
    if (e.target === overlay) closeModal();
  });
  document.addEventListener("keydown", escapeHandler);
  return overlay;
}

function escapeHandler(e) {
  if (e.key === "Escape") closeModal();
}

function closeModal() {
  const overlay = document.querySelector(".modal-overlay");
  if (overlay) {
    document.removeEventListener("keydown", escapeHandler);
    overlay.remove();
  }
}

function showModal(title, content) {
  createModal(title, content);
}

function showConfirmModal(title, message, confirmText, onConfirm, isDanger = false) {
  const modal = createModal(
    title,
    `
    <div class="modal-body"><p>${message}</p></div>
    <div class="modal-footer">
      <button class="modal-btn secondary" id="cancelBtn">Cancel</button>
      <button class="modal-btn ${isDanger ? "danger" : "primary"}" id="confirmBtn">${confirmText}</button>
    </div>`,
  );
  modal.querySelector("#cancelBtn").addEventListener("click", closeModal);
  modal.querySelector("#confirmBtn").addEventListener("click", async () => {
    modal.querySelector("#confirmBtn").disabled = true;
    closeModal();
    await onConfirm();
  });
}

function openCreateKeyModal(prefill = "") {
  const modal = createModal(
    "Create key",
    `
    <div class="modal-body">
      <div class="modal-field"><label for="newKeyName">Key name</label>
      <input type="text" id="newKeyName" placeholder="${escapeHtml(prefill || "")}" value="${escapeHtml(prefill || "")}" autofocus></div>
      <div class="switch-field" style="margin-top:8px">
        <label class="switch">
          <input type="checkbox" id="newKeyInstrumentation">
          <span class="switch-track"></span>
        </label>
        <label for="newKeyInstrumentation" class="switch-label">Enable instrumentation (recommended)</label>
      </div>
      <div class="switch-field" id="newKeyBlockBotsField" style="display:none">
        <label class="switch">
          <input type="checkbox" id="newKeyBlockBots">
          <span class="switch-track"></span>
        </label>
        <label for="newKeyBlockBots" class="switch-label">Attempt to block headless browsers</label>
      </div>
      <div class="switch-field">
        <label class="switch">
          <input type="checkbox" id="newKeyCorsEnabled">
          <span class="switch-track"></span>
        </label>
        <label for="newKeyCorsEnabled" class="switch-label">
          Restrict allowed origins
          <span class="hint">Only these origins will be able to request challenges for this key.</span>
        </label>
      </div>
      <div id="newKeyCorsPanel" style="display:none">
        <div id="newKeyCorsOriginsList" class="origin-list">
          <div class="origin-entry"><input type="text" class="new-key-cors-origin-input" placeholder="example.com"><button class="origin-remove-btn" title="Remove">&times;</button></div>
        </div>
      </div>
    </div>
    <div class="modal-footer">
      <button class="modal-btn secondary" onclick="closeModal()">Cancel</button>
      <button class="modal-btn primary" id="createKeySubmit">Create</button>
    </div>`,
  );

  const input = modal.querySelector("#newKeyName");
  const submitBtn = modal.querySelector("#createKeySubmit");
  const instrToggle = modal.querySelector("#newKeyInstrumentation");
  const blockBotsField = modal.querySelector("#newKeyBlockBotsField");
  const blockBotsToggle = modal.querySelector("#newKeyBlockBots");
  const corsToggle = modal.querySelector("#newKeyCorsEnabled");
  const corsPanel = modal.querySelector("#newKeyCorsPanel");
  const corsList = modal.querySelector("#newKeyCorsOriginsList");

  instrToggle.click();

  instrToggle.addEventListener("change", () => {
    blockBotsField.style.display = instrToggle.checked ? "flex" : "none";
    if (!instrToggle.checked) blockBotsToggle.checked = false;
  });

  function ensureNewKeyCorsEmptyRow() {
    const entries = [...corsList.querySelectorAll(".origin-entry")];
    const empties = entries.filter((e) => !e.querySelector(".new-key-cors-origin-input").value.trim());
    if (empties.length === 0) addNewKeyCorsRow();
    while (empties.length > 1) empties.pop().remove();
  }

  function attachOriginInput(inp) {
    inp.addEventListener("input", () => {
      ensureNewKeyCorsEmptyRow();
      inp.classList.remove("invalid");
    });
    inp.addEventListener("blur", () => {
      const raw = inp.value.trim();
      if (!raw) return;
      const normalized = normalizeOrigin(raw);
      if (!normalized) {
        inp.classList.add("invalid");
        return;
      }
      inp.classList.remove("invalid");
      if (normalized !== raw) inp.value = normalized;
    });
  }

  function addNewKeyCorsRow(value = "") {
    const div = document.createElement("div");
    div.className = "origin-entry";
    div.innerHTML = `<input type="text" class="new-key-cors-origin-input" value="${escapeHtml(value)}" placeholder="example.com"><button class="origin-remove-btn" title="Remove">&times;</button>`;
    const inp = div.querySelector(".new-key-cors-origin-input");
    div.querySelector(".origin-remove-btn").addEventListener("click", () => {
      div.remove();
      ensureNewKeyCorsEmptyRow();
    });
    attachOriginInput(inp);
    corsList.appendChild(div);
    return inp;
  }

  corsList.querySelectorAll(".origin-remove-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      btn.parentElement.remove();
      ensureNewKeyCorsEmptyRow();
    });
  });
  corsList.querySelectorAll(".new-key-cors-origin-input").forEach(attachOriginInput);

  corsToggle.addEventListener("change", () => {
    corsPanel.style.display = corsToggle.checked ? "block" : "none";
    if (corsToggle.checked) {
      const firstInput = corsList.querySelector(".new-key-cors-origin-input");
      firstInput?.focus();
    }
  });

  input.select();
  input.focus();
  input.addEventListener("input", () => {
    submitBtn.disabled = !input.value.trim();
  });
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && input.value.trim()) submitBtn.click();
  });

  submitBtn.addEventListener("click", async () => {
    submitBtn.disabled = true;
    const body = { name: input.value.trim() };
    if (instrToggle.checked) body.instrumentation = true;
    if (blockBotsToggle.checked) body.blockAutomatedBrowsers = true;
    if (corsToggle.checked) {
      const origins = [...corsList.querySelectorAll(".new-key-cors-origin-input")]
        .map((i) => normalizeOrigin(i.value))
        .filter(Boolean);
      if (origins.length) body.corsOrigins = origins;
    }
    const res = await api("POST", "/keys", body);
    if (res.siteKey && res.secretKey) {
      closeModal();
      showModal(
        "Key created",
        `
        <div class="modal-body">
          <div class="modal-field"><label>Site key</label><input type="text" value="${res.siteKey}" readonly onclick="this.select()"></div>
          <div class="modal-field"><label>Secret key</label><input type="text" value="${res.secretKey}" readonly onclick="this.select()">
          <p class="hint">Make sure to copy your secret key \u2014 it won\u2019t be shown again.</p></div>
        </div>
        <div class="modal-footer">
          <button class="modal-btn secondary" onclick="closeModal()">Close</button>
          <button class="modal-btn primary" onclick="closeModal(); selectKey('${res.siteKey}')">Open key</button>
        </div>`,
      );
      await loadKeys();
      selectKey(res.siteKey);
    } else {
      showModal("Error", '<div class="modal-body"><p>Failed to create key.</p></div>');
    }
  });
}

async function openSettings() {
  const hs = headerSettings || { ipHeader: "", countryHeader: "", asnHeader: "" };
  const rl = ratelimitSettings || { max: 30, duration: 5000 };
  const cs = corsSettings || { origins: null };
  const corsOriginsList = cs.origins || [];
  const fl = filteringSettings || { blockNonBrowserUA: false, requiredHeaders: [] };
  const globalRequiredHeaders = fl.requiredHeaders || [];
  const modal = createModal(
    "Settings",
    `
    <div class="settings-tabs">
      <div class="settings-tabs-indicator"></div>
      <button class="settings-tab active" data-tab="sessions">Sessions</button>
      <button class="settings-tab" data-tab="security">Security</button>
      <button class="settings-tab" data-tab="ipdata">IP data</button>
      <button class="settings-tab" data-tab="apikeys">API keys</button>
      <button class="settings-tab" data-tab="about">About</button>
    </div>
    <div class="settings-content">
      <div class="settings-section active" id="sessionsSection"><div id="sessionsList"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="icon icon-tabler icons-tabler-outline icon-tabler-loader-2"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M12 3a9 9 0 1 0 9 9" /></svg></div></div>
      <div class="settings-section" id="securitySection">
        <h4 class="settings-group-title">Global rate limit</h4>
        <p class="headers-description">Default rate limit applied to all challenge endpoints. Individual keys can override these values in their configuration.</p>
        <div class="edit-row">
          <div class="edit-field">
            <label>Max requests</label>
            <input type="number" id="cfgGlobalRatelimitMax" value="${rl.max}" min="1" max="10000">
            <span class="field-hint">Requests allowed per window</span>
          </div>
          <div class="edit-field">
            <label>Window (ms)</label>
            <input type="number" id="cfgGlobalRatelimitDuration" value="${rl.duration}" min="1000" max="3600000" step="1000">
            <span class="field-hint">Time window in milliseconds (e.g. 5000 = 5s)</span>
          </div>
        </div>
        <div class="config-save-row">
          <button class="save-btn" id="saveGlobalRatelimitBtn" disabled>Save</button>
        </div>

        <hr class="settings-divider">

        <div class="switch-field">
          <label class="switch">
            <input type="checkbox" id="cfgGlobalCorsEnabled" ${corsOriginsList.length ? "checked" : ""}>
            <span class="switch-track"></span>
          </label>
          <label for="cfgGlobalCorsEnabled" class="switch-label">Restrict allowed origins</label>
        </div>
        <div id="globalCorsPanel" style="display:${corsOriginsList.length ? "block" : "none"}">
          <p class="headers-description" style="margin:0 0 8px">Only these origins will be able to request challenges. Individual keys can override this.</p>
          <div id="globalCorsOrigins" class="origin-list">
            ${corsOriginsList.map((o) => `<div class="origin-entry"><input type="text" class="cors-origin-input" value="${escapeHtml(o)}" placeholder="Add an origin\u2026"><button class="origin-remove-btn" title="Remove">&times;</button></div>`).join("")}
          </div>
        </div>
        <div class="config-save-row">
          <button class="save-btn" id="saveCorsBtn" disabled>Save</button>
        </div>

        <hr class="settings-divider">

        <h4 class="settings-group-title">Request filtering</h4>
        <p class="headers-description">Block requests that don't look like they come from real browsers. Individual keys can override these defaults.</p>
        <div class="switch-field">
          <label class="switch">
            <input type="checkbox" id="cfgGlobalBlockNonBrowserUA" ${fl.blockNonBrowserUA ? "checked" : ""}>
            <span class="switch-track"></span>
          </label>
          <label for="cfgGlobalBlockNonBrowserUA" class="switch-label">
            Block non-browser user agents
            <span class="hint">Blocks requests from bots, scripts, and other non-browser clients (e.g. python-requests, curl).</span>
          </label>
        </div>
        <div class="switch-field">
          <label class="switch">
            <input type="checkbox" id="cfgGlobalRequiredHeadersEnabled" ${globalRequiredHeaders.length ? "checked" : ""}>
            <span class="switch-track"></span>
          </label>
          <label for="cfgGlobalRequiredHeadersEnabled" class="switch-label">
            Require browser headers
            <span class="hint">Block requests missing common browser headers.</span>
          </label>
        </div>
        <div id="globalRequiredHeadersPanel" style="display:${globalRequiredHeaders.length ? "block" : "none"}">
          <div class="header-checks">
            ${["accept-encoding", "accept-language", "cache-control", "referer", "sec-ch-ua", "sec-ch-ua-mobile", "sec-ch-ua-platform"].map((h) => `<label class="header-check-label"><input type="checkbox" class="global-required-header-check" value="${h}" ${globalRequiredHeaders.includes(h) ? "checked" : ""}> <code>${escapeHtml(h)}</code></label>`).join("")}
          </div>
        </div>
        <div class="config-save-row">
          <button class="save-btn" id="saveFilteringBtn" disabled>Save</button>
        </div>
      </div>
      <div class="settings-section" id="ipdataSection">
        <h4 class="settings-group-title">IP header</h4>
        <p class="headers-description">Set the header your reverse proxy uses to pass the client's real IP. Used for rate limiting, IP tracking, and geo lookups.</p>
        <div class="headers-presets">
          <span class="headers-presets-label">Presets</span>
          <button class="preset-btn" data-preset="cloudflare">Cloudflare</button>
          <button class="preset-btn" data-preset="vercel">Vercel</button>
          <button class="preset-btn" data-preset="nginx">Nginx</button>
          <button class="preset-btn" data-preset="clear">Clear</button>
        </div>
        <div class="edit-field">
          <label>IP header</label>
          <input type="text" id="cfgIpHeader" placeholder="e.g. CF-Connecting-IP" value="${escapeHtml(hs.ipHeader || "")}">
        </div>
        <div class="config-save-row">
          <button class="save-btn" id="saveIpHeaderBtn" disabled>Save</button>
        </div>

        <hr class="settings-divider">

        <h4 class="settings-group-title">Country & ASN data</h4>
        <p class="headers-description">Choose how to resolve country and ASN for each IP. Use <b>headers</b> if your reverse proxy provides them, or download an <b>IP database</b> for automatic lookups.</p>
        <div class="net-source-tabs">
          <button class="net-source-tab active" data-source="ipdb">IP Database</button>
          <button class="net-source-tab" data-source="headers">Proxy headers</button>
        </div>
        <div class="net-source-panel active" id="netSourceIpdb">
          <div id="ipdbStatus"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="icon icon-tabler icons-tabler-outline icon-tabler-loader-2"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M12 3a9 9 0 1 0 9 9" /></svg></div>
        </div>
        <div class="net-source-panel" id="netSourceHeaders">
          <div class="edit-field">
            <label>Country header</label>
            <input type="text" id="cfgCountryHeader" placeholder="e.g. CF-IPCountry" value="${escapeHtml(hs.countryHeader || "")}">
            <span class="field-hint">Header containing the 2-letter ISO country code</span>
          </div>
          <div class="edit-field">
            <label>ASN / Network header</label>
            <input type="text" id="cfgAsnHeader" placeholder="e.g. CF-IPOrg" value="${escapeHtml(hs.asnHeader || "")}">
            <span class="field-hint">Header containing the ASN or network name</span>
          </div>
          <div class="config-save-row">
            <button class="save-btn" id="saveGeoHeadersBtn" disabled>Save</button>
          </div>
        </div>
      </div>
      <div class="settings-section" id="apikeysSection">
        <div style="display:flex;justify-content:flex-end;margin-bottom:12px">
          <button class="create-btn" id="createApiKeyBtn">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg> Create
          </button>
        </div>
        <div id="apikeysList"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="icon icon-tabler icons-tabler-outline icon-tabler-loader-2"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M12 3a9 9 0 1 0 9 9" /></svg></div>
      </div>
      <div class="settings-section" id="aboutSection">
        <img src="https://capjs.js.org/logo.png" alt="Cap logo" loading="lazy" class="about-logo" draggable="false">
        <p class="about-info" id="aboutInfo"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="icon icon-tabler icons-tabler-outline icon-tabler-loader-2"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M12 3a9 9 0 1 0 9 9" /></svg></p>
        <a href="https://github.com/tiagozip/cap" target="_blank" class="github-link">
          <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>
          Star on GitHub
        </a>
      </div>
    </div>`,
    true,
  );

  const settingsTabsContainer = modal.querySelector(".settings-tabs");
  const settingsIndicator = settingsTabsContainer.querySelector(".settings-tabs-indicator");
  const settingsTabs = settingsTabsContainer.querySelectorAll(".settings-tab");

  function updateSettingsIndicator(animate = true) {
    const activeTab = settingsTabsContainer.querySelector(".settings-tab.active");
    if (!activeTab || !settingsIndicator) return;
    if (!animate) settingsIndicator.style.transition = "none";
    settingsIndicator.style.width = activeTab.offsetWidth + "px";
    settingsIndicator.style.transform = `translateX(${activeTab.offsetLeft - 4}px)`;
    if (!animate)
      requestAnimationFrame(() => {
        settingsIndicator.style.transition = "";
      });
  }

  requestAnimationFrame(() => updateSettingsIndicator(false));

  settingsTabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      settingsTabs.forEach((t) => t.classList.remove("active"));
      modal.querySelectorAll(".settings-section").forEach((s) => s.classList.remove("active"));
      tab.classList.add("active");
      modal.querySelector(`#${tab.dataset.tab}Section`).classList.add("active");
      updateSettingsIndicator();
    });
  });

  const ipPresets = {
    cloudflare: "CF-Connecting-IP",
    vercel: "X-Forwarded-For",
    nginx: "X-Real-IP",
    clear: "",
  };
  const geoPresets = {
    cloudflare: { countryHeader: "CF-IPCountry", asnHeader: "CF-IPOrg" },
    vercel: { countryHeader: "X-Vercel-IP-Country", asnHeader: "" },
    nginx: { countryHeader: "X-GeoIP2-Country", asnHeader: "X-GeoIP2-Org" },
    clear: { countryHeader: "", asnHeader: "" },
  };

  modal.querySelectorAll(".headers-presets .preset-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const p = btn.dataset.preset;
      if (p in ipPresets) {
        document.getElementById("cfgIpHeader").value = ipPresets[p];
        checkIpHeaderDirty();
      }
      if (p in geoPresets) {
        document.getElementById("cfgCountryHeader").value = geoPresets[p].countryHeader;
        document.getElementById("cfgAsnHeader").value = geoPresets[p].asnHeader;
        checkGeoHeadersDirty();
      }
    });
  });

  modal.querySelectorAll(".net-source-tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      modal.querySelectorAll(".net-source-tab").forEach((t) => t.classList.remove("active"));
      modal.querySelectorAll(".net-source-panel").forEach((p) => p.classList.remove("active"));
      tab.classList.add("active");
      document
        .getElementById(tab.dataset.source === "ipdb" ? "netSourceIpdb" : "netSourceHeaders")
        .classList.add("active");
    });
  });

  function checkIpHeaderDirty() {
    const ipHeader = document.getElementById("cfgIpHeader").value.trim();
    const dirty = ipHeader !== (hs.ipHeader || "");
    document.getElementById("saveIpHeaderBtn").disabled = !dirty;
  }

  function checkGeoHeadersDirty() {
    const countryHeader = document.getElementById("cfgCountryHeader").value.trim();
    const asnHeader = document.getElementById("cfgAsnHeader").value.trim();
    const dirty = countryHeader !== (hs.countryHeader || "") || asnHeader !== (hs.asnHeader || "");
    document.getElementById("saveGeoHeadersBtn").disabled = !dirty;
  }

  document.getElementById("cfgIpHeader")?.addEventListener("input", checkIpHeaderDirty);
  document.getElementById("cfgCountryHeader")?.addEventListener("input", checkGeoHeadersDirty);
  document.getElementById("cfgAsnHeader")?.addEventListener("input", checkGeoHeadersDirty);

  document.getElementById("saveIpHeaderBtn")?.addEventListener("click", async () => {
    const btn = document.getElementById("saveIpHeaderBtn");
    btn.disabled = true;
    const ipHeader = document.getElementById("cfgIpHeader").value.trim();
    const countryHeader =
      document.getElementById("cfgCountryHeader")?.value.trim() || hs.countryHeader || "";
    const asnHeader = document.getElementById("cfgAsnHeader")?.value.trim() || hs.asnHeader || "";
    const res = await api("PUT", "/settings/headers", { ipHeader, countryHeader, asnHeader });
    if (res.success) {
      headerSettings = { ipHeader, countryHeader, asnHeader };
      hs.ipHeader = ipHeader;
    } else {
      btn.disabled = false;
    }
  });

  document.getElementById("saveGeoHeadersBtn")?.addEventListener("click", async () => {
    const btn = document.getElementById("saveGeoHeadersBtn");
    btn.disabled = true;
    const ipHeader = document.getElementById("cfgIpHeader")?.value.trim() || hs.ipHeader || "";
    const countryHeader = document.getElementById("cfgCountryHeader").value.trim();
    const asnHeader = document.getElementById("cfgAsnHeader").value.trim();
    const res = await api("PUT", "/settings/headers", { ipHeader, countryHeader, asnHeader });
    if (res.success) {
      headerSettings = { ipHeader, countryHeader, asnHeader };
      hs.countryHeader = countryHeader;
      hs.asnHeader = asnHeader;
    } else {
      btn.disabled = false;
    }
  });

  function checkGlobalRatelimitDirty() {
    const max = parseInt(document.getElementById("cfgGlobalRatelimitMax").value, 10);
    const duration = parseInt(document.getElementById("cfgGlobalRatelimitDuration").value, 10);
    const dirty = max !== rl.max || duration !== rl.duration;
    document.getElementById("saveGlobalRatelimitBtn").disabled = !dirty;
  }

  document
    .getElementById("cfgGlobalRatelimitMax")
    ?.addEventListener("input", checkGlobalRatelimitDirty);
  document
    .getElementById("cfgGlobalRatelimitDuration")
    ?.addEventListener("input", checkGlobalRatelimitDirty);

  document.getElementById("saveGlobalRatelimitBtn")?.addEventListener("click", async () => {
    const btn = document.getElementById("saveGlobalRatelimitBtn");
    btn.disabled = true;
    const max = parseInt(document.getElementById("cfgGlobalRatelimitMax").value, 10);
    const duration = parseInt(document.getElementById("cfgGlobalRatelimitDuration").value, 10);
    if (!max || max < 1 || !duration || duration < 1000) {
      btn.disabled = false;
      return;
    }
    const res = await api("PUT", "/settings/ratelimit", { max, duration });
    if (res.success) {
      ratelimitSettings = { max, duration };
      rl.max = max;
      rl.duration = duration;
    } else {
      btn.disabled = false;
    }
  });

  function getCorsEntries() {
    return [...document.querySelectorAll("#globalCorsOrigins .cors-origin-input")]
      .map((i) => normalizeOrigin(i.value))
      .filter(Boolean);
  }

  function checkCorsDirty() {
    const enabled = document.getElementById("cfgGlobalCorsEnabled").checked;
    const current = enabled ? getCorsEntries() : [];
    const orig = corsOriginsList;
    const dirty = current.length !== orig.length || current.some((v, i) => v !== orig[i]);
    document.getElementById("saveCorsBtn").disabled = !dirty;
  }

  function ensureGlobalCorsEmptyRow() {
    const entries = [...document.querySelectorAll("#globalCorsOrigins .origin-entry")];
    const empties = entries.filter((e) => !e.querySelector(".cors-origin-input").value.trim());
    if (empties.length === 0) {
      addGlobalCorsRow();
      return;
    }
    while (empties.length > 1) {
      empties.pop().remove();
    }
  }

  function addGlobalCorsRow(value = "") {
    const div = document.createElement("div");
    div.className = "origin-entry";
    div.innerHTML = `<input type="text" class="cors-origin-input" value="${escapeHtml(value)}" placeholder="Add an origin\u2026"><button class="origin-remove-btn" title="Remove">&times;</button>`;
    const input = div.querySelector(".cors-origin-input");
    div.querySelector(".origin-remove-btn").addEventListener("click", () => {
      div.remove();
      ensureGlobalCorsEmptyRow();
      checkCorsDirty();
    });
    input.addEventListener("input", () => {
      ensureGlobalCorsEmptyRow();
      checkCorsDirty();
    });
    input.addEventListener("blur", () => {
      const normalized = normalizeOrigin(input.value);
      if (normalized && normalized !== input.value.trim()) input.value = normalized;
    });
    document.getElementById("globalCorsOrigins").appendChild(div);
    return input;
  }

  document.querySelectorAll("#globalCorsOrigins .origin-remove-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      btn.parentElement.remove();
      ensureGlobalCorsEmptyRow();
      checkCorsDirty();
    });
  });
  document.querySelectorAll("#globalCorsOrigins .cors-origin-input").forEach((input) => {
    input.addEventListener("input", () => {
      ensureGlobalCorsEmptyRow();
      checkCorsDirty();
    });
    input.addEventListener("blur", () => {
      const normalized = normalizeOrigin(input.value);
      if (normalized && normalized !== input.value.trim()) input.value = normalized;
    });
  });
  ensureGlobalCorsEmptyRow();

  document.getElementById("cfgGlobalCorsEnabled")?.addEventListener("change", (e) => {
    const panel = document.getElementById("globalCorsPanel");
    panel.style.display = e.target.checked ? "block" : "none";
    if (e.target.checked) ensureGlobalCorsEmptyRow();
    checkCorsDirty();
  });

  document.getElementById("saveCorsBtn")?.addEventListener("click", async () => {
    const btn = document.getElementById("saveCorsBtn");
    btn.disabled = true;
    const enabled = document.getElementById("cfgGlobalCorsEnabled").checked;
    const origins = enabled ? getCorsEntries() : [];
    document.querySelectorAll("#globalCorsOrigins .cors-origin-input").forEach((input) => {
      const normalized = normalizeOrigin(input.value);
      if (normalized && normalized !== input.value.trim()) input.value = normalized;
    });
    const res = await api("PUT", "/settings/cors", { origins: origins.length ? origins : null });
    if (res.success) {
      corsSettings = { origins: origins.length ? origins : null };
      corsOriginsList.length = 0;
      corsOriginsList.push(...origins);
    } else {
      btn.disabled = false;
    }
  });

  function getGlobalRequiredHeaders() {
    return [
      ...document.querySelectorAll(
        "#globalRequiredHeadersPanel .global-required-header-check:checked",
      ),
    ].map((c) => c.value);
  }

  function checkFilteringDirty() {
    const blockUA = document.getElementById("cfgGlobalBlockNonBrowserUA").checked;
    const reqEnabled = document.getElementById("cfgGlobalRequiredHeadersEnabled").checked;
    const reqHeaders = reqEnabled ? getGlobalRequiredHeaders() : [];
    const dirty =
      blockUA !== fl.blockNonBrowserUA ||
      JSON.stringify(reqHeaders) !== JSON.stringify(globalRequiredHeaders);
    document.getElementById("saveFilteringBtn").disabled = !dirty;
  }

  document
    .getElementById("cfgGlobalBlockNonBrowserUA")
    ?.addEventListener("change", checkFilteringDirty);
  document.getElementById("cfgGlobalRequiredHeadersEnabled")?.addEventListener("change", (e) => {
    document.getElementById("globalRequiredHeadersPanel").style.display = e.target.checked
      ? "block"
      : "none";
    checkFilteringDirty();
  });
  document.querySelectorAll(".global-required-header-check").forEach((cb) => {
    cb.addEventListener("change", checkFilteringDirty);
  });

  document.getElementById("saveFilteringBtn")?.addEventListener("click", async () => {
    const btn = document.getElementById("saveFilteringBtn");
    btn.disabled = true;
    const blockNonBrowserUA = document.getElementById("cfgGlobalBlockNonBrowserUA").checked;
    const reqEnabled = document.getElementById("cfgGlobalRequiredHeadersEnabled").checked;
    const requiredHeaders = reqEnabled ? getGlobalRequiredHeaders() : [];
    const res = await api("PUT", "/settings/filtering", { blockNonBrowserUA, requiredHeaders });
    if (res.success) {
      filteringSettings = { blockNonBrowserUA, requiredHeaders };
      fl.blockNonBrowserUA = blockNonBrowserUA;
      globalRequiredHeaders.length = 0;
      globalRequiredHeaders.push(...requiredHeaders);
    } else {
      btn.disabled = false;
    }
  });

  loadIPDBSettings();

  const sessions = await api("GET", "/settings/sessions");
  const currentHash = JSON.parse(localStorage.getItem("cap_auth"))?.hash || "";

  if (Array.isArray(sessions)) {
    document.getElementById("sessionsList").innerHTML = sessions
      .map(
        (s) => `
      <div class="session-item">
        <div class="session-info">
          <div class="session-token">${s.token}</div>
          <div class="session-meta">
            ${currentHash.endsWith(s.token) ? '<span class="current">Current</span> \u2022 ' : ""}
            expires ${formatRelative(s.expires)}
          </div>
        </div>
        <button class="session-action" data-token="${s.token}">Logout</button>
      </div>`,
      )
      .join("");

    document.querySelectorAll(".session-action").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const token = btn.dataset.token;
        if (!currentHash.endsWith(token)) btn.parentElement.remove();
        await api("POST", "/logout", { session: token });
        if (currentHash.endsWith(token)) {
          localStorage.removeItem("cap_auth");
          document.cookie = "cap_authed=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
          location.reload();
        }
      });
    });
  }

  const apikeys = await api("GET", "/settings/apikeys");
  if (Array.isArray(apikeys)) {
    if (apikeys.length === 0) {
      document.getElementById("apikeysList").innerHTML =
        '<div class="empty-list">No API keys yet</div>';
    } else {
      document.getElementById("apikeysList").innerHTML = apikeys
        .map(
          (k) => `
        <div class="apikey-item">
          <div class="apikey-info">
            <div class="apikey-name">${escapeHtml(k.name)}</div>
            <div class="apikey-meta">${k.id.slice(0, 12)}... \u2022 created ${formatRelative(k.created)}</div>
          </div>
          <button class="apikey-action" data-id="${k.id}">Delete</button>
        </div>`,
        )
        .join("");

      document.querySelectorAll(".apikey-action").forEach((btn) => {
        btn.addEventListener("click", () => {
          showConfirmModal(
            "Delete API key?",
            "This will permanently delete this API key.",
            "Delete",
            async () => {
              await api("DELETE", `/settings/apikeys/${btn.dataset.id}`);
            },
            true,
          );
        });
      });
    }
  }

  document.getElementById("createApiKeyBtn").addEventListener("click", () => {
    closeModal();
    openCreateApiKeyModal();
  });

  const about = await api("GET", "/about");
  if (about.ver) {
    document.getElementById("aboutInfo").innerHTML =
      `Standalone <b>v${escapeHtml(about.ver)}</b><br>Bun <b>v${escapeHtml(about.bun)}</b>${about.demo ? '<br><span style="color:var(--blue);font-weight:500">Demo mode</span>' : ""}`;
  }
}

function openCreateApiKeyModal() {
  const modal = createModal(
    "Create API Key",
    `
    <div class="modal-body">
      <div class="modal-field"><label for="apiKeyName">Key name</label>
      <input type="text" id="apiKeyName"></div>
    </div>
    <div class="modal-footer">
      <button class="modal-btn secondary" onclick="closeModal(); openSettings()">Cancel</button>
      <button class="modal-btn primary" id="createApiKeySubmit">Create</button>
    </div>`,
  );

  const input = modal.querySelector("#apiKeyName");
  const submitBtn = modal.querySelector("#createApiKeySubmit");
  input.select();
  input.focus();
  input.addEventListener("input", () => {
    submitBtn.disabled = !input.value.trim();
  });
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && input.value.trim()) submitBtn.click();
  });

  submitBtn.addEventListener("click", async () => {
    submitBtn.disabled = true;
    const res = await api("POST", "/settings/apikeys", {
      name: input.value.trim(),
    });
    if (res.apiKey) {
      closeModal();
      showModal(
        "API key created",
        `<div class="modal-body"><div class="modal-field"><label>API key</label>
        <input type="text" value="${res.apiKey}" readonly onclick="this.select()">
        <p class="hint">Make sure to copy your API key \u2014 it won\u2019t be shown again.</p></div></div>
        <div class="modal-footer"><button class="modal-btn primary" onclick="closeModal(); openSettings()">Done</button></div>`,
      );
    } else {
      showModal("Error", '<div class="modal-body"><p>Failed to create API key.</p></div>');
    }
  });
}

async function loadIPDBSettings() {
  const container = document.getElementById("ipdbStatus");
  if (!container) return;

  const data = await api("GET", "/settings/ipdb");

  const formatSize = (bytes) => {
    if (!bytes) return "";
    if (bytes > 1e6) return `${(bytes / 1e6).toFixed(1)} MB`;
    return `${(bytes / 1e3).toFixed(0)} KB`;
  };

  const hasDB = data.country?.exists || data.asn?.exists;
  const isActive = data.mode && data.mode !== "";

  container.innerHTML = `
    ${
      isActive
        ? `
      <div class="ipdb-status-card">
        <div class="ipdb-status-row">
          <span class="ipdb-status-dot active"></span>
          <span class="ipdb-status-label">${data.mode === "dbip" ? "DB-IP Lite" : data.mode === "maxmind" ? "MaxMind GeoLite2" : "IPInfo API"}</span>
          ${data.lastUpdated ? `<span class="ipdb-status-meta">Updated ${formatRelative(data.lastUpdated)}</span>` : ""}
        </div>
        ${
          hasDB
            ? `<div class="ipdb-status-detail">
          ${data.country?.exists ? `<span>Country: ${formatSize(data.country.size)} ${data.loaded?.country ? "(loaded)" : ""}</span>` : ""}
          ${data.asn?.exists ? `<span>ASN: ${formatSize(data.asn.size)} ${data.loaded?.asn ? "(loaded)" : ""}</span>` : ""}
        </div>`
            : ""
        }
        <div class="ipdb-actions">
          <button class="preset-btn" id="ipdbUpdateBtn">Update</button>
          <button class="preset-btn" id="ipdbDeleteBtn" style="color:var(--red)">Delete</button>
        </div>
      </div>
    `
        : `
      <div class="ipdb-setup">
        <div class="edit-field">
          <label>Provider</label>
          <select id="ipdbMode">
            <option value="dbip">DB-IP Lite (free, no key needed)</option>
            <option value="maxmind">MaxMind GeoLite2 (free, needs license key)</option>
            <option value="ipinfo">IPInfo (API, needs token)</option>
          </select>
        </div>
        <div class="edit-field" id="ipdbMaxmindField" style="display:none">
          <label>MaxMind license key</label>
          <input type="text" id="ipdbMaxmindKey" placeholder="Your GeoLite2 license key">
        </div>
        <div class="edit-field" id="ipdbIpinfoField" style="display:none">
          <label>IPInfo token</label>
          <input type="text" id="ipdbIpinfoToken" placeholder="Your IPInfo API token">
        </div>
        <button class="save-btn" id="ipdbDownloadBtn">Download & activate</button>
      </div>
    `
    }
    <div class="ipdb-progress" id="ipdbProgress" style="display:none">
      <div class="ipdb-progress-bar"><div class="ipdb-progress-fill" id="ipdbProgressFill"></div></div>
      <span class="ipdb-progress-text" id="ipdbProgressText">Downloading...</span>
    </div>
  `;

  if (!isActive) {
    const modeSelect = container.querySelector("#ipdbMode");
    const maxmindField = container.querySelector("#ipdbMaxmindField");
    const ipinfoField = container.querySelector("#ipdbIpinfoField");

    modeSelect?.addEventListener("change", () => {
      maxmindField.style.display = modeSelect.value === "maxmind" ? "" : "none";
      ipinfoField.style.display = modeSelect.value === "ipinfo" ? "" : "none";
    });

    container.querySelector("#ipdbDownloadBtn")?.addEventListener("click", async () => {
      const mode = modeSelect.value;
      const body = { mode };
      if (mode === "maxmind")
        body.maxmindKey = container.querySelector("#ipdbMaxmindKey").value.trim();
      if (mode === "ipinfo")
        body.ipinfoToken = container.querySelector("#ipdbIpinfoToken").value.trim();

      container.querySelector("#ipdbDownloadBtn").disabled = true;
      const res = await api("POST", "/settings/ipdb/download", body);
      if (!res.success) {
        showModal(
          "Error",
          `<div class="modal-body"><p>${escapeHtml(res.error || "Download failed")}</p></div>`,
        );
        container.querySelector("#ipdbDownloadBtn").disabled = false;
        return;
      }

      const progressEl = container.querySelector("#ipdbProgress");
      progressEl.style.display = "";
      const pollFn = async () => {
        const p = await api("GET", "/settings/ipdb/progress");
        const fill = container.querySelector("#ipdbProgressFill");
        const text = container.querySelector("#ipdbProgressText");
        if (p.active) {
          if (p.total > 0) {
            const pct = Math.round((p.downloaded / p.total) * 100);
            if (fill) fill.style.width = `${pct}%`;
            if (text) text.textContent = `Downloading ${p.file}... ${pct}%`;
          } else {
            if (fill) {
              fill.style.width = "100%";
              fill.style.opacity = "0.4";
            }
            const kb = (p.downloaded / 1024).toFixed(0);
            if (text) text.textContent = `Downloading ${p.file}... ${kb} KB`;
          }
        } else {
          clearInterval(poll);
          loadIPDBSettings();
        }
      };
      pollFn();
      const poll = setInterval(pollFn, 500);
    });
  } else {
    container.querySelector("#ipdbUpdateBtn")?.addEventListener("click", async () => {
      const body = { mode: data.mode };
      if (data.maxmindKey) body.maxmindKey = prompt("MaxMind license key:", "") || "";
      if (data.ipinfoToken) body.ipinfoToken = prompt("IPInfo token:", "") || "";
      if (data.mode === "dbip") {
      } else if (data.mode === "maxmind" && !body.maxmindKey) return;
      else if (data.mode === "ipinfo" && !body.ipinfoToken) return;

      await api("POST", "/settings/ipdb/download", body);
      const progressEl = container.querySelector("#ipdbProgress");
      if (progressEl) progressEl.style.display = "";
      const poll = setInterval(async () => {
        const p = await api("GET", "/settings/ipdb/progress");
        if (!p.active) {
          clearInterval(poll);
          loadIPDBSettings();
        } else {
          const fill = container.querySelector("#ipdbProgressFill");
          const text = container.querySelector("#ipdbProgressText");
          if (p.total > 0) {
            const pct = Math.round((p.downloaded / p.total) * 100);
            if (fill) fill.style.width = `${pct}%`;
            if (text) text.textContent = `Downloading ${p.file}... ${pct}%`;
          } else {
            if (fill) fill.style.width = "100%";
            if (fill) fill.style.opacity = "0.4";
            const kb = (p.downloaded / 1024).toFixed(0);
            if (text) text.textContent = `Downloading ${p.file}... ${kb} KB`;
          }
        }
      }, 500);
    });

    container.querySelector("#ipdbDeleteBtn")?.addEventListener("click", () => {
      showConfirmModal(
        "Delete IP Database?",
        "This will remove the downloaded IP database files. Country and ASN lookups will stop working unless you have headers configured.",
        "Delete",
        async () => {
          await api("DELETE", "/settings/ipdb");
          loadIPDBSettings();
        },
        true,
      );
    });
  }

  if (data.progress?.active) {
    const progressEl = container.querySelector("#ipdbProgress");
    if (progressEl) progressEl.style.display = "";
    const poll = setInterval(async () => {
      const p = await api("GET", "/settings/ipdb/progress");
      if (!p.active) {
        clearInterval(poll);
        loadIPDBSettings();
      } else {
        const fill = container.querySelector("#ipdbProgressFill");
        const text = container.querySelector("#ipdbProgressText");
        if (p.total > 0) {
          const pct = Math.round((p.downloaded / p.total) * 100);
          if (fill) fill.style.width = `${pct}%`;
          if (text) text.textContent = `Downloading ${p.file}... ${pct}%`;
        } else {
          if (fill) fill.style.width = "100%";
          if (fill) fill.style.opacity = "0.4";
          const kb = (p.downloaded / 1024).toFixed(0);
          if (text) text.textContent = `Downloading ${p.file}... ${kb} KB`;
        }
      }
    }, 500);
  }
}

document
  .getElementById("createKeyBtn")
  .addEventListener("click", () => openCreateKeyModal(searchInput.value.trim()));
document
  .getElementById("searchInput")
  .addEventListener("input", (e) => renderKeysList(e.target.value));
document.getElementById("settingsBtn").addEventListener("click", openSettings);
init();
