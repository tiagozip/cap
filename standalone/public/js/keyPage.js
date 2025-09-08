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
			`<div class="content"><p>Failed to load key data: ${error.message}</p></div>`,
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
			10,
		);
		const challengeCount = parseInt(
			configElement.querySelector("#challengeCount").value,
			10,
		);
		const saltSize = parseInt(
			configElement.querySelector("#saltSize").value,
			10,
		);

		if (
			!name ||
			isNaN(difficulty) ||
			isNaN(challengeCount) ||
			isNaN(saltSize)
		) {
			createModal(
				"Error",
				`<div class="content"><p>Please fill in all fields correctly.</p></div>`,
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
			},
		);

		if (!success) {
			createModal(
				"Error",
				`<div class="content"><p>Failed to save key.</p></div>`,
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
         <button class="delete-cancel-button primary secondary">Cancel</button>`,
			);

			document.body.appendChild(modal);

			modal
				.querySelector(".delete-confirm-button")
				.addEventListener("click", async () => {
					modal.querySelector(".delete-confirm-button").disabled = true;
					const { success } = await makeApiRequest(
						"DELETE",
						`/keys/${key.siteKey}`,
					);

					document.body.removeChild(modal);

					if (success) {
						initHomepage();
					} else {
						createModal(
							"Error",
							`<div class="content"><p>Failed to delete key</p></div>`,
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
       <button class="rotate-cancel-button primary secondary">Cancel</button>`,
			);

			modal
				.querySelector(".rotate-confirm-button")
				.addEventListener("click", async () => {
					modal.querySelector(".rotate-confirm-button").disabled = true;
					const { secretKey } = await makeApiRequest(
						"POST",
						`/keys/${key.siteKey}/rotate-secret`,
					);

					document.body.removeChild(modal);

					if (!secretKey) {
						createModal(
							"Error",
							`<div class="content"><p>Failed to rotate key secret.</p></div>`,
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

          <button class="close-small-button primary secondary">Close</button>`,
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

	copyButton.onclick = () => {
		navigator.clipboard.writeText(key.siteKey);
		const originalText = copyButton.innerHTML;
		copyButton.innerHTML = `<svg  xmlns="http://www.w3.org/2000/svg"  width="16"  height="16"  viewBox="0 0 24 24"  fill="none"  stroke="currentColor"  stroke-width="2"  stroke-linecap="round"  stroke-linejoin="round"  class="icon icon-tabler icons-tabler-outline icon-tabler-check"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M5 12l5 5l10 -10" /></svg> Copied!`;
		setTimeout(() => {
			copyButton.innerHTML = originalText;
		}, 2000);
	};
}

async function loadChartData(duration = "today") {
	document.querySelector(".chart-container").style.opacity = "0.3";
	document.querySelector(".chart-container").style.pointerEvents = "none";

	const response = await makeApiRequest(
		"GET",
		`/keys/${currentSiteKey}?chartDuration=${duration}`,
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

	function createGradient(chart) {
		const { ctx, chartArea } = chart;
		if (!chartArea) {
			return null;
		}

		const gradient = ctx.createLinearGradient(
			0,
			chartArea.bottom,
			0,
			chartArea.top,
		);

		gradient.addColorStop(0, "rgba(0, 118, 216, 0.05)");
		gradient.addColorStop(0.5, "rgba(0, 118, 216, 0.3)");
		gradient.addColorStop(1, "rgba(0, 118, 216, 0.7)");

		return gradient;
	}

	currentChart = new Chart(ctx, {
		type: "line",
		data: {
			labels: labels,
			datasets: [
				{
					label: "Daily Count",
					data: dataPoints,
					fill: true,
					backgroundColor: (context) => createGradient(context.chart),
					borderColor: "#007AFF",
					borderWidth: 2,
					pointRadius: 0,
					pointBackgroundColor: "#007AFF",
					pointBorderColor: "#fff",
					pointBorderWidth: 1.5,
					pointHoverRadius: 0,
					pointHoverBackgroundColor: "#fff",
					pointHoverBorderColor: "#007AFF",
					pointHoverBorderWidth: 2,
					tension: 0,
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
						color: "rgba(255, 255, 255, 0.08)",
						borderColor: "rgba(255, 255, 255, 0.15)",
						drawTicks: false,
						drawOnChartArea: false,
					},
					ticks: {
						color: "#b0b0b0",
						maxRotation: 45,
						minRotation: 0,
					},
				},
				y: {
					beginAtZero: true,
					grid: {
						color: "rgba(255, 255, 255, 0.08)",
						borderColor: "rgba(255, 255, 255, 0.15)",
					},
					ticks: {
						color: "#b0b0b0",
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
					callbacks: {
						title: (tooltipItems) => tooltipItems[0].label,
						label: (tooltipItem) => `${tooltipItem.raw} solves`,
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
		".state-key-page .time-duration",
	);

	timeDurationSelect.onchange = (e) => {
		const duration = e.target.value;
		loadChartData(duration);
	};
}
