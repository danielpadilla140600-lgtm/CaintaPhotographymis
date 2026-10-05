import React, { useState, useEffect } from "react";
import { Search, Star, Heart, CheckCircle2, ShieldAlert, SlidersHorizontal, MapPin, Map, LayoutGrid, Layers, X, Filter, Sparkles, Eye, ArrowRight, Globe, Share2 } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Interactive3DTiltCard, MagnetButton } from "../components/MotionCard.tsx";
import CaintaStudioMap from "../components/CaintaStudioMap.tsx";
import { SoundEngine } from "../utils/soundEffects.ts";

interface StudioDirectoryProps {
  studios: any[];
  categories: any[];
  onNavigate: (page: string, params?: any) => void;
  favorites: any[];
  onToggleFavorite: (studioId: string) => void;
  initialParams?: any;
}

export default function StudioDirectory({
  studios,
  categories,
  onNavigate,
  favorites,
  onToggleFavorite,
  initialParams
}: StudioDirectoryProps) {
  const [searchQuery, setSearchQuery] = useState(initialParams?.search || "");
  const [selectedCategory, setSelectedCategory] = useState(initialParams?.category || "All");
  const [priceRange, setPriceRange] = useState<number>(10000);
  const [minRating, setMinRating] = useState<number>(0);
  const [filteredStudios, setFilteredStudios] = useState<any[]>(studios);
  const [viewMode, setViewMode] = useState<"grid" | "map" | "both">(initialParams?.view === "map" ? "map" : "both");
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);
  const [previewStudio, setPreviewStudio] = useState<any | null>(null);

  useEffect(() => {
    let result = studios;

    // Search query filter
    if (searchQuery.trim() !== "") {
      const q = searchQuery.toLowerCase();
      result = result.filter(s => 
        s.name.toLowerCase().includes(q) || 
        s.description.toLowerCase().includes(q) ||
        s.location.toLowerCase().includes(q) ||
        s.address.toLowerCase().includes(q)
      );
    }

    // Category filter
    if (selectedCategory !== "All") {
      result = result.filter(s => (s.categories && s.categories.includes(selectedCategory)) || s.category === selectedCategory);
    }

    // Starting Price filter
    result = result.filter(s => s.startingPrice <= priceRange);

    // Rating filter
    if (minRating > 0) {
      result = result.filter(s => s.rating >= minRating);
    }

    setFilteredStudios(result);
  }, [searchQuery, selectedCategory, priceRange, minRating, studios]);

  const activeFilterCount = (searchQuery ? 1 : 0) + (selectedCategory !== "All" ? 1 : 0) + (priceRange < 10000 ? 1 : 0) + (minRating > 0 ? 1 : 0);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10 space-y-6 sm:space-y-8 pb-24 md:pb-12">
      {/* Page Title & View Mode Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 sm:gap-4 text-left">
        <div className="space-y-1 min-w-0">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-yellow-500/10 text-yellow-800 text-[10px] font-bold uppercase tracking-wider">
            <Sparkles size={12} className="text-yellow-600" />
            <span className="hidden xs:inline sm:inline">Accredited Cainta Photography Network</span>
            <span className="xs:hidden sm:hidden">Cainta Studios</span>
          </div>
          <h2 className="font-display text-xl sm:text-2xl md:text-3xl font-black text-[#2c2a29]">Explore Photography Studios</h2>
          <p className="text-xs text-gray-500 font-light hidden sm:block">Find verified studios across Valley Golf, San Roque, Sto. Domingo &amp; Cainta Poblacion</p>
        </div>

        {/* View Switcher & Mobile Filter Trigger */}
        <div className="flex items-center gap-2 flex-shrink-0 justify-between sm:justify-start">
          <button
            onClick={() => {
              SoundEngine.playPop();
              setMobileFilterOpen(!mobileFilterOpen);
            }}
            className="lg:hidden px-3 py-2 bg-white border border-[#e5e1da] rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm cursor-pointer text-[#2c2a29]"
          >
            <Filter size={15} />
            <span className="hidden xs:inline">Filters</span>
            {activeFilterCount > 0 && (
              <span className="bg-yellow-600 text-white text-[9px] w-4 h-4 rounded-full flex items-center justify-center font-bold">
                {activeFilterCount}
              </span>
            )}
          </button>

          {/* View mode buttons — icon-only on xs, icon+label on sm+ */}
          <div className="bg-white border border-[#e5e1da] p-1 rounded-xl shadow-xs flex items-center gap-0.5 sm:gap-1">
            <button
              onClick={() => { SoundEngine.playPop(); setViewMode("both"); }}
              className={`px-2 sm:px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition-all cursor-pointer ${
                viewMode === "both" ? "bg-[#2c2a29] text-white shadow-xs" : "text-[#7c756d] hover:text-[#2c2a29]"
              }`}
              title="Split (Map + Grid)"
            >
              <Layers size={14} />
              <span className="hidden md:inline">Split</span>
            </button>

            <button
              onClick={() => { SoundEngine.playPop(); setViewMode("map"); }}
              className={`px-2 sm:px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition-all cursor-pointer ${
                viewMode === "map" ? "bg-[#2c2a29] text-white shadow-xs" : "text-[#7c756d] hover:text-[#2c2a29]"
              }`}
              title="Map View"
            >
              <Map size={14} className="text-yellow-500" />
              <span className="hidden sm:inline">Map</span>
            </button>

            <button
              onClick={() => { SoundEngine.playPop(); setViewMode("grid"); }}
              className={`px-2 sm:px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition-all cursor-pointer ${
                viewMode === "grid" ? "bg-[#2c2a29] text-white shadow-xs" : "text-[#7c756d] hover:text-[#2c2a29]"
              }`}
              title="Grid Only"
            >
              <LayoutGrid size={14} />
              <span className="hidden sm:inline">Grid</span>
            </button>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-12 gap-6 lg:gap-8 items-start min-w-0">
        {/* FILTERS PANEL */}
        <aside className={`lg:col-span-3 bg-white border border-[#e5e1da] rounded-2xl p-5 space-y-6 text-left shadow-sm sticky top-24 ${
          mobileFilterOpen ? "block fixed inset-x-3 top-[68px] z-50 shadow-2xl max-h-[calc(100vh-80px)] overflow-y-auto" : "hidden lg:block"
        }`}>
          <div className="flex items-center justify-between border-b border-gray-100 pb-3">
            <div className="flex items-center gap-2 font-display font-bold text-sm text-[#2c2a29]">
              <SlidersHorizontal size={15} className="text-yellow-600" />
              <span>Search & Filter</span>
            </div>
            <button
              onClick={() => setMobileFilterOpen(false)}
              className="lg:hidden p-1 text-gray-400 hover:text-black cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>

          {/* Search Input */}
          <div className="space-y-1">
            <label className="text-[11px] font-bold uppercase text-[#7c756d] tracking-wider">Studio Keywords</label>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-3 text-[#7c756d]" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search Cainta studio or road..."
                className="w-full bg-[#faf9f6] border border-[#e5e1da] rounded-xl pl-8.5 pr-3 py-2 text-xs focus:outline-none focus:border-[#2c2a29]"
              />
            </div>
          </div>

          {/* Category Filter */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold uppercase text-[#7c756d] tracking-wider">Photography Concept</label>
            <div className="space-y-1 max-h-48 overflow-y-auto pr-1">
              <button
                type="button"
                onClick={() => { SoundEngine.playPop(); setSelectedCategory("All"); }}
                className={`w-full py-1.5 px-3 rounded-lg text-xs text-left transition-colors font-semibold cursor-pointer ${
                  selectedCategory === "All" ? "bg-[#2c2a29] text-white" : "bg-white text-[#2c2a29] hover:bg-gray-50"
                }`}
              >
                All Categories ({studios.length})
              </button>
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => { SoundEngine.playPop(); setSelectedCategory(cat.name); }}
                  className={`w-full py-1.5 px-3 rounded-lg text-xs text-left transition-colors font-semibold cursor-pointer ${
                    selectedCategory === cat.name ? "bg-[#2c2a29] text-white" : "bg-white text-[#2c2a29] hover:bg-gray-50"
                  }`}
                >
                  {cat.name}
                </button>
              ))}
            </div>
          </div>

          {/* Price Range Slider */}
          <div className="space-y-2">
            <div className="flex justify-between items-center text-[11px] font-bold uppercase text-[#7c756d] tracking-wider">
              <span>Max Starting Price</span>
              <span className="text-[#2c2a29] font-black text-xs font-display">₱{priceRange.toLocaleString()}</span>
            </div>
            <input
              type="range"
              min="800"
              max="10000"
              step="100"
              value={priceRange}
              onChange={e => setPriceRange(Number(e.target.value))}
              className="w-full accent-[#2c2a29] cursor-pointer"
            />
          </div>

          {/* Minimum Rating */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold uppercase text-[#7c756d] tracking-wider">Studio Rating</label>
            <div className="flex gap-1.5">
              {[0, 4, 4.5, 4.8].map((stars) => (
                <button
                  key={stars}
                  type="button"
                  onClick={() => { SoundEngine.playPop(); setMinRating(stars); }}
                  className={`flex-1 py-1 rounded-lg text-[10px] font-bold border transition-colors cursor-pointer ${
                    minRating === stars 
                      ? "bg-[#2c2a29] border-[#2c2a29] text-white" 
                      : "bg-white border-[#e5e1da] text-[#7c756d] hover:border-[#7c756d]"
                  }`}
                >
                  {stars === 0 ? "Any" : `${stars}★+`}
                </button>
              ))}
            </div>
          </div>

          {mobileFilterOpen && (
            <button
              onClick={() => { SoundEngine.playFocusBeep(); setMobileFilterOpen(false); }}
              className="w-full py-2.5 bg-[#2c2a29] text-white rounded-xl text-xs font-bold cursor-pointer"
            >
              Apply Filters ({filteredStudios.length} Studios)
            </button>
          )}
        </aside>

        {/* RESULTS */}
        <main className="lg:col-span-9 space-y-6 min-w-0">
          <div className="flex justify-between items-center text-xs text-gray-500 gap-2 min-w-0">
            <span className="flex-shrink-0">Showing <strong className="text-[#2c2a29] font-bold">{filteredStudios.length}</strong> accredited studios</span>
            <span className="text-[11px] text-gray-400 hidden sm:inline truncate">All prices include lighting setup &amp; basic retouch</span>
          </div>

          {/* INTERACTIVE CAINTA MAP */}
          {(viewMode === "map" || viewMode === "both") && (
            <CaintaStudioMap
              studios={filteredStudios}
              onNavigate={onNavigate}
              height={viewMode === "map" ? "480px" : "360px"}
            />
          )}

          {/* STUDIO CARDS GRID */}
          {(viewMode === "grid" || viewMode === "both") && (
            filteredStudios.length === 0 ? (
              <div className="bg-white border border-[#e5e1da] rounded-2xl p-8 sm:p-12 text-center space-y-4 shadow-sm">
                <ShieldAlert className="mx-auto text-yellow-600 animate-bounce" size={40} />
                <h4 className="font-display font-bold text-base text-[#2c2a29]">No studios match current filters</h4>
                <p className="text-xs text-[#7c756d] max-w-sm mx-auto">Try resetting keywords, widening the price budget, or choosing 'All Categories'.</p>
                <button
                  onClick={() => {
                    SoundEngine.playPop();
                    setSearchQuery("");
                    setSelectedCategory("All");
                    setPriceRange(10000);
                    setMinRating(0);
                  }}
                  className="px-5 py-2.5 bg-[#2c2a29] text-white text-xs font-bold rounded-xl hover:bg-gray-800 transition-colors cursor-pointer"
                >
                  Reset All Filters
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {filteredStudios.map((st) => {
                  const isFav = favorites.some(f => f.studioId === st.id);
                  return (
                    <Interactive3DTiltCard
                      key={st.id}
                      className="bg-white rounded-2xl overflow-hidden border border-[#e5e1da] flex flex-col justify-between h-full w-full shadow-sm hover:shadow-lg transition-shadow"
                    >
                      {/* Cover image */}
                      <div className="h-44 relative bg-gray-100 overflow-hidden group">
                        <img
                          src={st.coverImage || null}
                          alt={st.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                          referrerPolicy="no-referrer"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
                        
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            SoundEngine.playPop();
                            onToggleFavorite(st.id);
                          }}
                          className="absolute top-3 right-3 p-2 rounded-full bg-white/90 backdrop-blur-md text-gray-500 hover:text-red-500 transition-colors shadow-sm cursor-pointer z-30"
                        >
                          <Heart size={14} className={isFav ? "fill-red-500 text-red-500" : ""} />
                        </button>

                        <div className="absolute bottom-2 left-2 flex items-center gap-1.5">
                          <span className="bg-[#2c2a29]/90 backdrop-blur-sm text-yellow-400 text-[9px] uppercase tracking-wider px-2 py-0.5 rounded font-black border border-white/10">
                            Cainta, Rizal
                          </span>
                          {st.isApproved && (
                            <span className="bg-emerald-700/90 backdrop-blur-sm text-white text-[9px] px-2 py-0.5 rounded font-bold flex items-center gap-0.5">
                              <CheckCircle2 size={10} /> Verified
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Studio details */}
                      <div className="p-5 text-left flex-1 flex flex-col justify-between space-y-4">
                        <div className="space-y-2">
                          <div className="flex justify-between items-center text-[10px] text-gray-500 font-bold">
                            <span className="flex items-center gap-1 bg-yellow-50 text-yellow-800 px-2 py-0.5 rounded-full border border-yellow-200">
                              <Star size={11} className="fill-yellow-500 text-yellow-500" />
                              {st.rating} ({st.reviewCount} reviews)
                            </span>
                            <span className="text-gray-400 uppercase tracking-wider text-[9px]">
                              {st.category || "Portrait"}
                            </span>
                          </div>
                          <h4 className="font-display font-bold text-base text-[#2c2a29] leading-tight line-clamp-1">{st.name}</h4>
                          <p className="text-[11px] text-gray-500 line-clamp-2 leading-relaxed">{st.description}</p>
                          
                          {/* Map location string */}
                          <p className="text-[10px] text-gray-600 flex items-center gap-1 font-semibold truncate pt-1">
                            <MapPin size={12} className="text-yellow-600 flex-shrink-0" />
                            {st.location}
                          </p>
                        </div>

                        {/* Footer starting price & Action */}
                        <div className="pt-3 border-t border-[#e5e1da] space-y-2">
                          {(st.facebookUrl || st.instagramUrl || st.tiktokUrl || st.otherSocialUrl || st.websiteUrl) && (
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {st.facebookUrl && (
                                <a
                                  href={st.facebookUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={e => e.stopPropagation()}
                                  className="p-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg transition-colors shadow-xs"
                                  title="Facebook Page"
                                >
                                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"></path></svg>
                                </a>
                              )}
                              {st.instagramUrl && (
                                <a
                                  href={st.instagramUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={e => e.stopPropagation()}
                                  className="p-1.5 bg-pink-50 text-pink-700 hover:bg-pink-100 rounded-lg transition-colors shadow-xs"
                                  title="Instagram Profile"
                                >
                                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line></svg>
                                </a>
                              )}
                              {st.tiktokUrl && (
                                <a
                                  href={st.tiktokUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={e => e.stopPropagation()}
                                  className="p-1.5 bg-gray-100 text-black hover:bg-gray-200 rounded-lg transition-colors shadow-xs"
                                  title="TikTok Profile"
                                >
                                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 12a4 4 0 1 0 4 4V4a5 5 0 0 0 5 5"></path></svg>
                                </a>
                              )}
                              {st.otherSocialUrl && (
                                <a
                                  href={st.otherSocialUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={e => e.stopPropagation()}
                                  className="p-1.5 bg-amber-50 text-amber-700 hover:bg-amber-100 rounded-lg transition-colors shadow-xs"
                                  title="Other Social Link"
                                >
                                  <Share2 size={11} />
                                </a>
                              )}
                              {st.websiteUrl && (
                                <a
                                  href={st.websiteUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={e => e.stopPropagation()}
                                  className="p-1.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-lg transition-colors shadow-xs"
                                  title="Official Website"
                                >
                                  <Globe size={11} />
                                </a>
                              )}
                            </div>
                          )}

                          <div className="flex justify-between items-center">
                            <div>
                              <span className="text-[9px] text-gray-400 uppercase block font-bold leading-none">Starts at</span>
                              <span className="text-sm font-black text-[#2c2a29] font-display">₱{st.startingPrice?.toLocaleString()}</span>
                            </div>
                            <MagnetButton
                              sound="focus"
                              onClick={() => onNavigate("profile", { id: st.id })}
                              className="px-3.5 py-1.5 bg-[#2c2a29] hover:bg-[#4a4644] text-white text-xs font-bold rounded-xl shadow-sm transition-colors cursor-pointer"
                            >
                              Explore & Book
                            </MagnetButton>
                          </div>
                        </div>
                      </div>
                    </Interactive3DTiltCard>
                  );
                })}
              </div>
            )
          )}
        </main>
      </div>
    </div>
  );
}
