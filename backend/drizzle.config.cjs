const { defineConfig } = require("drizzle-kit");
require("dotenv").config();

module.exports = defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.js",
  out: "./drizzle",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
});
