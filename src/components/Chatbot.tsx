import React, { useState, useRef, useEffect } from "react";
import { MessageSquare, X, Send, Sparkles, ArrowRight, Camera, ExternalLink, MapPin, Calendar, Printer, LayoutDashboard, LogIn, ClipboardList, Settings, CheckCircle, ShieldCheck } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { apiRequest } from "../utils/apiClient.ts";

interface ChatbotProps {
  currentStudioId?: string;
  onTriggerBooking: (studioId: string) => void;
  onNavigateToServices: (studioId: string) => void;
  onNavigateToPackages: (studioId: string) => void;
  onNavigate: (page: string, params?: any) => void;
  currentUser: any | null;
}

interface Message {
  sender: "user" | "bot";
  text: string;
  timestamp: Date;
}

// ── Role helpers ─────────────────────────────────────────────────────────────
type AppRole = "SUPER_ADMIN" | "STUDIO_ADMIN" | "STUDIO_STAFF" | "CUSTOMER" | "GUEST";

function deriveRole(currentUser: any | null): AppRole {
  if (!currentUser) return "GUEST";
  return (currentUser.role as AppRole) || "GUEST";
}

function getFirstName(currentUser: any | null): string {
  if (!currentUser?.fullName) return "";
  return currentUser.fullName.split(" ")[0];
}

function buildGreeting(role: AppRole, name: string): string {
  switch (role) {
    case "CUSTOMER":
      return `Hi ${name}! 👋 Welcome back to your Cainta Photography Guide. I can help you check your bookings, find studios, explore packages, or place a print order. What do you need today?`;
    case "STUDIO_ADMIN":
      return `Hello ${name}! 🎛️ Welcome to your Studio Assistant. Ask me about your studio's bookings, pending payments, services, or anything operational you need a hand with.`;
    case "STUDIO_STAFF":
      return `Hey ${name}! 📋 Studio Staff Assistant here. I can help you look up today's schedule, check booking details, or answer questions about studio operations. How can I help?`;
    case "SUPER_ADMIN":
      return `Hello ${name}! 🛡️ Super Admin Assistant ready. Ask me about pending studio approvals, platform-wide bookings, user management, or system settings. What do you need?`;
    default:
      return `Hello! I'm your AI Cainta Photography Guide. 🌟 Ask me about studios, services, packages, or how to book a session. You can also log in to access your personal dashboard!`;
  }
}

// Token pattern string — used to build fresh RegExp instances (never a shared /g const)
const TOKEN_PATTERN_STR = "\\[(?:book_now|view_services|view_packages|go_page|go_studio|external_link):[^\\]]+\\]";

function cleanBotText(raw: string): string {
  let result = "";
  let cursor = 0;
  let m: RegExpExecArray | null;

  const re = new RegExp(TOKEN_PATTERN_STR, "g");
  while ((m = re.exec(raw)) !== null) {
    if (m.index > cursor) {
      result += stripMarkdown(raw.slice(cursor, m.index));
    }
    result += m[0];
    cursor = re.lastIndex;
  }
  if (cursor < raw.length) {
    result += stripMarkdown(raw.slice(cursor));
  }

  return result.trim();
}

function stripMarkdown(seg: string): string {
  return seg
    .replace(/```[\s\S]*?```/g, m => m.replace(/```/g, ""))
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, "[external_link:$2|$1]")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/^\s*#{1,6}\s+/gm, "")
    .replace(/^\s*[-*+]\s+/gm, "• ")
    .replace(/^\s*\d+[.)]\s+/gm, "")
    .replace(/\*{1,3}([^*\n]+)\*{1,3}/g, "$1")
    .replace(/_{1,3}([^_\n]+)_{1,3}/g, "$1")
    .replace(/\n{3,}/g, "\n\n");
}

// ── Quick-reply chips per role ────────────────────────────────────────────────
interface QuickChip {
  label: string;
  prompt: string;
}

function getQuickChips(role: AppRole, currentStudioId?: string): QuickChip[] {
  switch (role) {
    case "GUEST":
      return [
        { label: "📍 Find a Studio", prompt: "Show me the available photography studios in Cainta." },
        { label: "💰 Pricing",       prompt: "What are the starting prices for photography packages?" },
        { label: "📅 How to Book",   prompt: "How do I book a photography session?" },
        { label: "🔑 Log In",        prompt: "How do I create an account or log in?" },
      ];
    case "CUSTOMER":
      return [
        { label: "📋 My Bookings",     prompt: "Show me how to check my current bookings." },
        { label: "🖼️ My Print Orders", prompt: "How do I view or manage my print orders?" },
        { label: "📦 Packages",        prompt: currentStudioId ? "What packages are available here?" : "What photography packages are available?" },
        { label: "💳 Payments",        prompt: "How do I pay for my booking or check payment status?" },
      ];
    case "STUDIO_STAFF":
      return [
        { label: "📅 Today's Schedule", prompt: "What bookings are scheduled for today in our studio?" },
        { label: "🔍 Check Booking",    prompt: "How do I look up a specific customer booking?" },
        { label: "📸 Photo Proofing",   prompt: "How does the photo proofing and gallery delivery work?" },
        { label: "🖨️ Print Orders",     prompt: "How do I manage print order requests from customers?" },
      ];
    case "STUDIO_ADMIN":
      return [
        { label: "📊 Dashboard",         prompt: "Give me a quick overview of what I can manage in the studio dashboard." },
        { label: "⏳ Pending Bookings",  prompt: "How do I view and confirm pending booking requests?" },
        { label: "💸 Payments",          prompt: "How do I review and approve customer payment submissions?" },
        { label: "🗓️ Availability",      prompt: "How do I set or update my studio's availability and blocked dates?" },
      ];
    case "SUPER_ADMIN":
      return [
        { label: "🏢 Pending Studios",   prompt: "How do I review and approve pending studio registrations?" },
        { label: "👥 User Management",   prompt: "How do I manage user accounts and roles on the platform?" },
        { label: "📈 Platform Overview", prompt: "Give me an overview of platform-wide stats and bookings." },
        { label: "⚙️ System Settings",   prompt: "What system settings can I configure as super admin?" },
      ];
    default:
      return [];
  }
}

export default function Chatbot({
  currentStudioId,
  onTriggerBooking,
  onNavigateToServices,
  onNavigateToPackages,
  onNavigate,
  currentUser
}: ChatbotProps) {
  const role = deriveRole(currentUser);
  const firstName = getFirstName(currentUser);

  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      sender: "bot",
      text: buildGreeting(role, firstName),
      timestamp: new Date()
    }
  ]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [chipsUsed, setChipsUsed] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Re-set greeting when user logs in or out mid-session
  const prevRoleRef = useRef<AppRole>(role);
  useEffect(() => {
    if (prevRoleRef.current !== role) {
      prevRoleRef.current = role;
      setMessages([{
        sender: "bot",
        text: buildGreeting(role, firstName),
        timestamp: new Date()
      }]);
      setChipsUsed(false);
    }
  }, [role, firstName]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async (text: string) => {
    if (!text.trim() || isLoading) return;

    setMessages(prev => [...prev, { sender: "user", text, timestamp: new Date() }]);
    setIsLoading(true);

    try {
      const data = await apiRequest("/api/chatbot/message", {
        method: "POST",
        body: {
          message: text,
          studioId: currentStudioId || undefined,
          // Pass user context so the server can build a role-specific system prompt
          userId: currentUser?.id || undefined,
          userRole: role !== "GUEST" ? role : undefined,
          userStudioId: currentUser?.studioId || undefined,
          history: messages.slice(-6).map(m => ({
            role: m.sender === "user" ? "user" : "model",
            text: m.text
          }))
        }
      });
      setMessages(prev => [...prev, { sender: "bot", text: cleanBotText(data.text), timestamp: new Date() }]);
    } catch (error) {
      console.error("Chat error", error);
      setMessages(prev => [
        ...prev,
        {
          sender: "bot",
          text: "I'm having a little trouble connecting right now. Please try again in a moment.",
          timestamp: new Date()
        }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const text = inputValue.trim();
    setInputValue("");
    await sendMessage(text);
  };

  const handleChip = (chip: QuickChip) => {
    setChipsUsed(true);
    sendMessage(chip.prompt);
  };

  // ── Page/action configs ──────────────────────────────────────────────────
  const PAGE_LINK_META: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
    landing:                       { label: "Go to Home",             icon: <Camera size={13} />,          color: "bg-[#2c2a29] hover:bg-[#4a4644] text-white" },
    directory:                     { label: "Browse All Studios",     icon: <MapPin size={13} />,           color: "bg-[#2c2a29] hover:bg-[#4a4644] text-white" },
    login:                         { label: "Log In / Sign Up",       icon: <LogIn size={13} />,            color: "bg-[#2c2a29] hover:bg-[#4a4644] text-white" },
    "customer-dashboard":          { label: "My Dashboard",           icon: <LayoutDashboard size={13} />,  color: "bg-[#2c2a29] hover:bg-[#4a4644] text-white" },
    "customer-dashboard-prints":   { label: "My Print Orders",        icon: <Printer size={13} />,          color: "bg-[#2c2a29] hover:bg-[#4a4644] text-white" },
    "customer-dashboard-bookings": { label: "My Bookings",            icon: <Calendar size={13} />,         color: "bg-[#2c2a29] hover:bg-[#4a4644] text-white" },
    "studio-dashboard":            { label: "Studio Dashboard",       icon: <ClipboardList size={13} />,    color: "bg-[#2c2a29] hover:bg-[#4a4644] text-white" },
    "admin-dashboard":             { label: "Admin Dashboard",        icon: <ShieldCheck size={13} />,      color: "bg-[#2c2a29] hover:bg-[#4a4644] text-white" },
    "account-settings":            { label: "Account Settings",       icon: <Settings size={13} />,         color: "bg-[#2c2a29] hover:bg-[#4a4644] text-white" },
    notifications:                 { label: "Notifications",          icon: <CheckCircle size={13} />,      color: "bg-[#2c2a29] hover:bg-[#4a4644] text-white" },
  };

  // Parses all token types out of a chatbot message into renderable parts
  const parseMessageText = (text: string) => {
    type Part =
      | { type: "text";      content: string }
      | { type: "action";    action: string; targetId: string; label: string }
      | { type: "page_link"; page: string;   params?: any;     label: string }
      | { type: "ext_link";  url: string;    label: string };

    const parts: Part[] = [];
    const regex = new RegExp(`(${TOKEN_PATTERN_STR})`, "g");
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = regex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        parts.push({ type: "text", content: text.substring(lastIndex, match.index) });
      }

      const fullToken = match[1];
      const inner = fullToken.slice(1, -1);
      const colonIdx = inner.indexOf(":");
      const tokenType  = inner.substring(0, colonIdx);
      const tokenValue = inner.substring(colonIdx + 1);

      if (tokenType === "book_now") {
        parts.push({ type: "action", action: "book_now", targetId: tokenValue, label: "Book Appointment Now" });
      } else if (tokenType === "view_services") {
        parts.push({ type: "action", action: "view_services", targetId: tokenValue, label: "Browse Services" });
      } else if (tokenType === "view_packages") {
        parts.push({ type: "action", action: "view_packages", targetId: tokenValue, label: "View Packages" });
      } else if (tokenType === "go_studio") {
        parts.push({ type: "page_link", page: "profile", params: { id: tokenValue }, label: "View Studio Profile" });
      } else if (tokenType === "go_page") {
        const [page, ...rest] = tokenValue.split("|");
        const customLabel = rest.join("|").trim();
        const meta = PAGE_LINK_META[page];
        parts.push({ type: "page_link", page, label: customLabel || meta?.label || `Go to ${page}` });
      } else if (tokenType === "external_link") {
        const pipeIdx = tokenValue.indexOf("|");
        const url   = pipeIdx !== -1 ? tokenValue.substring(0, pipeIdx)  : tokenValue;
        const label = pipeIdx !== -1 ? tokenValue.substring(pipeIdx + 1) : url;
        parts.push({ type: "ext_link", url, label });
      }

      lastIndex = regex.lastIndex;
    }

    if (lastIndex < text.length) {
      parts.push({ type: "text", content: text.substring(lastIndex) });
    }

    return parts.length > 0 ? parts : [{ type: "text" as const, content: text }];
  };

  // ── Role-specific header badge ────────────────────────────────────────────
  const roleBadge: Record<AppRole, { label: string; color: string }> = {
    GUEST:       { label: "Guest",       color: "bg-gray-500" },
    CUSTOMER:    { label: "Customer",    color: "bg-blue-500" },
    STUDIO_STAFF:  { label: "Staff",    color: "bg-green-600" },
    STUDIO_ADMIN:  { label: "Studio Owner", color: "bg-amber-600" },
    SUPER_ADMIN: { label: "Super Admin", color: "bg-purple-600" },
  };
  const badge = roleBadge[role];
  const quickChips = getQuickChips(role, currentStudioId);
  const showChips = !chipsUsed && messages.length === 1;

  return (
    <div className="fixed bottom-20 md:bottom-6 right-4 sm:right-6 z-50">
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.85, y: 50 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.85, y: 50 }}
            transition={{ type: "spring", damping: 25, stiffness: 350 }}
            className="bg-white border border-[#e5e1da] rounded-2xl shadow-2xl w-[calc(100vw-2rem)] sm:w-96 max-w-sm h-[460px] sm:h-[540px] max-h-[calc(100vh-160px)] flex flex-col overflow-hidden mb-4"
          >
            {/* Header */}
            <div className="bg-[#2c2a29] text-white p-4 flex items-center justify-between shadow-md">
              <div className="flex items-center gap-2">
                <div className="bg-yellow-500 text-black p-1.5 rounded-full flex items-center justify-center animate-pulse">
                  <Sparkles size={14} className="fill-current" />
                </div>
                <div>
                  <h4 className="font-display font-semibold text-sm leading-tight">Cainta Photo Guide</h4>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-semibold text-white ${badge.color}`}>
                      {badge.label}
                    </span>
                    <p className="text-[10px] text-gray-400">Powered by Gemini AI</p>
                  </div>
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="text-gray-400 hover:text-white transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Chat Body */}
            <div className="flex-1 overflow-y-auto p-4 bg-[#faf9f6] space-y-4">
              {messages.map((m, i) => (
                <div key={i} className={`flex ${m.sender === "user" ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-xs shadow-sm ${
                      m.sender === "user"
                        ? "bg-[#2c2a29] text-[#faf9f6] rounded-br-none"
                        : "bg-white text-[#2c2a29] border border-[#e5e1da] rounded-bl-none"
                    }`}
                  >
                    {m.sender === "user" ? (
                      <p className="leading-relaxed whitespace-pre-wrap">{m.text}</p>
                    ) : (
                      <div className="space-y-2">
                        {parseMessageText(m.text).map((part, pIdx) => {
                          if (part.type === "text") {
                            return (
                              <p key={pIdx} className="leading-relaxed whitespace-pre-wrap">
                                {part.content}
                              </p>
                            );
                          }

                          if (part.type === "action") {
                            return (
                              <div key={pIdx} className="pt-1">
                                <button
                                  onClick={() => {
                                    const id = part.targetId!;
                                    const isReal = id && id !== "GLOBAL" && id !== "USE_REAL_ID_FROM_LIST";
                                    if (part.action === "book_now") {
                                      setIsOpen(false);
                                      isReal ? onTriggerBooking(id) : onNavigate("directory");
                                    }
                                    if (part.action === "view_services") {
                                      setIsOpen(false);
                                      isReal ? onNavigateToServices(id) : onNavigate("directory");
                                    }
                                    if (part.action === "view_packages") {
                                      setIsOpen(false);
                                      isReal ? onNavigateToPackages(id) : onNavigate("directory");
                                    }
                                  }}
                                  className="w-full flex items-center justify-between gap-1.5 px-3 py-2 bg-yellow-500 text-black font-semibold rounded-lg hover:bg-yellow-400 active:scale-95 transition-all text-[11px] uppercase tracking-wider cursor-pointer"
                                >
                                  <span className="flex items-center gap-1.5">
                                    <Camera size={13} />
                                    {part.label}
                                  </span>
                                  <ArrowRight size={13} />
                                </button>
                              </div>
                            );
                          }

                          if (part.type === "page_link") {
                            const meta = part.page ? PAGE_LINK_META[part.page] : undefined;
                            const colorClass = meta?.color || "bg-[#2c2a29] hover:bg-[#4a4644] text-white";
                            const icon = meta?.icon || <ArrowRight size={13} />;
                            const targetPage = part.page!;
                            const targetParams = (part as any).params;
                            const isStudioLink = targetPage === "profile";
                            const studioId = targetParams?.id;
                            const isRealStudio = studioId && studioId !== "GLOBAL" && studioId !== "USE_REAL_ID_FROM_LIST";
                            return (
                              <div key={pIdx} className="pt-1">
                                <button
                                  onClick={() => {
                                    setIsOpen(false);
                                    if (isStudioLink && !isRealStudio) {
                                      onNavigate("directory");
                                    } else {
                                      onNavigate(targetPage, targetParams);
                                    }
                                  }}
                                  className={`w-full flex items-center justify-between gap-1.5 px-3 py-2 rounded-lg font-semibold text-[11px] uppercase tracking-wider active:scale-95 transition-all cursor-pointer ${colorClass}`}
                                >
                                  <span className="flex items-center gap-1.5">
                                    {icon}
                                    {part.label}
                                  </span>
                                  <ArrowRight size={13} />
                                </button>
                              </div>
                            );
                          }

                          if (part.type === "ext_link") {
                            return (
                              <div key={pIdx} className="pt-1">
                                <a
                                  href={part.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="w-full flex items-center justify-between gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-semibold text-[11px] uppercase tracking-wider active:scale-95 transition-all cursor-pointer"
                                >
                                  <span className="flex items-center gap-1.5">
                                    <ExternalLink size={13} />
                                    {part.label}
                                  </span>
                                  <ExternalLink size={11} />
                                </a>
                              </div>
                            );
                          }

                          return null;
                        })}
                      </div>
                    )}
                    <span className="block text-[8px] text-right mt-1 opacity-60">
                      {m.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>
              ))}

              {/* Quick-reply chips — shown only before first user message */}
              {showChips && quickChips.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {quickChips.map((chip, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleChip(chip)}
                      className="text-[10px] px-2.5 py-1.5 bg-white border border-[#e5e1da] text-[#2c2a29] rounded-full hover:border-[#2c2a29] hover:bg-[#f5f3ef] active:scale-95 transition-all cursor-pointer font-medium shadow-sm"
                    >
                      {chip.label}
                    </button>
                  ))}
                </div>
              )}

              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-white border border-[#e5e1da] rounded-2xl rounded-bl-none px-4 py-3 text-xs shadow-sm flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 bg-[#2c2a29] rounded-full animate-bounce"></span>
                    <span className="w-1.5 h-1.5 bg-[#2c2a29] rounded-full animate-bounce delay-75"></span>
                    <span className="w-1.5 h-1.5 bg-[#2c2a29] rounded-full animate-bounce delay-150"></span>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Footer */}
            <form onSubmit={handleSend} className="p-3 border-t border-[#e5e1da] bg-white flex gap-2">
              <input
                type="text"
                value={inputValue}
                onChange={e => setInputValue(e.target.value)}
                placeholder={role === "GUEST" ? "Ask about studios, packages…" : `Ask me anything, ${firstName || "there"}…`}
                disabled={isLoading}
                className="flex-1 bg-[#faf9f6] border border-[#e5e1da] rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-[#2c2a29] transition-colors"
              />
              <button
                type="submit"
                disabled={isLoading || !inputValue.trim()}
                className="p-2 bg-[#2c2a29] hover:bg-[#4a4644] text-white rounded-xl active:scale-95 disabled:opacity-40 transition-all cursor-pointer"
              >
                <Send size={15} />
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating Shutter Toggle Button */}
      <motion.button
        onClick={() => setIsOpen(!isOpen)}
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.95 }}
        className="w-14 h-14 bg-[#2c2a29] text-white rounded-full flex items-center justify-center shadow-2xl relative overflow-hidden focus:outline-none cursor-pointer"
      >
        <AnimatePresence mode="wait">
          {isOpen ? (
            <motion.div
              key="close"
              initial={{ rotate: -90, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={{ rotate: 90, opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <X size={24} />
            </motion.div>
          ) : (
            <motion.div
              key="chat"
              initial={{ rotate: 90, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={{ rotate: -90, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="relative flex items-center justify-center"
            >
              <MessageSquare size={24} />
              <span className="absolute -top-1 -right-1 flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-yellow-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-yellow-500"></span>
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.button>
    </div>
  );
}
