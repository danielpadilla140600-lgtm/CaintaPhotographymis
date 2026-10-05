// Web Audio API Sound Synthesizer & Cainta Photography Studio Jingle Engine
// Automatically plays the authentic Cainta Photography Studio.mp3 jingle on visits/interactions

let audioCtx: AudioContext | null = null;
let soundEnabled = true;
let hasPlayedWelcomeThisSession = false;
let jingleAudio: HTMLAudioElement | null = null;
let isJingleActive = false;
let approvedAudioUrl = "";
let approvedAudioEnabled = true;

const JINGLE_SRC = "/Cainta%20Photography%20Studio.mp3";

function getJingleAudio(): HTMLAudioElement | null {
  if (typeof window === "undefined") return null;
  if (!jingleAudio) {
    const savedCustomAudio = approvedAudioUrl || JINGLE_SRC;
    jingleAudio = new Audio(savedCustomAudio);
    jingleAudio.preload = "auto";
    jingleAudio.autoplay = true;
    jingleAudio.volume = 0.85;

    jingleAudio.addEventListener("play", () => { isJingleActive = true; });
    jingleAudio.addEventListener("pause", () => { isJingleActive = false; });
    jingleAudio.addEventListener("ended", () => { isJingleActive = false; });
  }
  return jingleAudio;
}

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === "suspended") {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

export const SoundEngine = {
  isEnabled: () => soundEnabled,
  toggleSound: () => {
    soundEnabled = !soundEnabled;
    if (!soundEnabled && jingleAudio) {
      jingleAudio.pause();
    }
    return soundEnabled;
  },
  setSoundEnabled: (enabled: boolean) => {
    soundEnabled = enabled;
    if (!soundEnabled && jingleAudio) {
      jingleAudio.pause();
    }
  },
  hasPlayedWelcome: () => hasPlayedWelcomeThisSession,
  isJinglePlaying: () => isJingleActive,

  configureApprovedAudio: (url: string, enabled: boolean) => {
    approvedAudioUrl = url || "";
    approvedAudioEnabled = enabled;
    if (jingleAudio) {
      const nextSrc = approvedAudioUrl || JINGLE_SRC;
      if (jingleAudio.src !== new URL(nextSrc, window.location.origin).href) {
        jingleAudio.src = nextSrc;
        jingleAudio.load();
      }
    }
  },

  setCustomAudioUrl: (url: string) => {
    if (typeof window === "undefined") return;
    const audio = getJingleAudio();
    if (audio) {
      audio.src = url;
      audio.load();
    }
    approvedAudioUrl = url;
  },

  getCustomAudioUrl: () => {
    if (typeof window === "undefined") return null;
    return approvedAudioUrl || JINGLE_SRC;
  },

  // 0. Primary Jingle: Cainta Photography Studio.mp3
  playWelcomeAudio: (force = false) => {
    if (!soundEnabled || !approvedAudioEnabled) return;
    try {
      const audio = getJingleAudio();
      if (!audio) return;

      if (force || audio.paused || audio.ended) {
        audio.currentTime = 0;
        const playPromise = audio.play();
        if (playPromise !== undefined) {
          playPromise
            .then(() => {
              hasPlayedWelcomeThisSession = true;
              isJingleActive = true;
            })
            .catch((err) => {
              console.log("[SoundEngine] Autoplay waiting for user gesture:", err.message);
            });
        }
      }
    } catch (e) {
      console.warn("[SoundEngine] Error playing Cainta Photography Studio jingle:", e);
    }
  },

  stopWelcomeAudio: () => {
    if (jingleAudio) {
      jingleAudio.pause();
      jingleAudio.currentTime = 0;
      isJingleActive = false;
    }
  },

  // Auto-activates audio on visit with automatic gesture unlocking
  initAutoPlayOnVisit: () => {
    if (typeof window === "undefined") return;

    let listenersAttached = true;

    const tryAutoPlay = () => {
      if (!soundEnabled || !approvedAudioEnabled) return;
      const audio = getJingleAudio();
      if (audio) {
        audio.load();
        audio.play().then(() => {
          hasPlayedWelcomeThisSession = true;
          isJingleActive = true;
          detachListeners();
        }).catch(() => undefined);
      }
    };

    const handleFirstGesture = () => {
      if (!soundEnabled || !approvedAudioEnabled) return;
      const audio = getJingleAudio();
      if (audio) {
        audio.play().then(() => {
          hasPlayedWelcomeThisSession = true;
          isJingleActive = true;
          detachListeners();
        }).catch(() => {});
      }
    };

    const detachListeners = () => {
      if (!listenersAttached) return;
      listenersAttached = false;
      window.removeEventListener("click", handleFirstGesture);
      window.removeEventListener("pointerdown", handleFirstGesture);
      window.removeEventListener("keydown", handleFirstGesture);
      window.removeEventListener("touchstart", handleFirstGesture);
      window.removeEventListener("scroll", handleFirstGesture);
    };

    // 1. Attempt immediate playback
    tryAutoPlay();

    // 2. Attach listeners for first user gesture (click, tap, scroll, keypress)
    window.addEventListener("click", handleFirstGesture, { passive: true });
    window.addEventListener("pointerdown", handleFirstGesture, { passive: true });
    window.addEventListener("keydown", handleFirstGesture, { passive: true });
    window.addEventListener("touchstart", handleFirstGesture, { passive: true });
    window.addEventListener("scroll", handleFirstGesture, { passive: true });
  },

  // 1. Authentic Mechanical DSLR Shutter Click & Mirror Flap
  playShutter: () => {
    if (!soundEnabled) return;
    try {
      const ctx = getAudioContext();
      if (!ctx) return;

      const now = ctx.currentTime;

      // First click: mirror flip up (noise burst)
      const bufferSize = ctx.sampleRate * 0.04;
      const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        output[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.25));
      }

      const noise1 = ctx.createBufferSource();
      noise1.buffer = noiseBuffer;
      const filter1 = ctx.createBiquadFilter();
      filter1.type = "bandpass";
      filter1.frequency.setValueAtTime(2200, now);
      filter1.Q.setValueAtTime(3, now);

      const gain1 = ctx.createGain();
      gain1.gain.setValueAtTime(0.35, now);
      gain1.gain.exponentialRampToValueAtTime(0.01, now + 0.04);

      noise1.connect(filter1);
      filter1.connect(gain1);
      gain1.connect(ctx.destination);
      noise1.start(now);

      // Second click: shutter curtain mechanical snap (after 60ms)
      const noise2 = ctx.createBufferSource();
      noise2.buffer = noiseBuffer;
      const filter2 = ctx.createBiquadFilter();
      filter2.type = "highpass";
      filter2.frequency.setValueAtTime(1400, now + 0.06);

      const gain2 = ctx.createGain();
      gain2.gain.setValueAtTime(0.4, now + 0.06);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.11);

      noise2.connect(filter2);
      filter2.connect(gain2);
      gain2.connect(ctx.destination);
      noise2.start(now + 0.06);

      // Third sound: mirror down soft thud (after 120ms)
      const osc = ctx.createOscillator();
      const oscGain = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(180, now + 0.12);
      osc.frequency.exponentialRampToValueAtTime(45, now + 0.17);
      oscGain.gain.setValueAtTime(0.2, now + 0.12);
      oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
      osc.connect(oscGain);
      oscGain.connect(ctx.destination);
      osc.start(now + 0.12);
      osc.stop(now + 0.19);
    } catch {
      // Ignore if audio is muted or disallowed
    }
  },

  // 2. Electronic Autofocus Double-Beep (Classic Canon/Sony confirm beep)
  playFocusBeep: () => {
    if (!soundEnabled) return;
    try {
      const ctx = getAudioContext();
      if (!ctx) return;
      const now = ctx.currentTime;

      // Beep 1
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = "sine";
      osc1.frequency.setValueAtTime(1760, now); // A6
      gain1.gain.setValueAtTime(0.12, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.06);

      // Beep 2 (higher confirmation tone)
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = "sine";
      osc2.frequency.setValueAtTime(2637, now + 0.07); // E7
      gain2.gain.setValueAtTime(0.15, now + 0.07);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.07);
      osc2.stop(now + 0.15);
    } catch {}
  },

  // 3. Subtle UI Button Pop
  playPop: () => {
    if (!soundEnabled) return;
    try {
      const ctx = getAudioContext();
      if (!ctx) return;
      const now = ctx.currentTime;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.04);
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.06);
    } catch {}
  },

  // 4. Success Chime (Golden Chord for booking success)
  playSuccess: () => {
    if (!soundEnabled) return;
    try {
      const ctx = getAudioContext();
      if (!ctx) return;
      const now = ctx.currentTime;
      const chord = [523.25, 659.25, 783.99, 1046.5]; // C Major arpeggio

      chord.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, now + idx * 0.06);
        gain.gain.setValueAtTime(0.1, now + idx * 0.06);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.06 + 0.35);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + idx * 0.06);
        osc.stop(now + idx * 0.06 + 0.4);
      });
    } catch {}
  }
};
