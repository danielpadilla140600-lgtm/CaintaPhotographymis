/**
 * Source-Level Regression Tests — #14 Reschedule Persistence & Single-Write
 *
 * Guards the audit findings/fixes for the rescheduling workflow:
 *  - server PUT /api/bookings/:id/reschedule writes the canonical source of
 *    truth (bookingDate + timeSlot) on direct reschedule, and NEVER rewrites
 *    those fields for a pending approval request (the request lives only in
 *    rescheduleRequest).
 *  - the approval path copies requestedDate/requestedTimeSlot into
 *    bookingDate/timeSlot, flips status to "Rescheduled", and records history
 *    fields (previousDate / previousTimeSlot, not a "reschedule_date" shadow).
 *  - the direct path returns an explicit result envelope (isPendingApproval,
 *    newDate/newTimeSlot, previousDate/previousTimeSlot, status) instead of
 *    leaving the client to assume the request body won.
 *  - the approval message is emitted only after a persisted write, never on
 *    the pending-request branch.
 *  - the customer App-level callback never issues its own reschedule PUT
 *    (no second stale write); it merges the server-returned booking.
 *  - conflict validation excludes the rescheduled booking itself.
 *
 * Source-level analysis (no running server/DB), consistent with the other
 * preservation suites in this folder.
 */

import * as fs from "fs";
import * as path from "path";
import { describe, it, expect } from "vitest";

const ROOT = path.resolve(__dirname, "../..");

function readSource(relPath: string): string {
  return fs.readFileSync(path.join(ROOT, relPath), "utf-8");
}

function extractRescheduleHandler(src: string): string {
  const start = src.indexOf('app.put("/api/bookings/:id/reschedule",');
  const end = src.indexOf("\napp.", start + 1);
  return start !== -1 ? src.slice(start, end !== -1 ? end : undefined) : "";
}

// ---------------------------------------------------------------------------
// §14.1 — the database record actually moves to the new date/time
// ---------------------------------------------------------------------------
describe("Reschedule §14.1 — PUT handler persists bookingDate + timeSlot (source of truth)", () => {
  const src = readSource("server.ts");
  const handler = extractRescheduleHandler(src);

  it("PUT /api/bookings/:id/reschedule endpoint exists", () => {
    expect(src).toContain('app.put("/api/bookings/:id/reschedule",');
  });

  it("direct reschedule writes the canonical bookingDate field (not a shadow field)", () => {
    expect(handler).toMatch(/bookingDate:\s*newDate/);
  });

  it("direct reschedule writes the canonical timeSlot field (not a shadow field)", () => {
    expect(handler).toMatch(/timeSlot:\s*newTimeSlot/);
  });

  it("direct reschedule flips status to Rescheduled", () => {
    expect(handler).toMatch(/status:\s*["']Rescheduled["']/);
  });

  it("the pending-request branch does NOT rewrite bookingDate/timeSlot", () => {
    const branchStart = handler.indexOf("rescheduleRequest = {");
    const branchEnd = handler.indexOf("db.save()", branchStart);
    const branch = branchStart !== -1 ? handler.slice(branchStart, branchEnd !== -1 ? branchEnd : undefined) : "";
    expect(branch).not.toMatch(/bookingDate\s*[:=]/);
    expect(branch).not.toMatch(/timeSlot\s*[:=]/);
  });
});


// ---------------------------------------------------------------------------
// §14.2 + §14.8 — result envelope: no assumed success, no conflicting states
// ---------------------------------------------------------------------------
describe("Reschedule §14.2/§14.8 — result envelope distinguishes applied vs pending", () => {
  const src = readSource("server.ts");
  const handler = extractRescheduleHandler(src);

  it("the pending-request branch returns an explicit isPendingApproval flag", () => {
    expect(handler).toContain("isPendingApproval");
  });

  it("the direct path echoes the persisted schedule (newDate/newTimeSlot/status)", () => {
    expect(handler).toContain("newDate:");
    expect(handler).toContain("newTimeSlot:");
    expect(handler).toMatch(/status:\s*db\.bookings\[index\]\.status/);
  });

  it("the direct path records where the booking moved from (previousDate/previousTimeSlot)", () => {
    expect(handler).toContain("previousDate");
    expect(handler).toContain("previousTimeSlot");
  });

  it("the 'rescheduled' success message is emitted after the write, not on the pending branch", () => {
    const pendingFlag = handler.indexOf("isPendingApproval: true");
    const directTail = pendingFlag !== -1 ? handler.slice(pendingFlag) : handler;
    expect(directTail).toMatch(/message:\s*`Booking rescheduled to/);
    const pendingStart = handler.indexOf("booking.rescheduleRequest = {");
    const pendingEnd = handler.indexOf("return res.json({", pendingStart);
    const pendingReturn = pendingStart !== -1 && pendingEnd !== -1 ? handler.slice(pendingStart, pendingEnd + 400) : "";
    expect(pendingReturn).toMatch(/submitted to studio owner for approval/);
    expect(pendingReturn).not.toMatch(/Booking rescheduled to/);
  });

  it("the booking mapper persists reschedule_request and reads it back (restarts keep it)", () => {
    const db = readSource("src/db/database.ts");
    expect(db).toContain("reschedule_request");
    expect(db).toContain("parsedRescheduleRequest");
  });
});

// ---------------------------------------------------------------------------
// §14.3 — single source of truth; availability + calendar read the same fields
// ---------------------------------------------------------------------------
describe("Reschedule §14.3 — one source of truth for the schedule", () => {
  const db = readSource("src/db/database.ts");
  const modal = readSource("src/components/RescheduleModal.tsx");
  const calendar = readSource("src/components/SystemCalendar.tsx");

  it("MySQL mapper writes booking_date/time_slot and reads them back", () => {
    expect(db).toMatch(/booking_date:\s*b\.bookingDate/);
    expect(db).toMatch(/time_slot:\s*b\.timeSlot/);
    expect(db).toMatch(/bookingDate:\s*row\.booking_date/);
  });

  it("no shadow reschedule_date / scheduled_at / appointment_date columns exist", () => {
    const setup = readSource("database_setup.sql");
    const table = setup.slice(setup.search(/CREATE TABLE\s+bookings\s*\(/i));
    expect(table).not.toMatch(/reschedule_date|scheduled_at|appointment_date/i);
    expect(db).not.toMatch(/reschedule_date|scheduled_at|appointment_date/);
  });

  it("the reschedule modal's own conflict check reads bookingDate/timeSlot", () => {
    expect(modal).toContain("b.bookingDate !== date");
  });

  it("the studio calendar renders from bookingDate", () => {
    expect(calendar).toContain("bookingsByDate[b.bookingDate]");
  });

  it("the customer dashboard lists the authoritative bookingDate/timeSlot", () => {
    const dash = readSource("src/pages/CustomerDashboard.tsx");
    expect(dash).toContain("value: bk.bookingDate");
    expect(dash).toContain("value: bk.timeSlot");
  });
});

// ---------------------------------------------------------------------------
// §14.4 — availability: new slot occupied, old slot released, self excluded
// ---------------------------------------------------------------------------
describe("Reschedule §14.4 — availability conflict validation", () => {
  const src = readSource("server.ts");
  const handler = extractRescheduleHandler(src);

  it("conflict check compares against the NEW date (not the old one)", () => {
    expect(handler).toMatch(/b\.bookingDate !== newDate/);
  });

  it("conflict check excludes the rescheduled booking itself", () => {
    expect(handler).toMatch(/if \(b\.id === booking\.id\) return false/);
  });

  it("conflict check ignores terminal bookings (Cancelled/Rejected/Expired)", () => {
    expect(handler).toMatch(/\["Cancelled", "Rejected", "Expired"\]\.includes\(b\.status\)/);
  });

  it("the approve path re-validates the requested slot before applying it", () => {
    const approve = src.slice(src.indexOf('app.put("/api/bookings/:id/reschedule-approve"'));
    expect(approve).toMatch(/b\.bookingDate !== reqDate/);
    expect(approve).toMatch(/booking\.bookingDate = reqDate/);
    expect(approve).toMatch(/booking\.timeSlot = reqSlot/);
  });
});

// ---------------------------------------------------------------------------
// §14 — frontend: exactly ONE reschedule PUT, then merge the server record
// ---------------------------------------------------------------------------
describe("Reschedule §14 — single write + authoritative UI merge", () => {
  const app = readSource("src/App.tsx");

  it("App-level reschedule callback never issues its own PUT", () => {
    const start = app.indexOf("handleRescheduleBooking");
    const end = app.indexOf("\n  };", start);
    const fn = start !== -1 ? app.slice(start, end !== -1 ? end : undefined) : "";
    expect(fn).not.toContain("/reschedule");
    expect(fn).not.toMatch(/method:\s*["']PUT["']/);
  });

  it("App-level callback merges the server-returned booking into state", () => {
    const start = app.indexOf("handleRescheduleBooking");
    const end = app.indexOf("\n  };", start);
    const fn = start !== -1 ? app.slice(start, end !== -1 ? end : undefined) : "";
    expect(fn).toContain("setBookings");
    expect(fn).toContain("fetchMasterData");
  });

  it("customer modal shows success from the RETURNED booking, not the request", () => {
    const modal = readSource("src/components/RescheduleModal.tsx");
    expect(modal).toMatch(/data\.booking\?\.bookingDate/);
    expect(modal).toMatch(/data\.booking\?\.timeSlot/);
  });

  it("customer modal distinguishes pending approval from applied reschedule", () => {
    const modal = readSource("src/components/RescheduleModal.tsx");
    expect(modal).toContain("isPendingApproval");
    expect(modal).toMatch(/awaiting studio approval/);
  });
});

// ---------------------------------------------------------------------------
// §14.6 + §14.7 — notifications carry new schedule; external sync stays manual
// ---------------------------------------------------------------------------
describe("Reschedule §14.6/§14.7 — notifications and calendar integration", () => {
  const src = readSource("server.ts");

  it("notifications reference the applied move (old + new), never only the request", () => {
    const handler = extractRescheduleHandler(src);
    expect(handler).toMatch(/rescheduled from \$\{oldDate\} \$\{oldSlot\} to/);
  });

  it("the approval path notifies the customer with the applied schedule", () => {
    const approve = src.slice(src.indexOf('app.put("/api/bookings/:id/reschedule-approve"'));
    expect(approve).toMatch(/Reschedule Request Approved!/);
    expect(approve).toMatch(/New Schedule: \$\{reqDate\} at \$\{reqSlot\}/);
  });

  it("there is no automatic external-calendar write that could drift from the DB", () => {
    // calendarSync is a client-side manual export (Google URL / .ics download),
    // never a server-side write — verify no server handler calls into it.
    expect(src).not.toContain("calendarSync");
    expect(src).not.toMatch(/calendar\.google\.com/);
    const sync = readSource("src/utils/calendarSync.ts");
    expect(sync).toMatch(/Generates a Google Calendar quick-add URL/);
  });
});
