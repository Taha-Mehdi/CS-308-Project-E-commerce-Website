import { calculateAnalytics } from "../lib/analytics";

const sampleOrders = [
  {
    id: 1,
    total: "120.50",
    status: "paid",
    createdAt: "2024-01-01T12:00:00Z",
  },
  {
    id: 2,
    total: "80.00",
    status: "pending",
    createdAt: "2024-01-02T12:00:00Z",
  },
  {
    id: 3,
    total: "40.00",
    status: "cancelled",
    createdAt: "2024-01-03T12:00:00Z",
  },
];

describe("calculateAnalytics", () => {
  it("computes totals and averages", () => {
    const result = calculateAnalytics(sampleOrders);
    expect(result.orderCount).toBe(3);
    expect(result.totalRevenue).toBeCloseTo(200.5); // cancelled orders excluded from revenue
    expect(result.avgOrderValue).toBeCloseTo(200.5 / 3);
  });

  it("builds status counts and revenue timeline", () => {
    const result = calculateAnalytics(sampleOrders);
    expect(result.statusCounts.paid).toBe(1);
    expect(result.statusCounts.pending).toBe(1);
    expect(result.statusCounts.cancelled).toBe(1);
    expect(result.revenueByDay.length).toBeGreaterThan(0);
  });
});
