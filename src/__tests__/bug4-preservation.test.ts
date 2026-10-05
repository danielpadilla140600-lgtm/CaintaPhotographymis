import { describe, it, expect } from "vitest";

/**
 * Bug 4 — Studio Admin Cannot Cancel Bookings Due to `allowStudio = false`
 *
 * Preservation Property Tests:
 * These behaviors must NOT change after the fix is applied.
 * All tests PASS on both unfixed and fixed code.
 *
 * Validates: Requirements 1.1, 1.2, 1.3
 */

enum UserRole {
  SUPER_ADMIN = "SUPER_ADMIN",
  STUDIO_ADMIN = "STUDIO_ADMIN",
  STUDIO_STAFF = "STUDIO_STAFF",
  CUSTOMER = "CUSTOMER",
}

const booking = { id: "BK-001", studioId: "STU-001", customerId: "CUST-001", status: "Confirmed" };
const cancellableStatuses = ["Pending", "Awaiting Payment", "Confirmed", "Rescheduled"];

// Mirror requireBookingAccess logic as it exists in server.ts (BUGGY — allowStudio = false)
function checkBookingAccess_original(user: any, booking: any): boolean {
  const ownsBooking = user.role === UserRole.CUSTOMER && booking.customerId === user.id;
  const allowStudio = false; // BUG: hardcoded false in cancel endpoint
  const managesStudio =
    allowStudio &&
    [UserRole.SUPER_ADMIN, UserRole.STUDIO_ADMIN, UserRole.STUDIO_STAFF].includes(user.role) &&
    (user.role === UserRole.SUPER_ADMIN || user.studioId === booking.studioId);
  return ownsBooking || managesStudio;
}

// Mirror requireBookingAccess logic with the fix applied (allowStudio = true)
function checkBookingAccess_fixed(user: any, booking: any): boolean {
  const ownsBooking = user.role === UserRole.CUSTOMER && booking.customerId === user.id;
  const allowStudio = true; // FIX: set to true
  const managesStudio =
    allowStudio &&
    [UserRole.SUPER_ADMIN, UserRole.STUDIO_ADMIN, UserRole.STUDIO_STAFF].includes(user.role) &&
    (user.role === UserRole.SUPER_ADMIN || user.studioId === booking.studioId);
  return ownsBooking || managesStudio;
}

describe("Bug 4 — Preservation: Non-studio-role access must not change", () => {
  // CUSTOMER owns booking → gets access through requireBookingAccess (but then hits 400 policy)
  it("Preservation: CUSTOMER who owns booking gets access (then hit by customer policy 400)", () => {
    const customer = { id: "CUST-001", role: UserRole.CUSTOMER };
    // With original (allowStudio=false), customer access still works via ownsBooking
    expect(checkBookingAccess_original(customer, booking)).toBe(true); // customer passes the guard
    expect(checkBookingAccess_fixed(customer, booking)).toBe(true);   // same after fix
  });

  it("Preservation: CUSTOMER who does NOT own the booking is rejected", () => {
    const otherCustomer = { id: "CUST-999", role: UserRole.CUSTOMER };
    expect(checkBookingAccess_original(otherCustomer, booking)).toBe(false);
    expect(checkBookingAccess_fixed(otherCustomer, booking)).toBe(false);
  });

  it("Preservation: STUDIO_ADMIN from different studio is rejected (cross-studio 403)", () => {
    const otherAdmin = { id: "admin-2", role: UserRole.STUDIO_ADMIN, studioId: "STU-999" };
    expect(checkBookingAccess_fixed(otherAdmin, booking)).toBe(false); // cross-studio stays blocked
  });

  it("Preservation: cancellableStatuses check blocks Completed bookings", () => {
    const completedBooking = { ...booking, status: "Completed" };
    expect(cancellableStatuses.includes(completedBooking.status)).toBe(false); // Completed → not cancellable
  });
});
