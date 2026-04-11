// ============================================================
// app.js — Financial Market Ticker Dashboard
// Author: Gavit Priyanshu Bhimsing (Frontend & Visualization Lead)
// Sprint 2: US-8 Candlestick Chart, US-10 Timeframe Selection
// Sprint 3: US-9 Multi-Asset Comparison, US-6 Alert UI
// Sprint 4: US-11 EMA/RSI Technical Indicators, US-12 Responsive UI
// ============================================================

const BACKEND_URL = "https://13.234.113.78";

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

function getTimeConfig(tf) {
  if (tf >= 1440) return { unit: "day",    stepSize: 30 };
  if (tf >= 60)   return { unit: "hour",   stepSize: 24 };
  if (tf >= 5)    return { unit: "minute", stepSize: 120 };
  return            { unit: "minute", stepSize: 10 };
}

// ── DOM references ──────────────────────────────────────────
const priceBox      = document.getElementById("priceBox");
const tfSelectorDiv = document.getElementById("tfSelector");
const assetSelector = document.getElementById("assetSelector");
const canvas        = document.getElementById("chart");
const rsiCanvas     = document.getElementById("rsiChart");
const alertForm     = document.getElementById("alertForm");
const alertList     = document.getElementById("alertList");
const alertHistory  = document.getElementById("alertHistory");

// ── State ───────────────────────────────────────────────────
let chartInstance    = null;
let rsiChartInstance = null;
let selectedTf       = loadTfFromStorage();
let lastTfUsed       = null;
let lastAssetCount   = 0;
let selectedAssets   = loadAssetsFromStorage();
let historicalCache  = {};

// US-11: indicator toggle state
let showEMA20 = loadIndicator("showEMA20", true);
let showEMA50 = loadIndicator("showEMA50", true);
let showRSI   = loadIndicator("showRSI",   true);

// ── localStorage helpers ────────────────────────────────────
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

function loadIndicator(key, def) {
  const saved = localStorage.getItem(key);
  return saved !== null ? saved === "true" : def;
}
function saveIndicator(key, val) {
  localStorage.setItem(key, String(val));
}

// ── Chart destroy ────────────────────────────────────────────
function destroyChart() {
  if (chartInstance) { chartInstance.destroy(); chartInstance = null; }
  const existing = Chart.getChart(canvas);
  if (existing) existing.destroy();
  lastTfUsed     = null;
  lastAssetCount = 0;
}

function destroyRSI() {
  if (rsiChartInstance) { rsiChartInstance.destroy(); rsiChartInstance = null; }
  const existing = Chart.getChart(rsiCanvas);
  if (existing) existing.destroy();
}

// ── Candle merge ────────────────────────────────────────────
function mergeCandles(historical, live) {
  if (!live || live.length === 0) return historical;
  if (!historical || historical.length === 0) return live;
  const liveStart   = live[0].time;
  const baseCandles = historical.filter(c => c.time < liveStart);
  return [...baseCandles, ...live];
}

// ============================================================
// US-11: Technical Indicator Calculations
// ============================================================

// EMA — Exponential Moving Average
function calcEMA(candles, period) {
  if (candles.length < period) return [];
  const k      = 2 / (period + 1);
  const result = [];
  let ema      = candles.slice(0, period).reduce((s, c) => s + c.close, 0) / period;
  result.push({ x: candles[period - 1].time, y: parseFloat(ema.toFixed(2)) });
  for (let i = period; i < candles.length; i++) {
    ema = candles[i].close * k + ema * (1 - k);
    result.push({ x: candles[i].time, y: parseFloat(ema.toFixed(2)) });
  }
  return result;
}

// RSI — Relative Strength Index (period 14)
function calcRSI(candles, period = 14) {
  if (candles.length < period + 1) return [];
  const result = [];
  let gains = 0, losses = 0;

  // Initial average
  for (let i = 1; i <= period; i++) {
    const diff = candles[i].close - candles[i - 1].close;
    if (diff >= 0) gains  += diff;
    else           losses -= diff;
  }
  let avgGain = gains  / period;
  let avgLoss = losses / period;

  const rsi = avgLoss === 0 ? 100 : 100 - (100 / (1 + avgGain / avgLoss));
  result.push({ x: candles[period].time, y: parseFloat(rsi.toFixed(2)) });

  // Smoothed RSI (Wilder's method)
  for (let i = period + 1; i < candles.length; i++) {
    const diff = candles[i].close - candles[i - 1].close;
    const gain = diff > 0 ? diff : 0;
    const loss = diff < 0 ? -diff : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    const r = avgLoss === 0 ? 100 : 100 - (100 / (1 + avgGain / avgLoss));
    result.push({ x: candles[i].time, y: parseFloat(r.toFixed(2)) });
  }
  return result;
}

// ============================================================
// US-11: Indicator Toggle UI
// ============================================================
function buildIndicatorToggles() {
  const container = document.getElementById("indicatorToggles");
  if (!container) return;

  const indicators = [
    { key: "showEMA20", label: "EMA 20", color: "#3b82f6", get: () => showEMA20, set: v => { showEMA20 = v; } },
    { key: "showEMA50", label: "EMA 50", color: "#f97316", get: () => showEMA50, set: v => { showEMA50 = v; } },
    { key: "showRSI",   label: "RSI 14", color: "#a855f7", get: () => showRSI,   set: v => { showRSI   = v; } },
  ];

  container.innerHTML = "";
  indicators.forEach(({ key, label, color, get, set }) => {
    const btn = document.createElement("button");
    btn.className   = "indicator-btn" + (get() ? " active" : "");
    btn.textContent = label;
    btn.style.setProperty("--ind-color", color);

    btn.addEventListener("click", () => {
      const newVal = !get();
      set(newVal);
      saveIndicator(key, newVal);
      btn.classList.toggle("active", newVal);
      // Rebuild chart with updated indicators
      destroyChart();
      destroyRSI();
      loadCandleChart();
    });

    container.appendChild(btn);
  });
}

// ============================================================
// Timeframe Selector (US-10)
// ============================================================
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
      destroyRSI();
      await loadCandleChart();
    });
    tfSelectorDiv.appendChild(btn);
  });
}

// ============================================================
// Asset Selector (US-9)
// ============================================================
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
      destroyRSI();
      await loadCandleChart();
    });
    assetSelector.appendChild(btn);
  });
}

// ============================================================
// Live Price Box (US-8)
// ============================================================
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

// ============================================================
// Multi-asset normalization (US-9)
// ============================================================
function normalizeToPercent(candles) {
  if (!candles || candles.length === 0) return [];
  const base = candles[0].close;
  return candles.map(c => ({
    x:        c.time,
    y:        ((c.close - base) / base) * 100,
    rawPrice: c.close,
  }));
}

// ============================================================
// Build main chart config
// ============================================================
function buildChartConfig(datasets, isSingle) {
  const { unit, stepSize } = getTimeConfig(selectedTf);
  return {
    type: isSingle ? "candlestick" : "line",
    data: { datasets },
    options: {
      responsive:          true,
      maintainAspectRatio: false,
      animation:           false,
      interaction:         { mode: "index", intersect: false },
      scales: {
        x: {
          type: "time",
          time: {
            unit, stepSize,
            displayFormats: { minute: "HH:mm", hour: "MMM d HH:mm", day: "MMM d" },
          },
          ticks: { color: "#aaa", maxRotation: 0, autoSkip: true },
          grid:  { color: "rgba(255,255,255,0.05)" },
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
          display: !isSingle || (showEMA20 || showEMA50),
          labels:  { color: "#e8eaf0", font: { family: "'IBM Plex Mono'" }, boxWidth: 24 }
        },
        zoom: {
          pan:  { enabled: false },
          zoom: { wheel: { enabled: true, speed: 0.1 }, pinch: { enabled: true }, mode: "x" },
        },
        tooltip: {
          callbacks: {
            label: item => {
              if (item.dataset.type === "candlestick" || (isSingle && item.dataset.label === "BTC")) {
                const d = item.raw;
                if (d && d.o !== undefined) {
                  return [
                    `Open:  $${Number(d.o).toLocaleString()}`,
                    `High:  $${Number(d.h).toLocaleString()}`,
                    `Low:   $${Number(d.l).toLocaleString()}`,
                    `Close: $${Number(d.c).toLocaleString()}`,
                  ];
                }
              }
              if (!isSingle && item.raw && item.raw.rawPrice !== undefined) {
                return `${item.dataset.label}: $${Number(item.raw.rawPrice).toLocaleString()} (${Number(item.raw.y).toFixed(2)}%)`;
              }
              return `${item.dataset.label}: $${Number(item.raw.y || item.parsed.y).toLocaleString()}`;
            },
          },
        },
      },
    },
  };
}

// ============================================================
// Build RSI chart config
// ============================================================
function buildRSIConfig(rsiData) {
  const { unit, stepSize } = getTimeConfig(selectedTf);
  return {
    type: "line",
    data: {
      datasets: [
        {
          label:       "RSI 14",
          data:        rsiData,
          borderColor: "#a855f7",
          borderWidth: 1.5,
          pointRadius: 0,
          tension:     0.2,
          fill:        false,
        },
        // Overbought line at 70
        {
          label:       "Overbought (70)",
          data:        rsiData.map(d => ({ x: d.x, y: 70 })),
          borderColor: "rgba(239,83,80,0.5)",
          borderWidth: 1,
          borderDash:  [4, 4],
          pointRadius: 0,
          fill:        false,
        },
        // Oversold line at 30
        {
          label:       "Oversold (30)",
          data:        rsiData.map(d => ({ x: d.x, y: 30 })),
          borderColor: "rgba(38,166,154,0.5)",
          borderWidth: 1,
          borderDash:  [4, 4],
          pointRadius: 0,
          fill:        false,
        },
      ],
    },
    options: {
      responsive:          true,
      maintainAspectRatio: false,
      animation:           false,
      interaction:         { mode: "index", intersect: false },
      scales: {
        x: {
          type: "time",
          time: { unit, stepSize, displayFormats: { minute: "HH:mm", hour: "MMM d HH:mm", day: "MMM d" } },
          ticks: { color: "#aaa", maxRotation: 0, autoSkip: true },
          grid:  { color: "rgba(255,255,255,0.05)" },
        },
        y: {
          min:   0,
          max:   100,
          ticks: { color: "#aaa", stepSize: 20 },
          grid:  { color: "rgba(255,255,255,0.08)" },
        },
      },
      plugins: {
        legend: {
          display: true,
          labels:  { color: "#e8eaf0", font: { family: "'IBM Plex Mono'", size: 10 }, boxWidth: 16 }
        },
      },
    },
  };
}

// ============================================================
// Main chart load — candlestick + EMA overlays + RSI panel
// ============================================================
async function loadCandleChart() {
  try {
    const wrapper  = document.querySelector(".chart-wrapper");
    const limit    = TF_LIMITS[selectedTf] || 120;
    const isSingle = selectedAssets.length === 1;
    const datasets = [];
    let   btcCandles = [];

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
        merged        = mergeCandles(historicalCache[cacheKey], live);
        btcCandles    = merged; // save for indicators
      }

      const asset = ASSETS.find(a => a.symbol === symbol);

      if (isSingle) {
        datasets.push({
          label: asset.label,
          data:  merged.map(c => ({ x: c.time, o: c.open, h: c.high, l: c.low, c: c.close })),
          color:       { up: "#26a69a", down: "#ef5350", unchanged: "#999" },
          borderColor: { up: "#26a69a", down: "#ef5350", unchanged: "#999" },
        });

        // US-11: Add EMA overlays (single asset only)
        if (showEMA20) {
          const ema20 = calcEMA(merged, 20);
          datasets.push({
            label:       "EMA 20",
            data:        ema20,
            borderColor: "#3b82f6",
            borderWidth: 1.5,
            pointRadius: 0,
            tension:     0.3,
            fill:        false,
            type:        "line",
          });
        }
        if (showEMA50) {
          const ema50 = calcEMA(merged, 50);
          datasets.push({
            label:       "EMA 50",
            data:        ema50,
            borderColor: "#f97316",
            borderWidth: 1.5,
            pointRadius: 0,
            tension:     0.3,
            fill:        false,
            type:        "line",
          });
        }
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

    // Build/update main chart
    const needsRebuild = !chartInstance
      || lastTfUsed     !== selectedTf
      || lastAssetCount !== selectedAssets.length;

    if (!needsRebuild) {
      datasets.forEach((ds, i) => {
        if (chartInstance.data.datasets[i])
          chartInstance.data.datasets[i].data = ds.data;
      });
      chartInstance.update("none");
    } else {
      destroyChart();
      chartInstance  = new Chart(canvas, buildChartConfig(datasets, isSingle));
      lastTfUsed     = selectedTf;
      lastAssetCount = selectedAssets.length;
    }

    // US-11: RSI panel — only for single BTC asset
    const rsiWrapper = document.getElementById("rsiWrapper");
    if (isSingle && showRSI && btcCandles.length > 15) {
      const rsiData = calcRSI(btcCandles);
      if (rsiWrapper) rsiWrapper.style.display = "block";
      destroyRSI();
      rsiChartInstance = new Chart(rsiCanvas, buildRSIConfig(rsiData));
    } else {
      if (rsiWrapper) rsiWrapper.style.display = "none";
      destroyRSI();
    }

  } catch (err) {
    console.error("Chart error:", err);
  }
}

// ============================================================
// Alert UI (US-6)
// ============================================================
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

// ============================================================
// Boot sequence
// ============================================================
buildTfSelector();
buildAssetSelector();
buildIndicatorToggles();
updatePrice();
loadCandleChart();
loadAlerts();
loadAlertHistory();

if (alertForm) alertForm.addEventListener("submit", createAlert);

setInterval(updatePrice,      2000);
setInterval(loadCandleChart,  5000);
setInterval(loadAlerts,      10000);
setInterval(loadAlertHistory, 15000);

// ============================================================
// Zoom controls
// ============================================================
function zoomIn()    { if (chartInstance) chartInstance.zoom(1.2); }
function zoomOut()   { if (chartInstance) chartInstance.zoom(0.8); }
function resetZoom() { if (chartInstance) chartInstance.resetZoom(); }

// ============================================================
// Manual pan — drag in any direction
// ============================================================
(function setupPan() {
  let isDragging = false;
  let dragStartX = 0, dragStartY = 0;
  let startXMin  = 0, startXMax  = 0;
  let startYMin  = 0, startYMax  = 0;

  function onMouseDown(e) {
    if (!chartInstance) return;
    isDragging = true;
    dragStartX = e.clientX;
    dragStartY = e.clientY;
    const xs = chartInstance.scales.x;
    const ys = chartInstance.scales.y;
    startXMin = xs.min; startXMax = xs.max;
    startYMin = ys.min; startYMax = ys.max;
    e.currentTarget.style.cursor = "grabbing";
    e.preventDefault();
  }

  function onMouseMove(e) {
    if (!isDragging || !chartInstance) return;
    const xs     = chartInstance.scales.x;
    const ys     = chartInstance.scales.y;
    const dx     = e.clientX - dragStartX;
    const dy     = e.clientY - dragStartY;
    const xRange = startXMax - startXMin;
    const yRange = startYMax - startYMin;
    const xPx    = xs.right  - xs.left;
    const yPx    = ys.bottom - ys.top;
    const xDelta = (dx / xPx) * xRange;
    const yDelta = (dy / yPx) * yRange;

    chartInstance.zoomScale("x", { min: startXMin - xDelta, max: startXMax - xDelta }, "none");
    chartInstance.zoomScale("y", { min: startYMin + yDelta, max: startYMax + yDelta }, "none");
    chartInstance.update("none");
  }

  function onMouseUp(e) {
    isDragging = false;
    if (e.currentTarget) e.currentTarget.style.cursor = "grab";
  }

  // Touch support (US-12)
  function onTouchStart(e) {
    if (e.touches.length !== 1) return;
    isDragging = true;
    dragStartX = e.touches[0].clientX;
    dragStartY = e.touches[0].clientY;
    if (!chartInstance) return;
    const xs = chartInstance.scales.x;
    const ys = chartInstance.scales.y;
    startXMin = xs.min; startXMax = xs.max;
    startYMin = ys.min; startYMax = ys.max;
  }

  function onTouchMove(e) {
    if (!isDragging || !chartInstance || e.touches.length !== 1) return;
    e.preventDefault();
    const xs     = chartInstance.scales.x;
    const ys     = chartInstance.scales.y;
    const dx     = e.touches[0].clientX - dragStartX;
    const dy     = e.touches[0].clientY - dragStartY;
    const xRange = startXMax - startXMin;
    const yRange = startYMax - startYMin;
    const xPx    = xs.right  - xs.left;
    const yPx    = ys.bottom - ys.top;
    const xDelta = (dx / xPx) * xRange;
    const yDelta = (dy / yPx) * yRange;

    chartInstance.zoomScale("x", { min: startXMin - xDelta, max: startXMax - xDelta }, "none");
    chartInstance.zoomScale("y", { min: startYMin + yDelta, max: startYMax + yDelta }, "none");
    chartInstance.update("none");
  }

  function onTouchEnd() { isDragging = false; }

  function attach() {
    const c = document.getElementById("chart");
    if (!c) return;
    c.style.cursor = "grab";
    c.addEventListener("mousedown",  onMouseDown);
    c.addEventListener("mousemove",  onMouseMove);
    c.addEventListener("mouseup",    onMouseUp);
    c.addEventListener("mouseleave", onMouseUp);
    // Touch events for mobile (US-12)
    c.addEventListener("touchstart", onTouchStart, { passive: true });
    c.addEventListener("touchmove",  onTouchMove,  { passive: false });
    c.addEventListener("touchend",   onTouchEnd);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", attach);
  } else {
    attach();
  }
})();
