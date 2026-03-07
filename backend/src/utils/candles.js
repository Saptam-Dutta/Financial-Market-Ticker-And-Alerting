function aggregateCandles(data, timeframe) {
  if (!timeframe || !data || data.length === 0) return [];

  const bucketMs = timeframe * 60 * 1000; // convert minutes → milliseconds
  const bucket = {};

  data.forEach(entry => {
    // entry.time is Date.now() (milliseconds) set in index.js
    const bucketKey = Math.floor(entry.time / bucketMs) * bucketMs;

    if (!bucket[bucketKey]) {
      bucket[bucketKey] = {
        time:  bucketKey,      // valid ms timestamp — chartjs time scale needs this
        open:  entry.price,
        high:  entry.price,
        low:   entry.price,
        close: entry.price,
      };
    }

    bucket[bucketKey].high  = Math.max(bucket[bucketKey].high,  entry.price);
    bucket[bucketKey].low   = Math.min(bucket[bucketKey].low,   entry.price);
    bucket[bucketKey].close = entry.price;
  });

  // Return sorted oldest → newest
  return Object.values(bucket).sort((a, b) => a.time - b.time);
}

module.exports = aggregateCandles;