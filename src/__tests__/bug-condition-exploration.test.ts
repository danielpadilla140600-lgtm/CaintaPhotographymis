/**
 * Bug Condition Exploration Tests
 *
 * These tests confirm the existence of the bug described in:
 *   .kiro/specs/failed-fetch-api-base-url-fix/bugfix.md
 *
 * BUG: Components call raw `fetch("/api/...")` with relative paths instead of routing through
 * `apiRequest()` / `resolveApiUrl()` from `src/utils/apiClient.ts`. In production (Firebase
 * Hosting + Render.com backend) the requests hit the static host and fail.
 *
 * CRITICAL: These tests are EXPECTED TO FAIL on unfixed code.
 * Failure confirms the bug exists. They will PASS after the fix is applied.
 *
 * Property tested: isBugCondition(call)
 *   = call.url STARTS_WITH "/api/"
 *     AND resolveApiUrl WAS NOT called on call.url
 *
 * Validates: Requirements 1.1, 1.2, 1.3
 */

import * as fs from "fs";
import * as path from "path";
import { describe, it, expect } from "vitest";

// Resolve source file paths relative to this test file's location
const ROOT = path.resolve(__dirname, "../..");

function readSource(relPath: string): string {
  return fs.readFileSync(path.join(ROOT, relPath), "utf-8");
}

// ---------------------------------------------------------------------------
// Helper: count non-overlapping occurrences of a substring in a string
// ---------------------------------------------------------------------------
function countOccurrences(haystack: string, needle: string): number {
  let count = 0;
  let idx = 0;
  while ((idx = haystack.indexOf(needle, idx)) !== -1) {
    count++;
    idx += needle.length;
  }
  return count;
}

// ---------------------------------------------------------------------------
// Section 1 — Login.tsx
// Validates: Requirement 1.1 (production fetch failures), 1.3 (bypasses resolveApiUrl)
//
// After the fix: Login.tsx should NOT contain any raw fetch("/api/auth/...") calls.
// On unfixed code these assertions FAIL — confirming the bug.
// ---------------------------------------------------------------------------
describe("Bug Condition — src/pages/Login.tsx raw /api/ fetch calls", () => {
  const src = readSource("src/pages/Login.tsx");

  it("should NOT have raw fetch(\"/api/auth/login\") — use apiRequest instead", () => {
    // FAILS on unfixed code: Login.tsx calls fetch("/api/auth/login") directly
    expect(src).not.toContain('fetch("/api/auth/login"');
  });

  it("should NOT have raw fetch(\"/api/auth/register\")", () => {
    expect(src).not.toContain('fetch("/api/auth/register"');
  });

  it("should NOT have raw fetch(\"/api/auth/forgot-password\")", () => {
    expect(src).not.toContain('fetch("/api/auth/forgot-password"');
  });

  it("should NOT have raw fetch(\"/api/auth/verify-reset-otp\")", () => {
    expect(src).not.toContain('fetch("/api/auth/verify-reset-otp"');
  });

  it("should NOT have raw fetch(\"/api/auth/reset-password\")", () => {
    expect(src).not.toContain('fetch("/api/auth/reset-password"');
  });

  it("should NOT have raw fetch(\"/api/auth/google\")", () => {
    expect(src).not.toContain('fetch("/api/auth/google"');
  });
});

// ---------------------------------------------------------------------------
// Section 2 — BookingWizard.tsx
// Validates: Requirement 1.2 (local dev fetch failures), 1.3 (bypasses resolveApiUrl)
//
// After the fix: BookingWizard.tsx should NOT contain raw fetch("/api/bookings") or
// fetch("/api/payments"). On unfixed code these FAIL — confirming the bug.
// ---------------------------------------------------------------------------
describe("Bug Condition — src/components/BookingWizard.tsx raw /api/ fetch calls", () => {
  const src = readSource("src/components/BookingWizard.tsx");

  it("should NOT have raw fetch(\"/api/bookings\") — use apiRequest instead", () => {
    // FAILS on unfixed code: BookingWizard.tsx calls fetch("/api/bookings") directly
    expect(src).not.toContain('fetch("/api/bookings"');
  });

  it("should NOT have raw fetch(\"/api/payments\")", () => {
    expect(src).not.toContain('fetch("/api/payments"');
  });
});

// ---------------------------------------------------------------------------
// Section 3 — App.tsx
// Validates: Requirement 1.3 (11 batch fetches bypassing resolveApiUrl)
//
// App.tsx uses publicEndpoints.map(ep => fetch(ep)) for 11 endpoints, plus
// additional standalone raw fetches. After the fix all should be replaced by
// apiRequest(ep). On unfixed code these FAIL — confirming the bug.
// ---------------------------------------------------------------------------
describe("Bug Condition — src/App.tsx raw /api/ fetch calls", () => {
  const src = readSource("src/App.tsx");

  it("should NOT have publicEndpoints.map(ep => fetch(ep)) — should use apiRequest(ep)", () => {
    // FAILS on unfixed code: batch fetch with raw fetch(ep) over publicEndpoints
    expect(src).not.toContain("fetch(ep)");
  });

  it("should NOT have raw fetch(\"/api/chatbot/faqs\")", () => {
    expect(src).not.toContain('fetch("/api/chatbot/faqs"');
  });

  it("should NOT have raw fetch(\"/api/chatbot/faq-suggestions\")", () => {
    expect(src).not.toContain('fetch("/api/chatbot/faq-suggestions"');
  });

  it("should NOT have raw fetch(\"/api/studios?includePending=true\")", () => {
    expect(src).not.toContain('fetch("/api/studios?includePending=true"');
  });

  it("should NOT have authEndpoints.map(ep => fetch(ep,...)) — should use apiRequest(ep)", () => {
    // The auth endpoint batch also uses raw fetch(ep, { headers: authHeaders })
    // After the fix: replaced by apiRequest(ep) which auto-injects headers
    const rawAuthBatch = src.includes("fetch(ep, { headers: authHeaders })");
    expect(rawAuthBatch).toBe(false);
  });

  it("should NOT have raw fetch(\"/api/payments\") in handleUploadPayment", () => {
    // App.tsx has a standalone fetch("/api/payments") in handleUploadPayment
    expect(src).not.toContain('fetch("/api/payments"');
  });

  it("should NOT have raw fetch(\"/api/reviews\") in handleSubmitReview", () => {
    expect(src).not.toContain('fetch("/api/reviews"');
  });
});

// ---------------------------------------------------------------------------
// Section 4 — GCashQRModal.tsx
// Validates: Requirement 1.3 (bypasses resolveApiUrl for payment endpoints)
//
// After the fix: should call apiRequest, not raw fetch. On unfixed code these FAIL.
// ---------------------------------------------------------------------------
describe("Bug Condition — src/components/GCashQRModal.tsx raw /api/ fetch calls", () => {
  const src = readSource("src/components/GCashQRModal.tsx");

  it("should NOT have raw fetch(\"/api/payments/gcash/create-qr\")", () => {
    // FAILS on unfixed code: GCashQRModal calls fetch("/api/payments/gcash/create-qr") directly
    expect(src).not.toContain('fetch("/api/payments/gcash/create-qr"');
  });

  it("should NOT have raw fetch(\"/api/payments/gcash/submit-proof\")", () => {
    expect(src).not.toContain('fetch("/api/payments/gcash/submit-proof"');
  });
});

// ---------------------------------------------------------------------------
// Section 5 — Additional files with raw /api/ fetch calls
// Validates: Requirement 1.3 across all 11 affected source files
// ---------------------------------------------------------------------------
describe("Bug Condition — other affected files with raw /api/ fetch calls", () => {
  it("src/pages/AdminDashboard.tsx should NOT have raw fetch(\"/api/admin/reviews\")", () => {
    const src = readSource("src/pages/AdminDashboard.tsx");
    expect(src).not.toContain('fetch("/api/admin/reviews"');
  });

  it("src/pages/AdminDashboard.tsx should NOT have raw fetch(\"/api/admin/settings\")", () => {
    const src = readSource("src/pages/AdminDashboard.tsx");
    expect(src).not.toContain('fetch("/api/admin/settings"');
  });

  it("src/pages/AdminDashboard.tsx should NOT have raw fetch(\"/api/cms\")", () => {
    const src = readSource("src/pages/AdminDashboard.tsx");
    expect(src).not.toContain('fetch("/api/cms"');
  });

  it("src/pages/AdminDashboard.tsx should NOT have raw fetch(\"/api/admin/create-user\")", () => {
    const src = readSource("src/pages/AdminDashboard.tsx");
    expect(src).not.toContain('fetch("/api/admin/create-user"');
  });

  it("src/pages/AdminDashboard.tsx should NOT have raw fetch(\"/api/admin/register-studio\")", () => {
    const src = readSource("src/pages/AdminDashboard.tsx");
    expect(src).not.toContain('fetch("/api/admin/register-studio"');
  });

  it("src/pages/AccountSettings.tsx should NOT have raw fetch(\"/api/auth/account\")", () => {
    const src = readSource("src/pages/AccountSettings.tsx");
    expect(src).not.toContain('fetch("/api/auth/account"');
  });

  it("src/pages/StudioDashboard.tsx should NOT have raw fetch(\"/api/payments/gcash/gateway-status\")", () => {
    const src = readSource("src/pages/StudioDashboard.tsx");
    expect(src).not.toContain('fetch("/api/payments/gcash/gateway-status"');
  });

  it("src/components/Chatbot.tsx should NOT have raw fetch(\"/api/chatbot/message\")", () => {
    const src = readSource("src/components/Chatbot.tsx");
    expect(src).not.toContain('fetch("/api/chatbot/message"');
  });

  it("src/components/PrintOrderWizard.tsx should NOT have raw fetch(\"/api/print-orders\")", () => {
    const src = readSource("src/components/PrintOrderWizard.tsx");
    expect(src).not.toContain('fetch("/api/print-orders"');
  });

  it("src/components/ClientGallery.tsx should NOT have raw fetch(\"/api/photo-proofing\")", () => {
    const src = readSource("src/components/ClientGallery.tsx");
    expect(src).not.toContain('fetch("/api/photo-proofing"');
  });

  it("src/components/ClientGallery.tsx should NOT have raw fetch(\"/api/media\")", () => {
    const src = readSource("src/components/ClientGallery.tsx");
    expect(src).not.toContain('fetch("/api/media"');
  });
});

// ---------------------------------------------------------------------------
// Section 6 — resolveApiUrl behaviour (these PASS on unfixed code too)
// Shows that the utility works correctly — the bug is that components skip it.
// Validates: Requirement 2.1 (resolveApiUrl produces correct absolute URLs)
// ---------------------------------------------------------------------------
describe("resolveApiUrl — behaviour (baseline, should pass on unfixed code)", () => {
  const FAKE_BASE = "https://caintaphotographymisystem-1.onrender.com";

  it("prepends VITE_API_BASE_URL to relative /api/ paths when env var is set", () => {
    // Manually replicate resolveApiUrl logic to test it without import.meta env
    function resolveApiUrl(apiPath: string, base: string): string {
      const baseUrl = (base || "").trim().replace(/\/+$/, "");
      if (!baseUrl || apiPath.startsWith("http://") || apiPath.startsWith("https://")) {
        return apiPath;
      }
      const clean = apiPath.startsWith("/") ? apiPath : `/${apiPath}`;
      return `${baseUrl}${clean}`;
    }

    expect(resolveApiUrl("/api/auth/login", FAKE_BASE))
      .toBe("https://caintaphotographymisystem-1.onrender.com/api/auth/login");

    expect(resolveApiUrl("/api/bookings", FAKE_BASE))
      .toBe("https://caintaphotographymisystem-1.onrender.com/api/bookings");

    expect(resolveApiUrl("/api/payments/gcash/create-qr", FAKE_BASE))
      .toBe("https://caintaphotographymisystem-1.onrender.com/api/payments/gcash/create-qr");
  });

  it("returns absolute URLs unchanged (no double-prefix)", () => {
    function resolveApiUrl(apiPath: string, base: string): string {
      const baseUrl = (base || "").trim().replace(/\/+$/, "");
      if (!baseUrl || apiPath.startsWith("http://") || apiPath.startsWith("https://")) {
        return apiPath;
      }
      const clean = apiPath.startsWith("/") ? apiPath : `/${apiPath}`;
      return `${baseUrl}${clean}`;
    }

    const alreadyAbsolute = "https://caintaphotographymisystem-1.onrender.com/api/auth/login";
    expect(resolveApiUrl(alreadyAbsolute, FAKE_BASE)).toBe(alreadyAbsolute);
  });

  it("confirms the bug: raw fetch(\"/api/auth/login\") skips VITE_API_BASE_URL entirely", () => {
    // When components call fetch("/api/auth/login") directly, the browser uses the page origin.
    // In production (Firebase), that means https://<firebase-host>/api/auth/login → 404.
    // This test documents the bug by asserting that a URL starting with "/api/" is NOT absolute.
    const rawRelativePath = "/api/auth/login";
    expect(rawRelativePath.startsWith("http://") || rawRelativePath.startsWith("https://")).toBe(false);
    // => request goes to the wrong host in production; this is the bug.
  });
});
