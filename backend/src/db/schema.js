const {
  pgTable,
  serial,
  text,
  integer,
  boolean,
  timestamp,
  numeric,
  varchar,
} = require("drizzle-orm/pg-core");

// Roles: admin, customer, support, etc.
const roles = pgTable("roles", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
});

// Users
const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  fullName: text("full_name").notNull(),
  roleId: integer("role_id")
    .notNull()
    .references(() => roles.id),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// Products
const products = pgTable("products", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  price: numeric("price", { precision: 10, scale: 2 }).notNull(),
  stock: integer("stock").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  imageUrl: varchar("image_url", { length: 512 }),
});

// Orders (one per purchase)
const orders = pgTable("orders", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id),
  status: text("status").notNull().default("pending"), // pending, paid, shipped, cancelled
  total: numeric("total", { precision: 10, scale: 2 }).notNull().default("0"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// Order items (products inside an order)
const orderItems = pgTable("order_items", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id")
    .notNull()
    .references(() => orders.id),
  productId: integer("product_id")
    .notNull()
    .references(() => products.id),
  quantity: integer("quantity").notNull().default(1),
  unitPrice: numeric("unit_price", { precision: 10, scale: 2 }).notNull(),
});

const cartItems = pgTable("cart_items", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id),
  productId: integer("product_id")
    .notNull()
    .references(() => products.id),
  quantity: integer("quantity").notNull().default(1)
});

// Reviews (Ratings & Comments)
const reviews = pgTable("reviews", {
  id: serial("id").primaryKey(),

  // Link to the User who wrote it
  userId: integer("user_id")
      .notNull()
      .references(() => users.id),

  // Link to the Product being reviewed
  productId: integer("product_id")
      .notNull()
      .references(() => products.id),

  // The Rating (1-5)
  rating: integer("rating").notNull(),

  // The Comment (Text)
  comment: text("comment"),

  // Approval Status (For the Manager check)
  // 'pending' = submitted but hidden text
  // 'approved' = visible to everyone
  // 'rejected' = hidden forever
  status: text("status").notNull().default("pending"),

  createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
});

module.exports = {
  roles,
  users,
  products,
  orders,
  orderItems,
  cartItems,
  reviews
};

