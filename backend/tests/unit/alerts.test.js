
// ── Alert trigger logic (extracted for unit testing) ─────────
function shouldTrigger(alert, currentPrice) {
  if (alert.direction === "above") return currentPrice >= alert.price;
  if (alert.direction === "below") return currentPrice <= alert.price;
  return false;
}

function generateAlertId() {
  return `alert:${Date.now()}:${Math.random().toString(36).slice(2, 7)}`;
}

function createAlert({ symbol, price, direction }) {
  if (!price || !direction) throw new Error("price and direction are required");
  if (!["above", "below"].includes(direction)) throw new Error("direction must be 'above' or 'below'");
  return {
    id:        generateAlertId(),
    symbol:    symbol || "BTCUSDT",
    price:     Number(price),
    direction,
    createdAt: Date.now(),
  };
}

// ── Tests ────────────────────────────────────────────────────
describe("Alert trigger logic — shouldTrigger()", () => {

  test("triggers ABOVE when price equals threshold", () => {
    const alert = { price: 70000, direction: "above" };
    expect(shouldTrigger(alert, 70000)).toBe(true);
  });

  test("triggers ABOVE when price exceeds threshold", () => {
    const alert = { price: 70000, direction: "above" };
    expect(shouldTrigger(alert, 70001)).toBe(true);
  });

  test("does NOT trigger ABOVE when price is below threshold", () => {
    const alert = { price: 70000, direction: "above" };
    expect(shouldTrigger(alert, 69999)).toBe(false);
  });

  test("triggers BELOW when price equals threshold", () => {
    const alert = { price: 60000, direction: "below" };
    expect(shouldTrigger(alert, 60000)).toBe(true);
  });

  test("triggers BELOW when price is under threshold", () => {
    const alert = { price: 60000, direction: "below" };
    expect(shouldTrigger(alert, 59999)).toBe(true);
  });

  test("does NOT trigger BELOW when price exceeds threshold", () => {
    const alert = { price: 60000, direction: "below" };
    expect(shouldTrigger(alert, 60001)).toBe(false);
  });

  test("returns false for unknown direction", () => {
    const alert = { price: 60000, direction: "sideways" };
    expect(shouldTrigger(alert, 60000)).toBe(false);
  });

  test("handles decimal prices correctly", () => {
    const alert = { price: 69999.99, direction: "above" };
    expect(shouldTrigger(alert, 70000.00)).toBe(true);
    expect(shouldTrigger(alert, 69999.98)).toBe(false);
  });

});

describe("Alert creation — createAlert()", () => {

  test("creates alert with correct fields", () => {
    const alert = createAlert({ symbol: "BTCUSDT", price: 70000, direction: "above" });
    expect(alert).toHaveProperty("id");
    expect(alert).toHaveProperty("symbol", "BTCUSDT");
    expect(alert).toHaveProperty("price", 70000);
    expect(alert).toHaveProperty("direction", "above");
    expect(alert).toHaveProperty("createdAt");
  });

  test("throws when price is missing", () => {
    expect(() => createAlert({ direction: "above" })).toThrow("price and direction are required");
  });

  test("throws when direction is missing", () => {
    expect(() => createAlert({ price: 70000 })).toThrow("price and direction are required");
  });

  test("throws for invalid direction", () => {
    expect(() => createAlert({ price: 70000, direction: "left" })).toThrow("direction must be 'above' or 'below'");
  });

  test("converts price to number", () => {
    const alert = createAlert({ price: "70000", direction: "above" });
    expect(typeof alert.price).toBe("number");
  });

  test("generates unique IDs", () => {
    const a1 = createAlert({ price: 70000, direction: "above" });
    const a2 = createAlert({ price: 70000, direction: "above" });
    expect(a1.id).not.toBe(a2.id);
  });

  test("defaults symbol to BTCUSDT", () => {
    const alert = createAlert({ price: 70000, direction: "below" });
    expect(alert.symbol).toBe("BTCUSDT");
  });

});