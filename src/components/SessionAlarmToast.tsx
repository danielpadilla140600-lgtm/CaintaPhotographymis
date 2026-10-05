import React, { useEffect, useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, Clock, MapPin, Camera, Volume2, VolumeX } from "lucide-react";

export interface AlarmSession {
  bookingId: string;
  serviceName: string;
  studioName: string;
  timeSlot: string;
  bookingDate: string;
  minutesLeft: number;
}

interface SessionAlarmToastProps {
  sessions: AlarmSession[]; // sessions within alarm threshold
}

// ─── Web Audio Alarm ─────────────────────────────────────────────────────────
function playAlarm(ctx: AudioContext): void {
  // Three-beep alarm pattern: 880 Hz → 1100 Hz → 880 Hz
  const beepPattern = [
    { freq: 880,  start: 0.00, duration: 0.18 },
    { freq: 1100, start: 0.22, duration: 0.18 },
    { freq: 880,  start: 0.44, duration: 0.18 },
    { freq: 1100, start: 0.66, duration: 0.18 },
    { freq: 880,  start: 0.88, duration: 0.18 },
    { freq: 1320, start: 1.10, duration: 0.28 }, // final long tone
  ];

  const masterGain = ctx.createGain();
  masterGain.gain.setValueAtTime(0.35, ctx.currentTime);
  masterGain.connect(ctx.destination);

  beepPattern.forEach(({ freq, start, duration }) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, ctx.currentTime + start);
    gain.gain.setValueAtTime(0, ctx.currentTime + start);
    gain.gain.linearRampToValueAtTime(1, ctx.currentTime + start + 0.01);
    gain.gain.setValueAtTime(1, ctx.currentTime + start + duration - 0.02);
    gain.gain.linearRampToValueAtTime(0, ctx.currentTime + start + duration);
    osc.connect(gain);
    gain.connect(masterGain);
    osc.start(ctx.currentTime + start);
    osc.stop(ctx.currentTime + start + duration + 0.01);
  });
}

// ─── Alarm state tracking (per-session, per-browser-session) ─────────────────
const STORAGE_KEY = "session_alarm_shown_v1";

function getAlarmedIds(): Set<string> {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return new Set(raw ? JSON.parse(raw) : []);
  } catch {
    return new Set();
  }
}

function markAlarmed(bookingId: string): void {
  try {
    const ids = getAlarmedIds();
    ids.add(bookingId);
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify([...ids]));
  } catch { /* ignore */ }
}

// ─── Component ────────────────────────────────────────────────────────────────
const SessionAlarmToast: React.FC<SessionAlarmToastProps> = ({ sessions }) => {
  const [visible, setVisible] = useState<AlarmSession[]>([]);
  const [muted, setMuted] = useState(false);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const alarmTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mutedRef = useRef(false);

  mutedRef.current = muted;

  const triggerAlarm = useCallback((ctx: AudioContext) => {
    if (!mutedRef.current) playAlarm(ctx);
  }, []);

  useEffect(() => {
    if (!sessions || sessions.length === 0) return;

    const alarmedIds = getAlarmedIds();
    const newSessions = sessions.filter(s => !alarmedIds.has(s.bookingId));
    if (newSessions.length === 0) return;

    newSessions.forEach(s => markAlarmed(s.bookingId));

    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    const ctx = audioCtxRef.current;
    if (ctx.state === "suspended") ctx.resume();

    setVisible(prev => {
      const existingIds = new Set(prev.map(p => p.bookingId));
      const additions = newSessions.filter(s => !existingIds.has(s.bookingId));
      return [...prev, ...additions];
    });

    triggerAlarm(ctx);
    let count = 1;
    alarmTimerRef.current = setInterval(() => {
      if (count >= 3) {
        clearInterval(alarmTimerRef.current!);
        return;
      }
      triggerAlarm(ctx);
      count++;
    }, 8000);

    return () => {
      if (alarmTimerRef.current) clearInterval(alarmTimerRef.current);
    };
  }, [sessions]);

  const dismiss = (bookingId: string) => {
    setVisible(prev => prev.filter(s => s.bookingId !== bookingId));
  };

  const dismissAll = () => setVisible([]);

  if (visible.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-3 max-w-sm w-full pointer-events-none">
      <AnimatePresence mode="popLayout">
        {visible.map((session) => {
          const isVeryUrgent = session.minutesLeft <= 30;
          return (
            <motion.div
              key={session.bookingId}
              initial={{ opacity: 0, x: 80, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 80, scale: 0.85 }}
              transition={{ type: "spring", stiffness: 400, damping: 28 }}
              className="pointer-events-auto"
            >
              <div className={`relative rounded-2xl shadow-2xl overflow-hidden border-2 ${
                isVeryUrgent
                  ? "bg-gradient-to-br from-red-600 to-rose-700 border-red-400"
                  : "bg-gradient-to-br from-amber-500 to-orange-600 border-amber-400"
              }`}>
                {/* Pulsing glow ring */}
                <motion.div
                  className={`absolute inset-0 rounded-2xl ${
                    isVeryUrgent ? "bg-red-400/20" : "bg-amber-400/20"
                  }`}
                  animate={{ opacity: [0, 0.6, 0] }}
                  transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
                />

                <div className="relative p-4">
                  {/* Header */}
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-2.5">
                      <motion.div
                        className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0"
                        animate={{ rotate: [0, -15, 15, -10, 10, 0] }}
                        transition={{ duration: 0.6, repeat: Infinity, repeatDelay: 1.5 }}
                      >
                        <Clock size={20} className="text-white" />
                      </motion.div>
                      <div>
                        <p className="text-white font-black text-sm leading-tight">
                          {isVeryUrgent ? "🚨 Session Starting Soon!" : "⏰ Session in Under 2 Hours!"}
                        </p>
                        <p className="text-white/80 text-[11px] font-medium">
                          {session.minutesLeft < 60
                            ? `${session.minutesLeft} minute${session.minutesLeft !== 1 ? "s" : ""} away`
                            : `${(session.minutesLeft / 60).toFixed(1)} hours away`}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        onClick={() => setMuted(m => !m)}
                        className="w-7 h-7 rounded-lg bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors cursor-pointer"
                        title={muted ? "Unmute alarm" : "Mute alarm"}
                      >
                        {muted
                          ? <VolumeX size={13} className="text-white" />
                          : <Volume2 size={13} className="text-white" />
                        }
                      </button>
                      <button
                        onClick={() => dismiss(session.bookingId)}
                        className="w-7 h-7 rounded-lg bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors cursor-pointer"
                        title="Dismiss"
                      >
                        <X size={13} className="text-white" />
                      </button>
                    </div>
                  </div>

                  {/* Session details */}
                  <div className="bg-white/15 rounded-xl p-3 space-y-1.5">
                    <div className="flex items-center gap-2">
                      <Camera size={12} className="text-white/70 flex-shrink-0" />
                      <span className="text-white font-bold text-xs truncate">{session.serviceName}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <MapPin size={12} className="text-white/70 flex-shrink-0" />
                      <span className="text-white/90 text-xs truncate">{session.studioName}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock size={12} className="text-white/70 flex-shrink-0" />
                      <span className="text-white/90 text-xs">{session.timeSlot} · {session.bookingDate}</span>
                    </div>
                  </div>

                  {/* CTA button */}
                  <button
                    onClick={() => dismiss(session.bookingId)}
                    className="mt-3 w-full py-2 rounded-xl bg-white/20 hover:bg-white/30 text-white text-xs font-bold transition-colors cursor-pointer"
                  >
                    Got it — I'm on my way! 👍
                  </button>
                </div>
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>

      {visible.length > 1 && (
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          onClick={dismissAll}
          className="pointer-events-auto self-end text-[11px] text-white/80 bg-gray-900/60 hover:bg-gray-900/80 px-3 py-1.5 rounded-full backdrop-blur-sm transition-colors cursor-pointer"
        >
          Dismiss all ({visible.length})
        </motion.button>
      )}
    </div>
  );
};

export default SessionAlarmToast;
