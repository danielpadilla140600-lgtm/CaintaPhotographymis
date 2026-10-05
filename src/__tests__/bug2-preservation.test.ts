/**
 * Bug 2 — Unguarded JSON.parse on localStorage Crashes All API Requests
 * Preservation Property Test
 *
 * Spec: .kiro/specs/system-bugfix-comprehensive/bugfix.md
 *
 * PURPOSE: Verify that VALID and NULL localStorage behaviour is preserved
 * unchanged after the Bug 2 fix is applied.
 *
 * These tests run against the ORIGINAL (unfixed) parse logic and MUST PASS —
 * confirming the baseline behavior that must not regress when the fix lands.
 *
 * Property tested: Preservation 2 — Valid/Null localStorage Behaviour Unchanged
 *
 * FOR ALL cachedUser WHERE cachedUser IS null OR isValidJSON(cachedUser) DO
 *   result ← extractAuthHeader_original()
 *   IF cachedUser contains authToken THEN ASSERT result = "Bearer <token>"
 *   ELSE                                  ASSERT result = null
 * END FOR
 *
 * Validates: Requirements 3.1, 3.2
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

// Minimal localStorage mock
const mockStorage: Record<string, string | undefined> = {};
const mockLocalStorage = {
  getItem: (key: string): string | null => mockStorage[key] ?? null,
  setItem: (key: string, value: string): void => { mockStorage[key] = value; },
  removeItem: (key: string): void => { delete mockStorage[key]; },
};

// Mirror the UNFIXED parse logic (what currently runs)
function extractAuthHeader_original(): string | null {
  const cachedUser = mockLocalStorage.getItem("cainta_current_user");
  const user = cachedUser ? JSON.parse(cachedUser) : null;
  return user?.authToken ? `Bearer ${user.authToken}` : null;
}

// Mirror the FIXED parse logic (try/catch around JSON.parse)
function extractAuthHeader_fixed(): string | null {
  const cachedUser = mockLocalStorage.getItem("cainta_current_user");
  let user: any = null;
  if (cachedUser) {
    try {
      user = JSON.parse(cachedUser);
    } catch {
      mockLocalStorage.removeItem("cainta_current_user");
      user = null;
    }
  }
  return user?.authToken ? `Bearer ${user.authToken}` : null;
}

describe("Bug 2 — Preservation: Valid/null localStorage behavior unchanged", () => {
  beforeEach(() => {
    Object.keys(mockStorage).forEach(k => delete mockStorage[k]);
  });

  it("Preservation: valid JSON with authToken → Authorization header set (must preserve)", () => {
    mockLocalStorage.setItem("cainta_current_user", JSON.stringify({ authToken: "tok-abc123", role: "CUSTOMER" }));
    const header = extractAuthHeader_original();
    expect(header).toBe("Bearer tok-abc123");
  });

  it("Preservation: null localStorage → no Authorization header (must preserve)", () => {
    // nothing set in storage
    const header = extractAuthHeader_original();
    expect(header).toBeNull();
  });

  it("Preservation: valid JSON without authToken → no Authorization header (must preserve)", () => {
    mockLocalStorage.setItem("cainta_current_user", JSON.stringify({ role: "CUSTOMER", id: "cust-1" }));
    const header = extractAuthHeader_original();
    expect(header).toBeNull();
  });

  it.each([
    { authToken: "tok-1", role: "CUSTOMER" },
    { authToken: "session-xyz", role: "STUDIO_ADMIN" },
    { authToken: "adm-tok", role: "SUPER_ADMIN" },
  ])(
    "Preservation: valid JSON with authToken=$authToken returns correct header",
    ({ authToken, role }) => {
      mockLocalStorage.setItem("cainta_current_user", JSON.stringify({ authToken, role }));
      const header = extractAuthHeader_original();
      expect(header).toBe(`Bearer ${authToken}`);
    }
  );
});

// ---------------------------------------------------------------------------
// Post-Fix Preservation — same assertions run against extractAuthHeader_fixed
//
// Validates: Requirements 3.1, 3.2
// ---------------------------------------------------------------------------
describe("Bug 2 — Preservation (fixed): Valid/null localStorage behavior unchanged", () => {
  beforeEach(() => {
    Object.keys(mockStorage).forEach(k => delete mockStorage[k]);
  });

  it("Preservation (fixed): valid JSON with authToken → Authorization header set", () => {
    mockLocalStorage.setItem("cainta_current_user", JSON.stringify({ authToken: "tok-abc123", role: "CUSTOMER" }));
    const header = extractAuthHeader_fixed();
    expect(header).toBe("Bearer tok-abc123");
  });

  it("Preservation (fixed): null localStorage → no Authorization header", () => {
    // nothing set in storage
    const header = extractAuthHeader_fixed();
    expect(header).toBeNull();
  });

  it("Preservation (fixed): valid JSON without authToken → no Authorization header", () => {
    mockLocalStorage.setItem("cainta_current_user", JSON.stringify({ role: "CUSTOMER", id: "cust-1" }));
    const header = extractAuthHeader_fixed();
    expect(header).toBeNull();
  });

  it.each([
    { authToken: "tok-1", role: "CUSTOMER" },
    { authToken: "session-xyz", role: "STUDIO_ADMIN" },
    { authToken: "adm-tok", role: "SUPER_ADMIN" },
  ])(
    "Preservation (fixed): valid JSON with authToken=$authToken returns correct header",
    ({ authToken, role }) => {
      mockLocalStorage.setItem("cainta_current_user", JSON.stringify({ authToken, role }));
      const header = extractAuthHeader_fixed();
      expect(header).toBe(`Bearer ${authToken}`);
    }
  );
});
