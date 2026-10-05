import fs from "fs";
import path from "path";
import mysql from "mysql2/promise";
import dotenv from "dotenv";

dotenv.config();

async function runImport() {
  const host = process.env.DB_HOST || "127.0.0.1";
  const port = Number(process.env.DB_PORT) || 3306;
  const user = process.env.DB_USER || "root";
  const password = process.env.DB_PASSWORD || "";
  const database = process.env.DB_NAME || "cainta_photography_mis";
  const useSSL = process.env.DB_SSL === "true" || process.env.DB_SSL === "1";

  // TiDB Cloud Serverless requires TLS 1.2+
  const sslConfig = useSSL
    ? {
        minVersion: "TLSv1.2" as const,
        rejectUnauthorized: false
      }
    : undefined;

  console.log(`\n[Import] Connecting to ${host}:${port} as '${user}'...`);
  console.log(`[Import] SSL: ${useSSL ? "enabled" : "disabled"}`);

  const sqlFile = path.join(process.cwd(), "cainta_photography_mis.sql");
  if (!fs.existsSync(sqlFile)) {
    console.error(`[Error] SQL file not found: ${sqlFile}`);
    process.exit(1);
  }

  // Step 1: Connect to default 'sys' database to drop and cleanly recreate our target database
  console.log(`[Import] Step 1: Preparing clean database '${database}'...`);
  const adminConn = await mysql.createConnection({
    host,
    port,
    user,
    password,
    database: "sys", // TiDB default database
    connectTimeout: 15000,
    ssl: sslConfig
  });
  await adminConn.query(`DROP DATABASE IF EXISTS \`${database}\`;`);
  await adminConn.query(
    `CREATE DATABASE \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`
  );
  await adminConn.end();
  console.log(`[Import] Database '${database}' is freshly created and ready!`);

  // Step 2: Read SQL file and wrap with safe foreign key settings
  const sqlContent = fs.readFileSync(sqlFile, "utf-8");
  const fullSql = `
SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0;
SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO';
${sqlContent}
SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS;
SET SQL_MODE=@OLD_SQL_MODE;
  `;

  // Step 3: Import into the target database
  console.log(`[Import] Step 2: Importing all tables and seed data into '${database}'...`);
  const conn = await mysql.createConnection({
    host,
    port,
    user,
    password,
    database,
    multipleStatements: true,
    connectTimeout: 60000,
    ssl: sslConfig
  });

  try {
    await conn.query(fullSql);
    const [tables]: any = await conn.query("SHOW TABLES");
    console.log(`\n🎉 [SUCCESS] Lahat ng tables (${tables.length} tables) at seed data ay matagumpay na na-import sa TiDB Cloud!`);
    console.log(`\n📋 I-update mo na ang Render environment variables gamit ang:\n`);
    console.log(`  DB_HOST=${host}`);
    console.log(`  DB_PORT=${port}`);
    console.log(`  DB_USER=${user}`);
    console.log(`  DB_PASSWORD=${password}`);
    console.log(`  DB_NAME=${database}`);
    console.log(`  DB_SSL=true\n`);
  } finally {
    await conn.end();
  }
}

runImport().catch((err) => {
  console.error("\n[Import Error]:", err.message);
  if (err.message.includes("Access denied")) {
    console.error("\n💡 Tip: Siguraduhing tama ang username at password sa .env");
    console.error("   Para sa TiDB Cloud, ang username format ay: <prefix>.root");
    console.error("   Halimbawa: 26Bj1YQX46F83ZH.root\n");
  }
  process.exit(1);
});
