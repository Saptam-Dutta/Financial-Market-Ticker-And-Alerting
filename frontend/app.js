setInterval(() => {

fetch("http://localhost:3000/price")

.then(res => res.json())

.then(data => {

document.getElementById("priceBox")
.innerText = "BTC Price: " + data.price;

});

}, 1000);