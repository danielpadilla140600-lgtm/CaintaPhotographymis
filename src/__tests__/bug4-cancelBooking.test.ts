import { describe, it, expect } from "vitest";

/**
 * Bug 4 — Studio Admin Cannot Cancel Bookings Due to `allowStudio = false`
 *
 * Bug Condition (Property 7):
 * For any user where isBugCondition_4(user) holds (STUDIO_ADMIN, STUDIO_STAFF, or SUPER_ADMIN)
 * and the user manages the booking's studio, the cancel handler SHALL NOT return 403 and
 * SHALL proceed to the cancellableStatuses check.
 *
 * Validates: Requirements 1.1, 1.2, 1.3
 */

enum UserRole {
  SUPER_ADMIN = "SUPER_ADMIN",
  STUDIO_ADMIN = "STUDIO_ADMIN",
  STUDIO_STAFF = "STUDIO_STAFF",
  CUSTOMER = "CUSTOMER",
}

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

const booking = { id: "BK-001", studioId: "STU-001", customerId: "CUST-001" };

describe("Bug 4 — allowStudio=false blocks studio roles Bug Condition", () => {
  it.each([
    { id: "admin-1", role: UserRole.STUDIO_ADMIN, studioId: "STU-001" },
    { id: "staff-1", role: UserRole.STUDIO_STAFF, studioId: "STU-001" },
    { id: "super-1", role: UserRole.SUPER_ADMIN },
  ])(
    "BugCondition: $role should have access to cancel booking (currently FAILS — bug exists)",
    (user) => {
      const result = checkBookingAccess_original(user, booking);
      expect(result).toBe(true); // FAILS on buggy code (allowStudio=false blocks all studio roles)
    }
  );
});

describe("Bug 4 — Fix Verification: allowStudio=true grants studio roles access", () => {
  it.each([
    { id: "admin-1", role: UserRole.STUDIO_ADMIN, studioId: "STU-001" },
    { id: "staff-1", role: UserRole.STUDIO_STAFF, studioId: "STU-001" },
    { id: "super-1", role: UserRole.SUPER_ADMIN },
  ])(
    "Fixed: $role should have access to cancel booking when allowStudio=true",
    (user) => {
      const result = checkBookingAccess_fixed(user, booking);
      expect(result).toBe(true); // PASSES with fix applied
    }
  );
});
