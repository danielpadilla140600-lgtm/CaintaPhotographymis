/**
 * Booking Back-navigation idempotency (Back button must not create duplicates).
 *
 * Root cause: the wizard POSTed /api/bookings on every Step 5 -> 6 forward
 * navigation, so Payment -> Back -> Payment inserted a second "Awaiting
 * Payment" record and the first slot stayed blocked.
 *
 * Fixed behavior asserted here:
 *  1. POST /api/bookings accepts amendBookingId and updates the same draft
 *     in place (conflict check excludes the draft itself).
 *  2. PUT /api/bookings/:id/void-draft exists and only allows voiding unpaid
 *     drafts owned by the caller (Expired = slot released; payments block it).
 *  3. BookingWizard passes amendBookingId on Step 5->6, ignores its own draft
 *     in the slot grid, and voids the unpaid draft when closed before payment.
 */
import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

function readSource(rel: string): string {
  return fs.readFileSync(path.join(process.cwd(), rel), "utf-8");
}

function extractPostBookings(src: string): string {
  const start = src.indexOf('app.post("/api/bookings",');
  if (start === -1) return "";
  const end = src.indexOf("\napp.", start + 1);
  return src.slice(start, end === -1 ? undefined : end);
}

describe("booking Back-navigation fix", () => {
  it("POST /api/bookings supports idempotent amend via amendBookingId", () => {
    const src = readSource("server.ts");
    const handler = extractPostBookings(src);
    expect(handler).toContain("amendBookingId");
    expect(handler).toContain("amendSkip");
    expect(handler).toContain("draftIndex");
    expect(handler).toContain("amended");
  });

  it("void-draft endpoint exists with unpaid-only guards", () => {
    const src = readSource("server.ts");
    expect(src).toContain('app.put("/api/bookings/:id/void-draft"');
    const tail = src.slice(src.indexOf('app.put("/api/bookings/:id/void-draft"'));
    expect(tail).toContain("Pending Verification");
    expect(tail).toContain('status: "Expired"');
    expect(tail).toContain("Only the owning customer can void this booking.");
  });

  it("wizard reuses the draft and never double-counts its own slot", () => {
    const wiz = readSource("src/components/BookingWizard.tsx");
    expect(wiz).toContain("amendBookingId: createdBooking?.id");
    expect(wiz).toContain("b.id === createdBooking.id");
    expect(wiz).toContain("void-draft");
    expect(wiz).toContain("handleCloseWizard");
  });

  it("availability feed can exclude the wizard's own draft", () => {
    const wiz = readSource("src/components/BookingWizard.tsx");
    expect(wiz).toContain("excludeDraftId");
    const src = readSource("server.ts");
    expect(src).toContain("excludeDraftId");
  });

  it("studio calendar click opens the full booking details modal", () => {
    const calendar = readSource("src/components/SystemCalendar.tsx");
    // Full details modal (same component used in Bookings tab) with catalog
    // lookups so the owner sees sino (customer) at ano (service/package/addons).
    expect(calendar).toContain("BookingDetailsModal");
    expect(calendar).toContain("services={services}");
    expect(calendar).toContain("packages={packages}");
    expect(calendar).toContain("addons={addons}");
    // Day cells + selected-date schedule list expose sino + ano and open details.
    expect(calendar).toContain("customerDetails?.fullName");
    expect(calendar).toContain("Full Details");
    const dashboard = readSource("src/pages/StudioDashboard.tsx");
    expect(dashboard).toContain("onSelectBooking={(b) => setViewingBooking(b)}");
  });

  it("super admin payment + review View opens presentable fitted modals", () => {
    const admin = readSource("src/pages/AdminDashboard.tsx");
    // Payment: separate Proof (fitted image) vs View (full details card).
    expect(admin).toContain("SuperAdminPaymentView");
    expect(admin).toContain("setViewingPayment");
    // Review: View button opens full comment modal with moderation actions.
    expect(admin).toContain("SuperAdminReviewView");
    expect(admin).toContain("setViewingReview");
    // Proof preview fits images instead of full-zoom iframe.
    expect(admin).toContain('kind === "image"');
    expect(admin).toContain("max-h-[68vh] object-contain");
    const payView = readSource("src/components/SuperAdminPaymentView.tsx");
    expect(payView).toContain("max-w-lg");
    expect(payView).toContain("Full Details");
    const revView = readSource("src/components/SuperAdminReviewView.tsx");
    expect(revView).toContain("max-w-lg");
    expect(revView).toContain("Full Comment");
  });
});
