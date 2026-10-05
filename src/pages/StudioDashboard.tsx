import React, { useEffect, useState } from "react";
import { 
  Calendar, Printer, Star, Settings, FileText, Check, X, KeyRound, 
  Trash2, Plus, Sparkles, TrendingUp, Users, DollarSign, Edit, Download, Image as ImageIcon, BarChart3, LineChart as LineChartIcon,
  Upload, CheckCircle, MapPin, ShieldAlert, FileCheck, Eye, Camera, User,
  RefreshCw, RotateCcw, AlertTriangle, Search, SlidersHorizontal, Coins, Wallet, Globe, Share2, ExternalLink
} from "lucide-react";
import { 
  BarChart, Bar, AreaChart, Area, ComposedChart, Line, 
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  PieChart, Pie, Cell
} from "recharts";
import { generateStudioSalesReportPDF, generateBookingReceiptPDF, generatePrintOrderReceiptPDF } from "../utils/pdfGenerator";
import { apiRequest, resolveApiUrl, ApiError } from "../utils/apiClient";
import { ClientGallery } from "../components/ClientGallery";
import { SystemCalendar } from "../components/SystemCalendar";
import AvailabilityManager from "../components/AvailabilityManager";
import AccountSettings from "./AccountSettings.tsx";
import RescheduleModal from "../components/RescheduleModal.tsx";
import BookingDetailsModal from "../components/BookingDetailsModal.tsx";

export type StudioTab = "bookings" | "calendar" | "prints" | "reports" | "reviews" | "payments" | "management" | "services" | "staff" | "settings";
export type StudioManagementSubTab = "catalog" | "branding" | "gcash" | "staff" | "availability" | "faqs" | "account";

interface StudioDashboardProps {
  currentUser: any;
  studio: any;
  bookings: any[];
  printOrders: any[];
  payments: any[];
  reviews: any[];
  services: any[];
  packages: any[];
  addons?: any[];
  printProducts?: any[];
  faqs?: any[];
  onAddFaq?: (payload: { question: string; answer: string; category: string }) => void;
  onDeleteFaq?: (faqId: string) => void;
  onUpdateStatus: (type: "booking" | "print" | "payment", id: string, status: string) => void;
  onRecordPrintCashPayment?: (id: string, options?: { cashTendered?: number; changeAmount?: number; markCompleted?: boolean }) => void | Promise<void>;
  onProcessRefund?: (paymentId: string, reason: string, refundAmount?: number) => void;
  onUpdateStudioSettings: (settings: any) => void;
  onRefresh?: () => void;
  onNavigateToAccount?: () => void;
  onArchiveBooking?: (bookingId: string) => void;
  onUnarchiveBooking?: (bookingId: string) => void;
  onDeleteBooking?: (bookingId: string) => void;
  onArchivePrintOrder?: (orderId: string) => void;
  onUnarchivePrintOrder?: (orderId: string) => void;
  onDeletePrintOrder?: (orderId: string) => void;
  initialTab?: StudioTab;
}

export default function StudioDashboard({
  currentUser,
  studio,
  bookings,
  printOrders,
  payments,
  reviews,
  services,
  packages,
  addons = [],
  printProducts = [],
  faqs = [],
  onAddFaq,
  onDeleteFaq,
  onUpdateStatus,
  onRecordPrintCashPayment,
  onProcessRefund,
  onUpdateStudioSettings,
  onRefresh,
  onNavigateToAccount,
  onArchiveBooking,
  onUnarchiveBooking,
  onDeleteBooking,
  onArchivePrintOrder,
  onUnarchivePrintOrder,
  onDeletePrintOrder,
  initialTab = "bookings"
}: StudioDashboardProps) {
  const isInitialManagement = initialTab === "services" || initialTab === "staff" || initialTab === "settings" || initialTab === "management";
  const [activeTab, setActiveTab] = useState<StudioTab>(isInitialManagement ? "management" : initialTab);
  const [managementSubTab, setManagementSubTab] = useState<StudioManagementSubTab>(
    initialTab === "staff" ? "staff" : initialTab === "settings" ? "branding" : "catalog"
  );

  useEffect(() => {
    if (initialTab === "services") {
      setActiveTab("management");
      setManagementSubTab("catalog");
    } else if (initialTab === "staff") {
      setActiveTab("management");
      setManagementSubTab("staff");
    } else if (initialTab === "settings") {
      setActiveTab("management");
      setManagementSubTab("branding");
    } else if (initialTab === "management") {
      setActiveTab("management");
    } else if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);
  // Studio reviews state (fetched from /api/studio/reviews)
  const [studioOwnerReviews, setStudioOwnerReviews] = useState<any[]>([]);
  const [reviewsTabLoaded, setReviewsTabLoaded] = useState(false);
  const [replyTexts, setReplyTexts] = useState<Record<string, string>>({});
  const [replySuccess, setReplySuccess] = useState<Record<string, boolean>>({});

  const fetchStudioReviews = async () => {
    try {
      const data = await apiRequest(`/api/studio/reviews?studioId=${studio.id}`);
      if (data.success) {
        setStudioOwnerReviews(data.reviews || []);
        setReviewsTabLoaded(true);
      }
    } catch (err) {
      console.error("Failed to fetch studio reviews:", err);
    }
  };

  useEffect(() => {
    if (activeTab === "reviews" && currentUser?.authToken) {
      fetchStudioReviews();
    }
  }, [activeTab, studio.id, currentUser?.authToken]);

  // Settings form states
  const [logo, setLogo] = useState(studio.logo || "");
  const [coverImage, setCoverImage] = useState(studio.coverImage || "");
  const [location, setLocation] = useState(studio.location || "Ortigas Ave Ext (Valley Golf)");
  const [latitude, setLatitude] = useState<number | string>(studio.latitude || 14.5882);
  const [longitude, setLongitude] = useState<number | string>(studio.longitude || 121.1278);
  const [selectedCategories, setSelectedCategories] = useState<string[]>(
    Array.isArray(studio.categories) ? studio.categories : (studio.categories ? studio.categories.split(",") : ["Portrait Photography"])
  );
  const [businessHours, setBusinessHours] = useState(studio.businessHours || "");

  // Re-sync branding state whenever the parent refreshes the studio prop.
  // Without this, logo/coverImage stay as the original base64 data URI after a save
  // instead of reflecting the persisted /api/media/:id or Cloudinary URL.
  useEffect(() => {
    // Only overwrite if the incoming URL is a real persisted URL (not a base64 blob).
    // This prevents the form from reverting while the user is mid-edit.
    if (studio.logo && !studio.logo.startsWith("data:")) {
      setLogo(studio.logo);
    }
    if (studio.coverImage && !studio.coverImage.startsWith("data:")) {
      setCoverImage(studio.coverImage);
    }
  }, [studio.logo, studio.coverImage]);
  const [contactInfo, setContactInfo] = useState(studio.contactInfo || "");
  const [address, setAddress] = useState(studio.address || "");
  const [facebookUrl, setFacebookUrl] = useState(studio.facebookUrl || "");
  const [instagramUrl, setInstagramUrl] = useState(studio.instagramUrl || "");
  const [tiktokUrl, setTiktokUrl] = useState(studio.tiktokUrl || "");
  const [otherSocialUrl, setOtherSocialUrl] = useState(studio.otherSocialUrl || "");
  const [websiteUrl, setWebsiteUrl] = useState(studio.websiteUrl || "");

  // Compliance document re-upload state
  const [newBusinessPermit, setNewBusinessPermit] = useState<string>("");
  const [newValidId, setNewValidId] = useState<string>("");
  const [newOtherDocs, setNewOtherDocs] = useState<string>("");
  const [savingDocs, setSavingDocs] = useState(false);
  const [docSaveStatus, setDocSaveStatus] = useState<{ type: "idle" | "success" | "error"; message: string }>({ type: "idle", message: "" });

  useEffect(() => {
    if (studio.facebookUrl !== undefined) setFacebookUrl(studio.facebookUrl);
    if (studio.instagramUrl !== undefined) setInstagramUrl(studio.instagramUrl);
    if (studio.tiktokUrl !== undefined) setTiktokUrl(studio.tiktokUrl);
    if (studio.otherSocialUrl !== undefined) setOtherSocialUrl(studio.otherSocialUrl);
    if (studio.websiteUrl !== undefined) setWebsiteUrl(studio.websiteUrl);
  }, [studio]);
  const [startingPrice, setStartingPrice] = useState(studio.startingPrice || 1000);
  const [desc, setDesc] = useState(studio.description || "");
  const [savingSettings, setSavingSettings] = useState(false);
  const [saveStatus, setSaveStatus] = useState<{ type: "idle" | "success" | "error"; message: string }>({ type: "idle", message: "" });
  const [viewingReceipt, setViewingReceipt] = useState<{ url: string; ref: string; amount: number; method: string } | null>(null);

  // Payment Credentials & Methods configuration state
  // GCash and Maya only — Bank Transfer / QR Ph is no longer supported.
  const [gcashMerchantName, setGcashMerchantName] = useState("");
  const [gcashNumber, setGcashNumber] = useState("");
  const [gcashQrCode, setGcashQrCode] = useState("");

  const [mayaMerchantName, setMayaMerchantName] = useState("");
  const [mayaNumber, setMayaNumber] = useState("");
  const [mayaQrCode, setMayaQrCode] = useState("");

  const [savingGcash, setSavingGcash] = useState(false);
  const [gcashSaveMsg, setGcashSaveMsg] = useState("");

  useEffect(() => {
    if ((activeTab === "settings" || activeTab === "management") && studio?.id && currentUser?.authToken) {
      apiRequest(`/api/studios/${studio.id}/payment-credentials`)
        .then(data => {
          if (data.success && data.credentials) {
            const c = data.credentials;
            setGcashMerchantName(c.gcash_merchant_name || studio.gcashAccountName || "");
            setGcashNumber(c.gcash_number || studio.gcashNumber || "");
            setGcashQrCode(c.gcash_qr_code || studio.gcashQrCode || "");

            setMayaMerchantName(c.maya_merchant_name || studio.mayaAccountName || "");
            setMayaNumber(c.maya_number || studio.mayaNumber || "");
            setMayaQrCode(c.maya_qr_code || studio.mayaQrCode || "");
          }
        })
        .catch(() => {});
    }
  }, [activeTab, studio?.id, currentUser?.authToken]);

  const handleQrImageUpload = (e: React.ChangeEvent<HTMLInputElement>, setFn: (url: string) => void) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) {
      alert("QR code image file size must be smaller than 8 MB.");
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => {
      setFn(reader.result as string);
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const handleSaveGcashSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingGcash(true);
    setGcashSaveMsg("");
    try {
      const data = await apiRequest(`/api/studios/${studio.id}/payment-credentials`, {
        method: "POST",
        body: { 
          gcashMerchantName, 
          gcashNumber, 
          gcashQrCode,
          mayaMerchantName,
          mayaNumber,
          mayaQrCode
        }
      });
      if (data.success) {
        setGcashSaveMsg("✅ Payment methods & QR code images saved successfully!");
        if (data.credentials) {
          if (data.credentials.gcashQrCode) setGcashQrCode(data.credentials.gcashQrCode);
          if (data.credentials.mayaQrCode) setMayaQrCode(data.credentials.mayaQrCode);
        }
        if (onRefresh) onRefresh();
      } else {
        setGcashSaveMsg(`❌ ${data.message || "Failed to save settings."}`);
      }
    } catch {
      setGcashSaveMsg("❌ Failed to save payment settings. Please retry.");
    } finally {
      setSavingGcash(false);
      setTimeout(() => setGcashSaveMsg(""), 4000);
    }
  };

  // CRUD form states for Services
  const [isAddingService, setIsAddingService] = useState(false);
  const [editingServiceId, setEditingServiceId] = useState<string | null>(null);
  const [srvName, setSrvName] = useState("");
  const [srvDesc, setSrvDesc] = useState("");
  const [srvCat, setSrvCat] = useState("Portrait Photography");
  const [srvPrice, setSrvPrice] = useState("");
  const [srvDuration, setSrvDuration] = useState("60");
  const [srvImages, setSrvImages] = useState<string[]>([]);

  const SERVICE_CATEGORY_TEMPLATES: Record<string, { name: string; description: string; price: string; duration: string }> = {
    "Portrait Photography": {
      name: "e.g. Signature Family Portrait Session",
      description: "e.g. 2 outfit changes, 5 final edited poses, soft natural light setup, and guided posing direction.",
      price: "1500",
      duration: "60"
    },
    "Graduation Shoots": {
      name: "e.g. Senior Graduation Portrait Set",
      description: "e.g. cap-and-gown portraits, campus backdrop styling, 10 retouched images, and instant preview selection.",
      price: "2500",
      duration: "90"
    },
    "Wedding Milestones": {
      name: "e.g. Prenup Storytelling Session",
      description: "e.g. romantic couple shoot, two location setups, dress and suit detail coverage, and 20 highlight edits.",
      price: "4000",
      duration: "120"
    },
    "Product Creative": {
      name: "e.g. Product Hero Shot Package",
      description: "e.g. clean studio light setup, 15 product angles, background changes, and commercial-ready editing.",
      price: "3000",
      duration: "90"
    },
    "Family Portrait": {
      name: "e.g. Family Portrait Mini Session",
      description: "e.g. in-studio family setup, playful candid moments, 5 edited final images, and printable wall-ready preview.",
      price: "2000",
      duration: "60"
    },
    "Baby & Milestone": {
      name: "e.g. Baby Milestone Monthly Shoot",
      description: "e.g. themed milestone portrait, soft props styling, 8 high-resolution edits, and parent prep guidance.",
      price: "1800",
      duration: "60"
    }
  };

  const currentServiceTemplate = SERVICE_CATEGORY_TEMPLATES[srvCat] || SERVICE_CATEGORY_TEMPLATES["Portrait Photography"];

  // CRUD form states for Packages
  const [isAddingPackage, setIsAddingPackage] = useState(false);
  const [editingPackageId, setEditingPackageId] = useState<string | null>(null);
  const [pkgCat, setPkgCat] = useState<string>(Array.isArray(studio.categories) && studio.categories.length > 0 ? studio.categories[0] : "Portrait Photography");
  const [pkgName, setPkgName] = useState("");
  const [pkgDesc, setPkgDesc] = useState("");
  const [pkgPrice, setPkgPrice] = useState("");
  const [pkgDuration, setPkgDuration] = useState("60");
  const [pkgPhotosCount, setPkgPhotosCount] = useState("15");
  const [pkgPrints, setPkgPrints] = useState("None");
  const [pkgPhotographerCount, setPkgPhotographerCount] = useState("1");
  const [pkgImage, setPkgImage] = useState("");

  const PACKAGE_CATEGORY_TEMPLATES: Record<string, { name: string; description: string; price: string; duration: string; photos: string; prints: string; photographers: string }> = {
    "Portrait Photography": {
      name: "e.g. Classic Portrait Story Package",
      description: "e.g. 2 hour portrait session with wardrobe guidance, location scouting, 20 edited photos, and digital gallery delivery.",
      price: "6500",
      duration: "120",
      photos: "20",
      prints: "2 8R prints",
      photographers: "1"
    },
    "Graduation Shoots": {
      name: "e.g. Grad Glow Signature Package",
      description: "e.g. cap and gown set, location styling, teaser images, 30 retouched outputs, and high-resolution online gallery.",
      price: "7800",
      duration: "150",
      photos: "30",
      prints: "1 10R print",
      photographers: "1"
    },
    "Wedding Milestones": {
      name: "e.g. Wedding Storytelling Deluxe",
      description: "e.g. full-day coverage, candid and formal frames, edited gallery, 1 photographer, and highlight album preview.",
      price: "18000",
      duration: "360",
      photos: "200",
      prints: "1 premium album",
      photographers: "2"
    },
    "Product Creative": {
      name: "e.g. Brand Launch Studio Kit",
      description: "e.g. product lighting setup, multiple background treatments, 25 edited commercial photos, and final asset delivery.",
      price: "9500",
      duration: "180",
      photos: "25",
      prints: "1 branded mockup display",
      photographers: "1"
    },
    "Family Portrait": {
      name: "e.g. Family Memory Collection",
      description: "e.g. in-studio family portraits, 3 outfit looks, 25 retouched finals, and digital gallery access.",
      price: "7000",
      duration: "120",
      photos: "25",
      prints: "2 family prints",
      photographers: "1"
    },
    "Baby & Milestone": {
      name: "e.g. Baby Growth Story Bundle",
      description: "e.g. monthly milestone shoot, prop styling, 12 final images, and curated personal keepsake gallery.",
      price: "5200",
      duration: "90",
      photos: "12",
      prints: "1 keepsake print",
      photographers: "1"
    }
  };

  const currentPackageTemplate = PACKAGE_CATEGORY_TEMPLATES[pkgCat] || PACKAGE_CATEGORY_TEMPLATES["Portrait Photography"];

  const handleStudioFaqSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!faqQuestion.trim() || !faqAnswer.trim()) return;
    onAddFaq?.({ question: faqQuestion.trim(), answer: faqAnswer.trim(), category: faqCategory.trim() || "General" });
    setFaqQuestion("");
    setFaqAnswer("");
    setFaqCategory("General");
  };

  // Image upload helper
  const handleImageFileUpload = (e: React.ChangeEvent<HTMLInputElement>, setFn: (val: string) => void) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => setFn(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleServiceImagesUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    files.forEach(file => {
      const reader = new FileReader();
      reader.onloadend = () => setSrvImages(current => [...current, reader.result as string]);
      reader.readAsDataURL(file);
    });
    e.target.value = "";
  };

  const handlePrintProductImagesUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    files.forEach(file => {
      const reader = new FileReader();
      reader.onloadend = () => setPrintProdImages(current => [...current, reader.result as string]);
      reader.readAsDataURL(file);
    });
    e.target.value = "";
  };

  const handleAddonImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleImageFileUpload(e, setAddImage);
    e.target.value = "";
  };

  const handleToggleCategory = (catName: string) => {
    if (selectedCategories.includes(catName)) {
      setSelectedCategories(selectedCategories.filter(c => c !== catName));
    } else {
      setSelectedCategories([...selectedCategories, catName]);
    }
  };

  // CRUD form states for Addons
  const [isAddingAddon, setIsAddingAddon] = useState(false);
  const [addName, setAddName] = useState("");
  const [addPrice, setAddPrice] = useState("");
  const [addDesc, setAddDesc] = useState("");
  const [addImage, setAddImage] = useState("");

  // Print product catalog form states
  const [isAddingPrintProduct, setIsAddingPrintProduct] = useState(false);
  const [printProdName, setPrintProdName] = useState("");
  const [printProdDesc, setPrintProdDesc] = useState("");
  const [printProdSize, setPrintProdSize] = useState("8x10 inches");
  const [printProdPrice, setPrintProdPrice] = useState("");
  const [printProdImages, setPrintProdImages] = useState<string[]>([]);
  const [printProdExistingImages, setPrintProdExistingImages] = useState<string[]>([]);
  const [printProdHours, setPrintProdHours] = useState("24");
  const [editingPrintProductId, setEditingPrintProductId] = useState<string | null>(null);

  // Blocked Dates management local state
  const [blockedDates, setBlockedDates] = useState<string[]>(studio.blockedDates || []);
  const [newBlockedDate, setNewBlockedDate] = useState("");
  const [faqQuestion, setFaqQuestion] = useState("");
  const [faqAnswer, setFaqAnswer] = useState("");
  const [faqCategory, setFaqCategory] = useState("General");

  // Print simulation receipt view
  const [showLedgerReport, setShowLedgerReport] = useState(false);
  const [recordingBalanceId, setRecordingBalanceId] = useState<string | null>(null);
  const [staff, setStaff] = useState<any[]>([]);
  const [staffLoaded, setStaffLoaded] = useState(false);
  const [loadingStaff, setLoadingStaff] = useState(false);
  const [savingStaff, setSavingStaff] = useState(false);
  const [staffEmail, setStaffEmail] = useState("");
  const [staffFullName, setStaffFullName] = useState("");
  const [staffPassword, setStaffPassword] = useState("");
  const [staffContactNumber, setStaffContactNumber] = useState("");
  const [resolvedStudioPrintMedia, setResolvedStudioPrintMedia] = useState<Record<string, string>>({});
  const [receiptPreviewUrl, setReceiptPreviewUrl] = useState<string | null>(null);
  const [viewingPrintPhoto, setViewingPrintPhoto] = useState<string | null>(null);

  // Cash on Hand / Cash Pickup Modal state
  const [cashPickupModalOrder, setCashPickupModalOrder] = useState<any | null>(null);
  const [cashTenderedInput, setCashTenderedInput] = useState<string>("");
  const [markOrderCompletedCheck, setMarkOrderCompletedCheck] = useState<boolean>(true);
  const [cashRegisterTypeFilter, setCashRegisterTypeFilter] = useState<string>("All");
  const [recordingCashLoading, setRecordingCashLoading] = useState<boolean>(false);

  const resolveProtectedMediaUrl = async (url: string): Promise<string> => {
    if (!url || !url.startsWith("/api/media/")) return url;
    if (!currentUser?.authToken) return url;

    const response = await fetch(resolveApiUrl(url), {
      headers: {
        Authorization: `Bearer ${currentUser.authToken}`
      }
    });

    if (!response.ok) return url;
    const blob = await response.blob();
    return URL.createObjectURL(blob);
  };

  useEffect(() => {
    if (!viewingReceipt) {
      setReceiptPreviewUrl(null);
      return;
    }

    let cancelled = false;
    let blobUrl: string | null = null;

    const loadReceiptPreview = async () => {
      try {
        const resolvedUrl = viewingReceipt.url.startsWith("/api/media/")
          ? await resolveProtectedMediaUrl(viewingReceipt.url)
          : viewingReceipt.url;

        if (!cancelled) {
          blobUrl = resolvedUrl.startsWith("blob:") ? resolvedUrl : null;
          setReceiptPreviewUrl(blobUrl || resolvedUrl);
        }
      } catch (err) {
        console.warn("Failed to resolve receipt preview:", err);
        if (!cancelled) {
          setReceiptPreviewUrl(viewingReceipt.url);
        }
      }
    };

    loadReceiptPreview();

    return () => {
      cancelled = true;
      if (blobUrl) {
        URL.revokeObjectURL(blobUrl);
      }
    };
  }, [viewingReceipt?.url, currentUser?.authToken]);

  useEffect(() => {
    let isCancelled = false;
    const activeBlobUrls: string[] = [];

    const hydrateStudioPrintMedia = async () => {
      const nextMap: Record<string, string> = {};

      for (const order of printOrders) {
        const protectedUrls = [order.uploadedPhoto, order.proofOfPayment].filter((value): value is string => !!value && value.startsWith("/api/media/"));

        for (const protectedUrl of protectedUrls) {
          try {
            const resolved = await resolveProtectedMediaUrl(protectedUrl);
            if (!isCancelled) {
              nextMap[protectedUrl] = resolved;
              if (resolved.startsWith("blob:")) activeBlobUrls.push(resolved);
            }
          } catch (err) {
            console.warn("Failed to resolve studio print media:", err);
            if (!isCancelled) nextMap[protectedUrl] = protectedUrl;
          }
        }
      }

      if (!isCancelled) setResolvedStudioPrintMedia(nextMap);
    };

    hydrateStudioPrintMedia();

    return () => {
      isCancelled = true;
      for (const blobUrl of activeBlobUrls) {
        try {
          URL.revokeObjectURL(blobUrl);
        } catch {
          // ignore cleanup errors
        }
      }
    };
  }, [printOrders, currentUser?.authToken]);

  // Photo Proofing Portal state for Admin
  const [proofingBookingId, setProofingBookingId] = useState<string | null>(null);

  // Booking detail view modal
  const [viewingBooking, setViewingBooking] = useState<any | null>(null);

  // Studio-side reschedule modal
  const [reschedulingBooking, setReschedulingBooking] = useState<any | null>(null);

  // Studio-side refund modal
  const [refundingPayment, setRefundingPayment] = useState<{ payment: any; booking: any } | null>(null);
  const [refundReason, setRefundReason] = useState("");
  const [refundAmount, setRefundAmount] = useState("");
  const [refundLoading, setRefundLoading] = useState(false);
  const [refundMsg, setRefundMsg] = useState("");

  // Cash Payment Recording Modal for Print Order Pickup
  const [cashPaymentModal, setCashPaymentModal] = useState<{ order: any } | null>(null);
  const [cashTendered, setCashTendered] = useState("");
  const [cashPaymentLoading, setCashPaymentLoading] = useState(false);

  const cashTenderedNum = parseFloat(cashTendered) || 0;
  const cashOrderTotal = cashPaymentModal ? Number(cashPaymentModal.order.totalAmount || 0) : 0;
  const cashChange = cashTenderedNum - cashOrderTotal;
  const cashChangeValid = cashTenderedNum >= cashOrderTotal;

  const handleOpenCashPaymentModal = (order: any) => {
    setCashPaymentModal({ order });
    setCashTendered(String(Number(order.totalAmount || 0)));
  };

  const handleConfirmCashPayment = async () => {
    if (!cashPaymentModal || !onRecordPrintCashPayment) return;
    setCashPaymentLoading(true);
    try {
      await onRecordPrintCashPayment(cashPaymentModal.order.id, {
        cashTendered: cashTenderedNum,
        changeAmount: Math.max(0, cashChange),
        markCompleted: true
      });
      setCashPaymentModal(null);
      setCashTendered("");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to record cash payment.");
    } finally {
      setCashPaymentLoading(false);
    }
  };

  // Revenue Overview Chart View Mode
  const [revenueChartType, setRevenueChartType] = useState<"composed" | "stacked" | "area">("composed");
  const [revenuePeriod, setRevenuePeriod] = useState<"daily" | "weekly" | "monthly" | "yearly">("monthly");

  // Filter schedules and orders just for this studio
  const studioBookings = bookings.filter(b => b.studioId === studio.id);
  const studioPrints = printOrders.filter(p => p.studioId === studio.id);
  const studioPayments = payments.filter(pm => pm.studioId === studio.id);
  const studioReviews = reviews.filter(r => r.studioId === studio.id);
  const isStudioStaff = currentUser?.role === "STUDIO_STAFF";
  const canManageDownpayments = currentUser?.role === "STUDIO_ADMIN" && currentUser.id === studio.ownerId;
  const canManageStaff = canManageDownpayments;

  const loadStaff = async () => {
    setLoadingStaff(true);
    try {
      const data = await apiRequest(`/api/studios/${studio.id}/staff`);
      if (!data.success) throw new Error(data.message || "Unable to load staff accounts.");
      setStaff(data.staff || []);
      setStaffLoaded(true);
    } catch (error) {
      console.error(error);
      alert(error instanceof Error ? error.message : "Unable to load staff accounts.");
    } finally {
      setLoadingStaff(false);
    }
  };

  useEffect(() => {
    if ((activeTab === "staff" || (activeTab === "management" && managementSubTab === "staff")) && !staffLoaded && canManageStaff && currentUser?.authToken) {
      loadStaff();
    }
  }, [activeTab, managementSubTab, staffLoaded, canManageStaff, currentUser?.authToken]);

  const handleStaffInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingStaff(true);
    try {
      const data = await apiRequest(`/api/studios/${studio.id}/staff/invite`, {
        method: "POST",
        body: {
          email: staffEmail,
          fullName: staffFullName,
          password: staffPassword || undefined,
          contactNumber: staffContactNumber || undefined
        }
      });
      if (!data.success) throw new Error(data.message || "Unable to create staff account.");
      setStaff(currentStaff => [...currentStaff, data.staff]);
      setStaffEmail("");
      setStaffFullName("");
      setStaffPassword("");
      setStaffContactNumber("");
      setStaffLoaded(true);
      alert(`Staff account created. ${staffPassword ? "Use the password you entered." : "The temporary password is Staff123!."}`);
    } catch (error) {
      console.error(error);
      alert(error instanceof Error ? error.message : "Unable to create staff account.");
    } finally {
      setSavingStaff(false);
    }
  };

  const handleRemoveStaff = async (staffId: string) => {
    if (!confirm("Remove this staff account from your studio?")) return;
    try {
      const data = await apiRequest(`/api/studios/${studio.id}/staff/${staffId}`, { method: "DELETE" });
      if (!data.success) throw new Error(data.message || "Unable to remove staff account.");
      setStaff(currentStaff => currentStaff.filter(member => member.id !== staffId));
    } catch (error) {
      console.error(error);
      alert(error instanceof Error ? error.message : "Unable to remove staff account.");
    }
  };

  const recordBalancePayment = async (booking: any) => {
    const balance = Number(booking.remainingBalance ?? booking.totalAmount - (booking.amountPaid || 0));
    const enteredAmount = window.prompt(`Record final balance payment of PHP ${balance.toLocaleString()}? Enter amount to confirm:`, String(balance));
    if (enteredAmount === null) return;
    setRecordingBalanceId(booking.id);
    try {
      const data = await apiRequest(`/api/bookings/${booking.id}/balance-payment`, {
        method: "POST",
        body: { amount: Number(enteredAmount), paymentMethod: "Cash" }
      });
      if (!data.success) window.alert(data.message || "Unable to record balance payment.");
      else onRefresh?.();
    } finally {
      setRecordingBalanceId(null);
    }
  };

  // Process refund for a verified payment
  const handleProcessRefund = async () => {
    if (!refundingPayment) return;
    const { payment, booking } = refundingPayment;
    if (!refundReason.trim()) {
      setRefundMsg("Please provide a refund reason.");
      return;
    }
    const parsedAmount = refundAmount ? Number(refundAmount) : payment.amount;
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0 || parsedAmount > payment.amount) {
      setRefundMsg(`Refund amount must be between ₱1 and ₱${Number(payment.amount).toLocaleString()}.`);
      return;
    }
    setRefundLoading(true);
    setRefundMsg("");
    try {
      const data = await apiRequest(`/api/payments/${payment.id}/refund`, {
        method: "PUT",
        body: { reason: refundReason.trim(), refundAmount: parsedAmount }
      });
      if (data.success) {
        setRefundMsg(`✓ ₱${parsedAmount.toLocaleString()} refund processed successfully.`);
        setTimeout(() => {
          setRefundingPayment(null);
          setRefundReason("");
          setRefundAmount("");
          setRefundMsg("");
          onRefresh?.();
        }, 1800);
      } else {
        setRefundMsg(data.message || "Refund failed.");
      }
    } catch (err: any) {
      setRefundMsg(err?.message || "Failed to process refund.");
    } finally {
      setRefundLoading(false);
    }
  };

  // Financial metrics
  const paidStudioPayments = studioPayments.filter(payment => payment.paymentStatus === "Paid");
  const totalBookingsValue = paidStudioPayments.filter(payment => payment.paymentType !== "PrintOrder").reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
  const paidStudioPrints = studioPrints.filter(order => order.paymentStatus === "Paid");
  const totalPrintsValue = paidStudioPrints.reduce((sum, order) => sum + Number(order.totalAmount || 0), 0);
  const overallIncome = totalBookingsValue + totalPrintsValue;

  // Cash on Hand calculations (Physical Cash Collections)
  // Print order pickup cash payments
  const cashPrintOrders = studioPrints.filter(order => order.paymentStatus === "Paid" && (order.paymentMethod === "Cash" || !order.paymentMethod));
  const cashFromPrints = cashPrintOrders.reduce((sum, order) => sum + Number(order.totalAmount || 0), 0);

  // Photoshoot booking cash payments (e.g. in-studio balance paid in cash at counter)
  const cashBookingPayments = paidStudioPayments.filter(payment => payment.paymentMethod === "Cash" && payment.paymentType !== "PrintOrder");
  const cashFromBookings = cashBookingPayments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);

  // Total physical Cash on Hand
  const totalCashOnHand = cashFromPrints + cashFromBookings;

  // Today's Cash Collections
  const todayDateStr = new Date().toISOString().split("T")[0];
  const todayCashFromPrints = cashPrintOrders
    .filter(order => ((order as any).paidAt || order.createdAt || "").split("T")[0] === todayDateStr)
    .reduce((sum, order) => sum + Number(order.totalAmount || 0), 0);
  const todayCashFromBookings = cashBookingPayments
    .filter(payment => (payment.paymentDate || payment.createdAt || "").split("T")[0] === todayDateStr)
    .reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
  const todayCashOnHand = todayCashFromPrints + todayCashFromBookings;

  // Unified Cash on Hand ledger/drawer transactions
  const cashOnHandTransactions = React.useMemo(() => {
    const list: Array<{
      id: string;
      refId: string;
      type: "Print Order Pickup" | "Shoot Balance Cash";
      amount: number;
      customerName: string;
      customerId: string;
      date: string;
      cashTendered?: number;
      changeAmount?: number;
    }> = [];

    for (const pr of cashPrintOrders) {
      list.push({
        id: `CASH-PR-${pr.id}`,
        refId: pr.id,
        type: "Print Order Pickup",
        amount: Number(pr.totalAmount || 0),
        customerName: (pr as any).customerName || pr.customerId || "Walk-in Pickup",
        customerId: pr.customerId,
        date: (pr as any).paidAt || pr.createdAt,
        cashTendered: (pr as any).cashTendered,
        changeAmount: (pr as any).changeAmount
      });
    }

    for (const bk of cashBookingPayments) {
      const bObj = studioBookings.find(b => b.id === bk.bookingId);
      list.push({
        id: `CASH-PAY-${bk.id}`,
        refId: bk.bookingId || bk.id,
        type: "Shoot Balance Cash",
        amount: Number(bk.amount || 0),
        customerName: bObj?.customerDetails?.fullName || bk.customerId || "Customer",
        customerId: bk.customerId,
        date: bk.paymentDate || bk.createdAt
      });
    }

    return list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [cashPrintOrders, cashBookingPayments, studioBookings]);

  // Group verified revenue by the selected reporting period.
  const revenueData = React.useMemo(() => {
    const now = new Date();
    const periodCount = revenuePeriod === "daily" ? 14 : revenuePeriod === "weekly" ? 12 : revenuePeriod === "yearly" ? 5 : 6;
    const periods = Array.from({ length: periodCount }, (_, index) => {
      const date = new Date(now);
      if (revenuePeriod === "daily") date.setDate(now.getDate() - (periodCount - 1 - index));
      if (revenuePeriod === "weekly") date.setDate(now.getDate() - (periodCount - 1 - index) * 7);
      if (revenuePeriod === "monthly") date.setMonth(now.getMonth() - (periodCount - 1 - index));
      if (revenuePeriod === "yearly") date.setFullYear(now.getFullYear() - (periodCount - 1 - index));
      const periodStart = new Date(date);
      if (revenuePeriod === "weekly") {
        const day = periodStart.getDay() || 7;
        periodStart.setDate(periodStart.getDate() - day + 1);
      }
      periodStart.setHours(0, 0, 0, 0);
      const nextPeriod = new Date(periodStart);
      if (revenuePeriod === "daily") nextPeriod.setDate(nextPeriod.getDate() + 1);
      if (revenuePeriod === "weekly") nextPeriod.setDate(nextPeriod.getDate() + 7);
      if (revenuePeriod === "monthly") nextPeriod.setMonth(nextPeriod.getMonth() + 1);
      if (revenuePeriod === "yearly") nextPeriod.setFullYear(nextPeriod.getFullYear() + 1);
      const label = revenuePeriod === "daily"
        ? periodStart.toLocaleDateString("en-US", { month: "short", day: "numeric" })
        : revenuePeriod === "weekly"
          ? `Week of ${periodStart.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`
          : revenuePeriod === "monthly"
            ? periodStart.toLocaleDateString("en-US", { month: "short", year: "numeric" })
            : String(periodStart.getFullYear());
      return { periodStart, nextPeriod, label };
    });

    return periods.map(({ periodStart, nextPeriod, label }) => {
      const bookingIncome = paidStudioPayments.filter(payment => payment.paymentType !== "PrintOrder").reduce((sum, payment) => {
        const bookingDate = new Date(payment.paymentDate || payment.createdAt || Date.now());
        return bookingDate >= periodStart && bookingDate < nextPeriod ? sum + Number(payment.amount || 0) : sum;
      }, 0);

      const printSales = paidStudioPrints.reduce((sum, order) => {
        const orderDate = new Date(order.paidAt || order.createdAt || Date.now());
        return orderDate >= periodStart && orderDate < nextPeriod ? sum + Number(order.totalAmount || 0) : sum;
      }, 0);

      return {
        label,
        bookingIncome,
        printSales,
        totalRevenue: bookingIncome + printSales,
      };
    });
  }, [paidStudioPayments, paidStudioPrints, revenuePeriod]);

  // Specific 6-month data for the 'Revenue Overview' card
  const monthlyRevenueOverviewData = React.useMemo(() => {
    const now = new Date();
    return Array.from({ length: 6 }, (_, index) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (5 - index), 1);
      const periodStart = d;
      const nextPeriod = new Date(d.getFullYear(), d.getMonth() + 1, 1);
      const label = d.toLocaleDateString("en-US", { month: "short" });
      
      const total = paidStudioPayments.reduce((sum, payment) => {
        const pDate = new Date(payment.paymentDate || payment.createdAt);
        return pDate >= periodStart && pDate < nextPeriod ? sum + Number(payment.amount || 0) : sum;
      }, 0) + paidStudioPrints.reduce((sum, order) => {
        const oDate = new Date(order.paidAt || order.createdAt);
        return oDate >= periodStart && oDate < nextPeriod ? sum + Number(order.totalAmount || 0) : sum;
      }, 0);

      return { label, total };
    });
  }, [paidStudioPayments, paidStudioPrints]);

  const handleDocFileChange = (e: React.ChangeEvent<HTMLInputElement>, type: "permit" | "validId" | "other") => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result as string;
      if (type === "permit") setNewBusinessPermit(base64);
      else if (type === "validId") setNewValidId(base64);
      else setNewOtherDocs(base64);
    };
    reader.readAsDataURL(file);
  };

  const handleDocsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBusinessPermit && !newValidId && !newOtherDocs) {
      setDocSaveStatus({ type: "error", message: "Please select at least one document to upload." });
      return;
    }
    setSavingDocs(true);
    setDocSaveStatus({ type: "idle", message: "" });
    try {
      const body: Record<string, string> = {};
      if (newBusinessPermit) body.businessPermit = newBusinessPermit;
      if (newValidId) body.validId = newValidId;
      if (newOtherDocs) body.otherDocs = newOtherDocs;

      const data = await apiRequest(`/api/studios/${studio.id}`, {
        method: "PUT",
        body
      });
      if (!data.success) throw new Error(data.message || "Could not save documents.");

      setNewBusinessPermit("");
      setNewValidId("");
      setNewOtherDocs("");
      onRefresh?.();
      setDocSaveStatus({ type: "success", message: "Compliance documents updated successfully. The Super Admin can now review your updated files." });
    } catch (err) {
      setDocSaveStatus({ type: "error", message: err instanceof Error ? err.message : "Failed to upload documents." });
    } finally {
      setSavingDocs(false);
    }
  };

  const handleSettingsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const requiredFieldsMissing = !location.trim() || !address.trim() || !contactInfo.trim() || !desc.trim();
    if (requiredFieldsMissing) {
      setSaveStatus({
        type: "error",
        message: "Please complete the required studio details before saving: location, address, contact info, and description."
      });
      return;
    }

    if (!logo.trim() && !coverImage.trim()) {
      setSaveStatus({
        type: "error",
        message: "Please upload at least a studio logo or cover image before saving."
      });
      return;
    }

    setSavingSettings(true);
    setSaveStatus({ type: "idle", message: "" });

    try {
      const validateUrlOrEmpty = (raw: string): string => {
        if (!raw || !raw.trim()) return "";
        let trimmed = raw.trim();
        if (/^(javascript|data|vbscript|file):/i.test(trimmed)) {
          throw new Error("Invalid or potentially unsafe URL detected.");
        }
        if (!/^https?:\/\//i.test(trimmed)) {
          trimmed = "https://" + trimmed;
        }
        try {
          const parsed = new URL(trimmed);
          if (parsed.protocol === "http:" || parsed.protocol === "https:") {
            return parsed.toString();
          }
        } catch {
          throw new Error(`Invalid URL format: ${raw}`);
        }
        return "";
      };

      let cleanFacebook = "";
      let cleanInstagram = "";
      let cleanTiktok = "";
      let cleanOtherSocial = "";
      let cleanWebsite = "";
      try {
        cleanFacebook = validateUrlOrEmpty(facebookUrl);
        cleanInstagram = validateUrlOrEmpty(instagramUrl);
        cleanTiktok = validateUrlOrEmpty(tiktokUrl);
        cleanOtherSocial = validateUrlOrEmpty(otherSocialUrl);
        cleanWebsite = validateUrlOrEmpty(websiteUrl);
      } catch (err: any) {
        setSaveStatus({ type: "error", message: err.message || "Invalid URL provided." });
        setSavingSettings(false);
        return;
      }

      const data = await apiRequest(`/api/studios/${studio.id}`, {
        method: "PUT",
        body: {
          name: studio.name,
          logo,
          coverImage,
          location,
          latitude: latitude !== "" ? Number(latitude) : undefined,
          longitude: longitude !== "" ? Number(longitude) : undefined,
          categories: selectedCategories,
          businessHours,
          contactInfo,
          address,
          startingPrice: Number(startingPrice),
          description: desc,
          blockedDates,
          facebookUrl: cleanFacebook,
          instagramUrl: cleanInstagram,
          tiktokUrl: cleanTiktok,
          otherSocialUrl: cleanOtherSocial,
          websiteUrl: cleanWebsite
        }
      });

      if (!data.success) {
        throw new Error(data.message || "The studio profile could not be saved.");
      }

      // Immediately update local branding state with the server-resolved URLs
      // (e.g. /api/media/:id or Cloudinary URL) so the form preview is correct
      // and subsequent saves don't re-upload the same base64 data unnecessarily.
      if (data.studio?.logo && !data.studio.logo.startsWith("data:")) {
        setLogo(data.studio.logo);
      }
      if (data.studio?.coverImage && !data.studio.coverImage.startsWith("data:")) {
        setCoverImage(data.studio.coverImage);
      }

      onRefresh?.();
      setSaveStatus({
        type: "success",
        message: "Studio profile saved successfully. Branding and contact details are now live."
      });
    } catch (err) {
      console.error(err);
      setSaveStatus({
        type: "error",
        message: err instanceof Error ? err.message : "Failed to update studio settings."
      });
    } finally {
      setSavingSettings(false);
    }
  };

  const handleBlockDate = () => {
    if (!newBlockedDate) return;
    if (blockedDates.includes(newBlockedDate)) {
      alert("This date is already blocked!");
      return;
    }
    const updated = [...blockedDates, newBlockedDate];
    setBlockedDates(updated);
    setNewBlockedDate("");
    onUpdateStudioSettings({ blockedDates: updated });
    alert(`Blocked appointments on ${newBlockedDate}. Customers will not be able to schedule bookings on this day.`);
  };

  const handleUnblockDate = (dateToUnblock: string) => {
    const updated = blockedDates.filter(d => d !== dateToUnblock);
    setBlockedDates(updated);
    onUpdateStudioSettings({ blockedDates: updated });
    alert(`Restored normal scheduler availability for ${dateToUnblock}.`);
  };

  const resetServiceForm = () => {
    setIsAddingService(false);
    setEditingServiceId(null);
    setSrvName("");
    setSrvDesc("");
    setSrvCat(Array.isArray(studio.categories) && studio.categories.length > 0 ? studio.categories[0] : "Portrait Photography");
    setSrvPrice("");
    setSrvDuration("60");
    setSrvImages([]);
  };

  const resetPackageForm = () => {
    setIsAddingPackage(false);
    setEditingPackageId(null);
    setPkgCat(Array.isArray(studio.categories) && studio.categories.length > 0 ? studio.categories[0] : "Portrait Photography");
    setPkgName("");
    setPkgDesc("");
    setPkgPrice("");
    setPkgDuration("60");
    setPkgPhotosCount("15");
    setPkgPrints("None");
    setPkgPhotographerCount("1");
    setPkgImage("");
  };

  const startEditingService = (service: any) => {
    setIsAddingService(true);
    setEditingServiceId(service.id);
    setSrvName(service.name || "");
    setSrvDesc(service.description || "");
    setSrvCat(service.category || "Portrait Photography");
    setSrvPrice(String(service.basePrice ?? ""));
    setSrvDuration(String(service.durationMinutes ?? "60"));
    setSrvImages(Array.isArray(service.images) && service.images.length > 0 ? service.images : (service.image ? [service.image] : []));
  };

  const startEditingPackage = (pkg: any) => {
    setIsAddingPackage(true);
    setEditingPackageId(pkg.id);
    setPkgCat(Array.isArray(studio.categories) && studio.categories.length > 0 ? studio.categories[0] : "Portrait Photography");
    setPkgName(pkg.name || "");
    setPkgDesc(pkg.description || "");
    setPkgPrice(String(pkg.price ?? ""));
    setPkgDuration(String(pkg.durationMinutes ?? "60"));
    setPkgPhotosCount(String(pkg.editedPhotosCount ?? "15"));
    setPkgPrints(pkg.includedPrints || "None");
    setPkgPhotographerCount(String(pkg.photographerCount ?? "1"));
    setPkgImage(pkg.image || "");
  };

  const handleAddServiceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!srvName.trim() || !srvPrice) return;
    try {
      const payload = {
        name: srvName,
        description: srvDesc,
        category: srvCat,
        basePrice: Number(srvPrice),
        durationMinutes: Number(srvDuration),
        image: srvImages[0] || undefined,
        images: srvImages
      };

      const data = await apiRequest(
        editingServiceId ? `/api/services/${editingServiceId}` : `/api/studios/${studio.id}/services`,
        {
          method: editingServiceId ? "PUT" : "POST",
          body: payload
        }
      );
      if (data.success) {
        resetServiceForm();
        onRefresh?.();
        alert(editingServiceId ? "Photoshoot service updated successfully!" : "New photoshoot service registered successfully!");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteService = async (serviceId: string) => {
    if (!confirm("Are you sure you want to delete this service?")) return;
    try {
      const data = await apiRequest(`/api/services/${serviceId}`, { method: "DELETE" });
      if (data.success) {
        onRefresh?.();
        alert("Photoshoot service deleted.");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddPackageSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pkgName.trim() || !pkgPrice) return;
    try {
      const payload = {
        name: pkgName,
        description: pkgDesc,
        price: Number(pkgPrice),
        durationMinutes: Number(pkgDuration),
        editedPhotosCount: Number(pkgPhotosCount),
        includedPrints: pkgPrints,
        photographerCount: Number(pkgPhotographerCount),
        image: pkgImage || undefined
      };

      const data = await apiRequest(
        editingPackageId ? `/api/packages/${editingPackageId}` : `/api/studios/${studio.id}/packages`,
        {
          method: editingPackageId ? "PUT" : "POST",
          body: payload
        }
      );
      if (data.success) {
        resetPackageForm();
        onRefresh?.();
        alert(editingPackageId ? "Custom photoshoot package updated successfully!" : "Custom photoshoot package added successfully!");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeletePackage = async (packageId: string) => {
    if (!confirm("Are you sure you want to delete this package?")) return;
    try {
      const data = await apiRequest(`/api/packages/${packageId}`, { method: "DELETE" });
      if (data.success) {
        onRefresh?.();
        alert("Photoshoot package deleted.");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddAddonSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addName.trim() || !addPrice) return;
    try {
      const data = await apiRequest(`/api/studios/${studio.id}/addons`, {
        method: "POST",
        body: {
          name: addName,
          price: Number(addPrice),
          description: addDesc,
          image: addImage || undefined
        }
      });
      if (data.success) {
        setIsAddingAddon(false);
        setAddName("");
        setAddPrice("");
        setAddDesc("");
        setAddImage("");
        onRefresh?.();
        alert("Studio add-on registered successfully!");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteAddon = async (addonId: string) => {
    if (!confirm("Are you sure you want to delete this add-on?")) return;
    try {
      const data = await apiRequest(`/api/addons/${addonId}`, { method: "DELETE" });
      if (data.success) {
        onRefresh?.();
        alert("Studio add-on deleted.");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const resetPrintProductForm = () => {
    setIsAddingPrintProduct(false);
    setEditingPrintProductId(null);
    setPrintProdName("");
    setPrintProdDesc("");
    setPrintProdSize("8x10 inches");
    setPrintProdPrice("");
    setPrintProdImages([]);
    setPrintProdExistingImages([]);
    setPrintProdHours("24");
  };

  const startEditingPrintProduct = (product: any) => {
    setEditingPrintProductId(product.id);
    setIsAddingPrintProduct(true);
    setPrintProdName(product.name || "");
    setPrintProdDesc(product.description || "");
    setPrintProdSize(product.size || "");
    setPrintProdPrice(String(product.price ?? ""));
    setPrintProdHours(String(product.estimatedHours ?? 24));
    setPrintProdImages([]);
    setPrintProdExistingImages(product.images?.length ? product.images : (product.image ? [product.image] : []));
  };

  const handleAddPrintProductSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!printProdName.trim() || !printProdPrice) return;
    const wasEditing = Boolean(editingPrintProductId);

    try {
      const data = await apiRequest(editingPrintProductId ? `/api/print-products/${editingPrintProductId}` : "/api/print-products", {
        method: editingPrintProductId ? "PUT" : "POST",
        body: {
          studioId: studio.id,
          name: printProdName,
          description: printProdDesc || "Premium photo print option.",
          size: printProdSize,
          price: Number(printProdPrice),
          images: printProdImages,
          estimatedHours: Number(printProdHours) || 24
        }
      });
      if (!data.success) {
        throw new Error(data.message || `Unable to ${editingPrintProductId ? "update" : "add"} print product.`);
      }
      resetPrintProductForm();
      onRefresh?.();
      alert(`Print product ${wasEditing ? "updated" : "added"} successfully.`);
    } catch (err) {
      console.error(err);
      alert(err instanceof Error ? err.message : `Unable to ${wasEditing ? "update" : "add"} print product.`);
    }
  };

  const handleDeletePrintProduct = async (productId: string) => {
    if (!confirm("Remove this print product from the studio catalog?")) return;

    try {
      const data = await apiRequest(`/api/print-products/${productId}`, { method: "DELETE" });
      if (!data.success) {
        throw new Error(data.message || "Unable to delete print product.");
      }
      onRefresh?.();
      alert("Print product removed.");
    } catch (err) {
      console.error(err);
      alert(err instanceof Error ? err.message : "Unable to remove print product.");
    }
  };

  // ── extra filter state for bookings tab ──────────────────────────────────
  const [bookingSearch, setBookingSearch] = React.useState("");
  const [bookingStatusFilter, setBookingStatusFilter] = React.useState("All");
  const [showBkFilters, setShowBkFilters] = React.useState(false);
  const [printSearch, setPrintSearch] = React.useState("");
  const [printStatusFilter, setPrintStatusFilter] = React.useState("All");
  const [showArchivedBookings, setShowArchivedBookings] = React.useState(false);
  const [showArchivedPrints, setShowArchivedPrints] = React.useState(false);

  // Reports & Analytics tab state (hoisted to satisfy Rules of Hooks)
  const [reportStatusFilter, setReportStatusFilter] = React.useState<string>("All");
  const [reportTypeFilter, setReportTypeFilter] = React.useState<string>("All");
  const [reportSearchQuery, setReportSearchQuery] = React.useState<string>("");
  const [comparePeriod, setComparePeriod] = React.useState<boolean>(true);
  // Date range filter for Reports
  type ReportDatePreset = "today" | "yesterday" | "this_week" | "last_week" | "this_month" | "last_month" | "this_year" | "all_time" | "custom";
  const [reportDatePreset, setReportDatePreset] = React.useState<ReportDatePreset>("all_time");
  const [reportCustomStart, setReportCustomStart] = React.useState<string>("");
  const [reportCustomEnd, setReportCustomEnd]   = React.useState<string>("");

  // Payment Proofs filter state
  const [paymentSearch, setPaymentSearch] = React.useState("");
  const [paymentStatusFilter, setPaymentStatusFilter] = React.useState("All");
  const [paymentTypeFilter, setPaymentTypeFilter] = React.useState("All");

  const filteredStudioPayments = React.useMemo(() => {
    let list = [...studioPayments];
    if (paymentSearch.trim()) {
      const q = paymentSearch.toLowerCase();
      list = list.filter(p =>
        p.id.toLowerCase().includes(q) ||
        (p.referenceNumber || "").toLowerCase().includes(q) ||
        (p.bookingId || "").toLowerCase().includes(q)
      );
    }
    if (paymentStatusFilter !== "All") list = list.filter(p => p.paymentStatus === paymentStatusFilter);
    if (paymentTypeFilter !== "All") list = list.filter(p => p.paymentType === paymentTypeFilter);
    return list.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
  }, [studioPayments, paymentSearch, paymentStatusFilter, paymentTypeFilter]);

  const filteredStudioBookings = React.useMemo(() => {
    let list = studioBookings.filter(b => !b.isArchived);
    if (bookingSearch.trim()) {
      const q = bookingSearch.toLowerCase();
      list = list.filter(b =>
        b.id.toLowerCase().includes(q) ||
        (b.customerDetails?.fullName || "").toLowerCase().includes(q) ||
        b.bookingDate?.includes(q)
      );
    }
    if (bookingStatusFilter !== "All") list = list.filter(b => b.status === bookingStatusFilter);
    return [...list].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [studioBookings, bookingSearch, bookingStatusFilter]);

  const filteredStudioPrints = React.useMemo(() => {
    let list = studioPrints.filter(o => !o.isArchived);
    if (printSearch.trim()) {
      const q = printSearch.toLowerCase();
      list = list.filter(o => o.id.toLowerCase().includes(q));
    }
    if (printStatusFilter !== "All") list = list.filter(o => o.status === printStatusFilter);
    return [...list].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [studioPrints, printSearch, printStatusFilter]);

  const bkStatusOptions = ["All", ...Array.from(new Set(studioBookings.map(b => b.status)))];
  const printStatusOptions = ["All", ...Array.from(new Set(studioPrints.map(o => o.status)))];

  // pending actions counters for header badges
  const pendingPayments = studioPayments.filter(p => p.paymentStatus === "Pending Verification").length;
  const pendingBookings = studioBookings.filter(b => b.status === "Pending").length;
  const pendingPrints = studioPrints.filter(o => o.status === "Pending").length;

  return (<>
    <div className="min-h-screen bg-[#f5f3ef] text-left pb-20 md:pb-10">

      {/* ── PAGE HEADER ─────────────────────────────────────────────────────── */}
      <div className="bg-white border-b border-[#e5e1da]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">

          {/* Studio identity row */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div className="flex items-center gap-4">
              {studio.logo ? (
                <img src={studio.logo} alt={studio.name} className="w-14 h-14 rounded-2xl object-cover border border-[#e5e1da] shadow-sm flex-shrink-0" />
              ) : (
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center flex-shrink-0 shadow-md">
                  <Camera size={22} className="text-white" />
                </div>
              )}
              <div>
                <p className="text-[10px] uppercase tracking-widest text-amber-600 font-bold mb-0.5">
                  {isStudioStaff ? "Staff Operations Workspace" : "Studio Operator Portal"}
                </p>
                <h1 className="font-display text-xl sm:text-2xl font-black text-[#2c2a29] leading-none flex flex-wrap items-center gap-2">
                  {studio.name}
                  {studio.isApproved && (
                    <span className="inline-flex items-center gap-1 text-[10px] bg-green-100 text-green-800 font-bold px-2.5 py-0.5 rounded-full border border-green-200">
                      <CheckCircle size={10} /> Verified Hub
                    </span>
                  )}
                </h1>
                {studio.location && (
                  <p className="text-xs text-[#7c756d] flex items-center gap-1 mt-0.5">
                    <MapPin size={10} className="text-amber-500" /> {studio.location}
                  </p>
                )}
              </div>
            </div>

            {/* Quick-action shortcuts */}
            {canManageStaff && (
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => { setActiveTab("management"); setManagementSubTab("branding"); }}
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-amber-500 hover:bg-amber-400 text-white text-xs font-bold rounded-xl cursor-pointer transition-colors shadow-sm"
                >
                  <Settings size={13} /> Branding
                </button>
                <button
                  onClick={() => { setActiveTab("management"); setManagementSubTab("catalog"); }}
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-gray-50 border border-[#e5e1da] text-[#2c2a29] text-xs font-bold rounded-xl cursor-pointer transition-colors"
                >
                  <Camera size={13} /> Catalog
                </button>
              </div>
            )}
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              {
                label: "Total Revenue",
                value: `₱${Number(overallIncome).toLocaleString("en-PH", { minimumFractionDigits: 0 })}`,
                sub: "Bookings + prints",
                icon: <DollarSign size={16} />, bg: "bg-emerald-50", color: "text-emerald-700"
              },
              {
                label: "Bookings",
                value: studioBookings.length,
                sub: `${pendingBookings > 0 ? `${pendingBookings} pending` : "All managed"}`,
                icon: <Calendar size={16} />, bg: "bg-blue-50", color: "text-blue-700",
                badge: pendingBookings > 0 ? pendingBookings : null
              },
              {
                label: "Print Orders",
                value: studioPrints.length,
                sub: `${pendingPrints > 0 ? `${pendingPrints} pending` : "Up to date"}`,
                icon: <Printer size={16} />, bg: "bg-amber-50", color: "text-amber-700",
                badge: pendingPrints > 0 ? pendingPrints : null
              },
              {
                label: "Avg Rating",
                value: studioReviews.length > 0 ? `${(studioReviews.reduce((s, r) => s + r.rating, 0) / studioReviews.length).toFixed(1)} ★` : "5.0 ★",
                sub: `From ${studioReviews.length} reviews`,
                icon: <Star size={16} className="fill-yellow-500 text-yellow-500" />, bg: "bg-yellow-50", color: "text-yellow-700"
              },
            ].map(stat => (
              <div key={stat.label} className="bg-[#faf9f6] border border-[#e5e1da] rounded-2xl p-3.5 flex items-center gap-3 relative overflow-hidden">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${stat.bg} ${stat.color}`}>
                  {stat.icon}
                </div>
                <div className="min-w-0">
                  <p className="text-[9px] font-bold uppercase tracking-wider text-[#7c756d] truncate">{stat.label}</p>
                  <p className={`text-lg font-black leading-none ${stat.color}`}>{stat.value}</p>
                  <p className="text-[9px] text-[#7c756d] truncate">{stat.sub}</p>
                </div>
                {(stat as any).badge && (
                  <span className="absolute top-2 right-2 w-5 h-5 rounded-full bg-red-500 text-white text-[9px] font-black flex items-center justify-center">
                    {(stat as any).badge}
                  </span>
                )}
              </div>
            ))}
          </div>

          {/* Pending payments alert */}
          {pendingPayments > 0 && (
            <div className="mt-3 flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-2xl px-4 py-2.5">
              <AlertTriangle size={14} className="text-amber-600 flex-shrink-0" />
              <p className="text-xs font-bold text-amber-800">
                {pendingPayments} payment{pendingPayments !== 1 ? "s" : ""} awaiting your verification —{" "}
                <button onClick={() => setActiveTab("bookings")} className="underline cursor-pointer hover:no-underline">review now</button>
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ── SETUP CHECKLIST (admin-only, shown when incomplete) ──────────────── */}
      {canManageStaff && (!(logo && coverImage) || selectedCategories.length === 0 || !services.some(s => s.studioId === studio.id)) && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-5">
          <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-2xl p-5 space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <span className="inline-flex items-center gap-1.5 bg-amber-100 text-amber-800 border border-amber-300 px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider">
                  <Sparkles size={11} /> Studio Setup Checklist
                </span>
                <p className="text-xs text-[#526574] mt-1">Complete your studio profile to attract more clients.</p>
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { label: "Logo & Cover", done: !!(logo && coverImage), sub: logo && coverImage ? "Done" : "Upload photos", tab: "branding" as const },
                { label: "Location & Category", done: !!(location && selectedCategories.length > 0), sub: `${selectedCategories.length} specialties`, tab: "branding" as const },
                { label: "Services", done: services.some(s => s.studioId === studio.id), sub: `${services.filter(s => s.studioId === studio.id).length} listed`, tab: "catalog" as const },
                { label: "Packages", done: packages.some(p => p.studioId === studio.id), sub: `${packages.filter(p => p.studioId === studio.id).length} created`, tab: "catalog" as const },
              ].map(item => (
                <button
                  key={item.label}
                  onClick={() => { setActiveTab("management"); setManagementSubTab(item.tab); }}
                  className={`p-3 rounded-xl border flex items-center gap-2 cursor-pointer transition-all hover:scale-[1.01] text-left ${item.done ? "bg-green-50 border-green-200" : "bg-white border-amber-200 hover:border-amber-400"}`}
                >
                  <CheckCircle size={14} className={item.done ? "text-green-600 flex-shrink-0" : "text-gray-300 flex-shrink-0"} />
                  <div>
                    <p className={`text-[10px] font-bold ${item.done ? "text-green-700" : "text-[#2c2a29]"}`}>{item.label}</p>
                    <p className="text-[9px] text-[#7c756d]">{item.sub}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── MAIN CONTENT ──────────────────────────────────────────────────────── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-5">

      {/* 3. WORKSPACE TAB WORKFLOWS */}

      {/* Tab A: Bookings & Downpayments Tracker */}
      {activeTab === "bookings" && (
        <div className="space-y-4">
          {/* Revenue Overview Chart Card */}
          <div className="bg-white rounded-2xl border border-[#e5e1da] p-6 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="font-display font-black text-lg text-[#2c2a29] flex items-center gap-2">
                  <BarChart3 size={20} className="text-amber-500" />
                  Revenue Overview
                </h3>
                <p className="text-xs text-[#7c756d]">Total verified payments from bookings and print orders by month</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-bold uppercase tracking-wider text-[#7c756d]">Gross Volume (6mo)</p>
                <p className="text-xl font-black text-emerald-700">₱{monthlyRevenueOverviewData.reduce((s, m) => s + m.total, 0).toLocaleString()}</p>
              </div>
            </div>
            
            <div className="h-48 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={monthlyRevenueOverviewData} margin={{ top: 10, right: 0, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorTotalRev" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.15}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0ede8" />
                  <XAxis 
                    dataKey="label" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 10, fill: '#7c756d', fontWeight: 600 }} 
                    dy={10}
                  />
                  <YAxis 
                    hide 
                  />
                  <Tooltip 
                    content={({ active, payload }: any) => {
                      if (active && payload && payload.length) {
                        return (
                          <div className="bg-[#2c2a29] text-white p-2.5 rounded-xl shadow-xl border border-[#4a4644]">
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter mb-1">{payload[0].payload.label}</p>
                            <p className="text-xs font-black text-amber-400">₱{Number(payload[0].value).toLocaleString()}</p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="total" 
                    stroke="#10b981" 
                    strokeWidth={3} 
                    fillOpacity={1} 
                    fill="url(#colorTotalRev)" 
                    animationDuration={1500}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Search + Filter bar */}
          <div className="bg-white rounded-2xl border border-[#e5e1da] p-4 space-y-3">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <div className="relative flex-1">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                <input
                  value={bookingSearch}
                  onChange={e => setBookingSearch(e.target.value)}
                  placeholder="Search by booking ID, customer name, or date…"
                  className="w-full pl-9 pr-4 py-2.5 text-xs border border-[#e5e1da] rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-300 bg-[#faf9f6]"
                />
              </div>
              <button
                onClick={() => setShowBkFilters(v => !v)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-xs font-bold cursor-pointer transition-colors ${showBkFilters ? "bg-amber-500 border-amber-500 text-white" : "bg-white border-[#e5e1da] text-[#2c2a29] hover:bg-gray-50"}`}
              >
                <SlidersHorizontal size={13} /> Filter
                {bookingStatusFilter !== "All" && <span className="w-4 h-4 rounded-full bg-white text-amber-600 text-[9px] font-black flex items-center justify-center">1</span>}
              </button>
            </div>
            {showBkFilters && (
              <div className="border-t border-gray-100 pt-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-[#7c756d] mb-2">Booking Status</p>
                <div className="flex flex-wrap gap-1.5">
                  {bkStatusOptions.map(s => (
                    <button key={s} onClick={() => setBookingStatusFilter(s)}
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border cursor-pointer transition-all ${bookingStatusFilter === s ? "bg-amber-500 border-amber-500 text-white" : "bg-white border-[#e5e1da] text-[#7c756d] hover:border-amber-300"}`}>
                      {s}
                    </button>
                  ))}
                  {bookingStatusFilter !== "All" && (
                    <button onClick={() => { setBookingStatusFilter("All"); setBookingSearch(""); }}
                      className="px-2.5 py-1 rounded-lg text-[10px] font-bold text-rose-600 cursor-pointer flex items-center gap-1">
                      <X size={10} /> Clear
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between">
            <p className="text-xs text-[#7c756d] font-medium">
              Showing <strong className="text-[#2c2a29]">{filteredStudioBookings.length}</strong> of {studioBookings.length} booking{studioBookings.length !== 1 ? "s" : ""}
            </p>
          </div>

          {studioBookings.length === 0 ? (
            <div className="bg-white rounded-2xl border border-[#e5e1da] py-16 text-center space-y-2">
              <div className="w-12 h-12 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto"><Calendar size={22} className="text-gray-300" /></div>
              <p className="text-sm font-bold text-[#2c2a29]">No bookings yet</p>
              <p className="text-xs text-[#7c756d]">Bookings from customers will appear here once they schedule sessions.</p>
            </div>
          ) : filteredStudioBookings.length === 0 ? (
            <div className="bg-white rounded-2xl border border-[#e5e1da] py-10 text-center">
              <p className="text-sm font-bold text-[#2c2a29]">No results found</p>
              <p className="text-xs text-[#7c756d] mt-1">Try adjusting your search or filters.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredStudioBookings.map((bk) => {
                const pmObj = studioPayments.find(p => p.bookingId === bk.id && p.paymentStatus === "Pending Verification")
                  || studioPayments.find(p => p.bookingId === bk.id);
                const statusColor =
                  bk.status === "Completed"        ? "bg-green-50 text-green-700 border-green-200" :
                  bk.status === "Ongoing"          ? "bg-cyan-50 text-cyan-700 border-cyan-200" :
                  bk.status === "Confirmed"        ? "bg-blue-50 text-blue-700 border-blue-200" :
                  bk.status === "Rescheduled"      ? "bg-indigo-50 text-indigo-700 border-indigo-200" :
                  bk.status === "Awaiting Payment" ? "bg-orange-50 text-orange-700 border-orange-200" :
                  bk.status === "Pending"          ? "bg-yellow-50 text-yellow-800 border-yellow-200" :
                  bk.status === "No Show"          ? "bg-gray-100 text-gray-500 border-gray-200" :
                  bk.status === "Cancelled" || bk.status === "Rejected" ? "bg-rose-50 text-rose-700 border-rose-200" :
                  "bg-gray-100 text-gray-500 border-gray-200";
                const accentBar =
                  bk.status === "Completed"        ? "bg-green-500" :
                  bk.status === "Ongoing"          ? "bg-cyan-500" :
                  bk.status === "Confirmed"        ? "bg-blue-500" :
                  bk.status === "Rescheduled"      ? "bg-indigo-400" :
                  bk.status === "Awaiting Payment" ? "bg-orange-400" :
                  bk.status === "Pending"          ? "bg-yellow-400" :
                  bk.status === "Cancelled" || bk.status === "Rejected" ? "bg-red-400" : "bg-gray-300";

                return (
                  <div key={bk.id} className="bg-white rounded-2xl border border-[#e5e1da] overflow-hidden hover:shadow-md transition-shadow">
                    <div className={`h-1 w-full ${accentBar}`} />
                    <div className="p-4 sm:p-5">
                      {/* Header row */}
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                        <div className="flex items-start gap-3 min-w-0">
                          {/* Customer avatar */}
                          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-100 to-amber-200 flex items-center justify-center flex-shrink-0 font-black text-amber-700 text-sm">
                            {bk.customerDetails?.fullName?.charAt(0)?.toUpperCase() || "?"}
                          </div>
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-1.5 mb-0.5">
                              <span className="text-[10px] bg-[#2c2a29] text-white px-2 py-0.5 rounded font-bold tracking-wider">{bk.id}</span>
                              <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border uppercase tracking-wider ${statusColor}`}>{bk.status}</span>
                              {pmObj && (
                                <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border uppercase tracking-wider ${
                                  pmObj.paymentStatus === "Paid" ? "bg-green-50 text-green-700 border-green-200" :
                                  pmObj.paymentStatus === "Pending Verification" ? "bg-yellow-50 text-yellow-700 border-yellow-200" :
                                  "bg-gray-100 text-gray-500 border-gray-200"
                                }`}>{pmObj.paymentStatus}</span>
                              )}
                              {!pmObj && <span className="text-[9px] font-bold px-2 py-0.5 rounded-full border bg-rose-50 text-rose-700 border-rose-200 uppercase">Unpaid</span>}
                            </div>
                            <p className="font-bold text-[#2c2a29] text-sm leading-tight">{bk.customerDetails?.fullName}</p>
                            <p className="text-[10px] text-[#7c756d]">{bk.customerDetails?.phone} · {bk.customerDetails?.email}</p>
                          </div>
                        </div>
                        {/* Date/time chip */}
                        <div className="flex-shrink-0 bg-[#faf9f6] border border-[#e5e1da] rounded-xl px-3 py-2 text-right">
                          <p className="text-[9px] font-bold uppercase tracking-wider text-[#7c756d]">Scheduled</p>
                          <p className="text-xs font-bold text-[#2c2a29]">{bk.bookingDate}</p>
                          <p className="text-[10px] text-[#7c756d]">{bk.timeSlot}</p>
                        </div>
                      </div>

                      {/* Financial summary row */}
                      <div className="mt-3 grid grid-cols-3 gap-2">
                        {[
                          { label: "Total", value: `₱${Number(bk.totalAmount).toLocaleString()}` },
                          { label: "Paid", value: `₱${Number(bk.amountPaid || 0).toLocaleString()}`, highlight: "text-emerald-700" },
                          { label: "Balance", value: `₱${Number(bk.remainingBalance ?? Math.max(0, bk.totalAmount - (bk.amountPaid || 0))).toLocaleString()}`, highlight: "text-amber-700" },
                        ].map(item => (
                          <div key={item.label} className="bg-[#faf9f6] rounded-xl px-3 py-2">
                            <p className="text-[9px] font-bold uppercase tracking-wider text-[#7c756d]">{item.label}</p>
                            <p className={`text-xs font-bold ${item.highlight || "text-[#2c2a29]"}`}>{item.value}</p>
                          </div>
                        ))}
                      </div>

                      {/* Pending Reschedule Request Banner */}
                      {bk.rescheduleRequest && bk.rescheduleRequest.status === "pending" && (
                        <div className="mt-3 bg-indigo-50 border border-indigo-200 rounded-xl p-3 space-y-2 text-indigo-900">
                          <div className="flex items-center gap-1.5 font-bold text-xs">
                            <RefreshCw size={13} className="text-indigo-600 animate-spin" />
                            <span>Pending Reschedule Request from Customer</span>
                          </div>
                          <p className="text-[11px] text-indigo-800">
                            Requested New Schedule: <strong>{bk.rescheduleRequest.requestedDate} @ {bk.rescheduleRequest.requestedTimeSlot}</strong>
                            {bk.rescheduleRequest.reason && <span> · Reason: "{bk.rescheduleRequest.reason}"</span>}
                          </p>
                          <div className="flex gap-2 pt-1">
                            <button
                              type="button"
                              onClick={async () => {
                                try {
                                  const res = await apiRequest(`/api/bookings/${bk.id}/reschedule-approve`, { method: "PUT" });
                                  if (res.success) {
                                    alert("Reschedule request approved successfully!");
                                    onRefresh?.();
                                  }
                                } catch (e: any) {
                                  alert(e.message || "Failed to approve reschedule request.");
                                }
                              }}
                              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-bold rounded-lg cursor-pointer"
                            >
                              ✓ Approve Reschedule
                            </button>
                            <button
                              type="button"
                              onClick={async () => {
                                const reason = prompt("Reason for rejection (optional):") || "Studio schedule conflict";
                                try {
                                  const res = await apiRequest(`/api/bookings/${bk.id}/reschedule-reject`, {
                                    method: "PUT",
                                    body: { reason }
                                  });
                                  if (res.success) {
                                    alert("Reschedule request rejected.");
                                    onRefresh?.();
                                  }
                                } catch (e: any) {
                                  alert(e.message || "Failed to reject reschedule request.");
                                }
                              }}
                              className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-[10px] font-bold rounded-lg cursor-pointer"
                            >
                              ✕ Reject Request
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Payment details block */}
                      {pmObj && (
                        <div className="mt-3 bg-[#faf9f6] border border-[#e5e1da] rounded-xl p-3 space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-[10px] font-bold text-[#2c2a29]">Payment via {pmObj.paymentMethod}</span>
                            {(pmObj as any).paymentChannel === "gcash_qr" && (
                              <span className="text-[9px] font-extrabold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded">🛡️ QR Gateway</span>
                            )}
                            {(pmObj as any).fraudScore === -1 && (
                              <span className="text-[9px] font-extrabold text-red-700 bg-red-50 border border-red-200 px-1.5 py-0.5 rounded">⚠️ Amount Mismatch</span>
                            )}
                          </div>
                          <div className="flex flex-wrap items-center gap-3 text-[10px] text-[#7c756d]">
                            {pmObj.referenceNumber && <span>Ref: <strong className="text-[#2c2a29]">{pmObj.referenceNumber}</strong></span>}
                            {(pmObj as any).gatewayTransactionId && <span className="font-mono">TxID: {(pmObj as any).gatewayTransactionId?.slice(0, 16)}…</span>}
                            {pmObj.proofOfPayment && (
                              <button type="button"
                                onClick={() => setViewingReceipt({ url: pmObj.proofOfPayment, ref: pmObj.referenceNumber || (pmObj as any).gatewayTransactionId || "N/A", amount: Number(pmObj.amount), method: pmObj.paymentMethod })}
                                className="flex items-center gap-1 text-blue-600 font-bold hover:underline cursor-pointer bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                                <Eye size={10} /> View Receipt
                              </button>
                            )}
                          </div>
                          {canManageDownpayments && pmObj.paymentStatus === "Pending Verification" && (
                            <div className="flex gap-2 pt-1">
                              <button onClick={() => onUpdateStatus("payment", pmObj.id, "Verified")}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-bold rounded-lg cursor-pointer">
                                <Check size={11} /> Approve & Confirm Booking
                              </button>
                              <button onClick={() => onUpdateStatus("payment", pmObj.id, "Rejected")}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-[10px] font-bold rounded-lg cursor-pointer">
                                <X size={11} /> Reject Receipt
                              </button>
                            </div>
                          )}
                          {canManageDownpayments && bk.remainingBalance > 0 && bk.amountPaid >= bk.downPaymentAmount && (
                            <button onClick={() => recordBalancePayment(bk)} disabled={recordingBalanceId === bk.id}
                              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-[10px] font-bold rounded-lg cursor-pointer disabled:opacity-50">
                              {recordingBalanceId === bk.id ? "Recording…" : `💵 Record Balance Payment (₱${Number(bk.remainingBalance).toLocaleString()})`}
                            </button>
                          )}
                        </div>
                      )}

                      {/* Requirement */}
                      {bk.requirementsDoc && (
                        <div className="mt-2 flex items-center gap-1.5 text-[10px] text-green-700 font-bold">
                          <Check size={11} /> Requirements: {bk.requirementsDoc}
                        </div>
                      )}

                      {/* Action buttons */}
                      <div className="mt-3 pt-3 border-t border-gray-100 flex flex-wrap items-center gap-2">
                        <button onClick={() => setViewingBooking(bk)}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-[#faf9f6] hover:bg-gray-100 text-[#2c2a29] border border-[#e5e1da] text-[10px] font-bold rounded-lg cursor-pointer">
                          <Eye size={11} /> View Details
                        </button>
                        <button onClick={() => setProofingBookingId(bk.id)}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 text-[10px] font-bold rounded-lg cursor-pointer">
                          <ImageIcon size={11} /> Photo Proofs
                        </button>
                        {pmObj && (pmObj.status === "Verified" || pmObj.paymentStatus === "Paid") && (
                          <button onClick={() => generateBookingReceiptPDF(bk, studio)}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 text-[10px] font-bold rounded-lg cursor-pointer">
                            <Download size={11} /> PDF Receipt
                          </button>
                        )}
                        {/* ── PENDING: Approve or Cancel ───────────────── */}
                        {bk.status === "Pending" && (
                          <>
                            <button onClick={() => onUpdateStatus("booking", bk.id, "Confirmed")}
                              className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 hover:bg-green-500 text-white text-[10px] font-bold rounded-lg cursor-pointer">
                              <Check size={11} /> Approve Booking
                            </button>
                            <button onClick={() => onUpdateStatus("booking", bk.id, "Cancelled")}
                              className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-[10px] font-bold rounded-lg cursor-pointer">
                              <X size={11} /> Cancel
                            </button>
                          </>
                        )}

                        {/* ── AWAITING PAYMENT: manual cancel only (payment approval is above) ── */}
                        {bk.status === "Awaiting Payment" && (
                          <button onClick={() => onUpdateStatus("booking", bk.id, "Cancelled")}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-[10px] font-bold rounded-lg cursor-pointer">
                            <X size={11} /> Cancel Booking
                          </button>
                        )}

                        {/* ── RESCHEDULED: re-confirm so it rejoins the normal flow ── */}
                        {bk.status === "Rescheduled" && (
                          <>
                            <button onClick={() => onUpdateStatus("booking", bk.id, "Confirmed")}
                              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-bold rounded-lg cursor-pointer">
                              <Check size={11} /> Confirm New Schedule
                            </button>
                            <button onClick={() => onUpdateStatus("booking", bk.id, "Cancelled")}
                              className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-[10px] font-bold rounded-lg cursor-pointer">
                              <X size={11} /> Cancel
                            </button>
                          </>
                        )}

                        {/* ── CONFIRMED / RESCHEDULED → Start Session (→ Ongoing) ── */}
                        {["Confirmed", "Rescheduled"].includes(bk.status) && (
                          <button onClick={() => onUpdateStatus("booking", bk.id, "Ongoing")}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white text-[10px] font-bold rounded-lg cursor-pointer">
                            <Check size={11} /> Start Session
                          </button>
                        )}

                        {/* ── ONGOING → Complete or No Show ───────────── */}
                        {bk.status === "Ongoing" && (
                          <>
                            <button onClick={() => onUpdateStatus("booking", bk.id, "Completed")}
                              className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 hover:bg-green-500 text-white text-[10px] font-bold rounded-lg cursor-pointer">
                              <Check size={11} /> Complete Shoot
                            </button>
                            <button onClick={() => {
                              if (window.confirm("Mark this booking as No Show? This cannot be undone.")) {
                                onUpdateStatus("booking", bk.id, "No Show");
                              }
                            }}
                              className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-200 text-[10px] font-bold rounded-lg cursor-pointer">
                              <X size={11} /> No Show
                            </button>
                          </>
                        )}

                        {/* ── Reschedule (admin only, non-terminal statuses) ── */}
                        {["Confirmed", "Rescheduled", "Pending", "Awaiting Payment"].includes(bk.status) && canManageDownpayments && (
                          <button onClick={() => setReschedulingBooking(bk)}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-[10px] font-bold rounded-lg cursor-pointer">
                            <RefreshCw size={11} /> Reschedule
                          </button>
                        )}

                        {/* Archive — only for terminal-status bookings */}
                        {["Completed", "Cancelled", "Rejected", "Expired", "No Show"].includes(bk.status) && onArchiveBooking && (
                          <button
                            onClick={() => { if (window.confirm(`Archive booking ${bk.id}? It will be hidden from this view.`)) onArchiveBooking(bk.id); }}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 text-[10px] font-bold rounded-lg cursor-pointer ml-auto">
                            📦 Archive
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ── Archived bookings accordion ─────────────────────────────── */}
          {studioBookings.filter(b => b.isArchived).length > 0 && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 overflow-hidden">
              <button type="button"
                onClick={() => setShowArchivedBookings(v => !v)}
                className="w-full flex items-center justify-between px-5 py-3.5 cursor-pointer hover:bg-amber-100 transition-colors">
                <div className="flex items-center gap-2">
                  <span className="text-sm">📦</span>
                  <span className="text-xs font-bold text-amber-800">
                    Archived Bookings ({studioBookings.filter(b => b.isArchived).length})
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
                        <th className="py-2.5 px-3">Customer</th>
                        <th className="py-2.5 px-3">Date</th>
                        <th className="py-2.5 px-3">Status</th>
                        <th className="py-2.5 px-3">Archived On</th>
                        <th className="py-2.5 px-3">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-amber-100">
                      {studioBookings.filter(b => b.isArchived).map(b => (
                        <tr key={b.id} className="bg-white/60 hover:bg-amber-50 transition-colors">
                          <td className="py-2.5 px-4 font-mono text-[10px] font-bold text-[#2c2a29]">{b.id}</td>
                          <td className="py-2.5 px-3 text-[10px] text-[#2c2a29]">{b.customerDetails?.fullName || "—"}</td>
                          <td className="py-2.5 px-3 text-[10px] text-[#7c756d]">{b.bookingDate}</td>
                          <td className="py-2.5 px-3">
                            <span className="inline-flex px-2 py-0.5 rounded-full text-[9px] font-bold border bg-gray-100 text-gray-600 border-gray-200 uppercase">{b.status}</span>
                          </td>
                          <td className="py-2.5 px-3 text-[10px] text-[#7c756d]">
                            {b.archivedAt ? new Date(b.archivedAt).toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" }) : "—"}
                          </td>
                          <td className="py-2.5 px-3">
                            <div className="flex gap-1.5">
                              {onUnarchiveBooking && (
                                <button type="button"
                                  onClick={() => { if (window.confirm(`Restore booking ${b.id} from archive?`)) onUnarchiveBooking(b.id); }}
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
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Tab: Calendar Workload Planner */}
      {activeTab === "calendar" && (
        <div className="space-y-6">
          <SystemCalendar
            bookings={studioBookings}
            studio={studio}
            services={services}
            packages={packages}
            addons={addons}
            userRole="STUDIO_ADMIN"
            onSelectBooking={(b) => setViewingBooking(b)}
            onOpenProofing={(bookingId) => setProofingBookingId(bookingId)}
          />
        </div>
      )}

      {/* Tab B: Printing Shop Orders */}
      {activeTab === "prints" && (
        <div className="space-y-4">
          {/* Search + filter */}
          <div className="bg-white rounded-2xl border border-[#e5e1da] p-4 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <div className="relative flex-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              <input
                value={printSearch}
                onChange={e => setPrintSearch(e.target.value)}
                placeholder="Search print orders by ID…"
                className="w-full pl-9 pr-4 py-2.5 text-xs border border-[#e5e1da] rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-300 bg-[#faf9f6]"
              />
            </div>
            <div className="flex flex-wrap gap-1.5">
              {printStatusOptions.map(s => (
                <button key={s} onClick={() => setPrintStatusFilter(s)}
                  className={`px-3 py-1.5 rounded-xl text-[10px] font-bold border cursor-pointer transition-all ${printStatusFilter === s ? "bg-amber-500 border-amber-500 text-white" : "bg-white border-[#e5e1da] text-[#7c756d] hover:border-amber-300"}`}>
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between">
            <p className="text-xs text-[#7c756d] font-medium">
              Showing <strong className="text-[#2c2a29]">{filteredStudioPrints.length}</strong> of {studioPrints.length} order{studioPrints.length !== 1 ? "s" : ""}
            </p>
          </div>

          {studioPrints.length === 0 ? (
            <div className="bg-white rounded-2xl border border-[#e5e1da] py-16 text-center space-y-2">
              <div className="w-12 h-12 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto"><Printer size={22} className="text-gray-300" /></div>
              <p className="text-sm font-bold text-[#2c2a29]">No print orders yet</p>
              <p className="text-xs text-[#7c756d]">Customer print orders will appear here once submitted.</p>
            </div>
          ) : filteredStudioPrints.length === 0 ? (
            <div className="bg-white rounded-2xl border border-[#e5e1da] py-10 text-center">
              <p className="text-sm font-bold text-[#2c2a29]">No results match your filter</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredStudioPrints.map((ord) => {
                const printProduct = printProducts.find(product => product.id === ord.productId);
                const statusStep =
                  ord.status === "Completed" ? 4 :
                  ord.status === "Ready for Pickup" ? 3 :
                  (ord.status === "Processing" || ord.status === "Quality Check") ? 2 : 1;
                const statusAccent =
                  ord.status === "Completed" ? "bg-green-500" :
                  ord.status === "Ready for Pickup" ? "bg-emerald-400" :
                  ord.status === "Processing" || ord.status === "Quality Check" ? "bg-blue-400" :
                  ord.status === "Confirmed" ? "bg-indigo-400" :
                  "bg-yellow-400";

                return (
                  <div key={ord.id} className="bg-white rounded-2xl border border-[#e5e1da] overflow-hidden hover:shadow-md transition-shadow">
                    <div className={`h-1 w-full ${statusAccent}`} />
                    {/* Progress bar */}
                    <div className="h-1 bg-gray-100">
                      <div className={`h-full bg-gradient-to-r from-amber-400 to-emerald-500 transition-all duration-700`}
                        style={{ width: `${[0, 25, 50, 75, 100][statusStep]}%` }} />
                    </div>

                    <div className="p-4 sm:p-5">
                      {/* Header */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex items-center gap-3 min-w-0">
                          <button
                            type="button"
                            onClick={() => setViewingPrintPhoto(resolvedStudioPrintMedia[ord.uploadedPhoto] || ord.uploadedPhoto)}
                            aria-label={`View photo for print order ${ord.id}`}
                            title="View full-size print photo"
                            className="relative flex-shrink-0 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500"
                          >
                            <img src={resolvedStudioPrintMedia[ord.uploadedPhoto] || ord.uploadedPhoto}
                              alt="Customer photo to print" className="w-20 h-20 rounded-xl object-cover border border-gray-200 shadow-sm" />
                            <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-white border border-gray-200 flex items-center justify-center shadow-sm">
                              <Printer size={10} className="text-gray-500" />
                            </div>
                          </button>
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-1.5 mb-0.5">
                              <span className="text-[10px] bg-[#2c2a29] text-white px-2 py-0.5 rounded font-bold">{ord.id}</span>
                              <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border uppercase tracking-wider ${
                                statusStep === 4 ? "bg-green-50 text-green-700 border-green-200" :
                                statusStep === 3 ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                                statusStep === 2 ? "bg-blue-50 text-blue-700 border-blue-200" :
                                ord.status === "Confirmed" ? "bg-indigo-50 text-indigo-700 border-indigo-200" :
                                "bg-yellow-50 text-yellow-700 border-yellow-200"
                              }`}>{ord.status}</span>
                              <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border uppercase tracking-wider ${
                                ord.paymentStatus === "Paid" ? "bg-green-50 text-green-700 border-green-200" :
                                "bg-rose-50 text-rose-700 border-rose-200"
                              }`}>{ord.paymentStatus}</span>
                            </div>
                            <p className="text-xs font-bold text-[#2c2a29]">{ord.quantity} × {printProduct?.name || "custom print"}</p>
                            {printProduct?.size && <p className="text-[10px] text-[#7c756d]">Size: {printProduct.size}</p>}
                            <p className="text-[10px] text-[#7c756d]">
                              🏪 Studio Counter Pickup
                            </p>
                          </div>
                        </div>
                        {/* Amount + milestone dots */}
                        <div className="flex-shrink-0 text-right space-y-1.5">
                          <p className="text-base font-black text-[#2c2a29]">₱{Number(ord.totalAmount).toLocaleString()}</p>
                          <div className="flex items-center justify-end gap-1">
                            {[1, 2, 3, 4].map(step => (
                              <div key={step} className={`w-2 h-2 rounded-full transition-colors ${statusStep >= step ? "bg-amber-500" : "bg-gray-200"}`} />
                            ))}
                          </div>
                        </div>
                      </div>

                      <div className="mt-3 bg-[#faf9f6] border border-[#e5e1da] rounded-xl p-3">
                        <p className="text-[10px] uppercase tracking-wide font-bold text-[#7c756d]">Customer print design</p>
                        {ord.printDesign ? (
                          <p className="mt-1 text-xs font-semibold text-[#2c2a29]">
                            {ord.printDesign.frameStyle === "black" ? "Charcoal Black" : ord.printDesign.frameStyle === "oak" ? "Classic Oak Wood" : ord.printDesign.frameStyle === "gold" ? "Brushed Gold" : ord.printDesign.frameStyle === "frameless" ? "Frameless Canvas" : ord.printDesign.frameStyle}
                            {" · "}
                            {ord.printDesign.matteFinish === "glossy" ? "Glossy" : ord.printDesign.matteFinish === "matte" ? "Matte" : ord.printDesign.matteFinish}
                            {" · "}
                            {ord.printDesign.scaleMode === "fit" ? "Fit" : ord.printDesign.scaleMode === "fill" ? "Full Bleed" : ord.printDesign.scaleMode}
                          </p>
                        ) : (
                          <p className="mt-1 text-[10px] text-[#7c756d]">No design options were recorded for this order.</p>
                        )}
                      </div>

                      {/* Payment verification block — only show Record Cash Payment for Unpaid orders */}
                      {ord.paymentStatus === "Unpaid" && (
                        <div className="mt-3 bg-amber-50 border border-amber-200 rounded-xl p-3 space-y-2">
                          <p className="text-[10px] text-amber-800 font-semibold flex items-center gap-1">💵 Customer pays upon pickup — record cash collection below:</p>
                          {onRecordPrintCashPayment && (
                            <button
                              onClick={() => handleOpenCashPaymentModal(ord)}
                              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white border border-emerald-700 text-[10px] font-bold rounded-lg cursor-pointer shadow-sm"
                            >
                              💵 Record Cash Payment on Pickup
                            </button>
                          )}
                        </div>
                      )}

                      {/* Fulfillment action buttons */}
                      <div className="mt-3 pt-3 border-t border-gray-100 flex flex-wrap items-center gap-2">
                        {ord.status === "Pending" && (
                          <button onClick={() => onUpdateStatus("print", ord.id, "Confirmed")}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#2c2a29] hover:bg-[#4a4644] text-white text-[10px] font-bold rounded-lg cursor-pointer">
                            <Check size={11} /> Confirm Order
                          </button>
                        )}
                        {ord.status === "Confirmed" && (
                          <button onClick={() => onUpdateStatus("print", ord.id, "Processing")}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-bold rounded-lg cursor-pointer">
                            <Printer size={11} /> Start Printing
                          </button>
                        )}
                        {ord.status === "Processing" && (
                          <button onClick={() => onUpdateStatus("print", ord.id, "Quality Check")}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-white text-[10px] font-bold rounded-lg cursor-pointer">
                            🔍 Quality Check
                          </button>
                        )}
                        {ord.status === "Quality Check" && (
                          <button onClick={() => onUpdateStatus("print", ord.id, "Ready for Pickup")}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-white text-[10px] font-bold rounded-lg cursor-pointer">
                            ✓ Mark Ready for Pickup
                          </button>
                        )}
                        {ord.status === "Ready for Pickup" && (
                          <button onClick={() => onUpdateStatus("print", ord.id, "Completed")}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 hover:bg-green-500 text-white text-[10px] font-bold rounded-lg cursor-pointer">
                            <Check size={11} /> Mark Completed
                          </button>
                        )}
                        {ord.status === "Completed" && (
                          <span className="flex items-center gap-1.5 text-[10px] text-green-700 font-bold bg-green-50 border border-green-200 rounded-lg px-3 py-1.5">
                            <Check size={11} /> Order Fulfilled
                          </span>
                        )}
                        {/* Archive — only for terminal-status orders */}
                        {["Completed", "Cancelled"].includes(ord.status) && onArchivePrintOrder && (
                          <button
                            onClick={() => { if (window.confirm(`Archive print order ${ord.id}? It will be hidden from this view.`)) onArchivePrintOrder(ord.id); }}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 text-[10px] font-bold rounded-lg cursor-pointer ml-auto">
                            📦 Archive
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {viewingPrintPhoto && (
            <div
              role="dialog"
              aria-modal="true"
              aria-label="Print order photo preview"
              onClick={() => setViewingPrintPhoto(null)}
              className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
            >
              <div className="relative max-w-5xl max-h-full" onClick={event => event.stopPropagation()}>
                <button
                  type="button"
                  onClick={() => setViewingPrintPhoto(null)}
                  aria-label="Close photo preview"
                  className="absolute -top-3 -right-3 z-10 w-9 h-9 rounded-full bg-white text-[#2c2a29] flex items-center justify-center shadow-lg"
                >
                  <X size={18} />
                </button>
                <img src={viewingPrintPhoto} alt="Full-size customer photo for printing" className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl" />
              </div>
            </div>
          )}

          {/* ── Archived print orders accordion ─────────────────────────── */}
          {studioPrints.filter(o => o.isArchived).length > 0 && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 overflow-hidden">
              <button type="button"
                onClick={() => setShowArchivedPrints(v => !v)}
                className="w-full flex items-center justify-between px-5 py-3.5 cursor-pointer hover:bg-amber-100 transition-colors">
                <div className="flex items-center gap-2">
                  <span className="text-sm">📦</span>
                  <span className="text-xs font-bold text-amber-800">
                    Archived Print Orders ({studioPrints.filter(o => o.isArchived).length})
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
                        <th className="py-2.5 px-3">Status</th>
                        <th className="py-2.5 px-3">Amount</th>
                        <th className="py-2.5 px-3">Archived On</th>
                        <th className="py-2.5 px-3">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-amber-100">
                      {studioPrints.filter(o => o.isArchived).map(o => (
                        <tr key={o.id} className="bg-white/60 hover:bg-amber-50 transition-colors">
                          <td className="py-2.5 px-4 font-mono text-[10px] font-bold text-[#2c2a29]">{o.id}</td>
                          <td className="py-2.5 px-3">
                            <span className="inline-flex px-2 py-0.5 rounded-full text-[9px] font-bold border bg-gray-100 text-gray-600 border-gray-200 uppercase">{o.status}</span>
                          </td>
                          <td className="py-2.5 px-3 text-[10px] font-bold text-emerald-700">₱{Number(o.totalAmount).toLocaleString()}</td>
                          <td className="py-2.5 px-3 text-[10px] text-[#7c756d]">
                            {o.archivedAt ? new Date(o.archivedAt).toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" }) : "—"}
                          </td>
                          <td className="py-2.5 px-3">
                            <div className="flex gap-1.5">
                              {onUnarchivePrintOrder && (
                                <button type="button"
                                  onClick={() => { if (window.confirm(`Restore print order ${o.id} from archive?`)) onUnarchivePrintOrder(o.id); }}
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
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Tab C: Enhanced Reports & Analytics Module */}
      {activeTab === "reports" && (() => {
        // ── Date-range helper ──────────────────────────────────────────────
        // Computes { start: Date|null, end: Date|null, label: string } from the
        // active preset (or custom inputs). All comparisons are inclusive of
        // start and exclusive of the day AFTER end.
        const computeDateRange = () => {
          const now = new Date();
          const todayStr = now.toISOString().split("T")[0];

          const startOfDay  = (d: Date) => { const x = new Date(d); x.setHours(0,0,0,0); return x; };
          const endOfDay    = (d: Date) => { const x = new Date(d); x.setHours(23,59,59,999); return x; };

          switch (reportDatePreset) {
            case "today": {
              const s = startOfDay(now);
              return { start: s, end: endOfDay(now), label: `Today (${todayStr})` };
            }
            case "yesterday": {
              const y = new Date(now); y.setDate(now.getDate() - 1);
              return { start: startOfDay(y), end: endOfDay(y), label: `Yesterday (${y.toISOString().split("T")[0]})` };
            }
            case "this_week": {
              const mon = new Date(now); mon.setDate(now.getDate() - ((now.getDay() + 6) % 7)); 
              return { start: startOfDay(mon), end: endOfDay(now), label: `This Week (${mon.toISOString().split("T")[0]} – ${todayStr})` };
            }
            case "last_week": {
              const mon = new Date(now); mon.setDate(now.getDate() - ((now.getDay() + 6) % 7) - 7);
              const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
              return { start: startOfDay(mon), end: endOfDay(sun), label: `Last Week (${mon.toISOString().split("T")[0]} – ${sun.toISOString().split("T")[0]})` };
            }
            case "this_month": {
              const s = new Date(now.getFullYear(), now.getMonth(), 1);
              return { start: s, end: endOfDay(now), label: `This Month (${s.toLocaleDateString("en-US",{month:"long",year:"numeric"})})` };
            }
            case "last_month": {
              const s = new Date(now.getFullYear(), now.getMonth() - 1, 1);
              const e = new Date(now.getFullYear(), now.getMonth(), 0);
              return { start: s, end: endOfDay(e), label: `Last Month (${s.toLocaleDateString("en-US",{month:"long",year:"numeric"})})` };
            }
            case "this_year": {
              const s = new Date(now.getFullYear(), 0, 1);
              return { start: s, end: endOfDay(now), label: `This Year (${now.getFullYear()})` };
            }
            case "custom": {
              const s = reportCustomStart ? new Date(reportCustomStart + "T00:00:00") : null;
              const e = reportCustomEnd   ? new Date(reportCustomEnd   + "T23:59:59") : null;
              const lbl = s && e
                ? `Custom: ${reportCustomStart} – ${reportCustomEnd}`
                : s ? `From ${reportCustomStart}` : e ? `Until ${reportCustomEnd}` : "Custom Range (no dates set)";
              return { start: s, end: e, label: lbl };
            }
            default: // all_time
              return { start: null, end: null, label: "All Time" };
          }
        };

        const { start: drStart, end: drEnd, label: dateRangeLabel } = computeDateRange();

        // Returns true when a date-string (ISO or YYYY-MM-DD) falls within [drStart, drEnd]
        const inRange = (dateStr: string | undefined | null): boolean => {
          if (!drStart && !drEnd) return true; // all_time
          if (!dateStr) return false;
          const d = new Date(dateStr);
          if (isNaN(d.getTime())) return false;
          if (drStart && d < drStart) return false;
          if (drEnd   && d > drEnd)   return false;
          return true;
        };

        // For bookings we use the booking_date (when the shoot happened / was booked)
        // as the primary date dimension; for payments we use paymentDate.
        // We also check paymentDate of associated payments so "today" captures
        // a booking whose payment was received today even if booked earlier.
        const bookingInDateRange = (b: any): boolean => {
          if (inRange(b.bookingDate)) return true;
          // also match on payment date — useful for "today's collections"
          const relPays = studioPayments.filter(p => p.bookingId === b.id && p.paymentStatus === "Paid");
          return relPays.some(p => inRange(p.paymentDate || p.createdAt));
        };

        const printInDateRange = (p: any): boolean => {
          if (inRange((p as any).paidAt || p.createdAt)) return true;
          return false;
        };

        // Reports filter state lives at the top of the component (Rules of Hooks)
        const reportBookings = studioBookings
          .filter(b => b.status !== "Cancelled" && b.status !== "Rejected")
          .filter(bookingInDateRange);
        const reportPrints = studioPrints
          .filter(p => p.status !== "Cancelled")
          .filter(printInDateRange);

        // Calculations for KPIs & Rankings
        const totalBookingsCount = reportBookings.length;
        const completedBookingsCount = reportBookings.filter(b => b.status === "Completed").length;
        const pendingBookingsCount = reportBookings.filter(b => b.status === "Pending").length;
        const rescheduledBookingsCount = reportBookings.filter(b => b.status === "Rescheduled" || b.rescheduleRequest).length;
        const paidOrderCount = reportBookings.filter(booking => Number(booking.amountPaid || 0) > 0).length
          + reportPrints.filter(order => order.paymentStatus === "Paid").length;

        const totalBookingRevenue = reportBookings.reduce((sum, booking) => sum + Number(booking.amountPaid || 0), 0);
        const totalPrintRevenue  = reportPrints.filter(order => order.paymentStatus === "Paid").reduce((sum, order) => sum + Number(order.totalAmount || 0), 0);
        const totalRev = totalBookingRevenue + totalPrintRevenue;

        const totalPrintOrdersCount = reportPrints.length;
        const totalOrderCount = totalBookingsCount + totalPrintOrdersCount;

        // Unique customers
        const uniqueCustomerIds = new Set([
          ...reportBookings.map(b => b.customerId || b.customerDetails?.email),
          ...reportPrints.map(p => p.customerId)
        ].filter(Boolean));
        const totalCustomersCount = uniqueCustomerIds.size;

        // Rank photography services and print products using actual orders.
        const serviceOrderCounts: Record<string, { count: number; revenue: number }> = {};
        for (const b of reportBookings) {
          const sName = b.serviceName || services.find(service => service.id === b.serviceId)?.name || b.packageName || "Photoshoot";
          if (!serviceOrderCounts[sName]) {
            serviceOrderCounts[sName] = { count: 0, revenue: 0 };
          }
          serviceOrderCounts[sName].count += 1;
          serviceOrderCounts[sName].revenue += Number(b.amountPaid || 0);
        }
        for (const order of reportPrints) {
          const productName = printProducts.find(product => product.id === order.productId)?.name || "Photo Print";
          const rankingName = `Print: ${productName}`;
          if (!serviceOrderCounts[rankingName]) serviceOrderCounts[rankingName] = { count: 0, revenue: 0 };
          serviceOrderCounts[rankingName].count += 1;
          if (order.paymentStatus === "Paid") serviceOrderCounts[rankingName].revenue += Number(order.totalAmount || 0);
        }

        const sortedServices = Object.entries(serviceOrderCounts)
          .map(([name, data]) => ({
            name,
            orders: data.count,
            revenue: data.revenue,
            paidPerOrder: data.count > 0 ? data.revenue / data.count : 0,
            pct: totalOrderCount > 0 ? Math.round((data.count / totalOrderCount) * 100) : 0,
          }))
          .sort((a, b) => b.orders - a.orders);

        const packageOrderCounts: Record<string, number> = {};
        for (const booking of reportBookings) {
          const packageName = booking.packageName || packages.find(item => item.id === booking.packageId)?.name;
          if (packageName) packageOrderCounts[packageName] = (packageOrderCounts[packageName] || 0) + 1;
        }
        const mostOrderedService = sortedServices[0]?.name || "No orders yet";
        const mostPopularPackage = Object.entries(packageOrderCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || "No package orders yet";
        const avgOrderValue = paidOrderCount > 0 ? Math.round(totalRev / paidOrderCount) : 0;
        const outstandingBalance = reportBookings.reduce((sum, booking) => sum + Math.max(Number(booking.remainingBalance ?? Number(booking.totalAmount || 0) - Number(booking.amountPaid || 0)), 0), 0)
          + reportPrints.filter(order => order.paymentStatus !== "Paid").reduce((sum, order) => sum + Number(order.totalAmount || 0), 0);
        const currentPeriodRevenue = Number(revenueData[revenueData.length - 1]?.totalRevenue || 0);
        const previousPeriodRevenue = Number(revenueData[revenueData.length - 2]?.totalRevenue || 0);
        const revenuePeriodChange = previousPeriodRevenue > 0
          ? `${((currentPeriodRevenue - previousPeriodRevenue) / previousPeriodRevenue * 100).toFixed(1)}% vs prior ${revenuePeriod}`
          : "No prior-period comparison";

        // Booking Status breakdown for Pie Chart
        const statusBreakdownData = [
          { name: "Completed", value: completedBookingsCount, color: "#10b981" },
          { name: "Confirmed", value: studioBookings.filter(b => b.status === "Confirmed").length, color: "#3b82f6" },
          { name: "Pending", value: pendingBookingsCount, color: "#f59e0b" },
          { name: "Rescheduled", value: rescheduledBookingsCount, color: "#6366f1" },
        ].filter(item => item.value > 0);

        // Peak demand analysis (day of week & time slots)
        const dayCounts: Record<string, number> = {};
        const timeSlotCounts: Record<string, number> = {};
        for (const b of reportBookings) {
          if (b.bookingDate) {
            const dName = new Date(b.bookingDate).toLocaleDateString("en-US", { weekday: "long" });
            dayCounts[dName] = (dayCounts[dName] || 0) + 1;
          }
          if (b.timeSlot) {
            timeSlotCounts[b.timeSlot] = (timeSlotCounts[b.timeSlot] || 0) + 1;
          }
        }
        const topDay = Object.entries(dayCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || "No booking data";
        const topDayCount = dayCounts[topDay] || 0;
        const topTime = Object.entries(timeSlotCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || "No booking data";

        const reportRecords = [
          ...studioBookings.map(booking => {
            const bookingTotal = Number(booking.totalAmount || 0);
            const paidAmount = Number(booking.amountPaid || 0);
            const relatedPayments = studioPayments.filter(payment => payment.bookingId === booking.id);
            const serviceName = booking.serviceName || services.find(service => service.id === booking.serviceId)?.name || "Photoshoot";
            const packageName = booking.packageName || packages.find(item => item.id === booking.packageId)?.name;
            const addonDetails = (booking.addons || []).map((addon: any) => {
              const addonName = addons.find(item => item.id === addon.addonId)?.name || addon.addonId;
              return `${addonName} x${addon.quantity || 1} (₱${Number(addon.price || 0).toLocaleString()})`;
            });
            const paymentMethods = Array.from(new Set(relatedPayments.map(payment => payment.paymentMethod).filter(Boolean)));
            const references = relatedPayments.map(payment => payment.referenceNumber).filter(Boolean);
            const itemDetails = [serviceName, packageName && `Package: ${packageName}`, ...addonDetails].filter(Boolean).join(" | ");
            const displayDate = [booking.bookingDate, booking.timeSlot].filter(Boolean).join(" ") || "—";
            const customerName = booking.customerDetails?.fullName || "Customer";
            const customerEmail = booking.customerDetails?.email || "";
            const customerPhone = booking.customerDetails?.phone || "";

            return {
              type: "Booking",
              id: booking.id,
              customerName,
              customerEmail,
              customerPhone,
              displayDate,
              createdAt: booking.createdAt || "",
              itemDetails,
              quantity: "—",
              status: booking.status,
              paymentStatus: booking.paymentStatus || "Unpaid",
              paymentMethod: paymentMethods.join(", ") || booking.paymentOption || "—",
              reference: references.join(", ") || "—",
              totalAmount: bookingTotal,
              paidAmount,
              balance: Number(booking.remainingBalance ?? Math.max(bookingTotal - paidAmount, 0)),
              isArchived: Boolean(booking.isArchived),
              searchText: [booking.id, customerName, customerEmail, customerPhone, displayDate, itemDetails, booking.status, booking.paymentStatus, ...references].join(" ").toLowerCase(),
              booking
            };
          }),
          ...studioPrints.map(order => {
            const product = printProducts.find(item => item.id === order.productId);
            const customerName = (order as any).customerName || order.customerId || "Walk-in Pickup";
            const displayDate = order.createdAt ? new Date(order.createdAt).toLocaleString() : "—";
            const designDetails = order.printDesign
              ? Object.entries(order.printDesign).map(([key, value]) => `${key}: ${String(value)}`).join(" | ")
              : "Standard design";
            const paymentReferences = [
              order.referenceNumber,
              (order as any).cashReceivedBy && `Received by ${(order as any).cashReceivedBy}`,
              Number(order.cashTendered) > 0 && `Tendered ₱${Number(order.cashTendered).toLocaleString()}`,
              Number(order.changeAmount) > 0 && `Change ₱${Number(order.changeAmount).toLocaleString()}`
            ].filter(Boolean).join(" | ");
            const totalAmount = Number(order.totalAmount || 0);
            const paidAmount = order.paymentStatus === "Paid" ? totalAmount : 0;
            const itemDetails = `${product?.name || "Photo Print"}${product?.size ? ` (${product.size})` : ""} | ${designDetails}`;

            return {
              type: "Print Order",
              id: order.id,
              customerName,
              customerEmail: (order as any).customerEmail || "",
              customerPhone: (order as any).customerPhone || "",
              displayDate,
              createdAt: order.createdAt || "",
              itemDetails,
              quantity: String(order.quantity || 1),
              status: order.status,
              paymentStatus: order.paymentStatus || "Unpaid",
              paymentMethod: order.paymentMethod || "Cash",
              reference: paymentReferences || "—",
              totalAmount,
              paidAmount,
              balance: Math.max(totalAmount - paidAmount, 0),
              isArchived: Boolean(order.isArchived),
              searchText: [order.id, customerName, order.customerId, displayDate, itemDetails, order.status, order.paymentStatus, paymentReferences, order.cashTendered, order.changeAmount].join(" ").toLowerCase(),
              printOrder: order,
              product
            };
          })
        ].sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());

        const filteredReportRecords = reportRecords.filter(record => {
          if (reportTypeFilter !== "All" && record.type !== reportTypeFilter) return false;
          if (reportStatusFilter !== "All" && record.status !== reportStatusFilter) return false;
          return !reportSearchQuery.trim() || record.searchText.includes(reportSearchQuery.trim().toLowerCase());
        });
        const reportStatusOptions = Array.from(new Set(reportRecords.map(record => record.status))).sort();

        // CSV Export function — always exports the currently filtered set
        const exportReportsToCSV = () => {
          const escapeCsv = (value: unknown) => `"${String(value ?? "").replace(/"/g, '""')}"`;
          // Meta rows so the recipient knows the scope
          const metaRows = [
            [`${studio.name} — Business Analytics Report`],
            [`Date Scope: ${dateRangeLabel}`],
            [`Generated: ${new Date().toLocaleString()}`],
            [`Total Paid Income: PHP ${totalRev.toLocaleString()} (Bookings: PHP ${totalBookingRevenue.toLocaleString()} | Print Orders: PHP ${totalPrintRevenue.toLocaleString()})`],
            [], // blank spacer
          ];
          const headers = ["Record Type", "ID", "Customer", "Email", "Phone", "Date / Schedule", "Service / Product / Add-ons / Design", "Quantity", "Status", "Payment Status", "Payment Method", "Reference / Cash Receiver", "Total (PHP)", "Paid (PHP)", "Balance (PHP)", "Archived", "Created At"];
          const rows = filteredReportRecords.map(record => [
            record.type,
            record.id,
            record.customerName,
            record.customerEmail,
            record.customerPhone,
            record.displayDate,
            record.itemDetails,
            record.quantity,
            record.status,
            record.paymentStatus,
            record.paymentMethod,
            record.reference,
            record.totalAmount,
            record.paidAmount,
            record.balance,
            record.isArchived ? "Yes" : "No",
            record.createdAt
          ]);
          const allRows = [...metaRows, headers, ...rows];
          const csvContent = "\uFEFF" + allRows.map(row => row.map(escapeCsv).join(",")).join("\r\n");
          const safeDateLabel = dateRangeLabel.replace(/[^a-z0-9]/gi, "_").replace(/_+/g, "_").replace(/^_|_$/g, "");
          const csvUrl = URL.createObjectURL(new Blob([csvContent], { type: "text/csv;charset=utf-8" }));
          const link = document.createElement("a");
          link.setAttribute("href", csvUrl);
          link.setAttribute("download", `${studio.name.replace(/\s+/g, "_")}_Report_${safeDateLabel}.csv`);
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(csvUrl);
        };

        const exportReportsToPDF = () => {
          // Use the date-filtered sets so the PDF matches the screen
          const detailedBookings = reportBookings.map(booking => {
            const relatedPayments = studioPayments.filter(payment => payment.bookingId === booking.id);
            return {
              ...booking,
              serviceName: booking.serviceName || services.find(service => service.id === booking.serviceId)?.name || "Photoshoot",
              packageName: booking.packageName || packages.find(item => item.id === booking.packageId)?.name || "",
              addonReportDetails: (booking.addons || []).map((addon: any) => {
                const addonName = addons.find(item => item.id === addon.addonId)?.name || addon.addonId;
                return `${addonName} x${addon.quantity || 1} (₱${Number(addon.price || 0).toLocaleString()})`;
              }).join(", "),
              paymentMethods: Array.from(new Set(relatedPayments.map(payment => payment.paymentMethod).filter(Boolean))).join(", ") || booking.paymentOption || "—",
              paymentReferences: relatedPayments.map(payment => payment.referenceNumber).filter(Boolean).join(", ") || "—"
            };
          });
          const detailedPrintOrders = reportPrints.map(order => {
            const product = printProducts.find(item => item.id === order.productId);
            return { ...order, productName: product?.name || "Photo Print", productSize: product?.size || "—" };
          });
          generateStudioSalesReportPDF(studio, detailedBookings, detailedPrintOrders, dateRangeLabel);
        };

        // Date preset config
        const datePresets: { id: typeof reportDatePreset; label: string }[] = [
          { id: "today",      label: "Today" },
          { id: "yesterday",  label: "Yesterday" },
          { id: "this_week",  label: "This Week" },
          { id: "last_week",  label: "Last Week" },
          { id: "this_month", label: "This Month" },
          { id: "last_month", label: "Last Month" },
          { id: "this_year",  label: "This Year" },
          { id: "all_time",   label: "All Time" },
          { id: "custom",     label: "Custom" },
        ];

        return (
          <div className="space-y-6">
            {/* Top Bar with Date Filter, Period Selector, and Exports */}
            <div className="bg-white rounded-3xl border border-[#e5e1da] p-6 shadow-sm space-y-4">
              {/* Row 1: Title + Action buttons */}
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-[#e5e1da] pb-5">
                <div>
                  <span className="inline-flex items-center gap-1.5 bg-amber-50 text-amber-800 border border-amber-200 px-3 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider mb-2">
                    <TrendingUp size={12} /> Complete Business Performance Intelligence
                  </span>
                  <h3 className="font-display text-2xl font-extrabold text-[#2c2a29]">Reports & Analytics Module</h3>
                  <p className="text-xs text-[#7c756d] mt-0.5">Real-time calculations of bookings, revenue, service rankings, customer growth, and trend insights.</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {/* Chart period selector (for the trend charts only) */}
                  <div className="bg-[#faf9f6] p-1 rounded-xl border border-[#e5e1da] flex items-center" title="Trend chart grouping period">
                    {(["daily", "weekly", "monthly", "yearly"] as const).map(p => (
                      <button key={p} onClick={() => setRevenuePeriod(p)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer capitalize ${revenuePeriod === p ? "bg-amber-500 text-white shadow-sm" : "text-[#7c756d] hover:text-[#2c2a29]"}`}>
                        {p}
                      </button>
                    ))}
                  </div>

                  <button onClick={exportReportsToCSV}
                    className="flex items-center gap-1.5 px-3.5 py-2 bg-[#2c2a29] hover:bg-[#44403c] text-white text-xs font-bold rounded-xl cursor-pointer transition-colors shadow-sm">
                    <Download size={13} /> Export CSV
                  </button>

                  <button onClick={exportReportsToPDF}
                    className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl cursor-pointer transition-colors shadow-sm">
                    <FileText size={13} /> Export PDF Report
                  </button>

                  <button onClick={() => setShowLedgerReport(!showLedgerReport)}
                    className="flex items-center gap-1.5 px-3.5 py-2 bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 text-xs font-bold rounded-xl cursor-pointer transition-colors">
                    {showLedgerReport ? "Hide Ledger" : "View Ledger"}
                  </button>
                </div>
              </div>

              {/* Row 2: Date Range Filter */}
              <div className="space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <p className="text-[10px] font-extrabold uppercase tracking-widest text-[#7c756d] flex items-center gap-1.5">
                    <Calendar size={11} /> Filter by Date Range
                  </p>
                  {/* Active scope badge */}
                  <span className="inline-flex items-center gap-1.5 bg-amber-50 border border-amber-200 text-amber-800 px-2.5 py-1 rounded-full text-[10px] font-extrabold">
                    Scope: {dateRangeLabel}
                    {reportDatePreset !== "all_time" && (
                      <button
                        onClick={() => { setReportDatePreset("all_time"); setReportCustomStart(""); setReportCustomEnd(""); }}
                        className="ml-1 text-amber-600 hover:text-amber-900 cursor-pointer leading-none"
                        title="Clear filter"
                      >✕</button>
                    )}
                  </span>
                </div>

                {/* Preset pills */}
                <div className="flex flex-wrap gap-1.5">
                  {datePresets.map(p => (
                    <button
                      key={p.id}
                      onClick={() => setReportDatePreset(p.id)}
                      className={`px-3 py-1.5 rounded-xl text-[10px] font-extrabold border transition-all cursor-pointer ${
                        reportDatePreset === p.id
                          ? "bg-[#2c2a29] text-white border-[#2c2a29] shadow-sm"
                          : "bg-[#faf9f6] text-[#7c756d] border-[#e5e1da] hover:border-[#2c2a29] hover:text-[#2c2a29]"
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>

                {/* Custom date inputs — only shown when "Custom" is active */}
                {reportDatePreset === "custom" && (
                  <div className="flex flex-wrap items-center gap-3 pt-1 pl-1">
                    <div className="flex items-center gap-2">
                      <label className="text-[10px] font-bold text-[#7c756d] whitespace-nowrap">From</label>
                      <input
                        type="date"
                        value={reportCustomStart}
                        onChange={e => setReportCustomStart(e.target.value)}
                        className="py-1.5 px-3 text-xs border border-[#e5e1da] rounded-xl bg-[#faf9f6] focus:outline-none focus:ring-2 focus:ring-amber-300 font-mono"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="text-[10px] font-bold text-[#7c756d] whitespace-nowrap">To</label>
                      <input
                        type="date"
                        value={reportCustomEnd}
                        onChange={e => setReportCustomEnd(e.target.value)}
                        className="py-1.5 px-3 text-xs border border-[#e5e1da] rounded-xl bg-[#faf9f6] focus:outline-none focus:ring-2 focus:ring-amber-300 font-mono"
                      />
                    </div>
                    {(reportCustomStart || reportCustomEnd) && (
                      <button
                        onClick={() => { setReportCustomStart(""); setReportCustomEnd(""); }}
                        className="text-[10px] font-bold text-rose-600 hover:text-rose-800 cursor-pointer"
                      >Clear</button>
                    )}
                  </div>
                )}

                {/* Zero-results notice */}
                {reportDatePreset !== "all_time" && reportBookings.length === 0 && reportPrints.length === 0 && (
                  <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs text-[#7c756d]">
                    <AlertTriangle size={12} className="text-amber-500 flex-shrink-0" />
                    No bookings or print orders found for <strong>{dateRangeLabel}</strong>. Try a wider date range.
                  </div>
                )}
              </div>

              {/* Summary KPI Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 pt-2">
                {[
                  { label: "Photoshoot Bookings", value: totalBookingsCount, change: `${completedBookingsCount} completed · ${pendingBookingsCount} pending`, isUp: false, icon: <Calendar size={15} className="text-amber-700" /> },
                  { label: "Print Orders", value: totalPrintOrdersCount, change: `${reportPrints.filter(order => order.paymentStatus === "Paid").length} paid · ${reportPrints.filter(order => order.paymentStatus !== "Paid").length} unpaid`, isUp: false, icon: <Printer size={15} className="text-amber-700" /> },
                  { label: "Paid Revenue", value: `₱${totalRev.toLocaleString()}`, change: revenuePeriodChange, isUp: false, icon: <DollarSign size={15} className="text-emerald-700" /> },
                  { label: "Unique Customers", value: totalCustomersCount, change: "Bookings and print orders", isUp: false, icon: <Users size={15} className="text-amber-700" /> },
                  { label: "Top Order Category", value: mostOrderedService, change: `${sortedServices[0]?.orders || 0} total order${sortedServices[0]?.orders === 1 ? "" : "s"}`, isUp: false, icon: <Camera size={15} className="text-blue-700" /> },
                  { label: "Most Popular Package", value: mostPopularPackage, change: `${packageOrderCounts[mostPopularPackage] || 0} bookings`, isUp: false, icon: <Sparkles size={15} className="text-amber-600" /> },
                  { label: "Average Paid Revenue / Order", value: `₱${avgOrderValue.toLocaleString()}`, change: `${totalOrderCount} active orders`, isUp: false, icon: <TrendingUp size={15} className="text-emerald-600" /> },
                  { label: "Outstanding Balance", value: `₱${outstandingBalance.toLocaleString()}`, change: "Unpaid booking and print totals", isUp: false, icon: <Wallet size={15} className="text-rose-700" /> },
                  { label: "Rescheduled Bookings", value: rescheduledBookingsCount, change: "Includes open reschedule requests", isUp: false, icon: <RefreshCw size={15} className="text-indigo-600" /> },
                ].map((kpi, idx) => (
                  <div key={idx} className="bg-[#faf9f6] border border-[#e5e1da] p-4 rounded-2xl flex flex-col justify-between hover:shadow-sm transition-shadow">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-[10px] font-extrabold uppercase tracking-wider text-[#7c756d]">{kpi.label}</p>
                      <div className="w-7 h-7 rounded-xl bg-white border border-[#e5e1da] flex items-center justify-center shadow-xs">
                        {kpi.icon}
                      </div>
                    </div>
                    <div>
                      <p className="text-lg font-black text-[#2c2a29] truncate">{kpi.value}</p>
                      <p className="text-[9px] font-bold mt-1 text-gray-500">
                        {kpi.change}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* ── Income Source Breakdown ──────────────────────────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

              {/* Donut: Booking vs Print income */}
              <div className="bg-white rounded-3xl border border-[#e5e1da] p-6 shadow-sm space-y-4 flex flex-col">
                <div>
                  <h4 className="font-display font-black text-base text-[#2c2a29]">Income Source Breakdown</h4>
                  <p className="text-xs text-[#7c756d]">Booking income vs print order income (paid only)</p>
                </div>

                <div className="h-48 w-full flex items-center justify-center">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={[
                          { name: "Booking Income", value: totalBookingRevenue, color: "#2c2a29" },
                          { name: "Print Sales",    value: totalPrintRevenue,   color: "#d97706" },
                        ].filter(d => d.value > 0)}
                        cx="50%" cy="50%"
                        innerRadius={48} outerRadius={76}
                        paddingAngle={4} dataKey="value"
                      >
                        {[
                          { name: "Booking Income", value: totalBookingRevenue, color: "#2c2a29" },
                          { name: "Print Sales",    value: totalPrintRevenue,   color: "#d97706" },
                        ].filter(d => d.value > 0).map((entry, i) => (
                          <Cell key={i} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip content={({ active, payload }: any) => {
                        if (active && payload && payload.length) {
                          return (
                            <div className="bg-[#2c2a29] text-white p-2.5 rounded-xl text-xs font-bold shadow-xl border border-[#4a4644]">
                              <p className="text-amber-300 text-[10px] mb-1">{payload[0].name}</p>
                              <p>₱{Number(payload[0].value).toLocaleString()}</p>
                              <p className="text-gray-400 text-[10px]">{totalRev > 0 ? Math.round((payload[0].value / totalRev) * 100) : 0}% of total</p>
                            </div>
                          );
                        }
                        return null;
                      }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                {totalRev === 0 ? (
                  <p className="text-center text-xs text-[#7c756d]">No paid income yet.</p>
                ) : (
                  <div className="space-y-2 border-t border-gray-100 pt-3">
                    {[
                      { label: "Booking Income", value: totalBookingRevenue, color: "#2c2a29", bg: "bg-[#2c2a29]" },
                      { label: "Print Sales",    value: totalPrintRevenue,   color: "#d97706", bg: "bg-amber-500" },
                    ].map((item, i) => {
                      const pct = totalRev > 0 ? Math.round((item.value / totalRev) * 100) : 0;
                      return (
                        <div key={i} className="space-y-0.5">
                          <div className="flex items-center justify-between text-xs">
                            <span className="flex items-center gap-1.5 font-medium text-[#2c2a29]">
                              <span className={`w-2.5 h-2.5 rounded-full ${item.bg}`} />
                              {item.label}
                            </span>
                            <span className="font-bold font-mono text-[#2c2a29]">₱{item.value.toLocaleString()} <span className="text-[10px] text-[#7c756d]">({pct}%)</span></span>
                          </div>
                          <div className="w-full bg-gray-100 rounded-full h-1.5">
                            <div className={`${item.bg} h-1.5 rounded-full transition-all`} style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      );
                    })}
                    <div className="flex justify-between items-center pt-1.5 border-t border-gray-100 text-xs font-extrabold text-[#2c2a29]">
                      <span>Total Paid Income</span>
                      <span className="font-mono">₱{totalRev.toLocaleString()}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* KPI cards: Booking Income + Print Income */}
              <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4 content-start">

                {/* Booking Income card */}
                <div className="bg-gradient-to-br from-[#2c2a29] to-[#44403c] text-white rounded-3xl p-5 shadow-sm space-y-3 flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-extrabold uppercase tracking-widest text-amber-300">📷 Booking Income</span>
                    <div className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center">
                      <Calendar size={15} className="text-amber-300" />
                    </div>
                  </div>
                  <div>
                    <p className="text-2xl font-black leading-none">₱{totalBookingRevenue.toLocaleString()}</p>
                    <p className="text-[10px] text-gray-400 mt-1">Verified paid amounts from photoshoots only</p>
                  </div>
                  <div className="space-y-1 border-t border-white/10 pt-2 text-[10px]">
                    <div className="flex justify-between"><span className="text-gray-400">Paid bookings</span><span className="font-bold">{reportBookings.filter(b => Number(b.amountPaid||0) > 0).length}</span></div>
                    <div className="flex justify-between"><span className="text-gray-400">Fully paid</span><span className="font-bold text-emerald-400">{reportBookings.filter(b => b.paymentStatus === "Paid" || b.finalPaymentStatus === "Paid").length}</span></div>
                    <div className="flex justify-between"><span className="text-gray-400">Outstanding balance</span><span className="font-bold text-rose-400">₱{reportBookings.reduce((s,b) => s + Math.max(Number(b.remainingBalance??0),0),0).toLocaleString()}</span></div>
                  </div>
                </div>

                {/* Print Order Income card */}
                <div className="bg-gradient-to-br from-amber-600 to-amber-700 text-white rounded-3xl p-5 shadow-sm space-y-3 flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-extrabold uppercase tracking-widest text-amber-100">🖨️ Print Order Income</span>
                    <div className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center">
                      <Printer size={15} className="text-amber-100" />
                    </div>
                  </div>
                  <div>
                    <p className="text-2xl font-black leading-none">₱{totalPrintRevenue.toLocaleString()}</p>
                    <p className="text-[10px] text-amber-100/70 mt-1">Cash collected at studio counter (paid only)</p>
                  </div>
                  <div className="space-y-1 border-t border-white/10 pt-2 text-[10px]">
                    <div className="flex justify-between"><span className="text-amber-100/70">Paid orders</span><span className="font-bold">{reportPrints.filter(p => p.paymentStatus === "Paid").length}</span></div>
                    <div className="flex justify-between"><span className="text-amber-100/70">Unpaid / pending</span><span className="font-bold text-rose-200">{reportPrints.filter(p => p.paymentStatus !== "Paid").length}</span></div>
                    <div className="flex justify-between"><span className="text-amber-100/70">Avg per paid order</span><span className="font-bold">₱{reportPrints.filter(p => p.paymentStatus==="Paid").length > 0 ? Math.round(totalPrintRevenue / reportPrints.filter(p => p.paymentStatus==="Paid").length).toLocaleString() : "—"}</span></div>
                  </div>
                </div>

                {/* Combined totals mini-summary card */}
                <div className="sm:col-span-2 bg-emerald-50 border border-emerald-200 rounded-3xl p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-extrabold uppercase tracking-widest text-emerald-700">💰 Combined Paid Income Summary</span>
                    <DollarSign size={15} className="text-emerald-600" />
                  </div>
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div className="bg-white rounded-xl border border-emerald-100 p-3">
                      <p className="text-[9px] font-bold uppercase text-[#7c756d] tracking-wider">Booking Income</p>
                      <p className="text-sm font-black text-[#2c2a29] mt-0.5">₱{totalBookingRevenue.toLocaleString()}</p>
                      <p className="text-[9px] text-emerald-600 font-bold">{totalRev > 0 ? Math.round((totalBookingRevenue/totalRev)*100) : 0}% share</p>
                    </div>
                    <div className="bg-white rounded-xl border border-amber-100 p-3">
                      <p className="text-[9px] font-bold uppercase text-[#7c756d] tracking-wider">Print Income</p>
                      <p className="text-sm font-black text-amber-700 mt-0.5">₱{totalPrintRevenue.toLocaleString()}</p>
                      <p className="text-[9px] text-amber-600 font-bold">{totalRev > 0 ? Math.round((totalPrintRevenue/totalRev)*100) : 0}% share</p>
                    </div>
                    <div className="bg-emerald-600 rounded-xl p-3">
                      <p className="text-[9px] font-bold uppercase text-emerald-100 tracking-wider">Total Income</p>
                      <p className="text-sm font-black text-white mt-0.5">₱{totalRev.toLocaleString()}</p>
                      <p className="text-[9px] text-emerald-200 font-bold">{paidOrderCount} paid orders</p>
                    </div>
                  </div>
                  {/* Visual combined bar */}
                  <div className="space-y-1">
                    <div className="flex w-full h-2.5 rounded-full overflow-hidden bg-gray-100">
                      <div className="bg-[#2c2a29] h-full" style={{ width: `${totalRev > 0 ? (totalBookingRevenue/totalRev)*100 : 0}%` }} />
                      <div className="bg-amber-500 h-full" style={{ width: `${totalRev > 0 ? (totalPrintRevenue/totalRev)*100 : 0}%` }} />
                    </div>
                    <div className="flex gap-4 text-[9px] text-[#7c756d]">
                      <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#2c2a29] inline-block" /> Bookings</span>
                      <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500 inline-block" /> Print Orders</span>
                    </div>
                  </div>
                </div>

              </div>
            </div>

            {/* Trends & Insights Section */}
            <div className="bg-gradient-to-br from-[#2c2a29] to-[#44403c] text-white rounded-3xl p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 bg-amber-400 text-[#2c2a29] px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider">
                  <Sparkles size={12} /> Automated Trends & Business Insights
                </span>
                <span className="text-xs text-amber-300 font-bold">Real-time database analysis</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white/10 backdrop-blur-sm border border-white/15 p-4 rounded-2xl space-y-2">
                  <p className="text-xs font-bold text-amber-300">Peak Booking Demand</p>
                  <p className="text-xs text-gray-200 leading-relaxed">
                    {topDayCount > 0 ? <>{topDay} leads with <strong>{topDayCount}</strong> booking{topDayCount === 1 ? "" : "s"}; the busiest time is <strong>{topTime}</strong>.</> : "No booking activity is available to identify peak demand yet."}
                  </p>
                </div>
                <div className="bg-white/10 backdrop-blur-sm border border-white/15 p-4 rounded-2xl space-y-2">
                  <p className="text-xs font-bold text-emerald-300">Paid Revenue by Period</p>
                  <p className="text-xs text-gray-200 leading-relaxed">
                    Latest {revenuePeriod} collection is <strong>₱{currentPeriodRevenue.toLocaleString()}</strong>; {revenuePeriodChange}.
                  </p>
                </div>
                <div className="bg-white/10 backdrop-blur-sm border border-white/15 p-4 rounded-2xl space-y-2">
                  <p className="text-xs font-bold text-blue-300">Top Service or Print Product</p>
                  <p className="text-xs text-gray-200 leading-relaxed">
                    <strong>{mostOrderedService}</strong> leads with <strong>{sortedServices[0]?.orders || 0}</strong> orders and ₱{(sortedServices[0]?.revenue || 0).toLocaleString()} collected.
                  </p>
                </div>
              </div>
            </div>

            {/* Interactive Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Revenue & Booking Trends (2 cols) */}
              <div className="lg:col-span-2 bg-white rounded-3xl border border-[#e5e1da] p-6 shadow-sm space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#e5e1da] pb-4">
                  <div>
                    <h4 className="font-display font-black text-base text-[#2c2a29]">Revenue & Order Trends Over Time</h4>
                    <p className="text-xs text-[#7c756d]">Visualizing booking income versus print sales by {revenuePeriod}</p>
                  </div>
                  {/* Chart Type selector */}
                  <div className="bg-[#faf9f6] p-1 rounded-xl border border-[#e5e1da] flex items-center">
                    {([
                      { id: "composed" as const, label: "Composed" },
                      { id: "stacked" as const, label: "Stacked" },
                      { id: "area" as const, label: "Area" },
                    ]).map(ct => (
                      <button key={ct.id} onClick={() => setRevenueChartType(ct.id)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer capitalize ${revenueChartType === ct.id ? "bg-[#2c2a29] text-white shadow-sm" : "text-[#7c756d] hover:text-[#2c2a29]"}`}>
                        {ct.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="h-72 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    {revenueChartType === "composed" ? (
                      <ComposedChart data={revenueData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e1da" />
                        <XAxis dataKey="label" stroke="#7c756d" fontSize={11} tickLine={false} />
                        <YAxis stroke="#7c756d" fontSize={11} tickFormatter={(val) => `₱${val / 1000}k`} tickLine={false} />
                        <Tooltip content={({ active, payload, label }: any) => {
                          if (active && payload && payload.length) {
                            return (
                              <div className="bg-[#2c2a29] text-white p-3 rounded-xl shadow-xl text-xs space-y-1.5 border border-[#4a4644]">
                                <p className="font-bold text-amber-300 text-[11px]">{label}</p>
                                {payload.map((entry: any, index: number) => (
                                  <div key={index} className="flex justify-between gap-4">
                                    <span className="text-gray-300">{entry.name}:</span>
                                    <span className="font-bold font-mono">₱{Number(entry.value).toLocaleString()}</span>
                                  </div>
                                ))}
                              </div>
                            );
                          }
                          return null;
                        }} />
                        <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }} />
                        <Bar dataKey="bookingIncome" name="Booking Income" fill="#2c2a29" radius={[4, 4, 0, 0]} barSize={20} />
                        <Bar dataKey="printSales" name="Print Sales" fill="#d97706" radius={[4, 4, 0, 0]} barSize={20} />
                        <Line type="monotone" dataKey="totalRevenue" name="Total Revenue" stroke="#059669" strokeWidth={3} dot={{ r: 4 }} />
                      </ComposedChart>
                    ) : revenueChartType === "stacked" ? (
                      <BarChart data={revenueData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e1da" />
                        <XAxis dataKey="label" stroke="#7c756d" fontSize={11} tickLine={false} />
                        <YAxis stroke="#7c756d" fontSize={11} tickFormatter={(val) => `₱${val / 1000}k`} tickLine={false} />
                        <Tooltip content={({ active, payload, label }: any) => {
                          if (active && payload && payload.length) {
                            return (
                              <div className="bg-[#2c2a29] text-white p-3 rounded-xl shadow-xl text-xs space-y-1.5 border border-[#4a4644]">
                                <p className="font-bold text-amber-300 text-[11px]">{label}</p>
                                {payload.map((entry: any, index: number) => (
                                  <div key={index} className="flex justify-between gap-4">
                                    <span className="text-gray-300">{entry.name}:</span>
                                    <span className="font-bold font-mono">₱{Number(entry.value).toLocaleString()}</span>
                                  </div>
                                ))}
                              </div>
                            );
                          }
                          return null;
                        }} />
                        <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }} />
                        <Bar dataKey="bookingIncome" name="Booking Income" stackId="a" fill="#2c2a29" barSize={28} />
                        <Bar dataKey="printSales" name="Print Sales" stackId="a" fill="#d97706" barSize={28} />
                      </BarChart>
                    ) : (
                      <AreaChart data={revenueData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e1da" />
                        <XAxis dataKey="label" stroke="#7c756d" fontSize={11} tickLine={false} />
                        <YAxis stroke="#7c756d" fontSize={11} tickFormatter={(val) => `₱${val / 1000}k`} tickLine={false} />
                        <Tooltip content={({ active, payload, label }: any) => {
                          if (active && payload && payload.length) {
                            return (
                              <div className="bg-[#2c2a29] text-white p-3 rounded-xl shadow-xl text-xs space-y-1.5 border border-[#4a4644]">
                                <p className="font-bold text-amber-300 text-[11px]">{label}</p>
                                {payload.map((entry: any, index: number) => (
                                  <div key={index} className="flex justify-between gap-4">
                                    <span className="text-gray-300">{entry.name}:</span>
                                    <span className="font-bold font-mono">₱{Number(entry.value).toLocaleString()}</span>
                                  </div>
                                ))}
                              </div>
                            );
                          }
                          return null;
                        }} />
                        <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }} />
                        <Area type="monotone" dataKey="bookingIncome" name="Booking Income" stroke="#2c2a29" fill="#2c2a29" fillOpacity={0.8} />
                        <Area type="monotone" dataKey="printSales" name="Print Sales" stroke="#d97706" fill="#d97706" fillOpacity={0.8} />
                      </AreaChart>
                    )}
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Booking Status Breakdown (1 col) */}
              <div className="bg-white rounded-3xl border border-[#e5e1da] p-6 shadow-sm space-y-4 flex flex-col justify-between">
                <div>
                  <h4 className="font-display font-black text-base text-[#2c2a29]">Booking Status Breakdown</h4>
                  <p className="text-xs text-[#7c756d]">Distribution across fulfillment lifecycle</p>
                </div>

                <div className="h-52 w-full flex items-center justify-center">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={statusBreakdownData}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={80}
                        paddingAngle={4}
                        dataKey="value"
                      >
                        {statusBreakdownData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip content={({ active, payload }: any) => {
                        if (active && payload && payload.length) {
                          const data = payload[0];
                          return (
                            <div className="bg-[#2c2a29] text-white p-2 rounded-xl text-xs font-bold">
                              {data.name}: {data.value} bookings
                            </div>
                          );
                        }
                        return null;
                      }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                <div className="space-y-1.5 pt-2 border-t border-gray-100">
                  {statusBreakdownData.map((st, i) => (
                    <div key={i} className="flex items-center justify-between text-xs">
                      <span className="flex items-center gap-2 font-medium text-[#2c2a29]">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: st.color }} />
                        {st.name}
                      </span>
                      <span className="font-bold font-mono">{st.value} ({totalBookingsCount > 0 ? Math.round((st.value / totalBookingsCount) * 100) : 0}%)</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Service & Package Performance Analysis Table */}
            <div className="bg-white rounded-3xl border border-[#e5e1da] p-6 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#e5e1da] pb-4">
                <div>
                  <h4 className="font-display font-black text-base text-[#2c2a29]">Service, Package & Print Product Ranking</h4>
                  <p className="text-xs text-[#7c756d]">Ranked by actual booking and print order volume, with paid revenue collected</p>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead>
                    <tr className="bg-[#faf9f6] text-[#7c756d] font-bold uppercase tracking-wider text-[10px] border-b border-[#e5e1da]">
                      <th className="py-3 px-4 rounded-l-xl">Rank & Service / Package Name</th>
                      <th className="py-3 px-3">Total Orders</th>
                      <th className="py-3 px-3">Paid Revenue</th>
                      <th className="py-3 px-3">% of Total Orders</th>
                      <th className="py-3 px-3 text-right rounded-r-xl">Paid / Order</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 font-medium text-[#2c2a29]">
                    {sortedServices.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-[#7c756d]">No booking or print order data available yet.</td>
                      </tr>
                    ) : (
                      sortedServices.map((srv, idx) => (
                        <tr key={srv.name} className="hover:bg-gray-50/80 transition-colors">
                          <td className="py-3 px-4 font-bold text-[#2c2a29] flex items-center gap-2.5">
                            <span className="w-6 h-6 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center text-xs font-black">#{idx + 1}</span>
                            <span>{srv.name}</span>
                          </td>
                          <td className="py-3 px-3 font-mono font-bold">{srv.orders} order{srv.orders !== 1 ? "s" : ""}</td>
                          <td className="py-3 px-3 font-mono font-bold text-emerald-700">₱{srv.revenue.toLocaleString()}</td>
                          <td className="py-3 px-3">
                            <div className="flex items-center gap-2">
                              <div className="flex-1 bg-gray-100 h-2 rounded-full overflow-hidden max-w-[100px]">
                                <div className="bg-amber-500 h-full rounded-full" style={{ width: `${srv.pct}%` }} />
                              </div>
                              <span className="font-mono text-[10px] font-bold">{srv.pct}%</span>
                            </div>
                          </td>
                          <td className="py-3 px-3 text-right font-mono font-bold text-emerald-700">₱{Math.round(srv.paidPerOrder).toLocaleString()}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Reports Data Explorer Table with Filters & Search */}
            <div className="bg-white rounded-3xl border border-[#e5e1da] p-6 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#e5e1da] pb-4">
                <div>
                  <h4 className="font-display font-black text-base text-[#2c2a29]">Detailed Reports & Booking Records</h4>
                  <p className="text-xs text-[#7c756d]">{filteredReportRecords.length} of {reportRecords.length} booking and print order records</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative">
                    <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      value={reportSearchQuery}
                      onChange={e => setReportSearchQuery(e.target.value)}
                      placeholder="Search ID, customer, service..."
                      className="pl-8 pr-3 py-1.5 text-xs border border-[#e5e1da] rounded-xl bg-[#faf9f6] focus:outline-none focus:ring-2 focus:ring-amber-300"
                    />
                  </div>
                  <select
                    value={reportTypeFilter}
                    onChange={e => setReportTypeFilter(e.target.value)}
                    className="py-1.5 px-3 text-xs border border-[#e5e1da] rounded-xl bg-[#faf9f6] focus:outline-none font-bold"
                  >
                    <option value="All">All Record Types</option>
                    <option value="Booking">Bookings</option>
                    <option value="Print Order">Print Orders</option>
                  </select>
                  <select
                    value={reportStatusFilter}
                    onChange={e => setReportStatusFilter(e.target.value)}
                    className="py-1.5 px-3 text-xs border border-[#e5e1da] rounded-xl bg-[#faf9f6] focus:outline-none font-bold"
                  >
                    <option value="All">All Statuses</option>
                    {reportStatusOptions.map(status => <option key={status} value={status}>{status}</option>)}
                  </select>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead>
                    <tr className="bg-[#faf9f6] text-[#7c756d] font-bold uppercase tracking-wider text-[10px] border-b border-[#e5e1da]">
                      <th className="py-3 px-4 rounded-l-xl">Type / Record ID</th>
                      <th className="py-3 px-3">Customer / Contact</th>
                      <th className="py-3 px-3">Date / Schedule</th>
                      <th className="py-3 px-3">Service / Product Details</th>
                      <th className="py-3 px-3">Qty</th>
                      <th className="py-3 px-3">Order Status</th>
                      <th className="py-3 px-3">Payment / Reference</th>
                      <th className="py-3 px-3 text-right rounded-r-xl">Total / Paid / Balance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 font-medium text-[#2c2a29]">
                    {filteredReportRecords.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-8 text-center text-[#7c756d]">No matching booking or print order records found.</td>
                      </tr>
                    ) : (
                      filteredReportRecords.map(record => {
                        const booking = "booking" in record ? record.booking : null;
                        return (
                          <tr
                            key={`${record.type}-${record.id}`}
                            onClick={booking ? () => setViewingBooking(booking) : undefined}
                            onKeyDown={booking ? event => {
                              if (event.key === "Enter" || event.key === " ") {
                                event.preventDefault();
                                setViewingBooking(booking);
                              }
                            } : undefined}
                            role={booking ? "button" : undefined}
                            tabIndex={booking ? 0 : undefined}
                            aria-label={booking ? `View full report details for booking ${record.id}` : undefined}
                            className={`${booking ? "cursor-pointer" : ""} hover:bg-amber-50/70 focus:bg-amber-50/70 focus:outline-none transition-colors`}
                          >
                            <td className="py-3 px-4">
                              <span className={`inline-flex px-2 py-0.5 rounded-full text-[9px] font-bold border ${record.type === "Booking" ? "bg-blue-50 text-blue-700 border-blue-200" : "bg-amber-50 text-amber-800 border-amber-200"}`}>{record.type}</span>
                              <div className="font-mono font-bold text-[#2c2a29] mt-1">{record.id}</div>
                              {record.isArchived && <span className="text-[9px] font-bold text-gray-500">Archived</span>}
                            </td>
                            <td className="py-3 px-3">
                              <div className="font-bold">{record.customerName}</div>
                              {record.customerEmail && <div className="text-[10px] text-[#7c756d]">{record.customerEmail}</div>}
                              {record.customerPhone && <div className="text-[10px] text-[#7c756d]">{record.customerPhone}</div>}
                            </td>
                            <td className="py-3 px-3 text-[#57534e]">
                              <div>{record.displayDate}</div>
                              {record.createdAt && <div className="text-[10px] text-[#7c756d]">Created {new Date(record.createdAt).toLocaleDateString()}</div>}
                            </td>
                            <td className="py-3 px-3 min-w-56 max-w-80">
                              <div className="font-semibold">{record.itemDetails.split(" | ")[0]}</div>
                              {record.itemDetails.split(" | ").slice(1).map((detail, index) => <div key={index} className="text-[10px] text-[#7c756d]">{detail}</div>)}
                            </td>
                            <td className="py-3 px-3 text-center font-mono">{record.quantity}</td>
                            <td className="py-3 px-3">
                              <span className={`inline-flex px-2 py-0.5 rounded-full text-[9px] font-bold border uppercase ${
                                record.status === "Completed" ? "bg-green-50 text-green-700 border-green-200" :
                                record.status === "Confirmed" ? "bg-blue-50 text-blue-700 border-blue-200" :
                                ["Pending", "Processing", "Quality Check"].includes(record.status) ? "bg-amber-50 text-amber-700 border-amber-200" :
                                "bg-rose-50 text-rose-700 border-rose-200"
                              }`}>
                                {record.status}
                              </span>
                            </td>
                            <td className="py-3 px-3">
                              <div className="font-semibold">{record.paymentStatus}</div>
                              <div className="text-[10px] text-[#7c756d]">{record.paymentMethod}</div>
                              {record.reference !== "—" && <div className="text-[10px] text-[#7c756d]">{record.reference}</div>}
                            </td>
                            <td className="py-3 px-3 text-right font-mono whitespace-nowrap">
                              <div className="font-bold text-[#2c2a29]">₱{record.totalAmount.toLocaleString()}</div>
                              <div className="text-[10px] text-emerald-700">Paid ₱{record.paidAmount.toLocaleString()}</div>
                              <div className="text-[10px] text-rose-700">Balance ₱{record.balance.toLocaleString()}</div>
                              {"printOrder" in record && <button type="button" title="Download print order receipt" onClick={event => { event.stopPropagation(); generatePrintOrderReceiptPDF(record.printOrder, studio, record.product); }} className="mt-1 inline-flex items-center gap-1 text-[10px] font-bold text-amber-800 hover:text-amber-950"><Printer size={11} /> Receipt</button>}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Ledger Report Modal / Drawer if toggled */}
            {showLedgerReport && (() => {
              // ── Ledger-specific derived values ───────────────────────────
              // Only count PAID amounts — never totalAmount for unpaid records
              const ledgerBookings = reportBookings.filter(b => Number(b.amountPaid || 0) > 0);
              const ledgerPaidPrints = reportPrints.filter(p => p.paymentStatus === "Paid");
              const ledgerBookingIncome = ledgerBookings.reduce((s, b) => s + Number(b.amountPaid || 0), 0);
              const ledgerPrintIncome  = ledgerPaidPrints.reduce((s, p) => s + Number(p.totalAmount || 0), 0);
              const ledgerTotal        = ledgerBookingIncome + ledgerPrintIncome;
              const ledgerBookingPct   = ledgerTotal > 0 ? Math.round((ledgerBookingIncome / ledgerTotal) * 100) : 0;
              const ledgerPrintPct     = ledgerTotal > 0 ? Math.round((ledgerPrintIncome  / ledgerTotal) * 100) : 0;

              // Unpaid/pending amounts shown for reference only
              const unpaidBookings = reportBookings.filter(b => Number(b.remainingBalance ?? 0) > 0);
              const unpaidPrints   = reportPrints.filter(p => p.paymentStatus !== "Paid" && p.status !== "Cancelled");
              const outstandingBookingBalance = unpaidBookings.reduce((s, b) => s + Number(b.remainingBalance ?? 0), 0);
              const outstandingPrintBalance   = unpaidPrints.reduce((s, p) => s + Number(p.totalAmount || 0), 0);

              return (
              <div className="bg-white border border-[#2c2a29] rounded-3xl p-8 max-w-2xl mx-auto space-y-6 shadow-xl text-xs relative overflow-hidden font-mono text-left">

                {/* Header */}
                <div className="border-b border-double border-[#2c2a29] pb-4 text-center">
                  <span className="text-base font-extrabold uppercase tracking-widest">{studio.name}</span>
                  <p className="text-[10px] text-gray-500 mt-1">Official Financial Ledger Report • Cainta Rizal MIS</p>
                  {/* Active date scope pill */}
                  <div className="mt-2 inline-flex items-center gap-1.5 bg-amber-50 border border-amber-200 text-amber-800 px-3 py-1 rounded-full text-[10px] font-extrabold">
                    <Calendar size={10} /> Scope: {dateRangeLabel}
                  </div>
                  <p className="text-[10px] text-gray-400 mt-1.5">Only verified paid amounts are counted toward income totals</p>
                </div>

                {/* Studio details */}
                <div className="space-y-1 text-left text-gray-700">
                  <p>Report Date: {new Date().toLocaleDateString()}</p>
                  <p>Date Scope: <strong>{dateRangeLabel}</strong></p>
                  <p>Studio Address: {studio.address}</p>
                  <p>Contact Details: {studio.contactInfo}</p>
                </div>

                {/* Income Source Visual Summary */}
                <div className="border border-[#e5e1da] rounded-2xl p-4 space-y-3 bg-[#faf9f6]">
                  <span className="font-extrabold block text-[10px] uppercase text-[#7c756d] tracking-widest">Income Source Summary</span>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-white rounded-xl border border-[#e5e1da] p-3 space-y-1">
                      <p className="text-[9px] font-bold uppercase text-[#7c756d] tracking-wider">📷 Booking Income</p>
                      <p className="text-base font-extrabold text-[#2c2a29]">₱{ledgerBookingIncome.toLocaleString()}</p>
                      <p className="text-[9px] text-gray-500">{ledgerBookings.length} booking{ledgerBookings.length !== 1 ? "s" : ""} with payment collected</p>
                      <div className="w-full bg-gray-100 rounded-full h-1.5 mt-1">
                        <div className="bg-[#2c2a29] h-1.5 rounded-full transition-all" style={{ width: `${ledgerBookingPct}%` }} />
                      </div>
                      <p className="text-[9px] font-bold text-[#2c2a29]">{ledgerBookingPct}% of total income</p>
                    </div>
                    <div className="bg-white rounded-xl border border-[#e5e1da] p-3 space-y-1">
                      <p className="text-[9px] font-bold uppercase text-[#7c756d] tracking-wider">🖨️ Print Order Income</p>
                      <p className="text-base font-extrabold text-amber-700">₱{ledgerPrintIncome.toLocaleString()}</p>
                      <p className="text-[9px] text-gray-500">{ledgerPaidPrints.length} paid print order{ledgerPaidPrints.length !== 1 ? "s" : ""}</p>
                      <div className="w-full bg-gray-100 rounded-full h-1.5 mt-1">
                        <div className="bg-amber-500 h-1.5 rounded-full transition-all" style={{ width: `${ledgerPrintPct}%` }} />
                      </div>
                      <p className="text-[9px] font-bold text-amber-700">{ledgerPrintPct}% of total income</p>
                    </div>
                  </div>
                  {/* Combined bar */}
                  <div className="space-y-1">
                    <div className="flex w-full h-3 rounded-full overflow-hidden bg-gray-100">
                      <div className="bg-[#2c2a29] h-full transition-all" style={{ width: `${ledgerBookingPct}%` }} title={`Booking Income ${ledgerBookingPct}%`} />
                      <div className="bg-amber-500 h-full transition-all" style={{ width: `${ledgerPrintPct}%` }} title={`Print Income ${ledgerPrintPct}%`} />
                    </div>
                    <div className="flex gap-4 text-[9px]">
                      <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#2c2a29] inline-block" /> Booking {ledgerBookingPct}%</span>
                      <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500 inline-block" /> Print Orders {ledgerPrintPct}%</span>
                    </div>
                  </div>
                </div>

                {/* Section A: Booking Income */}
                <div className="border-t border-[#e5e1da] pt-4 text-left space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="font-extrabold block text-[10px] uppercase tracking-wider">A. Photography Booking Income (Paid Only)</span>
                    <span className="font-extrabold text-[10px] text-emerald-700">₱{ledgerBookingIncome.toLocaleString()}</span>
                  </div>
                  {ledgerBookings.length === 0 ? (
                    <p className="text-gray-400 text-[10px] italic">No paid booking income recorded.</p>
                  ) : (
                    ledgerBookings.map((b, idx) => {
                      const paid = Number(b.amountPaid || 0);
                      const balance = Number(b.remainingBalance ?? Math.max(Number(b.totalAmount || 0) - paid, 0));
                      return (
                        <div key={idx} className="flex justify-between items-start border-b border-dashed border-gray-100 pb-1 last:border-0">
                          <span className="text-gray-600 flex-1 pr-2">
                            {b.id} — {b.status}
                            {balance > 0 && <span className="text-rose-500 ml-1">(Balance due: ₱{balance.toLocaleString()})</span>}
                          </span>
                          <span className="font-extrabold text-emerald-700 whitespace-nowrap">₱{paid.toLocaleString()}</span>
                        </div>
                      );
                    })
                  )}
                  {/* Outstanding booking balances reference row */}
                  {outstandingBookingBalance > 0 && (
                    <div className="flex justify-between items-center bg-rose-50 border border-rose-100 rounded-lg px-2 py-1 mt-1">
                      <span className="text-rose-700 text-[9px] font-bold uppercase">Uncollected Booking Balances (not in income)</span>
                      <span className="text-rose-700 font-extrabold text-[10px]">₱{outstandingBookingBalance.toLocaleString()}</span>
                    </div>
                  )}
                </div>

                {/* Section B: Print Order Income */}
                <div className="border-t border-[#e5e1da] pt-4 text-left space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="font-extrabold block text-[10px] uppercase tracking-wider">B. Print Order Income (Paid Only)</span>
                    <span className="font-extrabold text-[10px] text-amber-700">₱{ledgerPrintIncome.toLocaleString()}</span>
                  </div>
                  {ledgerPaidPrints.length === 0 ? (
                    <p className="text-gray-400 text-[10px] italic">No paid print order income recorded.</p>
                  ) : (
                    ledgerPaidPrints.map((p, idx) => {
                      const product = printProducts.find(item => item.id === p.productId);
                      return (
                        <div key={idx} className="flex justify-between items-start border-b border-dashed border-gray-100 pb-1 last:border-0">
                          <span className="text-gray-600 flex-1 pr-2">
                            {p.id} — {product?.name || "Photo Print"} × {p.quantity} ({p.status})
                          </span>
                          <span className="font-extrabold text-amber-700 whitespace-nowrap">₱{Number(p.totalAmount || 0).toLocaleString()}</span>
                        </div>
                      );
                    })
                  )}
                  {/* Unpaid/pending print orders reference row */}
                  {outstandingPrintBalance > 0 && (
                    <div className="flex justify-between items-center bg-rose-50 border border-rose-100 rounded-lg px-2 py-1 mt-1">
                      <span className="text-rose-700 text-[9px] font-bold uppercase">Pending/Unpaid Print Orders (not in income)</span>
                      <span className="text-rose-700 font-extrabold text-[10px]">₱{outstandingPrintBalance.toLocaleString()}</span>
                    </div>
                  )}
                </div>

                {/* Grand Total */}
                <div className="border-t border-double border-[#2c2a29] pt-4 space-y-1.5">
                  <div className="flex justify-between text-[10px] text-gray-600">
                    <span>A. Booking Income</span>
                    <span className="font-bold">₱{ledgerBookingIncome.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-[10px] text-gray-600">
                    <span>B. Print Order Income</span>
                    <span className="font-bold">₱{ledgerPrintIncome.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between font-extrabold text-sm text-[#2c2a29] border-t border-[#2c2a29] pt-2 mt-1">
                    <span>OVERALL LEDGER INCOME SUMMARY (A + B):</span>
                    <span>₱{ledgerTotal.toLocaleString()}</span>
                  </div>
                  <p className="text-[9px] text-gray-400 text-right">Only verified paid collections are counted.</p>
                </div>
              </div>
              );
            })()}
          </div>
        );
      })()}

      {/* UNIFIED STUDIO MANAGEMENT & SETTINGS HUB */}
      {["management", "services", "staff", "settings"].includes(activeTab) && (
        <div className="space-y-6 text-left">
          {/* Management Hub Container Card */}
          <div className="bg-white rounded-3xl border border-[#e5e1da] shadow-sm p-6 space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#e5e1da] pb-5">
              <div>
                <div className="inline-flex items-center gap-1.5 bg-[#fff1bd] text-[#8a5a00] border border-[#efd37a] px-3 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider mb-2">
                  <Sparkles size={12} /> Studio Operations & Settings Hub
                </div>
                <h3 className="font-display text-2xl font-extrabold text-[#2c2a29]">
                  Studio Management & Settings
                </h3>
                <p className="text-xs text-[#7c756d] mt-1">
                  Manage your photography services catalog, studio branding, GCash payments, team accounts, scheduling rules, and account security in one place.
                </p>
              </div>
            </div>

            {/* Sub-Tab Navigation Pill Bar */}
            <div className="flex flex-wrap gap-2 pt-1 border-b border-[#e5e1da] pb-4">
              {[
                { id: "catalog" as const, label: "Services & Catalog", icon: Camera, desc: "Services, packages & prints" },
                { id: "branding" as const, label: "Branding & Profile", icon: Settings, desc: "Logo, location & bio" },
                { id: "gcash" as const, label: "Payment Methods & QR", icon: DollarSign, desc: "GCash & Maya QR codes" },
                ...(canManageStaff ? [{ id: "staff" as const, label: "Staff Accounts", icon: User, desc: "Team members & invites" }] : []),
                { id: "availability" as const, label: "Availability & Calendar", icon: Calendar, desc: "Blocked dates & hours" },
                { id: "faqs" as const, label: "Studio FAQs", icon: FileText, desc: "Chatbot & inquiries" },
                { id: "account" as const, label: "Account & Password", icon: KeyRound, desc: "My login credentials" }
              ].map((subTab) => {
                const Icon = subTab.icon;
                const isSelected = managementSubTab === subTab.id;
                return (
                  <button
                    key={subTab.id}
                    type="button"
                    onClick={() => setManagementSubTab(subTab.id)}
                    className={`px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 transition-all cursor-pointer ${
                      isSelected
                        ? "bg-[#2c2a29] text-white shadow-md shadow-black/10 scale-[1.02]"
                        : "bg-[#faf9f6] text-[#7c756d] hover:bg-gray-100 hover:text-[#2c2a29] border border-[#e5e1da]"
                    }`}
                  >
                    <Icon size={14} className={isSelected ? "text-yellow-400" : "text-[#7c756d]"} />
                    <span>{subTab.label}</span>
                  </button>
                );
              })}
            </div>

            {/* SUB-TAB 1: SERVICES & PACKAGES CATALOG */}
            {managementSubTab === "catalog" && (
              <div className="space-y-8 pt-2">
          {/* Section 1: Services */}
          <div className="bg-white rounded-3xl border border-[#e5e1da] shadow-sm p-6 space-y-6">
            <div className="flex justify-between items-center flex-wrap gap-4 border-b border-gray-100 pb-4">
              <div>
                <h3 className="font-display text-lg font-bold text-[#2c2a29]">Photography Services Catalog</h3>
                <p className="text-xs text-[#7c756d]">Services represent individual shoot offerings listed in your directory profile.</p>
              </div>
              <button
                onClick={() => {
                  if (isAddingService && editingServiceId) {
                    resetServiceForm();
                    return;
                  }
                  if (isAddingService) {
                    setIsAddingService(false);
                    return;
                  }
                  resetServiceForm();
                  setIsAddingService(true);
                }}
                className="py-2 px-4 bg-[#2c2a29] text-[#faf9f6] hover:bg-[#1a1918] rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 cursor-pointer shadow-sm"
              >
                {isAddingService ? <X size={14} /> : <Plus size={14} />} 
                {isAddingService ? "Cancel" : "Add Service"}
              </button>
            </div>

            {isAddingService && (
              <form onSubmit={handleAddServiceSubmit} className="bg-[#faf9f6] border border-[#e5e1da] p-5 rounded-2xl max-w-xl space-y-4 text-xs">
                <h4 className="font-bold text-[#2c2a29] uppercase tracking-wider text-[10px]">{editingServiceId ? "Edit Shoot Service" : "Create New Shoot Service"}</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1 col-span-2">
                    <label className="font-bold text-[#2c2a29]">Service Name</label>
                    <input
                      type="text"
                      required
                      value={srvName}
                      onChange={e => setSrvName(e.target.value)}
                      placeholder={currentServiceTemplate.name}
                      className="w-full bg-white border border-[#e5e1da] rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-[#2c2a29]"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="font-bold text-[#2c2a29]">Base Price (PHP)</label>
                    <input
                      type="number"
                      required
                      value={srvPrice}
                      onChange={e => setSrvPrice(e.target.value)}
                      placeholder={currentServiceTemplate.price}
                      className="w-full bg-white border border-[#e5e1da] rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-[#2c2a29]"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="font-bold text-[#2c2a29]">Shoot Duration (Minutes)</label>
                    <select
                      value={srvDuration}
                      onChange={e => setSrvDuration(e.target.value)}
                      className="w-full bg-white border border-[#e5e1da] rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-[#2c2a29]"
                    >
                      <option value="30">30 minutes</option>
                      <option value="60">1 hour</option>
                      <option value="90">1.5 hours</option>
                      <option value="120">2 hours</option>
                      <option value="180">3 hours</option>
                    </select>
                  </div>
                  <div className="space-y-1 col-span-2">
                    <label className="font-bold text-[#2c2a29]">Category Classification</label>
                    <select
                      value={srvCat}
                      onChange={e => setSrvCat(e.target.value)}
                      className="w-full bg-white border border-[#e5e1da] rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-[#2c2a29]"
                    >
                      <option value="Portrait Photography">Portrait Photography</option>
                      <option value="Graduation Shoots">Graduation Shoots</option>
                      <option value="Wedding Milestones">Wedding Milestones</option>
                      <option value="Product Creative">Product Creative</option>
                      <option value="Family Portrait">Family Portrait</option>
                      <option value="Baby & Milestone">Baby & Milestone</option>
                    </select>
                  </div>
                  <div className="space-y-1 col-span-2">
                    <label className="font-bold text-[#2c2a29]">Description / Inclusions Summary</label>
                    <textarea
                      required
                      value={srvDesc}
                      onChange={e => setSrvDesc(e.target.value)}
                      placeholder={currentServiceTemplate.description}
                      className="w-full bg-white border border-[#e5e1da] rounded-xl p-3 text-xs focus:outline-none focus:border-[#2c2a29] h-20"
                    />
                  </div>
                  <div className="space-y-1 col-span-2">
                    <label className="font-bold text-[#2c2a29]">Service Sample Showcase Photos</label>
                    <div className="flex items-start gap-3">
                      {srvImages.length > 0 && (
                        <div className="flex flex-wrap gap-2 max-w-[220px]">
                          {srvImages.map((image, index) => (
                            <div key={`${image.slice(0, 24)}-${index}`} className="relative">
                              <img src={image} alt={`Sample ${index + 1}`} className="w-16 h-12 object-cover rounded-lg border border-gray-200" />
                              <button type="button" onClick={() => setSrvImages(current => current.filter((_, imageIndex) => imageIndex !== index))} className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-red-600 text-white text-xs leading-none cursor-pointer" aria-label={`Remove sample ${index + 1}`}>×</button>
                            </div>
                          ))}
                        </div>
                      )}
                      <div className="flex-1 space-y-1">
                        <div className="relative">
                          <input
                            type="file"
                            accept="image/*"
                            multiple
                            onChange={handleServiceImagesUpload}
                            className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                          />
                          <button type="button" className="w-full py-2 bg-white border border-[#e5e1da] rounded-xl text-xs font-bold text-gray-700 hover:border-[#2c2a29] transition-colors flex items-center justify-center gap-1">
                            <Upload size={12} /> Add Sample Photos
                          </button>
                        </div>
                        <input
                          type="text"
                          placeholder="Paste an image URL, then press Enter"
                          onKeyDown={e => {
                            if (e.key === "Enter" && e.currentTarget.value.trim()) {
                              e.preventDefault();
                              setSrvImages(current => [...current, e.currentTarget.value.trim()]);
                              e.currentTarget.value = "";
                            }
                          }}
                          className="w-full bg-white border border-[#e5e1da] rounded-xl px-2.5 py-1 text-[11px] focus:outline-none focus:border-[#2c2a29]"
                        />
                        <p className="text-[10px] text-[#7c756d]">You can upload multiple sample images.</p>
                      </div>
                    </div>
                  </div>
                </div>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#2c2a29] text-white font-bold rounded-xl uppercase tracking-wider cursor-pointer"
                >
                  {editingServiceId ? "Update Service" : "Save Service"}
                </button>
              </form>
            )}

            <div className="grid sm:grid-cols-2 gap-4">
              {services.filter(s => s.studioId === studio.id).map((s) => (
                <div key={s.id} className="p-4 border border-[#e5e1da] rounded-2xl bg-[#faf9f6] flex flex-col justify-between space-y-3 text-xs overflow-hidden">
                  {s.image && (
                    <img src={s.image} alt={s.name} className="w-full h-36 object-cover rounded-xl border border-gray-200 shadow-xs" />
                  )}
                  <div className="space-y-1">
                    <div className="flex justify-between items-start">
                      <span className="text-[9px] bg-amber-50 text-amber-800 border border-amber-200 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">{s.category}</span>
                      <span className="font-bold font-mono text-xs text-[#2c2a29]">₱{s.basePrice}</span>
                    </div>
                    <h4 className="font-bold text-sm text-[#2c2a29]">{s.name}</h4>
                    <p className="text-[#7c756d] leading-snug text-[11px] line-clamp-3">{s.description}</p>
                    <p className="text-[10px] text-gray-500 font-semibold">🕒 Duration: {s.durationMinutes} minutes</p>
                  </div>
                  <div className="pt-2 border-t border-[#e5e1da]/50 flex justify-end gap-2">
                    <button
                      onClick={() => startEditingService(s)}
                      className="text-[#2c2a29] hover:text-[#1a1918] font-bold uppercase tracking-wider text-[10px] flex items-center gap-1 cursor-pointer"
                    >
                      <Edit size={12} /> Edit
                    </button>
                    <button
                      onClick={() => handleDeleteService(s.id)}
                      className="text-red-600 hover:text-red-800 font-bold uppercase tracking-wider text-[10px] flex items-center gap-1 cursor-pointer"
                    >
                      <Trash2 size={12} /> Remove Offering
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Section 2: Print Products */}
          <div className="bg-white rounded-3xl border border-[#e5e1da] shadow-sm p-6 space-y-6">
            <div className="flex justify-between items-center flex-wrap gap-4 border-b border-gray-100 pb-4">
              <div>
                <h3 className="font-display text-lg font-bold text-[#2c2a29]">Print Product Catalog</h3>
                <p className="text-xs text-[#7c756d]">Create the physical print options your customers can order from the studio storefront.</p>
              </div>
              <button
                onClick={() => isAddingPrintProduct ? resetPrintProductForm() : setIsAddingPrintProduct(true)}
                className="py-2 px-4 bg-[#2c2a29] text-[#faf9f6] hover:bg-[#1a1918] rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 cursor-pointer shadow-sm"
              >
                {isAddingPrintProduct ? <X size={14} /> : <Plus size={14} />} 
                {isAddingPrintProduct ? "Cancel" : "Add Print Product"}
              </button>
            </div>

            {isAddingPrintProduct && (
              <form onSubmit={handleAddPrintProductSubmit} className="bg-[#faf9f6] border border-[#e5e1da] p-5 rounded-2xl max-w-xl space-y-4 text-xs">
                <h4 className="font-bold text-[#2c2a29] uppercase tracking-wider text-[10px]">{editingPrintProductId ? "Edit Print Product" : "Create Print Product"}</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1 col-span-2">
                    <label className="font-bold text-[#2c2a29]">Product Name</label>
                    <input
                      type="text"
                      required
                      value={printProdName}
                      onChange={e => setPrintProdName(e.target.value)}
                      placeholder="e.g. 8R Matte Portrait Print"
                      className="w-full bg-white border border-[#e5e1da] rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-[#2c2a29]"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="font-bold text-[#2c2a29]">Price (PHP)</label>
                    <input
                      type="number"
                      required
                      value={printProdPrice}
                      onChange={e => setPrintProdPrice(e.target.value)}
                      placeholder="450"
                      className="w-full bg-white border border-[#e5e1da] rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-[#2c2a29]"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="font-bold text-[#2c2a29]">Size</label>
                    <input
                      type="text"
                      required
                      value={printProdSize}
                      onChange={e => setPrintProdSize(e.target.value)}
                      placeholder="8x10 inches"
                      className="w-full bg-white border border-[#e5e1da] rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-[#2c2a29]"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="font-bold text-[#2c2a29]">Estimated Hours</label>
                    <input
                      type="number"
                      required
                      value={printProdHours}
                      onChange={e => setPrintProdHours(e.target.value)}
                      placeholder="24"
                      className="w-full bg-white border border-[#e5e1da] rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-[#2c2a29]"
                    />
                  </div>
                  <div className="space-y-1 col-span-2">
                    <label className="font-bold text-[#2c2a29]">Product Photos (multiple)</label>
                    <input
                      type="file"
                      required={printProdImages.length === 0}
                      accept="image/jpeg,image/png,image/webp"
                      multiple
                      onChange={handlePrintProductImagesUpload}
                      className="w-full bg-white border border-[#e5e1da] rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-[#2c2a29]"
                    />
                    {printProdImages.length > 0 && (
                      <div className="grid grid-cols-4 gap-2 pt-2">
                        {printProdImages.map((image, index) => (
                          <img key={`${image.slice(0, 20)}-${index}`} src={image} alt={`Product preview ${index + 1}`} className="h-16 w-full rounded-lg object-cover border border-[#e5e1da]" />
                        ))}
                      </div>
                    )}
                    {printProdExistingImages.length > 0 && (
                      <div className="flex gap-2 pt-2">
                        {printProdExistingImages.slice(0, 5).map((image, index) => (
                          <img key={`${image}-${index}`} src={image} alt={`Current product photo ${index + 1}`} className="h-12 w-12 rounded-lg object-cover border border-[#e5e1da]" />
                        ))}
                        <p className="self-center text-[10px] text-[#7c756d]">Current photos are kept unless replacement photos are uploaded.</p>
                      </div>
                    )}
                    <p className="text-[10px] text-[#7c756d]">Upload photos showing the actual paper, material, frame, or finish. Add each size/style as its own product with its own price.</p>
                  </div>
                  <div className="space-y-1 col-span-2">
                    <label className="font-bold text-[#2c2a29]">Description</label>
                    <textarea
                      value={printProdDesc}
                      onChange={e => setPrintProdDesc(e.target.value)}
                      placeholder="Premium archival print with a fine matte finish and rich color depth."
                      className="w-full bg-white border border-[#e5e1da] rounded-xl p-3 text-xs focus:outline-none focus:border-[#2c2a29] h-20"
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-bold rounded-xl uppercase tracking-wider cursor-pointer"
                >
                  {editingPrintProductId ? "Update Print Product" : "Save Print Product"}
                </button>
              </form>
            )}

            <div className="grid sm:grid-cols-2 gap-4">
              {printProducts.filter(p => p.studioId === studio.id).map((prod) => (
                <div key={prod.id} className="p-4 border border-[#e5e1da] rounded-2xl bg-[#faf9f6] flex flex-col justify-between space-y-3 text-xs">
                  <div className="space-y-2 text-left">
                    <img src={prod.images?.[0] || prod.image} alt={prod.name} className="w-full h-32 rounded-xl object-cover border border-[#e5e1da]" />
                    {prod.images && prod.images.length > 1 && (
                      <div className="flex gap-1.5 overflow-hidden">
                        {prod.images.slice(1, 5).map((image: string, index: number) => (
                          <img key={`${image}-${index}`} src={image} alt={`${prod.name} detail ${index + 2}`} className="h-10 w-10 rounded object-cover border border-[#e5e1da]" />
                        ))}
                      </div>
                    )}
                    <div className="flex justify-between items-center gap-2">
                      <h4 className="font-bold text-sm text-[#2c2a29]">{prod.name}</h4>
                      <span className="font-bold font-mono text-xs text-[#2c2a29]">₱{prod.price}</span>
                    </div>
                    <p className="text-[#7c756d] text-[11px] leading-snug">{prod.description}</p>
                    <div className="grid grid-cols-2 gap-x-2 gap-y-1 pt-1 text-[10px] text-gray-500 font-semibold">
                      <span>📏 {prod.size}</span>
                      <span>⏱️ {prod.estimatedHours} hrs</span>
                    </div>
                  </div>
                  <div className="pt-2 border-t border-[#e5e1da]/50 flex justify-end gap-2">
                    <button
                      onClick={() => startEditingPrintProduct(prod)}
                      className="text-[#2c2a29] hover:text-black font-bold uppercase tracking-wider text-[10px] flex items-center gap-1 cursor-pointer"
                    >
                      <Edit size={12} /> Edit
                    </button>
                    <button
                      onClick={() => handleDeletePrintProduct(prod.id)}
                      className="text-red-600 hover:text-red-800 font-bold uppercase tracking-wider text-[10px] flex items-center gap-1 cursor-pointer"
                    >
                      <Trash2 size={12} /> Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Section 2: Packages */}
          <div className="bg-white rounded-3xl border border-[#e5e1da] shadow-sm p-6 space-y-6">
            <div className="flex justify-between items-center flex-wrap gap-4 border-b border-gray-100 pb-4">
              <div>
                <h3 className="font-display text-lg font-bold text-[#2c2a29]">Customizable Packages</h3>
                <p className="text-xs text-[#7c756d]">Packages are bundle plans representing multi-value photography packages with custom deliverables.</p>
              </div>
              <button
                onClick={() => {
                  if (isAddingPackage && editingPackageId) {
                    resetPackageForm();
                    return;
                  }
                  if (isAddingPackage) {
                    setIsAddingPackage(false);
                    return;
                  }
                  resetPackageForm();
                  setIsAddingPackage(true);
                }}
                className="py-2 px-4 bg-[#2c2a29] text-[#faf9f6] hover:bg-[#1a1918] rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 cursor-pointer shadow-sm"
              >
                {isAddingPackage ? <X size={14} /> : <Plus size={14} />} 
                {isAddingPackage ? "Cancel" : "Add Package"}
              </button>
            </div>

            {isAddingPackage && (
              <form onSubmit={handleAddPackageSubmit} className="bg-[#faf9f6] border border-[#e5e1da] p-5 rounded-2xl max-w-xl space-y-4 text-xs">
                <h4 className="font-bold text-[#2c2a29] uppercase tracking-wider text-[10px]">{editingPackageId ? "Edit Custom Photo Package" : "Create Custom Photo Package"}</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1 col-span-2">
                    <label className="font-bold text-[#2c2a29]">Package Category</label>
                    <select
                      value={pkgCat}
                      onChange={e => setPkgCat(e.target.value)}
                      className="w-full bg-white border border-[#e5e1da] rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-[#2c2a29]"
                    >
                      {selectedCategories.length > 0 ? selectedCategories.map((cat) => (
                        <option key={cat} value={cat}>{cat}</option>
                      )) : [
                        "Portrait Photography",
                        "Graduation Shoots",
                        "Wedding Milestones",
                        "Product Creative",
                        "Family Portrait",
                        "Baby & Milestone"
                      ].map((cat) => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1 col-span-2">
                    <label className="font-bold text-[#2c2a29]">Package Bundle Name</label>
                    <input
                      type="text"
                      required
                      value={pkgName}
                      onChange={e => setPkgName(e.target.value)}
                      placeholder={currentPackageTemplate.name}
                      className="w-full bg-white border border-[#e5e1da] rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-[#2c2a29]"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="font-bold text-[#2c2a29]">Price (PHP)</label>
                    <input
                      type="number"
                      required
                      value={pkgPrice}
                      onChange={e => setPkgPrice(e.target.value)}
                      placeholder={currentPackageTemplate.price}
                      className="w-full bg-white border border-[#e5e1da] rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-[#2c2a29]"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="font-bold text-[#2c2a29]">Shoot Duration (Minutes)</label>
                    <input
                      type="number"
                      required
                      value={pkgDuration}
                      onChange={e => setPkgDuration(e.target.value)}
                      placeholder={currentPackageTemplate.duration}
                      className="w-full bg-white border border-[#e5e1da] rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-[#2c2a29]"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="font-bold text-[#2c2a29]">Retouched & Edited Photos Deliverable</label>
                    <input
                      type="number"
                      required
                      value={pkgPhotosCount}
                      onChange={e => setPkgPhotosCount(e.target.value)}
                      placeholder={currentPackageTemplate.photos}
                      className="w-full bg-white border border-[#e5e1da] rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-[#2c2a29]"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="font-bold text-[#2c2a29]">Physical Prints Included</label>
                    <input
                      type="text"
                      required
                      value={pkgPrints}
                      onChange={e => setPkgPrints(e.target.value)}
                      placeholder={currentPackageTemplate.prints}
                      className="w-full bg-white border border-[#e5e1da] rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-[#2c2a29]"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="font-bold text-[#2c2a29]">Photographer Headcount</label>
                    <input
                      type="number"
                      required
                      value={pkgPhotographerCount}
                      onChange={e => setPkgPhotographerCount(e.target.value)}
                      placeholder={currentPackageTemplate.photographers}
                      className="w-full bg-white border border-[#e5e1da] rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-[#2c2a29]"
                    />
                  </div>
                  <div className="space-y-1 col-span-2">
                    <label className="font-bold text-[#2c2a29]">Inclusions & Terms Description</label>
                    <textarea
                      required
                      value={pkgDesc}
                      onChange={e => setPkgDesc(e.target.value)}
                      placeholder={currentPackageTemplate.description}
                      className="w-full bg-white border border-[#e5e1da] rounded-xl p-3 text-xs focus:outline-none focus:border-[#2c2a29] h-20"
                    />
                  </div>
                  <div className="space-y-1 col-span-2">
                    <label className="font-bold text-[#2c2a29]">Package Catalog Image</label>
                    <div className="flex items-center gap-3">
                      {pkgImage && <img src={pkgImage} alt="Package preview" className="w-20 h-16 rounded-lg object-cover border border-[#e5e1da]" />}
                      <div className="relative flex-1">
                        <input type="file" accept="image/jpeg,image/png,image/webp" onChange={e => handleImageFileUpload(e, setPkgImage)} className="absolute inset-0 opacity-0 cursor-pointer w-full h-full" />
                        <button type="button" className="w-full py-2 bg-white border border-[#e5e1da] rounded-xl text-xs font-bold text-gray-700 hover:border-[#2c2a29] transition-colors flex items-center justify-center gap-1">
                          <Upload size={12} /> {pkgImage ? "Replace Package Image" : "Upload Package Image"}
                        </button>
                      </div>
                    </div>
                    <p className="text-[10px] text-[#7c756d]">This image appears when customers choose the package while booking.</p>
                  </div>
                </div>
                <button
                  type="submit"
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-bold rounded-xl uppercase tracking-wider cursor-pointer"
                >
                  {editingPackageId ? "Update Package Bundle" : "Save Package Bundle"}
                </button>
              </form>
            )}

            <div className="grid sm:grid-cols-2 gap-4">
              {packages.filter(p => p.studioId === studio.id).map((p) => (
                <div key={p.id} className="p-4 border border-[#e5e1da] rounded-2xl bg-[#faf9f6] flex flex-col justify-between space-y-3 text-xs">
                  <div className="space-y-1 text-left">
                    {p.image && <img src={p.image} alt={p.name} className="w-full h-32 rounded-xl object-cover border border-[#e5e1da]" />}
                    <div className="flex justify-between items-start">
                      <span className="text-[9px] bg-green-50 text-green-800 border border-green-200 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">Bundle Package</span>
                      <span className="font-bold font-mono text-xs text-[#2c2a29]">₱{p.price}</span>
                    </div>
                    <h4 className="font-bold text-sm text-[#2c2a29]">{p.name}</h4>
                    <p className="text-[#7c756d] leading-snug text-[11px] line-clamp-3">{p.description}</p>
                    <div className="grid grid-cols-2 gap-x-2 gap-y-1 pt-1.5 text-[10px] text-gray-500 font-semibold">
                      <span>🕒 Shoot: {p.durationMinutes} mins</span>
                      <span>✨ Retouched: {p.editedPhotosCount} photos</span>
                      <span>📷 Staff count: {p.photographerCount} photographer</span>
                      <span className="col-span-2">🖼️ Prints: {p.includedPrints}</span>
                    </div>
                  </div>
                  <div className="pt-2 border-t border-[#e5e1da]/50 flex justify-end gap-2">
                    <button
                      onClick={() => startEditingPackage(p)}
                      className="text-[#2c2a29] hover:text-[#1a1918] font-bold uppercase tracking-wider text-[10px] flex items-center gap-1 cursor-pointer"
                    >
                      <Edit size={12} /> Edit
                    </button>
                    <button
                      onClick={() => handleDeletePackage(p.id)}
                      className="text-red-600 hover:text-red-800 font-bold uppercase tracking-wider text-[10px] flex items-center gap-1 cursor-pointer"
                    >
                      <Trash2 size={12} /> Remove Package
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Section 3: Addons */}
          <div className="bg-white rounded-3xl border border-[#e5e1da] shadow-sm p-6 space-y-6">
            <div className="flex justify-between items-center flex-wrap gap-4 border-b border-gray-100 pb-4">
              <div>
                <h3 className="font-display text-lg font-bold text-[#2c2a29]">Studio Add-on Enhancements</h3>
                <p className="text-xs text-[#7c756d]">Add-ons provide optional customer selection boosts during checkout (makeup, extra copies, layout designs).</p>
              </div>
              <button
                onClick={() => setIsAddingAddon(!isAddingAddon)}
                className="py-2 px-4 bg-[#2c2a29] text-[#faf9f6] hover:bg-[#1a1918] rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 cursor-pointer shadow-sm"
              >
                {isAddingAddon ? <X size={14} /> : <Plus size={14} />} 
                {isAddingAddon ? "Cancel" : "Add Addon"}
              </button>
            </div>

            {isAddingAddon && (
              <form onSubmit={handleAddAddonSubmit} className="bg-[#faf9f6] border border-[#e5e1da] p-5 rounded-2xl max-w-xl space-y-4 text-xs">
                <h4 className="font-bold text-[#2c2a29] uppercase tracking-wider text-[10px]">Create Studio Add-on</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1 col-span-2">
                    <label className="font-bold text-[#2c2a29]">Add-on Title</label>
                    <input
                      type="text"
                      required
                      value={addName}
                      onChange={e => setAddName(e.target.value)}
                      placeholder="e.g. Makeup & Hair-styling service"
                      className="w-full bg-white border border-[#e5e1da] rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-[#2c2a29]"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="font-bold text-[#2c2a29]">Price Tag (PHP)</label>
                    <input
                      type="number"
                      required
                      value={addPrice}
                      onChange={e => setAddPrice(e.target.value)}
                      placeholder="e.g. 500"
                      className="w-full bg-white border border-[#e5e1da] rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-[#2c2a29]"
                    />
                  </div>
                  <div className="space-y-1 col-span-2">
                    <label className="font-bold text-[#2c2a29]">Inclusion Description (Optional)</label>
                    <input
                      type="text"
                      value={addDesc}
                      onChange={e => setAddDesc(e.target.value)}
                      placeholder="e.g. Includes full visual styling + hair touchups during shoot..."
                      className="w-full bg-white border border-[#e5e1da] rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-[#2c2a29]"
                    />
                  </div>
                  <div className="space-y-1 col-span-2">
                    <label className="font-bold text-[#2c2a29]">Add-on Catalog Image</label>
                    <div className="flex items-center gap-3">
                      {addImage && <img src={addImage} alt="Add-on preview" className="w-20 h-16 rounded-lg object-cover border border-[#e5e1da]" />}
                      <div className="relative flex-1">
                        <input type="file" accept="image/jpeg,image/png,image/webp" onChange={handleAddonImageUpload} className="absolute inset-0 opacity-0 cursor-pointer w-full h-full" />
                        <button type="button" className="w-full py-2 bg-white border border-[#e5e1da] rounded-xl text-xs font-bold text-gray-700 hover:border-[#2c2a29] transition-colors flex items-center justify-center gap-1">
                          <Upload size={12} /> {addImage ? "Replace Add-on Image" : "Upload Add-on Image"}
                        </button>
                      </div>
                    </div>
                    <p className="text-[10px] text-[#7c756d]">This image appears when customers choose the add-on while booking.</p>
                  </div>
                </div>
                <button
                  type="submit"
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-bold rounded-xl uppercase tracking-wider cursor-pointer"
                >
                  Save Add-on
                </button>
              </form>
            )}

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {addons.filter(a => a.studioId === studio.id).map((addon) => (
                <div key={addon.id} className="p-3 bg-[#faf9f6] border border-[#e5e1da] rounded-2xl flex justify-between items-center text-xs font-semibold text-[#2c2a29]">
                  {addon.image && <img src={addon.image} alt={addon.name} className="w-14 h-14 rounded-lg object-cover border border-[#e5e1da] mr-3" />}
                  <div className="text-left space-y-0.5">
                    <p className="font-bold text-[#2c2a29] leading-snug">{addon.name}</p>
                    <span className="text-[10px] text-gray-500 font-bold font-mono">₱{addon.price}</span>
                  </div>
                  <button
                    onClick={() => handleDeleteAddon(addon.id)}
                    className="text-red-500 hover:text-red-700 p-1.5 cursor-pointer"
                    title="Remove Addon"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

          {/* SUB-TAB 4: STAFF ACCOUNTS */}
          {managementSubTab === "staff" && canManageStaff && (
            <div className="space-y-6 pt-2">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                <div className="space-y-1">
                  <h3 className="font-display text-lg font-bold text-[#2c2a29]">Staff Accounts</h3>
                  <p className="text-xs text-[#7c756d]">Create accounts for team members who help manage {studio.name}.</p>
                </div>
                <button
                  type="button"
              onClick={loadStaff}
              disabled={loadingStaff}
              className="px-3 py-2 bg-[#2c2a29] text-white rounded-xl text-xs font-bold cursor-pointer disabled:opacity-50"
            >
              {loadingStaff ? "Loading..." : "Refresh Staff"}
            </button>
          </div>

          <form onSubmit={handleStaffInvite} className="grid sm:grid-cols-2 gap-4 p-4 bg-[#faf9f6] rounded-2xl border border-[#e5e1da]">
            <div className="space-y-1">
              <label className="text-xs font-bold text-[#2c2a29]">Full Name</label>
              <input required value={staffFullName} onChange={e => setStaffFullName(e.target.value)} placeholder="e.g. Maria Santos" className="w-full bg-white border border-[#e5e1da] rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-[#2c2a29]" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-[#2c2a29]">Email Address</label>
              <input required type="email" value={staffEmail} onChange={e => setStaffEmail(e.target.value)} placeholder="staff@example.com" className="w-full bg-white border border-[#e5e1da] rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-[#2c2a29]" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-[#2c2a29]">Temporary Password (Optional)</label>
              <input type="password" minLength={6} value={staffPassword} onChange={e => setStaffPassword(e.target.value)} placeholder="Defaults to Staff123!" className="w-full bg-white border border-[#e5e1da] rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-[#2c2a29]" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-[#2c2a29]">Contact Number (Optional)</label>
              <input value={staffContactNumber} onChange={e => setStaffContactNumber(e.target.value)} placeholder="09XX XXX XXXX" className="w-full bg-white border border-[#e5e1da] rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-[#2c2a29]" />
            </div>
            <button type="submit" disabled={savingStaff} className="sm:col-span-2 w-fit px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-xl text-xs font-bold uppercase tracking-wider cursor-pointer disabled:opacity-50">
              <span className="inline-flex items-center gap-1.5"><Plus size={14} /> {savingStaff ? "Creating Account..." : "Add Staff Account"}</span>
            </button>
          </form>

          {!staffLoaded ? (
            <div className="py-6 text-center text-xs text-[#7c756d]">Select Refresh Staff to load your current team.</div>
          ) : staff.length === 0 ? (
            <div className="py-8 text-center text-xs text-[#7c756d]">No staff accounts yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead><tr className="border-b border-[#e5e1da] text-[#7c756d] font-bold uppercase tracking-wider text-[10px]"><th className="py-3 px-4">Name</th><th className="py-3 px-4">Email</th><th className="py-3 px-4">Contact</th><th className="py-3 px-4">Created</th><th className="py-3 px-4 text-right">Action</th></tr></thead>
                <tbody className="divide-y divide-gray-100 font-medium text-[#2c2a29]">
                  {staff.map(member => (
                    <tr key={member.id}>
                      <td className="py-3 px-4 font-bold">{member.fullName}</td>
                      <td className="py-3 px-4">{member.email}</td>
                      <td className="py-3 px-4">{member.contactNumber || "-"}</td>
                      <td className="py-3 px-4">{member.createdAt ? new Date(member.createdAt).toLocaleDateString() : "-"}</td>
                      <td className="py-3 px-4 text-right"><button type="button" onClick={() => handleRemoveStaff(member.id)} className="text-red-600 hover:text-red-800 p-1 cursor-pointer" title="Remove staff account"><Trash2 size={14} /></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

          {/* SUB-TAB 3: PAYMENT METHODS & QR CODES */}
          {managementSubTab === "gcash" && (
            <div className="space-y-6 pt-2 text-left">
              <div className="bg-white rounded-2xl border border-[#e5e1da] p-5 space-y-1">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-display font-extrabold text-base text-[#2c2a29] flex items-center gap-2">
                      <Wallet className="text-amber-500" size={18} />
                      Studio Payment Methods & QR Configuration
                    </h3>
                    <p className="text-xs text-[#7c756d]">
                      Upload your official GCash and Maya QR code images and account details. Customers will scan these during checkout and payment proof upload. Bank transfer is not supported.
                    </p>
                  </div>
                  <span className="text-[10px] font-bold px-3 py-1 rounded-full border bg-emerald-50 text-emerald-800 border-emerald-200 uppercase tracking-wider">
                    ● Active Checkout Ready
                  </span>
                </div>
              </div>

              <form onSubmit={handleSaveGcashSettings} className="space-y-6">
                {/* 1. GCASH CONFIGURATION CARD */}
                <div className="p-5 bg-gradient-to-br from-emerald-950 via-emerald-900 to-emerald-950 border border-emerald-700/50 rounded-2xl text-white space-y-4 shadow-sm">
                  <div className="flex items-center justify-between border-b border-emerald-700/50 pb-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-[#00a94f] flex items-center justify-center font-bold text-white text-sm shadow">
                        G
                      </div>
                      <div>
                        <h4 className="font-display font-bold text-sm text-white">GCash Direct QR & Account</h4>
                        <p className="text-emerald-300/80 text-[11px]">Primary mobile wallet payment method for instant transfers.</p>
                      </div>
                    </div>
                    <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-bold px-2.5 py-0.5 rounded-full">
                      GCash Supported
                    </span>
                  </div>

                  <div className="grid sm:grid-cols-2 gap-4 text-xs">
                    <div className="space-y-1">
                      <label className="text-emerald-200 font-bold block">GCash Account Name</label>
                      <input
                        type="text"
                        value={gcashMerchantName}
                        onChange={e => setGcashMerchantName(e.target.value)}
                        placeholder={studio.name || "e.g. Cainta Photography Studio"}
                        className="w-full bg-emerald-900/40 border border-emerald-600/40 rounded-xl px-3 py-2 text-white placeholder-emerald-400/50 focus:outline-none focus:border-emerald-400"
                      />
                      <span className="text-[10px] text-emerald-400/70 block">Exact account name as registered on GCash</span>
                    </div>

                    <div className="space-y-1">
                      <label className="text-emerald-200 font-bold block">GCash Registered Mobile Number</label>
                      <input
                        type="text"
                        value={gcashNumber}
                        onChange={e => setGcashNumber(e.target.value)}
                        placeholder="09XX XXX XXXX"
                        className="w-full bg-emerald-900/40 border border-emerald-600/40 rounded-xl px-3 py-2 text-white placeholder-emerald-400/50 focus:outline-none focus:border-emerald-400 font-mono font-bold"
                      />
                      <span className="text-[10px] text-emerald-400/70 block">Mobile number for customer manual transfer & verification</span>
                    </div>

                    {/* GCash QR Upload */}
                    <div className="sm:col-span-2 space-y-2 pt-1 border-t border-emerald-800/60">
                      <label className="text-emerald-200 font-bold block text-xs">GCash QR Code Image</label>
                      <div className="flex flex-col sm:flex-row items-center gap-4 bg-emerald-900/30 border border-emerald-700/40 p-3.5 rounded-xl">
                        {gcashQrCode ? (
                          <div className="relative group w-28 h-28 bg-white p-1.5 rounded-xl border border-emerald-400/40 flex-shrink-0">
                            <img src={gcashQrCode} alt="GCash QR Code" className="w-full h-full object-contain rounded-lg" />
                            <button
                              type="button"
                              onClick={() => setGcashQrCode("")}
                              className="absolute -top-2 -right-2 bg-rose-600 text-white p-1 rounded-full hover:bg-rose-700 transition-colors shadow"
                              title="Remove GCash QR Image"
                            >
                              <X size={12} />
                            </button>
                          </div>
                        ) : (
                          <div className="w-28 h-28 bg-emerald-950 border border-dashed border-emerald-600/60 rounded-xl flex flex-col items-center justify-center text-emerald-400 text-center p-2 flex-shrink-0">
                            <ImageIcon size={24} className="opacity-60 mb-1" />
                            <span className="text-[9px] font-bold">No QR Uploaded</span>
                          </div>
                        )}

                        <div className="space-y-1.5 text-left flex-1">
                          <p className="text-xs text-emerald-100 font-semibold">
                            {gcashQrCode ? "GCash QR Code image is active." : "Upload your official GCash QR Code screenshot or image."}
                          </p>
                          <p className="text-[10px] text-emerald-300/70 leading-relaxed">
                            Customers can scan this QR code directly inside their GCash app during checkout or when submitting payment proof.
                          </p>
                          <label className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold cursor-pointer transition-colors shadow-xs">
                            <Upload size={13} /> {gcashQrCode ? "Replace GCash QR Image" : "Upload GCash QR Image"}
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={(e) => handleQrImageUpload(e, setGcashQrCode)}
                            />
                          </label>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 2. MAYA (PAYMAYA) CONFIGURATION CARD */}
                <div className="p-5 bg-gradient-to-br from-slate-900 via-teal-950 to-slate-900 border border-teal-800/50 rounded-2xl text-white space-y-4 shadow-sm">
                  <div className="flex items-center justify-between border-b border-teal-800/50 pb-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-teal-500 flex items-center justify-center font-bold text-slate-950 text-sm shadow">
                        M
                      </div>
                      <div>
                        <h4 className="font-display font-bold text-sm text-white">Maya (PayMaya) Direct QR & Account</h4>
                        <p className="text-teal-300/80 text-[11px]">Secondary digital wallet option for customer convenience.</p>
                      </div>
                    </div>
                    <span className="bg-teal-500/20 text-teal-300 border border-teal-500/30 text-[10px] font-bold px-2.5 py-0.5 rounded-full">
                      Maya Supported
                    </span>
                  </div>

                  <div className="grid sm:grid-cols-2 gap-4 text-xs">
                    <div className="space-y-1">
                      <label className="text-teal-200 font-bold block">Maya Account Name</label>
                      <input
                        type="text"
                        value={mayaMerchantName}
                        onChange={e => setMayaMerchantName(e.target.value)}
                        placeholder={studio.name || "e.g. Cainta Photography Studio"}
                        className="w-full bg-teal-950/60 border border-teal-700/40 rounded-xl px-3 py-2 text-white placeholder-teal-500/50 focus:outline-none focus:border-teal-400"
                      />
                      <span className="text-[10px] text-teal-400/70 block">Registered account name on Maya</span>
                    </div>

                    <div className="space-y-1">
                      <label className="text-teal-200 font-bold block">Maya Mobile / Account Number</label>
                      <input
                        type="text"
                        value={mayaNumber}
                        onChange={e => setMayaNumber(e.target.value)}
                        placeholder="09XX XXX XXXX"
                        className="w-full bg-teal-950/60 border border-teal-700/40 rounded-xl px-3 py-2 text-white placeholder-teal-500/50 focus:outline-none focus:border-teal-400 font-mono font-bold"
                      />
                      <span className="text-[10px] text-teal-400/70 block">Registered Maya mobile or account number</span>
                    </div>

                    {/* Maya QR Upload */}
                    <div className="sm:col-span-2 space-y-2 pt-1 border-t border-teal-900/80">
                      <label className="text-teal-200 font-bold block text-xs">Maya QR Code Image</label>
                      <div className="flex flex-col sm:flex-row items-center gap-4 bg-teal-950/40 border border-teal-800/40 p-3.5 rounded-xl">
                        {mayaQrCode ? (
                          <div className="relative group w-28 h-28 bg-white p-1.5 rounded-xl border border-teal-400/40 flex-shrink-0">
                            <img src={mayaQrCode} alt="Maya QR Code" className="w-full h-full object-contain rounded-lg" />
                            <button
                              type="button"
                              onClick={() => setMayaQrCode("")}
                              className="absolute -top-2 -right-2 bg-rose-600 text-white p-1 rounded-full hover:bg-rose-700 transition-colors shadow"
                              title="Remove Maya QR Image"
                            >
                              <X size={12} />
                            </button>
                          </div>
                        ) : (
                          <div className="w-28 h-28 bg-slate-950 border border-dashed border-teal-700/60 rounded-xl flex flex-col items-center justify-center text-teal-400 text-center p-2 flex-shrink-0">
                            <ImageIcon size={24} className="opacity-60 mb-1" />
                            <span className="text-[9px] font-bold">No QR Uploaded</span>
                          </div>
                        )}

                        <div className="space-y-1.5 text-left flex-1">
                          <p className="text-xs text-teal-100 font-semibold">
                            {mayaQrCode ? "Maya QR Code image is active." : "Upload your official Maya (PayMaya) QR Code screenshot or image."}
                          </p>
                          <p className="text-[10px] text-teal-300/70 leading-relaxed">
                            Shown to customers selecting Maya as their preferred payment option during checkout.
                          </p>
                          <label className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-teal-600 hover:bg-teal-500 text-white rounded-lg text-xs font-bold cursor-pointer transition-colors shadow-xs">
                            <Upload size={13} /> {mayaQrCode ? "Replace Maya QR Image" : "Upload Maya QR Image"}
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={(e) => handleQrImageUpload(e, setMayaQrCode)}
                            />
                          </label>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 3. Bank Transfer / QR Ph configuration was removed:
                      GCash and Maya are the only supported payment methods. */}

                {/* Save Bar */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 bg-[#faf9f6] border border-[#e5e1da] rounded-2xl">
                  {gcashSaveMsg ? (
                    <span className="text-xs font-bold text-emerald-700 flex items-center gap-1.5">
                      <CheckCircle size={15} /> {gcashSaveMsg}
                    </span>
                  ) : (
                    <span className="text-xs text-[#7c756d]">
                      💡 Changes made here immediately update customer checkout and payment proof upload displays.
                    </span>
                  )}
                  <button
                    type="submit"
                    disabled={savingGcash}
                    className="w-full sm:w-auto px-6 py-2.5 bg-[#2c2a29] hover:bg-[#44403c] text-white rounded-xl font-bold text-xs uppercase tracking-wider cursor-pointer shadow-md transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    <Check size={16} />
                    {savingGcash ? "Saving All Payment Methods..." : "Save All Payment Methods & QR Images"}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* SUB-TAB 6: STUDIO FAQS */}
          {managementSubTab === "faqs" && (
            <div className="space-y-6 pt-2 max-w-2xl">
              <div className="space-y-4 p-5 bg-[#faf9f6] rounded-2xl border border-[#e5e1da]">
                <h4 className="font-extrabold text-xs text-[#2c2a29] uppercase tracking-wider flex items-center gap-1.5">
                  <FileText size={14} className="text-amber-600" /> Studio Frequently Asked Questions
                </h4>

              <form onSubmit={handleStudioFaqSubmit} className="space-y-4">
                <div className="grid sm:grid-cols-2 gap-4 text-xs">
                  <div className="space-y-1.5">
                    <label className="font-bold text-[#2c2a29] block">Question</label>
                    <input
                      value={faqQuestion}
                      onChange={e => setFaqQuestion(e.target.value)}
                      placeholder="How do I secure my booking date?"
                      className="w-full bg-white border border-[#e5e1da] rounded-xl px-3 py-2 focus:outline-none focus:border-[#2c2a29]"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="font-bold text-[#2c2a29] block">Category</label>
                    <select
                      value={faqCategory}
                      onChange={e => setFaqCategory(e.target.value)}
                      className="w-full bg-white border border-[#e5e1da] rounded-xl px-3 py-2 focus:outline-none focus:border-[#2c2a29]"
                    >
                      <option value="General">General</option>
                      <option value="Booking">Booking</option>
                      <option value="Payments">Payments</option>
                      <option value="Policies">Policies</option>
                      <option value="Services">Services</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-1.5 text-xs">
                  <label className="font-bold text-[#2c2a29] block">Answer</label>
                  <textarea
                    value={faqAnswer}
                    onChange={e => setFaqAnswer(e.target.value)}
                    rows={4}
                    placeholder="Write the real answer for your clients."
                    className="w-full bg-white border border-[#e5e1da] rounded-xl px-3 py-2 focus:outline-none focus:border-[#2c2a29]"
                  />
                </div>

                <div className="flex justify-end">
                  <button type="submit" className="px-4 py-2 bg-[#2c2a29] text-white rounded-xl font-bold text-[10px] uppercase tracking-wider cursor-pointer">
                    Save FAQ
                  </button>
                </div>
              </form>

              <div className="space-y-3">
                {faqs.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-[#e5e1da] bg-white p-4 text-center text-xs text-[#7c756d]">
                    No studio FAQs created yet.
                  </div>
                ) : (
                  faqs.map((faq) => (
                    <div key={faq.id} className="rounded-2xl border border-[#e5e1da] bg-white p-3 space-y-2">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-wider text-[#7c756d]">{faq.category || "General"}</p>
                          <h4 className="font-bold text-sm text-[#2c2a29]">{faq.question}</h4>
                        </div>
                        <button
                          type="button"
                          onClick={() => onDeleteFaq?.(faq.id)}
                          className="text-red-600 hover:text-red-800 text-[10px] font-bold uppercase cursor-pointer"
                        >
                          Delete
                        </button>
                      </div>
                      <p className="text-xs text-gray-600 leading-relaxed">{faq.answer}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

          {/* SUB-TAB 2: BRANDING & PROFILE */}
          {managementSubTab === "branding" && (
            <div className="space-y-6 pt-2">
              <form onSubmit={handleSettingsSubmit} className="space-y-6 max-w-2xl text-left">
                {/* 1. Studio Logo & Cover Image Uploads */}
                <div className="space-y-3 p-5 bg-[#faf9f6] rounded-2xl border border-[#e5e1da]">
                  <h4 className="font-extrabold text-xs text-[#2c2a29] uppercase tracking-wider flex items-center gap-1.5">
                    <ImageIcon size={14} className="text-amber-600" /> Studio Branding Photos & Logo
                  </h4>

              <div className="grid sm:grid-cols-2 gap-4">
                {/* Logo Upload */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-[#2c2a29]">Studio Logo Image</label>
                  <div className="flex items-center gap-3">
                    {logo ? (
                      <img src={logo} alt="Logo" className="w-14 h-14 object-cover rounded-xl border border-[#e5e1da] shadow-xs flex-shrink-0" />
                    ) : (
                      <div className="w-14 h-14 bg-gray-200 rounded-xl flex items-center justify-center text-gray-400 font-bold text-xs flex-shrink-0">
                        Logo
                      </div>
                    )}
                    <div className="flex-1 space-y-1">
                      <div className="relative">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={e => handleImageFileUpload(e, setLogo)}
                          className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                        />
                        <button type="button" className="w-full py-2 bg-white border border-[#e5e1da] rounded-xl text-xs font-bold text-gray-700 hover:border-[#2c2a29] transition-colors flex items-center justify-center gap-1">
                          <Upload size={12} /> Upload Logo Photo
                        </button>
                      </div>
                      <input
                        type="text"
                        value={logo}
                        onChange={e => setLogo(e.target.value)}
                        placeholder="Or paste Logo URL"
                        className="w-full bg-white border border-[#e5e1da] rounded-xl px-2.5 py-1 text-[11px] focus:outline-none focus:border-[#2c2a29]"
                      />
                    </div>
                  </div>
                </div>

                {/* Cover Image Upload */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-[#2c2a29]">Studio Header Cover Image</label>
                  <div className="space-y-1">
                    {coverImage && (
                      <img src={coverImage} alt="Cover" className="w-full h-16 object-cover rounded-xl border border-[#e5e1da] shadow-xs" />
                    )}
                    <div className="relative">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={e => handleImageFileUpload(e, setCoverImage)}
                        className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                      />
                      <button type="button" className="w-full py-2 bg-white border border-[#e5e1da] rounded-xl text-xs font-bold text-gray-700 hover:border-[#2c2a29] transition-colors flex items-center justify-center gap-1">
                        <Upload size={12} /> Upload Cover Banner Photo
                      </button>
                    </div>
                    <input
                      type="text"
                      value={coverImage}
                      onChange={e => setCoverImage(e.target.value)}
                      placeholder="Or paste Cover Banner Image URL"
                      className="w-full bg-white border border-[#e5e1da] rounded-xl px-2.5 py-1 text-[11px] focus:outline-none focus:border-[#2c2a29]"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* 2. Studio Location & Categories */}
            <div className="space-y-3 p-4 bg-[#faf9f6] rounded-2xl border border-[#e5e1da]">
              <h4 className="font-extrabold text-xs text-[#2c2a29] uppercase tracking-wider flex items-center gap-1.5">
                <MapPin size={14} className="text-red-500" /> Cainta Location Corridor & Categories
              </h4>

              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-[#2c2a29]">Cainta Location Corridor</label>
                  <select
                    value={location}
                    onChange={e => setLocation(e.target.value)}
                    className="w-full bg-white border border-[#e5e1da] rounded-xl px-3 py-2 text-xs font-bold focus:outline-none focus:border-[#2c2a29]"
                  >
                    <option value="Ortigas Ave Ext (Valley Golf)">Ortigas Ave Ext (Valley Golf)</option>
                    <option value="Felix Ave (Rublou Marketplace)">Felix Ave (Rublou Marketplace)</option>
                    <option value="Imelda Ave / Bypass Junction">Imelda Ave / Bypass Junction</option>
                    <option value="Town Center (San Roque)">Town Center (San Roque)</option>
                    <option value="Vista Verde Village">Vista Verde Village</option>
                    <option value="Cainta, Rizal">Cainta, Rizal (General)</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-[#2c2a29]">Physical Street Address</label>
                  <input
                    type="text"
                    required
                    value={address}
                    onChange={e => setAddress(e.target.value)}
                    placeholder="e.g. Unit 4, Felix Ave Junction, Cainta"
                    className="w-full bg-white border border-[#e5e1da] rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-[#2c2a29]"
                  />
                </div>
              </div>

              {/* GIS Coordinates */}
              <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                <div>
                  <label className="block font-bold text-gray-600 text-[11px] mb-0.5">GPS Latitude</label>
                  <input
                    type="number"
                    step="any"
                    value={latitude}
                    onChange={e => setLatitude(e.target.value)}
                    placeholder="14.5882"
                    className="w-full bg-white border border-[#e5e1da] rounded-xl px-3 py-1.5 text-xs font-mono focus:outline-none focus:border-[#2c2a29]"
                  />
                </div>
                <div>
                  <label className="block font-bold text-gray-600 text-[11px] mb-0.5">GPS Longitude</label>
                  <input
                    type="number"
                    step="any"
                    value={longitude}
                    onChange={e => setLongitude(e.target.value)}
                    placeholder="121.1278"
                    className="w-full bg-white border border-[#e5e1da] rounded-xl px-3 py-1.5 text-xs font-mono focus:outline-none focus:border-[#2c2a29]"
                  />
                </div>
              </div>

              {/* Specialization Categories Buttons */}
              <div className="space-y-1.5 pt-2">
                <label className="block text-xs font-bold text-[#2c2a29]">Studio Category Specializations (Pick 1 or more)</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {[
                    "Portrait Photography", "Graduation Shoots", "Wedding Milestones",
                    "Product Creative", "Self-Shoot Studio", "Family Portrait",
                    "Baby & Milestone", "Event Coverage", "ID/Passport Photography"
                  ].map((catName) => {
                    const checked = selectedCategories.includes(catName);
                    return (
                      <button
                        type="button"
                        key={catName}
                        onClick={() => handleToggleCategory(catName)}
                        className={`p-2 rounded-xl border text-[11px] font-bold transition-all flex items-center justify-between cursor-pointer ${
                          checked
                            ? "bg-[#2c2a29] text-white border-[#2c2a29]"
                            : "bg-white text-gray-700 border-[#e5e1da] hover:border-[#7c756d]"
                        }`}
                      >
                        <span className="truncate">{catName}</span>
                        {checked && <CheckCircle size={12} className="text-yellow-400 flex-shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* 3. Operating Details & Description */}
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-[#2c2a29]">Operating Business Hours</label>
                <input
                  type="text"
                  required
                  value={businessHours}
                  onChange={e => setBusinessHours(e.target.value)}
                  placeholder="e.g. Mon-Sat: 9:00 AM - 7:00 PM"
                  className="w-full bg-[#faf9f6] border border-[#e5e1da] rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:border-[#2c2a29]"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-[#2c2a29]">Contact Phone / Mobile</label>
                <input
                  type="text"
                  required
                  value={contactInfo}
                  onChange={e => setContactInfo(e.target.value)}
                  placeholder="e.g. +63 919 444 5555"
                  className="w-full bg-[#faf9f6] border border-[#e5e1da] rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:border-[#2c2a29]"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-[#2c2a29]">Catalog Starting Price (PHP)</label>
              <input
                type="number"
                required
                value={startingPrice}
                onChange={e => setStartingPrice(Number(e.target.value))}
                className="w-full bg-[#faf9f6] border border-[#e5e1da] rounded-xl px-4 py-2.5 text-xs font-bold text-emerald-800 focus:outline-none focus:border-[#2c2a29]"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-[#2c2a29]">Studio Description Profile</label>
              <textarea
                required
                value={desc}
                onChange={e => setDesc(e.target.value)}
                placeholder="Describe your studio specialty, backdrop choices, studio strobes, equipment, raw files policy..."
                className="w-full bg-[#faf9f6] border border-[#e5e1da] rounded-xl p-3 text-xs focus:outline-none focus:border-[#2c2a29] h-28"
              />
            </div>

            {/* Social Media & Official Website Section */}
            <div className="space-y-4 p-4 bg-[#faf9f6] rounded-2xl border border-[#e5e1da]">
              <h4 className="font-extrabold text-xs text-[#2c2a29] uppercase tracking-wider flex items-center gap-1.5">
                <Globe size={14} className="text-amber-600" /> Official Website & Social Media Presence (Optional)
              </h4>
              <p className="text-[11px] text-gray-500 font-light">Provide your studio's official links so clients can easily find and visit your online pages.</p>

              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-[#2c2a29] flex items-center gap-1">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-600"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"></path></svg>
                    Facebook Page / Profile Link
                  </label>
                  <input
                    type="text"
                    value={facebookUrl}
                    onChange={e => setFacebookUrl(e.target.value)}
                    placeholder="https://facebook.com/yourstudio"
                    className="w-full bg-white border border-[#e5e1da] rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-[#2c2a29]"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-[#2c2a29] flex items-center gap-1">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-pink-600"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line></svg>
                    Instagram Profile Link
                  </label>
                  <input
                    type="text"
                    value={instagramUrl}
                    onChange={e => setInstagramUrl(e.target.value)}
                    placeholder="https://instagram.com/yourstudio"
                    className="w-full bg-white border border-[#e5e1da] rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-[#2c2a29]"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-[#2c2a29] flex items-center gap-1">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-black"><path d="M9 12a4 4 0 1 0 4 4V4a5 5 0 0 0 5 5"></path></svg>
                    TikTok Profile Link
                  </label>
                  <input
                    type="text"
                    value={tiktokUrl}
                    onChange={e => setTiktokUrl(e.target.value)}
                    placeholder="https://tiktok.com/@yourstudio"
                    className="w-full bg-white border border-[#e5e1da] rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-[#2c2a29]"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-[#2c2a29] flex items-center gap-1">
                    <Share2 size={13} className="text-amber-600" /> Other Social Media Link
                  </label>
                  <input
                    type="text"
                    value={otherSocialUrl}
                    onChange={e => setOtherSocialUrl(e.target.value)}
                    placeholder="e.g. Twitter/X, YouTube, or LinkedIn"
                    className="w-full bg-white border border-[#e5e1da] rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-[#2c2a29]"
                  />
                </div>
              </div>

              <div className="space-y-1 pt-1">
                <label className="text-xs font-bold text-[#2c2a29] flex items-center gap-1">
                  <Globe size={13} className="text-emerald-600" /> Official Website URL
                </label>
                <input
                  type="text"
                  value={websiteUrl}
                  onChange={e => setWebsiteUrl(e.target.value)}
                  placeholder="https://www.yourstudio.com"
                  className="w-full bg-white border border-[#e5e1da] rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-[#2c2a29]"
                />
              </div>
            </div>

            <div className="space-y-3">
              <button
                type="submit"
                disabled={savingSettings}
                className="px-6 py-3 bg-[#2c2a29] hover:bg-[#1a1918] text-white text-xs font-bold rounded-xl uppercase tracking-wider flex items-center gap-2 shadow-md cursor-pointer transition-all active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed"
              >
                <Sparkles size={14} className="fill-current text-yellow-500" />
                {savingSettings ? "Saving Studio Profile..." : "Save & Publish Studio Style Profile"}
              </button>

              {saveStatus.type !== "idle" && (
                <div
                  className={`rounded-xl border px-3 py-2 text-[11px] font-medium ${
                    saveStatus.type === "success"
                      ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                      : "bg-red-50 border-red-200 text-red-700"
                  }`}
                >
                  {saveStatus.message}
                </div>
              )}
            </div>
          </form>

          {/* Compliance Documents — separate card outside the main settings form */}
          <div className="space-y-4 p-5 bg-amber-50/60 rounded-2xl border border-amber-200 max-w-2xl">
            <div className="space-y-0.5">
              <h4 className="font-extrabold text-xs text-amber-900 uppercase tracking-wider flex items-center gap-1.5">
                <FileCheck size={14} className="text-amber-600" /> Compliance & Verification Documents
              </h4>
              <p className="text-[11px] text-amber-800 leading-snug">
                Update your business permit, valid ID, or supporting documents here. The Super Admin will be notified to re-review your updated files.
              </p>
            </div>

            {/* Current document status */}
            <div className="grid sm:grid-cols-3 gap-2">
              {[
                { label: "Business Permit", url: studio.businessPermit, icon: FileText },
                { label: "Valid Gov't ID", url: studio.validId, icon: FileText },
                { label: "Other Docs", url: studio.otherDocs, icon: FileText }
              ].map(({ label, url, icon: Icon }) => (
                <div key={label} className={`p-3 rounded-xl border text-[11px] font-bold flex items-center gap-2 ${
                  url ? "bg-green-50 border-green-200 text-green-800" : "bg-white border-dashed border-amber-300 text-gray-400"
                }`}>
                  <Icon size={13} className={url ? "text-green-600" : "text-gray-300"} />
                  <div className="min-w-0">
                    <span className="block truncate">{label}</span>
                    <span className={`text-[10px] font-normal ${url ? "text-green-600" : "text-gray-400"}`}>
                      {url ? "On file ✓" : "Not uploaded"}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Upload form */}
            <form onSubmit={handleDocsSubmit} className="space-y-3">
              {/* Business Permit */}
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-gray-800">
                  DTI / Mayor's Business Permit {!studio.businessPermit && <span className="text-red-600 font-normal">(Not yet uploaded)</span>}
                </label>
                <div className="relative border border-dashed border-amber-300 rounded-xl bg-white p-3 text-center hover:border-amber-500 transition-all cursor-pointer">
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    onChange={e => handleDocFileChange(e, "permit")}
                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                  />
                  <div className="flex items-center justify-center gap-2 pointer-events-none">
                    <Upload size={14} className="text-amber-600" />
                    <span className="text-xs font-bold text-gray-700">
                      {newBusinessPermit ? "Change Business Permit" : studio.businessPermit ? "Replace Business Permit" : "Upload Business Permit"}
                    </span>
                  </div>
                </div>
                {newBusinessPermit && (
                  <div className="bg-green-50 p-2 rounded-lg border border-green-200 flex items-center justify-between">
                    <span className="text-[10px] font-bold text-green-800 flex items-center gap-1"><FileCheck size={12} /> New file ready to upload</span>
                    <button type="button" onClick={() => setNewBusinessPermit("")} className="text-red-500 hover:underline text-[10px] font-bold cursor-pointer">Remove</button>
                  </div>
                )}
              </div>

              {/* Valid ID */}
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-gray-800">
                  Owner Valid Government ID {!studio.validId && <span className="text-red-600 font-normal">(Not yet uploaded)</span>}
                </label>
                <p className="text-[10px] text-gray-500">Driver's License, Passport, UMID, PhilHealth, SSS ID</p>
                <div className="relative border border-dashed border-amber-300 rounded-xl bg-white p-3 text-center hover:border-amber-500 transition-all cursor-pointer">
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    onChange={e => handleDocFileChange(e, "validId")}
                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                  />
                  <div className="flex items-center justify-center gap-2 pointer-events-none">
                    <Upload size={14} className="text-amber-600" />
                    <span className="text-xs font-bold text-gray-700">
                      {newValidId ? "Change Valid ID" : studio.validId ? "Replace Valid ID" : "Upload Valid Government ID"}
                    </span>
                  </div>
                </div>
                {newValidId && (
                  <div className="bg-green-50 p-2 rounded-lg border border-green-200 flex items-center justify-between">
                    <span className="text-[10px] font-bold text-green-800 flex items-center gap-1"><FileCheck size={12} /> New file ready to upload</span>
                    <button type="button" onClick={() => setNewValidId("")} className="text-red-500 hover:underline text-[10px] font-bold cursor-pointer">Remove</button>
                  </div>
                )}
              </div>

              {/* Other Docs */}
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-gray-800">
                  Other Supporting Documents <span className="text-gray-500 font-normal">(BIR, Barangay Clearance, Lease — Optional)</span>
                </label>
                <div className="relative border border-dashed border-amber-300 rounded-xl bg-white p-3 text-center hover:border-amber-500 transition-all cursor-pointer">
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    onChange={e => handleDocFileChange(e, "other")}
                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                  />
                  <div className="flex items-center justify-center gap-2 pointer-events-none">
                    <Upload size={14} className="text-amber-600" />
                    <span className="text-xs font-bold text-gray-700">
                      {newOtherDocs ? "Change Supporting Docs" : studio.otherDocs ? "Replace Supporting Docs" : "Upload BIR, Lease, or Barangay Permit"}
                    </span>
                  </div>
                </div>
                {newOtherDocs && (
                  <div className="bg-green-50 p-2 rounded-lg border border-green-200 flex items-center justify-between">
                    <span className="text-[10px] font-bold text-green-800 flex items-center gap-1"><FileCheck size={12} /> New file ready to upload</span>
                    <button type="button" onClick={() => setNewOtherDocs("")} className="text-red-500 hover:underline text-[10px] font-bold cursor-pointer">Remove</button>
                  </div>
                )}
              </div>

              {docSaveStatus.type !== "idle" && (
                <div className={`rounded-xl border px-3 py-2 text-[11px] font-medium ${
                  docSaveStatus.type === "success"
                    ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                    : "bg-red-50 border-red-200 text-red-700"
                }`}>
                  {docSaveStatus.message}
                </div>
              )}

              <button
                type="submit"
                disabled={savingDocs || (!newBusinessPermit && !newValidId && !newOtherDocs)}
                className="px-5 py-2.5 bg-amber-700 hover:bg-amber-800 text-white text-xs font-bold rounded-xl uppercase tracking-wider flex items-center gap-2 shadow-sm cursor-pointer transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <FileCheck size={13} />
                {savingDocs ? "Uploading Documents..." : "Submit Updated Documents"}
              </button>
            </form>
          </div>
        </div>
      )}

          {/* SUB-TAB 5: AVAILABILITY & CALENDAR */}
          {managementSubTab === "availability" && (
            <div className="space-y-6 pt-2">
              <AvailabilityManager currentUser={currentUser} studio={studio} onRefresh={onRefresh} />

              {/* Section: Blocked Dates Holiday Scheduler */}
              <div className="p-5 bg-[#faf9f6] rounded-2xl border border-[#e5e1da] max-w-xl space-y-4">
                <div className="space-y-1">
                  <h4 className="font-bold text-xs text-[#2c2a29] uppercase tracking-wider">Closed Holidays & Blocked Dates</h4>
                  <p className="text-[11px] text-[#7c756d]">Customers will be blocked from making online scheduler bookings on dates selected here.</p>
                </div>

                <div className="flex gap-2">
                  <input
                    type="date"
                    value={newBlockedDate}
                    onChange={e => setNewBlockedDate(e.target.value)}
                    className="bg-white border border-[#e5e1da] rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-[#2c2a29] flex-1"
                  />
                  <button
                    type="button"
                    onClick={handleBlockDate}
                    className="px-4 py-2 bg-red-600 text-white text-xs font-bold rounded-xl uppercase tracking-wider hover:bg-red-700 cursor-pointer shadow"
                  >
                    Block Date
                  </button>
                </div>

                <div className="flex flex-wrap gap-2 pt-1">
                  {blockedDates.length === 0 ? (
                    <span className="text-[11px] text-gray-400 italic">No blocked dates set. The studio calendar is fully open.</span>
                  ) : (
                    blockedDates.map(dateStr => (
                      <span
                        key={dateStr}
                        className="inline-flex items-center gap-1 text-[11px] font-bold bg-red-50 text-red-800 border border-red-200 px-2 py-1 rounded-lg"
                      >
                        {new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                        <button
                          type="button"
                          onClick={() => handleUnblockDate(dateStr)}
                          className="hover:text-red-900 cursor-pointer ml-1 p-0.5"
                          title="Unblock Date"
                        >
                          <X size={10} />
                        </button>
                      </span>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {/* SUB-TAB 7: OPERATOR ACCOUNT & SECURITY */}
          {managementSubTab === "account" && (
            <div className="space-y-6 pt-2">
              <AccountSettings currentUser={currentUser} onUserUpdated={onRefresh || (() => {})} />
            </div>
          )}
        </div>
      </div>
      )}

      {/* Tab: Payment Proofs Verification Table */}
      {activeTab === "payments" && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-[#e5e1da] p-5 space-y-4 shadow-sm">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
              <div>
                <h3 className="font-display text-lg font-bold text-[#2c2a29]">Studio Payment Proofs & Verification Logs</h3>
                <p className="text-xs text-[#7c756d]">Review customer GCash payment screenshots, reference numbers, and verification history.</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                  <input
                    type="text"
                    placeholder="Search ref #, booking ID, customer…"
                    value={paymentSearch}
                    onChange={e => setPaymentSearch(e.target.value)}
                    className="bg-[#faf9f6] border border-[#e5e1da] rounded-xl pl-9 pr-3 py-2 text-xs w-full sm:w-64 focus:outline-none focus:border-[#2c2a29]"
                  />
                </div>
                <select
                  value={paymentStatusFilter}
                  onChange={e => setPaymentStatusFilter(e.target.value)}
                  className="bg-[#faf9f6] border border-[#e5e1da] rounded-xl px-3 py-2 text-xs font-bold text-[#2c2a29] focus:outline-none cursor-pointer"
                >
                  <option value="All">All Statuses</option>
                  <option value="Pending Verification">Pending Verification</option>
                  <option value="Verified">Verified / Paid</option>
                  <option value="Rejected">Rejected</option>
                </select>
                <select
                  value={paymentTypeFilter}
                  onChange={e => setPaymentTypeFilter(e.target.value)}
                  className="bg-[#faf9f6] border border-[#e5e1da] rounded-xl px-3 py-2 text-xs font-bold text-[#2c2a29] focus:outline-none cursor-pointer"
                >
                  <option value="All">All Types</option>
                  <option value="Downpayment">Downpayment</option>
                  <option value="Balance">Balance</option>
                  <option value="Full Payment">Full Payment</option>
                  <option value="PrintOrder">PrintOrder</option>
                </select>
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto border border-[#e5e1da] rounded-xl">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#faf9f6] border-b border-[#e5e1da] text-[10px] uppercase font-bold text-[#7c756d]">
                  <tr>
                    <th className="py-3 px-4">Ref # / ID</th>
                    <th className="py-3 px-4">Booking / Order</th>
                    <th className="py-3 px-4">Customer</th>
                    <th className="py-3 px-4">Type & Amount</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Rejection Reason</th>
                    <th className="py-3 px-4">Receipt</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {filteredStudioPayments.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-gray-400">
                        No payment proof logs found matching your filters.
                      </td>
                    </tr>
                  ) : (
                    filteredStudioPayments.map((pm: any) => {
                      const bk = bookings.find(b => b.id === pm.bookingId);
                      const isPending = pm.paymentStatus === "Pending Verification";
                      const isVerified = pm.paymentStatus === "Verified" || pm.paymentStatus === "Paid";
                      const isRejected = pm.paymentStatus === "Rejected";
                      return (
                        <tr key={pm.id} className="hover:bg-gray-50/60 transition-colors">
                          <td className="py-3 px-4 font-mono font-bold text-[#2c2a29]">
                            {pm.referenceNumber || pm.id.slice(0, 10)}
                          </td>
                          <td className="py-3 px-4 font-bold text-indigo-700">
                            {pm.bookingId || "—"}
                          </td>
                          <td className="py-3 px-4">
                            <p className="font-bold text-[#2c2a29]">{bk?.customerDetails?.fullName || "Customer"}</p>
                            <p className="text-[10px] text-[#7c756d]">{bk?.customerDetails?.phone || "—"}</p>
                          </td>
                          <td className="py-3 px-4">
                            <span className="font-bold text-[#2c2a29]">₱{Number(pm.amount || 0).toLocaleString()}</span>
                            <span className="block text-[10px] text-[#7c756d]">{pm.paymentType || "Payment"}</span>
                          </td>
                          <td className="py-3 px-4">
                            <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold border uppercase tracking-wider ${
                              isVerified ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                              isPending ? "bg-amber-50 text-amber-700 border-amber-200" :
                              isRejected ? "bg-rose-50 text-rose-700 border-rose-200" :
                              "bg-gray-100 text-gray-600 border-gray-200"
                            }`}>
                              {pm.paymentStatus || "Unpaid"}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-rose-600 text-[11px] font-medium">
                            {pm.rejectionReason || "—"}
                          </td>
                          <td className="py-3 px-4">
                            {pm.proofOfPayment ? (
                              <button
                                type="button"
                                onClick={() => setViewingReceipt({ url: pm.proofOfPayment, ref: pm.referenceNumber || "N/A", amount: Number(pm.amount), method: pm.paymentMethod })}
                                className="inline-flex items-center gap-1 text-blue-600 font-bold hover:underline bg-blue-50 px-2 py-1 rounded border border-blue-200 cursor-pointer"
                              >
                                <Eye size={12} /> View Screenshot
                              </button>
                            ) : (
                              <span className="text-gray-400 italic">No receipt</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right">
                            {isPending && canManageDownpayments && (
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => onUpdateStatus("payment", pm.id, "Verified")}
                                  className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg text-[10px] cursor-pointer"
                                  title="Approve payment"
                                >
                                  ✓ Verify
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const reason = prompt("Enter rejection reason for this payment receipt:") || "Invalid reference number or receipt mismatch";
                                    onUpdateStatus("payment", pm.id, "Rejected");
                                  }}
                                  className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold rounded-lg text-[10px] cursor-pointer"
                                  title="Reject payment"
                                >
                                  ✕ Reject
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab: Studio Reviews (Studio Owner View) */}
      {activeTab === "reviews" && (
        <div className="space-y-4">
          {/* Header */}
          <div className="bg-white rounded-2xl border border-[#e5e1da] p-5 flex items-start justify-between gap-4">
            <div>
              <h3 className="font-display text-lg font-bold text-[#2c2a29]">Customer Reviews</h3>
              <p className="text-xs text-[#7c756d] mt-0.5 max-w-lg">
                View, reply to, and control visibility of reviews on your public studio page.
              </p>
              {studioOwnerReviews.length > 0 && (
                <div className="flex items-center gap-3 mt-2">
                  <span className="flex items-center gap-1 text-xs font-bold text-amber-600">
                    <Star size={13} className="fill-amber-500 text-amber-500" />
                    {(studioOwnerReviews.reduce((s, r) => s + r.rating, 0) / studioOwnerReviews.length).toFixed(1)} avg
                  </span>
                  <span className="text-[10px] text-[#7c756d]">{studioOwnerReviews.length} total · {studioOwnerReviews.filter(r => r.status === "approved").length} approved · {studioOwnerReviews.filter(r => r.isVisible === false).length} hidden</span>
                </div>
              )}
            </div>
            <button onClick={fetchStudioReviews}
              className="flex items-center gap-1.5 px-3 py-2 bg-[#2c2a29] hover:bg-[#44403c] text-white text-xs font-bold rounded-xl cursor-pointer transition-colors flex-shrink-0">
              <RefreshCw size={12} /> Refresh
            </button>
          </div>

          {!reviewsTabLoaded && studioOwnerReviews.length === 0 && (
            <div className="bg-white rounded-2xl border border-[#e5e1da] py-12 text-center">
              <button onClick={fetchStudioReviews} className="text-xs text-amber-600 font-bold underline cursor-pointer hover:no-underline">Load reviews</button>
            </div>
          )}

          {reviewsTabLoaded && studioOwnerReviews.length === 0 && (
            <div className="bg-white rounded-2xl border border-[#e5e1da] py-14 text-center space-y-2">
              <div className="w-12 h-12 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto"><Star size={20} className="text-gray-300" /></div>
              <p className="text-sm font-bold text-[#2c2a29]">No reviews yet</p>
              <p className="text-xs text-[#7c756d]">Completed booking customers can submit reviews — they'll appear here after admin approval.</p>
            </div>
          )}

          <div className="space-y-3">
            {studioOwnerReviews.map((rev) => (
              <div key={rev.id} className={`bg-white rounded-2xl border overflow-hidden transition-shadow hover:shadow-md ${rev.isVisible === false ? "border-gray-200 opacity-75" : "border-[#e5e1da]"}`}>
                {/* Rating accent bar */}
                <div className={`h-1 w-full ${rev.rating >= 4 ? "bg-green-400" : rev.rating === 3 ? "bg-yellow-400" : "bg-rose-400"}`} />

                <div className="p-4 sm:p-5">
                  {/* Reviewer row */}
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-white font-black text-sm flex-shrink-0">
                      {rev.customerName?.[0]?.toUpperCase() || "C"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-0.5">
                        <span className="font-bold text-sm text-[#2c2a29]">{rev.customerName}</span>
                        <div className="flex items-center gap-0.5">
                          {[1,2,3,4,5].map(s => (
                            <Star key={s} size={12} className={s <= rev.rating ? "text-amber-400 fill-amber-400" : "text-gray-200 fill-gray-200"} />
                          ))}
                        </div>
                        <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold uppercase border ${
                          rev.isVisible === false ? "bg-gray-100 text-gray-500 border-gray-200" :
                          rev.status === "approved" ? "bg-green-50 text-green-700 border-green-200" :
                          "bg-amber-50 text-amber-700 border-amber-200"
                        }`}>{rev.isVisible === false ? "Hidden" : rev.status}</span>
                      </div>
                      <p className="text-xs text-[#2c2a29] leading-relaxed">"{rev.comment}"</p>
                      <p className="text-[10px] text-[#7c756d] mt-1">
                        {new Date(rev.createdAt).toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric" })}
                      </p>
                    </div>
                  </div>

                  {/* Existing reply */}
                  {rev.reply && (
                    <div className="mt-3 ml-13 bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 text-xs text-blue-900">
                      <p className="text-[9px] font-bold uppercase tracking-wider text-blue-500 mb-1">Studio Reply</p>
                      <p className="leading-relaxed">{rev.reply}</p>
                      {rev.replyAt && <p className="text-[10px] text-blue-400 mt-1">{new Date(rev.replyAt).toLocaleDateString("en-PH")}</p>}
                    </div>
                  )}

                  {/* Actions + reply form */}
                  <div className="mt-3 pt-3 border-t border-gray-100 space-y-3">
                    <div className="flex flex-wrap gap-2">
                      <button type="button"
                        onClick={async () => {
                          const nextVisible = rev.isVisible !== false;
                          const data = await apiRequest(`/api/studio/reviews/${rev.id}/visibility`, {
                            method: "PUT", body: { studioId: studio.id, visible: !nextVisible }
                          });
                          if (data.success) { setStudioOwnerReviews(prev => prev.map(item => item.id === rev.id ? data.review : item)); onRefresh?.(); }
                        }}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold border cursor-pointer transition-colors ${
                          rev.isVisible === false
                            ? "bg-green-50 hover:bg-green-100 text-green-700 border-green-200"
                            : "bg-gray-50 hover:bg-gray-100 text-gray-600 border-gray-200"
                        }`}>
                        {rev.isVisible === false ? <Eye size={11} /> : <Eye size={11} />}
                        {rev.isVisible === false ? "Show on Public Page" : "Hide from Public Page"}
                      </button>
                    </div>

                    {replySuccess[rev.id] ? (
                      <div className="flex items-center gap-2 text-xs text-green-700 bg-green-50 border border-green-200 rounded-xl px-3 py-2">
                        <Check size={12} /> Reply published successfully!
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <textarea
                          value={replyTexts[rev.id] || ""}
                          onChange={e => setReplyTexts(prev => ({ ...prev, [rev.id]: e.target.value }))}
                          placeholder="Write a professional response to this review…"
                          rows={2}
                          className="w-full bg-[#faf9f6] border border-[#e5e1da] rounded-xl px-3 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-amber-300 resize-none placeholder-gray-400"
                        />
                        <button
                          disabled={!replyTexts[rev.id]?.trim()}
                          onClick={() => {
                            const replyText = replyTexts[rev.id]?.trim();
                            if (!replyText) return;
                            apiRequest(`/api/studio/reviews/${rev.id}/reply`, {
                              method: "PUT", body: { reply: replyText, studioId: studio.id }
                            }).then(d => {
                              if (d.success) {
                                setStudioOwnerReviews(prev => prev.map(r => r.id === rev.id ? d.review : r));
                                onRefresh?.();
                                setReplySuccess(prev => ({ ...prev, [rev.id]: true }));
                                setReplyTexts(prev => ({ ...prev, [rev.id]: "" }));
                                setTimeout(() => setReplySuccess(prev => ({ ...prev, [rev.id]: false })), 3000);
                              }
                            });
                          }}
                          className="flex items-center gap-1.5 px-4 py-2 bg-[#2c2a29] hover:bg-[#44403c] text-white text-xs font-bold rounded-xl cursor-pointer transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          <Check size={12} /> {rev.reply ? "Update Reply" : "Post Reply"}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}


      </div>{/* end main content */}
    </div>{/* end page */}

    {/* Booking Details View Modal */}
    {viewingBooking && (
      <BookingDetailsModal
        booking={viewingBooking}
        studio={studio}
        services={services}
        packages={packages}
        addons={addons}
        onClose={() => setViewingBooking(null)}
      />
    )}

    {proofingBookingId && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-5xl w-full max-h-[90vh] overflow-y-auto p-6 text-left relative shadow-2xl border border-[#e5e1da]">
            <button
              onClick={() => setProofingBookingId(null)}
              className="absolute top-4 right-4 p-2 bg-gray-100 hover:bg-gray-200 text-[#2c2a29] rounded-full cursor-pointer z-10"
              title="Close Portal"
            >
              <X size={20} />
            </button>
            <ClientGallery
              bookingId={proofingBookingId}
              currentUser={currentUser}
              onClose={() => setProofingBookingId(null)}
            />
          </div>
        </div>
      )}

      {/* STUDIO RESCHEDULE MODAL */}
      {reschedulingBooking && (
        <RescheduleModal
          booking={reschedulingBooking}
          studio={studio}
          services={services}
          packages={packages}
          currentUser={currentUser}
          onClose={() => setReschedulingBooking(null)}
          onSuccess={(_updatedBooking, result) => {
            setReschedulingBooking(null);
            onRefresh?.();
            if (!result?.isPendingApproval) {
              window.alert(`Booking rescheduled to ${_updatedBooking?.bookingDate} at ${_updatedBooking?.timeSlot}.`);
            } else {
              window.alert(`Reschedule request submitted — awaiting customer/studio confirmation. Current schedule remains ${_updatedBooking?.bookingDate} at ${_updatedBooking?.timeSlot}.`);
            }
          }}
        />
      )}

      {/* STUDIO PROCESS REFUND MODAL */}
      {refundingPayment && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setRefundingPayment(null)} />
          <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-md border border-[#e5e1da] p-6 space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-purple-100 flex items-center justify-center">
                  <RotateCcw size={18} className="text-purple-700" />
                </div>
                <div>
                  <h3 className="font-display text-base font-bold text-[#2c2a29]">Process Refund</h3>
                  <p className="text-xs text-[#7c756d]">
                    Booking {refundingPayment.booking.id} · Payment {refundingPayment.payment.id}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setRefundingPayment(null)}
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="bg-purple-50 border border-purple-200 rounded-xl p-3 text-xs text-purple-800 space-y-1">
              <p className="font-bold">
                Customer: {refundingPayment.booking.customerDetails?.fullName}
              </p>
              <p>
                Payment: ₱{Number(refundingPayment.payment.amount).toLocaleString("en-PH", { minimumFractionDigits: 2 })} via {refundingPayment.payment.paymentMethod}
              </p>
              <p className="text-purple-600">The customer will be notified by email once the refund is processed.</p>
            </div>

            {/* Partial refund amount */}
            <div>
              <label className="block text-sm font-bold text-[#2c2a29] mb-2">
                Refund Amount <span className="text-xs text-[#7c756d] font-normal">(max ₱{Number(refundingPayment.payment.amount).toLocaleString()})</span>
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-[#7c756d]">₱</span>
                <input
                  type="number"
                  value={refundAmount}
                  onChange={e => { setRefundAmount(e.target.value); setRefundMsg(""); }}
                  min="1"
                  max={refundingPayment.payment.amount}
                  step="0.01"
                  className="w-full border border-[#e5e1da] rounded-xl pl-7 pr-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 text-[#2c2a29]"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold text-[#2c2a29] mb-2">
                Refund Reason <span className="text-rose-500">*</span>
              </label>
              <textarea
                value={refundReason}
                onChange={e => { setRefundReason(e.target.value); setRefundMsg(""); }}
                placeholder="e.g. Booking cancelled by studio, customer request, double payment…"
                rows={3}
                maxLength={400}
                className="w-full border border-[#e5e1da] rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 resize-none text-[#2c2a29] placeholder-gray-400"
              />
            </div>

            {refundMsg && (
              <div className={`flex items-start gap-2 text-xs rounded-xl px-4 py-3 border ${refundMsg.startsWith("✓") ? "bg-emerald-50 border-emerald-200 text-emerald-700" : "bg-rose-50 border-rose-200 text-rose-700"}`}>
                {refundMsg.startsWith("✓") ? <Check size={14} className="mt-0.5 shrink-0" /> : <AlertTriangle size={14} className="mt-0.5 shrink-0" />}
                <span>{refundMsg}</span>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setRefundingPayment(null)}
                className="flex-1 py-2.5 bg-white border border-[#e5e1da] text-[#2c2a29] text-sm font-bold rounded-xl hover:bg-gray-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleProcessRefund}
                disabled={refundLoading || !refundReason.trim() || !!refundMsg.startsWith("✓")}
                className="flex-1 py-2.5 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-bold rounded-xl flex items-center justify-center gap-2 cursor-pointer"
              >
                {refundLoading ? (
                  <><RotateCcw size={14} className="animate-spin" /> Processing…</>
                ) : (
                  <><RotateCcw size={14} /> Confirm Refund</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Receipt Screenshot Lightbox Modal */}
      {viewingReceipt && (
        <div className="fixed inset-0 z-[70] bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl border border-gray-200">
            <div className="p-4 bg-gray-900 text-white flex items-center justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-emerald-400">GCash Payment Receipt Proof</p>
                <p className="text-[11px] text-gray-300">Ref: {viewingReceipt.ref} · ₱{viewingReceipt.amount.toLocaleString()}</p>
              </div>
              <button
                type="button"
                onClick={() => setViewingReceipt(null)}
                className="p-1 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>
            <div className="p-4 bg-gray-100 flex items-center justify-center max-h-[75vh] overflow-auto">
              <img
                src={receiptPreviewUrl || viewingReceipt.url}
                alt="Payment Screenshot"
                className="max-h-[70vh] w-auto rounded-xl object-contain shadow"
              />
            </div>
            <div className="p-3 bg-white flex justify-end gap-2 border-t border-gray-200">
              <button
                type="button"
                onClick={() => setViewingReceipt(null)}
                className="px-4 py-1.5 bg-gray-800 text-white rounded-xl text-xs font-bold cursor-pointer hover:bg-black"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── CASH PAYMENT RECORDING MODAL (Print Order Pickup) ──────────────────── */}
      {cashPaymentModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(6px)" }}
          onClick={(e) => { if (e.target === e.currentTarget) setCashPaymentModal(null); }}
        >
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in-95" style={{ animationDuration: "200ms" }}>
            {/* Header */}
            <div className="bg-gradient-to-r from-emerald-600 to-emerald-700 px-6 py-5 flex items-center justify-between">
              <div>
                <h3 className="text-white font-bold text-base">💵 Record Cash Payment</h3>
                <p className="text-emerald-100 text-xs mt-0.5">Studio Counter Pickup — Cash Collection</p>
              </div>
              <button
                onClick={() => setCashPaymentModal(null)}
                className="w-7 h-7 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white cursor-pointer"
              >
                <X size={14} />
              </button>
            </div>

            {/* Order Summary */}
            <div className="px-6 pt-5 pb-3">
              <div className="bg-[#faf9f6] border border-[#e5e1da] rounded-2xl p-4 space-y-2 text-xs mb-4">
                <div className="flex justify-between">
                  <span className="text-[#7c756d]">Order ID</span>
                  <span className="font-bold text-[#2c2a29] font-mono">{cashPaymentModal.order.id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#7c756d]">Customer</span>
                  <span className="font-bold text-[#2c2a29]">{cashPaymentModal.order.customerName || cashPaymentModal.order.customerId}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#7c756d]">Product</span>
                  <span className="font-bold text-[#2c2a29]">{cashPaymentModal.order.productName || "Photo Print"}</span>
                </div>
                <div className="flex justify-between items-center border-t border-[#e5e1da] pt-2 mt-1">
                  <span className="text-[#2c2a29] font-bold">Amount Due</span>
                  <span className="text-emerald-700 font-extrabold text-sm">₱{Number(cashPaymentModal.order.totalAmount || 0).toLocaleString("en-PH", { minimumFractionDigits: 2 })}</span>
                </div>
              </div>

              {/* Cash Tendered Input */}
              <div className="space-y-1 mb-4">
                <label className="text-xs font-bold text-[#2c2a29] block">Cash Tendered by Customer</label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#7c756d] font-bold text-sm">₱</span>
                  <input
                    id="cash-tendered-input"
                    type="number"
                    min={cashOrderTotal}
                    step="0.01"
                    value={cashTendered}
                    onChange={e => setCashTendered(e.target.value)}
                    className="w-full pl-8 pr-4 py-3 border-2 rounded-xl text-sm font-bold text-[#2c2a29] focus:outline-none focus:border-emerald-500 transition-colors"
                    style={{ borderColor: cashTenderedNum > 0 && !cashChangeValid ? "#ef4444" : cashChangeValid ? "#10b981" : "#e5e1da" }}
                    placeholder={String(cashOrderTotal)}
                    autoFocus
                  />
                </div>
              </div>

              {/* Change calculation */}
              <div className={`rounded-xl p-3.5 mb-5 flex items-center justify-between ${
                cashTenderedNum > 0
                  ? cashChangeValid
                    ? "bg-emerald-50 border border-emerald-200"
                    : "bg-red-50 border border-red-200"
                  : "bg-gray-50 border border-gray-200"
              }`}>
                <span className={`text-xs font-bold ${
                  cashTenderedNum > 0 ? (cashChangeValid ? "text-emerald-700" : "text-red-600") : "text-gray-500"
                }`}>
                  {cashTenderedNum > 0
                    ? cashChangeValid
                      ? cashChange === 0 ? "✓ Exact payment — no change" : "Change to give back:"
                      : "⚠ Cash tendered is less than total due"
                    : "Enter the cash amount received"}
                </span>
                {cashChangeValid && cashChange > 0 && (
                  <span className="text-emerald-700 font-extrabold text-sm">₱{cashChange.toLocaleString("en-PH", { minimumFractionDigits: 2 })}</span>
                )}
              </div>

              {/* Quick amount buttons */}
              <div className="flex flex-wrap gap-1.5 mb-5">
                {[0, 20, 50, 100, 200].map(extra => {
                  const rounded = Math.ceil(cashOrderTotal / 100) * 100 + extra;
                  return (
                    <button
                      key={extra}
                      onClick={() => setCashTendered(String(rounded))}
                      className="px-2.5 py-1 bg-[#f5f3ef] hover:bg-[#e5e1da] border border-[#e5e1da] text-[#2c2a29] text-[10px] font-bold rounded-lg cursor-pointer transition-colors"
                    >
                      ₱{rounded.toLocaleString("en-PH")}
                    </button>
                  );
                })}
              </div>

              {/* Action buttons */}
              <div className="flex gap-2">
                <button
                  onClick={() => setCashPaymentModal(null)}
                  disabled={cashPaymentLoading}
                  className="flex-1 py-2.5 border border-[#e5e1da] text-[#2c2a29] rounded-xl text-xs font-bold cursor-pointer hover:bg-[#faf9f6] transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmCashPayment}
                  disabled={!cashChangeValid || cashPaymentLoading}
                  className="flex-[2] py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-300 text-white rounded-xl text-xs font-bold cursor-pointer transition-colors flex items-center justify-center gap-1.5 shadow-sm"
                >
                  {cashPaymentLoading ? (
                    <><RefreshCw size={12} className="animate-spin" /> Recording…</>
                  ) : (
                    <><Check size={12} /> Confirm & Record Cash Payment</>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
  </>);
}
