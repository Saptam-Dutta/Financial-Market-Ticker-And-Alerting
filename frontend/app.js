const priceBox = document.getElementById("priceBox");
const ctx = document.getElementById("chart").getContext("2d");
let chart;

/*
Load Live Price
*/
async function updatePrice() {
  const res = await fetch("http://localhost:3000/price");
  const data = await res.json();

  const time = data.time
    ? new Date(data.time).toLocaleTimeString()
    : "--";

  priceBox.innerHTML = `
    BTC/USDT: $${data.price || "--"} 
    <br>
    Time: ${time}
  `;
}

/*
Load Chart
*/
async function loadChart() {
  const res = await fetch("http://localhost:3000/candles?tf=5");
  const data = await res.json();

  const labels = data.map((_, i) => i);
  const prices = data.map(c => c.close);

  if (chart) chart.destroy();

  chart = new Chart(ctx, {
    type: "line",
    data: {
      labels: labels,
      datasets: [{
        label: "BTC Price",
        data: prices,
        borderColor: "green",
        borderWidth: 2,
        fill: false
      }]
    }
  });
}

/* Initial Load */
updatePrice();
loadChart();

/* Auto refresh */
setInterval(updatePrice, 2000);
setInterval(loadChart, 5000);