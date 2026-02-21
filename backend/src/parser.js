function parseTrade(msg) {
  try {
    const data = JSON.parse(msg);

    return {
      symbol: data.s,
      price: parseFloat(data.p),
      quantity: parseFloat(data.q),
      timestamp: data.T,
    };
  } catch (err) {
    return null;
  }
}

module.exports = parseTrade;