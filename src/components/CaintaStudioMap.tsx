import React, { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { configureLeafletDefaultMarkerIcons } from "../utils/leafletConfig";
import { Search, MapPin, Star, Camera, ChevronRight, Navigation, ShieldCheck, Compass } from "lucide-react";

interface CaintaStudioMapProps {
  studios: any[];
  onNavigate: (page: string, params?: any) => void;
  selectedStudioId?: string;
  className?: string;
  height?: string;
}

// Major Cainta, Rizal Landmarks & Corridors
const CAINTA_CORRIDORS = [
  { id: "all", name: "All Cainta", center: [14.5830, 121.1150] as [number, number], zoom: 13.5 },
  { id: "ortigas", name: "Ortigas Ave Ext (Valley Golf)", center: [14.5882, 121.1278] as [number, number], zoom: 15 },
  { id: "felix", name: "Felix Ave (Rublou Marketplace)", center: [14.5954, 121.1085] as [number, number], zoom: 15 },
  { id: "imelda", name: "Imelda Ave / Bypass Junction", center: [14.5825, 121.1002] as [number, number], zoom: 15 },
  { id: "town", name: "Town Center (San Roque)", center: [14.5772, 121.1224] as [number, number], zoom: 15.5 },
  { id: "vista", name: "Vista Verde Village", center: [14.6010, 121.1120] as [number, number], zoom: 15 }
];

// Haversine formula to calculate distance in km between two GPS coordinates
function getHaversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round((R * c) * 10) / 10;
}

/**
 * Adds a real map tile layer using Esri World Street Map.
 * Falls back to OpenStreetMap if Esri tiles fail to load. Neither provider requires an API key.
 */
function addRealMapTiles(map: L.Map) {
  // Primary: Esri World Street Map — no API key required
  const esriLayer = L.tileLayer(
    "https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}",
    {
      maxZoom: 20,
      minZoom: 10,
      attribution: "Tiles &copy; Esri",
      crossOrigin: "anonymous"
    }
  );

  // Fallback: OpenStreetMap — no API key required
  const openStreetMapLayer = L.tileLayer(
    "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
    {
      maxZoom: 20,
      minZoom: 10,
      attribution: "&copy; <a href='https://www.openstreetmap.org/copyright'>OpenStreetMap</a> contributors",
      crossOrigin: "anonymous"
    }
  );

  esriLayer.addTo(map);

  // If an Esri tile errors, switch to OpenStreetMap
  esriLayer.on("tileerror", () => {
    if (map.hasLayer(esriLayer)) {
      map.removeLayer(esriLayer);
    }
    if (!map.hasLayer(openStreetMapLayer)) {
      openStreetMapLayer.addTo(map);
    }
  });
}

export default function CaintaStudioMap({
  studios,
  onNavigate,
  selectedStudioId,
  className = "",
  height = "520px"
}: CaintaStudioMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<{ [key: string]: L.Marker }>({});
  const sidebarRef = useRef<HTMLDivElement>(null);

  const [activeCorridor, setActiveCorridor] = useState("all");
  const [mapSearch, setMapSearch] = useState("");
  const [activeStudioId, setActiveStudioId] = useState<string | null>(selectedStudioId || null);
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [sortByNearest, setSortByNearest] = useState<boolean>(false);

  // Keep sidebar max-height in sync with viewport width
  useEffect(() => {
    const updateSidebarHeight = () => {
      if (sidebarRef.current) {
        sidebarRef.current.style.maxHeight = window.innerWidth >= 1024 ? height : "288px";
      }
    };
    updateSidebarHeight();
    window.addEventListener("resize", updateSidebarHeight);
    return () => window.removeEventListener("resize", updateSidebarHeight);
  }, [height]);

  // Default fallback coordinates if a studio does not have lat/lng
  const getStudioCoords = (st: any): [number, number] => {
    if (st.latitude && st.longitude) return [st.latitude, st.longitude];
    if (st.id === "st-lumina") return [14.5882, 121.1278];
    if (st.id === "st-aperture") return [14.5954, 121.1085];
    if (st.id === "st-apex") return [14.5825, 121.1002];
    if (st.id === "st-memory") return [14.5772, 121.1224];
    if (st.id === "st-shuttercraft") return [14.6010, 121.1120];
    return [14.5830, 121.1150];
  };

  // Calculate distance for each studio if user location is known
  const studiosWithDistance = studios.map(st => {
    const coords = getStudioCoords(st);
    let distanceKm: number | null = null;
    if (userLocation) {
      distanceKm = getHaversineKm(userLocation[0], userLocation[1], coords[0], coords[1]);
    } else {
      // Default relative to Cainta Town Center (14.5772, 121.1224)
      distanceKm = getHaversineKm(14.5772, 121.1224, coords[0], coords[1]);
    }
    return { ...st, distanceKm };
  });

  // Filter & Sort studios based on search bar & corridor
  let filteredStudios = studiosWithDistance.filter((s) => {
    const q = mapSearch.toLowerCase();
    const matchesSearch = 
      s.name.toLowerCase().includes(q) ||
      s.location.toLowerCase().includes(q) ||
      s.address.toLowerCase().includes(q) ||
      s.categories.some((c: string) => c.toLowerCase().includes(q));

    if (!matchesSearch) return false;

    if (activeCorridor === "ortigas") return s.location.toLowerCase().includes("ortigas") || s.address.toLowerCase().includes("valley golf");
    if (activeCorridor === "felix") return s.location.toLowerCase().includes("felix") || s.address.toLowerCase().includes("rublou");
    if (activeCorridor === "imelda") return s.location.toLowerCase().includes("imelda") || s.address.toLowerCase().includes("bypass");
    if (activeCorridor === "town") return s.location.toLowerCase().includes("town") || s.address.toLowerCase().includes("san roque") || s.address.toLowerCase().includes("bonifacio");
    if (activeCorridor === "vista") return s.location.toLowerCase().includes("vista") || s.address.toLowerCase().includes("vista verde");

    return true;
  });

  if (sortByNearest) {
    filteredStudios.sort((a, b) => (a.distanceKm || 0) - (b.distanceKm || 0));
  }

  // 1. Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    configureLeafletDefaultMarkerIcons();

    if (!mapRef.current) {
      // Cainta town center coordinates
      const initialCenter: [number, number] = [14.5830, 121.1150];
      const map = L.map(mapContainerRef.current, {
        center: initialCenter,
        zoom: 13.5,
        zoomControl: false,
        attributionControl: true,
        minZoom: 10,
        maxZoom: 20
      });

      // Load real map tiles with a keyless Esri provider and fallback.
      addRealMapTiles(map);

      // Custom Zoom Control at bottom right
      L.control.zoom({ position: "bottomright" }).addTo(map);

      // Add Cainta Municipal Polygon Boundary Highlight
      const caintaPolyCoords: [number, number][] = [
        [14.6100, 121.1080],
        [14.6050, 121.1250],
        [14.5850, 121.1350],
        [14.5680, 121.1280],
        [14.5620, 121.1180],
        [14.5750, 121.0950],
        [14.5980, 121.0980]
      ];

      L.polygon(caintaPolyCoords, {
        color: "#2c2a29",
        weight: 2,
        dashArray: "6, 8",
        fillColor: "#eab308",
        fillOpacity: 0.05
      }).addTo(map).bindTooltip("Cainta, Rizal Municipal Boundary Zone", { permanent: false, direction: "center" });

      mapRef.current = map;
    }

    // Invalidate map size when the container resizes (handles mobile orientation change + viewport resize)
    const resizeObserver = new ResizeObserver(() => {
      if (mapRef.current) {
        mapRef.current.invalidateSize();
      }
    });
    if (mapContainerRef.current) {
      resizeObserver.observe(mapContainerRef.current);
    }

    return () => {
      resizeObserver.disconnect();
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  // 2. Render & Sync Leaflet Markers
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Clear existing markers
    Object.values(markersRef.current).forEach((m: L.Marker) => m.remove());
    markersRef.current = {};

    filteredStudios.forEach((st) => {
      const coords = getStudioCoords(st);
      const isSelected = activeStudioId === st.id;

      // Custom Leaflet DivIcon with photographic badge
      const customIcon = L.divIcon({
        className: "custom-leaflet-pin",
        html: `
          <div class="relative group cursor-pointer transform transition-transform duration-300 ${isSelected ? "scale-125 z-50" : "hover:scale-110 z-10"}">
            <div class="w-10 h-10 rounded-2xl ${isSelected ? "bg-[#2c2a29] ring-4 ring-yellow-500 shadow-xl" : "bg-white border-2 border-[#2c2a29] shadow-md"} flex items-center justify-center p-0.5 text-xs font-bold transition-all">
              <img src="${st.logo}" alt="${st.name}" class="w-full h-full object-cover rounded-xl" />
            </div>
            <div class="absolute -bottom-1.5 left-1/2 transform -translate-x-1/2 w-2 h-2 ${isSelected ? "bg-yellow-500" : "bg-[#2c2a29]"} rotate-45"></div>
            <div class="absolute top-0 right-0 transform translate-x-1 -translate-y-1 bg-yellow-500 text-black font-extrabold text-[8px] px-1 rounded-full shadow">
              ★${st.rating}
            </div>
          </div>
        `,
        iconSize: [40, 40],
        iconAnchor: [20, 40],
        popupAnchor: [0, -36]
      });

      // Custom Popup HTML
      const popupHtml = `
        <div class="p-1 max-w-[230px] text-left font-sans text-[#2c2a29]">
          <div class="h-24 w-full rounded-xl overflow-hidden relative mb-2 bg-gray-100">
            <img src="${st.coverImage}" class="w-full h-full object-cover" />
            <span class="absolute top-2 left-2 bg-[#2c2a29] text-white text-[9px] uppercase px-2 py-0.5 rounded font-bold">
              Cainta, Rizal
            </span>
            <span class="absolute bottom-2 right-2 bg-white/90 backdrop-blur-xs text-[#2c2a29] text-[10px] font-extrabold px-2 py-0.5 rounded shadow">
              ${st.startingPrice} PHP
            </span>
          </div>
          <h4 class="font-bold text-xs text-[#2c2a29] leading-tight mb-1">${st.name}</h4>
          <p class="text-[10px] text-[#7c756d] mb-2 line-clamp-2">${st.address}</p>
          <div class="flex items-center justify-between text-[10px] border-t border-gray-100 pt-2 mt-1">
            <span class="font-bold text-yellow-600 flex items-center gap-1">★ ${st.rating} (${st.reviewCount})</span>
            <button id="pop-book-${st.id}" class="px-2.5 py-1 bg-[#2c2a29] text-white font-bold rounded-lg hover:bg-gray-800 transition-colors cursor-pointer text-[10px]">
              Book Studio
            </button>
          </div>
        </div>
      `;

      const marker = L.marker(coords, { icon: customIcon }).addTo(map);
      marker.bindPopup(popupHtml, { closeButton: false, className: "custom-leaflet-popup" });

      marker.on("click", () => {
        setActiveStudioId(st.id);
        map.flyTo(coords, 15.5, { duration: 1.2 });
      });

      // Attach click handler inside popup DOM when opened
      marker.on("popupopen", () => {
        const btn = document.getElementById(`pop-book-${st.id}`);
        if (btn) {
          btn.onclick = () => {
            onNavigate("profile", { id: st.id });
          };
        }
      });

      markersRef.current[st.id] = marker;
    });
  }, [filteredStudios, activeStudioId]);

  // Center on studio when selected from card or prop
  const handleSelectStudio = (st: any) => {
    setActiveStudioId(st.id);
    const coords = getStudioCoords(st);
    if (mapRef.current) {
      mapRef.current.flyTo(coords, 16, { duration: 1.2 });
      const marker = markersRef.current[st.id];
      if (marker) {
        marker.openPopup();
      }
    }
  };

  // Switch Corridor
  const handleCorridorClick = (corridor: typeof CAINTA_CORRIDORS[0]) => {
    setActiveCorridor(corridor.id);
    if (mapRef.current) {
      mapRef.current.flyTo(corridor.center, corridor.zoom, { duration: 1 });
    }
  };

  // User Location in Cainta Simulation / Real Geolocation
  const handleLocateMe = () => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const coords: [number, number] = [pos.coords.latitude, pos.coords.longitude];
          setUserLocation(coords);
          if (mapRef.current) {
            mapRef.current.flyTo(coords, 16, { duration: 1.2 });
            
            // Add custom pulse user location marker
            const userIcon = L.divIcon({
              className: "user-loc-pin",
              html: `<div class="w-5 h-5 bg-blue-600 rounded-full border-2 border-white ring-4 ring-blue-400/40 animate-ping"></div>`,
              iconSize: [20, 20]
            });
            L.marker(coords, { icon: userIcon }).addTo(mapRef.current)
              .bindTooltip("You are near Cainta, Rizal!", { permanent: true, direction: "top" });
          }
        },
        () => {
          // Fallback to Cainta Town Hall
          const townCoords: [number, number] = [14.5772, 121.1224];
          setUserLocation(townCoords);
          if (mapRef.current) {
            mapRef.current.flyTo(townCoords, 15.5, { duration: 1 });
          }
        }
      );
    }
  };

  return (
    <div className={`bg-white border border-[#e5e1da] rounded-2xl overflow-hidden shadow-sm flex flex-col ${className}`}>
      {/* MAP HEADER CONTROLS */}
      <div className="p-4 border-b border-[#e5e1da] bg-[#faf9f6] space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-[#2c2a29] text-yellow-500 flex items-center justify-center font-bold flex-shrink-0">
              <Compass size={18} />
            </div>
            <div className="min-w-0">
              <h3 className="font-display font-bold text-sm text-[#2c2a29] flex items-center gap-1.5 flex-wrap">
                <span className="whitespace-nowrap">Cainta Studio Map</span>
                <span className="text-[9px] bg-yellow-500/10 text-yellow-700 font-extrabold px-2 py-0.5 rounded-full uppercase border border-yellow-500/20 whitespace-nowrap">
                  Rizal Zone
                </span>
              </h3>
              <p className="text-[10px] text-[#7c756d] hidden sm:block">Interactive Leaflet map showing photography studios along Cainta roads</p>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleLocateMe}
              className="px-3 py-1.5 bg-white border border-[#e5e1da] rounded-lg text-xs font-bold text-[#2c2a29] hover:bg-gray-50 flex items-center gap-1.5 cursor-pointer shadow-xs"
              title="Locate me in Cainta"
            >
              <Navigation size={13} className="text-blue-600" />
              <span>Locate Me</span>
            </button>

          </div>
        </div>

        {/* Search input & Corridor Filter Buttons */}
        <div className="flex flex-col md:flex-row gap-2.5 items-stretch">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-2.5 text-[#7c756d]" />
            <input
              type="text"
              value={mapSearch}
              onChange={(e) => setMapSearch(e.target.value)}
              placeholder="Search studio name, highway, or barangay in Cainta..."
              className="w-full bg-white border border-[#e5e1da] rounded-xl pl-8.5 pr-3 py-1.5 text-xs focus:outline-none focus:border-[#2c2a29]"
            />
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 no-scrollbar text-nowrap">
            {CAINTA_CORRIDORS.map((c) => (
              <button
                key={c.id}
                onClick={() => handleCorridorClick(c)}
                className={`px-3 py-1.5 rounded-xl text-[11px] font-extrabold transition-all cursor-pointer ${
                  activeCorridor === c.id
                    ? "bg-[#2c2a29] text-white shadow-sm"
                    : "bg-white border border-[#e5e1da] text-[#7c756d] hover:text-[#2c2a29] hover:bg-gray-50"
                }`}
              >
                {c.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* MAP + SIDEBAR GRID */}
      <div className="flex flex-col lg:grid lg:grid-cols-12 relative">
        {/* LEAFLET CANVAS CONTAINER */}
        <div className="lg:col-span-8 relative z-0">
          {/* Mobile: 260px, sm: 320px, lg+: use the height prop */}
          <div
            ref={mapContainerRef}
            className="w-full z-0 bg-gray-100 min-h-[260px] sm:min-h-[320px]"
            style={{ height }}
          />
          
          {/* Active Overlay Badge */}
          <div className="absolute top-3 left-3 bg-white/90 backdrop-blur-md border border-[#e5e1da] px-3 py-1.5 rounded-xl shadow-md text-left z-[400] flex items-center gap-2">
            <MapPin size={14} className="text-yellow-600" />
            <div>
              <span className="text-[9px] uppercase tracking-wider block font-bold text-[#7c756d]">Target District</span>
              <span className="text-xs font-extrabold text-[#2c2a29]">Cainta, Rizal ({filteredStudios.length} Studios)</span>
            </div>
          </div>
        </div>

        {/* SIDEBAR STUDIOS LOCATOR LIST
            On mobile (< lg): capped at 288px with scroll.
            On lg+: capped to the same height as the map canvas (set imperatively via sidebarRef). */}
        <div
          ref={sidebarRef}
          className="lg:col-span-4 border-t lg:border-t-0 lg:border-l border-[#e5e1da] bg-[#faf9f6] p-4 space-y-3 overflow-y-auto"
        >
          <div className="flex items-center justify-between pb-2 border-b border-[#e5e1da]">
            <span className="text-xs font-extrabold text-[#2c2a29] uppercase tracking-wider">Cainta Studios</span>
            <span className="text-[10px] bg-[#2c2a29] text-white font-bold px-2 py-0.5 rounded-full">
              {filteredStudios.length} Found
            </span>
          </div>

          {filteredStudios.length === 0 ? (
            <div className="p-8 text-center space-y-2">
              <Camera size={28} className="mx-auto text-gray-400" />
              <p className="text-xs font-bold text-[#2c2a29]">No studios match this corridor</p>
              <p className="text-[10px] text-[#7c756d]">Try searching for 'Valley Golf', 'Rublou', or 'Bypass'.</p>
            </div>
          ) : (
            filteredStudios.map((st) => {
              const isSelected = activeStudioId === st.id;
              return (
                <div
                  key={st.id}
                  onClick={() => handleSelectStudio(st)}
                  className={`p-3 rounded-xl border transition-all cursor-pointer text-left space-y-2 ${
                    isSelected
                      ? "bg-white border-[#2c2a29] ring-2 ring-yellow-500 shadow-md transform scale-[1.01]"
                      : "bg-white border-[#e5e1da] hover:border-[#7c756d]"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <img src={st.logo || null} alt={st.name} className="w-10 h-10 rounded-xl object-cover border border-gray-100 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <h4 className="font-bold text-xs text-[#2c2a29] truncate">{st.name}</h4>
                        <span className="text-[10px] text-yellow-600 font-extrabold flex items-center gap-0.5">
                          ★ {st.rating}
                        </span>
                      </div>
                      <p className="text-[10px] text-[#7c756d] truncate flex items-center gap-1 mt-0.5">
                        <MapPin size={10} className="flex-shrink-0" />
                        {st.location}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-[10px] border-t border-gray-100 pt-2 font-semibold">
                    <span className="text-[#2c2a29]">Starts: <strong>{st.startingPrice} PHP</strong></span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onNavigate("profile", { id: st.id });
                      }}
                      className="text-[#2c2a29] hover:underline flex items-center gap-0.5 font-bold"
                    >
                      Book <ChevronRight size={12} />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
