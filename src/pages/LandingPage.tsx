import React, { useState, useEffect } from "react";
import {
  Camera, Search, ArrowRight, Star, Heart, CheckCircle2, ChevronRight, HelpCircle,
  MapPin, Sparkles, Sliders, Calendar, ShieldCheck, Flame, Award, Check,
  Layers, Image as ImageIcon, Zap, Play, X, Compass, Users, GraduationCap,
  Store, PhoneCall, ExternalLink, ShieldAlert, BookOpen, Quote
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Interactive3DTiltCard, MagnetButton, ScrollReveal } from "../components/MotionCard.tsx";
import { SoundEngine } from "../utils/soundEffects.ts";

interface LandingPageProps {
  studios: any[];
  categories: any[];
  onNavigate: (page: string, params?: any) => void;
  favorites: any[];
  onToggleFavorite: (studioId: string) => void;
  cms?: { [key: string]: string };
  bookings?: any[];
  reviews?: any[];
  faqs?: any[];
  demoVideoUrl?: string;
  showDemoVideo?: boolean;
}

export default function LandingPage({
  studios,
  categories,
  onNavigate,
  favorites,
  onToggleFavorite,
  cms,
  bookings = [],
  reviews = [],
  faqs = [],
  demoVideoUrl = "",
  showDemoVideo = false
}: LandingPageProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFaq, setActiveFaq] = useState<number | null>(null);
  const [selectedSpotlightCategory, setSelectedSpotlightCategory] = useState<string>("ALL");
  const [isVideoOpen, setIsVideoOpen] = useState(false);

  // Close video modal on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isVideoOpen) {
        setIsVideoOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isVideoOpen]);

  const getCmsValue = (key: string, fallback: string) => {
    return cms && cms[key] ? cms[key] : fallback;
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    SoundEngine.playPop();
    onNavigate("directory", { search: searchQuery });
  };

  const handleCategoryClick = (catName: string) => {
    SoundEngine.playPop();
    onNavigate("directory", { category: catName });
  };

  const handleQuickTagClick = (tag: string) => {
    SoundEngine.playPop();
    setSearchQuery(tag);
    onNavigate("directory", { search: tag });
  };

  // Filter studios for the spotlight section
  const filteredSpotlightStudios = studios.filter((st) => {
    if (selectedSpotlightCategory === "ALL") return true;
    if (selectedSpotlightCategory === "VERIFIED") return st.isApproved;
    const catList = Array.isArray(st.categories)
      ? st.categories
      : typeof st.categories === "string"
      ? st.categories.split(",").map((c: string) => c.trim())
      : [];
    return catList.some((c: string) =>
      c.toLowerCase().includes(selectedSpotlightCategory.toLowerCase())
    );
  });

  // Top photography specialties for visual category discovery
  const getCategoryIcon = (name: string) => {
    const lower = name.toLowerCase();
    if (lower.includes("grad") || lower.includes("toga") || lower.includes("acad")) return GraduationCap;
    if (lower.includes("port") || lower.includes("head") || lower.includes("solo")) return Camera;
    if (lower.includes("wed") || lower.includes("debut") || lower.includes("event") || lower.includes("party")) return Sparkles;
    if (lower.includes("self") || lower.includes("booth") || lower.includes("diy")) return Layers;
    if (lower.includes("prod") || lower.includes("comm") || lower.includes("brand")) return Store;
    if (lower.includes("fam") || lower.includes("baby") || lower.includes("matern") || lower.includes("kid")) return Users;
    return ImageIcon;
  };

  const dynamicStats = [
    { label: "Partner Studios", value: `${studios.length}+`, sub: "Vetted in Cainta" },
    { label: "Photography Styles", value: `${Math.max(categories.length, 6)}`, sub: "Curated genres" },
    { label: "Bookings Managed", value: `${bookings.length}`, sub: "Zero double-books" },
    { label: "Network Status", value: studios.length > 0 ? "Active" : "Available", sub: "Live Real-Time Sync" }
  ];

  const quickSearchTags = [
    "Graduation & Toga",
    "Self-Shoot",
    "Creative Portrait",
    "Debut & Wedding",
    "Family & Kids"
  ];

  return (
    <div className="min-h-screen bg-[#faf8f5] text-[#1c1917] selection:bg-amber-500 selection:text-white pb-20">
      {/* ========================================================================= */}
      {/* 1. EDITORIAL HERO SECTION */}
      {/* ========================================================================= */}
      <section className="relative overflow-hidden pt-12 pb-20 sm:pt-16 sm:pb-28 border-b border-[#e8e4dc]">
        {/* Background Image with Warm Editorial Overlay */}
        <div
          className="absolute inset-0 bg-cover bg-center transition-all duration-700 opacity-25 scale-105 pointer-events-none"
          style={{
            backgroundImage: `url("${getCmsValue(
              "heroBackground",
              "https://images.unsplash.com/photo-1492691527719-9d1e07e534b4?w=1800&fit=crop&q=80"
            )}")`
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-[#faf8f5]/80 via-[#faf8f5]/95 to-[#faf8f5] pointer-events-none" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_15%,rgba(217,119,6,0.12)_0%,transparent_60%)] pointer-events-none" />

        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center space-y-8">
          {/* Top Platform Status Badge */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/90 backdrop-blur-md shadow-xs border border-[#e8e4dc] text-xs font-semibold text-[#292524] mx-auto"
          >
            <span className="flex h-2 w-2 rounded-full bg-amber-500 animate-ping" />
            <span className="h-2 w-2 rounded-full bg-amber-600 -ml-4" />
            <span className="tracking-wide uppercase text-[11px] font-bold text-amber-900">
              Cainta's Premier Photography Studio Network
            </span>
            <span className="text-[#a8a29e]">•</span>
            <span className="text-[#57534e] font-medium hidden sm:inline">Real-Time Booking & Proofing MIS</span>
          </motion.div>

          {/* Main Title & Subtitle */}
          <div className="space-y-4 max-w-4xl mx-auto">
            <motion.h1
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.08, duration: 0.5 }}
              className="font-display text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight text-[#1c1917] leading-[1.08]"
            >
              <span
                dangerouslySetInnerHTML={{
                  __html: getCmsValue(
                    "heroTitle",
                    "Capture Moments. <br /><span class='text-transparent bg-clip-text bg-gradient-to-r from-amber-600 via-amber-500 to-yellow-600'>Cherish Forever.</span>"
                  )
                }}
              />
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.14, duration: 0.5 }}
              className="text-base sm:text-lg text-[#57534e] max-w-2xl mx-auto leading-relaxed font-normal"
            >
              {getCmsValue(
                "heroSubtitle",
                "Discover accredited photo studios across Cainta, Rizal. Check live calendar dates, reserve your time slot with instant downpayment, and order archival framed prints."
              )}
            </motion.p>
          </div>

          {/* Primary Action Buttons */}
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.5 }}
            className="flex flex-wrap items-center justify-center gap-3.5 pt-2"
          >
            <button
              type="button"
              onClick={() => {
                SoundEngine.playPop();
                onNavigate("directory");
              }}
              className="px-8 py-3.5 bg-[#1c1917] hover:bg-black text-white text-xs sm:text-sm font-bold rounded-full shadow-lg hover:shadow-xl transition-all duration-200 flex items-center gap-2.5 cursor-pointer active:scale-95"
            >
              <Calendar size={16} className="text-amber-400" />
              <span>Book a Photoshoot</span>
              <ArrowRight size={14} className="text-gray-400 group-hover:translate-x-1" />
            </button>

            {showDemoVideo && (
              <button
                type="button"
                onClick={() => {
                  SoundEngine.playPop();
                  if (demoVideoUrl) {
                    setIsVideoOpen(true);
                  } else {
                    alert("No platform demo video has been uploaded yet by the Super Admin.");
                  }
                }}
                className="px-6 py-3.5 bg-white hover:bg-[#f5f2ed] text-[#1c1917] text-xs sm:text-sm font-bold rounded-full shadow-xs border border-[#e8e4dc] transition-all duration-200 flex items-center gap-2.5 cursor-pointer"
              >
                <div className="w-6 h-6 rounded-full bg-amber-500 text-white flex items-center justify-center font-bold text-xs shadow-xs">
                  <Play size={10} className="fill-white translate-x-0.5" />
                </div>
                <span>Watch Video Tour</span>
              </button>
            )}
          </motion.div>

          {/* High-Precision Search Box */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.26, duration: 0.5 }}
            className="max-w-3xl mx-auto pt-4 space-y-3"
          >
            <form
              onSubmit={handleSearchSubmit}
              className="flex items-center bg-white rounded-2xl sm:rounded-full p-2 shadow-lg border border-[#e8e4dc] focus-within:ring-2 focus-within:ring-amber-500 focus-within:border-transparent transition-all"
            >
              <div className="flex-1 flex items-center pl-3.5 pr-2">
                <Search size={18} className="text-[#a8a29e] mr-3 flex-shrink-0" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search studios by name, location (e.g. San Roque, Valley Golf), or package..."
                  className="w-full text-[#1c1917] text-xs sm:text-sm bg-transparent border-0 focus:outline-none placeholder-[#a8a29e] font-medium"
                />
              </div>
              <button
                type="submit"
                className="bg-amber-600 hover:bg-amber-700 text-white px-6 py-3 rounded-xl sm:rounded-full text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer shadow-sm active:scale-95 flex-shrink-0"
              >
                <span>Find Studios</span>
                <ArrowRight size={13} />
              </button>
            </form>

            {/* Quick Filter Tags */}
            <div className="flex flex-wrap items-center justify-center gap-2 pt-1 text-xs">
              <span className="text-[#78716c] font-medium text-[11px]">Popular:</span>
              {quickSearchTags.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => handleQuickTagClick(tag)}
                  className="px-3 py-1 rounded-full bg-white/80 hover:bg-amber-50 hover:text-amber-800 hover:border-amber-300 border border-[#e8e4dc] text-[11px] font-semibold text-[#44403c] transition-all cursor-pointer shadow-2xs"
                >
                  {tag}
                </button>
              ))}
            </div>
          </motion.div>

          {/* Unified Platform Metrics Bar */}
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.32, duration: 0.5 }}
            className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6 pt-10 border-t border-[#e8e4dc] max-w-4xl mx-auto"
          >
            {dynamicStats.map((stat) => (
              <div
                key={stat.label}
                className="text-left sm:text-center p-3 sm:p-4 rounded-xl bg-white/50 border border-[#e8e4dc]/60 backdrop-blur-xs"
              >
                <div className="font-display text-2xl sm:text-3xl font-black text-[#1c1917] tracking-tight">
                  {stat.value}
                </div>
                <div className="text-xs font-bold text-amber-700 mt-0.5">{stat.label}</div>
                <div className="text-[10px] text-[#78716c]">{stat.sub}</div>
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 2. CURATED SPOTLIGHT STUDIOS */}
      {/* ========================================================================= */}
      <section className="py-16 bg-[#f5f2ed] border-y border-[#e8e4dc]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
          {/* Section Header with Category Tabs */}
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div className="space-y-1.5 text-left">
              <span className="text-[11px] font-bold uppercase tracking-wider text-amber-800 bg-amber-100/60 px-3 py-1 rounded-full border border-amber-200 inline-flex items-center gap-1.5">
                <Award size={12} /> Verified Cainta Studios
              </span>
              <h2 className="font-display text-2xl sm:text-3xl font-extrabold text-[#1c1917]">
                Featured Studios & Portfolios
              </h2>
              <p className="text-xs sm:text-sm text-[#57534e] max-w-2xl">
                Audited partner studios equipped with pro strobes, color-calibrated displays, and certified photographers in Rizal.
              </p>
            </div>

            {/* Category Filter Chips */}
            <div className="flex flex-wrap items-center gap-2">
              {[
                { label: "All Studios", value: "ALL" },
                { label: "Verified Only", value: "VERIFIED" },
                { label: "Graduation", value: "Graduation" },
                { label: "Portrait", value: "Portrait" },
                { label: "Self-Shoot", value: "Self" }
              ].map((tab) => (
                <button
                  key={tab.value}
                  type="button"
                  onClick={() => {
                    SoundEngine.playPop();
                    setSelectedSpotlightCategory(tab.value);
                  }}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
                    selectedSpotlightCategory === tab.value
                      ? "bg-[#1c1917] text-white shadow-xs"
                      : "bg-white text-[#57534e] border border-[#e8e4dc] hover:border-[#1c1917]"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Studios Cards Grid */}
          {filteredSpotlightStudios.length > 0 ? (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {filteredSpotlightStudios.slice(0, 8).map((st) => {
                const isFav = favorites.some((f) => f.studioId === st.id);
                const categoriesList = Array.isArray(st.categories)
                  ? st.categories
                  : typeof st.categories === "string"
                  ? st.categories.split(",").map((c: string) => c.trim())
                  : [];

                return (
                  <Interactive3DTiltCard
                    key={st.id}
                    className="group bg-white rounded-2xl border border-[#e8e4dc] overflow-hidden shadow-xs hover:shadow-xl transition-all duration-300 flex flex-col h-full"
                  >
                    {/* Cover Image & Badges */}
                    <div className="relative h-48 sm:h-52 overflow-hidden bg-gray-100">
                      <img
                        src={
                          st.coverImage ||
                          "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=900&fit=crop&q=80"
                        }
                        alt={st.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        referrerPolicy="no-referrer"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/15 to-transparent" />

                      {/* Favorite Button */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          SoundEngine.playPop();
                          onToggleFavorite(st.id);
                        }}
                        className="absolute top-3 right-3 p-2 rounded-full bg-white/90 backdrop-blur-sm text-gray-500 hover:text-red-500 transition-colors shadow-sm cursor-pointer z-30"
                        title={isFav ? "Remove from favorites" : "Save to favorites"}
                      >
                        <Heart
                          size={15}
                          className={isFav ? "fill-red-500 text-red-500" : ""}
                        />
                      </button>

                      {/* Top Badges */}
                      <div className="absolute top-3 left-3 flex flex-wrap gap-1.5 z-20">
                        {st.isApproved && (
                          <span className="bg-emerald-600/90 backdrop-blur-xs text-white text-[10px] font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1 shadow-xs">
                            <CheckCircle2 size={10} /> Verified
                          </span>
                        )}
                      </div>

                      {/* Bottom Image Overlay Info */}
                      <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-white z-20">
                        <span className="text-[11px] font-medium flex items-center gap-1 bg-black/40 backdrop-blur-sm px-2.5 py-0.5 rounded-full text-white/90">
                          <MapPin size={11} className="text-amber-400" />
                          <span className="truncate max-w-[120px]">{st.location || "Cainta, Rizal"}</span>
                        </span>
                        <span className="inline-flex items-center gap-1 text-xs font-bold bg-black/50 backdrop-blur-sm px-2 py-0.5 rounded-full text-amber-400">
                          <Star size={11} className="fill-amber-400 text-amber-400" />
                          <span>{st.rating ? st.rating.toFixed(1) : "4.9"}</span>
                        </span>
                      </div>
                    </div>

                    {/* Studio Body Information */}
                    <div className="p-4 sm:p-5 flex-1 flex flex-col justify-between text-left space-y-3">
                      <div>
                        <div className="text-[10px] font-bold uppercase tracking-wider text-amber-700">
                          {categoriesList[0] || "Professional Photography"}
                        </div>
                        <h3 className="font-display text-base sm:text-lg font-bold text-[#1c1917] mt-0.5 leading-snug line-clamp-1 group-hover:text-amber-700 transition-colors">
                          {st.name}
                        </h3>
                        <p className="text-xs text-[#78716c] line-clamp-2 mt-1 leading-relaxed">
                          {st.description || "Premier studio setup with complete lighting gear and backdrops."}
                        </p>
                      </div>

                      {/* Category Tags */}
                      {categoriesList.length > 1 && (
                        <div className="flex flex-wrap gap-1 pt-1">
                          {categoriesList.slice(1, 3).map((tag: string) => (
                            <span
                              key={tag}
                              className="text-[10px] font-medium bg-[#faf8f5] text-[#57534e] px-2 py-0.5 rounded-md border border-[#e8e4dc]"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Card Footer: Price & Action */}
                      <div className="pt-3 border-t border-[#e8e4dc] flex items-center justify-between">
                        <div>
                          <span className="text-[10px] uppercase font-semibold text-[#a8a29e] block">Starting at</span>
                          <span className="font-display text-sm font-black text-[#1c1917]">
                            ₱{st.startingPrice?.toLocaleString() || "1,000"}
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            SoundEngine.playPop();
                            onNavigate("profile", { id: st.id });
                          }}
                          className="px-3.5 py-1.5 bg-[#1c1917] hover:bg-amber-600 text-white text-xs font-bold rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                        >
                          <span>View Studio</span>
                          <ChevronRight size={13} />
                        </button>
                      </div>
                    </div>
                  </Interactive3DTiltCard>
                );
              })}
            </div>
          ) : (
            <div className="p-12 text-center bg-white rounded-2xl border border-dashed border-[#e8e4dc] text-[#78716c] space-y-2">
              <Camera size={28} className="mx-auto text-amber-600" />
              <div className="font-bold text-sm text-[#1c1917]">No studios found in this category</div>
              <p className="text-xs">Try switching tabs or browse the complete studio directory.</p>
            </div>
          )}

          {/* Directory CTA */}
          <div className="pt-4 text-center">
            <button
              type="button"
              onClick={() => {
                SoundEngine.playPop();
                onNavigate("directory");
              }}
              className="px-7 py-3 bg-white hover:bg-[#faf8f5] border border-[#e8e4dc] hover:border-[#1c1917] text-[#1c1917] text-xs font-bold rounded-full shadow-xs transition-all inline-flex items-center gap-2 cursor-pointer"
            >
              <span>Explore All {studios.length} Cainta Studios</span>
              <ArrowRight size={14} />
            </button>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 3. PHOTOGRAPHY SPECIALTIES (CATEGORY DISCOVERY) */}
      {/* ========================================================================= */}
      <section className="py-16 sm:py-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div className="space-y-1 text-left">
            <span className="text-[11px] font-bold uppercase tracking-wider text-amber-700 bg-amber-50 px-3 py-1 rounded-full border border-amber-200 inline-flex items-center gap-1.5">
              <Compass size={12} /> Curated Photography Styles
            </span>
            <h2 className="font-display text-2xl sm:text-3xl font-extrabold text-[#1c1917]">
              Explore by Photoshoot Category
            </h2>
            <p className="text-xs sm:text-sm text-[#78716c] max-w-2xl">
              From academic toga portraiture to creative studio rental, discover verified Cainta studios tailored to your milestone.
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              SoundEngine.playPop();
              onNavigate("directory");
            }}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-800 hover:text-amber-900 transition-colors cursor-pointer self-start sm:self-auto"
          >
            <span>View All Categories</span>
            <ChevronRight size={14} />
          </button>
        </div>

        {/* Categories Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
          {(categories.length > 0
            ? categories
            : [
                { id: "1", name: "Graduation & Toga", description: "Cap, gown, diploma & formal portraits" },
                { id: "2", name: "Portraits & Headshots", description: "Corporate, creative & model portfolios" },
                { id: "3", name: "Weddings & Debut", description: "Milestone celebrations & pre-shoots" },
                { id: "4", name: "Self-Shoot Booth", description: "DIY wireless shutter creative rooms" },
                { id: "5", name: "Family & Newborn", description: "Warm family albums & maternity" },
                { id: "6", name: "Commercial & Studio", description: "Product catalog & studio space rental" }
              ]
          ).map((cat: any) => {
            const catName = typeof cat === "string" ? cat : cat.name;
            const catDesc = cat.description || "Verified studio packages";
            const IconComponent = getCategoryIcon(catName);

            return (
              <button
                key={cat.id || catName}
                type="button"
                onClick={() => handleCategoryClick(catName)}
                className="group p-4 sm:p-5 rounded-2xl bg-white border border-[#e8e4dc] hover:border-amber-400 hover:shadow-md transition-all duration-200 text-left flex flex-col justify-between space-y-3 cursor-pointer"
              >
                <div className="w-10 h-10 rounded-xl bg-amber-50 group-hover:bg-amber-500 text-amber-700 group-hover:text-white flex items-center justify-center transition-colors">
                  <IconComponent size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-xs sm:text-sm text-[#1c1917] group-hover:text-amber-700 transition-colors line-clamp-1">
                    {catName}
                  </h3>
                  <p className="text-[11px] text-[#78716c] line-clamp-2 mt-0.5 leading-snug">
                    {catDesc}
                  </p>
                </div>
                <div className="text-[10px] font-bold text-amber-700 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <span>Explore</span>
                  <ArrowRight size={10} />
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 4. SEAMLESS 3-STEP BOOKING JOURNEY (HOW IT WORKS) */}
      {/* ========================================================================= */}
      <section className="py-16 sm:py-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center space-y-3 max-w-2xl mx-auto mb-12">
          <span className="text-[11px] font-bold uppercase tracking-wider text-amber-700 bg-amber-50 px-3 py-1 rounded-full border border-amber-200 inline-flex items-center gap-1.5">
            <Sparkles size={12} /> Simple & Transparent Workflow
          </span>
          <h2 className="font-display text-2xl sm:text-3xl font-extrabold text-[#1c1917]">
            How Cainta Photo Studio MIS Works
          </h2>
          <p className="text-xs sm:text-sm text-[#78716c]">
            Book verified photo studios in minutes with synchronized calendar schedules, instant digital receipts, and guaranteed studio reservations.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 lg:gap-8 relative">
          {/* Step 1 */}
          <div className="p-6 sm:p-8 rounded-3xl bg-white border border-[#e8e4dc] shadow-xs relative text-left space-y-4 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <span className="font-display text-4xl font-black text-amber-500/25">01</span>
              <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-700 flex items-center justify-center">
                <Search size={22} />
              </div>
            </div>
            <h3 className="font-display text-lg font-bold text-[#1c1917]">
              Browse & Compare Studios
            </h3>
            <p className="text-xs text-[#78716c] leading-relaxed">
              Explore studio amenities, sample albums, graduation togas, HMUA inclusions, and live rate cards across Cainta.
            </p>
            <ul className="text-[11px] text-[#57534e] space-y-1.5 pt-2 border-t border-[#f5f2ed]">
              <li className="flex items-center gap-1.5">
                <Check size={12} className="text-emerald-600" /> Transparent pricing & inclusions
              </li>
              <li className="flex items-center gap-1.5">
                <Check size={12} className="text-emerald-600" /> Vetted camera & lighting equipment
              </li>
            </ul>
          </div>

          {/* Step 2 */}
          <div className="p-6 sm:p-8 rounded-3xl bg-white border border-[#e8e4dc] shadow-xs relative text-left space-y-4 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <span className="font-display text-4xl font-black text-amber-500/25">02</span>
              <div className="w-12 h-12 rounded-2xl bg-blue-500/10 text-blue-700 flex items-center justify-center">
                <Calendar size={22} />
              </div>
            </div>
            <h3 className="font-display text-lg font-bold text-[#1c1917]">
              Pick Date & Pay Downpayment
            </h3>
            <p className="text-xs text-[#78716c] leading-relaxed">
              Select your ideal date & time slot directly on the live calendar. Upload your GCash or Maya payment receipt for instant lock.
            </p>
            <ul className="text-[11px] text-[#57534e] space-y-1.5 pt-2 border-t border-[#f5f2ed]">
              <li className="flex items-center gap-1.5">
                <Check size={12} className="text-emerald-600" /> Real-time atomic slot lock
              </li>
              <li className="flex items-center gap-1.5">
                <Check size={12} className="text-emerald-600" /> Instant PDF confirmation voucher
              </li>
            </ul>
          </div>

          {/* Step 3 */}
          <div className="p-6 sm:p-8 rounded-3xl bg-white border border-[#e8e4dc] shadow-xs relative text-left space-y-4 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <span className="font-display text-4xl font-black text-amber-500/25">03</span>
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-700 flex items-center justify-center">
                <ImageIcon size={22} />
              </div>
            </div>
            <h3 className="font-display text-lg font-bold text-[#1c1917]">
              Photoshoot, Proofs & Prints
            </h3>
            <p className="text-xs text-[#78716c] leading-relaxed">
              Enjoy your relaxed session! Review watermarked proofs in your client portal, select retouches, and order custom Rizal wood frames.
            </p>
            <ul className="text-[11px] text-[#57534e] space-y-1.5 pt-2 border-t border-[#f5f2ed]">
              <li className="flex items-center gap-1.5">
                <Check size={12} className="text-emerald-600" /> 48-Hour client digital proofing
              </li>
              <li className="flex items-center gap-1.5">
                <Check size={12} className="text-emerald-600" /> Archival canvas & wood frames
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 5. VERIFIED STUDIO STANDARDS & SERVICE GUARANTEES */}
      {/* ========================================================================= */}
      <section className="py-16 sm:py-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        <div className="text-center space-y-2 max-w-2xl mx-auto">
          <span className="text-[11px] font-bold uppercase tracking-wider text-amber-700 bg-amber-50 px-3 py-1 rounded-full border border-amber-200 inline-flex items-center gap-1.5">
            <ShieldCheck size={12} /> Quality Assurance
          </span>
          <h2 className="font-display text-2xl sm:text-3xl font-extrabold text-[#1c1917]">
            Why Book Through Cainta Photography Studio MIS
          </h2>
          <p className="text-xs sm:text-sm text-[#78716c]">
            Every partner studio in Cainta is vetted for professional lighting, calibrated monitors, sanitized graduation togas, and punctual photo delivery.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 text-left">
          <div className="bg-white p-6 rounded-2xl border border-[#e8e4dc] space-y-3 shadow-xs hover:border-amber-400 hover:shadow-md transition-all">
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-800 flex items-center justify-center font-bold">
              <Calendar size={20} />
            </div>
            <h3 className="font-bold text-sm text-[#1c1917]">Real-Time Schedule Lock</h3>
            <p className="text-xs text-[#78716c] leading-relaxed">
              Synchronized atomic database transactions prevent double bookings or schedule overlaps across all studio bays.
            </p>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-[#e8e4dc] space-y-3 shadow-xs hover:border-amber-400 hover:shadow-md transition-all">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-800 flex items-center justify-center font-bold">
              <ShieldCheck size={20} />
            </div>
            <h3 className="font-bold text-sm text-[#1c1917]">Accredited Setups</h3>
            <p className="text-xs text-[#78716c] leading-relaxed">
              Studios feature studio strobes, clean seamless backdrops, sanitized school togas, and dedicated vanity powder rooms.
            </p>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-[#e8e4dc] space-y-3 shadow-xs hover:border-amber-400 hover:shadow-md transition-all">
            <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-800 flex items-center justify-center font-bold">
              <Zap size={20} />
            </div>
            <h3 className="font-bold text-sm text-[#1c1917]">Fast High-Res Proofing</h3>
            <p className="text-xs text-[#78716c] leading-relaxed">
              Access watermarked draft galleries, review master retouches, and download full-resolution ZIP archives directly from your dashboard.
            </p>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-[#e8e4dc] space-y-3 shadow-xs hover:border-amber-400 hover:shadow-md transition-all">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-800 flex items-center justify-center font-bold">
              <ImageIcon size={20} />
            </div>
            <h3 className="font-bold text-sm text-[#1c1917]">Artisan Wood & Canvas Prints</h3>
            <p className="text-xs text-[#78716c] leading-relaxed">
              Order archival 8x10, 11x14, or 16x20 wood canvas frames crafted by local Rizal artisans, available for studio pickup.
            </p>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 7. VERIFIED REVIEWS & TESTIMONIALS */}
      {/* ========================================================================= */}
      <section className="py-16 bg-[#f5f2ed] border-y border-[#e8e4dc]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
          <div className="text-center space-y-2 max-w-2xl mx-auto">
            <span className="text-[11px] font-bold uppercase tracking-wider text-amber-800 bg-amber-100/70 px-3 py-1 rounded-full border border-amber-200 inline-flex items-center gap-1.5">
              <Star size={12} className="fill-amber-600 text-amber-600" /> Client Experiences
            </span>
            <h2 className="font-display text-2xl sm:text-3xl font-extrabold text-[#1c1917]">
              Loved by Students & Families in Cainta
            </h2>
            <p className="text-xs sm:text-sm text-[#57534e]">
              Read verified feedback from graduates, debutantes, and couples who booked through our system.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {reviews.length > 0 ? (
              reviews.slice(0, 6).map((review) => {
                const studio = studios.find((item) => item.id === review.studioId);
                return (
                  <div
                    key={review.id}
                    className="rounded-2xl border border-[#e8e4dc] bg-white p-6 text-left shadow-xs space-y-3.5 flex flex-col justify-between"
                  >
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-bold text-sm text-[#1c1917]">{review.customerName}</p>
                          <p className="text-[11px] text-[#78716c] font-medium">
                            {studio?.name || "Cainta Photography Studio"}
                          </p>
                        </div>
                        <span className="text-[10px] text-[#a8a29e] whitespace-nowrap">
                          {new Date(review.createdAt).toLocaleDateString("en-PH", {
                            month: "short",
                            day: "numeric",
                            year: "numeric"
                          })}
                        </span>
                      </div>

                      <div className="flex items-center gap-1 text-amber-500" aria-label={`${review.rating} stars`}>
                        {[1, 2, 3, 4, 5].map((star) => (
                          <Star
                            key={star}
                            size={14}
                            className={star <= review.rating ? "fill-amber-400 text-amber-400" : "text-gray-200"}
                          />
                        ))}
                      </div>

                      <p className="text-xs text-[#57534e] leading-relaxed italic">
                        "{review.comment}"
                      </p>
                    </div>

                    {review.reply && (
                      <div className="mt-3 bg-[#faf8f5] border border-[#e8e4dc] rounded-xl p-3 text-[11px] text-[#44403c] space-y-1">
                        <span className="font-bold block text-[10px] uppercase tracking-wider text-amber-800">
                          Studio Response:
                        </span>
                        <p className="text-xs text-[#57534e]">{review.reply}</p>
                      </div>
                    )}
                  </div>
                );
              })
            ) : (
              <div className="md:col-span-3 rounded-2xl border border-dashed border-[#e8e4dc] bg-white p-8 text-center text-xs text-[#78716c]">
                No public reviews posted yet. Reviews will automatically show here as clients share their experience.
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 8. FREQUENTLY ASKED QUESTIONS (ACCORDION) */}
      {/* ========================================================================= */}
      <section className="py-16 sm:py-20 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-left space-y-8">
        <div className="text-center space-y-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-amber-700 bg-amber-50 px-3 py-1 rounded-full border border-amber-200 inline-flex items-center gap-1.5">
            <HelpCircle size={12} /> Client Support
          </span>
          <h2 className="font-display text-2xl sm:text-3xl font-extrabold text-[#1c1917]">
            Frequently Asked Questions
          </h2>
          <p className="text-xs sm:text-sm text-[#78716c]">
            Everything you need to know about booking, payments, rescheduling, and proofing deliveries.
          </p>
        </div>

        {faqs.length > 0 ? (
          <div className="bg-white border border-[#e8e4dc] rounded-2xl divide-y divide-[#e8e4dc] shadow-xs overflow-hidden">
            {faqs.map((faq, idx) => {
              const isOpen = activeFaq === idx;
              const q = faq.question || faq.q;
              const a = faq.answer || faq.a;

              return (
                <div key={faq.id || idx} className="transition-colors">
                  <button
                    type="button"
                    onClick={() => {
                      SoundEngine.playPop();
                      setActiveFaq(isOpen ? null : idx);
                    }}
                    className="w-full p-5 text-left flex items-center justify-between gap-4 font-bold text-xs sm:text-sm text-[#1c1917] hover:bg-[#faf8f5] cursor-pointer"
                  >
                    <span className="flex items-center gap-3">
                      <span className="w-6 h-6 rounded-full bg-amber-50 text-amber-700 flex items-center justify-center text-xs font-bold shrink-0">
                        ?
                      </span>
                      <span>{q}</span>
                    </span>
                    <span className="text-base font-bold text-[#a8a29e] shrink-0">
                      {isOpen ? "−" : "+"}
                    </span>
                  </button>
                  <AnimatePresence>
                    {isOpen && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                      >
                        <p className="px-5 pb-5 pt-1 text-xs text-[#57534e] leading-relaxed pl-14">
                          {a}
                        </p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="bg-white border border-dashed border-[#e8e4dc] rounded-2xl p-8 text-center text-xs text-[#78716c] space-y-2">
            <HelpCircle size={20} className="mx-auto text-amber-500/60" />
            <p className="font-semibold text-[#44403c]">No FAQs published yet.</p>
            <p>The Super Admin can add frequently asked questions from the Admin Dashboard under <span className="font-bold text-amber-700">Questions &amp; Policies</span>.</p>
          </div>
        )}
      </section>

      {/* ========================================================================= */}
      {/* 9. STUDIO PARTNER ONBOARDING BANNER */}
      {/* ========================================================================= */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="rounded-3xl bg-gradient-to-br from-[#1c1917] via-[#292524] to-[#1c1917] text-white p-8 sm:p-12 lg:p-16 relative overflow-hidden shadow-xl border border-[#3f3b39]">
          <div className="absolute right-0 top-0 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="relative z-10 max-w-2xl space-y-6 text-left">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/20 text-amber-400 text-[11px] font-bold uppercase tracking-wider border border-amber-500/30">
              <Store size={13} /> Partner Network
            </span>
            <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight leading-tight">
              Are you a Studio Owner or Photographer in Cainta?
            </h2>
            <p className="text-xs sm:text-sm text-[#d6d3d1] leading-relaxed">
              Automate your scheduling, eliminate double-bookings, accept online downpayments, and connect with hundreds of local clients looking for graduation, portrait, and event photoshoots.
            </p>
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  SoundEngine.playPop();
                  onNavigate("login");
                }}
                className="px-6 py-3 bg-amber-500 hover:bg-amber-400 text-[#1c1917] text-xs sm:text-sm font-bold rounded-full shadow-md transition-all flex items-center gap-2 cursor-pointer active:scale-95"
              >
                <span>Register Your Studio</span>
                <ArrowRight size={14} />
              </button>
              <button
                type="button"
                onClick={() => {
                  SoundEngine.playPop();
                  onNavigate("directory");
                }}
                className="px-6 py-3 bg-white/10 hover:bg-white/20 text-white text-xs sm:text-sm font-semibold rounded-full border border-white/20 transition-all cursor-pointer"
              >
                Learn More
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 10. SYSTEM FOOTER */}
      {/* ========================================================================= */}
      <footer className="mt-16 border-t border-[#e8e4dc] bg-white pt-14 pb-8 text-[#78716c] text-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 md:grid-cols-4 gap-8 text-left">
          {/* Col 1: Brand & Overview */}
          <div className="space-y-3 md:col-span-1">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-amber-600 text-white flex items-center justify-center font-bold shadow-xs">
                <Camera size={16} />
              </div>
              <span className="font-display text-base font-extrabold text-[#1c1917]">
                Cainta Photo MIS
              </span>
            </div>
            <p className="text-[11px] text-[#78716c] leading-relaxed">
              The centralized photo studio management information system for Cainta, Rizal. Connecting clients with verified studios for seamless booking, proofing, and print delivery.
            </p>
            <div className="text-[10px] text-amber-800 font-bold flex items-center gap-1.5 pt-1">
              <MapPin size={12} />
              <span>Cainta, Rizal, Philippines</span>
            </div>
          </div>

          {/* Col 2: Services */}
          <div>
            <h4 className="font-bold text-xs uppercase tracking-wider text-[#1c1917] mb-3">
              Photography Specialties
            </h4>
            <ul className="space-y-2 text-[11px]">
              <li>
                <button
                  type="button"
                  onClick={() => handleCategoryClick("Graduation")}
                  className="hover:text-amber-700 transition-colors cursor-pointer"
                >
                  Graduation & Toga Portraits
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => handleCategoryClick("Portrait")}
                  className="hover:text-amber-700 transition-colors cursor-pointer"
                >
                  Solo & Creative Headshots
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => handleCategoryClick("Wedding")}
                  className="hover:text-amber-700 transition-colors cursor-pointer"
                >
                  Weddings, Debut & Celebrations
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => handleCategoryClick("Self-Shoot")}
                  className="hover:text-amber-700 transition-colors cursor-pointer"
                >
                  Self-Shoot DIY Creative Booths
                </button>
              </li>
            </ul>
          </div>

          {/* Col 3: Platform Trust */}
          <div>
            <h4 className="font-bold text-xs uppercase tracking-wider text-[#1c1917] mb-3">
              Platform Standards
            </h4>
            <ul className="space-y-2 text-[11px]">
              <li className="flex items-center gap-1.5">
                <CheckCircle2 size={12} className="text-emerald-600" />
                <span>Zero Double-Booking Guarantee</span>
              </li>
              <li className="flex items-center gap-1.5">
                <CheckCircle2 size={12} className="text-emerald-600" />
                <span>Studio Accreditation Check</span>
              </li>
              <li className="flex items-center gap-1.5">
                <CheckCircle2 size={12} className="text-emerald-600" />
                <span>Encrypted Downpayment Proofs</span>
              </li>
              <li className="flex items-center gap-1.5">
                <CheckCircle2 size={12} className="text-emerald-600" />
                <span>Rizal Artisan Wood Frames</span>
              </li>
            </ul>
          </div>

          {/* Col 4: Quick Portal Access */}
          <div>
            <h4 className="font-bold text-xs uppercase tracking-wider text-[#1c1917] mb-3">
              Portal Access
            </h4>
            <ul className="space-y-2 text-[11px]">
              <li>
                <button
                  type="button"
                  onClick={() => {
                    SoundEngine.playPop();
                    onNavigate("directory");
                  }}
                  className="hover:text-amber-700 transition-colors cursor-pointer"
                >
                  Browse Studios Directory
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => {
                    SoundEngine.playPop();
                    onNavigate("login");
                  }}
                  className="hover:text-amber-700 transition-colors cursor-pointer"
                >
                  Client & Studio Login
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => {
                    SoundEngine.playPop();
                    onNavigate("login");
                  }}
                  className="hover:text-amber-700 transition-colors cursor-pointer"
                >
                  Studio Partner Registration
                </button>
              </li>
            </ul>
          </div>
        </div>

        {/* Copyright */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 border-t border-[#e8e4dc] mt-10 pt-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-[10px] text-[#a8a29e]">
          <p>© 2026 Cainta Photography Studio MIS. All Rights Reserved.</p>
          <p className="flex items-center gap-2">
            <span>Developed for Cainta Studios & Photographers</span>
            <span>•</span>
            <span className="text-emerald-700 font-semibold">System Online</span>
          </p>
        </div>
      </footer>

      {/* ========================================================================= */}
      {/* FLOATING SYSTEM DEMO VIDEO MODAL */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {isVideoOpen && demoVideoUrl && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm"
            onClick={() => setIsVideoOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-4xl bg-[#1c1917] rounded-3xl overflow-hidden shadow-2xl border border-white/10"
            >
              <div className="flex items-center justify-between p-4 border-b border-white/10 bg-black/40">
                <div className="flex items-center gap-2 text-white font-bold text-xs">
                  <Play size={14} className="text-amber-400" />
                  <span>Cainta Photography Studio MIS - System Tour</span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsVideoOpen(false)}
                  className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>
              <div className="p-2 sm:p-4 bg-black">
                <video
                  src={demoVideoUrl}
                  controls
                  autoPlay
                  className="w-full rounded-xl aspect-video bg-black"
                  preload="metadata"
                />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
