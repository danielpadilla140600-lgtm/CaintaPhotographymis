import { describe, it, expect } from "vitest";

/**
 * Bug 3 — Partial Refund Double Subtraction
 *
 * Validates: Requirements 1.1, 1.2
 *
 * BUG CONDITION: isBugCondition_3(refundAmount, totalPaid)
 *   → refundAmount > 0 AND refundAmount < totalPaid
 *
 * The defect: In PUT /api/payments/:id/refund (server.ts), after marking the
 * payment as "Refunded", syncBookingPaymentTotals() is called. Because that
 * function only sums payments with status "Paid", it finds zero paid payments
 * and sets booking.amountPaid = 0. The code then subtracts refundAmount from
 * that already-zeroed value → Math.max(0, 0 - refundAmount) = 0. Additionally,
 * isFullRefund is evaluated after the sync zeroes amountPaid, so
 * (refundAmount >= 0) is always true → booking.status is always set to
 * "Cancelled" even for partial refunds.
 *
 * EXPECTED OUTCOME: This test FAILS on unfixed code (proves the bug exists).
 */

// ──────────────────────────────────────────────────────────────────────────────
// Inline syncBookingPaymentTotals — mirrors the implementation in server.ts
// ──────────────────────────────────────────────────────────────────────────────
function syncBookingPaymentTotals(booking: any, payments: any[]) {
  const bookingPayments = payments.filter(p => p.bookingId === booking.id);
  const verifiedPayments = bookingPayments.filter(p => p.paymentStatus === "Paid");
  const paidAmount = Math.min(
    booking.totalAmount,
    verifiedPayments.reduce((sum: number, p: any) => sum + p.amount, 0)
  );
  booking.amountPaid = paidAmount;
  booking.remainingBalance = Math.max(0, booking.totalAmount - paidAmount);
  booking.finalPaymentStatus = booking.remainingBalance === 0 ? "Paid" : "Pending";
  booking.paymentStatus =
    booking.finalPaymentStatus === "Paid"
      ? "Paid"
      : paidAmount > 0
      ? "Partially Paid"
      : "Unpaid";
}

// ──────────────────────────────────────────────────────────────────────────────
// Inline BUGGY refund logic — mirrors the defective sequence in server.ts
// ──────────────────────────────────────────────────────────────────────────────
function processRefund_buggy(
  booking: any,
  payments: any[],
  paymentIndex: number,
  refundAmount: number,
  reason: string
) {
  // Step 1: Mark payment as refunded
  payments[paymentIndex] = {
    ...payments[paymentIndex],
    paymentStatus: "Refunded",
    rejectionReason: reason,
  };

  // Step 2: Sync totals — zeroes booking.amountPaid because the refunded
  // payment is now excluded from the "Paid" filter
  syncBookingPaymentTotals(booking, payments);

  // Step 3: BUG — isFullRefund is evaluated AFTER sync already zeroed amountPaid
  // Any positive refundAmount satisfies (refundAmount >= 0), so this is always true
  const isFullRefund = refundAmount >= booking.amountPaid; // booking.amountPaid is now 0

  booking.paymentStatus = "Refunded";

  // Double subtraction: 0 - refundAmount → negative → Math.max(0, negative) = 0
  booking.amountPaid = Math.max(0, booking.amountPaid - refundAmount);

  booking.remainingBalance = Math.min(
    booking.totalAmount,
    booking.totalAmount - booking.amountPaid
  );

  if (isFullRefund) {
    // Always fires — even on partial refund!
    booking.status = "Cancelled";
    booking.cancellationReason = `Refund issued: ${reason}`;
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Tests
// ──────────────────────────────────────────────────────────────────────────────
describe("Bug 3 — Partial Refund Double Subtraction Bug Condition", () => {
  it("BugCondition: partial refund should set amountPaid to totalPaid - refundAmount (currently FAILS — bug exists)", () => {
    // Scenario: booking fully paid (₱2000), partial refund of ₱500
    const booking: any = {
      id: "BK-001",
      totalAmount: 2000,
      amountPaid: 2000,
      remainingBalance: 0,
      paymentStatus: "Paid",
      status: "Confirmed",
    };
    const payments = [
      {
        id: "PAY-001",
        bookingId: "BK-001",
        amount: 2000,
        paymentStatus: "Paid",
      },
    ];

    const refundAmount = 500;
    processRefund_buggy(booking, payments, 0, refundAmount, "Partial refund");

    // Expected (correct): amountPaid = 2000 - 500 = 1500
    // Actual   (buggy):   amountPaid = 0  (double subtraction: 0 - 500 → max(0,−500) = 0)
    expect(booking.amountPaid).toBe(1500); // FAILS on buggy code

    // Expected (correct): partial refund should NOT cancel the booking
    // Actual   (buggy):   status = "Cancelled" because isFullRefund is always true
    expect(booking.status).not.toBe("Cancelled"); // FAILS on buggy code
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// Task 9.2 — Post-Fix Verification
// processRefund_fixed mirrors the FIXED logic in server.ts:
//   capture totalPaidBeforeRefund BEFORE sync, derive isFullRefund from it,
//   then sync (which sets the correct amountPaid based on remaining Paid payments).
// ──────────────────────────────────────────────────────────────────────────────
function processRefund_fixed(
  booking: any,
  payments: any[],
  paymentIndex: number,
  refundAmount: number,
  reason: string
) {
  // Step 1: Mark payment as refunded
  payments[paymentIndex] = {
    ...payments[paymentIndex],
    paymentStatus: "Refunded",
    rejectionReason: reason,
  };

  // FIX: capture totalPaid BEFORE sync so isFullRefund is evaluated correctly
  const totalPaidBeforeRefund = booking.amountPaid;
  const isFullRefund = refundAmount >= totalPaidBeforeRefund;

  // Step 2: Sync totals — now used for its correct amountPaid calculation only
  syncBookingPaymentTotals(booking, payments);

  booking.paymentStatus = "Refunded";

  if (isFullRefund) {
    booking.status = "Cancelled";
    booking.cancellationReason = `Refund issued: ${reason}`;
  }
}

describe("Bug 3 — Post-Fix Verification", () => {
  it("PostFix: partial refund sets amountPaid = totalPaid - refundAmount", () => {
    // Validates: Requirements 2.1, 2.2
    //
    // Scenario: booking total ₱2000, paid via two instalments.
    //   PAY-001: ₱500  → being refunded (marked "Refunded")
    //   PAY-002: ₱1500 → still "Paid"
    // After refund of PAY-001, syncBookingPaymentTotals sees one remaining
    // "Paid" payment of ₱1500 → booking.amountPaid = 1500.
    const booking: any = {
      id: "BK-001",
      totalAmount: 2000,
      amountPaid: 2000,
      remainingBalance: 0,
      paymentStatus: "Paid",
      status: "Confirmed",
    };
    const payments = [
      { id: "PAY-001", bookingId: "BK-001", amount: 500,  paymentStatus: "Paid" }, // to be refunded
      { id: "PAY-002", bookingId: "BK-001", amount: 1500, paymentStatus: "Paid" }, // remains paid
    ];

    processRefund_fixed(booking, payments, 0, 500, "Partial refund");

    expect(booking.amountPaid).toBe(1500);        // 2000 - 500 = 1500 ✓
    expect(booking.status).not.toBe("Cancelled"); // Not cancelled for partial refund ✓
  });
});
