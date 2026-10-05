import React from "react";
import { X, Check, Star } from "lucide-react";
import { apiRequest } from "../utils/apiClient";

interface SuperAdminReviewViewProps {
  review: any;
  onClose: () => void;
  onStatusChange: (updated: any) => void;
}

export default function SuperAdminReviewView({ review: r, onClose, onStatusChange }: SuperAdminReviewViewProps) {
  const moderate = async (action: "approve" | "reject") => {
    try {
      const d = await apiRequest(`/api/admin/reviews/${r.id}/${action}`, { method: "POST" });
      if (d.success) onStatusChange(d.review);
    } catch { /* ignore */ }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto border border-[#e5e1da] flex flex-col">
        <div className={`h-1.5 w-full rounded-t-3xl flex-shrink-0 ${Number(r.rating) >= 4 ? "bg-green-400" : Number(r.rating) === 3 ? "bg-yellow-400" : "bg-rose-400"}`} />
        <div className="flex items-start justify-between gap-3 px-6 pt-5 pb-4 border-b border-[#f0ede8]">
          <div className="flex items-center gap-3 min-w-0">
            {r.studioLogo ? (
              <img src={r.studioLogo} alt={r.studioName} className="w-11 h-11 rounded-xl object-cover border border-gray-200 flex-shrink-0" />
            ) : (
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-amber-100 to-amber-200 flex items-center justify-center font-black text-amber-700 text-lg flex-shrink-0">
                {r.customerName?.[0]?.toUpperCase() || "?"}
              </div>
            )}
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-1.5 mb-0.5">
                <span className="font-bold text-sm text-[#2c2a29] truncate">{r.customerName || "Anonymous"}</span>
                <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border uppercase ${
                  r.status === "approved" ? "bg-green-50 text-green-700 border-green-200" :
                  r.status === "rejected" ? "bg-rose-50 text-rose-700 border-rose-200" :
                  "bg-amber-50 text-amber-700 border-amber-200"
                }`}>{r.status}</span>
              </div>
              <div className="flex items-center gap-1">
                {[1,2,3,4,5].map(s => (
                  <Star key={s} size={12} className={s <= Number(r.rating) ? "text-amber-400 fill-amber-400" : "text-gray-200 fill-gray-200"} />
                ))}
                <span className="text-[10px] font-bold text-[#7c756d] ml-1">{r.rating}/5</span>
              </div>
              <p className="text-[10px] text-blue-600 font-semibold truncate mt-0.5">{r.studioName || "Unknown Studio"}</p>
            </div>
          </div>
          <button onClick={onClose} className="flex-shrink-0 p-1.5 rounded-full hover:bg-gray-100 cursor-pointer mt-0.5">
            <X size={16} className="text-[#7c756d]" />
          </button>
        </div>
        <div className="px-6 py-5 space-y-3 flex-1">
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-[#faf9f6] rounded-xl px-3 py-2">
              <p className="text-[9px] font-bold uppercase tracking-wider text-[#7c756d] mb-0.5">Review ID</p>
              <p className="text-xs font-bold text-[#2c2a29] font-mono break-all">{r.id}</p>
            </div>
            <div className="bg-[#faf9f6] rounded-xl px-3 py-2">
              <p className="text-[9px] font-bold uppercase tracking-wider text-[#7c756d] mb-0.5">Date</p>
              <p className="text-xs font-bold text-[#2c2a29]">{r.createdAt ? new Date(r.createdAt).toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric" }) : "—"}</p>
            </div>
          </div>
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-widest text-[#7c756d] mb-1.5">Full Comment</p>
            <p className="text-xs text-gray-700 leading-relaxed bg-[#faf9f6] rounded-xl p-3.5 border border-[#f0ede8] whitespace-pre-wrap break-words">"{r.comment}"</p>
          </div>
          <div className="flex gap-2">
            {r.status !== "approved" && (
              <button type="button" onClick={() => moderate("approve")}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-green-600 hover:bg-green-500 text-white rounded-xl text-xs font-bold cursor-pointer transition-colors">
                <Check size={12} /> Approve
              </button>
            )}
            {r.status !== "rejected" && (
              <button type="button" onClick={() => moderate("reject")}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold cursor-pointer transition-colors">
                <X size={12} /> Reject
              </button>
            )}
          </div>
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
