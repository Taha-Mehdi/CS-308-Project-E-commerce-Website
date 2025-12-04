export function calculateAnalytics(orders = []) {
  if (!Array.isArray(orders) || orders.length === 0) {
    return {
      totalRevenue: 0,
      orderCount: 0,
      avgOrderValue: 0,
      statusCounts: {},
      revenueByDay: [],
      completionRate: 0,
      recentRevenue: 0,
      avgPerDay: 0,
      topDay: null,
    };
  }

  let totalRevenue = 0;
  const orderCount = orders.length;
  const statusCounts = {};
  const revenueMap = new Map();

  for (const o of orders) {
    const totalNum = Number(o.total || 0);
    const status = o.status || "pending";
    statusCounts[status] = (statusCounts[status] || 0) + 1;

    if (status !== "cancelled") {
      totalRevenue += totalNum;
      if (o.createdAt) {
        const d = new Date(o.createdAt);
        if (!Number.isNaN(d.getTime())) {
          const key = d.toISOString().slice(0, 10);
          revenueMap.set(key, (revenueMap.get(key) || 0) + totalNum);
        }
      }
    }
  }

  const avgOrderValue = orderCount > 0 ? totalRevenue / orderCount : 0;

  const revenueByDay = [...revenueMap.entries()]
    .map(([date, revenue]) => ({
      date,
      revenue: Number(revenue.toFixed(2)),
    }))
    .sort((a, b) => (a.date < b.date ? -1 : 1));

  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000);
  const recentRevenue = revenueByDay
    .filter((item) => new Date(item.date) >= sevenDaysAgo)
    .reduce((sum, item) => sum + item.revenue, 0);

  const totalDays = revenueByDay.length || 1;
  const avgPerDay = totalRevenue / totalDays;

  const completedOrders =
    (statusCounts.delivered || 0) +
    (statusCounts.shipped || 0) +
    (statusCounts.paid || 0);
  const completionRate =
    orderCount > 0 ? (completedOrders / orderCount) * 100 : 0;

  const topDay =
    revenueByDay.length === 0
      ? null
      : revenueByDay.reduce((best, current) =>
          !best || current.revenue > best.revenue ? current : best
        );

  return {
    totalRevenue,
    orderCount,
    avgOrderValue,
    statusCounts,
    revenueByDay,
    completionRate,
    recentRevenue,
    avgPerDay,
    topDay,
  };
}
