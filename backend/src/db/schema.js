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

  // Discount support:
  // - originalPrice: the pre-discount price we can restore to when discount removed
  // - discountRate: percentage (0..100), nullable means "no discount"
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
  unitPrice: numeric("unit_price", { precision: 10, scale: 2 }).notNull(),
});

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
const reviews = pgTable("reviews", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  productId: integer("product_id").notNull().references(() => products.id),
  rating: integer("rating").notNull(),
  comment: text("comment"),
  status: text("status").notNull().default("pending"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

module.exports = {
  roles,
  categories,
  users,
  products,
  orders,
  orderItems,
  cartItems,
  wishlistItems,
  reviews,
};
