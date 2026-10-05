/**
 * Regression tests for the "uploaded file renders as a dead image" defect.
 *
 * Root causes that were fixed:
 *   1. GET /api/media/:id never allowed STUDIO_QR_CODE media (entityType
 *      "studio-payment"), so every GCash / Maya QR image the studio owner
 *      uploaded came back 401/404 — a dead image in the booking wizard and in
 *      the studio dashboard.
 *   2. PUT /api/print-products marked the *newly uploaded* catalog images as
 *      "deleted" because the cleanup pass ran after saveProtectedMedia() had
 *      already pushed the new rows, so every catalog photo 404'd.
 *   3. The Maya payment fields were missing from the MySQL `studios` table and
 *      from toDbStudio(), so an uploaded Maya QR code was silently dropped on
 *      the next save/reload.
 *
 * These are source-level invariants (the repo's existing convention) because
 * server.ts boots an HTTP listener on import.
 */

import * as fs from "fs";
import * as path from "path";
import { describe, it, expect } from "vitest";

const ROOT = path.resolve(__dirname, "../..");

function readSource(relPath: string): string {
  return fs.readFileSync(path.join(ROOT, relPath), "utf-8");
}

function extractRoute(src: string, route: string): string {
  const start = src.indexOf(route);
  if (start === -1) return "";
  const end = src.indexOf("\napp.", start + 1);
  return src.slice(start, end === -1 ? undefined : end);
}

const serverSrc = readSource("server.ts");
const dbSrc = readSource("src/db/database.ts");

// ---------------------------------------------------------------------------
// Section 1 — Studio GCash / Maya QR codes must be readable media
// ---------------------------------------------------------------------------
describe("GET /api/media/:id — studio QR codes are no longer dead images", () => {
  const mediaRoute = extractRoute(serverSrc, 'app.get("/api/media/:id"');

  it("the media route is still present", () => {
    expect(mediaRoute).toContain('app.get("/api/media/:id"');
  });

  it("STUDIO_QR_CODE is treated as public media", () => {
    const publicList = mediaRoute.slice(
      mediaRoute.indexOf("const publicPurposes = ["),
      mediaRoute.indexOf("];", mediaRoute.indexOf("const publicPurposes = ["))
    );
    expect(publicList).toContain("STUDIO_QR_CODE");
  });

  it("resolves the studio for entityType 'studio-payment' so the approval check works", () => {
    const resolver = mediaRoute.slice(
      mediaRoute.indexOf("const relatedStudioId ="),
      mediaRoute.indexOf("const relatedStudio =")
    );
    // FAILS on unfixed code: "studio-payment" fell through to undefined, so the
    // media was never public and always required a bearer token.
    expect(resolver).toContain('"studio-payment"');
  });

  it("canAccessMedia() grants the studio owner/staff access to their own QR code", () => {
    const canAccess = serverSrc.slice(
      serverSrc.indexOf("function canAccessMedia("),
      serverSrc.indexOf('app.post("/api/media"')
    );
    // FAILS on unfixed code: no branch existed for entityType "studio-payment",
    // so the owner's own upload returned 404 inside the dashboard.
    expect(canAccess).toContain('media.entityType === "studio-payment"');
  });
});

// ---------------------------------------------------------------------------
// Section 2 — Replacing print-product photos must not delete the new photos
// ---------------------------------------------------------------------------
describe("PUT /api/print-products/:id — freshly uploaded catalog images stay active", () => {
  const updateHandler = extractRoute(serverSrc, 'app.put("/api/print-products/:id"');

  it("the update handler is still present", () => {
    expect(updateHandler).toContain('app.put("/api/print-products/:id"');
  });

  it("snapshots the previous media ids before storing the new uploads", () => {
    // FAILS on unfixed code: no snapshot existed, so the cleanup pass below
    // matched the media rows created by this very request.
    expect(updateHandler).toContain("previousImageMediaIds");
  });

  it("only retires media that already belonged to the product", () => {
    const cleanupStart = updateHandler.indexOf("if (savedImages.length > 0)");
    expect(cleanupStart).toBeGreaterThan(-1);
    const cleanup = updateHandler.slice(cleanupStart, cleanupStart + 600);

    expect(cleanup).toContain("previousImageMediaIds.has(media.id)");
    // The old broad filter (entityType + entityId + purpose) would also match the
    // brand new rows and is what marked them "deleted".
    expect(cleanup).not.toContain('entityId === product.id');
  });
});

// ---------------------------------------------------------------------------
// Section 3 — Studio QR lookup endpoints must not be blocked by the auth gate
// ---------------------------------------------------------------------------
describe("public API whitelist — studio QR endpoints stay reachable", () => {
  const middlewareStart = serverSrc.indexOf("// Public reads are intentionally narrow");
  const middlewareEnd = serverSrc.indexOf("const smtpEmail");
  const middleware = middlewareStart === -1 || middlewareEnd === -1
    ? ""
    : serverSrc.slice(middlewareStart, middlewareEnd);

  it("the authentication middleware is still present", () => {
    expect(middleware.length).toBeGreaterThan(0);
    expect(middleware).toContain("Authentication is required.");
  });

  it.each(["/payment-methods", "/gcash"])(
    "GET /api/studios/:id%s is public so the QR image can load",
    (suffix) => {
      // FAILS on unfixed code: only "/api/studios/<id>" matched, so the QR lookup
      // endpoints answered 401 for unauthenticated clients.
      const pattern = suffix.replace("/", "\\/");
      expect(middleware).toContain(pattern);
    }
  );
});

// ---------------------------------------------------------------------------
// Section 4 — Maya payment details must survive a restart
// ---------------------------------------------------------------------------
describe("studios table — Maya payout fields are persisted like GCash", () => {
  const MAYA_COLUMNS = ["maya_number", "maya_account_name", "maya_qr_code"];

  it.each(MAYA_COLUMNS)("bootstrapDatabaseSchema() adds studios.%s", (column) => {
    // FAILS on unfixed code: the columns did not exist, so an uploaded Maya QR
    // code was lost the moment the studio record was written back.
    expect(dbSrc).toContain(`ALTER TABLE studios ADD COLUMN ${column}`);
  });

  it("toDbStudio() writes the Maya fields", () => {
    const mapper = dbSrc.slice(dbSrc.indexOf("function toDbStudio("), dbSrc.indexOf("function fromDbStudio("));
    for (const column of MAYA_COLUMNS) {
      expect(mapper).toContain(column);
    }
  });

  it("fromDbStudio() reads the Maya fields back", () => {
    const mapper = dbSrc.slice(dbSrc.indexOf("function fromDbStudio("), dbSrc.indexOf("function toDbCategory("));
    for (const column of MAYA_COLUMNS) {
      expect(mapper).toContain(column);
    }
  });
});
