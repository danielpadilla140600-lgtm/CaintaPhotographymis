import mysql from "mysql2/promise";
import dotenv from "dotenv";

dotenv.config();

import { 
  User, Customer, Studio, StudioCategory, StudioService, StudioPackage, 
  PackageAddon, Booking, Payment, PrintProduct, PrintOrder, 
  Review, ChatbotFAQ, AuditLog, Notification, FavoriteStudio, PhotoProofingGallery, UserRole, CMSSetting,
  CustomPage, SystemSettings, MediaFile, StudioAvailability, AvailabilityBlackout
} from "./types.ts";

export interface DatabaseSchema {
  users: User[];
  customers: Customer[];  // Separate table for customer accounts
  studios: Studio[];
  categories: StudioCategory[];
  services: StudioService[];
  packages: StudioPackage[];
  addons: PackageAddon[];
  bookings: Booking[];
  payments: Payment[];
  printProducts: PrintProduct[];
  printOrders: PrintOrder[];
  reviews: Review[];
  faqs: ChatbotFAQ[];
  auditLogs: AuditLog[];
  notifications: Notification[];
  favorites: FavoriteStudio[];
  photoProofings: PhotoProofingGallery[];
  cmsSettings: CMSSetting[];
  customPages: CustomPage[];
  systemSettings: SystemSettings;
  mediaFiles: MediaFile[];
  availabilities: StudioAvailability[];
  blackouts: AvailabilityBlackout[];
}

const defaultSchema: DatabaseSchema = {
  users: [],
  customers: [],  // Customers registered through the app go here
  studios: [],
  categories: [],
  services: [],
  packages: [],
  addons: [],
  bookings: [],
  payments: [],
  printProducts: [],
  printOrders: [],
  reviews: [],
  faqs: [],
  auditLogs: [],
  notifications: [],
  favorites: [],
  photoProofings: [],
  cmsSettings: [],
  customPages: [],
  systemSettings: {
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
  },
  mediaFiles: [],
  availabilities: [],
  blackouts: []
};

// ====================================================================
// MAPPING UTILITIES (MYSQL ROWS <-> TYPESCRIPT INTERFACES)
// ====================================================================

function toDbAvailability(a: StudioAvailability): any {
  return {
    id: a.id,
    studio_id: a.studioId,
    day_of_week: Number(a.dayOfWeek),
    opening_time: a.openingTime,
    closing_time: a.closingTime,
    is_available: a.isAvailable ? 1 : 0,
    slot_duration_minutes: Number(a.slotDurationMinutes) || 60,
    created_at: a.createdAt ? new Date(a.createdAt) : new Date(),
    updated_at: a.updatedAt ? new Date(a.updatedAt) : new Date()
  };
}

function fromDbAvailability(row: any): StudioAvailability {
  return {
    id: row.id,
    studioId: row.studio_id,
    dayOfWeek: Number(row.day_of_week),
    openingTime: row.opening_time,
    closingTime: row.closing_time,
    isAvailable: !!row.is_available,
    slotDurationMinutes: Number(row.slot_duration_minutes) || 60,
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : (row.created_at || new Date().toISOString()),
    updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : (row.updated_at || new Date().toISOString())
  };
}

function toDbBlackout(b: AvailabilityBlackout): any {
  return {
    id: b.id,
    studio_id: b.studioId,
    blackout_date: b.blackoutDate,
    start_time: b.startTime,
    end_time: b.endTime,
    reason: b.reason || "Studio closure",
    is_recurring: b.isRecurring ? 1 : 0,
    recurrence_rule: b.recurrenceRule || null,
    created_at: b.createdAt ? new Date(b.createdAt) : new Date()
  };
}

function fromDbBlackout(row: any): AvailabilityBlackout {
  return {
    id: row.id,
    studioId: row.studio_id,
    blackoutDate: row.blackout_date,
    startTime: row.start_time,
    endTime: row.end_time,
    reason: row.reason || "Studio closure",
    isRecurring: !!row.is_recurring,
    recurrenceRule: row.recurrence_rule || undefined,
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : (row.created_at || new Date().toISOString())
  };
}

function toDbUser(u: User): any {
  return {
    id: u.id,
    email: u.email,
    password_hash: u.passwordHash,
    full_name: u.fullName,
    role: u.role,
    studio_id: u.studioId || null,
    contact_number: u.contactNumber || null,
    address: u.address || null,
    created_at: u.createdAt ? new Date(u.createdAt) : new Date()
  };
}

function fromDbUser(row: any): User {
  return {
    id: row.id,
    email: row.email,
    passwordHash: row.password_hash,
    fullName: row.full_name,
    role: row.role as UserRole,
    studioId: row.studio_id || undefined,
    contactNumber: row.contact_number || undefined,
    address: row.address || undefined,
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : (row.created_at || new Date().toISOString())
  };
}

// Customer mapper functions (separate customers table)
function toDbCustomer(c: Customer): any {
  return {
    id: c.id,
    email: c.email,
    password_hash: c.passwordHash,
    full_name: c.fullName,
    contact_number: c.contactNumber || null,
    address: c.address || null,
    is_archived: c.isArchived ? 1 : 0,
    archived_at: c.archivedAt ? new Date(c.archivedAt) : null,
    archived_by: c.archivedBy || null,
    created_at: c.createdAt ? new Date(c.createdAt) : new Date()
  };
}

function fromDbCustomer(row: any): Customer {
  return {
    id: row.id,
    email: row.email,
    passwordHash: row.password_hash,
    fullName: row.full_name,
    role: "CUSTOMER" as const,
    contactNumber: row.contact_number || undefined,
    address: row.address || undefined,
    isArchived: !!row.is_archived,
    archivedAt: row.archived_at instanceof Date ? row.archived_at.toISOString() : (row.archived_at || undefined),
    archivedBy: row.archived_by || undefined,
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : (row.created_at || new Date().toISOString())
  };
}

function toDbStudio(s: Studio): any {
  const blockedDates = Array.isArray(s.blockedDates) ? s.blockedDates.filter(Boolean) : [];
  const categories = Array.isArray(s.categories) ? s.categories.filter(Boolean) : [];

  return {
    id: s.id,
    name: s.name,
    owner_id: s.ownerId,
    logo: s.logo,
    cover_image: s.coverImage,
    location: s.location,
    rating: Number(s.rating) || 0,
    review_count: Number(s.reviewCount) || 0,
    starting_price: Number(s.startingPrice) || 0,
    blocked_dates: blockedDates.join(","),
    categories: categories.join(","),
    description: s.description || "",
    address: s.address || "",
    contact_info: s.contactInfo || "",
    email: s.email || "",
    business_hours: s.businessHours || "09:00 AM - 06:00 PM",
    is_approved: s.isApproved ? 1 : 0,
    status: s.status || "pending",
    printing_available: s.printingAvailable ? 1 : 0,
    latitude: s.latitude !== undefined && s.latitude !== null ? Number(s.latitude) : null,
    longitude: s.longitude !== undefined && s.longitude !== null ? Number(s.longitude) : null,
    business_permit: s.businessPermit || null,
    valid_id: s.validId || null,
    other_docs: s.otherDocs || null,
    registered_by_admin: s.registeredByAdmin ? 1 : 0,
    gcash_number: s.gcashNumber || null,
    gcash_account_name: s.gcashAccountName || null,
    gcash_qr_code: s.gcashQrCode || null,
    // Maya (PayMaya) payout details. These columns must exist in MySQL too,
    // otherwise the uploaded Maya QR image disappears on the next reload.
    maya_number: s.mayaNumber || null,
    maya_account_name: s.mayaAccountName || null,
    maya_qr_code: s.mayaQrCode || null,
    facebook_url: s.facebookUrl || null,
    instagram_url: s.instagramUrl || null,
    tiktok_url: s.tiktokUrl || null,
    other_social_url: s.otherSocialUrl || null,
    website_url: s.websiteUrl || null,
    created_at: s.createdAt ? new Date(s.createdAt) : new Date()
  };
}

function fromDbStudio(row: any): Studio {
  const blockedDates = row.blocked_dates
    ? (typeof row.blocked_dates === "string" ? row.blocked_dates.split(",").map((v: string) => v.trim()).filter(Boolean) : row.blocked_dates)
    : [];
  const categories = row.categories
    ? (typeof row.categories === "string" ? row.categories.split(",").map((v: string) => v.trim()).filter(Boolean) : row.categories)
    : [];

  return {
    id: row.id,
    name: row.name,
    ownerId: row.owner_id,
    logo: row.logo,
    coverImage: row.cover_image,
    location: row.location,
    rating: Number(row.rating) || 0,
    reviewCount: Number(row.review_count) || 0,
    startingPrice: Number(row.starting_price) || 0,
    blockedDates,
    categories,
    description: row.description || "",
    address: row.address || "",
    contactInfo: row.contact_info || "",
    email: row.email || "",
    businessHours: row.business_hours || "09:00 AM - 06:00 PM",
    isApproved: !!row.is_approved,
    status: row.status || "pending",
    printingAvailable: !!row.printing_available,
    latitude: row.latitude !== null && row.latitude !== undefined ? Number(row.latitude) : undefined,
    longitude: row.longitude !== null && row.longitude !== undefined ? Number(row.longitude) : undefined,
    businessPermit: row.business_permit || undefined,
    validId: row.valid_id || undefined,
    otherDocs: row.other_docs || undefined,
    registeredByAdmin: !!row.registered_by_admin,
    gcashNumber: row.gcash_number || row.gcashNumber || undefined,
    gcashAccountName: row.gcash_account_name || row.gcashAccountName || undefined,
    gcashQrCode: row.gcash_qr_code || row.gcashQrCode || undefined,
    mayaNumber: row.maya_number || row.mayaNumber || undefined,
    mayaAccountName: row.maya_account_name || row.mayaAccountName || undefined,
    mayaQrCode: row.maya_qr_code || row.mayaQrCode || undefined,
    facebookUrl: row.facebook_url || row.facebookUrl || undefined,
    instagramUrl: row.instagram_url || row.instagramUrl || undefined,
    tiktokUrl: row.tiktok_url || row.tiktokUrl || undefined,
    otherSocialUrl: row.other_social_url || row.otherSocialUrl || undefined,
    websiteUrl: row.website_url || row.websiteUrl || undefined,
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : (row.created_at || new Date().toISOString())
  };
}

function toDbCategory(c: StudioCategory): any {
  return {
    id: c.id,
    name: c.name,
    description: c.description || "",
    created_at: c.createdAt ? new Date(c.createdAt) : new Date()
  };
}

function fromDbCategory(row: any): StudioCategory {
  return {
    id: row.id,
    name: row.name,
    description: row.description || "",
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : (row.created_at || new Date().toISOString())
  };
}

function toDbService(s: StudioService): any {
  const serviceImages = Array.isArray(s.images) && s.images.length > 0 ? s.images : (s.image ? [s.image] : []);
  return {
    id: s.id,
    studio_id: s.studioId,
    name: s.name,
    description: s.description || "",
    category: s.category || "General",
    base_price: Number(s.basePrice) || 0,
    duration_minutes: Number(s.durationMinutes) || 0,
    image: serviceImages.length > 0 ? JSON.stringify(serviceImages) : null,
    is_active: s.isActive ? 1 : 0,
    available_days: Array.isArray(s.availableDays) ? s.availableDays.join(",") : (s.availableDays || ""),
    available_slots: Array.isArray(s.availableSlots) ? s.availableSlots.join(",") : (s.availableSlots || ""),
    requirements: Array.isArray(s.requirements) ? s.requirements.join(",") : (s.requirements || ""),
    created_at: s.createdAt ? new Date(s.createdAt) : new Date()
  };
}

function fromDbService(row: any): StudioService {
  let serviceImages: string[] = [];
  if (typeof row.image === "string" && row.image.startsWith("[")) {
    try {
      const parsedImages = JSON.parse(row.image);
      if (Array.isArray(parsedImages)) serviceImages = parsedImages.filter((image): image is string => typeof image === "string");
    } catch {
      serviceImages = [];
    }
  }
  if (serviceImages.length === 0 && row.image) serviceImages = [row.image];
  return {
    id: row.id,
    studioId: row.studio_id,
    name: row.name,
    description: row.description || "",
    category: row.category || "General",
    basePrice: Number(row.base_price) || 0,
    durationMinutes: Number(row.duration_minutes) || 0,
    image: serviceImages[0] || undefined,
    images: serviceImages,
    isActive: !!row.is_active,
    availableDays: row.available_days ? (typeof row.available_days === "string" ? row.available_days.split(",") : row.available_days) : [],
    availableSlots: row.available_slots ? (typeof row.available_slots === "string" ? row.available_slots.split(",") : row.available_slots) : [],
    requirements: row.requirements ? (typeof row.requirements === "string" ? row.requirements.split(",") : row.requirements) : [],
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : (row.created_at || new Date().toISOString())
  };
}

function toDbPackage(p: StudioPackage): any {
  return {
    id: p.id,
    studio_id: p.studioId,
    name: p.name,
    description: p.description || "",
    price: Number(p.price) || 0,
    duration_minutes: Number(p.durationMinutes) || 0,
    edited_photos_count: Number(p.editedPhotosCount) || 0,
    included_prints: p.includedPrints || "",
    photographer_count: Number(p.photographerCount) || 1,
    included_services: Array.isArray(p.includedServices) ? p.includedServices.join(",") : (p.includedServices || null),
    terms_and_conditions: p.termsAndConditions || "",
    image: p.image || null,
    is_active: p.isActive ? 1 : 0,
    created_at: p.createdAt ? new Date(p.createdAt) : new Date()
  };
}

function fromDbPackage(row: any): StudioPackage {
  return {
    id: row.id,
    studioId: row.studio_id,
    name: row.name,
    description: row.description || "",
    price: Number(row.price) || 0,
    durationMinutes: Number(row.duration_minutes) || 0,
    editedPhotosCount: Number(row.edited_photos_count) || 0,
    includedPrints: row.included_prints || "",
    photographerCount: Number(row.photographer_count) || 1,
    includedServices: row.included_services ? (typeof row.included_services === "string" ? row.included_services.split(",") : row.included_services) : [],
    termsAndConditions: row.terms_and_conditions || "",
    image: row.image || undefined,
    isActive: !!row.is_active,
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : (row.created_at || new Date().toISOString())
  };
}

function toDbAddon(a: PackageAddon): any {
  return {
    id: a.id,
    studio_id: a.studioId,
    name: a.name,
    price: Number(a.price) || 0,
    description: a.description || "",
    image: a.image || null,
    created_at: a.createdAt ? new Date(a.createdAt) : new Date()
  };
}

function fromDbAddon(row: any): PackageAddon {
  return {
    id: row.id,
    studioId: row.studio_id,
    name: row.name,
    price: Number(row.price) || 0,
    description: row.description || "",
    image: row.image || undefined,
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : (row.created_at || new Date().toISOString())
  };
}

function toDbBooking(b: Booking): any {
  return {
    id: b.id,
    studio_id: b.studioId,
    customer_id: b.customerId,
    service_id: b.serviceId || null,
    package_id: b.packageId || null,
    booking_date: b.bookingDate,
    time_slot: b.timeSlot,
    addons: Array.isArray(b.addons) ? JSON.stringify(b.addons) : (b.addons || "[]"),
    customer_name: b.customerDetails?.fullName || "",
    customer_email: b.customerDetails?.email || "",
    customer_phone: b.customerDetails?.phone || "",
    customer_notes: b.customerDetails?.notes || null,
    requirements_doc: b.requirementsDoc || null,
    status: b.status,
    total_amount: Number(b.totalAmount) || 0,
    amount_paid: Number(b.amountPaid) || 0,
    down_payment_amount: Number(b.downPaymentAmount) || 0,
    remaining_balance: Number(b.remainingBalance) || Math.max(0, Number(b.totalAmount) - Number(b.amountPaid)),
    payment_status: b.paymentStatus || "Unpaid",
    final_payment_status: b.finalPaymentStatus || (Number(b.amountPaid) >= Number(b.totalAmount) ? "Paid" : "Pending"),
    payment_option: b.paymentOption || "Downpayment",
    payment_due_at: b.paymentDueAt ? new Date(b.paymentDueAt) : null,
    cancellation_reason: b.cancellationReason || null,
    cancelled_by: b.cancelledBy || null,
    cancelled_at: b.cancelledAt ? new Date(b.cancelledAt) : null,
    agreed_to_terms: b.agreedToTerms ? 1 : 0,
    agreed_to_terms_at: b.agreedToTermsAt ? new Date(b.agreedToTermsAt) : null,
    reschedule_request: b.rescheduleRequest ? JSON.stringify(b.rescheduleRequest) : null,
    is_archived: b.isArchived ? 1 : 0,
    archived_at: b.archivedAt ? new Date(b.archivedAt) : null,
    archived_by: b.archivedBy || null,
    created_at: b.createdAt ? new Date(b.createdAt) : new Date()
  };
}

function fromDbBooking(row: any): Booking {
  let parsedAddons = [];
  try {
    parsedAddons = row.addons ? (typeof row.addons === "string" ? JSON.parse(row.addons) : row.addons) : [];
  } catch (e) {
    parsedAddons = [];
  }
  let parsedRescheduleRequest = undefined;
  try {
    if (row.reschedule_request || row.rescheduleRequest) {
      parsedRescheduleRequest = typeof (row.reschedule_request || row.rescheduleRequest) === "string"
        ? JSON.parse(row.reschedule_request || row.rescheduleRequest)
        : (row.reschedule_request || row.rescheduleRequest);
    }
  } catch (e) {
    parsedRescheduleRequest = undefined;
  }
  return {
    id: row.id,
    studioId: row.studio_id,
    customerId: row.customer_id,
    serviceId: row.service_id,
    packageId: row.package_id,
    bookingDate: row.booking_date instanceof Date ? row.booking_date.toISOString().split("T")[0] : String(row.booking_date),
    timeSlot: row.time_slot,
    addons: parsedAddons,
    customerDetails: {
      fullName: row.customer_name || "",
      email: row.customer_email || "",
      phone: row.customer_phone || "",
      notes: row.customer_notes || ""
    },
    requirementsDoc: row.requirements_doc || undefined,
    status: row.status,
    totalAmount: Number(row.total_amount) || 0,
    amountPaid: Number(row.amount_paid) || 0,
    downPaymentAmount: Number(row.down_payment_amount) || Math.round(Number(row.total_amount) * 0.3 * 100) / 100,
    remainingBalance: Number(row.remaining_balance) || Math.max(0, Number(row.total_amount) - Number(row.amount_paid)),
    paymentStatus: row.payment_status || "Unpaid",
    finalPaymentStatus: row.final_payment_status || (Number(row.amount_paid) >= Number(row.total_amount) ? "Paid" : "Pending"),
    paymentOption: (row.payment_option === "Full Payment" || (Number(row.down_payment_amount) >= Number(row.total_amount) && Number(row.total_amount) > 0) ? "Full Payment" : "Downpayment") as "Downpayment" | "Full Payment",
    paymentDueAt: row.payment_due_at instanceof Date ? row.payment_due_at.toISOString() : (row.payment_due_at || undefined),
    cancellationReason: row.cancellation_reason || undefined,
    cancelledBy: row.cancelled_by || undefined,
    cancelledAt: row.cancelled_at instanceof Date ? row.cancelled_at.toISOString() : (row.cancelled_at || undefined),
    agreedToTerms: !!(row.agreed_to_terms || row.agreedToTerms),
    agreedToTermsAt: row.agreed_to_terms_at instanceof Date ? row.agreed_to_terms_at.toISOString() : (row.agreed_to_terms_at || row.agreedToTermsAt || undefined),
    rescheduleRequest: parsedRescheduleRequest,
    isArchived: !!row.is_archived,
    archivedAt: row.archived_at instanceof Date ? row.archived_at.toISOString() : (row.archived_at || undefined),
    archivedBy: row.archived_by || undefined,
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : (row.created_at || new Date().toISOString())
  };
}

function toDbPayment(p: Payment): any {
  return {
    id: p.id,
    booking_id: p.bookingId,
    studio_id: p.studioId,
    customer_id: p.customerId,
    amount: Number(p.amount) || 0,
    payment_type: p.paymentType || "Downpayment",
    payment_method: p.paymentMethod,
    payment_status: p.paymentStatus,
    proof_of_payment: p.proofOfPayment || null,
    reference_number: p.referenceNumber || null,
    payment_date: p.paymentDate ? new Date(p.paymentDate) : new Date(),
    reviewed_by: p.reviewedBy || null,
    reviewed_at: p.reviewedAt ? new Date(p.reviewedAt) : null,
    rejection_reason: p.rejectionReason || null,
    created_at: p.createdAt ? new Date(p.createdAt) : new Date(),
    // Bug 3 fix: GCash / gateway columns — default to null for non-GCash payments
    gcash_session_id: (p as any).gcashSessionId ?? null,
    gateway_transaction_id: (p as any).gatewayTransactionId ?? null,
    fraud_score: (p as any).fraudScore ?? null,
    payment_channel: (p as any).paymentChannel ?? "manual_upload",
    normalized_reference: (p as any).normalizedReference ?? null,
    submitted_amount: (p as any).submittedAmount ?? null,
    submitted_at: (p as any).submittedAt ? new Date((p as any).submittedAt) : null
  };
}

function fromDbPayment(row: any): Payment {
  return {
    id: row.id,
    bookingId: row.booking_id,
    studioId: row.studio_id,
    customerId: row.customer_id,
    amount: Number(row.amount) || 0,
    paymentType: row.payment_type || "Downpayment",
    paymentMethod: row.payment_method,
    paymentStatus: row.payment_status,
    proofOfPayment: row.proof_of_payment || undefined,
    referenceNumber: row.reference_number || undefined,
    paymentDate: row.payment_date instanceof Date ? row.payment_date.toISOString() : (row.payment_date || new Date().toISOString()),
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : (row.created_at || new Date().toISOString()),
    reviewedBy: row.reviewed_by || undefined,
    reviewedAt: row.reviewed_at instanceof Date ? row.reviewed_at.toISOString() : (row.reviewed_at || undefined),
    rejectionReason: row.rejection_reason || undefined,
    // Bug 3 fix: hydrate GCash / gateway columns so they survive server restarts
    gcashSessionId: row.gcash_session_id || undefined,
    gatewayTransactionId: row.gateway_transaction_id || undefined,
    fraudScore: row.fraud_score !== null && row.fraud_score !== undefined ? Number(row.fraud_score) : undefined,
    paymentChannel: row.payment_channel || undefined
  } as any;
}

function toDbPrintProduct(p: PrintProduct): any {
  return {
    id: p.id,
    studio_id: p.studioId,
    name: p.name,
    description: p.description || "",
    size: p.size,
    price: Number(p.price) || 0,
    image: p.image,
    in_stock: p.inStock ? 1 : 0,
    estimated_hours: Number(p.estimatedHours) || 24,
    is_active: p.isActive ? 1 : 0,
    created_at: p.createdAt ? new Date(p.createdAt) : new Date()
  };
}

function fromDbPrintProduct(row: any): PrintProduct {
  return {
    id: row.id,
    studioId: row.studio_id,
    name: row.name,
    description: row.description || "",
    size: row.size,
    price: Number(row.price) || 0,
    image: row.image,
    inStock: !!row.in_stock,
    estimatedHours: Number(row.estimated_hours) || 24,
    isActive: !!row.is_active,
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : (row.created_at || new Date().toISOString())
  };
}

function toDbPrintOrder(o: PrintOrder): any {
  return {
    id: o.id,
    studio_id: o.studioId,
    customer_id: o.customerId,
    product_id: o.productId || null,
    quantity: Number(o.quantity) || 1,
    uploaded_photo: o.uploadedPhoto,
    print_design: o.printDesign ? JSON.stringify(o.printDesign) : null,
    status: o.status,
    total_amount: Number(o.totalAmount) || 0,
    payment_method: o.paymentMethod,
    payment_status: o.paymentStatus,
    proof_of_payment: o.proofOfPayment || null,
    reference_number: o.referenceNumber || null,

    is_archived: o.isArchived ? 1 : 0,
    archived_at: o.archivedAt ? new Date(o.archivedAt) : null,
    archived_by: o.archivedBy || null,
    created_at: o.createdAt ? new Date(o.createdAt) : new Date()
  };
}

function fromDbPrintOrder(row: any): PrintOrder {
  let printDesign = row.print_design || row.printDesign;
  if (typeof printDesign === "string") {
    try {
      printDesign = JSON.parse(printDesign);
    } catch {
      printDesign = undefined;
    }
  }
  return {
    id: row.id,
    studioId: row.studio_id,
    customerId: row.customer_id,
    productId: row.product_id,
    quantity: Number(row.quantity) || 1,
    uploadedPhoto: row.uploaded_photo,
    printDesign: printDesign || undefined,
    status: row.status,
    totalAmount: Number(row.total_amount) || 0,
    paymentMethod: row.payment_method,
    paymentStatus: row.payment_status,
    proofOfPayment: row.proof_of_payment || undefined,
    referenceNumber: row.reference_number || undefined,
    paidAt: row.paid_at instanceof Date ? row.paid_at.toISOString() : (row.paid_at || row.paidAt || undefined),
    cashReceivedBy: row.cash_received_by || row.cashReceivedBy || undefined,
    cashTendered: row.cash_tendered !== undefined ? Number(row.cash_tendered) : (row.cashTendered !== undefined ? Number(row.cashTendered) : undefined),
    changeAmount: row.change_amount !== undefined ? Number(row.change_amount) : (row.changeAmount !== undefined ? Number(row.changeAmount) : undefined),

    isArchived: !!row.is_archived,
    archivedAt: row.archived_at instanceof Date ? row.archived_at.toISOString() : (row.archived_at || undefined),
    archivedBy: row.archived_by || undefined,
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : (row.created_at || new Date().toISOString())
  };
}

function toDbReview(r: Review): any {
  return {
    id: r.id,
    studio_id: r.studioId,
    customer_id: r.customerId,
    customer_name: r.customerName,
    booking_id: r.bookingId,
    rating: Number(r.rating) || 5,
    comment: r.comment || "",
    status: r.status || "pending",
    reply: r.reply || null,
    reply_at: r.replyAt ? new Date(r.replyAt) : null,
    created_at: r.createdAt ? new Date(r.createdAt) : new Date()
  };
}

function fromDbReview(row: any): Review {
  return {
    id: row.id,
    studioId: row.studio_id,
    customerId: row.customer_id,
    customerName: row.customer_name,
    bookingId: row.booking_id,
    rating: Number(row.rating) || 5,
    comment: row.comment || "",
    status: (row.status as "pending" | "approved" | "rejected") || "pending",
    reply: row.reply || undefined,
    replyAt: row.reply_at instanceof Date ? row.reply_at.toISOString() : (row.reply_at || undefined),
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : (row.created_at || new Date().toISOString())
  };
}

function toDbFAQ(f: ChatbotFAQ): any {
  return {
    id: f.id,
    studio_id: f.studioId,
    question: f.question,
    answer: f.answer,
    category: f.category,
    created_at: f.createdAt ? new Date(f.createdAt) : new Date()
  };
}

function fromDbFAQ(row: any): ChatbotFAQ {
  return {
    id: row.id,
    studioId: row.studio_id,
    question: row.question,
    answer: row.answer,
    category: row.category,
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : (row.created_at || new Date().toISOString()),
    frequency: row.frequency,
    isSuggestion: !!row.is_suggestion,
    source: row.source || "manual"
  };
}

function toDbAuditLog(l: AuditLog): any {
  return {
    id: l.id,
    user_id: l.userId,
    user_email: l.userEmail,
    action: l.action,
    entity_type: l.entityType,
    entity_id: l.entityId,
    timestamp: l.timestamp ? new Date(l.timestamp) : new Date()
  };
}

function fromDbAuditLog(row: any): AuditLog {
  return {
    id: row.id,
    userId: row.user_id,
    userEmail: row.user_email,
    action: row.action,
    entityType: row.entity_type,
    entityId: row.entity_id,
    timestamp: row.timestamp instanceof Date ? row.timestamp.toISOString() : (row.timestamp || new Date().toISOString())
  };
}

function toDbNotification(n: Notification): any {
  return {
    id: n.id,
    user_id: n.userId,
    studio_id: n.studioId || null,
    title: n.title,
    message: n.message,
    is_read: n.isRead ? 1 : 0,
    type: n.type,
    created_at: n.createdAt ? new Date(n.createdAt) : new Date()
  };
}

function fromDbNotification(row: any): Notification {
  return {
    id: row.id,
    userId: row.user_id,
    studioId: row.studio_id || undefined,
    title: row.title,
    message: row.message,
    isRead: !!row.is_read,
    type: row.type as any,
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : (row.created_at || new Date().toISOString())
  };
}

function toDbFavorite(f: FavoriteStudio): any {
  return {
    id: f.id,
    customer_id: f.customerId,
    studio_id: f.studioId,
    created_at: f.createdAt ? new Date(f.createdAt) : new Date()
  };
}

function fromDbFavorite(row: any): FavoriteStudio {
  return {
    id: row.id,
    customerId: row.customer_id,
    studioId: row.studio_id,
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : (row.created_at || new Date().toISOString())
  };
}

function toDbPhotoProofing(p: PhotoProofingGallery): any {
  return {
    id: p.id,
    booking_id: p.bookingId,
    studio_id: p.studioId,
    customer_id: p.customerId,
    photos: Array.isArray(p.photos) ? JSON.stringify(p.photos) : (p.photos || "[]"),
    watermark_text: p.watermarkText,
    watermark_position: p.watermarkPosition || "center",
    watermark_opacity: p.watermarkOpacity !== undefined ? Number(p.watermarkOpacity) : 0.40,
    final_drive_link: p.finalDriveLink || null,
    status: p.status || "draft",
    created_at: p.createdAt ? new Date(p.createdAt) : new Date(),
    updated_at: p.updatedAt ? new Date(p.updatedAt) : new Date()
  };
}

function fromDbPhotoProofing(row: any): PhotoProofingGallery {
  let parsedPhotos = [];
  try {
    parsedPhotos = row.photos ? (typeof row.photos === "string" ? JSON.parse(row.photos) : row.photos) : [];
  } catch (e) {
    parsedPhotos = [];
  }
  return {
    id: row.id,
    bookingId: row.booking_id,
    studioId: row.studio_id,
    customerId: row.customer_id,
    photos: parsedPhotos,
    watermarkText: row.watermark_text,
    watermarkPosition: row.watermark_position || "center",
    watermarkOpacity: row.watermark_opacity !== null ? Number(row.watermark_opacity) : 0.40,
    finalDriveLink: row.final_drive_link || undefined,
    status: row.status || "draft",
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : (row.created_at || new Date().toISOString()),
    updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : (row.updated_at || new Date().toISOString())
  };
}

function toDbCMS(c: CMSSetting): any {
  return {
    id: c.id || c.key,
    key: c.key,
    value: c.value
  };
}

function fromDbCMS(row: any): CMSSetting {
  return {
    id: row.id || row.key,
    key: row.key,
    value: row.value
  };
}

function toDbMediaFile(media: MediaFile): any {
  return {
    id: media.id,
    owner_id: media.ownerId,
    entity_type: media.entityType,
    entity_id: media.entityId,
    purpose: media.purpose,
    original_name: media.originalName || null,
    mime_type: media.mimeType,
    size_bytes: media.sizeBytes,
    checksum: media.checksum,
    storage_key: media.storageKey,
    access_status: media.accessStatus,
    created_at: media.createdAt ? new Date(media.createdAt) : new Date()
  };
}

function fromDbMediaFile(row: any): MediaFile {
  return {
    id: row.id,
    ownerId: row.owner_id,
    entityType: row.entity_type,
    entityId: row.entity_id,
    purpose: row.purpose,
    originalName: row.original_name || undefined,
    mimeType: row.mime_type,
    sizeBytes: Number(row.size_bytes) || 0,
    checksum: row.checksum,
    storageKey: row.storage_key,
    accessStatus: row.access_status || "quarantined",
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : (row.created_at || new Date().toISOString())
  };
}

// ====================================================================
// MAIN RELATIONAL MYSQL DATABASE CONTROLLER
// ====================================================================

class RelationalDatabase {
  public pool: any = null;
  public data: DatabaseSchema = { ...defaultSchema };
  private isMySqlActive = false;
  private readonly ready: Promise<void>;
  private saveQueue: Promise<void> = Promise.resolve();

  // Tracks user IDs that have been intentionally deleted this session.
  // ensureIntegrity() checks this before re-creating a missing studio owner,
  // preventing deleted accounts from being resurrected on every save/restart.
  private deletedUserIds = new Set<string>();

  public markUserDeleted(id: string) {
    this.deletedUserIds.add(id);
  }

  constructor() {
    this.ready = this.initialize();
  }

  public waitUntilReady() {
    return this.ready;
  }

  private async initialize() {
    const host = process.env.DB_HOST;
    const port = Number(process.env.DB_PORT) || 3306;
    const user = process.env.DB_USER || "root";
    const password = process.env.DB_PASSWORD || "";
    const database = process.env.DB_NAME || "cainta_photography_mis";

    if (!host) {
      throw new Error(
        "[Database] FATAL: DB_HOST is not set in environment variables. " +
        "A MySQL database connection is required. Please configure DB_HOST, DB_USER, DB_PASSWORD, and DB_NAME in your .env file."
      );
    }

    const connectionLimit = Number(process.env.DB_CONNECTION_LIMIT) || 10;
    const connectTimeout = Number(process.env.DB_CONNECT_TIMEOUT) || 5000;
    const ssl = (process.env.DB_SSL === "true" || process.env.DB_SSL === "1") ? { rejectUnauthorized: false } : undefined;

    console.log(`[Database] Connecting to MySQL at ${host}:${port}/${database} (Pool limit: ${connectionLimit})...`);
    this.pool = mysql.createPool({
      host,
      port,
      user,
      password,
      database,
      connectTimeout,
      waitForConnections: true,
      connectionLimit,
      queueLimit: 0,
      ssl
    });

    // Verify database connection
    await this.pool.query("SELECT 1");
    this.isMySqlActive = true;
    console.log(`[Database] Connected successfully to MySQL '${database}'!`);

    // Ensure all schemas and tables exist
    await this.bootstrapDatabaseSchema();

    // Load all data directly from live MySQL tables into memory
    await this.loadFromMySql();

    this.initializeCMSDefaults();
  }

  private initializeCMSDefaults() {
    if (!this.data.cmsSettings || this.data.cmsSettings.length === 0) {
      const defaults: CMSSetting[] = [
        { id: "heroTitle", key: "heroTitle", value: "Frame Your Story. <br /> Book Cainta Studios." },
        { id: "heroSubtitle", key: "heroSubtitle", value: "Discover accredited photography studios in Cainta, Rizal. Compare live calendar availability, customize grad & creative packages, inspect RAW vs retouched portfolios, and order gallery-grade physical wall prints." },
        { id: "heroBackground", key: "heroBackground", value: "https://images.unsplash.com/photo-1492691527719-9d1e07e534b4?w=1800&fit=crop" },
        { id: "aboutTitle", key: "aboutTitle", value: "Pristine Studio Lighting & Retouching" },
        { id: "aboutDescription", key: "aboutDescription", value: "Experience the difference of calibrated Profoto strobes, true-to-life skin tones, and meticulous post-processing by Cainta's leading photographers." },
        { id: "featuresTitle", key: "featuresTitle", value: "Spotlight Studios in Cainta, Rizal" },
        { id: "featuresSubtitle", key: "featuresSubtitle", value: "Explore photography styles and packages suited to your milestones." }
      ];
      this.data.cmsSettings = defaults;
      this.save();
    }

  }



  private reconcileStudioBrandingMedia() {
    for (const studio of this.data.studios) {
      const latestByPurpose = new Map<string, string>();
      for (const media of this.data.mediaFiles || []) {
        if (media.entityType !== "studio" || media.entityId !== studio.id || media.accessStatus !== "active") continue;
        if (media.purpose === "STUDIO_LOGO" || media.purpose === "STUDIO_COVER") {
          if (!latestByPurpose.has(media.purpose)) {
            // Use Cloudinary CDN URL directly when available (permanent, survives restarts).
            // Fall back to the /api/media proxy for legacy local-disk files.
            const url = media.storageKey && media.storageKey.startsWith("https://")
              ? media.storageKey
              : `/api/media/${media.id}`;
            latestByPurpose.set(media.purpose, url);
          }
        }
      }
      if (latestByPurpose.has("STUDIO_LOGO")) {
        studio.logo = latestByPurpose.get("STUDIO_LOGO") || studio.logo;
      }
      if (latestByPurpose.has("STUDIO_COVER")) {
        studio.coverImage = latestByPurpose.get("STUDIO_COVER") || studio.coverImage;
      }
    }
  }

  // Get collections
  get users() { return this.data.users; }
  get customers() { return this.data.customers || []; }  // Separate customers table
  get studios() { return this.data.studios; }
  get categories() { return this.data.categories; }
  get services() { return this.data.services; }
  get packages() { return this.data.packages; }
  get addons() { return this.data.addons; }
  get bookings() { return this.data.bookings; }
  get payments() { return this.data.payments; }
  get printProducts() { return this.data.printProducts; }
  get printOrders() { return this.data.printOrders; }
  get reviews() { return this.data.reviews; }
  get faqs() { return this.data.faqs; }
  get auditLogs() { return this.data.auditLogs; }
  get notifications() { return this.data.notifications; }
  get favorites() { return this.data.favorites; }
  get photoProofings() { return this.data.photoProofings || []; }
  get cmsSettings() { return this.data.cmsSettings || []; }
  get customPages() { return this.data.customPages || []; }
  get systemSettings() { return this.data.systemSettings || defaultSchema.systemSettings; }
  get mediaFiles() { return this.data.mediaFiles || []; }
  get availabilities() { return this.data.availabilities || []; }
  get blackouts() { return this.data.blackouts || []; }

  public updateSystemSettings(settings: SystemSettings) {
    this.data.systemSettings = { ...this.data.systemSettings, ...settings };
    this.save();
  }

  // Ensure relational data integrity (e.g. all studio ownerIds have corresponding user records)
  private ensureIntegrity() {
    // Keep data empty unless user-generated records are explicitly created.
    for (const studio of this.data.studios) {
      // Never re-create a user that was intentionally deleted this session.
      if (this.deletedUserIds.has(studio.ownerId)) continue;

      if (!this.data.users.some(u => u.id === studio.ownerId)) {
        const ownerUser: User = {
          id: studio.ownerId,
          email: studio.email || `${studio.ownerId}@caintastudios.com`,
          passwordHash: "$2b$10$KWzQUkhlejbbjajhZZSS3ONo1.Onq8MCGV6FDtQ1vWrH9TsHW7D6G",
          fullName: `${studio.name} Admin`,
          role: studio.ownerId === "u-superadmin" ? UserRole.SUPER_ADMIN : UserRole.STUDIO_ADMIN,
          studioId: studio.id,
          contactNumber: studio.contactInfo,
          address: studio.address,
          createdAt: studio.createdAt || new Date().toISOString()
        };
        this.data.users.push(ownerUser);
      }
    }
  }

  // Generic write helpers (Saves to memory buffers instantly, then persists to MySQL & local file)
  public addUser(user: User) { this.users.push(user); this.save(); }
  public addCustomer(customer: Customer) { 
    if (!this.data.customers) this.data.customers = [];
    this.data.customers.push(customer); 
    this.save(); 
  }
  public addCMSSetting(setting: CMSSetting) { this.cmsSettings.push(setting); this.save(); }
  public addStudio(studio: Studio) { 
    this.studios.push(studio); 
    this.ensureIntegrity();
    this.save(); 
  }
  public addCategory(category: StudioCategory) { this.categories.push(category); this.save(); }
  public addService(service: StudioService) { this.services.push(service); this.save(); }
  public addPackage(pkg: StudioPackage) { this.packages.push(pkg); this.save(); }
  public addAddon(addon: PackageAddon) { this.addons.push(addon); this.save(); }
  public addBooking(booking: Booking) { 
    const idx = this.bookings.findIndex(b => b.id === booking.id);
    if (idx >= 0) {
      this.bookings[idx] = booking;
    } else {
      this.bookings.push(booking);
    }
    this.save(); 
    this.mysqlInsert("bookings", toDbBooking(booking)).catch(err => {
      console.error("[Database] Direct booking insert notice:", err);
    });
  }
  public addPayment(payment: Payment) { 
    const idx = this.payments.findIndex(p => p.id === payment.id);
    if (idx >= 0) {
      this.payments[idx] = payment;
    } else {
      this.payments.push(payment);
    }
    this.save(); 
    this.mysqlInsert("payments", toDbPayment(payment)).catch(err => {
      console.error("[Database] Direct payment insert notice:", err);
    });
  }
  public addPrintProduct(product: PrintProduct) { this.printProducts.push(product); this.save(); }
  public addPrintOrder(order: PrintOrder) { this.printOrders.push(order); this.save(); }
  public addReview(review: Review) { this.reviews.push(review); this.save(); }
  public addFAQ(faq: ChatbotFAQ) { this.faqs.push(faq); this.save(); }
  public addAuditLog(log: AuditLog) { this.auditLogs.unshift(log); this.save(); }
  public addNotification(notification: Notification) { this.notifications.unshift(notification); this.save(); }
  public addFavorite(fav: FavoriteStudio) { this.favorites.push(fav); this.save(); }
  public addPhotoProofing(proofing: PhotoProofingGallery) { this.photoProofings.push(proofing); this.save(); }
  public addMediaFile(media: MediaFile) {
    if (!this.data.mediaFiles) this.data.mediaFiles = [];
    this.data.mediaFiles.push(media);
    // Immediately write to MySQL so GET /api/media/:id succeeds even if the
    // background persist() cycle hasn't completed yet (Bug 2 fix — mirrors
    // the same pattern used by addPayment()).
    this.mysqlInsert("media_files", toDbMediaFile(media)).catch(err => {
      console.error("[Database] Direct media_files insert notice:", err);
    });
    this.save();
  }

  // Generic parameterized MySQL Insert / Upsert
  private async mysqlInsert(table: string, dbRow: any) {
    if (!this.isMySqlActive || !this.pool) return;
    try {
      // If inserting a studio, ensure its owner exists in users first to avoid FK error.
      // Skip this guard entirely if the owner was intentionally deleted — we must not
      // re-create a deleted account just to satisfy a studio FK constraint.
      if (table === "studios" && dbRow.owner_id) {
        if (!this.deletedUserIds.has(dbRow.owner_id)) {
          const [existingUser]: any = await this.pool.query("SELECT id FROM users WHERE id = ?", [dbRow.owner_id]);
          if (!existingUser || existingUser.length === 0) {
            const ownerUser = this.users.find(u => u.id === dbRow.owner_id) || {
              id: dbRow.owner_id,
              email: dbRow.email || `${dbRow.owner_id}@caintastudios.com`,
              passwordHash: "$2b$10$KWzQUkhlejbbjajhZZSS3ONo1.Onq8MCGV6FDtQ1vWrH9TsHW7D6G",
              fullName: `${dbRow.name || "Studio"} Admin`,
              role: dbRow.owner_id === "u-superadmin" ? UserRole.SUPER_ADMIN : UserRole.STUDIO_ADMIN,
              studioId: dbRow.id,
              contactNumber: dbRow.contact_info,
              address: dbRow.address,
              createdAt: dbRow.created_at ? new Date(dbRow.created_at).toISOString() : new Date().toISOString()
            };
            await this.mysqlInsert("users", toDbUser(ownerUser));
          }
        }
      }

      const keys = Object.keys(dbRow);
      const values = Object.values(dbRow);
      const placeholders = keys.map(() => "?").join(", ");
      const columns = keys.map(k => `\`${k}\``).join(", ");
      const updateClauses = keys.filter(k => k !== "id").map(k => `\`${k}\` = VALUES(\`${k}\`)`).join(", ");

      const query = `INSERT INTO \`${table}\` (${columns}) VALUES (${placeholders}) ON DUPLICATE KEY UPDATE ${updateClauses}`;
      await this.pool.query(query, values);
    } catch (err) {
      console.error(`[Database] MySQL insert failed on table '${table}':`, err);
    }
  }

  // Synchronizes changes made in memory to MySQL in strict FK order
  public save() {
    this.saveQueue = this.saveQueue.then(() => this.persist()).catch(err => {
      console.error("[Database] Queued save failed:", err);
    });
    return this.saveQueue;
  }

  private async persist() {
    this.ensureIntegrity();

    // Upsert all active application tables to MySQL in strict FK order.
    //
    // ── ACTIVE TABLES (synced here) ──────────────────────────────────────────
    //   users, customers, studios, categories, services, packages, addons,
    //   bookings, payments, print_products, print_orders, reviews, faqs,
    //   audit_logs, notifications, favorites, photo_proofings, cms_settings,
    //   media_files, studio_availability, availability_blackouts
    //
    // ── ACTIVE PAYMENT TABLES (written directly via raw SQL, not via syncTable) ─
    //   gcash_qr_sessions     — managed by GCash QR endpoint SQL + webhook handler
    //   webhook_events        — idempotency log; written by webhook/poll handlers
    //   studio_payment_credentials — written by POST /api/studios/:id/payment-credentials
    //
    if (!this.isMySqlActive || !this.pool) return;
    try {
      await this.syncTable("users", this.users.map(toDbUser));
      await this.syncTable("customers", this.customers.map(toDbCustomer));
      await this.syncTable("studios", this.studios.map(toDbStudio));
      await this.syncTable("categories", this.categories.map(toDbCategory));
      await this.syncTable("services", this.services.map(toDbService));
      await this.syncTable("packages", this.packages.map(toDbPackage));
      await this.syncTable("addons", this.addons.map(toDbAddon));
      await this.syncTable("bookings", this.bookings.map(toDbBooking));
      await this.syncTable("payments", this.payments.map(toDbPayment));
      await this.syncTable("print_products", this.printProducts.map(toDbPrintProduct));
      await this.syncTable("print_orders", this.printOrders.map(toDbPrintOrder));
      await this.syncTable("reviews", this.reviews.map(toDbReview));
      await this.syncTable("faqs", this.faqs.map(toDbFAQ));
      await this.syncTable("audit_logs", this.auditLogs.map(toDbAuditLog));
      await this.syncTable("notifications", this.notifications.map(toDbNotification));
      await this.syncTable("favorites", this.favorites.map(toDbFavorite));
      await this.syncTable("photo_proofings", this.photoProofings.map(toDbPhotoProofing));
      await this.syncTable("cms_settings", this.cmsSettings.map(toDbCMS));
      await this.syncTable("media_files", this.mediaFiles.map(toDbMediaFile));
      await this.syncTable("studio_availability", this.availabilities.map(toDbAvailability));
      await this.syncTable("availability_blackouts", this.blackouts.map(toDbBlackout));
    } catch (err) {
      console.error("[Database] Synchronize MySQL update failed:", err);
    }
  }

  // Synchronizes a full table to MySQL
  private async syncTable(table: string, dbRows: any[]) {
    if (!this.pool) return;
    try {
      const tableCheck = await this.pool.query(`SHOW TABLES LIKE ?`, [table]);
      if (!Array.isArray(tableCheck[0]) || tableCheck[0].length === 0) {
        return;
      }

      // Safe deletion: Remove rows ONLY for tables where user deletion is an intentional feature,
      // and NEVER execute a blanket DELETE FROM <table> when memory is empty.
      const activeIds = dbRows.map(r => r.id).filter(Boolean);
      const tablesWithDeletions = [
        // User accounts — admins can delete these via the Users management panel
        "users", "customers",
        "custom_pages", "categories", "services", "packages",
        "addons", "studio_availability", "availability_blackouts",
        "print_products", "reviews", "favorites", "faqs"
      ];

      if (tablesWithDeletions.includes(table) && activeIds.length > 0) {
        const idPlaceholders = activeIds.map(() => "?").join(",");
        await this.pool.query(`DELETE FROM \`${table}\` WHERE id NOT IN (${idPlaceholders})`, activeIds);
      }

      // Upsert: Insert or update all rows
      for (const row of dbRows) {
        const keys = Object.keys(row);
        const values = Object.values(row);
        const columns = keys.map(k => `\`${k}\``).join(", ");
        const placeholders = keys.map(() => "?").join(", ");
        const updateClauses = keys.filter(k => k !== "id").map(k => `\`${k}\` = VALUES(\`${k}\`)`).join(", ");

        const query = `INSERT INTO \`${table}\` (${columns}) VALUES (${placeholders}) ON DUPLICATE KEY UPDATE ${updateClauses}`;
        await this.pool.query(query, values);
      }
    } catch (tableErr) {
      console.error(`[Database] syncTable failed for '${table}':`, tableErr);
    }
  }

  // Reads all tables from MySQL to populate the memory state
  private async loadFromMySql() {
    if (!this.pool) return;
    console.log("[Database] Hydrating memory from MySQL tables...");
    try {
      const [usersRes]: any = await this.pool.query("SELECT * FROM users");
      const [customersRes]: any = await this.pool.query("SELECT * FROM customers");
      const [studiosRes]: any = await this.pool.query("SELECT * FROM studios");
      const [categoriesRes]: any = await this.pool.query("SELECT * FROM categories");
      const [servicesRes]: any = await this.pool.query("SELECT * FROM services");
      const [packagesRes]: any = await this.pool.query("SELECT * FROM packages");
      const [addonsRes]: any = await this.pool.query("SELECT * FROM addons");
      const [bookingsRes]: any = await this.pool.query("SELECT * FROM bookings");
      const [paymentsRes]: any = await this.pool.query("SELECT * FROM payments");
      const [printsRes]: any = await this.pool.query("SELECT * FROM print_products");
      const [printOrdersRes]: any = await this.pool.query("SELECT * FROM print_orders");
      const [reviewsRes]: any = await this.pool.query("SELECT * FROM reviews");
      const [faqsRes]: any = await this.pool.query("SELECT * FROM faqs");
      const [logsRes]: any = await this.pool.query("SELECT * FROM audit_logs ORDER BY timestamp DESC");
      const [notificationsRes]: any = await this.pool.query("SELECT * FROM notifications ORDER BY created_at DESC");
      const [favoritesRes]: any = await this.pool.query("SELECT * FROM favorites");
      const [proofingsRes]: any = await this.pool.query("SELECT * FROM photo_proofings");
      let availabilityRes: any[] = [];
      try {
        const [availability]: any = await this.pool.query("SELECT * FROM studio_availability");
        availabilityRes = availability;
      } catch (e) {}

      let blackoutRes: any[] = [];
      try {
        const [blackouts]: any = await this.pool.query("SELECT * FROM availability_blackouts");
        blackoutRes = blackouts;
      } catch (e) {}

      let mediaFilesRes: any[] = [];
      try {
        const [media]: any = await this.pool.query("SELECT * FROM media_files");
        mediaFilesRes = media;
      } catch (e) {}

      let cmsRes: any[] = [];
      try {
        const [cms]: any = await this.pool.query("SELECT * FROM cms_settings");
        cmsRes = cms;
      } catch (e) {}

      this.data.users = usersRes.map(fromDbUser);
      this.data.customers = customersRes.map(fromDbCustomer);
      this.data.studios = studiosRes.map(fromDbStudio);
      this.data.categories = categoriesRes.map(fromDbCategory);
      this.data.services = servicesRes.map(fromDbService);
      this.data.packages = packagesRes.map(fromDbPackage);
      this.data.addons = addonsRes.map(fromDbAddon);
      this.data.bookings = bookingsRes.map(fromDbBooking);
      this.data.payments = paymentsRes.map(fromDbPayment);
      this.data.printProducts = printsRes.map(fromDbPrintProduct);
      this.data.printOrders = printOrdersRes.map(fromDbPrintOrder);
      this.data.reviews = reviewsRes.map(fromDbReview);
      this.data.faqs = faqsRes.map(fromDbFAQ);
      this.data.auditLogs = logsRes.map(fromDbAuditLog);
      this.data.notifications = notificationsRes.map(fromDbNotification);
      this.data.favorites = favoritesRes.map(fromDbFavorite);
      this.data.photoProofings = proofingsRes.map(fromDbPhotoProofing);
      this.data.availabilities = availabilityRes.map(fromDbAvailability);
      this.data.blackouts = blackoutRes.map(fromDbBlackout);
      this.data.cmsSettings = cmsRes.map(fromDbCMS);
      this.data.mediaFiles = mediaFilesRes.map(fromDbMediaFile);

      this.reconcileStudioBrandingMedia();
      this.ensureIntegrity();

      console.log(`[Database] Hydration complete! Loaded users: ${this.data.users.length}, customers: ${this.data.customers.length}, studios: ${this.data.studios.length}, bookings: ${this.data.bookings.length}`);
    } catch (err) {
      console.error("[Database] Hydration from MySQL failed:", err);
      throw err;
    }
  }

  // Schema bootstrapper to ensure tables and auxiliary columns exist
  private async bootstrapDatabaseSchema() {
    if (!this.pool) return;
    try {
      try {
        await this.pool.query(`
          CREATE TABLE IF NOT EXISTS users (
            id VARCHAR(50) PRIMARY KEY,
            email VARCHAR(100) UNIQUE NOT NULL,
            password_hash VARCHAR(255) NOT NULL,
            full_name VARCHAR(100) NOT NULL,
            role VARCHAR(50) NOT NULL,
            studio_id VARCHAR(50) NULL,
            contact_number VARCHAR(50) NULL,
            address TEXT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          );
        `);
      } catch (e) {}

      // Dedicated customers table (separate from users/admin/studio_owner)
      try {
        await this.pool.query(`
          CREATE TABLE IF NOT EXISTS customers (
            id VARCHAR(50) PRIMARY KEY,
            email VARCHAR(100) UNIQUE NOT NULL,
            password_hash VARCHAR(255) NOT NULL,
            full_name VARCHAR(100) NOT NULL,
            contact_number VARCHAR(50) NULL,
            address TEXT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          );
        `);
      } catch (e) {}

      try {
        await this.pool.query(`
          CREATE TABLE IF NOT EXISTS cms_settings (
            id VARCHAR(100) PRIMARY KEY,
            \`key\` VARCHAR(100) NOT NULL,
            \`value\` TEXT NOT NULL
          );
        `);
      } catch (e) {}

      try {
        await this.pool.query(`
          CREATE TABLE IF NOT EXISTS media_files (
            id VARCHAR(50) PRIMARY KEY,
            owner_id VARCHAR(50) NOT NULL,
            entity_type VARCHAR(50) NOT NULL,
            entity_id VARCHAR(50) NOT NULL,
            purpose VARCHAR(50) NOT NULL,
            original_name VARCHAR(255) NULL,
            mime_type VARCHAR(100) NOT NULL,
            size_bytes BIGINT NOT NULL,
            checksum VARCHAR(128) NOT NULL,
            storage_key VARCHAR(255) NOT NULL UNIQUE,
            access_status VARCHAR(30) NOT NULL DEFAULT 'quarantined',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX media_files_entity_idx (entity_type, entity_id),
            INDEX media_files_owner_idx (owner_id),
            INDEX media_files_purpose_idx (purpose)
          );
        `);
      } catch (e) {}

      try {
        await this.pool.query(`
          CREATE TABLE IF NOT EXISTS photo_proofings (
            id VARCHAR(50) PRIMARY KEY,
            booking_id VARCHAR(50) NOT NULL,
            studio_id VARCHAR(50) NOT NULL,
            customer_id VARCHAR(50) NOT NULL,
            photos JSON NULL,
            watermark_text VARCHAR(255) NOT NULL DEFAULT 'PROOF - CAINTA STUDIO',
            watermark_position VARCHAR(50) NOT NULL DEFAULT 'repeat_diagonal',
            watermark_opacity DECIMAL(4,2) NOT NULL DEFAULT 0.35,
            final_drive_link TEXT NULL,
            status VARCHAR(50) NOT NULL DEFAULT 'draft',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX photo_proofings_booking_idx (booking_id),
            INDEX photo_proofings_customer_idx (customer_id),
            INDEX photo_proofings_studio_idx (studio_id)
          );
        `);
      } catch (e) {}
      try {
        await this.pool.query(`ALTER TABLE media_files ADD COLUMN purpose VARCHAR(50) NOT NULL DEFAULT 'LEGACY';`);
      } catch (e) {}

      // Add missing columns if needed
      try {
        await this.pool.query(`ALTER TABLE studios ADD COLUMN blocked_dates TEXT NULL;`);
      } catch (e) {}
      try {
        await this.pool.query(`ALTER TABLE studios ADD COLUMN business_permit TEXT NULL;`);
      } catch (e) {}
      try {
        await this.pool.query(`ALTER TABLE studios ADD COLUMN valid_id LONGTEXT NULL;`);
      } catch (e) {}
      try {
        await this.pool.query(`ALTER TABLE studios ADD COLUMN other_docs TEXT NULL;`);
      } catch (e) {}
      try {
        await this.pool.query(`ALTER TABLE studios ADD COLUMN registered_by_admin BOOLEAN DEFAULT FALSE;`);
      } catch (e) {}
      // Official online presence links (social media profiles + website)
      try {
        await this.pool.query(`ALTER TABLE studios ADD COLUMN facebook_url VARCHAR(500) NULL;`);
      } catch (e) {}
      try {
        await this.pool.query(`ALTER TABLE studios ADD COLUMN instagram_url VARCHAR(500) NULL;`);
      } catch (e) {}
      try {
        await this.pool.query(`ALTER TABLE studios ADD COLUMN tiktok_url VARCHAR(500) NULL;`);
      } catch (e) {}
      try {
        await this.pool.query(`ALTER TABLE studios ADD COLUMN other_social_url VARCHAR(500) NULL;`);
      } catch (e) {}
      try {
        await this.pool.query(`ALTER TABLE studios ADD COLUMN website_url VARCHAR(500) NULL;`);
      } catch (e) {}
      // Direct GCash payout details mirrored on the studio record
      try {
        await this.pool.query(`ALTER TABLE studios ADD COLUMN gcash_number VARCHAR(50) NULL;`);
      } catch (e) {}
      try {
        await this.pool.query(`ALTER TABLE studios ADD COLUMN gcash_account_name VARCHAR(100) NULL;`);
      } catch (e) {}
      try {
        await this.pool.query(`ALTER TABLE studios ADD COLUMN gcash_qr_code LONGTEXT NULL;`);
      } catch (e) {}
      // Direct Maya (PayMaya) payout details — same treatment as GCash. Without
      // these columns toDbStudio() would silently drop the uploaded Maya QR code
      // or make the whole `studios` upsert fail with "Unknown column".
      try {
        await this.pool.query(`ALTER TABLE studios ADD COLUMN maya_number VARCHAR(50) NULL;`);
      } catch (e) {}
      try {
        await this.pool.query(`ALTER TABLE studios ADD COLUMN maya_account_name VARCHAR(100) NULL;`);
      } catch (e) {}
      try {
        await this.pool.query(`ALTER TABLE studios ADD COLUMN maya_qr_code LONGTEXT NULL;`);
      } catch (e) {}
      try {
        await this.pool.query(`ALTER TABLE addons ADD COLUMN image VARCHAR(255) NULL;`);
      } catch (e) {}
      // Reviews moderation & reply columns
      try {
        await this.pool.query(`ALTER TABLE reviews ADD COLUMN status VARCHAR(50) DEFAULT 'approved';`);
      } catch (e) {}
      try {
        await this.pool.query(`ALTER TABLE reviews ADD COLUMN reply TEXT NULL;`);
      } catch (e) {}
      try {
        await this.pool.query(`ALTER TABLE reviews ADD COLUMN reply_at TIMESTAMP NULL;`);
      } catch (e) {}
      try {
        await this.pool.query(`ALTER TABLE bookings ADD COLUMN payment_option VARCHAR(50) DEFAULT 'Downpayment';`);
      } catch (e) {}
      try {
        await this.pool.query(`ALTER TABLE bookings MODIFY COLUMN package_id VARCHAR(50) NULL;`);
      } catch (e) {}
      // ── Booking terms acceptance & reschedule request columns ──────────────
      // Written by toDbBooking(). Without them the whole `bookings` upsert
      // aborts with "Unknown column 'agreed_to_terms' in 'field list'", so the
      // Booking Wizard's "Accept Terms & Proceed to Payment" step silently
      // failed to persist the booking to MySQL.
      try {
        await this.pool.query(`ALTER TABLE bookings ADD COLUMN agreed_to_terms TINYINT(1) NOT NULL DEFAULT 0;`);
      } catch (e) {}
      try {
        await this.pool.query(`ALTER TABLE bookings ADD COLUMN agreed_to_terms_at TIMESTAMP NULL DEFAULT NULL;`);
      } catch (e) {}
      try {
        await this.pool.query(`ALTER TABLE bookings ADD COLUMN reschedule_request TEXT NULL;`);
      } catch (e) {}

      // ── GCash QR Payment Tables & Columns ──────────────────────────────────
      try {
        await this.pool.query(`
          CREATE TABLE IF NOT EXISTS gcash_qr_sessions (
            id VARCHAR(50) PRIMARY KEY,
            payment_id VARCHAR(50) NULL,
            booking_id VARCHAR(50) NULL,
            print_order_id VARCHAR(50) NULL,
            studio_id VARCHAR(50) NOT NULL,
            customer_id VARCHAR(50) NOT NULL,
            gateway VARCHAR(20) NOT NULL DEFAULT 'direct_gcash',
            gateway_payment_intent_id VARCHAR(255) NULL,
            gateway_source_id VARCHAR(255) NULL,
            gateway_checkout_url TEXT NULL,
            qr_code_data LONGTEXT NULL,
            amount DECIMAL(10,2) NOT NULL,
            payment_type VARCHAR(30) NOT NULL DEFAULT 'Downpayment',
            status VARCHAR(50) NOT NULL DEFAULT 'pending',
            expires_at TIMESTAMP NOT NULL,
            paid_at TIMESTAMP NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_gqr_booking (booking_id),
            INDEX idx_gqr_customer (customer_id),
            INDEX idx_gqr_intent (gateway_payment_intent_id),
            INDEX idx_gqr_status (status)
          );
        `);
      } catch (e) {}

      // Keep the payment deadline fixed when the session status changes.
      try {
        await this.pool.query(`
          ALTER TABLE gcash_qr_sessions
          MODIFY COLUMN expires_at TIMESTAMP NOT NULL
        `);
      } catch (e) {}

      try {
        await this.pool.query(`
          CREATE TABLE IF NOT EXISTS studio_payment_credentials (
            id VARCHAR(50) PRIMARY KEY,
            studio_id VARCHAR(50) NOT NULL,
            gateway VARCHAR(20) NOT NULL DEFAULT 'direct_gcash',
            gateway_sub_account_id VARCHAR(255) NULL,
            public_key_encrypted TEXT NULL,
            secret_key_encrypted TEXT NULL,
            webhook_secret_encrypted TEXT NULL,
            gcash_merchant_name VARCHAR(100) NULL,
            gcash_number VARCHAR(20) NULL,
            is_live_mode TINYINT(1) NOT NULL DEFAULT 0,
            is_enabled TINYINT(1) NOT NULL DEFAULT 1,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE KEY uniq_studio_gateway (studio_id, gateway)
          );
        `);
      } catch (e) {}

      try {
        await this.pool.query(`ALTER TABLE payments ADD COLUMN gcash_session_id VARCHAR(50) NULL;`);
      } catch (e) {}
      try {
        await this.pool.query(`ALTER TABLE payments ADD COLUMN gateway_transaction_id VARCHAR(255) NULL;`);
      } catch (e) {}
      try {
        await this.pool.query(`ALTER TABLE payments ADD COLUMN fraud_score INT NULL;`);
      } catch (e) {}
      try {
        await this.pool.query(`ALTER TABLE payments ADD COLUMN payment_channel VARCHAR(50) NOT NULL DEFAULT 'manual_upload';`);
      } catch (e) {}
      try {
        await this.pool.query(`
          CREATE TABLE IF NOT EXISTS studio_availability (
            id VARCHAR(50) PRIMARY KEY,
            studio_id VARCHAR(50) NOT NULL,
            day_of_week INT NOT NULL,
            opening_time VARCHAR(20) NOT NULL,
            closing_time VARCHAR(20) NOT NULL,
            is_available TINYINT(1) NOT NULL DEFAULT 1,
            slot_duration_minutes INT NOT NULL DEFAULT 60,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_studio_availability_studio (studio_id)
          );
        `);
      } catch (e) {}

      try {
        await this.pool.query(`
          CREATE TABLE IF NOT EXISTS availability_blackouts (
            id VARCHAR(50) PRIMARY KEY,
            studio_id VARCHAR(50) NOT NULL,
            blackout_date DATE NOT NULL,
            start_time VARCHAR(20) NULL,
            end_time VARCHAR(20) NULL,
            reason VARCHAR(255) NOT NULL DEFAULT 'Studio closure',
            is_recurring TINYINT(1) NOT NULL DEFAULT 0,
            recurrence_rule VARCHAR(255) NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_availability_blackouts_studio (studio_id)
          );
        `);
      } catch (e) {}

      try {
        await this.pool.query(`ALTER TABLE print_orders ADD COLUMN gcash_session_id VARCHAR(50) NULL;`);
      } catch (e) {}
      try {
        await this.pool.query(`ALTER TABLE print_orders ADD COLUMN gateway_transaction_id VARCHAR(255) NULL;`);
      } catch (e) {}
      try {
        await this.pool.query(`ALTER TABLE print_orders ADD COLUMN print_design TEXT NULL;`);
      } catch (e) {}
      // ── Archive columns ──────────────────────────────────────────────────
      try {
        await this.pool.query(`ALTER TABLE bookings ADD COLUMN is_archived TINYINT(1) NOT NULL DEFAULT 0;`);
      } catch (e) {}
      try {
        await this.pool.query(`ALTER TABLE bookings ADD COLUMN archived_at TIMESTAMP NULL;`);
      } catch (e) {}
      try {
        await this.pool.query(`ALTER TABLE bookings ADD COLUMN archived_by VARCHAR(50) NULL;`);
      } catch (e) {}
      try {
        await this.pool.query(`ALTER TABLE print_orders ADD COLUMN is_archived TINYINT(1) NOT NULL DEFAULT 0;`);
      } catch (e) {}
      try {
        await this.pool.query(`ALTER TABLE print_orders ADD COLUMN archived_at TIMESTAMP NULL;`);
      } catch (e) {}
      try {
        await this.pool.query(`ALTER TABLE print_orders ADD COLUMN archived_by VARCHAR(50) NULL;`);
      } catch (e) {}
      // Bug 4 fix: ensure customer archive columns exist — use IF NOT EXISTS so the
      // statement is truly idempotent and won't mask unrelated errors via swallowed catches.
      try {
        await this.pool.query(`ALTER TABLE customers ADD COLUMN IF NOT EXISTS is_archived TINYINT(1) NOT NULL DEFAULT 0;`);
      } catch (e) {}
      try {
        await this.pool.query(`ALTER TABLE customers ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP NULL DEFAULT NULL;`);
      } catch (e) {}
      try {
        await this.pool.query(`ALTER TABLE customers ADD COLUMN IF NOT EXISTS archived_by VARCHAR(50) NULL DEFAULT NULL;`);
      } catch (e) {}
    } catch (err) {
      console.error("[Database] MySQL schema verification notice:", err);
    }
  }
}


export const db = new RelationalDatabase();
