import React, { useState, useEffect, useCallback, useRef } from "react";
import { 
  Camera, Calendar, ShieldCheck, Mail, Phone, MapPin, 
  Clock, Heart, Star, Sparkles, Image as ImageIcon, Printer, User, MessageSquare, Compass,
  X, Eye, Layers, Info, ExternalLink, Globe, Share2, ChevronLeft, ChevronRight, Play, Pause, Maximize2
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Interactive3DTiltCard, MagnetButton } from "../components/MotionCard.tsx";
import CaintaStudioMap from "../components/CaintaStudioMap.tsx";

interface StudioProfileProps {
  studio: any;
  services: any[];
  packages: any[];
  addons: any[];
  reviews: any[];
  printProducts: any[];
  favorites: any[];
  onToggleFavorite: (studioId: string) => void;
  onOpenBookingWizard: () => void;
  onOpenPrintWizard: () => void;
}

export default function StudioProfile({
  studio,
  services,
  packages,
  addons,
  reviews,
  printProducts,
  favorites,
  onToggleFavorite,
  onOpenBookingWizard,
  onOpenPrintWizard
}: StudioProfileProps) {
  const [activeTab, setActiveTab] = useState<"services" | "packages" | "prints" | "reviews">("services");
  const isFav = favorites.some(f => f.studioId === studio.id);

  const [isExamplePrintsOpen, setIsExamplePrintsOpen] = useState(false);
  const [selectedProj, setSelectedProj] = useState(0);

  // Portfolio slideshow / lightbox state
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [slideshowIndex, setSlideshowIndex] = useState(0);
  const [isSlideshowPlaying, setIsSlideshowPlaying] = useState(true);
  const [portfolioFilter, setPortfolioFilter] = useState<"all" | "services" | "packages" | "prints">("all");
  const slideshowTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const pastPrintProjects = printProducts
    .filter(product => product.isActive !== false && (product.images?.[0] || product.image))
    .map(product => ({
      title: product.name,
      category: "Print Product",
      description: product.description || "Studio print product available for custom orders.",
      material: product.description || "Studio print product",
      dimensions: product.size,
      image: product.images?.[0] || product.image
    }));

  // Build categorized gallery items
  interface GalleryItem { url: string; category: "Service" | "Package" | "Print"; label: string; }
  const allGalleryItems: GalleryItem[] = [
    ...services.flatMap(s =>
      (Array.isArray(s.images) && s.images.length > 0 ? s.images : [s.image])
        .filter(Boolean)
        .map((url: string) => ({ url, category: "Service" as const, label: s.name }))
    ),
    ...packages.flatMap(p =>
      (Array.isArray(p.images) && p.images.length > 0 ? p.images : [p.image])
        .filter(Boolean)
        .map((url: string) => ({ url, category: "Package" as const, label: p.name }))
    ),
    ...printProducts.flatMap(pr =>
      (Array.isArray(pr.images) && pr.images.length > 0 ? pr.images : [pr.image])
        .filter(Boolean)
        .map((url: string) => ({ url, category: "Print" as const, label: pr.name }))
    ),
  ];

  const filteredGalleryItems = portfolioFilter === "all"
    ? allGalleryItems
    : portfolioFilter === "services"
    ? allGalleryItems.filter(i => i.category === "Service")
    : portfolioFilter === "packages"
    ? allGalleryItems.filter(i => i.category === "Package")
    : allGalleryItems.filter(i => i.category === "Print");

  // Slideshow auto-advance
  const startSlideshow = useCallback(() => {
    if (slideshowTimerRef.current) clearInterval(slideshowTimerRef.current);
    slideshowTimerRef.current = setInterval(() => {
      setSlideshowIndex(prev => (prev + 1) % (filteredGalleryItems.length || 1));
    }, 3500);
  }, [filteredGalleryItems.length]);

  useEffect(() => {
    if (isSlideshowPlaying && filteredGalleryItems.length > 1) {
      startSlideshow();
    } else {
      if (slideshowTimerRef.current) clearInterval(slideshowTimerRef.current);
    }
    return () => { if (slideshowTimerRef.current) clearInterval(slideshowTimerRef.current); };
  }, [isSlideshowPlaying, startSlideshow, filteredGalleryItems.length]);

  // Reset slideshow index when filter changes
  useEffect(() => { setSlideshowIndex(0); }, [portfolioFilter]);

  // Lightbox keyboard nav
  useEffect(() => {
    if (lightboxIndex === null) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") setLightboxIndex(i => i !== null ? (i + 1) % filteredGalleryItems.length : null);
      if (e.key === "ArrowLeft") setLightboxIndex(i => i !== null ? (i - 1 + filteredGalleryItems.length) % filteredGalleryItems.length : null);
      if (e.key === "Escape") setLightboxIndex(null);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [lightboxIndex, filteredGalleryItems.length]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10 space-y-6 sm:space-y-8 pb-24 md:pb-12">
      {/* 1. COVER PHOTO & MAIN HEADER CARD */}
      <div className="bg-white rounded-3xl overflow-hidden border border-[#e5e1da] shadow-lg">
        {/* Cover image */}
        <div className="h-64 sm:h-80 relative bg-gray-100">
          <img src={studio.coverImage} alt={studio.name} className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
          
          <button
            onClick={() => onToggleFavorite(studio.id)}
            className="absolute top-5 right-5 p-2 rounded-full bg-white/90 backdrop-blur-sm text-gray-500 hover:text-red-500 transition-colors shadow-md cursor-pointer"
            title="Add to Favorites"
          >
            <Heart size={20} className={isFav ? "fill-red-500 text-red-500" : ""} />
          </button>

          {/* Overlaid Title & Badges */}
          <div className="absolute bottom-6 left-6 text-left text-white space-y-2 pr-6">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] bg-yellow-500 text-black font-extrabold uppercase px-2 py-0.5 rounded tracking-wider shadow-sm">
                Studio Profile
              </span>
              {studio.isApproved && (
                <span className="text-[10px] bg-green-600 text-white font-bold px-2 py-0.5 rounded flex items-center gap-0.5 shadow-sm">
                  <ShieldCheck size={11} /> Verified Partner
                </span>
              )}
            </div>
            <h1 className="font-display text-2xl sm:text-4xl font-extrabold tracking-tight leading-none text-white">
              {studio.name}
            </h1>
            <p className="text-xs text-gray-200 flex items-center gap-1 font-semibold leading-relaxed">
              <MapPin size={13} className="text-yellow-500" /> {studio.location}
            </p>
          </div>
        </div>

        {/* Studio Bio / Description */}
        <div className="p-6 sm:p-8 grid md:grid-cols-12 gap-8 text-left">
          <div className="md:col-span-8 space-y-4">
            <h3 className="font-display text-lg font-bold text-[#2c2a29]">About our Creative Studio</h3>
            <p className="text-xs sm:text-sm text-[#7c756d] leading-relaxed font-light">{studio.description}</p>
            
            {/* ── PORTFOLIO PREVIEW ─────────────────────────────────── */}
            {allGalleryItems.length > 0 && (
              <div className="space-y-3 pt-2">
                {/* Section header + filter chips */}
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h4 className="font-display font-bold text-sm text-[#2c2a29] flex items-center gap-1.5">
                    <Camera size={15} className="text-yellow-600" /> Portfolio Preview
                    <span className="text-[10px] font-normal text-[#7c756d] bg-[#f3f1ed] border border-[#e5e1da] px-2 py-0.5 rounded-full ml-1">{allGalleryItems.length} photos</span>
                  </h4>
                  <div className="flex gap-1 flex-wrap">
                    {(["all", "services", "packages", "prints"] as const).map(f => (
                      <button
                        key={f}
                        type="button"
                        onClick={() => setPortfolioFilter(f)}
                        className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer ${
                          portfolioFilter === f
                            ? "bg-[#2c2a29] text-white"
                            : "bg-[#f3f1ed] text-[#7c756d] border border-[#e5e1da] hover:border-[#2c2a29]"
                        }`}
                      >
                        {f === "all" ? "All" : f === "services" ? "Services" : f === "packages" ? "Packages" : "Prints"}
                      </button>
                    ))}
                  </div>
                </div>

                {filteredGalleryItems.length === 0 ? (
                  <div className="py-6 text-center text-[11px] text-[#7c756d] bg-[#f3f1ed] rounded-2xl border border-[#e5e1da]">
                    No photos in this category yet.
                  </div>
                ) : (
                  <>
                    {/* ── HERO SLIDESHOW ── */}
                    <div className="relative rounded-2xl overflow-hidden bg-[#1a1917] shadow-lg group" style={{ aspectRatio: "16/9" }}>
                      <AnimatePresence mode="wait">
                        <motion.img
                          key={`slide-${slideshowIndex}-${filteredGalleryItems[slideshowIndex]?.url}`}
                          src={filteredGalleryItems[slideshowIndex % filteredGalleryItems.length]?.url}
                          alt={filteredGalleryItems[slideshowIndex % filteredGalleryItems.length]?.label}
                          className="absolute inset-0 w-full h-full object-cover"
                          initial={{ opacity: 0, scale: 1.04 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.97 }}
                          transition={{ duration: 0.55, ease: "easeInOut" }}
                        />
                      </AnimatePresence>

                      {/* Gradient overlay */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent pointer-events-none" />

                      {/* Category + label badge */}
                      <div className="absolute top-3 left-3 flex items-center gap-1.5">
                        <span className={`text-[9px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full shadow ${
                          filteredGalleryItems[slideshowIndex % filteredGalleryItems.length]?.category === "Service"
                            ? "bg-blue-500 text-white"
                            : filteredGalleryItems[slideshowIndex % filteredGalleryItems.length]?.category === "Package"
                            ? "bg-yellow-500 text-black"
                            : "bg-emerald-500 text-white"
                        }`}>
                          {filteredGalleryItems[slideshowIndex % filteredGalleryItems.length]?.category}
                        </span>
                        <span className="text-[10px] text-white/90 font-semibold bg-black/40 backdrop-blur-sm px-2 py-0.5 rounded-full max-w-[140px] truncate">
                          {filteredGalleryItems[slideshowIndex % filteredGalleryItems.length]?.label}
                        </span>
                      </div>

                      {/* Image counter */}
                      <div className="absolute top-3 right-3 bg-black/50 backdrop-blur-sm text-white text-[10px] font-bold px-2.5 py-1 rounded-full">
                        {(slideshowIndex % filteredGalleryItems.length) + 1} / {filteredGalleryItems.length}
                      </div>

                      {/* Prev / Next arrows */}
                      {filteredGalleryItems.length > 1 && (
                        <>
                          <button
                            type="button"
                            onClick={() => { setSlideshowIndex(i => (i - 1 + filteredGalleryItems.length) % filteredGalleryItems.length); startSlideshow(); }}
                            className="absolute left-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/50 hover:bg-black/70 text-white backdrop-blur-sm transition-all opacity-0 group-hover:opacity-100 cursor-pointer shadow"
                            aria-label="Previous photo"
                          >
                            <ChevronLeft size={18} />
                          </button>
                          <button
                            type="button"
                            onClick={() => { setSlideshowIndex(i => (i + 1) % filteredGalleryItems.length); startSlideshow(); }}
                            className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/50 hover:bg-black/70 text-white backdrop-blur-sm transition-all opacity-0 group-hover:opacity-100 cursor-pointer shadow"
                            aria-label="Next photo"
                          >
                            <ChevronRight size={18} />
                          </button>
                        </>
                      )}

                      {/* Bottom controls: play/pause + open lightbox */}
                      <div className="absolute bottom-3 left-0 right-0 px-3 flex items-center justify-between">
                        {/* Dot indicators */}
                        <div className="flex gap-1 flex-wrap max-w-[60%]">
                          {filteredGalleryItems.slice(0, 12).map((_, di) => (
                            <button
                              key={di}
                              type="button"
                              onClick={() => { setSlideshowIndex(di); startSlideshow(); }}
                              className={`rounded-full transition-all cursor-pointer ${
                                di === slideshowIndex % filteredGalleryItems.length
                                  ? "w-5 h-1.5 bg-white"
                                  : "w-1.5 h-1.5 bg-white/50 hover:bg-white/80"
                              }`}
                              aria-label={`Go to photo ${di + 1}`}
                            />
                          ))}
                          {filteredGalleryItems.length > 12 && (
                            <span className="text-white/60 text-[9px] self-center ml-1">+{filteredGalleryItems.length - 12}</span>
                          )}
                        </div>
                        {/* Play/Pause + Full Gallery buttons */}
                        <div className="flex items-center gap-1.5">
                          {filteredGalleryItems.length > 1 && (
                            <button
                              type="button"
                              onClick={() => setIsSlideshowPlaying(p => !p)}
                              className="p-1.5 rounded-full bg-black/50 hover:bg-black/70 text-white backdrop-blur-sm transition-all cursor-pointer"
                              aria-label={isSlideshowPlaying ? "Pause slideshow" : "Play slideshow"}
                            >
                              {isSlideshowPlaying ? <Pause size={13} /> : <Play size={13} />}
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => setLightboxIndex(slideshowIndex % filteredGalleryItems.length)}
                            className="p-1.5 rounded-full bg-black/50 hover:bg-black/70 text-white backdrop-blur-sm transition-all cursor-pointer"
                            aria-label="Open fullscreen"
                          >
                            <Maximize2 size={13} />
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* ── THUMBNAIL STRIP ── */}
                    <div className="grid grid-cols-4 sm:grid-cols-5 lg:grid-cols-6 gap-1.5">
                      {filteredGalleryItems.map((item, i) => (
                        <button
                          key={`${item.url}-${i}`}
                          type="button"
                          onClick={() => { setSlideshowIndex(i); setIsSlideshowPlaying(false); setLightboxIndex(i); }}
                          className={`relative aspect-square rounded-lg overflow-hidden group cursor-pointer transition-all ${
                            i === slideshowIndex % filteredGalleryItems.length
                              ? "ring-2 ring-[#2c2a29] ring-offset-1"
                              : "opacity-70 hover:opacity-100"
                          }`}
                          aria-label={`View ${item.label}`}
                        >
                          <img
                            src={item.url}
                            alt={item.label}
                            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                          />
                          {/* Category color dot */}
                          <span className={`absolute top-1 left-1 w-1.5 h-1.5 rounded-full ${
                            item.category === "Service" ? "bg-blue-400" : item.category === "Package" ? "bg-yellow-400" : "bg-emerald-400"
                          }`} />
                          {/* Hover overlay */}
                          <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <Eye size={14} className="text-white" />
                          </div>
                        </button>
                      ))}
                    </div>

                    {/* Category legend */}
                    <div className="flex flex-wrap gap-3 text-[10px] font-semibold text-[#7c756d]">
                      <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-400 inline-block" /> Services</span>
                      <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-yellow-400 inline-block" /> Packages</span>
                      <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" /> Prints</span>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Quick contact and hours panel */}
          <div className="md:col-span-4 bg-[#faf9f6] border border-[#e5e1da] rounded-2xl p-5 space-y-4 text-xs font-semibold text-[#2c2a29]">
            <h4 className="font-display text-sm font-bold border-b border-gray-100 pb-2">Business Information</h4>
            <div className="space-y-3">
              <p className="flex items-center gap-2"><Clock size={15} className="text-[#7c756d]" /> {studio.businessHours}</p>
              <p className="flex items-center gap-2"><Phone size={15} className="text-[#7c756d]" /> {studio.contactInfo}</p>
              <p className="flex items-center gap-2"><Mail size={15} className="text-[#7c756d]" /> {studio.email}</p>
              <p className="flex items-start gap-2 leading-tight">
                <MapPin size={15} className="text-[#7c756d] mt-0.5 flex-shrink-0" /> 
                <span className="text-[#7c756d] text-[11px] font-normal">{studio.address}</span>
              </p>
            </div>

            {/* Social Media & Official Website Presence */}
            {(studio.facebookUrl || studio.instagramUrl || studio.tiktokUrl || studio.otherSocialUrl || studio.websiteUrl) && (
              <div className="pt-3 border-t border-gray-200 space-y-2">
                <h5 className="text-[11px] font-bold uppercase tracking-wider text-[#7c756d]">Official Online Presence</h5>
                <div className="flex flex-wrap gap-1.5">
                  {studio.facebookUrl && (
                    <a
                      href={studio.facebookUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-900 border border-blue-200 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors shadow-xs"
                      title="Facebook Page"
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-600"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"></path></svg>
                      Facebook <ExternalLink size={10} className="opacity-60" />
                    </a>
                  )}
                  {studio.instagramUrl && (
                    <a
                      href={studio.instagramUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-2.5 py-1.5 bg-pink-50 hover:bg-pink-100 text-pink-900 border border-pink-200 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors shadow-xs"
                      title="Instagram Profile"
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-pink-600"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line></svg>
                      Instagram <ExternalLink size={10} className="opacity-60" />
                    </a>
                  )}
                  {studio.tiktokUrl && (
                    <a
                      href={studio.tiktokUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-2.5 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-900 border border-gray-300 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors shadow-xs"
                      title="TikTok Profile"
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-black"><path d="M9 12a4 4 0 1 0 4 4V4a5 5 0 0 0 5 5"></path></svg>
                      TikTok <ExternalLink size={10} className="opacity-60" />
                    </a>
                  )}
                  {studio.otherSocialUrl && (
                    <a
                      href={studio.otherSocialUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors shadow-xs"
                      title="Other Social Link"
                    >
                      <Share2 size={12} className="text-amber-600" /> Social <ExternalLink size={10} className="opacity-60" />
                    </a>
                  )}
                  {studio.websiteUrl && (
                    <a
                      href={studio.websiteUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-200 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors shadow-xs"
                      title="Official Website"
                    >
                      <Globe size={12} className="text-emerald-600" /> Website <ExternalLink size={10} className="opacity-60" />
                    </a>
                  )}
                </div>
              </div>
            )}

            {/* Direct primary action buttons */}
            <div className="pt-3 space-y-2">
              <MagnetButton
                onClick={onOpenBookingWizard}
                className="w-full py-3 bg-[#2c2a29] text-[#faf9f6] hover:bg-[#4a4644] font-bold rounded-xl shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer uppercase tracking-wider font-bold"
              >
                <Calendar size={15} /> Book Appointment
              </MagnetButton>

              {studio.printingAvailable && (
                <>
                  <MagnetButton
                    onClick={onOpenPrintWizard}
                    className="w-full py-2.5 bg-yellow-500 text-black hover:bg-yellow-400 font-bold rounded-xl shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer text-[11px] uppercase tracking-wider font-bold"
                  >
                    <Printer size={15} /> Order Custom Prints
                  </MagnetButton>
                  
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedProj(0);
                      setIsExamplePrintsOpen(true);
                    }}
                    className="w-full py-2 bg-white hover:bg-gray-50 text-[#2c2a29] border border-[#e5e1da] hover:border-[#2c2a29] text-[10px] uppercase tracking-wider font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
                  >
                    <ImageIcon size={13} /> View Past Print Gallery
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── FULLSCREEN LIGHTBOX ─────────────────────────────────────────── */}
      <AnimatePresence>
        {lightboxIndex !== null && filteredGalleryItems.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[60] bg-black/95 flex flex-col"
            role="dialog"
            aria-modal="true"
            aria-label="Portfolio image viewer"
            onClick={() => setLightboxIndex(null)}
          >
            {/* Top bar */}
            <div className="flex items-center justify-between px-5 py-3 flex-shrink-0" onClick={e => e.stopPropagation()}>
              <div className="flex items-center gap-3">
                <span className={`text-[9px] font-extrabold uppercase tracking-wider px-2.5 py-1 rounded-full ${
                  filteredGalleryItems[lightboxIndex]?.category === "Service"
                    ? "bg-blue-500/20 text-blue-300 border border-blue-500/30"
                    : filteredGalleryItems[lightboxIndex]?.category === "Package"
                    ? "bg-yellow-500/20 text-yellow-300 border border-yellow-500/30"
                    : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                }`}>
                  {filteredGalleryItems[lightboxIndex]?.category}
                </span>
                <span className="text-white/80 text-xs font-semibold truncate max-w-[200px]">
                  {filteredGalleryItems[lightboxIndex]?.label}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-white/50 text-xs font-medium">
                  {lightboxIndex + 1} / {filteredGalleryItems.length}
                </span>
                <button
                  type="button"
                  onClick={() => setLightboxIndex(null)}
                  className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
                  aria-label="Close lightbox"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Main image area */}
            <div className="flex-1 flex items-center justify-center relative min-h-0 px-14" onClick={e => e.stopPropagation()}>
              {/* Prev */}
              {filteredGalleryItems.length > 1 && (
                <button
                  type="button"
                  onClick={() => setLightboxIndex(i => i !== null ? (i - 1 + filteredGalleryItems.length) % filteredGalleryItems.length : 0)}
                  className="absolute left-3 p-3 rounded-full bg-white/10 hover:bg-white/25 text-white transition-all cursor-pointer z-10"
                  aria-label="Previous photo"
                >
                  <ChevronLeft size={22} />
                </button>
              )}

              <AnimatePresence mode="wait">
                <motion.img
                  key={`lb-${lightboxIndex}`}
                  src={filteredGalleryItems[lightboxIndex]?.url}
                  alt={filteredGalleryItems[lightboxIndex]?.label}
                  className="max-h-full max-w-full object-contain rounded-xl shadow-2xl select-none"
                  style={{ maxHeight: "calc(100vh - 160px)" }}
                  initial={{ opacity: 0, scale: 0.93 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 1.04 }}
                  transition={{ duration: 0.3, ease: "easeOut" }}
                  draggable={false}
                />
              </AnimatePresence>

              {/* Next */}
              {filteredGalleryItems.length > 1 && (
                <button
                  type="button"
                  onClick={() => setLightboxIndex(i => i !== null ? (i + 1) % filteredGalleryItems.length : 0)}
                  className="absolute right-3 p-3 rounded-full bg-white/10 hover:bg-white/25 text-white transition-all cursor-pointer z-10"
                  aria-label="Next photo"
                >
                  <ChevronRight size={22} />
                </button>
              )}
            </div>

            {/* Bottom thumbnail filmstrip */}
            {filteredGalleryItems.length > 1 && (
              <div className="flex-shrink-0 px-4 pb-4 pt-2" onClick={e => e.stopPropagation()}>
                <div className="flex gap-1.5 justify-center overflow-x-auto pb-1 scrollbar-hide">
                  {filteredGalleryItems.map((item, i) => (
                    <button
                      key={`film-${i}`}
                      type="button"
                      onClick={() => setLightboxIndex(i)}
                      className={`flex-shrink-0 w-12 h-12 rounded-lg overflow-hidden transition-all cursor-pointer ${
                        i === lightboxIndex
                          ? "ring-2 ring-white ring-offset-1 ring-offset-black opacity-100 scale-110"
                          : "opacity-50 hover:opacity-80"
                      }`}
                      aria-label={`Jump to photo ${i + 1}`}
                    >
                      <img src={item.url} alt={item.label} className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* ESC hint */}
            <div className="text-center pb-2 flex-shrink-0">
              <span className="text-white/30 text-[10px]">Press <kbd className="font-mono bg-white/10 px-1.5 py-0.5 rounded text-white/50">ESC</kbd> to close · <kbd className="font-mono bg-white/10 px-1.5 py-0.5 rounded text-white/50">←</kbd> <kbd className="font-mono bg-white/10 px-1.5 py-0.5 rounded text-white/50">→</kbd> to navigate</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* STUDIO CAINTA LEAFLET LOCATION MAP */}
      <div className="space-y-3 text-left">
        <div className="flex items-center gap-2">
          <Compass className="text-yellow-600" size={18} />
          <h3 className="font-display font-bold text-lg text-[#2c2a29]">Studio Location Map (Cainta, Rizal)</h3>
        </div>
        <CaintaStudioMap
          studios={[studio]}
          onNavigate={() => {}}
          selectedStudioId={studio.id}
          height="360px"
        />
      </div>

      {/* 2. TABBED SERVICES, CUSTOM PACKAGES, PRINTS AND REVIEWS */}
      <div className="bg-white rounded-3xl border border-[#e5e1da] shadow-sm overflow-hidden">
        {/* Tab Selection */}
        <div className="bg-gray-50 border-b border-[#e5e1da] flex overflow-x-auto">
          {[
            { id: "services", label: "Photography Services", count: services.length },
            { id: "packages", label: "Customizable Packages", count: packages.length },
            { id: "prints", label: "Printing Shop", count: printProducts.length },
            { id: "reviews", label: "Verified Reviews", count: reviews.length }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`py-4 px-6 font-bold text-xs whitespace-nowrap cursor-pointer border-b-2 transition-all flex items-center gap-2 ${
                activeTab === tab.id 
                  ? "border-[#2c2a29] text-[#2c2a29] bg-white" 
                  : "border-transparent text-[#7c756d] hover:text-[#2c2a29]"
              }`}
            >
              {tab.label}
              <span className="text-[10px] bg-gray-200 text-[#7c756d] px-1.5 py-0.5 rounded-full font-semibold">{tab.count}</span>
            </button>
          ))}
        </div>

        {/* Tab Content Display */}
        <div className="p-6 text-left">
          {/* A. Services Tab */}
          {activeTab === "services" && (
            <div className="grid sm:grid-cols-2 gap-6">
              {services.map((srv) => (
                <Interactive3DTiltCard 
                  key={srv.id} 
                  className="bg-[#faf9f6] border border-[#e5e1da] p-4 rounded-2xl flex flex-row gap-4 w-full h-full"
                >
                  <div className="w-20 flex-shrink-0 space-y-1">
                    <img src={(srv.images?.[0] || srv.image)} alt={srv.name} className="w-20 h-20 rounded-xl object-cover" />
                    {Array.isArray(srv.images) && srv.images.length > 1 && (
                      <div className="grid grid-cols-3 gap-1">
                        {srv.images.slice(1, 4).map((image: string, index: number) => (
                          <img key={`${image.slice(0, 24)}-${index}`} src={image} alt={`${srv.name} sample ${index + 2}`} className="w-6 h-6 rounded object-cover" />
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="space-y-1 text-left flex-1">
                    <h4 className="font-display font-bold text-sm text-[#2c2a29]">{srv.name}</h4>
                    <p className="text-[11px] text-[#7c756d] leading-relaxed line-clamp-2">{srv.description}</p>
                    <div className="flex flex-wrap gap-4 pt-1 text-[10px] text-[#7c756d] font-semibold">
                      <span>Base Rate: <strong className="text-[#2c2a29]">{srv.basePrice} PHP</strong></span>
                      <span>•</span>
                      <span>Duration: {srv.durationMinutes} mins</span>
                    </div>
                  </div>
                </Interactive3DTiltCard>
              ))}
            </div>
          )}

          {/* B. Packages Tab */}
          {activeTab === "packages" && (
            <div className="grid sm:grid-cols-2 gap-6">
              {packages.map((pkg) => (
                <Interactive3DTiltCard 
                  key={pkg.id} 
                  className="bg-[#faf9f6] border border-[#e5e1da] p-5 rounded-2xl flex flex-col justify-between space-y-4 w-full h-full"
                >
                  <div className="flex gap-4">
                    <img src={pkg.image} alt={pkg.name} className="w-16 h-16 rounded-xl object-cover flex-shrink-0" />
                    <div className="space-y-1 text-left flex-1">
                      <h4 className="font-display font-bold text-sm text-[#2c2a29]">{pkg.name}</h4>
                      <p className="text-[11px] text-[#7c756d] line-clamp-2">{pkg.description}</p>
                      <p className="text-xs font-bold text-[#2c2a29]">{pkg.price} PHP</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[10px] text-[#7c756d] pt-3 border-t border-dashed border-[#e5e1da] font-medium text-left">
                    <div>• Edited photos: {pkg.editedPhotosCount}</div>
                    <div>• Included Prints: {pkg.includedPrints}</div>
                    <div className="col-span-2">• Photographer count: {pkg.photographerCount} staff</div>
                  </div>
                </Interactive3DTiltCard>
              ))}
            </div>
          )}

          {/* C. Printing Shop Tab */}
          {activeTab === "prints" && (
            <div>
              {!studio.printingAvailable ? (
                <div className="py-8 text-center text-xs text-[#7c756d]">Printing products are not configured for this studio.</div>
              ) : (
                <div className="space-y-6">
                  {/* Premium physical gallery showcase invitation banner */}
                  <div className="bg-[#faf9f6] border border-[#e5e1da] rounded-2xl p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 text-xs">
                    <div className="space-y-0.5 text-left">
                      <h4 className="font-bold text-[#2c2a29] flex items-center gap-1">
                        <Sparkles size={14} className="text-yellow-600 fill-current" /> Premium Past Physical Print Showcase
                      </h4>
                      <p className="text-[11px] text-[#7c756d] leading-relaxed">
                        Curious about our final printed product quality, paper texture, and framing finishes? Explore our high-definition gallery of real past work.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsExamplePrintsOpen(true)}
                      className="py-2 px-4 bg-[#2c2a29] hover:bg-black text-[#faf9f6] rounded-xl text-[10px] font-bold uppercase tracking-wider cursor-pointer whitespace-nowrap flex items-center gap-1.5 shadow-sm transition-colors"
                    >
                      <ImageIcon size={13} /> Open Visual Showcase
                    </button>
                  </div>

                  <div className="grid sm:grid-cols-3 gap-4">
                  {printProducts.map((prod) => (
                    <Interactive3DTiltCard 
                      key={prod.id} 
                      className="bg-[#faf9f6] border border-[#e5e1da] p-4 rounded-xl flex flex-col justify-between text-left space-y-3 w-full h-full"
                    >
                      <div className="space-y-2">
                        <img src={prod.images?.[0] || prod.image} alt={prod.name} className="w-full h-28 rounded-lg object-cover" />
                        {prod.images && prod.images.length > 1 && (
                          <div className="flex gap-1 overflow-hidden">
                            {prod.images.slice(1, 4).map((image: string, index: number) => (
                              <img key={`${image}-${index}`} src={image} alt={`${prod.name} detail ${index + 2}`} className="h-8 w-8 rounded object-cover" />
                            ))}
                          </div>
                        )}
                        <h4 className="font-semibold text-xs text-[#2c2a29] line-clamp-1">{prod.name}</h4>
                        <p className="text-[10px] text-[#7c756d] line-clamp-1">{prod.description}</p>
                      </div>
                      <div className="flex justify-between items-center pt-2 border-t border-[#faf9f6] text-[10px] font-bold text-[#2c2a29]">
                        <span>Price: {prod.price} PHP</span>
                        <span className="text-[9px] uppercase tracking-wider bg-yellow-100 text-yellow-800 px-1.5 py-0.5 rounded font-bold">
                          {prod.size}
                        </span>
                      </div>
                    </Interactive3DTiltCard>
                  ))}
                </div>
              </div>
              )}
            </div>
          )}

          {/* D. Verified Reviews Tab */}
          {activeTab === "reviews" && (
            <div className="space-y-4">
              {(() => {
                const approvedReviews = reviews.filter(r => r.status === "approved");
                return approvedReviews.length === 0 ? (
                  <div className="py-8 text-center text-xs text-[#7c756d]">No verified reviews listed yet. Complete a booking to provide feedback!</div>
                ) : (
                  <div className="grid gap-4">
                    {approvedReviews.map((rev) => (
                      <div key={rev.id} className="bg-[#faf9f6] border border-[#e5e1da] p-5 rounded-2xl space-y-2">
                        <div className="flex justify-between items-center text-xs font-semibold text-[#2c2a29]">
                          <span className="flex items-center gap-1 font-bold">
                            <User size={14} className="text-[#7c756d]" /> {rev.customerName}
                          </span>
                          <span className="text-[10px] text-[#7c756d]">{new Date(rev.createdAt).toLocaleDateString()}</span>
                        </div>
                        <div className="flex gap-1 text-yellow-500">
                          {[...Array(rev.rating)].map((_, i) => <Star key={i} size={11} className="fill-current" />)}
                        </div>
                        <p className="text-xs text-[#7c756d] leading-relaxed italic">"{rev.comment}"</p>
                        {/* Studio Owner Reply */}
                        {rev.reply && (
                          <div className="mt-2 bg-blue-50 border border-blue-100 rounded-xl px-4 py-2.5 text-xs text-blue-900">
                            <span className="font-bold block text-[10px] uppercase tracking-wider text-blue-500 mb-0.5">Studio Response</span>
                            {rev.reply}
                            {rev.replyAt && <span className="text-[10px] text-blue-400 ml-2">· {new Date(rev.replyAt).toLocaleDateString()}</span>}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>
          )}

        </div>
      </div>

      {/* 3. EXAMPLE PRINTS PHYSICAL SHOWCASE MODAL */}
      {isExamplePrintsOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 transition-all">
          {/* Main Modal Panel */}
          <div className="bg-[#faf9f6] w-full max-w-5xl rounded-3xl shadow-2xl border border-[#e5e1da] overflow-hidden flex flex-col max-h-[90vh] text-[#2c2a29] text-left">
            
            {/* Header */}
            <div className="p-5 sm:p-6 border-b border-[#e5e1da] flex justify-between items-center bg-white">
              <div className="space-y-0.5">
                <span className="text-[10px] bg-[#2c2a29] text-white font-extrabold uppercase px-2 py-0.5 rounded tracking-wider">
                  Physical Print Showcase
                </span>
                <h3 className="font-display text-lg font-extrabold text-[#2c2a29]">
                  Studio Print Gallery
                </h3>
              </div>
              <button
                onClick={() => setIsExamplePrintsOpen(false)}
                className="p-2 rounded-full hover:bg-gray-100 text-gray-500 hover:text-black cursor-pointer transition-colors"
                title="Close Showcase"
              >
                <X size={18} />
              </button>
            </div>

            {/* Split Screen Content Body */}
            <div className="flex-1 overflow-y-auto grid md:grid-cols-12">
              {pastPrintProjects.length === 0 ? (
                <div className="md:col-span-12 p-12 text-center space-y-3">
                  <ImageIcon size={32} className="mx-auto text-[#7c756d]" />
                  <h4 className="font-display text-lg font-bold">No print gallery items yet</h4>
                  <p className="text-xs text-[#7c756d]">This studio has not published any print products yet.</p>
                </div>
              ) : (
              <>
              
              {/* Left Side: Large HD Image Preview Panel (7 columns) */}
              <div className="md:col-span-7 bg-white p-6 flex flex-col justify-between border-r border-[#e5e1da] space-y-4">
                <div className="space-y-3">
                  <div className="aspect-[4/3] rounded-2xl overflow-hidden bg-[#faf9f6] relative border border-[#e5e1da] group shadow-inner">
                    <img
                      src={pastPrintProjects[selectedProj].image}
                      alt={pastPrintProjects[selectedProj].title}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                      referrerPolicy="no-referrer"
                    />
                    <span className="absolute bottom-3 left-3 text-[10px] bg-[#2c2a29]/80 backdrop-blur-sm text-white font-bold px-2 py-1 rounded-lg">
                      {pastPrintProjects[selectedProj].category}
                    </span>
                  </div>
                  
                  <div className="space-y-2">
                    <h4 className="font-display text-xl font-extrabold text-[#2c2a29]">
                      {pastPrintProjects[selectedProj].title}
                    </h4>
                    <p className="text-xs text-[#7c756d] leading-relaxed font-light">
                      {pastPrintProjects[selectedProj].description}
                    </p>
                  </div>
                </div>

                {/* Print Specs Box */}
                <div className="bg-[#faf9f6] border border-[#e5e1da] p-4 rounded-2xl grid grid-cols-2 gap-4 text-[11px] font-semibold">
                  <div className="space-y-1">
                    <span className="text-[9px] uppercase text-gray-400 font-extrabold tracking-wider flex items-center gap-1">
                      <Layers size={10} /> Fabricated Material
                    </span>
                    <p className="text-[#2c2a29] leading-snug font-medium">
                      {pastPrintProjects[selectedProj].material}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[9px] uppercase text-gray-400 font-extrabold tracking-wider flex items-center gap-1">
                      <Info size={10} /> Aspect Ratio / Size
                    </span>
                    <p className="text-[#2c2a29] leading-snug font-medium">
                      {pastPrintProjects[selectedProj].dimensions}
                    </p>
                  </div>
                </div>
              </div>

              {/* Right Side: Showcase Selectors Panel (5 columns) */}
              <div className="md:col-span-5 p-6 bg-gray-50 flex flex-col justify-between space-y-6">
                <div className="space-y-4">
                  <span className="text-[10px] text-gray-400 font-extrabold uppercase tracking-widest block">
                    Select Print Specimen ({pastPrintProjects.length} Available)
                  </span>
                  
                  <div className="space-y-2.5">
                    {pastPrintProjects.map((proj, idx) => {
                      const isActive = selectedProj === idx;
                      return (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => setSelectedProj(idx)}
                          className={`w-full p-3.5 rounded-2xl border text-left flex gap-3 transition-all cursor-pointer items-center ${
                            isActive
                              ? "bg-white border-[#2c2a29] shadow-md ring-1 ring-[#2c2a29]"
                              : "bg-[#faf9f6] border-[#e5e1da] hover:border-[#7c756d]"
                          }`}
                        >
                          <div className="w-12 h-12 rounded-xl overflow-hidden flex-shrink-0 bg-gray-200">
                            <img src={proj.image} alt={proj.title} className="w-full h-full object-cover" />
                          </div>
                          <div className="flex-1 space-y-0.5 min-w-0">
                            <div className="flex justify-between items-center">
                              <span className="text-[9px] font-extrabold uppercase tracking-wider text-yellow-600 bg-yellow-50 px-1 rounded">
                                {proj.category}
                              </span>
                            </div>
                            <h5 className="font-bold text-xs text-[#2c2a29] truncate">
                              {proj.title}
                            </h5>
                            <p className="text-[10px] text-[#7c756d] truncate font-light">
                              {proj.material}
                            </p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Call to action print launcher */}
                <div className="bg-[#faf9f6] border border-[#e5e1da] p-4 rounded-2xl space-y-2 text-center">
                  <p className="text-[10px] text-[#7c756d]">
                    Ready to turn your high-resolution digital files into real physical specimens?
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setIsExamplePrintsOpen(false);
                      onOpenPrintWizard();
                    }}
                    className="w-full py-2 bg-[#2c2a29] hover:bg-black text-[#faf9f6] text-xs font-bold uppercase tracking-wider rounded-xl cursor-pointer flex items-center justify-center gap-1.5 shadow-sm transition-colors"
                  >
                    <Printer size={13} /> Order Print Now
                  </button>
                </div>

              </div>

              </>
              )}
            </div>

            {/* Footer close option */}
            <div className="p-4 bg-white border-t border-[#e5e1da] flex justify-end">
              <button
                type="button"
                onClick={() => setIsExamplePrintsOpen(false)}
                className="px-5 py-2 border border-[#e5e1da] hover:border-[#2c2a29] font-bold text-xs uppercase tracking-wider rounded-xl cursor-pointer transition-colors text-gray-600 hover:text-black"
              >
                Close Gallery Showcase
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
