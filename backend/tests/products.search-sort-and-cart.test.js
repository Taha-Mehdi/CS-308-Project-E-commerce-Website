// backend/__tests__/products.search-sort-and-cart.test.js
const request = require("supertest");
const { db } = require("../src/db");
const { products } = require("../src/db/schema");
const { inArray } = require("drizzle-orm");

// We hit the already-running backend on port 4000
const api = request("http://localhost:4000");

describe("Product search & sort + out-of-stock cart behaviour", () => {
  let cheapProductId;
  let expensiveProductId;
  let outOfStockProductId;
  let customerToken;

  // Seed some deterministic test data for these tests
  beforeAll(async () => {
    // 1) Insert three test products
    const inserted = await db
      .insert(products)
      .values([
        {
          name: "Test Shoe Cheap",
          model: "TS-CHEAP",
          serialNumber: "TS-CHEAP-001",
          description: "Search-sort test product cheap shoe",
          stock: 10,
          price: "50.00",
          warrantyStatus: "1 yr official",
          distributorInfo: "Test Distributor",
          isActive: true,
        },
        {
          name: "Test Shoe Expensive",
          model: "TS-EXP",
          serialNumber: "TS-EXP-001",
          description: "Search-sort test product expensive shoe",
          stock: 10,
          price: "200.00",
          warrantyStatus: "1 yr official",
          distributorInfo: "Test Distributor",
          isActive: true,
        },
        {
          name: "Test Shoe Out Of Stock",
          model: "TS-OOS",
          serialNumber: "TS-OOS-001",
          description: "Search-sort test product out of stock",
          stock: 0,
          price: "120.00",
          warrantyStatus: "1 yr official",
          distributorInfo: "Test Distributor",
          isActive: true,
        },
      ])
      .returning();

    cheapProductId = inserted[0].id;
    expensiveProductId = inserted[1].id;
    outOfStockProductId = inserted[2].id;

    // 2) Create a test customer account to get a JWT for /cart/add
    const email = `searchsort-test-${Date.now()}@example.com`;
    const password = "Password123!";
    const fullName = "Search Sort Test User";

    const registerRes = await api.post("/auth/register").send({
      email,
      password,
      fullName,
    });

    expect(registerRes.statusCode).toBe(201);
    customerToken = registerRes.body.token;
    expect(customerToken).toBeTruthy();
  });

  // Clean up test products after all tests
  afterAll(async () => {
  await db
    .delete(products)
    .where(inArray(products.model, ["TS-CHEAP", "TS-EXP", "TS-OOS"]));
  });


  // 1) Search by name should find our product
  test("search by product name returns matching product", async () => {
    const res = await api
      .get("/products")
      .query({ q: "Test Shoe Cheap" }) // name search
      .expect(200);

    expect(Array.isArray(res.body)).toBe(true);
    const names = res.body.map((p) => p.name);
    expect(names).toContain("Test Shoe Cheap");
  });

  // 2) Search by description should find our products
  test("search by description returns products", async () => {
    const res = await api
      .get("/products")
      .query({ q: "Search-sort test product" }) // in description
      .expect(200);

    expect(Array.isArray(res.body)).toBe(true);
    // At least the three we created should match
    const ids = res.body.map((p) => p.id);
    expect(ids).toEqual(
      expect.arrayContaining([cheapProductId, expensiveProductId, outOfStockProductId])
    );
  });

  // 3) Sort by price ascending
  test("sort by price ascending orders products from cheapest to most expensive", async () => {
    const res = await api
      .get("/products")
      .query({
        q: "Search-sort test product", // limit to our products
        sortBy: "price",
        sortOrder: "asc",
      })
      .expect(200);

    const prices = res.body.map((p) => Number(p.price));
    // prices should be sorted ascending
    for (let i = 1; i < prices.length; i++) {
      expect(prices[i]).toBeGreaterThanOrEqual(prices[i - 1]);
    }
  });

  // 4) Sort by price descending
  test("sort by price descending orders products from most expensive to cheapest", async () => {
    const res = await api
      .get("/products")
      .query({
        q: "Search-sort test product",
        sortBy: "price",
        sortOrder: "desc",
      })
      .expect(200);

    const prices = res.body.map((p) => Number(p.price));
    for (let i = 1; i < prices.length; i++) {
      expect(prices[i]).toBeLessThanOrEqual(prices[i - 1]);
    }
  });

  // 5) Out-of-stock product is searchable but cannot be added to cart
  test("out-of-stock product is searchable but cannot be added to cart", async () => {
    // 5a) still searchable
    const searchRes = await api
      .get("/products")
      .query({ q: "Out Of Stock" })
      .expect(200);

    const ids = searchRes.body.map((p) => p.id);
    expect(ids).toContain(outOfStockProductId);

    // 5b) but /cart/add rejects it
    const cartRes = await api
      .post("/cart/add")
      .set("Authorization", `Bearer ${customerToken}`)
      .send({
        productId: outOfStockProductId,
        quantity: 1,
      });

    expect(cartRes.statusCode).toBe(400);
    expect(cartRes.body.message).toMatch(/out of stock/i);
  });
});
