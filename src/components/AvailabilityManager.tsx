import React, { useEffect, useMemo, useState } from "react";
import { CalendarDays, Clock, Lock, Save } from "lucide-react";
import { apiRequest, ApiError } from "../utils/apiClient.ts";

interface AvailabilityManagerProps {
  currentUser: any;
  studio: any;
  onRefresh?: () => void;
}

const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday"
];

export default function AvailabilityManager({ currentUser, studio, onRefresh }: AvailabilityManagerProps) {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string>("");

  const isOwner = useMemo(() => {
    return currentUser?.role === "STUDIO_ADMIN" && currentUser?.id === studio?.ownerId;
  }, [currentUser, studio]);

  const makeDefaultRows = () => {
    return DAY_NAMES.map((day, index) => ({
      id: "",
      studioId: studio?.id,
      dayOfWeek: index,
      openingTime: "09:00",
      closingTime: "18:00",
      isAvailable: true,
      slotDurationMinutes: 60
    }));
  };

  const loadAvailability = async () => {
    if (!studio?.id) return;
    setLoading(true);
    try {
      const data = await apiRequest(`/api/studios/${studio.id}/availability`);
      if (!data.success) {
        throw new Error(data.message || "Unable to load studio availability.");
      }

      const existing = Array.isArray(data.availability) ? data.availability : [];
      if (existing.length === 0) {
        setRows(makeDefaultRows());
      } else {
        const normalized = DAY_NAMES.map((_, index) => {
          const row = existing.find((item: any) => Number(item.dayOfWeek) === index);
          return row || {
            id: "",
            studioId: studio.id,
            dayOfWeek: index,
            openingTime: "09:00",
            closingTime: "18:00",
            isAvailable: true,
            slotDurationMinutes: 60
          };
        });
        setRows(normalized);
      }
    } catch (err) {
      console.error(err);
      setRows(makeDefaultRows());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAvailability();
  }, [studio?.id, currentUser?.authToken]);

  const handleFieldChange = (dayOfWeek: number, field: string, value: any) => {
    setRows(current => current.map(row => row.dayOfWeek === dayOfWeek ? { ...row, [field]: value } : row));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isOwner) {
      setMessage("Only the studio owner can manage availability.");
      return;
    }

    setSaving(true);
    setMessage("");

    try {
      const results = [];
      for (const row of rows) {
        const payload = {
          studioId: studio.id,
          dayOfWeek: row.dayOfWeek,
          openingTime: row.openingTime,
          closingTime: row.closingTime,
          isAvailable: row.isAvailable,
          slotDurationMinutes: Number(row.slotDurationMinutes) || 60
        };

        const data = row.id
          ? await apiRequest(`/api/studios/${studio.id}/availability/${row.id}`, { method: "PUT", body: payload })
          : await apiRequest(`/api/studios/${studio.id}/availability`, { method: "POST", body: payload });
        if (!data.success) {
          throw new Error(data.message || "Unable to save availability.");
        }
        results.push(data.availability || data.item || row);
      }

      setMessage("Availability saved successfully.");
      onRefresh?.();
      await loadAvailability();
    } catch (err) {
      console.error(err);
      setMessage(err instanceof Error ? err.message : "Unable to save availability.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-3xl border border-[#e5e1da] shadow-sm p-6 space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-[#2c2a29]">
            <CalendarDays size={18} />
            <h3 className="font-display text-lg font-bold">Studio Owner Availability</h3>
          </div>
          <p className="text-xs text-[#7c756d] mt-1">Manage weekly hours for your studio. Only the studio owner can set availability.</p>
        </div>
        <div className="flex items-center gap-2 text-[11px] font-bold text-[#7c756d]">
          <Clock size={14} /> {DAY_NAMES.length} days
        </div>
      </div>

      {!isOwner && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-bold text-amber-800">
          <Lock size={14} className="inline-block mr-2" /> Studio staff members can view bookings, but only the studio owner may manage availability.
        </div>
      )}

      {loading ? <div className="text-xs text-[#7c756d]">Loading availability...</div> : (
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid gap-3">
            {rows.map(row => (
              <div key={row.dayOfWeek} className="grid grid-cols-12 gap-3 items-center rounded-2xl border border-[#e5e1da] p-3">
                <div className="col-span-3 sm:col-span-2">
                  <label className="text-[10px] font-bold uppercase text-[#7c756d] block">{DAY_NAMES[row.dayOfWeek]}</label>
                  <label className="inline-flex items-center gap-2 text-[10px] font-bold text-[#2c2a29] mt-2">
                    <input
                      type="checkbox"
                      checked={Boolean(row.isAvailable)}
                      disabled={!isOwner}
                      onChange={e => handleFieldChange(row.dayOfWeek, "isAvailable", e.target.checked)}
                    />
                    Available
                  </label>
                </div>

                <div className="col-span-4 sm:col-span-3">
                  <label className="text-[10px] font-bold uppercase text-[#7c756d] block">Opening</label>
                  <input
                    type="time"
                    value={row.openingTime || "09:00"}
                    disabled={!isOwner}
                    onChange={e => handleFieldChange(row.dayOfWeek, "openingTime", e.target.value)}
                    className="w-full mt-1 bg-white border border-[#e5e1da] rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-[#2c2a29]"
                  />
                </div>

                <div className="col-span-4 sm:col-span-3">
                  <label className="text-[10px] font-bold uppercase text-[#7c756d] block">Closing</label>
                  <input
                    type="time"
                    value={row.closingTime || "18:00"}
                    disabled={!isOwner}
                    onChange={e => handleFieldChange(row.dayOfWeek, "closingTime", e.target.value)}
                    className="w-full mt-1 bg-white border border-[#e5e1da] rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-[#2c2a29]"
                  />
                </div>

                <div className="col-span-4 sm:col-span-3">
                  <label className="text-[10px] font-bold uppercase text-[#7c756d] block">Slot Length</label>
                  <select
                    value={row.slotDurationMinutes || 60}
                    disabled={!isOwner}
                    onChange={e => handleFieldChange(row.dayOfWeek, "slotDurationMinutes", Number(e.target.value))}
                    className="w-full mt-1 bg-white border border-[#e5e1da] rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-[#2c2a29]"
                  >
                    <option value={30}>30 minutes</option>
                    <option value={60}>60 minutes</option>
                    <option value={90}>90 minutes</option>
                    <option value={120}>120 minutes</option>
                  </select>
                </div>
              </div>
            ))}
          </div>

          {message && <div className="text-xs font-bold text-[#2c2a29]">{message}</div>}

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={!isOwner || saving}
              className="px-4 py-2 bg-[#2c2a29] text-white rounded-xl font-bold text-[10px] uppercase tracking-wider cursor-pointer disabled:opacity-60"
            >
              <Save size={14} className="inline-block mr-1" /> {saving ? "Saving..." : "Save Availability"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

