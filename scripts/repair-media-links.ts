/**
 * Repair utility — re-activates media files that are still referenced by a live
 * database record but were wrongly flagged as "deleted" in `media_files`.
 *
 * Background: replacing a print product's catalog photo used to snapshot the
 * "old" image AFTER the new upload had already been stored, so the brand new
 * media row was flagged `deleted` immediately. Because GET /api/media/:id
 * refuses anything that is not `active`, every product photo in the storefront
 * rendered as a dead (broken) image.
 *
 * The codebug is fixed, but the rows damaged before the fix stay `deleted`.
 * This script walks every column that stores a `/api/media/<id>` reference and
 * flips those rows back to `active`.
 *
 * Usage:
 *   npm run repair:media
 *
 * Always restart the server afterwards: the app keeps its own in-memory copy of
 * `media_files` and will overwrite the repair on its next save.
 */

import mysql from "mysql2/promise";
import dotenv from "dotenv";

dotenv.config();

/** Table/column pairs that may contain one or more `/api/media/<id>` references. */
const MEDIA_REFERENCE_COLUMNS: Array<{ table: string; column: string }> = [
  { table: "studios", column: "logo" },
  { table: "studios", column: "cover_image" },
  { table: "studios", column: "gcash_qr_code" },
  { table: "studios", column: "maya_qr_code" },
  { table: "services", column: "image" },
  { table: "packages", column: "image" },
  { table: "addons", column: "image" },
  { table: "print_products", column: "image" },
  { table: "print_orders", column: "uploaded_photo" },
  { table: "print_orders", column: "proof_of_payment" },
  { table: "payments", column: "proof_of_payment" },
  { table: "photo_proofings", column: "photos" },
  { table: "cms_settings", column: "value" }
];

const MEDIA_ID_PATTERN = /\/api\/media\/([A-Za-z0-9._-]+)/g;

async function main() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || "127.0.0.1",
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "cainta_photography_mis",
    connectTimeout: 15000
  });

  const referencedMediaIds = new Map<string, string[]>();

  for (const { table, column } of MEDIA_REFERENCE_COLUMNS) {
    const [columnCheck]: any = await connection.query(
      `SELECT 1 FROM information_schema.columns
        WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ? LIMIT 1`,
      [table, column]
    );
    if (!columnCheck.length) continue;

    const [rows]: any = await connection.query(
      `SELECT id, \`${column}\` AS value FROM \`${table}\`
        WHERE \`${column}\` LIKE '%/api/media/%'`
    );

    for (const row of rows) {
      const matches = String(row.value || "").match(MEDIA_ID_PATTERN) || [];
      for (const match of matches) {
        const mediaId = match.replace("/api/media/", "");
        const owners = referencedMediaIds.get(mediaId) || [];
        owners.push(`${table}.${column} (${row.id})`);
        referencedMediaIds.set(mediaId, owners);
      }
    }
  }

  if (referencedMediaIds.size === 0) {
    console.log("[Repair] No /api/media references found — nothing to do.");
    await connection.end();
    return;
  }

  const mediaIds = [...referencedMediaIds.keys()];
  const placeholders = mediaIds.map(() => "?").join(", ");
  const [mediaRows]: any = await connection.query(
    `SELECT id, access_status FROM media_files WHERE id IN (${placeholders})`,
    mediaIds
  );

  const statusById = new Map<string, string>();
  for (const row of mediaRows) statusById.set(row.id, row.access_status);

  let restored = 0;
  for (const mediaId of mediaIds) {
    const status = statusById.get(mediaId);
    if (status === undefined) {
      console.warn(`[Repair] MISSING media record ${mediaId} — referenced by ${referencedMediaIds.get(mediaId)?.join(", ")}`);
      continue;
    }
    if (status === "active") continue;

    await connection.query(`UPDATE media_files SET access_status = 'active' WHERE id = ?`, [mediaId]);
    restored += 1;
    console.log(`[Repair] Reactivated ${mediaId} (was '${status}') — referenced by ${referencedMediaIds.get(mediaId)?.join(", ")}`);
  }

  console.log(`\n[Repair] ${restored} media file(s) restored. Restart the server so the in-memory cache reloads from MySQL.`);
  await connection.end();
}

main().catch((err) => {
  console.error("[Repair] Failed:", err.message);
  process.exit(1);
});
