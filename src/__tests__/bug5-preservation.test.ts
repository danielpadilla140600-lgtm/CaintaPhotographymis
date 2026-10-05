import { describe, it, expect } from "vitest";

function validateEmail_original(email: any): { valid: boolean; message?: string } {
  if (!email) return { valid: false, message: "Required fields are missing." };
  return { valid: true };
}

function validateEmail_fixed(email: any): { valid: boolean; message?: string } {
  if (!email) return { valid: false, message: "Required fields are missing." };
  if (!/^\S+@\S+\.\S+$/.test(String(email).trim())) {
    return { valid: false, message: "A valid email address is required." };
  }
  return { valid: true };
}

const validEmails = ["user@example.com", "test.user+tag@domain.co.uk", "admin@cainta-mis.ph"];

describe("Bug 5 — Preservation: Valid email registration must not change", () => {
  it("Preservation: null/undefined email still rejected (must preserve)", () => {
    expect(validateEmail_original(null).valid).toBe(false);
    expect(validateEmail_original(undefined).valid).toBe(false);
    expect(validateEmail_fixed(null).valid).toBe(false);
    expect(validateEmail_fixed(undefined).valid).toBe(false);
  });

  it.each(validEmails)("Preservation: valid email '%s' returns true (must preserve)", (email) => {
    expect(validateEmail_original(email).valid).toBe(true);
    expect(validateEmail_fixed(email).valid).toBe(true); // fixed must still accept valid emails
  });
});
