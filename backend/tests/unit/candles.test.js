
const aggregateCandles = require("../../src/utils/candles");

describe("aggregateCandles()", () => {

  // ── Basic aggregation ──────────────────────────────────────
  test("returns empty array when data is empty", () => {
    expect(aggregateCandles([], 5)).toEqual([]);
  });

  test("returns empty array when timeframe is 0", () => {
    const data = [{ price: 100, time: Date.now() }];
    expect(aggregateCandles(data, 0)).toEqual([]);
  });

  test("returns empty array when data is null", () => {
    expect(aggregateCandles(null, 5)).toEqual([]);
  });

  test("aggregates single tick into one candle", () => {
    const now  = 1700000000000;
    const data = [{ price: 50000, time: now }];
    const result = aggregateCandles(data, 1);
    expect(result).toHaveLength(1);
    expect(result[0].open).toBe(50000);
    expect(result[0].close).toBe(50000);
    expect(result[0].high).toBe(50000);
    expect(result[0].low).toBe(50000);
  });

  // ── OHLC correctness ───────────────────────────────────────
  test("correctly sets OHLC values within a bucket", () => {
    const bucketStart = Math.floor(1700000000000 / (5 * 60 * 1000)) * (5 * 60 * 1000);
    const data = [
      { price: 100, time: bucketStart },
      { price: 150, time: bucketStart + 10000 },
      { price:  80, time: bucketStart + 20000 },
      { price: 120, time: bucketStart + 30000 },
    ];
    const result = aggregateCandles(data, 5);
    expect(result).toHaveLength(1);
    const candle = result[0];
    expect(candle.open).toBe(100);   // first price
    expect(candle.high).toBe(150);   // highest
    expect(candle.low).toBe(80);     // lowest
    expect(candle.close).toBe(120);  // last price
  });

  // ── Multiple buckets ───────────────────────────────────────
  test("creates multiple candles for ticks in different buckets", () => {
    const bucket1 = Math.floor(1700000000000 / (5 * 60 * 1000)) * (5 * 60 * 1000);
    const bucket2 = bucket1 + 5 * 60 * 1000;
    const data = [
      { price: 100, time: bucket1 },
      { price: 200, time: bucket2 },
    ];
    const result = aggregateCandles(data, 5);
    expect(result).toHaveLength(2);
  });

  // ── Sort order ─────────────────────────────────────────────
  test("returns candles sorted oldest to newest", () => {
    const bucket1 = Math.floor(1700000000000 / (1 * 60 * 1000)) * (1 * 60 * 1000);
    const bucket2 = bucket1 + 60000;
    const bucket3 = bucket1 + 120000;
    const data = [
      { price: 300, time: bucket3 },
      { price: 100, time: bucket1 },
      { price: 200, time: bucket2 },
    ];
    const result = aggregateCandles(data, 1);
    expect(result[0].time).toBeLessThan(result[1].time);
    expect(result[1].time).toBeLessThan(result[2].time);
  });

  // ── Timeframe conversion ───────────────────────────────────
  test("uses minutes correctly — tf=60 creates 1-hour buckets", () => {
    const hour1 = Math.floor(1700000000000 / (60 * 60 * 1000)) * (60 * 60 * 1000);
    const hour2 = hour1 + 60 * 60 * 1000;
    const data  = [
      { price: 100, time: hour1 + 1000 },
      { price: 200, time: hour1 + 2000 },
      { price: 300, time: hour2 + 1000 },
    ];
    const result = aggregateCandles(data, 60);
    expect(result).toHaveLength(2);
  });

  // ── Close is last price ────────────────────────────────────
  test("close price is the last price in the bucket", () => {
    const bucket = Math.floor(1700000000000 / (5 * 60 * 1000)) * (5 * 60 * 1000);
    const data   = [
      { price: 100, time: bucket },
      { price: 200, time: bucket + 1000 },
      { price: 999, time: bucket + 2000 }, // last
    ];
    const result = aggregateCandles(data, 5);
    expect(result[0].close).toBe(999);
  });

  // ── Time field on candle ───────────────────────────────────
  test("candle time is the bucket start time (valid timestamp)", () => {
    const now    = Date.now();
    const data   = [{ price: 50000, time: now }];
    const result = aggregateCandles(data, 1);
    expect(result[0].time).toBeGreaterThan(0);
    expect(typeof result[0].time).toBe("number");
    expect(isNaN(result[0].time)).toBe(false);
  });

});