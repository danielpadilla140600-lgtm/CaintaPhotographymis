/**
 * Studio Online Presence Fields — regression tests
 *
 * BUG SUMMARY:
 *   Studio owners can edit Facebook / Instagram / TikTok / other-social / website
 *   links in Studio Dashboard → Settings, but PUT /api/studios/:id rejected the
 *   save with:
 *     "Unknown or protected studio fields: facebookUrl, instagramUrl, tiktokUrl,
 *      otherSocialUrl, websiteUrl."
 *   because the server allow-list for studio owners (ownerFields) never included
 *   the online-presence fields that the Studio model (src/db/types.ts) and the
 *   DB mappers already define.
 *
 *   Companion defect: the live MySQL `studios` table had no columns for those
 *   links (and none for the legacy gcash_* fields written by toDbStudio()), so the
 *   first upsert of the `studios` table failed with
 *   "Unknown column 'gcash_number' in 'field list'" — meaning NO studio profile
 *   edit reached MySQL at all, even when the API answered 200.
 *
 * EXPECTED BEHAVIOR (asserted below):
 *   - ownerFields allows the five online-presence fields while admin-only fields
 *     (ownerId, isApproved, status, businessPermit, ...) stay protected.
 *   - the handler normalizes/validates the links (http(s) only) before persisting.
 *   - bootstrapDatabaseSchema() auto-migrates every column toDbStudio() writes.
 *   - the DB <-> model mappers keep the fields so saved links survive a restart.
 *
 * These tests use source-level analysis (reading server.ts and
 * src/db/database.ts), the same approach as the project's existing
 * bug-condition / preservation tests.
 */

import * as fs from "fs";
import * as path from "path";
import { describe, it, expect } from "vitest";

const ROOT = path.resolve(__dirname, "../..");

function readSource(relPath: string): string {
  return fs.readFileSync(path.join(ROOT, relPath), "utf-8");
}

const SOCIAL_FIELDS = ["facebookUrl", "instagramUrl", "tiktokUrl", "otherSocialUrl", "websiteUrl"];
const SOCIAL_COLUMNS = ["facebook_url", "instagram_url", "tiktok_url", "other_social_url", "website_url"];
// Columns written by toDbStudio() that must exist in MySQL or the whole
// `studios` sync aborts.
const STUDIO_COLUMNS = [...SOCIAL_COLUMNS, "gcash_number", "gcash_account_name", "gcash_qr_code", "maya_number", "maya_account_name", "maya_qr_code"];

function extractStudioUpdateHandler(src: string): string {
  const start = src.indexOf('app.put("/api/studios/:id",');
  if (start === -1) return "";
  const end = src.indexOf("\napp.", start + 1);
  return src.slice(start, end === -1 ? undefined : end);
}

function extractArrayDeclaration(scope: string, declaration: string): string {
  const start = scope.indexOf(declaration);
  if (start === -1) return "";
  const end = scope.indexOf("];", start);
  return end === -1 ? "" : scope.slice(start, end);
}

// ---------------------------------------------------------------------------
// Section 1 — PUT /api/studios/:id must accept the owner's online-presence links
// ---------------------------------------------------------------------------
describe("PUT /api/studios/:id — studio owners may save their online presence links", () => {
  const handler = extractStudioUpdateHandler(readSource("server.ts"));
  const ownerFields = extractArrayDeclaration(handler, "const ownerFields = [");

  it("the studio update handler is still present", () => {
    expect(handler).toContain('app.put("/api/studios/:id"');
    expect(ownerFields.length).toBeGreaterThan(0);
  });

  it.each(SOCIAL_FIELDS)("ownerFields includes %s (no more 400 on save)", (field) => {
    // FAILS on unfixed code: these five fields were rejected as "unknown or protected".
    expect(ownerFields).toContain(`"${field}"`);
  });

  it("ownerFields still refuses admin-only studio fields", () => {
    for (const field of ["ownerId", "isApproved", "status", "businessPermit", "validId", "otherDocs", "registeredByAdmin"]) {
      expect(ownerFields).not.toContain(`"${field}"`);
    }
    // ...and the super-admin allow-list still owns them.
    const adminFields = extractArrayDeclaration(handler, "const adminFields = [");
    expect(adminFields).toContain('"isApproved"');
    expect(adminFields).toContain('"ownerId"');
    expect(adminFields).toContain("...ownerFields");
  });

  it("validates and normalizes every online-presence link before persisting", () => {
    expect(handler).toContain("sanitizeExternalUrl");
    for (const field of SOCIAL_FIELDS) {
      expect(handler).toContain(`${field}:`);
    }
  });

  it("rejects unsafe URL schemes server-side", () => {
    const src = readSource("server.ts");
    expect(src).toContain("function sanitizeExternalUrl");
    // Unsafe schemes must be blocked explicitly instead of trusting the client.
    expect(src).toMatch(/javascript|data|vbscript|file/);
    expect(src).toContain("^https?:\\/\\/");
  });
});

// ---------------------------------------------------------------------------
// Section 2 — MySQL schema must contain every column the studio mapper writes
// ---------------------------------------------------------------------------
describe("studios table — automatically migrated so profile saves reach MySQL", () => {
  const dbSrc = readSource("src/db/database.ts");

  it.each(STUDIO_COLUMNS)("bootstrapDatabaseSchema() adds studios.%s", (column) => {
    // FAILS on unfixed code: the ALTER statements were missing, so the upsert
    // failed with "Unknown column ... in 'field list'".
    expect(dbSrc).toContain(`ALTER TABLE studios ADD COLUMN ${column}`);
  });

  it("toDbStudio() persists the online presence links", () => {
    const mapper = dbSrc.slice(dbSrc.indexOf("function toDbStudio("), dbSrc.indexOf("function fromDbStudio("));
    for (const column of SOCIAL_COLUMNS) {
      expect(mapper).toContain(column);
    }
  });

  it("fromDbStudio() reads the links back so they survive a server restart", () => {
    const mapper = dbSrc.slice(dbSrc.indexOf("function fromDbStudio("), dbSrc.indexOf("function toDbCategory("));
    for (const column of SOCIAL_COLUMNS) {
      expect(mapper).toContain(column);
    }
  });
});
