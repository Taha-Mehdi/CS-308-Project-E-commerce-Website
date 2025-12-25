const express = require("express");
const { db } = require("../db");
const { orders, orderItems, products } = require("../db/schema");
const { and, gte, lte, inArray, sql } = require("drizzle-orm");
const { authMiddleware, requireSalesManager } = require("../middleware/auth");

const router = express.Router();

function parseDateParam(raw) {
  if (!raw || typeof raw !== "string") return null;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

// GET /analytics/summary?from=YYYY-MM-DD&to=YYYY-MM-DD
// ✅ sales_manager ONLY
router.get("/summary", authMiddleware, requireSalesManager, async (req, res) => {
  try {
    const from = parseDateParam(req.query.from);
    const to = parseDateParam(req.query.to);

    if (!from || !to) {
      return res
        .status(400)
        .json({ message: "from and to are required. Use format YYYY-MM-DD" });
    }

    const toInclusive = new Date(to);
    toInclusive.setHours(23, 59, 59, 999);

    // Orders in range (ignore cancelled by default)
    const orderRows = await db
      .select()
      .from(orders)
      .where(
        and(
          gte(orders.createdAt, from),
          lte(orders.createdAt, toInclusive),
          sql`${orders.status} <> 'cancelled'`
        )
      );

    const orderIds = orderRows.map((o) => o.id);
    const orderCount = orderIds.length;

    if (orderIds.length === 0) {
      return res.json({
        from: from.toISOString(),
        to: to.toISOString(),
        orderCount: 0,
        revenue: 0,
        cost: 0,
        profit: 0,
        series: [],
      });
    }

    // Revenue = sum(order.total)
    const revenue = orderRows.reduce((acc, o) => acc + Number(o.total || 0), 0);

    // Load items
    const items = await db
      .select()
      .from(orderItems)
      .where(inArray(orderItems.orderId, orderIds));

    // Load products (for cost)
    const productIds = [...new Set(items.map((i) => i.productId))];
    const prows = await db
      .select()
      .from(products)
      .where(inArray(products.id, productIds));
    const pmap = new Map(prows.map((p) => [p.id, p]));

    // orderId -> day
    const orderDay = new Map();
    for (const o of orderRows) {
      const d = new Date(o.createdAt);
      const day = d.toISOString().slice(0, 10);
      orderDay.set(o.id, day);
    }

    // day -> { revenue, cost }
    const seriesMap = new Map();
    for (const o of orderRows) {
      const day = orderDay.get(o.id);
      if (!seriesMap.has(day)) seriesMap.set(day, { revenue: 0, cost: 0 });
      seriesMap.get(day).revenue += Number(o.total || 0);
    }

    let totalCost = 0;

    for (const it of items) {
      const qty = Number(it.quantity || 0);
      const unitPrice = Number(it.unitPrice || 0);
      const p = pmap.get(it.productId);

      // Cost = explicit product.cost if provided, else 50% of sale price (unitPrice)
      const unitCost =
        p && p.cost !== null && p.cost !== undefined ? Number(p.cost) : unitPrice * 0.5;

      const lineCost = unitCost * qty;
      totalCost += lineCost;

      const day = orderDay.get(it.orderId);
      if (day) {
        if (!seriesMap.has(day)) seriesMap.set(day, { revenue: 0, cost: 0 });
        seriesMap.get(day).cost += lineCost;
      }
    }

    const profit = revenue - totalCost;

    const series = Array.from(seriesMap.entries())
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([day, v]) => ({
        date: day,
        revenue: +v.revenue.toFixed(2),
        cost: +v.cost.toFixed(2),
        profit: +(v.revenue - v.cost).toFixed(2),
      }));

    return res.json({
      from: from.toISOString(),
      to: to.toISOString(),
      orderCount,
      revenue: +revenue.toFixed(2),
      cost: +totalCost.toFixed(2),
      profit: +profit.toFixed(2),
      series,
    });
  } catch (err) {
    console.error("GET /analytics/summary error:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
