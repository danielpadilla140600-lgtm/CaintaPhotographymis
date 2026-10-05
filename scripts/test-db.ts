import mysql from "mysql2/promise";
import dotenv from "dotenv";
dotenv.config();

const host = process.env.DB_HOST!;
const port = Number(process.env.DB_PORT) || 4000;
const user = process.env.DB_USER!;
const password = process.env.DB_PASSWORD!;
const database = process.env.DB_NAME || "cainta_photography_mis";

async function verify() {
  console.log(`\nVerifying connection to TiDB Cloud (${host}:${port}) as '${user}'...`);
  try {
    const conn = await mysql.createConnection({
      host,
      port,
      user,
      password,
      database,
      ssl: { minVersion: "TLSv1.2", rejectUnauthorized: false }
    });
    const [tables]: any = await conn.query("SHOW TABLES");
    console.log(`✅ Connection successful! Found ${tables.length} tables in '${database}'.`);
    await conn.end();
  } catch (err: any) {
    console.error(`❌ Verification failed:`, err.message);
  }
}

verify();
