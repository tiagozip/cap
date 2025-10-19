import makeApiRequest from "./api.js";
import initHomepage from "./homepage.js";
import setState from "./state.js";
import { createModal } from "./utils.js";

let currentChart = null;
let currentSiteKey = null;

export default async function loadKeyPage(siteKey) {
  setState("loading");
  currentSiteKey = siteKey;

  try {
    const response = await makeApiRequest("GET", `/keys/${siteKey}`);

    if (!response.success && response.error) {
      throw new Error(response.error);
    }

    displayKeyData(response);
    await loadChartData();
    setupEventListeners();
    setState("keyPage");
  } catch (error) {
    createModal(
      "Error",
      `<div class="content"><p>Failed to load key data: ${error.message}</p></div>`
    );
    setState("homepage");
  }
}

function displayKeyData(data) {
  const { key } = data;

  const titleElement = document.querySelector(".state-key-page .topbar h1");
  titleElement.innerText = key.name;

  const configElement = document.querySelector(".state-key-page .config");
  configElement.querySelector("#keyName").value = key.name;
  configElement.querySelector("#difficulty").value = key.config.difficulty;
  configElement.querySelector("#challengeCount").value =
    key.config.challengeCount;
  configElement.querySelector("#saltSize").value = key.config.saltSize;

  configElement.querySelector("button").onclick = async () => {
    const name = configElement.querySelector("#keyName").value.trim();
    const difficulty = parseInt(
      configElement.querySelector("#difficulty").value,
      10
    );
    const challengeCount = parseInt(
      configElement.querySelector("#challengeCount").value,
      10
    );
    const saltSize = parseInt(
      configElement.querySelector("#saltSize").value,
      10
    );

    if (
      !name ||
      Number.isNaN(difficulty) ||
      Number.isNaN(challengeCount) ||
      Number.isNaN(saltSize)
    ) {
      createModal(
        "Error",
        `<div class="content"><p>Please fill in all fields correctly.</p></div>`
      );

      return;
    }

    if (difficulty <= 1 || challengeCount < 1 || saltSize <= 6) {
      createModal(
        "Validation failed",
        `<div class="content"><p>Difficulty must be greater than 1, challenge count must be greater than zero and salt size must be greater than 6.</p></div>`
      );

      return;
    }

    document.querySelector(".state-key-page h1").textContent =
      configElement.querySelector("#keyName").value;
    configElement.querySelector("button").disabled = true;

    const { success } = await makeApiRequest(
      "PUT",
      `/keys/${key.siteKey}/config`,
      {
        name,
        difficulty,
        challengeCount,
        saltSize,
      }
    );

    if (!success) {
      createModal(
        "Error",
        `<div class="content"><p>Failed to save key.</p></div>`
      );
    }

    configElement.querySelector("button").disabled = false;
  };

  document
    .querySelector(".danger-zone-buttons .delete-key")
    .addEventListener("click", async () => {
      const modal = createModal(
        "Delete key?",
        `<div class="content"><p>Are you sure you want to delete this key? This action cannot be undone.</p></div>
         <button class="delete-confirm-button primary" style="margin-bottom:8px">Yes, delete key</button>
         <button class="delete-cancel-button primary secondary">Cancel</button>`
      );

      document.body.appendChild(modal);

      modal
        .querySelector(".delete-confirm-button")
        .addEventListener("click", async () => {
          modal.querySelector(".delete-confirm-button").disabled = true;
          const { success } = await makeApiRequest(
            "DELETE",
            `/keys/${key.siteKey}`
          );

          document.body.removeChild(modal);

          if (success) {
            initHomepage();
          } else {
            createModal(
              "Error",
              `<div class="content"><p>Failed to delete key</p></div>`
            );
          }
        });

      modal
        .querySelector(".delete-cancel-button")
        .addEventListener("click", () => {
          document.body.removeChild(modal);
        });
    });

  document
    .querySelector(".danger-zone-buttons .rotate-secret")
    .addEventListener("click", async () => {
      const modal = createModal(
        "Rotate secret key?",
        `<div class="content"><p>Are you sure you want to rotate this key's secret? This won't delete the key itself.</p></div>
       <button class="rotate-confirm-button primary" style="margin-bottom:8px">Yes, rotate key</button>
       <button class="rotate-cancel-button primary secondary">Cancel</button>`
      );

      modal
        .querySelector(".rotate-confirm-button")
        .addEventListener("click", async () => {
          modal.querySelector(".rotate-confirm-button").disabled = true;
          const { secretKey } = await makeApiRequest(
            "POST",
            `/keys/${key.siteKey}/rotate-secret`
          );

          document.body.removeChild(modal);

          if (!secretKey) {
            createModal(
              "Error",
              `<div class="content"><p>Failed to rotate key secret.</p></div>`
            );
            return;
          }
          const successModal = createModal(
            "Secret key rotated",
            `<div class="content">
              <label for="secret-key">New secret key</label>
              <input type="text" name="secret-key" value="${secretKey}" readonly>

             <p class="small-text">Make sure to copy your secret key as it will not be shown again later.</p>
          </div>

          <button class="close-small-button primary secondary">Close</button>`
          );

          successModal
            .querySelector(".close-small-button")
            .addEventListener("click", () => {
              document.body.removeChild(successModal);
            });
        });

      modal
        .querySelector(".rotate-cancel-button")
        .addEventListener("click", () => {
          document.body.removeChild(modal);
        });
    });

  const copyButton = document.querySelector(".state-key-page .topbar button");
  copyButton.innerHTML = `<svg  xmlns="http://www.w3.org/2000/svg"  width="16"  height="16"  viewBox="0 0 24 24"  fill="none"  stroke="currentColor"  stroke-width="2"  stroke-linecap="round"  stroke-linejoin="round"  class="icon icon-tabler icons-tabler-outline icon-tabler-copy"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M7 7m0 2.667a2.667 2.667 0 0 1 2.667 -2.667h8.666a2.667 2.667 0 0 1 2.667 2.667v8.666a2.667 2.667 0 0 1 -2.667 2.667h-8.666a2.667 2.667 0 0 1 -2.667 -2.667z" /><path d="M4.012 16.737a2.005 2.005 0 0 1 -1.012 -1.737v-10c0 -1.1 .9 -2 2 -2h10c.75 0 1.158 .385 1.5 1" /></svg>  Copy site key`;

  copyButton.onclick = async () => {
    try {
      await navigator.clipboard.writeText(key.siteKey);
      const originalText = copyButton.innerHTML;
      copyButton.innerHTML = `<svg  xmlns="http://www.w3.org/2000/svg"  width="16"  height="16"  viewBox="0 0 24 24"  fill="none"  stroke="currentColor"  stroke-width="2"  stroke-linecap="round"  stroke-linejoin="round"  class="icon icon-tabler icons-tabler-outline icon-tabler-check"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M5 12l5 5l10 -10" /></svg> Copied!`;
      setTimeout(() => {
        copyButton.innerHTML = originalText;
      }, 2000);
    } catch {
      createModal(
        "Site key",
        `<div class="content"><p class="small">We couldn't automatically copy your site key to your clipboard. Please copy it manually.</p><label for="site-key">Site key</label><input type="text" name="site-key" value="${key.siteKey}" readonly></div>`
      );
    }
  };
}

async function loadChartData(duration = "today") {
  document.querySelector(".chart-container").style.opacity = "0.3";
  document.querySelector(".chart-container").style.pointerEvents = "none";

  const response = await makeApiRequest(
    "GET",
    `/keys/${currentSiteKey}?chartDuration=${duration}`
  );

  document.querySelector(".chart-container").style.opacity = "1";
  document.querySelector(".chart-container").style.pointerEvents = "all";

  renderChart(response.chartData, duration);
}

function formatDateLabel(timestamp, duration) {
  const date = new Date(timestamp * 1000);

  switch (duration) {
    case "today":
    case "yesterday":
      return date.toLocaleTimeString("en-US", {
        hour: "numeric",
        hour12: true,
      });
    case "last7days":
    case "last28days":
    case "last91days":
    case "alltime":
      return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });
    default:
      return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });
  }
}

function renderChart(chartData, duration) {
  const canvas = document.getElementById("chart");
  const ctx = canvas.getContext("2d");

  if (currentChart) {
    currentChart.destroy();
  }

  const labels = [];
  const dataPoints = [];

  const { bucketSize, data } = chartData;
  const now = Math.floor(Date.now() / 1000);

  let startTime, endTime, buckets;

  switch (duration) {
    case "today":
      startTime = Math.floor(Date.now() / 1000 / 86400) * 86400;
      endTime = startTime + 86400;
      buckets = Math.floor((endTime - startTime) / bucketSize);
      break;
    case "yesterday":
      startTime = Math.floor(Date.now() / 1000 / 86400) * 86400 - 86400;
      endTime = startTime + 86400;
      buckets = Math.floor((endTime - startTime) / bucketSize);
      break;
    case "last7days":
      startTime = now - 7 * 86400;
      endTime = now;
      buckets = 7;
      break;
    case "last28days":
      startTime = now - 28 * 86400;
      endTime = now;
      buckets = 28;
      break;
    case "last91days":
      startTime = now - 91 * 86400;
      endTime = now;
      buckets = 91;
      break;
    case "alltime":
      if (data.length > 0) {
        startTime = data[0].bucket;
        endTime = now;
        buckets = Math.ceil((endTime - startTime) / bucketSize);
      } else {
        startTime = now - 86400;
        endTime = now;
        buckets = 1;
      }
      break;
    default:
      startTime = now - 86400;
      endTime = now;
      buckets = 24;
  }

  const dataMap = new Map();
  data.forEach((item) => {
    dataMap.set(item.bucket, item.count);
  });

  for (let i = 0; i < buckets; i++) {
    const bucketTime = startTime + i * bucketSize;
    labels.push(formatDateLabel(bucketTime, duration));

    const alignedBucket = Math.floor(bucketTime / bucketSize) * bucketSize;
    dataPoints.push(dataMap.get(alignedBucket) || 0);
  }
  currentChart = new Chart(ctx, {
    type: "line",
    data: {
      labels: labels,
      datasets: [
        {
          label: "Solutions",
          data: dataPoints,
          fill: true,
          backgroundColor: "rgba(59, 130, 246, 0.5)",
          borderColor: "#3b82f6",
          borderWidth: 1,
          pointRadius: 0,
          pointBackgroundColor: "#3b82f6",
          pointBorderColor: "#3b82f6",
          pointHoverBorderWidth: 0,
          pointHoverRadius: 3,
          pointHoverBackgroundColor: "#3b82f6",
          tension: 0.4,
          animation: {
            duration: 0
          }
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: "index",
        intersect: false,
      },
      scales: {
        x: {
          grid: {
            drawOnChartArea: false,
          },
          ticks: {
            color: "#9ca3af",
          },
        },
        y: {
          beginAtZero: true,
          grid: {
            color: "rgba(255, 255, 255, 0.05)",
            drawBorder: false, 
          },
          ticks: {
            color: "#9ca3af",
          },
        },
      },
      plugins: {
        legend: {
          display: false,
        },
        tooltip: {
          enabled: true,
          displayColors: false,
          backgroundColor: "#161718",
          titleColor: "#e5e7eb",
          bodyColor: "#e5e7eb",
          padding: 5,
          borderColor: "#1F2021",
          borderWidth: 1,
          callbacks: {
            label: (context) => {
              return `${context.raw} solutions`;
            },
          },
        },
      },
      animation: {
        duration: 0,
      },
    },
  });

  const resizeObserver = new ResizeObserver(() => {
    if (currentChart) {
      currentChart.update("resize");
    }
  });

  resizeObserver.observe(canvas);
}

function setupEventListeners() {
  const timeDurationSelect = document.querySelector(
    ".state-key-page .time-duration"
  );

  timeDurationSelect.onchange = (e) => {
    const duration = e.target.value;
    loadChartData(duration);
  };
}
