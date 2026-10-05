/**
 * Utility functions for studio availability, time slots generation, and conflict detection.
 */

export interface StudioAvailabilityRule {
  id?: string;
  studioId: string;
  dayOfWeek: number; // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  openingTime: string; // "HH:MM" e.g. "09:00"
  closingTime: string; // "HH:MM" e.g. "18:00"
  isAvailable: boolean;
  slotDurationMinutes: number; // e.g. 30, 60, 90, 120
}

export interface StudioBlackoutRule {
  id?: string;
  studioId: string;
  blackoutDate: string; // "YYYY-MM-DD"
  startTime: string; // "HH:MM"
  endTime: string; // "HH:MM"
  reason?: string;
}

/**
 * Parses "HH:MM" 24-hour string into total minutes from midnight.
 */
export function parseHHMM(value: string): number {
  if (!value || typeof value !== "string") return 0;
  const [hourRaw, minuteRaw] = String(value).split(":");
  const hour = Number(hourRaw || 0);
  const minute = Number(minuteRaw || 0);
  if (Number.isNaN(hour) || Number.isNaN(minute)) return 0;
  return hour * 60 + minute;
}

/**
 * Parses a 12-hour or 24-hour time slot string (e.g. "09:00 AM", "01:30 PM", "14:00")
 * into total minutes from midnight.
 */
export function parseTimeToMinutes(timeStr: string): number {
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

/**
 * Formats total minutes from midnight into 12-hour "hh:mm A" string (e.g. "09:00 AM", "01:30 PM").
 */
export function minutesToTimeStr(totalMinutes: number): string {
  const hours24 = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const period = hours24 >= 12 ? "PM" : "AM";
  let hours12 = hours24 % 12;
  if (hours12 === 0) hours12 = 12;
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${pad(hours12)}:${pad(minutes)} ${period}`;
}

/**
 * Parses a studio's business hours string (e.g., "10:00 AM - 07:00 PM", "10:00 AM - 10:00 PM")
 * into standard 24-hour opening and closing "HH:MM" strings.
 */
export function parseBusinessHours(businessHoursStr?: string): { openingTime: string; closingTime: string } {
  if (!businessHoursStr || typeof businessHoursStr !== "string") {
    return { openingTime: "09:00", closingTime: "18:00" };
  }
  const parts = businessHoursStr.split(/[-–—]/).map(p => p.trim());
  if (parts.length >= 2) {
    const startMins = parseTimeToMinutes(parts[0]);
    const endMins = parseTimeToMinutes(parts[1]);
    if (startMins < endMins) {
      const pad = (n: number) => n.toString().padStart(2, "0");
      const startHHMM = `${pad(Math.floor(startMins / 60))}:${pad(startMins % 60)}`;
      const endHHMM = `${pad(Math.floor(endMins / 60))}:${pad(endMins % 60)}`;
      return { openingTime: startHHMM, closingTime: endHHMM };
    }
  }
  return { openingTime: "09:00", closingTime: "18:00" };
}

/**
 * Generates an array of time slot strings dynamically based on:
 * - openingTime (e.g. "09:00")
 * - closingTime (e.g. "18:00")
 * - slotDurationMinutes (e.g. 30, 60, 90, 120)
 * - shootDurationMinutes (default to slotDurationMinutes if not provided)
 */
export function generateTimeSlots(
  openingTime: string = "09:00",
  closingTime: string = "18:00",
  slotDurationMinutes: number = 60,
  shootDurationMinutes?: number
): string[] {
  const start = parseHHMM(openingTime);
  const end = parseHHMM(closingTime);
  const step = Math.max(15, Number(slotDurationMinutes) || 60);
  const sessionDuration = Math.max(15, shootDurationMinutes || step);

  if (start >= end) return [];

  const slots: string[] = [];
  for (let m = start; m + sessionDuration <= end; m += step) {
    slots.push(minutesToTimeStr(m));
  }
  // If no slots generated because sessionDuration is larger than the window or slightly exceeds end,
  // ensure at least starting slots can be offered if start < end
  if (slots.length === 0 && start < end) {
    for (let m = start; m < end; m += step) {
      slots.push(minutesToTimeStr(m));
    }
  }
  return slots;
}

/**
 * Checks if a date falls on a blocked holiday date or full-day blackout.
 */
export function isDateBlocked(
  dateStr: string,
  blockedDates: string[] = [],
  blackouts: StudioBlackoutRule[] = []
): { isBlocked: boolean; reason?: string } {
  if (!dateStr) return { isBlocked: false };

  // 1. Studio owner blocked dates list (holidays)
  if (Array.isArray(blockedDates) && blockedDates.includes(dateStr)) {
    return {
      isBlocked: true,
      reason: "The studio is closed on this date (Scheduled holiday / blocked date)."
    };
  }

  // 2. Full-day blackout check
  const fullDay = blackouts.find(b => {
    if (b.blackoutDate !== dateStr) return false;
    const start = parseHHMM(b.startTime);
    const end = parseHHMM(b.endTime);
    return (start <= 540 && end >= 1080) || (start === 0 && end >= 1439);
  });

  if (fullDay) {
    return {
      isBlocked: true,
      reason: fullDay.reason ? `Studio closure: ${fullDay.reason}` : "The studio is blocked on this date."
    };
  }

  return { isBlocked: false };
}

/**
 * Finds the studio's configured availability rule for a given date.
 * If not configured explicitly by the owner, falls back dynamically to the studio's businessHours!
 */
export function getAvailabilityForDate(
  dateStr: string,
  availabilities: StudioAvailabilityRule[],
  studioBusinessHours?: string
): {
  isConfigured: boolean;
  isAvailable: boolean;
  openingTime: string;
  closingTime: string;
  slotDurationMinutes: number;
  dayName: string;
} {
  const targetDate = new Date(`${dateStr}T00:00:00`);
  const dayOfWeek = targetDate.getDay();
  const dayName = targetDate.toLocaleDateString("en-US", { weekday: "long" });

  const rule = availabilities.find(a => Number(a.dayOfWeek) === dayOfWeek);

  if (!rule) {
    const hours = parseBusinessHours(studioBusinessHours);
    return {
      isConfigured: false,
      isAvailable: true,
      openingTime: hours.openingTime,
      closingTime: hours.closingTime,
      slotDurationMinutes: 60,
      dayName
    };
  }

  return {
    isConfigured: true,
    isAvailable: Boolean(rule.isAvailable),
    openingTime: rule.openingTime || "09:00",
    closingTime: rule.closingTime || "18:00",
    slotDurationMinutes: Number(rule.slotDurationMinutes) || 60,
    dayName
  };
}

export interface SlotDetail {
  slot: string; // e.g. "09:00 AM"
  startMinutes: number;
  endMinutes: number;
  isBooked: boolean;
  isBlackout: boolean;
  isPast: boolean;
  available: boolean;
  status: "available" | "booked" | "blackout" | "past";
  reason?: string;
}

export interface ComputeDateSlotsOptions {
  dateStr: string;
  service?: any;
  packageObj?: any;
  studio?: any;
  availabilities?: StudioAvailabilityRule[];
  blackouts?: StudioBlackoutRule[];
  existingBookings?: any[];
  excludeBookingId?: string;
  services?: any[];
  packages?: any[];
}

export interface DateSlotsResult {
  isBlocked: boolean;
  blockedReason?: string;
  isClosed: boolean;
  closedReason?: string;
  isServiceDayUnavailable: boolean;
  serviceDayReason?: string;
  dayName: string;
  openingTime: string;
  closingTime: string;
  slotDurationMinutes: number;
  shootDurationMinutes: number;
  slots: SlotDetail[];
  availableCount: number;
  totalCount: number;
}

/**
 * Computes all available time slots and their real-time availability statuses for a given date.
 * Respects:
 * 1. Studio owner daily availability rules (or parsed studio business hours)
 * 2. Closed holidays & blackout dates
 * 3. Service-specific availableDays
 * 4. Service-specific availableSlots (if defined) or dynamic slot generation
 * 5. Overlapping bookings and partial blackouts
 * 6. Past times for the current day
 */
export function computeDateSlots(options: ComputeDateSlotsOptions): DateSlotsResult {
  const {
    dateStr,
    service,
    packageObj,
    studio,
    availabilities = [],
    blackouts = [],
    existingBookings = [],
    excludeBookingId = "",
    services = [],
    packages = []
  } = options;

  if (!dateStr) {
    return {
      isBlocked: false,
      isClosed: false,
      isServiceDayUnavailable: false,
      dayName: "",
      openingTime: "09:00",
      closingTime: "18:00",
      slotDurationMinutes: 60,
      shootDurationMinutes: 60,
      slots: [],
      availableCount: 0,
      totalCount: 0
    };
  }

  // 1. Day of week schedule & operating hours
  const daySchedule = getAvailabilityForDate(dateStr, availabilities, studio?.businessHours);

  // 2. Blocked holidays & full-day blackouts
  const blockedCheck = isDateBlocked(dateStr, studio?.blockedDates || [], blackouts);

  // 3. Shoot duration
  let shootDurationMinutes = 60;
  if (packageObj?.durationMinutes) {
    shootDurationMinutes = Number(packageObj.durationMinutes);
  } else if (service?.durationMinutes) {
    shootDurationMinutes = Number(service.durationMinutes);
  }

  // 4. Check service-specific availableDays (e.g. ['Tuesday', 'Wednesday', ...])
  let isServiceDayUnavailable = false;
  let serviceDayReason: string | undefined = undefined;
  if (service?.availableDays) {
    const allowedDays: string[] = Array.isArray(service.availableDays)
      ? service.availableDays.map(String)
      : (typeof service.availableDays === "string"
          ? service.availableDays.split(",").map((s: string) => s.trim()).filter(Boolean)
          : []);
    if (allowedDays.length > 0 && !allowedDays.includes(daySchedule.dayName)) {
      isServiceDayUnavailable = true;
      serviceDayReason = `"${service.name || "This service"}" is only available on ${allowedDays.join(", ")}.`;
    }
  }

  // If date is blocked or studio closed or service not available on this day
  if (blockedCheck.isBlocked || !daySchedule.isAvailable || isServiceDayUnavailable) {
    return {
      isBlocked: blockedCheck.isBlocked,
      blockedReason: blockedCheck.reason,
      isClosed: !daySchedule.isAvailable,
      closedReason: !daySchedule.isAvailable ? `The studio is closed on ${daySchedule.dayName}s.` : undefined,
      isServiceDayUnavailable,
      serviceDayReason,
      dayName: daySchedule.dayName,
      openingTime: daySchedule.openingTime,
      closingTime: daySchedule.closingTime,
      slotDurationMinutes: daySchedule.slotDurationMinutes,
      shootDurationMinutes,
      slots: [],
      availableCount: 0,
      totalCount: 0
    };
  }

  // 5. Determine candidate slots
  // Studio owner daily availability rule (or parsed business hours) is authoritative for working hours!
  let candidateSlots: string[] = [];
  const hasConfiguredSchedule = daySchedule.isConfigured || Boolean(studio?.businessHours);

  if (hasConfiguredSchedule) {
    candidateSlots = generateTimeSlots(
      daySchedule.openingTime,
      daySchedule.closingTime,
      daySchedule.slotDurationMinutes || 60,
      shootDurationMinutes
    );
  } else if (service?.availableSlots) {
    const rawSlots: string[] = Array.isArray(service.availableSlots)
      ? service.availableSlots.map(String)
      : (typeof service.availableSlots === "string"
          ? service.availableSlots.split(",").map((s: string) => s.trim()).filter(Boolean)
          : []);
    if (rawSlots.length > 0) {
      candidateSlots = rawSlots;
    }
  }

  // Fallback to studio schedule/defaults if candidateSlots is still empty
  if (candidateSlots.length === 0) {
    candidateSlots = generateTimeSlots(
      daySchedule.openingTime,
      daySchedule.closingTime,
      daySchedule.slotDurationMinutes || 60,
      shootDurationMinutes
    );
  }

  // 6. Real-time availability check for each slot
  const now = new Date();
  const todayStr = now.toISOString().split("T")[0];
  const isToday = dateStr === todayStr;
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  const studioOpenMins = parseHHMM(daySchedule.openingTime);
  const studioCloseMins = parseHHMM(daySchedule.closingTime);

  const slots: SlotDetail[] = [];

  for (const slot of candidateSlots) {
    const startMinutes = parseTimeToMinutes(slot);
    const endMinutes = startMinutes + shootDurationMinutes;

    // Check if slot falls outside studio working hours
    const isOutsideHours = (daySchedule.isConfigured || studio?.businessHours) && 
      (startMinutes < studioOpenMins || startMinutes >= studioCloseMins);

    // Check partial-day blackout
    const inBlackout = blackouts.some(b => {
      if (b.blackoutDate !== dateStr) return false;
      const bStart = parseHHMM(b.startTime);
      const bEnd = parseHHMM(b.endTime);
      return startMinutes < bEnd && endMinutes > bStart;
    });

    // Check existing booking conflict
    const inBooking = existingBookings.some((b: any) => {
      if (studio?.id && b.studioId && b.studioId !== studio.id) return false;
      if (excludeBookingId && b.id === excludeBookingId) return false;
      if (b.bookingDate !== dateStr) return false;
      if (["Cancelled", "Rejected", "Expired"].includes(b.status)) return false;

      let existingDuration = 60;
      if (b.packageId) {
        const p = packages.find((pkg: any) => pkg.id === b.packageId);
        if (p?.durationMinutes) existingDuration = Number(p.durationMinutes);
      } else if (b.serviceId) {
        const s = services.find((srv: any) => srv.id === b.serviceId);
        if (s?.durationMinutes) existingDuration = Number(s.durationMinutes);
      }

      const existingStart = parseTimeToMinutes(b.timeSlot);
      const existingEnd = existingStart + existingDuration;
      return startMinutes < existingEnd && endMinutes > existingStart;
    });

    // Check if time has already passed for today
    const isPast = isToday && startMinutes <= currentMinutes;

    let status: "available" | "booked" | "blackout" | "past" = "available";
    let reason: string | undefined = undefined;

    // Priority:
    // 1. inBooking: If a slot is booked, always display it as "booked" ("Already Booked")
    //    even if the current time has passed, so the studio owner and customer clearly see it was reserved.
    // 2. inBlackout || isOutsideHours: Studio closure or blackout
    // 3. isPast: Time slot has passed for today
    if (inBooking) {
      status = "booked";
      reason = "Slot is already booked.";
    } else if (inBlackout || isOutsideHours) {
      status = "blackout";
      reason = inBlackout ? "Studio blackout closure." : "Outside operating hours.";
    } else if (isPast) {
      status = "past";
      reason = "Time slot has already passed.";
    }

    slots.push({
      slot,
      startMinutes,
      endMinutes,
      isBooked: inBooking,
      isBlackout: inBlackout || isOutsideHours,
      isPast,
      available: status === "available",
      status,
      reason
    });
  }

  const availableCount = slots.filter(s => s.available).length;

  return {
    isBlocked: false,
    isClosed: false,
    isServiceDayUnavailable: false,
    dayName: daySchedule.dayName,
    openingTime: daySchedule.openingTime,
    closingTime: daySchedule.closingTime,
    slotDurationMinutes: daySchedule.slotDurationMinutes,
    shootDurationMinutes,
    slots,
    availableCount,
    totalCount: slots.length
  };
}
