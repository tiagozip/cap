let keys = [];
let selectedKey;
let chart;

const keysList = document.getElementById("keysList");
const searchInput = document.getElementById("searchInput");
const welcomeScreen = document.getElementById("welcomeScreen");
const keyDetail = document.getElementById("keyDetail");

const escapeHtml = (s) => {
  return s.replaceAll("<", "&lt;").replaceAll(">", "&gt;");
};

const api = async (method, path, body) => {
  try {
    const auth = JSON.parse(localStorage.getItem("cap_auth"));
    if (!auth) throw new Error("Not authenticated");

    const opts = {
      method,
      headers: {
        Authorization: `Bearer ${btoa(JSON.stringify({ token: auth.token, hash: auth.hash }))}`,
      },
    };

    if (body) {
      opts.headers["Content-Type"] = "application/json";
      opts.body = JSON.stringify(body);
    }

    return await await fetch(`/server${path}`, opts).json();
  } catch (e) {
    return { error: e.message };
  }
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
      return past
        ? `${val} ${u}${val > 1 ? "s" : ""} ago`
        : `in ${val} ${u}${val > 1 ? "s" : ""}`;
    }
  }
  return past ? "just now" : "in a moment";
};

const randKey = () => {
  const left =
    "admiring adoring affectionate agitated amazing angry awesome beautiful blissful bold boring brave busy charming clever compassionate competent condescending confident cool cranky crazy dazzling determined distracted dreamy eager ecstatic elastic elated elegant eloquent epic exciting fervent festive flamboyant focused friendly frosty funny gallant gifted goofy gracious great happy hardcore heuristic hopeful hungry infallible inspiring intelligent interesting jolly jovial keen kind laughing loving lucid magical modest musing mystifying naughty nervous nice nifty nostalgic objective optimistic peaceful pedantic pensive practical priceless quirky quizzical recursing relaxed reverent romantic sad serene sharp silly sleepy stoic strange stupefied suspicious sweet tender thirsty trusting unruffled upbeat vibrant vigilant vigorous wizardly wonderful xenodochial youthful zealous zen".split(
      " ",
    );
  const right =
    "agnesi albattani allen almeida antonelli archimedes ardinghelli aryabhata austin babbage banach banzai bardeen bartik bassi beaver bell benz bhabha bhaskara black blackburn blackwell bohr booth borg bose bouman boyd brahmagupta brattain brown buck burnell cannon carson cartwright carver cerf chandrasekhar chaplygin chatelet chatterjee chaum chebyshev clarke cohen colden cori cray curie curran darwin davinci dewdney dhawan diffie dijkstra dirac driscoll dubinsky easley edison einstein elbakyan elgamal elion ellis engelbart euclid euler faraday feistel fermat fermi feynman franklin gagarin galileo galois ganguly gates gauss germain goldberg goldstine goldwasser golick goodall gould greider grothendieck haibt hamilton haslett hawking heisenberg hellman hermann herschel hertz heyrovsky hodgkin hofstadter hoover hopper hugle hypatia ishizaka jackson jang jemison jennings jepsen johnson joliot jones kalam kapitsa kare keldysh keller kepler khayyam khorana kilby kirch knuth kowalevski lalande lamarr lamport leakey leavitt lederberg lehmann lewin lichterman liskov lovelace lumiere mahavira margulis matsumoto maxwell mayer mccarthy mcclintock mclaren mclean mcnulty meitner mendel mendeleev meninsky merkle mestorf mirzakhani montalcini moore morse moser murdock napier nash neumann newton nightingale nobel noether northcutt noyce panini pare pascal pasteur payne perlman pike poincare poitras proskuriakova ptolemy raman ramanujan rhodes ride ritchie robinson roentgen rosalind rubin saha sammet sanderson satoshi shamir shannon shaw shirley shockley shtern sinoussi snyder solomon spence stonebraker sutherland swanson swartz swirles taussig tesla tharp thompson torvalds tu turing varahamihira vaughan villani visvesvaraya volhard wescoff wilbur wiles williams williamson wilson wing wozniak wright wu yalow yonath zhukovsky".split(
      " ",
    );

  return `${left[Math.floor(Math.random() * left.length)]}-${right[Math.floor(Math.random() * right.length)]}`;
};

async function init() {
  if (!localStorage.getItem("cap_auth")) {
    document.cookie =
      "cap_authed=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
    return;
  }

  await loadKeys();
}

async function loadKeys() {
  keys = await api("GET", "/keys");
  if (keys.error?.includes?.("Unauthorized")) {
    localStorage.removeItem("cap_auth");
    document.cookie =
      "cap_authed=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
    location.reload();
    return;
  }
  if (keys.error) {
    keysList.innerHTML = `<div class="keys-empty"><p>Error loading keys</p></div>`;
    return;
  }
  renderKeysList();
}

function renderKeysList(filter = "") {
  const filtered = keys.filter((k) =>
    k.name.toLowerCase().includes(filter.toLowerCase()),
  );

  if (filtered.length === 0) {
    keysList.innerHTML = `
      <div class="keys-empty">
        <p>${filter ? "No matching keys" : "No keys yet"}</p>
        ${
          !filter
            ? `<button class="create-btn" onclick="openCreateKeyModal()">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
            <path d="M12 5v14M5 12h14"/>
          </svg>
          Create your first key
        </button>`
            : ""
        }
      </div>
    `;
    return;
  }

  keysList.innerHTML = filtered
    .map(
      (key) => `
    <div class="key-item ${selectedKey?.siteKey === key.siteKey ? "active" : ""}" data-key="${key.siteKey}">
      <div class="key-item-name">${escapeHtml(key.name)}</div>
      <div class="key-item-stats">
        <span>${key.solvesLast24h} solves/24h</span>
        ${
          key.difference.direction
            ? `
          <span class="trend ${key.difference.direction}">
            ${
              key.difference.direction === "up"
                ? '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8.25 3.75H19.5a.75.75 0 01.75.75v11.25a.75.75 0 01-1.5 0V6.31L5.03 20.03a.75.75 0 01-1.06-1.06L17.69 5.25H8.25a.75.75 0 010-1.5z"/></svg>'
                : '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M3.97 3.97a.75.75 0 011.06 0l13.72 13.72V8.25a.75.75 0 011.5 0V19.5a.75.75 0 01-.75.75H8.25a.75.75 0 010-1.5h9.44L3.97 5.03a.75.75 0 010-1.06z"/></svg>'
            }
            ${key.difference.value}%
          </span>
        `
            : ""
        }
      </div>
    </div>
  `,
    )
    .join("");

  keysList.querySelectorAll(".key-item").forEach((el) => {
    el.addEventListener("click", () => {
      keysList.querySelectorAll(".key-item").forEach((e) => {
        e.classList.remove("active");
      });
      el.classList.add("active");
      selectKey(el.dataset.key);
    });
  });
}

async function selectKey(siteKey) {
  document.querySelector("#detailPanel").style.opacity = ".3";
  const data = await api("GET", `/keys/${siteKey}`);
  document.querySelector("#detailPanel").style.opacity = "1";
  if (data.error) {
    showModal(
      "Error",
      `<div class="modal-body"><p>Failed to load key: ${data.error}</p></div>`,
    );
    return;
  }

  selectedKey = data.key;
  selectedKey.stats = data.stats;
  selectedKey.chartData = data.chartData;

  renderKeyDetail();
  keysList.querySelectorAll(".key-item").forEach((el) => {
    el.classList.remove("active");
    if (el.dataset.key === siteKey) {
      el.classList.add("active");
    }
  });
}

function renderKeyDetail() {
  welcomeScreen.style.display = "none";
  keyDetail.style.display = "block";

  const key = selectedKey;
  const keyFromList = keys.find((k) => k.siteKey === key.siteKey);
  const change = keyFromList?.difference || { value: 0, direction: "" };

  keyDetail.innerHTML = `
    <div class="key-header">
      <h1>${escapeHtml(key.name)}</h1>
      <button class="copy-btn" id="copyKeyBtn">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
        </svg>
        Copy site key
      </button>
    </div>

    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-card-label">Solves (24h)</div>
        <div class="stat-card-value">${key.stats.solvesLast24h.toLocaleString()}</div>
        ${
          change.direction
            ? `
          <div class="stat-card-change ${change.direction}">
            ${
              change.direction === "up"
                ? '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8.25 3.75H19.5a.75.75 0 01.75.75v11.25a.75.75 0 01-1.5 0V6.31L5.03 20.03a.75.75 0 01-1.06-1.06L17.69 5.25H8.25a.75.75 0 010-1.5z"></path></svg>'
                : '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M3.97 3.97a.75.75 0 011.06 0l13.72 13.72V8.25a.75.75 0 011.5 0V19.5a.75.75 0 01-.75.75H8.25a.75.75 0 010-1.5h9.44L3.97 5.03a.75.75 0 010-1.06z"/></svg>'
            }
            ${change.value}% vs yesterday
          </div>
        `
            : ""
        }
      </div>
      <div class="stat-card">
        <div class="stat-card-label">Difficulty</div>
        <div class="stat-card-value">${key.config.difficulty}</div>
      </div>
      <div class="stat-card">
        <div class="stat-card-label">Challenges</div>
        <div class="stat-card-value">${key.config.challengeCount}</div>
      </div>
    </div>

    <div class="chart-section">
      <div class="chart-header">
        <h3>Activity</h3>
        <select class="time-select" id="timeSelect">
          <option value="today">Today</option>
          <option value="yesterday">Yesterday</option>
          <option value="last7days">Last 7 days</option>
          <option value="last28days">Last 28 days</option>
          <option value="last91days">Last 91 days</option>
          <option value="alltime">All time</option>
        </select>
      </div>
      <div class="chart-container">
        <canvas id="chart"></canvas>
        <div class="chart-loading" id="chartLoading">
          <svg class="spinner" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10" stroke-opacity="0.25"/>
            <path d="M12 2a10 10 0 0 1 10 10" stroke-linecap="round"/>
          </svg>
        </div>
      </div>
    </div>

    <div class="config-section">
      <h3>Configuration</h3>
      <div class="config-grid">
        <div class="config-field">
          <label for="cfgName">Name</label>
          <input type="text" id="cfgName" value="${escapeHtml(key.name)}">
        </div>
        <div class="config-field">
          <label for="cfgDifficulty">Difficulty</label>
          <input type="number" id="cfgDifficulty" value="${key.config.difficulty}" min="2">
        </div>
        <div class="config-field">
          <label for="cfgChallengeCount">Challenge count</label>
          <input type="number" id="cfgChallengeCount" value="${key.config.challengeCount}" min="1">
        </div>
        <div class="config-field">
          <label for="cfgSaltSize">Salt size</label>
          <input type="number" id="cfgSaltSize" value="${key.config.saltSize}" min="7">
        </div>
      </div>
      <div class="config-actions">
        <button class="save-btn" id="saveConfigBtn">Save changes</button>
      </div>
    </div>

    <div class="danger-section">
      <h3>Danger zone</h3>
      <p>These actions are irreversible. Please be certain.</p>
      <div class="danger-actions">
        <button class="danger-btn" id="rotateSecretBtn">Rotate secret</button>
        <button class="danger-btn delete" id="deleteKeyBtn">Delete key</button>
      </div>
    </div>
  `;

  document.getElementById("copyKeyBtn").addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(key.siteKey);
      const btn = document.getElementById("copyKeyBtn");
      btn.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="20 6 9 17 4 12"/>
        </svg>
        Copied!
      `;
      setTimeout(() => {
        btn.innerHTML = `
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
          </svg>
          Copy site key
        `;
      }, 2000);
    } catch {
      showModal(
        "Site Key",
        `
        <div class="modal-body">
          <div class="modal-field">
            <label>Site Key</label>
            <input type="text" value="${key.siteKey}" readonly onclick="this.select()">
          </div>
        </div>
      `,
      );
    }
  });

  document.getElementById("timeSelect").addEventListener("change", (e) => {
    loadChartData(e.target.value);
  });

  document
    .getElementById("saveConfigBtn")
    .addEventListener("click", saveConfig);
  document
    .getElementById("rotateSecretBtn")
    .addEventListener("click", rotateSecret);
  document.getElementById("deleteKeyBtn").addEventListener("click", deleteKey);

  renderChart(key.chartData);
}

async function loadChartData(duration) {
  document.getElementById("chartLoading").classList.add("visible");

  const data = await api(
    "GET",
    `/keys/${selectedKey.siteKey}?chartDuration=${duration}`,
  );

  document.getElementById("chartLoading").classList.remove("visible");

  if (data.chartData) {
    renderChart(data.chartData);
  }
}

function renderChart(chartData) {
  const canvas = document.getElementById("chart");
  const ctx = canvas.getContext("2d");

  if (chart) chart.destroy();

  const { data, duration } = chartData;
  const now = Math.floor(Date.now() / 1000);

  const labels = [];
  const values = [];

  const dataMap = new Map(data.map((d) => [d.bucket, d.count]));

  if (duration === "today") {
    const startTime = Math.floor(Date.now() / 1000 / 86400) * 86400;
    const buckets = Math.ceil((now - startTime) / 3600) + 1;
    for (let i = 0; i < buckets; i++) {
      const t = startTime + i * 3600;
      labels.push(
        new Date(t * 1000).toLocaleTimeString("en-US", {
          hour: "numeric",
          hour12: true,
        }),
      );
      values.push(dataMap.get(t) || 0);
    }
  } else if (duration === "yesterday") {
    const startTime = Math.floor(Date.now() / 1000 / 86400) * 86400 - 86400;
    for (let i = 0; i < 24; i++) {
      const t = startTime + i * 3600;
      labels.push(
        new Date(t * 1000).toLocaleTimeString("en-US", {
          hour: "numeric",
          hour12: true,
        }),
      );
      values.push(dataMap.get(t) || 0);
    }
  } else {
    data.forEach((d) => {
      labels.push(
        new Date(d.bucket * 1000).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        }),
      );
      values.push(d.count || 0);
    });
  }

  chart = new Chart(ctx, {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          data: values,
          fill: true,
          backgroundColor: "rgba(137, 180, 250, 0.15)",
          borderColor: "#89b4fa",
          borderWidth: 2,
          pointRadius: 0,
          pointHoverRadius: 4,
          pointHoverBackgroundColor: "#89b4fa",
          tension: 0.3,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 300 },
      interaction: { mode: "index", intersect: false },
      scales: {
        x: {
          grid: { display: false },
          ticks: { color: "#6c7086", maxTicksLimit: 8 },
        },
        y: {
          beginAtZero: true,
          grid: { color: "rgba(108, 112, 134, 0.1)" },
          ticks: { color: "#6c7086" },
        },
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: "#1e1e2e",
          titleColor: "#cdd6f4",
          bodyColor: "#cdd6f4",
          borderColor: "#313244",
          borderWidth: 1,
          padding: 10,
          displayColors: false,
          callbacks: {
            label: (ctx) => `${ctx.raw} solutions`,
          },
        },
      },
    },
  });
}

async function saveConfig() {
  const btn = document.getElementById("saveConfigBtn");
  btn.disabled = true;

  const name = document.getElementById("cfgName").value.trim();
  const difficulty = parseInt(
    document.getElementById("cfgDifficulty").value,
    10,
  );
  const challengeCount = parseInt(
    document.getElementById("cfgChallengeCount").value,
    10,
  );
  const saltSize = parseInt(document.getElementById("cfgSaltSize").value, 10);

  if (!name || difficulty < 2 || challengeCount < 1 || saltSize < 7) {
    showModal(
      "Validation Error",
      `<div class="modal-body"><p>Please check your input values. Difficulty must be ≥2, challenge count ≥1, and salt size ≥7.</p></div>`,
    );
    btn.disabled = false;
    return;
  }

  const res = await api("PUT", `/keys/${selectedKey.siteKey}/config`, {
    name,
    difficulty,
    challengeCount,
    saltSize,
  });

  btn.disabled = false;

  if (res.success) {
    await loadKeys();
    selectedKey.name = name;
    selectedKey.config = { difficulty, challengeCount, saltSize };
    document.querySelector(".key-header h1").textContent = name;
    renderKeysList(searchInput.value);
  } else {
    showModal(
      "Error",
      `<div class="modal-body"><p>Failed to save configuration.</p></div>`,
    );
  }
}

function rotateSecret() {
  showConfirmModal(
    "Rotate Secret?",
    "This will generate a new secret key. Your existing integrations will stop working until updated.",
    "Rotate",
    async () => {
      const res = await api(
        "POST",
        `/keys/${selectedKey.siteKey}/rotate-secret`,
      );
      if (res.secretKey) {
        showModal(
          "Rotated secret key",
          `
          <div class="modal-body">
            <div class="modal-field">
              <label>New secret key</label>
              <input type="text" value="${res.secretKey}" readonly onclick="this.select()">
              <p class="hint">Make sure to copy this - it won't be shown again.</p>
            </div>
          </div>
        `,
        );
      } else {
        showModal(
          "Error",
          `<div class="modal-body"><p>Failed to rotate secret key.</p></div>`,
        );
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
        showModal(
          "Error",
          `<div class="modal-body"><p>Failed to delete key.</p></div>`,
        );
      }
    },
    true,
  );
}

function createModal(title, content, isSettings = false) {
  closeModal();
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.innerHTML = `
    <div class="modal ${isSettings ? "settings-modal" : ""}">
      <div class="modal-header">
        <h2>${title}</h2>
        <button class="modal-close">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>
      ${content}
    </div>
  `;
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
    overlay.style.opacity = "0";
    overlay.querySelector(".modal").style.transform =
      "scale(0.95) translateY(10px)";
    overlay.querySelector(".modal").style.filter = "blur(2px)";
    document.removeEventListener("keydown", escapeHandler);

    setTimeout(() => {
      overlay.remove();
    }, 150);
  }
}

function showModal(title, content) {
  createModal(title, content);
}

function showConfirmModal(
  title,
  message,
  confirmText,
  onConfirm,
  isDanger = false,
) {
  const modal = createModal(
    title,
    `
    <div class="modal-body">
      <p>${message}</p>
    </div>
    <div class="modal-footer">
      <button class="modal-btn secondary" id="cancelBtn">Cancel</button>
      <button class="modal-btn ${isDanger ? "danger" : "primary"}" id="confirmBtn">${confirmText}</button>
    </div>
  `,
  );

  modal.querySelector("#cancelBtn").addEventListener("click", () => {
    closeModal();
  });
  modal.querySelector("#confirmBtn").addEventListener("click", async () => {
    modal.querySelector("#confirmBtn").disabled = true;
    await onConfirm();
    closeModal();
  });
}

function openCreateKeyModal(prefill = "") {
  const placeholder = randKey();

  const modal = createModal(
    "Create key",
    `
    <div class="modal-body">
      <div class="modal-field">
        <label for="newKeyName">Key name</label>
        <input type="text" id="newKeyName" placeholder="${placeholder}" value="${escapeHtml(prefill || placeholder)}" autofocus>
      </div>
    </div>
    <div class="modal-footer">
      <button class="modal-btn secondary" onclick="closeModal()">Cancel</button>
      <button class="modal-btn primary" id="createKeySubmit">Create</button>
    </div>
  `,
  );

  const input = modal.querySelector("#newKeyName");
  const submitBtn = modal.querySelector("#createKeySubmit");

  input.select();

  input.focus();
  input.addEventListener("input", () => {
    submitBtn.disabled = !input.value.trim();
  });

  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && input.value.trim()) {
      submitBtn.click();
    }
  });

  submitBtn.addEventListener("click", async () => {
    submitBtn.disabled = true;
    const res = await api("POST", "/keys", { name: input.value.trim() });

    if (res.siteKey && res.secretKey) {
      closeModal();
      showModal(
        "Key created",
        `
        <div class="modal-body">
          <div class="modal-field">
            <label>Site key</label>
            <input type="text" value="${res.siteKey}" readonly onclick="this.select()">
          </div>
          <div class="modal-field">
            <label>Secret key</label>
            <input type="text" value="${res.secretKey}" readonly onclick="this.select()">
            <p class="hint">Make sure to copy your secret key - it won't be shown again.</p>
          </div>
        </div>
        <div class="modal-footer">
          <button class="modal-btn secondary" onclick="closeModal()">Close</button>
          <button class="modal-btn primary" onclick="closeModal(); selectKey('${res.siteKey}')">Open key</button>
        </div>
      `,
      );
      await loadKeys();
      selectKey(res.siteKey);
    } else {
      showModal(
        "Error",
        `<div class="modal-body"><p>Failed to create key.</p></div>`,
      );
    }
  });
}

async function openSettings() {
  const modal = createModal(
    "Settings",
    `
    <div class="settings-tabs">
      <button class="settings-tab active" data-tab="sessions">Sessions</button>
      <button class="settings-tab" data-tab="apikeys">API keys</button>
      <button class="settings-tab" data-tab="about">About</button>
    </div>
    <div class="settings-content">
      <div class="settings-section active" id="sessionsSection">
        <div id="sessionsList">Loading...</div>
      </div>
      <div class="settings-section" id="apikeysSection">
        <div style="display:flex;justify-content:flex-end;margin-bottom:12px">
          <button class="create-btn" id="createApiKeyBtn">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
              <path d="M12 5v14M5 12h14"/>
            </svg>
            Create
          </button>
        </div>
        <div id="apikeysList">Loading...</div>
      </div>
      <div class="settings-section" id="aboutSection">
        <img src="https://capjs.js.org/logo.png" alt="Cap logo" loading="lazy" class="about-logo" draggable="false">
        <p class="about-info" id="aboutInfo">Loading...</p>
        <a href="https://github.com/tiagozip/cap" target="_blank" class="github-link">
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
          </svg>
          Star on GitHub
        </a>
      </div>
    </div>
  `,
    true,
  );

  modal.querySelectorAll(".settings-tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      modal.querySelectorAll(".settings-tab").forEach((t) => {
        t.classList.remove("active");
      });
      modal.querySelectorAll(".settings-section").forEach((s) => {
        s.classList.remove("active");
      });
      tab.classList.add("active");
      modal.querySelector(`#${tab.dataset.tab}Section`).classList.add("active");
    });
  });

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
            ${currentHash.endsWith(s.token) ? '<span class="current">Current</span> • ' : ""}
            expires ${formatRelative(s.expires)}
          </div>
        </div>
        <button class="session-action" data-token="${s.token}">Logout</button>
      </div>
    `,
      )
      .join("");

    document.querySelectorAll(".session-action").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const token = btn.dataset.token;

        if (!currentHash.endsWith(token)) {
          btn.parentElement.remove();
        }

        await api("POST", "/logout", { session: token });
        if (currentHash.endsWith(token)) {
          localStorage.removeItem("cap_auth");
          document.cookie =
            "cap_authed=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
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
            <div class="apikey-meta">${k.id.slice(0, 12)}... • created ${formatRelative(k.created)}</div>
          </div>
          <button class="apikey-action" data-id="${k.id}">Delete</button>
        </div>
      `,
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
    document.getElementById("aboutInfo").innerHTML = `
      Standalone <b>v${about.ver}</b><br>Bun <b>v${about.bun}</b>
    `;
  }
}

function openCreateApiKeyModal() {
  const placeholder = randKey();

  const modal = createModal(
    "Create API Key",
    `
    <div class="modal-body">
      <div class="modal-field">
        <label for="apiKeyName">Key name</label>
        <input type="text" id="apiKeyName" placeholder="${placeholder}" value="${placeholder}">
      </div>
    </div>
    <div class="modal-footer">
      <button class="modal-btn secondary" onclick="closeModal(); openSettings()">Cancel</button>
      <button class="modal-btn primary" id="createApiKeySubmit">Create</button>
    </div>
  `,
  );

  const input = modal.querySelector("#apiKeyName");
  const submitBtn = modal.querySelector("#createApiKeySubmit");

  input.select();

  input.focus();
  input.addEventListener("input", () => {
    submitBtn.disabled = !input.value.trim();
  });

  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && input.value.trim()) {
      submitBtn.click();
    }
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
        `
        <div class="modal-body">
          <div class="modal-field">
            <label>API key</label>
            <input type="text" value="${res.apiKey}" readonly onclick="this.select()">
            <p class="hint">Make sure to copy your API key - it won't be shown again.</p>
          </div>
        </div>
        <div class="modal-footer">
          <button class="modal-btn primary" onclick="closeModal(); openSettings()">Done</button>
        </div>
      `,
      );
    } else {
      showModal(
        "Error",
        `<div class="modal-body"><p>Failed to create API key.</p></div>`,
      );
    }
  });
}

document.getElementById("createKeyBtn").addEventListener("click", () => {
  openCreateKeyModal(searchInput.value.trim());
});

document.getElementById("searchInput").addEventListener("input", (e) => {
  renderKeysList(e.target.value);
});

document.getElementById("settingsBtn").addEventListener("click", openSettings);
init();
