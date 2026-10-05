/**
 * Bug Condition Exploration Tests — Print Orders Cash-Only
 *
 * Spec: .kiro/specs/print-orders-cash-only/bugfix.md
 *
 * BUG SUMMARY:
 *   Print orders are pickup-only (cash at counter), but the system incorrectly
 *   exposed a pre-payment flow:
 *     §1.4 — POST /api/print-orders accepted paymentMethod/referenceNumber/
 *             proofOfPayment from the client and set paymentStatus = "Pending Verification"
 *     §1.5 — POST /api/print-orders/:id/payment endpoint let customers submit
 *             payment proofs retroactively
 *     §1.6 — PUT /api/print-orders/:id/payment/verify let studio staff approve/reject
 *             a customer-uploaded print-order payment proof
 *
 * CRITICAL: These tests are EXPECTED TO FAIL on UNFIXED code.
 * Failure confirms the bug exists. They will PASS after the fix is applied.
 *
 * The tests use source-level analysis (reading server.ts and frontend components)
 * to detect the presence of bug conditions — the same approach used by the project's
 * existing exploration tests.
 *
 * Validates: Requirements 1.4, 1.5, 1.6
 */

import * as fs from "fs";
import * as path from "path";
import { describe, it, expect } from "vitest";

const ROOT = path.resolve(__dirname, "../..");

function readSource(relPath: string): string {
  return fs.readFileSync(path.join(ROOT, relPath), "utf-8");
}

// ---------------------------------------------------------------------------
// Section 1 — §1.4: POST /api/print-orders should NOT accept payment fields
//             from the client body or assign paymentStatus = "Pending Verification"
//
// Bug Condition: handler reads paymentMethod / referenceNumber / proofOfPayment
//   from req.body and/or sets paymentStatus = "Pending Verification"
// Expected Behavior: handler hardcodes paymentMethod = "Cash" and
//   paymentStatus = "Unpaid", ignoring any payment fields from the client
//
// Validates: Requirement 1.4
// ---------------------------------------------------------------------------
describe('Bug Condition §1.4 — POST /api/print-orders must NOT accept payment fields from client', () => {
  const src = readSource("server.ts");

  // Extract just the print-orders POST handler for targeted analysis.
  // The handler starts at app.post("/api/print-orders", and ends before the
  // next top-level app. route. We isolate it to avoid false-positive matches
  // from other endpoints.
  const postHandlerStart = src.indexOf('app.post("/api/print-orders",');
  const postHandlerEnd = src.indexOf('\napp.', postHandlerStart + 1);
  const postHandler = postHandlerStart !== -1
    ? src.slice(postHandlerStart, postHandlerEnd !== -1 ? postHandlerEnd : undefined)
    : src;

  it('server.ts POST /api/print-orders handler should NOT destructure paymentMethod from req.body', () => {
    // FAILS on unfixed code: handler did `const { ..., paymentMethod, ... } = req.body`
    // After fix: paymentMethod is not extracted from client body; it is hardcoded to "Cash"
    expect(postHandler).not.toMatch(/req\.body[^;]*paymentMethod/);
  });

  it('server.ts POST /api/print-orders handler should NOT destructure referenceNumber from req.body', () => {
    // FAILS on unfixed code: handler extracted referenceNumber from req.body
    expect(postHandler).not.toMatch(/req\.body[^;]*referenceNumber/);
  });

  it('server.ts POST /api/print-orders handler should NOT destructure proofOfPayment from req.body', () => {
    // FAILS on unfixed code: handler extracted proofOfPayment from req.body
    expect(postHandler).not.toMatch(/req\.body[^;]*proofOfPayment/);
  });

  it('server.ts POST /api/print-orders handler must hardcode paymentMethod: "Cash"', () => {
    // FAILS on unfixed code: paymentMethod was set from req.body, not hardcoded
    expect(postHandler).toContain('paymentMethod: "Cash"');
  });

  it('server.ts POST /api/print-orders handler must hardcode paymentStatus: "Unpaid"', () => {
    // FAILS on unfixed code: paymentStatus was conditionally set to "Pending Verification"
    expect(postHandler).toContain('paymentStatus: "Unpaid"');
  });

  it('server.ts POST /api/print-orders handler must NOT assign paymentStatus = "Pending Verification"', () => {
    // FAILS on unfixed code: non-cash payments set paymentStatus = "Pending Verification"
    expect(postHandler).not.toContain('"Pending Verification"');
  });
});

// ---------------------------------------------------------------------------
// Section 2 — §1.5: POST /api/print-orders/:id/payment must NOT exist
//
// Bug Condition: server.ts defines app.post("/api/print-orders/:id/payment", ...)
//   allowing customers to retroactively submit payment proofs for print orders
// Expected Behavior: endpoint is removed — calling it returns 404
//
// Validates: Requirement 1.5
// ---------------------------------------------------------------------------
describe('Bug Condition §1.5 — POST /api/print-orders/:id/payment must NOT exist', () => {
  const src = readSource("server.ts");

  it('server.ts must NOT define app.post("/api/print-orders/:id/payment")', () => {
    // FAILS on unfixed code: this route existed and allowed payment proof uploads
    expect(src).not.toContain('app.post("/api/print-orders/:id/payment"');
  });

  it('server.ts must NOT register any POST handler whose path includes print-orders and /payment (excluding record-cash)', () => {
    // More thorough check: no POST route that matches the pattern
    // We specifically exclude record-cash (which is a PUT, not a POST)
    const postPaymentMatch = src.match(/app\.post\(['"]\s*\/api\/print-orders\/:id\/payment[^/'"]*['"]/g);
    // Should be null — no such POST route exists after the fix
    expect(postPaymentMatch).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Section 3 — §1.6: PUT /api/print-orders/:id/payment/verify must NOT exist
//
// Bug Condition: server.ts defines
//   app.put("/api/print-orders/:id/payment/verify", ...) allowing studio staff
//   to approve/reject customer-uploaded print order payment proofs
// Expected Behavior: endpoint is removed — calling it returns 404
//
// Validates: Requirement 1.6
// ---------------------------------------------------------------------------
describe('Bug Condition §1.6 — PUT /api/print-orders/:id/payment/verify must NOT exist', () => {
  const src = readSource("server.ts");

  it('server.ts must NOT define app.put("/api/print-orders/:id/payment/verify")', () => {
    // FAILS on unfixed code: this route allowed approval/rejection of print order payments
    expect(src).not.toContain('app.put("/api/print-orders/:id/payment/verify"');
  });

  it('server.ts must NOT register any PUT handler whose path contains print-orders and /payment/verify', () => {
    // More thorough: scan for any variation of the verify endpoint
    const putVerifyMatch = src.match(/app\.put\(['"]\s*\/api\/print-orders\/:id\/payment\/verify['"]/g);
    expect(putVerifyMatch).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Section 4 — Companion check: record-cash endpoint MUST still exist
//
// The only legitimate payment action for print orders is recording cash at
// the studio counter. This endpoint must be preserved by the fix.
//
// Validates: Requirement 2.4 / Preservation Requirement 3.1
// ---------------------------------------------------------------------------
describe('Companion: PUT /api/print-orders/:id/payment/record-cash must still exist', () => {
  const src = readSource("server.ts");

  it('server.ts must define app.put("/api/print-orders/:id/payment/record-cash")', () => {
    // This endpoint is the sole payment action for print orders — must remain
    expect(src).toContain('app.put("/api/print-orders/:id/payment/record-cash"');
  });
});

// ---------------------------------------------------------------------------
// Section 5 — Frontend: PrintOrderWizard.tsx must NOT submit payment fields
//
// Bug Condition (§1.1): PrintOrderWizard sends paymentMethod, referenceNumber,
//   or proofOfPayment in the POST /api/print-orders body
// Expected Behavior: wizard submits only product/quantity/photo fields
//
// Validates: Requirement 2.1, 2.3
// ---------------------------------------------------------------------------
describe('Bug Condition §1.1 — PrintOrderWizard must NOT send payment fields to server', () => {
  const src = readSource("src/components/PrintOrderWizard.tsx");

  it('PrintOrderWizard.tsx handleSubmitPrintOrder must NOT include paymentMethod in the POST body', () => {
    // Extract the order payload in handleSubmitPrintOrder
    const payloadStart = src.indexOf('const orderPayload = {');
    const payloadEnd = src.indexOf('};', payloadStart);
    const payload = payloadStart !== -1 ? src.slice(payloadStart, payloadEnd + 2) : src;

    expect(payload).not.toContain('paymentMethod');
  });

  it('PrintOrderWizard.tsx handleSubmitPrintOrder must NOT include referenceNumber in the POST body', () => {
    const payloadStart = src.indexOf('const orderPayload = {');
    const payloadEnd = src.indexOf('};', payloadStart);
    const payload = payloadStart !== -1 ? src.slice(payloadStart, payloadEnd + 2) : src;

    expect(payload).not.toContain('referenceNumber');
  });

  it('PrintOrderWizard.tsx handleSubmitPrintOrder must NOT include proofOfPayment in the POST body', () => {
    const payloadStart = src.indexOf('const orderPayload = {');
    const payloadEnd = src.indexOf('};', payloadStart);
    const payload = payloadStart !== -1 ? src.slice(payloadStart, payloadEnd + 2) : src;

    expect(payload).not.toContain('proofOfPayment');
  });

  it('PrintOrderWizard.tsx step 4 is design selection, not payment', () => {
    expect(src).toMatch(/step\s*===\s*4/);
    expect(src).toContain('Choose Your Print Design');
    expect(src).toContain('printDesign: { frameStyle, backdrop, matteFinish, scaleMode }');
    expect(src).not.toContain('paymentMethod');
  });

  it('PrintOrderWizard.tsx confirmation step must show "Studio Pickup" or "Pay Cash" notice', () => {
    // The printing confirmation step should still contain the cash-at-counter notice
    expect(src).toMatch(/Studio Pickup|Pay Cash|cash at/i);
  });
});

// ---------------------------------------------------------------------------
// Section 6 — Frontend: CustomerDashboard.tsx print orders tab must NOT have
//   payment buttons (§1.2, §1.3)
//
// Bug Condition: print order cards show "Pay via GCash QR" or "Manual Receipt"
//   buttons, or trigger a payment modal with referenceNumber/proofOfPayment
// Expected Behavior: print order cards show status and details only,
//   with no payment action buttons
//
// Validates: Requirement 2.2
// ---------------------------------------------------------------------------
describe('Bug Condition §1.2/§1.3 — CustomerDashboard print orders tab must NOT have payment buttons', () => {
  const src = readSource("src/pages/CustomerDashboard.tsx");

  // Isolate the TAB B — PRINT ORDERS section for targeted assertions
  const tabBStart = src.indexOf('TAB B — PRINT ORDERS');
  // The next major section boundary after TAB B
  const tabBEnd = src.indexOf('activeSubTab ===', tabBStart + 50);
  const tabB = tabBStart !== -1 ? src.slice(tabBStart, tabBEnd !== -1 ? tabBEnd : undefined) : src;

  it('CustomerDashboard print orders tab must NOT have a "Pay via GCash QR" button', () => {
    // FAILS on unfixed code: each unpaid print order showed "Pay via GCash QR"
    expect(tabB).not.toContain('Pay via GCash');
  });

  it('CustomerDashboard print orders tab must NOT have a "Manual Receipt" button', () => {
    // FAILS on unfixed code: each unpaid print order showed "Manual Receipt" button
    expect(tabB).not.toContain('Manual Receipt');
  });

  it('CustomerDashboard must NOT have onSubmitPrintPayment handler or prop', () => {
    expect(src).not.toContain('onSubmitPrintPayment');
  });

  it('CustomerDashboard must NOT declare printRefNo state (print order reference number)', () => {
    expect(src).not.toMatch(/printRefNo|print_ref_no|printReferenceNumber/);
  });

  it('CustomerDashboard must NOT declare printProofBase64 state (print order proof upload)', () => {
    expect(src).not.toMatch(/printProofBase64|printProof64|printProofImage/);
  });

  it('CustomerDashboard must NOT call setGcashQRTarget with a printOrderId for payment', () => {
    // On unfixed code setGcashQRTarget was called with printOrderId inside the
    // print orders tab to trigger the GCash QR modal for a print order.
    // After fix: gcashQRTarget.printOrderId may exist as a type but must NOT be
    // set from within the print orders card action buttons.
    //
    // We check that no setGcashQRTarget call that includes a printOrderId value
    // appears in the print orders tab section (TAB B).
    const gcashCallsInTabB = tabB.match(/setGcashQRTarget\s*\(/g);
    // No setGcashQRTarget calls should exist within the print orders tab
    expect(gcashCallsInTabB).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Section 7 — Frontend: App.tsx must NOT wire print payment handlers
//
// Bug Condition: App.tsx defined handleSubmitPrintPayment and/or
//   handleVerifyPrintPayment and passed them as props to CustomerDashboard
//   or StudioDashboard
// Expected Behavior: those handlers are removed; only record-cash flows through
//
// Validates: Requirement 2.6, 2.7
// ---------------------------------------------------------------------------
describe('Bug Condition §1.5/§1.6 — App.tsx must NOT wire print payment handlers', () => {
  const src = readSource("src/App.tsx");

  it('App.tsx must NOT define handleSubmitPrintPayment', () => {
    // FAILS on unfixed code: App.tsx had this handler calling POST /:id/payment
    expect(src).not.toContain('handleSubmitPrintPayment');
  });

  it('App.tsx must NOT define handleVerifyPrintPayment', () => {
    // FAILS on unfixed code: App.tsx had this handler calling PUT /:id/payment/verify
    expect(src).not.toContain('handleVerifyPrintPayment');
  });
});
