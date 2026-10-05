import express from "express";
import path from "path";
import dotenv from "dotenv";
import bcrypt from "bcryptjs";

import nodemailer from "nodemailer";

import os from "os";
import fs from "fs/promises";
import fsSync from "fs";
import crypto from "crypto";
import QRCode from "qrcode";
import { v2 as cloudinary } from "cloudinary";

// Load environment variables
dotenv.config();

// ─── Cloudinary configuration ───────────────────────────────────────────────
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});
const USE_CLOUDINARY = !!(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET);

import { db } from "./src/db/database.ts";
import { buildBookingReceiptPDF, buildPrintOrderReceiptPDF } from "./src/utils/pdfGenerator.ts";
import { UserRole, Booking, Payment, PrintOrder, AuditLog, Notification, Review, Studio, StudioService, StudioPackage, PackageAddon, ChatbotFAQ, PhotoProofingGallery, MediaFile, StudioAvailability, AvailabilityBlackout } from "./src/db/types.ts";
import { parseBusinessHours } from "./src/utils/availability.ts";

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const SESSION_TTL_MS = 8 * 60 * 60 * 1000;

// ── Global safety nets — prevent any unhandled rejection from crashing the process ──
process.on("unhandledRejection", (reason: any) => {
  console.error("[Server] Unhandled Promise Rejection (caught by safety net):", reason?.message || reason);
});
process.on("uncaughtException", (err: any) => {
  console.error("[Server] Uncaught Exception (caught by safety net):", err?.message || err);
});
const authSessions = new Map<string, { userId: string; expiresAt: number }>();
const passwordResetTokens = new Map<string, { userId: string; email: string; expiresAt: number }>();
const passwordResetOtps = new Map<string, { userId: string; email: string; otpHash: string; expiresAt: number; attempts: number }>();
const emailVerificationTokens = new Map<string, { userId: string; email: string; expiresAt: number }>();
const loginAttempts = new Map<string, { count: number; lockedUntil: number }>();
const MEDIA_ROOT = path.join(process.cwd(), "protected-media");
if (!fsSync.existsSync(MEDIA_ROOT)) {
  fsSync.mkdirSync(MEDIA_ROOT, { recursive: true });
}
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID ? process.env.GOOGLE_CLIENT_ID.trim() : "";

async function verifyGoogleIdToken(credential: string) {
  if (!credential || !credential.includes(".")) {
    throw new Error("Invalid Google credential format.");
  }

  const tokenInfoUrl = `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`;
  const response = await fetch(tokenInfoUrl);
  if (!response.ok) {
    throw new Error("Google identity token could not be verified.");
  }

  const payload: any = await response.json();
  if (!payload?.email || !payload?.sub || !payload?.name) {
    throw new Error("Google identity payload is incomplete.");
  }

  if (GOOGLE_CLIENT_ID && payload.aud && payload.aud !== GOOGLE_CLIENT_ID) {
    throw new Error("Google client configuration mismatch.");
  }

  if (!["accounts.google.com", "https://accounts.google.com"].includes(payload.iss || "")) {
    throw new Error("Google token issuer mismatch.");
  }

  return {
    email: String(payload.email).trim().toLowerCase(),
    fullName: String(payload.name || payload.email.split("@")[0]).trim(),
    googleId: String(payload.sub),
    picture: String(payload.picture || "")
  };
}

type ChatbotFaqSuggestion = {
  id: string;
  question: string;
  answer: string;
  studioId: string;
  category: string;
  frequency: number;
  createdAt: string;
  lastSeenAt: string;
  source: "chatbot";
};

const faqSuggestionStore = new Map<string, ChatbotFaqSuggestion>();

function normalizeFaqQuestion(question: string): string {
  return question.toLowerCase().replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, " ").trim();
}

function looksLikeQuestion(question: string): boolean {
  const normalized = question.trim().toLowerCase();
  return normalized.includes("?") || /\b(what|where|when|why|how|who|can|could|is|are|do|does|which|will|should|booking|book|price|payment|cost|studio)\b/.test(normalized);
}

function rememberFaqSuggestion(question: string, answer: string, studioId?: string): void {
  if (!question || !answer) return;
  if (!looksLikeQuestion(question)) return;

  const normalized = normalizeFaqQuestion(question);
  if (!normalized) return;

  const now = new Date().toISOString();
  const existing = faqSuggestionStore.get(normalized);
  if (existing) {
    existing.answer = answer;
    existing.frequency += 1;
    existing.lastSeenAt = now;
    existing.studioId = existing.studioId || studioId || "GLOBAL";
    return;
  }

  if (faqSuggestionStore.size > 500) {
    const oldestKey = Array.from(faqSuggestionStore.keys()).sort((a, b) => {
      const aa = faqSuggestionStore.get(a)!;
      const bb = faqSuggestionStore.get(b)!;
      return new Date(aa.lastSeenAt).getTime() - new Date(bb.lastSeenAt).getTime();
    })[0];
    if (oldestKey) faqSuggestionStore.delete(oldestKey);
  }

  faqSuggestionStore.set(normalized, {
    id: generateId("SUG"),
    question: question.trim(),
    answer: answer.trim(),
    studioId: studioId || "GLOBAL",
    category: "Suggested",
    frequency: 1,
    createdAt: now,
    lastSeenAt: now,
    source: "chatbot"
  });
}

// ── SSE Client Registry (real-time payment confirmations) ────────────────────
const sseClients = new Map<string, Set<express.Response>>();
function broadcastSSE(userId: string, data: Record<string, any>): void {
  const clients = sseClients.get(userId);
  if (!clients || clients.size === 0) return;
  const payload = `data: ${JSON.stringify(data)}\n\n`;
  for (const client of clients) {
    try { client.write(payload); } catch { clients.delete(client); }
  }
}

function checkLoginRateLimit(key: string): { allowed: boolean; waitMinutes?: number } {
  const now = Date.now();
  const attempt = loginAttempts.get(key);
  if (attempt && attempt.lockedUntil > now) {
    const waitMinutes = Math.ceil((attempt.lockedUntil - now) / 60000);
    return { allowed: false, waitMinutes };
  }
  return { allowed: true };
}

function recordLoginFailure(key: string): number {
  const now = Date.now();
  const attempt = loginAttempts.get(key) || { count: 0, lockedUntil: 0 };
  attempt.count += 1;
  const failureCount = attempt.count;
  if (attempt.count >= 5) {
    attempt.lockedUntil = now + 15 * 60 * 1000; // 15 min lockout
    attempt.count = 0;
  }
  loginAttempts.set(key, attempt);
  return failureCount;
}

function clearLoginAttempts(key: string) {
  loginAttempts.delete(key);
}

// Do not serve requests against the pre-hydration in-memory database.
app.use(async (_req, _res, next) => {
  await db.waitUntilReady();
  next();
});

app.use((req, res, next) => {
  if (req.path.startsWith("/api/")) {
    res.setHeader("Cache-Control", "no-store");
  }
  next();
});

// Restrict browser access to configured origins and allow seamless localhost/LAN access.
app.use((req, res, next) => {
  const configuredOrigins = (process.env.FRONTEND_ORIGINS || "http://localhost:3000")
    .split(",").map(origin => origin.trim()).filter(Boolean);
  const requestOrigin = req.header("Origin");
  
  const isOriginAllowed = !requestOrigin || 
    requestOrigin.includes("localhost") ||
    requestOrigin.includes("127.0.0.1") ||
    configuredOrigins.includes("*") || 
    configuredOrigins.includes(requestOrigin) ||
    configuredOrigins.some(pattern => pattern.startsWith("*.") && requestOrigin.endsWith(pattern.slice(1)));

  if (requestOrigin && isOriginAllowed) {
    res.header("Access-Control-Allow-Origin", requestOrigin);
    res.header("Access-Control-Allow-Credentials", "true");
    res.header("Vary", "Origin");
  }
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS, PATCH");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
  res.header("X-Content-Type-Options", "nosniff");
  res.header("X-Frame-Options", "DENY");
  res.header("Referrer-Policy", "same-origin");
  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }
  next();
});

// Enable JSON parser with enough room for an 8 MB base64 media payload.
app.use(express.json({ limit: "12mb" }));
app.use((err: any, _req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (err?.type === "entity.too.large") {
    return res.status(413).json({ success: false, message: "The file is too large. Please select a file that is 8 MB or smaller." });
  }
  next(err);
});


// Public reads are intentionally narrow. Every other API request must authenticate.
app.use((req, res, next) => {
  if (!req.path.startsWith("/api/")) return next();
  const publicApi = [
    /^\/api\/auth\/(login|register|forgot-password|verify-reset-otp|reset-password|verify-email|google)$/,
    /^\/api\/studios\/?$/,
    /^\/api\/studios\/[^/]+$/,
    // The studio's GCash / Maya QR details are public by design (the same values
    // are already inside the /api/studios payload). Without these two patterns the
    // middleware answered 401 and the QR image could never load for a client that
    // fetches it directly — another "dead image" trap.
    /^\/api\/studios\/[^/]+\/payment-methods$/,
    /^\/api\/studios\/[^/]+\/gcash$/,
    /^\/api\/reviews\/?$/,
    /^\/api\/categories\/?$/,
    /^\/api\/cms\/?$/,
    /^\/api\/custom-pages\/?$/,
    /^\/api\/media\/[^/]+$/,
    /^\/api\/services\/?$/,
    /^\/api\/packages\/?$/,
    /^\/api\/addons\/?$/,
    /^\/api\/print-products\/?$/,
    /^\/api\/system\/audio\/?$/,
    /^\/api\/system\/demo-video\/?$/,
    /^\/api\/chatbot\/faqs\/?$/,
    /^\/api\/chatbot\/message\/?$/
  ];
  const isPublicRead = req.method === "GET" && publicApi.some(pattern => pattern.test(req.path));
  const isPublicChatbotMessage = req.method === "POST" && /^\/api\/chatbot\/message\/?$/.test(req.path);
  if (isPublicRead || publicApi.some(pattern => pattern.test(req.path) && req.path.startsWith("/api/auth/")) || isPublicChatbotMessage) {
    return next();
  }
  if (!getAuthenticatedUser(req)) {
    return res.status(401).json({ success: false, message: "Authentication is required." });
  }
  next();
});

// ----------------------------------------------------
// SMTP EMAIL NOTIFICATION TRANSPORTER SETUP
// Works on Render (root .env) and Firebase Functions (functions/.env)
// Gmail requires: 2FA enabled + App Password generated in Google Account
// Firebase Functions (Blaze plan) allows outbound SMTP on port 587/465.
// ----------------------------------------------------
const smtpEmail = (process.env.SMTP_EMAIL || "").trim();
const smtpPassword = (process.env.SMTP_APP_PASSWORD || "").trim().replace(/\s+/g, "");
// Optional: custom SMTP host/port for non-Gmail providers (e.g. SendGrid, Mailgun)
const smtpHost = (process.env.SMTP_HOST || "smtp.gmail.com").trim();
const smtpPort = parseInt(process.env.SMTP_PORT || "465", 10);
const smtpSecure = process.env.SMTP_SECURE !== "false"; // default true (SSL/TLS)
// Display name shown in email From header
const smtpFromName = (process.env.EMAIL_FROM_NAME || "Cainta Photography Studio MIS").replace(/^"|"$/g, "").trim();

let mailTransporter: nodemailer.Transporter | null = null;

function createMailTransporter(): nodemailer.Transporter | null {
  if (!smtpEmail || !smtpPassword) {
    console.log("[SMTP] Notice: SMTP_EMAIL or SMTP_APP_PASSWORD not set — email disabled.");
    return null;
  }
  // Use explicit host/port instead of service shorthand to ensure compatibility
  // across all Node.js environments including Firebase Functions serverless containers.
  return nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpSecure,         // true = TLS on port 465; false = STARTTLS on 587
    auth: {
      user: smtpEmail,
      pass: smtpPassword
    },
    tls: {
      // Do not fail on self-signed certs (cloud environments sometimes use them)
      rejectUnauthorized: false
    }
  } as nodemailer.TransportOptions);
}

if (smtpEmail && smtpPassword) {
  mailTransporter = createMailTransporter();
  if (mailTransporter) {
    mailTransporter.verify((error) => {
      if (error) {
        console.warn("[SMTP] Email transport verification failed:", error.message);
        console.warn("[SMTP] Hint: ensure SMTP_EMAIL and SMTP_APP_PASSWORD are correct in your .env file.");
        console.warn("[SMTP] For Gmail: enable 2FA and generate an App Password at myaccount.google.com.");
      } else {
        console.log(`[SMTP] ✅ Email notifications active — sender: ${smtpFromName} <${smtpEmail}> via ${smtpHost}:${smtpPort}`);
      }
    });
  }
} else {
  console.log("[SMTP] Notice: SMTP credentials not fully configured in .env");
}

// Rich HTML Email Dispatcher (High-End Luxury Studio Design)
async function sendEmailNotification(
  toEmail: string, 
  title: string, 
  message: string, 
  type: "info" | "success" | "warning" | "error" = "info",
  actionUrl?: string,
  actionLabel?: string,
  attachments?: Array<{ filename: string; content: Buffer | string; contentType?: string }>
) {
  // Lazy re-init: in serverless environments the transporter may not have been
  // created at cold-start if env vars are injected after module load.
  if (!mailTransporter && smtpEmail && smtpPassword) {
    mailTransporter = createMailTransporter();
  }
  if (!mailTransporter || !smtpEmail) {
    console.log(`[SMTP Simulated] Email to ${toEmail}: [${title}] ${message}`);
    return;
  }

  const typeConfig: Record<string, { badge: string; badgeBg: string; badgeColor: string; accentGrad: string; icon: string }> = {
    success: {
      badge: "VERIFIED UPDATE",
      badgeBg: "#ecfdf5",
      badgeColor: "#059669",
      accentGrad: "linear-gradient(135deg, #059669 0%, #10b981 100%)",
      icon: "✓"
    },
    warning: {
      badge: "ACTION REQUIRED",
      badgeBg: "#fffbeb",
      badgeColor: "#d97706",
      accentGrad: "linear-gradient(135deg, #d97706 0%, #f59e0b 100%)",
      icon: "⚡"
    },
    error: {
      badge: "ATTENTION",
      badgeBg: "#fef2f2",
      badgeColor: "#dc2626",
      accentGrad: "linear-gradient(135deg, #dc2626 0%, #ef4444 100%)",
      icon: "!"
    },
    info: {
      badge: "STUDIO NOTIFICATION",
      badgeBg: "#f5f3ef",
      badgeColor: "#78716c",
      accentGrad: "linear-gradient(135deg, #1c1917 0%, #292524 100%)",
      icon: "✦"
    }
  };

  const config = typeConfig[type] || typeConfig.info;
  const currentYear = new Date().getFullYear();
  const dateFormatted = new Date().toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });

  const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f6f5f1; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; -webkit-font-smoothing: antialiased; color: #1c1917;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #f6f5f1; padding: 40px 16px;">
    <tr>
      <td align="center">
        <!-- Main Email Container -->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width: 580px; background-color: #ffffff; border-radius: 24px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.06); border: 1px solid #e7e5e0;">
          
          <!-- Header Banner (Luxury Dark Obsidian & Gold Accent) -->
          <tr>
            <td style="background: #181615; padding: 36px 32px 30px; text-align: center; border-bottom: 2px solid #d97706;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <!-- Logo / Badge Emblem -->
                    <div style="display: inline-block; background: #262322; border: 1px solid #3e3a37; border-radius: 16px; padding: 10px 18px; margin-bottom: 16px;">
                      <span style="color: #f59e0b; font-size: 16px; margin-right: 6px;">📷</span>
                      <span style="color: #faf9f6; font-size: 12px; font-weight: 800; letter-spacing: 2px; text-transform: uppercase;">Cainta Photography MIS</span>
                    </div>
                  </td>
                </tr>
                <tr>
                  <td align="center">
                    <p style="margin: 0; color: #a8a29e; font-size: 12px; letter-spacing: 1px; text-transform: uppercase; font-weight: 600;">
                      Centralized Photography Studio Network &bull; Rizal
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Main Content Area -->
          <tr>
            <td style="padding: 36px 32px 28px;">
              <!-- Type Badge -->
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin-bottom: 18px;">
                <tr>
                  <td style="background-color: ${config.badgeBg}; border: 1px solid ${config.badgeColor}22; border-radius: 30px; padding: 5px 14px;">
                    <span style="color: ${config.badgeColor}; font-size: 10px; font-weight: 800; letter-spacing: 1px; text-transform: uppercase;">
                      ${config.icon} ${config.badge}
                    </span>
                  </td>
                </tr>
              </table>

              <!-- Main Title -->
              <h1 style="margin: 0 0 16px 0; color: #1c1917; font-size: 20px; font-weight: 800; line-height: 1.35; letter-spacing: -0.3px;">
                ${title}
              </h1>

              <!-- Message Callout Card -->
              <div style="background-color: #faf9f6; border: 1px solid #e7e5e0; border-left: 4px solid #d97706; border-radius: 14px; padding: 20px 22px; margin-bottom: 24px;">
                <p style="margin: 0; color: #44403c; font-size: 14px; line-height: 1.65;">
                  ${message}
                </p>
              </div>

              <!-- Metadata Summary Box -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #fdfdfc; border: 1px solid #f0ede6; border-radius: 14px; padding: 14px 18px; margin-bottom: 28px;">
                <tr>
                  <td style="font-size: 11px; color: #78716c; padding: 4px 0;">
                    <strong style="color: #1c1917;">Timestamp:</strong> ${dateFormatted}
                  </td>
                  <td align="right" style="font-size: 11px; color: #78716c; padding: 4px 0;">
                    <strong style="color: #1c1917;">Status:</strong> <span style="color: #059669; font-weight: 700;">Verified System Transaction</span>
                  </td>
                </tr>
              </table>

              <!-- Optional CTA Button -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <a href="${actionUrl || 'http://localhost:3000'}" style="display: inline-block; background-color: #1c1917; color: #ffffff; text-decoration: none; font-size: 12px; font-weight: 800; letter-spacing: 1px; text-transform: uppercase; padding: 14px 32px; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.12);">
                      ${actionLabel || 'Access Studio MIS Portal →'}
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Divider -->
          <tr>
            <td style="padding: 0 32px;">
              <div style="border-top: 1px solid #f0ede6;"></div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 24px 32px 32px; text-align: center; background-color: #faf9f6;">
              <p style="margin: 0 0 6px 0; font-size: 11px; color: #78716c; font-weight: 600;">
                Cainta Photography Studio Management Information System
              </p>
              <p style="margin: 0 0 12px 0; font-size: 10px; color: #a8a29e; line-height: 1.5;">
                Town Center &bull; Felix Avenue &bull; Valley Golf &bull; Imelda Avenue &bull; Cainta, Rizal<br/>
                This is an automated notification. Please do not reply directly to this email.
              </p>
              <p style="margin: 0; font-size: 10px; color: #d6d3d1;">
                &copy; ${currentYear} Cainta Photography Studio MIS. All rights reserved.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;

  try {
    await mailTransporter.sendMail({
      from: `"${smtpFromName}" <${smtpEmail}>`,
      to: toEmail,
      subject: `[Cainta Photography] ${title}`,
      text: `${title}\n\n${message}\n\nTimestamp: ${dateFormatted}\n\n-- Cainta Photography Studio MIS`,
      html: htmlContent,
      attachments: attachments?.map(item => ({
        filename: item.filename,
        content: item.content,
        contentType: item.contentType || "application/octet-stream"
      }))
    });
    console.log(`[SMTP] Successfully delivered email notification to ${toEmail} for: "${title}"`);
  } catch (err: any) {
    console.error(`[SMTP] Failed to send email to ${toEmail}:`, err?.message || err);
  }
}

// Helper to generate unique IDs
const generateId = (prefix: string) => `${prefix}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

function createAuthToken(userId: string): string {
  const token = `${generateId("SESSION")}-${Math.random().toString(36).slice(2)}`;
  authSessions.set(token, { userId, expiresAt: Date.now() + SESSION_TTL_MS });
  return token;
}

function getAuthenticatedUser(req: express.Request) {
  const header = req.header("Authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  const session = token ? authSessions.get(token) : undefined;
  if (!session) return null;
  if (session.expiresAt <= Date.now()) {
    authSessions.delete(token);
    return null;
  }
  const userId = session.userId;
  const user = db.users.find(item => item.id === userId) || db.customers.find(customer => customer.id === userId) || null;
  if (user && getStudioAccountStatus(user) !== null && getStudioAccountStatus(user) !== "approved") {
    authSessions.delete(token);
    return null;
  }
  return user;
}

function requireAuthenticatedUser(req: express.Request, res: express.Response) {
  const user = getAuthenticatedUser(req);
  if (!user) {
    res.status(401).json({ success: false, message: "Authentication is required." });
    return null;
  }
  return user;
}

function requireRole(req: express.Request, res: express.Response, ...roles: UserRole[]) {
  const user = requireAuthenticatedUser(req, res);
  if (!user) return null;
  if (!roles.includes(user.role as UserRole)) {
    res.status(403).json({ success: false, message: "You do not have permission to perform this action." });
    return null;
  }
  return user;
}

function getStudioAccountStatus(user: any): "approved" | "pending" | "rejected" | "suspended" | null {
  if (user.role !== UserRole.STUDIO_ADMIN) return null;
  const studio = db.studios.find(item => item.id === user.studioId || item.ownerId === user.id);
  if (!studio) return "pending";
  if (studio.status === "suspended") return "suspended";
  if (studio.status === "rejected") return "rejected";
  return studio.isApproved || studio.status === "approved" ? "approved" : "pending";
}

function requireStudioAccess(req: express.Request, res: express.Response, studioId: string) {
  const user = requireAuthenticatedUser(req, res);
  if (!user) return null;
  if (user.role === UserRole.SUPER_ADMIN) return user;
  const studioUser = "studioId" in user ? user : null;
  if (!studioUser || ![UserRole.STUDIO_ADMIN, UserRole.STUDIO_STAFF].includes(user.role as UserRole) || studioUser.studioId !== studioId) {
    res.status(403).json({ success: false, message: "You do not have access to this studio." });
    return null;
  }
  return user;
}

function requireStudioOwner(req: express.Request, res: express.Response, studioId: string) {
  const user = requireAuthenticatedUser(req, res);
  if (!user) return null;
  if (user.role !== UserRole.STUDIO_ADMIN) {
    res.status(403).json({ success: false, message: "Only the studio owner can manage this studio's availability." });
    return null;
  }
  const studio = db.studios.find(item => item.id === studioId);
  if (!studio || studio.ownerId !== user.id) {
    res.status(403).json({ success: false, message: "Only the studio owner can manage this studio's availability." });
    return null;
  }
  return user;
}

function requireBookingAccess(req: express.Request, res: express.Response, booking: Booking, allowStudio = true) {
  const user = requireAuthenticatedUser(req, res);
  if (!user) return null;
  const ownsBooking = user.role === UserRole.CUSTOMER && booking.customerId === user.id;
  const studioUser = "studioId" in user ? user : null;
  const managesStudio = allowStudio && [UserRole.SUPER_ADMIN, UserRole.STUDIO_ADMIN, UserRole.STUDIO_STAFF].includes(user.role as UserRole) &&
    (user.role === UserRole.SUPER_ADMIN || studioUser?.studioId === booking.studioId);
  if (!ownsBooking && !managesStudio) {
    res.status(403).json({ success: false, message: "You do not have access to this booking." });
    return null;
  }
  return user;
}

function canManageStudioPayment(user: any, studioId: string): boolean {
  if (user.role === UserRole.SUPER_ADMIN) return true;
  const studio = db.studios.find(item => item.id === studioId);
  return user.role === UserRole.STUDIO_ADMIN &&
    user.studioId === studioId &&
    studio?.ownerId === user.id;
}

// Public "online presence" links a studio owner may publish on their profile.
// Studio owners may only store absolute http(s) links, so the server normalizes
// the value and rejects unsafe schemes (javascript:, data:, vbscript:, file:).
const EXTERNAL_LINK_MAX_LENGTH = 500;

function sanitizeExternalUrl(raw: any): string | null {
  if (raw === undefined || raw === null) return "";
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed) return "";
  if (trimmed.length > EXTERNAL_LINK_MAX_LENGTH) return null;
  if (/^(javascript|data|vbscript|file):/i.test(trimmed)) return null;
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const parsed = new URL(withProtocol);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

function publicUser(user: any, authToken: string) {
  const { passwordHash, ...safeUser } = user;
  return { ...safeUser, authToken };
}

function expireUnpaidBooking(booking: Booking): boolean {
  if (!booking.paymentDueAt || !["Pending", "Awaiting Payment"].includes(booking.status)) return false;
  if (booking.amountPaid >= booking.downPaymentAmount || new Date(booking.paymentDueAt) > new Date()) return false;
  booking.status = "Expired";
  db.save();
  notifyUser(booking.customerId, "Booking Payment Hold Expired", `Booking ${booking.id} expired because the downpayment was not received before the payment deadline.`, "error", booking.studioId);
  return true;
}

// Logger helper
function logAction(userId: string, email: string, action: string, entityType: string, entityId: string) {
  const log: AuditLog = {
    id: generateId("LOG"),
    userId,
    userEmail: email,
    action,
    entityType,
    entityId,
    timestamp: new Date().toISOString()
  };
  db.addAuditLog(log);
}

// System-wide Notifications helper (Creates in-app notification + Sends SMTP email)
function notifyUser(userId: string, title: string, message: string, type: "info" | "success" | "warning" | "error" = "info", studioId?: string) {
  const notif: Notification = {
    id: generateId("NOTIF"),
    userId,
    studioId,
    title,
    message,
    isRead: false,
    type,
    createdAt: new Date().toISOString()
  };
  db.addNotification(notif);

  // Automatically lookup user / customer email and trigger real-time SMTP dispatch
  const recipient = db.users.find(u => u.id === userId) || db.customers.find(c => c.id === userId);
  if (recipient && recipient.email) {
    sendEmailNotification(recipient.email, title, message, type).catch(err => {
      console.warn("[SMTP] Notification email dispatch warning:", err);
    });
  }
}

async function sendReceiptCopyEmail(
  customerEmail: string,
  title: string,
  message: string,
  fileName: string,
  pdfBuffer: Buffer
) {
  await sendEmailNotification(
    customerEmail,
    title,
    message,
    "success",
    undefined,
    undefined,
    [{ filename: fileName, content: pdfBuffer, contentType: "application/pdf" }]
  );
}

function parseMediaData(value: unknown): { mimeType: string; bytes: Buffer } | null {
  if (typeof value !== "string") return null;
  const match = value.match(/^data:((?:image\/(?:jpeg|png|webp)|application\/pdf|video\/(?:mp4|webm|quicktime|x-matroska|x-msvideo)));base64,([A-Za-z0-9+/=]+)$/);
  if (!match) return null;

  const mimeType = match[1];
  const bytes = Buffer.from(match[2], "base64");
  if (!bytes.length || bytes.length > 8 * 1024 * 1024) return null;

  if (mimeType.startsWith("video/")) {
    return { mimeType, bytes };
  }

  const hasSignature = mimeType === "image/jpeg"
    ? bytes.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))
    : mimeType === "image/png"
      ? bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
      : mimeType === "image/webp"
        ? bytes.subarray(0, 4).toString("ascii") === "RIFF" && bytes.subarray(8, 12).toString("ascii") === "WEBP"
        : bytes.subarray(0, 5).toString("ascii") === "%PDF-";

  if (!hasSignature) return null;
  return { mimeType, bytes };
}

function reconcileStudioBrandingMedia(studioId: string) {
  const studioIndex = db.studios.findIndex(item => item.id === studioId);
  if (studioIndex === -1) return;

  const media = db.mediaFiles.filter(item =>
    item.entityType === "studio" &&
    item.entityId === studioId &&
    item.accessStatus === "active" &&
    (item.purpose === "STUDIO_LOGO" || item.purpose === "STUDIO_COVER")
  );

  const latestByPurpose = new Map<string, string>();
  for (const item of media) {
    if (!latestByPurpose.has(item.purpose)) {
      // If storageKey is a Cloudinary URL use it directly (CDN, permanent).
      // Otherwise fall back to the proxied /api/media/:id route.
      const url = item.storageKey.startsWith("https://")
        ? item.storageKey
        : `/api/media/${item.id}`;
      latestByPurpose.set(item.purpose, url);
    }
  }

  if (latestByPurpose.has("STUDIO_LOGO")) db.studios[studioIndex].logo = latestByPurpose.get("STUDIO_LOGO") || db.studios[studioIndex].logo;
  if (latestByPurpose.has("STUDIO_COVER")) db.studios[studioIndex].coverImage = latestByPurpose.get("STUDIO_COVER") || db.studios[studioIndex].coverImage;
}

async function saveProtectedMedia(ownerId: string, entityType: string, entityId: string, purpose: string, value: unknown, originalName?: string) {
  const parsed = parseMediaData(value);
  if (!parsed) return null;

  // Bug 2 fix: wrap the entire storage + DB-write path in a try/catch so that
  // Cloudinary API errors, local fs.writeFile failures, or mysqlInsert errors
  // return null (which every caller converts to a 400) rather than propagating
  // as an unhandled rejection that Express turns into a 500 with no client message.
  try {
  const mediaId = generateId("MEDIA");
  const extension = parsed.mimeType === "application/pdf" ? "pdf" : parsed.mimeType.split("/")[1];
  const storageKey = `${mediaId}.${extension}`;
  let cloudinaryUrl: string | undefined;

  if (USE_CLOUDINARY) {
    // Upload buffer to Cloudinary as a data URI — permanent, survives server restarts
    const dataUri = `data:${parsed.mimeType};base64,${parsed.bytes.toString("base64")}`;
    const resourceType = parsed.mimeType.startsWith("video/") ? "video"
      : parsed.mimeType === "application/pdf" ? "raw"
      : "image";
    const uploadResult = await cloudinary.uploader.upload(dataUri, {
      public_id: mediaId,
      folder: "cainta-mis",
      resource_type: resourceType,
      overwrite: false,
    });
    cloudinaryUrl = uploadResult.secure_url;
  } else {
    // Fallback: write to local disk (development / no Cloudinary configured)
    await fs.mkdir(MEDIA_ROOT, { recursive: true });
    await fs.writeFile(path.join(MEDIA_ROOT, storageKey), parsed.bytes, { flag: "wx" });
  }

  const media: MediaFile = {
    id: mediaId,
    ownerId,
    entityType,
    entityId,
    purpose,
    originalName,
    mimeType: parsed.mimeType,
    sizeBytes: parsed.bytes.length,
    checksum: crypto.createHash("sha256").update(parsed.bytes).digest("hex"),
    // storageKey holds either the Cloudinary secure URL (permanent) or the local filename
    storageKey: cloudinaryUrl ?? storageKey,
    accessStatus: "active",
    createdAt: new Date().toISOString()
  };
  db.addMediaFile(media);
  if (entityType === "studio") {
    reconcileStudioBrandingMedia(entityId);
    await db.save();
  }
  // Return the final public URL: Cloudinary CDN URL if uploaded there, otherwise the /api/media proxy
  const mediaUrl = cloudinaryUrl ?? `/api/media/${mediaId}`;
  return { mediaId, mimeType: media.mimeType, size: media.sizeBytes, url: mediaUrl };
  } catch (err: any) {
    console.error("[saveProtectedMedia] Storage error:", err?.message || err);
    return null;
  }
}

function canAccessMedia(user: any, media: { ownerId: string; entityType: string; entityId: string }) {
  if (user.role === UserRole.SUPER_ADMIN || user.id === media.ownerId) return true;
  if (media.entityType === "payment") {
    const payment = db.payments.find(item => item.id === media.entityId);
    const booking = payment ? db.bookings.find(item => item.id === payment.bookingId) : undefined;
    return !!payment && !!booking && ((user.role === UserRole.CUSTOMER && payment.customerId === user.id) ||
      ([UserRole.STUDIO_ADMIN, UserRole.STUDIO_STAFF].includes(user.role) && user.studioId === payment.studioId));
  }
  if (media.entityType === "studio") {
    const studio = db.studios.find(item => item.id === media.entityId);
    return !!studio && (user.studioId === studio.id || user.id === studio.ownerId);
  }
  // Studio payment QR codes are uploaded against entityType "studio-payment"
  // with the studio id as the entity id. Without this branch the studio owner
  // (and staff) could never load their own QR image, which made the dashboard
  // preview show a dead image.
  if (media.entityType === "studio-payment") {
    const studio = db.studios.find(item => item.id === media.entityId);
    return !!studio && (user.studioId === studio.id || user.id === studio.ownerId);
  }
  if (media.entityType === "print-order") {
    const order = db.printOrders.find(item => item.id === media.entityId);
    return !!order && ((user.role === UserRole.CUSTOMER && order.customerId === user.id) ||
      ([UserRole.STUDIO_ADMIN, UserRole.STUDIO_STAFF].includes(user.role) && user.studioId === order.studioId));
  }
  if (media.entityType === "photo-proofing") {
    const gallery = db.photoProofings.find(item => item.id === media.entityId);
    return !!gallery && ((user.role === UserRole.CUSTOMER && gallery.customerId === user.id) ||
      ([UserRole.STUDIO_ADMIN, UserRole.STUDIO_STAFF].includes(user.role) && user.studioId === gallery.studioId) ||
      user.role === UserRole.SUPER_ADMIN);
  }
  if (media.entityType === "service") {
    const service = db.services.find(item => item.id === media.entityId);
    return !!service && ([UserRole.STUDIO_ADMIN, UserRole.STUDIO_STAFF].includes(user.role) && user.studioId === service.studioId);
  }
  if (media.entityType === "package") {
    const pkg = db.packages.find(item => item.id === media.entityId);
    return !!pkg && ([UserRole.STUDIO_ADMIN, UserRole.STUDIO_STAFF].includes(user.role) && user.studioId === pkg.studioId);
  }
  if (media.entityType === "addon") {
    const addon = db.addons.find(item => item.id === media.entityId);
    return !!addon && ([UserRole.STUDIO_ADMIN, UserRole.STUDIO_STAFF].includes(user.role) && user.studioId === addon.studioId);
  }
  return false;
}

app.post("/api/media", async (req, res) => {
  const user = requireAuthenticatedUser(req, res);
  if (!user) return;
  const { entityType, entityId, purpose, fileData, originalName } = req.body;
  if (!entityType || !entityId || !purpose || !fileData) {
    return res.status(400).json({ success: false, message: "entityType, entityId, purpose, and fileData are required." });
  }
  if ((String(purpose) === "HERO_BACKGROUND" || String(purpose) === "SYSTEM_DEMO_VIDEO") &&
    (user.role !== UserRole.SUPER_ADMIN || String(entityType) !== (String(purpose) === "HERO_BACKGROUND" ? "cms" : "system") || String(entityId) !== (String(purpose) === "HERO_BACKGROUND" ? "heroBackground" : "demo-video"))) {
    return res.status(403).json({ success: false, message: "Only a superadmin can upload this protected media." });
  }
  const media = await saveProtectedMedia(user.id, String(entityType), String(entityId), String(purpose), fileData, originalName);
  if (!media) return res.status(400).json({ success: false, message: "The file type or size is not supported." });
  const mediaUrl = media.url;
  if (String(purpose) === "HERO_BACKGROUND" && String(entityType) === "cms" && String(entityId) === "heroBackground") {
    const cmsIndex = db.cmsSettings.findIndex(setting => setting.key === "heroBackground");
    if (cmsIndex >= 0) {
      db.cmsSettings[cmsIndex].value = mediaUrl;
    } else {
      db.cmsSettings.push({ id: "heroBackground", key: "heroBackground", value: mediaUrl });
    }
    await db.save();
  }
  res.json({ success: true, media, url: mediaUrl });
});

// ----------------------------------------------------
// API ROUTES
// ----------------------------------------------------

// Auth Endpoints
app.post("/api/auth/login", (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ success: false, message: "Email and password are required." });
  }

  const rateLimitKey = `${req.ip || "local"}:${String(email).toLowerCase()}`;
  const rateLimit = checkLoginRateLimit(rateLimitKey);
  if (!rateLimit.allowed) {
    return res.status(429).json({ 
      success: false, 
      message: `Too many failed login attempts. Account temporarily locked. Please try again in ${rateLimit.waitMinutes} minute(s).` 
    });
  }

  // Check across users (admins & studio admins) and customers table
  const user = db.users.find(u => u.email.toLowerCase() === email.toLowerCase()) ||
               db.customers.find(c => c.email.toLowerCase() === email.toLowerCase());

  if (!user) {
    recordLoginFailure(rateLimitKey);
    return res.status(401).json({ success: false, message: "Invalid email or password" });
  }

  // Pure bcrypt password validation
  let isPasswordValid = false;
  try {
    if (user.passwordHash.startsWith("$2a$") || user.passwordHash.startsWith("$2b$")) {
      isPasswordValid = bcrypt.compareSync(password, user.passwordHash);
    }
  } catch {
    isPasswordValid = false;
  }

  if (!isPasswordValid) {
    const failureCount = recordLoginFailure(rateLimitKey);
    if (failureCount === 3 || failureCount === 5) {
      notifyUser(
        user.id,
        "Multiple Failed Login Attempts",
        `We detected ${failureCount} unsuccessful login attempts for your account. If this was not you, change your password immediately and contact support.`,
        "error"
      );
    }
    return res.status(401).json({ success: false, message: "Invalid email or password" });
  }

  const studioAccountStatus = getStudioAccountStatus(user);
  if (studioAccountStatus && studioAccountStatus !== "approved") {
    const messages = {
      pending: "Your studio registration is awaiting Super Admin approval. You cannot access the Studio Portal yet.",
      rejected: "Your studio registration was rejected. Please contact the Super Admin for more information.",
      suspended: "Your studio account is suspended. Please contact the Super Admin."
    };
    return res.status(403).json({ success: false, message: messages[studioAccountStatus] });
  }

  clearLoginAttempts(rateLimitKey);
  const authToken = createAuthToken(user.id);
  res.json({ success: true, user: publicUser(user, authToken) });
});

app.post("/api/auth/google", async (req, res) => {
  const credential = typeof req.body?.credential === "string" ? req.body.credential.trim() : "";
  if (!credential) {
    return res.status(400).json({ success: false, message: "Missing Google credential." });
  }

  try {
    if (!GOOGLE_CLIENT_ID) {
      return res.status(500).json({ success: false, message: "Google client ID is not configured on the server." });
    }

    const googleIdentity = await verifyGoogleIdToken(credential);
    const normalizedEmail = googleIdentity.email;

    const existingUser = db.users.find(u => u.email.toLowerCase() === normalizedEmail) ||
      db.customers.find(c => c.email.toLowerCase() === normalizedEmail);

    if (existingUser) {
      existingUser.fullName = existingUser.fullName || googleIdentity.fullName;
      existingUser.email = normalizedEmail;
      (existingUser as any).authProvider = "google";
      (existingUser as any).googleId = googleIdentity.googleId;
      if (googleIdentity.picture) (existingUser as any).picture = googleIdentity.picture;

      const authToken = createAuthToken(existingUser.id);
      db.save();
      return res.json({ success: true, user: publicUser(existingUser, authToken) });
    }

    const customer: any = {
      id: generateId("CUST"),
      email: normalizedEmail,
      passwordHash: bcrypt.hashSync(`${Date.now()}-${crypto.randomUUID()}-google-social`, 10),
      fullName: googleIdentity.fullName,
      role: UserRole.CUSTOMER,
      contactNumber: "",
      address: "",
      authProvider: "google",
      googleId: googleIdentity.googleId,
      picture: googleIdentity.picture,
      createdAt: new Date().toISOString()
    };

    db.addCustomer(customer);
    const authToken = createAuthToken(customer.id);
    return res.json({ success: true, user: publicUser(customer, authToken) });
  } catch (error: any) {
    console.error("[Google Login]", error?.message || error);
    return res.status(401).json({ success: false, message: "Google authentication failed." });
  }
});

app.get("/api/auth/session", (req, res) => {
  const user = requireAuthenticatedUser(req, res);
  if (!user) return;
  const token = req.header("Authorization")?.slice(7).trim() || "";
  res.json({ success: true, user: publicUser(user, token) });
});

app.post("/api/auth/forgot-password", async (req, res) => {
  const normalizedEmail = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
  if (!normalizedEmail || !/^\S+@\S+\.\S+$/.test(normalizedEmail)) {
    return res.status(400).json({ success: false, message: "A valid email address is required." });
  }

  const user = db.users.find(u => u.email.toLowerCase() === normalizedEmail) ||
               db.customers.find(c => c.email.toLowerCase() === normalizedEmail);

  if (user) {
    const otp = String(crypto.randomInt(100000, 1000000)).padStart(6, "0");
    const expiresAt = Date.now() + 10 * 60 * 1000;
    passwordResetOtps.set(normalizedEmail, {
      userId: user.id,
      email: user.email,
      otpHash: crypto.createHash("sha256").update(otp).digest("hex"),
      expiresAt,
      attempts: 0
    });
    await sendEmailNotification(
      user.email,
      "Your Password Reset OTP",
      `We received a request to reset your Cainta Photography Studio MIS password. Your one-time verification code is <strong>${otp}</strong>. This code expires in 10 minutes. If you did not make this request, you can safely ignore this email.`,
      "warning",
    );
    notifyUser(user.id, "Password Reset OTP Dispatched", "A password reset verification code has been sent to your email address.", "info");
    logAction(user.id, user.email, "Requested password reset", "USER", user.id);
  }

  // Always return success to prevent email enumeration
  res.json({ 
    success: true, 
    message: "If an account matches that email address, a password reset OTP has been sent." 
  });
});

app.post("/api/auth/verify-reset-otp", (req, res) => {
  const email = typeof req.body.email === "string" ? req.body.email.trim().toLowerCase() : "";
  const otp = typeof req.body.otp === "string" ? req.body.otp.trim() : "";

  if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
    return res.status(400).json({ success: false, message: "A valid email address is required." });
  }

  if (!otp || otp.length < 6) {
    return res.status(400).json({ success: false, message: "A valid 6-digit OTP is required." });
  }

  const resetRecord = passwordResetOtps.get(email);
  if (!resetRecord || resetRecord.expiresAt <= Date.now()) {
    passwordResetOtps.delete(email);
    return res.status(400).json({ success: false, message: "The OTP is invalid or has expired. Request a new OTP." });
  }

  resetRecord.attempts += 1;
  if (resetRecord.attempts > 5) {
    passwordResetOtps.delete(email);
    return res.status(400).json({ success: false, message: "Too many OTP attempts. Please request a fresh OTP." });
  }

  const otpHash = crypto.createHash("sha256").update(otp).digest("hex");
  if (!crypto.timingSafeEqual(Buffer.from(otpHash), Buffer.from(resetRecord.otpHash))) {
    const attemptsLeft = 5 - resetRecord.attempts;
    if (attemptsLeft <= 0) {
      passwordResetOtps.delete(email);
      return res.status(400).json({ success: false, message: "Too many OTP attempts. Please request a fresh OTP." });
    }
    return res.status(400).json({ success: false, message: `Invalid OTP. ${attemptsLeft} attempt${attemptsLeft === 1 ? "" : "s"} remaining.` });
  }

  const resetToken = crypto.randomBytes(32).toString("hex");
  passwordResetTokens.set(resetToken, {
    userId: resetRecord.userId,
    email: resetRecord.email,
    expiresAt: Date.now() + 15 * 60 * 1000
  });
  passwordResetOtps.delete(email);
  res.json({ success: true, resetToken });
});

app.post("/api/auth/reset-password", (req, res) => {
  const { token, newPassword } = req.body;
  if (!token || typeof token !== "string" || !token.trim()) {
    return res.status(400).json({ success: false, message: "A valid verification token is required." });
  }

  if (!newPassword || typeof newPassword !== "string" || newPassword.length < 6) {
    return res.status(400).json({ success: false, message: "A password with at least 6 characters is required." });
  }

  const resetRecord = passwordResetTokens.get(token);
  if (!resetRecord || resetRecord.expiresAt <= Date.now()) {
    passwordResetTokens.delete(token);
    return res.status(400).json({ success: false, message: "Password reset link is invalid or has expired." });
  }

  const hashedPassword = bcrypt.hashSync(newPassword, 10);
  let updated = false;

  const uIndex = db.users.findIndex(u => u.id === resetRecord.userId);
  if (uIndex !== -1) {
    db.users[uIndex].passwordHash = hashedPassword;
    updated = true;
  } else {
    const cIndex = db.customers.findIndex(c => c.id === resetRecord.userId);
    if (cIndex !== -1) {
      db.customers[cIndex].passwordHash = hashedPassword;
      updated = true;
    }
  }

  if (!updated) {
    return res.status(404).json({ success: false, message: "User account not found." });
  }

  passwordResetTokens.delete(token);
  db.save();

  // Invalidate any active sessions for security
  for (const [sToken, session] of authSessions.entries()) {
    if (session.userId === resetRecord.userId) {
      authSessions.delete(sToken);
    }
  }

  logAction(resetRecord.userId, resetRecord.email, "Reset account password", "USER", resetRecord.userId);
  notifyUser(resetRecord.userId, "Password Reset Successful", "Your password has been changed successfully. You can now log in with your new credentials.", "success");

  res.json({ success: true, message: "Password has been successfully reset. Please log in with your new password." });
});

app.post("/api/auth/verify-email", (req, res) => {
  const { token } = req.body;
  if (!token) {
    return res.status(400).json({ success: false, message: "Verification token is required." });
  }

  const record = emailVerificationTokens.get(token);
  if (!record || record.expiresAt <= Date.now()) {
    emailVerificationTokens.delete(token);
    return res.status(400).json({ success: false, message: "Email verification link is invalid or has expired." });
  }

  emailVerificationTokens.delete(token);
  res.json({ success: true, message: "Email verified successfully." });
});

app.post("/api/auth/logout", (req, res) => {
  const header = req.header("Authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (token) authSessions.delete(token);
  res.json({ success: true });
});

app.put("/api/auth/account", (req, res) => {
  const user = requireAuthenticatedUser(req, res);
  if (!user) return;
  const { fullName, email, contactNumber, address, currentPassword, newPassword } = req.body;
  if (!String(fullName || "").trim() || !String(email || "").trim()) {
    return res.status(400).json({ success: false, message: "Full name and email are required." });
  }
  const normalizedEmail = String(email).trim().toLowerCase();
  const duplicate = [...db.users, ...db.customers].find(item => item.id !== user.id && item.email.toLowerCase() === normalizedEmail);
  if (duplicate) return res.status(400).json({ success: false, message: "Email is already registered." });

  const changingPassword = Boolean(newPassword);
  if (changingPassword) {
    if (typeof newPassword !== "string" || newPassword.length < 6 || !currentPassword) {
      return res.status(400).json({ success: false, message: "Current password and a new password of at least 6 characters are required." });
    }
    if (!bcrypt.compareSync(currentPassword, user.passwordHash)) {
      return res.status(400).json({ success: false, message: "Current password is incorrect." });
    }
  }

  const updates: any = { fullName: String(fullName).trim(), email: String(email).trim(), contactNumber: contactNumber || "", address: address || "" };
  if (changingPassword) updates.passwordHash = bcrypt.hashSync(newPassword, 10);
  const target = user.role === UserRole.CUSTOMER ? db.customers.find(item => item.id === user.id) : db.users.find(item => item.id === user.id);
  if (!target) return res.status(404).json({ success: false, message: "Account not found." });
  Object.assign(target, updates);

  let authToken = req.header("Authorization")?.slice(7).trim() || "";
  if (changingPassword) {
    for (const [token, session] of authSessions.entries()) {
      if (session.userId === user.id) authSessions.delete(token);
    }
    authToken = createAuthToken(user.id);
  }
  db.save();
  logAction(user.id, target.email, "Updated account credentials", "USER", user.id);
  res.json({ success: true, user: publicUser(target, authToken) });
});

app.post("/api/auth/register", async (req, res) => {
  const { email, password, fullName, contactNumber, address, role, studioName, studioAddress, latitude, longitude, businessPermit, validId, otherDocs } = req.body;

  if (!email || !password || !fullName) {
    return res.status(400).json({ success: false, message: "Required fields are missing." });
  }

  if (!/^\S+@\S+\.\S+$/.test(String(email).trim())) {
    return res.status(400).json({ success: false, message: "A valid email address is required." });
  }

  // Check both users and customers tables to prevent duplicate email registration
  const existingInUsers = db.users.find(u => u.email.toLowerCase() === email.toLowerCase());
  const existingInCustomers = db.customers.find(c => c.email.toLowerCase() === email.toLowerCase());
  if (existingInUsers || existingInCustomers) {
    return res.status(400).json({ success: false, message: "Email is already registered." });
  }

  const targetRole = role === UserRole.STUDIO_ADMIN ? UserRole.STUDIO_ADMIN : UserRole.CUSTOMER;
  const userId = generateId(targetRole === "CUSTOMER" ? "CUST" : "U");
  let studioId: string | undefined;

  // Securely hash user password with bcrypt
  const hashedPassword = bcrypt.hashSync(password, 10);

  // If registering as a Customer -> Insert into separate dedicated customers table
  if (targetRole === "CUSTOMER") {
    const newCustomer = {
      id: userId,
      email,
      passwordHash: hashedPassword,
      fullName,
      role: "CUSTOMER" as const,
      contactNumber,
      address,
      createdAt: new Date().toISOString()
    };

    db.addCustomer(newCustomer);
    logAction(userId, email, `Registered customer account in customers table`, "CUSTOMER", userId);

    const authToken = createAuthToken(newCustomer.id);
    return res.json({ success: true, user: publicUser(newCustomer, authToken) });
  }

  // If registering as a Studio Admin, we create their pending studio and save to users table
  if (targetRole === UserRole.STUDIO_ADMIN) {
    studioId = generateId("ST");
    const newStudio: Studio = {
      id: studioId,
      name: studioName || `${fullName}'s Photography Studio`,
      ownerId: userId,
      logo: "",
      coverImage: "",
      location: studioAddress || "Cainta, Rizal",
      rating: 5.0,
      reviewCount: 0,
      startingPrice: 1000,
      categories: ["Portrait Photography"],
      description: "Welcome to our newly registered photography studio! Complete our profile setup to list services, customizable packages, and receive instant bookings.",
      address: studioAddress || address || "Cainta, Rizal",
      contactInfo: contactNumber || "+63 900 000 0000",
      email: email,
      businessHours: "09:00 AM - 06:00 PM",
      isApproved: false,
      status: "pending",
      printingAvailable: true,
      latitude: Number.isFinite(Number(latitude)) ? Number(latitude) : undefined,
      longitude: Number.isFinite(Number(longitude)) ? Number(longitude) : undefined,
      businessPermit: undefined,
      validId: undefined,
      otherDocs: undefined,
      createdAt: new Date().toISOString()
    };
    const documentMedia: Array<{ purpose: string; value: string; name: string }> = [
      { purpose: "BUSINESS_PERMIT", value: businessPermit, name: "business-permit" },
      { purpose: "OWNER_VALID_ID", value: validId, name: "owner-valid-id" },
      { purpose: "SUPPORTING_DOCUMENT", value: otherDocs, name: "supporting-document" }
    ];
    // Create the real owner first so addStudio() does not synthesize a fallback owner.
    const newUser = {
      id: userId,
      email,
      passwordHash: hashedPassword,
      fullName,
      role: targetRole as UserRole,
      studioId,
      contactNumber,
      address,
      createdAt: new Date().toISOString()
    };
    db.addUser(newUser);
    db.addStudio(newStudio);
    for (const document of documentMedia) {
      if (document.value) {
        const media = await saveProtectedMedia(userId, "studio", studioId, document.purpose, document.value, document.name);
        if (media) (newStudio as any)[document.purpose === "BUSINESS_PERMIT" ? "businessPermit" : document.purpose === "OWNER_VALID_ID" ? "validId" : "otherDocs"] = `/api/media/${media.mediaId}`;
      }
    }
    await db.save();
    logAction(userId, email, `Registered new photography studio: ${newStudio.name}`, "STUDIO", studioId);
    
    // Notify super admin
    db.users.filter(u => u.role === UserRole.SUPER_ADMIN).forEach(admin => {
      notifyUser(admin.id, "New Studio Registration", `Studio '${newStudio.name}' has registered and is pending verification.`, "warning");
    });
  }

  res.json({
    success: true,
    message: "Registration submitted successfully. Please wait for Super Admin approval before signing in to the Studio Portal."
  });
});

// CMS Content Management Endpoints
app.get("/api/cms", (req, res) => {
  const cmsMap: { [key: string]: string } = {};
  db.cmsSettings.forEach(s => {
    cmsMap[s.key] = s.value;
  });
  res.json({ success: true, cms: cmsMap });
});

app.post("/api/cms", (req, res) => {
  if (!requireRole(req, res, UserRole.SUPER_ADMIN)) return;
  const updates = req.body;
  if (!updates || typeof updates !== "object") {
    return res.status(400).json({ success: false, message: "Invalid payload." });
  }

  for (const [key, value] of Object.entries(updates)) {
    const stringVal = String(value);
    const index = db.cmsSettings.findIndex(s => s.key === key);
    if (index !== -1) {
      db.cmsSettings[index].value = stringVal;
    } else {
      db.cmsSettings.push({
        id: key,
        key: key,
        value: stringVal
      });
    }
  }

  db.save();
  logAction("system", "system@cainta-mis.com", "Updated system content settings (CMS)", "SYSTEM", "CMS");
  res.json({ success: true, message: "CMS settings updated successfully.", cms: db.cmsSettings });
});

// System Settings (Theme, colors, feature toggles, nav visibility)
app.get("/api/admin/settings", (req, res) => {
  if (!requireRole(req, res, UserRole.SUPER_ADMIN)) return;
  res.json({ success: true, settings: db.systemSettings });
});

app.post("/api/admin/settings", (req, res) => {
  if (!requireRole(req, res, UserRole.SUPER_ADMIN)) return;
  const updates = req.body;
  if (!updates) {
    return res.status(400).json({ success: false, message: "Invalid payload." });
  }
  db.updateSystemSettings(updates);
  logAction("system", "system@cainta-mis.com", "Updated system settings & UI config", "SYSTEM", "SETTINGS");
  res.json({ success: true, settings: db.systemSettings });
});

// The approved audio is public read-only configuration. Only the endpoint above can change it.
app.get("/api/system/audio", (_req, res) => {
  res.json({
    success: true,
    audioUrl: db.systemSettings.customAudioUrl || "",
    isEnabled: db.systemSettings.isSoundEnabled && db.systemSettings.customAudioEnabled !== false
  });
});

app.get("/api/system/demo-video", (_req, res) => {
  const demoVideo = db.mediaFiles.find(item =>
    item.entityType === "system" &&
    item.entityId === "demo-video" &&
    item.purpose === "SYSTEM_DEMO_VIDEO" &&
    item.accessStatus === "active"
  );

  res.json({
    success: true,
    demoVideoUrl: demoVideo ? `/api/media/${demoVideo.id}` : (db.systemSettings.demoVideoUrl || ""),
    showDemoVideo: db.systemSettings.showDemoVideo === true
  });
});

// SMTP Status & Test Email Dispatch Endpoint
app.get("/api/admin/smtp-status", (req, res) => {
  if (!requireRole(req, res, UserRole.SUPER_ADMIN)) return;
  res.json({
    success: true,
    isConfigured: !!(smtpEmail && smtpPassword),
    senderEmail: smtpEmail || "Not configured",
    smtpHost,
    smtpPort,
    smtpSecure,
    fromName: smtpFromName,
    service: smtpHost === "smtp.gmail.com" ? "Gmail SMTP" : smtpHost
  });
});

app.post("/api/admin/send-test-email", async (req, res) => {
  if (!requireRole(req, res, UserRole.SUPER_ADMIN)) return;
  const { toEmail } = req.body;
  const targetEmail = toEmail || smtpEmail;

  if (!targetEmail) {
    return res.status(400).json({ success: false, message: "No recipient email address specified." });
  }

  if (!mailTransporter || !smtpEmail) {
    return res.status(500).json({
      success: false,
      message: "SMTP is not active. Please check SMTP_EMAIL and SMTP_APP_PASSWORD in .env."
    });
  }

  try {
    await sendEmailNotification(
      targetEmail,
      "Test Notification from Cainta Photography MIS",
      "Congratulations! Your Gmail SMTP configuration is fully operational. Real-time booking confirmations, payment approvals, studio applications, and client proofing notifications will now be delivered to your inbox automatically.",
      "success"
    );
    res.json({
      success: true,
      message: `Test email notification successfully sent to ${targetEmail} via Gmail SMTP!`
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: `SMTP error: ${err?.message || "Failed to dispatch email"}` });
  }
});

// Custom Pages Builder Endpoints
app.get("/api/custom-pages", (req, res) => {
  if (req.method !== "GET" && !requireRole(req, res, UserRole.SUPER_ADMIN)) return;
  res.json({ success: true, pages: db.customPages });
});

app.post("/api/custom-pages", (req, res) => {
  if (!requireRole(req, res, UserRole.SUPER_ADMIN)) return;
  const { title, slug, isPublished, showInNavbar, blocks } = req.body;
  if (!title || !slug) {
    return res.status(400).json({ success: false, message: "Title and slug are required." });
  }
  const newPage = {
    id: generateId("PAGE"),
    title,
    slug: slug.toLowerCase().replace(/[^a-z0-9-]/g, "-"),
    isPublished: isPublished !== undefined ? isPublished : true,
    showInNavbar: showInNavbar !== undefined ? showInNavbar : true,
    blocks: blocks || [],
    createdAt: new Date().toISOString()
  };
  db.customPages.push(newPage);
  db.save();
  logAction("system", "system@cainta-mis.com", `Created custom page: ${title}`, "PAGE", newPage.id);
  res.json({ success: true, page: newPage });
});

app.put("/api/custom-pages/:id", (req, res) => {
  if (!requireRole(req, res, UserRole.SUPER_ADMIN)) return;
  const index = db.customPages.findIndex(p => p.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({ success: false, message: "Custom page not found." });
  }
  const updated = {
    ...db.customPages[index],
    ...req.body
  };
  db.customPages[index] = updated;
  db.save();
  logAction("system", "system@cainta-mis.com", `Updated custom page: ${updated.title}`, "PAGE", updated.id);
  res.json({ success: true, page: updated });
});

app.delete("/api/custom-pages/:id", (req, res) => {
  if (!requireRole(req, res, UserRole.SUPER_ADMIN)) return;
  const index = db.customPages.findIndex(p => p.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({ success: false, message: "Custom page not found." });
  }
  const removed = db.customPages.splice(index, 1)[0];
  db.save();
  logAction("system", "system@cainta-mis.com", `Deleted custom page: ${removed.title}`, "PAGE", removed.id);
  res.json({ success: true, message: "Custom page deleted successfully." });
});

// Admin-Only Direct Studio Owner Registration
app.post("/api/admin/register-studio", async (req, res) => {
  if (!requireRole(req, res, UserRole.SUPER_ADMIN)) return;
  const { 
    email, password, fullName, contactNumber, userAddress,
    studioName, description, categories, startingPrice, businessHours,
    address, location, latitude, longitude, businessPermit, validId, otherDocs
  } = req.body;

  if (!email || !password || !fullName || !studioName) {
    return res.status(400).json({ success: false, message: "Required fields are missing." });
  }

  const existing = db.users.find(u => u.email.toLowerCase() === email.toLowerCase()) ||
                   db.customers.find(c => c.email.toLowerCase() === email.toLowerCase());
  if (existing) {
    return res.status(400).json({ success: false, message: "Email is already registered." });
  }

  const userId = generateId("U");
  const studioId = generateId("ST");
  const hashedPassword = bcrypt.hashSync(password, 10);

  // 1. Create registered studio
  const newStudio: Studio = {
    id: studioId,
    name: studioName,
    ownerId: userId,
    logo: "",
    coverImage: "",
    location: location || "Cainta, Rizal",
    rating: 5.0,
    reviewCount: 0,
    startingPrice: Number(startingPrice) || 1000,
    categories: Array.isArray(categories) ? categories : ["Portrait Photography"],
    description: description || "Centralized photography studio.",
    address: address || userAddress || "Cainta, Rizal",
    contactInfo: contactNumber || "+63 900 000 0000",
    email: email,
    businessHours: businessHours || "09:00 AM - 06:00 PM",
    isApproved: true,
    status: "approved",
    printingAvailable: true,
    latitude: latitude !== undefined ? Number(latitude) : undefined,
    longitude: longitude !== undefined ? Number(longitude) : undefined,
    businessPermit: undefined,
    validId: undefined,
    otherDocs: undefined,
    registeredByAdmin: true,
    createdAt: new Date().toISOString()
  };

  const documentMedia: Array<{ purpose: string; value: string; name: string }> = [
    { purpose: "BUSINESS_PERMIT", value: businessPermit, name: "business-permit" },
    { purpose: "OWNER_VALID_ID", value: validId, name: "owner-valid-id" },
    { purpose: "SUPPORTING_DOCUMENT", value: otherDocs, name: "supporting-document" }
  ];

  // 2. Create registered user
  const newUser = {
    id: userId,
    email,
    passwordHash: hashedPassword,
    fullName,
    role: UserRole.STUDIO_ADMIN,
    studioId,
    contactNumber,
    address: userAddress,
    createdAt: new Date().toISOString()
  };

  db.addStudio(newStudio);
  db.addUser(newUser);
  for (const document of documentMedia) {
    if (document.value) {
      const media = await saveProtectedMedia(userId, "studio", studioId, document.purpose, document.value, document.name);
      if (media) (newStudio as any)[document.purpose === "BUSINESS_PERMIT" ? "businessPermit" : document.purpose === "OWNER_VALID_ID" ? "validId" : "otherDocs"] = `/api/media/${media.mediaId}`;
    }
  }
  await db.save();
  
  logAction("system", "system@cainta-mis.com", `Directly registered and verified studio owner account: ${email} for studio ${studioName}`, "STUDIO", studioId);
  notifyUser(userId, "Welcome to Cainta Studio Network", `Your studio '${studioName}' has been directly registered and approved by the Super Admin.`, "success", studioId);

  res.json({ success: true, message: "Studio and owner registered successfully by admin.", user: newUser, studio: newStudio });
});

// Admin-Only Direct Generic User Creation (Customer, Studio Staff, Super Admin)
app.post("/api/admin/create-user", (req, res) => {
  if (!requireRole(req, res, UserRole.SUPER_ADMIN)) return;
  const { email, password, fullName, contactNumber, address, role, studioId } = req.body;

  if (!email || !password || !fullName || !role) {
    return res.status(400).json({ success: false, message: "Email, password, name, and role are required." });
  }

  const existingInUsers = db.users.find(u => u.email.toLowerCase() === email.toLowerCase());
  const existingInCustomers = db.customers.find(c => c.email.toLowerCase() === email.toLowerCase());
  if (existingInUsers || existingInCustomers) {
    return res.status(400).json({ success: false, message: "Email is already registered." });
  }

  const hashedPassword = bcrypt.hashSync(password, 10);

  if (role === "CUSTOMER") {
    const userId = generateId("CUST");
    const newCustomer = {
      id: userId,
      email,
      passwordHash: hashedPassword,
      fullName,
      role: "CUSTOMER" as const,
      contactNumber,
      address,
      createdAt: new Date().toISOString()
    };
    db.addCustomer(newCustomer);
    logAction("system", "system@cainta-mis.com", `Admin created customer user account: ${email}`, "CUSTOMER", userId);
    return res.json({ success: true, message: "Customer account created successfully.", user: newCustomer });
  } else {
    const userId = generateId("U");
    const newUser = {
      id: userId,
      email,
      passwordHash: hashedPassword,
      fullName,
      role: role as UserRole,
      studioId: studioId || undefined,
      contactNumber,
      address,
      createdAt: new Date().toISOString()
    };
    db.addUser(newUser);
    logAction("system", "system@cainta-mis.com", `Admin created user account (${role}): ${email}`, "USER", userId);
    return res.json({ success: true, message: `User account (${role}) created successfully.`, user: newUser });
  }
});

// Studio Endpoints
app.get("/api/studios", (req, res) => {
  // Only approved studios appear publicly, unless a super-admin wants all, or we supply query param
  const { includePending } = req.query;
  if (includePending === "true") {
    if (!requireRole(req, res, UserRole.SUPER_ADMIN)) return;
    return res.json({ success: true, studios: db.studios });
  }
  const approved = db.studios.filter(s => s.status === "approved" || s.isApproved);
  res.json({ success: true, studios: approved });
});

app.get("/api/studios/:id", (req, res) => {
  const studio = db.studios.find(s => s.id === req.params.id);
  if (!studio) {
    return res.status(404).json({ success: false, message: "Studio not found" });
  }
  reconcileStudioBrandingMedia(studio.id);
  if (!studio.isApproved && studio.status !== "approved") {
    const user = requireRole(req, res, UserRole.SUPER_ADMIN, UserRole.STUDIO_ADMIN);
    if (!user || (user.role === UserRole.STUDIO_ADMIN && user.studioId !== studio.id)) return;
  }
  // Load related information
  const services = db.services.filter(s => s.studioId === studio.id && s.isActive);
  const packages = db.packages.filter(p => p.studioId === studio.id && p.isActive);
  const addons = db.addons.filter(a => a.studioId === studio.id);
  const reviews = db.reviews.filter(r => r.studioId === studio.id);
  const printProducts = db.printProducts.filter(p => p.studioId === studio.id && p.isActive);

  res.json({
    success: true,
    studio,
    services,
    packages,
    addons,
    reviews,
    printProducts
  });
});

app.post("/api/studios", (req, res) => {
  if (!requireRole(req, res, UserRole.SUPER_ADMIN)) return;
  const studioId = generateId("ST");
  const newStudio: Studio = {
    id: studioId,
    ...req.body,
    rating: 5.0,
    reviewCount: 0,
    isApproved: false,
    status: "pending",
    createdAt: new Date().toISOString()
  };
  db.addStudio(newStudio);
  res.json({ success: true, studio: newStudio });
});

app.put("/api/studios/:id", async (req, res) => {
  const index = db.studios.findIndex(s => s.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({ success: false, message: "Studio not found." });
  }
  const user = requireAuthenticatedUser(req, res);
  if (!user) return;
  const isOwnerOrAdmin = user.role === UserRole.SUPER_ADMIN || 
                         (user.role === UserRole.STUDIO_ADMIN && (user.studioId === req.params.id || db.studios[index].ownerId === user.id));
  if (!isOwnerOrAdmin) {
    return res.status(403).json({ success: false, message: "You cannot update this studio." });
  }
  const isSuperAdmin = user.role === UserRole.SUPER_ADMIN;
  const ownerFields = [
    "name", "logo", "coverImage", "location", "categories", "description", "address",
    "contactInfo", "email", "businessHours", "printingAvailable", "latitude", "longitude",
    "startingPrice", "blockedDates",
    // Compliance documents — owners may re-upload their own verification files
    "businessPermit", "validId", "otherDocs",
    // Official online presence links shown on the public studio profile
    "facebookUrl", "instagramUrl", "tiktokUrl", "otherSocialUrl", "websiteUrl"
  ];
  const adminFields = [...ownerFields, "ownerId", "isApproved", "status", "registeredByAdmin"];
  const allowedFields = isSuperAdmin ? adminFields : ownerFields;
  const unknownFields = Object.keys(req.body).filter(field => !allowedFields.includes(field));
  if (unknownFields.length > 0) {
    return res.status(400).json({ success: false, message: `Unknown or protected studio fields: ${unknownFields.join(", ")}.` });
  }
  const updates: Record<string, any> = {};
  for (const field of allowedFields) {
    if (field in req.body) updates[field] = req.body[field];
  }
  if (updates.latitude !== undefined && (typeof updates.latitude !== "number" || updates.latitude < -90 || updates.latitude > 90)) {
    return res.status(400).json({ success: false, message: "Latitude must be a number between -90 and 90." });
  }
  if (updates.longitude !== undefined && (typeof updates.longitude !== "number" || updates.longitude < -180 || updates.longitude > 180)) {
    return res.status(400).json({ success: false, message: "Longitude must be a number between -180 and 180." });
  }
  // Normalize the public online-presence links before they are stored so the
  // public profile can safely render them as href values.
  const externalLinkLabels: Record<string, string> = {
    facebookUrl: "Facebook",
    instagramUrl: "Instagram",
    tiktokUrl: "TikTok",
    otherSocialUrl: "Other social",
    websiteUrl: "Website"
  };
  for (const field of Object.keys(externalLinkLabels)) {
    if (!(field in updates)) continue;
    const cleaned = sanitizeExternalUrl(updates[field]);
    if (cleaned === null) {
      return res.status(400).json({
        success: false,
        message: `${externalLinkLabels[field]} link must be a valid http(s) URL (max ${EXTERNAL_LINK_MAX_LENGTH} characters).`
      });
    }
    updates[field] = cleaned;
  }
  const uploadFields: Array<{ field: "logo" | "coverImage" | "businessPermit" | "validId" | "otherDocs"; purpose: string }> = [
    { field: "logo", purpose: "STUDIO_LOGO" },
    { field: "coverImage", purpose: "STUDIO_COVER" },
    { field: "businessPermit", purpose: "BUSINESS_PERMIT" },
    { field: "validId", purpose: "OWNER_VALID_ID" },
    { field: "otherDocs", purpose: "SUPPORTING_DOCUMENT" }
  ];
  for (const upload of uploadFields) {
    const value = updates[upload.field];
    if (typeof value === "string" && value.startsWith("data:")) {
      const media = await saveProtectedMedia(user.id, "studio", req.params.id, upload.purpose, value, upload.field);
      if (!media) return res.status(400).json({ success: false, message: `${upload.field} is not a supported file.` });
      updates[upload.field] = media.url;
    }
  }
  db.studios[index] = { ...db.studios[index], ...updates };
  reconcileStudioBrandingMedia(req.params.id);
  await db.save();
  logAction(user.id, user.email, "Updated studio profile", "STUDIO", req.params.id);
  res.json({ success: true, studio: db.studios[index] });
});

app.put("/api/studios/:id/approve", (req, res) => {
  if (!requireRole(req, res, UserRole.SUPER_ADMIN)) return;
  const index = db.studios.findIndex(s => s.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({ success: false, message: "Studio not found." });
  }
  db.studios[index].isApproved = true;
  db.studios[index].status = "approved";
  db.save();

  const studio = db.studios[index];
  logAction("system", "system@cainta-mis.com", `Approved studio registration: ${studio.name}`, "STUDIO", studio.id);
  notifyUser(studio.ownerId, "Studio Approved", `Your studio '${studio.name}' has been verified and approved by the Super Admin! You can now start receiving client bookings.`, "success", studio.id);

  res.json({ success: true, studio });
});

app.put("/api/studios/:id/reject", (req, res) => {
  const admin = requireRole(req, res, UserRole.SUPER_ADMIN);
  if (!admin) return;
  const index = db.studios.findIndex(s => s.id === req.params.id);
  if (index === -1) return res.status(404).json({ success: false, message: "Studio not found." });

  const studio = db.studios[index];
  studio.isApproved = false;
  studio.status = "rejected";
  db.save();
  for (const [token, session] of authSessions.entries()) {
    if (session.userId === studio.ownerId) authSessions.delete(token);
  }
  logAction(admin.id, admin.email, `Rejected studio registration: ${studio.name}`, "STUDIO", studio.id);
  notifyUser(studio.ownerId, "Studio Registration Rejected", `Your studio '${studio.name}' was rejected by the Super Admin.`, "error", studio.id);
  res.json({ success: true, studio });
});

app.put("/api/admin/users/:id/status", (req, res) => {
  const admin = requireRole(req, res, UserRole.SUPER_ADMIN);
  if (!admin) return;
  const { status } = req.body;
  if (!["approved", "rejected", "suspended"].includes(status)) {
    return res.status(400).json({ success: false, message: "Status must be approved, rejected, or suspended." });
  }
  const user = db.users.find(item => item.id === req.params.id);
  if (!user || user.role !== UserRole.STUDIO_ADMIN) {
    return res.status(400).json({ success: false, message: "Only studio-owner accounts can be moderated here." });
  }
  const studio = db.studios.find(item =>
    item.ownerId === user.id ||
    item.id === user.studioId ||
    (item.email && user.email && item.email.toLowerCase() === user.email.toLowerCase())
  );
  if (!studio) return res.status(404).json({ success: false, message: "Owner studio not found." });

  studio.status = status;
  studio.isApproved = status === "approved";
  db.save();
  if (status !== "approved") {
    for (const [token, session] of authSessions.entries()) {
      if (session.userId === user.id) authSessions.delete(token);
    }
  }
  logAction(admin.id, admin.email, `${status[0].toUpperCase()}${status.slice(1)} studio owner account`, "USER", user.id);
  notifyUser(user.id, `Studio Account ${status[0].toUpperCase()}${status.slice(1)}`, `Your studio account has been ${status} by the Super Admin.`, status === "approved" ? "success" : "error", studio.id);
  res.json({ success: true, user, studio });
});

app.delete("/api/studios/:id", (req, res) => {
  const admin = requireRole(req, res, UserRole.SUPER_ADMIN);
  if (!admin) return;
  const index = db.studios.findIndex(s => s.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({ success: false, message: "Studio not found." });
  }
  const studio = db.studios[index];
  const hasActiveBookings = db.bookings.some(booking => booking.studioId === studio.id && !["Completed", "Cancelled", "Rejected", "Expired", "No Show"].includes(booking.status));
  if (hasActiveBookings) {
    return res.status(409).json({ success: false, message: "This studio has active bookings and cannot be archived yet." });
  }
  studio.status = "suspended";
  studio.isApproved = false;
  db.save();
  logAction(admin.id, admin.email, `Archived studio: ${studio.name}`, "STUDIO", studio.id);
  res.json({ success: true, message: "Studio archived successfully.", studio });
});

// Studio Staff Management Endpoints
app.get("/api/studios/:id/staff", (req, res) => {
  const user = requireStudioAccess(req, res, req.params.id);
  if (!user) return;
  const staff = db.users
    .filter(u => u.studioId === req.params.id && [UserRole.STUDIO_ADMIN, UserRole.STUDIO_STAFF].includes(u.role))
    .map(u => {
      const { passwordHash, ...safe } = u;
      return safe;
    });
  res.json({ success: true, staff });
});

app.post("/api/studios/:id/staff/invite", (req, res) => {
  const user = requireStudioAccess(req, res, req.params.id);
  if (!user) return;
  if (user.role !== UserRole.SUPER_ADMIN && user.role !== UserRole.STUDIO_ADMIN) {
    return res.status(403).json({ success: false, message: "Only studio administrators can invite staff." });
  }

  const { email, fullName, password, contactNumber } = req.body;
  if (!email || !fullName) {
    return res.status(400).json({ success: false, message: "Staff email and full name are required." });
  }

  const existing = db.users.find(u => u.email.toLowerCase() === email.trim().toLowerCase()) ||
                   db.customers.find(c => c.email.toLowerCase() === email.trim().toLowerCase());
  if (existing) {
    return res.status(400).json({ success: false, message: "An account with this email already exists." });
  }

  const staffId = generateId("STAFF");
  const defaultPassword = password || "Staff123!";
  const hashedPassword = bcrypt.hashSync(defaultPassword, 10);

  const newStaff = {
    id: staffId,
    email: email.trim(),
    passwordHash: hashedPassword,
    fullName: fullName.trim(),
    role: UserRole.STUDIO_STAFF,
    studioId: req.params.id,
    contactNumber: contactNumber || undefined,
    createdAt: new Date().toISOString()
  };

  db.addUser(newStaff);
  logAction(user.id, user.email, `Invited new studio staff: ${fullName}`, "USER", staffId);
  sendEmailNotification(
    email.trim(),
    "Studio Staff Invitation",
    `You have been invited to join the studio management team on Cainta Photography Studio MIS. Your temporary login password is: ${defaultPassword}`,
    "info"
  );

  const { passwordHash: _, ...safeStaff } = newStaff;
  res.json({ success: true, staff: safeStaff });
});

app.delete("/api/studios/:id/staff/:staffId", (req, res) => {
  const user = requireStudioAccess(req, res, req.params.id);
  if (!user) return;
  if (user.role !== UserRole.SUPER_ADMIN && user.role !== UserRole.STUDIO_ADMIN) {
    return res.status(403).json({ success: false, message: "Only studio administrators can remove staff." });
  }

  const index = db.users.findIndex(u => u.id === req.params.staffId && u.studioId === req.params.id && u.role === UserRole.STUDIO_STAFF);
  if (index === -1) {
    return res.status(404).json({ success: false, message: "Staff member not found or is not removable." });
  }

  const removed = db.users.splice(index, 1)[0];
  db.save();
  logAction(user.id, user.email, `Removed staff member: ${removed.fullName}`, "USER", removed.id);
  res.json({ success: true, message: "Staff member removed successfully." });
});

// Users & Customers Endpoints
app.get("/api/users", (req, res) => {
  if (!requireRole(req, res, UserRole.SUPER_ADMIN)) return;
  // Combines admin/studio users and customers for comprehensive system overview
  const allAccounts = [
    ...db.users,
    ...db.customers.map(c => ({ ...c, role: "CUSTOMER" as const }))
  ];
  res.json({ success: true, users: allAccounts });
});

app.delete("/api/users/:id", (req, res) => {
  const admin = requireRole(req, res, UserRole.SUPER_ADMIN);
  if (!admin) return;

  const userId = req.params.id;

  const userIndex = db.users.findIndex(u => u.id === userId);
  if (userIndex !== -1) {
    const removed = db.users.splice(userIndex, 1)[0];
    // Mark as deleted BEFORE save() so ensureIntegrity() and mysqlInsert()
    // don't re-create this account during the persist call that follows.
    db.markUserDeleted(removed.id);
    for (const [token, session] of authSessions.entries()) {
      if (session.userId === removed.id) authSessions.delete(token);
    }
    db.save();
    logAction(admin.id, admin.email, `Deleted user account: ${removed.fullName || removed.email}`, "USER", removed.id);
    return res.json({ success: true, message: "User deleted successfully." });
  }

  const customerIndex = db.customers.findIndex(c => c.id === userId);
  if (customerIndex !== -1) {
    const removed = db.customers.splice(customerIndex, 1)[0];
    // Same guard — mark before save so the deleted ID is never re-inserted.
    db.markUserDeleted(removed.id);
    for (const [token, session] of authSessions.entries()) {
      if (session.userId === removed.id) authSessions.delete(token);
    }
    db.save();
    logAction(admin.id, admin.email, `Deleted customer account: ${removed.fullName || removed.email}`, "USER", removed.id);
    return res.json({ success: true, message: "Customer deleted successfully." });
  }

  return res.status(404).json({ success: false, message: "User not found." });
});

// Dedicated Customers Table Endpoint
app.get("/api/customers", (req, res) => {
  if (!requireRole(req, res, UserRole.SUPER_ADMIN)) return;
  res.json({ success: true, customers: db.customers });
});

// ── Archive a customer (soft-delete) ────────────────────────────────────────
app.put("/api/customers/:id/archive", (req, res) => {
  const admin = requireRole(req, res, UserRole.SUPER_ADMIN);
  if (!admin) return;

  const idx = db.customers.findIndex(c => c.id === req.params.id);
  if (idx === -1) return res.status(404).json({ success: false, message: "Customer not found." });

  db.customers[idx] = {
    ...db.customers[idx],
    isArchived: true,
    archivedAt: new Date().toISOString(),
    archivedBy: admin.id
  };
  db.save();
  logAction(admin.id, admin.email, `Archived customer: ${db.customers[idx].fullName}`, "CUSTOMER", req.params.id);
  res.json({ success: true, customer: db.customers[idx] });
});

// ── Unarchive a customer ─────────────────────────────────────────────────────
app.put("/api/customers/:id/unarchive", (req, res) => {
  const admin = requireRole(req, res, UserRole.SUPER_ADMIN);
  if (!admin) return;

  const idx = db.customers.findIndex(c => c.id === req.params.id);
  if (idx === -1) return res.status(404).json({ success: false, message: "Customer not found." });

  db.customers[idx] = {
    ...db.customers[idx],
    isArchived: false,
    archivedAt: undefined,
    archivedBy: undefined
  };
  db.save();
  logAction(admin.id, admin.email, `Unarchived customer: ${db.customers[idx].fullName}`, "CUSTOMER", req.params.id);
  res.json({ success: true, customer: db.customers[idx] });
});

// ── Permanently delete an archived customer ──────────────────────────────────
app.delete("/api/customers/:id", (req, res) => {
  const admin = requireRole(req, res, UserRole.SUPER_ADMIN);
  if (!admin) return;

  const idx = db.customers.findIndex(c => c.id === req.params.id);
  if (idx === -1) return res.status(404).json({ success: false, message: "Customer not found." });

  const customer = db.customers[idx];
  if (!customer.isArchived) {
    return res.status(409).json({ success: false, message: "Archive this customer first before permanently deleting." });
  }

  db.customers.splice(idx, 1);
  db.markUserDeleted(customer.id);
  for (const [token, session] of authSessions.entries()) {
    if (session.userId === customer.id) authSessions.delete(token);
  }
  db.save();
  logAction(admin.id, admin.email, `Permanently deleted customer: ${customer.fullName}`, "CUSTOMER", customer.id);
  res.json({ success: true, message: "Customer permanently deleted." });
});

// Global Services
app.get("/api/services", (req, res) => {
  res.json({ success: true, services: db.services });
});

// Global Packages
app.get("/api/packages", (req, res) => {
  res.json({ success: true, packages: db.packages });
});

// Global Addons
app.get("/api/addons", (req, res) => {
  res.json({ success: true, addons: db.addons });
});

// Global Reviews - PUBLIC: submitted reviews are visible unless rejected or intentionally hidden by the studio owner
app.get("/api/reviews", (req, res) => {
  const visibleReviews = db.reviews.filter(r => r.status !== "rejected" && r.isVisible !== false);
  res.json({ success: true, reviews: visibleReviews });
});

// Categories
app.get("/api/categories", (req, res) => {
  res.json({ success: true, categories: db.categories });
});

app.post("/api/categories", (req, res) => {
  if (!requireRole(req, res, UserRole.SUPER_ADMIN)) return;
  const name = typeof req.body.name === "string" ? req.body.name.trim() : "";
  const description = typeof req.body.description === "string" ? req.body.description.trim() : "";
  if (!name) {
    return res.status(400).json({ success: false, message: "Category name is required." });
  }
  if (db.categories.some(category => category.name.toLowerCase() === name.toLowerCase())) {
    return res.status(409).json({ success: false, message: "A category with this name already exists." });
  }
  const newCat = {
    id: generateId("CAT"),
    name,
    description,
    createdAt: new Date().toISOString()
  };
  db.addCategory(newCat);
  res.json({ success: true, category: newCat });
});

app.put("/api/categories/:id", (req, res) => {
  if (!requireRole(req, res, UserRole.SUPER_ADMIN)) return;
  const category = db.categories.find(item => item.id === req.params.id);
  if (!category) {
    return res.status(404).json({ success: false, message: "Category not found." });
  }
  const name = typeof req.body.name === "string" ? req.body.name.trim() : "";
  const description = typeof req.body.description === "string" ? req.body.description.trim() : "";
  if (!name) {
    return res.status(400).json({ success: false, message: "Category name is required." });
  }
  if (db.categories.some(item => item.id !== category.id && item.name.toLowerCase() === name.toLowerCase())) {
    return res.status(409).json({ success: false, message: "A category with this name already exists." });
  }
  category.name = name;
  category.description = description;
  db.save();
  res.json({ success: true, category });
});

app.delete("/api/categories/:id", (req, res) => {
  if (!requireRole(req, res, UserRole.SUPER_ADMIN)) return;
  const index = db.categories.findIndex(c => c.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({ success: false, message: "Category not found." });
  }
  db.categories.splice(index, 1);
  db.save();
  res.json({ success: true, message: "Category removed successfully." });
});

// Service management
app.get("/api/studios/:studioId/services", (req, res) => {
  const services = db.services.filter(s => s.studioId === req.params.studioId);
  res.json({ success: true, services });
});

app.post("/api/studios/:studioId/services", async (req, res) => {
  const user = requireStudioAccess(req, res, req.params.studioId);
  if (!user) return;
  const newService: StudioService = {
    id: generateId("SRV"),
    studioId: req.params.studioId,
    name: req.body.name,
    description: req.body.description,
    category: req.body.category,
    basePrice: Number(req.body.basePrice),
    durationMinutes: Number(req.body.durationMinutes),
    image: "",
    images: [],
    isActive: true,
    availableDays: req.body.availableDays || ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
    availableSlots: req.body.availableSlots || ["09:00 AM", "10:30 AM", "01:00 PM", "02:30 PM", "04:00 PM"],
    requirements: req.body.requirements || ["Arrive 10 minutes early"],
    createdAt: new Date().toISOString()
  };
  const submittedImages = Array.isArray(req.body.images) ? req.body.images : (req.body.image ? [req.body.image] : []);
  for (const [index, submittedImage] of submittedImages.entries()) {
    if (typeof submittedImage === "string" && (/^https?:\/\//.test(submittedImage) || submittedImage.startsWith("/api/media/"))) {
      newService.images?.push(submittedImage);
      continue;
    }
    const media = await saveProtectedMedia(user.id, "service", newService.id, "SERVICE_IMAGE", submittedImage, `service-image-${index + 1}`);
    if (!media) return res.status(400).json({ success: false, message: "Service images must be supported images smaller than 8 MB." });
    newService.images?.push(`/api/media/${media.mediaId}`);
  }
  newService.image = newService.images?.[0] || "";
  db.addService(newService);
  res.json({ success: true, service: newService });
});

app.put("/api/services/:id", async (req, res) => {
  const index = db.services.findIndex(s => s.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({ success: false, message: "Service not found." });
  }
  const user = requireStudioAccess(req, res, db.services[index].studioId);
  if (!user) return;
  const service = db.services[index];
  const submittedImages = Array.isArray(req.body.images) ? req.body.images : (req.body.image ? [req.body.image] : undefined);
  let protectedImages = service.images || (service.image ? [service.image] : []);
  if (submittedImages) {
    protectedImages = [];
    for (const [imageIndex, submittedImage] of submittedImages.entries()) {
      if (typeof submittedImage === "string" && submittedImage.startsWith("/api/media/")) {
        protectedImages.push(submittedImage);
        continue;
      }
      if (typeof submittedImage === "string" && /^https?:\/\//.test(submittedImage)) {
        protectedImages.push(submittedImage);
        continue;
      }
      const media = await saveProtectedMedia(user.id, "service", service.id, "SERVICE_IMAGE", submittedImage, `service-image-${imageIndex + 1}`);
      if (!media) return res.status(400).json({ success: false, message: "Service images must be supported images smaller than 8 MB." });
      protectedImages.push(`/api/media/${media.mediaId}`);
    }
  }
  db.services[index] = { ...service, ...req.body, images: protectedImages, image: protectedImages[0] || "" };
  db.save();
  res.json({ success: true, service: db.services[index] });
});

app.delete("/api/services/:id", (req, res) => {
  const index = db.services.findIndex(s => s.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({ success: false, message: "Service not found." });
  }
  if (!requireStudioAccess(req, res, db.services[index].studioId)) return;
  db.services.splice(index, 1);
  db.save();
  res.json({ success: true, message: "Service deleted." });
});

// Packages
app.get("/api/studios/:studioId/packages", (req, res) => {
  const packages = db.packages.filter(p => p.studioId === req.params.studioId);
  res.json({ success: true, packages });
});

app.post("/api/studios/:studioId/packages", async (req, res) => {
  const user = requireStudioAccess(req, res, req.params.studioId);
  if (!user) return;
  const newPkg: StudioPackage = {
    id: generateId("PKG"),
    studioId: req.params.studioId,
    name: req.body.name,
    description: req.body.description,
    price: Number(req.body.price),
    durationMinutes: Number(req.body.durationMinutes),
    editedPhotosCount: Number(req.body.editedPhotosCount),
    includedPrints: req.body.includedPrints || "None",
    photographerCount: Number(req.body.photographerCount),
    includedServices: req.body.includedServices || [],
    termsAndConditions: req.body.termsAndConditions || "No terms specified.",
    image: "",
    isActive: true,
    createdAt: new Date().toISOString()
  };
  if (req.body.image) {
    const media = await saveProtectedMedia(user.id, "package", newPkg.id, "PACKAGE_IMAGE", req.body.image, "package-image");
    if (!media) return res.status(400).json({ success: false, message: "Package image must be a supported image smaller than 8 MB." });
    newPkg.image = `/api/media/${media.mediaId}`;
  }
  db.addPackage(newPkg);
  res.json({ success: true, package: newPkg });
});

app.put("/api/packages/:id", async (req, res) => {
  const index = db.packages.findIndex(p => p.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({ success: false, message: "Package not found." });
  }
  const user = requireStudioAccess(req, res, db.packages[index].studioId);
  if (!user) return;
  const pkg = db.packages[index];
  let image = pkg.image;
  if (req.body.image && req.body.image !== pkg.image) {
    const media = await saveProtectedMedia(user.id, "package", pkg.id, "PACKAGE_IMAGE", req.body.image, "package-image");
    if (!media) return res.status(400).json({ success: false, message: "Package image must be a supported image smaller than 8 MB." });
    image = `/api/media/${media.mediaId}`;
  }
  db.packages[index] = { ...pkg, ...req.body, image };
  db.save();
  res.json({ success: true, package: db.packages[index] });
});

app.delete("/api/packages/:id", (req, res) => {
  const index = db.packages.findIndex(p => p.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({ success: false, message: "Package not found." });
  }
  if (!requireStudioAccess(req, res, db.packages[index].studioId)) return;
  db.packages.splice(index, 1);
  db.save();
  res.json({ success: true, message: "Package deleted." });
});

// Addons
app.get("/api/studios/:studioId/addons", (req, res) => {
  const addons = db.addons.filter(a => a.studioId === req.params.studioId);
  res.json({ success: true, addons });
});

app.post("/api/studios/:studioId/addons", async (req, res) => {
  const user = requireStudioAccess(req, res, req.params.studioId);
  if (!user) return;
  const newAddon: PackageAddon = {
    id: generateId("ADD"),
    studioId: req.params.studioId,
    name: req.body.name,
    price: Number(req.body.price),
    description: req.body.description || "",
    image: "",
    createdAt: new Date().toISOString()
  };
  if (req.body.image) {
    const media = await saveProtectedMedia(user.id, "addon", newAddon.id, "ADDON_IMAGE", req.body.image, "addon-image");
    if (!media) return res.status(400).json({ success: false, message: "Add-on image must be a supported image smaller than 8 MB." });
    newAddon.image = `/api/media/${media.mediaId}`;
  }
  db.addAddon(newAddon);
  res.json({ success: true, addon: newAddon });
});

app.delete("/api/addons/:id", (req, res) => {
  const index = db.addons.findIndex(a => a.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({ success: false, message: "Addon not found." });
  }
  if (!requireStudioAccess(req, res, db.addons[index].studioId)) return;
  db.addons.splice(index, 1);
  db.save();
  res.json({ success: true, message: "Addon removed." });
});

function parseHHMM(value: string): number {
  if (!value || typeof value !== "string") return 0;
  const [hourRaw, minuteRaw] = String(value).split(":");
  const hour = Number(hourRaw || 0);
  const minute = Number(minuteRaw || 0);
  if (Number.isNaN(hour) || Number.isNaN(minute)) return 0;
  return hour * 60 + minute;
}

// Studio availability endpoints (publicly readable for booking calendar, owner-only for write)
app.get("/api/studios/:studioId/availability", (req, res) => {
  const availability = db.availabilities.filter(a => a.studioId === req.params.studioId);
  res.json({ success: true, availability });
});

app.post("/api/studios/:studioId/availability", (req, res) => {
  const user = requireStudioOwner(req, res, req.params.studioId);
  if (!user) return;

  const payload = req.body || {};
  const dayOfWeek = Number(payload.dayOfWeek);
  if (Number.isNaN(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6) {
    return res.status(400).json({ success: false, message: "Please select a valid day of week." });
  }

  const openingTime = String(payload.openingTime || "09:00");
  const closingTime = String(payload.closingTime || "18:00");
  const start = parseHHMM(openingTime);
  const end = parseHHMM(closingTime);
  if (start >= end) {
    return res.status(400).json({ success: false, message: "Closing time must be after opening time." });
  }

  const existing = db.availabilities.find(a => a.studioId === req.params.studioId && a.dayOfWeek === dayOfWeek);
  const item: StudioAvailability = existing || {
    id: generateId("AVL"),
    studioId: req.params.studioId,
    dayOfWeek,
    openingTime,
    closingTime,
    isAvailable: payload.isAvailable !== false,
    slotDurationMinutes: Number(payload.slotDurationMinutes) || 60,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  if (existing) {
    Object.assign(existing, {
      openingTime,
      closingTime,
      isAvailable: payload.isAvailable !== false,
      slotDurationMinutes: Number(payload.slotDurationMinutes) || 60,
      updatedAt: new Date().toISOString()
    });
  } else {
    db.availabilities.push(item);
  }

  db.save();
  res.json({ success: true, availability: item });
});

app.put("/api/studios/:studioId/availability/:id", (req, res) => {
  const user = requireStudioOwner(req, res, req.params.studioId);
  if (!user) return;

  const index = db.availabilities.findIndex(a => a.id === req.params.id && a.studioId === req.params.studioId);
  if (index === -1) {
    return res.status(404).json({ success: false, message: "Availability not found." });
  }

  const payload = req.body || {};
  const openingTime = String(payload.openingTime || db.availabilities[index].openingTime);
  const closingTime = String(payload.closingTime || db.availabilities[index].closingTime);
  const start = parseHHMM(openingTime);
  const end = parseHHMM(closingTime);
  if (start >= end) {
    return res.status(400).json({ success: false, message: "Closing time must be after opening time." });
  }

  db.availabilities[index] = {
    ...db.availabilities[index],
    dayOfWeek: Number(payload.dayOfWeek ?? db.availabilities[index].dayOfWeek),
    openingTime,
    closingTime,
    isAvailable: payload.isAvailable !== false,
    slotDurationMinutes: Number(payload.slotDurationMinutes) || db.availabilities[index].slotDurationMinutes,
    updatedAt: new Date().toISOString()
  };

  db.save();
  res.json({ success: true, availability: db.availabilities[index] });
});

app.delete("/api/studios/:studioId/availability/:id", (req, res) => {
  const user = requireStudioOwner(req, res, req.params.studioId);
  if (!user) return;

  const index = db.availabilities.findIndex(a => a.id === req.params.id && a.studioId === req.params.studioId);
  if (index === -1) {
    return res.status(404).json({ success: false, message: "Availability not found." });
  }

  db.availabilities.splice(index, 1);
  db.save();
  res.json({ success: true, message: "Availability removed." });
});

// Blackout date endpoints (publicly readable for booking calendar, owner-only for write)
app.get("/api/studios/:studioId/blackouts", (req, res) => {
  const blackouts = db.blackouts.filter(b => b.studioId === req.params.studioId);
  res.json({ success: true, blackouts });
});

app.post("/api/studios/:studioId/blackouts", (req, res) => {
  const user = requireStudioOwner(req, res, req.params.studioId);
  if (!user) return;

  const blackout: AvailabilityBlackout = {
    id: generateId("BLK"),
    studioId: req.params.studioId,
    blackoutDate: String(req.body.blackoutDate || new Date().toISOString().slice(0, 10)),
    startTime: String(req.body.startTime || "00:00"),
    endTime: String(req.body.endTime || "23:59"),
    reason: String(req.body.reason || "Studio closure"),
    isRecurring: Boolean(req.body.isRecurring),
    recurrenceRule: req.body.recurrenceRule || undefined,
    createdAt: new Date().toISOString()
  };

  db.blackouts.push(blackout);
  db.save();
  res.json({ success: true, blackout });
});

app.delete("/api/studios/:studioId/blackouts/:id", (req, res) => {
  const user = requireStudioOwner(req, res, req.params.studioId);
  if (!user) return;

  const index = db.blackouts.findIndex(b => b.id === req.params.id && b.studioId === req.params.studioId);
  if (index === -1) {
    return res.status(404).json({ success: false, message: "Blackout not found." });
  }

  db.blackouts.splice(index, 1);
  db.save();
  res.json({ success: true, message: "Blackout removed." });
});

// Helper to parse time slot string (e.g., "09:00 AM", "01:30 PM", "14:00") into minutes from midnight
function parseTimeToMinutes(timeStr: string): number {
  if (!timeStr) return 540; // Default 9:00 AM
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

function minutesToTimeStr(totalMinutes: number): string {
  const hours24 = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const period = hours24 >= 12 ? "PM" : "AM";
  let hours12 = hours24 % 12;
  if (hours12 === 0) hours12 = 12;
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${pad(hours12)}:${pad(minutes)} ${period}`;
}

// Dynamic real-time slot generation endpoint based on studio owner availability
app.get("/api/studios/:studioId/slots", (req, res) => {
  const studioId = req.params.studioId;
  const dateStr = String(req.query.date || "");
  const durationMinutes = Math.max(15, Number(req.query.duration) || 60);
  const excludeBookingId = String(req.query.excludeBookingId || "");

  const studio = db.studios.find(s => s.id === studioId);
  if (!studio) {
    return res.status(404).json({ success: false, message: "Studio not found." });
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return res.status(400).json({ success: false, message: "Valid date parameter (YYYY-MM-DD) is required." });
  }

  // 1. Check studio owner blocked dates (closed holidays)
  const isBlockedDate = Array.isArray(studio.blockedDates) && studio.blockedDates.includes(dateStr);
  if (isBlockedDate) {
    return res.json({
      success: true,
      isClosed: true,
      reason: `The studio is closed on ${dateStr} (Scheduled holiday / blocked date).`,
      slots: []
    });
  }

  // 2. Check full-day blackout
  const dayBlackouts = db.blackouts.filter(b => b.studioId === studioId && b.blackoutDate === dateStr);
  const fullDayBlackout = dayBlackouts.find(b => {
    const s = parseHHMM(b.startTime);
    const e = parseHHMM(b.endTime);
    return (s <= 540 && e >= 1080) || (s === 0 && e >= 1439);
  });
  if (fullDayBlackout) {
    return res.json({
      success: true,
      isClosed: true,
      reason: `The studio is closed on ${dateStr}: ${fullDayBlackout.reason || "Closure"}.`,
      slots: []
    });
  }

  // 3. Day of week availability check
  const targetDate = new Date(`${dateStr}T00:00:00`);
  const dayOfWeek = targetDate.getDay();
  const dayName = targetDate.toLocaleDateString("en-US", { weekday: "long" });

  const availability = db.availabilities.find(a => a.studioId === studioId && a.dayOfWeek === dayOfWeek);

  if (availability && !availability.isAvailable) {
    return res.json({
      success: true,
      isClosed: true,
      reason: `The studio is closed on ${dayName}s.`,
      slots: []
    });
  }

  const serviceId = String(req.query.serviceId || "");
  const selectedService = serviceId ? db.services.find(s => s.id === serviceId && s.studioId === studioId) : undefined;

  const defaultHours = parseBusinessHours(studio.businessHours);
  const openingTime = availability ? availability.openingTime : defaultHours.openingTime;
  const closingTime = availability ? availability.closingTime : defaultHours.closingTime;
  const slotDuration = Math.max(15, availability?.slotDurationMinutes || 60);

  const startMinutes = parseHHMM(openingTime);
  const endMinutes = parseHHMM(closingTime);

  // Candidate slots: if studio availability is configured or business hours exist, generate dynamically
  let candidateSlots: string[] = [];
  if (availability || studio.businessHours) {
    for (let m = startMinutes; m + durationMinutes <= endMinutes; m += slotDuration) {
      candidateSlots.push(minutesToTimeStr(m));
    }
    if (candidateSlots.length === 0 && startMinutes < endMinutes) {
      for (let m = startMinutes; m < endMinutes; m += slotDuration) {
        candidateSlots.push(minutesToTimeStr(m));
      }
    }
  } else if (selectedService?.availableSlots && selectedService.availableSlots.length > 0) {
    candidateSlots = selectedService.availableSlots;
  } else {
    for (let m = startMinutes; m + durationMinutes <= endMinutes; m += slotDuration) {
      candidateSlots.push(minutesToTimeStr(m));
    }
    if (candidateSlots.length === 0 && startMinutes < endMinutes) {
      for (let m = startMinutes; m < endMinutes; m += slotDuration) {
        candidateSlots.push(minutesToTimeStr(m));
      }
    }
  }

  // Existing active bookings on that date
  const dayBookings = db.bookings.filter(b => 
    b.studioId === studioId && 
    b.bookingDate === dateStr && 
    b.id !== excludeBookingId &&
    !["Cancelled", "Rejected", "Expired"].includes(b.status)
  );

  const now = new Date();
  const todayStr = now.toISOString().split("T")[0];
  const isToday = dateStr === todayStr;
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  const slots: { slot: string; isBooked: boolean; isBlackout: boolean; isPast: boolean; status: string; available: boolean }[] = [];

  for (const slotStr of candidateSlots) {
    const m = parseTimeToMinutes(slotStr);
    const slotEnd = m + durationMinutes;

    // Check partial blackout overlap
    const inBlackout = dayBlackouts.some(b => {
      const bStart = parseHHMM(b.startTime);
      const bEnd = parseHHMM(b.endTime);
      return m < bEnd && slotEnd > bStart;
    });

    // Check booking overlap
    const inBooking = dayBookings.some(b => {
      let bDuration = 60;
      if (b.packageId) {
        const pkg = db.packages.find(p => p.id === b.packageId);
        if (pkg?.durationMinutes) bDuration = pkg.durationMinutes;
      } else if (b.serviceId) {
        const svc = db.services.find(s => s.id === b.serviceId);
        if (svc?.durationMinutes) bDuration = svc.durationMinutes;
      }
      const bStart = parseTimeToMinutes(b.timeSlot);
      const bEnd = bStart + bDuration;
      return m < bEnd && slotEnd > bStart;
    });

    const isPast = isToday && m <= currentMinutes;
    let status = "available";
    if (inBooking) {
      status = "booked";
    } else if (inBlackout) {
      status = "blackout";
    } else if (isPast) {
      status = "past";
    }

    slots.push({
      slot: slotStr,
      isBooked: inBooking,
      isBlackout: inBlackout,
      isPast,
      status,
      available: status === "available"
    });
  }

  res.json({
    success: true,
    isClosed: false,
    dayName,
    openingTime,
    closingTime,
    slotDurationMinutes: slotDuration,
    slots
  });
});

// Bookings
app.get("/api/bookings", (req, res) => {
  const user = requireAuthenticatedUser(req, res);
  if (!user) return;
  db.bookings.forEach(expireUnpaidBooking);
  const { customerId, studioId } = req.query;
  let filtered = db.bookings
    .filter(booking => {
      // Hide this session's own unpaid wizard draft from the availability feed
      // so going Back never renders the previously chosen slot as taken.
      const ownDraftId = typeof req.query?.excludeDraftId === "string" ? req.query.excludeDraftId : undefined;
      if (ownDraftId && booking.id === ownDraftId) return false;
      return true;
    })
    .map(booking => {
      const pendingPaymentAmount = db.payments
        .filter(payment => payment.bookingId === booking.id && payment.paymentStatus === "Pending Verification")
        .reduce((sum, payment) => sum + Number(payment.amount), 0);
      // Attach refund details from the refunded payment record so customers can see them
      const refundedPayment = db.payments.find(
        p => p.bookingId === booking.id && p.paymentStatus === "Refunded"
      ) as any;
      return {
        ...booking,
        pendingPaymentAmount,
        refundAmount: refundedPayment?.refundAmount ?? null,
        refundReason: refundedPayment?.refundReason ?? null,
        refundedAt: refundedPayment?.refundedAt ?? null,
      };
    });
  if (user.role === UserRole.CUSTOMER) filtered = filtered.filter(b => b.customerId === user.id);
  else if (user.role === UserRole.STUDIO_ADMIN || user.role === UserRole.STUDIO_STAFF) filtered = filtered.filter(b => b.studioId === user.studioId);
  if (customerId && user.role === UserRole.SUPER_ADMIN) filtered = filtered.filter(b => b.customerId === customerId);
  if (studioId && user.role === UserRole.SUPER_ADMIN) filtered = filtered.filter(b => b.studioId === studioId);
  res.json({ success: true, bookings: filtered });
});

app.get("/api/bookings/:id", (req, res) => {
  const booking = db.bookings.find(b => b.id === req.params.id);
  if (!booking) {
    return res.status(404).json({ success: false, message: "Booking not found." });
  }
  if (!requireBookingAccess(req, res, booking)) return;
  res.json({ success: true, booking });
});

app.post("/api/bookings", (req, res) => {
  const user = requireAuthenticatedUser(req, res);
  if (!user) return;
  const { studioId, customerId, serviceId, packageId, bookingDate, timeSlot, addons, customerDetails, totalAmount, paymentOption } = req.body;

  if (user.role !== UserRole.CUSTOMER || customerId !== user.id) {
    return res.status(403).json({ success: false, message: "Only the authenticated customer can create this booking." });
  }

  const studio = db.studios.find(item => item.id === studioId && (item.status === "approved" || item.isApproved));
  if (!studio) {
    return res.status(400).json({ success: false, message: "Bookings are available only for approved studios." });
  }
  if (!serviceId) {
    return res.status(400).json({ success: false, message: "Please select a service before booking." });
  }
  const selectedPackage = packageId
    ? db.packages.find(item => item.id === packageId && item.studioId === studioId)
    : undefined;
  if (packageId && !selectedPackage) {
    return res.status(400).json({ success: false, message: "The selected package is not valid for this studio." });
  }
  const selectedService = serviceId ? db.services.find(item => item.id === serviceId && item.studioId === studioId && item.isActive) : undefined;
  if (serviceId && !selectedService) {
    return res.status(400).json({ success: false, message: "The selected service is not valid for this studio." });
  }
  const requestedDate = new Date(`${bookingDate}T00:00:00`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(bookingDate)) || Number.isNaN(requestedDate.getTime()) || requestedDate < new Date(new Date().toDateString())) {
    return res.status(400).json({ success: false, message: "Booking date must be today or a future date." });
  }

  // Check studio blockedDates (closed holidays set by studio owner)
  if (Array.isArray(studio.blockedDates) && studio.blockedDates.includes(bookingDate)) {
    return res.status(400).json({ success: false, message: `The studio is closed on ${bookingDate} (Scheduled holiday / blocked date).` });
  }

  const dayName = requestedDate.toLocaleDateString("en-US", { weekday: "long" });
  const dayOfWeek = requestedDate.getDay();
  const studioAvailability = db.availabilities.find(a => a.studioId === studioId && a.dayOfWeek === dayOfWeek);
  if (studioAvailability && !studioAvailability.isAvailable) {
    return res.status(400).json({ success: false, message: `The studio is closed on ${dayName}. Please choose another day.` });
  }
  if (studioAvailability) {
    const start = parseHHMM(studioAvailability.openingTime);
    const end = parseHHMM(studioAvailability.closingTime);
    const slotStart = parseTimeToMinutes(timeSlot);
    if (slotStart < start || slotStart >= end) {
      return res.status(400).json({ success: false, message: "The selected time is outside the studio owner's working hours." });
    }
  } else if (studio.businessHours) {
    // Fallback: validate against the studio's displayed business hours if no per-day rule exists
    const defaultHours = parseBusinessHours(studio.businessHours);
    const start = parseHHMM(defaultHours.openingTime);
    const end = parseHHMM(defaultHours.closingTime);
    const slotStart = parseTimeToMinutes(timeSlot);
    if (start < end && (slotStart < start || slotStart >= end)) {
      return res.status(400).json({ success: false, message: "The selected time is outside the studio's working hours." });
    }
  }

  const blackout = db.blackouts.find(b => b.studioId === studioId && b.blackoutDate === bookingDate);
  if (blackout) {
    const blackStart = parseHHMM(blackout.startTime);
    const blackEnd = parseHHMM(blackout.endTime);
    const slotStart = parseTimeToMinutes(timeSlot);
    if (slotStart >= blackStart && slotStart < blackEnd) {
      return res.status(400).json({ success: false, message: `The studio is blocked on ${bookingDate} for: ${blackout.reason || "schedule closure"}.` });
    }
  }

  // If studio availability is configured, it is authoritative for studio open days & working hours.
  // Otherwise check service availableDays/availableSlots as legacy fallback.
  const hasStudioAvail = db.availabilities.some(a => a.studioId === studioId);
  if (!hasStudioAvail && selectedService) {
    if (selectedService.availableDays?.length && !selectedService.availableDays.includes(dayName)) {
      return res.status(400).json({ success: false, message: "The selected date is not available for this service." });
    }
    if (selectedService.availableSlots?.length && !selectedService.availableSlots.includes(timeSlot)) {
      return res.status(400).json({ success: false, message: "The selected time is not available for this service." });
    }
  }
  const selectedAddons = (Array.isArray(addons) ? addons : []).reduce((validAddons: { addonId: string; quantity: number; price: number }[], addon: any) => {
    const catalogAddon = db.addons.find(item => item.id === addon.addonId && item.studioId === studioId);
    if (!catalogAddon) return validAddons;
    const quantity = Math.max(1, Number(addon.quantity) || 1);
    validAddons.push({ addonId: catalogAddon.id, quantity, price: Number(catalogAddon.price) });
    return validAddons;
  }, []);
  const calculatedTotal = (selectedPackage ? Number(selectedPackage.price) : Number(selectedService?.basePrice || 0)) + selectedAddons.reduce((sum, addon) => {
    return sum + addon.price * addon.quantity;
  }, 0);
  const normalizedPaymentOption = paymentOption === "Full Payment" ? "Full Payment" : "Downpayment";

  // Determine duration of shoot in minutes
  let shootDuration = 60; // Default 1 hour
  if (packageId) {
    const pkg = db.packages.find(p => p.id === packageId);
    if (pkg?.durationMinutes) shootDuration = pkg.durationMinutes;
  } else if (serviceId) {
    const srv = db.services.find(s => s.id === serviceId);
    if (srv?.durationMinutes) shootDuration = srv.durationMinutes;
  }

  const newStartMinutes = parseTimeToMinutes(timeSlot);
  const newEndMinutes = newStartMinutes + shootDuration;

  // Advanced Time-Range Overlap Conflict Check:
  // (StartA < EndB) AND (EndA > StartB)
  const overlappingBooking = db.bookings.find(b => {
    const amendSkip = typeof req.body?.amendBookingId === "string" && b.id === req.body.amendBookingId;
    if (amendSkip) return false;
    if (b.studioId !== studioId || b.bookingDate !== bookingDate) return false;
    if (["Cancelled", "Rejected", "Expired"].includes(b.status)) return false;

    // Find duration of existing booking
    let existingDuration = 60;
    if (b.packageId) {
      const p = db.packages.find(pkg => pkg.id === b.packageId);
      if (p?.durationMinutes) existingDuration = p.durationMinutes;
    } else if (b.serviceId) {
      const s = db.services.find(srv => srv.id === b.serviceId);
      if (s?.durationMinutes) existingDuration = s.durationMinutes;
    }

    const existingStart = parseTimeToMinutes(b.timeSlot);
    const existingEnd = existingStart + existingDuration;

    // Interval collision condition
    return newStartMinutes < existingEnd && newEndMinutes > existingStart;
  });

  if (overlappingBooking) {
    return res.status(400).json({ 
      success: false, 
      message: `Time slot conflict! Studio already has booking #${overlappingBooking.id} scheduled at ${overlappingBooking.timeSlot} on ${bookingDate}. Please choose another time.` 
    });
  }

  if (req.body.agreedToTerms !== true) {
    return res.status(400).json({
      success: false,
      message: "You must explicitly agree to the Terms and Conditions (including direct GCash payment to studio owner and strict no-refund policy) before continuing."
    });
  }

  // Idempotent draft: if the wizard already created an unpaid draft for this
  // session (customer pressed Back then forward), update it in place instead
  // of inserting a second booking record.
  const amendBookingId = typeof req.body?.amendBookingId === "string" ? req.body.amendBookingId : undefined;
  let draftIndex = -1;
  if (amendBookingId) {
    draftIndex = db.bookings.findIndex(b => b.id === amendBookingId);
    if (draftIndex === -1) {
      return res.status(404).json({ success: false, message: "Draft booking not found. Please restart the booking." });
    }
    const draft = db.bookings[draftIndex];
    if (draft.customerId !== user.id) {
      return res.status(403).json({ success: false, message: "You can only amend your own booking." });
    }
    if (!["Pending", "Awaiting Payment"].includes(draft.status)) {
      return res.status(409).json({ success: false, message: `Bookings in ${draft.status} status can no longer be amended.` });
    }
    const draftPayments = db.payments.filter(p => p.bookingId === draft.id);
    if (draftPayments.some(p => ["Pending Verification", "Paid", "Partially Paid"].includes(p.paymentStatus)) || (draft.amountPaid || 0) > 0) {
      return res.status(409).json({ success: false, message: "This booking already has a submitted payment and can no longer be amended." });
    }
  }

  const bookingId = draftIndex !== -1 ? db.bookings[draftIndex].id : generateId("BK-2026");
  const preservedCreatedAt = draftIndex !== -1 ? db.bookings[draftIndex].createdAt : new Date().toISOString();
  const newBooking: Booking = {
    id: bookingId,
    studioId,
    customerId,
    serviceId,
    packageId,
    bookingDate,
    timeSlot,
    addons: selectedAddons,
    customerDetails,
    status: "Awaiting Payment",
    totalAmount: calculatedTotal,
    amountPaid: 0,
    downPaymentAmount: normalizedPaymentOption === "Full Payment" ? calculatedTotal : Math.round(calculatedTotal * 0.3 * 100) / 100,
    remainingBalance: calculatedTotal,
    paymentStatus: "Unpaid",
    finalPaymentStatus: "Pending",
    paymentOption: normalizedPaymentOption,
    paymentDueAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    agreedToTerms: true,
    agreedToTermsAt: new Date().toISOString(),
    createdAt: preservedCreatedAt
  };

  if (draftIndex !== -1) {
    db.bookings[draftIndex] = newBooking;
    db.save();
  } else {
    db.addBooking(newBooking);
  }

  // Notifications
  if (draftIndex === -1) {
    notifyUser(customerId, "Booking Created", `Your booking at ${db.studios.find(s=>s.id===studioId)?.name} is successfully created. Complete direct GCash payment to secure your slot!`, "info");
  }

  // Find studio admin to notify
  const studioAdmin = db.users.find(u => u.studioId === studioId && u.role === UserRole.STUDIO_ADMIN);
  if (studioAdmin && draftIndex === -1) {
    notifyUser(studioAdmin.id, "New Booking Received", `A new booking (${bookingId}) has been made for ${bookingDate} at ${timeSlot}. Awaiting direct GCash payment.`, "warning", studioId);
  }

  res.json({ success: true, booking: newBooking, amended: draftIndex !== -1 });
});

// Void an unpaid draft (releases its held slot). Used when the customer
// abandons the wizard before submitting any payment proof. Refuses once a
// payment exists so verified / under-review bookings are never released here.
app.put("/api/bookings/:id/void-draft", (req, res) => {
  const index = db.bookings.findIndex(b => b.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({ success: false, message: "Booking not found." });
  }
  const target = db.bookings[index];
  const actor = requireBookingAccess(req, res, target, false);
  if (!actor) return;
  if (actor.role !== UserRole.CUSTOMER || target.customerId !== actor.id) {
    return res.status(403).json({ success: false, message: "Only the owning customer can void this booking." });
  }
  if (!["Pending", "Awaiting Payment"].includes(target.status)) {
    return res.status(409).json({ success: false, message: `Bookings in ${target.status} status can no longer be voided.` });
  }
  const linkedPayments = db.payments.filter(pmt => pmt.bookingId === target.id);
  if (linkedPayments.some(pmt => ["Pending Verification", "Paid", "Partially Paid"].includes(pmt.paymentStatus)) || (target.amountPaid || 0) > 0) {
    return res.status(409).json({ success: false, message: "This booking has a payment and can no longer be voided." });
  }
  db.bookings[index] = { ...target, status: "Expired" };
  db.save();
  logAction(actor.id, actor.email, `Voided unpaid draft ${target.id} (slot released)`, "BOOKING", target.id);
  res.json({ success: true, booking: db.bookings[index] });
});

// ── Resume payment for an expired unpaid booking ────────────────────────────
// When a customer's device cuts out mid-payment-wizard the booking gets auto-
// expired. This endpoint reactivates it so they can complete payment without
// losing their slot choice.  Only allowed when no payment was ever made.
app.put("/api/bookings/:id/resume-payment", (req, res) => {
  const user = requireAuthenticatedUser(req, res);
  if (!user) return;

  const idx = db.bookings.findIndex(b => b.id === req.params.id);
  if (idx === -1) return res.status(404).json({ success: false, message: "Booking not found." });
  const booking = db.bookings[idx];

  const isSuperAdmin = user.role === UserRole.SUPER_ADMIN;
  const isOwningCustomer = user.role === UserRole.CUSTOMER && booking.customerId === user.id;
  if (!isSuperAdmin && !isOwningCustomer) {
    return res.status(403).json({ success: false, message: "Access denied." });
  }

  if (booking.status !== "Expired") {
    return res.status(409).json({ success: false, message: "Only expired bookings can be resumed." });
  }

  // Refuse if any payment was ever made — this is for zero-payment expiry only
  if ((booking.amountPaid || 0) > 0) {
    return res.status(409).json({ success: false, message: "This booking already has a recorded payment and cannot be resumed this way. Please contact the studio." });
  }
  const hasPayment = db.payments.some(p => p.bookingId === booking.id && ["Pending Verification", "Paid", "Partially Paid"].includes(p.paymentStatus));
  if (hasPayment) {
    return res.status(409).json({ success: false, message: "A payment submission exists for this booking. Please contact the studio." });
  }

  // Check the desired slot is still available
  const slotConflict = db.bookings.some(b => {
    if (b.id === booking.id) return false;
    if (b.studioId !== booking.studioId || b.bookingDate !== booking.bookingDate) return false;
    if (["Cancelled", "Rejected", "Expired"].includes(b.status)) return false;
    return b.timeSlot === booking.timeSlot;
  });
  if (slotConflict) {
    return res.status(409).json({ success: false, message: "The original time slot has been taken by another booking. Please rebook with a new time." });
  }

  // Reactivate with a fresh 24-hour payment window
  db.bookings[idx] = {
    ...booking,
    status: "Awaiting Payment",
    paymentStatus: "Unpaid",
    paymentDueAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
  };
  db.save();
  const userEmail = (user as any).email || user.id;
  logAction(user.id, userEmail, `Resumed expired booking ${booking.id} for payment`, "BOOKING", booking.id);
  notifyUser(booking.customerId, "Booking Reactivated", `Your booking ${booking.id} has been reactivated. Please complete payment within 24 hours to secure your slot.`, "info", booking.studioId);
  res.json({ success: true, booking: db.bookings[idx] });
});

app.put("/api/bookings/:id/cancel", (req, res) => {
  const index = db.bookings.findIndex(b => b.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({ success: false, message: "Booking not found." });
  }

  const booking = db.bookings[index];
  const user = requireBookingAccess(req, res, booking, true);
  if (!user) return;
  if (user.role === UserRole.CUSTOMER) {
    return res.status(400).json({ 
      success: false, 
      message: "Cancellations and refunds are no longer permitted under the studio booking policy. Please request a booking reschedule instead." 
    });
  }

  const cancellableStatuses = ["Pending", "Awaiting Payment", "Confirmed", "Rescheduled"];
  if (!cancellableStatuses.includes(booking.status)) {
    return res.status(400).json({ success: false, message: `Bookings in ${booking.status} status can no longer be cancelled.` });
  }

  const reason = String(req.body.reason || "Customer requested cancellation").trim();
  db.bookings[index] = {
    ...booking,
    status: "Cancelled",
    cancellationReason: reason || "Customer requested cancellation",
    cancelledBy: user.id,
    cancelledAt: new Date().toISOString()
  };
  db.save();

  const studio = db.studios.find(item => item.id === booking.studioId);
  const studioOwner = studio ? db.users.find(item => item.id === studio.ownerId) : undefined;
  const message = `Booking ${booking.id} for ${booking.bookingDate} at ${booking.timeSlot} was cancelled by the customer. Reason: ${reason || "Customer requested cancellation"}`;
  if (studioOwner) notifyUser(studioOwner.id, "Booking Cancelled by Customer", message, "warning", booking.studioId);
  notifyUser(user.id, "Booking Cancellation Confirmed", `Your booking ${booking.id} has been cancelled successfully.`, "success", booking.studioId);
  logAction(user.id, user.email, "Cancelled booking", "BOOKING", booking.id);

  res.json({ success: true, booking: db.bookings[index] });
});

app.put("/api/bookings/:id/assign-staff", (req, res) => {
  const index = db.bookings.findIndex(b => b.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({ success: false, message: "Booking not found." });
  }

  const booking = db.bookings[index];
  const user = requireStudioAccess(req, res, booking.studioId);
  if (!user) return;

  const { staffId, staffName } = req.body;
  if (!staffId || !staffName) {
    return res.status(400).json({ success: false, message: "Staff ID and staff name are required." });
  }

  (db.bookings[index] as any).assignedStaffId = staffId;
  (db.bookings[index] as any).assignedStaffName = staffName;
  db.save();

  logAction(user.id, user.email, `Assigned staff ${staffName} to booking ${booking.id}`, "BOOKING", booking.id);
  notifyUser(staffId, "Booking Assigned", `You have been assigned to shoot booking ${booking.id} on ${booking.bookingDate} at ${booking.timeSlot}.`, "info", booking.studioId);

  res.json({ success: true, booking: db.bookings[index] });
});

app.put("/api/bookings/:id/checklist", (req, res) => {
  const index = db.bookings.findIndex(b => b.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({ success: false, message: "Booking not found." });
  }

  const booking = db.bookings[index];
  const user = requireStudioAccess(req, res, booking.studioId);
  if (!user) return;

  const { checklist } = req.body;
  if (!Array.isArray(checklist)) {
    return res.status(400).json({ success: false, message: "Checklist must be an array." });
  }

  (db.bookings[index] as any).preShootChecklist = checklist;
  db.save();

  res.json({ success: true, booking: db.bookings[index] });
});

app.put("/api/bookings/:id/status", (req, res) => {
  const { status, amountPaid, paymentStatus } = req.body;
  const index = db.bookings.findIndex(b => b.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({ success: false, message: "Booking not found." });
  }

  const original = db.bookings[index];
  const user = requireBookingAccess(req, res, original);
  if (!user || user.role === UserRole.CUSTOMER) {
    if (user?.role === UserRole.CUSTOMER) res.status(403).json({ success: false, message: "Customers cannot change booking status." });
    return;
  }
  const allowedTransitions: Record<string, string[]> = {
    Pending: ["Awaiting Payment", "Cancelled", "Expired"],
    "Awaiting Payment": ["Pending", "Confirmed", "Cancelled", "Expired"],
    Confirmed: ["Ongoing", "Completed", "Rescheduled", "Cancelled"],
    Rescheduled: ["Confirmed", "Ongoing", "Completed", "Cancelled", "No Show"],
    Ongoing: ["Completed", "No Show"],
    Completed: []
  };
  if (status && status !== original.status && !allowedTransitions[original.status]?.includes(status)) {
    return res.status(400).json({ success: false, message: `Invalid booking status transition from ${original.status} to ${status}.` });
  }
  db.bookings[index] = {
    ...original,
    status: status || original.status,
    amountPaid: amountPaid !== undefined ? Number(amountPaid) : original.amountPaid,
    paymentStatus: paymentStatus || original.paymentStatus
  };

  // Auto-create photo proofing gallery when the booking is fulfilled/completed.
  if ((status || original.status) === "Completed") {
    const existingProofing = db.photoProofings.find(p => p.bookingId === original.id);
    if (!existingProofing) {
      const newGallery: PhotoProofingGallery = {
        id: generateId("PRF"),
        bookingId: original.id,
        studioId: original.studioId,
        customerId: original.customerId,
        photos: [],
        watermarkText: `${db.studios.find(s => s.id === original.studioId)?.name?.toUpperCase() || "CAINTA STUDIO"} - PROOF ONLY`,
        watermarkPosition: "repeat_diagonal",
        watermarkOpacity: 0.35,
        status: "sent_to_client",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      db.addPhotoProofing(newGallery);
      notifyUser(
        original.customerId,
        "Photo Proofing Gallery Ready",
        `Your photo proofing gallery for Booking #${original.id} is now ready for review.`,
        "success",
        original.studioId
      );
    }
  }

  db.save();

  // Notify customer
  notifyUser(original.customerId, `Booking Status Updated`, `Your booking ${original.id} status is now: ${status || original.status}`, "success");

  res.json({ success: true, booking: db.bookings[index] });
});

app.put("/api/bookings/:id/requirements", async (req, res) => {
  const { fileName, fileData } = req.body;
  const index = db.bookings.findIndex(b => b.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({ success: false, message: "Booking not found." });
  }
  const user = requireBookingAccess(req, res, db.bookings[index], false);
  if (!user) return;
  if (user.role !== UserRole.CUSTOMER) {
    return res.status(403).json({ success: false, message: "Only the booking customer can submit requirements." });
  }
  if (!fileData || typeof fileData !== "string") {
    return res.status(400).json({ success: false, message: "A requirement file is required." });
  }
  const media = await saveProtectedMedia(user.id, "booking", req.params.id, "BOOKING_REQUIREMENT", fileData, fileName || "booking-requirement");
  if (!media) {
    return res.status(400).json({ success: false, message: "Requirement must be a supported image or PDF smaller than 8 MB." });
  }
  db.bookings[index].requirementsDoc = `/api/media/${media.mediaId}`;
  db.save();
  res.json({ success: true, booking: db.bookings[index] });
});

// Payments
function syncBookingPaymentTotals(booking: Booking) {
  const bookingPayments = db.payments.filter(payment => payment.bookingId === booking.id);
  const verifiedPayments = bookingPayments.filter(payment => payment.paymentStatus === "Paid");
  const paidAmount = Math.min(booking.totalAmount, verifiedPayments.reduce((sum, payment) => sum + Number(payment.amount), 0));
  const hasPendingPayment = bookingPayments.some(payment => payment.paymentStatus === "Pending Verification");

  booking.amountPaid = paidAmount;
  booking.remainingBalance = Math.max(0, booking.totalAmount - paidAmount);
  booking.finalPaymentStatus = booking.remainingBalance === 0 ? "Paid" : "Pending";
  booking.paymentStatus = hasPendingPayment
    ? "Pending Verification"
    : booking.finalPaymentStatus === "Paid"
      ? "Paid"
      : paidAmount > 0
        ? "Partially Paid"
        : "Unpaid";

  if (booking.finalPaymentStatus === "Paid" || paidAmount >= booking.downPaymentAmount) {
    booking.status = "Confirmed";
  }
}

app.get("/api/payments", (req, res) => {
  const user = requireAuthenticatedUser(req, res);
  if (!user) return;
  const { studioId, customerId } = req.query;
  let filtered = db.payments.map(p => ({
    ...p,
    status: (p as any).status || p.paymentStatus
  }));
  if (user.role === UserRole.CUSTOMER) {
    filtered = filtered.filter(p => p.customerId === user.id);
  } else if (user.role === UserRole.STUDIO_ADMIN || user.role === UserRole.STUDIO_STAFF) {
    filtered = filtered.filter(p => p.studioId === user.studioId);
  }
  if (studioId && user.role === UserRole.SUPER_ADMIN) filtered = filtered.filter(p => p.studioId === studioId);
  if (customerId && user.role === UserRole.SUPER_ADMIN) filtered = filtered.filter(p => p.customerId === customerId);
  res.json({ success: true, payments: filtered });
});

app.post("/api/payments", async (req, res) => {
  try {
  const user = requireAuthenticatedUser(req, res);
  if (!user) return;
  const { bookingId, amount, paymentMethod, referenceNumber, proofOfPayment, paymentType } = req.body;
  const booking = db.bookings.find(item => item.id === bookingId);
  const paymentAmount = Number(amount);
  const requestedPaymentType = (paymentType === "Full Payment" ? "Full Payment" : paymentType === "Balance" ? "Balance" : "Downpayment");

  if (!booking || user.role !== UserRole.CUSTOMER || booking.customerId !== user.id) {
    return res.status(400).json({ success: false, message: "The payment does not match a valid booking." });
  }
  if (["Cancelled", "Rejected", "Expired"].includes(booking.status)) {
    return res.status(400).json({ success: false, message: "This booking cannot accept a payment." });
  }

  // Determine expected amount per payment type
  let expectedAmount: number;
  if (requestedPaymentType === "Full Payment") {
    // Fresh full payment — no prior downpayment
    expectedAmount = booking.totalAmount;
  } else if (requestedPaymentType === "Balance") {
    // Customer paying the remaining balance after a downpayment
    syncBookingPaymentTotals(booking);
    expectedAmount = booking.remainingBalance;
    if (booking.amountPaid < (booking.downPaymentAmount || 0)) {
      return res.status(400).json({ success: false, message: "Downpayment must be verified before submitting the remaining balance." });
    }
  } else {
    expectedAmount = booking.downPaymentAmount;
  }

  if (!Number.isFinite(paymentAmount) || Math.abs(paymentAmount - expectedAmount) > 0.01) {
    return res.status(400).json({ success: false, message: `The selected ${requestedPaymentType.toLowerCase()} must be exactly ₱${Number(expectedAmount).toLocaleString()}.` });
  }
  // Bank Transfer / Online Payment are no longer supported for studio bookings.
  // GCash and Maya are the only accepted online payment methods (Cash stays for
  // the on-site / studio counter settlement flow).
  if (!["Cash", "GCash", "Maya"].includes(paymentMethod)) {
    return res.status(400).json({ success: false, message: "GCash and Maya are the only accepted online payment methods for studio bookings." });
  }
  if (paymentMethod !== "Cash" && (!referenceNumber?.trim() || !proofOfPayment)) {
    return res.status(400).json({ success: false, message: "Reference number and proof of payment are required for this payment method." });
  }
  if (proofOfPayment && !parseMediaData(proofOfPayment)) {
    return res.status(400).json({ success: false, message: "Proof of payment must be a JPEG, PNG, WebP, or PDF file smaller than 8 MB." });
  }
  // Block duplicate submissions — but only for the same payment type
  if (db.payments.some(payment =>
    payment.bookingId === bookingId &&
    payment.paymentType === requestedPaymentType &&
    ["Pending Verification", "Paid"].includes(payment.paymentStatus)
  )) {
    return res.status(400).json({ success: false, message: `A ${requestedPaymentType.toLowerCase()} has already been submitted for this booking.` });
  }

  // Security Check: Duplicate Reference Number Validation
  if (referenceNumber && referenceNumber.trim()) {
    const cleanRef = referenceNumber.trim();
    const duplicatePayment = db.payments.find(p => p.referenceNumber && p.referenceNumber.trim().toUpperCase() === cleanRef.toUpperCase());
    if (duplicatePayment) {
      return res.status(400).json({ 
        success: false, 
        message: `Security Alert: Reference number '${cleanRef}' has already been submitted for Payment ${duplicatePayment.id}. Duplicate receipts are strictly rejected.` 
      });
    }
  }
  
  const paymentId = generateId("PAY");
  const paymentMedia = proofOfPayment ? await saveProtectedMedia(user.id, "payment", paymentId, "PAYMENT_PROOF", proofOfPayment, "payment-proof") : null;
  const newPayment: Payment = {
    id: paymentId,
    bookingId,
    studioId: booking.studioId,
    customerId: booking.customerId,
    amount: paymentAmount,
    paymentType: requestedPaymentType,
    paymentMethod,
    paymentStatus: "Pending Verification",
    referenceNumber,
    proofOfPayment: paymentMedia ? `/api/media/${paymentMedia.mediaId}` : undefined,
    paymentDate: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    reviewedBy: undefined,
    reviewedAt: undefined
  };
  (newPayment as any).status = "For Verification";

  db.addPayment(newPayment);
  logAction(user.id, user.email, `Submitted ${requestedPaymentType.toLowerCase()}`, "PAYMENT", paymentId);

  syncBookingPaymentTotals(booking);
  db.save();

  // Notify studio admin and customer through in-app notification and email.
  const studioAdmin = db.users.find(u => u.studioId === booking.studioId && u.role === UserRole.STUDIO_ADMIN);
  if (studioAdmin) {
    notifyUser(
      studioAdmin.id, 
      "Payment Submitted for Verification",
      `A ${paymentMethod} ${requestedPaymentType} for Booking ${bookingId} was submitted for studio verification. Your slot is not confirmed until the payment is verified.`,
      "info",
      booking.studioId
    );
  }
  notifyUser(
    booking.customerId,
    "Payment Submitted for Verification",
    `Your ${paymentMethod} ${requestedPaymentType} of ₱${paymentAmount.toLocaleString()} for Booking ${bookingId} is awaiting studio verification.`,
    "info",
    booking.studioId
  );

  res.json({ success: true, payment: newPayment });
  } catch (err: any) {
    console.error("[POST /api/payments] Unhandled error:", err?.message || err);
    if (!res.headersSent) {
      res.status(500).json({ success: false, message: err?.message || "An unexpected error occurred while submitting your payment." });
    }
  }
});

app.get("/api/media/:id", async (req, res) => {
  const media = db.mediaFiles.find(item => item.id === req.params.id && item.accessStatus === "active");
  if (!media) {
    return res.status(404).json({ success: false, message: "Media file not found." });
  }
  // STUDIO_QR_CODE is intentionally public: the studio's GCash / Maya QR code is
  // already returned without authentication by GET /api/studios, so the media
  // route must allow it too. Otherwise the booking wizard (customer view) and the
  // studio dashboard both render the uploaded QR as a dead image.
  const publicPurposes = ["STUDIO_LOGO", "STUDIO_COVER", "SERVICE_IMAGE", "PACKAGE_IMAGE", "ADDON_IMAGE", "PRINT_PRODUCT_IMAGE", "SYSTEM_DEMO_VIDEO", "STUDIO_QR_CODE"];
  const relatedStudioId = media.entityType === "studio"
    ? media.entityId
    : media.entityType === "studio-payment"
      ? media.entityId
      : media.entityType === "service"
      ? db.services.find(item => item.id === media.entityId)?.studioId
      : media.entityType === "package"
        ? db.packages.find(item => item.id === media.entityId)?.studioId
        : media.entityType === "print-product"
          ? db.printProducts.find(item => item.id === media.entityId)?.studioId
          : media.entityType === "addon"
            ? db.addons.find(item => item.id === media.entityId)?.studioId
        : undefined;
  const relatedStudio = relatedStudioId ? db.studios.find(item => item.id === relatedStudioId) : undefined;
  const isPublicMedia = (publicPurposes.includes(media.purpose) && !!relatedStudio && (relatedStudio.isApproved || relatedStudio.status === "approved")) ||
    (media.purpose === "HERO_BACKGROUND" && media.entityType === "cms" && media.entityId === "heroBackground") ||
    (media.purpose === "SYSTEM_DEMO_VIDEO" && media.entityType === "system" && media.entityId === "demo-video");

  let user = null as any;
  if (isPublicMedia) {
    user = getAuthenticatedUser(req);
  } else {
    user = requireAuthenticatedUser(req, res);
    if (!user) return;
    if (!canAccessMedia(user, media)) {
      return res.status(404).json({ success: false, message: "Media file not found." });
    }
  }

  // If storageKey is a Cloudinary URL (starts with https://), redirect directly.
  // This avoids proxying the file through the server and survives restarts.
  if (media.storageKey.startsWith("https://")) {
    res.setHeader("Cache-Control", isPublicMedia ? "public, max-age=31536000, immutable" : "private, no-store");
    return res.redirect(302, media.storageKey);
  }

  // Fallback: serve from local disk (dev environment / legacy files)
  try {
    const fileBuffer = await fs.readFile(path.join(MEDIA_ROOT, media.storageKey));
    res.type(media.mimeType);
    res.setHeader("Cache-Control", "private, no-store");
    return res.send(fileBuffer);
  } catch {
    return res.status(404).json({ success: false, message: "Media file is unavailable." });
  }
});

app.put("/api/payments/:id/verify", (req, res) => {
  const user = requireAuthenticatedUser(req, res);
  if (!user) return;
  const { approved, reason } = req.body;
  const index = db.payments.findIndex(p => p.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({ success: false, message: "Payment not found." });
  }

  const payment = db.payments[index];
  if (!canManageStudioPayment(user, payment.studioId)) {
    return res.status(403).json({ success: false, message: "You are not allowed to review this payment." });
  }
  if (payment.paymentStatus !== "Pending Verification") {
    return res.status(400).json({ success: false, message: "Only pending payments can be verified." });
  }
  const paymentBooking = db.bookings.find(item => item.id === payment.bookingId);
  if (!paymentBooking || ["Cancelled", "Expired"].includes(paymentBooking.status)) {
    return res.status(400).json({ success: false, message: "Payments cannot be verified for cancelled or expired bookings." });
  }
  if (typeof approved !== "boolean") {
    return res.status(400).json({ success: false, message: "An explicit approval decision is required." });
  }
  if (!approved && !String(reason || "").trim()) {
    return res.status(400).json({ success: false, message: "A rejection reason is required." });
  }
  db.payments[index].paymentStatus = approved ? "Paid" : "Failed";
  (db.payments[index] as any).status = approved ? "Verified" : "Rejected";
  (db.payments[index] as any).reviewedBy = user.id;
  (db.payments[index] as any).reviewedAt = new Date().toISOString();
  (db.payments[index] as any).rejectionReason = approved ? undefined : String(reason).trim();
  db.save();

  // Also update booking status
  const bIndex = db.bookings.findIndex(b => b.id === payment.bookingId);
  if (bIndex !== -1) {
    syncBookingPaymentTotals(db.bookings[bIndex]);
    if (!approved) db.bookings[bIndex].status = "Pending";
    db.save();
    
    // Notify customer
    const customer = db.customers.find(c => c.id === db.bookings[bIndex].customerId) || db.users.find(u => u.id === db.bookings[bIndex].customerId);
    if (approved && customer?.email) {
      const receiptDoc = buildBookingReceiptPDF(db.bookings[bIndex], db.studios.find(s => s.id === payment.studioId), payment);
      const pdfBuffer = Buffer.from(receiptDoc.output("arraybuffer"));
      sendReceiptCopyEmail(
        customer.email,
        "Official Receipt Copy",
        `Your official receipt for Booking ${payment.bookingId} is attached here. Please keep this copy for your records.`,
        `Receipt_${payment.bookingId}_CaintaMIS.pdf`,
        pdfBuffer
      ).catch(err => console.warn("[SMTP] Receipt copy email warning:", err));
    }
    notifyUser(
      db.bookings[bIndex].customerId,
      approved ? "Payment Verified & Slot Confirmed" : "Downpayment Rejected",
      approved
        ? `Your downpayment of ₱${payment.amount} has been verified for booking ${payment.bookingId}. Remaining balance: ₱${db.bookings[bIndex].remainingBalance}.`
        : `Your downpayment for booking ${payment.bookingId} was rejected. Reason: ${String(reason).trim()}`,
      approved ? "success" : "error",
      payment.studioId
    );
  }

  logAction(user.id, user.email, approved ? "Approved downpayment" : "Rejected downpayment", "PAYMENT", payment.id);

  res.json({ success: true, payment: db.payments[index] });
});

app.post("/api/bookings/:id/balance-payment", (req, res) => {
  const user = requireAuthenticatedUser(req, res);
  if (!user) return;
  const booking = db.bookings.find(item => item.id === req.params.id);
  const amount = Number(req.body.amount);
  if (!booking) return res.status(404).json({ success: false, message: "Booking not found." });
  if (!canManageStudioPayment(user, booking.studioId)) {
    return res.status(403).json({ success: false, message: "You are not allowed to record this payment." });
  }
  syncBookingPaymentTotals(booking);
  if (booking.amountPaid < booking.downPaymentAmount) {
    return res.status(400).json({ success: false, message: "Verify the down payment before recording the remaining balance." });
  }
  if (!Number.isFinite(amount) || amount <= 0 || Math.abs(amount - booking.remainingBalance) > 0.01) {
    return res.status(400).json({ success: false, message: `Balance payment must be exactly ₱${booking.remainingBalance.toLocaleString()}.` });
  }

  const payment: Payment = {
    id: generateId("PAY"), bookingId: booking.id, studioId: booking.studioId, customerId: booking.customerId,
    amount, paymentType: "Balance", paymentMethod: req.body.paymentMethod || "Cash", paymentStatus: "Paid",
    referenceNumber: req.body.referenceNumber, paymentDate: new Date().toISOString(), createdAt: new Date().toISOString()
  };
  db.addPayment(payment);
  syncBookingPaymentTotals(booking);
  db.save();
  const customer = db.customers.find(c => c.id === booking.customerId) || db.users.find(u => u.id === booking.customerId);
  if (customer?.email) {
    const receiptDoc = buildBookingReceiptPDF(booking, db.studios.find(s => s.id === booking.studioId), payment);
    const pdfBuffer = Buffer.from(receiptDoc.output("arraybuffer"));
    sendReceiptCopyEmail(
      customer.email,
      "Final Payment Receipt Copy",
      `Your final payment receipt for Booking ${booking.id} is attached here. Thank you for choosing Cainta Photography Studio.`,
      `Receipt_${booking.id}_CaintaMIS.pdf`,
      pdfBuffer
    ).catch(err => console.warn("[SMTP] Final receipt copy email warning:", err));
  }
  notifyUser(booking.customerId, "Final Payment Recorded", `Your final payment of ₱${amount} has been recorded at the studio. Your booking is fully paid.`, "success", booking.studioId);
  res.json({ success: true, payment, booking });
});

// ──────────────────────────────────────────────────────────────────
// REFUND ENDPOINT — Studio admin / super-admin only
// PUT /api/payments/:id/refund
// ──────────────────────────────────────────────────────────────────
app.put("/api/payments/:id/refund", async (req, res) => {
  try {
  const user = requireAuthenticatedUser(req, res);
  if (!user) return;

  const index = db.payments.findIndex(p => p.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({ success: false, message: "Payment not found." });
  }

  const payment = db.payments[index];

  // Only studio admin (for their own studio) or super admin can process refunds
  if (!canManageStudioPayment(user, payment.studioId)) {
    return res.status(403).json({ success: false, message: "You are not allowed to process refunds for this payment." });
  }

  // Only paid payments can be refunded
  if (payment.paymentStatus !== "Paid") {
    return res.status(400).json({
      success: false,
      message: `Only verified/paid payments can be refunded. Current status: ${payment.paymentStatus}`
    });
  }

  const reason = String(req.body.reason || "Refund requested by studio").trim();
  const refundAmount = Number(req.body.refundAmount) || payment.amount;

  if (!Number.isFinite(refundAmount) || refundAmount <= 0 || refundAmount > payment.amount) {
    return res.status(400).json({ success: false, message: `Refund amount must be between ₱1 and ₱${payment.amount.toLocaleString()}.` });
  }

  // Mark payment as refunded
  db.payments[index] = {
    ...payment,
    paymentStatus: "Refunded",
    reviewedBy: user.id,
    reviewedAt: new Date().toISOString(),
    rejectionReason: reason
  };
  (db.payments[index] as any).refundedAt = new Date().toISOString();
  (db.payments[index] as any).refundAmount = refundAmount;
  (db.payments[index] as any).refundReason = reason;
  (db.payments[index] as any).refundedBy = user.id;

  // Update booking payment status
  const bookingIndex = db.bookings.findIndex(b => b.id === payment.bookingId);
  if (bookingIndex !== -1) {
    const booking = db.bookings[bookingIndex];
    // Capture totalPaid BEFORE sync so isFullRefund is correct
    const totalPaidBeforeRefund = booking.amountPaid;
    const isFullRefund = refundAmount >= totalPaidBeforeRefund;
    syncBookingPaymentTotals(booking);
    // Override paymentStatus to Refunded after sync (sync does not set this field)
    booking.paymentStatus = "Refunded";
    if (isFullRefund) {
      booking.status = "Cancelled";
      booking.cancellationReason = `Refund issued: ${reason}`;
      booking.cancelledAt = new Date().toISOString();
      booking.cancelledBy = user.id;
    }
    db.save();

    // Notify customer
    const studio = db.studios.find(s => s.id === payment.studioId);
    const studioName = studio?.name || "the studio";
    const customer = db.customers.find(c => c.id === booking.customerId) || db.users.find(u => u.id === booking.customerId);

    notifyUser(
      booking.customerId,
      "Refund Processed",
      `₱${refundAmount.toLocaleString("en-PH", { minimumFractionDigits: 2 })} refund for Booking ${booking.id} has been processed by ${studioName}. Reason: ${reason}`,
      "warning",
      payment.studioId
    );

    // Email notification to customer
    if (customer?.email) {
      sendEmailNotification(
        customer.email,
        `Refund Processed — ₱${refundAmount.toLocaleString("en-PH", { minimumFractionDigits: 2 })}`,
        `Your refund of ₱${refundAmount.toLocaleString("en-PH", { minimumFractionDigits: 2 })} for Booking ${booking.id} at ${studioName} has been processed.\n\nReason: ${reason}\n\nPayment ID: ${payment.id}\nRefund Date: ${new Date().toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric" })}\n\nPlease allow 3–7 business days for the refund to reflect in your account.`,
        "warning"
      );
    }

    logAction(user.id, (user as any).email || user.id, `Processed ₱${refundAmount} refund for booking ${booking.id}`, "PAYMENT", payment.id);
  }

  db.save();
  res.json({ success: true, payment: db.payments[index], message: `₱${refundAmount.toLocaleString()} refund processed successfully.` });
  } catch (err: any) {
    console.error("[Refund] Unexpected error:", err?.message || err);
    res.status(500).json({ success: false, message: err?.message || "An unexpected error occurred while processing the refund." });
  }
});

// ──────────────────────────────────────────────────────────────────
// BOOKING RESCHEDULE — Customer or Studio admin
// PUT /api/bookings/:id/reschedule
// ──────────────────────────────────────────────────────────────────
app.put("/api/bookings/:id/reschedule", async (req, res) => {
  try {
  const index = db.bookings.findIndex(b => b.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({ success: false, message: "Booking not found." });
  }

  const booking = db.bookings[index];
  const user = requireBookingAccess(req, res, booking, false);
  if (!user) return;

  // Only customers can request reschedule on their own bookings;
  // studio admin can also reschedule confirmed/rescheduled bookings.
  const reschedulableStatuses = ["Confirmed", "Rescheduled", "Awaiting Payment", "Pending"];
  if (!reschedulableStatuses.includes(booking.status)) {
    return res.status(400).json({
      success: false,
      message: `Bookings in '${booking.status}' status cannot be rescheduled.`
    });
  }

  if (user.role === UserRole.CUSTOMER && booking.customerId !== user.id) {
    return res.status(403).json({ success: false, message: "You can only reschedule your own bookings." });
  }

  const { newDate, newTimeSlot, reason } = req.body;

  if (!newDate || !/^\d{4}-\d{2}-\d{2}$/.test(String(newDate))) {
    return res.status(400).json({ success: false, message: "A valid new booking date (YYYY-MM-DD) is required." });
  }
  if (!newTimeSlot || typeof newTimeSlot !== "string") {
    return res.status(400).json({ success: false, message: "A new time slot is required." });
  }

  // Date must be today or future
  const requestedDate = new Date(`${newDate}T00:00:00`);
  if (Number.isNaN(requestedDate.getTime()) || requestedDate < new Date(new Date().toDateString())) {
    return res.status(400).json({ success: false, message: "Reschedule date must be today or a future date." });
  }

  const dayName = requestedDate.toLocaleDateString("en-US", { weekday: "long" });
  const dayOfWeek = requestedDate.getDay();

  // Studio availability check
  const studioAvailability = db.availabilities.find(a => a.studioId === booking.studioId && a.dayOfWeek === dayOfWeek);
  if (studioAvailability && !studioAvailability.isAvailable) {
    return res.status(400).json({ success: false, message: `The studio is closed on ${dayName}. Please choose another day.` });
  }
  if (studioAvailability) {
    const start = parseHHMM(studioAvailability.openingTime);
    const end = parseHHMM(studioAvailability.closingTime);
    const slotStart = parseTimeToMinutes(newTimeSlot);
    if (slotStart < start || slotStart >= end) {
      return res.status(400).json({ success: false, message: "The selected time is outside the studio's working hours." });
    }
  } else {
    const rescheduleStudio = db.studios.find(s => s.id === booking.studioId);
    if (rescheduleStudio?.businessHours) {
      const defaultHours = parseBusinessHours(rescheduleStudio.businessHours);
      const start = parseHHMM(defaultHours.openingTime);
      const end = parseHHMM(defaultHours.closingTime);
      const slotStart = parseTimeToMinutes(newTimeSlot);
      if (start < end && (slotStart < start || slotStart >= end)) {
        return res.status(400).json({ success: false, message: "The selected time is outside the studio's working hours." });
      }
    }
  }

  // Check studio owner blocked dates (closed holidays)
  const studioRecord = db.studios.find(s => s.id === booking.studioId);
  if (Array.isArray(studioRecord?.blockedDates) && studioRecord.blockedDates.includes(newDate)) {
    return res.status(400).json({ success: false, message: `The studio is closed on ${newDate} (Scheduled holiday / blocked date).` });
  }

  // Blackout check
  const blackout = db.blackouts.find(b => b.studioId === booking.studioId && b.blackoutDate === newDate);
  if (blackout) {
    const blackStart = parseHHMM(blackout.startTime);
    const blackEnd = parseHHMM(blackout.endTime);
    const slotStart = parseTimeToMinutes(newTimeSlot);
    if (slotStart >= blackStart && slotStart < blackEnd) {
      return res.status(400).json({ success: false, message: `The studio is blocked on ${newDate}: ${blackout.reason || "scheduled closure"}.` });
    }
  }

  // Determine shoot duration for overlap check
  let shootDuration = 60;
  if (booking.packageId) {
    const pkg = db.packages.find(p => p.id === booking.packageId);
    if (pkg?.durationMinutes) shootDuration = pkg.durationMinutes;
  } else if (booking.serviceId) {
    const srv = db.services.find(s => s.id === booking.serviceId);
    if (srv?.durationMinutes) shootDuration = srv.durationMinutes;
  }

  const newStartMinutes = parseTimeToMinutes(newTimeSlot);
  const newEndMinutes = newStartMinutes + shootDuration;

  // Time-range overlap check (exclude the current booking itself)
  const overlapping = db.bookings.find(b => {
    if (b.id === booking.id) return false;
    if (b.studioId !== booking.studioId || b.bookingDate !== newDate) return false;
    if (["Cancelled", "Rejected", "Expired"].includes(b.status)) return false;

    let existingDuration = 60;
    if (b.packageId) {
      const p = db.packages.find(pkg => pkg.id === b.packageId);
      if (p?.durationMinutes) existingDuration = p.durationMinutes;
    } else if (b.serviceId) {
      const s = db.services.find(srv => srv.id === b.serviceId);
      if (s?.durationMinutes) existingDuration = s.durationMinutes;
    }
    const existingStart = parseTimeToMinutes(b.timeSlot);
    const existingEnd = existingStart + existingDuration;
    return newStartMinutes < existingEnd && newEndMinutes > existingStart;
  });

  if (overlapping) {
    return res.status(400).json({
      success: false,
      message: `Time slot conflict! Booking #${overlapping.id} is already scheduled at ${overlapping.timeSlot} on ${newDate}. Please choose a different time.`
    });
  }

  // Same-slot reschedule is a no-op: return the unchanged record instead of
  // rewriting it (avoids a pointless audit entry and keeps optimistic UI honest).
  if (newDate === booking.bookingDate && newTimeSlot === booking.timeSlot) {
    return res.json({
      success: true,
      booking,
      unchanged: true,
      isPendingApproval: false,
      message: "The requested schedule is identical to the current schedule — nothing changed."
    });
  }

  const oldDate = booking.bookingDate;
  const oldSlot = booking.timeSlot;
  const rescheduleReason = String(reason || "Customer requested reschedule").trim();
  const studio = db.studios.find(s => s.id === booking.studioId);
  const studioName = studio?.name || "the studio";

  // Requirement: If a customer requests a reschedule on a Confirmed booking,
  // it creates a pending reschedule request that requires Studio Owner Approval.
  if (user.role === UserRole.CUSTOMER && booking.status === "Confirmed") {
    booking.rescheduleRequest = {
      requestedDate: newDate,
      requestedTimeSlot: newTimeSlot,
      reason: rescheduleReason,
      requestedAt: new Date().toISOString(),
      status: "pending"
    };
    db.save();

    // Notify studio admin
    const studioAdmin = db.users.find(u => u.studioId === booking.studioId && u.role === UserRole.STUDIO_ADMIN);
    if (studioAdmin) {
      notifyUser(
        studioAdmin.id,
        "New Reschedule Request",
        `Booking ${booking.id} customer requested to reschedule from ${oldDate} ${oldSlot} to ${newDate} ${newTimeSlot}. Reason: ${rescheduleReason}. Please approve in your dashboard.`,
        "warning",
        booking.studioId
      );
    }
    notifyUser(
      booking.customerId,
      "Reschedule Request Submitted",
      `Your reschedule request to move Booking ${booking.id} to ${newDate} at ${newTimeSlot} has been submitted to ${studioName} for approval.`,
      "info",
      booking.studioId
    );

    logAction(user.id, (user as any).email || user.id, `Requested reschedule for booking ${booking.id} to ${newDate} ${newTimeSlot}`, "BOOKING", booking.id);
    return res.json({
      success: true,
      booking: db.bookings[index],
      isRequest: true,
      isPendingApproval: true,
      message: "Reschedule request submitted to studio owner for approval."
    });
  }

  // Direct reschedule (by studio owner / staff, or unconfirmed booking)
  db.bookings[index] = {
    ...booking,
    bookingDate: newDate,
    timeSlot: newTimeSlot,
    status: "Rescheduled",
  };
  (db.bookings[index] as any).rescheduleReason = rescheduleReason;
  (db.bookings[index] as any).rescheduledAt = new Date().toISOString();
  (db.bookings[index] as any).rescheduledBy = user.id;
  (db.bookings[index] as any).previousDate = oldDate;
  (db.bookings[index] as any).previousTimeSlot = oldSlot;
  if (db.bookings[index].rescheduleRequest) {
    db.bookings[index].rescheduleRequest.status = "approved";
    db.bookings[index].rescheduleRequest.reviewedAt = new Date().toISOString();
  }

  db.save();

  // Notify both parties
  if (user.role === UserRole.CUSTOMER) {
    const studioAdmin = db.users.find(u => u.studioId === booking.studioId && u.role === UserRole.STUDIO_ADMIN);
    if (studioAdmin) {
      notifyUser(
        studioAdmin.id,
        "Booking Rescheduled by Customer",
        `Booking ${booking.id} has been rescheduled from ${oldDate} ${oldSlot} to ${newDate} ${newTimeSlot}. Reason: ${rescheduleReason}`,
        "warning",
        booking.studioId
      );
    }
    notifyUser(
      booking.customerId,
      "Reschedule Confirmed",
      `Your booking ${booking.id} has been rescheduled to ${newDate} at ${newTimeSlot} at ${studioName}.`,
      "success",
      booking.studioId
    );
  } else {
    notifyUser(
      booking.customerId,
      `Booking Rescheduled by ${studioName}`,
      `Your booking ${booking.id} has been rescheduled from ${oldDate} ${oldSlot} to ${newDate} at ${newTimeSlot}. Reason: ${rescheduleReason}. Please contact the studio if you have concerns.`,
      "warning",
      booking.studioId
    );
  }

  // Email notifications
  const customer = db.customers.find(c => c.id === booking.customerId) || db.users.find(u => u.id === booking.customerId);
  if (customer?.email) {
    sendEmailNotification(
      customer.email,
      `Booking Rescheduled — ${newDate} at ${newTimeSlot}`,
      `Your booking ${booking.id} at ${studioName} has been rescheduled.\n\nPrevious: ${oldDate} at ${oldSlot}\nNew Schedule: ${newDate} at ${newTimeSlot}\n\nReason: ${rescheduleReason}\n\nIf you did not request this change or have concerns, please contact ${studioName} directly.`,
      "info"
    );
  }

  logAction(user.id, (user as any).email || user.id, `Rescheduled booking ${booking.id} from ${oldDate} to ${newDate} ${newTimeSlot}`, "BOOKING", booking.id);

  res.json({
    success: true,
    booking: db.bookings[index],
    unchanged: false,
    isPendingApproval: false,
    previousDate: oldDate,
    previousTimeSlot: oldSlot,
    newDate: db.bookings[index].bookingDate,
    newTimeSlot: db.bookings[index].timeSlot,
    status: db.bookings[index].status,
    message: `Booking rescheduled to ${db.bookings[index].bookingDate} at ${db.bookings[index].timeSlot}.`
  });
  } catch (err: any) {
    console.error("[Reschedule] Unexpected error:", err?.message || err);
    res.status(500).json({ success: false, message: err?.message || "An unexpected error occurred while rescheduling." });
  }
});

// ── Approve a pending reschedule request (Studio Owner) ────────────────────
app.put("/api/bookings/:id/reschedule-approve", (req, res) => {
  const index = db.bookings.findIndex(b => b.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({ success: false, message: "Booking not found." });
  }

  const booking = db.bookings[index];
  const user = requireStudioAccess(req, res, booking.studioId);
  if (!user) return;

  if (!booking.rescheduleRequest || booking.rescheduleRequest.status !== "pending") {
    return res.status(400).json({ success: false, message: "No pending reschedule request for this booking." });
  }

  const reqDate = booking.rescheduleRequest.requestedDate;
  const reqSlot = booking.rescheduleRequest.requestedTimeSlot;
  const oldDate = booking.bookingDate;
  const oldSlot = booking.timeSlot;

  // Conflict check for requested slot
  const overlapping = db.bookings.find(b => {
    if (b.id === booking.id) return false;
    if (b.studioId !== booking.studioId || b.bookingDate !== reqDate) return false;
    if (["Cancelled", "Rejected", "Expired"].includes(b.status)) return false;
    return b.timeSlot === reqSlot;
  });

  if (overlapping) {
    return res.status(400).json({
      success: false,
      message: `Conflict: Booking #${overlapping.id} is already scheduled at ${reqSlot} on ${reqDate}.`
    });
  }

  booking.bookingDate = reqDate;
  booking.timeSlot = reqSlot;
  booking.status = "Rescheduled";
  (booking as any).previousDate = oldDate;
  (booking as any).previousTimeSlot = oldSlot;
  (booking as any).rescheduledAt = new Date().toISOString();
  (booking as any).rescheduledBy = user.id;
  booking.rescheduleRequest.status = "approved";
  booking.rescheduleRequest.reviewedAt = new Date().toISOString();
  booking.rescheduleRequest.reviewedBy = user.id;

  db.save();

  const studio = db.studios.find(s => s.id === booking.studioId);
  const studioName = studio?.name || "the studio";

  notifyUser(
    booking.customerId,
    "Reschedule Request Approved!",
    `Great news! Your reschedule request for Booking ${booking.id} has been approved by ${studioName}. Your new session schedule is ${reqDate} at ${reqSlot}.`,
    "success",
    booking.studioId
  );

  const customer = db.customers.find(c => c.id === booking.customerId) || db.users.find(u => u.id === booking.customerId);
  if (customer?.email) {
    sendEmailNotification(
      customer.email,
      `Reschedule Approved — ${reqDate} at ${reqSlot}`,
      `Your reschedule request for Booking ${booking.id} at ${studioName} has been approved.\n\nNew Schedule: ${reqDate} at ${reqSlot}\n\nWe look forward to capturing your milestone!`,
      "info"
    );
  }

  logAction(user.id, (user as any).email || user.id, `Approved reschedule for booking ${booking.id} to ${reqDate} ${reqSlot}`, "BOOKING", booking.id);
  res.json({ success: true, booking, message: `Reschedule request approved! Schedule updated to ${reqDate} at ${reqSlot}.` });
});

// ── Reject a pending reschedule request (Studio Owner) ────────────────────
app.put("/api/bookings/:id/reschedule-reject", (req, res) => {
  const index = db.bookings.findIndex(b => b.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({ success: false, message: "Booking not found." });
  }

  const booking = db.bookings[index];
  const user = requireStudioAccess(req, res, booking.studioId);
  if (!user) return;

  if (!booking.rescheduleRequest || booking.rescheduleRequest.status !== "pending") {
    return res.status(400).json({ success: false, message: "No pending reschedule request for this booking." });
  }

  const rejectReason = String(req.body.reason || "Studio owner is unavailable at the requested schedule").trim();
  booking.rescheduleRequest.status = "rejected";
  booking.rescheduleRequest.rejectionReason = rejectReason;
  booking.rescheduleRequest.reviewedAt = new Date().toISOString();
  booking.rescheduleRequest.reviewedBy = user.id;

  db.save();

  const studio = db.studios.find(s => s.id === booking.studioId);
  const studioName = studio?.name || "the studio";

  notifyUser(
    booking.customerId,
    "Reschedule Request Declined",
    `Your reschedule request for Booking ${booking.id} could not be accommodated by ${studioName}. Reason: ${rejectReason}. Your original schedule remains ${booking.bookingDate} at ${booking.timeSlot}.`,
    "warning",
    booking.studioId
  );

  logAction(user.id, (user as any).email || user.id, `Declined reschedule for booking ${booking.id}`, "BOOKING", booking.id);
  res.json({ success: true, booking, message: "Reschedule request declined." });
});

// ── Archive a booking (soft-delete) ─────────────────────────────────────────
// Allowed for: SUPER_ADMIN (any booking), STUDIO_ADMIN (own studio), CUSTOMER (own booking — only terminal statuses)
app.put("/api/bookings/:id/archive", (req, res) => {
  const user = requireAuthenticatedUser(req, res);
  if (!user) return;

  const idx = db.bookings.findIndex(b => b.id === req.params.id);
  if (idx === -1) return res.status(404).json({ success: false, message: "Booking not found." });
  const booking = db.bookings[idx];

  // Role-based access
  const isSuperAdmin = user.role === UserRole.SUPER_ADMIN;
  const isStudioOwner = (user.role === UserRole.STUDIO_ADMIN || user.role === UserRole.STUDIO_STAFF) && user.studioId === booking.studioId;
  const isOwningCustomer = user.role === UserRole.CUSTOMER && booking.customerId === user.id;
  if (!isSuperAdmin && !isStudioOwner && !isOwningCustomer) {
    return res.status(403).json({ success: false, message: "Access denied." });
  }

  // Customers can only archive terminal-status bookings
  const terminalStatuses = ["Completed", "Cancelled", "Rejected", "Expired", "No Show"];
  if (isOwningCustomer && !terminalStatuses.includes(booking.status)) {
    return res.status(409).json({ success: false, message: "Only completed, cancelled, or expired bookings can be archived." });
  }

  db.bookings[idx] = {
    ...booking,
    isArchived: true,
    archivedAt: new Date().toISOString(),
    archivedBy: user.id
  };
  db.save();
  logAction(user.id, (user as any).email || user.id, `Archived booking ${booking.id}`, "BOOKING", booking.id);
  res.json({ success: true, booking: db.bookings[idx] });
});

// ── Unarchive a booking ──────────────────────────────────────────────────────
app.put("/api/bookings/:id/unarchive", (req, res) => {
  const user = requireAuthenticatedUser(req, res);
  if (!user) return;

  const idx = db.bookings.findIndex(b => b.id === req.params.id);
  if (idx === -1) return res.status(404).json({ success: false, message: "Booking not found." });
  const booking = db.bookings[idx];

  const isSuperAdmin = user.role === UserRole.SUPER_ADMIN;
  const isStudioOwner = (user.role === UserRole.STUDIO_ADMIN || user.role === UserRole.STUDIO_STAFF) && user.studioId === booking.studioId;
  const isOwningCustomer = user.role === UserRole.CUSTOMER && booking.customerId === user.id;
  if (!isSuperAdmin && !isStudioOwner && !isOwningCustomer) {
    return res.status(403).json({ success: false, message: "Access denied." });
  }

  db.bookings[idx] = {
    ...booking,
    isArchived: false,
    archivedAt: undefined,
    archivedBy: undefined
  };
  db.save();
  logAction(user.id, (user as any).email || user.id, `Unarchived booking ${booking.id}`, "BOOKING", booking.id);
  res.json({ success: true, booking: db.bookings[idx] });
});

// ── Permanently delete an archived booking ───────────────────────────────────
// Allowed: SUPER_ADMIN (any), STUDIO_ADMIN/STUDIO_STAFF (own studio), CUSTOMER (own booking)
app.delete("/api/bookings/:id", (req, res) => {
  const user = requireAuthenticatedUser(req, res);
  if (!user) return;

  const idx = db.bookings.findIndex(b => b.id === req.params.id);
  if (idx === -1) return res.status(404).json({ success: false, message: "Booking not found." });
  const booking = db.bookings[idx];

  const isSuperAdmin = user.role === UserRole.SUPER_ADMIN;
  const isStudioOwner = (user.role === UserRole.STUDIO_ADMIN || user.role === UserRole.STUDIO_STAFF) && user.studioId === booking.studioId;
  const isOwningCustomer = user.role === UserRole.CUSTOMER && booking.customerId === user.id;
  if (!isSuperAdmin && !isStudioOwner && !isOwningCustomer) {
    return res.status(403).json({ success: false, message: "Access denied." });
  }

  if (!booking.isArchived) {
    return res.status(409).json({ success: false, message: "Archive this booking first before permanently deleting." });
  }

  const userEmail = (user as any).email || user.id;
  db.bookings.splice(idx, 1);
  db.save();
  logAction(user.id, userEmail, `Permanently deleted booking ${booking.id}`, "BOOKING", booking.id);
  res.json({ success: true, message: "Booking permanently deleted." });
});

// Photo Proofing Endpoints
app.get("/api/photo-proofing/booking/:bookingId", (req, res) => {
  const booking = db.bookings.find(item => item.id === req.params.bookingId);
  if (!booking) return res.status(404).json({ success: false, message: "Booking not found." });
  if (!requireBookingAccess(req, res, booking)) return;
  const gallery = db.photoProofings.find(p => p.bookingId === req.params.bookingId);
  res.json({ success: true, gallery: gallery || null });
});

app.post("/api/photo-proofing", (req, res) => {
  const { bookingId, studioId, customerId, photos, watermarkText, watermarkPosition, watermarkOpacity } = req.body;
  const booking = db.bookings.find(item => item.id === bookingId);
  if (!booking || booking.studioId !== studioId || booking.customerId !== customerId) {
    return res.status(400).json({ success: false, message: "Gallery details do not match a valid booking." });
  }
  const user = requireStudioAccess(req, res, studioId);
  if (!user) return;
  
  const proofingId = generateId("PRF");
  const newGallery: PhotoProofingGallery = {
    id: proofingId,
    bookingId,
    studioId,
    customerId,
    photos: photos || [],
    watermarkText: watermarkText || "PROOF - CAINTA STUDIO",
    watermarkPosition: watermarkPosition || "repeat_diagonal",
    watermarkOpacity: watermarkOpacity !== undefined ? watermarkOpacity : 0.35,
    status: "sent_to_client",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  db.addPhotoProofing(newGallery);

  // Notify customer that photo proofing is ready
  notifyUser(
    customerId,
    "Photo Proofing Gallery Ready",
    `Your watermarked photo proofs for Booking #${bookingId} are now ready for review! Star your favorites for editing.`,
    "success",
    studioId
  );

  res.json({ success: true, gallery: newGallery });
});

app.put("/api/photo-proofing/:id/photos", (req, res) => {
  const { photos, status, watermarkText, watermarkOpacity, watermarkPosition } = req.body;
  const index = db.photoProofings.findIndex(p => p.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({ success: false, message: "Photo proofing gallery not found." });
  }

  const existing = db.photoProofings[index];
  const booking = db.bookings.find(item => item.id === existing.bookingId);
  if (!booking || !requireBookingAccess(req, res, booking)) return;
  const user = getAuthenticatedUser(req);
  const studioOperator = user && user.role !== UserRole.CUSTOMER;
  if (studioOperator && user?.role !== UserRole.SUPER_ADMIN && user?.studioId !== existing.studioId) {
    return res.status(403).json({ success: false, message: "You do not have access to this gallery." });
  }
  if (user?.role === UserRole.CUSTOMER && status && status !== "client_reviewed") {
    return res.status(403).json({ success: false, message: "Customers can only submit gallery selections." });
  }
  db.photoProofings[index] = {
    ...existing,
    photos: photos || existing.photos,
    status: status || existing.status,
    watermarkText: watermarkText || existing.watermarkText,
    watermarkOpacity: watermarkOpacity !== undefined ? watermarkOpacity : existing.watermarkOpacity,
    watermarkPosition: watermarkPosition || existing.watermarkPosition,
    updatedAt: new Date().toISOString()
  };
  db.save();

  // Notify studio admin if customer reviewed
  if (status === "client_reviewed") {
    const studioAdmin = db.users.find(u => u.studioId === existing.studioId && u.role === UserRole.STUDIO_ADMIN);
    if (studioAdmin) {
      notifyUser(
        studioAdmin.id,
        "Photo Proofing Selections Submitted",
        `Customer reviewed photo proofs for Booking #${existing.bookingId} and submitted retouch notes.`,
        "info",
        existing.studioId
      );
    }
  }

  res.json({ success: true, gallery: db.photoProofings[index] });
});

app.put("/api/photo-proofing/:id/deliver", (req, res) => {
  const { finalDriveLink, status } = req.body;
  const index = db.photoProofings.findIndex(p => p.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({ success: false, message: "Photo proofing gallery not found." });
  }

  const existing = db.photoProofings[index];
  if (!requireStudioAccess(req, res, existing.studioId)) return;
  db.photoProofings[index] = {
    ...existing,
    finalDriveLink: finalDriveLink || existing.finalDriveLink,
    status: status || "completed",
    updatedAt: new Date().toISOString()
  };
  db.save();

  // Notify customer
  notifyUser(
    existing.customerId,
    "Final High-Res Photos Delivered!",
    `Your high-resolution edited photoshoot files are ready for download! Access them via your Customer Dashboard portal.`,
    "success",
    existing.studioId
  );

  res.json({ success: true, gallery: db.photoProofings[index] });
});

// Notifications API
app.put("/api/notifications/:id/read", (req, res) => {
  const user = requireAuthenticatedUser(req, res);
  if (!user) return;
  const index = db.notifications.findIndex(n => n.id === req.params.id);
  if (index !== -1 && db.notifications[index].userId !== user.id) {
    return res.status(403).json({ success: false, message: "You cannot update another user's notification." });
  }
  if (index !== -1) {
    db.notifications[index].isRead = true;
    db.save();
  }
  res.json({ success: true });
});

app.post("/api/notifications/dispatch", (req, res) => {
  const actor = requireRole(req, res, UserRole.SUPER_ADMIN, UserRole.STUDIO_ADMIN);
  if (!actor) return;
  const { userId, studioId, channel, recipientContact, title, message, type } = req.body;
  const targetUser = db.users.find(u => u.id === userId) || db.customers.find(c => c.id === userId);

  if (!targetUser) {
    return res.status(404).json({ success: false, message: "Notification recipient not found." });
  }

  const targetStudioId = "studioId" in targetUser ? targetUser.studioId : undefined;
  if (studioId && targetUser.role !== UserRole.SUPER_ADMIN && targetStudioId !== studioId) {
    return res.status(403).json({ success: false, message: "Notification target is outside the user's studio." });
  }

  const notif: Notification = {
    id: generateId("DISPATCH"),
    userId,
    studioId,
    title: title || `${channel || "App"} Notification`,
    message,
    isRead: false,
    type: type || "info",
    channel: channel || "SMS",
    recipientContact: recipientContact || "+63 900 000 0000",
    createdAt: new Date().toISOString()
  };

  db.addNotification(notif);
  res.json({ success: true, notification: notif });
});

// Printing Products
app.get("/api/print-products", (req, res) => {
  const { studioId } = req.query;
  const filtered = (studioId ? db.printProducts.filter(p => p.studioId === studioId) : db.printProducts)
    .filter(product => product.isActive !== false)
    .map(product => {
    const images = db.mediaFiles
      .filter(media => media.entityType === "print-product" && media.entityId === product.id && media.purpose === "PRINT_PRODUCT_IMAGE" && media.accessStatus === "active")
      .map(media => `/api/media/${media.id}`);
    return { ...product, images: images.length > 0 ? images : (product.images?.length ? product.images : [product.image]) };
  });
  res.json({ success: true, products: filtered, printProducts: filtered });
});

app.post("/api/print-products", async (req, res) => {
  const { studioId, name, description, size, price, image, images, estimatedHours } = req.body;
  const user = requireStudioAccess(req, res, studioId);
  if (!user) return;
  const submittedImages = Array.isArray(images) ? images.filter((value: unknown): value is string => typeof value === "string" && value.length > 0) : [];
  const firstImage = submittedImages[0] || image || "https://images.unsplash.com/photo-1513519245088-0e12902e5a38?w=300&fit=crop";
  const newProd: any = {
    id: generateId("PRD"),
    studioId,
    name,
    description,
    size,
    price: Number(price),
    image: firstImage,
    images: submittedImages,
    inStock: true,
    estimatedHours: Number(estimatedHours) || 24,
    isActive: true,
    createdAt: new Date().toISOString()
  };
  db.addPrintProduct(newProd);
  const savedImages: string[] = [];
  for (let index = 0; index < submittedImages.length; index += 1) {
    const media = await saveProtectedMedia(user.id, "print-product", newProd.id, "PRINT_PRODUCT_IMAGE", submittedImages[index], `print-product-${index + 1}`);
    if (!media) {
      return res.status(400).json({ success: false, message: "Each catalog image must be a JPEG, PNG, or WebP image smaller than 8 MB." });
    }
    savedImages.push(`/api/media/${media.mediaId}`);
  }
  if (savedImages.length > 0) {
    newProd.image = savedImages[0];
    newProd.images = savedImages;
    db.printProducts[db.printProducts.length - 1] = newProd;
    await db.save();
  }
  res.json({ success: true, product: newProd });
});

app.delete("/api/print-products/:id", async (req, res) => {
  const index = db.printProducts.findIndex(p => p.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({ success: false, message: "Product not found." });
  }
  if (!requireStudioAccess(req, res, db.printProducts[index].studioId)) return;
  db.printProducts[index].isActive = false;
  try {
    await db.save();
  } catch {
    return res.status(500).json({ success: false, message: "Product could not be removed from storage." });
  }
  res.json({ success: true, message: "Print product removed." });
});

app.put("/api/print-products/:id", async (req, res) => {
  const index = db.printProducts.findIndex(product => product.id === req.params.id);
  if (index === -1) return res.status(404).json({ success: false, message: "Product not found." });
  const product = db.printProducts[index];
  const user = requireStudioAccess(req, res, product.studioId);
  if (!user) return;
  const { name, description, size, price, images, estimatedHours } = req.body;
  if (!String(name || "").trim() || !String(size || "").trim() || !Number.isFinite(Number(price))) {
    return res.status(400).json({ success: false, message: "Name, size, and a valid price are required." });
  }
  const submittedImages = Array.isArray(images) ? images.filter((value: unknown): value is string => typeof value === "string" && value.length > 0) : [];
  // Snapshot the catalog images that already exist BEFORE the new uploads are
  // stored. Previously the "mark old images as deleted" pass ran after
  // saveProtectedMedia() had already pushed the NEW media rows into db.mediaFiles,
  // so a freshly uploaded image was instantly flagged "deleted" and every
  // catalog image rendered as a dead image (GET /api/media/:id → 404).
  const previousImageMediaIds = new Set(
    db.mediaFiles
      .filter(media => media.entityType === "print-product" && media.entityId === product.id && media.purpose === "PRINT_PRODUCT_IMAGE")
      .map(media => media.id)
  );
  const savedImages: string[] = [];
  for (let imageIndex = 0; imageIndex < submittedImages.length; imageIndex += 1) {
    const media = await saveProtectedMedia(user.id, "print-product", product.id, "PRINT_PRODUCT_IMAGE", submittedImages[imageIndex], `print-product-${imageIndex + 1}`);
    if (!media) return res.status(400).json({ success: false, message: "Each catalog image must be a JPEG, PNG, or WebP image smaller than 8 MB." });
    savedImages.push(`/api/media/${media.mediaId}`);
  }
  if (savedImages.length > 0) {
    // Retire only the images that belonged to the product before this request —
    // the images uploaded in this request must stay active so they can display.
    db.mediaFiles
      .filter(media => previousImageMediaIds.has(media.id) && !savedImages.includes(`/api/media/${media.id}`))
      .forEach(media => { media.accessStatus = "deleted"; });
  }
  db.printProducts[index] = {
    ...product,
    name: String(name).trim(),
    description: String(description || "Premium photo print option.").trim(),
    size: String(size).trim(),
    price: Number(price),
    estimatedHours: Number(estimatedHours) || 24,
    ...(savedImages.length > 0 ? { image: savedImages[0], images: savedImages } : {})
  };
  await db.save();
  res.json({ success: true, product: db.printProducts[index] });
});

// Print orders
app.get("/api/print-orders", (req, res) => {
  const user = requireAuthenticatedUser(req, res);
  if (!user) return;
  const { customerId, studioId } = req.query;
  let filtered = db.printOrders;
  if (user.role === UserRole.CUSTOMER) filtered = filtered.filter(o => o.customerId === user.id);
  else if (user.role === UserRole.STUDIO_ADMIN || user.role === UserRole.STUDIO_STAFF) filtered = filtered.filter(o => o.studioId === user.studioId);
  if (customerId && user.role === UserRole.SUPER_ADMIN) filtered = filtered.filter(o => o.customerId === customerId);
  if (studioId && user.role === UserRole.SUPER_ADMIN) filtered = filtered.filter(o => o.studioId === studioId);
  const printOrdersWithCustomerDetails = filtered.map(order => {
    const customer = db.users.find(item => item.id === order.customerId);
    return {
      ...order,
      customerName: customer?.fullName || "Walk-in Pickup",
      customerEmail: customer?.email || "",
      customerPhone: customer?.contactNumber || ""
    };
  });
  res.json({ success: true, printOrders: printOrdersWithCustomerDetails });
});

app.post("/api/print-orders", async (req, res) => {
  // Print orders are pickup-only. Payment is always cash at the studio counter.
  // paymentMethod, referenceNumber, and proofOfPayment from the client are ignored.
  const { studioId, customerId, productId, quantity, uploadedPhoto, totalAmount, printDesign } = req.body;
  const user = requireRole(req, res, UserRole.CUSTOMER);
  if (!user) return;
  if (customerId !== user.id) return res.status(403).json({ success: false, message: "Customer identity is derived from the authenticated session." });
  const product = db.printProducts.find(item => item.id === productId && item.studioId === studioId && item.isActive && item.inStock);
  const orderQuantity = Number(quantity);
  if (!product || !Number.isInteger(orderQuantity) || orderQuantity < 1 || orderQuantity > 100) {
    return res.status(400).json({ success: false, message: "The selected print product or quantity is invalid." });
  }
  const calculatedTotal = Number(product.price) * orderQuantity;
  if (!Number.isFinite(calculatedTotal) || Math.abs(calculatedTotal - Number(totalAmount)) > 0.01) {
    return res.status(400).json({ success: false, message: "The order total does not match the selected product and quantity." });
  }
  const validPrintDesign = printDesign &&
    ["oak", "black", "gold", "frameless"].includes(printDesign.frameStyle) &&
    ["neutral", "cozy", "gallery", "easel"].includes(printDesign.backdrop) &&
    ["glossy", "matte"].includes(printDesign.matteFinish) &&
    ["fit", "fill"].includes(printDesign.scaleMode);
  if (!validPrintDesign) {
    return res.status(400).json({ success: false, message: "Please choose a valid print design before submitting your order." });
  }

  const orderId = generateId("PR-2026");
  const photoMedia = await saveProtectedMedia(user.id, "print-order", orderId, "PRINT_UPLOAD", uploadedPhoto, "print-photo");
  if (!photoMedia) {
    return res.status(400).json({ success: false, message: "The print photo must be a JPEG, PNG, or WebP image smaller than 8 MB." });
  }
  const newOrder: PrintOrder = {
    id: orderId,
    studioId,
    customerId,
    productId,
    quantity: orderQuantity,
    uploadedPhoto: `/api/media/${photoMedia.mediaId}`,
    printDesign: {
      frameStyle: printDesign.frameStyle,
      backdrop: printDesign.backdrop,
      matteFinish: printDesign.matteFinish,
      scaleMode: printDesign.scaleMode
    },
    status: "Pending",
    totalAmount: calculatedTotal,
    paymentMethod: "Cash",
    paymentStatus: "Unpaid",
    createdAt: new Date().toISOString()
  };

  db.addPrintOrder(newOrder);

  // Notify studio admin
  const studioAdmin = db.users.find(u => u.studioId === studioId && u.role === UserRole.STUDIO_ADMIN);
  if (studioAdmin) {
    notifyUser(studioAdmin.id, "New Print Order", `A new print order (${orderId}) has been received.`, "warning", studioId);
  }

  res.json({ success: true, printOrder: newOrder });
});

app.put("/api/print-orders/:id/cancel", (req, res) => {
  const index = db.printOrders.findIndex(o => o.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({ success: false, message: "Print order not found." });
  }

  const order = db.printOrders[index];
  const user = requireAuthenticatedUser(req, res);
  if (!user) return;

  const canCancel =
    (user.role === UserRole.CUSTOMER && order.customerId === user.id) ||
    (user.role === UserRole.SUPER_ADMIN) ||
    ((user.role === UserRole.STUDIO_ADMIN || user.role === UserRole.STUDIO_STAFF) && user.studioId === order.studioId);

  if (!canCancel) {
    return res.status(403).json({ success: false, message: "You cannot cancel this print order." });
  }

  const cancellableStatuses = ["Pending", "Confirmed", "Processing", "Quality Check", "Ready for Pickup"];
  if (!cancellableStatuses.includes(order.status)) {
    return res.status(400).json({ success: false, message: `Print orders in ${order.status} status cannot be cancelled.` });
  }

  const reason = String(req.body?.reason || "Customer requested cancellation").trim();
  db.printOrders[index] = {
    ...order,
    status: "Cancelled",
    paymentStatus: order.paymentStatus === "Paid" ? "Paid" : order.paymentStatus
  };
  db.save();

  notifyUser(order.customerId, "Print Order Cancelled", `Your print order ${order.id} has been cancelled. ${reason ? `Reason: ${reason}` : ""}`.trim(), "warning");
  res.json({ success: true, printOrder: db.printOrders[index] });
});

app.put("/api/print-orders/:id/status", (req, res) => {
  const { status } = req.body;
  const index = db.printOrders.findIndex(o => o.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({ success: false, message: "Print order not found." });
  }

  const original = db.printOrders[index];
  const user = requireAuthenticatedUser(req, res);
  if (!user) return;
  const canManage = user.role === UserRole.SUPER_ADMIN ||
    ((user.role === UserRole.STUDIO_ADMIN || user.role === UserRole.STUDIO_STAFF) && user.studioId === original.studioId);
  if (!canManage) return res.status(403).json({ success: false, message: "You cannot update this print order." });
  const allowedTransitions: Record<string, string[]> = {
    Pending: ["Confirmed", "Cancelled"],
    Confirmed: ["Processing", "Cancelled"],
    Processing: ["Quality Check", "Ready for Pickup", "Cancelled"],
    "Quality Check": ["Ready for Pickup", "Processing"],
    "Ready for Pickup": ["Completed"],
    Completed: [],
    Cancelled: []
  };
  if (status && status !== original.status && !allowedTransitions[original.status]?.includes(status)) {
    return res.status(400).json({ success: false, message: `Invalid print order transition from ${original.status} to ${status}.` });
  }
  if (status === "Completed" && original.paymentStatus !== "Paid") {
    return res.status(400).json({ success: false, message: "A print order must be paid before completion." });
  }
  db.printOrders[index] = {
    ...original,
    status: status || original.status
  };
  db.save();

  notifyUser(original.customerId, "Print Order Update", `Your print order ${original.id} status is now: ${status || original.status}`, "info");

  res.json({ success: true, printOrder: db.printOrders[index] });
});

app.put("/api/print-orders/:id/payment/record-cash", (req, res) => {
  const user = requireStudioAccess(req, res, db.printOrders.find(order => order.id === req.params.id)?.studioId || "");
  if (!user) return;
  const index = db.printOrders.findIndex(order => order.id === req.params.id);
  if (index === -1) return res.status(404).json({ success: false, message: "Print order not found." });
  
  if (db.printOrders[index].paymentStatus === "Paid") {
    return res.status(400).json({ success: false, message: "Order is already paid." });
  }

  const now = new Date().toISOString();
  db.printOrders[index].paymentStatus = "Paid";
  db.printOrders[index].paymentMethod = "Cash";
  (db.printOrders[index] as any).paidAt = now;
  (db.printOrders[index] as any).cashReceivedBy = user.id;

  if (req.body?.cashTendered !== undefined) {
    (db.printOrders[index] as any).cashTendered = Number(req.body.cashTendered);
  }
  if (req.body?.changeAmount !== undefined) {
    (db.printOrders[index] as any).changeAmount = Number(req.body.changeAmount);
  }

  // If markCompleted is true or if already Ready for Pickup, mark status as Completed
  if (req.body?.markCompleted !== false && (req.body?.markCompleted === true || db.printOrders[index].status === "Ready for Pickup")) {
    db.printOrders[index].status = "Completed";
  }

  db.save();

  logAction(
    user.id,
    (user as any).email || user.id,
    `Recorded cash on hand payment of ₱${db.printOrders[index].totalAmount} for Print Order ${db.printOrders[index].id} (Studio Counter Pickup)`,
    "PRINT_ORDER",
    db.printOrders[index].id
  );

  notifyUser(
    db.printOrders[index].customerId,
    "Payment Received & Order Released",
    `Your cash payment of ₱${db.printOrders[index].totalAmount} for print order ${db.printOrders[index].id} has been recorded at the studio counter. Thank you!`,
    "success",
    db.printOrders[index].studioId
  );

  const customer = db.customers.find(c => c.id === db.printOrders[index].customerId) || db.users.find(u => u.id === db.printOrders[index].customerId);
  if (customer?.email) {
    const product = db.printProducts.find(p => p.id === db.printOrders[index].productId);
    const receiptDoc = buildPrintOrderReceiptPDF(db.printOrders[index], db.studios.find(s => s.id === db.printOrders[index].studioId), product);
    const pdfBuffer = Buffer.from(receiptDoc.output("arraybuffer"));
    sendReceiptCopyEmail(
      customer.email,
      "Print Order Receipt Copy",
      `Your cash payment receipt for Print Order ${db.printOrders[index].id} is attached here.`,
      `Print_Order_${db.printOrders[index].id}_Receipt.pdf`,
      pdfBuffer
    ).catch(err => console.warn("[SMTP] Print receipt copy email warning:", err));
  }
  res.json({ success: true, printOrder: db.printOrders[index] });
});

// ── Archive a print order (soft-delete) ─────────────────────────────────────
app.put("/api/print-orders/:id/archive", (req, res) => {
  const user = requireAuthenticatedUser(req, res);
  if (!user) return;

  const idx = db.printOrders.findIndex(o => o.id === req.params.id);
  if (idx === -1) return res.status(404).json({ success: false, message: "Print order not found." });
  const order = db.printOrders[idx];

  const isSuperAdmin = user.role === UserRole.SUPER_ADMIN;
  const isStudioOwner = (user.role === UserRole.STUDIO_ADMIN || user.role === UserRole.STUDIO_STAFF) && user.studioId === order.studioId;
  const isOwningCustomer = user.role === UserRole.CUSTOMER && order.customerId === user.id;
  if (!isSuperAdmin && !isStudioOwner && !isOwningCustomer) {
    return res.status(403).json({ success: false, message: "Access denied." });
  }

  const terminalStatuses = ["Completed", "Cancelled"];
  if (isOwningCustomer && !terminalStatuses.includes(order.status)) {
    return res.status(409).json({ success: false, message: "Only completed or cancelled print orders can be archived." });
  }

  db.printOrders[idx] = {
    ...order,
    isArchived: true,
    archivedAt: new Date().toISOString(),
    archivedBy: user.id
  };
  db.save();
  logAction(user.id, (user as any).email || user.id, `Archived print order ${order.id}`, "PRINT_ORDER", order.id);
  res.json({ success: true, printOrder: db.printOrders[idx] });
});

// ── Unarchive a print order ──────────────────────────────────────────────────
app.put("/api/print-orders/:id/unarchive", (req, res) => {
  const user = requireAuthenticatedUser(req, res);
  if (!user) return;

  const idx = db.printOrders.findIndex(o => o.id === req.params.id);
  if (idx === -1) return res.status(404).json({ success: false, message: "Print order not found." });
  const order = db.printOrders[idx];

  const isSuperAdmin = user.role === UserRole.SUPER_ADMIN;
  const isStudioOwner = (user.role === UserRole.STUDIO_ADMIN || user.role === UserRole.STUDIO_STAFF) && user.studioId === order.studioId;
  const isOwningCustomer = user.role === UserRole.CUSTOMER && order.customerId === user.id;
  if (!isSuperAdmin && !isStudioOwner && !isOwningCustomer) {
    return res.status(403).json({ success: false, message: "Access denied." });
  }

  db.printOrders[idx] = {
    ...order,
    isArchived: false,
    archivedAt: undefined,
    archivedBy: undefined
  };
  db.save();
  logAction(user.id, (user as any).email || user.id, `Unarchived print order ${order.id}`, "PRINT_ORDER", order.id);
  res.json({ success: true, printOrder: db.printOrders[idx] });
});

// ── Permanently delete an archived print order ───────────────────────────────
// Allowed: SUPER_ADMIN (any), STUDIO_ADMIN/STUDIO_STAFF (own studio), CUSTOMER (own order)
app.delete("/api/print-orders/:id", (req, res) => {
  const user = requireAuthenticatedUser(req, res);
  if (!user) return;

  const idx = db.printOrders.findIndex(o => o.id === req.params.id);
  if (idx === -1) return res.status(404).json({ success: false, message: "Print order not found." });
  const order = db.printOrders[idx];

  const isSuperAdmin = user.role === UserRole.SUPER_ADMIN;
  const isStudioOwner = (user.role === UserRole.STUDIO_ADMIN || user.role === UserRole.STUDIO_STAFF) && user.studioId === order.studioId;
  const isOwningCustomer = user.role === UserRole.CUSTOMER && order.customerId === user.id;
  if (!isSuperAdmin && !isStudioOwner && !isOwningCustomer) {
    return res.status(403).json({ success: false, message: "Access denied." });
  }

  if (!order.isArchived) {
    return res.status(409).json({ success: false, message: "Archive this print order first before permanently deleting." });
  }

  const userEmail = (user as any).email || user.id;
  db.printOrders.splice(idx, 1);
  db.save();
  logAction(user.id, userEmail, `Permanently deleted print order ${order.id}`, "PRINT_ORDER", order.id);
  res.json({ success: true, message: "Print order permanently deleted." });
});

// Reviews
app.post("/api/reviews", (req, res) => {
  const { studioId, customerId, customerName, bookingId, rating, comment } = req.body;
  const user = requireRole(req, res, UserRole.CUSTOMER);
  if (!user) return;
  if (customerId !== user.id) return res.status(403).json({ success: false, message: "Customer identity is derived from the authenticated session." });
  
  // Verify completed booking exists and hasn't been reviewed yet
  const completedBooking = db.bookings.find(b => b.id === bookingId && b.customerId === customerId && b.status === "Completed");
  if (!completedBooking) {
    return res.status(400).json({ success: false, message: "You can only review completed bookings." });
  }

  const alreadyReviewed = db.reviews.some(r => r.bookingId === bookingId);
  if (alreadyReviewed) {
    return res.status(400).json({ success: false, message: "You have already reviewed this booking." });
  }
  if (!Number.isInteger(Number(rating)) || Number(rating) < 1 || Number(rating) > 5 || !String(comment || "").trim()) {
    return res.status(400).json({ success: false, message: "A rating from 1 to 5 and a comment are required." });
  }

  const reviewId = generateId("REV");
  const newReview: Review = {
    id: reviewId,
    studioId,
    customerId,
    customerName,
    bookingId,
    rating: Number(rating),
    comment,
    status: "pending", // Requires admin approval before going public
    isVisible: true,
    createdAt: new Date().toISOString()
  };

  db.addReview(newReview);

  logAction(customerId, customerName, `Submitted review REV-${reviewId} for studio ${studioId}`, "REVIEW", reviewId);

  res.json({ success: true, review: newReview, message: "Your review has been submitted and is pending admin approval." });
});

// ====================================================================
// ADMIN REVIEW MANAGEMENT ENDPOINTS (SUPER_ADMIN only)
// ====================================================================

// GET all reviews (admin sees ALL statuses: pending, approved, rejected)
app.get("/api/admin/reviews", (req, res) => {
  if (!requireRole(req, res, UserRole.SUPER_ADMIN)) return;
  const allReviews = [...db.reviews].sort((a, b) => {
    // pending first, then approved, rejected last
    const order = { pending: 0, approved: 1, rejected: 2 };
    return (order[a.status] ?? 1) - (order[b.status] ?? 1);
  });
  res.json({ success: true, reviews: allReviews });
});

// Approve a review
app.put("/api/admin/reviews/:id/approve", (req, res) => {
  if (!requireRole(req, res, UserRole.SUPER_ADMIN)) return;
  const { id } = req.params;
  const idx = db.reviews.findIndex(r => r.id === id);
  if (idx === -1) return res.status(404).json({ success: false, message: "Review not found." });

  db.reviews[idx].status = "approved";
  db.save();

  // Recalculate Studio Rating based on approved reviews only
  const studioId = db.reviews[idx].studioId;
  const studioIdx = db.studios.findIndex(s => s.id === studioId);
  if (studioIdx !== -1) {
    const approvedReviews = db.reviews.filter(r => r.studioId === studioId && r.status === "approved");
    const avgRating = approvedReviews.length > 0
      ? approvedReviews.reduce((sum, r) => sum + r.rating, 0) / approvedReviews.length
      : 0;
    db.studios[studioIdx].rating = parseFloat(avgRating.toFixed(1));
    db.studios[studioIdx].reviewCount = approvedReviews.length;
    db.save();
  }

  logAction("SYSTEM", "system@admin", `Approved review ${id}`, "REVIEW", id);
  res.json({ success: true, review: db.reviews[idx] });
});

// Reject a review
app.put("/api/admin/reviews/:id/reject", (req, res) => {
  if (!requireRole(req, res, UserRole.SUPER_ADMIN)) return;
  const { id } = req.params;
  const idx = db.reviews.findIndex(r => r.id === id);
  if (idx === -1) return res.status(404).json({ success: false, message: "Review not found." });

  db.reviews[idx].status = "rejected";
  db.save();

  // Recalculate Studio Rating based on approved reviews only
  const studioId = db.reviews[idx].studioId;
  const studioIdx = db.studios.findIndex(s => s.id === studioId);
  if (studioIdx !== -1) {
    const approvedReviews = db.reviews.filter(r => r.studioId === studioId && r.status === "approved");
    const avgRating = approvedReviews.length > 0
      ? approvedReviews.reduce((sum, r) => sum + r.rating, 0) / approvedReviews.length
      : 0;
    db.studios[studioIdx].rating = parseFloat(avgRating.toFixed(1));
    db.studios[studioIdx].reviewCount = approvedReviews.length;
    db.save();
  }

  logAction("SYSTEM", "system@admin", `Rejected review ${id}`, "REVIEW", id);
  res.json({ success: true, review: db.reviews[idx] });
});

// Hard delete a review (admin only)
app.delete("/api/admin/reviews/:id", (req, res) => {
  if (!requireRole(req, res, UserRole.SUPER_ADMIN)) return;
  const { id } = req.params;
  const idx = db.reviews.findIndex(r => r.id === id);
  if (idx === -1) return res.status(404).json({ success: false, message: "Review not found." });

  const studioId = db.reviews[idx].studioId;
  db.reviews.splice(idx, 1);
  db.save();

  // Recalculate Studio Rating after deletion
  const studioIdx = db.studios.findIndex(s => s.id === studioId);
  if (studioIdx !== -1) {
    const approvedReviews = db.reviews.filter(r => r.studioId === studioId && r.status === "approved");
    const avgRating = approvedReviews.length > 0
      ? approvedReviews.reduce((sum, r) => sum + r.rating, 0) / approvedReviews.length
      : 0;
    db.studios[studioIdx].rating = parseFloat(avgRating.toFixed(1));
    db.studios[studioIdx].reviewCount = approvedReviews.length;
    db.save();
  }

  logAction("SYSTEM", "system@admin", `Deleted review ${id}`, "REVIEW", id);
  res.json({ success: true, message: "Review deleted successfully." });
});

// ====================================================================
// STUDIO OWNER REVIEW ENDPOINTS (STUDIO_ADMIN only)
// ====================================================================

// GET reviews for a specific studio (studio owner sees pending + approved, not rejected)
app.get("/api/studio/reviews", (req, res) => {
  const { studioId } = req.query;
  if (!studioId) return res.status(400).json({ success: false, message: "studioId is required." });
  if (!requireStudioAccess(req, res, String(studioId))) return;
  const studioReviews = db.reviews
    .filter(r => r.studioId === studioId && r.status !== "rejected")
    .map(r => ({ ...r, isVisible: r.isVisible !== false }))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  res.json({ success: true, reviews: studioReviews });
});

// Studio owner toggles whether a review is visible publicly
app.put("/api/studio/reviews/:id/visibility", (req, res) => {
  const { id } = req.params;
  const { studioId, visible } = req.body;
  if (!studioId) return res.status(400).json({ success: false, message: "studioId is required." });
  if (!requireStudioAccess(req, res, studioId)) return;

  const idx = db.reviews.findIndex(r => r.id === id && r.studioId === studioId);
  if (idx === -1) return res.status(404).json({ success: false, message: "Review not found or not yours." });

  db.reviews[idx].isVisible = Boolean(visible);
  db.save();

  logAction(studioId, studioId, `Studio changed review ${id} visibility to ${Boolean(visible) ? "public" : "hidden"}`, "REVIEW", id);
  res.json({ success: true, review: db.reviews[idx] });
});

// Studio owner replies to a review
app.put("/api/studio/reviews/:id/reply", (req, res) => {
  const { id } = req.params;
  const { reply, studioId } = req.body;
  if (!reply || !studioId) return res.status(400).json({ success: false, message: "reply and studioId are required." });
  if (!requireStudioAccess(req, res, studioId)) return;

  const idx = db.reviews.findIndex(r => r.id === id && r.studioId === studioId);
  if (idx === -1) return res.status(404).json({ success: false, message: "Review not found or not yours." });

  db.reviews[idx].reply = reply;
  db.reviews[idx].replyAt = new Date().toISOString();
  db.save();

  logAction(studioId, studioId, `Studio replied to review ${id}`, "REVIEW", id);
  res.json({ success: true, review: db.reviews[idx] });
});

// Favorites
app.get("/api/favorites", (req, res) => {
  const { customerId } = req.query;
  const user = requireRole(req, res, UserRole.CUSTOMER);
  if (!user) return;
  if (customerId !== user.id) return res.status(403).json({ success: false, message: "Favorite access is limited to the authenticated customer." });
  const filtered = db.favorites.filter(f => f.customerId === customerId);
  res.json({ success: true, favorites: filtered });
});

app.post("/api/favorites", (req, res) => {
  const { customerId, studioId } = req.body;
  const user = requireRole(req, res, UserRole.CUSTOMER);
  if (!user) return;
  if (customerId !== user.id) return res.status(403).json({ success: false, message: "Customer identity is derived from the authenticated session." });
  const exists = db.favorites.find(f => f.customerId === customerId && f.studioId === studioId);
  if (exists) {
    return res.json({ success: true, message: "Already favorited" });
  }
  const newFav = {
    id: generateId("FAV"),
    customerId,
    studioId,
    createdAt: new Date().toISOString()
  };
  db.addFavorite(newFav);
  res.json({ success: true, favorite: newFav });
});

app.delete("/api/favorites", (req, res) => {
  const { customerId, studioId } = req.body;
  const user = requireRole(req, res, UserRole.CUSTOMER);
  if (!user) return;
  if (customerId !== user.id) return res.status(403).json({ success: false, message: "Customer identity is derived from the authenticated session." });
  const index = db.favorites.findIndex(f => f.customerId === customerId && f.studioId === studioId);
  if (index !== -1) {
    db.favorites.splice(index, 1);
    db.save();
  }
  res.json({ success: true, message: "Favorite removed." });
});

// Knowledge Base / FAQ FAQs
app.get("/api/chatbot/faqs", (req, res) => {
  const { studioId } = req.query;
  const filtered = studioId ? db.faqs.filter(f => f.studioId === studioId || f.studioId === "GLOBAL") : db.faqs;
  res.json({ success: true, faqs: filtered });
});

app.get("/api/chatbot/faq-suggestions", (_req, res) => {
  const suggestions = Array.from(faqSuggestionStore.values())
    .filter(s => s.frequency >= 2)
    .sort((a, b) => new Date(b.lastSeenAt).getTime() - new Date(a.lastSeenAt).getTime());

  res.json({ success: true, suggestions });
});

app.post("/api/chatbot/faq-suggestions/:id/approve", (req, res) => {
  const suggestion = Array.from(faqSuggestionStore.values()).find(s => s.id === req.params.id);
  if (!suggestion) {
    return res.status(404).json({ success: false, message: "Suggested FAQ not found." });
  }

  const newFAQ: ChatbotFAQ = {
    id: generateId("FAQ"),
    studioId: suggestion.studioId || "GLOBAL",
    question: suggestion.question,
    answer: suggestion.answer,
    category: suggestion.category || "Suggested",
    createdAt: new Date().toISOString(),
    frequency: suggestion.frequency,
    isSuggestion: false,
    source: "chatbot"
  };

  db.addFAQ(newFAQ);
  faqSuggestionStore.delete(normalizeFaqQuestion(suggestion.question));

  res.json({ success: true, faq: newFAQ });
});

app.post("/api/chatbot/faqs", (req, res) => {
  const { studioId, question, answer, category } = req.body;
  if (!requireStudioAccess(req, res, studioId)) return;
  const newFAQ: ChatbotFAQ = {
    id: generateId("FAQ"),
    studioId,
    question,
    answer,
    category: category || "FAQ",
    createdAt: new Date().toISOString()
  };
  db.addFAQ(newFAQ);
  res.json({ success: true, faq: newFAQ });
});

app.delete("/api/chatbot/faqs/:id", (req, res) => {
  const index = db.faqs.findIndex(f => f.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({ success: false, message: "FAQ not found." });
  }
  if (!requireStudioAccess(req, res, db.faqs[index].studioId)) return;
  db.faqs.splice(index, 1);
  db.save();
  res.json({ success: true, message: "FAQ removed." });
});

// Notifications Endpoints
app.get("/api/notifications", (req, res) => {
  const { userId } = req.query;
  const user = requireAuthenticatedUser(req, res);
  if (!user) return;
  if (userId !== user.id) return res.status(403).json({ success: false, message: "Notification access is limited to the authenticated user." });
  const filtered = db.notifications.filter(n => n.userId === userId);
  res.json({ success: true, notifications: filtered });
});

app.put("/api/notifications/mark-read", (req, res) => {
  const { userId, notifId } = req.body;
  const user = requireAuthenticatedUser(req, res);
  if (!user) return;
  if (userId && userId !== user.id) return res.status(403).json({ success: false, message: "Notification access is limited to the authenticated user." });
  if (notifId) {
    const notif = db.notifications.find(n => n.id === notifId);
    if (notif) {
      notif.isRead = true;
      db.save();
    }
  } else if (userId) {
    db.notifications.forEach(n => {
      if (n.userId === userId) n.isRead = true;
    });
    db.save();
  }
  res.json({ success: true });
});

// Audit Logs
app.get("/api/audit-logs", (req, res) => {
  if (!requireRole(req, res, UserRole.SUPER_ADMIN)) return;
  res.json({ success: true, logs: db.auditLogs, auditLogs: db.auditLogs });
});

// ----------------------------------------------------
// ANALYTICS & SALES REPORTING
// ----------------------------------------------------
app.get("/api/reports/sales", (req, res) => {
  const user = requireRole(req, res, UserRole.SUPER_ADMIN, UserRole.STUDIO_ADMIN, UserRole.STUDIO_STAFF);
  if (!user) return;
  const { studioId, startDate, endDate } = req.query;
  const scopedStudioId = user.role === UserRole.SUPER_ADMIN ? studioId as string | undefined : ("studioId" in user ? user.studioId : undefined);
  let targetBookings = db.bookings.filter(b => !["Cancelled", "Expired", "Rejected"].includes(b.status));
  let targetPrints = db.printOrders.filter(p => !["Cancelled"].includes(p.status));

  if (scopedStudioId) {
    targetBookings = targetBookings.filter(b => b.studioId === scopedStudioId);
    targetPrints = targetPrints.filter(p => p.studioId === scopedStudioId);
  }

  // Filter by date range if provided
  if (startDate) {
    targetBookings = targetBookings.filter(b => b.bookingDate >= (startDate as string));
    targetPrints = targetPrints.filter(p => p.createdAt >= (startDate as string));
  }
  if (endDate) {
    targetBookings = targetBookings.filter(b => b.bookingDate <= (endDate as string));
    targetPrints = targetPrints.filter(p => p.createdAt <= (endDate as string));
  }

  const bookingSales = targetBookings.reduce((sum, b) => sum + db.payments
    .filter(p => p.bookingId === b.id && p.paymentStatus === "Paid")
    .reduce((paymentSum, p) => paymentSum + Number(p.amount), 0), 0);
  const printingSales = targetPrints.reduce((sum, p) => sum + (p.paymentStatus === "Paid" ? p.totalAmount : 0), 0);
  const totalSales = bookingSales + printingSales;

  res.json({
    success: true,
    summary: {
      bookingSales,
      printingSales,
      totalSales,
        outstandingBalances: targetBookings.reduce((sum, b) => sum + Math.max(0, b.remainingBalance), 0),
      bookingCount: targetBookings.length,
      printOrderCount: targetPrints.length
    }
  });
});

app.get("/api/reports/bookings", (req, res) => {
  const user = requireRole(req, res, UserRole.SUPER_ADMIN, UserRole.STUDIO_ADMIN, UserRole.STUDIO_STAFF);
  if (!user) return;
  const { studioId } = req.query;
  let targetBookings = db.bookings;
  const scopedStudioId = user.role === UserRole.SUPER_ADMIN ? studioId as string | undefined : ("studioId" in user ? user.studioId : undefined);
  if (scopedStudioId) {
    targetBookings = targetBookings.filter(b => b.studioId === scopedStudioId);
  }

  // Aggregate by status
  const statusCounts = targetBookings.reduce((acc: any, b) => {
    acc[b.status] = (acc[b.status] || 0) + 1;
    return acc;
  }, {});

  const months = Array.from({ length: 12 }, (_, index) => new Date(new Date().getFullYear(), index, 1)
    .toLocaleDateString("en-US", { month: "short" }));
  const trend = months.map(m => {
    const val = db.bookings.filter(b => {
      if (scopedStudioId && b.studioId !== scopedStudioId) return false;
      const bMonth = new Date(b.createdAt).getMonth();
      const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      return monthNames[bMonth].substring(0, 3) === m && db.payments.some(p => p.bookingId === b.id && p.paymentStatus === "Paid");
    });

    const printVal = db.printOrders.filter(p => {
      if (scopedStudioId && p.studioId !== scopedStudioId) return false;
      const pMonth = new Date(p.createdAt).getMonth();
      const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      return monthNames[pMonth].substring(0, 3) === m && p.paymentStatus === "Paid";
    });

    return {
      name: m,
      bookings: val.length,
      revenue: val.reduce((sum, b) => sum + db.payments.filter(p => p.bookingId === b.id && p.paymentStatus === "Paid").reduce((paid, p) => paid + Number(p.amount), 0), 0) + printVal.reduce((sum, p) => sum + p.totalAmount, 0),
      printing: printVal.reduce((sum, p) => sum + p.totalAmount, 0)
    };
  });

  res.json({
    success: true,
    statusCounts,
    trend
  });
});

app.get("/api/reports/daily-closing", (req, res) => {
  const user = requireRole(req, res, UserRole.SUPER_ADMIN, UserRole.STUDIO_ADMIN);
  if (!user) return;

  const { studioId, date } = req.query;
  const targetStudioId = user.role === UserRole.SUPER_ADMIN ? studioId as string | undefined : ("studioId" in user ? user.studioId : undefined);
  const targetDate = (date as string) || new Date().toISOString().split("T")[0];

  const verifiedPayments = db.payments.filter(p => {
    if (targetStudioId && p.studioId !== targetStudioId) return false;
    if (p.paymentStatus !== "Paid") return false;
    const paymentDay = (p.paymentDate || p.createdAt || "").split("T")[0];
    return paymentDay === targetDate;
  });

  const verifiedPrints = db.printOrders.filter(pr => {
    if (targetStudioId && pr.studioId !== targetStudioId) return false;
    if (pr.paymentStatus !== "Paid") return false;
    const printDay = ((pr as any).paidAt || pr.createdAt || "").split("T")[0];
    return printDay === targetDate;
  });

  const totalDownpayments = verifiedPayments.filter(p => p.paymentType === "Downpayment").reduce((sum, p) => sum + Number(p.amount), 0);
  const totalBalanceCollections = verifiedPayments.filter(p => p.paymentType === "Balance").reduce((sum, p) => sum + Number(p.amount), 0);
  const totalPrintRevenue = verifiedPrints.reduce((sum, p) => sum + Number(p.totalAmount), 0);
  const grossCollections = totalDownpayments + totalBalanceCollections + totalPrintRevenue;

  const byMethod = {
    cash: verifiedPayments.filter(p => p.paymentMethod === "Cash").reduce((s, p) => s + Number(p.amount), 0) +
          verifiedPrints.filter(p => p.paymentMethod === "Cash").reduce((s, p) => s + Number(p.totalAmount), 0),
    gcash: verifiedPayments.filter(p => p.paymentMethod === "GCash").reduce((s, p) => s + Number(p.amount), 0) + 0,
    // Bank Transfer / Online Payment were removed — Maya replaces them as the
    // second (and last) digital wallet option.
    maya: verifiedPayments.filter(p => p.paymentMethod === "Maya").reduce((s, p) => s + Number(p.amount), 0) + 0
  };

  const bookingTransactions = verifiedPayments.map(p => ({
    id: p.id,
    bookingId: p.bookingId,
    type: p.paymentType,
    method: p.paymentMethod,
    amount: p.amount,
    referenceNumber: p.referenceNumber || "N/A",
    timestamp: p.paymentDate || p.createdAt
  }));

  const printTransactions = verifiedPrints.map(pr => ({
    id: pr.id,
    bookingId: pr.id,
    type: "Print Order Pickup",
    method: "Cash",
    amount: pr.totalAmount,
    referenceNumber: pr.referenceNumber || "Studio Counter Cash",
    timestamp: (pr as any).paidAt || pr.createdAt
  }));

  res.json({
    success: true,
    closingReport: {
      date: targetDate,
      studioId: targetStudioId || "ALL_STUDIOS",
      grossCollections,
      totalDownpayments,
      totalBalanceCollections,
      totalPrintRevenue,
      cashOnHandToday: byMethod.cash,
      paymentCount: verifiedPayments.length + verifiedPrints.length,
      breakdownByMethod: byMethod,
      transactions: [...bookingTransactions, ...printTransactions]
    }
  });
});

app.get("/api/audit-events", (req, res) => {
  const user = requireRole(req, res, UserRole.SUPER_ADMIN, UserRole.STUDIO_ADMIN);
  if (!user) return;

  const { entityType, entityId, limit } = req.query;
  let events = [...db.auditLogs];

  if (entityType) {
    events = events.filter(e => e.entityType.toLowerCase() === String(entityType).toLowerCase());
  }
  if (entityId) {
    events = events.filter(e => e.entityId === String(entityId));
  }

  events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  const maxLimit = Number(limit) || 100;

  res.json({ success: true, auditEvents: events.slice(0, maxLimit) });
});

// Automatic Background Job: Check and expire unpaid booking holds every 60 seconds
setInterval(() => {
  const now = new Date();
  let updated = false;
  for (const b of db.bookings) {
    if (["Pending", "Awaiting Payment"].includes(b.status) && b.paymentDueAt && new Date(b.paymentDueAt) <= now && b.amountPaid < b.downPaymentAmount) {
      // Only expire if no pending verification payment exists
      const hasPendingProof = db.payments.some(p => p.bookingId === b.id && p.paymentStatus === "Pending Verification");
      if (!hasPendingProof) {
        b.status = "Expired";
        b.paymentStatus = "Failed";
        updated = true;
        notifyUser(b.customerId, "Booking Payment Hold Expired", `Booking ${b.id} expired because the downpayment was not received before the deadline. The time slot has been released.`, "error", b.studioId);
        logAction("SYSTEM", "system@caintaphotography.com", "Auto-expired unpaid booking hold", "BOOKING", b.id);
      }
    }
  }
  if (updated) db.save();
}, 60 * 1000);

// ----------------------------------------------------
// Background Job: Upcoming Session Reminders (runs every 5 minutes)
// Sends in-app + email notifications:
//   • 24 hours before the session → first reminder
//   •  2 hours before the session → final/urgent reminder
// Each reminder fires only once per booking (tracked by reminderSent24h / reminderSent2h).
// ----------------------------------------------------
setInterval(() => {
  const now = new Date();
  let updated = false;

  for (const booking of db.bookings) {
    // Remind for all active upcoming booking statuses — including Awaiting Payment and Pending
    // because new bookings start in those statuses before the owner verifies payment.
    if (!["Confirmed", "Rescheduled", "Awaiting Payment", "Pending"].includes(booking.status)) continue;
    if (booking.isArchived) continue;

    // Build the session start datetime from bookingDate + timeSlot (e.g. "09:00 AM")
    const sessionDate = booking.bookingDate; // "YYYY-MM-DD"
    const timeStr = booking.timeSlot;        // "09:00 AM"
    const sessionStart = new Date(`${sessionDate}T00:00:00`);

    // Parse the time slot into hours/minutes
    const tMatch = timeStr.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
    if (!tMatch) continue;
    let hours = parseInt(tMatch[1], 10);
    const mins = parseInt(tMatch[2], 10);
    const meridiem = tMatch[3].toUpperCase();
    if (meridiem === "PM" && hours !== 12) hours += 12;
    if (meridiem === "AM" && hours === 12) hours = 0;
    sessionStart.setHours(hours, mins, 0, 0);

    const msUntilSession = sessionStart.getTime() - now.getTime();
    if (msUntilSession <= 0) continue; // already past

    // Look up studio and customer details
    const studio = db.studios.find(s => s.id === booking.studioId);
    const studioName = studio?.name || "your studio";
    const customerName = booking.customerDetails?.fullName || "Customer";
    const serviceName = db.services.find(s => s.id === booking.serviceId)?.name || "your service";
    const sessionLabel = `${booking.bookingDate} at ${booking.timeSlot}`;

    // Find the studio owner (STUDIO_ADMIN) for this studio
    const studioAdmin = db.users.find(u => u.studioId === booking.studioId && u.role === "STUDIO_ADMIN");

    // ── 24-hour reminder ──────────────────────────────────────────────────
    // Only send the 24h reminder if we are NOT already within the 2h window.
    // If the session is already < 2h away, we skip directly to the urgent 2h reminder
    // to avoid firing two notifications back-to-back for last-minute bookings.
    const within24h = msUntilSession <= 24 * 60 * 60 * 1000;
    const within2h  = msUntilSession <=  2 * 60 * 60 * 1000;

    if (within24h && !within2h && !booking.reminderSent24h) {
      // Customer: reminder that their session is tomorrow (or later today but > 2h away)
      notifyUser(
        booking.customerId,
        "📸 Session Reminder – Coming Up!",
        `Hi ${customerName}, your booking for "${serviceName}" at ${studioName} is scheduled for ${sessionLabel}. Please make sure you are ready and arrive on time. If you need to reschedule, contact the studio ASAP.`,
        "info",
        booking.studioId
      );

      // Studio owner: heads-up
      if (studioAdmin) {
        notifyUser(
          studioAdmin.id,
          "📅 Upcoming Session Reminder",
          `Reminder: ${customerName} has a confirmed booking for "${serviceName}" on ${sessionLabel}. Please ensure your studio is prepared.`,
          "info",
          booking.studioId
        );
      }

      booking.reminderSent24h = true;
      updated = true;
      logAction("SYSTEM", "system@caintaphotography.com", `24h session reminder sent for booking ${booking.id}`, "BOOKING", booking.id);
    }

    // ── 2-hour (urgent) reminder ──────────────────────────────────────────
    if (within2h && !booking.reminderSent2h) {
      // Compute a human-readable "time until session" string
      const minutesLeft = Math.round(msUntilSession / 60000);
      const timeUntilStr = minutesLeft < 60
        ? `${minutesLeft} minute${minutesLeft !== 1 ? "s" : ""}`
        : `${(msUntilSession / 3600000).toFixed(1)} hours`;
      const urgencyTitle = minutesLeft <= 30
        ? "🚨 Your Session is Starting Soon!"
        : "⏰ Your Session Starts in 2 Hours!";

      // Customer: urgent reminder with exact time remaining
      notifyUser(
        booking.customerId,
        urgencyTitle,
        `Hi ${customerName}, your photography session for "${serviceName}" at ${studioName} starts in ${timeUntilStr} (${booking.timeSlot}, ${booking.bookingDate}). Please head to the studio now to avoid delays. See you soon!`,
        "warning",
        booking.studioId
      );

      // Studio owner: final heads-up
      if (studioAdmin) {
        notifyUser(
          studioAdmin.id,
          urgencyTitle.replace("Your Session", `${customerName}'s Session`),
          `${customerName}'s "${serviceName}" session starts in ${timeUntilStr} (${booking.timeSlot}). Please be ready to welcome your client.`,
          "warning",
          booking.studioId
        );
      }

      // Also mark the 24h reminder as sent so it never fires after this
      booking.reminderSent24h = true;
      booking.reminderSent2h  = true;
      updated = true;
      logAction("SYSTEM", "system@caintaphotography.com", `2h session reminder sent for booking ${booking.id} (${timeUntilStr} remaining)`, "BOOKING", booking.id);
    }
  }

  if (updated) db.save();
}, 5 * 60 * 1000); // runs every 5 minutes

// ----------------------------------------------------
// AI CHATBOT (GEMINI PROXY)
// ----------------------------------------------------
app.post("/api/chatbot/message", async (req, res) => {
  // Extract base fields + new role-context fields sent by the frontend
  const {
    message,
    studioId,
    history,
    userId,
    userRole,      // "CUSTOMER" | "STUDIO_ADMIN" | "STUDIO_STAFF" | "SUPER_ADMIN" | undefined (guest)
    userStudioId,  // studioId that belongs to the logged-in STUDIO_ADMIN / STUDIO_STAFF
  } = req.body;

  if (!message) {
    return res.status(400).json({ success: false, message: "Query message is required." });
  }

  const apiKey = process.env.GEMINI_API_KEY?.trim();
  const isValidApiKey = apiKey &&
    apiKey !== "MY_GEMINI_API_KEY" &&
    (apiKey.startsWith("AIza") || apiKey.startsWith("AQ.")) &&
    apiKey.length >= 20;
  if (!isValidApiKey) {
    console.warn("[Chatbot] Rejecting Gemini request: GEMINI_API_KEY is not configured or has an invalid format.");
    return res.status(503).json({
      success: false,
      message: "The chatbot is temporarily unavailable. Please try again shortly."
    });
  }

  try {
    // ── 1. Resolve the studio context ─────────────────────────────────────
    // For staff / studio owners the relevant studio is their own studio,
    // unless the request also specifies a studioId (e.g. they're browsing a profile).
    const effectiveStudioId: string | undefined =
      studioId ||
      (userRole === "STUDIO_ADMIN" || userRole === "STUDIO_STAFF" ? userStudioId : undefined);

    // ── 2. Build studio knowledge block ───────────────────────────────────
    let studioContext = "";
    let faqsContext = "";

    // Global FAQs always included; studio-specific FAQs when a studio is known
    const relevantFAQs = db.faqs.filter(
      f => f.studioId === "GLOBAL" || (effectiveStudioId && f.studioId === effectiveStudioId)
    );
    faqsContext = relevantFAQs.map(f => `Q: ${f.question}\nA: ${f.answer}`).join("\n\n");

    if (effectiveStudioId) {
      const studio = db.studios.find(s => s.id === effectiveStudioId);
      if (studio) {
        const services = db.services.filter(s => s.studioId === effectiveStudioId && s.isActive);
        const packages = db.packages.filter(p => p.studioId === effectiveStudioId && p.isActive);

        studioContext = `
STUDIO PROFILE DETAILS:
Name: ${studio.name}
Description: ${studio.description}
Address: ${studio.address}
Location: ${studio.location}
Contact: ${studio.contactInfo}
Email: ${studio.email}
Business Hours: ${studio.businessHours}
Rating: ${studio.rating} (${studio.reviewCount} reviews)
Starting Price: ${studio.startingPrice} PHP
Printing Available: ${studio.printingAvailable ? "Yes" : "No"}

AVAILABLE SERVICES:
${services.map(s => `- ${s.name} (Base Price: ${s.basePrice} PHP, Duration: ${s.durationMinutes} mins) - Description: ${s.description}`).join("\n")}

AVAILABLE CUSTOMIZABLE PACKAGES:
${packages.map(p => `- ${p.name} (Price: ${p.price} PHP, Duration: ${p.durationMinutes} mins, Edited Photos: ${p.editedPhotosCount}, Prints: ${p.includedPrints}) - Description: ${p.description}`).join("\n")}
`;
      }
    } else {
      // No specific studio — show the full directory
      studioContext = `
ALL REGISTERED PHOTOGRAPHY STUDIOS IN CAINTA, RIZAL:
${db.studios.filter(s => s.isApproved).map(s => `- ${s.name} (Location: ${s.location}, Rating: ${s.rating}, Starting Price: ${s.startingPrice} PHP). Categories: ${s.categories.join(", ")}. ID: ${s.id}`).join("\n")}
`;
    }

    // ── 3. Build role-specific operational context ─────────────────────────
    let roleContext = "";
    let rolePersona = "";
    let roleTokens = "";

    if (userRole === "CUSTOMER" && userId) {
      // Pull this customer's bookings and print orders for personalised answers
      const myBookings = db.bookings
        .filter(b => b.customerId === userId)
        .slice(-10) // last 10 only to keep prompt size reasonable
        .map(b => {
          const studio = db.studios.find(s => s.id === b.studioId);
          return `- Booking ID: ${b.id} | Studio: ${studio?.name || b.studioId} | Date: ${b.appointmentDate} | Status: ${b.status} | Total: ${b.totalAmount} PHP | Payment: ${b.paymentStatus}`;
        });
      const myPrintOrders = db.printOrders
        .filter(o => o.customerId === userId)
        .slice(-5)
        .map(o => `- Order ID: ${o.id} | Status: ${o.status} | Total: ${o.totalAmount} PHP`);

      roleContext = `
CURRENT USER ROLE: Customer (logged in)
USER ID: ${userId}

MY RECENT BOOKINGS (last 10):
${myBookings.length ? myBookings.join("\n") : "No bookings yet."}

MY RECENT PRINT ORDERS (last 5):
${myPrintOrders.length ? myPrintOrders.join("\n") : "No print orders yet."}
`;
      rolePersona = `You are speaking with a registered customer of the platform. Address them warmly by their first name if it appears in the conversation. Help them track their bookings, understand payment status, find studios, explore packages, and place print orders.`;
      roleTokens = `
Customer-specific navigation:
- [go_page:customer-dashboard|My Dashboard] — their main dashboard
- [go_page:customer-dashboard-bookings|My Bookings] — booking history
- [go_page:customer-dashboard-prints|My Print Orders] — print order history
- [go_page:account-settings|Account Settings] — update profile
- [go_page:directory|Browse Studios] — find a new studio
`;

    } else if (userRole === "STUDIO_ADMIN" && userStudioId) {
      // Pull this studio's pending/recent bookings and payments
      const pendingBookings = db.bookings
        .filter(b => b.studioId === userStudioId && b.status === "pending")
        .slice(-10)
        .map(b => `- Booking ID: ${b.id} | Date: ${b.appointmentDate} | Customer: ${b.customerId} | Total: ${b.totalAmount} PHP`);
      const confirmedToday = db.bookings
        .filter(b => {
          const today = new Date().toISOString().slice(0, 10);
          return b.studioId === userStudioId && b.appointmentDate === today;
        })
        .map(b => `- Booking ID: ${b.id} | Time: ${b.appointmentTime || "TBD"} | Status: ${b.status} | Customer: ${b.customerId}`);
      const pendingPayments = db.payments
        .filter(p => p.studioId === userStudioId && p.status === "pending_review")
        .slice(-10)
        .map(p => `- Payment ID: ${p.id} | Booking: ${p.bookingId} | Amount: ${p.amount} PHP | Method: ${p.paymentChannel}`);
      const studio = db.studios.find(s => s.id === userStudioId);

      roleContext = `
CURRENT USER ROLE: Studio Owner / Admin
STUDIO: ${studio?.name || userStudioId} (ID: ${userStudioId})

PENDING BOOKINGS AWAITING CONFIRMATION (last 10):
${pendingBookings.length ? pendingBookings.join("\n") : "No pending bookings."}

TODAY'S BOOKINGS:
${confirmedToday.length ? confirmedToday.join("\n") : "No bookings today."}

PAYMENTS UNDER REVIEW (last 10):
${pendingPayments.length ? pendingPayments.join("\n") : "No pending payments."}
`;
      rolePersona = `You are speaking with the owner/admin of ${studio?.name || "the studio"}. Help them manage their studio operations: confirming bookings, reviewing payments, setting availability, updating services, and understanding their dashboard. Keep answers operationally focused.`;
      roleTokens = `
Studio owner navigation:
- [go_page:studio-dashboard|Studio Dashboard] — main studio management panel
- [go_page:account-settings|Account Settings] — update profile
`;

    } else if (userRole === "STUDIO_STAFF" && userStudioId) {
      const studio = db.studios.find(s => s.id === userStudioId);
      const todayStr = new Date().toISOString().slice(0, 10);
      const todayBookings = db.bookings
        .filter(b => b.studioId === userStudioId && b.appointmentDate === todayStr)
        .map(b => `- Booking ID: ${b.id} | Time: ${b.appointmentTime || "TBD"} | Status: ${b.status} | Customer: ${b.customerId}`);
      const upcomingBookings = db.bookings
        .filter(b => b.studioId === userStudioId && b.appointmentDate > todayStr && b.status !== "cancelled")
        .slice(0, 10)
        .map(b => `- Booking ID: ${b.id} | Date: ${b.appointmentDate} | Time: ${b.appointmentTime || "TBD"} | Status: ${b.status}`);

      roleContext = `
CURRENT USER ROLE: Studio Staff
STUDIO: ${studio?.name || userStudioId} (ID: ${userStudioId})

TODAY'S BOOKINGS (${todayStr}):
${todayBookings.length ? todayBookings.join("\n") : "No bookings today."}

UPCOMING BOOKINGS (next 10):
${upcomingBookings.length ? upcomingBookings.join("\n") : "No upcoming bookings."}
`;
      rolePersona = `You are speaking with a staff member of ${studio?.name || "the studio"}. Help them look up today's schedule, find booking details, understand the photo proofing workflow, manage print orders, and answer operational questions. You do NOT have access to payment financials or studio settings — direct those questions to the studio owner.`;
      roleTokens = `
Staff navigation:
- [go_page:studio-dashboard|Studio Dashboard] — studio operations panel
`;

    } else if (userRole === "SUPER_ADMIN") {
      // Platform-wide stats for the super admin
      const pendingStudios = db.studios.filter(s => s.status === "pending" || s.status === "under_review");
      const allBookings = db.bookings;
      const totalRevenue = db.payments
        .filter(p => p.status === "verified")
        .reduce((sum, p) => sum + (p.amount || 0), 0);

      roleContext = `
CURRENT USER ROLE: Super Administrator (full platform access)

PLATFORM OVERVIEW:
- Total Studios: ${db.studios.length} (${db.studios.filter(s => s.isApproved).length} approved, ${pendingStudios.length} pending/under review)
- Total Bookings: ${allBookings.length}
- Total Customers: ${db.customers?.length || "N/A"}
- Total Verified Revenue: ${totalRevenue.toLocaleString()} PHP

PENDING STUDIO APPROVALS:
${pendingStudios.length ? pendingStudios.map(s => `- ${s.name} (ID: ${s.id}) | Status: ${s.status} | Registered: ${s.createdAt?.slice(0, 10)}`).join("\n") : "No studios pending approval."}
`;
      rolePersona = `You are speaking with the Super Administrator of the Cainta Photography Studio MIS platform. Help them manage studio approvals, oversee platform bookings and revenue, manage user accounts, configure system settings, and understand platform health. You have full visibility into all platform data.`;
      roleTokens = `
Super admin navigation:
- [go_page:admin-dashboard|Admin Dashboard] — platform management panel
- [go_page:account-settings|Account Settings] — admin profile
`;

    } else {
      // Guest (not logged in)
      roleContext = `CURRENT USER ROLE: Guest (not logged in)`;
      rolePersona = `You are speaking with a guest visitor who has not yet created an account. Help them discover studios, understand pricing and packages, learn how the booking process works, and encourage them to sign up or log in to get started.`;
      roleTokens = `
Guest navigation:
- [go_page:directory|Browse Studios] — explore all studios
- [go_page:login|Log In / Sign Up] — create an account or log in
- [go_page:landing|Home] — back to landing page
`;
    }

    // ── 4. Shared token reference (booking/studio actions, always available) ──
    const sharedTokens = `
Booking & studio exploration — ONLY use when you have a real studio ID from the database:
- [book_now:STUDIO_ID] — opens the booking wizard for that studio
- [view_services:STUDIO_ID] — shows the studio's services list
- [view_packages:STUDIO_ID] — shows the studio's packages list
- [go_studio:STUDIO_ID] — navigates to a studio's profile page
IMPORTANT: NEVER use "GLOBAL" as a STUDIO_ID. Use [go_page:directory] when no specific studio ID is known.

External URLs (blue link buttons — only when a real verified URL exists in context):
- [external_link:https://example.com|Link Label] — opens in a new tab

STUDIO IDs IN CONTEXT (copy-paste the exact ID — never guess or invent one):
${effectiveStudioId ? `Active studio context ID: ${effectiveStudioId}` : `No specific studio selected. Refer to the ALL REGISTERED STUDIOS list. Do NOT use "GLOBAL" as an ID.`}
`;

    // ── 5. Assemble the full system instruction ────────────────────────────
    const systemInstruction = `
You are the official AI assistant for the Cainta Photography Studio MIS platform.

ROLE CONTEXT:
${roleContext}

YOUR PERSONA FOR THIS CONVERSATION:
${rolePersona}

CRITICAL SECURITY AND SAFETY CONSTRAINTS:
1. You must NOT invent or make up prices, schedules, booking confirmations, payment statuses, or studio policies.
2. If the user asks something whose answer is not found in the database context below, respond with:
"I don't have enough information to answer that accurately. Please check directly in the dashboard or contact the studio."
Do NOT fill in gaps with assumptions. This is an absolute security boundary.
3. Prioritize the provided database context over any generic AI knowledge.
4. Keep replies warm, concise, and conversational. Use plain text only — no asterisks, markdown headings, bullet symbols, numbered lists, backticks, or decorative formatting. Write in short natural paragraphs.
5. When directing the user to act or navigate, embed special link tokens naturally inside your sentence. The frontend renders them as clickable buttons. Never place a token on its own orphaned line — weave it into the sentence.
6. Only suggest actions and pages that are appropriate for the user's role. Do NOT suggest customer booking pages to a studio admin, and do NOT suggest admin dashboard pages to a guest or customer.

AVAILABLE LINK TOKENS FOR THIS ROLE:
${roleTokens}
${sharedTokens}

CURRENT DATABASE / STUDIO CONTEXT:
${studioContext}

FAQs & KNOWLEDGE BASE:
${faqsContext}
`;

    // ── 6. Call Gemini ─────────────────────────────────────────────────────
    const contents = [
      ...(Array.isArray(history) ? history : [])
        .filter(item => item && (item.role === "user" || item.role === "model") && typeof item.text === "string")
        .map(item => ({ role: item.role, parts: [{ text: item.text }] })),
      { role: "user", parts: [{ text: String(message) }] },
    ];
    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${encodeURIComponent(apiKey)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemInstruction }] },
          contents,
          generationConfig: { temperature: 0.3 },
        }),
      },
    );
    const responseData = await geminiResponse.json() as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      error?: { message?: string };
    };
    if (!geminiResponse.ok) {
      throw new Error(responseData.error?.message || `Gemini API request failed with HTTP ${geminiResponse.status}.`);
    }
    const responseText = responseData.candidates?.[0]?.content?.parts
      ?.map(part => part.text || "")
      .join("")
      .trim();
    if (!responseText) {
      throw new Error("Gemini API returned an empty response.");
    }

    rememberFaqSuggestion(message, responseText, effectiveStudioId || "GLOBAL");
    res.json({ success: true, text: responseText });

  } catch (error: any) {
    console.error("Gemini Chatbot API error:", error);
    res.status(503).json({
      success: false,
      message: "The chatbot is temporarily unavailable. Please try again shortly."
    });
  }
});

// Helper to retrieve local LAN IP address
function getLocalNetworkIp(): string {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] || []) {
      if (net.family === "IPv4" && !net.internal && !net.address.startsWith("169.254")) {
        return net.address;
      }
    }
  }
  return "127.0.0.1";
}


// ============================================================
// GCASH QR PAYMENT SYSTEM — API ENDPOINTS
// ============================================================

// ── Helpers ─────────────────────────────────────────────────────────────────
const GCASH_QR_LIFETIME_MS = 30 * 60 * 1000;

// ── SSE: real-time payment confirmation stream ───────────────────────────────
// Customers connect here and receive a push when their QR payment lands.
app.get("/api/payments/gcash/stream", (req, res) => {
  const user = requireAuthenticatedUser(req, res);
  if (!user) return;

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no"); // disable nginx buffering
  res.flushHeaders();

  const userId = user.id;
  if (!sseClients.has(userId)) sseClients.set(userId, new Set());
  sseClients.get(userId)!.add(res);

  // Send initial ping
  res.write(`data: ${JSON.stringify({ type: "connected", userId })}\n\n`);

  // Heartbeat every 25s to prevent proxy timeouts
  const heartbeat = setInterval(() => {
    try { res.write(": ping\n\n"); } catch { clearInterval(heartbeat); }
  }, 25000);

  req.on("close", () => {
    clearInterval(heartbeat);
    sseClients.get(userId)?.delete(res);
    if (sseClients.get(userId)?.size === 0) sseClients.delete(userId);
  });
});

// ── POST /api/payments/gcash/create-qr ──────────────────────────────────────
// Generates direct Studio Owner GCash QR code based on studio owner's registered GCash info and exact price
app.post("/api/payments/gcash/create-qr", async (req, res) => {
  const user = requireAuthenticatedUser(req, res);
  if (!user) return;

  const { bookingId, studioId, amount, paymentType, description } = req.body;

  let targetStudioId = studioId;
  let booking: Booking | undefined = undefined;

  if (bookingId) {
    booking = db.bookings.find(b => b.id === bookingId);
    if (!booking) {
      return res.status(404).json({ success: false, message: "Booking not found." });
    }
    targetStudioId = booking.studioId;
    if (user.role === UserRole.CUSTOMER && booking.customerId !== user.id) {
      return res.status(403).json({ success: false, message: "Not your booking." });
    }
  }

  if (!targetStudioId) {
    return res.status(400).json({ success: false, message: "studioId is required." });
  }

  const studio = db.studios.find(s => s.id === targetStudioId);
  if (!studio) {
    return res.status(404).json({ success: false, message: "Studio not found." });
  }

  // Exact Amount Determination and Validation
  let amountNum = Number(amount);
  if (booking) {
    syncBookingPaymentTotals(booking);
    if (paymentType === "Full Payment") {
      amountNum = booking.totalAmount;
    } else if (paymentType === "Downpayment") {
      amountNum = booking.downPaymentAmount || Math.round(booking.totalAmount * 0.3 * 100) / 100;
    } else if (paymentType === "Balance") {
      amountNum = booking.remainingBalance;
    }
  }

  if (!Number.isFinite(amountNum) || amountNum < 1) {
    return res.status(400).json({ success: false, message: "Invalid payment amount." });
  }

  const gcashAccountName = studio.gcashAccountName || studio.name;
  const gcashNumber = studio.gcashNumber || String(studio.contactInfo || "09170000000");
  const cleanPhone = gcashNumber.replace(/[^0-9]/g, "");

  // Use the studio owner's uploaded GCash QR image (if any).
  // We intentionally do NOT generate a fake QR from a custom URL — no such
  // GCash endpoint exists, and scanning a fabricated URL always results in a
  // "QR code not valid" error in the GCash app.
  // When qrCodeData is empty the frontend falls back to a manual-transfer UI
  // that shows the studio owner's GCash number and name so the customer can
  // send directly via GCash's "Send Money" feature instead.
  const qrCodeData = studio.gcashQrCode || "";

  const sessionId = `GQR-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
  const expiresAt = new Date(Date.now() + GCASH_QR_LIFETIME_MS).toISOString();

  const newSession: any = {
    id: sessionId,
    bookingId: bookingId || null,
    studioId: studio.id,
    customerId: user.id,
    amount: amountNum,
    paymentType: paymentType || "Downpayment",
    qrCodeData,
    status: "pending",
    expiresAt,
    studioOwnerName: gcashAccountName,
    studioOwnerNumber: gcashNumber,
    createdAt: new Date().toISOString()
  };

  if (!(db.data as any).gcashQRSessions) {
    (db.data as any).gcashQRSessions = [];
  }
  (db.data as any).gcashQRSessions.push(newSession);

  try {
    await db.pool.execute(
      `INSERT INTO gcash_qr_sessions
        (id, booking_id, studio_id, customer_id, gateway,
         qr_code_data, amount, payment_type, status, expires_at)
       VALUES (?, ?, ?, ?, 'direct_gcash', ?, ?, ?, 'pending', ?)`,
      [
        sessionId, bookingId || null, studio.id, user.id,
        qrCodeData || null, amountNum, paymentType || "Downpayment", expiresAt
      ]
    );
  } catch (err: any) {
    // Non-fatal if MySQL is offline
  }

  db.save();

  return res.json({
    success: true,
    session: {
      id: sessionId,
      bookingId: bookingId || null,
      studioId: studio.id,
      amount: amountNum,
      paymentType: paymentType || "Downpayment",
      qrCodeData,
      status: "pending",
      expiresAt,
      createdAt: newSession.createdAt
    },
    studioOwner: {
      studioId: studio.id,
      studioName: studio.name,
      gcashAccountName,
      gcashNumber
    },
    exactAmount: amountNum
  });
});

// ── POST /api/payments/gcash/submit-proof ──────────────────────────────────
// Allows customer to attach receipt screenshot & reference number after QR payment
app.post("/api/payments/gcash/submit-proof", async (req, res) => {
  const user = requireAuthenticatedUser(req, res);
  if (!user) return;

  const { sessionId, referenceNumber, proofOfPayment } = req.body;
  if (!sessionId) {
    return res.status(400).json({ success: false, message: "sessionId is required." });
  }

  let session = (db.data as any).gcashQRSessions?.find((s: any) => s.id === sessionId);
  if (!session) {
    const [rows] = await db.pool.execute(
      "SELECT * FROM gcash_qr_sessions WHERE id = ? LIMIT 1",
      [sessionId]
    ) as any;
    if (rows && rows.length > 0) {
      session = rows[0];
    }
  }

  if (!session) {
    return res.status(404).json({ success: false, message: "GCash session not found." });
  }

  const bookingId = session.bookingId || session.booking_id;
  const studioId = session.studioId || session.studio_id;
  const amount = Number(session.amount);
  const paymentType = session.paymentType || session.payment_type || "Downpayment";

  let paymentId = session.paymentId || session.payment_id;
  if (!paymentId) {
    paymentId = generateId("PAY");
  }

  let proofUrl = proofOfPayment;
  if (proofOfPayment && proofOfPayment.startsWith("data:")) {
    const paymentMedia = await saveProtectedMedia(user.id, "payment", paymentId, "PAYMENT_PROOF", proofOfPayment, "payment-proof");
    if (paymentMedia) {
      proofUrl = `/api/media/${paymentMedia.mediaId}`;
    }
  }

  // Update in-memory collections
  const existingPay = db.payments.find(p => p.id === paymentId || (bookingId && p.bookingId === bookingId && p.paymentType === paymentType));
  if (existingPay) {
    if (referenceNumber) existingPay.referenceNumber = referenceNumber;
    if (proofUrl) existingPay.proofOfPayment = proofUrl;
    existingPay.paymentStatus = "Pending Verification";
    (existingPay as any).status = "Pending Verification";
  } else {
    const newPay: Payment = {
      id: paymentId,
      bookingId: bookingId || "",
      studioId: studioId || "",
      customerId: user.id,
      amount,
      paymentMethod: "GCash",
      referenceNumber: referenceNumber || "",
      proofOfPayment: proofUrl || "",
      paymentStatus: "Pending Verification",
      paymentType: paymentType as any,
      paymentDate: new Date().toISOString(),
      createdAt: new Date().toISOString()
    };
    (newPay as any).status = "Pending Verification";
    db.payments.push(newPay);
  }

  session.paymentId = paymentId;

  if (bookingId) {
    const b = db.bookings.find(x => x.id === bookingId);
    if (b) {
      (b as any).pendingPaymentAmount = amount;
      if (!["Paid", "Partially Paid"].includes(b.paymentStatus)) {
        b.paymentStatus = "Pending Verification";
      }
      if (b.status === "Pending") {
        b.status = "Awaiting Payment";
      }
    }
  }

  db.save();

  // Notify studio admin
  const studioAdmin = db.users.find(u => u.studioId === studioId && u.role === UserRole.STUDIO_ADMIN);
  const studioObj = db.studios.find(s => s.id === studioId);
  const studioName = studioObj?.name || "the studio";
  if (studioAdmin) {
    notifyUser(
      studioAdmin.id,
      "Direct GCash Payment Submitted",
      `Customer submitted direct GCash payment proof of ₱${amount.toLocaleString()} (Ref: ${referenceNumber || "N/A"}) for Booking ${bookingId || "N/A"}. Please verify in your dashboard.`,
      "warning",
      studioId
    );
  }

  return res.json({
    success: true,
    message: "Payment receipt submitted successfully for studio review.",
    paymentId
  });
});

// ── GET /api/payments/gcash/session/:sessionId ───────────────────────────────
app.get("/api/payments/gcash/session/:sessionId", async (req, res) => {
  const user = requireAuthenticatedUser(req, res);
  if (!user) return;

  const { sessionId } = req.params;

  let session = (db.data as any).gcashQRSessions?.find((s: any) => s.id === sessionId);
  if (!session) {
    const [rows] = await db.pool.execute(
      "SELECT * FROM gcash_qr_sessions WHERE id = ? LIMIT 1",
      [sessionId]
    ) as any;
    if (rows && rows.length > 0) {
      session = rows[0];
    }
  }

  if (!session) {
    return res.status(404).json({ success: false, message: "Session not found." });
  }

  const customerId = session.customerId || session.customer_id;
  if (user.role === "CUSTOMER" && customerId !== user.id) {
    return res.status(403).json({ success: false, message: "Access denied." });
  }

  return res.json({ success: true, session });
});

// ── POST /api/studios/:studioId/payment-credentials ─────────────────────────
// Studio admin saves their payment details (GCash, Maya) & QR Code images.
// Bank Transfer is intentionally unsupported — any bank* fields sent by an old
// client are ignored so a bank payment method can never be re-enabled.
app.post("/api/studios/:studioId/payment-credentials", async (req, res) => {
  const user = requireStudioAccess(req, res, req.params.studioId);
  if (!user) return;

  const { 
    gcashMerchantName, gcashNumber, gcashQrCode,
    mayaMerchantName, mayaNumber, mayaQrCode
  } = req.body;
  const { studioId } = req.params;

  const studio = db.studios.find(s => s.id === studioId);
  if (studio) {
    if (gcashMerchantName !== undefined) studio.gcashAccountName = String(gcashMerchantName).trim();
    if (gcashNumber !== undefined) studio.gcashNumber = String(gcashNumber).trim();
    if (gcashQrCode !== undefined) {
      if (gcashQrCode && gcashQrCode.startsWith("data:image")) {
        const media = await saveProtectedMedia(user.id, "studio-payment", studioId, "STUDIO_QR_CODE", gcashQrCode, "gcash-qr-code");
        studio.gcashQrCode = media ? `/api/media/${media.mediaId}` : gcashQrCode;
      } else {
        studio.gcashQrCode = gcashQrCode;
      }
    }

    if (mayaMerchantName !== undefined) studio.mayaAccountName = String(mayaMerchantName).trim();
    if (mayaNumber !== undefined) studio.mayaNumber = String(mayaNumber).trim();
    if (mayaQrCode !== undefined) {
      if (mayaQrCode && mayaQrCode.startsWith("data:image")) {
        const media = await saveProtectedMedia(user.id, "studio-payment", studioId, "STUDIO_QR_CODE", mayaQrCode, "maya-qr-code");
        studio.mayaQrCode = media ? `/api/media/${media.mediaId}` : mayaQrCode;
      } else {
        studio.mayaQrCode = mayaQrCode;
      }
    }

    // Bank Transfer details are no longer accepted, stored, or returned.
    // (Existing studio.bank* values in local data are ignored from here on.)

    db.save();
  }

  const credId = generateId("CRED");

  try {
    await db.pool.execute(
      `INSERT INTO studio_payment_credentials
         (id, studio_id, gateway, gcash_merchant_name, gcash_number)
       VALUES (?, ?, 'direct_gcash', ?, ?)
       ON DUPLICATE KEY UPDATE
         gcash_merchant_name = VALUES(gcash_merchant_name),
         gcash_number = VALUES(gcash_number),
         updated_at = NOW()`,
      [credId, studioId, gcashMerchantName || null, gcashNumber || null]
    );
  } catch (err: any) {
    // Non-fatal if MySQL is offline
  }

  return res.json({ 
    success: true, 
    message: "Studio payment methods saved successfully.",
    credentials: {
      studioId,
      gcashMerchantName: studio?.gcashAccountName || gcashMerchantName,
      gcashNumber: studio?.gcashNumber || gcashNumber,
      gcashQrCode: studio?.gcashQrCode || gcashQrCode,
      mayaMerchantName: studio?.mayaAccountName || mayaMerchantName,
      mayaNumber: studio?.mayaNumber || mayaNumber,
      mayaQrCode: studio?.mayaQrCode || mayaQrCode
    }
  });
});

// ── GET /api/studios/:studioId/payment-credentials ──────────────────────────
app.get("/api/studios/:studioId/payment-credentials", async (req, res) => {
  const user = requireStudioAccess(req, res, req.params.studioId);
  if (!user) return;

  const studio = db.studios.find(s => s.id === req.params.studioId);
  const creds = {
    studio_id: req.params.studioId,
    gcash_merchant_name: studio?.gcashAccountName || studio?.name || "",
    gcash_number: studio?.gcashNumber || String(studio?.contactInfo || ""),
    gcash_qr_code: studio?.gcashQrCode || null,
    maya_merchant_name: studio?.mayaAccountName || studio?.name || "",
    maya_number: studio?.mayaNumber || "",
    maya_qr_code: studio?.mayaQrCode || null,
    is_live_mode: true,
    is_enabled: true
  };

  return res.json({ success: true, credentials: creds });
});

// ── GET /api/studios/:studioId/payment-methods (Public/Customer access) ───────
app.get("/api/studios/:studioId/payment-methods", (req, res) => {
  const studio = db.studios.find(s => s.id === req.params.studioId);
  if (!studio) {
    return res.status(404).json({ success: false, message: "Studio not found." });
  }

  // GCash and Maya only — bank transfer is no longer an offered payment method.
  return res.json({
    success: true,
    studioId: studio.id,
    studioName: studio.name,
    gcashAccountName: studio.gcashAccountName || studio.name,
    gcashNumber: studio.gcashNumber || String(studio.contactInfo || "09170000000"),
    gcashQrCode: studio.gcashQrCode || null,
    mayaAccountName: studio.mayaAccountName || studio.name,
    mayaNumber: studio.mayaNumber || "",
    mayaQrCode: studio.mayaQrCode || null
  });
});

app.get("/api/studios/:studioId/gcash", (req, res) => {
  const studio = db.studios.find(s => s.id === req.params.studioId);
  if (!studio) {
    return res.status(404).json({ success: false, message: "Studio not found." });
  }

  // GCash and Maya only — bank transfer is no longer an offered payment method.
  return res.json({
    success: true,
    studioId: studio.id,
    studioName: studio.name,
    gcashAccountName: studio.gcashAccountName || studio.name,
    gcashNumber: studio.gcashNumber || String(studio.contactInfo || "09170000000"),
    gcashQrCode: studio.gcashQrCode || null,
    mayaAccountName: studio.mayaAccountName || studio.name,
    mayaNumber: studio.mayaNumber || "",
    mayaQrCode: studio.mayaQrCode || null
  });
});

// LAN Network Information endpoint
app.get("/api/system/network-info", (req, res) => {
  if (!requireRole(req, res, UserRole.SUPER_ADMIN)) return;
  const lanIp = getLocalNetworkIp();
  res.json({
    success: true,
    port: PORT,
    localUrl: `http://localhost:${PORT}`,
    networkUrl: `http://${lanIp}:${PORT}`,
    ipAddress: lanIp
  });
});

// ----------------------------------------------------
// VITE MIDDLEWARE SETUP & STATIC RUN
// ----------------------------------------------------

async function startServer() {
  try {
    await db.waitUntilReady();
  } catch (dbErr) {
    console.warn("[Server] DB ready wait notice:", dbErr);
  }
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  const lanIp = getLocalNetworkIp();

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`\n======================================================`);
    console.log(`📸 CAINTA PHOTOGRAPHY STUDIO MIS (Localhost MIS Server)`);
    console.log(`➜ Local:   http://localhost:${PORT}`);
    console.log(`➜ Network: http://${lanIp}:${PORT}`);
    console.log(`  (Running exclusively in local environment)`);
    console.log(`======================================================\n`);
  });
}

export { app };

// Always start the server for standard node/tsx execution
startServer();

