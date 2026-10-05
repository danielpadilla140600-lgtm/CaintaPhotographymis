import React, { useRef, useState, useEffect } from "react";
import { motion, useMotionValue, useSpring, useTransform, useMotionTemplate, useScroll, AnimatePresence } from "motion/react";
import { Camera, Sparkles, Volume2, VolumeX, Eye, Sliders, Check, Maximize2 } from "lucide-react";
import { SoundEngine } from "../utils/soundEffects.ts";

interface MotionCardProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "onAnimationStart"> {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  key?: React.Key;
}

// 1. HYPER-REALISTIC 3D CARD TILT WITH SPRING INERTIA & DYNAMIC SPECULAR SHINE
export function Interactive3DTiltCard({ children, className = "", onClick, ...props }: MotionCardProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [hovering, setHovering] = useState(false);

  // Normalized relative coordinate values (0 to 1)
  const x = useMotionValue(0.5);
  const y = useMotionValue(0.5);

  // High-fidelity spring mappings to simulate mechanical weight/lag
  const rotateX = useSpring(useTransform(y, [0, 1], [10, -10]), { stiffness: 160, damping: 18, mass: 0.7 });
  const rotateY = useSpring(useTransform(x, [0, 1], [-10, 10]), { stiffness: 160, damping: 18, mass: 0.7 });
  const scale = useSpring(hovering ? 1.025 : 1, { stiffness: 220, damping: 20 });

  const handleMouseMove = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;
    
    x.set(mouseX / rect.width);
    y.set(mouseY / rect.height);
  };

  const handleMouseEnter = () => {
    setHovering(true);
    SoundEngine.playPop();
  };

  const handleMouseLeave = () => {
    setHovering(false);
    x.set(0.5);
    y.set(0.5);
  };

  // Build high-performance CSS gradient template for light shine reflection
  const percentX = useTransform(x, [0, 1], [0, 100]);
  const percentY = useTransform(y, [0, 1], [0, 100]);
  const shineBg = useMotionTemplate`radial-gradient(circle at ${percentX}% ${percentY}%, rgba(255,255,255,0.2) 0%, rgba(255,255,255,0) 70%)`;
  const MotionDiv = motion.div as React.ComponentType<any>;

  return (
    <MotionDiv
      ref={ref}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={onClick}
      style={{
        rotateX,
        rotateY,
        scale,
        transformStyle: "preserve-3d",
        perspective: 1000,
      }}
      className={`relative rounded-2xl transition-all duration-300 ${
        hovering ? "shadow-2xl border-[#2c2a29]/30" : "shadow-md border-[#e5e1da]"
      } ${className} interactive-card-tilt`}
      {...props}
    >
      {/* Specular glare overlay */}
      <motion.div
        style={{
          background: shineBg,
          transform: "translateZ(30px)",
        }}
        className="absolute inset-0 pointer-events-none rounded-2xl z-20"
      />
      
      {/* Content wrapper with realistic spatial offset */}
      <div 
        style={{ 
          transform: "translateZ(15px)", 
          transformStyle: "preserve-3d" 
        }} 
        className="h-full flex flex-col"
      >
        {children}
      </div>
    </MotionDiv>
  );
}

// 2. MAGNETIC ATTRACTION VECTOR BUTTON
export function MagnetButton({ children, className = "", onClick, type = "button", disabled = false, sound = "pop", ...props }: any) {
  const ref = useRef<HTMLButtonElement>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  // Micro-weight springs for fast organic pull and snap-back
  const springX = useSpring(x, { stiffness: 200, damping: 14, mass: 0.1 });
  const springY = useSpring(y, { stiffness: 200, damping: 14, mass: 0.1 });

  const handleMouseMove = (event: React.MouseEvent) => {
    if (!ref.current || disabled) return;
    const rect = ref.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    
    const distanceX = event.clientX - centerX;
    const distanceY = event.clientY - centerY;
    
    // Smooth pull within max 14px bounds
    const maxPull = 14;
    const pullX = Math.max(-maxPull, Math.min(maxPull, distanceX * 0.35));
    const pullY = Math.max(-maxPull, Math.min(maxPull, distanceY * 0.35));
    
    x.set(pullX);
    y.set(pullY);
  };

  const handleMouseLeave = () => {
    x.set(0);
    y.set(0);
  };

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (sound === "shutter") SoundEngine.playShutter();
    else if (sound === "focus") SoundEngine.playFocusBeep();
    else if (sound === "pop") SoundEngine.playPop();
    else if (sound === "success") SoundEngine.playSuccess();
    
    if (onClick) onClick(e);
  };

  return (
    <motion.button
      ref={ref}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onClick={handleClick}
      type={type}
      disabled={disabled}
      style={{ x: springX, y: springY }}
      className={`cursor-pointer inline-flex items-center justify-center transition-all ${className}`}
      {...props}
    >
      <motion.span 
        style={{ transform: "translateZ(5px)" }}
        className="relative z-10 flex items-center justify-center gap-1.5"
      >
        {children}
      </motion.span>
    </motion.button>
  );
}

// 3. PHOTOGRAPHIC AUTOFOCUS RETICLE VIEWPORT CURSOR
export function LensFocusCursor() {
  const [position, setPosition] = useState({ x: -100, y: -100 });
  const [hoverType, setHoverType] = useState<"none" | "card" | "button">("none");
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setPosition({ x: e.clientX, y: e.clientY });
      if (!isVisible) setIsVisible(true);
    };

    const handleMouseLeaveWindow = () => {
      setIsVisible(false);
    };

    const handleMouseOver = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target) return;
      
      if (target.closest(".interactive-card-tilt") || target.closest(".studio-photo-card")) {
        setHoverType("card");
      } else if (
        target.closest("button") || 
        target.closest("a") || 
        target.closest("input") || 
        target.closest("textarea") || 
        target.closest("[role='button']")
      ) {
        setHoverType("button");
      } else {
        setHoverType("none");
      }
    };

    window.addEventListener("mousemove", handleMouseMove, { passive: true });
    document.addEventListener("mouseleave", handleMouseLeaveWindow);
    window.addEventListener("mouseover", handleMouseOver, { passive: true });

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseleave", handleMouseLeaveWindow);
      window.removeEventListener("mouseover", handleMouseOver);
    };
  }, [isVisible]);

  if (!isVisible) return null;

  // Real fluid cinematic reticle spring
  const springConfig = { stiffness: 260, damping: 22, mass: 0.4 };

  return (
    <div className="hidden lg:block pointer-events-none">
      {/* Outer focus tracking frame */}
      <motion.div
        animate={{
          x: position.x - 24,
          y: position.y - 24,
          scale: hoverType === "card" ? 1.4 : hoverType === "button" ? 0.75 : 1,
          borderColor: hoverType === "card" ? "#eab308" : hoverType === "button" ? "#2c2a29" : "#a8a29e",
          borderWidth: hoverType === "button" ? "2px" : "1px",
          rotate: hoverType === "card" ? 45 : 0,
        }}
        transition={springConfig}
        className="fixed top-0 left-0 w-12 h-12 rounded-full border pointer-events-none z-[9999] mix-blend-difference flex items-center justify-center"
      >
        {/* Reticle camera viewfinder grid lines */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1.5px] h-2 bg-yellow-500/80" />
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[1.5px] h-2 bg-yellow-500/80" />
        <div className="absolute left-0 top-1/2 -translate-y-1/2 h-[1.5px] w-2 bg-yellow-500/80" />
        <div className="absolute right-0 top-1/2 -translate-y-1/2 h-[1.5px] w-2 bg-yellow-500/80" />
        
        {/* Focusing brackets indicators */}
        {hoverType === "card" && (
          <motion.div 
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="absolute inset-1 border border-dashed border-yellow-500/50 rounded-full"
          />
        )}
      </motion.div>

      {/* Center point precise focal reticle */}
      <motion.div
        animate={{
          x: position.x - 3,
          y: position.y - 3,
          scale: hoverType !== "none" ? 1.6 : 1,
          backgroundColor: hoverType === "card" ? "#eab308" : "#2c2a29",
        }}
        transition={{ type: "spring", stiffness: 500, damping: 25 }}
        className="fixed top-0 left-0 w-1.5 h-1.5 rounded-full pointer-events-none z-[9999] mix-blend-difference"
      />
    </div>
  );
}

// 4. PHOTOGRAPHIC LENS SHUTTER APERTURE BLADES TRANSITION
export function AperturePageTransition({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative overflow-hidden w-full h-full">
      <motion.div
        initial={{ opacity: 0, scale: 0.98, filter: "blur(4px)" }}
        animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
        exit={{ opacity: 0, scale: 1.02, filter: "blur(6px)" }}
        transition={{ 
          type: "spring", 
          stiffness: 140, 
          damping: 18,
          filter: { duration: 0.25 }
        }}
        className="w-full h-full"
      >
        {children}
      </motion.div>
    </div>
  );
}

// 5. SPRING-DRIVEN SMOOTH SCROLL PROGRESS BAR (FILM STRIP INSPIRED)
export function ScrollProgressBar() {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, {
    stiffness: 120,
    damping: 22,
    restDelta: 0.001
  });

  return (
    <div className="fixed top-0 left-0 right-0 h-1 z-[60] bg-[#faf9f6]/30 overflow-hidden pointer-events-none">
      <motion.div 
        style={{ scaleX, transformOrigin: "0%" }}
        className="h-full bg-gradient-to-r from-yellow-500 via-[#2c2a29] to-yellow-600 relative"
      >
        {/* Retro film sprocket-holes simulation overlay */}
        <div className="absolute inset-x-0 bottom-0 top-0 opacity-40 bg-[linear-gradient(90deg,transparent_0px,transparent_6px,#fff_6px,#fff_8px)] bg-[size:10px_100%]" />
      </motion.div>
    </div>
  );
}

// 6. SCROLL REVEAL VIEWPORT CONTAINER
interface ScrollRevealProps {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  direction?: "up" | "down" | "left" | "right" | "none";
}

export function ScrollReveal({ children, className = "", delay = 0, direction = "up" }: ScrollRevealProps) {
  const offsets = {
    up: { y: 35, x: 0 },
    down: { y: -35, x: 0 },
    left: { x: 35, y: 0 },
    right: { x: -35, y: 0 },
    none: { x: 0, y: 0 }
  };

  return (
    <motion.div
      initial={{ 
        opacity: 0, 
        y: offsets[direction].y,
        x: offsets[direction].x,
        scale: direction !== "none" ? 0.97 : 1
      }}
      whileInView={{ 
        opacity: 1, 
        y: 0, 
        x: 0, 
        scale: 1 
      }}
      viewport={{ once: true, margin: "-10%" }}
      transition={{
        type: "spring",
        stiffness: 110,
        damping: 16,
        mass: 0.6,
        delay
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// 7. INTERACTIVE BEFORE / AFTER RETOUCH COMPARISON SLIDER
interface BeforeAfterSliderProps {
  beforeImage: string;
  afterImage: string;
  beforeLabel?: string;
  afterLabel?: string;
  title?: string;
  caption?: string;
}

export function BeforeAfterSlider({
  beforeImage,
  afterImage,
  beforeLabel = "RAW Studio Camera",
  afterLabel = "Master Retouch Finish",
  title = "Studio Grade Post-Processing",
  caption = "Drag slider horizontally to inspect color grading & skin tone detail"
}: BeforeAfterSliderProps) {
  const [sliderPos, setSliderPos] = useState(50);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleMove = (clientX: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const clampedPercent = Math.max(0, Math.min(100, (x / rect.width) * 100));
    setSliderPos(clampedPercent);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches[0]) handleMove(e.touches[0].clientX);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging || e.buttons === 1) {
      handleMove(e.clientX);
    }
  };

  return (
    <div className="bg-[#1e1c1b] text-[#faf9f6] rounded-2xl p-4 sm:p-6 border border-white/10 shadow-2xl space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Sparkles size={16} className="text-yellow-500" />
            <h3 className="font-display text-lg sm:text-xl font-bold tracking-tight">{title}</h3>
          </div>
          <p className="text-xs text-gray-400 font-light mt-0.5">{caption}</p>
        </div>
        <div className="hidden sm:flex items-center gap-2 text-xs font-semibold px-3 py-1 bg-white/5 border border-white/10 rounded-full text-yellow-400">
          <Sliders size={13} />
          <span>Interactive Slider</span>
        </div>
      </div>

      <div
        ref={containerRef}
        onMouseDown={() => { setIsDragging(true); SoundEngine.playFocusBeep(); }}
        onMouseUp={() => setIsDragging(false)}
        onMouseMove={handleMouseMove}
        onTouchMove={handleTouchMove}
        className="relative h-72 sm:h-96 w-full rounded-xl overflow-hidden cursor-ew-resize select-none border border-white/10 shadow-inner group"
      >
        {/* AFTER IMAGE (Underneath, full size) */}
        <img
          src={afterImage}
          alt="After retouch"
          className="absolute inset-0 w-full h-full object-cover"
          referrerPolicy="no-referrer"
        />

        {/* BEFORE IMAGE (Clipped overlay) */}
        <div
          style={{ clipPath: `polygon(0 0, ${sliderPos}% 0, ${sliderPos}% 100%, 0 100%)` }}
          className="absolute inset-0 w-full h-full overflow-hidden"
        >
          <img
            src={beforeImage}
            alt="Before retouch"
            className="absolute inset-0 w-full h-full object-cover filter contrast-90 brightness-95 saturate-75"
            referrerPolicy="no-referrer"
          />
        </div>

        {/* Vertical Divider Line */}
        <div
          style={{ left: `${sliderPos}%` }}
          className="absolute top-0 bottom-0 w-0.5 bg-yellow-400 shadow-[0_0_10px_rgba(234,179,8,0.8)] -translate-x-1/2 pointer-events-none"
        >
          {/* Handle Knob with Camera Aperture Icon */}
          <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 left-1/2 w-8 h-8 rounded-full bg-yellow-500 text-black flex items-center justify-center shadow-lg border-2 border-white group-hover:scale-110 transition-transform">
            <Camera size={14} className="stroke-[2.5]" />
          </div>
        </div>

        {/* Floating Labels */}
        <div className="absolute bottom-3 left-3 bg-black/60 backdrop-blur-md px-2.5 py-1 rounded-md text-[11px] font-bold text-gray-200 border border-white/10 pointer-events-none">
          {beforeLabel}
        </div>
        <div className="absolute bottom-3 right-3 bg-yellow-500/90 backdrop-blur-md px-2.5 py-1 rounded-md text-[11px] font-bold text-black border border-white/10 pointer-events-none">
          {afterLabel}
        </div>
      </div>
    </div>
  );
}

// 8. INTERACTIVE CAMERA VIEWFINDER HUD SIMULATOR
export function CameraViewfinderHUD({ onCapture }: { onCapture?: () => void }) {
  const [iso, setIso] = useState(200);
  const [shutterSpeed, setShutterSpeed] = useState("1/250");
  const [aperture, setAperture] = useState("f/2.8");
  const [isFlashing, setIsFlashing] = useState(false);
  const [flashCount, setFlashCount] = useState(0);

  const isoOptions = [100, 200, 400, 800, 1600];
  const shutterOptions = ["1/125", "1/250", "1/500", "1/1000"];
  const apertureOptions = ["f/1.8", "f/2.8", "f/4.0", "f/5.6", "f/8.0"];

  const handleShoot = () => {
    SoundEngine.playShutter();
    setIsFlashing(true);
    setFlashCount(prev => prev + 1);
    setTimeout(() => setIsFlashing(false), 200);
    if (onCapture) onCapture();
  };

  return (
    <div className="relative rounded-2xl overflow-hidden bg-black text-white p-4 sm:p-6 border border-white/20 shadow-2xl">
      {/* Background Studio Shot */}
      <div className="relative h-64 sm:h-80 rounded-xl overflow-hidden border border-white/10 bg-neutral-900">
        <img
          src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=900&fit=crop"
          alt="Studio Viewfinder Portrait"
          className={`w-full h-full object-cover transition-all duration-300 ${
            aperture === "f/1.8" ? "filter contrast-105" : "filter contrast-100"
          }`}
          referrerPolicy="no-referrer"
        />

        {/* Viewfinder Rule-of-Thirds Grid */}
        <div className="absolute inset-0 pointer-events-none grid grid-cols-3 grid-rows-3">
          <div className="border-r border-b border-white/15" />
          <div className="border-r border-b border-white/15" />
          <div className="border-b border-white/15" />
          <div className="border-r border-b border-white/15" />
          <div className="border-r border-b border-white/15 flex items-center justify-center">
            {/* Center Focus Box */}
            <motion.div
              animate={{ scale: [1, 1.05, 1] }}
              transition={{ repeat: Infinity, duration: 2 }}
              className="w-12 h-12 border border-yellow-400/80 rounded flex items-center justify-center"
            >
              <div className="w-1.5 h-1.5 bg-yellow-400 rounded-full" />
            </motion.div>
          </div>
          <div className="border-b border-white/15" />
          <div className="border-r border-white/15" />
          <div className="border-r border-white/15" />
          <div />
        </div>

        {/* Viewfinder Corner Brackets */}
        <div className="absolute top-3 left-3 w-4 h-4 border-t-2 border-l-2 border-yellow-400" />
        <div className="absolute top-3 right-3 w-4 h-4 border-t-2 border-r-2 border-yellow-400" />
        <div className="absolute bottom-3 left-3 w-4 h-4 border-b-2 border-l-2 border-yellow-400" />
        <div className="absolute bottom-3 right-3 w-4 h-4 border-b-2 border-r-2 border-yellow-400" />

        {/* Top HUD Metrics */}
        <div className="absolute top-3 inset-x-6 flex items-center justify-between text-[11px] font-mono tracking-widest text-yellow-300 bg-black/40 backdrop-blur-sm px-3 py-1 rounded-md">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500 animate-ping inline-block" /> REC</span>
            <span>RAW 4K</span>
            <span>CAINTA STUDIO 01</span>
          </div>
          <div className="flex items-center gap-2">
            <span>SHOTS: #{flashCount}</span>
            <span className="text-white">BATTERY 94%</span>
          </div>
        </div>

        {/* Bottom EXIF dials */}
        <div className="absolute bottom-3 inset-x-6 flex items-center justify-between text-xs font-mono font-bold text-white bg-black/60 backdrop-blur-md px-4 py-2 rounded-lg border border-white/10">
          <div className="flex items-center gap-4">
            <span className="text-yellow-400">{aperture}</span>
            <span>{shutterSpeed}s</span>
            <span>ISO {iso}</span>
            <span className="text-emerald-400">AF-C [●]</span>
          </div>
          <div className="flex items-center gap-2 text-[10px] text-gray-300">
            <span>COLOR: NAT</span>
            <span>WB: 5600K</span>
          </div>
        </div>

        {/* Full White Shutter Flash Effect */}
        <AnimatePresence>
          {isFlashing && (
            <motion.div
              initial={{ opacity: 1 }}
              animate={{ opacity: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="absolute inset-0 bg-white z-50 pointer-events-none"
            />
          )}
        </AnimatePresence>
      </div>

      {/* Interactive Controls below Viewfinder */}
      <div className="mt-4 grid grid-cols-1 sm:grid-cols-4 gap-3 items-center">
        <div>
          <label className="text-[10px] font-semibold text-gray-400 block mb-1 uppercase tracking-wider">Aperture (DoF)</label>
          <select
            value={aperture}
            onChange={e => { setAperture(e.target.value); SoundEngine.playFocusBeep(); }}
            className="w-full bg-[#2c2a29] border border-white/20 text-white text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-yellow-400"
          >
            {apertureOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
          </select>
        </div>

        <div>
          <label className="text-[10px] font-semibold text-gray-400 block mb-1 uppercase tracking-wider">Shutter Speed</label>
          <select
            value={shutterSpeed}
            onChange={e => { setShutterSpeed(e.target.value); SoundEngine.playFocusBeep(); }}
            className="w-full bg-[#2c2a29] border border-white/20 text-white text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-yellow-400"
          >
            {shutterOptions.map(opt => <option key={opt} value={opt}>{opt}s</option>)}
          </select>
        </div>

        <div>
          <label className="text-[10px] font-semibold text-gray-400 block mb-1 uppercase tracking-wider">Sensor ISO</label>
          <select
            value={iso}
            onChange={e => { setIso(Number(e.target.value)); SoundEngine.playFocusBeep(); }}
            className="w-full bg-[#2c2a29] border border-white/20 text-white text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-yellow-400"
          >
            {isoOptions.map(opt => <option key={opt} value={opt}>ISO {opt}</option>)}
          </select>
        </div>

        <div className="pt-2 sm:pt-4">
          <button
            type="button"
            onClick={handleShoot}
            className="w-full py-2 bg-gradient-to-r from-yellow-500 to-amber-600 hover:from-yellow-400 hover:to-amber-500 text-black font-black text-xs uppercase tracking-wider rounded-lg shadow-lg flex items-center justify-center gap-2 cursor-pointer active:scale-95 transition-transform"
          >
            <Camera size={14} className="stroke-[2.5]" />
            <span>Test Shutter Click</span>
          </button>
        </div>
      </div>
    </div>
  );
}

// 9. INSTANT STUDIO ESTIMATOR WIDGET (LIVE BUDGET CALCULATOR)
export function StudioPriceEstimator({ onBookNow }: { onBookNow?: (summary: any) => void }) {
  const [sessionType, setSessionType] = useState<string>("grad");
  const [peopleCount, setPeopleCount] = useState<number>(1);
  const [includeHMUA, setIncludeHMUA] = useState<boolean>(true);
  const [includeRawUSB, setIncludeRawUSB] = useState<boolean>(true);
  const [frameSize, setFrameSize] = useState<string>("11x14");

  const sessionRates: Record<string, { name: string; base: number; extraPerson: number }> = {
    grad: { name: "Graduation Toga & Creative", base: 1200, extraPerson: 300 },
    portrait: { name: "Solo Executive / Glamour", base: 950, extraPerson: 300 },
    couple: { name: "Couple & Pre-Debut Studio", base: 1800, extraPerson: 350 },
    family: { name: "Big Family / Clan Portrait", base: 2500, extraPerson: 250 },
    selfshoot: { name: "Unlimited Self-Shoot Booth", base: 650, extraPerson: 200 }
  };

  const frameRates: Record<string, { label: string; price: number }> = {
    none: { label: "No Physical Frame (Digitals Only)", price: 0 },
    "8x10": { label: "8x10 Wooden Desk Frame (+₱450)", price: 450 },
    "11x14": { label: "11x14 Premium Oak Wall Frame (+₱850)", price: 850 },
    "16x20": { label: "16x20 Gallery Canvas Wrap (+₱1,650)", price: 1650 }
  };

  const hmuaPrice = 800;
  const rawUsbPrice = 350;

  const currentRate = sessionRates[sessionType] || sessionRates.grad;
  const extraPeoplePrice = Math.max(0, peopleCount - 1) * currentRate.extraPerson;
  const framePrice = frameRates[frameSize]?.price || 0;
  
  const totalPrice = currentRate.base + extraPeoplePrice + (includeHMUA ? hmuaPrice : 0) + (includeRawUSB ? rawUsbPrice : 0) + framePrice;
  const downpayment = Math.round(totalPrice * 0.3); // 30% standard deposit

  return (
    <div className="bg-[#faf9f6] text-[#2c2a29] rounded-2xl p-6 border border-[#e5e1da] shadow-xl space-y-6">
      <div className="flex items-center justify-between border-b border-[#e5e1da] pb-4">
        <div>
          <span className="text-[10px] uppercase font-bold tracking-widest text-[#7c756d]">Interactive Tool</span>
          <h3 className="font-display text-2xl font-bold text-[#2c2a29]">Cainta Studio Cost Calculator</h3>
          <p className="text-xs text-gray-500">Estimate your photography session cost in real-time with genuine studio inclusions</p>
        </div>
        <div className="w-10 h-10 rounded-full bg-yellow-500/20 text-yellow-700 flex items-center justify-center font-bold font-display text-lg">
          ₱
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left Options */}
        <div className="space-y-4">
          <div>
            <label className="text-xs font-bold text-[#2c2a29] block mb-1.5">Session Concept</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {Object.entries(sessionRates).map(([key, val]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => { setSessionType(key); SoundEngine.playPop(); }}
                  className={`p-2.5 rounded-xl border text-left text-xs transition-all cursor-pointer ${
                    sessionType === key
                      ? "bg-[#2c2a29] text-[#faf9f6] border-[#2c2a29] shadow-md"
                      : "bg-white text-[#2c2a29] border-[#e5e1da] hover:border-gray-400"
                  }`}
                >
                  <p className="font-bold">{val.name}</p>
                  <p className={`text-[11px] mt-0.5 ${sessionType === key ? "text-yellow-400" : "text-gray-500"}`}>
                    Starts at ₱{val.base.toLocaleString()}
                  </p>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-[#2c2a29] block mb-1.5">Number of Persons in Shoot: <span className="text-yellow-600 font-black">{peopleCount}</span></label>
            <input
              type="range"
              min={1}
              max={10}
              value={peopleCount}
              onChange={e => setPeopleCount(Number(e.target.value))}
              className="w-full accent-[#2c2a29] cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-gray-400 font-bold mt-1">
              <span>1 Person (Solo)</span>
              <span>5 Persons</span>
              <span>10 Persons (Group)</span>
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-[#2c2a29] block mb-1.5">Print & Framing Option</label>
            <select
              value={frameSize}
              onChange={e => setFrameSize(e.target.value)}
              className="w-full bg-white border border-[#e5e1da] rounded-xl px-3 py-2 text-xs font-medium text-[#2c2a29] focus:outline-none focus:border-[#2c2a29]"
            >
              {Object.entries(frameRates).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Right Summary */}
        <div className="bg-white rounded-xl p-5 border border-[#e5e1da] flex flex-col justify-between space-y-4">
          <div className="bg-[#faf9f6] p-4 rounded-xl border border-[#e5e1da] space-y-2">
            <div className="flex justify-between text-xs text-gray-600">
              <span>Estimated Package Total:</span>
              <span className="text-lg font-black text-[#2c2a29] font-display">₱{totalPrice.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-xs text-gray-600 border-t border-[#e5e1da] pt-2">
              <span>Required Downpayment (30%):</span>
              <span className="font-bold text-yellow-700">₱{downpayment.toLocaleString()}</span>
            </div>
            <p className="text-[10px] text-gray-400 italic">
              *Payable via GCash / Maya / In-Studio Cash upon booking confirmation.
            </p>

            <MagnetButton
              onClick={() => {
                SoundEngine.playSuccess();
                if (onBookNow) onBookNow({ sessionType, peopleCount, totalPrice, downpayment });
              }}
              className="w-full mt-3 py-2.5 bg-[#2c2a29] hover:bg-[#4a4644] text-[#faf9f6] rounded-xl text-xs font-bold uppercase tracking-wider shadow-lg flex items-center justify-center gap-2 cursor-pointer font-bold"
            >
              <Check size={14} className="text-yellow-400" />
              <span>Proceed to Studio Selection</span>
            </MagnetButton>
          </div>
        </div>
      </div>
    </div>
  );
}
