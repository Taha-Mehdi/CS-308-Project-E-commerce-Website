// backend/src/utils/ensureCategories.js
const { db } = require("../db");
const { categories } = require("../db/schema");
const { eq } = require("drizzle-orm");

async function ensureDefaultCategories() {
  const defaults = [
    { id: 1, name: "Low Top" },
    { id: 2, name: "Mid Top" },
    { id: 3, name: "High Top" },
  ];

  for (const cat of defaults) {
    const existing = await db
      .select()
      .from(categories)
      .where(eq(categories.id, cat.id));

    if (existing.length === 0) {
      // Insert new fixed ID category
      await db.insert(categories).values(cat);
    } else if (existing[0].name !== cat.name) {
      // Keep ID stable, but fix the name if it drifted
      await db
        .update(categories)
        .set({ name: cat.name })
        .where(eq(categories.id, cat.id));
    }
  }

  console.log("Default categories ensured");
}

module.exports = { ensureDefaultCategories };
