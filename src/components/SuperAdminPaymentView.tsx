import React from "react";
import { X, Eye } from "lucide-react";

interface SuperAdminPaymentViewProps {
  payment: any;
  onClose: () => void;
  onOpenProof: (payment: any) => void;
}

export default function SuperAdminPaymentView({ payment: p, onClose, onOpenProof }: SuperAdminPaymentViewProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto border border-[#e5e1da] flex flex-col">
        <div className="h-1.5 w-full rounded-t-3xl flex-shrink-0 bg-emerald-500" />
        <div className="flex items-start justify-between gap-3 px-6 pt-5 pb-4 border-b border-[#f0ede8]">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5 mb-1">
              <span className="text-[10px] bg-[#2c2a29] text-white px-2 py-0.5 rounded font-bold tracking-wider font-mono">{p.id}</span>
              <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border uppercase tracking-wider ${
                p.paymentStatus === "Paid" ? "bg-green-50 text-green-700 border-green-200" :
                p.paymentStatus === "Pending Verification" ? "bg-amber-50 text-amber-700 border-amber-200" :
                "bg-gray-100 text-gray-500 border-gray-200"
              }`}>{p.paymentStatus}</span>
            </div>
            <p className="font-display font-black text-sm text-[#2c2a29] leading-tight truncate">{p.studioName || "Studio Payment"}</p>
            <p className="text-[10px] text-[#7c756d]">Payment Ledger · Full Details</p>
          </div>
          <button onClick={onClose} className="flex-shrink-0 p-1.5 rounded-full hover:bg-gray-100 cursor-pointer mt-0.5">
            <X size={16} className="text-[#7c756d]" />
          </button>
        </div>
        <div className="px-6 py-5 space-y-4 flex-1">
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-[#faf9f6] rounded-xl px-3 py-2">
              <p className="text-[9px] font-bold uppercase tracking-wider text-[#7c756d] mb-0.5">Booking</p>
              <p className="text-xs font-bold text-[#2c2a29] font-mono">{p.bookingId || "—"}</p>
            </div>
            <div className="bg-[#faf9f6] rounded-xl px-3 py-2">
              <p className="text-[9px] font-bold uppercase tracking-wider text-[#7c756d] mb-0.5">Type</p>
              <p className="text-xs font-bold text-[#2c2a29]">{p.paymentType || "—"}</p>
            </div>
            <div className="bg-[#faf9f6] rounded-xl px-3 py-2">
              <p className="text-[9px] font-bold uppercase tracking-wider text-[#7c756d] mb-0.5">Method</p>
              <p className="text-xs font-bold text-[#2c2a29]">{p.paymentMethod || "—"}</p>
            </div>
            <div className="bg-[#faf9f6] rounded-xl px-3 py-2">
              <p className="text-[9px] font-bold uppercase tracking-wider text-[#7c756d] mb-0.5">Amount</p>
              <p className="text-xs font-bold text-emerald-700">₱{Number(p.amount || 0).toLocaleString("en-PH", { minimumFractionDigits: 2 })}</p>
            </div>
            <div className="bg-[#faf9f6] rounded-xl px-3 py-2">
              <p className="text-[9px] font-bold uppercase tracking-wider text-[#7c756d] mb-0.5">Reference No.</p>
              <p className="text-xs font-bold text-[#2c2a29] font-mono break-all">{p.referenceNumber || "—"}</p>
            </div>
            <div className="bg-[#faf9f6] rounded-xl px-3 py-2">
              <p className="text-[9px] font-bold uppercase tracking-wider text-[#7c756d] mb-0.5">Payment Date</p>
              <p className="text-xs font-bold text-[#2c2a29]">{p.paymentDate ? new Date(p.paymentDate).toLocaleString("en-PH", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "—"}</p>
            </div>
          </div>
          {p.booking && (
            <div className="bg-[#faf9f6] border border-[#e5e1da] rounded-xl p-3 text-[11px] text-[#7c756d] space-y-1">
              <p><span className="font-bold text-[#2c2a29]">Customer:</span> {p.booking.customerDetails?.fullName || p.booking.customerId || "—"}</p>
              <p><span className="font-bold text-[#2c2a29]">Schedule:</span> {p.booking.bookingDate || "—"} · {p.booking.timeSlot || ""}</p>
              <p><span className="font-bold text-[#2c2a29]">Booking status:</span> {p.booking.status || "—"}</p>
            </div>
          )}
          {p.proofOfPayment && (
            <button type="button" onClick={() => onOpenProof(p)}
              className="w-full flex items-center justify-center gap-1.5 py-2.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-xl text-xs font-bold cursor-pointer transition-colors">
              <Eye size={13} /> Open Proof Image (properly fitted preview)
            </button>
          )}
        </div>
        <div className="px-6 pb-5 pt-3 border-t border-[#f0ede8] flex-shrink-0">
          <button onClick={onClose}
            className="w-full py-2.5 bg-[#2c2a29] hover:bg-[#4a4644] text-white rounded-xl text-xs font-bold uppercase tracking-wider cursor-pointer transition-colors">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
