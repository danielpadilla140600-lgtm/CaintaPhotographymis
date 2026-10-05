import React, { useState } from "react";
import { X, Upload, Check, Info, ArrowRight, ChevronLeft, Eye, Sparkles } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { SoundEngine } from "../utils/soundEffects.ts";
import { apiRequest, ApiError } from "../utils/apiClient.ts";

interface PrintOrderWizardProps {
  studio: any;
  printProducts: any[];
  currentUser: any | null;
  onClose: () => void;
  onSuccess: (orderId: string) => void;
}

export default function PrintOrderWizard({
  studio,
  printProducts,
  currentUser,
  onClose,
  onSuccess
}: PrintOrderWizardProps) {
  const [step, setStep] = useState(1);
  const [selectedProduct, setSelectedProduct] = useState<any>(printProducts[0] || null);
  const [quantity, setQuantity] = useState<number>(1);
  const [uploadedPhoto, setUploadedPhoto] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const [showMockupModal, setShowMockupModal] = useState(false);
  const [frameStyle, setFrameStyle] = useState<"oak" | "black" | "gold" | "frameless">("black");
  const [backdrop, setBackdrop] = useState<"neutral" | "cozy" | "gallery" | "easel">("neutral");
  const [matteFinish, setMatteFinish] = useState<"glossy" | "matte">("glossy");
  const [scaleMode, setScaleMode] = useState<"fit" | "fill">("fit");
  const [designConfirmed, setDesignConfirmed] = useState(false);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.size > 8 * 1024 * 1024) {
      setErrorMsg("Please choose an image smaller than 8 MB.");
      e.currentTarget.value = "";
      return;
    }
    if (file && !["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setErrorMsg("Please choose a JPEG, PNG, or WebP image.");
      e.currentTarget.value = "";
      return;
    }
    if (file) {
      setErrorMsg("");
      const reader = new FileReader();
      reader.onloadend = () => {
        setUploadedPhoto(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const totalAmount = selectedProduct ? (selectedProduct.price * quantity) : 0;

  const handleNextStep = () => {
    if (step === 1 && !selectedProduct) return;
    if (step === 2 && !uploadedPhoto) {
      setErrorMsg("Please upload the photo you would like us to print.");
      return;
    }
    SoundEngine.playFocusBeep();
    setErrorMsg("");
    setSuccessMsg("");
    setStep(prev => prev + 1);
  };

  const handlePrevStep = () => {
    SoundEngine.playPop();
    setErrorMsg("");
    setSuccessMsg("");
    setStep(prev => prev - 1);
  };

  const handleSubmitPrintOrder = async () => {
    if (!currentUser) {
      setErrorMsg("Please log in to submit a print order.");
      return;
    }
    if (!designConfirmed) {
      setErrorMsg("Please review and confirm your print design before submitting.");
      return;
    }

    setLoading(true);
    setErrorMsg("");
    setSuccessMsg("");

    const orderPayload = {
      studioId: studio.id,
      customerId: currentUser.id,
      productId: selectedProduct.id,
      quantity,
      uploadedPhoto,
      printDesign: { frameStyle, backdrop, matteFinish, scaleMode },
      totalAmount,
      shippingAddress: undefined
    };

    try {
      const data = await apiRequest("/api/print-orders", {
        method: "POST",
        body: orderPayload
      });
      SoundEngine.playSuccess();
      setSuccessMsg(`Order submitted successfully! Order ID: ${data.printOrder.id}. We will process your print and notify you once it's ready for pickup.`);
      setTimeout(() => onSuccess(data.printOrder.id), 2500);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || "Failed to submit print order. Please try again or contact the studio.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden flex justify-end">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <motion.div
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ type: "spring", damping: 30, stiffness: 300 }}
        className="relative bg-[#faf9f6] w-full max-w-md h-full shadow-2xl flex flex-col z-10 border-l border-[#e5e1da]"
      >
        {/* Header */}
        <div className="bg-[#2c2a29] text-white p-5 flex items-center justify-between border-b border-white/10 shadow-md">
          <div>
            <span className="text-[10px] uppercase tracking-wider text-yellow-500 font-bold">Creative Printing Shop</span>
            <h3 className="font-display text-lg font-bold text-[#faf9f6] leading-tight">{studio.name}</h3>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-white/10 text-white transition-colors cursor-pointer">
            <X size={20} />
          </button>
        </div>

        {/* Steps header */}
        <div className="bg-white border-b border-[#e5e1da] px-5 py-3 flex justify-between items-center text-xs text-[#7c756d] overflow-x-auto hide-scrollbar whitespace-nowrap">
          <div className="flex gap-3">
            <span className={step === 1 ? "text-[#2c2a29] font-bold" : ""}>1. Product</span>
            <span>&rarr;</span>
            <span className={step === 2 ? "text-[#2c2a29] font-bold" : ""}>2. Photo</span>
            <span>&rarr;</span>
            <span className={step === 3 ? "text-[#2c2a29] font-bold" : ""}>3. Confirm Printing</span>
            <span>&rarr;</span>
            <span className={step === 4 ? "text-[#2c2a29] font-bold" : ""}>4. Design</span>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 text-left">
          {errorMsg && (
            <div className="bg-red-50 border border-red-200 text-red-800 p-4 rounded-xl text-xs font-semibold flex items-start gap-2">
              <span className="text-red-500 mt-0.5">✕</span>
              <span>{errorMsg}</span>
            </div>
          )}
          {successMsg && (
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-4 rounded-xl text-xs font-semibold flex items-start gap-2">
              <Check size={14} className="text-emerald-600 mt-0.5 flex-shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* STEP 1: Product Selection */}
          {step === 1 && (
            <div className="space-y-4">
              <h4 className="font-display text-base font-bold text-[#2c2a29]">Select Print Product & Size</h4>
              <p className="text-xs text-[#7c756d]">We print on premium, high-gloss and matte textured archival photopapers.</p>

              <div className="grid gap-3">
                {printProducts.map((prod) => (
                  <div
                    key={prod.id}
                    onClick={() => setSelectedProduct(prod)}
                    className={`p-4 rounded-xl border-2 flex gap-4 cursor-pointer transition-all ${
                      selectedProduct?.id === prod.id 
                        ? "border-[#2c2a29] bg-white shadow-sm" 
                        : "border-[#e5e1da] bg-white hover:border-[#7c756d]"
                    }`}
                  >
                    <img src={prod.images?.[0] || prod.image} alt={prod.name} className="w-14 h-14 rounded-lg object-cover" />
                    <div className="flex-1 text-left">
                      <div className="flex justify-between">
                        <h5 className="font-semibold text-xs text-[#2c2a29]">{prod.name}</h5>
                        <span className="font-bold text-xs text-[#2c2a29]">{prod.price} PHP</span>
                      </div>
                      <p className="text-[10px] text-[#7c756d] mt-0.5 line-clamp-1">{prod.description}</p>
                      <div className="flex justify-between items-center mt-2 text-[9px] text-[#7c756d] font-semibold">
                        <span>Size: {prod.size}</span>
                        <span>Fulfill: {prod.estimatedHours} hrs</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Quantity */}
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-[#2c2a29]">Printing Copies / Quantity</label>
                <div className="flex items-center gap-3">
                  <button 
                    onClick={() => setQuantity(q => Math.max(1, q - 1))}
                    className="w-8 h-8 rounded-lg bg-white border border-[#e5e1da] text-xs font-bold text-[#2c2a29] cursor-pointer"
                  >
                    -
                  </button>
                  <span className="text-sm font-bold w-6 text-center">{quantity}</span>
                  <button 
                    onClick={() => setQuantity(q => q + 1)}
                    className="w-8 h-8 rounded-lg bg-white border border-[#e5e1da] text-xs font-bold text-[#2c2a29] cursor-pointer"
                  >
                    +
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: Upload Photo */}
          {step === 2 && (
            <div className="space-y-4">
              <h4 className="font-display text-base font-bold text-[#2c2a29]">Upload Your Photo To Be Printed</h4>
              <p className="text-xs text-[#7c756d]">Please ensure your photograph is high-resolution for pristine matte and glossy frames.</p>

              <div className="border-2 border-dashed border-[#e5e1da] rounded-2xl p-6 text-center bg-white relative hover:border-[#7c756d] cursor-pointer transition-colors">
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(e) => handleFileUpload(e)}
                  className="absolute inset-0 opacity-0 cursor-pointer"
                />
                {uploadedPhoto ? (
                  <div className="space-y-3">
                    <img src={uploadedPhoto} alt="Upload preview" className="mx-auto max-h-48 rounded-lg object-contain shadow-md" />
                    <div className="text-xs text-green-600 font-semibold flex items-center justify-center gap-1">
                      <Check size={14} /> Ready to print! Click to change
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2 py-8 text-[#7c756d]">
                    <Upload size={32} />
                    <span className="text-xs font-semibold text-[#2c2a29]">Click or drag your photo file</span>
                    <span className="text-[10px]">JPEG, PNG, or WebP. Max 8 MB.</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* STEP 3: Confirm Printing */}
          {step === 3 && (
            <div className="space-y-5 animate-in fade-in">
              <h4 className="font-display text-base font-bold text-[#2c2a29]">Confirm Printing Details</h4>
              <p className="text-xs text-[#7c756d]">Review the photo, print product, size, and quantity. You will choose the final design on the next step.</p>

              {/* Pickup + cash payment notice */}
              <div className="bg-amber-50 border border-amber-200 text-amber-900 p-4 rounded-xl flex items-start gap-3 text-xs">
                <Info size={16} className="flex-shrink-0 mt-0.5 text-amber-600" />
                <div className="space-y-1">
                  <strong className="block text-amber-900 font-bold">Studio Pickup — Pay Cash Upon Pickup</strong>
                  <p className="text-[#7c756d] leading-relaxed">
                    No upfront online payment required! Your photo prints will be produced at our studio. Simply pick up your order at the counter and pay in cash upon receiving your prints.
                  </p>
                </div>
              </div>

              {/* Final summary card */}
              <div className="bg-white border-2 border-[#e5e1da] p-5 rounded-2xl text-xs space-y-3">
                <div className="flex justify-between items-center border-b border-gray-100 pb-3">
                  <span className="font-bold text-[#2c2a29] text-sm">Order Summary</span>
                  <span className="text-[10px] font-bold uppercase bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">Pickup Only</span>
                </div>
                <div className="flex items-center gap-3">
                  <img src={uploadedPhoto} alt="Photo selected for printing" className="w-20 h-20 rounded-lg object-cover border border-[#e5e1da]" />
                  <span className="font-semibold text-[#2c2a29]">Photo to be printed</span>
                </div>
                <div className="flex justify-between"><span className="text-[#7c756d]">Product</span><span className="font-bold text-[#2c2a29]">{selectedProduct?.name}</span></div>
                <div className="flex justify-between"><span className="text-[#7c756d]">Size</span><span className="font-bold text-[#2c2a29]">{selectedProduct?.size}</span></div>
                <div className="flex justify-between"><span className="text-[#7c756d]">Quantity</span><span className="font-bold text-[#2c2a29]">{quantity} copies</span></div>
                <div className="flex justify-between"><span className="text-[#7c756d]">Pickup Location</span><span className="font-bold text-[#2c2a29]">{studio.name}</span></div>
                <div className="flex justify-between"><span className="text-[#7c756d]">Payment Method</span><span className="font-bold text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded text-[11px]">Pay on Pickup (Cash at Counter)</span></div>
                <div className="flex justify-between items-center bg-[#2c2a29] text-white p-3 rounded-xl mt-2">
                  <span className="font-bold">Total Amount Due (Upon Pickup)</span>
                  <span className="font-extrabold text-base">₱{totalAmount.toLocaleString("en-PH", { minimumFractionDigits: 2 })}</span>
                </div>
              </div>

              <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-4 rounded-xl text-xs flex items-start gap-2">
                <Check size={14} className="flex-shrink-0 mt-0.5 text-emerald-600" />
                <span>
                  After you confirm these printing details, you can choose the frame and finish before submitting your order.
                </span>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-5 animate-in fade-in">
              <h4 className="font-display text-base font-bold text-[#2c2a29]">Choose Your Print Design</h4>
              <p className="text-xs text-[#7c756d]">Your printing details are confirmed. Select the frame, finish, and crop before placing your order.</p>
              <div className="bg-white border border-[#e5e1da] p-4 rounded-xl flex items-center gap-3">
                <img src={uploadedPhoto} alt="Photo selected for printing" className="w-20 h-20 rounded-lg object-cover border border-[#e5e1da]" />
                <div className="min-w-0">
                  <p className="font-bold text-xs text-[#2c2a29]">{selectedProduct?.name} · {selectedProduct?.size}</p>
                  <p className="text-[10px] text-[#7c756d] mt-1">{frameStyle} frame · {matteFinish} finish · {scaleMode} crop</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowMockupModal(true)}
                disabled={!!successMsg}
                className="w-full py-3 px-4 bg-[#2c2a29] text-[#faf9f6] hover:bg-[#4a4644] text-xs font-bold rounded-xl flex items-center justify-center gap-2 transition-all shadow-sm cursor-pointer disabled:opacity-50"
              >
                <Eye size={14} /> {designConfirmed ? "Review or Change Design" : "Choose Frame and Finish"}
              </button>
              <div className={`p-3 rounded-xl text-xs font-semibold ${designConfirmed ? "bg-emerald-50 border border-emerald-200 text-emerald-800" : "bg-amber-50 border border-amber-200 text-amber-900"}`}>
                {designConfirmed ? "Design confirmed. It will be locked to this order after submission." : "Open the mockup and confirm your design to continue."}
              </div>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="p-5 border-t border-[#e5e1da] bg-white flex justify-between items-center">
          <div className="text-left">
            <span className="text-[10px] text-[#7c756d] block">Total Amount</span>
            <span className="text-base font-bold text-[#2c2a29]">₱{totalAmount.toLocaleString("en-PH", { minimumFractionDigits: 2 })}</span>
          </div>

          <div className="flex gap-2">
            {step > 1 && (
              <button
                onClick={handlePrevStep}
                disabled={loading || !!successMsg}
                className="px-3 py-2 bg-white hover:bg-[#faf9f6] border border-[#e5e1da] text-[#2c2a29] rounded-full text-xs font-semibold flex items-center gap-1 cursor-pointer disabled:opacity-50"
              >
                <ChevronLeft size={14} /> Back
              </button>
            )}

            {step < 4 ? (
              <button
                onClick={handleNextStep}
                className="px-4 py-2 bg-[#2c2a29] hover:bg-[#4a4644] text-white rounded-full text-xs font-semibold flex items-center gap-1 shadow-sm cursor-pointer"
              >
                Next <ArrowRight size={14} />
              </button>
            ) : (
              <button
                onClick={handleSubmitPrintOrder}
                disabled={loading || !!successMsg || !designConfirmed}
                className="px-5 py-2.5 bg-yellow-500 hover:bg-yellow-400 text-black font-extrabold rounded-full text-xs uppercase tracking-wider shadow-sm disabled:opacity-75 transition-all flex items-center justify-center gap-2 cursor-pointer min-w-[170px]"
              >
                {loading ? (
                  <span className="flex items-center gap-1">
                    <span className="w-1.5 h-1.5 bg-black rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                    <span className="w-1.5 h-1.5 bg-black rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                    <span className="w-1.5 h-1.5 bg-black rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                    <span className="ml-1 text-[10px] font-mono tracking-widest uppercase">Ordering</span>
                  </span>
                ) : successMsg ? (
                  <span className="flex items-center gap-1"><Check size={14} /> Order Placed!</span>
                ) : (
                  <span>Submit Order</span>
                )}
              </button>
            )}
          </div>
        </div>
      </motion.div>

      {/* Visual Image Preview Mockup Modal */}
      <AnimatePresence>
        {showMockupModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md"
          >
            <motion.div
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              className="bg-white rounded-3xl max-w-4xl w-full h-[90vh] md:h-auto md:max-h-[85vh] overflow-hidden flex flex-col text-left shadow-2xl border border-[#e5e1da]"
            >
              {/* Modal Header */}
              <div className="p-4 sm:p-5 border-b border-gray-100 flex items-center justify-between bg-[#faf9f6]">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-[#2c2a29] text-white rounded-lg">
                    <Sparkles size={16} className="text-yellow-500 fill-yellow-500" />
                  </div>
                  <div>
                    <h4 className="font-display font-extrabold text-[#2c2a29] text-sm sm:text-base">Interactive Print Product Mockup</h4>
                    <p className="text-[10px] sm:text-xs text-[#7c756d]">See how your print product will look in real-world settings before ordering.</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowMockupModal(false)}
                  className="p-1.5 rounded-full bg-gray-100 hover:bg-gray-200 text-[#2c2a29] transition-colors cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Modal Body: Left is preview container, Right is controls/details */}
              <div className="flex-1 overflow-y-auto grid md:grid-cols-12">
                {/* Visual Preview Window (7 columns) */}
                <div className={`md:col-span-7 p-6 sm:p-10 flex flex-col items-center justify-center relative min-h-[300px] sm:min-h-[420px] transition-colors duration-500 ${
                  backdrop === "neutral" ? "bg-[#f4f3ef]" :
                  backdrop === "cozy" ? "bg-[#18181b]" :
                  backdrop === "gallery" ? "bg-gradient-to-b from-[#1c1917] to-[#0c0a09] border-t-8 border-stone-800" :
                  "bg-gradient-to-b from-[#f5f5f4] to-[#e7e5e4] border-b-8 border-stone-300"
                }`}>
                  {/* Backdrop lighting helper/indicator label */}
                  <span className={`absolute top-3 left-3 text-[9px] uppercase font-bold px-2 py-0.5 rounded tracking-wider ${
                    backdrop === "neutral" || backdrop === "easel" ? "bg-black/5 text-[#7c756d]" : "bg-white/5 text-gray-400"
                  }`}>
                    {backdrop === "neutral" && "Backdrop: Sand Wall"}
                    {backdrop === "cozy" && "Backdrop: Charcoal Living Room"}
                    {backdrop === "gallery" && "Backdrop: Spotlight Gallery"}
                    {backdrop === "easel" && "Backdrop: White Easel"}
                  </span>

                  {/* The actual product mockup structure */}
                  <motion.div 
                    layout
                    className={`relative transition-all duration-300 flex items-center justify-center max-w-[85%] max-h-[85%] ${
                      frameStyle === "oak" ? "border-[12px] sm:border-[16px] border-[#b48a53] shadow-2xl ring-1 ring-[#926c3d]" :
                      frameStyle === "black" ? "border-[12px] sm:border-[16px] border-[#18181b] shadow-2xl ring-1 ring-black" :
                      frameStyle === "gold" ? "border-[12px] sm:border-[16px] border-[#d4af37] shadow-2xl ring-1 ring-[#b2932a]" :
                      "border border-gray-200/50 shadow-lg bg-white p-1" // canvas/frameless
                    }`}
                    style={{
                      aspectRatio: "4/3",
                      width: "360px",
                    }}
                  >
                    {/* Inner wood bevel / shadow style for realism */}
                    {frameStyle !== "frameless" && (
                      <div className="absolute inset-0 border border-black/20 pointer-events-none z-10" />
                    )}

                    {/* White Matting layer around photo (adds high class frame look) */}
                    <div className={`w-full h-full flex items-center justify-center transition-all ${
                      frameStyle !== "frameless" 
                        ? "p-4 sm:p-6 bg-[#faf9f6] border border-gray-200 shadow-inner" 
                        : "p-0 bg-transparent"
                    }`}>
                      <div className="w-full h-full relative overflow-hidden bg-[#e5e1da]">
                        <img 
                          src={uploadedPhoto} 
                          alt="Product Mockup Preview" 
                          referrerPolicy="no-referrer"
                          className={`w-full h-full transition-all duration-300 ${
                            scaleMode === "fit" ? "object-contain" : "object-cover"
                          }`}
                        />

                        {/* Glossy lighting reflection glare overlay */}
                        {matteFinish === "glossy" && (
                          <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/5 to-white/35 pointer-events-none mix-blend-overlay" />
                        )}

                        {/* Matte texture finish overlay */}
                        {matteFinish === "matte" && (
                          <div className="absolute inset-0 bg-white/5 pointer-events-none mix-blend-overlay backdrop-contrast-[0.97]" />
                        )}

                        {/* Subtle print overlay watermark or grain */}
                        <div className="absolute inset-0 bg-black/[0.02] pointer-events-none" />
                      </div>
                    </div>

                    {/* Canvas perspective border if frameless */}
                    {frameStyle === "frameless" && (
                      <div className="absolute inset-y-0 -right-2 w-2 bg-gray-300 origin-left transform skew-y-12 shadow-md border-r border-gray-400" />
                    )}
                  </motion.div>

                  {/* Studio physical shadows reflection base */}
                  {backdrop === "easel" && (
                    <div className="absolute bottom-4 w-40 h-2 bg-stone-400/20 blur-[2px] rounded-full" />
                  )}
                </div>

                {/* Mockup Configuration panel (5 columns) */}
                <div className="md:col-span-5 p-5 sm:p-6 border-t md:border-t-0 md:border-l border-gray-100 flex flex-col justify-between bg-white space-y-4">
                  <div className="space-y-4">
                    {/* Selected product stats info */}
                    <div className="space-y-1.5">
                      <span className="text-[10px] font-bold text-[#7c756d] uppercase tracking-wider">Currently Mocking</span>
                      <h5 className="font-display font-extrabold text-[#2c2a29] text-sm leading-snug">{selectedProduct?.name}</h5>
                      <p className="text-[11px] text-[#7c756d] leading-relaxed line-clamp-2">{selectedProduct?.description}</p>
                      
                      <div className="grid grid-cols-2 gap-2 pt-1 text-[11px] text-[#2c2a29]">
                        <div className="p-2 bg-[#faf9f6] border border-[#e5e1da] rounded-xl">
                          <span className="text-[9px] text-[#7c756d] block font-semibold uppercase">Dimensions</span>
                          <span className="font-bold">{selectedProduct?.size}</span>
                        </div>
                        <div className="p-2 bg-[#faf9f6] border border-[#e5e1da] rounded-xl">
                          <span className="text-[9px] text-[#7c756d] block font-semibold uppercase">Est. Printing</span>
                          <span className="font-bold">{selectedProduct?.estimatedHours} Hours</span>
                        </div>
                      </div>
                    </div>

                    {/* Frame style toggles */}
                    <div className="space-y-1.5 border-t border-gray-100 pt-3">
                      <label className="block text-[10px] font-bold uppercase text-[#7c756d] tracking-wider">1. Border / Frame Style</label>
                      <div className="grid grid-cols-2 gap-1.5 text-xs">
                        {[
                          { id: "black", name: "Charcoal Black" },
                          { id: "oak", name: "Classic Oak Wood" },
                          { id: "gold", name: "Brushed Gold" },
                          { id: "frameless", name: "Frameless Canvas" }
                        ].map((style) => (
                          <button
                            key={style.id}
                            type="button"
                            onClick={() => { setFrameStyle(style.id as any); setDesignConfirmed(false); }}
                            disabled={!!successMsg}
                            className={`p-1.5 rounded-xl border text-left font-bold text-[10px] sm:text-[11px] transition-all cursor-pointer ${
                              frameStyle === style.id 
                                ? "border-[#2c2a29] bg-[#faf9f6] text-[#2c2a29]" 
                                : "border-[#e5e1da] bg-white text-[#7c756d] hover:text-[#2c2a29]"
                            }`}
                          >
                            {style.name}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Matte finishes */}
                    <div className="space-y-1.5">
                      <label className="block text-[10px] font-bold uppercase text-[#7c756d] tracking-wider">2. Photopaper Sheen</label>
                      <div className="grid grid-cols-2 gap-1.5 text-xs">
                        {[
                          { id: "glossy", name: "Glossy Reflection" },
                          { id: "matte", name: "Matte Fine Art" }
                        ].map((finish) => (
                          <button
                            key={finish.id}
                            type="button"
                            onClick={() => { setMatteFinish(finish.id as any); setDesignConfirmed(false); }}
                            disabled={!!successMsg}
                            className={`p-1.5 rounded-xl border text-left font-bold text-[10px] sm:text-[11px] transition-all cursor-pointer ${
                              matteFinish === finish.id 
                                ? "border-[#2c2a29] bg-[#faf9f6] text-[#2c2a29]" 
                                : "border-[#e5e1da] bg-white text-[#7c756d] hover:text-[#2c2a29]"
                            }`}
                          >
                            {finish.name}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Backdrop Environments */}
                    <div className="space-y-1.5">
                      <label className="block text-[10px] font-bold uppercase text-[#7c756d] tracking-wider">3. Backdrop Environment</label>
                      <div className="grid grid-cols-2 gap-1.5 text-xs">
                        {[
                          { id: "neutral", name: "Sand Wall" },
                          { id: "cozy", name: "Deep Charcoal" },
                          { id: "gallery", name: "Spotlight Gallery" },
                          { id: "easel", name: "Easel Stand" }
                        ].map((b) => (
                          <button
                            key={b.id}
                            type="button"
                            onClick={() => { setBackdrop(b.id as any); setDesignConfirmed(false); }}
                            disabled={!!successMsg}
                            className={`p-1.5 rounded-xl border text-left font-bold text-[10px] sm:text-[11px] transition-all cursor-pointer ${
                              backdrop === b.id 
                                ? "border-[#2c2a29] bg-[#faf9f6] text-[#2c2a29]" 
                                : "border-[#e5e1da] bg-white text-[#7c756d] hover:text-[#2c2a29]"
                            }`}
                          >
                            {b.name}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Scale Mode Toggle */}
                    <div className="space-y-1.5">
                      <label className="block text-[10px] font-bold uppercase text-[#7c756d] tracking-wider">4. Image Scaling / Crop</label>
                      <div className="grid grid-cols-2 gap-1.5 text-xs">
                        {[
                          { id: "fit", name: "Fit (Letterbox)" },
                          { id: "fill", name: "Fill (Full Bleed)" }
                        ].map((mode) => (
                          <button
                            key={mode.id}
                            type="button"
                            onClick={() => { setScaleMode(mode.id as any); setDesignConfirmed(false); }}
                            disabled={!!successMsg}
                            className={`p-1.5 rounded-xl border text-left font-bold text-[10px] sm:text-[11px] transition-all cursor-pointer ${
                              scaleMode === mode.id 
                                ? "border-[#2c2a29] bg-[#faf9f6] text-[#2c2a29]" 
                                : "border-[#e5e1da] bg-white text-[#7c756d] hover:text-[#2c2a29]"
                            }`}
                          >
                            {mode.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="border-t border-gray-100 pt-3 flex gap-2">
                    <button
                      type="button"
                      onClick={() => setShowMockupModal(false)}
                      className="flex-1 py-2 text-[#2c2a29] border border-[#e5e1da] hover:bg-gray-50 text-xs font-bold rounded-full text-center transition-all cursor-pointer"
                    >
                      Back to Design
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setDesignConfirmed(true);
                        setShowMockupModal(false);
                      }}
                      disabled={!!successMsg}
                      className="flex-1 py-2 bg-[#2c2a29] hover:bg-[#4a4644] text-[#faf9f6] text-xs font-bold rounded-full text-center transition-all cursor-pointer shadow-sm"
                    >
                      Looks Perfect!
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
