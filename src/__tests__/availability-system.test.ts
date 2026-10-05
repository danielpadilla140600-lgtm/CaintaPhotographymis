import { describe, it, expect } from "vitest";
import {
  parseHHMM,
  parseTimeToMinutes,
  minutesToTimeStr,
  generateTimeSlots,
  isDateBlocked,
  getAvailabilityForDate,
  parseBusinessHours,
  computeDateSlots,
  StudioAvailabilityRule,
  StudioBlackoutRule
} from "../utils/availability.ts";

describe("Studio Availability & Dynamic Slot Generation", () => {
  it("parses 24-hour HH:MM correctly", () => {
    expect(parseHHMM("09:00")).toBe(540);
    expect(parseHHMM("18:30")).toBe(1110);
    expect(parseHHMM("00:00")).toBe(0);
    expect(parseHHMM("invalid")).toBe(0);
  });

  it("parses 12-hour strings to minutes", () => {
    expect(parseTimeToMinutes("09:00 AM")).toBe(540);
    expect(parseTimeToMinutes("12:00 PM")).toBe(720);
    expect(parseTimeToMinutes("01:30 PM")).toBe(810);
    expect(parseTimeToMinutes("06:00 PM")).toBe(1080);
    expect(parseTimeToMinutes("12:00 AM")).toBe(0);
  });

  it("formats minutes to 12-hour hh:mm A", () => {
    expect(minutesToTimeStr(540)).toBe("09:00 AM");
    expect(minutesToTimeStr(720)).toBe("12:00 PM");
    expect(minutesToTimeStr(810)).toBe("01:30 PM");
    expect(minutesToTimeStr(1080)).toBe("06:00 PM");
    expect(minutesToTimeStr(0)).toBe("12:00 AM");
  });

  it("dynamically generates 60-minute slots between 09:00 and 18:00", () => {
    const slots = generateTimeSlots("09:00", "18:00", 60);
    expect(slots).toEqual([
      "09:00 AM",
      "10:00 AM",
      "11:00 AM",
      "12:00 PM",
      "01:00 PM",
      "02:00 PM",
      "03:00 PM",
      "04:00 PM",
      "05:00 PM"
    ]);
    expect(slots.length).toBe(9);
  });

  it("dynamically generates 30-minute slots when owner configures 30 minutes", () => {
    const slots = generateTimeSlots("09:00", "12:00", 30);
    expect(slots).toEqual([
      "09:00 AM",
      "09:30 AM",
      "10:00 AM",
      "10:30 AM",
      "11:00 AM",
      "11:30 AM"
    ]);
  });

  it("dynamically generates 120-minute slots when owner configures 120 minutes", () => {
    const slots = generateTimeSlots("10:00", "16:00", 120);
    expect(slots).toEqual([
      "10:00 AM",
      "12:00 PM",
      "02:00 PM"
    ]);
  });

  it("respects shootDurationMinutes when longer than slot interval", () => {
    // 60-min interval, but session takes 90 mins, studio closes at 12:00
    const slots = generateTimeSlots("09:00", "12:00", 60, 90);
    // 09:00 (ends 10:30 <= 12:00) -> valid
    // 10:00 (ends 11:30 <= 12:00) -> valid
    // 11:00 (ends 12:30 > 12:00) -> invalid
    expect(slots).toEqual(["09:00 AM", "10:00 AM"]);
  });

  it("detects blocked dates in studio blockedDates", () => {
    const blockedDates = ["2026-12-25", "2026-01-01"];
    expect(isDateBlocked("2026-12-25", blockedDates).isBlocked).toBe(true);
    expect(isDateBlocked("2026-12-24", blockedDates).isBlocked).toBe(false);
  });

  it("detects full-day blackouts", () => {
    const blackouts: StudioBlackoutRule[] = [
      {
        studioId: "STD-1",
        blackoutDate: "2026-11-01",
        startTime: "00:00",
        endTime: "23:59",
        reason: "All Saints Day"
      }
    ];
    const check = isDateBlocked("2026-11-01", [], blackouts);
    expect(check.isBlocked).toBe(true);
    expect(check.reason).toContain("All Saints Day");
  });

  it("identifies when studio owner closed a specific day of week", () => {
    const rules: StudioAvailabilityRule[] = [
      {
        studioId: "STD-1",
        dayOfWeek: 0, // Sunday
        openingTime: "09:00",
        closingTime: "18:00",
        isAvailable: false,
        slotDurationMinutes: 60
      },
      {
        studioId: "STD-1",
        dayOfWeek: 1, // Monday
        openingTime: "10:00",
        closingTime: "19:00",
        isAvailable: true,
        slotDurationMinutes: 30
      }
    ];

    // 2026-10-11 is a Sunday
    const sundayCheck = getAvailabilityForDate("2026-10-11", rules);
    expect(sundayCheck.isConfigured).toBe(true);
    expect(sundayCheck.isAvailable).toBe(false);
    expect(sundayCheck.dayName).toBe("Sunday");

    // 2026-10-12 is a Monday
    const mondayCheck = getAvailabilityForDate("2026-10-12", rules);
    expect(mondayCheck.isConfigured).toBe(true);
    expect(mondayCheck.isAvailable).toBe(true);
    expect(mondayCheck.openingTime).toBe("10:00");
    expect(mondayCheck.closingTime).toBe("19:00");
    expect(mondayCheck.slotDurationMinutes).toBe(30);
  });

  it("parses studio businessHours correctly", () => {
    expect(parseBusinessHours("10:00 AM - 10:00 PM")).toEqual({ openingTime: "10:00", closingTime: "22:00" });
    expect(parseBusinessHours("09:00 AM - 07:00 PM")).toEqual({ openingTime: "09:00", closingTime: "19:00" });
    expect(parseBusinessHours("invalid")).toEqual({ openingTime: "09:00", closingTime: "18:00" });
  });

  it("falls back to studio.businessHours when unconfigured by owner", () => {
    // Unconfigured studio with 10:00 AM - 10:00 PM business hours
    const check = getAvailabilityForDate("2026-10-12", [], "10:00 AM - 10:00 PM");
    expect(check.isConfigured).toBe(false);
    expect(check.isAvailable).toBe(true);
    expect(check.openingTime).toBe("10:00");
    expect(check.closingTime).toBe("22:00");
  });

  it("computeDateSlots respects service-specific availableSlots and flags booked slots", () => {
    const service = {
      id: "SRV-1",
      name: "Graduation Shoot",
      availableSlots: ["09:00 AM", "10:30 AM", "01:00 PM", "02:30 PM", "04:00 PM"],
      availableDays: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
      durationMinutes: 60
    };
    const existingBookings = [
      {
        id: "BK-1",
        bookingDate: "2026-10-12", // Monday
        timeSlot: "10:30 AM",
        status: "Confirmed",
        serviceId: "SRV-1"
      }
    ];

    const result = computeDateSlots({
      dateStr: "2026-10-12",
      service,
      existingBookings
    });

    expect(result.isBlocked).toBe(false);
    expect(result.isClosed).toBe(false);
    expect(result.isServiceDayUnavailable).toBe(false);
    expect(result.totalCount).toBe(5);
    expect(result.availableCount).toBe(4);

    const bookedSlot = result.slots.find(s => s.slot === "10:30 AM");
    expect(bookedSlot?.isBooked).toBe(true);
    expect(bookedSlot?.available).toBe(false);
    expect(bookedSlot?.status).toBe("booked");

    const availableSlot = result.slots.find(s => s.slot === "09:00 AM");
    expect(availableSlot?.isBooked).toBe(false);
    expect(availableSlot?.available).toBe(true);
    expect(availableSlot?.status).toBe("available");
  });

  it("computeDateSlots flags service day restriction when date is outside availableDays", () => {
    const service = {
      id: "SRV-1",
      name: "Maternity",
      availableDays: ["Tuesday", "Wednesday", "Thursday"],
      durationMinutes: 60
    };

    // 2026-10-11 is Sunday
    const result = computeDateSlots({
      dateStr: "2026-10-11",
      service
    });

    expect(result.isServiceDayUnavailable).toBe(true);
    expect(result.serviceDayReason).toContain("only available on Tuesday, Wednesday, Thursday");
    expect(result.slots.length).toBe(0);
  });

  it("prioritizes studio owner configured 9am to 6pm availability over legacy service availableSlots", () => {
    // Studio owner configured Monday (dayOfWeek = 1) from 09:00 to 18:00
    const availabilities = [
      {
        id: "AVL-1",
        studioId: "STU-1",
        dayOfWeek: 1, // Monday
        openingTime: "09:00",
        closingTime: "18:00",
        isAvailable: true,
        slotDurationMinutes: 60
      }
    ];

    // Service has old legacy slots only up to 3:00 PM
    const service = {
      id: "SRV-LEGACY",
      name: "Graduation",
      availableSlots: ["09:00 AM", "10:30 AM", "01:00 PM", "03:00 PM"],
      durationMinutes: 60
    };

    // Customer has a booking at 03:00 PM
    const existingBookings = [
      {
        id: "BK-123",
        studioId: "STU-1",
        bookingDate: "2026-10-12", // Monday
        timeSlot: "03:00 PM",
        status: "Confirmed",
        serviceId: "SRV-LEGACY"
      }
    ];

    const result = computeDateSlots({
      dateStr: "2026-10-12", // Monday
      service,
      availabilities,
      existingBookings,
      studio: { id: "STU-1", businessHours: "09:00 AM - 06:00 PM" }
    });

    // Should generate all slots from 9:00 AM to 6:00 PM (9 slots: 9am, 10am, 11am, 12pm, 1pm, 2pm, 3pm, 4pm, 5pm)
    expect(result.slots.length).toBe(9);
    expect(result.slots.map(s => s.slot)).toEqual([
      "09:00 AM", "10:00 AM", "11:00 AM", "12:00 PM",
      "01:00 PM", "02:00 PM", "03:00 PM", "04:00 PM", "05:00 PM"
    ]);

    // 03:00 PM must be marked as booked
    const slot3pm = result.slots.find(s => s.slot === "03:00 PM");
    expect(slot3pm?.isBooked).toBe(true);
    expect(slot3pm?.status).toBe("booked");
    expect(slot3pm?.available).toBe(false);

    // 04:00 PM and 05:00 PM must be available!
    const slot4pm = result.slots.find(s => s.slot === "04:00 PM");
    expect(slot4pm?.isBooked).toBe(false);
    expect(slot4pm?.status).toBe("available");
    expect(slot4pm?.available).toBe(true);

    const slot5pm = result.slots.find(s => s.slot === "05:00 PM");
    expect(slot5pm?.isBooked).toBe(false);
    expect(slot5pm?.status).toBe("available");
    expect(slot5pm?.available).toBe(true);

    // 8 out of 9 slots available
    expect(result.availableCount).toBe(8);
  });
});

