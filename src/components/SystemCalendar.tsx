import React, { useState } from "react";
import {
  ChevronLeft, ChevronRight, Calendar as CalendarIcon, Clock,
  User as UserIcon, Eye, Sparkles, Filter,
  Grid, List, Users
} from "lucide-react";
import { Booking, Studio } from "../db/types";
import BookingDetailsModal from "./BookingDetailsModal";

/** Formats a Date as YYYY-MM-DD in local time */
export const toDateStr = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

interface SystemCalendarProps {
  bookings: Booking[];
  studio?: Studio;
  services?: any[];
  packages?: any[];
  addons?: any[];
  userRole?: "STUDIO_ADMIN" | "CUSTOMER" | "SUPER_ADMIN";
  onSelectBooking?: (booking: Booking) => void;
  onOpenProofing?: (bookingId: string) => void;
  onRequestBookingDate?: (dateStr: string) => void;
}

export const SystemCalendar: React.FC<SystemCalendarProps> = ({
  bookings,
  studio,
  services = [],
  packages = [],
  addons = [],
  userRole = "STUDIO_ADMIN",
  onSelectBooking,
  onOpenProofing,
  onRequestBookingDate
}) => {
  const [currentDate, setCurrentDate] = useState<Date>(new Date()); // Default to real current month
  const [selectedDateStr, setSelectedDateStr] = useState<string | null>(null);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [mobileView, setMobileView] = useState<"grid" | "agenda">("grid");

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  // Days in month calculation
  const firstDayOfMonth = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  // Filter bookings for current active status filter (exclude archived)
  const filteredBookings = bookings.filter(b => {
    if (b.isArchived) return false; // always hide archived bookings from calendar
    if (statusFilter === "ALL") return true;
    return b.status.toUpperCase() === statusFilter.toUpperCase();
  });

  // Map bookings by date string (YYYY-MM-DD)
  const bookingsByDate: { [dateStr: string]: Booking[] } = {};
  filteredBookings.forEach(b => {
    if (!bookingsByDate[b.bookingDate]) {
      bookingsByDate[b.bookingDate] = [];
    }
    bookingsByDate[b.bookingDate].push(b);
  });

  // Generate calendar day cells
  const calendarDays = [];
  // Empty padding cells for previous month
  for (let i = 0; i < firstDayOfMonth; i++) {
    calendarDays.push(null);
  }
  // Days of current month
  for (let d = 1; d <= daysInMonth; d++) {
    const monthStr = String(month + 1).padStart(2, "0");
    const dayStr = String(d).padStart(2, "0");
    const dateStr = `${year}-${monthStr}-${dayStr}`;
    calendarDays.push({
      dayNumber: d,
      dateStr,
      dayBookings: bookingsByDate[dateStr] || []
    });
  }

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case "confirmed":
      case "approved":
        return "bg-emerald-100 text-emerald-800 border-emerald-300";
      case "pending":
        return "bg-amber-100 text-amber-800 border-amber-300";
      case "awaiting payment":
        return "bg-orange-100 text-orange-800 border-orange-300";
      case "rescheduled":
        return "bg-indigo-100 text-indigo-800 border-indigo-300";
      case "ongoing":
        return "bg-cyan-100 text-cyan-800 border-cyan-300";
      case "completed":
        return "bg-blue-100 text-blue-800 border-blue-300";
      case "cancelled":
      case "rejected":
      case "expired":
        return "bg-rose-100 text-rose-800 border-rose-300";
      default:
        return "bg-gray-100 text-gray-800 border-gray-300";
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-[#e5e1da] p-3 sm:p-5 shadow-sm space-y-4 text-left">
      {/* Calendar Header Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#e5e1da] pb-3">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 bg-amber-50 px-2.5 py-1 rounded-md border border-amber-200 inline-flex items-center gap-1 mb-1">
            <Sparkles size={12} /> Cainta Studio Built-in Calendar
          </span>
          <h3 className="font-display text-xl font-extrabold text-[#2c2a29]">
            {monthNames[month]} {year} Schedule
          </h3>
          <p className="text-xs text-[#7c756d]">
            Interactive system calendar for photoshoot appointments & studio availability
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Mobile View Toggle */}
          <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-xl sm:hidden">
            <button
              onClick={() => setMobileView("grid")}
              className={`p-1.5 rounded-lg text-xs font-bold cursor-pointer ${
                mobileView === "grid" ? "bg-[#2c2a29] text-white" : "text-gray-600"
              }`}
              title="Month Grid"
            >
              <Grid size={15} />
            </button>
            <button
              onClick={() => setMobileView("agenda")}
              className={`p-1.5 rounded-lg text-xs font-bold cursor-pointer ${
                mobileView === "agenda" ? "bg-[#2c2a29] text-white" : "text-gray-600"
              }`}
              title="Agenda List"
            >
              <List size={15} />
            </button>
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-1 bg-[#faf9f6] p-1 rounded-xl border border-[#e5e1da] text-xs overflow-x-auto max-w-full">
            <Filter size={12} className="text-gray-400 ml-1.5 shrink-0" />
            {["ALL", "CONFIRMED", "PENDING", "COMPLETED"].map(st => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-2 py-1 rounded-lg font-bold text-[10px] sm:text-[11px] transition-all cursor-pointer whitespace-nowrap ${
                  statusFilter === st
                    ? "bg-[#2c2a29] text-white shadow-xs"
                    : "text-[#7c756d] hover:text-[#2c2a29]"
                }`}
              >
                {st}
              </button>
            ))}
          </div>

          {/* Month Navigation */}
          <div className="flex items-center gap-1">
            <button
              onClick={handleToday}
              className="px-2.5 py-1.5 bg-[#faf9f6] hover:bg-gray-100 text-[#2c2a29] border border-[#e5e1da] rounded-xl text-xs font-bold cursor-pointer"
            >
              Today
            </button>
            <button
              onClick={handlePrevMonth}
              className="p-1.5 bg-[#faf9f6] hover:bg-gray-100 text-[#2c2a29] border border-[#e5e1da] rounded-xl cursor-pointer"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              onClick={handleNextMonth}
              className="p-1.5 bg-[#faf9f6] hover:bg-gray-100 text-[#2c2a29] border border-[#e5e1da] rounded-xl cursor-pointer"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* AGENDA LIST VIEW (FOR MOBILE OR TOGGLED) */}
      {mobileView === "agenda" && (
        <div className="space-y-3">
          <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider">
            Agenda for {monthNames[month]} {year}
          </h4>
          {filteredBookings.length === 0 ? (
            <div className="p-8 text-center bg-[#faf9f6] rounded-2xl border border-dashed border-gray-200">
              <CalendarIcon size={28} className="mx-auto text-gray-400 mb-2" />
              <p className="text-xs text-gray-500 font-semibold">No bookings found for selected filter.</p>
            </div>
          ) : (
            filteredBookings.map(b => (
              <button
                type="button"
                key={b.id}
                onClick={() => {
                  setSelectedBooking(b);
                  if (onSelectBooking) onSelectBooking(b);
                }}
                className="w-full text-left p-3 bg-white border border-[#e5e1da] rounded-2xl flex items-center justify-between gap-3 shadow-xs hover:border-amber-400 cursor-pointer transition-all"
              >
                <div className="space-y-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-extrabold text-[#2c2a29]">{b.bookingDate} · {b.timeSlot}</span>
                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded border uppercase ${getStatusColor(b.status)}`}>
                      {b.status}
                    </span>
                  </div>
                  <p className="text-xs text-gray-600 font-bold truncate flex items-center gap-1">
                    <UserIcon size={11} className="text-gray-400 shrink-0" />
                    {b.customerDetails?.fullName || `Booking #${b.id}`}
                  </p>
                  <p className="text-[10px] text-gray-500 truncate">
                    {(b as any).serviceName || (b as any).packageName || "Photoshoot"} · {b.customerDetails?.phone || "No contact"}
                  </p>
                </div>
                <span className="px-3 py-1.5 bg-[#2c2a29] text-white text-xs font-bold rounded-xl shrink-0 flex items-center gap-1">
                  <Eye size={12} /> Full Details
                </span>
              </button>
            ))
          )}
        </div>
      )}

      {/* MONTH GRID VIEW */}
      {mobileView === "grid" && (
        <>
          {/* Weekday Labels Header */}
          <div className="grid grid-cols-7 gap-1 sm:gap-2 text-center">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(day => (
              <div key={day} className="text-[10px] sm:text-[11px] font-extrabold uppercase tracking-wider text-[#7c756d] py-1 bg-[#faf9f6] rounded-lg border border-gray-100">
                {day}
              </div>
            ))}
          </div>

          {/* Month Calendar Grid */}
          <div className="grid grid-cols-7 gap-1">
            {calendarDays.map((cell, idx) => {
              if (!cell) {
                return (
                  <div key={`empty-${idx}`} className="min-h-[45px] sm:min-h-[70px] bg-[#faf9f6]/40 rounded-xl border border-dashed border-gray-100" />
                );
              }

              const isToday = cell.dateStr === toDateStr(new Date());
              const isSelected = selectedDateStr === cell.dateStr;
              const hasBookings = cell.dayBookings.length > 0;

              return (
                <div
                  key={cell.dateStr}
                  onClick={() => setSelectedDateStr(cell.dateStr)}
                  className={`min-h-[50px] sm:min-h-[75px] p-1 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                    isSelected
                      ? "bg-amber-50/50 border-amber-400 ring-2 ring-amber-400/20 shadow-sm"
                      : isToday
                      ? "bg-emerald-50/40 border-emerald-300 ring-1 ring-emerald-300"
                      : "bg-white border-[#e5e1da] hover:border-gray-400 hover:shadow-xs"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center ${
                      isToday 
                        ? "bg-emerald-600 text-white" 
                        : isSelected 
                        ? "bg-amber-500 text-white" 
                        : "text-[#2c2a29]"
                    }`}>
                      {cell.dayNumber}
                    </span>

                    {hasBookings && (
                      <span className="text-[8px] font-bold text-amber-700 bg-amber-100 px-1 py-0.2 rounded-full border border-amber-200">
                        {cell.dayBookings.length}
                      </span>
                    )}
                  </div>

                  {/* Day's Bookings List Badges — shows sino (customer) at ano (time); click opens full details */}
                  <div className="space-y-0.5 my-0.5 overflow-y-auto max-h-[30px] sm:max-h-[40px]">
                    {cell.dayBookings.map(b => (
                      <button
                        type="button"
                        key={b.id}
                        title={`${b.customerDetails?.fullName || `Booking #${b.id}`} — ${b.timeSlot} — click for full details`}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedBooking(b);
                          if (onSelectBooking) onSelectBooking(b);
                        }}
                        className={`w-full p-0.5 rounded-md border text-[8px] font-semibold truncate hover:scale-[1.02] transition-transform text-left cursor-pointer ${getStatusColor(b.status)}`}
                      >
                        <span className="truncate block">{b.timeSlot} · {b.customerDetails?.fullName || b.id}</span>
                      </button>
                    ))}
                  </div>

                  {cell.dayBookings.length === 0 && (
                    <span className="text-[8px] text-gray-300 italic text-center hidden sm:block mt-auto">Free</span>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Selected Date Summary Banner */}
      {selectedDateStr && (
        <div className="p-4 bg-[#faf9f6] border border-[#e5e1da] rounded-2xl space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h4 className="text-xs font-bold text-[#2c2a29]">
                Schedule for {selectedDateStr}
              </h4>
              <p className="text-[11px] text-[#7c756d]">
                {bookingsByDate[selectedDateStr]?.length || 0} photoshoot appointments scheduled on this date.
              </p>
            </div>

            <div className="flex items-center gap-2">
              {onRequestBookingDate && (
                <button
                  onClick={() => onRequestBookingDate(selectedDateStr)}
                  className="px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 cursor-pointer shadow-sm"
                >
                  <Sparkles size={13} /> Request Booking on this Date
                </button>
              )}
              <button
                onClick={() => setSelectedDateStr(null)}
                className="text-[11px] font-bold text-gray-500 hover:text-black px-3 py-1.5 rounded-lg border border-gray-200"
              >
                Clear
              </button>
            </div>
          </div>

          {/* Full day schedule list — sino (customer) at ano (service/package, time, status) */}
          {(bookingsByDate[selectedDateStr] || []).length > 0 && (
            <div className="space-y-2">
              <p className="text-[10px] font-extrabold uppercase tracking-widest text-[#7c756d] flex items-center gap-1.5">
                <Users size={12} /> Full schedule — click a booking for complete details
              </p>
              <div className="space-y-2 max-h-64 overflow-y-auto pr-0.5">
                {(bookingsByDate[selectedDateStr] || []).map(b => (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => {
                      setSelectedBooking(b);
                      if (onSelectBooking) onSelectBooking(b);
                    }}
                    className="w-full text-left p-3 bg-white border border-[#e5e1da] rounded-2xl flex items-center justify-between gap-3 shadow-xs hover:border-amber-400 hover:shadow-sm cursor-pointer transition-all"
                  >
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-extrabold text-[#2c2a29] flex items-center gap-1">
                          <Clock size={11} className="text-amber-600" /> {b.timeSlot}
                        </span>
                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded border uppercase ${getStatusColor(b.status)}`}>
                          {b.status}
                        </span>
                      </div>
                      <p className="text-xs font-bold text-[#2c2a29] truncate flex items-center gap-1">
                        <UserIcon size={11} className="text-gray-400 shrink-0" />
                        {b.customerDetails?.fullName || `Booking #${b.id}`}
                      </p>
                      <p className="text-[10px] text-gray-500 truncate">
                        {(b as any).serviceName || (b as any).packageName || "Photoshoot"} · {b.customerDetails?.phone || "No contact"} · {b.paymentStatus || "Unpaid"}
                      </p>
                    </div>
                    <span className="px-3 py-1.5 bg-[#2c2a29] text-white text-[10px] font-bold rounded-xl shrink-0 flex items-center gap-1">
                      <Eye size={11} /> Full Details
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Full booking details modal when a calendar schedule is clicked.
          Studio owner sees sino (customer) at ano (service, package, addons,
          schedule, payment) — same full details modal used in Bookings tab. */}
      {selectedBooking && (
        <BookingDetailsModal
          booking={selectedBooking}
          studio={studio}
          services={services}
          packages={packages}
          addons={addons}
          onClose={() => setSelectedBooking(null)}
        />
      )}
    </div>
  );
};
