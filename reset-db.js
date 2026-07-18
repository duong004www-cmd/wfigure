require("dotenv").config();
const db = require("./db");

(async () => {
  try {
    await db.query(`
      DROP TABLE IF EXISTS
      products,
      users,
      orders,
      categories,
      blog_posts,
      contacts,
      contact_info,
      flash_sale,
      site_content,
      site_content_versions,
      site_music
      CASCADE;
    `);

    console.log("✅ All tables dropped");
  } catch (err) {
    console.error(err);
  } finally {
    process.exit();
  }
})();