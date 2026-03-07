const BACKEND_URL = "http://localhost:3000";

// Timeframe config: label → minutes value sent to /candles?tf=
const TIMEFRAMES = [
  { label: "1m",  tf: 1    },
  { label: "5m",  tf: 5    },
  { label: "1h",  tf: 60   },
  { label: "1d",  tf: 1440 },
];

const DEFAULT_TF = 5; // default timeframe in minutes

// ── DOM references ──────────────────────────────────────────
const priceBox       = document.getElementById("priceBox");
const tfSelectorDiv  = document.getElementById("tfSelector");
const ctx            = document.getElementById("chart").getContext("2d");

// ── State ───────────────────────────────────────────────────
let chart           = null;
let selectedTf      = loadTfFromStorage(); // US-10: restore from localStorage

// ============================================================
// US-10: localStorage persistence helpers
// ============================================================
function loadTfFromStorage() {
  const saved = localStorage.getItem("selectedTf");
  return saved ? parseInt(saved) : DEFAULT_TF;
}

function saveTfToStorage(tf) {
  localStorage.setItem("selectedTf", tf);
}

// ============================================================
// Timeframe Selector UI (US-10)
// Builds buttons and marks the currently active one
// ============================================================
function buildTfSelector() {
  tfSelectorDiv.innerHTML = "";
  TIMEFRAMES.forEach(({ label, tf }) => {
    const btn = document.createElement("button");
    btn.textContent = label;
    btn.classList.add("tf-btn");
    if (tf === selectedTf) btn.classList.add("active");

    btn.addEventListener("click", async () => {
      selectedTf = tf;
      saveTfToStorage(tf); // US-10: persist selection

      // Update active button styling
      document.querySelectorAll(".tf-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");

      // Reload chart with new timeframe within 500ms (US-10 AC)
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
      <span class="ticker-price">$${data.price ? Number(data.price).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "--"}</span>
      <span class="ticker-time">Last update: ${time}</span>
    `;
  } catch (err) {
    priceBox.innerHTML = `<span class="ticker-error">Price unavailable</span>`;
    console.error("Price fetch error:", err);
  }
}

// ============================================================
// US-8: Candlestick Chart using chartjs-chart-financial
// Calls /candles?tf=<minutes> — aggregation done server-side (US-10 AC)
// ============================================================
async function loadCandleChart() {
  try {
    const res     = await fetch(`${BACKEND_URL}/candles?tf=${selectedTf}`);
    const candles = await res.json();

    if (!candles || candles.length === 0) {
      console.warn("No candle data received");
      return;
    }

    // chartjs-chart-financial expects { x, o, h, l, c }
    const candleData = candles.map(c => ({
      x: c.time,
      o: c.open,
      h: c.high,
      l: c.low,
      c: c.close,
    }));

    if (chart) {
      // Update existing chart data (smooth update, no re-render flicker)
      chart.data.datasets[0].data = candleData;
      chart.update("none"); // 'none' = instant, no animation on refresh
    } else {
      // Create chart for the first time
      chart = new Chart(ctx, {
        type: "candlestick",
        data: {
          datasets: [
            {
              label: "BTC/USDT",
              data: candleData,
              color: {
                up:   "#26a69a", // green candles
                down: "#ef5350", // red candles
                unchanged: "#999",
              },
              borderColor: {
                up:   "#26a69a",
                down: "#ef5350",
                unchanged: "#999",
              },
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          animation: false,
          scales: {
            x: {
              type: "time",
              time: { unit: selectedTf >= 1440 ? "day" : selectedTf >= 60 ? "hour" : "minute" },
              ticks: { color: "#aaa", maxTicksLimit: 10 },
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
                label: ctx => {
                  const d = ctx.raw;
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
      });
    }
  } catch (err) {
    console.error("Candle chart error:", err);
  }
}

// ============================================================
// Boot sequence
// ============================================================
buildTfSelector();   // Render timeframe buttons (restores from localStorage)
updatePrice();       // Fetch latest price immediately
loadCandleChart();   // Load candlestick chart with saved/default timeframe

// Auto-refresh
setInterval(updatePrice,    2000);  // Price every 2s
setInterval(loadCandleChart, 5000); // Chart every 5s