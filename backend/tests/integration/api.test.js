
const request = require("supertest");

// Base URL — can override with env variable for CI
const BASE_URL = process.env.API_URL || "http://localhost:3000";

// ── Helper: create an alert and return its ID ─────────────────
async function createTestAlert(price = 999999, direction = "above", symbol = "BTCUSDT") {
  const res = await request(BASE_URL)
    .post("/alert")
    .send({ symbol, price, direction })
    .set("Content-Type", "application/json");
  return res.body.alert?.id;
}

// ═══════════════════════════════════════════════════════════
// 1. Health Check
// ═══════════════════════════════════════════════════════════
describe("GET /  — Health Check", () => {

  test("returns 200 with status field", async () => {
    const res = await request(BASE_URL).get("/");
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty("status");
    expect(res.body.status).toMatch(/running/i);
  });

  test("returns timestamp field", async () => {
    const res = await request(BASE_URL).get("/");
    expect(res.body).toHaveProperty("timestamp");
    expect(new Date(res.body.timestamp).getTime()).not.toBeNaN();
  });

});

// ═══════════════════════════════════════════════════════════
// 2. Latest Price
// ═══════════════════════════════════════════════════════════
describe("GET /price  — Latest Price", () => {

  test("returns 200", async () => {
    const res = await request(BASE_URL).get("/price");
    expect(res.statusCode).toBe(200);
  });

  test("returns object (empty or with price + time)", async () => {
    const res = await request(BASE_URL).get("/price");
    expect(typeof res.body).toBe("object");
  });

  test("price is a positive number when available", async () => {
    const res = await request(BASE_URL).get("/price");
    if (res.body.price !== undefined) {
      expect(typeof res.body.price).toBe("number");
      expect(res.body.price).toBeGreaterThan(0);
    }
  });

  test("time is a valid timestamp when available", async () => {
    const res = await request(BASE_URL).get("/price");
    if (res.body.time !== undefined) {
      expect(res.body.time).toBeGreaterThan(0);
    }
  });

});

// ═══════════════════════════════════════════════════════════
// 3. Price History
// ═══════════════════════════════════════════════════════════
describe("GET /history  — Price History", () => {

  test("returns 200 and an array", async () => {
    const res = await request(BASE_URL).get("/history");
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test("each entry has price and time fields", async () => {
    const res = await request(BASE_URL).get("/history");
    if (res.body.length > 0) {
      const entry = res.body[0];
      expect(entry).toHaveProperty("price");
      expect(entry).toHaveProperty("time");
      expect(typeof entry.price).toBe("number");
      expect(typeof entry.time).toBe("number");
    }
  });

  test("history length does not exceed 500", async () => {
    const res = await request(BASE_URL).get("/history");
    expect(res.body.length).toBeLessThanOrEqual(500);
  });

});

// ═══════════════════════════════════════════════════════════
// 4. Live Candles
// ═══════════════════════════════════════════════════════════
describe("GET /candles  — Live Candles", () => {

  test("returns 200 and array for tf=1", async () => {
    const res = await request(BASE_URL).get("/candles?tf=1");
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test("returns 200 and array for tf=5", async () => {
    const res = await request(BASE_URL).get("/candles?tf=5");
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test("candles have valid OHLC structure", async () => {
    const res = await request(BASE_URL).get("/candles?tf=1");
    if (res.body.length > 0) {
      const c = res.body[0];
      expect(c).toHaveProperty("time");
      expect(c).toHaveProperty("open");
      expect(c).toHaveProperty("high");
      expect(c).toHaveProperty("low");
      expect(c).toHaveProperty("close");
      expect(c.high).toBeGreaterThanOrEqual(c.low);
      expect(c.time).not.toBeNull();
      expect(isNaN(c.time)).toBe(false);
    }
  });

  test("defaults to tf=5 when tf param missing", async () => {
    const res = await request(BASE_URL).get("/candles");
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

});

// ═══════════════════════════════════════════════════════════
// 5. Historical Candles (Binance REST)
// ═══════════════════════════════════════════════════════════
describe("GET /candles/history  — Binance Historical Candles", () => {

  test("returns 200 and array for BTCUSDT 5m", async () => {
    const res = await request(BASE_URL).get("/candles/history?tf=5&symbol=BTCUSDT");
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
  }, 10000);

  test("returns up to requested limit", async () => {
    const res = await request(BASE_URL).get("/candles/history?tf=5&symbol=BTCUSDT&limit=10");
    expect(res.statusCode).toBe(200);
    expect(res.body.length).toBeLessThanOrEqual(10);
  }, 10000);

  test("candles have valid OHLC and time", async () => {
    const res = await request(BASE_URL).get("/candles/history?tf=5&symbol=BTCUSDT&limit=5");
    if (res.body.length > 0) {
      const c = res.body[0];
      expect(c).toHaveProperty("time");
      expect(c).toHaveProperty("open");
      expect(c).toHaveProperty("high");
      expect(c).toHaveProperty("low");
      expect(c).toHaveProperty("close");
      expect(c.high).toBeGreaterThanOrEqual(c.open);
      expect(c.high).toBeGreaterThanOrEqual(c.close);
      expect(c.low).toBeLessThanOrEqual(c.open);
    }
  }, 10000);

  test("works for ETHUSDT", async () => {
    const res = await request(BASE_URL).get("/candles/history?tf=5&symbol=ETHUSDT&limit=5");
    expect(res.statusCode).toBe(200);
    expect(res.body.length).toBeGreaterThan(0);
  }, 10000);

});

// ═══════════════════════════════════════════════════════════
// 6. Create Alert (POST /alert)
// ═══════════════════════════════════════════════════════════
describe("POST /alert  — Create Alert", () => {

  test("creates alert with valid body", async () => {
    const res = await request(BASE_URL)
      .post("/alert")
      .send({ symbol: "BTCUSDT", price: 999999, direction: "above" })
      .set("Content-Type", "application/json");
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty("alert");
    expect(res.body.alert).toHaveProperty("id");
    expect(res.body.alert).toHaveProperty("symbol", "BTCUSDT");
    expect(res.body.alert).toHaveProperty("price", 999999);
    expect(res.body.alert).toHaveProperty("direction", "above");

    // Cleanup
    if (res.body.alert?.id) {
      await request(BASE_URL).delete(`/alert/${res.body.alert.id}`);
    }
  });

  test("creates BELOW alert", async () => {
    const res = await request(BASE_URL)
      .post("/alert")
      .send({ symbol: "ETHUSDT", price: 1, direction: "below" })
      .set("Content-Type", "application/json");
    expect(res.statusCode).toBe(200);
    expect(res.body.alert.direction).toBe("below");

    if (res.body.alert?.id) {
      await request(BASE_URL).delete(`/alert/${res.body.alert.id}`);
    }
  });

  test("returns 400 when price is missing", async () => {
    const res = await request(BASE_URL)
      .post("/alert")
      .send({ direction: "above" })
      .set("Content-Type", "application/json");
    expect(res.statusCode).toBe(400);
    expect(res.body).toHaveProperty("error");
  });

  test("returns 400 when direction is missing", async () => {
    const res = await request(BASE_URL)
      .post("/alert")
      .send({ price: 70000 })
      .set("Content-Type", "application/json");
    expect(res.statusCode).toBe(400);
  });

  test("returns 400 for invalid direction", async () => {
    const res = await request(BASE_URL)
      .post("/alert")
      .send({ price: 70000, direction: "sideways" })
      .set("Content-Type", "application/json");
    expect(res.statusCode).toBe(400);
  });

});

// ═══════════════════════════════════════════════════════════
// 7. Get Active Alerts (GET /alerts)
// ═══════════════════════════════════════════════════════════
describe("GET /alerts  — Active Alerts", () => {

  test("returns 200 and array", async () => {
    const res = await request(BASE_URL).get("/alerts");
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test("newly created alert appears in list", async () => {
    const id  = await createTestAlert(999998, "above");
    const res = await request(BASE_URL).get("/alerts");
    const ids = res.body.map(a => a.id);
    expect(ids).toContain(id);
    await request(BASE_URL).delete(`/alert/${id}`);
  });

});

// ═══════════════════════════════════════════════════════════
// 8. Delete Alert (DELETE /alert/:id)
// ═══════════════════════════════════════════════════════════
describe("DELETE /alert/:id  — Delete Alert", () => {

  test("successfully deletes an existing alert", async () => {
    const id  = await createTestAlert(999997, "above");
    const res = await request(BASE_URL).delete(`/alert/${id}`);
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty("message");

    // Confirm it's gone
    const list = await request(BASE_URL).get("/alerts");
    const ids  = list.body.map(a => a.id);
    expect(ids).not.toContain(id);
  });

  test("returns 404 for non-existent alert", async () => {
    const res = await request(BASE_URL).delete("/alert/nonexistent-id-xyz");
    expect(res.statusCode).toBe(404);
  });

});

// ═══════════════════════════════════════════════════════════
// 9. Alert History (GET /alerts/history)
// ═══════════════════════════════════════════════════════════
describe("GET /alerts/history  — Alert History", () => {

  test("returns 200 and array", async () => {
    const res = await request(BASE_URL).get("/alerts/history");
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test("history items have required fields when present", async () => {
    const res = await request(BASE_URL).get("/alerts/history");
    if (res.body.length > 0) {
      const item = res.body[0];
      expect(item).toHaveProperty("id");
      expect(item).toHaveProperty("symbol");
      expect(item).toHaveProperty("price");
      expect(item).toHaveProperty("direction");
      expect(item).toHaveProperty("triggeredAt");
      expect(item).toHaveProperty("triggeredPrice");
    }
  });

  test("returns at most 50 records", async () => {
    const res = await request(BASE_URL).get("/alerts/history");
    expect(res.body.length).toBeLessThanOrEqual(50);
  });

});