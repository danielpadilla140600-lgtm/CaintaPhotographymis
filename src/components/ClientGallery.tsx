import React, { useState, useEffect } from "react";
import { PhotoProofingGallery, ProofPhoto, User, UserRole } from "../db/types";
import { 
  Sparkles, Star, CheckCircle, Image as ImageIcon, Send, 
  Eye, Download, Lock, ExternalLink, Settings, RefreshCw, X, Shield, MessageSquare
} from "lucide-react";
import { apiRequest, resolveApiUrl, ApiError } from "../utils/apiClient.ts";

interface ClientGalleryProps {
  bookingId: string;
  currentUser: User | null;
  studioName?: string;
  onClose?: () => void;
}

export const ClientGallery: React.FC<ClientGalleryProps> = ({
  bookingId,
  currentUser,
  studioName = "Photography Studio",
  onClose
}) => {
  const [gallery, setGallery] = useState<PhotoProofingGallery | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [selectedPhoto, setSelectedPhoto] = useState<ProofPhoto | null>(null);
  const [watermarkText, setWatermarkText] = useState<string>("PROOF - CAINTA STUDIO");
  const [watermarkOpacity, setWatermarkOpacity] = useState<number>(0.35);
  const [watermarkPos, setWatermarkPos] = useState<"center" | "bottom_right" | "repeat_diagonal">("repeat_diagonal");
  const [newPhotoUrl, setNewPhotoUrl] = useState<string>("");
  const [newProofFiles, setNewProofFiles] = useState<File[]>([]);
  const [finalDriveLink, setFinalDriveLink] = useState<string>("");
  const [feedbackNoteInput, setFeedbackNoteInput] = useState<string>("");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [uploadingProof, setUploadingProof] = useState<boolean>(false);
  const [resolvedPhotoUrls, setResolvedPhotoUrls] = useState<Record<string, string>>({});

  const authHeaders = {
    "Content-Type": "application/json",
    ...(currentUser?.authToken ? { Authorization: `Bearer ${currentUser.authToken}` } : {})
  };

  const isStudioAdmin = currentUser?.role === UserRole.STUDIO_ADMIN || currentUser?.role === UserRole.SUPER_ADMIN;

  const resolveProtectedImageUrl = async (url: string): Promise<string> => {
    if (!url || !url.startsWith("/api/media/")) return url;

    const response = await fetch(resolveApiUrl(url), {
      headers: authHeaders
    });

    if (!response.ok) {
      throw new Error("Unable to load proof image.");
    }

    const blob = await response.blob();
    return URL.createObjectURL(blob);
  };

  const hydrateGalleryPhotos = async (nextGallery: PhotoProofingGallery | null) => {
    if (!nextGallery) {
      setResolvedPhotoUrls({});
      return;
    }

    const resolved: Record<string, string> = {};
    for (const photo of nextGallery.photos) {
      try {
        if (photo.url.startsWith("/api/media/")) {
          resolved[photo.id] = await resolveProtectedImageUrl(photo.url);
        }
      } catch (err) {
        console.warn("Failed to resolve proof image:", err);
        resolved[photo.id] = photo.url;
      }
    }
    setResolvedPhotoUrls(resolved);
  };

  useEffect(() => {
    fetchGallery();
  }, [bookingId]);

  const fetchGallery = async () => {
    try {
      setLoading(true);
      const data = await apiRequest(`/api/photo-proofing/booking/${bookingId}`);
      if (data.gallery) {
        setGallery(data.gallery);
        await hydrateGalleryPhotos(data.gallery);
        setWatermarkText(data.gallery.watermarkText || "PROOF - CAINTA STUDIO");
        setWatermarkOpacity(data.gallery.watermarkOpacity || 0.35);
        setWatermarkPos(data.gallery.watermarkPosition || "repeat_diagonal");
        setFinalDriveLink(data.gallery.finalDriveLink || "");
      } else if (isStudioAdmin) {
        // Auto-create initial gallery template for admin
        createInitialGallery();
      } else {
        setGallery(null);
      }
    } catch (err) {
      console.error("Error loading proofing gallery:", err);
      if (isStudioAdmin) {
        createInitialGallery();
      } else {
        setGallery(null);
      }
    } finally {
      setLoading(false);
    }
  };

  const createInitialGallery = async () => {
    if (!currentUser?.studioId) {
      setGallery(null);
      return;
    }

    try {
      const bookingData = await apiRequest(`/api/bookings/${bookingId}`);
      const bookingCustomerId = bookingData?.booking?.customerId;

      if (!bookingCustomerId) {
        throw new Error("Unable to resolve booking customer.");
      }

      const data = await apiRequest("/api/photo-proofing", {
        method: "POST",
        body: {
          bookingId,
          studioId: currentUser.studioId,
          customerId: bookingCustomerId,
          photos: [],
          watermarkText: `${studioName.toUpperCase()} - PROOF ONLY`,
          watermarkPosition: "repeat_diagonal",
          watermarkOpacity: 0.35
        }
      });
      setGallery(data.gallery);
      await hydrateGalleryPhotos(data.gallery);
    } catch (err) {
      console.error("Failed creating initial gallery:", err);
      setGallery(null);
    }
  };

  const handleToggleSelectPhoto = (photoId: string) => {
    if (!gallery) return;
    const updatedPhotos = gallery.photos.map(p => {
      if (p.id === photoId) {
        return { ...p, isSelectedForPrint: !p.isSelectedForPrint, isStarred: !p.isSelectedForPrint };
      }
      return p;
    });
    setGallery({ ...gallery, photos: updatedPhotos });
  };

  const handleSaveFeedbackNote = (photoId: string) => {
    if (!gallery) return;
    const updatedPhotos = gallery.photos.map(p => {
      if (p.id === photoId) {
        return { ...p, feedbackNote: feedbackNoteInput };
      }
      return p;
    });
    setGallery({ ...gallery, photos: updatedPhotos });
    setStatusMessage("Retouching feedback note saved for this photo!");
    setTimeout(() => setStatusMessage(null), 3000);
  };

  const handleSubmitSelections = async () => {
    if (!gallery) return;
    try {
      setSaving(true);
      const data = await apiRequest(`/api/photo-proofing/${gallery.id}/photos`, {
        method: "PUT",
        body: {
          photos: gallery.photos,
          status: "client_reviewed",
          watermarkText,
          watermarkOpacity,
          watermarkPosition: watermarkPos
        }
      });
      setGallery(data.gallery);
      setStatusMessage("Your photo selections & retouch notes have been submitted to the Studio!");
      setTimeout(() => setStatusMessage(null), 4000);
    } catch (err) {
      console.error("Failed submitting selections:", err);
    } finally {
      setSaving(false);
    }
  };

  const handleAddPhotoAdmin = async () => {
    if (!gallery) return;

    if (newProofFiles.length > 0) {
      try {
        setUploadingProof(true);
        const uploadedPhotos: ProofPhoto[] = [];

        for (const file of newProofFiles) {
          const fileData = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(String(reader.result || ""));
            reader.onerror = () => reject(new Error(`Unable to read the selected proof photo: ${file.name}`));
            reader.readAsDataURL(file);
          });

          const mediaData = await apiRequest("/api/media", {
            method: "POST",
            body: {
              entityType: "photo-proofing",
              entityId: gallery.id,
              purpose: "PROOF_PHOTO",
              fileData,
              originalName: file.name
            }
          });
          if (!mediaData.url) {
            throw new Error(mediaData.message || `Failed to upload the proof image: ${file.name}`);
          }

          uploadedPhotos.push({
            id: `ph-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            url: mediaData.url,
            caption: file.name || "Newly Uploaded Studio Shot",
            isSelectedForPrint: false,
            isStarred: false,
            status: "raw"
          });
        }

        const updatedPhotos = [...gallery.photos, ...uploadedPhotos];
        const data = await apiRequest(`/api/photo-proofing/${gallery.id}/photos`, {
          method: "PUT",
          body: {
            photos: updatedPhotos,
            status: gallery.status || "sent_to_client",
            watermarkText,
            watermarkOpacity,
            watermarkPosition: watermarkPos
          }
        });
        setGallery(data.gallery);
        await hydrateGalleryPhotos(data.gallery);
        setStatusMessage(`${uploadedPhotos.length} photo proof${uploadedPhotos.length > 1 ? "s were" : " was"} uploaded and saved successfully.`);
        setTimeout(() => setStatusMessage(null), 3000);
      } catch (err) {
        console.error("Failed uploading proof photos:", err);
        setStatusMessage("Unable to save the uploaded proof images. Please try again.");
        setTimeout(() => setStatusMessage(null), 4000);
      } finally {
        setSaving(false);
        setUploadingProof(false);
        setNewProofFiles([]);
        setNewPhotoUrl("");
      }
      return;
    }

    if (!newPhotoUrl.trim()) return;

    const newPhoto: ProofPhoto = {
      id: `ph-${Date.now()}`,
      url: newPhotoUrl.trim(),
      caption: "Newly Uploaded Studio Shot",
      isSelectedForPrint: false,
      isStarred: false,
      status: "raw"
    };

    try {
      setSaving(true);
      const updatedPhotos = [...gallery.photos, newPhoto];
      const data = await apiRequest(`/api/photo-proofing/${gallery.id}/photos`, {
        method: "PUT",
        body: {
          photos: updatedPhotos,
          status: gallery.status || "sent_to_client",
          watermarkText,
          watermarkOpacity,
          watermarkPosition: watermarkPos
        }
      });
      setGallery(data.gallery);
      await hydrateGalleryPhotos(data.gallery);
      setStatusMessage("Photo proof added successfully.");
      setTimeout(() => setStatusMessage(null), 3000);
    } catch (err) {
      console.error("Failed adding admin proof photo:", err);
      setStatusMessage("Unable to save this photo proof. Please try again.");
      setTimeout(() => setStatusMessage(null), 4000);
    } finally {
      setSaving(false);
      setNewPhotoUrl("");
    }
  };

  const handleDeliverDriveLink = async () => {
    if (!gallery) return;
    try {
      setSaving(true);
      const data = await apiRequest(`/api/photo-proofing/${gallery.id}/deliver`, {
        method: "PUT",
        body: {
          finalDriveLink: finalDriveLink || "",
          status: "completed"
        }
      });
      setGallery(data.gallery);
      setStatusMessage("Final High-Res Google Drive Link delivered to customer!");
      setTimeout(() => setStatusMessage(null), 4000);
    } catch (err) {
      console.error("Failed delivering drive link:", err);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8 text-center bg-slate-900 rounded-2xl text-slate-300">
        <RefreshCw className="w-8 h-8 animate-spin mx-auto text-amber-400 mb-3" />
        <p className="text-sm">Loading Client Photo Proofing Gallery...</p>
      </div>
    );
  }

  const galleryNotReadyForCustomer = !isStudioAdmin && (
    !gallery ||
    gallery.status === "draft" ||
    (gallery.status !== "completed" && gallery.photos.length === 0)
  );

  if (galleryNotReadyForCustomer) {
    return (
      <div className="p-8 text-center bg-slate-900 rounded-2xl border border-slate-800 text-slate-300">
        <ImageIcon className="w-12 h-12 text-slate-600 mx-auto mb-3" />
        <h3 className="text-lg font-semibold text-white">Proofing Gallery Not Ready Yet</h3>
        <p className="text-sm text-slate-400 mt-1 max-w-md mx-auto">
          The studio is currently preparing and editing your watermarked photo proofs. You will receive an SMS/Email notification once your proofs are available for review.
        </p>
        <div className="mt-4 flex items-center justify-center gap-2 flex-wrap">
          <button
            onClick={() => fetchGallery()}
            className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold rounded-lg flex items-center gap-2"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Check Again
          </button>
          {onClose && (
            <button onClick={onClose} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs rounded-lg">
              Close Panel
            </button>
          )}
        </div>
      </div>
    );
  }

  const selectedCount = gallery?.photos.filter(p => p.isSelectedForPrint).length || 0;

  return (
    <div className="bg-slate-900 text-slate-100 rounded-2xl border border-slate-800 overflow-hidden shadow-2xl max-w-5xl mx-auto">
      {/* Header Bar */}
      <div className="bg-slate-950 p-5 border-b border-slate-800 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-amber-400" />
            <h2 className="text-lg font-bold text-white">{studioName} - Client Photo Proofing Portal</h2>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
              Booking #{bookingId}
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            {isStudioAdmin
              ? "Studio Admin Controls: Upload proofs, customize watermark, and deliver final high-res files."
              : "Review watermarked photo proofs, star your favorites for editing, and leave retouch notes."}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-300">
            Selected for Final Print: <span className="text-amber-400 font-bold">{selectedCount}</span> / {gallery?.photos.length}
          </div>
          {onClose && (
            <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800">
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {statusMessage && (
        <div className="bg-emerald-500/10 border-b border-emerald-500/20 p-3 text-center text-emerald-400 text-xs font-medium flex items-center justify-center gap-2">
          <CheckCircle className="w-4 h-4" />
          {statusMessage}
        </div>
      )}

      {/* Admin Watermark & Settings Drawer */}
      {isStudioAdmin && (
        <div className="bg-slate-950/60 p-4 border-b border-slate-800 grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div>
            <label className="block text-slate-400 mb-1 font-medium">Watermark Overlay Text</label>
            <input 
              type="text" 
              value={watermarkText} 
              onChange={(e) => setWatermarkText(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-white"
            />
          </div>
          <div>
            <label className="block text-slate-400 mb-1 font-medium">Watermark Opacity ({Math.round(watermarkOpacity * 100)}%)</label>
            <input 
              type="range" 
              min="0.1" 
              max="0.8" 
              step="0.05" 
              value={watermarkOpacity} 
              onChange={(e) => setWatermarkOpacity(parseFloat(e.target.value))}
              className="w-full accent-amber-500"
            />
          </div>
          <div>
            <label className="block text-slate-400 mb-1 font-medium">Watermark Style</label>
            <select 
              value={watermarkPos} 
              onChange={(e: any) => setWatermarkPos(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-white"
            >
              <option value="repeat_diagonal">Diagonal Pattern (Anti-Theft)</option>
              <option value="center">Centered Stamp</option>
              <option value="bottom_right">Corner Stamp</option>
            </select>
          </div>
        </div>
      )}

      {/* Main Photo Proofing Grid */}
      <div className="p-6 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
        {gallery?.photos.map((photo) => (
          <div 
            key={photo.id}
            className={`group relative rounded-xl border overflow-hidden transition-all duration-200 bg-slate-950 ${
              photo.isSelectedForPrint ? "border-amber-500 ring-2 ring-amber-500/30" : "border-slate-800 hover:border-slate-700"
            }`}
          >
            {/* Watermarked Photo Preview Frame */}
            <div className="relative aspect-4/5 overflow-hidden bg-slate-950 select-none">
              <img 
                src={resolvedPhotoUrls[photo.id] || photo.url} 
                alt={photo.caption || "Proof photo"} 
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              />

              {/* Watermark Rendering Overlay */}
              <div 
                className="absolute inset-0 pointer-events-none flex items-center justify-center overflow-hidden"
                style={{ opacity: watermarkOpacity }}
              >
                {watermarkPos === "repeat_diagonal" && (
                  <div className="transform -rotate-30 text-white font-extrabold text-xs tracking-widest leading-loose text-center opacity-80 whitespace-nowrap drop-shadow-md select-none">
                    {Array(8).fill(watermarkText).join("   •   ")}<br/>
                    {Array(8).fill(watermarkText).join("   •   ")}<br/>
                    {Array(8).fill(watermarkText).join("   •   ")}
                  </div>
                )}
                {watermarkPos === "center" && (
                  <div className="border-2 border-white/80 bg-black/40 px-4 py-2 rounded text-white font-bold text-sm tracking-wider uppercase">
                    {watermarkText}
                  </div>
                )}
                {watermarkPos === "bottom_right" && (
                  <div className="absolute bottom-2 right-2 bg-black/60 px-2 py-1 rounded text-white font-semibold text-[10px]">
                    {watermarkText}
                  </div>
                )}
              </div>

              {/* Selection Star Badge */}
              <button 
                onClick={() => handleToggleSelectPhoto(photo.id)}
                className={`absolute top-2 right-2 p-2 rounded-full backdrop-blur-md transition-all shadow-lg ${
                  photo.isSelectedForPrint 
                    ? "bg-amber-500 text-slate-950" 
                    : "bg-slate-900/80 text-slate-400 hover:text-amber-400"
                }`}
                title={photo.isSelectedForPrint ? "Selected for editing" : "Click to select for editing"}
              >
                <Star className="w-4 h-4 fill-current" />
              </button>

              {/* Quick Zoom Eye Button */}
              <button
                onClick={() => {
                  setSelectedPhoto(photo);
                  setFeedbackNoteInput(photo.feedbackNote || "");
                }}
                className="absolute top-2 left-2 p-2 rounded-full bg-slate-900/80 text-slate-300 hover:text-white backdrop-blur-md"
              >
                <Eye className="w-4 h-4" />
              </button>
            </div>

            {/* Photo Footer Card */}
            <div className="p-3">
              <p className="text-xs font-medium text-slate-200 truncate">{photo.caption || "Studio Photo"}</p>
              
              {photo.feedbackNote && (
                <div className="mt-2 text-[11px] text-amber-300 bg-amber-500/10 p-1.5 rounded border border-amber-500/20 flex items-start gap-1">
                  <MessageSquare className="w-3 h-3 shrink-0 mt-0.5 text-amber-400" />
                  <span className="truncate">{photo.feedbackNote}</span>
                </div>
              )}

              <div className="mt-2 flex items-center justify-between">
                <button
                  onClick={() => handleToggleSelectPhoto(photo.id)}
                  className={`text-[11px] font-semibold px-2.5 py-1 rounded-md transition-all ${
                    photo.isSelectedForPrint
                      ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                      : "bg-slate-800 hover:bg-slate-700 text-slate-400"
                  }`}
                >
                  {photo.isSelectedForPrint ? "✓ Selected" : "+ Select Photo"}
                </button>

                <button
                  onClick={() => {
                    setSelectedPhoto(photo);
                    setFeedbackNoteInput(photo.feedbackNote || "");
                  }}
                  className="text-[11px] text-slate-400 hover:text-slate-200 flex items-center gap-1"
                >
                  <MessageSquare className="w-3 h-3" /> Note
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Admin Photo Uploader Row */}
      {isStudioAdmin && (
        <div className="p-5 bg-slate-950 border-t border-slate-800">
          <h4 className="text-xs font-bold text-slate-300 mb-2">Upload Additional Proof Photo (Admin)</h4>
          <div className="flex flex-col md:flex-row gap-2">
            <input 
              type="text" 
              placeholder="Paste image URL only if needed (fallback)"
              value={newPhotoUrl}
              onChange={(e) => setNewPhotoUrl(e.target.value)}
              className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white"
            />
            <label className="flex items-center justify-center gap-2 px-3 py-2 border border-dashed border-slate-700 bg-slate-900 rounded-lg text-[10px] text-slate-300 cursor-pointer hover:border-amber-500/60 hover:text-white">
              <ImageIcon className="w-3.5 h-3.5" />
              <span>{newProofFiles.length > 0 ? `${newProofFiles.length} file(s) selected` : "Upload from device"}</span>
              <input
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => setNewProofFiles(Array.from(e.target.files || []))}
              />
            </label>
            <button 
              onClick={handleAddPhotoAdmin}
              disabled={saving || uploadingProof}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 disabled:opacity-60"
            >
              <ImageIcon className="w-3.5 h-3.5" /> {uploadingProof ? "Uploading..." : "Add Photo Proof"}
            </button>
          </div>
        </div>
      )}

      {/* Final High-Res Drive Delivery Section */}
      {gallery?.status === "completed" || gallery?.finalDriveLink ? (
        <div className="m-6 p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex items-center justify-between">
          <div>
            <h4 className="text-sm font-bold text-emerald-400 flex items-center gap-2">
              <CheckCircle className="w-4 h-4" /> Final High-Resolution Photos Ready!
            </h4>
            <p className="text-xs text-slate-300 mt-1">
              Your studio retouching is complete. Access your full unwatermarked high-res photos via the secure drive folder below:
            </p>
          </div>
          <a
            href={gallery.finalDriveLink || "#"}
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-slate-950 text-xs font-bold rounded-lg flex items-center gap-2 shadow-lg"
          >
            <Download className="w-4 h-4" /> Download Google Drive
          </a>
        </div>
      ) : isStudioAdmin ? (
        <div className="p-5 bg-slate-950 border-t border-slate-800 flex flex-wrap items-center justify-between gap-4">
          <div className="flex-1">
            <label className="block text-xs font-bold text-slate-300 mb-1">Deliver Final Drive Link to Client</label>
            <input 
              type="text" 
              placeholder="https://drive.google.com/drive/folders/your-high-res-photos"
              value={finalDriveLink}
              onChange={(e) => setFinalDriveLink(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white"
            />
          </div>
          <button
            onClick={handleDeliverDriveLink}
            disabled={saving}
            className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl flex items-center gap-2 self-end shadow-lg"
          >
            <Send className="w-4 h-4" /> Mark Completed & Send Link
          </button>
        </div>
      ) : (
        <div className="p-5 bg-slate-950 border-t border-slate-800 flex items-center justify-between">
          <p className="text-xs text-slate-400">
            Once you are done selecting photos and adding retouch notes, submit your review below.
          </p>
          <button
            onClick={handleSubmitSelections}
            disabled={saving}
            className="px-6 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl flex items-center gap-2 shadow-lg"
          >
            <Send className="w-4 h-4" /> Submit Selections to Studio ({selectedCount} Selected)
          </button>
        </div>
      )}

      {/* Modal for Zooming & Editing Retouch Notes */}
      {selectedPhoto && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full p-6 text-slate-100 shadow-2xl relative">
            <button 
              onClick={() => setSelectedPhoto(null)}
              className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white rounded-full bg-slate-800"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-base font-bold text-white mb-3">Photo Preview & Retouch Feedback</h3>
            
            <div className="relative aspect-4/3 rounded-xl overflow-hidden bg-black mb-4">
              <img
                src={resolvedPhotoUrls[selectedPhoto.id] || selectedPhoto.url}
                alt="Zoom preview"
                className="w-full h-full object-contain"
              />
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Retouching Instructions / Feedback Note for Studio Photographer:
                </label>
                <textarea
                  rows={3}
                  value={feedbackNoteInput}
                  onChange={(e) => setFeedbackNoteInput(e.target.value)}
                  placeholder="e.g., Please brighten the background, smooth skin tone, or adjust color warmth..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="flex items-center justify-between pt-2">
                <button
                  onClick={() => handleToggleSelectPhoto(selectedPhoto.id)}
                  className={`px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 ${
                    selectedPhoto.isSelectedForPrint
                      ? "bg-amber-500 text-slate-950"
                      : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                  }`}
                >
                  <Star className="w-4 h-4 fill-current" />
                  {selectedPhoto.isSelectedForPrint ? "Selected for Final Print" : "Select for Print"}
                </button>

                <button
                  onClick={() => {
                    handleSaveFeedbackNote(selectedPhoto.id);
                    setSelectedPhoto(null);
                  }}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-lg"
                >
                  Save Note & Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
