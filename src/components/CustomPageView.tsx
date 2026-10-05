import React from "react";
import { CustomPage, PageBlock } from "../db/types.ts";
import { Sparkles, ArrowRight, CheckCircle2, HelpCircle } from "lucide-react";
import { motion } from "motion/react";

interface CustomPageViewProps {
  page: CustomPage;
  onNavigate: (page: string) => void;
}

export default function CustomPageView({ page, onNavigate }: CustomPageViewProps) {
  return (
    <div className="min-h-screen bg-[#faf9f6] pb-24">
      {/* Header Banner */}
      <div className="bg-[#2c2a29] text-white py-16 px-4 text-center relative overflow-hidden">
        <div className="absolute inset-0 opacity-15 bg-[radial-gradient(#e5e1da_1px,transparent_1px)] [background-size:16px_16px]"></div>
        <div className="max-w-4xl mx-auto relative z-10 space-y-4">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest bg-yellow-500/20 text-yellow-400 border border-yellow-500/30">
            <Sparkles size={13} /> Cainta MIS Custom Page
          </span>
          <h1 className="font-display text-3xl sm:text-5xl font-bold tracking-tight text-white">
            {page.title}
          </h1>
          <p className="text-sm sm:text-base text-gray-300 max-w-2xl mx-auto font-medium">
            Published on {new Date(page.createdAt).toLocaleDateString()}
          </p>
        </div>
      </div>

      {/* Page Blocks Renderer */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-16">
        {page.blocks && page.blocks.length > 0 ? (
          page.blocks.map((block, index) => (
            <motion.div
              key={block.id || index}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              {renderBlock(block, onNavigate)}
            </motion.div>
          ))
        ) : (
          <div className="text-center py-20 bg-white rounded-3xl border border-[#e5e1da] shadow-sm p-8">
            <p className="text-gray-500 text-sm font-medium">This custom page has no content blocks yet.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function renderBlock(block: PageBlock, onNavigate: (page: string) => void) {
  switch (block.type) {
    case "hero":
      return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center bg-white rounded-3xl p-8 sm:p-12 border border-[#e5e1da] shadow-sm">
          <div className="space-y-6 text-left">
            <h2 className="font-display text-2xl sm:text-4xl font-bold text-[#2c2a29] leading-tight">
              {block.title}
            </h2>
            <p className="text-[#7c756d] text-sm sm:text-base leading-relaxed">
              {block.content}
            </p>
            {block.buttonText && (
              <button
                onClick={() => block.buttonLink && onNavigate(block.buttonLink)}
                className="inline-flex items-center gap-2 px-6 py-3 bg-[#2c2a29] hover:bg-yellow-500 hover:text-black text-white rounded-xl text-xs sm:text-sm font-bold shadow-md transition-all cursor-pointer"
              >
                {block.buttonText} <ArrowRight size={16} />
              </button>
            )}
          </div>
          {block.imageUrl && (
            <div className="rounded-2xl overflow-hidden shadow-md aspect-video md:aspect-square">
              <img src={block.imageUrl} alt={block.title || "Hero banner"} className="w-full h-full object-cover" />
            </div>
          )}
        </div>
      );

    case "text":
      return (
        <div className="bg-white rounded-3xl p-8 sm:p-12 border border-[#e5e1da] shadow-sm text-left space-y-4">
          {block.title && (
            <h3 className="font-display text-xl sm:text-2xl font-bold text-[#2c2a29]">
              {block.title}
            </h3>
          )}
          <div className="text-[#7c756d] text-sm sm:text-base leading-relaxed whitespace-pre-line font-normal">
            {block.content}
          </div>
        </div>
      );

    case "gallery":
      return (
        <div className="space-y-6 text-left">
          {block.title && (
            <h3 className="font-display text-xl sm:text-2xl font-bold text-[#2c2a29]">
              {block.title}
            </h3>
          )}
          {block.content && <p className="text-sm text-[#7c756d]">{block.content}</p>}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {block.items?.map((item, i) => (
              <div key={i} className="bg-white rounded-2xl overflow-hidden border border-[#e5e1da] shadow-sm flex flex-col">
                {item.image && (
                  <div className="aspect-video overflow-hidden bg-gray-100">
                    <img src={item.image} alt={item.title} className="w-full h-full object-cover hover:scale-105 transition-transform duration-300" />
                  </div>
                )}
                <div className="p-5 flex-1 flex flex-col justify-between space-y-2">
                  <h4 className="font-display font-bold text-base text-[#2c2a29]">{item.title}</h4>
                  <p className="text-xs text-[#7c756d] leading-relaxed">{item.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      );

    case "faq":
      return (
        <div className="bg-white rounded-3xl p-8 sm:p-10 border border-[#e5e1da] shadow-sm space-y-6 text-left">
          {block.title && (
            <div className="flex items-center gap-2">
              <HelpCircle className="text-yellow-600" size={24} />
              <h3 className="font-display text-xl sm:text-2xl font-bold text-[#2c2a29]">{block.title}</h3>
            </div>
          )}
          <div className="space-y-4">
            {block.items?.map((faq, i) => (
              <div key={i} className="p-4 rounded-xl bg-[#faf9f6] border border-[#e5e1da] space-y-1">
                <h4 className="font-bold text-sm text-[#2c2a29]">{faq.title}</h4>
                <p className="text-xs text-[#7c756d] leading-relaxed">{faq.description}</p>
              </div>
            ))}
          </div>
        </div>
      );

    case "pricing":
      return (
        <div className="space-y-6 text-left">
          {block.title && (
            <h3 className="font-display text-xl sm:text-2xl font-bold text-[#2c2a29] text-center">{block.title}</h3>
          )}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {block.items?.map((pkg, i) => (
              <div key={i} className="bg-white rounded-3xl p-6 border border-[#e5e1da] shadow-sm flex flex-col justify-between space-y-4">
                <div className="space-y-2">
                  <h4 className="font-display font-bold text-lg text-[#2c2a29]">{pkg.title}</h4>
                  <p className="text-xs text-[#7c756d]">{pkg.description}</p>
                </div>
                {pkg.price && (
                  <div className="pt-4 border-t border-gray-100 flex items-baseline justify-between">
                    <span className="text-2xl font-bold font-display text-[#2c2a29]">{pkg.price}</span>
                    <span className="text-[10px] uppercase font-bold text-yellow-700 bg-yellow-50 px-2.5 py-1 rounded-full">Standard Rate</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      );

    case "cta":
      return (
        <div className="bg-gradient-to-r from-[#2c2a29] to-[#4a4644] text-white rounded-3xl p-8 sm:p-12 text-center space-y-6 shadow-xl relative overflow-hidden">
          <div className="max-w-2xl mx-auto space-y-4 relative z-10">
            <h3 className="font-display text-2xl sm:text-3xl font-bold">{block.title || "Ready to get started?"}</h3>
            <p className="text-sm text-gray-300">{block.content}</p>
            {block.buttonText && (
              <button
                onClick={() => block.buttonLink && onNavigate(block.buttonLink)}
                className="px-8 py-3.5 bg-yellow-500 hover:bg-yellow-400 text-black font-bold rounded-xl shadow-lg transition-transform hover:scale-105 cursor-pointer text-sm"
              >
                {block.buttonText}
              </button>
            )}
          </div>
        </div>
      );

    default:
      return null;
  }
}
