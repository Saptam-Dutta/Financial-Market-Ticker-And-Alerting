function aggregateCandles(data, timeframe) {

  if (!timeframe) return [];

  const bucket = {};

  data.forEach(entry => {

    const time = Math.floor(entry.timestamp / timeframe) * timeframe;

    if (!bucket[time]) {
      bucket[time] = {
        time,
        open: entry.price,
        high: entry.price,
        low: entry.price,
        close: entry.price
      };
    }

    bucket[time].high = Math.max(bucket[time].high, entry.price);
    bucket[time].low = Math.min(bucket[time].low, entry.price);
    bucket[time].close = entry.price;

  });

  return Object.values(bucket);

}

module.exports = aggregateCandles;