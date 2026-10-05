/**
 * generate-icons.mjs
 * Converts public/icons/icon.svg → icon-192.png and icon-512.png
 * Requires: npm install -g sharp  OR  npm install sharp (local)
 *
 * Run with: node scripts/generate-icons.mjs
 */

import { createRequire } from "module";
import { fileURLToPath } from "url";
import path from "path";
import fs from "fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const svgPath = path.join(root, "public", "icons", "icon.svg");
const iconsDir = path.join(root, "public", "icons");

let sharp;
try {
  const require = createRequire(import.meta.url);
  sharp = require("sharp");
} catch {
  console.error(
    "❌  'sharp' is not installed. Run: npm install sharp\n" +
    "    Then re-run: node scripts/generate-icons.mjs"
  );
  process.exit(1);
}

const svgBuffer = fs.readFileSync(svgPath);

for (const size of [192, 512]) {
  const outPath = path.join(iconsDir, `icon-${size}.png`);
  await sharp(svgBuffer)
    .resize(size, size)
    .png()
    .toFile(outPath);
  console.log(`✅  Generated ${outPath}`);
}

console.log("\n🎉  Icons ready! You can now build the PWA.\n");
