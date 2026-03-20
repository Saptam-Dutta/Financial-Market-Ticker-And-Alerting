
const BACKEND_URL = "http://localhost:3000";

const TIMEFRAMES = [
  { label: "1m",  tf: 1    },
  { label: "5m",  tf: 5    },
  { label: "1h",  tf: 60   },
  { label: "1d",  tf: 1440 },
];
const DEFAULT_TF = 5;

const ASSETS = [
  { symbol: "BTCUSDT", label: "BTC", color: "#f0b429" },
  { symbol: "ETHUSDT", label: "ETH", color: "#627eea" },
  { symbol: "BNBUSDT", label: "BNB", color: "#2ecc71" },
  { symbol: "SOLUSDT", label: "SOL", color: "#cc44ff" },
];

const TF_LIMITS = { 1: 500, 5: 500, 60: 500, 1440: 365 };

// Correct time unit AND step size per timeframe
function getTimeConfig(tf) {
  // stepSize = interval between tick labels
  // chosen so labels show a clean readable interval:
  // 1m  window = 2hrs    → tick every 10 min
  // 5m  window = 24hrs   → tick every 2 hours
  // 1h  window = 7 days  → tick every 24 hours
  // 1d  window = 1 year  → tick every 30 days
  if (tf >= 1440) return { unit: "day",    stepSize: 30 };
  if (tf >= 60)   return { unit: "hour",   stepSize: 24 };
  if (tf >= 5)    return { unit: "minute", stepSize: 120 };
  return            { unit: "minute", stepSize: 10 };
}

const priceBox      = document.getElementById("priceBox");
const tfSelectorDiv = document.getElementById("tfSelector");
const assetSelector = document.getElementById("assetSelector");
const canvas        = document.getElementById("chart");
const alertForm     = document.getElementById("alertForm");
const alertList     = document.getElementById("alertList");
const alertHistory  = document.getElementById("alertHistory");

let chartInstance   = null;
let selectedTf      = loadTfFromStorage();
let lastTfUsed      = null;
let lastAssetCount  = 0;
let selectedAssets  = loadAssetsFromStorage();
let historicalCache = {};

function loadTfFromStorage() {
  const saved = localStorage.getItem("selectedTf");
  return saved ? parseInt(saved) : DEFAULT_TF;
}
function saveTfToStorage(tf) { localStorage.setItem("selectedTf", tf); }
function loadAssetsFromStorage() {
  try {
    const saved = localStorage.getItem("selectedAssets");
    return saved ? JSON.parse(saved) : ["BTCUSDT"];
  } catch { return ["BTCUSDT"]; }
}
function saveAssetsToStorage(assets) {
  localStorage.setItem("selectedAssets", JSON.stringify(assets));
}

function destroyChart() {
  if (chartInstance) { chartInstance.destroy(); chartInstance = null; }
  const existing = Chart.getChart(canvas);
  if (existing) existing.destroy();
  lastTfUsed     = null;
  lastAssetCount = 0;
}

function mergeCandles(historical, live) {
  if (!live || live.length === 0) return historical;
  if (!historical || historical.length === 0) return live;
  const liveStart   = live[0].time;
  const baseCandles = historical.filter(c => c.time < liveStart);
  return [...baseCandles, ...live];
}

// ── Timeframe Selector ──────────────────────────────────────
function buildTfSelector() {
  tfSelectorDiv.innerHTML = "";
  TIMEFRAMES.forEach(({ label, tf }) => {
    const btn = document.createElement("button");
    btn.textContent = label;
    btn.classList.add("tf-btn");
    if (tf === selectedTf) btn.classList.add("active");
    btn.addEventListener("click", async () => {
      if (tf === selectedTf) return;
      selectedTf      = tf;
      saveTfToStorage(tf);
      historicalCache = {};
      document.querySelectorAll(".tf-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      destroyChart();
      await loadCandleChart();
    });
    tfSelectorDiv.appendChild(btn);
  });
}

// ── Asset Selector ──────────────────────────────────────────
function buildAssetSelector() {
  assetSelector.innerHTML = "";
  ASSETS.forEach(({ symbol, label, color }) => {
    const btn = document.createElement("button");
    btn.textContent = label;
    btn.classList.add("asset-btn");
    btn.style.setProperty("--asset-color", color);
    if (selectedAssets.includes(symbol)) btn.classList.add("active");
    btn.addEventListener("click", async () => {
      if (selectedAssets.includes(symbol)) {
        if (selectedAssets.length === 1) return;
        selectedAssets = selectedAssets.filter(s => s !== symbol);
        btn.classList.remove("active");
      } else {
        if (selectedAssets.length >= 4) {
          alert("Maximum 4 assets can be compared simultaneously.");
          return;
        }
        selectedAssets.push(symbol);
        btn.classList.add("active");
      }
      saveAssetsToStorage(selectedAssets);
      historicalCache = {};
      destroyChart();
      await loadCandleChart();
    });
    assetSelector.appendChild(btn);
  });
}

// ── Price Box ───────────────────────────────────────────────
async function updatePrice() {
  try {
    const res  = await fetch(`${BACKEND_URL}/price`);
    const data = await res.json();
    const time = data.time ? new Date(data.time).toLocaleTimeString() : "--";
    priceBox.innerHTML = `
      <span class="ticker-label">BTC / USDT</span>
      <span class="ticker-price">$${data.price
        ? Number(data.price).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
        : "--"}</span>
      <span class="ticker-time">Last update: ${time}</span>
    `;
  } catch {
    priceBox.innerHTML = `<span class="ticker-error">Price unavailable</span>`;
  }
}

// ── Normalize to % but keep rawPrice for tooltip ────────────
function normalizeToPercent(candles) {
  if (!candles || candles.length === 0) return [];
  const base = candles[0].close;
  return candles.map(c => ({
    x:        c.time,
    y:        ((c.close - base) / base) * 100,
    rawPrice: c.close,   // actual price stored for tooltip display
  }));
}

// ── Chart Config ─────────────────────────────────────────────
function buildChartConfig(datasets, isSingle) {
  const { unit, stepSize } = getTimeConfig(selectedTf);

  return {
    type: isSingle ? "candlestick" : "line",
    data: { datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      interaction: { mode: "index", intersect: false },
      scales: {
        x: {
          type: "time",
          time: {
            unit,
            stepSize,
            displayFormats: {
              minute: "HH:mm",
              hour:   "MMM d HH:mm",
              day:    "MMM d",
            },
          },
          ticks: {
            color: "#aaa",
            maxRotation: 0,
            autoSkip: true,
            maxRotation: 0,
          },
          grid: { color: "rgba(255,255,255,0.05)" },
        },
        y: {
          ticks: {
            color: "#aaa",
            callback: val => isSingle
              ? "$" + Number(val).toLocaleString()
              : val.toFixed(2) + "%",
          },
          grid: { color: "rgba(255,255,255,0.08)" },
        },
      },
      plugins: {
        legend: {
          display: !isSingle,
          labels: { color: "#e8eaf0", font: { family: "'IBM Plex Mono'" } }
        },
        tooltip: {
          callbacks: {
            label: item => {
              if (isSingle) {
                const d = item.raw;
                return [
                  `Open:  $${Number(d.o).toLocaleString()}`,
                  `High:  $${Number(d.h).toLocaleString()}`,
                  `Low:   $${Number(d.l).toLocaleString()}`,
                  `Close: $${Number(d.c).toLocaleString()}`,
                ];
              }
              // ← FIXED: show actual price from rawPrice, not % value
              const price = item.raw.rawPrice;
              const pct   = Number(item.raw.y).toFixed(2);
              return `${item.dataset.label}: $${Number(price).toLocaleString()} (${pct}%)`;
            },
          },
        },
      },
    },
  };
}

// ── Load Candle Chart ────────────────────────────────────────
async function loadCandleChart() {
  try {
    const wrapper  = document.querySelector(".chart-wrapper");
    const limit    = TF_LIMITS[selectedTf] || 120;
    const isSingle = selectedAssets.length === 1;
    const datasets = [];

    for (const symbol of selectedAssets) {
      const cacheKey = `${symbol}:${selectedTf}`;

      if (!historicalCache[cacheKey]) {
        const res = await fetch(
          `${BACKEND_URL}/candles/history?tf=${selectedTf}&limit=${limit}&symbol=${symbol}`
        );
        historicalCache[cacheKey] = await res.json();
      }

      let merged = historicalCache[cacheKey];
      if (symbol === "BTCUSDT") {
        const liveRes = await fetch(`${BACKEND_URL}/candles?tf=${selectedTf}`);
        const live    = await liveRes.json();
        merged = mergeCandles(historicalCache[cacheKey], live);
      }

      const asset = ASSETS.find(a => a.symbol === symbol);

      if (isSingle) {
        datasets.push({
          label: asset.label,
          data: merged.map(c => ({ x: c.time, o: c.open, h: c.high, l: c.low, c: c.close })),
          color:       { up: "#26a69a", down: "#ef5350", unchanged: "#999" },
          borderColor: { up: "#26a69a", down: "#ef5350", unchanged: "#999" },
        });
      } else {
        datasets.push({
          label:           asset.label,
          data:            normalizeToPercent(merged),
          borderColor:     asset.color,
          backgroundColor: asset.color + "22",
          borderWidth:     2,
          pointRadius:     0,
          tension:         0.2,
          fill:            false,
        });
      }
    }

    if (datasets.length === 0 || datasets[0].data.length === 0) {
      wrapper.setAttribute("data-empty", "Loading chart data…");
      return;
    }

    wrapper.removeAttribute("data-empty");

    const needsRebuild = !chartInstance
      || lastTfUsed !== selectedTf
      || lastAssetCount !== selectedAssets.length;

    if (!needsRebuild) {
      datasets.forEach((ds, i) => {
        if (chartInstance.data.datasets[i]) {
          chartInstance.data.datasets[i].data = ds.data;
        }
      });
      chartInstance.update("none");
    } else {
      destroyChart();
      chartInstance  = new Chart(canvas, buildChartConfig(datasets, isSingle));
      lastTfUsed     = selectedTf;
      lastAssetCount = selectedAssets.length;
    }

  } catch (err) {
    console.error("Chart error:", err);
  }
}

// ── Alert UI ─────────────────────────────────────────────────
async function loadAlerts() {
  try {
    const res    = await fetch(`${BACKEND_URL}/alerts`);
    const alerts = await res.json();
    alertList.innerHTML = alerts.length === 0
      ? `<p class="alert-empty">No active alerts</p>`
      : alerts.map(a => `
          <div class="alert-item">
            <span class="alert-symbol">${a.symbol}</span>
            <span class="alert-direction ${a.direction}">${a.direction === "above" ? "▲" : "▼"} ${a.direction}</span>
            <span class="alert-price">$${Number(a.price).toLocaleString()}</span>
            <button class="alert-delete" onclick="deleteAlert('${a.id}')">✕</button>
          </div>`
      ).join("");
  } catch {
    alertList.innerHTML = `<p class="alert-empty">Could not load alerts</p>`;
  }
}

async function loadAlertHistory() {
  try {
    const res     = await fetch(`${BACKEND_URL}/alerts/history`);
    const history = await res.json();
    alertHistory.innerHTML = history.length === 0
      ? `<p class="alert-empty">No triggered alerts yet</p>`
      : history.map(a => `
          <div class="alert-item triggered">
            <span class="alert-symbol">${a.symbol}</span>
            <span class="alert-direction ${a.direction}">${a.direction === "above" ? "▲" : "▼"} $${Number(a.price).toLocaleString()}</span>
            <span class="alert-triggered-price">@ $${Number(a.triggeredPrice).toLocaleString()}</span>
            <span class="alert-time">${new Date(a.triggeredAt).toLocaleTimeString()}</span>
          </div>`
      ).join("");
  } catch {
    alertHistory.innerHTML = `<p class="alert-empty">Could not load history</p>`;
  }
}

async function createAlert(e) {
  e.preventDefault();
  const symbol    = document.getElementById("alertSymbol").value;
  const price     = parseFloat(document.getElementById("alertPrice").value);
  const direction = document.getElementById("alertDirection").value;
  if (!price || isNaN(price)) return;
  try {
    const res  = await fetch(`${BACKEND_URL}/alert`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ symbol, price, direction }),
    });
    const data = await res.json();
    if (data.alert) {
      document.getElementById("alertPrice").value = "";
      await loadAlerts();
    }
  } catch (err) {
    console.error("Create alert error:", err);
  }
}

async function deleteAlert(id) {
  try {
    await fetch(`${BACKEND_URL}/alert/${id}`, { method: "DELETE" });
    await loadAlerts();
  } catch (err) {
    console.error("Delete alert error:", err);
  }
}

// ── Boot ─────────────────────────────────────────────────────
buildTfSelector();
buildAssetSelector();
updatePrice();
loadCandleChart();
loadAlerts();
loadAlertHistory();

if (alertForm) alertForm.addEventListener("submit", createAlert);

setInterval(updatePrice,      2000);
setInterval(loadCandleChart,  5000);
setInterval(loadAlerts,      10000);
setInterval(loadAlertHistory,15000);

// ============================================================
// ============================================================
// Zoom controls (+/- buttons)
// ============================================================
function zoomIn()   { if (chartInstance) chartInstance.zoom(1.2); }
function zoomOut()  { if (chartInstance) chartInstance.zoom(0.8); }
function resetZoom(){ if (chartInstance) chartInstance.resetZoom(); }

// ============================================================
// Manual pan — hold left mouse button and drag in any direction
// ============================================================
(function setupPan() {
  let isDragging = false;
  let dragStartX = 0;
  let dragStartY = 0;
  let startXMin  = 0;
  let startXMax  = 0;
  let startYMin  = 0;
  let startYMax  = 0;

  function onMouseDown(e) {
    if (!chartInstance) return;
    isDragging = true;
    dragStartX = e.clientX;
    dragStartY = e.clientY;
    const xs = chartInstance.scales.x;
    const ys = chartInstance.scales.y;
    startXMin = xs.min;   startXMax = xs.max;
    startYMin = ys.min;   startYMax = ys.max;
    e.currentTarget.style.cursor = "grabbing";
    e.preventDefault();
  }

  function onMouseMove(e) {
    if (!isDragging || !chartInstance) return;

    const xs = chartInstance.scales.x;
    const ys = chartInstance.scales.y;

    // Pixel → data unit conversion
    const dx      = e.clientX - dragStartX;
    const dy      = e.clientY - dragStartY;
    const xRange  = startXMax - startXMin;
    const yRange  = startYMax - startYMin;
    const xPx     = xs.right  - xs.left;
    const yPx     = ys.bottom - ys.top;
    const xDelta  = (dx / xPx) * xRange;
    const yDelta  = (dy / yPx) * yRange;

    // Pan x-axis (drag right = go back in time)
    chartInstance.zoomScale("x", {
      min: startXMin - xDelta,
      max: startXMax - xDelta,
    }, "none");

    // Pan y-axis (drag down = see lower prices)
    chartInstance.zoomScale("y", {
      min: startYMin + yDelta,
      max: startYMax + yDelta,
    }, "none");

    chartInstance.update("none");
  }

  function onMouseUp(e) {
    isDragging = false;
    if (e.currentTarget) e.currentTarget.style.cursor = "grab";
  }

  function attach() {
    const c = document.getElementById("chart");
    if (!c) return;
    c.style.cursor = "grab";
    c.addEventListener("mousedown",  onMouseDown);
    c.addEventListener("mousemove",  onMouseMove);
    c.addEventListener("mouseup",    onMouseUp);
    c.addEventListener("mouseleave", onMouseUp);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", attach);
  } else {
    attach();
  }
})();