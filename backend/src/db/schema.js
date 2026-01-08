const {
  pgTable,
  serial,
  text,
  integer,
  boolean,
  timestamp,
  numeric,
  varchar,
  uniqueIndex,
} = require("drizzle-orm/pg-core");

// ROLES
const roles = pgTable("roles", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
});

// CATEGORIES
const categories = pgTable("categories", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
});

// USERS
const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  fullName: text("full_name").notNull(),
  taxId: text("tax_id"),
  address: text("address"),
  roleId: integer("role_id").notNull().references(() => roles.id),
  isActive: boolean("is_active").notNull().default(true),

  // ✅ Store credit balance (for refunds to account)
  accountBalance: numeric("account_balance", { precision: 10, scale: 2 })
    .notNull()
    .default("0"),

  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// PRODUCTS
const products = pgTable("products", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  model: text("model"),
  serialNumber: text("serial_number").unique(),
  description: text("description"),
  stock: integer("stock").notNull().default(0),

  // price shown to customers (current sale price)
  price: numeric("price", { precision: 10, scale: 2 }).notNull(),

  // product manager can specify; otherwise used as fallback 50% of sale price for profit/loss
  cost: numeric("cost", { precision: 10, scale: 2 }),

  // Discount support
  originalPrice: numeric("original_price", { precision: 10, scale: 2 }),
  discountRate: numeric("discount_rate", { precision: 5, scale: 2 }),

  warrantyStatus: text("warranty_status"),
  distributorInfo: text("distributor_info"),
  categoryId: integer("category_id").references(() => categories.id),
  imageUrl: varchar("image_url", { length: 512 }),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// ORDERS
const orders = pgTable("orders", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  status: text("status").notNull().default("pending"),

  // ✅ credit_card | account
  paymentMethod: text("payment_method").notNull().default("credit_card"),

  total: numeric("total", { precision: 10, scale: 2 }).notNull().default("0"),
  shippingAddress: text("shipping_address").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// ORDER ITEMS
const orderItems = pgTable("order_items", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id").notNull().references(() => orders.id),
  productId: integer("product_id").notNull().references(() => products.id),
  quantity: integer("quantity").notNull().default(1),

  // IMPORTANT: this is the price at purchase time (includes discount)
  unitPrice: numeric("unit_price", { precision: 10, scale: 2 }).notNull(),
});

/**
 * RETURN REQUESTS (Selective Return + Refund)
 * Flow:
 * - customer creates request within 30 days & only if delivered
 * - sales_manager decides approve/reject
 * - once received back, sales_manager marks received -> refunds + restocks + emails customer
 */
const returnRequests = pgTable(
  "return_requests",
  {
    id: serial("id").primaryKey(),

    orderId: integer("order_id").notNull().references(() => orders.id),
    orderItemId: integer("order_item_id").notNull().references(() => orderItems.id),
    customerId: integer("customer_id").notNull().references(() => users.id),

    // requested | approved | rejected | refunded
    status: text("status").notNull().default("requested"),

    reason: text("reason"),

    requestedAt: timestamp("requested_at", { withTimezone: true }).defaultNow().notNull(),

    decidedBy: integer("decided_by").references(() => users.id),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
    decisionNote: text("decision_note"),

    receivedAt: timestamp("received_at", { withTimezone: true }),
    refundedAt: timestamp("refunded_at", { withTimezone: true }),

    // ✅ record where we refunded to
    refundMethod: text("refund_method"),
    refundReference: text("refund_reference"),

    refundAmount: numeric("refund_amount", { precision: 10, scale: 2 }),
  },
  (table) => ({
    // One return request per order item (simple rule)
    uniqueOrderItem: uniqueIndex("unique_return_request_order_item").on(table.orderItemId),
  })
);

// CART ITEMS
const cartItems = pgTable(
  "cart_items",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id").notNull().references(() => users.id),
    productId: integer("product_id").notNull().references(() => products.id),
    quantity: integer("quantity").notNull().default(1),
  },
  (table) => ({
    uniqueUserProduct: uniqueIndex("unique_user_product_cart").on(
      table.userId,
      table.productId
    ),
  })
);

// WISHLIST ITEMS
const wishlistItems = pgTable(
  "wishlist_items",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id").notNull().references(() => users.id),
    productId: integer("product_id").notNull().references(() => products.id),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    uniqueUserProduct: uniqueIndex("unique_user_product_wishlist").on(
      table.userId,
      table.productId
    ),
  })
);

// REVIEWS
const reviews = pgTable(
  "reviews",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id").notNull().references(() => users.id),
    productId: integer("product_id").notNull().references(() => products.id),

    rating: integer("rating").notNull(),
    comment: text("comment"),

    status: text("status").notNull().default("none"),

    moderatedBy: integer("moderated_by").references(() => users.id),
    moderatedAt: timestamp("moderated_at", { withTimezone: true }),
    rejectionReason: text("rejection_reason"),

    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    uniqueUserProductReview: uniqueIndex("unique_user_product_review").on(
      table.userId,
      table.productId
    ),
  })
);

module.exports = {
  roles,
  categories,
  users,
  products,
  orders,
  orderItems,
  returnRequests,
  cartItems,
  wishlistItems,
  reviews,
};
