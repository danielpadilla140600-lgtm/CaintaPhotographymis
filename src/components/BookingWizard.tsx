import React, { useState, useEffect } from "react";
import {
  X, Calendar, Clock, Check, ChevronRight, ChevronLeft,
  CreditCard, Camera, Info, Upload, AlertTriangle, QrCode,
  Download, Copy, CheckCircle2, User, Phone, Mail, FileText, ShieldAlert,
  ArrowRight, ShieldCheck, RefreshCw
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import QRCode from "qrcode";
import { SoundEngine } from "../utils/soundEffects.ts";
import { apiRequest, ApiError } from "../utils/apiClient.ts";
import {
  generateTimeSlots,
  isDateBlocked,
  getAvailabilityForDate,
  parseHHMM,
  computeDateSlots,
  DateSlotsResult,
  SlotDetail,
  StudioAvailabilityRule,
  StudioBlackoutRule
} from "../utils/availability.ts";

interface BookingWizardProps {
  studio: any;
  services: any[];
  packages: any[];
  addons: any[];
  currentUser: any | null;
  onClose: () => void;
  onSuccess: (bookingId: string) => void;
  initialDate?: string;
}

export default function BookingWizard({
  studio,
  services,
  packages,
  addons,
  currentUser,
  onClose,
  onSuccess,
  initialDate
}: BookingWizardProps) {
  // Step sequence:
  // 1. Service & Package -> 2. Date & Time -> 3. Customer Info -> 4. Review & Price -> 5. Terms & Conditions -> 6. GCash / Maya Payment -> 7. Success
  const [step, setStep] = useState(1);
  const [shutterActive, setShutterActive] = useState(false);

  // Form state
  const [selectedService, setSelectedService] = useState<any>(services[0] || null);
  const [selectedPackage, setSelectedPackage] = useState<any>(null);
  const [selectedDate, setSelectedDate] = useState<string>(initialDate || "");
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<string>("");
  const [selectedAddons, setSelectedAddons] = useState<{ addonId: string; quantity: number; price: number }[]>([]);
  const [customerNotes, setCustomerNotes] = useState("");

  // Customer contact info
  const [customerName, setCustomerName] = useState(currentUser?.fullName || "");
  const [customerEmail, setCustomerEmail] = useState(currentUser?.email || "");
  const [customerPhone, setCustomerPhone] = useState(currentUser?.contactNumber || "");

  // Price & Payment state — GCash and Maya are the only supported methods.
  // Bank Transfer / QR Ph is intentionally not offered.
  const [selectedPayMethod, setSelectedPayMethod] = useState<"gcash" | "maya">("gcash");
  const payMethodLabel: "GCash" | "Maya" = selectedPayMethod === "maya" ? "Maya" : "GCash";
  const [paymentOption, setPaymentOption] = useState<"Downpayment" | "Full Payment">("Downpayment");
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [refNo, setRefNo] = useState("");
  const [uploadProof, setUploadProof] = useState<string>("");
  const [copiedPhone, setCopiedPhone] = useState(false);

  // Created booking & QR state
  const [createdBooking, setCreatedBooking] = useState<any>(null);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>("");
  const [qrLoading, setQrLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Existing bookings for conflict detection
  const [existingBookings, setExistingBookings] = useState<any[]>([]);
  // Studio owner real-time availability and blackouts
  const [studioAvailability, setStudioAvailability] = useState<StudioAvailabilityRule[]>([]);
  const [studioBlackouts, setStudioBlackouts] = useState<StudioBlackoutRule[]>([]);

  useEffect(() => {
    if (currentUser) {
      if (!customerName) setCustomerName(currentUser.fullName || "");
      if (!customerEmail) setCustomerEmail(currentUser.email || "");
      if (!customerPhone) setCustomerPhone(currentUser.contactNumber || "");
    }
  }, [currentUser]);

  const refreshStudioBookings = async () => {
    if (!studio?.id) return;
    try {
      // Exclude this wizard's own unpaid draft so the availability grid never
      // renders the previously chosen slot as taken after going Back.
      const draftParam = createdBooking?.id ? `&excludeDraftId=${encodeURIComponent(createdBooking.id)}` : "";
      const data = await apiRequest(`/api/bookings?studioId=${studio.id}${draftParam}`);
      if (data.bookings) setExistingBookings(data.bookings);
    } catch (err) {
      console.error("Failed to fetch studio bookings", err);
    }
  };

  // Fetch studio owner availability and blackouts in real time
  useEffect(() => {
    if (!studio?.id) return;
    apiRequest(`/api/studios/${studio.id}/availability`)
      .then(res => {
        if (Array.isArray(res.availability)) setStudioAvailability(res.availability);
      })
      .catch(err => console.error("Failed to load studio availability", err));

    apiRequest(`/api/studios/${studio.id}/blackouts`)
      .then(res => {
        if (Array.isArray(res.blackouts)) setStudioBlackouts(res.blackouts);
      })
      .catch(err => console.error("Failed to load studio blackouts", err));
  }, [studio?.id]);

  // Refresh the grid whenever the selected date changes OR the wizard's draft
  // moves (createdBooking changes) so an amended draft never shows its old
  // slot as taken for the same customer.
  useEffect(() => {
    if (studio?.id) {
      refreshStudioBookings();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studio?.id, selectedDate, createdBooking?.id, createdBooking?.bookingDate, createdBooking?.timeSlot]);

  // Release this wizard's unpaid draft when it is closed/abandoned before any
  // payment proof is submitted, so the held slot becomes available again and
  // no orphan "Awaiting Payment" record lingers in My Bookings.
  const draftVoidedRef = React.useRef(false);
  const voidUnpaidDraft = async () => {
    const draftId = createdBooking?.id;
    if (!draftId || draftVoidedRef.current) return;
    draftVoidedRef.current = true;
    try {
      await apiRequest(`/api/bookings/${draftId}/void-draft`, { method: "PUT" });
    } catch (err) {
      console.warn("Draft void notice:", err);
    }
  };

  // (Tab-close abandonment is covered by the 24h paymentDueAt expiry sweep;
  // no beacon call here because void-draft requires an authenticated PUT.)

  // Auto set date for next available day
  useEffect(() => {
    if (!selectedDate) {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      setSelectedDate(tomorrow.toISOString().split("T")[0]);
    }
  }, []);

  function parseTimeToMinutes(timeStr: string): number {
    if (!timeStr) return 540;
    const clean = timeStr.trim().toUpperCase();
    const isPM = clean.includes("PM");
    const isAM = clean.includes("AM");
    const numbers = clean.replace(/[^0-9:]/g, "");
    const parts = numbers.split(":");
    let hours = parseInt(parts[0], 10) || 9;
    const minutes = parseInt(parts[1], 10) || 0;
    if (isPM && hours < 12) hours += 12;
    if (isAM && hours === 12) hours = 0;
    return hours * 60 + minutes;
  }

  const isSlotBooked = (slot: string) => {
    if (!selectedDate) return false;
    let shootDuration = 60;
    if (selectedPackage) {
      shootDuration = selectedPackage.durationMinutes || 60;
    } else if (selectedService) {
      shootDuration = selectedService.durationMinutes || 60;
    }
    const newStartMinutes = parseTimeToMinutes(slot);
    const newEndMinutes = newStartMinutes + shootDuration;

    // Check partial-day blackouts on this date
    const inBlackout = studioBlackouts.some(b => {
      if (b.blackoutDate !== selectedDate) return false;
      const bStart = parseHHMM(b.startTime);
      const bEnd = parseHHMM(b.endTime);
      return newStartMinutes < bEnd && newEndMinutes > bStart;
    });
    if (inBlackout) return true;

    return existingBookings.some((b: any) => {
      if (studio?.id && b.studioId && b.studioId !== studio.id) return false;
      // Ignore this wizard's own unpaid draft so going Back never marks the
      // previously chosen slot as taken for the same customer.
      if (createdBooking?.id && b.id === createdBooking.id) return false;
      if (b.bookingDate !== selectedDate) return false;
      if (["Cancelled", "Rejected", "Expired"].includes(b.status)) return false;
      let existingDuration = 60;
      if (b.packageId) {
        const p = packages.find(pkg => pkg.id === b.packageId);
        if (p?.durationMinutes) existingDuration = p.durationMinutes;
      } else if (b.serviceId) {
        const s = services.find(srv => srv.id === b.serviceId);
        if (s?.durationMinutes) existingDuration = s.durationMinutes;
      }
      const existingStart = parseTimeToMinutes(b.timeSlot);
      const existingEnd = existingStart + existingDuration;
      return newStartMinutes < existingEnd && newEndMinutes > existingStart;
    });
  };

  // Dynamically compute real-time date slots and availability
  const dateSlotsResult: DateSlotsResult = React.useMemo(() => {
    return computeDateSlots({
      dateStr: selectedDate,
      service: selectedService,
      packageObj: selectedPackage,
      studio,
      availabilities: studioAvailability,
      blackouts: studioBlackouts,
      existingBookings,
      excludeBookingId: createdBooking?.id,
      services,
      packages
    });
  }, [
    selectedDate,
    selectedService,
    selectedPackage,
    studio,
    studioAvailability,
    studioBlackouts,
    existingBookings,
    createdBooking?.id,
    services,
    packages
  ]);

  useEffect(() => {
    if (selectedTimeSlot) {
      const active = dateSlotsResult.slots.find(s => s.slot === selectedTimeSlot);
      if (active && !active.available) {
        setSelectedTimeSlot("");
      }
    }
  }, [dateSlotsResult.slots, selectedTimeSlot]);

  const triggerShutterEffect = (callback: () => void) => {
    setShutterActive(true);
    SoundEngine.playShutter();
    setTimeout(() => {
      callback();
    }, 250);
    setTimeout(() => {
      setShutterActive(false);
    }, 500);
  };

  const handleAddonToggle = (addon: any) => {
    const exists = selectedAddons.find(a => a.addonId === addon.id);
    if (exists) {
      setSelectedAddons(prev => prev.filter(a => a.addonId !== addon.id));
    } else {
      setSelectedAddons(prev => [...prev, { addonId: addon.id, quantity: 1, price: addon.price }]);
    }
  };

  // Price calculations
  const packagePrice = selectedPackage ? selectedPackage.price : (selectedService?.basePrice || 0);
  const addonsTotal = selectedAddons.reduce((sum, a) => sum + (a.price * a.quantity), 0);
  const totalAmount = packagePrice + addonsTotal;
  const downPaymentAmount = Math.round(totalAmount * 0.3 * 100) / 100;
  const exactAmountToPay = paymentOption === "Full Payment" ? totalAmount : downPaymentAmount;

  // Studio Owner direct GCash info
  const studioGcashName = studio?.gcashAccountName || studio?.name || "Studio Owner";
  const studioGcashNumber = studio?.gcashNumber || String(studio?.contactInfo || "0917 123 4567");
  const cleanStudioPhone = studioGcashNumber.replace(/[^0-9]/g, "");

  // Generate QR code whenever reaching payment step or changing payment option
  useEffect(() => {
    if (step === 6) {
      generateStudioGcashQR();
    }
  }, [step, exactAmountToPay]);

  const generateStudioGcashQR = async () => {
    setQrLoading(true);
    try {
      if (studio?.gcashQrCode) {
        setQrCodeDataUrl(studio.gcashQrCode);
        setQrLoading(false);
        return;
      }
      const refCode = createdBooking?.id || `BK-${Date.now().toString().slice(-6)}`;
      const qrPayload = `https://get.gcash.com/pay?account=${encodeURIComponent(cleanStudioPhone)}&name=${encodeURIComponent(studioGcashName)}&amount=${exactAmountToPay.toFixed(2)}&ref=${refCode}`;
      const dataUrl = await QRCode.toDataURL(qrPayload, {
        errorCorrectionLevel: "M",
        margin: 2,
        scale: 8,
        color: { dark: "#005ce6", light: "#ffffff" }
      });
      setQrCodeDataUrl(dataUrl);
    } catch (err) {
      console.error("QR Generation error:", err);
    } finally {
      setQrLoading(false);
    }
  };

  const copyNumber = () => {
    navigator.clipboard.writeText(studioGcashNumber);
    setCopiedPhone(true);
    setTimeout(() => setCopiedPhone(false), 2000);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith("image/") || file.size > 8 * 1024 * 1024) {
        setErrorMsg("Please choose an image smaller than 8 MB (JPG/PNG).");
        return;
      }
      setErrorMsg("");
      const reader = new FileReader();
      reader.onloadend = () => {
        setUploadProof(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // Step 1 -> 2
  const handleProceedFromService = () => {
    if (!selectedService) {
      setErrorMsg("Please choose a photography service to proceed.");
      return;
    }
    setErrorMsg("");
    triggerShutterEffect(() => setStep(2));
  };

  // Step 2 -> 3
  const handleProceedFromDateTime = () => {
    if (!selectedDate || !selectedTimeSlot) {
      setErrorMsg("Please select both a date and an available time slot.");
      return;
    }
    setErrorMsg("");
    triggerShutterEffect(() => setStep(3));
  };

  // Step 3 -> 4
  const handleProceedFromCustomerInfo = () => {
    if (!currentUser) {
      setErrorMsg("Please log in to complete your booking.");
      return;
    }
    if (!customerName.trim() || !customerPhone.trim() || !customerEmail.trim()) {
      setErrorMsg("Full name, valid email, and contact phone are required.");
      return;
    }
    setErrorMsg("");
    triggerShutterEffect(() => setStep(4));
  };

  // Step 4 -> 5 (Review to Terms & Conditions)
  const handleProceedToTerms = () => {
    setErrorMsg("");
    triggerShutterEffect(() => setStep(5));
  };

  // Step 5 -> 6 (Accept Terms & Initialize Booking for GCash Payment)
  const handleAcceptTermsAndProceedToPayment = async () => {
    if (!agreedToTerms) {
      setErrorMsg("You must read and acknowledge the Terms and Conditions before proceeding to payment.");
      return;
    }
    setErrorMsg("");
    setLoading(true);

    try {
      // Create (or amend, when returning via Back) the tentative booking draft.
      // Passing amendBookingId makes Step 5 -> 6 idempotent: the same draft is
      // updated in place instead of inserting a duplicate booking record.
      const bookingPayload = {
        studioId: studio.id,
        customerId: currentUser.id,
        serviceId: selectedService.id,
        packageId: selectedPackage?.id,
        bookingDate: selectedDate,
        timeSlot: selectedTimeSlot,
        addons: selectedAddons,
        customerDetails: {
          fullName: customerName,
          email: customerEmail,
          phone: customerPhone,
          notes: customerNotes
        },
        totalAmount,
        paymentOption,
        agreedToTerms: true,
        amendBookingId: createdBooking?.id
      };

      const data = await apiRequest("/api/bookings", {
        method: "POST",
        body: bookingPayload
      });

      setCreatedBooking(data.booking);
      draftVoidedRef.current = false;
      // Refresh availability so the grid reflects the draft's (possibly moved) slot.
      refreshStudioBookings();

      // Initialize GCash QR session on backend
      try {
        await apiRequest("/api/payments/gcash/create-qr", {
          method: "POST",
          body: {
            bookingId: data.booking.id,
            studioId: studio.id,
            amount: exactAmountToPay,
            paymentType: paymentOption
          }
        });
      } catch (qrErr) {
        console.warn("Server QR session registered via local generation", qrErr);
      }

      SoundEngine.playSuccess();
      triggerShutterEffect(() => setStep(6));
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to initialize booking. Please try another time slot.");
    } finally {
      setLoading(false);
    }
  };

  // Step 6 -> 7 (Submit Payment Proof directly to Studio Owner)
  const handleSubmitPaymentProof = async () => {
    if (!refNo.trim()) {
      setErrorMsg(`Please enter the ${payMethodLabel} reference number from your receipt.`);
      return;
    }
    if (!uploadProof) {
      setErrorMsg(`Please upload your ${payMethodLabel} payment screenshot receipt.`);
      return;
    }

    setLoading(true);
    setErrorMsg("");

    try {
      const bId = createdBooking?.id;
      if (!bId) throw new Error("Booking record not found. Please try again.");

      // Submit payment directly for studio owner verification
      await apiRequest("/api/payments", {
        method: "POST",
        body: {
          bookingId: bId,
          amount: exactAmountToPay,
          paymentType: paymentOption,
          paymentMethod: payMethodLabel,
          referenceNumber: refNo.trim(),
          proofOfPayment: uploadProof
        }
      });

      SoundEngine.playSuccess();
      setSuccessMsg("Payment proof submitted directly to studio owner!");
      triggerShutterEffect(() => setStep(7));
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to submit payment proof. Please verify your reference number.");
    } finally {
      setLoading(false);
    }
  };

  // Closing the wizard (X / backdrop) before any payment proof is submitted
  // voids the unpaid draft so its slot is released and no orphan
  // "Awaiting Payment" record stays in My Bookings. After payment proof is
  // submitted (step 7) the booking must be kept.
  const handleCloseWizard = async () => {
    if (createdBooking?.id && step < 7) {
      await voidUnpaidDraft();
    }
    onClose();
  };

  const stepsList = [
    "Select Service",
    "Date & Time",
    "Customer Info",
    "Review & Price",
    "Terms & Conditions",
    "GCash / Maya Payment"
  ];

  return (
    <div className="fixed inset-0 z-50 overflow-hidden flex justify-end">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={handleCloseWizard} />

      {/* Shutter Animation Effect overlay */}
      <AnimatePresence>
        {shutterActive && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="absolute inset-0 bg-zinc-950/95 backdrop-blur-md z-50 flex flex-col items-center justify-center text-white"
          >
            <div className="relative w-48 h-48 flex items-center justify-center">
              <div className="absolute top-0 left-0 w-6 h-6 border-t-2 border-l-2 border-amber-400" />
              <div className="absolute top-0 right-0 w-6 h-6 border-t-2 border-r-2 border-amber-400" />
              <div className="absolute bottom-0 left-0 w-6 h-6 border-b-2 border-l-2 border-amber-400" />
              <div className="absolute bottom-0 right-0 w-6 h-6 border-b-2 border-r-2 border-amber-400" />
              <motion.div
                animate={{
                  scale: [0.85, 1.05, 0.85],
                  borderColor: ["rgba(251, 191, 36, 0.4)", "rgba(16, 185, 129, 0.8)", "rgba(251, 191, 36, 0.4)"]
                }}
                transition={{ repeat: Infinity, duration: 1.5, ease: "easeInOut" }}
                className="w-24 h-24 rounded-full border-2 border-dashed flex items-center justify-center"
              >
                <motion.div
                  animate={{ scale: [1, 1.4, 1] }}
                  transition={{ repeat: Infinity, duration: 0.75 }}
                  className="w-3 h-3 rounded-full bg-emerald-500 shadow-lg shadow-emerald-500/50"
                />
              </motion.div>
            </div>
            <div className="mt-6 text-center space-y-1">
              <p className="font-mono text-xs tracking-[0.3em] text-zinc-400 uppercase">Cainta MIS Studio Booking</p>
              <h4 className="font-display text-lg font-bold text-white tracking-widest uppercase">Capturing Step...</h4>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Slide-out Panel */}
      <motion.div
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ type: "spring", damping: 30, stiffness: 300 }}
        className="relative bg-[#faf9f6] w-full max-w-xl h-full shadow-2xl flex flex-col z-10 border-l border-[#e5e1da]"
      >
        {/* Header */}
        <div className="bg-[#2c2a29] text-white p-5 flex items-center justify-between border-b border-white/10 shadow-md">
          <div>
            <span className="text-[10px] uppercase tracking-wider text-amber-400 font-bold">Studio Booking & Payment</span>
            <h3 className="font-display text-lg font-bold text-[#faf9f6] leading-tight">{studio.name}</h3>
          </div>
          <button onClick={handleCloseWizard} className="p-1.5 rounded-full hover:bg-white/10 text-white transition-colors cursor-pointer">
            <X size={20} />
          </button>
        </div>

        {/* Step progress indicators */}
        <div className="bg-white border-b border-[#e5e1da] px-4 py-2.5 flex justify-between items-center text-xs overflow-x-auto">
          {stepsList.map((st, i) => (
            <div key={i} className="flex items-center gap-1 flex-shrink-0">
              <span className={`w-5 h-5 rounded-full flex items-center justify-center font-bold text-[10px] ${
                step === i + 1
                  ? "bg-[#2c2a29] text-white"
                  : step > i + 1
                  ? "bg-emerald-600 text-white"
                  : "bg-[#e5e1da] text-[#7c756d]"
              }`}>
                {step > i + 1 ? <Check size={10} /> : i + 1}
              </span>
              <span className={`text-[11px] font-medium hidden md:inline ${step === i + 1 ? "text-[#2c2a29] font-bold" : "text-[#7c756d]"}`}>{st}</span>
              {i < stepsList.length - 1 && <span className="text-gray-300 text-[10px] mx-1">/</span>}
            </div>
          ))}
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {errorMsg && (
            <div className="bg-rose-50 border border-rose-200 text-rose-800 p-4 rounded-xl flex items-start gap-3 shadow-sm">
              <AlertTriangle className="text-rose-600 flex-shrink-0 mt-0.5" size={18} />
              <div className="text-xs font-semibold">{errorMsg}</div>
            </div>
          )}

          {successMsg && (
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-4 rounded-xl flex items-start gap-3 shadow-sm">
              <Check className="text-emerald-600 flex-shrink-0 mt-0.5" size={18} />
              <div className="text-xs font-semibold">{successMsg}</div>
            </div>
          )}

          {/* STEP 1: Select Service / Package */}
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <h4 className="font-display text-lg font-bold text-[#2c2a29]">1. Select Photography Service</h4>
                <p className="text-xs text-[#7c756d]">Choose your session category tailored to your milestone in Cainta.</p>
              </div>

              <div className="grid gap-3">
                {services.map((srv) => (
                  <div
                    key={srv.id}
                    onClick={() => { setSelectedService(srv); setSelectedPackage(null); }}
                    className={`p-4 rounded-xl border-2 flex gap-4 cursor-pointer transition-all ${
                      selectedService?.id === srv.id
                        ? "border-[#2c2a29] bg-white shadow-md scale-[1.01]"
                        : "border-[#e5e1da] bg-white hover:border-[#7c756d]/50"
                    }`}
                  >
                    <img src={srv.image || "/placeholder.jpg"} alt={srv.name} className="w-16 h-16 rounded-lg object-cover flex-shrink-0" />
                    <div className="flex-1 text-left">
                      <div className="flex justify-between items-start">
                        <h5 className="font-bold text-sm text-[#2c2a29]">{srv.name}</h5>
                        <span className="font-bold text-xs text-[#2c2a29] bg-[#faf9f6] px-2 py-0.5 rounded-full border border-[#e5e1da]">
                          ₱{srv.basePrice?.toLocaleString()}
                        </span>
                      </div>
                      <p className="text-xs text-[#7c756d] mt-1 line-clamp-2">{srv.description}</p>
                      <div className="flex items-center gap-3 mt-2 text-[10px] text-[#7c756d]">
                        <span className="flex items-center gap-1"><Clock size={11} /> {srv.durationMinutes} mins</span>
                        <span className="bg-amber-100 text-amber-800 px-1.5 py-0.2 rounded font-medium">{srv.category}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Optional Package Selection */}
              {packages && packages.length > 0 && (
                <div className="pt-4 border-t border-[#e5e1da] space-y-3">
                  <div className="text-left">
                    <h5 className="font-bold text-sm text-[#2c2a29]">Upgrade with a Featured Package (Optional)</h5>
                    <p className="text-[11px] text-[#7c756d]">Includes edited prints, multiple photographers, and extra studio perks.</p>
                  </div>
                  <div className="grid gap-2">
                    {packages.map((pkg) => (
                      <div
                        key={pkg.id}
                        onClick={() => setSelectedPackage(selectedPackage?.id === pkg.id ? null : pkg)}
                        className={`p-3 rounded-xl border-2 flex items-center justify-between cursor-pointer transition-all ${
                          selectedPackage?.id === pkg.id
                            ? "border-amber-500 bg-amber-50/50 shadow-sm"
                            : "border-[#e5e1da] bg-white hover:border-gray-300"
                        }`}
                      >
                        <div className="text-left pr-2">
                          <p className="font-bold text-xs text-[#2c2a29]">{pkg.name}</p>
                          <p className="text-[10px] text-[#7c756d] line-clamp-1">{pkg.description}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-black text-amber-700">₱{pkg.price?.toLocaleString()}</span>
                          <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${selectedPackage?.id === pkg.id ? "bg-amber-500 text-white border-amber-500" : "border-gray-300"}`}>
                            {selectedPackage?.id === pkg.id && <Check size={10} />}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Optional Add-ons */}
              {addons && addons.length > 0 && (
                <div className="pt-4 border-t border-[#e5e1da] space-y-3">
                  <div className="text-left">
                    <h5 className="font-bold text-sm text-[#2c2a29]">Optional Session Add-ons</h5>
                    <p className="text-[11px] text-[#7c756d]">Hair & makeup, framed prints, or additional companions.</p>
                  </div>
                  <div className="grid gap-2">
                    {addons.map((add) => {
                      const isSelected = selectedAddons.some(a => a.addonId === add.id);
                      return (
                        <div
                          key={add.id}
                          onClick={() => handleAddonToggle(add)}
                          className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                            isSelected ? "border-[#2c2a29] bg-white shadow-xs" : "border-[#e5e1da] bg-white hover:border-[#7c756d]"
                          }`}
                        >
                          <div className="text-left">
                            <p className="font-bold text-xs text-[#2c2a29]">{add.name}</p>
                            <p className="text-[10px] text-[#7c756d]">{add.description}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-[#2c2a29]">+₱{add.price?.toLocaleString()}</span>
                            <div className={`w-4 h-4 rounded border flex items-center justify-center ${isSelected ? "bg-[#2c2a29] text-white" : "border-gray-300"}`}>
                              {isSelected && <Check size={10} />}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STEP 2: Select Date & Time */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="text-left">
                <h4 className="font-display text-lg font-bold text-[#2c2a29]">2. Choose Date & Time Slot</h4>
                <p className="text-xs text-[#7c756d]">Select an available shoot schedule. Booked slots are blocked automatically.</p>
              </div>

              <div className="bg-white border border-[#e5e1da] rounded-2xl p-4 space-y-4 text-left">
                <div>
                  <label className="block text-xs font-bold text-[#2c2a29] mb-1.5 flex items-center gap-1.5">
                    <Calendar size={14} className="text-amber-600" /> Select Session Date
                  </label>
                  <input
                    type="date"
                    value={selectedDate}
                    min={new Date().toISOString().split("T")[0]}
                    onChange={e => setSelectedDate(e.target.value)}
                    className="w-full bg-[#faf9f6] border border-[#e5e1da] rounded-xl px-3 py-2 text-xs font-bold text-[#2c2a29] focus:outline-none focus:border-[#2c2a29]"
                  />
                </div>

                {/* Date Status Notices */}
                {selectedDate && dateSlotsResult.isBlocked && (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs font-bold text-amber-800 flex items-center gap-2">
                    <AlertTriangle size={15} className="shrink-0 text-amber-600" />
                    <span>{dateSlotsResult.blockedReason || "The studio is closed on this date (Scheduled holiday / blocked date)."}</span>
                  </div>
                )}

                {selectedDate && !dateSlotsResult.isBlocked && dateSlotsResult.isClosed && (
                  <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs font-bold text-rose-800 flex items-center gap-2">
                    <AlertTriangle size={15} className="shrink-0 text-rose-600" />
                    <span>{dateSlotsResult.closedReason || `The studio is closed on ${dateSlotsResult.dayName}s. Please choose another day.`}</span>
                  </div>
                )}

                {selectedDate && !dateSlotsResult.isBlocked && !dateSlotsResult.isClosed && dateSlotsResult.isServiceDayUnavailable && (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs font-bold text-amber-800 flex items-center gap-2">
                    <Info size={15} className="shrink-0 text-amber-600" />
                    <span>{dateSlotsResult.serviceDayReason || "The selected service is not available on this day."}</span>
                  </div>
                )}

                <div>
                  <div className="flex flex-wrap items-center justify-between gap-1.5 mb-2.5">
                    <label className="block text-xs font-bold text-[#2c2a29] flex items-center gap-1.5">
                      <Clock size={14} className="text-amber-600" /> Select Available Time Slot
                    </label>
                    {selectedDate && !dateSlotsResult.isBlocked && !dateSlotsResult.isClosed && !dateSlotsResult.isServiceDayUnavailable && (
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-[#7c756d] font-semibold bg-[#faf9f6] px-2 py-0.5 rounded-md border border-[#e5e1da]">
                          Hours: {dateSlotsResult.openingTime} - {dateSlotsResult.closingTime}
                        </span>
                        <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                          {dateSlotsResult.availableCount} Available
                        </span>
                      </div>
                    )}
                  </div>

                  {!selectedDate ? (
                    <div className="p-4 rounded-xl border border-dashed border-[#e5e1da] text-center text-xs text-[#7c756d]">
                      Please choose a session date above to view real-time available time slots.
                    </div>
                  ) : dateSlotsResult.slots.length === 0 ? (
                    <div className="p-4 rounded-xl border border-dashed border-gray-200 text-center text-xs text-gray-500">
                      No available time slots for this date and service. Please choose another date.
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                      {dateSlotsResult.slots.map((slotItem) => {
                        const isSelected = selectedTimeSlot === slotItem.slot;
                        const isAvailable = slotItem.available;

                        return (
                          <button
                            key={slotItem.slot}
                            type="button"
                            disabled={!isAvailable}
                            onClick={() => setSelectedTimeSlot(slotItem.slot)}
                            className={`p-3 rounded-2xl border text-left transition-all relative flex flex-col justify-between gap-1.5 ${
                              isSelected
                                ? "bg-[#2c2a29] text-white border-[#2c2a29] shadow-md ring-2 ring-amber-500/50"
                                : !isAvailable
                                ? slotItem.status === "booked"
                                  ? "bg-rose-50/70 text-rose-900 border-rose-200 cursor-not-allowed opacity-90 shadow-2xs"
                                  : "bg-gray-50 text-gray-400 border-gray-200 cursor-not-allowed opacity-60"
                                : "bg-[#faf9f6] text-[#2c2a29] border-[#e5e1da] hover:border-[#2c2a29] hover:bg-white cursor-pointer shadow-xs"
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className={`text-xs font-extrabold ${
                                isSelected 
                                  ? "text-white" 
                                  : slotItem.status === "booked" 
                                  ? "text-rose-900 line-through" 
                                  : !isAvailable 
                                  ? "text-gray-400 line-through" 
                                  : "text-[#2c2a29]"
                              }`}>
                                {slotItem.slot}
                              </span>
                              {isSelected && (
                                <CheckCircle2 size={14} className="text-amber-400 shrink-0" />
                              )}
                            </div>

                            <div className="flex items-center gap-1.5 mt-0.5">
                              {isSelected ? (
                                <span className="text-[10px] font-bold text-amber-300">
                                  Selected
                                </span>
                              ) : slotItem.status === "available" ? (
                                <span className="text-[9px] font-bold text-emerald-700 bg-emerald-100/70 px-1.5 py-0.5 rounded flex items-center gap-1">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> Available
                                </span>
                              ) : slotItem.status === "booked" ? (
                                <span className="text-[9px] font-bold text-rose-700 bg-rose-100/90 border border-rose-200 px-1.5 py-0.5 rounded flex items-center gap-1">
                                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500" /> Already Booked
                                </span>
                              ) : slotItem.status === "blackout" ? (
                                <span className="text-[9px] font-bold text-amber-800 bg-amber-100/70 px-1.5 py-0.5 rounded">
                                  Blocked
                                </span>
                              ) : (
                                <span className="text-[9px] font-bold text-gray-500 bg-gray-200 px-1.5 py-0.5 rounded">
                                  Passed
                                </span>
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: Enter Customer Information */}
          {step === 3 && (
            <div className="space-y-4">
              <div className="text-left">
                <h4 className="font-display text-lg font-bold text-[#2c2a29]">3. Customer Information</h4>
                <p className="text-xs text-[#7c756d]">Provide contact information for booking confirmations and studio coordination.</p>
              </div>

              <div className="bg-white border border-[#e5e1da] rounded-2xl p-5 space-y-3.5 text-left">
                <div>
                  <label className="block text-[11px] font-bold text-[#2c2a29] mb-1 flex items-center gap-1">
                    <User size={13} className="text-amber-600" /> Full Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={customerName}
                    onChange={e => setCustomerName(e.target.value)}
                    placeholder="Enter your full name"
                    className="w-full bg-[#faf9f6] border border-[#e5e1da] rounded-xl px-3 py-2 text-xs font-medium text-[#2c2a29] focus:outline-none focus:border-[#2c2a29]"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-[#2c2a29] mb-1 flex items-center gap-1">
                    <Mail size={13} className="text-amber-600" /> Email Address <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="email"
                    value={customerEmail}
                    onChange={e => setCustomerEmail(e.target.value)}
                    placeholder="name@example.com"
                    className="w-full bg-[#faf9f6] border border-[#e5e1da] rounded-xl px-3 py-2 text-xs font-medium text-[#2c2a29] focus:outline-none focus:border-[#2c2a29]"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-[#2c2a29] mb-1 flex items-center gap-1">
                    <Phone size={13} className="text-amber-600" /> Mobile Contact Number <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="tel"
                    value={customerPhone}
                    onChange={e => setCustomerPhone(e.target.value)}
                    placeholder="09XX XXX XXXX"
                    className="w-full bg-[#faf9f6] border border-[#e5e1da] rounded-xl px-3 py-2 text-xs font-medium text-[#2c2a29] focus:outline-none focus:border-[#2c2a29]"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-[#2c2a29] mb-1 flex items-center gap-1">
                    <FileText size={13} className="text-amber-600" /> Special Requests or Session Notes (Optional)
                  </label>
                  <textarea
                    value={customerNotes}
                    onChange={e => setCustomerNotes(e.target.value)}
                    placeholder="Tell us about outfit changes, props, backdrop color preference, or special requirements..."
                    rows={3}
                    className="w-full bg-[#faf9f6] border border-[#e5e1da] rounded-xl p-3 text-xs focus:outline-none focus:border-[#2c2a29]"
                  />
                </div>
              </div>
            </div>
          )}

          {/* STEP 4: Review Booking Details & Price */}
          {step === 4 && (
            <div className="space-y-4">
              <div className="text-left">
                <h4 className="font-display text-lg font-bold text-[#2c2a29]">4. Review Booking Details & Price</h4>
                <p className="text-xs text-[#7c756d]">Confirm your selected photography session and exact amount due before proceeding.</p>
              </div>

              <div className="bg-white border border-[#e5e1da] rounded-2xl p-5 space-y-4 text-left shadow-sm">
                <div>
                  <span className="text-[10px] uppercase tracking-wider text-[#7c756d] font-bold">Studio</span>
                  <p className="text-sm font-bold text-[#2c2a29]">{studio.name}</p>
                  <p className="text-[11px] text-[#7c756d]">{studio.address || studio.location}</p>
                </div>

                <div className="grid grid-cols-2 gap-3 border-t border-gray-100 pt-3">
                  <div>
                    <span className="text-[10px] uppercase tracking-wider text-[#7c756d] font-bold">Service</span>
                    <p className="text-xs font-bold text-[#2c2a29]">{selectedService?.name}</p>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase tracking-wider text-[#7c756d] font-bold">Package</span>
                    <p className="text-xs font-bold text-[#2c2a29]">{selectedPackage?.name || "Standard Base Session"}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 border-t border-gray-100 pt-3">
                  <div>
                    <span className="text-[10px] uppercase tracking-wider text-[#7c756d] font-bold">Shoot Schedule</span>
                    <p className="text-xs font-bold text-[#2c2a29]">{selectedDate}</p>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase tracking-wider text-[#7c756d] font-bold">Time Slot</span>
                    <p className="text-xs font-bold text-[#2c2a29]">{selectedTimeSlot}</p>
                  </div>
                </div>

                {selectedAddons.length > 0 && (
                  <div className="border-t border-gray-100 pt-3">
                    <span className="text-[10px] uppercase tracking-wider text-[#7c756d] font-bold">Add-ons</span>
                    <ul className="text-xs space-y-1 mt-1 text-[#2c2a29]">
                      {selectedAddons.map(sa => {
                        const ad = addons.find(a => a.id === sa.addonId);
                        return <li key={sa.addonId}>• {ad?.name} (+₱{ad?.price?.toLocaleString()})</li>;
                      })}
                    </ul>
                  </div>
                )}

                {/* Payment Option Selection: Downpayment vs Full Payment */}
                <div className="border-t border-gray-100 pt-4 space-y-2">
                  <span className="text-[10px] uppercase tracking-wider text-[#7c756d] font-bold">Choose Payment Amount</span>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setPaymentOption("Downpayment")}
                      className={`p-3 rounded-xl border text-left transition-all ${paymentOption === "Downpayment" ? "border-amber-600 bg-amber-50/60 shadow-xs" : "border-[#e5e1da] bg-white hover:border-gray-300"}`}
                    >
                      <div className="flex items-center gap-1.5">
                        <CreditCard size={14} className="text-amber-700" />
                        <span className="text-xs font-bold text-[#2c2a29]">30% Downpayment</span>
                      </div>
                      <p className="mt-1 text-sm font-black text-amber-900">₱{downPaymentAmount.toLocaleString()}</p>
                      <p className="text-[10px] text-[#7c756d]">Balance at shoot day</p>
                    </button>

                    <button
                      type="button"
                      onClick={() => setPaymentOption("Full Payment")}
                      className={`p-3 rounded-xl border text-left transition-all ${paymentOption === "Full Payment" ? "border-amber-600 bg-amber-50/60 shadow-xs" : "border-[#e5e1da] bg-white hover:border-gray-300"}`}
                    >
                      <div className="flex items-center gap-1.5">
                        <CreditCard size={14} className="text-amber-700" />
                        <span className="text-xs font-bold text-[#2c2a29]">Full Payment</span>
                      </div>
                      <p className="mt-1 text-sm font-black text-amber-900">₱{totalAmount.toLocaleString()}</p>
                      <p className="text-[10px] text-[#7c756d]">100% paid in advance</p>
                    </button>
                  </div>
                </div>

                {/* Total & Due Notice */}
                <div className="border-t border-gray-200 pt-4 flex items-center justify-between">
                  <div>
                    <p className="text-xs text-[#7c756d]">Total Session Price</p>
                    <p className="text-sm font-bold text-[#2c2a29]">₱{totalAmount.toLocaleString()}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] uppercase tracking-wider text-emerald-700 font-extrabold bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                      Exact Amount Due Now
                    </span>
                    <p className="text-xl font-black text-emerald-800 mt-0.5">
                      ₱{exactAmountToPay.toLocaleString("en-PH", { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                </div>

                <div className="bg-[#faf9f6] border border-[#e5e1da] rounded-xl p-3 text-xs text-[#7c756d] flex items-start gap-2">
                  <ShieldCheck size={16} className="text-emerald-700 flex-shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-[#2c2a29]">Direct Studio Payment via GCash or Maya</strong>:
                    <p className="text-[11px] mt-0.5">
                      Payments are made directly to {studio.name}'s verified GCash or Maya account. Bank Transfer / QR Ph has been removed for instant verification.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 5: Display Terms and Conditions */}
          {step === 5 && (
            <div className="space-y-4">
              <div className="text-left">
                <h4 className="font-display text-lg font-bold text-[#2c2a29]">5. Terms and Conditions</h4>
                <p className="text-xs text-[#7c756d]">Please read and accept the studio booking terms before proceeding to GCash payment.</p>
              </div>

              <div className="bg-white border border-[#e5e1da] rounded-2xl p-5 text-left space-y-4 shadow-sm max-h-[360px] overflow-y-auto text-xs text-[#2c2a29]">
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl space-y-1">
                  <h5 className="font-bold text-amber-900 flex items-center gap-1.5">
                    <ShieldAlert size={14} className="text-amber-700" /> Direct Studio Payment Requirement
                  </h5>
                  <p className="text-[11px] text-amber-800 leading-relaxed">
                    Payment is made <strong>directly to the Studio Owner’s GCash or Maya account</strong> ({studioGcashName}). You must transfer the exact amount of <strong>₱{exactAmountToPay.toLocaleString("en-PH", { minimumFractionDigits: 2 })}</strong> and submit your reference number and screenshot receipt. Bank transfer is not accepted.
                  </p>
                </div>

                <div className="space-y-1">
                  <h5 className="font-bold text-rose-900 flex items-center gap-1.5">
                    <X size={14} className="text-rose-700" /> Strict No-Refund Policy
                  </h5>
                  <p className="text-[11px] text-[#7c756d] leading-relaxed">
                    All booking payments (both 30% downpayments and full payments) made to the studio are <strong>strictly non-refundable</strong> once placed. Booking cancellations and refund requests are not supported by the system.
                  </p>
                </div>

                <div className="space-y-1">
                  <h5 className="font-bold text-indigo-900 flex items-center gap-1.5">
                    <RefreshCw size={14} className="text-indigo-700" /> Rescheduling Policy
                  </h5>
                  <p className="text-[11px] text-[#7c756d] leading-relaxed">
                    Instead of cancelling, you may <strong>Reschedule your Booking</strong> through your customer dashboard. Reschedule requests are subject to the Studio Owner's applicable scheduling rules, working hours, and calendar availability, and require Studio Owner approval.
                  </p>
                </div>

                <div className="space-y-1">
                  <h5 className="font-bold text-[#2c2a29] flex items-center gap-1.5">
                    <Clock size={14} className="text-amber-700" /> Booking Validity & Hold Times
                  </h5>
                  <p className="text-[11px] text-[#7c756d] leading-relaxed">
                    Your appointment slot is tentatively reserved while awaiting payment verification by the Studio Owner. Please submit your payment proof promptly so the studio can verify your schedule.
                  </p>
                </div>

                <div className="space-y-1">
                  <h5 className="font-bold text-[#2c2a29] flex items-center gap-1.5">
                    <Camera size={14} className="text-amber-700" /> Studio Restrictions & Guidelines
                  </h5>
                  <p className="text-[11px] text-[#7c756d] leading-relaxed">
                    Please arrive 10–15 minutes prior to your call time. Studio house rules, equipment safety protocols, and gown/wardrobe care guidelines must be respected during the session.
                  </p>
                </div>
              </div>

              {/* Explicit Acceptance Checkbox */}
              <div className="bg-[#faf9f6] border border-[#e5e1da] rounded-2xl p-4 text-left">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={agreedToTerms}
                    onChange={e => setAgreedToTerms(e.target.checked)}
                    className="w-5 h-5 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500 mt-0.5 cursor-pointer"
                  />
                  <span className="text-xs text-[#2c2a29] font-medium leading-snug">
                    I have read, understood, and explicitly agree to the <strong>Terms and Conditions</strong>, including the <strong>Direct Payment to Studio Owner</strong>, <strong>Strict No-Refund Policy</strong>, and <strong>Rescheduling Policy</strong>.
                  </span>
                </label>
              </div>
            </div>
          )}

          {/* STEP 6: Payment Methods & Proof Submission */}
          {step === 6 && (
            <div className="space-y-5">
              <div className="text-left">
                <h4 className="font-display text-lg font-bold text-[#2c2a29]">6. Direct Studio Payment & QR Checkout</h4>
                <p className="text-xs text-[#7c756d]">Select your preferred payment method below. Scan the QR code or copy the account details to transfer.</p>
              </div>

              {/* Payment Method Selector Tabs */}
              <div className="flex rounded-xl p-1 bg-[#faf9f6] border border-[#e5e1da] gap-1">
                <button
                  type="button"
                  onClick={() => setSelectedPayMethod("gcash")}
                  className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                    selectedPayMethod === "gcash"
                      ? "bg-[#005ce6] text-white shadow-xs"
                      : "text-[#7c756d] hover:text-[#2c2a29]"
                  }`}
                >
                  <span className="w-4 h-4 rounded-full bg-white text-[#005ce6] text-[10px] font-black flex items-center justify-center">G</span>
                  GCash
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedPayMethod("maya")}
                  className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                    selectedPayMethod === "maya"
                      ? "bg-teal-600 text-white shadow-xs"
                      : "text-[#7c756d] hover:text-[#2c2a29]"
                  }`}
                >
                  <span className="w-4 h-4 rounded-full bg-white text-teal-700 text-[10px] font-black flex items-center justify-center">M</span>
                  Maya {studio?.mayaQrCode && <span className="w-2 h-2 rounded-full bg-teal-300"></span>}
                </button>
              </div>

              {/* Studio Payment Method Details Card */}
              {selectedPayMethod === "gcash" && (
                <div className="bg-gradient-to-br from-[#005ce6] to-[#0042a6] text-white rounded-2xl p-5 space-y-4 shadow-lg text-left">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center font-black text-[#005ce6] text-sm shadow-sm">
                        G
                      </div>
                      <div>
                        <span className="font-bold text-xs tracking-wider uppercase">Direct GCash Payment</span>
                        <p className="text-[10px] text-blue-100">Pay directly to {studio.name}</p>
                      </div>
                    </div>
                    <span className="bg-white/20 text-white text-[10px] font-bold px-2.5 py-0.5 rounded-full border border-white/30">
                      Studio Verified
                    </span>
                  </div>

                  <div className="bg-white/10 rounded-xl p-3 border border-white/20 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <span className="text-[10px] uppercase text-blue-200 font-semibold">Studio GCash Account Name</span>
                      <p className="text-sm font-bold text-white">{studioGcashName}</p>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase text-blue-200 font-semibold">GCash Mobile Number</span>
                      <div className="flex items-center gap-1.5">
                        <p className="text-sm font-mono font-bold text-white">{studioGcashNumber}</p>
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(studioGcashNumber);
                            setCopiedPhone(true);
                            setTimeout(() => setCopiedPhone(false), 2000);
                          }}
                          className="p-1 bg-white/20 hover:bg-white/30 rounded text-xs text-white transition-colors cursor-pointer"
                          title="Copy number"
                        >
                          {copiedPhone ? <Check size={12} /> : <Copy size={12} />}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Amount to pay */}
                  <div className="bg-white rounded-xl p-3.5 text-center text-[#2c2a29] shadow-sm">
                    <span className="text-[10px] uppercase font-bold text-[#7c756d]">Exact Amount to Transfer</span>
                    <p className="text-2xl font-black text-[#005ce6] mt-0.5">
                      ₱{exactAmountToPay.toLocaleString("en-PH", { minimumFractionDigits: 2 })}
                    </p>
                    <p className="text-[10px] text-[#7c756d]">
                      {paymentOption === "Full Payment" ? "Full Booking Payment" : "30% Downpayment"} · Booking Ref: {createdBooking?.id || "BK-Pending"}
                    </p>
                  </div>
                </div>
              )}

              {selectedPayMethod === "maya" && (
                <div className="bg-gradient-to-br from-teal-900 to-slate-900 text-white rounded-2xl p-5 space-y-4 shadow-lg text-left">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-teal-400 flex items-center justify-center font-black text-slate-950 text-sm shadow-sm">
                        M
                      </div>
                      <div>
                        <span className="font-bold text-xs tracking-wider uppercase">Maya (PayMaya) Transfer</span>
                        <p className="text-[10px] text-teal-200">Pay directly to {studio.name}</p>
                      </div>
                    </div>
                    <span className="bg-teal-500/30 text-teal-200 text-[10px] font-bold px-2.5 py-0.5 rounded-full border border-teal-400/30">
                      Maya Active
                    </span>
                  </div>

                  <div className="bg-white/10 rounded-xl p-3 border border-white/20 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <span className="text-[10px] uppercase text-teal-200 font-semibold">Maya Account Name</span>
                      <p className="text-sm font-bold text-white">{studio?.mayaAccountName || studioGcashName}</p>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase text-teal-200 font-semibold">Maya Mobile / Account Number</span>
                      <div className="flex items-center gap-1.5">
                        <p className="text-sm font-mono font-bold text-white">{studio?.mayaNumber || studioGcashNumber}</p>
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(studio?.mayaNumber || studioGcashNumber);
                            setCopiedPhone(true);
                            setTimeout(() => setCopiedPhone(false), 2000);
                          }}
                          className="p-1 bg-white/20 hover:bg-white/30 rounded text-xs text-white transition-colors cursor-pointer"
                          title="Copy number"
                        >
                          {copiedPhone ? <Check size={12} /> : <Copy size={12} />}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Amount to pay */}
                  <div className="bg-white rounded-xl p-3.5 text-center text-[#2c2a29] shadow-sm">
                    <span className="text-[10px] uppercase font-bold text-[#7c756d]">Exact Amount to Transfer</span>
                    <p className="text-2xl font-black text-teal-700 mt-0.5">
                      ₱{exactAmountToPay.toLocaleString("en-PH", { minimumFractionDigits: 2 })}
                    </p>
                    <p className="text-[10px] text-[#7c756d]">
                      {paymentOption === "Full Payment" ? "Full Booking Payment" : "30% Downpayment"} · Booking Ref: {createdBooking?.id || "BK-Pending"}
                    </p>
                  </div>
                </div>
              )}

              {/* Uploaded or Generated QR Code Display */}
              <div className="bg-white border border-[#e5e1da] rounded-2xl p-5 text-center space-y-3 shadow-xs">
                <span className="text-[11px] font-bold text-[#2c2a29] uppercase tracking-wider block">
                  Scan {selectedPayMethod === "maya" ? "Maya" : "GCash"} QR Code
                </span>

                <div className="w-56 h-56 mx-auto bg-white p-3 rounded-2xl border-2 border-dashed border-[#2c2a29]/30 flex items-center justify-center shadow-inner relative">
                  {selectedPayMethod === "gcash" ? (
                    studio?.gcashQrCode ? (
                      <img src={studio.gcashQrCode} alt="Studio Official GCash QR" className="w-full h-full object-contain rounded-lg" />
                    ) : qrLoading ? (
                      <div className="space-y-2 text-[#7c756d]">
                        <RefreshCw size={24} className="animate-spin mx-auto text-[#005ce6]" />
                        <p className="text-xs">Generating Studio QR…</p>
                      </div>
                    ) : qrCodeDataUrl ? (
                      <img src={qrCodeDataUrl} alt="Studio Owner GCash QR" className="w-full h-full object-contain rounded-lg" />
                    ) : (
                      <QrCode size={48} className="text-gray-300" />
                    )
                  ) : (
                    studio?.mayaQrCode ? (
                      <img src={studio.mayaQrCode} alt="Studio Official Maya QR" className="w-full h-full object-contain rounded-lg" />
                    ) : (
                      <div className="space-y-1 p-2 text-center text-[#7c756d]">
                        <QrCode size={40} className="mx-auto text-teal-600 opacity-60" />
                        <p className="text-xs font-bold text-[#2c2a29]">No Maya QR Uploaded</p>
                        <p className="text-[10px]">Send to Maya account number: <strong>{studio?.mayaNumber || studioGcashNumber}</strong></p>
                      </div>
                    )
                  )}
                </div>

                {((selectedPayMethod === "gcash" && (studio?.gcashQrCode || qrCodeDataUrl)) ||
                  (selectedPayMethod === "maya" && studio?.mayaQrCode)) && (
                  <a
                    href={
                      selectedPayMethod === "gcash" ? (studio?.gcashQrCode || qrCodeDataUrl) :
                      studio?.mayaQrCode
                    }
                    download={`${selectedPayMethod.toUpperCase()}-QR-${studio.name.replace(/\s+/g, "_")}.png`}
                    className="inline-flex items-center gap-1.5 text-xs text-amber-700 font-bold hover:underline"
                  >
                    <Download size={13} /> Download {selectedPayMethod.toUpperCase()} QR Image
                  </a>
                )}
              </div>

              {/* Payment Proof Submission Form */}
              <div className="bg-white border border-[#e5e1da] rounded-2xl p-5 space-y-4 text-left shadow-sm">
                <div>
                  <h5 className="font-bold text-sm text-[#2c2a29]">Submit Payment Proof to Studio Owner</h5>
                  <p className="text-[11px] text-[#7c756d]">Enter your {payMethodLabel} reference number and upload your screenshot receipt for owner verification.</p>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-[#2c2a29] mb-1">
                    {payMethodLabel} Reference Number <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={refNo}
                    onChange={e => setRefNo(e.target.value)}
                    placeholder="e.g. 1002 9384 1928"
                    className="w-full bg-[#faf9f6] border border-[#e5e1da] rounded-xl px-3 py-2 text-xs font-mono font-bold text-[#2c2a29] focus:outline-none focus:border-[#005ce6]"
                  />
                  <span className="text-[10px] text-[#7c756d] block mt-0.5">Found at the top of your {payMethodLabel} payment confirmation screen</span>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-[#2c2a29] mb-1">
                    Upload {payMethodLabel} Receipt Screenshot <span className="text-rose-500">*</span>
                  </label>
                  <div className="border-2 border-dashed border-[#e5e1da] rounded-xl p-4 text-center bg-[#faf9f6] relative hover:border-[#005ce6]/50 transition-colors">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleFileUpload}
                      className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                    />
                    {uploadProof ? (
                      <div className="space-y-2">
                        <img src={uploadProof} alt="Receipt preview" className="w-24 h-24 object-cover mx-auto rounded-lg shadow-sm border border-emerald-300" />
                        <p className="text-xs font-bold text-emerald-700">Receipt screenshot attached!</p>
                        <p className="text-[10px] text-gray-500">Tap to replace image</p>
                      </div>
                    ) : (
                      <div className="space-y-1.5 py-2">
                        <Camera size={24} className="mx-auto text-gray-400" />
                        <p className="text-xs font-bold text-[#2c2a29]">Tap or drag receipt image here</p>
                        <p className="text-[10px] text-[#7c756d]">JPEG or PNG up to 8 MB</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 7: Booking Submitted & Awaiting Verification */}
          {step === 7 && (
            <div className="space-y-5 text-center py-4">
              <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto shadow-md">
                <CheckCircle2 size={36} />
              </div>

              <div className="space-y-1">
                <h4 className="font-display text-xl font-bold text-[#2c2a29]">Payment Proof Submitted!</h4>
                <p className="text-xs text-[#7c756d] max-w-sm mx-auto">
                  Your booking details and {payMethodLabel} payment proof have been sent directly to <strong>{studio.name}</strong>.
                </p>
              </div>

              <div className="bg-white border border-[#e5e1da] rounded-2xl p-5 text-left space-y-3 max-w-sm mx-auto shadow-sm">
                <div className="flex justify-between items-center text-xs border-b border-gray-100 pb-2">
                  <span className="text-[#7c756d]">Booking ID</span>
                  <span className="font-bold text-[#2c2a29]">{createdBooking?.id || "BK-Pending"}</span>
                </div>
                <div className="flex justify-between items-center text-xs border-b border-gray-100 pb-2">
                  <span className="text-[#7c756d]">Schedule</span>
                  <span className="font-bold text-[#2c2a29]">{selectedDate} @ {selectedTimeSlot}</span>
                </div>
                <div className="flex justify-between items-center text-xs border-b border-gray-100 pb-2">
                  <span className="text-[#7c756d]">Amount Submitted</span>
                  <span className="font-black text-emerald-700">₱{exactAmountToPay.toLocaleString("en-PH", { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between items-center text-xs border-b border-gray-100 pb-2">
                  <span className="text-[#7c756d]">{payMethodLabel} Ref #</span>
                  <span className="font-mono font-bold text-[#2c2a29]">{refNo}</span>
                </div>
                <div className="flex justify-between items-center text-xs pt-1">
                  <span className="text-[#7c756d]">Status</span>
                  <span className="bg-amber-100 text-amber-800 text-[10px] font-bold px-2 py-0.5 rounded-full">
                    Awaiting Studio Owner Verification
                  </span>
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-xl p-3.5 text-xs text-blue-900 max-w-sm mx-auto text-left space-y-1">
                <p className="font-bold flex items-center gap-1.5">
                  <Info size={14} className="text-blue-700" /> What happens next?
                </p>
                <p className="text-[11px] text-blue-800 leading-relaxed">
                  The Studio Owner will verify your payment against their {payMethodLabel} account. Once verified, your booking will become <strong>Confirmed</strong>, and you will receive an in-app & email notification.
                </p>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => {
                    if (createdBooking?.id) onSuccess(createdBooking.id);
                    onClose();
                  }}
                  className="w-full py-3 bg-[#2c2a29] hover:bg-black text-white font-bold text-xs rounded-xl shadow-md cursor-pointer transition-all uppercase tracking-wider"
                >
                  View My Bookings in Dashboard
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer Navigation Bar */}
        {step < 7 && (
          <div className="bg-white border-t border-[#e5e1da] p-4 flex items-center justify-between">
            {step > 1 ? (
              <button
                type="button"
                onClick={() => {
                  // Going Back from the payment step keeps the unpaid draft as
                  // the single booking record. The next forward navigation
                  // amends that same draft (no duplicate) and frees the old
                  // slot; only refresh availability for the grid.
                  if (step === 6) refreshStudioBookings();
                  setStep(prev => prev - 1);
                }}
                className="flex items-center gap-1 px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-[#2c2a29] rounded-xl text-xs font-bold cursor-pointer transition-colors"
              >
                <ChevronLeft size={16} /> Back
              </button>
            ) : <div />}

            {step === 1 && (
              <button
                type="button"
                onClick={handleProceedFromService}
                className="flex items-center gap-1.5 px-6 py-2.5 bg-[#2c2a29] hover:bg-black text-white rounded-xl text-xs font-bold cursor-pointer transition-colors shadow-sm"
              >
                Select Date & Time <ChevronRight size={16} />
              </button>
            )}

            {step === 2 && (
              <button
                type="button"
                onClick={handleProceedFromDateTime}
                className="flex items-center gap-1.5 px-6 py-2.5 bg-[#2c2a29] hover:bg-black text-white rounded-xl text-xs font-bold cursor-pointer transition-colors shadow-sm"
              >
                Enter Contact Info <ChevronRight size={16} />
              </button>
            )}

            {step === 3 && (
              <button
                type="button"
                onClick={handleProceedFromCustomerInfo}
                className="flex items-center gap-1.5 px-6 py-2.5 bg-[#2c2a29] hover:bg-black text-white rounded-xl text-xs font-bold cursor-pointer transition-colors shadow-sm"
              >
                Review Booking Details <ChevronRight size={16} />
              </button>
            )}

            {step === 4 && (
              <button
                type="button"
                onClick={handleProceedToTerms}
                className="flex items-center gap-1.5 px-6 py-2.5 bg-[#2c2a29] hover:bg-black text-white rounded-xl text-xs font-bold cursor-pointer transition-colors shadow-sm"
              >
                View Terms & Conditions <ChevronRight size={16} />
              </button>
            )}

            {step === 5 && (
              <button
                type="button"
                disabled={!agreedToTerms || loading}
                onClick={handleAcceptTermsAndProceedToPayment}
                className="flex items-center gap-1.5 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold cursor-pointer transition-colors shadow-sm"
              >
                {loading ? "Processing…" : <>Accept & Proceed to GCash / Maya Payment <ArrowRight size={16} /></>}
              </button>
            )}

            {step === 6 && (
              <button
                type="button"
                disabled={loading || !refNo.trim() || !uploadProof}
                onClick={handleSubmitPaymentProof}
                className="flex items-center gap-1.5 px-6 py-2.5 bg-[#005ce6] hover:bg-[#004bbd] disabled:opacity-50 text-white rounded-xl text-xs font-bold cursor-pointer transition-colors shadow-sm"
              >
                {loading ? "Submitting…" : <>Submit Payment Proof to Owner <Check size={16} /></>}
              </button>
            )}
          </div>
        )}
      </motion.div>
    </div>
  );
}
