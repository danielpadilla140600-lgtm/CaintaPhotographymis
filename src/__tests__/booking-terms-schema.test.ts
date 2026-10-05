/**
 * Bookings table — schema auto-migration regression tests
 *
 * BUG SUMMARY:
 *   Booking a session through the Booking Wizard failed to reach MySQL. The
 *   server terminal printed:
 *     [Database] MySQL insert failed on table 'bookings':
 *       Error: Unknown column 'agreed_to_terms' in 'field list'
 *   (errno 1054 / ER_BAD_FIELD_ERROR) and repeated
 *     [Database] syncTable failed for 'bookings': ...
 *   `toDbBooking()` writes agreed_to_terms, agreed_to_terms_at and
 *   reschedule_request, but the live MySQL `bookings` table had no such columns
 *   and `bootstrapDatabaseSchema()` never migrated them. Because one bad column
 *   aborts the entire upsert, NO booking was persisted to MySQL at all (only the
 *   notification emails went out).
 *
 * EXPECTED BEHAVIOR (asserted below):
 *   - bootstrapDatabaseSchema() auto-migrates every column toDbBooking() writes.
 *   - the DB <-> model mappers keep the terms / reschedule fields so an accepted
 *     booking survives a server restart.
 *   - the base SQL schema imported by `npm run import:db` already contains the
 *     columns, so a fresh install never needs the ALTER fallback.
 *
 * These tests use source-level analysis (reading src/db/database.ts and the .sql
 * schema files), the same approach as the project's existing
 * bug-condition / preservation / studio-social-fields tests.
 */

import * as fs from "fs";
import * as path from "path";
import { describe, it, expect } from "vitest";

const ROOT = path.resolve(__dirname, "../..");

function readSource(relPath: string): string {
  return fs.readFileSync(path.join(ROOT, relPath), "utf-8");
}

// Columns written by toDbBooking() that MUST exist in MySQL or the whole
// `bookings` sync aborts.
const BOOKING_COLUMNS = [
  "studio_id",
  "customer_id",
  "service_id",
  "package_id",
  "booking_date",
  "time_slot",
  "addons",
  "customer_name",
  "customer_email",
  "customer_phone",
  "customer_notes",
  "requirements_doc",
  "status",
  "total_amount",
  "amount_paid",
  "down_payment_amount",
  "remaining_balance",
  "payment_status",
  "final_payment_status",
  "payment_option",
  "payment_due_at",
  "cancellation_reason",
  "cancelled_by",
  "cancelled_at",
  "agreed_to_terms",
  "agreed_to_terms_at",
  "reschedule_request",
  "is_archived",
  "archived_at",
  "archived_by",
  "created_at"
];

// The three columns that were missing from the live database and caused the
// "Unknown column ... in 'field list'" failure.
const TERMS_COLUMNS = ["agreed_to_terms", "agreed_to_terms_at", "reschedule_request"];

function extractBookingMapper(src: string): string {
  const start = src.indexOf("function toDbBooking(");
  const end = src.indexOf("function fromDbBooking(");
  return start === -1 || end === -1 ? "" : src.slice(start, end);
}

function extractBookingTable(baseSql: string): string {
  // Both schema files declare the table either back-ticked or bare.
  const start = baseSql.search(/CREATE TABLE\s+`?bookings`?\s*\(/);
  if (start === -1) return "";
  const end = baseSql.indexOf(";", start);
  return end === -1 ? "" : baseSql.slice(start, end);
}


// ---------------------------------------------------------------------------
// Section 1 — the mapper still writes the terms / reschedule columns
// ---------------------------------------------------------------------------
describe("toDbBooking() — terms acceptance & reschedule fields", () => {
  const mapper = extractBookingMapper(readSource("src/db/database.ts"));

  it("the booking mapper is still present", () => {
    expect(mapper).toContain("booking_date");
    expect(mapper).toContain("customer_name");
  });

  it.each(TERMS_COLUMNS)("writes %s", (column) => {
    expect(mapper).toContain(column);
  });

  it("agreed_to_terms is stored as a MySQL-friendly 0/1 flag", () => {
    expect(mapper).toMatch(/agreed_to_terms:\s*b\.agreedToTerms\s*\?\s*1\s*:\s*0/);
  });
});

// ---------------------------------------------------------------------------
// Section 2 — MySQL schema must contain every column the booking mapper writes
// ---------------------------------------------------------------------------
describe("bookings table — every column toDbBooking() writes is guaranteed to exist", () => {
  const dbSrc = readSource("src/db/database.ts");
  const baseTable = extractBookingTable(readSource("cainta_photography_mis.sql"));

  it("the bootstrapper and the base schema are both readable", () => {
    expect(dbSrc).toContain("function toDbBooking(");
    expect(baseTable).toContain("CREATE TABLE");
  });

  it.each(BOOKING_COLUMNS)(
    "bookings.%s is declared in the base schema or auto-migrated at startup",
    (column) => {
      // FAILS on unfixed code for the three terms/reschedule columns: they were
      // in neither place, so the upsert died with "Unknown column ... in 'field
      // list'" and no booking row was ever written.
      const declaredInSchema = baseTable.includes(column);
      const autoMigrated = dbSrc.includes(`ALTER TABLE bookings ADD COLUMN ${column}`);
      expect(
        declaredInSchema || autoMigrated,
        `bookings.${column} is not guaranteed to exist in MySQL`
      ).toBe(true);
    }
  );

  it("the existing-database migration adds the three previously missing columns", () => {
    // These columns were missing from a live database created before the terms
    // and reschedule features shipped, so they MUST be auto-migrated (the base
    // schema alone would not fix an already-installed database).
    for (const column of TERMS_COLUMNS) {
      expect(dbSrc).toContain(`ALTER TABLE bookings ADD COLUMN ${column}`);
    }
  });

  it("the live-database fix is idempotent (every ALTER is guarded)", () => {
    // Each ALTER must sit inside a try/catch so re-running the bootstrapper on a
    // database that already has the column keeps starting up normally.
    for (const column of TERMS_COLUMNS) {
      const stmt = `ALTER TABLE bookings ADD COLUMN ${column}`;
      const idx = dbSrc.indexOf(stmt);
      expect(idx).toBeGreaterThan(-1);
      const window = dbSrc.slice(idx, idx + 140);
      // "already exists" errors are swallowed by an empty catch block.
      expect(window).toMatch(/\} catch \(e\) \{\}/);
    }
  });

  it("fromDbBooking() reads the terms fields back so they survive a restart", () => {
    const mapper = dbSrc.slice(
      dbSrc.indexOf("function fromDbBooking("),
      dbSrc.indexOf("function toDbPayment(")
    );
    expect(mapper).toContain("agreedToTerms");
    expect(mapper).toContain("agreedToTermsAt");
    expect(mapper).toContain("rescheduleRequest");
  });
});

// ---------------------------------------------------------------------------
// Section 3 — fresh installs get the columns straight from the schema scripts
// ---------------------------------------------------------------------------
describe("base SQL schema — fresh imports already include the booking columns", () => {
  it.each(["cainta_photography_mis.sql", "database_setup.sql"])(
    "%s declares every terms/reschedule booking column",
    (file) => {
      const table = extractBookingTable(readSource(file));
      expect(table).not.toBe("");
      for (const column of TERMS_COLUMNS) {
        expect(table).toContain(column);
      }
    }
  );

  it("cainta_photography_mis.sql stays aligned with toDbBooking()", () => {
    const mapper = extractBookingMapper(readSource("src/db/database.ts"));
    const table = extractBookingTable(readSource("cainta_photography_mis.sql"));
    const writtenColumns = BOOKING_COLUMNS.filter((c) => mapper.includes(`${c}:`));
    const missing = writtenColumns.filter((c) => !table.includes(c));
    expect(missing).toEqual([]);
  });
});
