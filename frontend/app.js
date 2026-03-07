// ============================================================
// app.js — Financial Market Ticker Dashboard
// Author: Gavit Priyanshu Bhimsing (Frontend & Visualization Lead)
// US-8: Real-Time Candlestick Chart Display
// US-10: Timeframe Selection (1m, 5m, 1h, 1d)
// ============================================================

const BACKEND_URL = "http://localhost:3000";

const TIMEFRAMES = [
  { label: "1m",  tf: 1    },
  { label: "5m",  tf: 5    },
  { label: "1h",  tf: 60   },
  { label: "1d",  tf: 1440 },
];

const DEFAULT_TF = 5;

// ── DOM references ──────────────────────────────────────────
const priceBox      = document.getElementById("priceBox");
const tfSelectorDiv = document.getElementById("tfSelector");
const canvas        = document.getElementById("chart");

// ── State ───────────────────────────────────────────────────
let chartInstance   = null;
let selectedTf      = loadTfFromStorage();
let lastTfUsed      = null;
let historicalData  = [];   // candles from Binance REST (500 candles of real history)
let liveData        = [];   // candles aggregated from live WebSocket ticks

// ============================================================
// localStorage helpers (US-10)
// ============================================================
function loadTfFromStorage() {
  const saved = localStorage.getItem("selectedTf");
  return saved ? parseInt(saved) : DEFAULT_TF;
}
function saveTfToStorage(tf) {
  localStorage.setItem("selectedTf", tf);
}

// ============================================================
// Merge historical + live candles
// Live candles override/extend the last historical candle
// so the chart stays seamless as new ticks arrive
// ============================================================
function mergeCandles(historical, live) {
  if (!live || live.length === 0) return historical;
  if (!historical || historical.length === 0) return live;

  // Find where live data starts and splice it onto history
  const liveStart  = live[0].time;
  const baseCandles = historical.filter(c => c.time < liveStart);
  return [...baseCandles, ...live];
}

// ============================================================
// Destroy chart — only on timeframe switch
// ============================================================
function destroyChart() {
  if (chartInstance) {
    chartInstance.destroy();
    chartInstance = null;
  }
  const existing = Chart.getChart(canvas);
  if (existing) existing.destroy();
  lastTfUsed = null;
}

// ============================================================
// Timeframe Selector UI (US-10)
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
      selectedTf = tf;
      saveTfToStorage(tf);
      document.querySelectorAll(".tf-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      destroyChart();
      historicalData = [];
      liveData       = [];
      await loadCandleChart();
    });

    tfSelectorDiv.appendChild(btn);
  });
}

// ============================================================
// US-8: Live Price Display
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
  } catch (err) {
    priceBox.innerHTML = `<span class="ticker-error">Price unavailable</span>`;
    console.error("Price fetch error:", err);
  }
}

// ============================================================
// Build Chart.js candlestick config
// ============================================================
function buildChartConfig(candleData) {
  return {
    type: "candlestick",
    data: {
      datasets: [{
        label: "BTC/USDT",
        data: candleData,
        color:       { up: "#26a69a", down: "#ef5350", unchanged: "#999" },
        borderColor: { up: "#26a69a", down: "#ef5350", unchanged: "#999" },
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      scales: {
        x: {
          type: "time",
          time: {
            unit: selectedTf >= 1440 ? "day" : selectedTf >= 60 ? "hour" : "minute",
          },
          ticks: { color: "#aaa", maxTicksLimit: 12 },
          grid:  { color: "rgba(255,255,255,0.05)" },
        },
        y: {
          ticks: {
            color: "#aaa",
            callback: val => "$" + Number(val).toLocaleString(),
          },
          grid: { color: "rgba(255,255,255,0.08)" },
        },
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: item => {
              const d = item.raw;
              return [
                `Open:  $${Number(d.o).toLocaleString()}`,
                `High:  $${Number(d.h).toLocaleString()}`,
                `Low:   $${Number(d.l).toLocaleString()}`,
                `Close: $${Number(d.c).toLocaleString()}`,
              ];
            },
          },
        },
      },
    },
  };
}

// ============================================================
// US-8: Load candles — history + live merged
// ============================================================
async function loadCandleChart() {
  try {
    const wrapper = document.querySelector(".chart-wrapper");

    // Step 1: Fetch Binance historical candles (500 real candles)
    if (historicalData.length === 0) {
      const histRes  = await fetch(`${BACKEND_URL}/candles/history?tf=${selectedTf}&limit=${selectedTf >= 1440 ? 365 : selectedTf >= 60 ? 168 : selectedTf >= 5 ? 288 : 120}`);
      historicalData = await histRes.json();
    }

    // Step 2: Fetch live candles from our WebSocket ticks
    const liveRes = await fetch(`${BACKEND_URL}/candles?tf=${selectedTf}`);
    liveData      = await liveRes.json();

    // Step 3: Merge — history provides the base, live extends the right edge
    const merged = mergeCandles(historicalData, liveData);

    if (!merged || merged.length === 0) {
      wrapper.setAttribute("data-empty", "Loading chart data…");
      return;
    }

    wrapper.removeAttribute("data-empty");

    const candleData = merged.map(c => ({
      x: c.time,
      o: c.open,
      h: c.high,
      l: c.low,
      c: c.close,
    }));

    if (chartInstance && lastTfUsed === selectedTf) {
      // Update in place — no flicker
      chartInstance.data.datasets[0].data = candleData;
      chartInstance.update("none");
    } else {
      // First render or timeframe switched
      destroyChart();
      chartInstance = new Chart(canvas, buildChartConfig(candleData));
      lastTfUsed    = selectedTf;
    }

  } catch (err) {
    console.error("Candle chart error:", err);
  }
}

// ============================================================
// Boot sequence
// ============================================================
buildTfSelector();
updatePrice();
loadCandleChart();

setInterval(updatePrice,     2000);   // live price every 2s
setInterval(loadCandleChart, 5000);   // chart refresh every 5s