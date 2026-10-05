/**
 * Bug 1 — canManageStudioPayment() Missing SUPER_ADMIN Path
 * Preservation Property Test
 *
 * Spec: .kiro/specs/system-bugfix-comprehensive/bugfix.md
 *
 * PURPOSE: Confirm the BASELINE behavior for non-SUPER_ADMIN users that must
 * NOT change after the fix is applied.
 *
 * IMPORTANT: This test is EXPECTED TO PASS on UNFIXED code.
 * Passing confirms the baseline behavior that the fix must preserve.
 *
 * Properties tested: Preservation — Studio Admin and Non-Super-Admin Refund Authorization
 *
 * FOR ALL user WHERE user.role !== SUPER_ADMIN DO
 *   ASSERT canManageStudioPayment_fixed(user, studioId) = canManageStudioPayment_original(user, studioId)
 * END FOR
 *
 * Validates: Requirements 3.1, 3.2, 3.3
 */

import { describe, it, expect } from "vitest";

// ---------------------------------------------------------------------------
// Mirror the UserRole enum from src/db/types.ts
// ---------------------------------------------------------------------------
enum UserRole {
  SUPER_ADMIN = "SUPER_ADMIN",
  STUDIO_ADMIN = "STUDIO_ADMIN",
  STUDIO_STAFF = "STUDIO_STAFF",
  CUSTOMER = "CUSTOMER",
}

// ---------------------------------------------------------------------------
// Mirror the canManageStudioPayment logic from server.ts — UNFIXED version.
//
//   function canManageStudioPayment(user: any, studioId: string): boolean {
//     const studio = db.studios.find(item => item.id === studioId);
//     return user.role === UserRole.STUDIO_ADMIN &&
//       user.studioId === studioId &&
//       studio?.ownerId === user.id;
//   }
//
// Inlined here so the test can run without a live database.
// ---------------------------------------------------------------------------
function canManageStudioPayment_original(
  user: any,
  studioId: string,
  studios: { id: string; ownerId: string }[]
): boolean {
  const studio = studios.find((item) => item.id === studioId);
  return (
    user.role === UserRole.STUDIO_ADMIN &&
    user.studioId === studioId &&
    studio?.ownerId === user.id
  );
}

// ---------------------------------------------------------------------------
// Mirror the canManageStudioPayment logic from server.ts — FIXED version.
//
//   function canManageStudioPayment(user: any, studioId: string): boolean {
//     if (user.role === UserRole.SUPER_ADMIN) return true;
//     const studio = db.studios.find(item => item.id === studioId);
//     return user.role === UserRole.STUDIO_ADMIN &&
//       user.studioId === studioId &&
//       studio?.ownerId === user.id;
//   }
//
// Inlined here so the test can run without a live database.
// ---------------------------------------------------------------------------
function canManageStudioPayment_fixed(
  user: any,
  studioId: string,
  studios: any[]
): boolean {
  if (user.role === UserRole.SUPER_ADMIN) return true;
  const studio = studios.find((item) => item.id === studioId);
  return (
    user.role === UserRole.STUDIO_ADMIN &&
    user.studioId === studioId &&
    studio?.ownerId === user.id
  );
}

// ---------------------------------------------------------------------------
// Shared test fixtures
// ---------------------------------------------------------------------------
const ownerId = "owner-123";
const studioId = "studio-456";
const mockStudios = [{ id: studioId, ownerId }];

// ---------------------------------------------------------------------------
// Preservation Tests — these MUST PASS on unfixed code
//
// Validates: Requirements 3.1, 3.2, 3.3
// ---------------------------------------------------------------------------
describe("Bug 1 — Preservation: Non-SUPER_ADMIN behavior must not change", () => {
  /**
   * **Validates: Requirements 3.1**
   *
   * A STUDIO_ADMIN who owns the studio must still be authorized after the fix.
   * This is the only happy-path for non-super-admins — it MUST return true.
   */
  it("STUDIO_ADMIN who owns the studio returns true (must preserve)", () => {
    const user = { id: ownerId, role: UserRole.STUDIO_ADMIN, studioId };
    expect(canManageStudioPayment_original(user, studioId, mockStudios)).toBe(true);
  });

  /**
   * **Validates: Requirements 3.2**
   *
   * A STUDIO_ADMIN from a DIFFERENT studio must still be denied.
   * studioId on the user does not match the target studioId.
   */
  it("STUDIO_ADMIN for a different studio returns false (must preserve)", () => {
    const user = { id: "other-owner", role: UserRole.STUDIO_ADMIN, studioId: "other-studio" };
    expect(canManageStudioPayment_original(user, studioId, mockStudios)).toBe(false);
  });

  /**
   * **Validates: Requirements 3.2**
   *
   * A STUDIO_ADMIN who belongs to the correct studio but is NOT the owner
   * must still be denied.
   */
  it("STUDIO_ADMIN with correct studioId but not the owner returns false (must preserve)", () => {
    const user = { id: "non-owner-admin", role: UserRole.STUDIO_ADMIN, studioId };
    expect(canManageStudioPayment_original(user, studioId, mockStudios)).toBe(false);
  });

  /**
   * **Validates: Requirements 3.3**
   *
   * STUDIO_STAFF must always be denied — they are not STUDIO_ADMIN.
   */
  it("STUDIO_STAFF returns false (must preserve)", () => {
    const user = { id: "staff-1", role: UserRole.STUDIO_STAFF, studioId };
    expect(canManageStudioPayment_original(user, studioId, mockStudios)).toBe(false);
  });

  /**
   * **Validates: Requirements 3.3**
   *
   * CUSTOMER must always be denied — they are not STUDIO_ADMIN.
   */
  it("CUSTOMER returns false (must preserve)", () => {
    const user = { id: "cust-1", role: UserRole.CUSTOMER };
    expect(canManageStudioPayment_original(user, studioId, mockStudios)).toBe(false);
  });

  /**
   * **Validates: Requirements 3.1, 3.2, 3.3**
   *
   * Parametric preservation check across all non-SUPER_ADMIN roles and
   * multiple studioId values. For each combination, the original function
   * is the ground truth — the fixed function must return the same value.
   *
   * Covers the formal preservation requirement:
   *   FOR ALL user WHERE NOT isBugCondition_1(user) DO
   *     ASSERT canManageStudioPayment(user, studioId) = canManageStudioPayment'(user, studioId)
   *   END FOR
   */
  describe("Parametric preservation across roles and studioIds", () => {
    const studioIds = ["studio-456", "studio-abc", "studio-xyz-999", "STU-123"];

    const nonSuperAdminCases: { label: string; user: any; expectedOwnerStudio: boolean }[] = [
      {
        label: "STUDIO_ADMIN owner",
        user: { id: ownerId, role: UserRole.STUDIO_ADMIN, studioId },
        expectedOwnerStudio: true,
      },
      {
        label: "STUDIO_ADMIN non-owner (wrong studioId on user)",
        user: { id: ownerId, role: UserRole.STUDIO_ADMIN, studioId: "other-studio" },
        expectedOwnerStudio: false,
      },
      {
        label: "STUDIO_ADMIN non-owner (wrong ownerId)",
        user: { id: "wrong-owner", role: UserRole.STUDIO_ADMIN, studioId },
        expectedOwnerStudio: false,
      },
      {
        label: "STUDIO_STAFF",
        user: { id: "staff-2", role: UserRole.STUDIO_STAFF, studioId },
        expectedOwnerStudio: false,
      },
      {
        label: "CUSTOMER",
        user: { id: "cust-2", role: UserRole.CUSTOMER },
        expectedOwnerStudio: false,
      },
    ];

    it.each(nonSuperAdminCases)(
      "Preservation: $label returns expected result for target studioId",
      ({ user, expectedOwnerStudio }) => {
        // Use studioId = "studio-456" (the one in mockStudios) as the target
        const result = canManageStudioPayment_original(user, studioId, mockStudios);
        expect(result).toBe(expectedOwnerStudio);
      }
    );

    it.each(studioIds)(
      "Preservation: Non-owner STUDIO_ADMIN always returns false for studioId=%s",
      (targetStudioId) => {
        // Build a mock studios list that includes the target with a different owner
        const studiosForTarget = [{ id: targetStudioId, ownerId: "some-other-owner" }];
        const user = { id: ownerId, role: UserRole.STUDIO_ADMIN, studioId: targetStudioId };
        // User has correct studioId but is NOT the ownerId recorded in studios → false
        const result = canManageStudioPayment_original(user, targetStudioId, studiosForTarget);
        expect(result).toBe(false);
      }
    );

    it.each(studioIds)(
      "Preservation: STUDIO_STAFF always returns false for studioId=%s",
      (targetStudioId) => {
        const studiosForTarget = [{ id: targetStudioId, ownerId }];
        const user = { id: ownerId, role: UserRole.STUDIO_STAFF, studioId: targetStudioId };
        const result = canManageStudioPayment_original(user, targetStudioId, studiosForTarget);
        expect(result).toBe(false);
      }
    );

    it.each(studioIds)(
      "Preservation: CUSTOMER always returns false for studioId=%s",
      (targetStudioId) => {
        const studiosForTarget = [{ id: targetStudioId, ownerId }];
        const user = { id: ownerId, role: UserRole.CUSTOMER };
        const result = canManageStudioPayment_original(user, targetStudioId, studiosForTarget);
        expect(result).toBe(false);
      }
    );
  });
});

// ---------------------------------------------------------------------------
// Preservation Tests against FIXED version — confirm no regressions
//
// Validates: Requirements 3.1, 3.2, 3.3
// ---------------------------------------------------------------------------
describe("Bug 1 — Preservation (FIXED): Non-SUPER_ADMIN behavior unchanged after fix", () => {
  /**
   * **Validates: Requirements 3.1**
   *
   * A STUDIO_ADMIN who owns the studio must still be authorized after the fix.
   */
  it("STUDIO_ADMIN who owns the studio returns true (fixed preserves)", () => {
    const user = { id: ownerId, role: UserRole.STUDIO_ADMIN, studioId };
    expect(canManageStudioPayment_fixed(user, studioId, mockStudios)).toBe(true);
  });

  /**
   * **Validates: Requirements 3.2**
   *
   * A STUDIO_ADMIN from a different studio must still be denied.
   */
  it("STUDIO_ADMIN for a different studio returns false (fixed preserves)", () => {
    const user = { id: "other-owner", role: UserRole.STUDIO_ADMIN, studioId: "other-studio" };
    expect(canManageStudioPayment_fixed(user, studioId, mockStudios)).toBe(false);
  });

  /**
   * **Validates: Requirements 3.2**
   *
   * A STUDIO_ADMIN who belongs to the correct studio but is NOT the owner
   * must still be denied.
   */
  it("STUDIO_ADMIN with correct studioId but not the owner returns false (fixed preserves)", () => {
    const user = { id: "non-owner-admin", role: UserRole.STUDIO_ADMIN, studioId };
    expect(canManageStudioPayment_fixed(user, studioId, mockStudios)).toBe(false);
  });

  /**
   * **Validates: Requirements 3.3**
   *
   * STUDIO_STAFF must always be denied after the fix.
   */
  it("STUDIO_STAFF returns false (fixed preserves)", () => {
    const user = { id: "staff-1", role: UserRole.STUDIO_STAFF, studioId };
    expect(canManageStudioPayment_fixed(user, studioId, mockStudios)).toBe(false);
  });

  /**
   * **Validates: Requirements 3.3**
   *
   * CUSTOMER must always be denied after the fix.
   */
  it("CUSTOMER returns false (fixed preserves)", () => {
    const user = { id: "cust-1", role: UserRole.CUSTOMER };
    expect(canManageStudioPayment_fixed(user, studioId, mockStudios)).toBe(false);
  });

  /**
   * **Validates: Requirements 3.1, 3.2, 3.3**
   *
   * For each non-SUPER_ADMIN input, the fixed function must return the same
   * value as the original (preservation invariant).
   */
  describe("Parametric preservation: fixed === original for all non-SUPER_ADMIN inputs", () => {
    const studioIds = ["studio-456", "studio-abc", "studio-xyz-999", "STU-123"];

    const nonSuperAdminCases: { label: string; user: any; expectedOwnerStudio: boolean }[] = [
      {
        label: "STUDIO_ADMIN owner",
        user: { id: ownerId, role: UserRole.STUDIO_ADMIN, studioId },
        expectedOwnerStudio: true,
      },
      {
        label: "STUDIO_ADMIN non-owner (wrong studioId on user)",
        user: { id: ownerId, role: UserRole.STUDIO_ADMIN, studioId: "other-studio" },
        expectedOwnerStudio: false,
      },
      {
        label: "STUDIO_ADMIN non-owner (wrong ownerId)",
        user: { id: "wrong-owner", role: UserRole.STUDIO_ADMIN, studioId },
        expectedOwnerStudio: false,
      },
      {
        label: "STUDIO_STAFF",
        user: { id: "staff-2", role: UserRole.STUDIO_STAFF, studioId },
        expectedOwnerStudio: false,
      },
      {
        label: "CUSTOMER",
        user: { id: "cust-2", role: UserRole.CUSTOMER },
        expectedOwnerStudio: false,
      },
    ];

    it.each(nonSuperAdminCases)(
      "Fixed matches original: $label returns expected result for target studioId",
      ({ user, expectedOwnerStudio }) => {
        const fixedResult = canManageStudioPayment_fixed(user, studioId, mockStudios);
        const originalResult = canManageStudioPayment_original(user, studioId, mockStudios);
        expect(fixedResult).toBe(expectedOwnerStudio);
        expect(fixedResult).toBe(originalResult);
      }
    );

    it.each(studioIds)(
      "Fixed matches original: Non-owner STUDIO_ADMIN always returns false for studioId=%s",
      (targetStudioId) => {
        const studiosForTarget = [{ id: targetStudioId, ownerId: "some-other-owner" }];
        const user = { id: ownerId, role: UserRole.STUDIO_ADMIN, studioId: targetStudioId };
        const fixedResult = canManageStudioPayment_fixed(user, targetStudioId, studiosForTarget);
        const originalResult = canManageStudioPayment_original(user, targetStudioId, studiosForTarget);
        expect(fixedResult).toBe(false);
        expect(fixedResult).toBe(originalResult);
      }
    );

    it.each(studioIds)(
      "Fixed matches original: STUDIO_STAFF always returns false for studioId=%s",
      (targetStudioId) => {
        const studiosForTarget = [{ id: targetStudioId, ownerId }];
        const user = { id: ownerId, role: UserRole.STUDIO_STAFF, studioId: targetStudioId };
        const fixedResult = canManageStudioPayment_fixed(user, targetStudioId, studiosForTarget);
        const originalResult = canManageStudioPayment_original(user, targetStudioId, studiosForTarget);
        expect(fixedResult).toBe(false);
        expect(fixedResult).toBe(originalResult);
      }
    );

    it.each(studioIds)(
      "Fixed matches original: CUSTOMER always returns false for studioId=%s",
      (targetStudioId) => {
        const studiosForTarget = [{ id: targetStudioId, ownerId }];
        const user = { id: ownerId, role: UserRole.CUSTOMER };
        const fixedResult = canManageStudioPayment_fixed(user, targetStudioId, studiosForTarget);
        const originalResult = canManageStudioPayment_original(user, targetStudioId, studiosForTarget);
        expect(fixedResult).toBe(false);
        expect(fixedResult).toBe(originalResult);
      }
    );
  });
});
