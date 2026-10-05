import React, { useState, useEffect, useMemo } from "react";
import {
  Calendar, Printer, Star, Upload, Check, AlertCircle,
  MapPin, Heart, Clock, Sparkles, CreditCard, X, Download,
  Image as ImageIcon, CalendarPlus, FileText, Layers, Truck,
  ChevronDown, ChevronUp, Eye, Scissors, CheckCircle2,
  RefreshCw, RotateCcw, Search, Filter, SlidersHorizontal,
  Camera, Package, BookOpen, Phone, User, Mail, ChevronRight,
  TrendingUp, AlertTriangle, Wallet, ArrowUpRight, BadgeCheck
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { generateBookingReceiptPDF, generatePrintOrderReceiptPDF } from "../utils/pdfGenerator";
import { getGoogleCalendarUrl, downloadIcsFile } from "../utils/calendarSync";
import { ClientGallery } from "../components/ClientGallery";
import GCashQRModal from "../components/GCashQRModal.tsx";
import RescheduleModal from "../components/RescheduleModal.tsx";
import BookingDetailsModal from "../components/BookingDetailsModal.tsx";
import SessionAlarmToast, { type AlarmSession } from "../components/SessionAlarmToast.tsx";
import { QrCode, Zap } from "lucide-react";
import { apiRequest, resolveApiUrl, ApiError } from "../utils/apiClient.ts";

interface CustomerDashboardProps {
  currentUser: any;
  bookings: any[];
  printOrders: any[];
  favorites: any[];
  studios: any[];
  printProducts?: any[];
  services?: any[];
  packages?: any[];
  initialSubTab?: "bookings" | "prints" | "favorites";
  onNavigate: (page: string, params?: any) => void;
  onUploadPayment: (bookingId: string, payload: any) => void;
  onCancelBooking: (bookingId: string, reason?: string) => void;
  onRescheduleBooking?: (bookingId: string, booking?: any, reason?: string, opts?: { pendingApproval?: boolean }) => void;
  onUploadRequirement: (bookingId: string, fileName: string, fileData: string) => void;
  onSubmitReview: (reviewPayload: any) => Promise<boolean> | boolean;
  onRemoveFavorite: (studioId: string) => void;
  onArchiveBooking?: (bookingId: string) => void;
  onDeleteBooking?: (bookingId: string) => void;
  onArchivePrintOrder?: (orderId: string) => void;
  onDeletePrintOrder?: (orderId: string) => void;
}

// ─── helpers ────────────────────────────────────────────────────────────────
const STATUS_META: Record<string, { label: string; bg: string; text: string; border: string }> = {
  Pending:         { label: "Pending",          bg: "bg-yellow-50",  text: "text-yellow-800", border: "border-yellow-200" },
  "Awaiting Payment": { label: "Awaiting Payment", bg: "bg-orange-50", text: "text-orange-700", border: "border-orange-200" },
  Confirmed:       { label: "Confirmed",         bg: "bg-blue-50",   text: "text-blue-700",   border: "border-blue-200" },
  Rescheduled:     { label: "Rescheduled",       bg: "bg-indigo-50", text: "text-indigo-700", border: "border-indigo-200" },
  Ongoing:         { label: "Ongoing",           bg: "bg-cyan-50",   text: "text-cyan-700",   border: "border-cyan-200" },
  Completed:       { label: "Completed",         bg: "bg-green-50",  text: "text-green-700",  border: "border-green-200" },
  Cancelled:       { label: "Cancelled",         bg: "bg-gray-100",  text: "text-gray-500",   border: "border-gray-200" },
  Rejected:        { label: "Rejected",          bg: "bg-rose-50",   text: "text-rose-700",   border: "border-rose-200" },
  Expired:         { label: "Expired",           bg: "bg-rose-50",   text: "text-rose-600",   border: "border-rose-200" },
  "No Show":       { label: "No Show",           bg: "bg-gray-100",  text: "text-gray-500",   border: "border-gray-200" },
  Refunded:        { label: "Refunded",          bg: "bg-purple-50", text: "text-purple-700", border: "border-purple-200" },
};

function StatusBadge({ status, paymentStatus }: { status: string; paymentStatus?: string }) {
  const isRefunded = paymentStatus === "Refunded";
  const key = isRefunded ? "Refunded" : status;
  const meta = STATUS_META[key] ?? STATUS_META.Cancelled;
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase tracking-wider ${meta.bg} ${meta.text} ${meta.border}`}>
      {isRefunded && <RotateCcw size={9} />}
      {isRefunded ? "Cancelled · Refunded" : meta.label}
    </span>
  );
}

function PaymentBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    "Unpaid":               "bg-gray-100 text-gray-500 border-gray-200",
    "Pending Verification": "bg-yellow-50 text-yellow-700 border-yellow-200",
    "Partially Paid":       "bg-orange-50 text-orange-700 border-orange-200",
    "Paid":                 "bg-green-50 text-green-700 border-green-200",
    "Refunded":             "bg-purple-50 text-purple-700 border-purple-200",
    "Failed":               "bg-rose-50 text-rose-700 border-rose-200",
  };
  return (
    <span className={`inline-flex items-center text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase tracking-wide ${map[status] ?? map.Unpaid}`}>
      {status}
    </span>
  );
}

// ─── component ──────────────────────────────────────────────────────────────
export default function CustomerDashboard({
  currentUser,
  bookings,
  printOrders,
  favorites,
  studios,
  printProducts = [],
  services = [],
  packages = [],
  initialSubTab = "bookings",
  onNavigate,
  onUploadPayment,
  onCancelBooking,
  onRescheduleBooking,
  onUploadRequirement,
  onSubmitReview,
  onRemoveFavorite,
  onArchiveBooking,
  onDeleteBooking,
  onArchivePrintOrder,
  onDeletePrintOrder,
}: CustomerDashboardProps) {

  const [activeSubTab, setActiveSubTab] = useState<"bookings" | "prints" | "favorites">(initialSubTab);
  useEffect(() => { setActiveSubTab(initialSubTab); }, [initialSubTab]);

  // ── filters ──────────────────────────────────────────────────────────────
  const [bookingSearch, setBookingSearch]           = useState("");
  const [bookingStatusFilter, setBookingStatusFilter] = useState("All");
  const [bookingPayFilter, setBookingPayFilter]     = useState("All");
  const [printSearch, setPrintSearch]               = useState("");
  const [printStatusFilter, setPrintStatusFilter]   = useState("All");
  const [favSearch, setFavSearch]                   = useState("");
  const [showBookingFilters, setShowBookingFilters] = useState(false);
  const [showArchivedBookings, setShowArchivedBookings] = useState(false);
  const [showArchivedPrints, setShowArchivedPrints] = useState(false);

  // ── expanded print order ─────────────────────────────────────────────────
  const [expandedOrderId, setExpandedOrderId]       = useState<string | null>(null);
  const [trackFrame, setTrackFrame]                 = useState<"oak" | "black" | "gold" | "frameless">("black");
  const [trackMatte, setTrackMatte]                 = useState<"glossy" | "matte">("glossy");

  // ── payment modals ────────────────────────────────────────────────────────
  const [payingBooking, setPayingBooking]           = useState<any | null>(null);
  const [payingPaymentType, setPayingPaymentType]   = useState<"Downpayment" | "Full Payment">("Downpayment");
  const [gcashQRTarget, setGcashQRTarget]           = useState<{
    bookingId?: string; printOrderId?: string; studioId: string; amount: number;
    paymentType: "Downpayment" | "Balance" | "Full Payment" | "PrintOrder";
    studioName: string; description?: string;
  } | null>(null);

  const [paymentMethod, setPaymentMethod]           = useState<"GCash" | "Maya">("GCash");

  const [refNo, setRefNo]                           = useState("");
  const [proofBase64, setProofBase64]               = useState("");

  // ── review modal ──────────────────────────────────────────────────────────
  const [reviewingBooking, setReviewingBooking]     = useState<any | null>(null);
  const [rating, setRating]                         = useState(5);
  const [reviewComment, setReviewComment]           = useState("");

  // ── misc modals ───────────────────────────────────────────────────────────
  const [proofingBookingId, setProofingBookingId]   = useState<string | null>(null);
  const [reschedulingBooking, setReschedulingBooking] = useState<any | null>(null);
  const [reqBookingId, setReqBookingId]             = useState<string | null>(null);

  // ── booking details view modal ────────────────────────────────────────────
  const [viewingBooking, setViewingBooking]         = useState<any | null>(null);

  // ── protected media ───────────────────────────────────────────────────────
  const [resolvedPrintMedia, setResolvedPrintMedia] = useState<Record<string, string>>({});

  const resolveProtectedMediaUrl = async (url: string): Promise<string> => {
    if (!url || !url.startsWith("/api/media/")) return url;
    if (!currentUser?.authToken) return url;
    const response = await fetch(resolveApiUrl(url), {
      headers: { Authorization: `Bearer ${currentUser.authToken}` }
    });
    if (!response.ok) return url;
    const blob = await response.blob();
    return URL.createObjectURL(blob);
  };

  useEffect(() => {
    let isCancelled = false;
    const blobUrls: string[] = [];
    const hydratePrintMedia = async () => {
      const nextMap: Record<string, string> = {};
      for (const order of printOrders) {
        const urls = [order.uploadedPhoto, order.proofOfPayment]
          .filter((v): v is string => !!v && v.startsWith("/api/media/"));
        for (const u of urls) {
          try {
            const resolved = await resolveProtectedMediaUrl(u);
            if (!isCancelled) {
              nextMap[u] = resolved;
              if (resolved.startsWith("blob:")) blobUrls.push(resolved);
            }
          } catch { if (!isCancelled) nextMap[u] = u; }
        }
      }
      if (!isCancelled) setResolvedPrintMedia(nextMap);
    };
    hydratePrintMedia();
    return () => {
      isCancelled = true;
      blobUrls.forEach(u => URL.revokeObjectURL(u));
    };
  }, [printOrders]);

  // ── file upload helper ────────────────────────────────────────────────────
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, type: string) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if ((type === "payment" || type === "print-payment") && (!file.type.startsWith("image/") || file.size > 9 * 1024 * 1024)) {
      alert("Please choose an image smaller than 9 MB."); return;
    }
    const reader = new FileReader();
    reader.onloadend = () => {
      if (type === "payment") setProofBase64(reader.result as string);
      else if (type === "requirement" && reqBookingId) {
        onUploadRequirement(reqBookingId, file.name, reader.result as string);
        setReqBookingId(null);
      }
    };
    reader.readAsDataURL(file);
  };

  // ── handlers ──────────────────────────────────────────────────────────────
  const handlePaymentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!payingBooking) return;

    const alreadyPaidDown = Number(payingBooking.amountPaid) > 0;
    const isFullFromScratch = payingPaymentType === "Full Payment" && !alreadyPaidDown;
    const isBalance = payingPaymentType === "Full Payment" && alreadyPaidDown;

    // Determine correct paymentType string and amount for the API
    const apiPaymentType: string = isBalance ? "Balance" : payingPaymentType;
    const apiAmount: number = isBalance
      ? (Number(payingBooking.remainingBalance) > 0 ? Number(payingBooking.remainingBalance) : Number(payingBooking.totalAmount))
      : isFullFromScratch
        ? Number(payingBooking.totalAmount)
        : (Number(payingBooking.downPaymentAmount) || Math.round(Number(payingBooking.totalAmount) * 0.3 * 100) / 100);

    if (!refNo.trim()) {
      alert("Please enter the reference number.");
      return;
    }
    if (!proofBase64) {
      alert("Please upload your receipt image.");
      return;
    }

    onUploadPayment(payingBooking.id, {
      amount: apiAmount,
      paymentMethod,
      referenceNumber: refNo,
      proofOfPayment: proofBase64,
      paymentType: apiPaymentType,
    });
    setPayingBooking(null); setRefNo(""); setProofBase64("");
  };

  const handleReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewingBooking) return;
    const ok = await onSubmitReview({
      bookingId: reviewingBooking.id, studioId: reviewingBooking.studioId,
      customerId: currentUser.id, customerName: currentUser.fullName,
      rating, comment: reviewComment,
    });
    if (ok) { setReviewingBooking(null); setRating(5); setReviewComment(""); }
  };



  // ── derived / filtered data ───────────────────────────────────────────────
  const filteredBookings = useMemo(() => {
    let list = [...bookings].filter(b => !b.isArchived);
    if (bookingSearch.trim()) {
      const q = bookingSearch.toLowerCase();
      list = list.filter(b =>
        b.id.toLowerCase().includes(q) ||
        (studios.find(s => s.id === b.studioId)?.name || "").toLowerCase().includes(q) ||
        b.bookingDate?.includes(q)
      );
    }
    if (bookingStatusFilter !== "All") list = list.filter(b => b.status === bookingStatusFilter);
    if (bookingPayFilter !== "All") list = list.filter(b => b.paymentStatus === bookingPayFilter);
    return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [bookings, bookingSearch, bookingStatusFilter, bookingPayFilter, studios]);

  const filteredPrints = useMemo(() => {
    let list = [...printOrders].filter(o => !o.isArchived);
    if (printSearch.trim()) {
      const q = printSearch.toLowerCase();
      list = list.filter(o =>
        o.id.toLowerCase().includes(q) ||
        (studios.find(s => s.id === o.studioId)?.name || "").toLowerCase().includes(q)
      );
    }
    if (printStatusFilter !== "All") list = list.filter(o => o.status === printStatusFilter);
    return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [printOrders, printSearch, printStatusFilter, studios]);

  const filteredFavorites = useMemo(() => {
    if (!favSearch.trim()) return favorites;
    const q = favSearch.toLowerCase();
    return favorites.filter(f => {
      const s = studios.find(st => st.id === f.studioId);
      return s && (s.name.toLowerCase().includes(q) || s.location?.toLowerCase().includes(q));
    });
  }, [favorites, favSearch, studios]);

  // ── stats ─────────────────────────────────────────────────────────────────
  const totalSpent = bookings.reduce((sum, b) => sum + Number(b.amountPaid || 0), 0);
  const confirmedCount = bookings.filter(b => b.status === "Confirmed").length;
  const pendingCount = bookings.filter(b => ["Pending", "Awaiting Payment"].includes(b.status)).length;
  const completedCount = bookings.filter(b => b.status === "Completed").length;

  // ── unique filter options ─────────────────────────────────────────────────
  const bookingStatuses = ["All", ...Array.from(new Set(bookings.map(b => b.status)))];
  const bookingPayStatuses = ["All", ...Array.from(new Set(bookings.map(b => b.paymentStatus)))];
  const printStatuses = ["All", ...Array.from(new Set(printOrders.map(o => o.status)))];

  // ── upcoming sessions (within 24 hours) ──────────────────────────────────
  const upcomingSessions = useMemo(() => {
    const now = new Date();
    const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    return bookings.filter(b => {
      // Include all non-cancelled/expired statuses — new bookings start as Awaiting Payment
      if (!['Confirmed', 'Rescheduled', 'Awaiting Payment', 'Pending'].includes(b.status)) return false;
      if (b.isArchived) return false;
      const tMatch = (b.timeSlot || '').match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
      if (!tMatch) return false;
      let h = parseInt(tMatch[1], 10);
      const m = parseInt(tMatch[2], 10);
      if (tMatch[3].toUpperCase() === 'PM' && h !== 12) h += 12;
      if (tMatch[3].toUpperCase() === 'AM' && h === 12) h = 0;
      const sessionStart = new Date(`${b.bookingDate}T00:00:00`);
      sessionStart.setHours(h, m, 0, 0);
      return sessionStart > now && sessionStart <= in24h;
    }).sort((a, b) => new Date(a.bookingDate + 'T' + a.timeSlot).getTime() - new Date(b.bookingDate + 'T' + b.timeSlot).getTime());
  }, [bookings]);

  // ── alarm sessions (within 2 hours — triggers sound + popup) ─────────────
  const alarmSessions = useMemo((): AlarmSession[] => {
    const now = new Date();
    const in2h = new Date(now.getTime() + 2 * 60 * 60 * 1000);
    return bookings
      .filter(b => {
        // Include all active statuses — new bookings start as Awaiting Payment
        if (!['Confirmed', 'Rescheduled', 'Awaiting Payment', 'Pending'].includes(b.status)) return false;
        if (b.isArchived) return false;
        const tMatch = (b.timeSlot || '').match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
        if (!tMatch) return false;
        let h = parseInt(tMatch[1], 10);
        const m = parseInt(tMatch[2], 10);
        if (tMatch[3].toUpperCase() === 'PM' && h !== 12) h += 12;
        if (tMatch[3].toUpperCase() === 'AM' && h === 12) h = 0;
        const sd = new Date(`${b.bookingDate}T00:00:00`);
        sd.setHours(h, m, 0, 0);
        return sd > now && sd <= in2h;
      })
      .map(b => {
        const tMatch = b.timeSlot.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i)!;
        let h = parseInt(tMatch[1], 10);
        const m = parseInt(tMatch[2], 10);
        if (tMatch[3].toUpperCase() === 'PM' && h !== 12) h += 12;
        if (tMatch[3].toUpperCase() === 'AM' && h === 12) h = 0;
        const sd = new Date(`${b.bookingDate}T00:00:00`);
        sd.setHours(h, m, 0, 0);
        const minutesLeft = Math.max(0, Math.round((sd.getTime() - now.getTime()) / 60000));
        const studio = studios.find(s => s.id === b.studioId);
        const service = services.find(sv => sv.id === b.serviceId);
        return {
          bookingId: b.id,
          serviceName: service?.name || 'Photography Session',
          studioName: studio?.name || 'Studio',
          timeSlot: b.timeSlot,
          bookingDate: b.bookingDate,
          minutesLeft,
        } satisfies AlarmSession;
      });
  }, [bookings, studios, services]);

  // ── print step helper ─────────────────────────────────────────────────────
  const getPrintStep = (status: string) => {
    const s = status.toLowerCase();
    if (s === "processing" || s === "accepted") return 2;
    if (s === "ready for pickup" || s === "quality check") return 3;
    if (s === "completed" || s === "delivered") return 4;
    return 1;
  };

  const tabs = [
    { id: "bookings" as const,  label: "My Bookings",    icon: <Calendar size={15} />,  count: bookings.length },
    { id: "prints" as const,    label: "Print Orders",   icon: <Printer size={15} />,   count: printOrders.length },
    { id: "favorites" as const, label: "Saved Studios",  icon: <Heart size={15} />,     count: favorites.length },
  ];

  return (
    <div className="min-h-screen bg-[#f5f3ef]">

      {/* ── SESSION ALARM POPUP + SOUND ──────────────────────────────── */}
      <SessionAlarmToast sessions={alarmSessions} />

      {/* ── PAGE HEADER ──────────────────────────────────────────────────── */}
      <div className="bg-white border-b border-[#e5e1da]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
          {/* Profile Row */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 text-white flex items-center justify-center font-black text-xl uppercase shadow-md shadow-amber-200/50 flex-shrink-0">
                {currentUser.fullName.charAt(0)}
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-widest text-amber-600 font-bold mb-0.5">Customer Portal</p>
                <h1 className="font-display text-xl sm:text-2xl font-black text-[#2c2a29] leading-none">{currentUser.fullName}</h1>
                <p className="text-xs text-[#7c756d] mt-0.5 flex items-center gap-3">
                  {currentUser.email && <span className="flex items-center gap-1"><Mail size={11} />{currentUser.email}</span>}
                  {currentUser.contactNumber && <span className="flex items-center gap-1"><Phone size={11} />{currentUser.contactNumber}</span>}
                </p>
              </div>
            </div>
            <button
              onClick={() => onNavigate("account-settings")}
              className="flex items-center gap-2 px-4 py-2 bg-[#f5f3ef] hover:bg-[#eee9e1] border border-[#e5e1da] rounded-xl text-xs font-bold text-[#2c2a29] transition-colors cursor-pointer"
            >
              <User size={13} /> Edit Profile
            </button>
          </div>

          {/* Stats Row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "Total Spent",     value: `₱${totalSpent.toLocaleString("en-PH", { minimumFractionDigits: 0 })}`, icon: <Wallet size={16} />,      color: "text-emerald-600", bg: "bg-emerald-50" },
              { label: "Confirmed",       value: confirmedCount,  icon: <BadgeCheck size={16} />,   color: "text-blue-600",    bg: "bg-blue-50" },
              { label: "Pending Action",  value: pendingCount,    icon: <AlertTriangle size={16} />, color: "text-amber-600",   bg: "bg-amber-50" },
              { label: "Completed",       value: completedCount,  icon: <CheckCircle2 size={16} />, color: "text-green-600",   bg: "bg-green-50" },
            ].map(stat => (
              <div key={stat.label} className="bg-[#faf9f6] border border-[#e5e1da] rounded-2xl p-3.5 flex items-center gap-3">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${stat.bg} ${stat.color}`}>
                  {stat.icon}
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] text-[#7c756d] font-semibold uppercase tracking-wider truncate">{stat.label}</p>
                  <p className={`text-lg font-black leading-none ${stat.color}`}>{stat.value}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── TAB BAR ─────────────────────────────────────────────────── */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-1 border-t border-[#e5e1da] overflow-x-auto scrollbar-hide">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveSubTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-3.5 text-xs font-bold whitespace-nowrap border-b-2 transition-all cursor-pointer ${
                  activeSubTab === tab.id
                    ? "border-amber-500 text-amber-600"
                    : "border-transparent text-[#7c756d] hover:text-[#2c2a29]"
                }`}
              >
                {tab.icon}
                {tab.label}
                <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full ${
                  activeSubTab === tab.id ? "bg-amber-100 text-amber-700" : "bg-gray-100 text-gray-500"
                }`}>{tab.count}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── MAIN CONTENT ──────────────────────────────────────────────── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 pb-24">

        {/* ════════════════════════════════════════════════════════════
            TAB A — MY BOOKINGS
        ════════════════════════════════════════════════════════════ */}
        {activeSubTab === "bookings" && (
          <div className="space-y-5">

            {/* ── Upcoming Session Alert Banner ──────────────────────────── */}
            {upcomingSessions.length > 0 && (
              <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-300 rounded-2xl p-4 space-y-3">
                <div className="flex items-center gap-2 mb-1">
                  <span className="w-7 h-7 rounded-lg bg-amber-500 text-white flex items-center justify-center flex-shrink-0">
                    <Clock size={14} />
                  </span>
                  <div>
                    <p className="text-xs font-black text-amber-800 uppercase tracking-wider">Upcoming Session{upcomingSessions.length > 1 ? 's' : ''} — Today!</p>
                    <p className="text-[10px] text-amber-700">You have {upcomingSessions.length} session{upcomingSessions.length > 1 ? 's' : ''} scheduled within the next 24 hours. Please be on time.</p>
                  </div>
                </div>
                {upcomingSessions.map(session => {
                  const studio = studios.find(s => s.id === session.studioId);
                  const service = services.find(sv => sv.id === session.serviceId);
                  const now = new Date();
                  const tM = (session.timeSlot || '').match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
                  let hoursUntil = 0;
                  if (tM) {
                    let h = parseInt(tM[1], 10);
                    const m = parseInt(tM[2], 10);
                    if (tM[3].toUpperCase() === 'PM' && h !== 12) h += 12;
                    if (tM[3].toUpperCase() === 'AM' && h === 12) h = 0;
                    const sd = new Date(`${session.bookingDate}T00:00:00`);
                    sd.setHours(h, m, 0, 0);
                    hoursUntil = Math.max(0, (sd.getTime() - now.getTime()) / 3600000);
                  }
                  const isUrgent = hoursUntil <= 2;
                  return (
                    <div key={session.id} className={`flex items-center justify-between gap-3 rounded-xl border px-3 py-2.5 ${
                      isUrgent ? 'bg-red-50 border-red-300' : 'bg-white border-amber-200'
                    }`}>
                      <div className="min-w-0">
                        <p className={`text-xs font-bold truncate ${isUrgent ? 'text-red-700' : 'text-amber-900'}`}>
                          {isUrgent ? '⏰ ' : '📸 '}{service?.name || 'Session'} — {studio?.name || 'Studio'}
                        </p>
                        <p className={`text-[10px] ${isUrgent ? 'text-red-600' : 'text-amber-700'}`}>
                          {session.timeSlot} · {hoursUntil < 1
                            ? `${Math.round(hoursUntil * 60)} min away`
                            : `${hoursUntil.toFixed(1)}h away`
                          }
                        </p>
                      </div>
                      <span className={`shrink-0 text-[10px] font-black px-2 py-0.5 rounded-full border ${
                        isUrgent
                          ? 'bg-red-100 text-red-700 border-red-200 animate-pulse'
                          : 'bg-amber-100 text-amber-700 border-amber-200'
                      }`}>
                        {isUrgent ? 'NOW SOON' : 'TODAY'}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Search + Filter Bar */}
            <div className="bg-white rounded-2xl border border-[#e5e1da] p-4 space-y-3">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                {/* Search */}
                <div className="relative flex-1">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                  <input
                    value={bookingSearch}
                    onChange={e => setBookingSearch(e.target.value)}
                    placeholder="Search by booking ID, studio name, or date…"
                    className="w-full pl-9 pr-4 py-2.5 text-xs border border-[#e5e1da] rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-300 bg-[#faf9f6]"
                  />
                </div>
                {/* Filter toggle */}
                <button
                  onClick={() => setShowBookingFilters(v => !v)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-xs font-bold cursor-pointer transition-colors ${showBookingFilters ? "bg-amber-500 border-amber-500 text-white" : "bg-white border-[#e5e1da] text-[#2c2a29] hover:bg-gray-50"}`}
                >
                  <SlidersHorizontal size={13} />
                  Filters
                  {(bookingStatusFilter !== "All" || bookingPayFilter !== "All") && (
                    <span className="w-4 h-4 rounded-full bg-white text-amber-600 text-[9px] font-black flex items-center justify-center">
                      {(bookingStatusFilter !== "All" ? 1 : 0) + (bookingPayFilter !== "All" ? 1 : 0)}
                    </span>
                  )}
                </button>
              </div>

              {/* Expandable filter chips */}
              <AnimatePresence>
                {showBookingFilters && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="pt-2 border-t border-gray-100 grid sm:grid-cols-2 gap-4">
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-[#7c756d] mb-2">Booking Status</p>
                        <div className="flex flex-wrap gap-1.5">
                          {bookingStatuses.map(s => (
                            <button
                              key={s}
                              onClick={() => setBookingStatusFilter(s)}
                              className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border cursor-pointer transition-all ${
                                bookingStatusFilter === s
                                  ? "bg-amber-500 border-amber-500 text-white"
                                  : "bg-white border-[#e5e1da] text-[#7c756d] hover:border-amber-300"
                              }`}
                            >{s}</button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-[#7c756d] mb-2">Payment Status</p>
                        <div className="flex flex-wrap gap-1.5">
                          {bookingPayStatuses.map(s => (
                            <button
                              key={s}
                              onClick={() => setBookingPayFilter(s)}
                              className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border cursor-pointer transition-all ${
                                bookingPayFilter === s
                                  ? "bg-amber-500 border-amber-500 text-white"
                                  : "bg-white border-[#e5e1da] text-[#7c756d] hover:border-amber-300"
                              }`}
                            >{s}</button>
                          ))}
                        </div>
                      </div>
                    </div>
                    {(bookingStatusFilter !== "All" || bookingPayFilter !== "All" || bookingSearch) && (
                      <button
                        onClick={() => { setBookingStatusFilter("All"); setBookingPayFilter("All"); setBookingSearch(""); }}
                        className="mt-3 text-[10px] font-bold text-rose-600 hover:text-rose-700 cursor-pointer flex items-center gap-1"
                      >
                        <X size={11} /> Clear all filters
                      </button>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Results count */}
            <div className="flex items-center justify-between">
              <p className="text-xs text-[#7c756d] font-medium">
                Showing <strong className="text-[#2c2a29]">{filteredBookings.length}</strong> of {bookings.length} booking{bookings.length !== 1 ? "s" : ""}
              </p>
              {filteredBookings.length !== bookings.length && (
                <button onClick={() => { setBookingStatusFilter("All"); setBookingPayFilter("All"); setBookingSearch(""); }} className="text-[10px] text-amber-600 font-bold hover:underline cursor-pointer">Show all</button>
              )}
            </div>

            {/* Booking cards */}
            {filteredBookings.length === 0 ? (
              <div className="bg-white rounded-2xl border border-[#e5e1da] py-16 text-center space-y-3">
                <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto">
                  <Calendar size={24} className="text-gray-300" />
                </div>
                <p className="text-sm font-bold text-[#2c2a29]">No bookings found</p>
                <p className="text-xs text-[#7c756d]">{bookings.length === 0 ? "Discover Cainta studios and book your first session!" : "Try adjusting your search or filters."}</p>
                {bookings.length === 0 && (
                  <button onClick={() => onNavigate("directory")} className="inline-flex items-center gap-1.5 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-white text-xs font-bold rounded-xl cursor-pointer mt-1">
                    <Camera size={13} /> Explore Studios
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                {filteredBookings.map((bk) => {
                  const studioObj = studios.find(s => s.id === bk.studioId);
                  const isRefunded = bk.paymentStatus === "Refunded";
                  return (
                    <motion.div
                      key={bk.id}
                      layout
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-white rounded-2xl border border-[#e5e1da] overflow-hidden hover:shadow-md transition-shadow"
                    >
                      {/* Status accent bar */}
                      <div className={`h-1 w-full ${
                        bk.status === "Completed" ? "bg-green-500" :
                        bk.status === "Confirmed" ? "bg-blue-500" :
                        bk.status === "Pending" || bk.status === "Awaiting Payment" ? "bg-yellow-400" :
                        isRefunded ? "bg-purple-400" :
                        bk.status === "Cancelled" || bk.status === "Rejected" ? "bg-red-300" :
                        "bg-gray-200"
                      }`} />

                      <div className="p-4 sm:p-5">
                        {/* Top row — ID, badges, studio cover */}
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex items-start gap-3 min-w-0">
                            {/* Studio thumbnail */}
                            {studioObj?.coverImage ? (
                              <img
                                src={studioObj.coverImage}
                                alt={studioObj.name}
                                className="w-12 h-12 rounded-xl object-cover border border-gray-100 flex-shrink-0"
                              />
                            ) : (
                              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-100 to-amber-200 flex items-center justify-center flex-shrink-0">
                                <Camera size={18} className="text-amber-500" />
                              </div>
                            )}
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-1.5 mb-1">
                                <span className="text-[10px] bg-[#2c2a29] text-white px-2 py-0.5 rounded font-bold tracking-wider">{bk.id}</span>
                                <StatusBadge status={bk.status} paymentStatus={bk.paymentStatus} />
                                <PaymentBadge status={bk.paymentStatus} />
                              </div>
                              <h4 className="font-display font-bold text-[#2c2a29] text-sm sm:text-base leading-tight truncate">
                                {studioObj?.name || "Photography Studio"}
                              </h4>
                              {studioObj?.location && (
                                <p className="text-[10px] text-[#7c756d] flex items-center gap-1 mt-0.5">
                                  <MapPin size={9} />{studioObj.location}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Info grid */}
                        <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2">
                          {[
                            { label: "Date",    value: bk.bookingDate },
                            { label: "Time",    value: bk.timeSlot },
                            { label: "Total",   value: `₱${Number(bk.totalAmount).toLocaleString()}` },
                            { label: "Paid",    value: `₱${Number(bk.amountPaid || 0).toLocaleString()}`, highlight: "text-emerald-700" },
                          ].map(item => (
                            <div key={item.label} className="bg-[#faf9f6] rounded-xl px-3 py-2">
                              <p className="text-[9px] font-bold uppercase tracking-wider text-[#7c756d]">{item.label}</p>
                              <p className={`text-xs font-bold ${item.highlight || "text-[#2c2a29]"}`}>{item.value}</p>
                            </div>
                          ))}
                        </div>

                        {/* Pending payment amount */}
                        {(bk.pendingPaymentAmount || 0) > 0 && (
                          <div className="mt-2 flex items-center gap-2 bg-yellow-50 border border-yellow-200 rounded-xl px-3 py-2">
                            <Clock size={12} className="text-yellow-600 flex-shrink-0" />
                            <p className="text-[10px] font-bold text-yellow-700">
                              ₱{Number(bk.pendingPaymentAmount).toLocaleString()} submitted — awaiting studio verification
                            </p>
                          </div>
                        )}

                        {/* Balance */}
                        {(bk.remainingBalance ?? Math.max(0, bk.totalAmount - (bk.amountPaid || 0))) > 0 && !isRefunded && bk.status !== "Cancelled" && (
                          <div className="mt-2 flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
                            <Wallet size={12} className="text-amber-600 flex-shrink-0" />
                            <p className="text-[10px] font-bold text-amber-700">
                              Balance due: ₱{Number(bk.remainingBalance ?? Math.max(0, bk.totalAmount - (bk.amountPaid || 0))).toLocaleString()}
                            </p>
                          </div>
                        )}

                        {/* Refund banner */}
                        {isRefunded && (
                          <div className="mt-3 bg-purple-50 border border-purple-200 rounded-xl px-3 py-2.5 space-y-1">
                            <p className="text-[10px] font-bold text-purple-700 flex items-center gap-1.5">
                              <RotateCcw size={11} /> Refund Processed
                            </p>
                            {(bk as any).refundAmount != null && (
                              <p className="text-[10px] text-purple-800">Amount: <strong>₱{Number((bk as any).refundAmount).toLocaleString("en-PH", { minimumFractionDigits: 2 })}</strong></p>
                            )}
                            {(bk as any).refundedAt && (
                              <p className="text-[10px] text-purple-700">Date: <strong>{new Date((bk as any).refundedAt).toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric" })}</strong></p>
                            )}
                            {(bk as any).refundReason && (
                              <p className="text-[10px] text-purple-700">Reason: <strong>{(bk as any).refundReason}</strong></p>
                            )}
                            <p className="text-[9px] text-purple-500 italic">Please allow 3–7 business days for the refund to reflect in your account.</p>
                          </div>
                        )}

                        {/* Requirement upload */}
                        <div className="mt-3">
                          {bk.requirementsDoc ? (
                            <p className="text-[10px] text-green-600 font-bold flex items-center gap-1">
                              <Check size={11} /> Requirement submitted: {bk.requirementsDoc}
                            </p>
                          ) : (
                            <div className="relative inline-block">
                              <input type="file" onChange={(e) => { setReqBookingId(bk.id); handleFileUpload(e, "requirement"); }} className="absolute inset-0 opacity-0 cursor-pointer" />
                              <button className="text-[10px] text-blue-600 hover:text-blue-800 font-bold flex items-center gap-1 cursor-pointer">
                                <Upload size={11} /> Upload requirements (dress, theme docs)
                              </button>
                            </div>
                          )}
                        </div>

                        {/* Pending reschedule status — shows which schedule is authoritative */}
                        {bk.rescheduleRequest && bk.rescheduleRequest.status === "pending" && (
                          <div className="mt-3 bg-indigo-50 border border-indigo-200 rounded-xl px-3 py-2.5 space-y-1">
                            <p className="text-[10px] font-bold text-indigo-700">⏳ Reschedule requested — awaiting studio approval</p>
                            <p className="text-[10px] text-indigo-800">
                              Current schedule stays <strong>{bk.bookingDate} at {bk.timeSlot}</strong> until approved.
                              Requested: <strong>{bk.rescheduleRequest.requestedDate} at {bk.rescheduleRequest.requestedTimeSlot}</strong>
                            </p>
                          </div>
                        )}

                        {/* Rescheduled banner — new date confirmed by studio */}
                        {bk.status === "Rescheduled" && !(bk.rescheduleRequest?.status === "pending") && (
                          <div className="mt-3 bg-indigo-50 border border-indigo-200 rounded-xl px-3 py-2.5 space-y-1">
                            <p className="text-[10px] font-bold text-indigo-700">📅 Booking Rescheduled</p>
                            <p className="text-[10px] text-indigo-800">
                              Your shoot has been moved to <strong>{bk.bookingDate} at {bk.timeSlot}</strong>.
                              {(bk as any).rescheduleReason && <span> Reason: "{(bk as any).rescheduleReason}"</span>}
                            </p>
                            <p className="text-[9px] text-indigo-600">The studio will confirm and start your session on the new date.</p>
                          </div>
                        )}

                        {/* Ongoing session banner */}
                        {bk.status === "Ongoing" && (
                          <div className="mt-3 bg-cyan-50 border border-cyan-200 rounded-xl px-3 py-2.5 flex items-center gap-2">
                            <span className="text-base">📸</span>
                            <div>
                              <p className="text-[10px] font-bold text-cyan-700">Session In Progress</p>
                              <p className="text-[9px] text-cyan-600">Your shoot is currently ongoing. Hang tight — photos will be available soon!</p>
                            </div>
                          </div>
                        )}

                        {/* Divider + Action buttons */}
                        <div className="mt-4 pt-3 border-t border-gray-100 flex flex-wrap items-center gap-2">

                          {/* View Details */}
                          <button
                            type="button"
                            onClick={() => setViewingBooking(bk)}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#faf9f6] hover:bg-gray-100 text-[#2c2a29] border border-[#e5e1da] text-[11px] font-bold rounded-lg cursor-pointer">
                            <Eye size={11} /> View Details
                          </button>

                          {/* Pay via GCash QR */}
                          {(bk.paymentStatus === "Unpaid" || bk.paymentStatus === "Failed") && bk.status !== "Cancelled" && bk.status !== "Expired" && (
                            <>
                              {bk.paymentOption === "Full Payment" ? (
                                <button type="button" onClick={() => setGcashQRTarget({ bookingId: bk.id, studioId: bk.studioId, amount: bk.totalAmount, paymentType: "Full Payment", studioName: studioObj?.name || "Studio", description: `Full Payment for Booking #${bk.id}` })}
                                  className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 text-white text-[11px] font-bold rounded-lg shadow-sm cursor-pointer">
                                  <Zap size={11} className="fill-current text-yellow-300" /> Pay Full (₱{Number(bk.totalAmount).toLocaleString()})
                                </button>
                              ) : (
                                <>
                                  <button type="button" onClick={() => setGcashQRTarget({ bookingId: bk.id, studioId: bk.studioId, amount: bk.downPaymentAmount || Math.round(bk.totalAmount * 0.3 * 100) / 100, paymentType: "Downpayment", studioName: studioObj?.name || "Studio", description: `Downpayment for Booking #${bk.id}` })}
                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 text-white text-[11px] font-bold rounded-lg shadow-sm cursor-pointer">
                                    <Zap size={11} className="fill-current text-yellow-300" /> Downpayment (₱{(bk.downPaymentAmount || Math.round(bk.totalAmount * 0.3 * 100) / 100).toLocaleString()})
                                  </button>
                                  <button type="button" onClick={() => setGcashQRTarget({ bookingId: bk.id, studioId: bk.studioId, amount: bk.totalAmount, paymentType: "Full Payment", studioName: studioObj?.name || "Studio", description: `Full Payment for Booking #${bk.id}` })}
                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-[11px] font-bold rounded-lg shadow-sm cursor-pointer">
                                    <Zap size={11} className="fill-current text-yellow-300" /> Full Payment (₱{Number(bk.totalAmount).toLocaleString()})
                                  </button>
                                </>
                              )}
                              <button type="button" onClick={() => { setPayingBooking(bk); setPayingPaymentType(bk.paymentOption === "Full Payment" ? "Full Payment" : "Downpayment"); setRefNo(""); setProofBase64(""); }}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-gray-50 border border-gray-200 text-gray-700 text-[11px] font-semibold rounded-lg cursor-pointer">
                                <Upload size={11} /> Manual Receipt
                              </button>
                            </>
                          )}

                          {/* Pay balance — available while shoot is not yet fully paid, up through Ongoing */}
                          {["Confirmed", "Rescheduled", "Ongoing"].includes(bk.status) && (bk.remainingBalance || 0) > 0 && bk.finalPaymentStatus !== "Paid" && (
                            <button type="button" onClick={() => setGcashQRTarget({ bookingId: bk.id, studioId: bk.studioId, amount: bk.remainingBalance, paymentType: "Balance", studioName: studioObj?.name || "Studio", description: `Final Balance for Booking #${bk.id}` })}
                              className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-white text-[11px] font-bold rounded-lg cursor-pointer">
                              <Zap size={11} className="fill-current text-yellow-200" /> Pay Balance (₱{bk.remainingBalance})
                            </button>
                          )}

                          {/* Pending verification label */}
                          {bk.paymentStatus === "Pending Verification" && (
                            <span className="flex items-center gap-1 text-[10px] text-yellow-600 font-bold bg-yellow-50 border border-yellow-200 rounded-lg px-2.5 py-1">
                              <Clock size={11} /> Pending Verification
                            </span>
                          )}

                          {/* Reschedule — not available once session is Ongoing or past */}
                          {["Confirmed", "Rescheduled", "Pending", "Awaiting Payment"].includes(bk.status) && (
                            <button type="button" onClick={() => setReschedulingBooking(bk)}
                              className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-[11px] font-bold rounded-lg cursor-pointer">
                              <RefreshCw size={11} /> Reschedule
                            </button>
                          )}
                          {isRefunded && (
                            <span className="flex items-center gap-1 text-[10px] text-purple-700 font-bold bg-purple-50 border border-purple-200 rounded-lg px-2.5 py-1">
                              <RotateCcw size={11} /> Refund Processed
                            </span>
                          )}

                          {/* Expired — show Resume button for unpaid expiry, otherwise static label */}
                          {bk.status === "Expired" && (
                            (bk.amountPaid || 0) === 0 ? (
                              <button type="button"
                                onClick={async () => {
                                  if (!window.confirm("Resume payment for this booking? Your original time slot will be re-reserved for 24 hours.")) return;
                                  try {
                                    const data = await apiRequest(`/api/bookings/${bk.id}/resume-payment`, { method: "PUT" });
                                    if (data.success) {
                                      // Open payment modal immediately with resumed booking data
                                      const resumed = data.booking;
                                      setGcashQRTarget({
                                        bookingId: resumed.id,
                                        studioId: resumed.studioId,
                                        amount: resumed.paymentOption === "Full Payment" ? resumed.totalAmount : (resumed.downPaymentAmount || Math.round(resumed.totalAmount * 0.3 * 100) / 100),
                                        paymentType: resumed.paymentOption === "Full Payment" ? "Full Payment" : "Downpayment",
                                        studioName: studioObj?.name || "Studio",
                                        description: `${resumed.paymentOption === "Full Payment" ? "Full Payment" : "Downpayment"} for Booking #${resumed.id}`
                                      });
                                      // Trigger a page data refresh so status updates everywhere
                                      window.location.reload();
                                    }
                                  } catch (err: any) {
                                    alert(err.message || "Unable to resume payment. The time slot may have been taken — please rebook.");
                                  }
                                }}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-white text-[11px] font-bold rounded-lg shadow-sm cursor-pointer">
                                <Zap size={11} className="fill-current" /> Resume Payment
                              </button>
                            ) : (
                              <span className="flex items-center gap-1 text-[10px] text-rose-600 font-bold">
                                <AlertCircle size={11} /> Hold Expired
                              </span>
                            )
                          )}

                          {/* PDF receipt */}
                          {bk.finalPaymentStatus === "Paid" && (
                            <button onClick={() => generateBookingReceiptPDF(bk, studioObj)}
                              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 text-[11px] font-bold rounded-lg cursor-pointer">
                              <Download size={11} /> Receipt PDF
                            </button>
                          )}

                          {/* Calendar sync — only while booking is upcoming/active */}
                          {!["Cancelled", "Completed", "Rejected", "Expired", "No Show"].includes(bk.status) && (
                            <>
                              <a href={getGoogleCalendarUrl({ title: `Photoshoot @ ${studioObj?.name || "Cainta Studio"}`, description: `Booking #${bk.id}`, location: studioObj?.address || "Cainta, Rizal", startDate: bk.bookingDate, timeSlot: bk.timeSlot })}
                                target="_blank" rel="noopener noreferrer"
                                className="flex items-center gap-1.5 px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-[10px] font-bold rounded-lg">
                                <CalendarPlus size={11} /> Google Cal
                              </a>
                              <button onClick={() => downloadIcsFile({ title: `Photoshoot @ ${studioObj?.name || "Cainta Studio"}`, description: `Booking #${bk.id}`, location: studioObj?.address || "Cainta, Rizal", startDate: bk.bookingDate, timeSlot: bk.timeSlot })}
                                className="px-2.5 py-1.5 bg-gray-50 hover:bg-gray-100 text-gray-700 border border-gray-200 text-[10px] font-bold rounded-lg cursor-pointer">
                                .iCal
                              </button>
                            </>
                          )}

                          {/* Photo proofs */}
                          <button onClick={() => setProofingBookingId(bk.id)}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-300 text-[11px] font-bold rounded-lg cursor-pointer">
                            <ImageIcon size={11} /> Photo Proofs
                          </button>

                          {/* Review */}
                          {bk.status === "Completed" && (
                            <button onClick={() => setReviewingBooking(bk)}
                              className="flex items-center gap-1.5 px-3 py-1.5 bg-yellow-400 hover:bg-yellow-300 text-black text-[11px] font-bold rounded-lg cursor-pointer">
                              <Star size={11} className="fill-current" /> Review Studio
                            </button>
                          )}

                          {/* Archive — terminal bookings only */}
                          {["Completed", "Cancelled", "Rejected", "Expired", "No Show"].includes(bk.status) && onArchiveBooking && (
                            <button
                              onClick={() => { if (window.confirm("Archive this booking? It will be moved to your archive and hidden from the main list.")) onArchiveBooking(bk.id); }}
                              className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 text-[10px] font-bold rounded-lg cursor-pointer">
                              📦 Archive
                            </button>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}

            {/* ── Archived bookings accordion ─────────────────────────── */}
            {bookings.filter(b => b.isArchived).length > 0 && (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 overflow-hidden mt-4">
                <button type="button"
                  onClick={() => setShowArchivedBookings(v => !v)}
                  className="w-full flex items-center justify-between px-5 py-3.5 cursor-pointer hover:bg-amber-100 transition-colors">
                  <div className="flex items-center gap-2">
                    <span className="text-sm">📦</span>
                    <span className="text-xs font-bold text-amber-800">
                      Archived Bookings ({bookings.filter(b => b.isArchived).length})
                    </span>
                  </div>
                  <span className="text-[10px] font-bold text-amber-700">{showArchivedBookings ? "▲ Hide" : "▼ Show"}</span>
                </button>
                {showArchivedBookings && (
                  <div className="border-t border-amber-200 overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="bg-amber-100 text-amber-900 text-[9px] uppercase tracking-wider">
                          <th className="py-2.5 px-4">Booking ID</th>
                          <th className="py-2.5 px-3">Studio</th>
                          <th className="py-2.5 px-3">Date</th>
                          <th className="py-2.5 px-3">Status</th>
                          <th className="py-2.5 px-3">Archived On</th>
                          <th className="py-2.5 px-3">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-amber-100">
                        {bookings.filter(b => b.isArchived).map(b => {
                          const sObj = studios.find(s => s.id === b.studioId);
                          return (
                            <tr key={b.id} className="bg-white/60 hover:bg-amber-50 transition-colors">
                              <td className="py-2.5 px-4 font-mono text-[10px] font-bold text-[#2c2a29]">{b.id}</td>
                              <td className="py-2.5 px-3 text-[10px] text-[#7c756d]">{sObj?.name || "—"}</td>
                              <td className="py-2.5 px-3 text-[10px] text-[#7c756d]">{b.bookingDate}</td>
                              <td className="py-2.5 px-3">
                                <span className="inline-flex px-2 py-0.5 rounded-full text-[9px] font-bold border bg-gray-100 text-gray-600 border-gray-200 uppercase">{b.status}</span>
                              </td>
                              <td className="py-2.5 px-3 text-[10px] text-[#7c756d]">
                                {b.archivedAt ? new Date(b.archivedAt).toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" }) : "—"}
                              </td>
                              <td className="py-2.5 px-3">
                                <div className="flex gap-1.5 flex-wrap">
                                  {onArchiveBooking && (
                                    <button type="button"
                                      onClick={() => { if (window.confirm("Restore this booking from the archive?")) apiRequest(`/api/bookings/${b.id}/unarchive`, { method: "PUT" }).then(() => window.location.reload()).catch((err: any) => alert(err.message || "Unable to restore.")); }}
                                      className="flex items-center gap-0.5 px-2 py-1 bg-green-50 hover:bg-green-100 text-green-700 border border-green-200 text-[9px] font-bold rounded-lg cursor-pointer">
                                      ↩ Restore
                                    </button>
                                  )}
                                  {onDeleteBooking && (
                                    <button type="button"
                                      onClick={() => { if (window.confirm(`PERMANENTLY DELETE booking ${b.id}? This cannot be undone.`)) onDeleteBooking(b.id); }}
                                      className="flex items-center gap-0.5 px-2 py-1 bg-rose-600 hover:bg-rose-500 text-white text-[9px] font-bold rounded-lg cursor-pointer">
                                      🗑 Delete
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════
            TAB B — PRINT ORDERS
        ════════════════════════════════════════════════════════════ */}
        {activeSubTab === "prints" && (
          <div className="space-y-5">

            {/* Search + Filter */}
            <div className="bg-white rounded-2xl border border-[#e5e1da] p-4 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <div className="relative flex-1">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                <input
                  value={printSearch}
                  onChange={e => setPrintSearch(e.target.value)}
                  placeholder="Search print orders by ID or studio…"
                  className="w-full pl-9 pr-4 py-2.5 text-xs border border-[#e5e1da] rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-300 bg-[#faf9f6]"
                />
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {printStatuses.map(s => (
                  <button key={s} onClick={() => setPrintStatusFilter(s)}
                    className={`px-3 py-1.5 rounded-xl text-[10px] font-bold border cursor-pointer transition-all ${
                      printStatusFilter === s ? "bg-amber-500 border-amber-500 text-white" : "bg-white border-[#e5e1da] text-[#7c756d] hover:border-amber-300"
                    }`}>{s}</button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between">
              <p className="text-xs text-[#7c756d] font-medium">
                Showing <strong className="text-[#2c2a29]">{filteredPrints.length}</strong> of {printOrders.length} order{printOrders.length !== 1 ? "s" : ""}
              </p>
            </div>

            {filteredPrints.length === 0 ? (
              <div className="bg-white rounded-2xl border border-[#e5e1da] py-16 text-center space-y-3">
                <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto">
                  <Printer size={24} className="text-gray-300" />
                </div>
                <p className="text-sm font-bold text-[#2c2a29]">No print orders found</p>
                <p className="text-xs text-[#7c756d]">{printOrders.length === 0 ? "Order custom canvas prints and frames from Cainta studios!" : "Try adjusting your search."}</p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredPrints.map((ord) => {
                  const sObj = studios.find(s => s.id === ord.studioId);
                  const isExpanded = expandedOrderId === ord.id;
                  const currentStep = getPrintStep(ord.status || "Pending");
                  const percent = [0, 25, 50, 75, 100][currentStep] ?? 25;
                  const estCompletionDate = new Date(new Date(ord.createdAt).getTime() + 24 * 60 * 60 * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

                  return (
                    <div key={ord.id} className={`bg-white rounded-2xl border overflow-hidden transition-all ${isExpanded ? "border-[#2c2a29] shadow-md" : "border-[#e5e1da] hover:shadow-sm"}`}>

                      {/* Progress bar */}
                      <div className="h-1.5 bg-gray-100 relative">
                        <div className="h-full bg-gradient-to-r from-amber-400 to-emerald-500 transition-all duration-700" style={{ width: `${percent}%` }} />
                      </div>

                      {/* Summary row */}
                      <div className="p-4 sm:p-5 cursor-pointer" onClick={() => setExpandedOrderId(isExpanded ? null : ord.id)}>
                        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                          {/* Thumb */}
                          <div className="relative flex-shrink-0">
                            <img src={resolvedPrintMedia[ord.uploadedPhoto] || ord.uploadedPhoto} alt="print" className="w-16 h-16 rounded-xl object-cover border border-gray-200 shadow-sm" />
                            <div className="absolute -bottom-1.5 -right-1.5 w-5 h-5 rounded-full bg-white border border-gray-200 flex items-center justify-center shadow-sm">
                              <Printer size={10} className="text-gray-500" />
                            </div>
                          </div>

                          {/* Info */}
                          <div className="flex-1 min-w-0 space-y-1.5">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="text-[10px] bg-[#2c2a29] text-white px-2 py-0.5 rounded font-bold">{ord.id}</span>
                              <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border uppercase tracking-wider ${
                                currentStep === 4 ? "bg-green-50 text-green-700 border-green-200" :
                                currentStep === 3 ? "bg-amber-50 text-amber-700 border-amber-200" :
                                currentStep === 2 ? "bg-blue-50 text-blue-700 border-blue-200" :
                                "bg-gray-100 text-gray-500 border-gray-200"
                              }`}>{ord.status || "Pending"}</span>
                              <PaymentBadge status={ord.paymentStatus} />
                            </div>
                            <h4 className="font-display font-bold text-sm text-[#2c2a29]">{sObj?.name || "Printing Studio"}</h4>
                            <p className="text-[11px] text-[#7c756d] flex flex-wrap items-center gap-x-3">
                              <span>Copies: <strong className="text-[#2c2a29]">{ord.quantity}</strong></span>
                              <span>•</span>
                              <span>Total: <strong className="text-[#2c2a29]">₱{Number(ord.totalAmount).toLocaleString()}</strong></span>
                              <span>•</span>
                              <span>Studio Pickup</span>
                            </p>
                          </div>

                          {/* Right: dispatch + toggle */}
                          <div className="flex sm:flex-col items-center sm:items-end gap-3 ml-auto flex-shrink-0">
                            <div className="text-right">
                              <p className="text-[9px] text-[#7c756d] font-bold uppercase">Est. Dispatch</p>
                              <p className="text-xs font-bold text-[#2c2a29]">{estCompletionDate}</p>
                            </div>
                            {/* Milestone dots */}
                            <div className="flex items-center gap-1">
                              {[1, 2, 3, 4].map(step => (
                                <div key={step} className={`w-2 h-2 rounded-full transition-colors ${currentStep >= step ? "bg-amber-500" : "bg-gray-200"}`} />
                              ))}
                            </div>
                            <div className="p-1.5 rounded-full bg-gray-100 hover:bg-gray-200 text-[#2c2a29]">
                              {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                            </div>
                          </div>
                        </div>

                        {/* Ready for Pickup callout */}
                        {ord.status === "Ready for Pickup" && ord.paymentStatus !== "Paid" && (
                          <div className="mt-3 p-3 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl text-xs flex items-center gap-2.5">
                            <span className="text-base">🏪</span>
                            <div>
                              <p className="font-bold text-emerald-900">Ready for Studio Pickup!</p>
                              <p className="text-[11px] text-emerald-700">Please visit the studio counter to pick up your printed photos and pay <strong>₱{Number(ord.totalAmount).toLocaleString()}</strong> in cash.</p>
                            </div>
                          </div>
                        )}

                        {/* Action buttons row */}
                        <div className="mt-3 pt-3 border-t border-gray-100 flex flex-wrap items-center gap-2" onClick={e => e.stopPropagation()}>
                          {ord.status !== "Cancelled" && ord.status !== "Completed" && (
                            <button onClick={() => { if (window.confirm("Cancel this print order?")) { apiRequest(`/api/print-orders/${ord.id}/cancel`, { method: "PUT", body: { reason: "Customer requested cancellation" } }).then(() => window.location.reload()).catch((err: any) => alert(err.message || "Unable to cancel.")); } }}
                              className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-[10px] font-bold rounded-lg cursor-pointer">
                              <X size={11} /> Cancel Order
                            </button>
                          )}
                          {ord.paymentStatus !== "Paid" ? (
                            <span className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 border border-amber-200 text-amber-700 text-[10px] font-semibold rounded-lg">
                              💵 Pay cash at studio counter on pickup
                            </span>
                          ) : (
                            <span className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 border border-emerald-200 text-emerald-800 text-[10px] font-bold rounded-lg">
                              ✓ Paid in Cash at Counter
                            </span>
                          )}
                          <button onClick={() => { const product = printProducts.find(p => p.id === ord.productId); generatePrintOrderReceiptPDF(ord, sObj, product); }}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-[10px] font-bold rounded-lg cursor-pointer">
                            <Download size={11} /> Receipt PDF
                          </button>

                          {/* Archive — terminal orders only */}
                          {["Completed", "Cancelled"].includes(ord.status) && onArchivePrintOrder && (
                            <button
                              onClick={() => { if (window.confirm("Archive this print order? It will be moved to your archive.")) onArchivePrintOrder(ord.id); }}
                              className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 text-[10px] font-bold rounded-lg cursor-pointer">
                              📦 Archive
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Expanded — timeline + mockup */}
                      <AnimatePresence>
                        {isExpanded && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.3 }}
                            className="overflow-hidden"
                          >
                            <div className="border-t border-gray-100 bg-[#faf9f6]/50 p-4 sm:p-6 grid lg:grid-cols-12 gap-6">
                              {/* Timeline */}
                              <div className="lg:col-span-7 space-y-5">
                                <h5 className="text-xs font-bold uppercase text-[#7c756d] tracking-wider flex items-center gap-1.5">
                                  <Layers size={13} className="text-[#2c2a29]" /> Live Production Timeline
                                </h5>
                                {/* Stepper */}
                                <div className="grid grid-cols-4 gap-2 relative">
                                  <div className="absolute top-4 left-[12.5%] right-[12.5%] h-0.5 bg-gray-200 z-0">
                                    <div className="h-full bg-amber-400 transition-all duration-700" style={{ width: `${Math.min(100, (currentStep - 1) / 3 * 100)}%` }} />
                                  </div>
                                  {[
                                    { label: "Order Placed",    sub: "Spec loaded",          icon: <FileText size={13} /> },
                                    { label: "In Production",   sub: "Inkjet printing",      icon: <Printer size={13} /> },
                                    { label: "Framing & QA",    sub: "Hand-mounted",          icon: <Scissors size={13} /> },
                                    { label: "Dispatch Ready",  sub: "Counter / courier",    icon: <Truck size={13} /> },
                                  ].map((step, i) => (
                                    <div key={i} className="flex flex-col items-center text-center gap-1.5 relative z-10">
                                      <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
                                        currentStep > i + 1 ? "bg-emerald-500 text-white shadow-md shadow-green-100" :
                                        currentStep === i + 1 ? "bg-amber-500 text-white shadow-md shadow-amber-100 ring-2 ring-amber-200" :
                                        "bg-white border-2 border-gray-200 text-gray-400"
                                      }`}>
                                        {currentStep > i + 1 ? <Check size={13} /> : step.icon}
                                      </div>
                                      <p className="text-[10px] font-bold text-[#2c2a29] leading-tight">{step.label}</p>
                                      <p className="text-[9px] text-[#7c756d] leading-tight hidden sm:block">{step.sub}</p>
                                    </div>
                                  ))}
                                </div>
                                {/* Event log */}
                                <div className="bg-white border border-[#e5e1da] rounded-2xl p-4 space-y-3">
                                  <span className="text-[10px] uppercase font-bold text-[#7c756d] tracking-wider">Production Logs</span>
                                  <div className="space-y-2.5 text-xs">
                                    {[
                                      { step: 1, done: "Order placed & payment authorized", doneDetail: `${ord.quantity}x custom print queued in Cainta printing hub`, pending: null },
                                      { step: 2, done: "Fine-art inkjet print completed", doneDetail: "12-channel archival ink, color-corrected", pending: "Awaiting machine slot calibration" },
                                      { step: 3, done: "QA passed & mounted", doneDetail: "Beveling, mounting & glass protection verified", pending: "Framing & quality check pending" },
                                      { step: 4, done: "Product fulfilled", doneDetail: "Collected at studio counter", pending: "Final dispatch / counter hand-off" },
                                    ].map(({ step, done, doneDetail, pending }) => (
                                      <div key={step} className="flex items-start gap-2.5">
                                        {currentStep >= step ? (
                                          <CheckCircle2 size={14} className={`flex-shrink-0 mt-0.5 ${currentStep > step ? "text-emerald-600" : "text-amber-500 animate-pulse"}`} />
                                        ) : (
                                          <Clock size={14} className="flex-shrink-0 mt-0.5 text-gray-300" />
                                        )}
                                        <div>
                                          <p className={`font-bold ${currentStep >= step ? "text-[#2c2a29]" : "text-gray-400"}`}>
                                            {currentStep >= step ? done : pending}
                                          </p>
                                          {currentStep >= step && doneDetail && (
                                            <p className="text-[10px] text-gray-400 mt-0.5">{doneDetail}</p>
                                          )}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              </div>

                              {/* Mockup visualiser */}
                              <div className="lg:col-span-5 space-y-4">
                                <h5 className="text-xs font-bold uppercase text-[#7c756d] tracking-wider flex items-center gap-1.5">
                                  <Sparkles size={13} className="text-yellow-500 fill-yellow-500" /> Mockup Visualizer
                                </h5>
                                <div className="bg-stone-100 rounded-2xl p-5 flex items-center justify-center h-[200px] border border-stone-200 relative shadow-inner">
                                  <motion.div layout
                                    className={`relative shadow-xl ${
                                      trackFrame === "oak" ? "border-8 border-[#b48a53] ring-1 ring-[#926c3d]" :
                                      trackFrame === "black" ? "border-8 border-[#18181b] ring-1 ring-black" :
                                      trackFrame === "gold" ? "border-8 border-[#d4af37] ring-1 ring-[#b2932a]" : "border border-gray-200 bg-white p-0.5"
                                    }`}
                                    style={{ aspectRatio: "4/3", width: "150px" }}
                                  >
                                    <div className={`w-full h-full overflow-hidden bg-stone-200 ${trackFrame !== "frameless" ? "p-1 bg-[#faf9f6]" : ""}`}>
                                      <img src={resolvedPrintMedia[ord.uploadedPhoto] || ord.uploadedPhoto} alt="mockup" className="w-full h-full object-cover" />
                                      {trackMatte === "glossy" && <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/5 to-white/25 pointer-events-none mix-blend-overlay" />}
                                    </div>
                                  </motion.div>
                                  <span className="absolute bottom-2 left-2 text-[9px] uppercase font-bold text-stone-500 bg-white/70 px-2 py-0.5 rounded">{trackFrame} / {trackMatte}</span>
                                </div>
                                <div className="space-y-2.5">
                                  <div>
                                    <p className="text-[10px] font-bold text-gray-500 uppercase mb-1.5">Frame Style</p>
                                    <div className="grid grid-cols-4 gap-1.5">
                                      {(["black", "oak", "gold", "frameless"] as const).map(f => (
                                        <button key={f} onClick={() => setTrackFrame(f)}
                                          className={`py-1.5 text-[9px] font-bold rounded-lg border uppercase cursor-pointer transition-all ${trackFrame === f ? "bg-[#2c2a29] border-[#2c2a29] text-white" : "bg-white border-[#e5e1da] text-stone-600 hover:bg-stone-50"}`}>
                                          {f === "frameless" ? "Canvas" : f.charAt(0).toUpperCase() + f.slice(1)}
                                        </button>
                                      ))}
                                    </div>
                                  </div>
                                  <div>
                                    <p className="text-[10px] font-bold text-gray-500 uppercase mb-1.5">Finish</p>
                                    <div className="grid grid-cols-2 gap-1.5">
                                      {(["glossy", "matte"] as const).map(m => (
                                        <button key={m} onClick={() => setTrackMatte(m)}
                                          className={`py-1.5 text-[9px] font-bold rounded-lg border uppercase cursor-pointer transition-all ${trackMatte === m ? "bg-[#2c2a29] border-[#2c2a29] text-white" : "bg-white border-[#e5e1da] text-stone-600 hover:bg-stone-50"}`}>
                                          {m}
                                        </button>
                                      ))}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })}
              </div>
            )}

            {/* ── Archived print orders accordion ─────────────────────── */}
            {printOrders.filter(o => o.isArchived).length > 0 && (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 overflow-hidden mt-4">
                <button type="button"
                  onClick={() => setShowArchivedPrints(v => !v)}
                  className="w-full flex items-center justify-between px-5 py-3.5 cursor-pointer hover:bg-amber-100 transition-colors">
                  <div className="flex items-center gap-2">
                    <span className="text-sm">📦</span>
                    <span className="text-xs font-bold text-amber-800">
                      Archived Print Orders ({printOrders.filter(o => o.isArchived).length})
                    </span>
                  </div>
                  <span className="text-[10px] font-bold text-amber-700">{showArchivedPrints ? "▲ Hide" : "▼ Show"}</span>
                </button>
                {showArchivedPrints && (
                  <div className="border-t border-amber-200 overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="bg-amber-100 text-amber-900 text-[9px] uppercase tracking-wider">
                          <th className="py-2.5 px-4">Order ID</th>
                          <th className="py-2.5 px-3">Studio</th>
                          <th className="py-2.5 px-3">Status</th>
                          <th className="py-2.5 px-3">Amount</th>
                          <th className="py-2.5 px-3">Archived On</th>
                          <th className="py-2.5 px-3">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-amber-100">
                        {printOrders.filter(o => o.isArchived).map(o => {
                          const sObj = studios.find(s => s.id === o.studioId);
                          return (
                            <tr key={o.id} className="bg-white/60 hover:bg-amber-50 transition-colors">
                              <td className="py-2.5 px-4 font-mono text-[10px] font-bold text-[#2c2a29]">{o.id}</td>
                              <td className="py-2.5 px-3 text-[10px] text-[#7c756d]">{sObj?.name || "—"}</td>
                              <td className="py-2.5 px-3">
                                <span className="inline-flex px-2 py-0.5 rounded-full text-[9px] font-bold border bg-gray-100 text-gray-600 border-gray-200 uppercase">{o.status}</span>
                              </td>
                              <td className="py-2.5 px-3 text-[10px] font-bold text-emerald-700">₱{Number(o.totalAmount).toLocaleString()}</td>
                              <td className="py-2.5 px-3 text-[10px] text-[#7c756d]">
                                {o.archivedAt ? new Date(o.archivedAt).toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" }) : "—"}
                              </td>
                              <td className="py-2.5 px-3">
                                <div className="flex gap-1.5 flex-wrap">
                                  {onArchivePrintOrder && (
                                    <button type="button"
                                      onClick={() => { if (window.confirm("Restore this print order from the archive?")) apiRequest(`/api/print-orders/${o.id}/unarchive`, { method: "PUT" }).then(() => window.location.reload()).catch((err: any) => alert(err.message || "Unable to restore.")); }}
                                      className="flex items-center gap-0.5 px-2 py-1 bg-green-50 hover:bg-green-100 text-green-700 border border-green-200 text-[9px] font-bold rounded-lg cursor-pointer">
                                      ↩ Restore
                                    </button>
                                  )}
                                  {onDeletePrintOrder && (
                                    <button type="button"
                                      onClick={() => { if (window.confirm(`PERMANENTLY DELETE print order ${o.id}? This cannot be undone.`)) onDeletePrintOrder(o.id); }}
                                      className="flex items-center gap-0.5 px-2 py-1 bg-rose-600 hover:bg-rose-500 text-white text-[9px] font-bold rounded-lg cursor-pointer">
                                      🗑 Delete
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════
            TAB C — SAVED STUDIOS
        ════════════════════════════════════════════════════════════ */}
        {activeSubTab === "favorites" && (
          <div className="space-y-5">
            {/* Search */}
            <div className="bg-white rounded-2xl border border-[#e5e1da] p-4">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                <input
                  value={favSearch}
                  onChange={e => setFavSearch(e.target.value)}
                  placeholder="Search saved studios by name or location…"
                  className="w-full pl-9 pr-4 py-2.5 text-xs border border-[#e5e1da] rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-300 bg-[#faf9f6]"
                />
              </div>
            </div>

            <div className="flex items-center justify-between">
              <p className="text-xs text-[#7c756d] font-medium">
                <strong className="text-[#2c2a29]">{filteredFavorites.length}</strong> saved studio{filteredFavorites.length !== 1 ? "s" : ""}
              </p>
            </div>

            {filteredFavorites.length === 0 ? (
              <div className="bg-white rounded-2xl border border-[#e5e1da] py-16 text-center space-y-3">
                <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto">
                  <Heart size={24} className="text-gray-300" />
                </div>
                <p className="text-sm font-bold text-[#2c2a29]">
                  {favorites.length === 0 ? "No saved studios yet" : "No studios match your search"}
                </p>
                <p className="text-xs text-[#7c756d]">{favorites.length === 0 ? "Heart studios while browsing to save them here." : "Try a different keyword."}</p>
                {favorites.length === 0 && (
                  <button onClick={() => onNavigate("directory")} className="inline-flex items-center gap-1.5 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-white text-xs font-bold rounded-xl cursor-pointer mt-1">
                    <Camera size={13} /> Explore Studios
                  </button>
                )}
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredFavorites.map((fav) => {
                  const stObj = studios.find(s => s.id === fav.studioId);
                  if (!stObj) return null;
                  const avgRating = stObj.rating ? Number(stObj.rating).toFixed(1) : null;
                  return (
                    <motion.div
                      key={fav.id}
                      layout
                      initial={{ opacity: 0, scale: 0.97 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="bg-white rounded-2xl border border-[#e5e1da] overflow-hidden hover:shadow-md transition-shadow group"
                    >
                      {/* Cover */}
                      <div className="relative h-32 overflow-hidden">
                        {stObj.coverImage ? (
                          <img src={stObj.coverImage} alt={stObj.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                        ) : (
                          <div className="w-full h-full bg-gradient-to-br from-amber-100 to-amber-200 flex items-center justify-center">
                            <Camera size={32} className="text-amber-400" />
                          </div>
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                        {/* Remove heart */}
                        <button
                          onClick={() => onRemoveFavorite(stObj.id)}
                          className="absolute top-2.5 right-2.5 w-8 h-8 rounded-full bg-white/90 backdrop-blur-sm flex items-center justify-center text-red-500 hover:text-red-700 hover:bg-white transition-colors cursor-pointer shadow-sm"
                          title="Remove from favorites"
                        >
                          <Heart size={15} className="fill-current" />
                        </button>
                        {stObj.isApproved && (
                          <span className="absolute top-2.5 left-2.5 flex items-center gap-1 text-[9px] font-bold bg-green-600 text-white px-2 py-0.5 rounded-full">
                            <BadgeCheck size={9} /> Verified
                          </span>
                        )}
                      </div>

                      {/* Info */}
                      <div className="p-4 space-y-3">
                        <div>
                          <h4 className="font-display font-bold text-[#2c2a29] text-sm leading-tight">{stObj.name}</h4>
                          <p className="text-[10px] text-[#7c756d] flex items-center gap-1 mt-0.5">
                            <MapPin size={10} />{stObj.location || stObj.address || "Cainta, Rizal"}
                          </p>
                        </div>

                        {/* Rating + starting price */}
                        <div className="flex items-center justify-between">
                          {avgRating ? (
                            <div className="flex items-center gap-1">
                              <Star size={11} className="text-yellow-500 fill-yellow-500" />
                              <span className="text-xs font-bold text-[#2c2a29]">{avgRating}</span>
                            </div>
                          ) : <span />}
                          {stObj.startingPrice != null && (
                            <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-lg">
                              From ₱{Number(stObj.startingPrice).toLocaleString()}
                            </span>
                          )}
                        </div>

                        {/* Categories */}
                        {stObj.categories && (
                          <div className="flex flex-wrap gap-1">
                            {(Array.isArray(stObj.categories) ? stObj.categories : String(stObj.categories).split(","))
                              .slice(0, 3)
                              .map((cat: string, i: number) => (
                                <span key={i} className="text-[9px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full font-semibold">{cat.trim()}</span>
                              ))}
                          </div>
                        )}

                        {/* Actions */}
                        <div className="flex items-center gap-2 pt-1">
                          <button
                            onClick={() => onNavigate("profile", { id: stObj.id })}
                            className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-[#2c2a29] hover:bg-[#4a4644] text-white text-[11px] font-bold rounded-xl cursor-pointer transition-colors"
                          >
                            <Eye size={12} /> View Studio
                          </button>
                          <button
                            onClick={() => onNavigate("profile", { id: stObj.id })}
                            className="flex items-center justify-center gap-1.5 px-3 py-2 bg-amber-500 hover:bg-amber-400 text-white text-[11px] font-bold rounded-xl cursor-pointer transition-colors"
                            title="Book this studio"
                          >
                            <CalendarPlus size={12} />
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ════════════════════════════════════════════════════════════
          MODALS
      ════════════════════════════════════════════════════════════ */}

      {/* Booking Details View */}
      {viewingBooking && (
        <BookingDetailsModal
          booking={viewingBooking}
          studio={studios.find(s => s.id === viewingBooking.studioId)}
          services={services}
          packages={packages}
          onClose={() => setViewingBooking(null)}
        />
      )}

      {/* Booking payment proof */}
      {payingBooking && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 border border-[#e5e1da] shadow-2xl space-y-4">
            <div className="flex justify-between items-center">
              <h4 className="font-display font-bold text-sm text-[#2c2a29]">
                Submit {payingPaymentType === "Full Payment"
                  ? (Number(payingBooking.amountPaid) > 0 ? "Remaining Balance" : "Full Payment")
                  : "Downpayment"} —{" "}
                ₱{payingPaymentType === "Full Payment"
                  ? (Number(payingBooking.amountPaid) > 0
                      ? (Number(payingBooking.remainingBalance) > 0 ? Number(payingBooking.remainingBalance) : Number(payingBooking.totalAmount))
                      : Number(payingBooking.totalAmount)
                    ).toLocaleString()
                  : (Number(payingBooking.downPaymentAmount) || Math.round(Number(payingBooking.totalAmount) * 0.3 * 100) / 100).toLocaleString()}
              </h4>
              <button onClick={() => setPayingBooking(null)} className="p-1.5 rounded-full hover:bg-gray-100 cursor-pointer"><X size={16} /></button>
            </div>
            <form onSubmit={handlePaymentSubmit} className="space-y-4 text-xs">
              <div>
                <label className="text-[10px] font-bold text-[#7c756d] uppercase block mb-2">Payment Type</label>
                <div className="grid grid-cols-2 gap-2">
                  {(["Downpayment", "Full Payment"] as const).map(t => (
                    <button key={t} type="button" onClick={() => setPayingPaymentType(t)}
                      className={`py-2 px-2.5 rounded-xl border text-xs font-semibold cursor-pointer transition-all ${payingPaymentType === t ? "bg-[#2c2a29] border-[#2c2a29] text-white" : "bg-[#faf9f6] border-[#e5e1da] text-[#7c756d] hover:border-[#2c2a29]"}`}>
                      {t === "Downpayment"
                        ? `Downpayment (₱${(Number(payingBooking.downPaymentAmount) || Math.round(Number(payingBooking.totalAmount) * 0.3 * 100) / 100).toLocaleString()})`
                        : Number(payingBooking.amountPaid) > 0
                          ? `Remaining Balance (₱${(Number(payingBooking.remainingBalance) > 0 ? Number(payingBooking.remainingBalance) : Number(payingBooking.totalAmount)).toLocaleString()})`
                          : `Full Payment (₱${Number(payingBooking.totalAmount).toLocaleString()})`}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-[10px] font-bold text-[#7c756d] uppercase block mb-1.5">Payment Method</label>
                <select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value as any)} className="w-full bg-[#faf9f6] border border-[#e5e1da] rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-amber-300">
                  <option>GCash</option><option>Maya</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] font-bold text-[#7c756d] uppercase block mb-1.5">Reference Number</label>
                <input type="text" required value={refNo} onChange={e => setRefNo(e.target.value)} placeholder="Paste transaction reference" className="w-full bg-[#faf9f6] border border-[#e5e1da] rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-amber-300" />
              </div>
              <div>
                <label className="text-[10px] font-bold text-[#7c756d] uppercase block mb-1.5">Upload Receipt</label>
                <div className="border-2 border-dashed border-[#e5e1da] rounded-xl p-3 text-center bg-[#faf9f6] relative cursor-pointer hover:border-amber-400 transition-colors">
                  <input type="file" accept="image/*" onChange={e => handleFileUpload(e, "payment")} className="absolute inset-0 opacity-0 cursor-pointer" />
                  <span className="text-[10px] text-[#7c756d]">{proofBase64 ? "✓ Image loaded — click to replace" : "Click to select receipt photo"}</span>
                </div>
              </div>
              <button type="submit" className="w-full py-3 bg-[#2c2a29] hover:bg-[#4a4644] text-white rounded-xl text-xs font-bold uppercase tracking-wider cursor-pointer transition-colors">Upload & Confirm Payment</button>
            </form>
          </div>
        </div>
      )}

      {/* GCash QR */}
      {gcashQRTarget && (
        <GCashQRModal
          isOpen={!!gcashQRTarget}
          onClose={() => setGcashQRTarget(null)}
          onPaymentSuccess={() => { setGcashQRTarget(null); window.location.reload(); }}
          bookingId={gcashQRTarget.bookingId}
          printOrderId={gcashQRTarget.printOrderId}
          studioId={gcashQRTarget.studioId}
          amount={gcashQRTarget.amount}
          paymentType={gcashQRTarget.paymentType}
          studioName={gcashQRTarget.studioName}
          description={gcashQRTarget.description}
          authToken={currentUser?.authToken || ""}
        />
      )}

      {/* Review */}
      {reviewingBooking && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 border border-[#e5e1da] shadow-2xl space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-[10px] text-[#7c756d] font-bold uppercase tracking-wider">Leave a Review</p>
                <h4 className="font-display font-bold text-sm text-[#2c2a29]">{studios.find(s => s.id === reviewingBooking.studioId)?.name}</h4>
              </div>
              <button onClick={() => setReviewingBooking(null)} className="p-1.5 rounded-full hover:bg-gray-100 cursor-pointer"><X size={16} /></button>
            </div>
            <form onSubmit={handleReviewSubmit} className="space-y-4">
              <div>
                <label className="text-[10px] font-bold text-[#7c756d] uppercase block mb-2">Your Rating</label>
                <div className="flex items-center gap-2">
                  {[1, 2, 3, 4, 5].map(s => (
                    <button key={s} type="button" onClick={() => setRating(s)} className="cursor-pointer transition-transform hover:scale-110">
                      <Star size={24} className={`transition-colors ${rating >= s ? "text-yellow-400 fill-yellow-400" : "text-gray-200 fill-gray-200"}`} />
                    </button>
                  ))}
                  <span className="text-sm font-bold text-[#2c2a29] ml-1">{rating}/5</span>
                </div>
              </div>
              <div>
                <label className="text-[10px] font-bold text-[#7c756d] uppercase block mb-1.5">Your Feedback</label>
                <textarea required value={reviewComment} onChange={e => setReviewComment(e.target.value)} placeholder="Share your photography experience…" className="w-full bg-[#faf9f6] border border-[#e5e1da] rounded-xl p-3 text-xs focus:outline-none focus:ring-2 focus:ring-amber-300 resize-none h-24" />
              </div>
              <button type="submit" className="w-full py-3 bg-yellow-400 hover:bg-yellow-300 text-black rounded-xl text-xs font-bold uppercase tracking-wider cursor-pointer transition-colors">Submit Review</button>
            </form>
          </div>
        </div>
      )}

      {/* Photo proofing portal */}
      {proofingBookingId && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-5xl w-full max-h-[90vh] overflow-y-auto p-6 relative shadow-2xl border border-[#e5e1da]">
            <button onClick={() => setProofingBookingId(null)} className="absolute top-4 right-4 p-2 bg-gray-100 hover:bg-gray-200 rounded-full cursor-pointer z-10"><X size={18} /></button>
            <ClientGallery bookingId={proofingBookingId} currentUser={currentUser} onClose={() => setProofingBookingId(null)} />
          </div>
        </div>
      )}

      {/* Reschedule */}
      {reschedulingBooking && (
        <RescheduleModal
          booking={reschedulingBooking}
          studio={studios.find(s => s.id === reschedulingBooking.studioId) || {}}
          services={services}
          packages={packages}
          currentUser={currentUser}
          onClose={() => setReschedulingBooking(null)}
          onSuccess={(updatedBooking, result) => {
            setReschedulingBooking(null);
            // The modal's own PUT already persisted the change on the server.
            // Pass the SERVER-returned booking (not the stale pre-modal row) so
            // App merges the authoritative record and never re-PUTs stale data.
            if (onRescheduleBooking) onRescheduleBooking(
              updatedBooking.id,
              updatedBooking,
              result?.rescheduleReason,
              { pendingApproval: result?.isPendingApproval }
            );
          }}
        />
      )}


    </div>
  );
}
