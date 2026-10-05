import React, { useState, useEffect } from "react";
import { Notification, User } from "../db/types";
import { 
  Bell, Smartphone, Mail, RefreshCw, MessageSquare, ArrowUpRight
} from "lucide-react";
import { apiRequest } from "../utils/apiClient.ts";

interface NotificationCenterProps {
  currentUser: User | null;
  onNavigate: (page: string, params?: any) => void;
}

export const NotificationCenter: React.FC<NotificationCenterProps> = ({ currentUser, onNavigate }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [filterType, setFilterType] = useState<"All" | Notification["type"]>("All");

  useEffect(() => {
    if (currentUser) {
      fetchNotifications();
    }
  }, [currentUser]);

  const fetchNotifications = async () => {
    if (!currentUser) return;
    try {
      setLoading(true);
      const data = await apiRequest(`/api/notifications?userId=${currentUser.id}`);
      if (data.success) {
        setNotifications(data.notifications || []);
      }
    } catch (err) {
      console.error("Failed loading notifications:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAsRead = async (id: string) => {
    try {
      await apiRequest(`/api/notifications/${id}/read`, { method: "PUT" });
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
    } catch (err) {
      console.error("Failed marking read:", err);
    }
  };

  const getNotificationDestination = (notification: Notification) => {
    const notificationText = `${notification.title} ${notification.message}`.toLowerCase();

    if (currentUser?.role === "SUPER_ADMIN" || notificationText.includes("admin")) {
      return "admin-dashboard";
    }
    if (currentUser?.role === "STUDIO_ADMIN") {
      return "studio-dashboard";
    }
    if (notificationText.includes("print")) {
      return "customer-dashboard-prints";
    }
    return "customer-dashboard";
  };

  const handleNotificationClick = async (notification: Notification) => {
    if (!notification.isRead) {
      await handleMarkAsRead(notification.id);
    }
    onNavigate(getNotificationDestination(notification));
  };

  const unreadCount = notifications.filter(n => !n.isRead).length;
  const roleLabel = currentUser?.role.replace("_", " ").toLowerCase() || "user";

  const filteredList = notifications.filter(n => {
    if (filterType === "All") return true;
    return n.type === filterType;
  });

  const typeStyles: Record<Notification["type"], string> = {
    info: "bg-sky-50 text-sky-700 border-sky-100",
    success: "bg-emerald-50 text-emerald-700 border-emerald-100",
    warning: "bg-amber-50 text-amber-700 border-amber-100",
    error: "bg-rose-50 text-rose-700 border-rose-100"
  };

  return (
    <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10 space-y-6 text-left">
      <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-[#e5e1da] pb-6">
        <div>
          <span className="text-[10px] uppercase tracking-[0.16em] text-[#b7791f] font-bold">Activity center</span>
          <h1 className="font-display text-3xl font-extrabold text-[#26384a] mt-1">Notifications</h1>
          <p className="text-sm text-[#748292] mt-1">Updates and alerts for your {roleLabel} account.</p>
        </div>
        <div className="bg-white border border-[#e5ebef] rounded-xl px-4 py-3 shadow-sm min-w-36">
          <span className="block text-[10px] uppercase tracking-wider text-[#748292] font-bold">Unread</span>
          <strong className="font-display text-2xl text-[#26384a]">{unreadCount}</strong>
        </div>
      </header>

      <section className="bg-white border border-[#e5ebef] rounded-2xl shadow-sm overflow-hidden">
        <div className="px-4 sm:px-6 py-4 border-b border-[#e5ebef] flex items-center gap-2 overflow-x-auto">
          {(["All", "info", "success", "warning", "error"] as const).map(type => (
            <button
              key={type}
              onClick={() => setFilterType(type)}
              className={`px-3 py-2 rounded-lg text-xs font-bold whitespace-nowrap transition-colors ${
                filterType === type ? "bg-[#26384a] text-white" : "text-[#748292] hover:bg-[#f3f7f8]"
              }`}
            >
              {type === "All" ? "All notifications" : type.charAt(0).toUpperCase() + type.slice(1)}
            </button>
          ))}
        </div>

        <div className="divide-y divide-[#e5ebef]">
          {loading ? (
            <div className="text-center py-16 text-[#748292]">
              <RefreshCw className="w-7 h-7 animate-spin mx-auto mb-3 text-[#b7791f]" />
              <p className="text-sm">Fetching notifications...</p>
            </div>
          ) : filteredList.length === 0 ? (
            <div className="text-center py-16 px-6 text-[#748292]">
              <MessageSquare className="w-9 h-9 mx-auto mb-3 text-[#b7c3cb]" />
              <p className="font-bold text-[#26384a]">You&apos;re all caught up</p>
              <p className="text-xs mt-1">No notifications in this category.</p>
            </div>
          ) : (
            filteredList.map(n => (
              <button
                key={n.id}
                type="button"
                onClick={() => handleNotificationClick(n)}
                className={`w-full text-left px-4 sm:px-6 py-5 flex items-start gap-4 transition-colors cursor-pointer hover:bg-[#f8fbfc] ${!n.isRead ? "bg-[#fffaf0]" : "bg-white"}`}
              >
                <span className={`shrink-0 w-10 h-10 rounded-xl border grid place-items-center ${typeStyles[n.type]}`}>
                  {n.channel === "SMS" ? <Smartphone size={17} /> : n.channel === "Email" ? <Mail size={17} /> : <Bell size={17} />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="font-bold text-sm text-[#26384a]">{n.title}</span>
                    {!n.isRead && <span className="w-2 h-2 rounded-full bg-[#d97706]" title="Unread" />}
                    <span className="text-[11px] text-[#9aa7af]">{new Date(n.createdAt).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}</span>
                  </span>
                  <span className="block text-sm text-[#61717d] leading-relaxed mt-1">{n.message}</span>
                  {n.recipientContact && <span className="inline-flex mt-3 text-[10px] text-[#748292] bg-[#f3f7f8] px-2 py-1 rounded-md border border-[#e5ebef] font-mono">Recipient: {n.recipientContact}</span>}
                </span>
                <ArrowUpRight size={17} className="shrink-0 text-[#9aa7af] mt-1" />
              </button>
            ))
          )}
        </div>
      </section>
    </main>
  );
};
