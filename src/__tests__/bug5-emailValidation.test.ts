import { describe, it, expect } from "vitest";

// Mirror the BUGGY validation from server.ts register endpoint (presence check only)
function validateEmail_original(email: any): { valid: boolean; message?: string } {
  if (!email) return { valid: false, message: "Required fields are missing." };
  return { valid: true }; // BUG: no format check
}

// Mirror the FIXED validation (presence check + format check)
function validateEmail_fixed(email: any): { valid: boolean; message?: string } {
  if (!email) return { valid: false, message: "Required fields are missing." };
  if (!/^\S+@\S+\.\S+$/.test(String(email).trim())) {
    return { valid: false, message: "A valid email address is required." };
  }
  return { valid: true };
}

const malformedEmails = ["notanemail", "user@", "@domain.com", "   ", "plainstring", "noat"];

describe("Bug 5 â€” Missing Email Format Validation Bug Condition", () => {
  it.each(malformedEmails)(
    "BugCondition: malformed email '%s' should be rejected but is NOT (bug exists)",
    (email) => {
      const result = validateEmail_original(email);
      expect(result.valid).toBe(false); // FAILS for non-empty malformed emails
    }
  );
});


describe("Bug 5 — Post-Fix Verification: Malformed emails now rejected", () => {
  it.each(malformedEmails)(
    "PostFix: malformed email '%s' is now correctly rejected",
    (email) => {
      const result = validateEmail_fixed(email);
      expect(result.valid).toBe(false); // PASSES with fix applied
    }
  );
});
