import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  X,
  QrCode,
  CheckCircle2,
  AlertCircle,
  Clock,
  Download,
  RefreshCw,
  Smartphone,
  Shield,
  Loader2,
  Lock,
  Upload,
  Camera,
  FileCheck,
  Copy,
  Check,
  CreditCard,
} from "lucide-react";
import type { GCashQRSession } from "../db/types";
import { apiRequest, resolveApiUrl } from "../utils/apiClient.ts";

interface GCashQRModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPaymentSuccess: (sessionId: string, paymentId: string) => void;
  bookingId?: string;
  printOrderId?: string;
  studioId: string;
  amount: number;
  paymentType: "Downpayment" | "Balance" | "Full Payment" | "PrintOrder";
  studioName: string;
  description?: string;
  authToken: string;
}

type ModalState = "loading" | "qr_ready" | "no_qr" | "waiting" | "paid" | "expired" | "error";

const POLL_INTERVAL_MS = 4000;
const QR_LIFETIME_MS  = 30 * 60 * 1000;

function formatTime(ms: number): string {
  const totalSecs = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(totalSecs / 60).toString().padStart(2, "0");
  const s = (totalSecs % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

export default function GCashQRModal({
  isOpen,
  onClose,
  onPaymentSuccess,
  bookingId,
  printOrderId,
  studioId,
  amount,
  paymentType,
  studioName,
  description,
  authToken,
}: GCashQRModalProps) {
  const [modalState, setModalState]               = useState<ModalState>("loading");
  const [session, setSession]                     = useState<GCashQRSession | null>(null);
  const [studioOwnerInfo, setStudioOwnerInfo]     = useState<{ gcashAccountName?: string; gcashNumber?: string; studioName?: string } | null>(null);
  const [timeLeftMs, setTimeLeftMs]               = useState(QR_LIFETIME_MS);
  const [error, setError]                         = useState<string>("");
  const [isGenerating, setIsGenerating]           = useState(false);

  // Proof form
  const [refNo, setRefNo]                         = useState("");
  const [receiptBase64, setReceiptBase64]         = useState("");
  const [receiptFileName, setReceiptFileName]     = useState("");
  const [isSubmittingProof, setIsSubmittingProof] = useState(false);
  const [proofSubmitted, setProofSubmitted]       = useState(false);
  const [showProofForm, setShowProofForm]         = useState(true);
  const [proofError, setProofError]               = useState("");
  const [copiedNum, setCopiedNum]                 = useState(false);

  const pollRef  = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const sseRef   = useRef<EventSource | null>(null);

  // ── Cleanup ──────────────────────────────────────────────────────────────
  const cleanup = useCallback(() => {
    if (pollRef.current)  { clearInterval(pollRef.current);  pollRef.current  = null; }
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    if (sseRef.current)   { sseRef.current.close();          sseRef.current   = null; }
  }, []);

  useEffect(() => {
    if (!isOpen) {
      cleanup();
      setModalState("loading");
      setSession(null);
      setError("");
      setTimeLeftMs(QR_LIFETIME_MS);
      setRefNo("");
      setReceiptBase64("");
      setReceiptFileName("");
      setProofSubmitted(false);
      setProofError("");
      setShowProofForm(true);
    }
    return cleanup;
  }, [isOpen, cleanup]);

  // ── Countdown ────────────────────────────────────────────────────────────
  const startCountdown = (expiresAt: number) => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      const remaining = expiresAt - Date.now();
      if (remaining <= 0) {
        clearInterval(timerRef.current!);
        setModalState("expired");
        setTimeLeftMs(0);
        if (pollRef.current) clearInterval(pollRef.current);
      } else {
        setTimeLeftMs(remaining);
      }
    }, 1000);
  };

  // ── Paid confirmation ────────────────────────────────────────────────────
  const handlePaidConfirmation = useCallback((s: GCashQRSession) => {
    cleanup();
    setModalState("paid");
    setSession(s);
    onPaymentSuccess(s.id, s.paymentId || "");
  }, [cleanup, onPaymentSuccess]);

  // ── SSE (primary) ────────────────────────────────────────────────────────
  const startSSE = useCallback((sessionId: string) => {
    if (sseRef.current) { sseRef.current.close(); sseRef.current = null; }
    const es = new EventSource(`/api/payments/gcash/stream?token=${encodeURIComponent(authToken)}`);
    sseRef.current = es;
    es.addEventListener("GCASH_PAYMENT_CONFIRMED", (ev: MessageEvent) => {
      try {
        const payload = JSON.parse(ev.data);
        if (payload.sessionId === sessionId) {
          handlePaidConfirmation({
            id: sessionId,
            paymentId: payload.paymentId,
            bookingId: payload.bookingId,
            studioId: "", customerId: "", gateway: "direct_gcash",
            amount: payload.amount, paymentType: "Downpayment",
            status: "paid", expiresAt: "", paidAt: payload.paidAt, createdAt: ""
          } as GCashQRSession);
        }
      } catch { /* ignore */ }
    });
    es.onerror = () => { /* SSE errors are non-fatal; polling fallback covers it */ };
  }, [authToken, handlePaidConfirmation]);

  // ── Polling (fallback) ───────────────────────────────────────────────────
  const startPolling = useCallback((sessionId: string) => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(resolveApiUrl(`/api/payments/gcash/session/${sessionId}`), {
          headers: { "Authorization": `Bearer ${authToken}` },
        });
        const data = await res.json();
        if (data.success && data.session) {
          const s: GCashQRSession = data.session;
          if (s.status === "paid") handlePaidConfirmation(s);
          else if (s.status === "expired" || s.status === "failed") { cleanup(); setModalState("expired"); }
        }
      } catch { /* silent */ }
    }, POLL_INTERVAL_MS);
  }, [authToken, cleanup, handlePaidConfirmation]);

  // ── Generate QR ──────────────────────────────────────────────────────────
  const generateQR = useCallback(async () => {
    setIsGenerating(true);
    setModalState("loading");
    setError("");
    try {
      const body: Record<string, any> = {
        studioId, amount, paymentType,
        description: description || `${paymentType} for ${studioName}`,
      };
      if (bookingId)    body.bookingId    = bookingId;
      if (printOrderId) body.printOrderId = printOrderId;

      const data = await apiRequest("/api/payments/gcash/create-qr", { method: "POST", body });
      const newSession: GCashQRSession = data.session;
      setSession(newSession);
      if (data.studioOwner) setStudioOwnerInfo(data.studioOwner);

      const expiresAt = new Date(newSession.expiresAt).getTime();
      setTimeLeftMs(expiresAt - Date.now());
      setModalState(newSession.qrCodeData ? "qr_ready" : "no_qr");
      startSSE(newSession.id);
      startPolling(newSession.id);
      startCountdown(expiresAt);
    } catch (err: any) {
      setError(err.message || "Could not generate QR code. Please try again.");
      setModalState("error");
    } finally {
      setIsGenerating(false);
    }
  }, [studioId, amount, paymentType, bookingId, printOrderId, description, studioName, authToken, startSSE, startPolling]);

  useEffect(() => {
    if (isOpen) generateQR();
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Helpers ──────────────────────────────────────────────────────────────
  const getQrSrc = (raw?: string | null) => {
    if (!raw) return "";
    if (raw.startsWith("data:") || raw.startsWith("http")) return raw;
    return `data:image/png;base64,${raw}`;
  };

  const downloadQR = () => {
    if (!session?.qrCodeData) return;
    const link = document.createElement("a");
    link.href = getQrSrc(session.qrCodeData);
    link.download = `gcash-qr-${session.id}.png`;
    link.click();
  };

  const handleReceiptUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { setProofError("Please select a screenshot image (JPG or PNG)."); return; }
    if (file.size > 8 * 1024 * 1024) { setProofError("Screenshot exceeds 8 MB limit."); return; }
    setProofError("");
    setReceiptFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => setReceiptBase64(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleSubmitProof = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!session) return;
    if (!refNo.trim() && !receiptBase64) {
      setProofError("Please provide your GCash Reference Number or screenshot.");
      return;
    }
    setIsSubmittingProof(true);
    setProofError("");
    try {
      const data = await apiRequest("/api/payments/gcash/submit-proof", {
        method: "POST",
        body: { sessionId: session.id, referenceNumber: refNo.trim(), proofOfPayment: receiptBase64 }
      });
      setProofSubmitted(true);
      setTimeout(() => onPaymentSuccess(session.id, data.paymentId), 2500);
    } catch (err: any) {
      setProofError(err.message || "Failed to submit payment proof.");
    } finally {
      setIsSubmittingProof(false);
    }
  };

  if (!isOpen) return null;

  const pctLeft       = (timeLeftMs / QR_LIFETIME_MS) * 100;
  const isUrgent      = timeLeftMs < 5 * 60 * 1000;
  const radius        = 28;
  const circumference = 2 * Math.PI * radius;
  const strokeDash    = (pctLeft / 100) * circumference;

  const payLabel = paymentType === "Downpayment"
    ? "30% Downpayment"
    : paymentType === "Balance"
    ? "Remaining Balance"
    : paymentType === "PrintOrder"
    ? "Print Order Payment"
    : "Full Payment";

  // ── Shared proof form (reused in both qr_ready and no_qr states) ─────────
  // Defined as a render-time variable so it closes over current state without
  // triggering hook remount between renders.
  const proofFormJsx = (
    <div className="border border-[#e5e1da] rounded-2xl overflow-hidden">
      {/* Section header */}
      <div className="bg-[#faf9f6] border-b border-[#e5e1da] px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-amber-100 flex items-center justify-center">
            <Camera size={13} className="text-amber-700" />
          </div>
          <span className="text-xs font-bold text-[#2c2a29]">Submit Payment Proof</span>
        </div>
        {showProofForm && (
          <button type="button" onClick={() => setShowProofForm(false)}
            className="text-[10px] text-[#7c756d] hover:text-[#2c2a29] font-medium cursor-pointer">
            Hide
          </button>
        )}
      </div>

      {showProofForm && (
        <div className="p-4 space-y-3">
          {/* Ref number */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-[#7c756d] uppercase tracking-wider">
              GCash Reference No. <span className="text-[#b0aa9f] normal-case">(optional)</span>
            </label>
            <input
              type="text"
              value={refNo}
              onChange={e => setRefNo(e.target.value)}
              placeholder="e.g. 1029 3847 5612"
              className="w-full px-3 py-2.5 text-xs border border-[#e5e1da] rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-300 bg-white text-[#2c2a29] placeholder-[#b0aa9f]"
            />
          </div>

          {/* Receipt upload */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-[#7c756d] uppercase tracking-wider">
              Screenshot Receipt
            </label>
            <label className={`flex items-center gap-3 px-3 py-3 border-2 border-dashed rounded-xl cursor-pointer transition-colors ${
              receiptBase64 ? "border-green-300 bg-green-50" : "border-[#e5e1da] hover:border-amber-300 bg-[#faf9f6]"
            }`}>
              <input type="file" accept="image/*" onChange={handleReceiptUpload} className="sr-only" />
              {receiptBase64 ? (
                <>
                  <div className="w-8 h-8 rounded-lg bg-green-100 flex items-center justify-center flex-shrink-0">
                    <CheckCircle2 size={15} className="text-green-600" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-green-700">Screenshot attached!</p>
                    <p className="text-[10px] text-green-600 truncate">{receiptFileName}</p>
                  </div>
                </>
              ) : (
                <>
                  <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0">
                    <Upload size={14} className="text-amber-700" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-[#2c2a29]">Tap to attach screenshot</p>
                    <p className="text-[10px] text-[#7c756d]">JPG or PNG · max 8 MB</p>
                  </div>
                </>
              )}
            </label>
          </div>

          {proofError && (
            <div className="flex items-center gap-2 px-3 py-2 bg-rose-50 border border-rose-200 rounded-xl">
              <AlertCircle size={12} className="text-rose-500 flex-shrink-0" />
              <p className="text-xs text-rose-600">{proofError}</p>
            </div>
          )}

          <button
            type="button"
            onClick={handleSubmitProof}
            disabled={isSubmittingProof}
            className="w-full py-2.5 bg-[#2c2a29] hover:bg-[#1a1918] text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-colors disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
          >
            {isSubmittingProof ? (
              <><Loader2 size={13} className="animate-spin" /> Submitting…</>
            ) : (
              <><FileCheck size={13} /> Submit to Studio for Verification</>
            )}
          </button>
        </div>
      )}

      {!showProofForm && (
        <div className="p-3">
          <button type="button" onClick={() => setShowProofForm(true)}
            className="w-full py-2 bg-[#faf9f6] hover:bg-[#f0ede8] border border-[#e5e1da] rounded-xl text-xs font-bold text-[#2c2a29] flex items-center justify-center gap-2 cursor-pointer transition-colors">
            <Camera size={12} /> Already paid? Upload receipt & ref #
          </button>
        </div>
      )}
    </div>
  );

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center p-0 sm:p-4"
      style={{ background: "rgba(0,0,0,0.45)", backdropFilter: "blur(6px)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl overflow-hidden shadow-2xl flex flex-col"
        style={{ maxHeight: "95dvh", animation: "payModalIn 0.3s cubic-bezier(0.34,1.56,0.64,1)" }}
        role="dialog" aria-modal="true" aria-labelledby="pay-modal-title"
      >

        {/* ── HEADER ─────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#f0ede8] flex-shrink-0">
          <div className="flex items-center gap-3">
            {/* GCash icon badge */}
            <div className="w-9 h-9 rounded-xl bg-[#00a94f] flex items-center justify-center shadow-sm flex-shrink-0">
              <svg viewBox="0 0 24 24" fill="none" width="20" height="20">
                <text x="12" y="17" textAnchor="middle" fill="white" fontSize="13" fontWeight="bold" fontFamily="Arial">G</text>
              </svg>
            </div>
            <div>
              <h2 id="pay-modal-title" className="text-sm font-black text-[#2c2a29] leading-none">
                GCash · Direct Payment
              </h2>
              <p className="text-[10px] text-[#7c756d] mt-0.5">{studioName}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-[#f5f3ef] hover:bg-[#e8e5e0] text-[#7c756d] hover:text-[#2c2a29] flex items-center justify-center transition-colors cursor-pointer"
            aria-label="Close payment modal"
          >
            <X size={16} />
          </button>
        </div>

        {/* ── SECURITY STRIP ─────────────────────────────────────────────── */}
        <div className="flex items-center justify-center gap-2 px-4 py-2 bg-green-50 border-b border-green-100 flex-shrink-0">
          <Lock size={10} className="text-green-600" />
          <span className="text-[10px] text-green-700 font-medium">Direct payment to studio owner · Secured GCash transfer</span>
          <Shield size={10} className="text-green-600" />
        </div>

        {/* ── SCROLLABLE BODY ─────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-4 sm:p-5 space-y-4">

            {/* ── AMOUNT CARD ──────────────────────────────────────────────── */}
            <div className="bg-[#faf9f6] border border-[#e5e1da] rounded-2xl p-4 flex items-center gap-4">
              <div className="w-11 h-11 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0">
                <CreditCard size={18} className="text-amber-700" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-bold text-[#7c756d] uppercase tracking-wider">{payLabel}</p>
                <p className="text-2xl font-black text-[#2c2a29] leading-tight">
                  ₱{amount.toLocaleString("en-PH", { minimumFractionDigits: 2 })}
                </p>
                {description && <p className="text-[10px] text-[#7c756d] truncate mt-0.5">{description}</p>}
              </div>
            </div>

            {/* ── STUDIO GCASH ACCOUNT ─────────────────────────────────────── */}
            <div className="bg-green-50 border border-green-200 rounded-2xl p-4 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-green-700 uppercase tracking-wider">Studio GCash Account</span>
                <span className="text-[9px] font-bold text-green-600 bg-green-100 border border-green-200 px-2 py-0.5 rounded-full">Direct Transfer</span>
              </div>
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <p className="text-sm font-bold text-[#2c2a29]">{studioOwnerInfo?.gcashAccountName || studioName}</p>
                  <p className="text-[11px] text-[#7c756d]">{studioName}</p>
                </div>
                {studioOwnerInfo?.gcashNumber && (
                  <div className="flex items-center gap-2 bg-white border border-green-200 rounded-xl px-3 py-1.5">
                    <span className="font-mono text-sm font-bold text-[#2c2a29]">{studioOwnerInfo.gcashNumber}</span>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(studioOwnerInfo!.gcashNumber || "");
                        setCopiedNum(true);
                        setTimeout(() => setCopiedNum(false), 2000);
                      }}
                      className="flex items-center gap-1 text-[10px] font-bold text-green-600 hover:text-green-800 cursor-pointer transition-colors"
                    >
                      {copiedNum ? <><Check size={10} /> Copied</> : <><Copy size={10} /> Copy</>}
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* ── LOADING STATE ─────────────────────────────────────────────── */}
            {modalState === "loading" && (
              <div className="flex flex-col items-center gap-3 py-8">
                <div className="w-16 h-16 rounded-2xl bg-[#faf9f6] border border-[#e5e1da] flex items-center justify-center">
                  <Loader2 size={28} className="text-amber-500 animate-spin" />
                </div>
                <p className="text-sm font-bold text-[#2c2a29]">Loading payment session…</p>
                <p className="text-xs text-[#7c756d]">Fetching studio payment details</p>
              </div>
            )}

            {/* ── QR READY / WAITING STATE ─────────────────────────────────── */}
            {(modalState === "qr_ready" || modalState === "waiting") && session?.qrCodeData && (
              <div className="space-y-4">

                {/* QR code + timer in a row on wider screens, column on small */}
                <div className="flex flex-col sm:flex-row items-center gap-4">
                  {/* QR image */}
                  <div className={`relative bg-white rounded-2xl p-3 border-2 flex-shrink-0 transition-all ${
                    isUrgent ? "border-rose-300 shadow-rose-100" : "border-[#e5e1da]"
                  } shadow-sm`}>
                    <img
                      src={getQrSrc(session.qrCodeData)}
                      alt="GCash payment QR code"
                      className="w-44 h-44 sm:w-48 sm:h-48 block rounded-lg"
                    />
                    {/* Corner decorators */}
                    {[
                      "top-2 left-2 border-t-2 border-l-2 rounded-tl",
                      "top-2 right-2 border-t-2 border-r-2 rounded-tr",
                      "bottom-2 left-2 border-b-2 border-l-2 rounded-bl",
                      "bottom-2 right-2 border-b-2 border-r-2 rounded-br",
                    ].map((cls, i) => (
                      <div key={i} className={`absolute w-4 h-4 ${isUrgent ? "border-rose-400" : "border-[#00a94f]"} ${cls}`} />
                    ))}
                    {isUrgent && (
                      <div className="absolute -top-2 left-1/2 -translate-x-1/2 bg-rose-500 text-white text-[9px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap">
                        Expiring soon!
                      </div>
                    )}
                  </div>

                  {/* Right side info */}
                  <div className="flex-1 w-full space-y-3">
                    {/* Timer */}
                    <div className={`flex items-center gap-3 p-3 rounded-xl border ${
                      isUrgent ? "bg-rose-50 border-rose-200" : "bg-[#faf9f6] border-[#e5e1da]"
                    }`}>
                      <div className="relative flex-shrink-0">
                        <svg width="56" height="56" viewBox="0 0 72 72">
                          <circle cx="36" cy="36" r={radius} fill="none" stroke={isUrgent ? "#fee2e2" : "#e5f7ed"} strokeWidth="5"/>
                          <circle
                            cx="36" cy="36" r={radius} fill="none"
                            stroke={isUrgent ? "#ef4444" : "#00a94f"}
                            strokeWidth="5" strokeLinecap="round"
                            strokeDasharray={`${strokeDash} ${circumference}`}
                            transform="rotate(-90 36 36)"
                            style={{ transition: "stroke-dasharray 1s linear, stroke 0.5s" }}
                          />
                          <text x="36" y="42" textAnchor="middle" fontSize="14" fontWeight="700"
                            fill={isUrgent ? "#ef4444" : "#00a94f"} fontFamily="monospace">
                            {formatTime(timeLeftMs)}
                          </text>
                        </svg>
                      </div>
                      <div className="min-w-0">
                        <p className={`text-xs font-bold ${isUrgent ? "text-rose-700" : "text-[#2c2a29]"}`}>
                          QR expires in {formatTime(timeLeftMs)}
                        </p>
                        <p className="text-[10px] text-[#7c756d] mt-0.5">
                          {isUrgent ? "Complete payment now!" : "Single-use · Valid 30 min"}
                        </p>
                      </div>
                    </div>

                    {/* Waiting indicator */}
                    <div className="flex items-center gap-2 px-3 py-2 bg-green-50 border border-green-200 rounded-xl">
                      <span className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0 animate-pulse" />
                      <span className="text-xs font-medium text-green-700">Waiting for payment confirmation…</span>
                    </div>

                    {/* How to pay steps */}
                    <div className="bg-[#faf9f6] border border-[#e5e1da] rounded-xl p-3 space-y-2">
                      <p className="text-[10px] font-bold text-[#7c756d] uppercase tracking-wider flex items-center gap-1.5">
                        <Smartphone size={11} /> How to pay via GCash
                      </p>
                      {[
                        "Open your GCash app",
                        `Tap "Pay QR" or "Scan QR"`,
                        "Scan the QR code",
                        `Confirm ₱${amount.toLocaleString("en-PH", { minimumFractionDigits: 2 })} and complete`,
                      ].map((step, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <span className="w-5 h-5 rounded-full bg-[#00a94f] text-white text-[9px] font-bold flex items-center justify-center flex-shrink-0">{i + 1}</span>
                          <span className="text-[11px] text-[#2c2a29]">{step}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Proof form */}
                {proofFormJsx}
              </div>
            )}

            {/* ── NO QR / MANUAL SEND MONEY STATE ─────────────────────────── */}
            {modalState === "no_qr" && session && (
              <div className="space-y-4">

                {/* Icon + heading */}
                <div className="flex flex-col items-center gap-2 text-center py-2">
                  <div className="w-14 h-14 rounded-2xl bg-green-100 flex items-center justify-center">
                    <Smartphone size={26} className="text-green-600" />
                  </div>
                  <p className="text-sm font-black text-[#2c2a29]">Send via GCash "Send Money"</p>
                  <p className="text-xs text-[#7c756d] max-w-xs leading-relaxed">
                    This studio hasn't uploaded a QR code yet. Send the exact amount directly to their GCash number.
                  </p>
                </div>

                {/* Exact amount highlight */}
                <div className="bg-green-50 border border-green-200 rounded-2xl p-4 text-center">
                  <p className="text-[10px] font-bold text-green-700 uppercase tracking-wider mb-1">Exact amount to send</p>
                  <p className="text-3xl font-black text-[#2c2a29]">
                    ₱{amount.toLocaleString("en-PH", { minimumFractionDigits: 2 })}
                  </p>
                </div>

                {/* Steps */}
                <div className="bg-[#faf9f6] border border-[#e5e1da] rounded-2xl p-4 space-y-2.5">
                  <p className="text-[10px] font-bold text-[#7c756d] uppercase tracking-wider">Step-by-step guide</p>
                  {[
                    `Open GCash → tap "Send Money"`,
                    `Enter number: ${studioOwnerInfo?.gcashNumber || "studio's GCash number"}`,
                    `Enter exact amount: ₱${amount.toLocaleString("en-PH", { minimumFractionDigits: 2 })}`,
                    "Complete the transfer, note your ref #",
                    "Submit your receipt below",
                  ].map((step, i) => (
                    <div key={i} className="flex items-start gap-3">
                      <span className="w-5 h-5 rounded-full bg-[#00a94f] text-white text-[9px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">{i + 1}</span>
                      <span className="text-xs text-[#2c2a29] leading-relaxed">{step}</span>
                    </div>
                  ))}
                </div>

                {/* Waiting indicator */}
                <div className="flex items-center gap-2 px-3 py-2.5 bg-green-50 border border-green-200 rounded-xl">
                  <span className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0 animate-pulse" />
                  <span className="text-xs font-medium text-green-700">Waiting for payment confirmation…</span>
                </div>

                {/* Proof form */}
                {proofFormJsx}
              </div>
            )}

            {/* ── PAID STATE ────────────────────────────────────────────────── */}
            {modalState === "paid" && (
              <div className="flex flex-col items-center gap-4 py-4 text-center">
                {/* Success icon */}
                <div className="w-20 h-20 rounded-full bg-green-100 border-4 border-green-200 flex items-center justify-center"
                  style={{ animation: "paySuccessPop 0.5s cubic-bezier(0.34,1.56,0.64,1)" }}>
                  <CheckCircle2 size={40} className="text-green-500" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-[#2c2a29]">Payment Received!</h3>
                  <p className="text-2xl font-black text-green-600 mt-1">
                    ₱{amount.toLocaleString("en-PH", { minimumFractionDigits: 2 })}
                  </p>
                </div>

                {proofSubmitted ? (
                  <div className="bg-green-50 border border-green-200 rounded-2xl p-4 space-y-1 w-full">
                    <p className="text-sm font-bold text-green-700">✅ Receipt submitted!</p>
                    <p className="text-xs text-green-600">Your booking will be confirmed once the studio verifies the payment.</p>
                  </div>
                ) : (
                  <div className="border border-[#e5e1da] rounded-2xl overflow-hidden w-full text-left">
                    <div className="bg-[#faf9f6] border-b border-[#e5e1da] px-4 py-3">
                      <p className="text-xs font-bold text-[#2c2a29] flex items-center gap-2">
                        <Camera size={13} className="text-amber-600" /> Attach your GCash receipt screenshot
                      </p>
                    </div>
                    <div className="p-4 space-y-3">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-[#7c756d] uppercase tracking-wider">GCash Reference No.</label>
                        <input type="text" value={refNo} onChange={e => setRefNo(e.target.value)}
                          placeholder="e.g. 1029 3847 5612"
                          className="w-full px-3 py-2.5 text-xs border border-[#e5e1da] rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-300 bg-white text-[#2c2a29]" />
                      </div>
                      <label className={`flex items-center gap-3 px-3 py-3 border-2 border-dashed rounded-xl cursor-pointer transition-colors ${
                        receiptBase64 ? "border-green-300 bg-green-50" : "border-[#e5e1da] hover:border-amber-300 bg-[#faf9f6]"
                      }`}>
                        <input type="file" accept="image/*" onChange={handleReceiptUpload} className="sr-only" />
                        {receiptBase64 ? (
                          <span className="text-xs font-bold text-green-700 flex items-center gap-2"><CheckCircle2 size={13} /> Screenshot attached!</span>
                        ) : (
                          <span className="text-xs text-[#7c756d] flex items-center gap-2"><Upload size={13} /> Click to upload receipt screenshot</span>
                        )}
                      </label>
                      {proofError && <p className="text-xs text-rose-600">{proofError}</p>}
                      <button type="button" onClick={handleSubmitProof} disabled={isSubmittingProof}
                        className="w-full py-2.5 bg-[#2c2a29] hover:bg-[#1a1918] text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-colors disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2">
                        {isSubmittingProof ? <><Loader2 size={12} className="animate-spin" /> Submitting…</> : <><FileCheck size={12} /> Submit to Studio Owner</>}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── EXPIRED STATE ─────────────────────────────────────────────── */}
            {modalState === "expired" && (
              <div className="flex flex-col items-center gap-4 py-4 text-center">
                <div className="w-16 h-16 rounded-2xl bg-amber-100 flex items-center justify-center">
                  <Clock size={30} className="text-amber-600" />
                </div>
                <div>
                  <h3 className="text-base font-black text-[#2c2a29]">Session Expired</h3>
                  <p className="text-xs text-[#7c756d] mt-1 max-w-xs">This payment session expired after 30 minutes. Start a new one to continue.</p>
                </div>
                <button onClick={generateQR} disabled={isGenerating}
                  className="flex items-center gap-2 px-5 py-2.5 bg-[#2c2a29] hover:bg-[#1a1918] text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-colors disabled:opacity-50 cursor-pointer">
                  {isGenerating ? <><Loader2 size={13} className="animate-spin" /> Starting…</> : <><RefreshCw size={13} /> Start New Session</>}
                </button>
              </div>
            )}

            {/* ── ERROR STATE ───────────────────────────────────────────────── */}
            {modalState === "error" && (
              <div className="flex flex-col items-center gap-4 py-4 text-center">
                <div className="w-16 h-16 rounded-2xl bg-rose-100 flex items-center justify-center">
                  <AlertCircle size={30} className="text-rose-500" />
                </div>
                <div>
                  <h3 className="text-base font-black text-[#2c2a29]">Connection Error</h3>
                  <p className="text-xs text-[#7c756d] mt-1 max-w-xs">{error}</p>
                </div>
                <button onClick={generateQR} disabled={isGenerating}
                  className="flex items-center gap-2 px-5 py-2.5 bg-[#2c2a29] hover:bg-[#1a1918] text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-colors disabled:opacity-50 cursor-pointer">
                  {isGenerating ? <><Loader2 size={13} className="animate-spin" /> Retrying…</> : <><RefreshCw size={13} /> Try Again</>}
                </button>
              </div>
            )}

          </div>
        </div>

        {/* ── FOOTER ─────────────────────────────────────────────────────── */}
        <div className="border-t border-[#f0ede8] px-5 py-3 flex-shrink-0">
          {(modalState === "qr_ready" || modalState === "waiting") && session?.qrCodeData ? (
            <div className="flex items-center justify-between gap-3">
              <button onClick={downloadQR}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-[#faf9f6] hover:bg-[#f0ede8] border border-[#e5e1da] rounded-xl text-xs font-bold text-[#2c2a29] transition-colors cursor-pointer">
                <Download size={12} /> Download QR
              </button>
              <div className="flex items-center gap-1.5 text-[10px] text-[#b0aa9f]">
                <QrCode size={11} />
                <span>GCash · Maya · QR Ph compatible</span>
              </div>
            </div>
          ) : modalState === "paid" ? (
            <button onClick={onClose}
              className="w-full py-2.5 bg-green-500 hover:bg-green-600 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer flex items-center justify-center gap-2">
              <CheckCircle2 size={13} /> Done
            </button>
          ) : (
            <div className="flex items-center justify-center gap-1.5 text-[10px] text-[#b0aa9f]">
              <Lock size={10} />
              <span>Payments go directly to the studio owner's GCash</span>
            </div>
          )}
        </div>

      </div>

      <style>{`
        @keyframes payModalIn {
          from { opacity: 0; transform: translateY(40px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes paySuccessPop {
          from { transform: scale(0); opacity: 0; }
          to   { transform: scale(1); opacity: 1; }
        }
        @media (max-width: 639px) {
          [data-pay-modal] {
            border-bottom-left-radius: 0 !important;
            border-bottom-right-radius: 0 !important;
          }
        }
      `}</style>
    </div>
  );
}
