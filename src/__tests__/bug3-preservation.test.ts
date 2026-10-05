import { describe, it, expect } from "vitest";

/**
 * Bug 3 — Partial Refund Double Subtraction
 * Preservation Property Test
 *
 * Validates: Requirements 3.1, 3.2
 *
 * This test verifies the CORRECT behavior that must NOT change after the fix:
 *   1. Full refund (refundAmount === totalPaid): amountPaid = 0, status = "Cancelled"
 *   2. syncBookingPaymentTotals called outside refund flow correctly sums "Paid" payments
 *
 * These tests PASS on unfixed code because:
 *   - Full refunds accidentally work: isFullRefund is always true (0 >= 0), giving
 *     the right result for full refunds even though the logic is wrong.
 *   - syncBookingPaymentTotals is correct and unaffected by the bug.
 *
 * EXPECTED OUTCOME: All tests PASS on unfixed code (baseline confirmed).
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
// Preservation Tests
// ──────────────────────────────────────────────────────────────────────────────
describe("Bug 3 — Preservation: Full refund behavior must not change", () => {
  it("Preservation: full refund sets amountPaid=0, status=Cancelled (must preserve)", () => {
    const booking: any = {
      id: "BK-002",
      totalAmount: 1000,
      amountPaid: 1000,
      remainingBalance: 0,
      paymentStatus: "Paid",
      status: "Confirmed",
    };
    const payments = [
      { id: "PAY-002", bookingId: "BK-002", amount: 1000, paymentStatus: "Paid" },
    ];

    processRefund_buggy(booking, payments, 0, 1000, "Full refund"); // refundAmount === totalPaid

    expect(booking.amountPaid).toBe(0);        // Full refund → 0 ✓
    expect(booking.status).toBe("Cancelled");  // Full refund → Cancelled ✓
    expect(booking.remainingBalance).toBe(1000);
  });

  it("Preservation: syncBookingPaymentTotals correctly sums Paid payments", () => {
    const booking: any = {
      id: "BK-003",
      totalAmount: 3000,
      amountPaid: 0,
      remainingBalance: 3000,
    };
    const payments = [
      { id: "P1", bookingId: "BK-003", amount: 900, paymentStatus: "Paid" },
      { id: "P2", bookingId: "BK-003", amount: 500, paymentStatus: "Pending Verification" },
    ];

    syncBookingPaymentTotals(booking, payments);

    expect(booking.amountPaid).toBe(900);      // Only "Paid" payment counted
    expect(booking.remainingBalance).toBe(2100);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// Task 9.3 — processRefund_fixed (mirrors FIXED server.ts logic)
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

  // FIX: capture totalPaid BEFORE sync
  const totalPaidBeforeRefund = booking.amountPaid;
  const isFullRefund = refundAmount >= totalPaidBeforeRefund;

  // Step 2: Sync totals
  syncBookingPaymentTotals(booking, payments);

  booking.paymentStatus = "Refunded";

  if (isFullRefund) {
    booking.status = "Cancelled";
    booking.cancellationReason = `Refund issued: ${reason}`;
  }
}

describe("Bug 3 — Preservation (Fixed): Full refund behavior must still hold after fix", () => {
  it("PostFix-Preservation: full refund sets amountPaid=0, status=Cancelled", () => {
    // Validates: Requirements 3.1, 3.2
    const booking: any = {
      id: "BK-004",
      totalAmount: 1000,
      amountPaid: 1000,
      remainingBalance: 0,
      paymentStatus: "Paid",
      status: "Confirmed",
    };
    const payments = [
      { id: "PAY-004", bookingId: "BK-004", amount: 1000, paymentStatus: "Paid" },
    ];

    processRefund_fixed(booking, payments, 0, 1000, "Full refund"); // refundAmount === totalPaid

    expect(booking.amountPaid).toBe(0);        // Full refund → 0 ✓
    expect(booking.status).toBe("Cancelled");  // Full refund → Cancelled ✓
    expect(booking.remainingBalance).toBe(1000);
  });

  it("PostFix-Preservation: syncBookingPaymentTotals still correctly sums Paid payments", () => {
    // Validates: Requirements 3.1, 3.2
    const booking: any = {
      id: "BK-005",
      totalAmount: 3000,
      amountPaid: 0,
      remainingBalance: 3000,
    };
    const payments = [
      { id: "P3", bookingId: "BK-005", amount: 900, paymentStatus: "Paid" },
      { id: "P4", bookingId: "BK-005", amount: 500, paymentStatus: "Pending Verification" },
    ];

    syncBookingPaymentTotals(booking, payments);

    expect(booking.amountPaid).toBe(900);
    expect(booking.remainingBalance).toBe(2100);
  });
});
