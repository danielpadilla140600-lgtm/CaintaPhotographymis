import React, { useState, useEffect, useRef } from "react";
import { apiRequest, resolveApiUrl, ApiError } from "../utils/apiClient.ts";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { configureLeafletDefaultMarkerIcons } from "../utils/leafletConfig";
import { 
  BarChart, Bar, AreaChart, Area, ComposedChart, Line, 
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  PieChart, Pie, Cell, ResponsiveContainer as RechartsResponsiveContainer
} from "recharts";
import { 
  ShieldAlert, ShieldCheck, Check, X, FileText, Plus, RefreshCw, DollarSign,
  Trash2, Users, Briefcase, Calendar, Star, Sparkles, Edit, Download,
  MapPin, Upload, FileUp, Eye, Globe, Settings, FileCheck, CheckCircle, GripVertical,
  Volume2, Music, KeyRound, Radio, Mail, Smartphone, ExternalLink, Copy,
  Search, SlidersHorizontal, AlertTriangle, BadgeCheck, TrendingUp, Filter, Building2, CreditCard,
  LayoutDashboard, BarChart3, PieChart as PieChartIcon
} from "lucide-react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import CustomPageView from "../components/CustomPageView.tsx";
import SuperAdminPaymentView from "../components/SuperAdminPaymentView.tsx";
import SuperAdminReviewView from "../components/SuperAdminReviewView.tsx";
import { CustomAudioPlayer } from "../components/CustomAudioPlayer.tsx";
import { UserRole } from "../db/types.ts";
import AccountSettings from "./AccountSettings.tsx";

export type AdminPrimarySection = "dashboard" | "studios" | "finance" | "management";
export type AdminStudiosSubTab = "pending" | "onboard" | "approved";
export type AdminFinanceSubTab = "payments" | "reviews";
export type AdminManagementSubTab = "users" | "categories" | "cms" | "pages" | "theme" | "modules" | "audio" | "audit" | "account";

export type AdminTab = 
  | AdminPrimarySection 
  | "pending" | "onboard" | "approved" | "users" | "cms" | "theme" | "audio" | "modules" | "pages" | "categories" | "reviews" | "payments" | "audit" | "account" | "settings";

interface AdminDashboardProps {
  studios: any[];
  bookings: any[];
  printOrders: any[];
  payments: any[];
  users: any[];
  categories: any[];
  auditLogs: any[];
  reviews?: any[];
  cms?: { [key: string]: string };
  faqs?: any[];
  faqSuggestions?: any[];
  onApproveFaqSuggestion?: (suggestionId: string) => void;
  onApproveStudio: (studioId: string) => void;
  onRejectStudio: (studioId: string) => void;
  authToken?: string;
  onAddCategory: (categoryName: string, description?: string) => void;
  onUpdateCategory: (categoryId: string, categoryName: string, description?: string) => void;
  onDeleteCategory: (categoryId: string) => void;
  onDeleteUser?: (userId: string) => void;
  onArchiveCustomer?: (customerId: string) => void;
  onUnarchiveCustomer?: (customerId: string) => void;
  onDeleteCustomer?: (customerId: string) => void;
  onArchiveBooking?: (bookingId: string) => void;
  onUnarchiveBooking?: (bookingId: string) => void;
  onDeleteBooking?: (bookingId: string) => void;
  onArchivePrintOrder?: (orderId: string) => void;
  onUnarchivePrintOrder?: (orderId: string) => void;
  onDeletePrintOrder?: (orderId: string) => void;
  onAddFaq?: (payload: { question: string; answer: string; category: string }) => void;
  onDeleteFaq?: (faqId: string) => void;
  onRefresh: () => void;
  activeTab: AdminTab;
  onActiveTabChange: (tab: AdminTab) => void;
  currentUser?: any;
}

export default function AdminDashboard({
  studios,
  bookings,
  printOrders,
  payments,
  users,
  categories,
  auditLogs,
  reviews = [],
  cms,
  faqs = [],
  faqSuggestions = [],
  onApproveFaqSuggestion,
  onApproveStudio,
  onRejectStudio,
  authToken,
  onAddCategory,
  onUpdateCategory,
  onDeleteCategory,
  onDeleteUser,
  onArchiveCustomer,
  onUnarchiveCustomer,
  onDeleteCustomer,
  onArchiveBooking,
  onUnarchiveBooking,
  onDeleteBooking,
  onArchivePrintOrder,
  onUnarchivePrintOrder,
  onDeletePrintOrder,
  onAddFaq,
  onDeleteFaq,
  onRefresh,
  activeTab,
  onActiveTabChange,
  currentUser
}: AdminDashboardProps) {

  const primarySection: AdminPrimarySection = React.useMemo(() => {
    if (activeTab === "dashboard") return "dashboard";
    if (activeTab === "studios" || activeTab === "pending" || activeTab === "onboard" || activeTab === "approved") return "studios";
    if (activeTab === "finance" || activeTab === "payments" || activeTab === "reviews") return "finance";
    if (activeTab === "management" || ["users", "categories", "cms", "pages", "theme", "modules", "audio", "audit", "account", "settings"].includes(activeTab as string)) return "management";
    return "dashboard";
  }, [activeTab]);

  const [studiosSubTab, setStudiosSubTab] = useState<AdminStudiosSubTab>(() => {
    if (activeTab === "onboard") return "onboard";
    if (activeTab === "approved") return "approved";
    return "pending";
  });

  const [financeSubTab, setFinanceSubTab] = useState<AdminFinanceSubTab>(() => {
    if (activeTab === "reviews") return "reviews";
    return "payments";
  });

  const [managementSubTab, setManagementSubTab] = useState<AdminManagementSubTab>(() => {
    if (["users", "categories", "cms", "pages", "theme", "modules", "audio", "audit", "account"].includes(activeTab as string)) {
      return activeTab as AdminManagementSubTab;
    }
    return "users";
  });

  const [systemRevenuePeriod, setSystemRevenuePeriod] = useState<"daily" | "weekly" | "monthly" | "yearly">("monthly");

  // System-wide statistics for Superadmin Dashboard
  const systemStats = React.useMemo(() => {
    const totalStudios = studios.length;
    const activeStudios = studios.filter(s => s.status === "approved").length;
    const totalBookings = bookings.length;
    const completedBookings = bookings.filter(b => b.status === "Completed").length;
    const pendingBookings = bookings.filter(b => b.status === "Pending").length;
    const cancelledBookings = bookings.filter(b => b.status === "Cancelled" || b.status === "Rejected").length;
    
    const verifiedPayments = payments.filter(p => p.paymentStatus === "Paid");
    const totalBookingRevenue = verifiedPayments
      .filter(p => p.paymentType !== "PrintOrder")
      .reduce((sum, p) => sum + Number(p.amount || 0), 0);
      
    const totalPrintRevenue = verifiedPayments
      .filter(p => p.paymentType === "PrintOrder")
      .reduce((sum, p) => sum + Number(p.amount || 0), 0);
      
    const totalSystemRevenue = totalBookingRevenue + totalPrintRevenue;
    
    const totalUsers = users.length;
    const totalCustomers = users.filter(u => u.role === "CUSTOMER").length;

    return {
      totalStudios,
      activeStudios,
      totalBookings,
      completedBookings,
      pendingBookings,
      cancelledBookings,
      totalSystemRevenue,
      totalBookingRevenue,
      totalPrintRevenue,
      totalUsers,
      totalCustomers
    };
  }, [studios, bookings, payments, users]);

  const studioRankings = React.useMemo(() => {
    return studios.map(s => {
      const sBookings = bookings.filter(b => b.studioId === s.id);
      const sPayments = payments.filter(p => p.studioId === s.id && p.paymentStatus === "Paid");
      const revenue = sPayments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
      return {
        id: s.id,
        name: s.name,
        logo: s.logo,
        bookingsCount: sBookings.length,
        revenue
      };
    }).sort((a, b) => b.revenue - a.revenue);
  }, [studios, bookings, payments]);

  // Group verified system revenue by the selected reporting period.
  const systemRevenueData = React.useMemo(() => {
    const now = new Date();
    const periodCount = systemRevenuePeriod === "daily" ? 14 : systemRevenuePeriod === "weekly" ? 12 : systemRevenuePeriod === "yearly" ? 5 : 6;
    const periods = Array.from({ length: periodCount }, (_, index) => {
      const date = new Date(now);
      if (systemRevenuePeriod === "daily") date.setDate(now.getDate() - (periodCount - 1 - index));
      if (systemRevenuePeriod === "weekly") date.setDate(now.getDate() - (periodCount - 1 - index) * 7);
      if (systemRevenuePeriod === "monthly") date.setMonth(now.getMonth() - (periodCount - 1 - index));
      if (systemRevenuePeriod === "yearly") date.setFullYear(now.getFullYear() - (periodCount - 1 - index));
      const periodStart = new Date(date);
      if (systemRevenuePeriod === "weekly") {
        const day = periodStart.getDay() || 7;
        periodStart.setDate(periodStart.getDate() - day + 1);
      }
      periodStart.setHours(0, 0, 0, 0);
      const nextPeriod = new Date(periodStart);
      if (systemRevenuePeriod === "daily") nextPeriod.setDate(nextPeriod.getDate() + 1);
      if (systemRevenuePeriod === "weekly") nextPeriod.setDate(nextPeriod.getDate() + 7);
      if (systemRevenuePeriod === "monthly") nextPeriod.setMonth(nextPeriod.getMonth() + 1);
      if (systemRevenuePeriod === "yearly") nextPeriod.setFullYear(nextPeriod.getFullYear() + 1);
      const label = systemRevenuePeriod === "daily"
        ? periodStart.toLocaleDateString("en-US", { month: "short", day: "numeric" })
        : systemRevenuePeriod === "weekly"
          ? `Week of ${periodStart.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`
          : systemRevenuePeriod === "monthly"
            ? periodStart.toLocaleDateString("en-US", { month: "short", year: "numeric" })
            : String(periodStart.getFullYear());
      return { periodStart, nextPeriod, label };
    });

    const verifiedPayments = payments.filter(p => p.paymentStatus === "Paid");

    return periods.map(({ periodStart, nextPeriod, label }) => {
      const bookingIncome = verifiedPayments.filter(payment => payment.paymentType !== "PrintOrder").reduce((sum, payment) => {
        const paymentDate = new Date(payment.paymentDate || payment.createdAt || Date.now());
        return paymentDate >= periodStart && paymentDate < nextPeriod ? sum + Number(payment.amount || 0) : sum;
      }, 0);

      const printSales = verifiedPayments.filter(payment => payment.paymentType === "PrintOrder").reduce((sum, payment) => {
        const paymentDate = new Date(payment.createdAt || Date.now());
        return paymentDate >= periodStart && paymentDate < nextPeriod ? sum + Number(payment.amount || 0) : sum;
      }, 0);

      return {
        label,
        bookingIncome,
        printSales,
        totalRevenue: bookingIncome + printSales,
      };
    });
  }, [payments, systemRevenuePeriod]);

  // CSV Export function for System-wide data
  const exportSystemReportsToCSV = () => {
    const headers = ["ID", "Studio", "Type", "Customer", "Date", "Status", "Amount (PHP)"];
    const rows = [
      ...bookings.map(b => {
        const s = studios.find(st => st.id === b.studioId);
        return [b.id, s?.name || "—", "Photoshoot Booking", b.customerDetails?.fullName || "—", b.bookingDate, b.status, b.totalAmount];
      }),
      ...printOrders.map(p => {
        const s = studios.find(st => st.id === p.studioId);
        return [p.id, s?.name || "—", "Print Order", p.customerName || "Walk-in", p.createdAt?.split("T")[0] || "—", p.status, p.totalAmount];
      })
    ];
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Cainta_Photography_System_Report_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  useEffect(() => {
    // Reset sub-tabs to their defaults when navigating to the dashboard overview
    if (activeTab === "dashboard") {
      setStudiosSubTab("pending");
      setFinanceSubTab("payments");
      setManagementSubTab("users");
      return;
    }

    if (activeTab === "onboard") setStudiosSubTab("onboard");
    else if (activeTab === "approved") setStudiosSubTab("approved");
    else if (activeTab === "pending" || activeTab === "studios") setStudiosSubTab("pending");
    
    if (activeTab === "reviews") setFinanceSubTab("reviews");
    else if (activeTab === "payments" || activeTab === "finance") setFinanceSubTab("payments");

    if (["users", "categories", "cms", "pages", "theme", "modules", "audio", "audit", "account"].includes(activeTab as string)) {
      setManagementSubTab(activeTab as AdminManagementSubTab);
    }
  }, [activeTab]);

  const [selectedDocPreview, setSelectedDocPreview] = useState<{ title: string; url: string; kind?: "image" | "pdf" } | null>(null);

  const openPaymentProof = async (payment: any) => {
    if (!payment.proofOfPayment) return;
    try {
      const response = await fetch(resolveApiUrl(payment.proofOfPayment), {
        headers: authToken ? { Authorization: `Bearer ${authToken}` } : undefined
      });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.message || "Unable to load payment proof.");
      }
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const kind = blob.type.startsWith("image/") ? "image" : "pdf";
      setSelectedDocPreview({ title: `${payment.id} - Payment Proof`, url: blobUrl, kind });
    } catch (error) {
      alert(error instanceof Error ? error.message : "Unable to load payment proof.");
    }
  };

  const openProtectedDocument = async (url: string, title: string) => {
    try {
      const response = await fetch(resolveApiUrl(url), {
        headers: authToken ? { Authorization: `Bearer ${authToken}` } : undefined
      });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.message || "Unable to load document.");
      }
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const kind = blob.type.startsWith("image/") ? "image" : "pdf";
      setSelectedDocPreview({ title, url: blobUrl, kind });
    } catch (error) {
      alert(error instanceof Error ? error.message : "Unable to load document.");
    }
  };

  // Generic User Creation State
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [userRoleFilter, setUserRoleFilter] = useState<string>("ALL");
  const [newRole, setNewRole] = useState<string>("CUSTOMER");
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("");
  const [newUserFullName, setNewUserFullName] = useState("");
  const [newUserContact, setNewUserContact] = useState("");
  const [newUserAddress, setNewUserAddress] = useState("");
  const [newUserStudioId, setNewUserStudioId] = useState("");
  const [userCreateLoading, setUserCreateLoading] = useState(false);
  const [userCreateMsg, setUserCreateMsg] = useState<{ text: string; type: "success" | "error" } | null>(null);

  const [adminReviews, setAdminReviews] = useState<any[]>([]);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [viewingPayment, setViewingPayment] = useState<any | null>(null);
  const [viewingReview, setViewingReview] = useState<any | null>(null);
  const [newCatName, setNewCatName] = useState("");
  const [newCatDescription, setNewCatDescription] = useState("");
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);

  const loadAdminReviews = async () => {
    if (!authToken) return;
    setReviewsLoading(true);
    try {
      const data = await apiRequest("/api/admin/reviews");
      if (data.success) {
        setAdminReviews(data.reviews || []);
      }
    } catch (err) {
      console.error("Failed to fetch admin reviews:", err);
    } finally {
      setReviewsLoading(false);
    }
  };

  useEffect(() => {
    if ((activeTab === "reviews" || (primarySection === "finance" && financeSubTab === "reviews")) && authToken) {
      loadAdminReviews();
    }
  }, [activeTab, primarySection, financeSubTab, authToken]);

  // System Settings (Theme & UI Config) State
  const [systemSettings, setSystemSettings] = useState({
    primaryColor: "#2c2a29",
    accentColor: "#d97706",
    backgroundColor: "#faf9f6",
    fontFamily: "sans",
    headerStyle: "standard",
    isChatbotEnabled: true,
    isPrintStoreEnabled: true,
    isBookingEnabled: true,
    isMapEnabled: true,
    isSoundEnabled: true,
    customAudioUrl: "",
    customAudioEnabled: true,
    demoVideoUrl: "",
    showDemoVideo: false,
    hiddenNavItems: [] as string[]
  });
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsSuccess, setSettingsSuccess] = useState(false);
  const [settingsError, setSettingsError] = useState("");

  // SMTP Email Notifications Test State
  const [smtpStatus, setSmtpStatus] = useState<{ isConfigured: boolean; senderEmail: string; service: string } | null>(null);
  const [testEmailInput, setTestEmailInput] = useState("");
  const [sendingTestEmail, setSendingTestEmail] = useState(false);
  const [testEmailResult, setTestEmailResult] = useState<{ success: boolean; message: string } | null>(null);

  // LAN Wi-Fi Network Access State
  const [networkInfo, setNetworkInfo] = useState<{ localUrl: string; networkUrl: string; ipAddress: string } | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  // Custom Pages Builder State
  const [customPages, setCustomPages] = useState<any[]>([]);
  const [faqQuestion, setFaqQuestion] = useState("");
  const [faqAnswer, setFaqAnswer] = useState("");
  const [faqCategory, setFaqCategory] = useState("General");
  const [isEditingPage, setIsEditingPage] = useState(false);
  const [isPreviewingPage, setIsPreviewingPage] = useState(false);
  const [currentPageForm, setCurrentPageForm] = useState({
    id: "",
    createdAt: "",
    title: "",
    slug: "",
    isPublished: true,
    showInNavbar: true,
    blocks: [] as any[]
  });

  const handleFaqSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!faqQuestion.trim() || !faqAnswer.trim()) return;
    onAddFaq?.({ question: faqQuestion.trim(), answer: faqAnswer.trim(), category: faqCategory.trim() || "General" });
    setFaqQuestion("");
    setFaqAnswer("");
    setFaqCategory("General");
  };

  const handleDragEnd = (result: any) => {
    if (!result.destination) return;
    const items = Array.from(currentPageForm.blocks);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);
    setCurrentPageForm({ ...currentPageForm, blocks: items });
  };

  useEffect(() => {
    fetchSettingsAndPages();
  }, []);

  const fetchSettingsAndPages = async () => {
    try {
      const dSet = await apiRequest("/api/admin/settings").catch(() => null);
      if (dSet?.success) setSystemSettings(dSet.settings);

      const dPages = await apiRequest("/api/custom-pages").catch(() => null);
      if (dPages?.success) setCustomPages(dPages.pages);

      const dSmtp = await apiRequest("/api/admin/smtp-status").catch(() => null);
      if (dSmtp?.success) {
        setSmtpStatus(dSmtp);
        if (dSmtp.senderEmail && dSmtp.senderEmail !== "Not configured") {
          setTestEmailInput(dSmtp.senderEmail);
        }
      }

      const dNet = await apiRequest("/api/system/network-info").catch(() => null);
      if (dNet?.success) setNetworkInfo(dNet);
    } catch (e) {
      console.error("Failed to load settings or pages", e);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    setSettingsSuccess(false);
    setSettingsError("");
    try {
      const d = await apiRequest("/api/admin/settings", { method: "POST", body: systemSettings });
      if (d.success) {
        setSystemSettings(d.settings);
        setSettingsSuccess(true);
        setTimeout(() => setSettingsSuccess(false), 3000);
        onRefresh();
      } else {
        setSettingsError(d.message || "Failed to save system settings.");
      }
    } catch (err) {
      setSettingsError(err instanceof ApiError ? err.message : "Failed to save system settings.");
    } finally {
      setSavingSettings(false);
    }
  };

  const handleSavePageForm = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const url = currentPageForm.id ? `/api/custom-pages/${currentPageForm.id}` : "/api/custom-pages";
      const method = currentPageForm.id ? "PUT" : "POST";
      const d = await apiRequest(url, { method, body: currentPageForm });
      if (d.success) {
        setIsEditingPage(false);
        fetchSettingsAndPages();
        onRefresh();
      } else {
        alert(d.message || "Failed to save custom page.");
      }
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "Error saving custom page.");
    }
  };

  const handleDeletePage = async (pageId: string) => {
    if (!confirm("Are you sure you want to delete this custom page?")) return;
    try {
      const d = await apiRequest(`/api/custom-pages/${pageId}`, { method: "DELETE" });
      if (d.success) {
        fetchSettingsAndPages();
        onRefresh();
      }
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "Failed to delete page.");
    }
  };

  const handleAddBlockToPage = (type: string) => {
    const newBlock = {
      id: `block-${Date.now()}`,
      type,
      title: "New Block Title",
      content: "Enter block content or description here.",
      imageUrl: "https://images.unsplash.com/photo-1542038784456-1ea8e935640e?w=800&fit=crop",
      buttonText: type === "hero" || type === "cta" ? "Learn More" : undefined,
      buttonLink: type === "hero" || type === "cta" ? "directory" : undefined,
      items: type === "gallery" || type === "faq" || type === "pricing" ? [
        { title: "Item 1", description: "Description 1", price: "₱1,500", image: "https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=600&fit=crop" }
      ] : undefined
    };
    setCurrentPageForm({
      ...currentPageForm,
      blocks: [...currentPageForm.blocks, newBlock]
    });
  };

  const handleRemoveBlock = (blockId: string) => {
    setCurrentPageForm({
      ...currentPageForm,
      blocks: currentPageForm.blocks.filter((b: any) => b.id !== blockId)
    });
  };

  // CMS Editor State
  const [heroTitle, setHeroTitle] = useState("");
  const [heroSubtitle, setHeroSubtitle] = useState("");
  const [heroBackground, setHeroBackground] = useState("");
  const [aboutTitle, setAboutTitle] = useState("");
  const [aboutDescription, setAboutDescription] = useState("");
  const [savingCms, setSavingCms] = useState(false);
  const [uploadingHeroBackground, setUploadingHeroBackground] = useState(false);
  const [cmsSuccess, setCmsSuccess] = useState(false);

  // Onboard Studio Owner State
  const [ownerName, setOwnerName] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [ownerPassword, setOwnerPassword] = useState("");
  const [ownerContact, setOwnerContact] = useState("");
  const [ownerAddress, setOwnerAddress] = useState("");

  const [studioName, setStudioName] = useState("");
  const [studioDescription, setStudioDescription] = useState("");
  const [studioAddress, setStudioAddress] = useState("");
  const [studioLocation, setStudioLocation] = useState("Ortigas Ave Ext (Valley Golf)");
  const [startingPrice, setStartingPrice] = useState("1200");
  const [businessHours, setBusinessHours] = useState("09:00 AM - 06:00 PM");
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  
  const [latitude, setLatitude] = useState(14.5882);
  const [longitude, setLongitude] = useState(121.1278);
  const [businessPermit, setBusinessPermit] = useState("");
  const [validId, setValidId] = useState("");
  const [otherDocs, setOtherDocs] = useState("");

  const [onboardLoading, setOnboardLoading] = useState(false);
  const [onboardError, setOnboardError] = useState("");
  const [onboardSuccess, setOnboardSuccess] = useState(false);

  // Map Refs for Picker Map
  const pickMapContainerRef = useRef<HTMLDivElement>(null);
  const pickMapRef = useRef<L.Map | null>(null);
  const pickMarkerRef = useRef<L.Marker | null>(null);

  const pendingStudios = studios.filter(s => !s.isApproved || s.status === "pending");
  const approvedStudios = studios.filter(s => s.isApproved || s.status === "approved");

  // Sync CMS values from prop
  useEffect(() => {
    if (cms) {
      setHeroTitle(cms.heroTitle || "Frame Your Story. <br /> Book Cainta Studios.");
      setHeroSubtitle(cms.heroSubtitle || "Discover accredited photography studios in Cainta, Rizal...");
      setHeroBackground(cms.heroBackground || "https://images.unsplash.com/photo-1492691527719-9d1e07e534b4?w=1800&fit=crop");
      setAboutTitle(cms.aboutTitle || "Pristine Studio Lighting & Retouching");
      setAboutDescription(cms.aboutDescription || "Experience the difference of calibrated Profoto strobes...");
    }
  }, [cms]);

  // Picker Map Initialization Effect
  useEffect(() => {
    if ((primarySection !== "studios" || studiosSubTab !== "onboard") && activeTab !== "onboard") return;
    if (!pickMapContainerRef.current) return;

    configureLeafletDefaultMarkerIcons();

    if (pickMapRef.current) {
      pickMapRef.current.remove();
      pickMapRef.current = null;
    }

    try {
      const map = L.map(pickMapContainerRef.current, {
        center: [latitude || 14.5882, longitude || 121.1278],
        zoom: 13.5,
        zoomControl: true,
        attributionControl: false
      });

      // Primary: CARTO Positron — free, no API key, CORS-friendly
      const cartoLayer = L.tileLayer(
        "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
        {
          subdomains: "abcd",
          maxZoom: 20,
          minZoom: 10,
          attribution: "&copy; <a href='https://www.openstreetmap.org/copyright'>OpenStreetMap</a> contributors &copy; <a href='https://carto.com/attributions'>CARTO</a>",
          crossOrigin: "anonymous"
        }
      );
      // Fallback: ESRI World Street Map
      const esriLayer = L.tileLayer(
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}",
        {
          maxZoom: 20,
          minZoom: 10,
          attribution: "Tiles &copy; Esri",
          crossOrigin: "anonymous"
        }
      );
      cartoLayer.addTo(map);
      cartoLayer.on("tileerror", () => {
        if (map.hasLayer(cartoLayer)) map.removeLayer(cartoLayer);
        if (!map.hasLayer(esriLayer)) esriLayer.addTo(map);
      });
      const marker = L.marker([latitude || 14.5882, longitude || 121.1278], { draggable: true }).addTo(map);
      marker.bindTooltip("Drag me or click map to pick coordinates!", { permanent: true, direction: "top" });

      marker.on("dragend", () => {
        const pos = marker.getLatLng();
        setLatitude(Number(pos.lat.toFixed(6)));
        setLongitude(Number(pos.lng.toFixed(6)));
      });

      map.on("click", (e: L.LeafletMouseEvent) => {
        marker.setLatLng(e.latlng);
        setLatitude(Number(e.latlng.lat.toFixed(6)));
        setLongitude(Number(e.latlng.lng.toFixed(6)));
      });

      pickMapRef.current = map;
      pickMarkerRef.current = marker;

      setTimeout(() => {
        map.invalidateSize();
      }, 300);
    } catch (err) {
      console.error("Map creation error:", err);
    }

    return () => {
      if (pickMapRef.current) {
        pickMapRef.current.remove();
        pickMapRef.current = null;
        pickMarkerRef.current = null;
      }
    };
  }, [primarySection, studiosSubTab, activeTab]);

  const handleCategorySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName.trim()) return;
    if (editingCategoryId) {
      onUpdateCategory(editingCategoryId, newCatName.trim(), newCatDescription.trim());
    } else {
      onAddCategory(newCatName.trim(), newCatDescription.trim());
    }
    setNewCatName("");
    setNewCatDescription("");
    setEditingCategoryId(null);
  };

  const handleEditCategory = (category: any) => {
    setEditingCategoryId(category.id);
    setNewCatName(category.name || "");
    setNewCatDescription(category.description || "");
  };

  const handleCMSSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingCms(true);
    setCmsSuccess(false);

    try {
      const data = await apiRequest("/api/cms", {
        method: "POST",
        body: {
          heroTitle,
          heroSubtitle,
          heroBackground,
          aboutTitle,
          aboutDescription
        }
      });
      if (data.success) {
        setCmsSuccess(true);
        setTimeout(() => setCmsSuccess(false), 4000);
        onRefresh();
      } else {
        alert("CMS update error: " + data.message);
      }
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "Failed to communicate with CMS api.");
    } finally {
      setSavingCms(false);
    }
  };

  const parseApiResponse = async (response: Response) => {
    const text = await response.text();
    if (!text) return { success: response.ok, message: response.statusText || "No response body." };
    try {
      return JSON.parse(text);
    } catch {
      throw new Error(`Server returned an unexpected response. (${response.status})`);
    }
  };

  const handleHeroBackgroundUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      alert("Please select an image file.");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      alert("The image must be 8 MB or smaller.");
      return;
    }

    const reader = new FileReader();
    reader.onload = async () => {
      setUploadingHeroBackground(true);
      try {
        const data = await apiRequest("/api/media", {
          method: "POST",
          body: {
            entityType: "cms",
            entityId: "heroBackground",
            purpose: "HERO_BACKGROUND",
            fileData: reader.result,
            originalName: file.name
          }
        });
        setHeroBackground(data.url);
      } catch (err: any) {
        alert(err?.message || "The image upload failed.");
      } finally {
        setUploadingHeroBackground(false);
      }
    };
    reader.onerror = () => alert("The image could not be read from your device.");
    reader.readAsDataURL(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, type: "permit" | "validId" | "other") => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      if (type === "permit") {
        setBusinessPermit(reader.result as string);
      } else if (type === "validId") {
        setValidId(reader.result as string);
      } else {
        setOtherDocs(reader.result as string);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleToggleCategory = (catName: string) => {
    if (selectedCategories.includes(catName)) {
      setSelectedCategories(selectedCategories.filter(c => c !== catName));
    } else {
      setSelectedCategories([...selectedCategories, catName]);
    }
  };

  const handleCreateUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setUserCreateLoading(true);
    setUserCreateMsg(null);
    try {
      const data = await apiRequest("/api/admin/create-user", {
        method: "POST",
        body: {
          email: newUserEmail,
          password: newUserPassword,
          fullName: newUserFullName,
          contactNumber: newUserContact,
          address: newUserAddress,
          role: newRole,
          studioId: newUserStudioId || undefined
        }
      });
      if (data.success) {
        setUserCreateMsg({ text: data.message || "User account created successfully!", type: "success" });
        setNewUserEmail("");
        setNewUserPassword("");
        setNewUserFullName("");
        setNewUserContact("");
        setNewUserAddress("");
        onRefresh();
      } else {
        setUserCreateMsg({ text: data.message || "Failed to create user account.", type: "error" });
      }
    } catch (err) {
      setUserCreateMsg({ text: err instanceof ApiError ? err.message : "Failed to connect to backend server.", type: "error" });
    } finally {
      setUserCreateLoading(false);
    }
  };

  const handleUserStatusChange = async (userId: string, status: "approved" | "rejected" | "suspended") => {
    try {
      const data = await apiRequest(`/api/admin/users/${userId}/status`, {
        method: "PUT",
        body: { status }
      });
      if (data.success) onRefresh();
      else alert(data.message || "Failed to update user status.");
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "Failed to connect to the server.");
    }
  };

  const handleDeleteUserAccount = (user: any) => {
    if (!user || user.role === "SUPER_ADMIN") return;
    onDeleteUser?.(user.id);
  };

  const handleOnboardSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setOnboardLoading(true);
    setOnboardError("");
    setOnboardSuccess(false);

    if (selectedCategories.length === 0) {
      setOnboardError("Please select at least one photography special category.");
      setOnboardLoading(false);
      return;
    }

    try {
      const data = await apiRequest("/api/admin/register-studio", {
        method: "POST",
        body: {
          email: ownerEmail,
          password: ownerPassword,
          fullName: ownerName,
          contactNumber: ownerContact,
          userAddress: ownerAddress,
          studioName,
          description: studioDescription,
          categories: selectedCategories,
          startingPrice: Number(startingPrice),
          businessHours,
          address: studioAddress,
          location: studioLocation,
          latitude,
          longitude,
          businessPermit,
          validId,
          otherDocs
        }
      });
      if (data.success) {
        setOnboardSuccess(true);
        setOwnerName("");
        setOwnerEmail("");
        setOwnerPassword("");
        setOwnerContact("");
        setOwnerAddress("");
        setStudioName("");
        setStudioDescription("");
        setStudioAddress("");
        setSelectedCategories([]);
        setBusinessPermit("");
        setValidId("");
        setOtherDocs("");
        onRefresh();
      } else {
        setOnboardError(data.message || "Onboarding failed.");
      }
    } catch (err) {
      setOnboardError(err instanceof ApiError ? err.message : "Failed to register studio. Connectivity issue.");
    } finally {
      setOnboardLoading(false);
    }
  };

  // ── extra UI state ────────────────────────────────────────────────────────
  const [userSearch, setUserSearch] = React.useState("");
  const [paymentSearch, setPaymentSearch] = React.useState("");
  const [studioSearch, setStudioSearch] = React.useState("");

  // ── archive/delete UI state ───────────────────────────────────────────────
  const [showArchivedCustomers, setShowArchivedCustomers] = React.useState(false);
  const [showArchivedBookings, setShowArchivedBookings] = React.useState(false);
  const [showArchivedPrintOrders, setShowArchivedPrintOrders] = React.useState(false);
  const [bookingSearch, setBookingSearch] = React.useState("");
  const [bookingStatusFilter, setBookingStatusFilter] = React.useState("All");
  const [printOrderSearch, setPrintOrderSearch] = React.useState("");
  const [printOrderStatusFilter, setPrintOrderStatusFilter] = React.useState("All");

  const verifiedPaymentsTotal = systemStats.totalSystemRevenue;

  const pendingPaymentsCount = payments.filter(p => p.paymentStatus === "Pending Verification").length;

  return (<>
    <div className="min-h-screen bg-[#f5f3ef] text-left pb-20">

      {/* ── PAGE HEADER ─────────────────────────────────────────────────────── */}
      <div className="bg-white border-b border-[#e5e1da]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#2c2a29] to-[#4a4644] flex items-center justify-center flex-shrink-0 shadow-md">
                <ShieldCheck size={22} className="text-yellow-400" />
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-widest text-amber-600 font-bold mb-0.5">Super Admin Portal</p>
                <h1 className="font-display text-xl sm:text-2xl font-black text-[#2c2a29] leading-none">Admin Control Center</h1>
                <p className="text-xs text-[#7c756d] mt-0.5">Cainta Photography Studio Network</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 text-xs text-emerald-700 font-bold bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-full">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /> All systems live
              </span>
              <button type="button" onClick={onRefresh}
                className="flex items-center gap-2 px-4 py-2 bg-[#2c2a29] hover:bg-black text-white text-xs font-bold rounded-xl cursor-pointer shadow-sm transition-colors">
                <RefreshCw size={13} /> Refresh
              </button>
            </div>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
            {[
              {
                label: "Pending Approvals",
                value: pendingStudios.length,
                sub: pendingStudios.length > 0 ? "Action required" : "All clear",
                icon: <ShieldAlert size={15} />,
                color: pendingStudios.length > 0 ? "text-amber-700" : "text-green-700",
                bg: pendingStudios.length > 0 ? "bg-amber-50" : "bg-green-50",
                badge: pendingStudios.length > 0 ? pendingStudios.length : null,
                onClick: () => { setStudiosSubTab("pending"); onActiveTabChange("pending"); }
              },
              {
                label: "Verified Studios",
                value: approvedStudios.length,
                sub: "Listed & active",
                icon: <ShieldCheck size={15} />,
                color: "text-blue-700",
                bg: "bg-blue-50",
                onClick: () => { setStudiosSubTab("approved"); onActiveTabChange("approved"); }
              },
              {
                label: "Unverified Payments",
                value: pendingPaymentsCount,
                sub: pendingPaymentsCount > 0 ? "Needs verification" : "Finances clear",
                icon: <DollarSign size={15} />,
                color: pendingPaymentsCount > 0 ? "text-rose-700" : "text-emerald-700",
                bg: pendingPaymentsCount > 0 ? "bg-rose-50" : "bg-emerald-50",
                badge: pendingPaymentsCount > 0 ? pendingPaymentsCount : null,
                onClick: () => { setFinanceSubTab("payments"); onActiveTabChange("payments"); }
              },
              {
                label: "User Accounts",
                value: users.length,
                sub: `${users.filter(u => u.role === "CUSTOMER").length} customers`,
                icon: <Users size={15} />,
                color: "text-purple-700",
                bg: "bg-purple-50",
                onClick: () => { setManagementSubTab("users"); onActiveTabChange("users"); }
              },
            ].map(stat => (
              <div
                key={stat.label}
                onClick={(stat as any).onClick}
                className={`bg-[#faf9f6] border border-[#e5e1da] rounded-2xl p-3.5 flex items-center gap-3 relative overflow-hidden transition-shadow ${(stat as any).onClick ? "cursor-pointer hover:shadow-md hover:border-amber-300" : ""}`}
              >
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

          {/* Primary Navigation Tabs */}
          <div className="flex gap-2 mt-6 overflow-x-auto pb-1 scrollbar-hide">
            {[
              { id: "dashboard", label: "Overview", icon: LayoutDashboard },
              { id: "studios", label: "Studio Partners", icon: Building2 },
              { id: "finance", label: "Finance & Ledger", icon: CreditCard },
              { id: "management", label: "System Setup", icon: Settings },
            ].map((tab) => {
              const Icon = tab.icon;
              const isSelected = primarySection === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => onActiveTabChange(tab.id as any)}
                  className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all whitespace-nowrap cursor-pointer ${
                    isSelected 
                      ? "bg-[#2c2a29] text-white shadow-lg shadow-black/10 scale-[1.02]" 
                      : "bg-white text-[#7c756d] hover:bg-gray-50 hover:text-[#2c2a29] border border-[#e5e1da]"
                  }`}
                >
                  <Icon size={16} className={isSelected ? "text-yellow-400" : ""} />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── MAIN CONTENT ──────────────────────────────────────────────────── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-5">

        {/* 3. WORKSPACE SECTION WORKFLOWS */}
        
        {/* ─── SECTION 0: SYSTEM-WIDE DASHBOARD OVERVIEW ─── */}
        {(primarySection === "dashboard") && (
          <div className="space-y-6">
            {/* Top Bar / Header */}
            <div className="bg-white rounded-3xl border border-[#e5e1da] p-6 shadow-sm space-y-4">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-[#e5e1da] pb-5">
                <div>
                  <span className="inline-flex items-center gap-1.5 bg-indigo-50 text-indigo-800 border border-indigo-200 px-3 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider mb-2">
                    <ShieldCheck size={12} /> System Administrator Intelligence
                  </span>
                  <h3 className="font-display text-2xl font-extrabold text-[#2c2a29]">System Overview Dashboard</h3>
                  <p className="text-xs text-[#7c756d] mt-0.5">Real-time performance metrics aggregated across all photography studio partners.</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="bg-[#faf9f6] p-1 rounded-xl border border-[#e5e1da] flex items-center">
                    {(["daily", "weekly", "monthly", "yearly"] as const).map(p => (
                      <button key={p} onClick={() => setSystemRevenuePeriod(p)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer capitalize ${systemRevenuePeriod === p ? "bg-[#2c2a29] text-white shadow-sm" : "text-[#7c756d] hover:text-[#2c2a29]"}`}>
                        {p}
                      </button>
                    ))}
                  </div>

                  <button onClick={exportSystemReportsToCSV}
                    className="flex items-center gap-1.5 px-3.5 py-2 bg-[#2c2a29] hover:bg-black text-white text-xs font-bold rounded-xl cursor-pointer transition-colors shadow-sm">
                    <Download size={13} /> Export System CSV
                  </button>

                  <button onClick={onRefresh}
                    className="flex items-center gap-1.5 px-3.5 py-2 bg-white border border-[#e5e1da] hover:bg-gray-50 text-[#2c2a29] text-xs font-bold rounded-xl cursor-pointer transition-colors shadow-sm">
                    <RefreshCw size={13} /> Refresh Data
                  </button>
                </div>
              </div>

              {/* KPI Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-2">
                {[
                  { label: "Partner Studios", value: systemStats.totalStudios, sub: `${systemStats.activeStudios} verified active`, icon: <Building2 size={16} className="text-blue-600" /> },
                  { label: "System Revenue", value: `₱${systemStats.totalSystemRevenue.toLocaleString()}`, sub: `₱${systemStats.totalBookingRevenue.toLocaleString()} from bookings`, icon: <DollarSign size={16} className="text-emerald-600" /> },
                  { label: "Total Bookings", value: systemStats.totalBookings, sub: `${systemStats.completedBookings} fulfilled sessions`, icon: <Calendar size={16} className="text-amber-600" /> },
                  { label: "Platform Users", value: systemStats.totalUsers, sub: `${systemStats.totalCustomers} registered customers`, icon: <Users size={16} className="text-indigo-600" /> },
                ].map((kpi, idx) => (
                  <div key={idx} className="bg-[#faf9f6] border border-[#e5e1da] p-5 rounded-2xl flex flex-col justify-between hover:shadow-md transition-all group">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-[10px] font-extrabold uppercase tracking-wider text-[#7c756d]">{kpi.label}</p>
                      <div className="w-8 h-8 rounded-xl bg-white border border-[#e5e1da] flex items-center justify-center shadow-xs group-hover:scale-110 transition-transform">
                        {kpi.icon}
                      </div>
                    </div>
                    <div>
                      <p className="text-2xl font-black text-[#2c2a29]">{kpi.value}</p>
                      <p className="text-[10px] font-bold text-gray-500 mt-1">{kpi.sub}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Trends and Studio Performance */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* System Revenue Trend (2 cols) */}
              <div className="lg:col-span-2 bg-white rounded-3xl border border-[#e5e1da] p-6 shadow-sm space-y-5">
                <div className="flex items-center justify-between border-b border-[#e5e1da] pb-4">
                  <div>
                    <h4 className="font-display font-black text-base text-[#2c2a29]">Aggregated System Revenue</h4>
                    <p className="text-xs text-[#7c756d]">Gross platform volume by {systemRevenuePeriod}</p>
                  </div>
                  <TrendingUp size={18} className="text-emerald-500" />
                </div>
                
                <div className="h-72 w-full">
                  <RechartsResponsiveContainer width="100%" height="100%">
                    <AreaChart data={systemRevenueData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#2c2a29" stopOpacity={0.8}/>
                          <stop offset="95%" stopColor="#2c2a29" stopOpacity={0.1}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e1da" vertical={false} />
                      <XAxis dataKey="label" stroke="#7c756d" fontSize={11} tickLine={false} axisLine={false} />
                      <YAxis stroke="#7c756d" fontSize={11} tickFormatter={(val) => `₱${val / 1000}k`} tickLine={false} axisLine={false} />
                      <Tooltip content={({ active, payload, label }: any) => {
                        if (active && payload && payload.length) {
                          return (
                            <div className="bg-[#2c2a29] text-white p-3 rounded-xl shadow-xl text-xs space-y-1.5 border border-[#4a4644]">
                              <p className="font-bold text-amber-300 text-[11px]">{label}</p>
                              <div className="flex justify-between gap-4">
                                <span className="text-gray-300">Total Revenue:</span>
                                <span className="font-bold font-mono">₱{Number(payload[0].value).toLocaleString()}</span>
                              </div>
                            </div>
                          );
                        }
                        return null;
                      }} />
                      <Area type="monotone" dataKey="totalRevenue" name="Total Revenue" stroke="#2c2a29" fillOpacity={1} fill="url(#colorTotal)" />
                    </AreaChart>
                  </RechartsResponsiveContainer>
                </div>
              </div>

              {/* Status Distribution (1 col) */}
              <div className="bg-white rounded-3xl border border-[#e5e1da] p-6 shadow-sm space-y-5">
                <div className="flex items-center justify-between border-b border-[#e5e1da] pb-4">
                  <h4 className="font-display font-black text-base text-[#2c2a29]">Fulfillment Breakdown</h4>
                  <PieChartIcon size={18} className="text-indigo-500" />
                </div>
                
                <div className="h-52 w-full">
                  <RechartsResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={[
                          { name: "Completed", value: systemStats.completedBookings, color: "#10b981" },
                          { name: "Pending", value: systemStats.pendingBookings, color: "#f59e0b" },
                          { name: "Cancelled", value: systemStats.cancelledBookings, color: "#f43f5e" },
                          { name: "Others", value: systemStats.totalBookings - systemStats.completedBookings - systemStats.pendingBookings - systemStats.cancelledBookings, color: "#6366f1" }
                        ].filter(i => i.value > 0)}
                        cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={5} dataKey="value"
                      >
                        {[0, 1, 2, 3].map((_, index) => (
                          <Cell key={`cell-${index}`} fill={["#10b981", "#f59e0b", "#f43f5e", "#6366f1"][index]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </RechartsResponsiveContainer>
                </div>

                <div className="space-y-2 pt-2 border-t border-gray-50">
                  <div className="flex items-center justify-between text-[11px] font-bold">
                    <span className="flex items-center gap-2 text-emerald-700">
                      <span className="w-2 h-2 rounded-full bg-emerald-500" />
                      Fulfillment Rate
                    </span>
                    <span>{systemStats.totalBookings > 0 ? Math.round((systemStats.completedBookings / systemStats.totalBookings) * 100) : 0}%</span>
                  </div>
                  <div className="w-full bg-gray-100 h-1.5 rounded-full overflow-hidden">
                    <div className="bg-emerald-500 h-full" style={{ width: `${systemStats.totalBookings > 0 ? Math.round((systemStats.completedBookings / systemStats.totalBookings) * 100) : 0}%` }} />
                  </div>
                </div>
              </div>
            </div>

            {/* Top Partner Studios Ranking */}
            <div className="bg-white rounded-3xl border border-[#e5e1da] p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-[#e5e1da] pb-4">
                <div>
                  <h4 className="font-display font-black text-base text-[#2c2a29]">Top Performing Partner Studios</h4>
                  <p className="text-xs text-[#7c756d]">Ranked by total historical verified revenue</p>
                </div>
                <BadgeCheck size={20} className="text-amber-500" />
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead>
                    <tr className="bg-[#faf9f6] text-[#7c756d] font-bold uppercase tracking-wider text-[10px] border-b border-[#e5e1da]">
                      <th className="py-3 px-4 rounded-l-xl">Rank & Studio Partner</th>
                      <th className="py-3 px-3">Total Bookings</th>
                      <th className="py-3 px-3">Gross Revenue</th>
                      <th className="py-3 px-3 text-right rounded-r-xl">Growth Index</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50 font-medium text-[#2c2a29]">
                    {studioRankings.length === 0 ? (
                      <tr><td colSpan={4} className="py-10 text-center text-gray-400">No partner data available.</td></tr>
                    ) : (
                      studioRankings.slice(0, 10).map((s, idx) => (
                        <tr key={s.id} className="hover:bg-gray-50 transition-colors group">
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-3">
                              <span className="w-5 text-[10px] font-black text-gray-400">#{idx + 1}</span>
                              {s.logo ? (
                                <img src={s.logo} alt="" className="w-8 h-8 rounded-lg object-cover border border-gray-100 group-hover:scale-110 transition-transform" />
                              ) : (
                                <div className="w-8 h-8 rounded-lg bg-[#2c2a29] flex items-center justify-center text-white text-[10px] font-black uppercase">{s.name.charAt(0)}</div>
                              )}
                              <span className="font-bold">{s.name}</span>
                            </div>
                          </td>
                          <td className="py-3 px-3 font-mono font-bold text-gray-600">{s.bookingsCount} sessions</td>
                          <td className="py-3 px-3 font-mono font-bold text-emerald-700">₱{s.revenue.toLocaleString()}</td>
                          <td className="py-3 px-3 text-right">
                            <span className="inline-flex px-2 py-0.5 rounded-full text-[9px] font-extrabold bg-amber-50 text-amber-800 border border-amber-200 uppercase tracking-tighter">
                              Top Tier Partner
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ─── SECTION 1: STUDIOS & APPROVALS ─── */}
        {(primarySection === "studios") && (
          <div className="space-y-4">
            {/* Section header card */}
            <div className="bg-white rounded-2xl border border-[#e5e1da] px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
                  <Building2 size={17} className="text-blue-700" />
                </div>
                <div>
                  <h3 className="font-display font-black text-[#2c2a29] text-base leading-tight">Studios & Partner Network</h3>
                  <p className="text-[10px] text-[#7c756d]">Review applications, onboard partners, browse directory</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {pendingStudios.length > 0 && (
                  <span className="inline-flex items-center gap-1.5 bg-amber-50 border border-amber-200 text-amber-800 text-[10px] font-extrabold px-3 py-1.5 rounded-full animate-pulse">
                    <AlertTriangle size={11} /> {pendingStudios.length} pending
                  </span>
                )}
              </div>
            </div>

            {/* Sub-tab bar */}
            <div className="bg-white rounded-2xl border border-[#e5e1da] p-1.5 flex flex-wrap gap-1">
              {[
                { id: "pending" as AdminStudiosSubTab, label: "Pending Approvals", icon: ShieldAlert, badge: pendingStudios.length > 0 ? pendingStudios.length : null },
                { id: "onboard" as AdminStudiosSubTab, label: "Onboard Studio", icon: Plus, badge: null },
                { id: "approved" as AdminStudiosSubTab, label: "Verified Studios", icon: ShieldCheck, badge: approvedStudios.length > 0 ? approvedStudios.length : null },
              ].map((subTab) => {
                const Icon = subTab.icon;
                const isSelected = studiosSubTab === subTab.id;
                return (
                  <button key={subTab.id} type="button"
                    onClick={() => { setStudiosSubTab(subTab.id); onActiveTabChange(subTab.id); }}
                    className={`flex-1 sm:flex-none flex items-center justify-center sm:justify-start gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      isSelected ? "bg-[#2c2a29] text-white shadow-md" : "text-[#7c756d] hover:bg-gray-100 hover:text-[#2c2a29]"
                    }`}
                  >
                    <Icon size={13} className={isSelected ? "text-yellow-400" : ""} />
                    <span className="hidden sm:inline">{subTab.label}</span>
                    <span className="sm:hidden">{subTab.label.split(" ")[0]}</span>
                    {subTab.badge != null && (
                      <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-black ${isSelected ? "bg-yellow-400 text-black" : "bg-rose-500 text-white"}`}>
                        {subTab.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* ── SUB-TAB: PENDING APPROVALS ── */}
            {studiosSubTab === "pending" && (
              <div className="space-y-3">
                {pendingStudios.length === 0 ? (
                  <div className="bg-white rounded-2xl border border-[#e5e1da] py-16 text-center space-y-3">
                    <div className="w-14 h-14 rounded-2xl bg-green-50 flex items-center justify-center mx-auto">
                      <ShieldCheck size={26} className="text-green-500" />
                    </div>
                    <p className="font-bold text-sm text-[#2c2a29]">All clear — no pending applications</p>
                    <p className="text-xs text-[#7c756d] max-w-xs mx-auto">All registered photography studios have been processed and approved.</p>
                  </div>
                ) : (
                  pendingStudios.map((st) => (
                    <div key={st.id} className="bg-white rounded-2xl border border-amber-200 overflow-hidden hover:shadow-md transition-shadow">
                      <div className="h-1 w-full bg-gradient-to-r from-amber-400 to-orange-400" />
                      <div className="p-5">
                        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                          <div className="flex items-start gap-3 min-w-0">
                            {st.logo ? (
                              <img src={st.logo} alt={st.name} className="w-12 h-12 rounded-xl object-cover border border-gray-200 flex-shrink-0" />
                            ) : (
                              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-100 to-amber-200 flex items-center justify-center flex-shrink-0 font-black text-amber-700 text-lg">
                                {st.name?.charAt(0)}
                              </div>
                            )}
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-1.5 mb-1">
                                <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200 uppercase tracking-wider">Pending Review</span>
                                <span className="text-[10px] font-mono text-gray-400">{st.id}</span>
                              </div>
                              <h4 className="font-display font-bold text-base text-[#2c2a29] leading-tight">{st.name}</h4>
                              <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-[11px] text-[#7c756d]">
                                <span>Owner: <strong className="text-[#2c2a29]">{st.ownerName || st.contactInfo || "—"}</strong></span>
                                <span>Email: <strong className="text-[#2c2a29]">{st.email}</strong></span>
                                <span className="flex items-center gap-1"><MapPin size={10} className="text-amber-500" />{st.location || st.address}</span>
                              </div>
                            </div>
                          </div>

                          {/* Actions */}
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <button type="button" onClick={() => onApproveStudio(st.id)}
                              className="flex items-center gap-1.5 px-4 py-2 bg-green-600 hover:bg-green-500 text-white font-bold rounded-xl text-xs cursor-pointer shadow-sm transition-colors">
                              <Check size={13} /> Approve
                            </button>
                            <button type="button" onClick={() => onRejectStudio(st.id)}
                              className="flex items-center gap-1.5 px-4 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold rounded-xl text-xs cursor-pointer transition-colors">
                              <X size={13} /> Reject
                            </button>
                          </div>
                        </div>

                        {/* Compliance docs */}
                        {(st.businessPermit || st.validId || st.otherDocs) && (
                          <div className="mt-3 pt-3 border-t border-amber-100 flex flex-wrap items-center gap-2">
                            <span className="text-[10px] font-bold text-[#7c756d] uppercase tracking-wider">Documents:</span>
                            {st.businessPermit && (
                              <button type="button" onClick={() => openProtectedDocument(st.businessPermit, `${st.name} - Business Permit`)}
                                className="flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 bg-amber-50 border border-amber-200 rounded-lg text-amber-900 hover:bg-amber-100 cursor-pointer">
                                <FileText size={11} /> Business Permit
                              </button>
                            )}
                            {st.validId && (
                              <button type="button" onClick={() => openProtectedDocument(st.validId, `${st.name} - Valid ID`)}
                                className="flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 bg-amber-50 border border-amber-200 rounded-lg text-amber-900 hover:bg-amber-100 cursor-pointer">
                                <FileText size={11} /> Valid ID
                              </button>
                            )}
                            {st.otherDocs && (
                              <button type="button" onClick={() => openProtectedDocument(st.otherDocs, `${st.name} - Supporting Documents`)}
                                className="flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 bg-amber-50 border border-amber-200 rounded-lg text-amber-900 hover:bg-amber-100 cursor-pointer">
                                <FileText size={11} /> Other Docs
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* ── SUB-TAB: ONBOARD STUDIO ── */}
            {studiosSubTab === "onboard" && (
              <div className="space-y-4">
                <div className="bg-white rounded-2xl border border-[#e5e1da] p-5 space-y-5">
                  <div className="space-y-1">
                    <h4 className="font-display text-lg font-bold text-[#2c2a29]">Exclusively Onboard Verified Photography Studio & Owner Account</h4>
                      <p className="text-xs text-[#7c756d]">As super-administrator, directly create verified studio profiles, lock coordinates via the GIS map interface, and store compliance documents.</p>
                    </div>

                    {onboardSuccess && (
                      <div className="bg-green-50 text-green-800 p-4 rounded-xl border border-green-200 font-semibold text-xs flex items-center gap-2.5">
                        <CheckCircle size={20} className="text-green-600 flex-shrink-0" />
                        <div>
                          <p className="font-bold">Studio Owner Registered & Listed Successfully!</p>
                          <p className="text-[11px] text-green-700 font-medium">The account is active. The studio is instantly published and approved in the centralized database, ready to receive bookings and upload portfolios.</p>
                        </div>
                      </div>
                    )}

                    {onboardError && (
                      <div className="bg-red-50 text-red-800 p-4 rounded-xl border border-red-200 font-bold text-xs flex items-center gap-2">
                        <ShieldAlert size={18} />
                        <span>{onboardError}</span>
                      </div>
                    )}

                    <form onSubmit={handleOnboardSubmit} className="space-y-8">
                      <div className="grid md:grid-cols-2 gap-8">
                        {/* Left Column: Owner Credentials & Studio Basics */}
                        <div className="space-y-6">
                          <div>
                            <h4 className="font-display font-extrabold text-sm text-[#2c2a29] uppercase tracking-wider mb-3.5 pb-1 border-b border-gray-100">
                              1. Owner Personal & Login Credentials
                            </h4>
                            <div className="space-y-3 text-xs">
                              <div>
                                <label className="block font-bold text-gray-700 mb-1">Owner's Full Name</label>
                                <input
                                  type="text"
                                  required
                                  value={ownerName}
                                  onChange={e => setOwnerName(e.target.value)}
                                  placeholder="e.g. Stephen Reyes"
                                  className="w-full bg-white border border-[#e5e1da] rounded-xl px-4 py-2.5 focus:outline-none focus:border-[#2c2a29]"
                                />
                              </div>
                              <div className="grid grid-cols-2 gap-2">
                                <div>
                                  <label className="block font-bold text-gray-700 mb-1">Owner Login Email</label>
                                  <input
                                    type="email"
                                    required
                                    value={ownerEmail}
                                    onChange={e => setOwnerEmail(e.target.value)}
                                    placeholder="stephen@studio.com"
                                    className="w-full bg-white border border-[#e5e1da] rounded-xl px-4 py-2.5 focus:outline-none focus:border-[#2c2a29]"
                                  />
                                </div>
                                <div>
                                  <label className="block font-bold text-gray-700 mb-1">Secure Password</label>
                                  <input
                                    type="password"
                                    required
                                    value={ownerPassword}
                                    onChange={e => setOwnerPassword(e.target.value)}
                                    placeholder="Min. 8 characters"
                                    className="w-full bg-white border border-[#e5e1da] rounded-xl px-4 py-2.5 focus:outline-none focus:border-[#2c2a29]"
                                  />
                                </div>
                              </div>
                              <div className="grid grid-cols-2 gap-2">
                                <div>
                                  <label className="block font-bold text-gray-700 mb-1">Owner Contact Number</label>
                                  <input
                                    type="text"
                                    required
                                    value={ownerContact}
                                    onChange={e => setOwnerContact(e.target.value)}
                                    placeholder="0917-000-0000"
                                    className="w-full bg-white border border-[#e5e1da] rounded-xl px-4 py-2.5 focus:outline-none focus:border-[#2c2a29]"
                                  />
                                </div>
                                <div>
                                  <label className="block font-bold text-gray-700 mb-1">Personal Home Address</label>
                                  <input
                                    type="text"
                                    required
                                    value={ownerAddress}
                                    onChange={e => setOwnerAddress(e.target.value)}
                                    placeholder="Cainta, Rizal"
                                    className="w-full bg-white border border-[#e5e1da] rounded-xl px-4 py-2.5 focus:outline-none focus:border-[#2c2a29]"
                                  />
                                </div>
                              </div>
                            </div>
                          </div>

                          <div>
                            <h4 className="font-display font-extrabold text-sm text-[#2c2a29] uppercase tracking-wider mb-3.5 pb-1 border-b border-gray-100">
                              2. Photography Studio Commercial Profile
                            </h4>
                            <div className="space-y-3 text-xs">
                              <div>
                                <label className="block font-bold text-gray-700 mb-1">Studio Business Name</label>
                                <input
                                  type="text"
                                  required
                                  value={studioName}
                                  onChange={e => setStudioName(e.target.value)}
                                  placeholder="e.g. Luminary Vision Studio"
                                  className="w-full bg-white border border-[#e5e1da] rounded-xl px-4 py-2.5 focus:outline-none focus:border-[#2c2a29]"
                                />
                              </div>
                              <div>
                                <label className="block font-bold text-gray-700 mb-1">Studio Bio / Description</label>
                                <textarea
                                  rows={2}
                                  required
                                  value={studioDescription}
                                  onChange={e => setStudioDescription(e.target.value)}
                                  placeholder="High-end editorial, wedding, and graduation creative space in Cainta..."
                                  className="w-full bg-white border border-[#e5e1da] rounded-xl p-3 focus:outline-none focus:border-[#2c2a29] leading-relaxed"
                                />
                              </div>
                              <div className="grid grid-cols-2 gap-2">
                                <div>
                                  <label className="block font-bold text-gray-700 mb-1">Studio Physical Address</label>
                                  <input
                                    type="text"
                                    required
                                    value={studioAddress}
                                    onChange={e => setStudioAddress(e.target.value)}
                                    placeholder="Unit 3B, Ortigas Ave Extension"
                                    className="w-full bg-white border border-[#e5e1da] rounded-xl px-4 py-2.5 focus:outline-none focus:border-[#2c2a29]"
                                  />
                                </div>
                                <div>
                                  <label className="block font-bold text-gray-700 mb-1">Area / Landmark</label>
                                  <select
                                    value={studioLocation}
                                    onChange={e => setStudioLocation(e.target.value)}
                                    className="w-full bg-white border border-[#e5e1da] rounded-xl px-4 py-2.5 focus:outline-none focus:border-[#2c2a29]"
                                  >
                                    <option value="Ortigas Ave Ext (Valley Golf)">Ortigas Ave Ext (Valley Golf)</option>
                                    <option value="Felix Ave (Rublou Marketplace)">Felix Ave (Rublou Marketplace)</option>
                                    <option value="Imelda Ave / Bypass Junction">Imelda Ave / Bypass Junction</option>
                                    <option value="Town Center (San Roque)">Town Center (San Roque)</option>
                                    <option value="Vista Verde Village">Vista Verde Village</option>
                                  </select>
                                </div>
                              </div>

                              <div className="grid grid-cols-2 gap-2">
                                <div>
                                  <label className="block font-bold text-gray-700 mb-1">Starting Price (PHP)</label>
                                  <input
                                    type="number"
                                    required
                                    value={startingPrice}
                                    onChange={e => setStartingPrice(e.target.value)}
                                    className="w-full bg-white border border-[#e5e1da] rounded-xl px-4 py-2.5 focus:outline-none focus:border-[#2c2a29] font-bold text-green-700"
                                  />
                                </div>
                                <div>
                                  <label className="block font-bold text-gray-700 mb-1">Business Hours</label>
                                  <input
                                    type="text"
                                    required
                                    value={businessHours}
                                    onChange={e => setBusinessHours(e.target.value)}
                                    placeholder="09:00 AM - 06:00 PM"
                                    className="w-full bg-white border border-[#e5e1da] rounded-xl px-4 py-2.5 focus:outline-none focus:border-[#2c2a29]"
                                  />
                                </div>
                              </div>

                              <div>
                                <label className="block font-bold text-gray-700 mb-1.5">Acquisition Specializations (Choose 1 or more)</label>
                                <div className="grid grid-cols-2 gap-2">
                                  {categories.map((cat) => {
                                    const checked = selectedCategories.includes(cat.name);
                                    return (
                                      <button
                                        type="button"
                                        key={cat.id}
                                        onClick={() => handleToggleCategory(cat.name)}
                                        className={`p-2 rounded-lg border text-[11px] font-bold transition-all flex items-center justify-between cursor-pointer ${
                                          checked 
                                            ? "bg-[#2c2a29] text-white border-[#2c2a29]" 
                                            : "bg-white text-gray-600 border-[#e5e1da] hover:border-[#7c756d]"
                                        }`}
                                      >
                                        <span>{cat.name}</span>
                                        {checked && <CheckCircle size={12} className="text-yellow-400" />}
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Right Column: GIS Location Marker & Compliance Docs */}
                        <div className="space-y-6">
                          <div>
                            <h4 className="font-display font-extrabold text-sm text-[#2c2a29] uppercase tracking-wider mb-2.5 pb-1 border-b border-gray-100 flex items-center gap-1.5">
                              <MapPin size={16} className="text-red-500" /> 3. GIS Coordinates Locator via Interactive Map
                            </h4>
                            <p className="text-[10px] text-[#7c756d] mb-3">Click on the map or drag the golden marker to align GPS coordinates for local search indexing.</p>
                            
                            <div className="relative border border-[#e5e1da] rounded-2xl overflow-hidden bg-gray-50">
                              <div ref={pickMapContainerRef} style={{ height: "290px" }} className="w-full z-0" />
                            </div>

                            <div className="grid grid-cols-2 gap-2 mt-3 text-xs">
                              <div>
                                <label className="block font-bold text-gray-500 mb-0.5">Latitude (GPS N)</label>
                                <input
                                  type="number"
                                  step="any"
                                  required
                                  value={latitude}
                                  onChange={e => setLatitude(Number(e.target.value))}
                                  className="w-full bg-white border border-[#e5e1da] rounded-xl px-3 py-1.5 focus:outline-none focus:border-[#2c2a29] font-mono text-[11px]"
                                />
                              </div>
                              <div>
                                <label className="block font-bold text-gray-500 mb-0.5">Longitude (GPS E)</label>
                                <input
                                  type="number"
                                  step="any"
                                  required
                                  value={longitude}
                                  onChange={e => setLongitude(Number(e.target.value))}
                                  className="w-full bg-white border border-[#e5e1da] rounded-xl px-3 py-1.5 focus:outline-none focus:border-[#2c2a29] font-mono text-[11px]"
                                />
                              </div>
                            </div>
                          </div>

                          <div>
                            <h4 className="font-display font-extrabold text-sm text-[#2c2a29] uppercase tracking-wider mb-2.5 pb-1 border-b border-gray-100 flex items-center gap-1.5">
                              <FileUp size={16} className="text-yellow-600" /> 4. Compliance Documents & Verification
                            </h4>
                            
                            <div className="grid gap-3 text-xs">
                              <div className="p-3 bg-white border border-[#e5e1da] rounded-xl flex items-center justify-between">
                                <div>
                                  <p className="font-bold text-gray-800">DTI / Mayor's Business Permit</p>
                                  <p className="text-[10px] text-gray-500">Government compliance certificate or Mayor's clearance</p>
                                </div>
                                <label className="px-3 py-1.5 bg-yellow-50 hover:bg-yellow-100 text-yellow-800 border border-yellow-300 font-bold rounded-lg cursor-pointer text-xs flex items-center gap-1">
                                  <Upload size={12} /> {businessPermit ? "Change" : "Upload"}
                                  <input type="file" accept="image/*,application/pdf" onChange={e => handleFileChange(e, "permit")} className="hidden" />
                                </label>
                              </div>
                              {businessPermit && (
                                <div className="bg-green-50 p-2 rounded-xl border border-green-200 flex items-center justify-between">
                                  <span className="text-[10px] font-bold text-green-800 flex items-center gap-1">
                                    <FileCheck size={12} /> Business Permit Attached!
                                  </span>
                                  <button type="button" onClick={() => setBusinessPermit("")} className="text-red-500 hover:underline text-[9px] font-bold">Remove</button>
                                </div>
                              )}

                              <div className="p-3 bg-white border border-[#e5e1da] rounded-xl flex items-center justify-between">
                                <div>
                                  <p className="font-bold text-gray-800">Owner Valid Government ID</p>
                                  <p className="text-[10px] text-gray-500">Passport, Driver's License, or UMID</p>
                                </div>
                                <label className="px-3 py-1.5 bg-yellow-50 hover:bg-yellow-100 text-yellow-800 border border-yellow-300 font-bold rounded-lg cursor-pointer text-xs flex items-center gap-1">
                                  <Upload size={12} /> {validId ? "Change" : "Upload"}
                                  <input type="file" accept="image/*,application/pdf" onChange={e => handleFileChange(e, "validId")} className="hidden" />
                                </label>
                              </div>
                              {validId && (
                                <div className="bg-green-50 p-2 rounded-xl border border-green-200 flex items-center justify-between">
                                  <span className="text-[10px] font-bold text-green-800 flex items-center gap-1">
                                    <FileCheck size={12} /> Valid ID Attached!
                                  </span>
                                  <button type="button" onClick={() => setValidId("")} className="text-red-500 hover:underline text-[9px] font-bold">Remove</button>
                                </div>
                              )}

                              <div className="p-3 bg-white border border-[#e5e1da] rounded-xl flex items-center justify-between">
                                <div>
                                  <p className="font-bold text-gray-800">Additional Studio Documents</p>
                                  <p className="text-[10px] text-gray-500">Lease agreement, BIR 2303, or studio photos</p>
                                </div>
                                <label className="px-3 py-1.5 bg-yellow-50 hover:bg-yellow-100 text-yellow-800 border border-yellow-300 font-bold rounded-lg cursor-pointer text-xs flex items-center gap-1">
                                  <Upload size={12} /> {otherDocs ? "Change" : "Upload"}
                                  <input type="file" accept="image/*,application/pdf" onChange={e => handleFileChange(e, "other")} className="hidden" />
                                </label>
                              </div>
                              {otherDocs && (
                                <div className="bg-green-50 p-2 rounded-xl border border-green-200 flex items-center justify-between">
                                  <span className="text-[10px] font-bold text-green-800 flex items-center gap-1">
                                    <FileCheck size={12} /> Docs Attached!
                                  </span>
                                  <button type="button" onClick={() => setOtherDocs("")} className="text-red-500 hover:underline text-[9px] font-bold">Remove</button>
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="pt-4">
                            <button
                              type="submit"
                              disabled={onboardLoading}
                              className="w-full py-3.5 bg-yellow-500 hover:bg-yellow-400 text-black font-extrabold rounded-xl text-xs uppercase tracking-wider shadow-md hover:shadow-lg transition-all active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer"
                            >
                              <Sparkles size={16} />
                              {onboardLoading ? "Registering & Instantly Approving..." : "Complete verified onboarding & instant approval"}
                            </button>
                          </div>
                        </div>
                      </div>
                    </form>
                  </div>
                </div>
              )}

            {studiosSubTab === "approved" && (
              <div className="space-y-4">
                {/* Search */}
                <div className="bg-white rounded-2xl border border-[#e5e1da] p-3.5">
                  <div className="relative">
                    <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                    <input
                      value={studioSearch}
                      onChange={e => setStudioSearch(e.target.value)}
                      placeholder="Search verified studios by name or location…"
                      className="w-full pl-8 pr-4 py-2 text-xs border border-[#e5e1da] rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-300 bg-[#faf9f6]"
                    />
                    </div>
                  </div>
                {approvedStudios.length === 0 ? (
                  <div className="bg-white rounded-2xl border border-[#e5e1da] py-14 text-center space-y-2">
                    <div className="w-12 h-12 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto"><ShieldCheck size={22} className="text-gray-300" /></div>
                    <p className="text-sm font-bold text-[#2c2a29]">No verified studios yet</p>
                    <p className="text-xs text-[#7c756d]">Approve pending applications to add studios here.</p>
                  </div>
                ) : (
                  <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
                    {approvedStudios
                      .filter(st => !studioSearch.trim() || st.name?.toLowerCase().includes(studioSearch.toLowerCase()) || st.location?.toLowerCase().includes(studioSearch.toLowerCase()))
                      .map((st) => (
                        <div key={st.id} className="bg-white rounded-2xl border border-[#e5e1da] overflow-hidden hover:shadow-md transition-shadow group">
                          {/* Cover strip */}
                          <div className="h-20 bg-gradient-to-br from-gray-100 to-gray-200 overflow-hidden relative">
                            {st.coverImage ? (
                              <img src={st.coverImage} alt={st.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center"><Building2 size={28} className="text-gray-300" /></div>
                            )}
                            <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
                            <span className="absolute bottom-2 left-2 inline-flex items-center gap-1 text-[9px] font-bold bg-green-500 text-white px-2 py-0.5 rounded-full">
                              <Check size={9} /> Verified
                            </span>
                          </div>
                          <div className="p-3.5 space-y-2">
                            <div className="flex items-center gap-2.5">
                              {st.logo ? (
                                <img src={st.logo} alt={st.name} className="w-8 h-8 rounded-lg object-cover border border-gray-100 flex-shrink-0" />
                              ) : (
                                <div className="w-8 h-8 rounded-lg bg-[#2c2a29] flex items-center justify-center text-white font-black text-sm flex-shrink-0">
                                  {st.name?.charAt(0)}
                                </div>
                              )}
                              <div className="min-w-0">
                                <p className="font-bold text-sm text-[#2c2a29] truncate">{st.name}</p>
                                <p className="text-[10px] text-[#7c756d] flex items-center gap-1 truncate"><MapPin size={9} className="text-amber-500 flex-shrink-0" />{st.location || st.address}</p>
                              </div>
                            </div>
                            <div className="text-[10px] text-gray-500 space-y-0.5">
                              <p>✉️ {st.email}</p>
                              <p>📞 {st.contactInfo || "—"}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            )}

          </div>
        )}

        {/* ─── SECTION 2: PAYMENTS & REVIEWS ─── */}
        {(primarySection === "finance") && (
          <div className="space-y-4">
            {/* Section header card */}
            <div className="bg-white rounded-2xl border border-[#e5e1da] px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center flex-shrink-0">
                  <CreditCard size={17} className="text-emerald-700" />
                </div>
                <div>
                  <h3 className="font-display font-black text-[#2c2a29] text-base leading-tight">Finance & Quality Control</h3>
                  <p className="text-[10px] text-[#7c756d]">Payment ledger monitoring, review moderation</p>
                </div>
              </div>
            </div>

            {/* Sub-tab bar */}
            <div className="bg-white rounded-2xl border border-[#e5e1da] p-1.5 flex gap-1">
              {[
                { id: "payments" as AdminFinanceSubTab, label: "Payment Ledger", icon: CreditCard },
                { id: "reviews" as AdminFinanceSubTab, label: "Review Moderation", icon: Star },
              ].map((subTab) => {
                const Icon = subTab.icon;
                const isSelected = financeSubTab === subTab.id;
                return (
                  <button key={subTab.id} type="button"
                    onClick={() => { setFinanceSubTab(subTab.id); onActiveTabChange(subTab.id); }}
                    className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      isSelected ? "bg-[#2c2a29] text-white shadow-md" : "text-[#7c756d] hover:bg-gray-100 hover:text-[#2c2a29]"
                    }`}
                  >
                    <Icon size={13} className={isSelected ? "text-yellow-400" : ""} />
                    {subTab.label}
                  </button>
                );
              })}
            </div>

            {/* ── PAYMENTS SUB-TAB ── */}
            {financeSubTab === "payments" && (
              <div className="space-y-4">
                {/* Search bar */}
                <div className="bg-white rounded-2xl border border-[#e5e1da] p-3.5">
                  <div className="relative">
                    <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                    <input
                      value={paymentSearch}
                      onChange={e => setPaymentSearch(e.target.value)}
                      placeholder="Filter studios by name…"
                      className="w-full pl-8 pr-4 py-2 text-xs border border-[#e5e1da] rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-300 bg-[#faf9f6]"
                    />
                  </div>
                </div>

                {/* Per-studio payment cards */}
                {studios
                  .filter(studio => !paymentSearch.trim() || studio.name?.toLowerCase().includes(paymentSearch.toLowerCase()))
                  .map(studio => {
                    const studioPayments = payments.filter(p => p.studioId === studio.id);
                    const totalPaid =
                      studioPayments.filter(p => p.paymentStatus === "Paid" && p.paymentType !== "PrintOrder").reduce((s, p) => s + Number(p.amount || 0), 0) +
                      printOrders.filter(o => o.studioId === studio.id && o.paymentStatus === "Paid").reduce((s, o) => s + Number(o.totalAmount || 0), 0);
                    const pendingCount = studioPayments.filter(p => p.paymentStatus === "Pending Verification").length;
                    if (studioPayments.length === 0) return null;
                    return (
                      <div key={studio.id} className="bg-white rounded-2xl border border-[#e5e1da] overflow-hidden">
                        {/* Studio header */}
                        <div className="px-5 py-3.5 flex items-center justify-between gap-4 border-b border-[#f0ede8] bg-[#faf9f6]">
                          <div className="flex items-center gap-3 min-w-0">
                            {studio.logo ? (
                              <img src={studio.logo} alt={studio.name} className="w-8 h-8 rounded-lg object-cover border border-gray-200 flex-shrink-0" />
                            ) : (
                              <div className="w-8 h-8 rounded-lg bg-[#2c2a29] flex items-center justify-center text-white font-black text-sm flex-shrink-0">
                                {studio.name?.charAt(0)}
                              </div>
                            )}
                            <div className="min-w-0">
                              <p className="font-bold text-sm text-[#2c2a29] truncate">{studio.name}</p>
                              <p className="text-[10px] text-[#7c756d]">{studioPayments.length} transaction{studioPayments.length !== 1 ? "s" : ""}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3 flex-shrink-0">
                            {pendingCount > 0 && (
                              <span className="flex items-center gap-1 text-[9px] font-bold bg-amber-50 border border-amber-200 text-amber-800 px-2 py-0.5 rounded-full">
                                <AlertTriangle size={9} /> {pendingCount} unverified
                              </span>
                            )}
                            <div className="text-right">
                              <p className="text-[9px] uppercase font-bold text-[#7c756d]">Total Collected</p>
                              <p className="text-base font-black text-emerald-700">₱{totalPaid.toLocaleString("en-PH", { minimumFractionDigits: 0 })}</p>
                            </div>
                          </div>
                        </div>

                        {/* Payments table */}
                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-xs">
                            <thead>
                              <tr className="border-b border-[#f0ede8] bg-[#faf9f6]/50 text-[9px] uppercase tracking-wider text-[#7c756d] font-bold">
                                <th className="py-2.5 px-4">Payment ID</th>
                                <th className="py-2.5 px-3">Type / Method</th>
                                <th className="py-2.5 px-3">Amount</th>
                                <th className="py-2.5 px-3">Status</th>
                                <th className="py-2.5 px-3">Reference</th>
                                <th className="py-2.5 px-3">Proof</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-[#f5f3ef]">
                              {studioPayments.map(payment => (
                                <tr key={payment.id} className="hover:bg-[#faf9f6]/50 transition-colors">
                                  <td className="py-3 px-4">
                                    <span className="font-bold text-[#2c2a29] font-mono text-[10px]">{payment.id}</span>
                                  </td>
                                  <td className="py-3 px-3">
                                    <span className="text-[10px] font-semibold text-[#2c2a29]">{payment.paymentType}</span>
                                    <span className="block text-[9px] text-[#7c756d]">{payment.paymentMethod}</span>
                                  </td>
                                  <td className="py-3 px-3 font-bold text-[#2c2a29]">
                                    ₱{Number(payment.amount || 0).toLocaleString("en-PH", { minimumFractionDigits: 2 })}
                                  </td>
                                  <td className="py-3 px-3">
                                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold border ${
                                      payment.paymentStatus === "Paid" ? "bg-green-50 text-green-700 border-green-200" :
                                      payment.paymentStatus === "Failed" || payment.paymentStatus === "Rejected" ? "bg-rose-50 text-rose-700 border-rose-200" :
                                      payment.paymentStatus === "Pending Verification" ? "bg-amber-50 text-amber-700 border-amber-200" :
                                      "bg-gray-100 text-gray-500 border-gray-200"
                                    }`}>{payment.paymentStatus}</span>
                                  </td>
                                  <td className="py-3 px-3 text-[10px] text-[#7c756d] font-mono">
                                    {payment.referenceNumber || "—"}
                                  </td>
                                  <td className="py-3 px-3">
                                    <div className="flex items-center gap-1.5">
                                      {payment.proofOfPayment ? (
                                        <button type="button" onClick={() => openPaymentProof(payment)}
                                          className="flex items-center gap-1 text-[10px] font-bold text-blue-600 hover:text-blue-800 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-lg cursor-pointer">
                                          <Eye size={10} /> Proof
                                        </button>
                                      ) : (
                                        <span className="text-[10px] text-gray-400">None</span>
                                      )}
                                      <button type="button"
                                        onClick={() => {
                                          const studioName = studio.name;
                                          const booking = bookings.find((b: any) => b.id === payment.bookingId);
                                          setViewingPayment({ ...(payment as any), studioName, booking });
                                        }}
                                        className="flex items-center gap-1 text-[10px] font-bold text-[#2c2a29] hover:text-black bg-[#faf9f6] border border-[#e5e1da] px-2 py-0.5 rounded-lg cursor-pointer">
                                        <Eye size={10} /> View
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}

            {/* ── REVIEWS SUB-TAB ── */}
            {financeSubTab === "reviews" && (
              <div className="space-y-4">
                {/* Header */}
                <div className="bg-white rounded-2xl border border-[#e5e1da] p-4 flex items-center justify-between gap-4">
                  <div>
                    <h4 className="font-display font-bold text-[#2c2a29] text-sm">Customer Review Moderation</h4>
                    <p className="text-[10px] text-[#7c756d] mt-0.5">
                      {adminReviews.length > 0
                        ? `${adminReviews.length} reviews · ${adminReviews.filter(r => r.status === "pending").length} pending · ${adminReviews.filter(r => r.status === "approved").length} approved · ${adminReviews.filter(r => r.status === "rejected").length} rejected`
                        : "Approve or reject customer-submitted ratings for all studios."}
                    </p>
                  </div>
                  <button type="button" onClick={loadAdminReviews}
                    className="flex items-center gap-1.5 px-3 py-2 bg-[#2c2a29] hover:bg-[#44403c] text-white text-xs font-bold rounded-xl cursor-pointer transition-colors flex-shrink-0">
                    <RefreshCw size={12} /> Refresh
                  </button>
                </div>

                {reviewsLoading && (
                  <div className="bg-white rounded-2xl border border-[#e5e1da] py-12 text-center">
                    <div className="w-8 h-8 rounded-full border-2 border-amber-400 border-t-transparent animate-spin mx-auto mb-3" />
                    <p className="text-xs text-[#7c756d] font-medium">Loading reviews…</p>
                  </div>
                )}

                {!reviewsLoading && adminReviews.length === 0 && (
                  <div className="bg-white rounded-2xl border border-[#e5e1da] py-14 text-center space-y-2">
                    <div className="w-12 h-12 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto"><Star size={22} className="text-gray-300" /></div>
                    <p className="text-sm font-bold text-[#2c2a29]">No reviews yet</p>
                    <p className="text-xs text-[#7c756d]">Customer reviews will appear here once submitted.</p>
                  </div>
                )}

                <div className="grid sm:grid-cols-2 gap-3">
                  {adminReviews.map((rev) => {
                    const studio = studios.find(s => s.id === rev.studioId);
                    return (
                      <div key={rev.id} className="bg-white rounded-2xl border border-[#e5e1da] overflow-hidden hover:shadow-md transition-shadow">
                        {/* Rating accent bar */}
                        <div className={`h-1 w-full ${rev.rating >= 4 ? "bg-green-400" : rev.rating === 3 ? "bg-yellow-400" : "bg-rose-400"}`} />
                        <div className="p-4 space-y-3">
                          {/* Header row */}
                          <div className="flex items-start gap-3">
                            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-100 to-amber-200 flex items-center justify-center font-black text-amber-700 text-sm flex-shrink-0">
                              {rev.customerName?.[0]?.toUpperCase() || "?"}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex flex-wrap items-center gap-1.5 mb-0.5">
                                <span className="font-bold text-sm text-[#2c2a29] truncate">{rev.customerName || "Anonymous"}</span>
                                <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border uppercase ${
                                  rev.status === "approved" ? "bg-green-50 text-green-700 border-green-200" :
                                  rev.status === "rejected" ? "bg-rose-50 text-rose-700 border-rose-200" :
                                  "bg-amber-50 text-amber-700 border-amber-200"
                                }`}>{rev.status}</span>
                              </div>
                              <div className="flex items-center gap-1 mb-1">
                                {[1,2,3,4,5].map(s => (
                                  <Star key={s} size={11} className={s <= rev.rating ? "text-amber-400 fill-amber-400" : "text-gray-200 fill-gray-200"} />
                                ))}
                                <span className="text-[10px] font-bold text-[#7c756d] ml-1">{rev.rating}/5</span>
                              </div>
                              <p className="text-[10px] text-blue-600 font-semibold truncate">{studio?.name || "Unknown Studio"}</p>
                            </div>
                            <button type="button"
                              onClick={() => setViewingReview({ ...(rev as any), studioName: studio?.name || "Unknown Studio", studioLogo: studio?.logo })}
                              className="flex items-center gap-1 text-[10px] font-bold text-[#2c2a29] hover:text-black bg-[#faf9f6] border border-[#e5e1da] px-2 py-1 rounded-lg cursor-pointer flex-shrink-0">
                              <Eye size={10} /> View
                            </button>
                          </div>

                          <p className="text-xs text-gray-600 leading-relaxed bg-[#faf9f6] rounded-xl p-2.5 border border-[#f0ede8]">
                            "{rev.comment}"
                          </p>
                          <p className="text-[10px] text-[#7c756d]">{new Date(rev.createdAt).toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" })}</p>

                          {/* Actions */}
                          <div className="flex gap-2 pt-1 border-t border-[#f0ede8]">
                            {rev.status !== "approved" && (
                              <button type="button"
                                onClick={async () => {
                                  try {
                                    const d = await apiRequest(`/api/admin/reviews/${rev.id}/approve`, { method: "POST" });
                                    if (d.success) setAdminReviews(prev => prev.map(r => r.id === rev.id ? d.review : r));
                                  } catch { /* ignore */ }
                                }}
                                className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-green-600 hover:bg-green-500 text-white rounded-xl text-[10px] font-bold cursor-pointer transition-colors">
                                <Check size={11} /> Approve
                              </button>
                            )}
                            {rev.status !== "rejected" && (
                              <button type="button"
                                onClick={async () => {
                                  try {
                                    const d = await apiRequest(`/api/admin/reviews/${rev.id}/reject`, { method: "POST" });
                                    if (d.success) setAdminReviews(prev => prev.map(r => r.id === rev.id ? d.review : r));
                                  } catch { /* ignore */ }
                                }}
                                className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-[10px] font-bold cursor-pointer transition-colors">
                                <X size={11} /> Reject
                              </button>
                            )}
                            {rev.status === "approved" && (
                              <span className="flex-1 flex items-center justify-center gap-1 text-[10px] text-green-700 font-bold bg-green-50 border border-green-200 rounded-xl py-2">
                                <Check size={11} /> Published
                              </span>
                            )}
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

        {/* ─── SECTION 3: SYSTEM MANAGEMENT & SETTINGS ─── */}
        {(primarySection === "management") && (
          <div className="space-y-4">
            {/* Section header card */}
            <div className="bg-white rounded-2xl border border-[#e5e1da] px-5 py-4 flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-[#faf0d0] flex items-center justify-center flex-shrink-0">
                <Settings size={17} className="text-amber-700" />
              </div>
              <div>
                <h3 className="font-display font-black text-[#2c2a29] text-base leading-tight">System Management & Settings</h3>
                <p className="text-[10px] text-[#7c756d]">Users, categories, content, theme, modules, audit, account</p>
              </div>
            </div>

            {/* Sub-tab bar — scrollable on mobile */}
            <div className="bg-white rounded-2xl border border-[#e5e1da] p-1.5 overflow-x-auto">
              <div className="flex gap-1 min-w-max">
                {[
                  { id: "users" as AdminManagementSubTab,      label: "Users",          icon: Users },
                  { id: "categories" as AdminManagementSubTab, label: "Categories",     icon: Briefcase },
                  { id: "cms" as AdminManagementSubTab,        label: "Content & FAQs", icon: FileText },
                  { id: "pages" as AdminManagementSubTab,      label: "Page Builder",   icon: Globe },
                  { id: "theme" as AdminManagementSubTab,      label: "Theme & UI",     icon: Sparkles },
                  { id: "modules" as AdminManagementSubTab,    label: "Modules",        icon: Settings },
                  { id: "audio" as AdminManagementSubTab,      label: "Audio",          icon: Volume2 },
                  { id: "audit" as AdminManagementSubTab,      label: "Audit Log",      icon: FileCheck },
                  { id: "account" as AdminManagementSubTab,    label: "Admin Account",  icon: ShieldCheck },
                ].map((subTab) => {
                  const Icon = subTab.icon;
                  const isSelected = managementSubTab === subTab.id;
                  return (
                    <button key={subTab.id} type="button"
                      onClick={() => { setManagementSubTab(subTab.id); onActiveTabChange(subTab.id); }}
                      className={`flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                        isSelected ? "bg-[#2c2a29] text-white shadow-md" : "text-[#7c756d] hover:bg-gray-100 hover:text-[#2c2a29]"
                      }`}
                    >
                      <Icon size={12} className={isSelected ? "text-yellow-400" : ""} />
                      {subTab.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Wrap all sub-tab content in a white card */}
            <div className="bg-white rounded-2xl border border-[#e5e1da] p-5 sm:p-6 space-y-5">

              {/* 1. USERS SUB-TAB */}
              {managementSubTab === "users" && (
                <div className="space-y-4">
                  {/* Header row */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <h4 className="font-display font-bold text-[#2c2a29] text-sm">User Account Management</h4>
                      <p className="text-xs text-[#7c756d] mt-0.5">{users.length} total accounts · {users.filter(u => u.role === "CUSTOMER").length} customers · {users.filter(u => u.role === "STUDIO_ADMIN").length} studio admins</p>
                    </div>
                    <button onClick={() => setShowAddUserModal(true)}
                      className="flex items-center gap-1.5 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-white font-bold rounded-xl text-xs cursor-pointer shadow-sm transition-colors">
                      <Plus size={13} /> Add New User
                    </button>
                  </div>

                  {/* Search + role filter */}
                  <div className="flex flex-col sm:flex-row gap-2">
                    <div className="relative flex-1">
                      <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                      <input value={userSearch} onChange={e => setUserSearch(e.target.value)}
                        placeholder="Search by name or email…"
                        className="w-full pl-8 pr-4 py-2 text-xs border border-[#e5e1da] rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-300 bg-[#faf9f6]" />
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {["ALL", "CUSTOMER", "STUDIO_ADMIN", "STUDIO_STAFF", "SUPER_ADMIN"].map(r => (
                        <button key={r} onClick={() => setUserRoleFilter(r)}
                          className={`px-3 py-1.5 rounded-xl text-[10px] font-bold border cursor-pointer transition-all ${
                            userRoleFilter === r ? "bg-[#2c2a29] border-[#2c2a29] text-white" : "bg-white border-[#e5e1da] text-[#7c756d] hover:border-amber-300"
                          }`}>
                          {r === "ALL" ? "All" : r.replace("_", " ")}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Users table */}
                  <div className="rounded-2xl border border-[#e5e1da] overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="bg-[#2c2a29] text-white text-[9px] uppercase tracking-wider">
                            <th className="py-3 px-4">User</th>
                            <th className="py-3 px-3">Role</th>
                            <th className="py-3 px-3">Status</th>
                            <th className="py-3 px-3">Contact</th>
                            <th className="py-3 px-3">Documents</th>
                            <th className="py-3 px-3">Joined</th>
                            <th className="py-3 px-3">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#f0ede8]">
                          {users
                            .filter(u => userRoleFilter === "ALL" || u.role === userRoleFilter)
                            .filter(u => !userSearch.trim() ||
                              (u.fullName || u.name || "").toLowerCase().includes(userSearch.toLowerCase()) ||
                              (u.email || "").toLowerCase().includes(userSearch.toLowerCase())
                            )
                            .map((u) => (
                              <tr key={u.id} className="hover:bg-[#faf9f6]/60 transition-colors">
                                {/* User column */}
                                <td className="py-3 px-4">
                                  <div className="flex items-center gap-2.5 min-w-0">
                                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-black text-sm flex-shrink-0 ${
                                      u.role === "SUPER_ADMIN" ? "bg-purple-100 text-purple-700" :
                                      u.role === "STUDIO_ADMIN" ? "bg-amber-100 text-amber-700" :
                                      u.role === "STUDIO_STAFF" ? "bg-blue-100 text-blue-700" :
                                      "bg-green-100 text-green-700"
                                    }`}>
                                      {(u.fullName || u.name || "?").charAt(0).toUpperCase()}
                                    </div>
                                    <div className="min-w-0">
                                      <p className="font-bold text-[#2c2a29] truncate">{u.fullName || u.name}</p>
                                      <p className="text-[10px] text-[#7c756d] truncate">{u.email}</p>
                                    </div>
                                  </div>
                                </td>
                                {/* Role */}
                                <td className="py-3 px-3">
                                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold border uppercase ${
                                    u.role === "SUPER_ADMIN" ? "bg-purple-50 text-purple-700 border-purple-200" :
                                    u.role === "STUDIO_ADMIN" ? "bg-amber-50 text-amber-800 border-amber-200" :
                                    u.role === "STUDIO_STAFF" ? "bg-blue-50 text-blue-700 border-blue-200" :
                                    "bg-green-50 text-green-700 border-green-200"
                                  }`}>
                                    {u.role ? u.role.replace("_", " ") : "CUSTOMER"}
                                  </span>
                                </td>
                                {/* Status */}
                                <td className="py-3 px-3">
                                  {u.role === "STUDIO_ADMIN" ? (() => {
                                    const studio = studios.find(s => s.ownerId === u.id || s.id === u.studioId);
                                    const status = studio?.status || "pending";
                                    return (
                                      <span className={`inline-flex px-2 py-0.5 rounded-full text-[9px] font-bold border uppercase ${
                                        status === "approved" ? "bg-green-50 text-green-700 border-green-200" :
                                        status === "rejected" ? "bg-rose-50 text-rose-700 border-rose-200" :
                                        status === "suspended" ? "bg-gray-100 text-gray-600 border-gray-200" :
                                        "bg-yellow-50 text-yellow-700 border-yellow-200"
                                      }`}>{status}</span>
                                    );
                                  })() : <span className="text-[10px] font-bold text-green-600">Active</span>}
                                </td>
                                {/* Contact */}
                                <td className="py-3 px-3 text-[10px] text-[#7c756d]">
                                  {u.contactNumber || u.contactInfo || "—"}
                                </td>
                                {/* Documents */}
                                <td className="py-3 px-3">
                                  {u.role === "STUDIO_ADMIN" ? (() => {
                                    const studio = studios.find(s => s.ownerId === u.id || s.id === u.studioId);
                                    const docs = [
                                      { label: "Permit", value: studio?.businessPermit, title: "Business Permit" },
                                      { label: "ID", value: studio?.validId, title: "Owner Valid ID" },
                                      { label: "Docs", value: studio?.otherDocs, title: "Supporting Documents" },
                                    ].filter(d => d.value);
                                    return docs.length > 0 ? (
                                      <div className="flex flex-wrap gap-1">
                                        {docs.map(d => (
                                          <button key={d.label} type="button"
                                            onClick={() => openProtectedDocument(d.value, `${studio?.name || u.fullName} - ${d.title}`)}
                                            className="flex items-center gap-1 px-2 py-0.5 bg-amber-50 border border-amber-200 text-amber-800 text-[9px] font-bold rounded-lg cursor-pointer hover:bg-amber-100">
                                            <Eye size={10} /> {d.label}
                                          </button>
                                        ))}
                                      </div>
                                    ) : <span className="text-[10px] text-gray-400">—</span>;
                                  })() : <span className="text-[10px] text-gray-400">—</span>}
                                </td>
                                {/* Joined */}
                                <td className="py-3 px-3 text-[10px] text-[#7c756d]">
                                  {new Date(u.createdAt).toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" })}
                                </td>
                                {/* Actions */}
                                <td className="py-3 px-3">
                                  <div className="flex flex-wrap gap-1">
                                    {u.role === "STUDIO_ADMIN" && (() => {
                                      const studio = studios.find(s => s.ownerId === u.id || s.id === u.studioId);
                                      const status = studio?.status || "pending";
                                      return <>
                                        {status !== "approved" && (
                                          <button onClick={() => handleUserStatusChange(u.id, "approved")}
                                            className="flex items-center gap-0.5 px-2 py-1 bg-green-600 hover:bg-green-500 text-white text-[9px] font-bold rounded-lg cursor-pointer">
                                            <Check size={10} /> Approve
                                          </button>
                                        )}
                                        {status !== "rejected" && (
                                          <button onClick={() => handleUserStatusChange(u.id, "rejected")}
                                            className="flex items-center gap-0.5 px-2 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-[9px] font-bold rounded-lg cursor-pointer">
                                            <X size={10} /> Reject
                                          </button>
                                        )}
                                        {status !== "suspended" && status === "approved" && (
                                          <button onClick={() => handleUserStatusChange(u.id, "suspended")}
                                            className="flex items-center gap-0.5 px-2 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-200 text-[9px] font-bold rounded-lg cursor-pointer">
                                            <ShieldAlert size={10} /> Suspend
                                          </button>
                                        )}
                                      </>;
                                    })()}
                                    {u.role === "CUSTOMER" && !u.isArchived && (
                                      <button type="button"
                                        onClick={() => { if (window.confirm(`Archive customer "${u.fullName || u.email}"? They will be hidden from active views.`)) onArchiveCustomer?.(u.id); }}
                                        className="flex items-center gap-0.5 px-2 py-1 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 text-[9px] font-bold rounded-lg cursor-pointer">
                                        📦 Archive
                                      </button>
                                    )}
                                    {u.role === "CUSTOMER" && u.isArchived && (
                                      <>
                                        <button type="button"
                                          onClick={() => onUnarchiveCustomer?.(u.id)}
                                          className="flex items-center gap-0.5 px-2 py-1 bg-green-50 hover:bg-green-100 text-green-700 border border-green-200 text-[9px] font-bold rounded-lg cursor-pointer">
                                          ↩ Restore
                                        </button>
                                        <button type="button"
                                          onClick={() => { if (window.confirm(`PERMANENTLY DELETE "${u.fullName || u.email}"? This cannot be undone.`)) onDeleteCustomer?.(u.id); }}
                                          className="flex items-center gap-0.5 px-2 py-1 bg-rose-600 hover:bg-rose-500 text-white text-[9px] font-bold rounded-lg cursor-pointer">
                                          <Trash2 size={10} /> Delete
                                        </button>
                                      </>
                                    )}
                                    {u.role !== "SUPER_ADMIN" && u.role !== "CUSTOMER" && (
                                      <button type="button" onClick={() => handleDeleteUserAccount(u)}
                                        className="flex items-center gap-0.5 px-2 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-[9px] font-bold rounded-lg cursor-pointer">
                                        <Trash2 size={10} /> Del
                                      </button>
                                    )}
                                  </div>
                                </td>
                              </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* ── Archived customers toggle ──────────────────────────── */}
                  {(userRoleFilter === "ALL" || userRoleFilter === "CUSTOMER") && (
                    <div className="rounded-2xl border border-amber-200 bg-amber-50 overflow-hidden">
                      <button
                        type="button"
                        onClick={() => setShowArchivedCustomers(v => !v)}
                        className="w-full flex items-center justify-between px-5 py-3.5 cursor-pointer hover:bg-amber-100 transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-sm">📦</span>
                          <span className="text-xs font-bold text-amber-800">
                            Archived Customers ({users.filter(u => u.role === "CUSTOMER" && u.isArchived).length})
                          </span>
                        </div>
                        <span className="text-[10px] font-bold text-amber-700">{showArchivedCustomers ? "▲ Hide" : "▼ Show"}</span>
                      </button>
                      {showArchivedCustomers && (
                        <div className="border-t border-amber-200 overflow-x-auto">
                          <table className="w-full text-left text-xs">
                            <thead>
                              <tr className="bg-amber-100 text-amber-900 text-[9px] uppercase tracking-wider">
                                <th className="py-2.5 px-4">Customer</th>
                                <th className="py-2.5 px-3">Archived On</th>
                                <th className="py-2.5 px-3">Actions</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-amber-100">
                              {users.filter(u => u.role === "CUSTOMER" && u.isArchived).map(u => (
                                <tr key={u.id} className="bg-white/60 hover:bg-amber-50 transition-colors">
                                  <td className="py-2.5 px-4">
                                    <p className="font-bold text-[#2c2a29]">{u.fullName || u.name}</p>
                                    <p className="text-[10px] text-[#7c756d]">{u.email}</p>
                                  </td>
                                  <td className="py-2.5 px-3 text-[10px] text-[#7c756d]">
                                    {u.archivedAt ? new Date(u.archivedAt).toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" }) : "—"}
                                  </td>
                                  <td className="py-2.5 px-3">
                                    <div className="flex gap-1.5">
                                      <button type="button"
                                        onClick={() => onUnarchiveCustomer?.(u.id)}
                                        className="flex items-center gap-0.5 px-2 py-1 bg-green-50 hover:bg-green-100 text-green-700 border border-green-200 text-[9px] font-bold rounded-lg cursor-pointer">
                                        ↩ Restore
                                      </button>
                                      <button type="button"
                                        onClick={() => { if (window.confirm(`PERMANENTLY DELETE "${u.fullName || u.email}"? This cannot be undone.`)) onDeleteCustomer?.(u.id); }}
                                        className="flex items-center gap-0.5 px-2 py-1 bg-rose-600 hover:bg-rose-500 text-white text-[9px] font-bold rounded-lg cursor-pointer">
                                        <Trash2 size={10} /> Delete Forever
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              ))}
                              {users.filter(u => u.role === "CUSTOMER" && u.isArchived).length === 0 && (
                                <tr><td colSpan={3} className="py-4 text-center text-xs text-[#7c756d]">No archived customers.</td></tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}

                  {/* ── All Bookings (admin view) ──────────────────────────── */}
                  <div className="space-y-3 pt-2">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <h5 className="font-display font-bold text-[#2c2a29] text-sm flex items-center gap-2">
                        <Calendar size={14} className="text-indigo-600" /> All Bookings
                        <span className="text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 px-2 py-0.5 rounded-full">
                          {bookings.filter(b => !b.isArchived).length} active
                        </span>
                      </h5>
                      <div className="flex gap-2 flex-wrap">
                        <div className="relative">
                          <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                          <input value={bookingSearch} onChange={e => setBookingSearch(e.target.value)}
                            placeholder="Search ID or customer…"
                            className="pl-7 pr-3 py-1.5 text-[11px] border border-[#e5e1da] rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-300 bg-white w-44" />
                        </div>
                        <select value={bookingStatusFilter} onChange={e => setBookingStatusFilter(e.target.value)}
                          className="px-2 py-1.5 text-[11px] border border-[#e5e1da] rounded-xl focus:outline-none bg-white cursor-pointer">
                          {["All", "Pending", "Confirmed", "Completed", "Cancelled", "Rejected", "Expired"].map(s => (
                            <option key={s}>{s}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-[#e5e1da] overflow-hidden">
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                          <thead>
                            <tr className="bg-[#2c2a29] text-white text-[9px] uppercase tracking-wider">
                              <th className="py-2.5 px-4">Booking</th>
                              <th className="py-2.5 px-3">Customer</th>
                              <th className="py-2.5 px-3">Studio</th>
                              <th className="py-2.5 px-3">Date</th>
                              <th className="py-2.5 px-3">Status</th>
                              <th className="py-2.5 px-3">Amount</th>
                              <th className="py-2.5 px-3">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[#f0ede8]">
                            {bookings
                              .filter(b => !b.isArchived)
                              .filter(b => bookingStatusFilter === "All" || b.status === bookingStatusFilter)
                              .filter(b => !bookingSearch.trim() ||
                                b.id.toLowerCase().includes(bookingSearch.toLowerCase()) ||
                                (b.customerDetails?.fullName || "").toLowerCase().includes(bookingSearch.toLowerCase())
                              )
                              .slice(0, 50)
                              .map(b => {
                                const studio = studios.find(s => s.id === b.studioId);
                                const terminalStatuses = ["Completed", "Cancelled", "Rejected", "Expired", "No Show"];
                                const canArchive = terminalStatuses.includes(b.status);
                                return (
                                  <tr key={b.id} className="hover:bg-[#faf9f6]/60 transition-colors">
                                    <td className="py-2.5 px-4 font-mono text-[10px] font-bold text-[#2c2a29]">{b.id}</td>
                                    <td className="py-2.5 px-3 text-[10px] text-[#2c2a29]">{b.customerDetails?.fullName || "—"}</td>
                                    <td className="py-2.5 px-3 text-[10px] text-[#7c756d]">{studio?.name || "—"}</td>
                                    <td className="py-2.5 px-3 text-[10px] text-[#7c756d]">{b.bookingDate}</td>
                                    <td className="py-2.5 px-3">
                                      <span className={`inline-flex px-2 py-0.5 rounded-full text-[9px] font-bold border uppercase ${
                                        b.status === "Completed" ? "bg-green-50 text-green-700 border-green-200" :
                                        b.status === "Confirmed" ? "bg-blue-50 text-blue-700 border-blue-200" :
                                        b.status === "Pending" ? "bg-yellow-50 text-yellow-700 border-yellow-200" :
                                        "bg-gray-100 text-gray-600 border-gray-200"
                                      }`}>{b.status}</span>
                                    </td>
                                    <td className="py-2.5 px-3 text-[10px] font-bold text-emerald-700">₱{Number(b.totalAmount).toLocaleString()}</td>
                                    <td className="py-2.5 px-3">
                                      {canArchive ? (
                                        <button type="button"
                                          onClick={() => { if (window.confirm(`Archive booking ${b.id}?`)) onArchiveBooking?.(b.id); }}
                                          className="flex items-center gap-0.5 px-2 py-1 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 text-[9px] font-bold rounded-lg cursor-pointer">
                                          📦 Archive
                                        </button>
                                      ) : (
                                        <span className="text-[10px] text-gray-400">Active</span>
                                      )}
                                    </td>
                                  </tr>
                                );
                              })}
                            {bookings.filter(b => !b.isArchived).length === 0 && (
                              <tr><td colSpan={7} className="py-4 text-center text-xs text-[#7c756d]">No active bookings.</td></tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Archived bookings toggle */}
                    <div className="rounded-2xl border border-amber-200 bg-amber-50 overflow-hidden">
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
                                <th className="py-2.5 px-4">Booking</th>
                                <th className="py-2.5 px-3">Customer</th>
                                <th className="py-2.5 px-3">Status</th>
                                <th className="py-2.5 px-3">Archived On</th>
                                <th className="py-2.5 px-3">Actions</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-amber-100">
                              {bookings.filter(b => b.isArchived).map(b => (
                                <tr key={b.id} className="bg-white/60 hover:bg-amber-50 transition-colors">
                                  <td className="py-2.5 px-4 font-mono text-[10px] font-bold text-[#2c2a29]">{b.id}</td>
                                  <td className="py-2.5 px-3 text-[10px] text-[#2c2a29]">{b.customerDetails?.fullName || "—"}</td>
                                  <td className="py-2.5 px-3">
                                    <span className="inline-flex px-2 py-0.5 rounded-full text-[9px] font-bold border bg-gray-100 text-gray-600 border-gray-200 uppercase">{b.status}</span>
                                  </td>
                                  <td className="py-2.5 px-3 text-[10px] text-[#7c756d]">
                                    {b.archivedAt ? new Date(b.archivedAt).toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" }) : "—"}
                                  </td>
                                  <td className="py-2.5 px-3">
                                    <div className="flex gap-1.5">
                                      <button type="button"
                                        onClick={() => onUnarchiveBooking?.(b.id)}
                                        className="flex items-center gap-0.5 px-2 py-1 bg-green-50 hover:bg-green-100 text-green-700 border border-green-200 text-[9px] font-bold rounded-lg cursor-pointer">
                                        ↩ Restore
                                      </button>
                                      <button type="button"
                                        onClick={() => { if (window.confirm(`PERMANENTLY DELETE booking ${b.id}? This cannot be undone.`)) onDeleteBooking?.(b.id); }}
                                        className="flex items-center gap-0.5 px-2 py-1 bg-rose-600 hover:bg-rose-500 text-white text-[9px] font-bold rounded-lg cursor-pointer">
                                        <Trash2 size={10} /> Delete Forever
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              ))}
                              {bookings.filter(b => b.isArchived).length === 0 && (
                                <tr><td colSpan={5} className="py-4 text-center text-xs text-[#7c756d]">No archived bookings.</td></tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* ── All Print Orders (admin view) ─────────────────────── */}
                  <div className="space-y-3 pt-2">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <h5 className="font-display font-bold text-[#2c2a29] text-sm flex items-center gap-2">
                        🖨️ All Print Orders
                        <span className="text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200 px-2 py-0.5 rounded-full">
                          {printOrders.filter(o => !o.isArchived).length} active
                        </span>
                      </h5>
                      <div className="flex gap-2 flex-wrap">
                        <div className="relative">
                          <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                          <input value={printOrderSearch} onChange={e => setPrintOrderSearch(e.target.value)}
                            placeholder="Search by order ID…"
                            className="pl-7 pr-3 py-1.5 text-[11px] border border-[#e5e1da] rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-300 bg-white w-44" />
                        </div>
                        <select value={printOrderStatusFilter} onChange={e => setPrintOrderStatusFilter(e.target.value)}
                          className="px-2 py-1.5 text-[11px] border border-[#e5e1da] rounded-xl focus:outline-none bg-white cursor-pointer">
                          {["All", "Pending", "Confirmed", "Processing", "Completed", "Cancelled"].map(s => (
                            <option key={s}>{s}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-[#e5e1da] overflow-hidden">
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                          <thead>
                            <tr className="bg-[#2c2a29] text-white text-[9px] uppercase tracking-wider">
                              <th className="py-2.5 px-4">Order ID</th>
                              <th className="py-2.5 px-3">Studio</th>
                              <th className="py-2.5 px-3">Status</th>
                              <th className="py-2.5 px-3">Payment</th>
                              <th className="py-2.5 px-3">Amount</th>
                              <th className="py-2.5 px-3">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[#f0ede8]">
                            {printOrders
                              .filter(o => !o.isArchived)
                              .filter(o => printOrderStatusFilter === "All" || o.status === printOrderStatusFilter)
                              .filter(o => !printOrderSearch.trim() || o.id.toLowerCase().includes(printOrderSearch.toLowerCase()))
                              .slice(0, 50)
                              .map(o => {
                                const studio = studios.find(s => s.id === o.studioId);
                                const canArchive = ["Completed", "Cancelled"].includes(o.status);
                                return (
                                  <tr key={o.id} className="hover:bg-[#faf9f6]/60 transition-colors">
                                    <td className="py-2.5 px-4 font-mono text-[10px] font-bold text-[#2c2a29]">{o.id}</td>
                                    <td className="py-2.5 px-3 text-[10px] text-[#7c756d]">{studio?.name || "—"}</td>
                                    <td className="py-2.5 px-3">
                                      <span className={`inline-flex px-2 py-0.5 rounded-full text-[9px] font-bold border uppercase ${
                                        o.status === "Completed" ? "bg-green-50 text-green-700 border-green-200" :
                                        o.status === "Cancelled" ? "bg-gray-100 text-gray-600 border-gray-200" :
                                        "bg-blue-50 text-blue-700 border-blue-200"
                                      }`}>{o.status}</span>
                                    </td>
                                    <td className="py-2.5 px-3">
                                      <span className={`inline-flex px-2 py-0.5 rounded-full text-[9px] font-bold border uppercase ${
                                        o.paymentStatus === "Paid" ? "bg-green-50 text-green-700 border-green-200" :
                                        o.paymentStatus === "Pending Verification" ? "bg-yellow-50 text-yellow-700 border-yellow-200" :
                                        "bg-gray-100 text-gray-500 border-gray-200"
                                      }`}>{o.paymentStatus}</span>
                                    </td>
                                    <td className="py-2.5 px-3 text-[10px] font-bold text-emerald-700">₱{Number(o.totalAmount).toLocaleString()}</td>
                                    <td className="py-2.5 px-3">
                                      {canArchive ? (
                                        <button type="button"
                                          onClick={() => { if (window.confirm(`Archive print order ${o.id}?`)) onArchivePrintOrder?.(o.id); }}
                                          className="flex items-center gap-0.5 px-2 py-1 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 text-[9px] font-bold rounded-lg cursor-pointer">
                                          📦 Archive
                                        </button>
                                      ) : (
                                        <span className="text-[10px] text-gray-400">Active</span>
                                      )}
                                    </td>
                                  </tr>
                                );
                              })}
                            {printOrders.filter(o => !o.isArchived).length === 0 && (
                              <tr><td colSpan={6} className="py-4 text-center text-xs text-[#7c756d]">No active print orders.</td></tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Archived print orders toggle */}
                    <div className="rounded-2xl border border-amber-200 bg-amber-50 overflow-hidden">
                      <button type="button"
                        onClick={() => setShowArchivedPrintOrders(v => !v)}
                        className="w-full flex items-center justify-between px-5 py-3.5 cursor-pointer hover:bg-amber-100 transition-colors">
                        <div className="flex items-center gap-2">
                          <span className="text-sm">📦</span>
                          <span className="text-xs font-bold text-amber-800">
                            Archived Print Orders ({printOrders.filter(o => o.isArchived).length})
                          </span>
                        </div>
                        <span className="text-[10px] font-bold text-amber-700">{showArchivedPrintOrders ? "▲ Hide" : "▼ Show"}</span>
                      </button>
                      {showArchivedPrintOrders && (
                        <div className="border-t border-amber-200 overflow-x-auto">
                          <table className="w-full text-left text-xs">
                            <thead>
                              <tr className="bg-amber-100 text-amber-900 text-[9px] uppercase tracking-wider">
                                <th className="py-2.5 px-4">Order ID</th>
                                <th className="py-2.5 px-3">Status</th>
                                <th className="py-2.5 px-3">Archived On</th>
                                <th className="py-2.5 px-3">Actions</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-amber-100">
                              {printOrders.filter(o => o.isArchived).map(o => (
                                <tr key={o.id} className="bg-white/60 hover:bg-amber-50 transition-colors">
                                  <td className="py-2.5 px-4 font-mono text-[10px] font-bold text-[#2c2a29]">{o.id}</td>
                                  <td className="py-2.5 px-3">
                                    <span className="inline-flex px-2 py-0.5 rounded-full text-[9px] font-bold border bg-gray-100 text-gray-600 border-gray-200 uppercase">{o.status}</span>
                                  </td>
                                  <td className="py-2.5 px-3 text-[10px] text-[#7c756d]">
                                    {o.archivedAt ? new Date(o.archivedAt).toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" }) : "—"}
                                  </td>
                                  <td className="py-2.5 px-3">
                                    <div className="flex gap-1.5">
                                      <button type="button"
                                        onClick={() => onUnarchivePrintOrder?.(o.id)}
                                        className="flex items-center gap-0.5 px-2 py-1 bg-green-50 hover:bg-green-100 text-green-700 border border-green-200 text-[9px] font-bold rounded-lg cursor-pointer">
                                        ↩ Restore
                                      </button>
                                      <button type="button"
                                        onClick={() => { if (window.confirm(`PERMANENTLY DELETE print order ${o.id}? This cannot be undone.`)) onDeletePrintOrder?.(o.id); }}
                                        className="flex items-center gap-0.5 px-2 py-1 bg-rose-600 hover:bg-rose-500 text-white text-[9px] font-bold rounded-lg cursor-pointer">
                                        <Trash2 size={10} /> Delete Forever
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              ))}
                              {printOrders.filter(o => o.isArchived).length === 0 && (
                                <tr><td colSpan={4} className="py-4 text-center text-xs text-[#7c756d]">No archived print orders.</td></tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* 2. CATEGORIES SUB-TAB */}
              {managementSubTab === "categories" && (
                <div className="space-y-5">
                  <div className="space-y-1">
                    <h4 className="font-display text-base font-bold text-[#2c2a29]">Photography Categories & Taxonomies</h4>
                    <p className="text-xs text-[#7c756d]">Manage the photography specialties and categories available for studios to list under.</p>
                  </div>
                  <form onSubmit={handleCategorySubmit} className="flex flex-col sm:flex-row gap-3 items-end bg-[#faf9f6] border border-[#e5e1da] rounded-2xl p-4">
                    <div className="flex-1 space-y-1">
                      <label className="font-bold text-xs text-[#2c2a29]">Category Name</label>
                      <input value={newCatName} onChange={e => setNewCatName(e.target.value)} placeholder="e.g. Portrait Photography" required className="w-full bg-white border border-[#e5e1da] rounded-xl px-3 py-2.5 text-xs focus:outline-none focus:border-[#2c2a29]" />
                    </div>
                    <div className="flex-1 space-y-1">
                      <label className="font-bold text-xs text-[#2c2a29]">Description (optional)</label>
                      <input value={newCatDescription} onChange={e => setNewCatDescription(e.target.value)} placeholder="Brief description" className="w-full bg-white border border-[#e5e1da] rounded-xl px-3 py-2.5 text-xs focus:outline-none focus:border-[#2c2a29]" />
                    </div>
                    <button type="submit" className="py-2.5 px-5 bg-[#2c2a29] text-white rounded-xl text-xs font-bold uppercase tracking-wider cursor-pointer whitespace-nowrap">
                      {editingCategoryId ? "Save Edit" : "Add Category"}
                    </button>
                    {editingCategoryId && <button type="button" onClick={() => { setEditingCategoryId(null); setNewCatName(""); setNewCatDescription(""); }} className="py-2.5 px-4 text-xs font-bold text-gray-500 border border-gray-200 rounded-xl cursor-pointer">Cancel</button>}
                  </form>
                  <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-3">
                    {categories.map(cat => (
                      <div key={cat.id} className="bg-[#faf9f6] border border-[#e5e1da] rounded-2xl p-4 flex items-start justify-between">
                        <div>
                          <p className="font-bold text-sm text-[#2c2a29]">{cat.name}</p>
                          {cat.description && <p className="text-[11px] text-[#7c756d] mt-0.5">{cat.description}</p>}
                        </div>
                        <div className="flex gap-1 flex-shrink-0">
                          <button onClick={() => handleEditCategory(cat)} className="text-amber-600 hover:text-amber-800 p-1 cursor-pointer" title="Edit">
                            <Edit size={13} />
                          </button>
                          <button onClick={() => onDeleteCategory(cat.id)} className="text-red-500 hover:text-red-700 p-1 cursor-pointer" title="Delete">
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 3. CONTENT & FAQS SUB-TAB */}
              {managementSubTab === "cms" && (
                <div className="space-y-6">
                  {/* FAQs Section */}
                  <div className="bg-[#faf9f6] rounded-2xl border border-[#e5e1da] p-6 space-y-6">
                    <div className="space-y-1">
                      <h4 className="font-display text-base font-bold text-[#2c2a29]">Frequently Asked Questions</h4>
                      <p className="text-xs text-[#7c756d]">Manage the real questions shown on the public landing page and chatbot knowledge base.</p>
                    </div>
                    <form onSubmit={handleFaqSubmit} className="space-y-4 rounded-2xl border border-[#e5e1da] bg-white p-4 text-xs">
                      <div className="grid md:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <label className="font-bold text-[#2c2a29] block">Question</label>
                          <input value={faqQuestion} onChange={e => setFaqQuestion(e.target.value)} placeholder="How do I book a studio slot?" className="w-full bg-[#faf9f6] border border-[#e5e1da] rounded-xl px-3 py-2 focus:outline-none focus:border-[#2c2a29]" />
                        </div>
                        <div className="space-y-1.5">
                          <label className="font-bold text-[#2c2a29] block">Category</label>
                          <select value={faqCategory} onChange={e => setFaqCategory(e.target.value)} className="w-full bg-[#faf9f6] border border-[#e5e1da] rounded-xl px-3 py-2 focus:outline-none focus:border-[#2c2a29]">
                            <option value="General">General</option>
                            <option value="Booking">Booking</option>
                            <option value="Payments">Payments</option>
                            <option value="Policies">Policies</option>
                            <option value="Services">Services</option>
                          </select>
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <label className="font-bold text-[#2c2a29] block">Answer</label>
                        <textarea value={faqAnswer} onChange={e => setFaqAnswer(e.target.value)} rows={4} placeholder="Provide the real answer clients need to see." className="w-full bg-[#faf9f6] border border-[#e5e1da] rounded-xl px-3 py-2 focus:outline-none focus:border-[#2c2a29]" />
                      </div>
                      <div className="flex justify-end">
                        <button type="submit" className="px-4 py-2 bg-[#2c2a29] text-white rounded-xl font-bold text-[10px] uppercase tracking-wider cursor-pointer">Save FAQ</button>
                      </div>
                    </form>
                    <div className="space-y-4">
                      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-[10px] uppercase font-black tracking-wider text-amber-800">Chatbot FAQ Suggestions</p>
                            <p className="text-xs text-[#7c756d]">Repeated customer questions flagged from the chatbot answers.</p>
                          </div>
                          <span className="rounded-full bg-white border border-amber-300 px-3 py-1 text-[10px] font-black text-amber-800">{faqSuggestions.length}</span>
                        </div>
                        {faqSuggestions.length === 0 ? (
                          <div className="mt-3 rounded-xl border border-dashed border-amber-300 bg-white px-3 py-3 text-[11px] text-[#7c756d]">No repeated chatbot question patterns found yet.</div>
                        ) : (
                          <div className="mt-3 space-y-2">
                            {faqSuggestions.map((s) => (
                              <div key={s.id} className="rounded-xl border border-amber-200 bg-white p-3 space-y-2">
                                <div className="flex items-start justify-between gap-3">
                                  <div>
                                    <p className="text-[10px] font-black uppercase tracking-wider text-[#7c756d]">{s.category || "Suggested"} · {s.frequency || 1}x</p>
                                    <h4 className="font-bold text-sm text-[#2c2a29]">{s.question}</h4>
                                  </div>
                                  <button type="button" onClick={() => onApproveFaqSuggestion?.(s.id)} className="rounded-lg bg-[#2c2a29] px-3 py-2 text-[10px] font-black uppercase text-white hover:bg-amber-700 cursor-pointer">Approve</button>
                                </div>
                                <p className="text-xs text-gray-600 leading-relaxed">{s.answer}</p>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="space-y-3">
                        {faqs.length === 0 ? (
                          <div className="rounded-2xl border border-dashed border-[#e5e1da] bg-white p-6 text-center text-xs text-[#7c756d]">No FAQs added yet. Add your first real FAQ here.</div>
                        ) : (
                          faqs.map((faq) => (
                            <div key={faq.id} className="rounded-2xl border border-[#e5e1da] bg-white p-4 space-y-2">
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <p className="text-xs font-bold uppercase tracking-wider text-[#7c756d]">{faq.category || "General"}</p>
                                  <h4 className="font-bold text-sm text-[#2c2a29]">{faq.question}</h4>
                                </div>
                                <button type="button" onClick={() => onDeleteFaq?.(faq.id)} className="text-red-600 hover:text-red-800 text-[10px] font-bold uppercase cursor-pointer">Delete</button>
                              </div>
                              <p className="text-xs text-gray-600 leading-relaxed">{faq.answer}</p>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>

                  {/* CMS Section */}
                  <div className="bg-[#faf9f6] rounded-2xl border border-[#e5e1da] p-6 space-y-6">
                    <div className="space-y-1">
                      <h4 className="font-display text-base font-bold text-[#2c2a29]">Content Management System</h4>
                      <p className="text-xs text-[#7c756d]">Update primary marketing messages, descriptions, call-to-actions, and background assets live without re-deploying code.</p>
                    </div>
                    {cmsSuccess && (
                      <div className="bg-green-50 text-green-800 p-3 rounded-xl border border-green-200 font-bold text-xs flex items-center gap-2">
                        <CheckCircle size={16} className="text-green-600" />
                        <span>CMS settings updated successfully! Changes are active and visible in real-time.</span>
                      </div>
                    )}
                    <form onSubmit={handleCMSSubmit} className="space-y-6 max-w-4xl text-xs">
                      <div className="space-y-4">
                        <h5 className="font-display font-bold text-xs uppercase tracking-wider text-gray-500 pb-1 border-b border-gray-200">
                          1. Landing Page Hero Section Content
                        </h5>
                        <div className="grid md:grid-cols-2 gap-4">
                          <div className="space-y-1.5">
                            <label className="block font-bold text-[#2c2a29]">Hero Primary Headline Title</label>
                            <textarea
                              rows={2}
                              required
                              value={heroTitle}
                              onChange={e => setHeroTitle(e.target.value)}
                              placeholder="e.g. Frame Your Story. <br /> Book Cainta Studios."
                              className="w-full bg-white border border-[#e5e1da] rounded-xl p-3 focus:outline-none focus:border-[#2c2a29] font-mono"
                            />
                            <p className="text-[9px] text-gray-400">Supports normal HTML tags (e.g. &lt;br /&gt;) for layout highlights.</p>
                          </div>
                          <div className="space-y-1.5">
                            <label className="block font-bold text-[#2c2a29]">Hero Subtitle / Description Paragraph</label>
                            <textarea
                              rows={3}
                              required
                              value={heroSubtitle}
                              onChange={e => setHeroSubtitle(e.target.value)}
                              placeholder="Compare live availability across Cainta, Rizal..."
                              className="w-full bg-white border border-[#e5e1da] rounded-xl p-3 focus:outline-none focus:border-[#2c2a29] leading-relaxed"
                            />
                          </div>
                        </div>
                        <div className="space-y-1.5">
                          <label className="block font-bold text-[#2c2a29]">Hero Ambient Background Image URL</label>
                          <div className="flex gap-2">
                            <input
                              type="url"
                              required
                              value={heroBackground}
                              onChange={e => setHeroBackground(e.target.value)}
                              placeholder="https://images.unsplash.com/photo-..."
                              className="flex-1 bg-white border border-[#e5e1da] rounded-xl px-4 py-2.5 focus:outline-none focus:border-[#2c2a29]"
                            />
                            <label
                              htmlFor="hero-background-upload"
                              className={`px-4 bg-[#2c2a29] hover:bg-black rounded-xl text-white font-bold border border-[#2c2a29] cursor-pointer flex items-center gap-1 ${uploadingHeroBackground ? "opacity-60 pointer-events-none" : ""}`}
                              title="Upload Image from Device"
                            >
                              <Upload size={13} /> {uploadingHeroBackground ? "Uploading..." : "Upload"}
                            </label>
                            <input
                              id="hero-background-upload"
                              type="file"
                              accept="image/jpeg,image/png,image/webp"
                              onChange={handleHeroBackgroundUpload}
                              className="hidden"
                              disabled={uploadingHeroBackground}
                            />
                            <button
                              type="button"
                              onClick={() => window.open(heroBackground, "_blank")}
                              className="px-4 bg-gray-100 hover:bg-gray-200 rounded-xl text-gray-700 font-bold border border-gray-200 cursor-pointer flex items-center gap-1"
                            >
                              <Eye size={13} /> Preview
                            </button>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-4 pt-4 border-t border-gray-200">
                        <h5 className="font-display font-bold text-xs uppercase tracking-wider text-gray-500 pb-1 border-b border-gray-200">
                          2. Signature Retouching / About Section Content
                        </h5>
                        <div className="grid md:grid-cols-2 gap-4">
                          <div className="space-y-1.5">
                            <label className="block font-bold text-[#2c2a29]">About Block Section Title</label>
                            <input
                              type="text"
                              required
                              value={aboutTitle}
                              onChange={e => setAboutTitle(e.target.value)}
                              placeholder="Pristine Studio Lighting & Retouching"
                              className="w-full bg-white border border-[#e5e1da] rounded-xl px-4 py-2.5 focus:outline-none focus:border-[#2c2a29] font-bold"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <label className="block font-bold text-[#2c2a29]">About Block Section Description</label>
                            <textarea
                              rows={2}
                              required
                              value={aboutDescription}
                              onChange={e => setAboutDescription(e.target.value)}
                              placeholder="Experience the difference of calibrated Profoto strobes..."
                              className="w-full bg-white border border-[#e5e1da] rounded-xl p-3 focus:outline-none focus:border-[#2c2a29] leading-relaxed"
                            />
                          </div>
                        </div>
                      </div>

                      <div className="pt-2">
                        <button
                          type="submit"
                          disabled={savingCms}
                          className="px-6 py-3 bg-[#2c2a29] hover:bg-yellow-500 hover:text-black text-white font-bold rounded-xl text-xs uppercase tracking-wider shadow-md cursor-pointer transition-all flex items-center gap-2"
                        >
                          <Sparkles size={14} />
                          {savingCms ? "Updating System CMS..." : "Apply Live CMS Changes"}
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}

              {/* 4. PAGE BUILDER SUB-TAB */}
              {managementSubTab === "pages" && (
                <div className="space-y-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-display text-base font-bold text-[#2c2a29]">Custom Page Builder</h4>
                      <p className="text-xs text-[#7c756d] mt-0.5">Create dynamic landing pages like workshops, about us, or announcements.</p>
                    </div>
                    {!isEditingPage && (
                      <button
                        onClick={() => {
                          setCurrentPageForm({
                            id: "",
                            createdAt: new Date().toISOString(),
                            title: "",
                            slug: "",
                            isPublished: true,
                            showInNavbar: true,
                            blocks: []
                          });
                          setIsEditingPage(true);
                        }}
                        className="py-2.5 px-4 bg-yellow-500 hover:bg-yellow-400 text-black font-extrabold rounded-xl text-xs uppercase tracking-wider shadow-sm cursor-pointer flex items-center gap-1.5"
                      >
                        <Plus size={16} /> Create Page
                      </button>
                    )}
                  </div>

                  {isEditingPage ? (
                    <div className="bg-[#faf9f6] p-6 rounded-3xl border border-[#e5e1da] space-y-6 text-left">
                      <div className="flex justify-between items-center border-b border-gray-200 pb-4">
                        <h5 className="font-display font-bold text-base text-[#2c2a29]">
                          {currentPageForm.id ? "Edit Custom Page" : "Create New Custom Page"}
                        </h5>
                        <button
                          onClick={() => setIsEditingPage(false)}
                          className="text-gray-400 hover:text-black font-bold text-xs cursor-pointer"
                        >
                          ✕ Cancel
                        </button>
                      </div>

                      <form onSubmit={handleSavePageForm} className="space-y-6">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                          <div className="space-y-1.5">
                            <label className="block font-bold text-[#2c2a29]">Page Title</label>
                            <input
                              type="text"
                              required
                              value={currentPageForm.title}
                              onChange={e => setCurrentPageForm({ ...currentPageForm, title: e.target.value, slug: currentPageForm.id ? currentPageForm.slug : e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-") })}
                              placeholder="e.g. Photography Masterclass & Workshop"
                              className="w-full bg-white border border-[#e5e1da] rounded-xl px-4 py-2.5 font-bold focus:outline-none focus:border-[#2c2a29]"
                            />
                          </div>

                          <div className="space-y-1.5">
                            <label className="block font-bold text-[#2c2a29]">URL Slug</label>
                            <input
                              type="text"
                              required
                              value={currentPageForm.slug}
                              onChange={e => setCurrentPageForm({ ...currentPageForm, slug: e.target.value })}
                              placeholder="photography-masterclass"
                              className="w-full bg-white border border-[#e5e1da] rounded-xl px-4 py-2.5 font-mono focus:outline-none focus:border-[#2c2a29]"
                            />
                          </div>
                        </div>

                        <div className="flex items-center gap-6 text-xs font-bold text-[#2c2a29]">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={currentPageForm.isPublished}
                              onChange={e => setCurrentPageForm({ ...currentPageForm, isPublished: e.target.checked })}
                              className="rounded text-[#2c2a29] focus:ring-0 w-4 h-4"
                            />
                            Publish Page (Visible to Public)
                          </label>

                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={currentPageForm.showInNavbar}
                              onChange={e => setCurrentPageForm({ ...currentPageForm, showInNavbar: e.target.checked })}
                              className="rounded text-[#2c2a29] focus:ring-0 w-4 h-4"
                            />
                            Show in Navbar / Menu
                          </label>
                        </div>

                        {/* Page Blocks Manager */}
                        <div className="space-y-4 pt-4 border-t border-gray-200">
                          <div className="flex items-center justify-between">
                            <h5 className="font-display font-bold text-sm text-[#2c2a29]">Page Design Blocks</h5>
                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={() => setIsPreviewingPage(!isPreviewingPage)}
                                className={`px-3 py-1.5 border border-[#e5e1da] rounded-lg text-[10px] font-bold uppercase tracking-wider cursor-pointer shadow-2xs ${isPreviewingPage ? 'bg-yellow-500 text-black border-yellow-600' : 'bg-white text-[#2c2a29] hover:bg-gray-50'}`}
                              >
                                <Eye size={12} className="inline mr-1" />
                                {isPreviewingPage ? "Edit Blocks" : "Preview Page"}
                              </button>
                              {!isPreviewingPage && ["hero", "text", "gallery", "faq", "pricing", "cta"].map(type => (
                                <button
                                  key={type}
                                  type="button"
                                  onClick={() => handleAddBlockToPage(type)}
                                  className="px-3 py-1.5 bg-white hover:bg-gray-100 text-[#2c2a29] border border-[#e5e1da] rounded-lg text-[10px] font-bold uppercase tracking-wider cursor-pointer shadow-2xs"
                                >
                                  + Add {type}
                                </button>
                              ))}
                            </div>
                          </div>

                          {isPreviewingPage ? (
                            <div className="border-4 border-dashed border-gray-200 rounded-3xl overflow-hidden bg-white mt-4 relative">
                              <div className="absolute top-0 w-full bg-gray-100 text-center text-[10px] font-bold text-gray-500 py-1 uppercase tracking-widest z-10 border-b border-gray-200">Live Preview Mode</div>
                              <div className="pointer-events-none mt-6">
                                <CustomPageView page={{ ...currentPageForm, createdAt: currentPageForm.createdAt || new Date().toISOString() }} onNavigate={() => {}} />
                              </div>
                            </div>
                          ) : (
                            <DragDropContext onDragEnd={handleDragEnd}>
                              <Droppable droppableId="blocks-list">
                                {(provided) => (
                                  <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-4">
                                    {currentPageForm.blocks.map((block: any, idx: number) => {
                                      const DraggableComp = Draggable as any;
                                      return (
                                        <DraggableComp key={block.id} draggableId={block.id} index={idx}>
                                          {(provided: any, snapshot: any) => (
                                            <div 
                                              ref={provided.innerRef}
                                              {...provided.draggableProps}
                                              className={`bg-white p-5 rounded-2xl border border-[#e5e1da] space-y-3 relative shadow-2xs transition-shadow ${snapshot.isDragging ? 'shadow-2xl ring-2 ring-yellow-500 z-50' : ''}`}
                                            >
                                              <div className="flex justify-between items-center border-b border-gray-100 pb-2 mb-2">
                                                <div className="flex items-center gap-2">
                                                  <div 
                                                    {...provided.dragHandleProps} 
                                                    className="text-gray-400 hover:text-black cursor-grab active:cursor-grabbing p-1"
                                                    title="Drag to reorder"
                                                  >
                                                    <GripVertical size={16} />
                                                  </div>
                                                  <span className="text-[10px] uppercase font-black bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded">
                                                    Block {idx + 1}: {block.type}
                                                  </span>
                                                </div>
                                                <button
                                                  type="button"
                                                  onClick={() => handleRemoveBlock(block.id)}
                                                  className="text-red-500 hover:text-red-700 cursor-pointer p-1 bg-red-50 rounded-lg transition-colors"
                                                  title="Delete block"
                                                >
                                                  <Trash2 size={15} />
                                                </button>
                                              </div>

                                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs pl-8">
                                                <input
                                                  type="text"
                                                  value={block.title || ""}
                                                  onChange={e => {
                                                    const updated = [...currentPageForm.blocks];
                                                    updated[idx].title = e.target.value;
                                                    setCurrentPageForm({ ...currentPageForm, blocks: updated });
                                                  }}
                                                  placeholder="Block Title"
                                                  className="bg-[#faf9f6] border border-[#e5e1da] rounded-xl px-3 py-2 font-bold focus:outline-none focus:border-yellow-600 focus:ring-1 focus:ring-yellow-600"
                                                />
                                                {block.type !== "faq" && block.type !== "pricing" && (
                                                  <input
                                                    type="url"
                                                    value={block.imageUrl || ""}
                                                    onChange={e => {
                                                      const updated = [...currentPageForm.blocks];
                                                      updated[idx].imageUrl = e.target.value;
                                                      setCurrentPageForm({ ...currentPageForm, blocks: updated });
                                                    }}
                                                    placeholder="Image URL"
                                                    className="bg-[#faf9f6] border border-[#e5e1da] rounded-xl px-3 py-2 focus:outline-none focus:border-yellow-600 focus:ring-1 focus:ring-yellow-600"
                                                  />
                                                )}
                                              </div>

                                              {block.type !== "faq" && block.type !== "pricing" && (
                                                <div className="pl-8">
                                                  <textarea
                                                    rows={2}
                                                    value={block.content || ""}
                                                    onChange={e => {
                                                      const updated = [...currentPageForm.blocks];
                                                      updated[idx].content = e.target.value;
                                                      setCurrentPageForm({ ...currentPageForm, blocks: updated });
                                                    }}
                                                    placeholder="Block Content / Description"
                                                    className="w-full bg-[#faf9f6] border border-[#e5e1da] rounded-xl p-3 text-xs leading-relaxed focus:outline-none focus:border-yellow-600 focus:ring-1 focus:ring-yellow-600"
                                                  />
                                                </div>
                                              )}
                                            </div>
                                          )}
                                        </DraggableComp>
                                      );
                                    })}
                                    {provided.placeholder}
                                  </div>
                                )}
                              </Droppable>
                            </DragDropContext>
                          )}
                        </div>

                        <div className="pt-4 flex justify-end gap-3">
                          <button
                            type="button"
                            onClick={() => setIsEditingPage(false)}
                            className="px-5 py-2.5 bg-gray-100 text-gray-700 rounded-xl font-bold text-xs cursor-pointer"
                          >
                            Cancel
                          </button>
                          <button
                            type="submit"
                            className="px-6 py-2.5 bg-[#2c2a29] hover:bg-yellow-500 hover:text-black text-white rounded-xl font-bold text-xs uppercase tracking-wider cursor-pointer shadow-md transition-all"
                          >
                            Save Custom Page
                          </button>
                        </div>
                      </form>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {customPages.length === 0 ? (
                        <div className="col-span-2 py-12 text-center text-xs text-[#7c756d] flex flex-col items-center gap-3">
                          <Globe className="text-gray-300" size={44} />
                          <span className="font-bold">No custom pages yet. Create your first page.</span>
                        </div>
                      ) : (
                        customPages.map(page => (
                          <div key={page.id} className="p-5 bg-[#faf9f6] border border-[#e5e1da] rounded-2xl flex justify-between items-start shadow-2xs">
                            <div className="space-y-1.5 text-left pr-3">
                              <div className="flex items-center gap-2">
                                <h5 className="font-display font-bold text-sm text-[#2c2a29]">{page.title}</h5>
                                <span className={`text-[9px] px-2 py-0.5 rounded font-black uppercase ${page.isPublished ? "bg-green-100 text-green-800" : "bg-gray-200 text-gray-700"}`}>
                                  {page.isPublished ? "Published" : "Draft"}
                                </span>
                              </div>
                              <p className="text-xs text-[#7c756d] font-mono">/page/{page.slug}</p>
                              <p className="text-[10px] text-gray-400">Blocks: {page.blocks?.length || 0} • Created: {new Date(page.createdAt).toLocaleDateString()}</p>
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => {
                                  setCurrentPageForm(page);
                                  setIsEditingPage(true);
                                }}
                                className="p-2 bg-white border border-[#e5e1da] hover:bg-gray-50 rounded-xl text-gray-700 font-bold text-xs cursor-pointer shadow-2xs"
                                title="Edit Page"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => handleDeletePage(page.id)}
                                className="p-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl text-xs cursor-pointer"
                                title="Delete Page"
                              >
                                <Trash2 size={15} />
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* 5. THEME & UI SUB-TAB */}
              {managementSubTab === "theme" && (
                <div className="space-y-6">
                  <div className="space-y-1">
                    <h4 className="font-display text-base font-bold text-[#2c2a29]">Theme & UI Branding</h4>
                    <p className="text-xs text-[#7c756d]">Customize platform colors, typography and header style. Changes apply instantly across all pages.</p>
                  </div>
                  {settingsSuccess && <div className="bg-green-50 text-green-800 p-3 rounded-xl border border-green-200 font-bold text-xs flex items-center gap-2"><CheckCircle size={16} className="text-green-600" /> Theme settings saved successfully!</div>}
                  {settingsError && <div className="bg-red-50 text-red-800 p-3 rounded-xl border border-red-200 font-bold text-xs flex items-center gap-2"><ShieldAlert size={16} /> {settingsError}</div>}
                  
                  <form onSubmit={handleSaveSettings} className="space-y-5 text-xs">
                    <div className="grid md:grid-cols-3 gap-4">
                      <div className="space-y-1.5">
                        <label className="font-bold text-[#2c2a29]">Primary Color</label>
                        <div className="flex items-center gap-2 border border-[#e5e1da] rounded-xl p-2 bg-[#faf9f6]">
                          <input type="color" value={systemSettings.primaryColor} onChange={e => setSystemSettings(prev => ({ ...prev, primaryColor: e.target.value }))} className="w-10 h-10 rounded-lg border-0 cursor-pointer" />
                          <span className="font-mono text-[10px] text-[#7c756d]">{systemSettings.primaryColor}</span>
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <label className="font-bold text-[#2c2a29]">Accent Color</label>
                        <div className="flex items-center gap-2 border border-[#e5e1da] rounded-xl p-2 bg-[#faf9f6]">
                          <input type="color" value={systemSettings.accentColor} onChange={e => setSystemSettings(prev => ({ ...prev, accentColor: e.target.value }))} className="w-10 h-10 rounded-lg border-0 cursor-pointer" />
                          <span className="font-mono text-[10px] text-[#7c756d]">{systemSettings.accentColor}</span>
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <label className="font-bold text-[#2c2a29]">Background Color</label>
                        <div className="flex items-center gap-2 border border-[#e5e1da] rounded-xl p-2 bg-[#faf9f6]">
                          <input type="color" value={systemSettings.backgroundColor} onChange={e => setSystemSettings(prev => ({ ...prev, backgroundColor: e.target.value }))} className="w-10 h-10 rounded-lg border-0 cursor-pointer" />
                          <span className="font-mono text-[10px] text-[#7c756d]">{systemSettings.backgroundColor}</span>
                        </div>
                      </div>
                    </div>

                    <div className="grid md:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="font-bold text-[#2c2a29]">Platform Font Family</label>
                        <select value={systemSettings.fontFamily} onChange={e => setSystemSettings(prev => ({ ...prev, fontFamily: e.target.value }))} className="w-full bg-[#faf9f6] border border-[#e5e1da] rounded-xl px-3.5 py-2.5 focus:outline-none">
                          <option value="sans">Plus Jakarta Sans (Modern Editorial)</option>
                          <option value="serif">Playfair Display (Luxury & Classic)</option>
                          <option value="inter">Inter (Clean & Functional)</option>
                          <option value="outfit">Outfit (Creative Studio)</option>
                        </select>
                      </div>
                      <div className="space-y-1.5">
                        <label className="font-bold text-[#2c2a29]">Navigation Header Style</label>
                        <select value={systemSettings.headerStyle} onChange={e => setSystemSettings(prev => ({ ...prev, headerStyle: e.target.value }))} className="w-full bg-[#faf9f6] border border-[#e5e1da] rounded-xl px-3.5 py-2.5 focus:outline-none">
                          <option value="standard">Standard (Solid White)</option>
                          <option value="glass">Glassmorphism (Frosted)</option>
                          <option value="dark">Dark Mode Header</option>
                          <option value="colored">Branded Color Header</option>
                        </select>
                      </div>
                    </div>

                    <button type="submit" disabled={savingSettings} className="w-full py-3.5 bg-[#2c2a29] hover:bg-black text-white font-extrabold rounded-xl text-xs uppercase tracking-wider shadow-md cursor-pointer">
                      {savingSettings ? "Saving Theme…" : "Apply Theme Changes"}
                    </button>
                  </form>

                  {/* LAN Wi-Fi Network Access State Card */}
                  {networkInfo && (
                    <div className="bg-[#faf9f6] border border-[#e5e1da] rounded-2xl p-5 space-y-3">
                      <div className="flex items-center justify-between">
                        <h5 className="font-display font-bold text-sm text-[#2c2a29] flex items-center gap-2">
                          <Radio size={16} className="text-emerald-600" /> Local Wi-Fi Network Connectivity
                        </h5>
                        <span className="text-[10px] font-bold px-2.5 py-0.5 bg-emerald-100 text-emerald-800 rounded-full">Active Host</span>
                      </div>
                      <p className="text-xs text-[#7c756d]">Connect smartphones, tablets, or client devices on the same Wi-Fi network without cables.</p>
                      <div className="grid sm:grid-cols-2 gap-3 text-xs">
                        <div className="p-3 bg-white border border-[#e5e1da] rounded-xl space-y-1">
                          <span className="text-[10px] font-bold uppercase text-gray-500">Local PC Access</span>
                          <p className="font-mono font-bold text-[#2c2a29]">{networkInfo.localUrl}</p>
                        </div>
                        <div className="p-3 bg-white border border-[#e5e1da] rounded-xl space-y-1">
                          <span className="text-[10px] font-bold uppercase text-gray-500">Network URL (Mobile)</span>
                          <div className="flex items-center justify-between gap-2">
                            <p className="font-mono font-bold text-emerald-700">{networkInfo.networkUrl}</p>
                            <button
                              type="button"
                              onClick={() => {
                                navigator.clipboard.writeText(networkInfo.networkUrl);
                                setCopiedLink(true);
                                setTimeout(() => setCopiedLink(false), 2000);
                              }}
                              className="text-[10px] font-bold text-blue-700 hover:underline flex items-center gap-1"
                            >
                              <Copy size={11} /> {copiedLink ? "Copied!" : "Copy"}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* SMTP Status */}
                  {smtpStatus && (
                    <div className="bg-[#faf9f6] border border-[#e5e1da] rounded-2xl p-5 space-y-3 text-xs">
                      <h5 className="font-display font-bold text-sm text-[#2c2a29] flex items-center gap-2">
                        <Mail size={16} className="text-yellow-600" /> Email Notifications Configuration (SMTP)
                      </h5>
                      <p className="text-gray-600">Sender: <strong>{smtpStatus.senderEmail}</strong> · Service: <strong>{smtpStatus.service}</strong></p>
                      <div className="flex gap-2">
                        <input
                          type="email"
                          value={testEmailInput}
                          onChange={e => setTestEmailInput(e.target.value)}
                          placeholder="recipient@example.com"
                          className="flex-1 bg-white border border-[#e5e1da] rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-[#2c2a29]"
                        />
                        <button
                          type="button"
                          disabled={sendingTestEmail}
                          onClick={async () => {
                            setSendingTestEmail(true);
                            setTestEmailResult(null);
                            try {
                              const d = await apiRequest("/api/admin/test-email", {
                                method: "POST",
                                body: { to: testEmailInput }
                              });
                              setTestEmailResult({ success: d.success, message: d.message });
                            } catch (err) {
                              setTestEmailResult({ success: false, message: err instanceof ApiError ? err.message : "Failed to send test email." });
                            } finally {
                              setSendingTestEmail(false);
                            }
                          }}
                          className="px-4 py-2 bg-[#2c2a29] text-white rounded-xl font-bold cursor-pointer hover:bg-black"
                        >
                          {sendingTestEmail ? "Sending..." : "Send Test"}
                        </button>
                      </div>
                      {testEmailResult && (
                        <p className={`font-bold ${testEmailResult.success ? "text-green-700" : "text-red-700"}`}>
                          {testEmailResult.message}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* 6. MODULES SUB-TAB */}
              {managementSubTab === "modules" && (
                <div className="space-y-5">
                  <div className="space-y-1">
                    <h4 className="font-display text-base font-bold text-[#2c2a29]">Feature Modules & System Toggles</h4>
                    <p className="text-xs text-[#7c756d]">Enable or disable platform-wide features. Changes take effect immediately without code deployment.</p>
                  </div>
                  {settingsSuccess && <div className="bg-green-50 text-green-800 p-3 rounded-xl border border-green-200 font-bold text-xs flex items-center gap-2"><CheckCircle size={16} className="text-green-600" /> Module settings saved!</div>}
                  <form onSubmit={handleSaveSettings} className="space-y-4">
                    {[
                      { key: "isChatbotEnabled", label: "AI Studio Chatbot", desc: "Customer-facing intelligent FAQ chat assistant powered by the platform's knowledge base." },
                      { key: "isPrintStoreEnabled", label: "Print Store", desc: "Allow studios to list photo print products and accept print orders from customers." },
                      { key: "isBookingEnabled", label: "Live Booking System", desc: "Enable customers to make and confirm studio photo shoot reservations." },
                      { key: "isMapEnabled", label: "Interactive Studio Map", desc: "Display the Cainta studio network map on the landing discovery page." },
                      { key: "isSoundEnabled", label: "Sound Engine & Chimes", desc: "Platform-wide ambient sound effects and welcome audio on page load." },
                      { key: "showDemoVideo", label: "Landing Page Video Tour", desc: "Show the Watch Video Tour button on the landing page. Hidden by default." },
                    ].map(({ key, label, desc }) => (
                      <div key={key} className="flex items-center justify-between gap-4 bg-[#faf9f6] border border-[#e5e1da] rounded-2xl p-4">
                        <div>
                          <p className="font-bold text-sm text-[#2c2a29]">{label}</p>
                          <p className="text-[11px] text-[#7c756d] mt-0.5">{desc}</p>
                        </div>
                        <button type="button" onClick={() => setSystemSettings(prev => ({ ...prev, [key]: !(prev as any)[key] }))} className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full transition-colors ${(systemSettings as any)[key] ? "bg-green-500" : "bg-gray-200"}`}>
                          <span className={`inline-block h-4 w-4 rounded-full bg-white shadow-md transform transition-transform mt-1 ${(systemSettings as any)[key] ? "translate-x-6" : "translate-x-1"}`} />
                        </button>
                      </div>
                    ))}
                    <div className="bg-[#faf9f6] border border-[#e5e1da] rounded-2xl p-4 space-y-2">
                      <label className="font-bold text-sm text-[#2c2a29] block">Demo Reel Video URL</label>
                      <p className="text-[11px] text-[#7c756d]">YouTube or direct MP4 link for the landing page hero demo video.</p>
                      <input type="url" value={systemSettings.demoVideoUrl || ""} onChange={e => setSystemSettings(prev => ({ ...prev, demoVideoUrl: e.target.value }))} placeholder="https://youtube.com/..." className="w-full bg-white border border-[#e5e1da] rounded-xl px-3.5 py-2.5 text-xs focus:outline-none focus:border-[#2c2a29]" />
                    </div>
                    <button type="submit" disabled={savingSettings} className="w-full py-3.5 bg-[#2c2a29] hover:bg-black text-white font-extrabold rounded-xl text-xs uppercase tracking-wider shadow-md cursor-pointer">
                      {savingSettings ? "Saving…" : "Save Module Configuration"}
                    </button>
                  </form>
                </div>
              )}

              {/* 7. AUDIO SUB-TAB */}
              {managementSubTab === "audio" && (
                <div className="space-y-6">
                  <div className="space-y-1">
                    <h4 className="font-display text-base font-bold text-[#2c2a29]">System Sound Effects & Custom Ambient Audio</h4>
                    <p className="text-xs text-[#7c756d]">Manage platform chimes, button clicks, and custom background audio for visitors.</p>
                  </div>
                  {settingsSuccess && (
                    <div className="bg-green-50 text-green-800 p-3 rounded-xl border border-green-200 font-bold text-xs flex items-center gap-2">
                      <CheckCircle size={16} className="text-green-600" /> Audio policy and sound settings saved successfully.
                    </div>
                  )}
                  <form onSubmit={handleSaveSettings} className="max-w-2xl space-y-6">
                    <CustomAudioPlayer
                      audioUrl={systemSettings.customAudioUrl}
                      enabled={systemSettings.customAudioEnabled}
                      onAudioChange={customAudioUrl => setSystemSettings({ ...systemSettings, customAudioUrl })}
                      onEnabledChange={customAudioEnabled => setSystemSettings({ ...systemSettings, customAudioEnabled })}
                    />
                    <button type="submit" disabled={savingSettings} className="w-full py-3.5 bg-[#2c2a29] hover:bg-black text-white font-extrabold rounded-xl text-xs uppercase tracking-wider shadow-md cursor-pointer">
                      {savingSettings ? "Saving Audio Settings..." : "Save Audio Configuration"}
                    </button>
                  </form>
                </div>
              )}

              {/* 8. AUDIT LOG SUB-TAB */}
              {managementSubTab === "audit" && (
                <div className="space-y-5">
                  <div className="space-y-1">
                    <h4 className="font-display text-base font-bold text-[#2c2a29]">Platform Immutable Security Audit Trail</h4>
                    <p className="text-xs text-[#7c756d]">Real-time system transaction tracking logging business, booking, and administrative state modifications.</p>
                  </div>
                  <div className="bg-[#faf9f6] border border-[#e5e1da] rounded-2xl divide-y divide-[#e5e1da] max-h-[420px] overflow-y-auto shadow-inner">
                    {auditLogs.length === 0 ? (
                      <div className="p-6 text-center text-xs text-[#7c756d]">No transactions recorded yet.</div>
                    ) : (
                      auditLogs.slice().reverse().map((log) => (
                        <div key={log.id} className="p-4 flex justify-between items-center text-xs">
                          <div className="text-left space-y-1 pr-4">
                            <p className="font-bold text-[#2c2a29] leading-snug">{log.message}</p>
                            <div className="flex gap-4 text-[10px] text-gray-500">
                              <span>Log ID: <strong>{log.id}</strong></span>
                              <span>Actor: <strong>{log.actorEmail}</strong></span>
                            </div>
                          </div>
                          <span className="text-[10px] text-gray-500 whitespace-nowrap">{new Date(log.createdAt).toLocaleTimeString()}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* 9. ADMIN ACCOUNT SUB-TAB */}
              {managementSubTab === "account" && (
                <div className="space-y-5">
                  <div className="space-y-1">
                    <h4 className="font-display text-base font-bold text-[#2c2a29]">Admin Account & Security</h4>
                    <p className="text-xs text-[#7c756d]">Update your super admin profile information and change your login password.</p>
                  </div>
                  <AccountSettings currentUser={currentUser} onUserUpdated={() => {}} />
                </div>
              )}

            </div>
          </div>
        )}

      </div>{/* end main content */}
    </div>{/* end page */}

      {/* Add User Modal */}
      {showAddUserModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-[#e5e1da] shadow-2xl max-w-lg w-full p-6 space-y-5 text-left relative animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div>
                <h3 className="font-display font-bold text-base text-[#2c2a29]">Create System User Account</h3>
                <p className="text-[11px] text-gray-500">Directly add Customer, Studio Staff, Studio Owner, or Super Admin accounts.</p>
              </div>
              <button
                onClick={() => setShowAddUserModal(false)}
                className="text-gray-400 hover:text-black p-1 rounded-full hover:bg-gray-100 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {userCreateMsg && (
              <div className={`p-3 rounded-xl text-xs font-bold flex items-center gap-2 ${
                userCreateMsg.type === "success"
                  ? "bg-green-50 text-green-800 border border-green-200"
                  : "bg-red-50 text-red-800 border border-red-200"
              }`}>
                {userCreateMsg.type === "success" ? <CheckCircle size={16} /> : <ShieldAlert size={16} />}
                <span>{userCreateMsg.text}</span>
              </div>
            )}

            <form onSubmit={handleCreateUserSubmit} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="font-bold text-gray-700">Account Role Type</label>
                <select
                  value={newRole}
                  onChange={e => setNewRole(e.target.value)}
                  className="w-full bg-[#faf9f6] border border-[#e5e1da] rounded-xl px-3 py-2 font-bold focus:outline-none focus:border-[#2c2a29]"
                >
                  <option value="CUSTOMER">Customer / Client</option>
                  <option value="STUDIO_ADMIN">Studio Owner (Admin)</option>
                  <option value="STUDIO_STAFF">Studio Staff / Photographer</option>
                  <option value="SUPER_ADMIN">Super Administrator</option>
                </select>
              </div>

              {(newRole === "STUDIO_ADMIN" || newRole === "STUDIO_STAFF") && (
                <div className="space-y-1">
                  <label className="font-bold text-gray-700">Assign to Photography Studio</label>
                  <select
                    value={newUserStudioId}
                    onChange={e => setNewUserStudioId(e.target.value)}
                    className="w-full bg-[#faf9f6] border border-[#e5e1da] rounded-xl px-3 py-2 font-bold focus:outline-none focus:border-[#2c2a29]"
                  >
                    <option value="">-- Independent / None --</option>
                    {studios.map(st => (
                      <option key={st.id} value={st.id}>{st.name}</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-gray-700">Full Name</label>
                  <input
                    type="text"
                    required
                    value={newUserFullName}
                    onChange={e => setNewUserFullName(e.target.value)}
                    placeholder="e.g. Maria Santos"
                    className="w-full bg-[#faf9f6] border border-[#e5e1da] rounded-xl px-3 py-2 focus:outline-none focus:border-[#2c2a29]"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-gray-700">Contact Number</label>
                  <input
                    type="text"
                    value={newUserContact}
                    onChange={e => setNewUserContact(e.target.value)}
                    placeholder="0917-000-0000"
                    className="w-full bg-[#faf9f6] border border-[#e5e1da] rounded-xl px-3 py-2 focus:outline-none focus:border-[#2c2a29]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-gray-700">Login Email Address</label>
                  <input
                    type="email"
                    required
                    value={newUserEmail}
                    onChange={e => setNewUserEmail(e.target.value)}
                    placeholder="maria@example.com"
                    className="w-full bg-[#faf9f6] border border-[#e5e1da] rounded-xl px-3 py-2 focus:outline-none focus:border-[#2c2a29]"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-gray-700">Initial Password</label>
                  <input
                    type="password"
                    required
                    value={newUserPassword}
                    onChange={e => setNewUserPassword(e.target.value)}
                    placeholder="Min. 8 characters"
                    className="w-full bg-[#faf9f6] border border-[#e5e1da] rounded-xl px-3 py-2 focus:outline-none focus:border-[#2c2a29]"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-gray-700">Address / Location</label>
                <input
                  type="text"
                  value={newUserAddress}
                  onChange={e => setNewUserAddress(e.target.value)}
                  placeholder="Cainta, Rizal"
                  className="w-full bg-[#faf9f6] border border-[#e5e1da] rounded-xl px-3 py-2 focus:outline-none focus:border-[#2c2a29]"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddUserModal(false)}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-bold cursor-pointer"
                >
                  Close
                </button>
                <button
                  type="submit"
                  disabled={userCreateLoading}
                  className="px-5 py-2 bg-[#2c2a29] hover:bg-yellow-500 hover:text-black text-white font-bold rounded-xl transition-all cursor-pointer shadow-sm"
                >
                  {userCreateLoading ? "Creating Account..." : "Create Account"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Document Full Preview Modal */}
      {selectedDocPreview && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-[#e5e1da] shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col relative animate-in fade-in zoom-in-95 duration-150">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between bg-[#2c2a29] text-white">
              <h3 className="font-display font-bold text-sm flex items-center gap-2">
                <FileText size={16} className="text-yellow-400" />
                {selectedDocPreview.title}
              </h3>
              <div className="flex items-center gap-3">
                <a
                  href={selectedDocPreview.url}
                  download="document"
                  className="text-xs bg-yellow-500 hover:bg-yellow-400 text-black px-3 py-1 rounded-lg font-bold transition-colors"
                >
                  Download File
                </a>
                <button
                  onClick={() => {
                    if (selectedDocPreview.url.startsWith("blob:")) URL.revokeObjectURL(selectedDocPreview.url);
                    setSelectedDocPreview(null);
                  }}
                  className="text-gray-300 hover:text-white p-1 rounded-full hover:bg-white/10 transition-colors"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            <div className="p-4 sm:p-6 overflow-y-auto flex-1 flex items-center justify-center bg-gray-100">
              {(selectedDocPreview.kind === "image" || selectedDocPreview.url.startsWith("data:image/")) ? (
                <img
                  src={selectedDocPreview.url}
                  alt={selectedDocPreview.title}
                  className="w-full max-w-2xl h-auto max-h-[68vh] object-contain rounded-xl shadow-lg border border-gray-200 bg-white"
                />
              ) : (
                <iframe
                  src={selectedDocPreview.url}
                  title={selectedDocPreview.title}
                  className="w-full h-[68vh] border-0 rounded-xl bg-white shadow-inner"
                />
              )}
            </div>
          </div>
        </div>
      )}
      {/* Super Admin Payment full-details View (presentable fitted modal) */}
      {viewingPayment && (
        <SuperAdminPaymentView
          payment={viewingPayment}
          onClose={() => setViewingPayment(null)}
          onOpenProof={(p) => openPaymentProof(p)}
        />
      )}

      {/* Super Admin Review full-details View (presentable fitted modal) */}
      {viewingReview && (
        <SuperAdminReviewView
          review={viewingReview}
          onClose={() => setViewingReview(null)}
          onStatusChange={(updated) => {
            setAdminReviews(prev => prev.map(r => r.id === updated.id ? updated : r));
            setViewingReview((prev: any) => prev ? { ...prev, status: updated.status } : prev);
          }}
        />
      )}

  </>);
}
