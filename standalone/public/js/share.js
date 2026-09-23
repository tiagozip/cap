const token = location.hash.slice(1);
let chart;
let loadSeq = 0;

const el = (id) => document.getElementById(id);

const escapeHtml = (s) =>
  String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const formatCompact = (n) => {
  if (n >= 1e6) return (n / 1e6).toFixed(n >= 10e6 ? 0 : 1).replace(/\.0$/, "") + "M";
  if (n >= 1e3) return Math.round(n / 1e3) + "k";
  return String(n);
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
  const pct = previous === 0 ? 100 : Math.round(((current - previous) / previous) * 100);
  const dir = pct > 0 ? "up" : pct < 0 ? "down" : "neutral";
  const path =
    dir === "up" ? "M7 17L17 7M17 7H7M17 7v10" : dir === "down" ? "M7 7L17 17M17 17H7M17 17V7" : "M5 12h14";
  return `<span class="stat-trend ${dir}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="${path}"/></svg> ${Math.abs(pct)}%</span>`;
};

const getDateRange = (chartData) => {
  if (!chartData?.data?.length) return "";
  const fmt = (d) =>
    d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  const first = new Date(chartData.data[0].bucket * 1000);
  const last = new Date(chartData.data[chartData.data.length - 1].bucket * 1000);
  return `${fmt(first)} <span>\u2014</span> ${fmt(last)}`;
};

const showError = (message) => {
  el("shareMain").hidden = true;
  el("shareFilters").hidden = true;
  el("shareError").hidden = false;
  el("shareError").textContent = message;
  el("shareName").textContent = "Stats unavailable";
};

const renderEntries = (container, items, total, emptyText, labelFor) => {
  if (!items?.length) {
    container.innerHTML = `<div class="insight-empty">${emptyText}</div>`;
    return;
  }
  const t = total || 1;
  container.innerHTML = `<div class="insight-entries">${items
    .slice(0, 50)
    .map((item) => {
      const pct = Math.round((item.count / t) * 100);
      const { prefix, label } = labelFor(item);
      return `<div class="insight-entry">
        <div class="insight-entry-bar" style="width:${Math.max(pct, 2)}%"></div>
        ${prefix}
        <span class="insight-entry-label">${escapeHtml(label)}</span>
        <span class="insight-entry-value">${formatCompact(item.count)}</span>
        <span class="insight-entry-pct">${pct}%</span>
      </div>`;
    })
    .join("")}</div>`;
};

function renderChart(chartData) {
  const canvas = el("chart");
  if (chart) chart.destroy();
  const { data, duration } = chartData;
  if (!data?.length) {
    chart = null;
    return;
  }

  const labels = data.map((d) =>
    duration === "today" || duration === "yesterday"
      ? new Date(d.bucket * 1000).toLocaleTimeString("en-US", { hour: "numeric", hour12: true })
      : new Date(d.bucket * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
  );

  const mkDataset = (label, key, color) => ({
    label,
    data: data.map((d) => d[key] || 0),
    borderColor: color,
    fill: false,
    borderWidth: 2,
    pointRadius: 0,
    pointHoverRadius: 4,
    pointHoverBackgroundColor: color,
    tension: 0.1,
  });

  chart = new Chart(canvas.getContext("2d"), {
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
      animation: { duration: 0 },
      onResize(c) {
        const w = c.width;
        c.options.scales.x.ticks.maxTicksLimit = w < 400 ? 6 : w < 720 ? 10 : 14;
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
            callback: (v) => (v >= 1000 ? formatCompact(v) : String(v)),
          },
        },
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: "#14151a",
          borderColor: "#2a2a30",
          borderWidth: 1,
          titleColor: "#fafafa",
          bodyColor: "#a0a0a8",
          padding: 10,
          boxWidth: 8,
          boxHeight: 8,
          boxPadding: 4,
          usePointStyle: true,
          titleFont: { family: "'IBM Plex Sans', system-ui, sans-serif", size: 12 },
          bodyFont: { family: "'IBM Plex Sans', system-ui, sans-serif", size: 12 },
        },
      },
    },
  });
}

async function loadGeo() {
  let data;
  try {
    data = await (
      await fetch(new URL(`share/${encodeURIComponent(token)}/geo-stats`, document.baseURI))
    ).json();
  } catch {
    return;
  }
  if (data.error) return;

  renderEntries(el("locationBody"), data.countries, data.totalCountry, "No location data yet.", (c) => ({
    prefix: `<span class="insight-entry-flag">${countryFlags(c.code)}</span>`,
    label: countryName(c.code),
  }));
  renderEntries(el("networksBody"), data.asns, data.totalAsn, "No network data yet.", (a) => ({
    prefix: "",
    label: a.name,
  }));
  renderEntries(el("platformBody"), data.platforms, data.totalPlatform, "No platform data yet.", (p) => ({
    prefix: "",
    label: p.name,
  }));
  renderEntries(el("osBody"), data.oses, data.totalOs, "No OS data yet.", (o) => ({
    prefix: "",
    label: o.name,
  }));
}

async function load(duration, withGeo = false) {
  const seq = ++loadSeq;
  el("refreshBtn").classList.add("spinning");
  el("chartLoading").classList.add("visible");

  let data;
  try {
    data = await (
      await fetch(
        new URL(`share/${encodeURIComponent(token)}?chartDuration=${duration}`, document.baseURI),
      )
    ).json();
  } catch {
    data = { error: "Couldn't reach the server." };
  }

  if (seq !== loadSeq) return;
  el("refreshBtn").classList.remove("spinning");
  el("chartLoading").classList.remove("visible");

  if (!data.stats) {
    showError(data.error || "This share link is invalid or has expired.");
    return;
  }

  el("shareMain").hidden = false;
  el("shareFilters").hidden = false;
  el("shareError").hidden = true;
  el("shareName").textContent = data.name;
  document.title = `${data.name} · Cap stats`;
  el("shareExpires").textContent = data.expires
    ? `Link expires ${new Date(data.expires).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`
    : "";

  const s = data.stats;
  const ps = data.prevStats;
  const failed = Math.max(0, (s.challenges || 0) - (s.verified || 0));
  const prevFailed = ps ? Math.max(0, (ps.challenges || 0) - (ps.verified || 0)) : null;
  el("statChallenges").textContent = formatCompact(s.challenges || 0);
  el("statVerified").textContent = formatCompact(s.verified || 0);
  el("statFailed").textContent = formatCompact(failed);
  el("statLatency").textContent = formatLatency(s.avgLatency || 0);
  el("trendChallenges").innerHTML = trendHtml(s.challenges, ps?.challenges);
  el("trendVerified").innerHTML = trendHtml(s.verified, ps?.verified);
  el("trendFailed").innerHTML = trendHtml(failed, prevFailed);
  el("dateRange").innerHTML = getDateRange(data.chartData);

  renderChart(data.chartData);
  if (withGeo) loadGeo();
}

if (!token) {
  showError("This link is missing its share token.");
} else {
  el("timeSelect").addEventListener("change", (e) => load(e.target.value));
  el("refreshBtn").addEventListener("click", () => load(el("timeSelect").value, true));
  window.addEventListener("hashchange", () => location.reload());
  load(el("timeSelect").value, true);
}
