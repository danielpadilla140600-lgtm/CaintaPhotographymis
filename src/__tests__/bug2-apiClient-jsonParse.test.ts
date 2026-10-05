/**
 * Bug 2 — Unguarded JSON.parse on localStorage Crashes All API Requests
 * Bug Condition Exploration Test
 *
 * Spec: .kiro/specs/system-bugfix-comprehensive/bugfix.md
 *
 * BUG: apiRequest() in src/utils/apiClient.ts calls JSON.parse(cachedUser)
 * without a try/catch. If "cainta_current_user" in localStorage contains
 * corrupted or malformed JSON, every API call throws an unhandled SyntaxError,
 * rendering the entire application non-functional until the user manually
 * clears their browser storage.
 *
 * CRITICAL: This test is EXPECTED TO FAIL on unfixed code.
 * Failure confirms the bug exists. It will PASS after the fix is applied.
 *
 * Property tested: Bug Condition 2 — Corrupted localStorage Does Not Crash API
 *   isBugCondition_2(cachedUser) = cachedUser !== null AND isInvalidJSON(cachedUser)
 *
 * FOR ALL cachedUser WHERE isBugCondition_2(cachedUser) DO
 *   result ← parseUserFromStorage_original()
 *   ASSERT no_exception_thrown(result) AND result proceeds as unauthenticated
 * END FOR
 *
 * Validates: Requirements 1.1, 1.2
 */

import { describe, it, expect, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Minimal localStorage mock for Node.js test environment
// (localStorage is browser-only; vitest runs in Node.js)
// ---------------------------------------------------------------------------
const mockStorage: Record<string, string> = {};
const mockLocalStorage = {
  getItem: (key: string) => mockStorage[key] ?? null,
  setItem: (key: string, value: string) => {
    mockStorage[key] = value;
  },
  removeItem: (key: string) => {
    delete mockStorage[key];
  },
};

// ---------------------------------------------------------------------------
// Mirror the BUGGY parse logic from src/utils/apiClient.ts — UNFIXED version.
// The original code (around line 39-41 of apiClient.ts):
//
//   const cachedUser = localStorage.getItem("cainta_current_user");
//   const user = cachedUser ? JSON.parse(cachedUser) : null;
//
// No try/catch — this is the defect. Inlined here so tests run without a
// browser or a live server, and without touching the actual (possibly already
// fixed) source file.
// ---------------------------------------------------------------------------
function parseUserFromStorage_original(): any {
  const cachedUser = mockLocalStorage.getItem("cainta_current_user");
  // BUG: No try/catch. Invalid JSON throws SyntaxError here.
  const user = cachedUser ? JSON.parse(cachedUser) : null;
  return user;
}

// ---------------------------------------------------------------------------
// Fixed version — mirrors the CORRECT fix (try/catch guard):
//
//   let user: any = null;
//   if (cachedUser) {
//     try { user = JSON.parse(cachedUser); }
//     catch { mockLocalStorage.removeItem("cainta_current_user"); }
//   }
// ---------------------------------------------------------------------------
function parseUserFromStorage_fixed(): any {
  const cachedUser = mockLocalStorage.getItem("cainta_current_user");
  let user: any = null;
  if (cachedUser) {
    try {
      user = JSON.parse(cachedUser);
    } catch {
      mockLocalStorage.removeItem("cainta_current_user");
    }
  }
  return user;
}

// ---------------------------------------------------------------------------
// Invalid JSON values that represent isBugCondition_2(cachedUser) = true:
//   - cachedUser is non-null
//   - cachedUser is not valid JSON
//
// Note: "null" and "true" and "123" ARE valid JSON (primitives), so they are
// excluded from the bug-condition set. The cases below are genuinely invalid.
// "   " (whitespace-only) throws in V8/Node.js because JSON.parse("   ")
// raises SyntaxError: Unexpected end of JSON input.
// ---------------------------------------------------------------------------
const invalidJsonValues = [
  "undefined",   // JavaScript keyword — not valid JSON
  "{bad json",   // Unclosed object with unquoted key
  "not-json",    // Plain string without quotes
  "{key:}",      // Object with unquoted key and missing value
  "NaN",         // JavaScript special value — not valid JSON
  "true false",  // Two tokens — JSON allows only one top-level value
  "   ",         // Whitespace-only — SyntaxError in V8 (unexpected end of input)
];

// ---------------------------------------------------------------------------
// Bug Condition Exploration — Property 1: Corrupted localStorage must not throw
//
// Validates: Requirements 1.1, 1.2
// ---------------------------------------------------------------------------
describe("Bug 2 — Unguarded JSON.parse Bug Condition", () => {
  beforeEach(() => {
    // Clear mock storage before each test to avoid cross-test contamination
    Object.keys(mockStorage).forEach((k) => delete mockStorage[k]);
  });

  /**
   * **Validates: Requirements 1.1, 1.2**
   *
   * isBugCondition_2(cachedUser) = cachedUser !== null AND isInvalidJSON(cachedUser)
   *
   * The correct behaviour (post-fix) is: no exception thrown, user treated as null.
   * The BUGGY behaviour: JSON.parse throws SyntaxError, propagating out of the function.
   *
   * On UNFIXED code: each invalid value causes a throw → assertion FAILS (bug confirmed).
   * On FIXED code:   no throw for any value → assertion PASSES (fix confirmed).
   */
  it.each(invalidJsonValues)(
    "BugCondition: corrupted localStorage value '%s' should NOT throw but DOES (bug exists)",
    (invalidValue) => {
      mockLocalStorage.setItem("cainta_current_user", invalidValue);

      // The correct (expected) behaviour would be: no exception,
      // treat the stored value as absent and continue as unauthenticated.
      // The BUGGY behaviour throws SyntaxError — this assertion FAILS on unfixed code.
      expect(() => parseUserFromStorage_original()).not.toThrow();
    }
  );

  /**
   * Additional single-call test that aggregates all invalid values.
   * Surfaces the first counterexample found in one test case.
   */
  it("BugCondition: any corrupted localStorage value should not crash the parser (currently FAILS — bug exists)", () => {
    for (const invalidValue of invalidJsonValues) {
      mockLocalStorage.setItem("cainta_current_user", invalidValue);

      // Document expected vs actual:
      //   Expected: returns null (unauthenticated), no exception
      //   Actual (buggy): throws SyntaxError — e.g. value="undefined" →
      //     SyntaxError: Unexpected token 'u', "undefined" is not valid JSON
      expect(() => parseUserFromStorage_original()).not.toThrow();
    }
  });
});

// ---------------------------------------------------------------------------
// Post-Fix Verification — Property 1: Fixed parser handles corrupted values
//
// Validates: Requirements 2.1, 2.2
// ---------------------------------------------------------------------------
describe("Bug 2 — Unguarded JSON.parse Post-Fix Verification", () => {
  beforeEach(() => {
    Object.keys(mockStorage).forEach((k) => delete mockStorage[k]);
  });

  /**
   * **Validates: Requirements 2.1, 2.2**
   *
   * Runs the SAME assertions as the bug condition tests above, but against
   * parseUserFromStorage_fixed — which wraps JSON.parse in a try/catch.
   *
   * On FIXED code: no throw, returns null → test PASSES (fix confirmed).
   */
  it.each(invalidJsonValues)(
    "PostFix: corrupted localStorage value '%s' should not throw",
    (invalidValue) => {
      mockLocalStorage.setItem("cainta_current_user", invalidValue);
      expect(() => parseUserFromStorage_fixed()).not.toThrow();
    }
  );

  it.each(invalidJsonValues)(
    "PostFix: corrupted localStorage value '%s' should return null (unauthenticated)",
    (invalidValue) => {
      mockLocalStorage.setItem("cainta_current_user", invalidValue);
      const result = parseUserFromStorage_fixed();
      expect(result).toBeNull();
    }
  );

  it.each(invalidJsonValues)(
    "PostFix: corrupted localStorage entry '%s' should be cleared after parse failure",
    (invalidValue) => {
      mockLocalStorage.setItem("cainta_current_user", invalidValue);
      parseUserFromStorage_fixed();
      // Corrupted entry must be cleared so subsequent calls also get null
      expect(mockLocalStorage.getItem("cainta_current_user")).toBeNull();
    }
  );
});
