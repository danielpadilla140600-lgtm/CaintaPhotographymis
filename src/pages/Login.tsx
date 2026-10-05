import React, { useState } from "react";
import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { configureLeafletDefaultMarkerIcons } from "../utils/leafletConfig";
import { LogIn, Key, Mail, ShieldAlert, Sparkles, User, Camera, Shield, Briefcase, Upload, FileCheck, FileText, CheckCircle, Eye, EyeOff, MapPin, Search } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { UserRole } from "../db/types.ts";
import { apiRequest, ApiError } from "../utils/apiClient.ts";

interface LoginProps {
  onLoginSuccess: (user: any) => void;
  onNavigate: (page: string) => void;
  cms?: { [key: string]: string };
}

export default function Login({ onLoginSuccess, onNavigate, cms }: LoginProps) {
  const [isRegister, setIsRegister] = useState(false);

  const resolveLocalCaintaCoordinates = (query: string): [number, number] => {
    const normalized = query.toLowerCase();
    if (normalized.includes("ortigas") || normalized.includes("valley golf")) return [14.5882, 121.1278];
    if (normalized.includes("felix") || normalized.includes("rublou") || normalized.includes("marketplace")) return [14.5954, 121.1085];
    if (normalized.includes("imelda") || normalized.includes("bypass")) return [14.5825, 121.1002];
    if (normalized.includes("town") || normalized.includes("san roque") || normalized.includes("bonifacio")) return [14.5772, 121.1224];
    if (normalized.includes("vista") || normalized.includes("vista verde")) return [14.6010, 121.1120];
    return [14.5882, 121.1278];
  };
  
  // Login form
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showForgotNewPassword, setShowForgotNewPassword] = useState(false);
  const [showForgotConfirmPassword, setShowForgotConfirmPassword] = useState(false);

  // Register form
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [regFullName, setRegFullName] = useState("");
  const [regContact, setRegContact] = useState("");
  const [regAddress, setRegAddress] = useState("");
  const [regStudioAddress, setRegStudioAddress] = useState("");
  const [regAddressSearch, setRegAddressSearch] = useState("");
  const [regAddressSearchLoading, setRegAddressSearchLoading] = useState(false);
  const [regAddressSearchError, setRegAddressSearchError] = useState("");
  const [regBarangay, setRegBarangay] = useState("");
  const [regLatitude, setRegLatitude] = useState(14.5882);
  const [regLongitude, setRegLongitude] = useState(121.1278);
  const [regRole, setRegRole] = useState<UserRole>(UserRole.CUSTOMER);
  const [regStudioName, setRegStudioName] = useState("");
  const [regBusinessPermit, setRegBusinessPermit] = useState("");
  const [regValidId, setRegValidId] = useState("");
  const [regOtherDocs, setRegOtherDocs] = useState("");

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const regMapContainerRef = useRef<HTMLDivElement | null>(null);
  const regMapRef = useRef<L.Map | null>(null);
  const regMarkerRef = useRef<L.Marker | null>(null);

  const handleStudioAddressSearch = async () => {
    const query = regAddressSearch.trim();
    if (!query) return;

    setRegAddressSearchLoading(true);
    setRegAddressSearchError("");
    try {
      const [latitude, longitude] = resolveLocalCaintaCoordinates(query);
      const nextLatitude = Number(latitude.toFixed(6));
      const nextLongitude = Number(longitude.toFixed(6));
      setRegLatitude(nextLatitude);
      setRegLongitude(nextLongitude);
      setRegStudioAddress(query);
      regMarkerRef.current?.setLatLng([nextLatitude, nextLongitude]);
      regMapRef.current?.setView([nextLatitude, nextLongitude], 17);
    } catch {
      setRegAddressSearchError("Unable to search right now. You can still click the map or drag the pin.");
    } finally {
      setRegAddressSearchLoading(false);
    }
  };

  useEffect(() => {
    if (!isRegister || regRole !== UserRole.STUDIO_ADMIN || !regMapContainerRef.current) return;

    configureLeafletDefaultMarkerIcons();

    regMapRef.current?.remove();
    const map = L.map(regMapContainerRef.current, { center: [regLatitude, regLongitude], zoom: 14, attributionControl: true, minZoom: 10, maxZoom: 20 });

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
    esriLayer.on("tileerror", () => {
      if (map.hasLayer(esriLayer)) map.removeLayer(esriLayer);
      if (!map.hasLayer(openStreetMapLayer)) openStreetMapLayer.addTo(map);
    });


    const marker = L.marker([regLatitude, regLongitude], { draggable: true }).addTo(map);
    marker.bindTooltip("Drag or click to pin your studio", { permanent: true, direction: "top" });

    const updateLocation = (lat: number, lng: number) => {
      const nextLatitude = Number(lat.toFixed(6));
      const nextLongitude = Number(lng.toFixed(6));
      setRegLatitude(nextLatitude);
      setRegLongitude(nextLongitude);
    };

    marker.on("dragend", () => {
      const position = marker.getLatLng();
      updateLocation(position.lat, position.lng);
    });
    map.on("click", event => {
      marker.setLatLng(event.latlng);
      updateLocation(event.latlng.lat, event.latlng.lng);
    });
    regMapRef.current = map;
    regMarkerRef.current = marker;
    const resizeTimer = window.setTimeout(() => map.invalidateSize(), 200);

    return () => {
      window.clearTimeout(resizeTimer);
      map.remove();
      regMapRef.current = null;
      regMarkerRef.current = null;
    };
  }, [isRegister, regRole]);

  const handleRegFileChange = (e: React.ChangeEvent<HTMLInputElement>, type: "permit" | "validId" | "other") => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result as string;
      if (type === "permit") setRegBusinessPermit(base64);
      else if (type === "validId") setRegValidId(base64);
      else setRegOtherDocs(base64);
    };
    reader.readAsDataURL(file);
  };

  // Forgot password modal
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotOtp, setForgotOtp] = useState("");
  const [forgotNewPassword, setForgotNewPassword] = useState("");
  const [forgotConfirmPassword, setForgotConfirmPassword] = useState("");
  const [forgotStep, setForgotStep] = useState<"email" | "otp" | "password">("email");
  const [forgotResetToken, setForgotResetToken] = useState("");
  const [forgotCountdown, setForgotCountdown] = useState(60);
  const [forgotMsg, setForgotMsg] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const [forgotLoading, setForgotLoading] = useState(false);

  const resetForgotFlow = () => {
    setForgotStep("email");
    setForgotEmail("");
    setForgotOtp("");
    setForgotNewPassword("");
    setForgotConfirmPassword("");
    setForgotResetToken("");
    setForgotMsg(null);
  };

  const openForgotModal = () => {
    resetForgotFlow();
    setShowForgotModal(true);
  };

  const getPasswordStrength = (password: string) => {
    let score = 0;
    if (password.length >= 8) score += 1;
    if (/[a-z]/.test(password)) score += 1;
    if (/[A-Z]/.test(password)) score += 1;
    if (/\d/.test(password)) score += 1;
    if (/[^A-Za-z0-9]/.test(password)) score += 1;

    if (password.length === 0) return { score: 0, label: "", color: "bg-gray-200", width: "0%" };
    if (score <= 2) return { score, label: "Weak", color: "bg-red-500", width: "35%" };
    if (score === 3) return { score, label: "Fair", color: "bg-amber-500", width: "60%" };
    if (score === 4) return { score, label: "Good", color: "bg-blue-500", width: "80%" };
    return { score, label: "Strong", color: "bg-emerald-500", width: "100%" };
  };

  const forgotPasswordStrength = getPasswordStrength(forgotNewPassword);

  useEffect(() => {
    if (!showForgotModal || forgotStep !== "otp" || forgotCountdown <= 0) return;

    const timer = window.setTimeout(() => {
      setForgotCountdown(prev => Math.max(prev - 1, 0));
    }, 1000);

    return () => window.clearTimeout(timer);
  }, [showForgotModal, forgotStep, forgotCountdown]);

  const requestForgotOtp = async () => {
    setForgotMsg(null);

    if (!forgotEmail || !/^\S+@\S+\.\S+$/.test(forgotEmail)) {
      setForgotMsg({ text: "Enter a valid email address before requesting an OTP.", type: "error" });
      return;
    }

    setForgotLoading(true);
    try {
      await apiRequest("/api/auth/forgot-password", {
        method: "POST",
        body: { email: forgotEmail.trim().toLowerCase() }
      });
      setForgotStep("otp");
      setForgotOtp("");
      setForgotNewPassword("");
      setForgotConfirmPassword("");
      setForgotResetToken("");
      setForgotCountdown(60);
      setForgotMsg({ text: "Verification code sent. Check your email inbox and spam folder.", type: "success" });
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Failed to connect to the authentication server.";
      setForgotMsg({ text: msg, type: "error" });
    } finally {
      setForgotLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    await requestForgotOtp();
  };

  const resendForgotOtp = async () => {
    if (forgotCountdown > 0) return;
    await requestForgotOtp();
  };

  const verifyForgotOtp = async () => {
    const otp = forgotOtp.trim();
    if (!otp || otp.length < 6) {
      setForgotMsg({ text: "Enter the 6-digit OTP sent to your email.", type: "error" });
      return;
    }

    setForgotLoading(true);
    setForgotMsg(null);
    try {
      const data = await apiRequest("/api/auth/verify-reset-otp", {
        method: "POST",
        body: { email: forgotEmail.trim().toLowerCase(), otp }
      });
      if (data.resetToken) {
        setForgotResetToken(data.resetToken);
        setForgotStep("password");
        setForgotOtp("");
        setForgotMsg({ text: "OTP verified. Create your new password.", type: "success" });
      }
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Unable to verify the OTP right now.";
      setForgotMsg({ text: msg, type: "error" });
    } finally {
      setForgotLoading(false);
    }
  };

  const resetPassword = async () => {
    if (!forgotResetToken) {
      setForgotMsg({ text: "Please verify the OTP before setting a new password.", type: "error" });
      return;
    }

    if (!forgotNewPassword || forgotNewPassword.length < 6) {
      setForgotMsg({ text: "Password must be at least 6 characters long.", type: "error" });
      return;
    }

    if (forgotNewPassword !== forgotConfirmPassword) {
      setForgotMsg({ text: "The new password and confirmation do not match.", type: "error" });
      return;
    }

    setForgotLoading(true);
    setForgotMsg(null);
    try {
      await apiRequest("/api/auth/reset-password", {
        method: "POST",
        body: { token: forgotResetToken, newPassword: forgotNewPassword }
      });
      setForgotMsg({ text: "Password reset complete. You can now sign in with your new password.", type: "success" });
      setForgotStep("email");
      setTimeout(() => setShowForgotModal(false), 1200);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Unable to reset the password right now.";
      setForgotMsg({ text: msg, type: "error" });
    } finally {
      setForgotLoading(false);
    }
  };

  const handleGoogleLogin = () => {
    const googleClientId = ((window as any).GOOGLE_CLIENT_ID || "").trim();
    const googleApi = (window as any).google;
    if (!googleClientId || !googleApi?.accounts?.id) {
      setErrorMsg("Google login has not been configured. Add GOOGLE_CLIENT_ID to the page config and reload the page.");
      return;
    }

    const gc = googleApi.accounts.id;
    gc.initialize({
      client_id: googleClientId,
      callback: async (response: { credential?: string }) => {
        if (!response?.credential) {
          setErrorMsg("Google returned no identity token.");
          return;
        }

        setLoading(true);
        setErrorMsg("");

        try {
          const data = await apiRequest("/api/auth/google", {
            method: "POST",
            body: { credential: response.credential }
          });
          onLoginSuccess(data.user);
        } catch (err) {
          const msg = err instanceof ApiError ? err.message : "Failed to connect to the authentication server.";
          setErrorMsg(msg);
        } finally {
          setLoading(false);
        }
      }
    });

    gc.prompt();
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg("");

    try {
      const data = await apiRequest("/api/auth/login", {
        method: "POST",
        body: { email, password }
      });
      onLoginSuccess(data.user);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Failed to connect to the authentication server.";
      setErrorMsg(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg("");

    if (regRole === UserRole.STUDIO_ADMIN) {
      if (!regBusinessPermit || !regValidId) {
        setErrorMsg("Studio Owner registration requires uploading both a DTI/Business Permit and a Valid Government ID.");
        setLoading(false);
        return;
      }
    }

    try {
      const data = await apiRequest("/api/auth/register", {
        method: "POST",
        body: {
          email: regEmail,
          password: regPassword,
          fullName: regFullName,
          contactNumber: regContact,
          address: regAddress,
          role: regRole,
          studioName: regRole === UserRole.STUDIO_ADMIN ? regStudioName : undefined,
          studioAddress: regRole === UserRole.STUDIO_ADMIN ? regStudioAddress : undefined,
          latitude: regRole === UserRole.STUDIO_ADMIN ? regLatitude : undefined,
          longitude: regRole === UserRole.STUDIO_ADMIN ? regLongitude : undefined,
          businessPermit: regRole === UserRole.STUDIO_ADMIN ? regBusinessPermit : undefined,
          validId: regRole === UserRole.STUDIO_ADMIN ? regValidId : undefined,
          otherDocs: regRole === UserRole.STUDIO_ADMIN ? regOtherDocs : undefined
        }
      });
      if (data.user) onLoginSuccess(data.user);
      else setErrorMsg(data.message || "Registration submitted for Admin approval.");
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Failed to connect to the authentication server.";
      setErrorMsg(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto my-12 px-4">
      <div className="bg-white rounded-3xl overflow-hidden border border-[#e5e1da] shadow-2xl grid md:grid-cols-12 min-h-[500px]">
        {/* Left Side: Creative Brand Intro */}
        <div className="md:col-span-5 bg-[#2c2a29] text-white p-8 flex flex-col justify-between relative overflow-hidden">
          <div
            className="absolute inset-0 opacity-20 bg-cover bg-center"
            style={{
              backgroundImage: `url("${cms?.heroBackground || "https://images.unsplash.com/photo-1492691527719-9d1e07e534b4?w=800&fit=crop"}")`
            }}
          />
          
          <div className="relative z-10 space-y-4">
            <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/20">
              <Camera size={14} className="text-yellow-500" />
              <span className="text-[10px] tracking-wider uppercase font-bold">Rizal Studio Network</span>
            </div>
            <h2 className="font-display text-3xl font-bold leading-tight">Capture & Book Timeless Moments</h2>
            <p className="text-xs text-gray-300 leading-relaxed">
              Cainta's centralized Management Information System connects photographers, creators, and customers with persistent schedules, quick downpayments, print configurations, and instant AI guidance.
            </p>
          </div>

          <div className="relative z-10 pt-8 border-t border-white/10 text-xs text-gray-400">
            <span className="block font-semibold text-white">Centralized Studio Platform:</span>
            <p className="mt-1 text-gray-400 leading-relaxed">
              Sign in with your registered customer, studio admin, or super admin credentials to access your dashboard.
            </p>
          </div>
        </div>

        {/* Right Side: Interactive Card (Login or Register) */}
        <div className="md:col-span-7 p-8 sm:p-12 flex flex-col justify-center">
          <AnimatePresence mode="wait">
            {!isRegister ? (
              // LOGIN FORM
              <motion.div
                key="login"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div className="text-left space-y-1">
                  <h3 className="font-display text-2xl font-bold text-[#2c2a29]">Welcome Back</h3>
                  <p className="text-xs text-[#7c756d]">Manage photography bookings, print sales, and studio reviews.</p>
                </div>

                {errorMsg && (
                  <div className="bg-red-50 text-red-800 p-3 rounded-xl text-xs font-semibold flex items-center gap-2 border border-red-200">
                    <ShieldAlert size={16} />
                    <span>{errorMsg}</span>
                  </div>
                )}

                <form onSubmit={handleLogin} className="space-y-4 text-left">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-[#2c2a29]">Email Address</label>
                    <div className="relative">
                      <Mail size={16} className="absolute left-3.5 top-3.5 text-[#7c756d]" />
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        placeholder="e.g. your-email@example.com"
                        className="w-full bg-[#faf9f6] border border-[#e5e1da] rounded-xl pl-10 pr-4 py-3 text-sm focus:outline-none focus:border-[#2c2a29]"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between items-center">
                      <label className="text-xs font-semibold text-[#2c2a29]">Password</label>
                      <button
                        type="button"
                        onClick={() => {
                          resetForgotFlow();
                          setForgotEmail(email);
                          setShowForgotModal(true);
                        }}
                        className="text-[11px] text-[#7c756d] hover:text-[#2c2a29] font-medium hover:underline cursor-pointer"
                      >
                        Forgot password?
                      </button>
                    </div>
                    <div className="relative">
                      <Key size={16} className="absolute left-3.5 top-3.5 text-[#7c756d]" />
                      <input
                        type={showPassword ? "text" : "password"}
                        required
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full bg-[#faf9f6] border border-[#e5e1da] rounded-xl pl-10 pr-11 py-3 text-sm focus:outline-none focus:border-[#2c2a29]"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(value => !value)}
                        aria-label={showPassword ? "Hide password" : "Show password"}
                        title={showPassword ? "Hide password" : "Show password"}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-[#7c756d] hover:text-[#2c2a29] cursor-pointer"
                      >
                        {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3 bg-[#2c2a29] hover:bg-[#4a4644] text-white rounded-xl text-sm font-bold shadow-md hover:shadow-lg transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-2"
                  >
                    <LogIn size={16} />
                    {loading ? "Signing In..." : "Sign In to Account"}
                  </button>

                  <button
                    type="button"
                    disabled={loading}
                    onClick={handleGoogleLogin}
                    className="w-full py-3 bg-white border border-[#e5e1da] text-[#2c2a29] rounded-xl text-sm font-bold shadow-sm hover:shadow-md transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-2"
                  >
                    <svg aria-label="Google" className="h-4 w-4" viewBox="0 0 24 24">
                      <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.2 1.2-.9 2.2-1.9 2.9l3.1 2.4C18.7 18.8 20.5 16.7 20.5 14c0-.3 0-.7-.1-1H12z" />
                      <path fill="#34A853" d="M12 4.8c2.3 0 4.4.8 6 2.6l3.2-3.2C17.4 1.5 14.9 0 12 0 7.7 0 4 2.7 2.2 6.5l3.8 3C6.8 7.6 9.2 4.8 12 4.8z" />
                      <path fill="#FBBC05" d="M2.2 6.5C1.7 7.8 1.4 9.4 1.4 11.1s.3 3.3 1.8 4.6l3.8-3C6.8 12.3 6.5 11.8 6.5 11.1c0-.7.3-1.2.8-1.6l-3.1-2.4z" />
                      <path fill="#4285F4" d="M12 20.4c-2.8 0-5.1-1.7-6-4.1l-3.8 3C3.8 21.9 7.7 24 12 24c3 0 5.8-1.1 7.9-3.1l-3.5-2.6C15.8 18.9 14.1 20.4 12 20.4z" />
                    </svg>
                    Continue with Google
                  </button>
                </form>

                <div className="text-xs text-gray-500 pt-4 border-t border-gray-100 flex justify-between">
                  <span>Don't have an account?</span>
                  <button onClick={() => setIsRegister(true)} className="text-[#2c2a29] font-bold hover:underline cursor-pointer">
                    Register Studio or Customer
                  </button>
                </div>
              </motion.div>
            ) : (
              // REGISTER FORM
              <motion.div
                key="register"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div className="text-left space-y-1">
                  <h3 className="font-display text-2xl font-bold text-[#2c2a29]">Create Account</h3>
                  <p className="text-xs text-[#7c756d]">Register as a customer or list your photography business in Cainta.</p>
                </div>

                {errorMsg && (
                  <div className="bg-red-50 text-red-800 p-3 rounded-xl text-xs font-semibold flex items-center gap-2 border border-red-200">
                    <ShieldAlert size={16} />
                    <span>{errorMsg}</span>
                  </div>
                )}

                <div className="space-y-3">
                  <button
                    type="button"
                    disabled={loading}
                    onClick={handleGoogleLogin}
                    className="w-full py-3 bg-white border border-[#e5e1da] text-[#2c2a29] rounded-xl text-sm font-bold shadow-sm hover:shadow-md transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-2"
                  >
                    <svg aria-label="Google" className="h-4 w-4" viewBox="0 0 24 24">
                      <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.2 1.2-.9 2.2-1.9 2.9l3.1 2.4C18.7 18.8 20.5 16.7 20.5 14c0-.3 0-.7-.1-1H12z" />
                      <path fill="#34A853" d="M12 4.8c2.3 0 4.4.8 6 2.6l3.2-3.2C17.4 1.5 14.9 0 12 0 7.7 0 4 2.7 2.2 6.5l3.8 3C6.8 7.6 9.2 4.8 12 4.8z" />
                      <path fill="#FBBC05" d="M2.2 6.5C1.7 7.8 1.4 9.4 1.4 11.1s.3 3.3 1.8 4.6l3.8-3C6.8 12.3 6.5 11.8 6.5 11.1c0-.7.3-1.2.8-1.6l-3.1-2.4z" />
                      <path fill="#4285F4" d="M12 20.4c-2.8 0-5.1-1.7-6-4.1l-3.8 3C3.8 21.9 7.7 24 12 24c3 0 5.8-1.1 7.9-3.1l-3.5-2.6C15.8 18.9 14.1 20.4 12 20.4z" />
                    </svg>
                    Sign up with Google
                  </button>

                  <div className="flex items-center gap-3">
                    <span className="h-px flex-1 bg-[#e5e1da]" />
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[#7c756d]">OR</span>
                    <span className="h-px flex-1 bg-[#e5e1da]" />
                  </div>
                </div>

                <form onSubmit={handleRegister} className="space-y-4 text-left max-h-[400px] overflow-y-auto pr-2">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-[#2c2a29]">Register Role Type</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setRegRole(UserRole.CUSTOMER)}
                        className={`p-2.5 rounded-lg border text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                          regRole === UserRole.CUSTOMER 
                            ? "border-[#2c2a29] bg-[#2c2a29] text-[#faf9f6]" 
                            : "border-[#e5e1da] bg-white text-[#2c2a29] hover:border-[#7c756d]"
                        }`}
                      >
                        <User size={13} /> Customer Account
                      </button>
                      <button
                        type="button"
                        onClick={() => setRegRole(UserRole.STUDIO_ADMIN)}
                        className={`p-2.5 rounded-lg border text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                          regRole === UserRole.STUDIO_ADMIN 
                            ? "border-[#2c2a29] bg-[#2c2a29] text-[#faf9f6]" 
                            : "border-[#e5e1da] bg-white text-[#2c2a29] hover:border-[#7c756d]"
                        }`}
                      >
                        <Briefcase size={13} /> Studio Owner / Admin
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-[#2c2a29]">Full Name</label>
                    <input
                      type="text"
                      required
                      value={regFullName}
                      onChange={e => setRegFullName(e.target.value)}
                      className="w-full bg-[#faf9f6] border border-[#e5e1da] rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[#2c2a29]"
                    />
                  </div>

                  {regRole === UserRole.STUDIO_ADMIN && (
                    <>
                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-red-700">Photography Studio Name</label>
                        <input
                          type="text"
                          required
                          value={regStudioName}
                          onChange={e => setRegStudioName(e.target.value)}
                          placeholder="e.g. Rizal Milestone Studios"
                          className="w-full bg-[#faf9f6] border-2 border-red-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[#2c2a29]"
                        />
                      </div>

                      <div className="p-4 bg-emerald-50/70 rounded-2xl border border-emerald-200/80 space-y-3">
                        <div>
                          <h4 className="text-xs font-bold text-emerald-900 flex items-center gap-1.5">
                            <MapPin size={14} className="text-emerald-600" /> Studio Location
                          </h4>
                          <p className="text-[11px] text-emerald-800 leading-snug mt-1">Pin the exact studio location on the map. The address and GPS coordinates will be sent to the admin for verification.</p>
                        </div>
                        <div className="space-y-1">
                          <label className="text-[11px] font-bold text-gray-800">Barangay</label>
                          <select
                            value={regBarangay}
                            onChange={e => setRegBarangay(e.target.value)}
                            className="w-full bg-white border border-emerald-200 rounded-xl px-3 py-2.5 text-xs focus:outline-none focus:border-emerald-600"
                          >
                            <option value="">Select barangay</option>
                            <option value="Cainta Poblacion">Cainta Poblacion</option>
                            <option value="San Andres">San Andres</option>
                            <option value="San Isidro">San Isidro</option>
                            <option value="San Juan">San Juan</option>
                            <option value="San Roque">San Roque</option>
                            <option value="Santa Rosa">Santa Rosa</option>
                            <option value="Santo Domingo">Santo Domingo</option>
                            <option value="Santo Niño">Santo Niño</option>
                          </select>
                        </div>
                        <div className="space-y-1">
                          <label className="text-[11px] font-bold text-gray-800">Search Map Address</label>
                          <div className="flex gap-2">
                            <div className="relative flex-1">
                              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                              <input
                                type="search"
                                value={regAddressSearch}
                                onChange={e => setRegAddressSearch(e.target.value)}
                                placeholder="Search street, building, or landmark"
                                className="w-full bg-white border border-emerald-200 rounded-xl pl-9 pr-3 py-2.5 text-xs focus:outline-none focus:border-emerald-600"
                              />
                            </div>
                            <button
                              type="button"
                              onClick={handleStudioAddressSearch}
                              disabled={regAddressSearchLoading || !regAddressSearch.trim()}
                              className="px-3 py-2 bg-emerald-700 text-white rounded-xl text-xs font-bold disabled:opacity-50 disabled:cursor-not-allowed hover:bg-emerald-800"
                            >
                              {regAddressSearchLoading ? "Searching..." : "Search"}
                            </button>
                          </div>
                          {regAddressSearchError && <p className="text-[10px] text-red-600">{regAddressSearchError}</p>}
                        </div>
                        <div className="relative border border-emerald-200 rounded-xl overflow-hidden bg-white">
                          <div ref={regMapContainerRef} style={{ height: "230px" }} className="w-full z-0" />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[11px] font-bold text-gray-800">Exact Studio Address <span className="text-red-600">*</span></label>
                          <input
                            type="text"
                            required
                            value={regStudioAddress}
                            onChange={e => setRegStudioAddress(e.target.value)}
                            placeholder="Unit, building, street, barangay, Cainta, Rizal"
                            className="w-full bg-white border border-emerald-200 rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:border-emerald-600"
                          />
                          <p className="text-[10px] text-gray-500">Click or drag the pin to update the suggested address, then correct it if needed.</p>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-1">
                            <label className="text-[11px] font-bold text-gray-700">Latitude</label>
                            <input
                              type="number"
                              step="any"
                              required
                              value={regLatitude}
                              onChange={e => {
                                const value = Number(e.target.value);
                                setRegLatitude(value);
                                regMarkerRef.current?.setLatLng([value, regLongitude]);
                              }}
                              className="w-full bg-white border border-emerald-200 rounded-xl px-3 py-2 text-xs font-mono focus:outline-none focus:border-emerald-600"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[11px] font-bold text-gray-700">Longitude</label>
                            <input
                              type="number"
                              step="any"
                              required
                              value={regLongitude}
                              onChange={e => {
                                const value = Number(e.target.value);
                                setRegLongitude(value);
                                regMarkerRef.current?.setLatLng([regLatitude, value]);
                              }}
                              className="w-full bg-white border border-emerald-200 rounded-xl px-3 py-2 text-xs font-mono focus:outline-none focus:border-emerald-600"
                            />
                          </div>
                        </div>
                      </div>
                    </>
                  )}

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-[#2c2a29]">Email Address</label>
                    <input
                      type="email"
                      required
                      value={regEmail}
                      onChange={e => setRegEmail(e.target.value)}
                      className="w-full bg-[#faf9f6] border border-[#e5e1da] rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[#2c2a29]"
                    />
                  </div>

                  <div className="space-y-1 relative">
                    <label className="text-xs font-semibold text-[#2c2a29]">Password</label>
                    <input
                      type={showRegPassword ? "text" : "password"}
                      required
                      value={regPassword}
                      onChange={e => setRegPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full bg-[#faf9f6] border border-[#e5e1da] rounded-xl px-4 pr-11 py-2.5 text-sm focus:outline-none focus:border-[#2c2a29]"
                    />
                    <button
                      type="button"
                      onClick={() => setShowRegPassword(value => !value)}
                      aria-label={showRegPassword ? "Hide registration password" : "Show registration password"}
                      title={showRegPassword ? "Hide password" : "Show password"}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#7c756d] hover:text-[#2c2a29] cursor-pointer"
                    >
                      {showRegPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-[#2c2a29]">Contact Number</label>
                      <input
                        type="text"
                        value={regContact}
                        onChange={e => setRegContact(e.target.value)}
                        placeholder="+63 900 000 0000"
                        className="w-full bg-[#faf9f6] border border-[#e5e1da] rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[#2c2a29]"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-[#2c2a29]">Home Address</label>
                      <input
                        type="text"
                        value={regAddress}
                        onChange={e => setRegAddress(e.target.value)}
                        placeholder="Cainta, Rizal"
                        className="w-full bg-[#faf9f6] border border-[#e5e1da] rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[#2c2a29]"
                      />
                    </div>
                  </div>

                  {regRole === UserRole.STUDIO_ADMIN && (
                    <div className="p-4 bg-amber-50/70 rounded-2xl border border-amber-200/80 space-y-3">
                      <div className="space-y-0.5">
                        <h4 className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
                          <Shield className="text-amber-600" size={14} />
                          Studio Compliance & Verification Documents
                        </h4>
                        <p className="text-[11px] text-amber-800 leading-snug">
                          Uploading business permits and owner valid IDs ensures platform security and faster admin verification.
                        </p>
                      </div>

                      {/* 1. DTI / Business Permit Upload */}
                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-gray-800 flex items-center justify-between">
                          <span>1. DTI / Mayor's Business Permit <span className="text-red-600">* Required</span></span>
                        </label>
                        <div className="border border-dashed border-amber-300 rounded-xl bg-white p-3 text-center hover:border-amber-500 transition-all relative cursor-pointer">
                          <input
                            type="file"
                            accept="image/*,application/pdf"
                            onChange={e => handleRegFileChange(e, "permit")}
                            className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                          />
                          <div className="flex items-center justify-center gap-2">
                            <Upload size={16} className="text-amber-600" />
                            <span className="text-xs font-bold text-gray-700">
                              {regBusinessPermit ? "Change Business Permit" : "Click / Drag to upload Business Permit"}
                            </span>
                          </div>
                        </div>
                        {regBusinessPermit && (
                          <div className="bg-green-50 p-2 rounded-lg border border-green-200 flex items-center justify-between">
                            <span className="text-[10px] font-bold text-green-800 flex items-center gap-1">
                              <FileCheck size={12} /> Business Permit Attached
                            </span>
                            <button type="button" onClick={() => setRegBusinessPermit("")} className="text-red-500 hover:underline text-[10px] font-bold">Remove</button>
                          </div>
                        )}
                      </div>

                      {/* 2. Valid Owner Government ID Upload */}
                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-gray-800 flex items-center justify-between">
                          <span>2. Owner Valid Government ID <span className="text-red-600">* Required</span></span>
                        </label>
                        <p className="text-[10px] text-gray-500">Driver's License, Passport, UMID, PhilHealth, SSS ID</p>
                        <div className="border border-dashed border-amber-300 rounded-xl bg-white p-3 text-center hover:border-amber-500 transition-all relative cursor-pointer">
                          <input
                            type="file"
                            accept="image/*,application/pdf"
                            onChange={e => handleRegFileChange(e, "validId")}
                            className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                          />
                          <div className="flex items-center justify-center gap-2">
                            <Upload size={16} className="text-amber-600" />
                            <span className="text-xs font-bold text-gray-700">
                              {regValidId ? "Change Owner Valid ID" : "Click / Drag to upload Valid Government ID"}
                            </span>
                          </div>
                        </div>
                        {regValidId && (
                          <div className="bg-green-50 p-2 rounded-lg border border-green-200 flex items-center justify-between">
                            <span className="text-[10px] font-bold text-green-800 flex items-center gap-1">
                              <FileCheck size={12} /> Valid Government ID Attached
                            </span>
                            <button type="button" onClick={() => setRegValidId("")} className="text-red-500 hover:underline text-[10px] font-bold">Remove</button>
                          </div>
                        )}
                      </div>

                      {/* 3. Additional Business Documents (Optional) */}
                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-gray-800">
                          3. Other Validation Documents <span className="text-gray-500 font-normal">(Optional - BIR, Barangay Clearance, Lease)</span>
                        </label>
                        <div className="border border-dashed border-amber-300 rounded-xl bg-white p-3 text-center hover:border-amber-500 transition-all relative cursor-pointer">
                          <input
                            type="file"
                            accept="image/*,application/pdf"
                            onChange={e => handleRegFileChange(e, "other")}
                            className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                          />
                          <div className="flex items-center justify-center gap-2">
                            <Upload size={16} className="text-amber-600" />
                            <span className="text-xs font-bold text-gray-700">
                              {regOtherDocs ? "Change Additional Docs" : "Upload BIR, Lease Contract, or Barangay Permit"}
                            </span>
                          </div>
                        </div>
                        {regOtherDocs && (
                          <div className="bg-green-50 p-2 rounded-lg border border-green-200 flex items-center justify-between">
                            <span className="text-[10px] font-bold text-green-800 flex items-center gap-1">
                              <FileCheck size={12} /> Additional Docs Attached
                            </span>
                            <button type="button" onClick={() => setRegOtherDocs("")} className="text-red-500 hover:underline text-[10px] font-bold">Remove</button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3 bg-yellow-500 hover:bg-yellow-400 text-black rounded-xl text-sm font-bold shadow-md hover:shadow-lg transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-2 mt-2"
                  >
                    <Sparkles size={16} />
                    {loading ? "Creating..." : "Create Account & Sign In"}
                  </button>
                </form>

                <div className="text-xs text-gray-500 pt-4 border-t border-gray-100 flex justify-between">
                  <span>Already have an account?</span>
                  <button onClick={() => setIsRegister(false)} className="text-[#2c2a29] font-bold hover:underline cursor-pointer">
                    Sign In instead
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* FORGOT PASSWORD MODAL */}
      <AnimatePresence>
        {showForgotModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-[#e5e1da] text-left space-y-4"
            >
              <div className="flex justify-between items-center">
                <h4 className="font-display font-bold text-lg text-[#2c2a29]">Reset Password</h4>
                <button
                  onClick={() => setShowForgotModal(false)}
                  className="text-gray-400 hover:text-gray-600 text-sm font-bold cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <p className="text-xs text-[#7c756d] leading-relaxed">
                {forgotStep === "email" && "Enter your account email address. We’ll send a 6-digit OTP to verify your identity."}
                {forgotStep === "otp" && "Enter the 6-digit verification code sent to your email."}
                {forgotStep === "password" && "Create a new password for your account."}
              </p>

              {forgotMsg && (
                <div className={`p-3 rounded-xl text-xs font-semibold ${
                  forgotMsg.type === "success" ? "bg-emerald-50 text-emerald-800 border border-emerald-200" : "bg-red-50 text-red-800 border border-red-200"
                }`}>
                  {forgotMsg.text}
                </div>
              )}

              {forgotStep === "email" && (
                <form onSubmit={handleForgotPassword} className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-[#2c2a29]">Account Email</label>
                    <input
                      type="email"
                      required
                      value={forgotEmail}
                      onChange={e => setForgotEmail(e.target.value)}
                      placeholder="e.g. your-email@example.com"
                      className="w-full bg-[#faf9f6] border border-[#e5e1da] rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[#2c2a29]"
                    />
                  </div>

                  <div className="flex gap-2 justify-end pt-2">
                    <button
                      type="button"
                      onClick={() => setShowForgotModal(false)}
                      className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={forgotLoading}
                      className="px-5 py-2 bg-[#2c2a29] hover:bg-[#4a4644] text-white rounded-xl text-xs font-bold cursor-pointer shadow-md"
                    >
                      {forgotLoading ? "Sending..." : "Send OTP"}
                    </button>
                  </div>
                </form>
              )}

              {forgotStep === "otp" && (
                <div className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-[#2c2a29]">Enter 6-digit OTP</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      value={forgotOtp}
                      onChange={e => setForgotOtp(e.target.value.replace(/\D/g, ""))}
                      placeholder="123456"
                      className="w-full bg-[#faf9f6] border border-[#e5e1da] rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[#2c2a29]"
                    />
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-bold text-[#7c756d]">
                      {forgotCountdown > 0 ? `OTP expires in ${forgotCountdown}s` : "OTP expired"}
                    </span>
                    <button
                      type="button"
                      disabled={forgotLoading || forgotCountdown > 0}
                      onClick={resendForgotOtp}
                      className="px-4 py-2 bg-[#f6efe6] hover:bg-[#eeddc6] text-[#2c2a29] rounded-xl text-[11px] font-bold disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                    >
                      {forgotLoading ? "Sending..." : forgotCountdown > 0 ? `Resend in ${forgotCountdown}s` : "Resend OTP"}
                    </button>
                  </div>

                  <div className="flex gap-2 justify-end pt-2">
                    <button
                      type="button"
                      onClick={() => setForgotStep("email")}
                      className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold cursor-pointer"
                    >
                      Back
                    </button>
                    <button
                      type="button"
                      disabled={forgotLoading}
                      onClick={verifyForgotOtp}
                      className="px-5 py-2 bg-[#2c2a29] hover:bg-[#4a4644] text-white rounded-xl text-xs font-bold cursor-pointer shadow-md"
                    >
                      {forgotLoading ? "Verifying..." : "Verify OTP"}
                    </button>
                  </div>
                </div>
              )}

              {forgotStep === "password" && (
                <div className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-[#2c2a29]">New Password</label>
                    <div className="relative">
                      <input
                        type={showForgotNewPassword ? "text" : "password"}
                        value={forgotNewPassword}
                        onChange={e => setForgotNewPassword(e.target.value)}
                        placeholder="At least 6 characters"
                        className="w-full bg-[#faf9f6] border border-[#e5e1da] rounded-xl px-4 pr-11 py-2.5 text-sm focus:outline-none focus:border-[#2c2a29]"
                      />
                      <button
                        type="button"
                        onClick={() => setShowForgotNewPassword(value => !value)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-[#7c756d] hover:text-[#2c2a29] cursor-pointer"
                      >
                        {showForgotNewPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-[#7c756d]">Password strength</span>
                      <span className="text-[11px] font-bold text-[#2c2a29]">{forgotPasswordStrength.label}</span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-[#e5e1da] overflow-hidden">
                      <div className={`${forgotPasswordStrength.color} h-full rounded-full transition-all duration-300`} style={{ width: forgotPasswordStrength.width }} />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-[#2c2a29]">Confirm Password</label>
                    <div className="relative">
                      <input
                        type={showForgotConfirmPassword ? "text" : "password"}
                        value={forgotConfirmPassword}
                        onChange={e => setForgotConfirmPassword(e.target.value)}
                        placeholder="Confirm your password"
                        className="w-full bg-[#faf9f6] border border-[#e5e1da] rounded-xl px-4 pr-11 py-2.5 text-sm focus:outline-none focus:border-[#2c2a29]"
                      />
                      <button
                        type="button"
                        onClick={() => setShowForgotConfirmPassword(value => !value)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-[#7c756d] hover:text-[#2c2a29] cursor-pointer"
                      >
                        {showForgotConfirmPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                      </button>
                    </div>
                  </div>

                  <div className="flex gap-2 justify-end pt-2">
                    <button
                      type="button"
                      onClick={() => setForgotStep("otp")}
                      className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold cursor-pointer"
                    >
                      Back
                    </button>
                    <button
                      type="button"
                      disabled={forgotLoading}
                      onClick={resetPassword}
                      className="px-5 py-2 bg-[#2c2a29] hover:bg-[#4a4644] text-white rounded-xl text-xs font-bold cursor-pointer shadow-md"
                    >
                      {forgotLoading ? "Resetting..." : "Reset Password"}
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
