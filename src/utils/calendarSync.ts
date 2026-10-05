// Calendar Sync Utility for Google Calendar & iCal (.ics) exports

export interface CalendarEvent {
  title: string;
  description: string;
  location: string;
  startDate: string; // YYYY-MM-DD
  timeSlot: string;  // e.g. "09:00 AM" or "02:00 PM"
  durationMinutes?: number;
}

function parseDateTime(dateStr: string, timeStr: string): Date {
  const [year, month, day] = dateStr.split("-").map(Number);
  let hours = 9;
  let minutes = 0;

  if (timeStr) {
    const cleanTime = timeStr.trim();
    const isPM = cleanTime.toUpperCase().includes("PM");
    const isAM = cleanTime.toUpperCase().includes("AM");
    const numbers = cleanTime.replace(/[^0-9:]/g, "");
    const parts = numbers.split(":");
    
    if (parts.length >= 1) hours = parseInt(parts[0], 10) || 9;
    if (parts.length >= 2) minutes = parseInt(parts[1], 10) || 0;

    if (isPM && hours < 12) hours += 12;
    if (isAM && hours === 12) hours = 0;
  }

  return new Date(Date.UTC(year, month - 1, day, hours, minutes));
}

function formatDateToISOString(date: Date): string {
  return date.toISOString().replace(/-|:|\.\d+/g, "");
}

/**
 * Generates a Google Calendar quick-add URL
 */
export function getGoogleCalendarUrl(event: CalendarEvent): string {
  const start = parseDateTime(event.startDate, event.timeSlot);
  const duration = event.durationMinutes || 60;
  const end = new Date(start.getTime() + duration * 60 * 1000);

  const startIso = formatDateToISOString(start);
  const endIso = formatDateToISOString(end);

  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: event.title,
    details: event.description,
    location: event.location,
    dates: `${startIso}/${endIso}`
  });

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

/**
 * Downloads an iCal (.ics) file for Apple Calendar, Outlook, or mobile phones
 */
export function downloadIcsFile(event: CalendarEvent) {
  const start = parseDateTime(event.startDate, event.timeSlot);
  const duration = event.durationMinutes || 60;
  const end = new Date(start.getTime() + duration * 60 * 1000);

  const startIso = formatDateToISOString(start);
  const endIso = formatDateToISOString(end);

  const icsContent = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Cainta Photography Studio MIS//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:REQUEST",
    "BEGIN:VEVENT",
    `UID:bk-${Date.now()}@cainta-mis.com`,
    `DTSTAMP:${formatDateToISOString(new Date())}`,
    `DTSTART:${startIso}`,
    `DTEND:${endIso}`,
    `SUMMARY:${event.title.replace(/\n/g, " ")}`,
    `DESCRIPTION:${event.description.replace(/\n/g, " ")}`,
    `LOCATION:${event.location.replace(/\n/g, " ")}`,
    "STATUS:CONFIRMED",
    "END:VEVENT",
    "END:VCALENDAR"
  ].join("\r\n");

  const blob = new Blob([icsContent], { type: "text/calendar;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", `${event.title.replace(/[^a-z0-9]/gi, "_").toLowerCase()}_schedule.ics`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
