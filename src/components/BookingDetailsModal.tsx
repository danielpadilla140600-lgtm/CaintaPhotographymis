import React from "react";
import {
  X, Calendar, Clock, User, Phone, Mail, FileText,
  CreditCard, Package, Layers, MapPin, Camera, Hash,
  AlertCircle, CheckCircle, RotateCcw, BadgeCheck, Info
} from "lucide-react";

interface BookingDetailsModalProps {
  booking: any;
  studio?: any;
  services?: any[];
  packages?: any[];
  addons?: any[];
  onClose: () => void;
}

// ── tiny helpers ─────────────────────────────────────────────────────────────
const STATUS_COLOR: Record<string, string> = {
  Pending:           "bg-yellow-50 text-yellow-800 border-yellow-200",
  "Awaiting Payment":"bg-orange-50 text-orange-700 border-orange-200",
  Confirmed:         "bg-blue-50 text-blue-700 border-blue-200",
  Rescheduled:       "bg-indigo-50 text-indigo-700 border-indigo-200",
  Ongoing:           "bg-cyan-50 text-cyan-700 border-cyan-200",
  Completed:         "bg-green-50 text-green-700 border-green-200",
  Cancelled:         "bg-gray-100 text-gray-500 border-gray-200",
  Rejected:          "bg-rose-50 text-rose-700 border-rose-200",
  Expired:           "bg-rose-50 text-rose-600 border-rose-200",
  "No Show":         "bg-gray-100 text-gray-500 border-gray-200",
};
const PAY_COLOR: Record<string, string> = {
  Unpaid:                "bg-gray-100 text-gray-500 border-gray-200",
  "Pending Verification":"bg-yellow-50 text-yellow-700 border-yellow-200",
  "Partially Paid":      "bg-orange-50 text-orange-700 border-orange-200",
  Paid:                  "bg-green-50 text-green-700 border-green-200",
  Refunded:              "bg-purple-50 text-purple-700 border-purple-200",
  Failed:                "bg-rose-50 text-rose-700 border-rose-200",
};
const ACCENT_BAR: Record<string, string> = {
  Completed: "bg-green-500",
  Confirmed: "bg-blue-500",
  Pending:   "bg-yellow-400",
  "Awaiting Payment": "bg-orange-400",
  Rescheduled: "bg-indigo-400",
  Cancelled: "bg-red-300",
  Rejected:  "bg-red-400",
  Expired:   "bg-rose-300",
  Ongoing:   "bg-cyan-400",
};

function Label({ children }: { children: React.ReactNode }) {
  return <p className="text-[9px] font-bold uppercase tracking-wider text-[#7c756d] mb-0.5">{children}</p>;
}
function Value({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <p className={`text-xs font-bold text-[#2c2a29] ${className}`}>{children}</p>;
}
function Cell({ label, value, highlight = "" }: { label: string; value: string; highlight?: string }) {
  return (
    <div className="bg-[#faf9f6] rounded-xl px-3 py-2">
      <Label>{label}</Label>
      <Value className={highlight}>{value}</Value>
    </div>
  );
}
function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5">
        <span className="text-[#7c756d]">{icon}</span>
        <p className="text-[10px] font-extrabold uppercase tracking-widest text-[#7c756d]">{title}</p>
      </div>
      {children}
    </div>
  );
}

export default function BookingDetailsModal({
  booking: bk,
  studio,
  services = [],
  packages = [],
  addons = [],
  onClose,
}: BookingDetailsModalProps) {
  if (!bk) return null;

  const service = services.find(s => s.id === bk.serviceId);
  const pkg     = packages.find(p => p.id === bk.packageId);
  const resolvedAddons = (bk.addons || []).map((a: any) => ({
    ...a,
    name: addons.find((ad: any) => ad.id === a.addonId)?.name || `Addon #${a.addonId?.slice(-6) || "?"}`,
  }));

  const statusClass = STATUS_COLOR[bk.status] ?? "bg-gray-100 text-gray-500 border-gray-200";
  const payClass    = PAY_COLOR[bk.paymentStatus] ?? PAY_COLOR.Unpaid;
  const accentBar   = ACCENT_BAR[bk.status] ?? "bg-gray-200";

  const fmt = (iso: string | undefined) =>
    iso ? new Date(iso).toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric" }) : "—";
  const fmtTime = (iso: string | undefined) =>
    iso ? new Date(iso).toLocaleString("en-PH", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto border border-[#e5e1da] flex flex-col">

        {/* Top accent bar */}
        <div className={`h-1.5 w-full rounded-t-3xl flex-shrink-0 ${accentBar}`} />

        {/* Header */}
        <div className="flex items-start justify-between gap-3 px-6 pt-5 pb-4 border-b border-[#f0ede8]">
          <div className="flex items-center gap-3 min-w-0">
            {studio?.coverImage ? (
              <img src={studio.coverImage} alt={studio.name} className="w-11 h-11 rounded-xl object-cover border border-gray-200 flex-shrink-0" />
            ) : (
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-amber-100 to-amber-200 flex items-center justify-center flex-shrink-0">
                <Camera size={18} className="text-amber-600" />
              </div>
            )}
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-1.5 mb-0.5">
                <span className="text-[10px] bg-[#2c2a29] text-white px-2 py-0.5 rounded font-bold tracking-wider">{bk.id}</span>
                <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border uppercase tracking-wider ${statusClass}`}>{bk.status}</span>
                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase tracking-wide ${payClass}`}>{bk.paymentStatus}</span>
              </div>
              <p className="font-display font-black text-sm text-[#2c2a29] leading-tight truncate">
                {studio?.name || "Photography Studio"}
              </p>
              {studio?.location && (
                <p className="text-[10px] text-[#7c756d] flex items-center gap-1 mt-0.5">
                  <MapPin size={9} />{studio.location}
                </p>
              )}
            </div>
          </div>
          <button onClick={onClose} className="flex-shrink-0 p-1.5 rounded-full hover:bg-gray-100 cursor-pointer mt-0.5">
            <X size={16} className="text-[#7c756d]" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-5 flex-1">

          {/* ── Schedule ─────────────────────────────────────────────── */}
          <Section title="Schedule" icon={<Calendar size={12} />}>
            <div className="grid grid-cols-2 gap-2">
              <Cell label="Date"      value={bk.bookingDate} />
              <Cell label="Time Slot" value={bk.timeSlot} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Cell label="Booked On" value={fmt(bk.createdAt)} />
              {bk.paymentDueAt && <Cell label="Payment Due" value={fmtTime(bk.paymentDueAt)} />}
            </div>
          </Section>

          {/* ── Service & Package ─────────────────────────────────────── */}
          <Section title="Service / Package" icon={<Camera size={12} />}>
            <div className="grid grid-cols-2 gap-2">
              <Cell label="Service"  value={service?.name  || bk.serviceId  || "—"} />
              <Cell label="Package"  value={pkg?.name      || bk.packageId  || "None"} />
            </div>
            {bk.paymentOption && (
              <Cell label="Payment Option" value={bk.paymentOption} />
            )}
          </Section>

          {/* ── Addons ───────────────────────────────────────────────── */}
          {resolvedAddons.length > 0 && (
            <Section title="Add-ons" icon={<Layers size={12} />}>
              <div className="space-y-1.5">
                {resolvedAddons.map((a: any, i: number) => (
                  <div key={i} className="flex items-center justify-between bg-[#faf9f6] border border-[#e5e1da] rounded-xl px-3 py-2">
                    <span className="text-xs font-semibold text-[#2c2a29]">{a.name}</span>
                    <span className="text-[10px] text-[#7c756d] font-bold">×{a.quantity} · ₱{Number(a.price).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* ── Customer ─────────────────────────────────────────────── */}
          <Section title="Customer Details" icon={<User size={12} />}>
            <div className="bg-[#faf9f6] border border-[#e5e1da] rounded-xl p-3 space-y-2">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-100 to-amber-200 flex items-center justify-center font-black text-amber-700 text-sm flex-shrink-0">
                  {bk.customerDetails?.fullName?.charAt(0)?.toUpperCase() || "?"}
                </div>
                <div>
                  <p className="text-xs font-bold text-[#2c2a29]">{bk.customerDetails?.fullName || "—"}</p>
                  <p className="text-[10px] text-[#7c756d]">{bk.customerId}</p>
                </div>
              </div>
              {bk.customerDetails?.email && (
                <div className="flex items-center gap-2 text-[10px] text-[#7c756d]">
                  <Mail size={10} className="flex-shrink-0" />
                  <span>{bk.customerDetails.email}</span>
                </div>
              )}
              {bk.customerDetails?.phone && (
                <div className="flex items-center gap-2 text-[10px] text-[#7c756d]">
                  <Phone size={10} className="flex-shrink-0" />
                  <span>{bk.customerDetails.phone}</span>
                </div>
              )}
              {bk.customerDetails?.notes && (
                <div className="flex items-start gap-2 text-[10px] text-[#7c756d]">
                  <FileText size={10} className="flex-shrink-0 mt-0.5" />
                  <span className="italic">"{bk.customerDetails.notes}"</span>
                </div>
              )}
            </div>
          </Section>

          {/* ── Financial ─────────────────────────────────────────────── */}
          <Section title="Payment Summary" icon={<CreditCard size={12} />}>
            <div className="grid grid-cols-3 gap-2">
              <Cell label="Total"   value={`₱${Number(bk.totalAmount).toLocaleString()}`} />
              <Cell label="Paid"    value={`₱${Number(bk.amountPaid || 0).toLocaleString()}`} highlight="text-emerald-700" />
              <Cell label="Balance" value={`₱${Number(bk.remainingBalance ?? Math.max(0, bk.totalAmount - (bk.amountPaid || 0))).toLocaleString()}`} highlight="text-amber-700" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Cell label="Downpayment" value={`₱${Number(bk.downPaymentAmount || Math.round(bk.totalAmount * 0.3 * 100) / 100).toLocaleString()}`} />
              <Cell label="Final Payment" value={bk.finalPaymentStatus || "—"} highlight={bk.finalPaymentStatus === "Paid" ? "text-green-700" : ""} />
            </div>
          </Section>

          {/* ── Requirements ─────────────────────────────────────────── */}
          {bk.requirementsDoc && (
            <Section title="Requirements" icon={<FileText size={12} />}>
              <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl px-3 py-2">
                <CheckCircle size={12} className="text-green-600 flex-shrink-0" />
                <span className="text-xs font-bold text-green-700">{bk.requirementsDoc}</span>
              </div>
            </Section>
          )}

          {/* ── Cancellation details ──────────────────────────────────── */}
          {(bk.status === "Cancelled" || bk.status === "Rejected") && (bk.cancellationReason || bk.cancelledAt) && (
            <Section title="Cancellation Details" icon={<AlertCircle size={12} />}>
              <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 space-y-1.5">
                {bk.cancellationReason && (
                  <div>
                    <Label>Reason</Label>
                    <Value>{bk.cancellationReason}</Value>
                  </div>
                )}
                {bk.cancelledAt && (
                  <div>
                    <Label>Cancelled On</Label>
                    <Value>{fmtTime(bk.cancelledAt)}</Value>
                  </div>
                )}
              </div>
            </Section>
          )}

          {/* ── Refund details ────────────────────────────────────────── */}
          {bk.paymentStatus === "Refunded" && (
            <Section title="Refund Info" icon={<RotateCcw size={12} />}>
              <div className="bg-purple-50 border border-purple-200 rounded-xl p-3 space-y-1.5">
                {(bk as any).refundAmount != null && (
                  <div>
                    <Label>Refund Amount</Label>
                    <Value>₱{Number((bk as any).refundAmount).toLocaleString("en-PH", { minimumFractionDigits: 2 })}</Value>
                  </div>
                )}
                {(bk as any).refundedAt && (
                  <div>
                    <Label>Refunded On</Label>
                    <Value>{fmtTime((bk as any).refundedAt)}</Value>
                  </div>
                )}
                {(bk as any).refundReason && (
                  <div>
                    <Label>Reason</Label>
                    <Value>{(bk as any).refundReason}</Value>
                  </div>
                )}
              </div>
            </Section>
          )}

          {/* ── Archive info ──────────────────────────────────────────── */}
          {bk.isArchived && (
            <Section title="Archive" icon={<Info size={12} />}>
              <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
                <Label>Archived On</Label>
                <Value>{fmt(bk.archivedAt)}</Value>
              </div>
            </Section>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 pb-5 pt-3 border-t border-[#f0ede8] flex-shrink-0">
          <button
            onClick={onClose}
            className="w-full py-2.5 bg-[#2c2a29] hover:bg-[#4a4644] text-white rounded-xl text-xs font-bold uppercase tracking-wider cursor-pointer transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
