require("dotenv").config();

const fs = require("fs");
const path = require("path");
const db = require("./db");

(async () => {
  try {
    console.log("Đang đọc file SQL...");

    const sql = fs.readFileSync(
      path.join(__dirname, "migrations", "001_init.sql"),
      "utf8"
    );

    console.log("Đang tạo database schema...");

    await db.query(sql);

    console.log("✅ Migration thành công!");
  } catch (err) {
    console.error("❌ Migration lỗi:");
    console.error(err);
  } finally {
    process.exit();
  }
})();