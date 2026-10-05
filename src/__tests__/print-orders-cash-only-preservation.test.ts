/**
 * Preservation Property Tests — Print Orders Cash-Only
 *
 * Spec: .kiro/specs/print-orders-cash-only/bugfix.md
 *
 * PROPERTY 2: PRESERVATION — Core Print Order and Booking Flows Unaffected
 *
 * These tests verify that the cash-only fix does NOT break the following
 * unchanged behaviours:
 *
 *   §3.1 — PUT /api/print-orders/:id/payment/record-cash sets paymentStatus = "Paid"
 *   §3.2 — POST /api/print-orders creates an order with status = "Pending"
 *   §3.3 — PUT /api/print-orders/:id/status advances the order through the
 *           full fulfillment flow (Pending → Confirmed → Processing →
 *           Quality Check → Ready for Pickup → Completed)
 *   §3.5 — POST /api/payments (booking) still accepts the customer-supplied
 *           paymentMethod and creates a "Pending Verification" payment
 *
 * The tests use source-level analysis (reading server.ts and relevant
 * component files), consistent with the bug condition exploration tests.
 * This approach requires no running server or database, making the suite
 * fast and deterministic.
 *
 * IMPORTANT: All tests MUST PASS on the fixed code.
 *
 * Validates: Requirements 3.1, 3.2, 3.3, 3.5
 */

import * as fs from "fs";
import * as path from "path";
import { describe, it, expect } from "vitest";

const ROOT = path.resolve(__dirname, "../..");

function readSource(relPath: string): string {
  return fs.readFileSync(path.join(ROOT, relPath), "utf-8");
}

// ---------------------------------------------------------------------------
// Section 1 — §3.2: POST /api/print-orders creates order with status = "Pending"
//
// Preservation: the POST handler must create orders with status = "Pending"
// and paymentMethod = "Cash" and paymentStatus = "Unpaid" for all valid payloads.
// "All valid payloads" here means any combination of valid product, quantity
// 1–99, and uploaded photo — the handler's behaviour is uniform across those
// inputs because it hardcodes all three fields.
//
// Validates: Requirement 3.2
// ---------------------------------------------------------------------------
describe('Preservation §3.2 — POST /api/print-orders creates order with status = "Pending"', () => {
  const src = readSource("server.ts");

  // Isolate the POST /api/print-orders handler to avoid cross-contamination
  // with other endpoints that may legitimately reference "Pending".
  const postHandlerStart = src.indexOf('app.post("/api/print-orders",');
  const postHandlerEnd = src.indexOf('\napp.', postHandlerStart + 1);
  const postHandler = postHandlerStart !== -1
    ? src.slice(postHandlerStart, postHandlerEnd !== -1 ? postHandlerEnd : undefined)
    : src;

  it('POST /api/print-orders handler must still exist in server.ts', () => {
    // Preservation: the endpoint itself must not have been removed by the fix
    expect(postHandlerStart).not.toBe(-1);
  });

  it('POST /api/print-orders handler hardcodes status: "Pending" for the new order', () => {
    // §3.2: every created order must start in "Pending" status regardless of
    // what fields the client submits.
    expect(postHandler).toContain('status: "Pending"');
  });

  it('POST /api/print-orders handler hardcodes paymentMethod: "Cash" (preservation of fix)', () => {
    // The fix hardcodes this; preservation tests confirm it remains hardcoded.
    expect(postHandler).toContain('paymentMethod: "Cash"');
  });

  it('POST /api/print-orders handler hardcodes paymentStatus: "Unpaid" (preservation of fix)', () => {
    expect(postHandler).toContain('paymentStatus: "Unpaid"');
  });

  it('POST /api/print-orders handler still accepts studioId, customerId, productId, quantity, uploadedPhoto, totalAmount from req.body', () => {
    // The fix must only strip payment fields — core order fields must remain
    expect(postHandler).toMatch(/studioId.*customerId.*productId|const\s*\{[^}]*studioId[^}]*\}/);
    expect(postHandler).toMatch(/productId/);
    expect(postHandler).toMatch(/quantity/);
    expect(postHandler).toMatch(/uploadedPhoto/);
    expect(postHandler).toMatch(/totalAmount/);
  });

  it('POST /api/print-orders handler still validates the product against the database', () => {
    // Core order validation must be intact
    expect(postHandler).toMatch(/db\.printProducts\.find/);
  });

  it('POST /api/print-orders handler still validates quantity range (1–100)', () => {
    // Quantity guard must still be present
    expect(postHandler).toMatch(/orderQuantity\s*<\s*1|orderQuantity\s*>\s*100|isInteger/);
  });

  it('POST /api/print-orders handler still persists the new order via db.addPrintOrder', () => {
    expect(postHandler).toContain('db.addPrintOrder');
  });

  it('POST /api/print-orders handler still notifies the studio admin on new order', () => {
    // Admin notification must survive the fix
    expect(postHandler).toMatch(/notifyUser|STUDIO_ADMIN/);
  });

  it('PrintOrder type in types.ts has status as a union that includes "Pending"', () => {
    const types = readSource("src/db/types.ts");
    // Find the PrintOrder interface block
    const ifaceStart = types.indexOf('interface PrintOrder');
    const ifaceEnd = types.indexOf('\n}', ifaceStart);
    const iface = ifaceStart !== -1 ? types.slice(ifaceStart, ifaceEnd + 2) : types;
    expect(iface).toContain('"Pending"');
  });
});

// ---------------------------------------------------------------------------
// Section 2 — §3.1: PUT /api/print-orders/:id/payment/record-cash sets
//   paymentStatus = "Paid"
//
// Preservation: the record-cash endpoint is the sole legitimate payment action
// for print orders. It must remain functional after the fix — setting
// paymentStatus to "Paid" and triggering the receipt email for any unpaid order.
//
// Validates: Requirement 3.1
// ---------------------------------------------------------------------------
describe('Preservation §3.1 — PUT /api/print-orders/:id/payment/record-cash sets paymentStatus = "Paid"', () => {
  const src = readSource("server.ts");

  // Isolate the record-cash handler
  const cashHandlerStart = src.indexOf('app.put("/api/print-orders/:id/payment/record-cash"');
  const cashHandlerEnd = src.indexOf('\napp.', cashHandlerStart + 1);
  const cashHandler = cashHandlerStart !== -1
    ? src.slice(cashHandlerStart, cashHandlerEnd !== -1 ? cashHandlerEnd : undefined)
    : src;

  it('record-cash endpoint still exists in server.ts', () => {
    expect(cashHandlerStart).not.toBe(-1);
  });

  it('record-cash handler sets paymentStatus = "Paid"', () => {
    // §3.1: the sole payment action must flip paymentStatus to "Paid"
    expect(cashHandler).toMatch(/paymentStatus\s*=\s*["']Paid["']/);
  });

  it('record-cash handler also sets paymentMethod = "Cash" (consistency)', () => {
    expect(cashHandler).toMatch(/paymentMethod\s*=\s*["']Cash["']/);
  });

  it('record-cash handler calls db.save() to persist the change', () => {
    expect(cashHandler).toContain('db.save()');
  });

  it('record-cash handler returns { success: true, printOrder } on success', () => {
    expect(cashHandler).toContain('success: true');
    expect(cashHandler).toContain('printOrder');
  });

  it('record-cash handler returns 404 when the order is not found', () => {
    // Robustness of existing endpoint must be preserved
    expect(cashHandler).toMatch(/status\(404\)/);
  });

  it('record-cash handler returns 400 when the order is already paid', () => {
    // Idempotency guard must remain
    expect(cashHandler).toContain('"Paid"');
    expect(cashHandler).toContain('already paid');
  });

  it('record-cash handler triggers the receipt PDF email', () => {
    // §3.1: receipt email must be sent — sendReceiptCopyEmail is the function used
    expect(cashHandler).toContain('sendReceiptCopyEmail');
  });
});

// ---------------------------------------------------------------------------
// Section 3 — §3.3: PUT /api/print-orders/:id/status advances the fulfillment
//   status flow correctly
//
// Preservation: the full status transition graph must survive the fix:
//   Pending → Confirmed → Processing → Quality Check → Ready for Pickup → Completed
// Each transition must be an allowed step; invalid transitions must be rejected.
//
// Validates: Requirement 3.3
// ---------------------------------------------------------------------------
describe('Preservation §3.3 — PUT /api/print-orders/:id/status handles fulfillment transitions', () => {
  const src = readSource("server.ts");

  const statusHandlerStart = src.indexOf('app.put("/api/print-orders/:id/status"');
  const statusHandlerEnd = src.indexOf('\napp.', statusHandlerStart + 1);
  const statusHandler = statusHandlerStart !== -1
    ? src.slice(statusHandlerStart, statusHandlerEnd !== -1 ? statusHandlerEnd : undefined)
    : src;

  it('status endpoint still exists in server.ts', () => {
    expect(statusHandlerStart).not.toBe(-1);
  });

  it('status handler defines the full allowedTransitions map', () => {
    // All nodes in the fulfillment graph must be present.
    // Keys may be unquoted (Pending:) or quoted ("Pending":) in the object literal,
    // so we check for the string values in array literals (always quoted) and
    // confirm the allowedTransitions variable name is declared.
    expect(statusHandler).toContain('allowedTransitions');
    // These status strings appear as array values and are always double-quoted
    expect(statusHandler).toContain('"Confirmed"');
    expect(statusHandler).toContain('"Processing"');
    expect(statusHandler).toContain('"Quality Check"');
    expect(statusHandler).toContain('"Ready for Pickup"');
    expect(statusHandler).toContain('"Completed"');
    // "Pending" appears either as an unquoted key or a quoted key; either way
    // the string Pending must appear in the handler
    expect(statusHandler).toMatch(/Pending/);
  });

  it('status handler allows Pending → Confirmed transition', () => {
    // Spot-check the most common first step
    expect(statusHandler).toMatch(/Pending.*Confirmed/s);
  });

  it('status handler allows Ready for Pickup → Completed transition', () => {
    // Final step before completion
    expect(statusHandler).toMatch(/Ready for Pickup.*Completed/s);
  });

  it('status handler rejects invalid transitions with a 400', () => {
    expect(statusHandler).toMatch(/status\(400\)/);
    expect(statusHandler).toMatch(/Invalid.*transition|transition.*Invalid/i);
  });

  it('status handler persists the new status via db.save()', () => {
    expect(statusHandler).toContain('db.save()');
  });

  it('status handler notifies the customer of the status update', () => {
    expect(statusHandler).toContain('notifyUser');
  });

  it('status handler blocks completion when paymentStatus is not "Paid"', () => {
    // A print order must be paid before it can be marked Completed
    expect(statusHandler).toContain('"Completed"');
    expect(statusHandler).toMatch(/paymentStatus.*Paid|paid.*before/i);
  });

  it('PrintOrder status type in types.ts still includes all fulfillment statuses', () => {
    const types = readSource("src/db/types.ts");
    const ifaceStart = types.indexOf('interface PrintOrder');
    const ifaceEnd = types.indexOf('\n}', ifaceStart);
    const iface = ifaceStart !== -1 ? types.slice(ifaceStart, ifaceEnd + 2) : types;

    // All statuses must remain in the union type
    expect(iface).toContain('"Pending"');
    expect(iface).toContain('"Confirmed"');
    expect(iface).toContain('"Processing"');
    expect(iface).toContain('"Quality Check"');
    expect(iface).toContain('"Ready for Pickup"');
    expect(iface).toContain('"Completed"');
    expect(iface).toContain('"Cancelled"');
  });
});

// ---------------------------------------------------------------------------
// Section 4 — §3.5: POST /api/payments (booking payments) still accepts the
//   client-supplied paymentMethod and creates a "Pending Verification" payment
//
// Preservation: the booking payment endpoint is completely separate from
// print orders and must be wholly unaffected by the print-order cash-only fix.
// It must still accept GCash / Maya and produce a payment record with
// paymentStatus = "Pending Verification".
// Bank Transfer / QR Ph was removed from the product, so the handler must
// reject it (and the legacy "Online Payment" label).
//
// Validates: Requirement 3.5
// ---------------------------------------------------------------------------
describe('Preservation §3.5 — POST /api/payments (booking) still accepts customer paymentMethod', () => {
  const src = readSource("server.ts");

  // Isolate the POST /api/payments handler
  const paymentsHandlerStart = src.indexOf('app.post("/api/payments",');
  const paymentsHandlerEnd = src.indexOf('\napp.', paymentsHandlerStart + 1);
  const paymentsHandler = paymentsHandlerStart !== -1
    ? src.slice(paymentsHandlerStart, paymentsHandlerEnd !== -1 ? paymentsHandlerEnd : undefined)
    : src;

  it('POST /api/payments endpoint still exists in server.ts', () => {
    expect(paymentsHandlerStart).not.toBe(-1);
  });

  it('POST /api/payments handler reads paymentMethod from req.body', () => {
    // Unlike print orders, booking payments accept paymentMethod from the client
    expect(paymentsHandler).toMatch(/paymentMethod.*req\.body|req\.body.*paymentMethod/);
  });

  it('POST /api/payments handler accepts GCash as a valid paymentMethod', () => {
    expect(paymentsHandler).toContain('"GCash"');
  });

  it('POST /api/payments handler accepts Maya as a valid paymentMethod', () => {
    expect(paymentsHandler).toContain('"Maya"');
  });

  it('POST /api/payments handler only allows Cash, GCash and Maya', () => {
    // Bank Transfer / QR Ph was removed — GCash and Maya are the only online methods.
    expect(paymentsHandler).toMatch(/\["Cash", "GCash", "Maya"\]/);
  });

  it('POST /api/payments handler no longer accepts Bank Transfer or Online Payment', () => {
    expect(paymentsHandler).not.toContain('"Bank Transfer"');
    expect(paymentsHandler).not.toContain('"Online Payment"');
  });

  it('POST /api/payments handler still reads referenceNumber from req.body', () => {
    // Booking payments require a reference number for non-cash methods
    expect(paymentsHandler).toMatch(/referenceNumber.*req\.body|req\.body.*referenceNumber/);
  });

  it('POST /api/payments handler still reads proofOfPayment from req.body', () => {
    // Booking payments require a proof-of-payment upload
    expect(paymentsHandler).toMatch(/proofOfPayment.*req\.body|req\.body.*proofOfPayment/);
  });

  it('POST /api/payments handler creates a payment with paymentStatus = "Pending Verification"', () => {
    // Booking payments go through staff verification — this status must remain
    expect(paymentsHandler).toContain('"Pending Verification"');
  });

  it('POST /api/payments handler does NOT touch any printOrders collection', () => {
    // The fix must not have inadvertently bled into the booking payment handler
    expect(paymentsHandler).not.toMatch(/db\.printOrders/);
  });
});

// ---------------------------------------------------------------------------
// Section 5 — §3.5 (continued): booking-related frontend still has payment UI
//
// Preservation: CustomerDashboard's booking tab (TAB A) must still render
// "Pay via GCash QR" and "Manual Receipt" buttons so customers can pay for
// bookings. These controls must NOT have been removed by the print-order fix.
//
// Validates: Requirement 3.5
// ---------------------------------------------------------------------------
describe('Preservation §3.5 — CustomerDashboard booking tab still has booking payment buttons', () => {
  const src = readSource("src/pages/CustomerDashboard.tsx");

  it('CustomerDashboard.tsx still contains "Pay via GCash" text for bookings', () => {
    // The GCash QR payment button must still exist somewhere in the file
    expect(src).toContain('Pay via GCash');
  });

  it('CustomerDashboard.tsx still contains "Manual Receipt" text for bookings', () => {
    // The manual receipt button must still exist somewhere in the file
    expect(src).toContain('Manual Receipt');
  });

  it('CustomerDashboard.tsx still has a payment modal for bookings (onUploadPayment or handlePaymentSubmit)', () => {
    // At least one payment submission handler must remain for bookings.
    // The component calls onUploadPayment (prop) and/or defines handlePaymentSubmit internally.
    expect(src).toMatch(/onUploadPayment|handlePaymentSubmit|handlePaymentUpload/);
  });
});

// ---------------------------------------------------------------------------
// Section 6 — §3.5 (continued): StudioDashboard booking payment approval still
//   shows Approve/Reject controls for booking payments
//
// Preservation: StudioDashboard must still have "Approve Payment" and/or
// "Reject" action buttons for booking payments. These must NOT have been
// removed when the print-order payment verification buttons were stripped.
//
// Validates: Requirement 3.5
// ---------------------------------------------------------------------------
describe('Preservation §3.5 — StudioDashboard still has booking payment approve/reject controls', () => {
  const src = readSource("src/pages/StudioDashboard.tsx");

  it('StudioDashboard.tsx still contains "Approve" action for booking payments', () => {
    // Staff must still be able to approve booking payment proofs
    expect(src).toMatch(/Approve|approve/);
  });

  it('StudioDashboard.tsx still contains booking payment verification logic', () => {
    // "Pending Verification" status must still be handled for bookings
    expect(src).toMatch(/Pending Verification|pending.*verif/i);
  });

  it('StudioDashboard.tsx still has the record-cash action for print orders', () => {
    // Ensure record-cash UI is still wired (not removed by mistake)
    expect(src).toMatch(/record.*cash|Record.*Cash/i);
  });
});
