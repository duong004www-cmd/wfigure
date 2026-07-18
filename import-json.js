require("dotenv").config();

const fs = require("fs");
const path = require("path");
const db = require("./db");

async function createTable(table) {
  await db.query(`
    CREATE TABLE IF NOT EXISTS ${table} (
      id SERIAL PRIMARY KEY,
      data JSONB NOT NULL
    )
  `);
}

async function importTable(table, filename) {
  const filePath = path.join(__dirname, "data", filename);

  if (!fs.existsSync(filePath)) {
    console.log(`⚠️ Không tìm thấy ${filename}`);
    return;
  }

  let data;

  try {
    data = JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (err) {
    console.log(`❌ Lỗi đọc ${filename}:`, err.message);
    return;
  }

  await createTable(table);

  await db.query(`TRUNCATE TABLE ${table} RESTART IDENTITY`);

  if (Array.isArray(data)) {
    for (const item of data) {
      await db.query(
        `INSERT INTO ${table}(data) VALUES($1)`,
        [JSON.stringify(item)]
      );
    }

    console.log(`✅ ${table}: ${data.length} bản ghi`);
  } else {
    await db.query(
      `INSERT INTO ${table}(data) VALUES($1)`,
      [JSON.stringify(data)]
    );

    console.log(`✅ ${table}: 1 object`);
  }
}

async function main() {
  console.log("===== IMPORT JSON -> POSTGRESQL =====");

  await importTable("products", "products.json");
  await importTable("users", "users.json");
  await importTable("orders", "orders.json");
  await importTable("categories", "categories.json");
  await importTable("contacts", "contacts.json");
  await importTable("contact_info", "contact-info.json");
  await importTable("flash_sale", "flash-sale.json");
  await importTable("site_content", "site-content.json");
  await importTable("site_content_draft", "site-content-draft.json");
  await importTable("site_content_versions", "site-content-versions.json");
  await importTable("site_music", "site-music.json");
  await importTable("blog_posts", "blog-posts.json");

  console.log("");
  console.log("🎉 IMPORT THÀNH CÔNG!");
  console.log("Bạn có thể bắt đầu chuyển website sang PostgreSQL.");
  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Import thất bại:");
  console.error(err);
  process.exit(1);
});