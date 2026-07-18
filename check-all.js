require("dotenv").config();
const db = require("./db");

(async () => {
  const tables = [
    "products",
    "users",
    "orders",
    "categories",
    "flash_sale",
    "site_content",
    "site_music",
    "contact_info",
    "blog_posts"
  ];

  for (const table of tables) {
    const result = await db.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name='${table}'
      ORDER BY ordinal_position
    `);

    console.log("\n======", table, "======");
    console.table(result.rows);
  }

  process.exit();
})();