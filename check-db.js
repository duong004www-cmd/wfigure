require("dotenv").config();

const db = require("./db");

(async () => {
  try {
    const result = await db.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'categories'
      ORDER BY ordinal_position;
    `);

    console.table(result.rows);
  } catch (err) {
    console.error(err);
  } finally {
    process.exit();
  }
})();