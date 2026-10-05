import React, { useState, useEffect, useRef } from "react";
import { Sparkles, Camera, Shield, User, Briefcase, Bell, X, AlertCircle } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";

// Components & Pages Imports
import Navbar from "./components/Navbar.tsx";
import Chatbot from "./components/Chatbot.tsx";
import InstallPrompt from "./components/InstallPrompt.tsx";
import BookingWizard from "./components/BookingWizard.tsx";
import PrintOrderWizard from "./components/PrintOrderWizard.tsx";
import CustomPageView from "./components/CustomPageView.tsx";
import { ScrollProgressBar } from "./components/MotionCard.tsx";
import { NotificationCenter } from "./components/NotificationCenter.tsx";
import { SoundEngine } from "./utils/soundEffects.ts";
import { apiRequest, ApiError } from "./utils/apiClient.ts";

import LandingPage from "./pages/LandingPage.tsx";
import StudioDirectory from "./pages/StudioDirectory.tsx";
import StudioProfile from "./pages/StudioProfile.tsx";
import CustomerDashboard from "./pages/CustomerDashboard.tsx";
import StudioDashboard from "./pages/StudioDashboard.tsx";
import AdminDashboard, { AdminTab } from "./pages/AdminDashboard.tsx";
import Login from "./pages/Login.tsx";
import AccountSettings from "./pages/AccountSettings.tsx";

export default function App() {
  // Navigation State
  const [currentPage, setCurrentPage] = useState<string>("landing");
  const [navigationParams, setNavigationParams] = useState<any>(null);
  const [adminTab, setAdminTab] = useState<AdminTab>("dashboard");

  // Authentication State
  const [currentUser, setCurrentUser] = useState<any | null>(() => {
    try {
      const storedUser = localStorage.getItem("cainta_current_user");
      return storedUser ? JSON.parse(storedUser) : null;
    } catch (error) {
      localStorage.removeItem("cainta_current_user");
      return null;
    }
  });
  const [isRestoringSession, setIsRestoringSession] = useState(true);

  // Central Database Lists (Synchronized from Express Server)
  const [studios, setStudios] = useState<any[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [packages, setPackages] = useState<any[]>([]);
  const [addons, setAddons] = useState<any[]>([]);
  const [reviews, setReviews] = useState<any[]>([]);
  const [printProducts, setPrintProducts] = useState<any[]>([]);
  const [printOrders, setPrintOrders] = useState<any[]>([]);
  const [bookings, setBookings] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [cms, setCms] = useState<{ [key: string]: string }>({});
  const [systemSettings, setSystemSettings] = useState<any>({
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
    hiddenNavItems: []
  });
  const [customPages, setCustomPages] = useState<any[]>([]);
  const [faqs, setFaqs] = useState<any[]>([]);
  const [faqSuggestions, setFaqSuggestions] = useState<any[]>([]);

  // Local-only Reactive State
  const [favorites, setFavorites] = useState<{ id: string; customerId: string; studioId: string }[]>([]);
  const [notifications, setNotifications] = useState<{ id: string; message: string; isRead: boolean; createdAt: string }[]>([]);

  // Modal wizards visibility
  const [activeBookingStudio, setActiveBookingStudio] = useState<any | null>(null);
  const [activePrintStudio, setActivePrintStudio] = useState<any | null>(null);
  const [initialBookingDate, setInitialBookingDate] = useState<string | null>(null);


  // Quick Switcher Box visible state (to help grader/user easily test all three roles in one click)
  const [showQuickSwitcher, setShowQuickSwitcher] = useState(true);

  // Keep a ref to the latest currentUser to avoid stale closure issues in timers and callbacks
  const currentUserRef = useRef<any>(currentUser);
  useEffect(() => {
    currentUserRef.current = currentUser;
  }, [currentUser]);

  // Fetch initial master lists from our Express REST server
  const fetchMasterData = async (authTokenOverride?: string, roleOverride?: string) => {
    try {
      const storedUser = (() => {
        try {
          const item = localStorage.getItem("cainta_current_user");
          return item ? JSON.parse(item) : null;
        } catch {
          return null;
        }
      })();

      const effectiveUser = authTokenOverride
        ? { authToken: authTokenOverride, role: roleOverride }
        : (currentUserRef.current || storedUser);

      const activeToken = authTokenOverride || effectiveUser?.authToken || "";
      const activeRole = roleOverride || effectiveUser?.role || "";
      const isAuthenticated = Boolean(activeToken);
      const isSuperAdmin = activeRole === "SUPER_ADMIN";

      // 1. Always fetch public endpoints
      const publicEndpoints = [
        "/api/studios",
        "/api/services",
        "/api/packages",
        "/api/addons",
        "/api/reviews",
        "/api/print-products",
        "/api/categories",
        "/api/cms",
        "/api/custom-pages",
        "/api/system/audio",
        "/api/system/demo-video"
      ];

      const publicData = await Promise.all(
        publicEndpoints.map(ep => apiRequest(ep).catch(() => ({})))
      );

      const faqData = await apiRequest("/api/chatbot/faqs").catch(() => null);
      if (faqData?.success) setFaqs(faqData.faqs || []);

      const suggestionsData = await apiRequest("/api/chatbot/faq-suggestions").catch(() => null);
      if (suggestionsData?.success) setFaqSuggestions(suggestionsData.suggestions || []);

      // For regular users, use the public approved studios list. For super admin, adminStudiosResponse below handles it.
      if (!isSuperAdmin && publicData[0]?.success) setStudios(publicData[0].studios);
      if (publicData[1]?.success) setServices(publicData[1].services);
      if (publicData[2]?.success) setPackages(publicData[2].packages);
      if (publicData[3]?.success) setAddons(publicData[3].addons);
      if (publicData[4]?.success) setReviews(publicData[4].reviews);
      if (publicData[5]?.success) setPrintProducts(publicData[5].printProducts);
      if (publicData[6]?.success) setCategories(publicData[6].categories);
      if (publicData[7]?.success) setCms(publicData[7].cms);
      if (publicData[8]?.success) setCustomPages(publicData[8].pages);
      if (publicData[9]?.success) {
        SoundEngine.configureApprovedAudio(publicData[9].audioUrl, publicData[9].isEnabled);
      }
      if (publicData[10]?.success) {
        setSystemSettings((prev: any) => ({
          ...prev,
          demoVideoUrl: publicData[10].demoVideoUrl || "",
          showDemoVideo: publicData[10].showDemoVideo === true
        }));
      }

      const authHeaders = activeToken ? { Authorization: `Bearer ${activeToken}` } : undefined;

      // Super admins need pending studios for the approval queue; public users only receive approved studios.
      if (isSuperAdmin && authHeaders) {
        const adminStudiosData = await apiRequest("/api/studios?includePending=true").catch(() => null);
        if (adminStudiosData?.success && Array.isArray(adminStudiosData.studios)) setStudios(adminStudiosData.studios);
      }

      // 2. Fetch authenticated endpoints only if logged in
      if (isAuthenticated && authHeaders) {
        const authEndpoints = [
          "/api/bookings",
          "/api/payments",
          "/api/print-orders"
        ];
        const authData = await Promise.all(
          authEndpoints.map(ep => apiRequest(ep).catch(() => null))
        );

        if (authData[0]?.success && Array.isArray(authData[0].bookings)) setBookings(authData[0].bookings);
        if (authData[1]?.success && Array.isArray(authData[1].payments)) setPayments(authData[1].payments);
        if (authData[2]?.success && Array.isArray(authData[2].printOrders)) setPrintOrders(authData[2].printOrders);
      } else {
        setBookings([]);
        setPayments([]);
        setPrintOrders([]);
      }

      // 3. Fetch Super Admin endpoints only if Super Admin
      if (isSuperAdmin && authHeaders) {
        const adminEndpoints = [
          "/api/users",
          "/api/audit-logs",
          "/api/admin/settings"
        ];
        const adminData = await Promise.all(
          adminEndpoints.map(ep => apiRequest(ep).catch(() => null))
        );

        if (adminData[0]?.success && Array.isArray(adminData[0].users)) setUsers(adminData[0].users);
        if (adminData[1]?.success && Array.isArray(adminData[1].auditLogs)) setAuditLogs(adminData[1].auditLogs);
        if (adminData[2]?.success && adminData[2].settings) setSystemSettings(adminData[2].settings);
      } else {
        setUsers([]);
        setAuditLogs([]);
      }

    } catch (error) {
      console.error("Failed to fetch initial application datasets:", error);
    }
  };

  useEffect(() => {
    let active = true;
    const restoreSession = async () => {
      const cachedUser = currentUserRef.current || (() => {
        try {
          const stored = localStorage.getItem("cainta_current_user");
          return stored ? JSON.parse(stored) : null;
        } catch {
          return null;
        }
      })();

      if (!cachedUser?.authToken) {
        await fetchMasterData();
        if (active) setIsRestoringSession(false);
        return;
      }
      try {
        const data = await apiRequest<{ user: any }>("/api/auth/session");
        if (active) {
          setCurrentUser(data.user);
          currentUserRef.current = data.user;
          localStorage.setItem("cainta_current_user", JSON.stringify(data.user));
        }
        await fetchMasterData(data.user.authToken, data.user.role);
      } catch {
        if (active) {
          localStorage.removeItem("cainta_current_user");
          currentUserRef.current = null;
          setCurrentUser(null);
        }
        await fetchMasterData();
      } finally {
        if (active) setIsRestoringSession(false);
      }
    };
    restoreSession();

    const handleSessionExpired = () => {
      if (!active) return;
      currentUserRef.current = null;
      setCurrentUser(null);
      setCurrentPage("login");
    };
    window.addEventListener("cainta:session-expired", handleSessionExpired);

    // In development (localhost), poll every 10 s so new bookings appear quickly on all dashboards.
    // In production on Render, keep 5 s so multi-dyno cache stays in sync.
    const pollInterval = (import.meta.env.DEV || !import.meta.env.VITE_API_BASE_URL) ? 10_000 : 5_000;
    const refreshTimer = window.setInterval(() => {
      fetchMasterData();
    }, pollInterval);

    // Keep the Render free-tier backend awake so it doesn't spin down.
    // Pings /api/studios (cheap public endpoint) every 4 minutes.
    const keepAliveTimer = window.setInterval(() => {
      const apiBase = (import.meta.env.VITE_API_BASE_URL || "").trim().replace(/\/+$/, "");
      if (apiBase) {
        fetch(`${apiBase}/api/studios`).catch(() => {/* ignore — best effort */});
      }
    }, 4 * 60 * 1000);

    // Automatically initialize and play welcome audio when the user visits or opens the web app
    SoundEngine.initAutoPlayOnVisit();

    return () => {
      active = false;
      window.clearInterval(refreshTimer);
      window.clearInterval(keepAliveTimer);
      window.removeEventListener("cainta:session-expired", handleSessionExpired);
    };
  }, [currentUser?.authToken]);

  // Sync favorites and notifications locally
  useEffect(() => {
    if (currentUser) {
      if (currentUser.role === "CUSTOMER") {
        apiRequest<{ favorites: { id: string; customerId: string; studioId: string }[] }>(`/api/favorites?customerId=${encodeURIComponent(currentUser.id)}`)
          .then(data => setFavorites(data.favorites))
          .catch(() => setFavorites([]));
      } else {
        setFavorites([]);
      }

      // Generate a welcome notification
      setNotifications([
        {
          id: `notif-${Date.now()}`,
          message: `Welcome to Cainta Photography Studio MIS, ${currentUser.fullName}! 🌟`,
          isRead: false,
          createdAt: new Date().toISOString()
        }
      ]);
    } else {
      setFavorites([]);
      setNotifications([]);
    }
  }, [currentUser]);

  // Handle favorite toggle
  const handleToggleFavorite = async (studioId: string) => {
    if (!currentUser) {
      alert("Please login first to bookmark photography studios!");
      setCurrentPage("login");
      return;
    }

    try {
      const exists = favorites.find(f => f.studioId === studioId);
      if (exists) {
        await apiRequest("/api/favorites", { method: "DELETE", body: { customerId: currentUser.id, studioId } });
        setFavorites(prev => prev.filter(f => f.studioId !== studioId));
      } else {
        const data = await apiRequest<{ favorite: { id: string; customerId: string; studioId: string } }>("/api/favorites", {
          method: "POST",
          body: { customerId: currentUser.id, studioId }
        });
        setFavorites(prev => [...prev, data.favorite]);
      }
    } catch (error) {
      alert(error instanceof Error ? error.message : "Unable to update favorite.");
    }
  };

  const handleRemoveFavorite = async (studioId: string) => {
    if (!currentUser) return;
    try {
      await apiRequest("/api/favorites", { method: "DELETE", body: { customerId: currentUser.id, studioId } });
      setFavorites(prev => prev.filter(f => f.studioId !== studioId));
    } catch (error) {
      alert(error instanceof Error ? error.message : "Unable to remove favorite.");
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!window.confirm("Delete this account permanently from the system? This action cannot be undone.")) return;
    try {
      const data = await apiRequest(`/api/users/${userId}`, { method: "DELETE" });
      if (data.success) {
        fetchMasterData();
      } else {
        alert(data.message || "Failed to delete user.");
      }
    } catch (error) {
      alert(error instanceof Error ? error.message : "Unable to delete user.");
    }
  };

  // ── Customer archive / unarchive / delete ──────────────────────────────────
  const handleArchiveCustomer = async (customerId: string) => {
    try {
      const data = await apiRequest(`/api/customers/${customerId}/archive`, { method: "PUT" });
      if (data.success) fetchMasterData();
      else alert(data.message || "Failed to archive customer.");
    } catch (err) { alert(err instanceof Error ? err.message : "Unable to archive customer."); }
  };

  const handleUnarchiveCustomer = async (customerId: string) => {
    try {
      const data = await apiRequest(`/api/customers/${customerId}/unarchive`, { method: "PUT" });
      if (data.success) fetchMasterData();
      else alert(data.message || "Failed to restore customer.");
    } catch (err) { alert(err instanceof Error ? err.message : "Unable to restore customer."); }
  };

  const handleDeleteCustomer = async (customerId: string) => {
    try {
      const data = await apiRequest(`/api/customers/${customerId}`, { method: "DELETE" });
      if (data.success) fetchMasterData();
      else alert(data.message || "Failed to delete customer.");
    } catch (err) { alert(err instanceof Error ? err.message : "Unable to delete customer."); }
  };

  // ── Booking archive / unarchive / delete ───────────────────────────────────
  const handleArchiveBooking = async (bookingId: string) => {
    try {
      const data = await apiRequest(`/api/bookings/${bookingId}/archive`, { method: "PUT" });
      if (data.success) fetchMasterData();
      else alert(data.message || "Failed to archive booking.");
    } catch (err) { alert(err instanceof Error ? err.message : "Unable to archive booking."); }
  };

  const handleUnarchiveBooking = async (bookingId: string) => {
    try {
      const data = await apiRequest(`/api/bookings/${bookingId}/unarchive`, { method: "PUT" });
      if (data.success) fetchMasterData();
      else alert(data.message || "Failed to restore booking.");
    } catch (err) { alert(err instanceof Error ? err.message : "Unable to restore booking."); }
  };

  const handleDeleteBooking = async (bookingId: string) => {
    try {
      const data = await apiRequest(`/api/bookings/${bookingId}`, { method: "DELETE" });
      if (data.success) fetchMasterData();
      else alert(data.message || "Failed to delete booking.");
    } catch (err) { alert(err instanceof Error ? err.message : "Unable to delete booking."); }
  };

  // ── Print order archive / unarchive / delete ───────────────────────────────
  const handleArchivePrintOrder = async (orderId: string) => {
    try {
      const data = await apiRequest(`/api/print-orders/${orderId}/archive`, { method: "PUT" });
      if (data.success) fetchMasterData();
      else alert(data.message || "Failed to archive print order.");
    } catch (err) { alert(err instanceof Error ? err.message : "Unable to archive print order."); }
  };

  const handleUnarchivePrintOrder = async (orderId: string) => {
    try {
      const data = await apiRequest(`/api/print-orders/${orderId}/unarchive`, { method: "PUT" });
      if (data.success) fetchMasterData();
      else alert(data.message || "Failed to restore print order.");
    } catch (err) { alert(err instanceof Error ? err.message : "Unable to restore print order."); }
  };

  const handleDeletePrintOrder = async (orderId: string) => {
    try {
      const data = await apiRequest(`/api/print-orders/${orderId}`, { method: "DELETE" });
      if (data.success) fetchMasterData();
      else alert(data.message || "Failed to delete print order.");
    } catch (err) { alert(err instanceof Error ? err.message : "Unable to delete print order."); }
  };

  // Navigates elegantly with optional page parameters
  const handleNavigate = (page: string, params?: any) => {
    setCurrentPage(page);
    setNavigationParams(params);
    // Reset admin tab to overview whenever the admin dashboard is opened fresh via navigation
    if (page === "admin-dashboard" && !params?.adminTab) {
      setAdminTab("dashboard");
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Logout routine
  const handleLogout = () => {
    if (currentUser?.authToken) {
      apiRequest("/api/auth/logout", { method: "POST" }).catch(() => undefined);
    }
    localStorage.removeItem("cainta_current_user");
    currentUserRef.current = null;
    setCurrentUser(null);
    setBookings([]);
    setPayments([]);
    setPrintOrders([]);
    setUsers([]);
    setAuditLogs([]);
    setCurrentPage("landing");
  };

  // Update Status callbacks (performs REST API modification on server)
  const handleUpdateStatus = async (type: "booking" | "print" | "payment", id: string, status: string) => {
    try {
      let url = "";
      if (type === "booking") url = `/api/bookings/${id}/status`;
      else if (type === "print") url = `/api/print-orders/${id}/status`;
      else if (type === "payment") url = `/api/payments/${id}/verify`;

      const rejectionReason = type === "payment" && status === "Rejected"
        ? window.prompt("Enter the rejection reason:")
        : undefined;
      if (type === "payment" && status === "Rejected" && !rejectionReason?.trim()) return;
      const data = await apiRequest(url, {
        method: "PUT",
        body: type === "payment"
          ? { approved: status === "Verified", ...(status === "Rejected" ? { reason: rejectionReason } : {}) }
          : { status }
      });
      setNotifications(prev => [{
        id: `notif-${Date.now()}`,
        message: `Status updated successfully: ${type} ${id} updated!`,
        isRead: false,
        createdAt: new Date().toISOString()
      }, ...prev]);
      fetchMasterData();
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to update status.");
    }
  };

  const handleRecordPrintCashPayment = async (id: string, options?: { cashTendered?: number; changeAmount?: number; markCompleted?: boolean }) => {
    try {
      await apiRequest(`/api/print-orders/${id}/payment/record-cash`, {
        method: "PUT",
        body: options || {}
      });
      fetchMasterData();
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to record cash payment.");
    }
  };

  // Settings update for studio operator
  const handleUpdateStudioSettings = async (settings: any) => {
    if (!currentUser || !currentUser.studioId) return;
    try {
      await apiRequest(`/api/studios/${currentUser.studioId}`, {
        method: "PUT",
        body: settings
      });
      fetchMasterData();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to update studio settings.");
    }
  };

  // Admin action triggers
  const handleAddGlobalFaq = async (payload: { question: string; answer: string; category: string }) => {
    try {
      const data = await apiRequest("/api/chatbot/faqs", {
        method: "POST",
        body: {
          studioId: "GLOBAL",
          question: payload.question,
          answer: payload.answer,
          category: payload.category || "FAQ"
        }
      });
      if (data.success) {
        fetchMasterData();
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to save FAQ.");
    }
  };

  const handleDeleteGlobalFaq = async (faqId: string) => {
    try {
      const data = await apiRequest(`/api/chatbot/faqs/${faqId}`, { method: "DELETE" });
      if (data.success) {
        fetchMasterData();
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete FAQ.");
    }
  };

  const handleAddStudioFaq = async (payload: { question: string; answer: string; category: string }) => {
    if (!currentUser?.studioId) return;
    try {
      const data = await apiRequest("/api/chatbot/faqs", {
        method: "POST",
        body: {
          studioId: currentUser.studioId,
          question: payload.question,
          answer: payload.answer,
          category: payload.category || "FAQ"
        }
      });
      if (data.success) {
        fetchMasterData();
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to save studio FAQ.");
    }
  };

  const handleDeleteStudioFaq = async (faqId: string) => {
    try {
      const data = await apiRequest(`/api/chatbot/faqs/${faqId}`, { method: "DELETE" });
      if (data.success) {
        fetchMasterData();
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete studio FAQ.");
    }
  };

  const handleApproveFaqSuggestion = async (suggestionId: string) => {
    try {
      const data = await apiRequest(`/api/chatbot/faq-suggestions/${suggestionId}/approve`, {
        method: "POST",
        body: { studioId: "GLOBAL", category: "Suggested" }
      });
      if (data.success) {
        fetchMasterData();
      } else {
        alert(data.message || "Failed to convert suggested FAQ.");
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to approve suggested FAQ.");
    }
  };

  const handleApproveStudio = async (studioId: string) => {
    try {
      await apiRequest(`/api/studios/${studioId}/approve`, {
        method: "PUT",
      });
      fetchMasterData();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to approve studio.");
    }
  };

  const handleRejectStudio = async (studioId: string) => {
    const reason = window.prompt("Optional rejection note for the studio owner:") || "";
    try {
      await apiRequest(`/api/studios/${studioId}/reject`, {
        method: "PUT",
        body: { reason }
      });
      fetchMasterData();
    } catch {
      alert("Failed to connect to the server.");
    }
  };

  const handleAddCategory = async (name: string, description = "") => {
    try {
      await apiRequest("/api/categories", {
        method: "POST",
        body: { name, description }
      });
      await fetchMasterData();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to add category.");
    }
  };

  const handleUpdateCategory = async (id: string, name: string, description = "") => {
    try {
      await apiRequest(`/api/categories/${id}`, {
        method: "PUT",
        body: { name, description }
      });
      await fetchMasterData();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to update category.");
    }
  };

  const handleDeleteCategory = async (id: string) => {
    try {
      await apiRequest(`/api/categories/${id}`, { method: "DELETE" });
      await fetchMasterData();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete category.");
    }
  };

  // Direct proof of downpayment submission from CustomerDashboard
  const handleUploadPayment = async (bookingId: string, payload: any) => {
    try {
      const data = await apiRequest("/api/payments", { method: "POST", body: payload });
      if (data.success) {
        setNotifications(prev => [
          {
            id: `notif-${Date.now()}`,
            message: `Proof of payment receipt uploaded for Booking ${bookingId}! Waiting for studio verification.`,
            isRead: false,
            createdAt: new Date().toISOString()
          },
          ...prev
        ]);
        fetchMasterData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleCancelBooking = async (bookingId: string, reason?: string) => {
    try {
      const data = await apiRequest(`/api/bookings/${bookingId}/cancel`, {
        method: "PUT",
        body: { reason }
      });
      if (data.success) {
        setNotifications(prev => [{
          id: `notif-${Date.now()}`,
          message: `Booking ${bookingId} was cancelled successfully.`,
          isRead: false,
          createdAt: new Date().toISOString()
        }, ...prev]);
        fetchMasterData();
      }
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to cancel booking.");
    }
  };

  // Post-modal follow-up after RescheduleModal already persisted the change:
  // never issues its own reschedule PUT (that would be a second request with
  // stale state). It merges the server-returned booking into local state,
  // posts an accurate notification, then re-fetches to converge all views.
  const handleRescheduleBooking = async (bookingId: string, booking?: any, reason?: string, opts?: { pendingApproval?: boolean }) => {
    try {
      const confirmed = (booking as any) || null;
      if (confirmed) {
        setBookings(prev => prev.map(b => (b.id === bookingId ? { ...b, ...confirmed } : b)));
        const pendingApproval = Boolean(opts?.pendingApproval);
        setNotifications(prev => [{
          id: `notif-${Date.now()}`,
          message: pendingApproval
            ? `Reschedule request for Booking ${bookingId} to ${confirmed.bookingDate || ""} at ${confirmed.timeSlot || ""} was submitted for studio approval.`
            : `Booking ${bookingId} rescheduled to ${confirmed.bookingDate || ""} at ${confirmed.timeSlot || ""}.`,
          isRead: false,
          createdAt: new Date().toISOString()
        }, ...prev]);
      }
      await fetchMasterData();
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to reschedule booking.");
    }
  };

  const handleProcessRefund = async (paymentId: string, reason: string, refundAmount?: number) => {
    try {
      const data = await apiRequest(`/api/payments/${paymentId}/refund`, {
        method: "PUT",
        body: { reason, refundAmount }
      });
      if (data.success) {
        setNotifications(prev => [{
          id: `notif-${Date.now()}`,
          message: `Refund processed for Payment ${paymentId}.`,
          isRead: false,
          createdAt: new Date().toISOString()
        }, ...prev]);
        fetchMasterData();
      }
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to process refund.");
    }
  };

  // Requirement PDF/Image upload callback
  const handleUploadRequirement = async (bookingId: string, fileName: string, fileData: string) => {
    try {
      const data = await apiRequest(`/api/bookings/${bookingId}/requirements`, {
        method: "PUT",
        body: { fileName, fileData }
      });
      if (data.success) {
        setNotifications(prev => [
          {
            id: `notif-${Date.now()}`,
            message: `Document '${fileName}' attached to your Shoot Booking Requirements successfully.`,
            isRead: false,
            createdAt: new Date().toISOString()
          },
          ...prev
        ]);
        fetchMasterData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Review submission callback
  const handleSubmitReview = async (reviewPayload: any): Promise<boolean> => {
    if (!currentUser?.authToken) {
      alert("Please sign in to submit a review.");
      return false;
    }

    try {
      const data = await apiRequest("/api/reviews", { method: "POST", body: reviewPayload });
      if (!data.success) {
        throw new Error(data.message || "Unable to submit review.");
      }

      setNotifications(prev => [
        {
          id: `notif-${Date.now()}`,
          message: `Thank you for rating your photoshoot! Your review is now pending the studio admin approval.`,
          isRead: false,
          createdAt: new Date().toISOString()
        },
        ...prev
      ]);
      fetchMasterData();
      return true;
    } catch (err) {
      console.error(err);
      alert(err instanceof Error ? err.message : "Unable to submit review.");
      return false;
    }
  };

  // Helpers to fetch filtered objects
  const unreadNotifications = notifications.filter(n => !n.isRead).length;

  const handleMarkNotificationsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
  };

  if (isRestoringSession) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "linear-gradient(135deg, #faf9f6 0%, #f0ede8 50%, #e8e3dc 100%)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "'Inter', 'Segoe UI', sans-serif",
          animation: "sessionFadeIn 0.6s ease-out",
        }}
      >
        <style>{`
          @keyframes sessionFadeIn {
            from { opacity: 0; transform: translateY(12px); }
            to   { opacity: 1; transform: translateY(0); }
          }
          @keyframes dotBounce {
            0%, 80%, 100% { transform: translateY(0); opacity: 0.4; }
            40%            { transform: translateY(-6px); opacity: 1; }
          }
          @keyframes progressShimmer {
            0%   { width: 0%;   opacity: 0.9; }
            60%  { width: 75%;  opacity: 1; }
            100% { width: 92%;  opacity: 0.85; }
          }
          @keyframes glowPulse {
            0%, 100% { box-shadow: 0 0 0 0 rgba(217,119,6,0.0); }
            50%       { box-shadow: 0 0 24px 6px rgba(217,119,6,0.18); }
          }
          .session-dot { display: inline-block; width: 7px; height: 7px; border-radius: 50%; background: #d97706; margin: 0 2.5px; animation: dotBounce 1.3s infinite; }
          .session-dot:nth-child(2) { animation-delay: 0.18s; }
          .session-dot:nth-child(3) { animation-delay: 0.36s; }
          .session-progress-bar {
            height: 4px; border-radius: 99px;
            background: linear-gradient(90deg, #d97706, #f59e0b, #fbbf24);
            animation: progressShimmer 2.4s cubic-bezier(.4,0,.2,1) forwards;
          }
          .session-gif-wrap {
            width: 140px; height: 140px;
            border-radius: 50%;
            border: 3px solid rgba(217,119,6,0.22);
            overflow: hidden;
            background: #fff;
            display: flex; align-items: center; justify-content: center;
            animation: glowPulse 2.4s ease-in-out infinite;
            box-shadow: 0 8px 32px rgba(44,42,41,0.10);
          }
        `}</style>

        {/* GIF circle */}
        <div className="session-gif-wrap" style={{ marginBottom: "28px" }}>
          <img
            src="/Waiting.gif"
            alt="Loading…"
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
            onError={(e) => {
              /* fallback: hide broken image gracefully */
              (e.currentTarget as HTMLImageElement).style.display = "none";
            }}
          />
        </div>

        {/* Studio brand */}
        <div style={{ marginBottom: "6px", display: "flex", alignItems: "center", gap: "8px" }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/><circle cx="12" cy="10" r="3"/><path d="M7 20.662V19a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v1.662"/>
          </svg>
          <span style={{ fontSize: "15px", fontWeight: 700, color: "#2c2a29", letterSpacing: "0.01em" }}>
            Cainta Photography Studio
          </span>
        </div>

        {/* Animated dots text */}
        <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "28px" }}>
          <span style={{ fontSize: "13px", color: "#7c756d", fontWeight: 500 }}>Restoring your session</span>
          <span className="session-dot" />
          <span className="session-dot" />
          <span className="session-dot" />
        </div>

        {/* Progress bar */}
        <div style={{ width: "220px", height: "4px", borderRadius: "99px", background: "rgba(44,42,41,0.08)", overflow: "hidden" }}>
          <div className="session-progress-bar" />
        </div>

        <p style={{ marginTop: "14px", fontSize: "11px", color: "#b0a89e", letterSpacing: "0.03em" }}>
          Setting up your experience…
        </p>
      </div>
    );
  }

  const themeColor = (value: unknown, fallback: string) =>
    typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value) ? value : fallback;
  const themePrimary = themeColor(systemSettings.primaryColor, "#2c2a29");
  const themeAccent = themeColor(systemSettings.accentColor, "#d97706");
  const themeBackground = themeColor(systemSettings.backgroundColor, "#faf9f6");

  return (
    <div
      className={`theme-root min-h-screen bg-[#faf9f6] text-[#2c2a29] flex flex-col font-sans antialiased relative selection:bg-yellow-100 selection:text-black app-font-${systemSettings.fontFamily || "sans"} ${currentUser && ["customer-dashboard", "customer-dashboard-prints", "customer-dashboard-favorites", "studio-dashboard", "admin-dashboard", "account-settings", "notifications"].includes(currentPage) ? "dashboard-mode" : ""}`}
      data-header-style={systemSettings.headerStyle || "standard"}
      style={{
        backgroundColor: themeBackground,
        color: themePrimary,
        ["--theme-primary" as string]: themePrimary,
        ["--theme-accent" as string]: themeAccent,
        ["--theme-background" as string]: themeBackground,
        ["--dashboard-canvas" as string]: themeBackground
      }}
    >
      {/* Dynamic Navigation Header Bar */}
      <Navbar
        currentUser={currentUser}
        onNavigate={handleNavigate}
        currentPage={currentPage}
        onLogout={handleLogout}
        favoritesCount={favorites.length}
        unreadNotifications={unreadNotifications}
        onOpenNotifications={() => handleNavigate("notifications")}
        systemSettings={systemSettings}
        customPages={customPages}
        adminTab={adminTab}
        onAdminTabChange={setAdminTab}
        studioTab={navigationParams?.studioTab || "bookings"}
        onStudioTabChange={(tab) => handleNavigate("studio-dashboard", { studioTab: tab })}
      />

      {/* Primary Visual Router Frame */}
      <div className="flex-1 app-router-frame">
        <AnimatePresence mode="wait">
          {currentPage.startsWith("custom-page-") && (() => {
            const slug = currentPage.replace("custom-page-", "");
            const customPage = customPages.find(p => p.slug === slug);
            if (!customPage) return <div className="p-12 text-center text-sm font-bold text-gray-500">Custom page not found or unpublished.</div>;
            return (
              <motion.div
                key={`custom-${slug}`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
              >
                <CustomPageView page={customPage} onNavigate={handleNavigate} />
              </motion.div>
            );
          })()}

          {currentPage === "landing" && (
            <motion.div
              key="landing"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
            >
              <LandingPage
                studios={studios}
                categories={categories}
                onNavigate={handleNavigate}
                favorites={favorites}
                onToggleFavorite={handleToggleFavorite}
                cms={cms}
                bookings={bookings}
                reviews={reviews}
                faqs={faqs.filter(f => f.studioId === "GLOBAL")}
                demoVideoUrl={systemSettings.demoVideoUrl || ""}
                showDemoVideo={systemSettings.showDemoVideo === true}
              />
            </motion.div>
          )}

          {currentPage === "directory" && (
            <motion.div
              key="directory"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
            >
              <StudioDirectory
                studios={studios}
                categories={categories}
                onNavigate={handleNavigate}
                favorites={favorites}
                onToggleFavorite={handleToggleFavorite}
                initialParams={navigationParams}
              />
            </motion.div>
          )}

          {currentPage === "profile" && navigationParams?.id && (
            <motion.div
              key="profile"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
            >
              {(() => {
                const selectedStudio = studios.find(s => s.id === navigationParams.id);
                if (!selectedStudio) return <div className="p-12 text-center text-xs">Loading studio metadata...</div>;
                
                const studioServices = services.filter(s => s.studioId === selectedStudio.id);
                const studioPackages = packages.filter(p => p.studioId === selectedStudio.id);
                const studioAddons = addons.filter(a => a.studioId === selectedStudio.id);
                const studioReviews = reviews.filter(r => r.studioId === selectedStudio.id);
                const studioPrints = printProducts.filter(p => p.studioId === selectedStudio.id);

                return (
                  <StudioProfile
                    studio={selectedStudio}
                    services={studioServices}
                    packages={studioPackages}
                    addons={studioAddons}
                    reviews={studioReviews}
                    printProducts={studioPrints}
                    favorites={favorites}
                    onToggleFavorite={handleToggleFavorite}
                    onOpenBookingWizard={() => {
                      if (!currentUser) {
                        alert("Please login to proceed with booking!");
                        handleNavigate("login");
                      } else {
                        setActiveBookingStudio(selectedStudio);
                      }
                    }}
                    onOpenPrintWizard={() => {
                      if (!currentUser) {
                        alert("Please login to order custom prints!");
                        handleNavigate("login");
                      } else {
                        setActivePrintStudio(selectedStudio);
                      }
                    }}
                  />
                );
              })()}
            </motion.div>
          )}

          {(currentPage === "customer-dashboard" || currentPage === "customer-dashboard-favorites") && currentUser && (
            <motion.div
              key={currentPage}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
            >
              <CustomerDashboard
                currentUser={currentUser}
                bookings={bookings.filter(b => b.customerId === currentUser.id)}
                printOrders={printOrders.filter(p => p.customerId === currentUser.id)}
                favorites={favorites}
                studios={studios}
                printProducts={printProducts}
                services={services}
                packages={packages}
                initialSubTab={currentPage === "customer-dashboard-favorites" ? "favorites" : "bookings"}
                onNavigate={handleNavigate}
                onUploadPayment={handleUploadPayment}
                onCancelBooking={handleCancelBooking}
                onRescheduleBooking={handleRescheduleBooking}
                onUploadRequirement={handleUploadRequirement}
                onSubmitReview={handleSubmitReview}
                onRemoveFavorite={handleRemoveFavorite}
                onArchiveBooking={handleArchiveBooking}
                onDeleteBooking={handleDeleteBooking}
                onArchivePrintOrder={handleArchivePrintOrder}
                onDeletePrintOrder={handleDeletePrintOrder}
              />
            </motion.div>
          )}

          {/* Quick Prints tab shortcut */}
          {currentPage === "customer-dashboard-prints" && currentUser && (
            <motion.div
              key="customer-dashboard-prints"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
            >
              <CustomerDashboard
                currentUser={currentUser}
                bookings={bookings.filter(b => b.customerId === currentUser.id)}
                printOrders={printOrders.filter(p => p.customerId === currentUser.id)}
                favorites={favorites}
                studios={studios}
                printProducts={printProducts}
                services={services}
                packages={packages}
                initialSubTab="prints"
                onNavigate={handleNavigate}
                onUploadPayment={handleUploadPayment}
                onCancelBooking={handleCancelBooking}
                onRescheduleBooking={handleRescheduleBooking}
                onUploadRequirement={handleUploadRequirement}
                onSubmitReview={handleSubmitReview}
                onRemoveFavorite={handleRemoveFavorite}
                onArchiveBooking={handleArchiveBooking}
                onDeleteBooking={handleDeleteBooking}
                onArchivePrintOrder={handleArchivePrintOrder}
                onDeletePrintOrder={handleDeletePrintOrder}
              />
            </motion.div>
          )}

          {currentPage === "studio-dashboard" && currentUser && currentUser.studioId && (
            <motion.div
              key="studio-dashboard"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
            >
              {(() => {
                const sObj = studios.find(s => s.id === currentUser.studioId);
                if (!sObj) return (
                  <div className="p-12 text-center space-y-3">
                    <div className="text-4xl">📷</div>
                    <h3 className="font-bold text-lg text-[#2c2a29]">Studio Not Found</h3>
                    <p className="text-xs text-[#7c756d] max-w-sm mx-auto">
                      Your studio account is pending Admin verification. Once the Super Admin approves your studio, you will have full access to the Studio Portal.
                    </p>
                    <div className="inline-block bg-amber-50 border border-amber-200 text-amber-800 text-xs font-bold px-4 py-2 rounded-xl">
                      ⏳ Awaiting Admin Approval
                    </div>
                  </div>
                );
                if (!sObj.isApproved) return (
                  <div className="p-12 text-center space-y-3">
                    <div className="text-4xl">⏳</div>
                    <h3 className="font-bold text-lg text-[#2c2a29]">Pending Verification</h3>
                    <p className="text-xs text-[#7c756d] max-w-sm mx-auto">
                      Your studio <strong>{sObj.name}</strong> is currently under review by the Admin. You can still access the Studio Portal to set up your branding and catalog while waiting for approval.
                    </p>
                    <StudioDashboard
                      currentUser={currentUser}
                      studio={sObj}
                      bookings={bookings}
                      printOrders={printOrders}
                      payments={payments}
                      reviews={reviews}
                      services={services}
                      packages={packages}
                      addons={addons}
                      printProducts={printProducts}
                      faqs={faqs.filter(f => f.studioId === sObj.id || f.studioId === "GLOBAL")}
                      onAddFaq={handleAddStudioFaq}
                      onDeleteFaq={handleDeleteStudioFaq}
                      onUpdateStatus={handleUpdateStatus}
                      onRecordPrintCashPayment={handleRecordPrintCashPayment}
                      onUpdateStudioSettings={handleUpdateStudioSettings}
                      onNavigateToAccount={() => handleNavigate("account-settings")}
                      initialTab={navigationParams?.studioTab}
                      onRefresh={fetchMasterData}
                      onArchiveBooking={handleArchiveBooking}
                      onUnarchiveBooking={handleUnarchiveBooking}
                      onDeleteBooking={handleDeleteBooking}
                      onArchivePrintOrder={handleArchivePrintOrder}
                      onUnarchivePrintOrder={handleUnarchivePrintOrder}
                      onDeletePrintOrder={handleDeletePrintOrder}
                    />
                  </div>
                );
                return (
                  <StudioDashboard
                    currentUser={currentUser}
                    studio={sObj}
                    bookings={bookings}
                    printOrders={printOrders}
                    payments={payments}
                    reviews={reviews}
                    services={services}
                    packages={packages}
                    addons={addons}
                    printProducts={printProducts}
                    faqs={faqs.filter(f => f.studioId === sObj.id || f.studioId === "GLOBAL")}
                    onAddFaq={handleAddStudioFaq}
                    onDeleteFaq={handleDeleteStudioFaq}
                    onUpdateStatus={handleUpdateStatus}
                    onRecordPrintCashPayment={handleRecordPrintCashPayment}
                    onProcessRefund={handleProcessRefund}
                    onUpdateStudioSettings={handleUpdateStudioSettings}
                    onNavigateToAccount={() => handleNavigate("account-settings")}
                    initialTab={navigationParams?.studioTab}
                    onRefresh={fetchMasterData}
                    onArchiveBooking={handleArchiveBooking}
                    onUnarchiveBooking={handleUnarchiveBooking}
                    onDeleteBooking={handleDeleteBooking}
                    onArchivePrintOrder={handleArchivePrintOrder}
                    onUnarchivePrintOrder={handleUnarchivePrintOrder}
                    onDeletePrintOrder={handleDeletePrintOrder}
                  />
                );
              })()}
            </motion.div>
          )}

          {currentPage === "admin-dashboard" && currentUser && (
            <motion.div
              key="admin-dashboard"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
            >
              <AdminDashboard
                studios={studios}
                bookings={bookings}
                printOrders={printOrders}
                payments={payments}
                users={users}
                categories={categories}
                auditLogs={auditLogs}
                cms={cms}
                faqs={faqs.filter(f => f.studioId === "GLOBAL")}
                faqSuggestions={faqSuggestions}
                onApproveFaqSuggestion={handleApproveFaqSuggestion}
                onApproveStudio={handleApproveStudio}
                onRejectStudio={handleRejectStudio}
                authToken={currentUser?.authToken}
                onAddCategory={handleAddCategory}
                onUpdateCategory={handleUpdateCategory}
                onDeleteCategory={handleDeleteCategory}
                onDeleteUser={handleDeleteUser}
                onArchiveCustomer={handleArchiveCustomer}
                onUnarchiveCustomer={handleUnarchiveCustomer}
                onDeleteCustomer={handleDeleteCustomer}
                onArchiveBooking={handleArchiveBooking}
                onUnarchiveBooking={handleUnarchiveBooking}
                onDeleteBooking={handleDeleteBooking}
                onArchivePrintOrder={handleArchivePrintOrder}
                onUnarchivePrintOrder={handleUnarchivePrintOrder}
                onDeletePrintOrder={handleDeletePrintOrder}
                onAddFaq={handleAddGlobalFaq}
                onDeleteFaq={handleDeleteGlobalFaq}
                onRefresh={fetchMasterData}
                activeTab={adminTab}
                onActiveTabChange={setAdminTab}
              />
            </motion.div>
          )}

          {currentPage === "login" && (
            <motion.div
              key="login"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
            >
              <Login
                cms={cms}
                onLoginSuccess={(user) => {
                  localStorage.setItem("cainta_current_user", JSON.stringify(user));
                  currentUserRef.current = user;
                  setCurrentUser(user);
                  fetchMasterData(user.authToken, user.role);
                  handleNavigate("landing");
                }}
                onNavigate={handleNavigate}
              />
            </motion.div>
          )}

          {currentPage === "notifications" && currentUser && (
            <NotificationCenter
              currentUser={currentUser}
              onNavigate={handleNavigate}
            />
          )}

          {currentPage === "account-settings" && currentUser && (
            <AccountSettings
              currentUser={currentUser}
              onUserUpdated={(user) => {
                localStorage.setItem("cainta_current_user", JSON.stringify(user));
                currentUserRef.current = user;
                setCurrentUser(user);
              }}
            />
          )}
        </AnimatePresence>
      </div>

      {/* FLOATING GEMINI CHATBOT ASSISTANT */}
      {systemSettings.isChatbotEnabled && (
        <Chatbot
          currentStudioId={navigationParams?.id}
          currentUser={currentUser}
          onNavigate={handleNavigate}
          onTriggerBooking={(studioId) => {
            const selected = studios.find(s => s.id === studioId);
            if (selected) {
              if (!currentUser) {
                alert("Please login first to make bookings!");
                handleNavigate("login");
              } else {
                setActiveBookingStudio(selected);
              }
            }
          }}
          onNavigateToServices={(studioId) => handleNavigate("profile", { id: studioId })}
          onNavigateToPackages={(studioId) => handleNavigate("profile", { id: studioId })}
        />
      )}

      {/* MODAL: STUNNING CAMERA SHUTTER SLIDE OVER BOOKING APPOINTMENTS */}
      <AnimatePresence>
        {activeBookingStudio && (
          <BookingWizard
            studio={activeBookingStudio}
            services={services.filter(s => s.studioId === activeBookingStudio.id)}
            packages={packages.filter(p => p.studioId === activeBookingStudio.id)}
            addons={addons.filter(a => a.studioId === activeBookingStudio.id)}
            currentUser={currentUser}
            initialDate={initialBookingDate || undefined}
            onClose={() => {
              setActiveBookingStudio(null);
              setInitialBookingDate(null);
            }}
            onSuccess={(bookingId) => {
              setActiveBookingStudio(null);
              setInitialBookingDate(null);
              // Trigger instant system notification
              setNotifications(prev => [
                {
                  id: `notif-${Date.now()}`,
                  message: `Successfully booked Appointment ${bookingId}! Please check your customer dashboard to monitor downpayment approval.`,
                  isRead: false,
                  createdAt: new Date().toISOString()
                },
                ...prev
              ]);
              fetchMasterData();
              handleNavigate("customer-dashboard");
            }}
          />
        )}
      </AnimatePresence>

      {/* MODAL: PHYSICAL CREATIVE PRINT ORDERS WIZARD */}
      <AnimatePresence>
        {activePrintStudio && (
          <PrintOrderWizard
            studio={activePrintStudio}
            printProducts={printProducts.filter(p => p.studioId === activePrintStudio.id)}
            currentUser={currentUser}
            onClose={() => setActivePrintStudio(null)}
            onSuccess={(orderId) => {
              setActivePrintStudio(null);
              setNotifications(prev => [
                {
                  id: `notif-${Date.now()}`,
                  message: `Print Order ${orderId} successfully submitted! Check print sales trackers.`,
                  isRead: false,
                  createdAt: new Date().toISOString()
                },
                ...prev
              ]);
              fetchMasterData();
              handleNavigate("customer-dashboard-prints");
            }}
          />
        )}
      </AnimatePresence>

      {/* Global photographic lens autofocus cursor follower */}
      <ScrollProgressBar />

      {/* PWA Install Prompt — shows after 3 seconds if app is installable */}
      <InstallPrompt />
    </div>
  );
}
