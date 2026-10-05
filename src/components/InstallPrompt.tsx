import React, { useEffect, useState } from "react";
import { Download, X, Smartphone } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

// The browser fires this event when the app is installable.
// We capture it to show our own custom install button.
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [show, setShow] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // Already running as installed PWA
    if (window.matchMedia("(display-mode: standalone)").matches) {
      setIsInstalled(true);
      return;
    }

    // Detect iOS (Safari doesn't fire beforeinstallprompt)
    const ios =
      /iphone|ipad|ipod/i.test(navigator.userAgent) &&
      !(window as any).MSStream;
    setIsIOS(ios);

    // Check if user already dismissed this session
    const alreadyDismissed = sessionStorage.getItem("pwa-prompt-dismissed");
    if (alreadyDismissed) return;

    if (ios) {
      // Show iOS instructions after 3 seconds
      const t = setTimeout(() => setShow(true), 3000);
      return () => clearTimeout(t);
    }

    // Chrome / Edge / Android — capture the native prompt
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setTimeout(() => setShow(true), 3000); // slight delay feels less intrusive
    };

    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setIsInstalled(true);
    }
    setShow(false);
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setShow(false);
    setDismissed(true);
    sessionStorage.setItem("pwa-prompt-dismissed", "1");
  };

  if (isInstalled || dismissed) return null;

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ y: 120, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 120, opacity: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[9999] w-[calc(100%-2rem)] max-w-sm"
        >
          <div className="bg-[#2c2a29] text-[#faf9f6] rounded-2xl shadow-2xl p-4 flex items-start gap-3 border border-[#d97706]/30">
            {/* Icon */}
            <div className="shrink-0 w-10 h-10 rounded-xl bg-[#d97706] flex items-center justify-center">
              <Smartphone size={20} className="text-white" />
            </div>

            {/* Text */}
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm leading-tight">
                Install CaintaPhoto
              </p>
              {isIOS ? (
                <p className="text-xs text-[#faf9f6]/70 mt-1 leading-snug">
                  Tap the <strong>Share</strong> button in Safari, then{" "}
                  <strong>"Add to Home Screen"</strong> to install this app.
                </p>
              ) : (
                <p className="text-xs text-[#faf9f6]/70 mt-1 leading-snug">
                  Install the app for quick access — no browser needed.
                </p>
              )}

              {/* Install button (non-iOS only) */}
              {!isIOS && (
                <button
                  onClick={handleInstall}
                  className="mt-2 inline-flex items-center gap-1.5 bg-[#d97706] hover:bg-[#b45309] text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
                >
                  <Download size={13} />
                  Install
                </button>
              )}
            </div>

            {/* Dismiss */}
            <button
              onClick={handleDismiss}
              className="shrink-0 text-[#faf9f6]/50 hover:text-[#faf9f6] transition-colors mt-0.5"
              aria-label="Dismiss install prompt"
            >
              <X size={16} />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
