import React, { useState, useEffect, useRef } from "react";
import { Music, Play, Pause, Volume2, Upload, CheckCircle2, Sparkles, Disc } from "lucide-react";
import { SoundEngine } from "../utils/soundEffects.ts";

interface CustomAudioPlayerProps {
  audioUrl: string;
  enabled: boolean;
  onAudioChange: (audioUrl: string) => void;
  onEnabledChange: (enabled: boolean) => void;
}

export function CustomAudioPlayer({ audioUrl, enabled, onAudioChange, onEnabledChange }: CustomAudioPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [fileName, setFileName] = useState<string>("");
  const [volume, setVolume] = useState(0.8);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const activeUrl = audioUrl || "/Cainta Photography Studio.mp3";
    setFileName(audioUrl ? "Custom User Audio (Saved)" : "Cainta Photography Studio.mp3");
    audioRef.current?.pause();
    audioRef.current = new Audio(activeUrl);
    audioRef.current.volume = 0.8;
    audioRef.current.onended = () => setIsPlaying(false);
    return () => audioRef.current?.pause();
  }, [audioUrl]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume;
  }, [volume]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      if (base64) {
        onAudioChange(base64);
        if (audioRef.current) {
          audioRef.current.pause();
        }
        audioRef.current = new Audio(base64);
        audioRef.current.volume = volume;
        audioRef.current.onended = () => setIsPlaying(false);
        
        // Play automatically once uploaded
        audioRef.current.play().then(() => {
          setIsPlaying(true);
        }).catch(err => {
          console.warn("Autoplay blocked:", err);
        });

        SoundEngine.playSuccess();
      }
    };
    reader.readAsDataURL(file);
  };

  const togglePlay = () => {
    if (!audioRef.current && audioUrl) {
      audioRef.current = new Audio(audioUrl);
      audioRef.current.volume = volume;
      audioRef.current.onended = () => setIsPlaying(false);
    }

    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.currentTime = 0;
      audioRef.current.play().then(() => {
        setIsPlaying(true);
      }).catch(err => {
        console.error("Playback failed:", err);
      });
    }
  };

  const handleVolumeChange = (newVol: number) => {
    setVolume(newVol);
    if (audioRef.current) {
      audioRef.current.volume = newVol;
    }
  };

  return (
    <div className="bg-white border border-[#e5e1da] rounded-2xl p-5 shadow-sm space-y-4 text-left">
      <div className="flex items-center justify-between border-b border-gray-100 pb-3">
        <h3 className="font-display font-bold text-sm text-[#2c2a29] flex items-center gap-2">
          <Disc size={18} className="text-yellow-600 animate-spin" style={{ animationDuration: isPlaying ? '3s' : '0s' }} />
          System Background Audio
        </h3>
        <span className="text-[10px] font-bold px-2.5 py-1 bg-yellow-50 text-yellow-800 rounded-full border border-yellow-200 flex items-center gap-1">
          <Sparkles size={11} /> Super Admin Control
        </span>
      </div>

      <p className="text-xs text-gray-600 leading-relaxed">
        Upload one approved background sound for the whole MIS. Staff, customers, and studio owners can only hear the configured sound.
      </p>

      <label className="flex items-center justify-between p-3 bg-[#faf9f6] border border-[#e5e1da] rounded-xl text-xs font-bold text-[#2c2a29]">
        <span>Allow system background audio</span>
        <input
          type="checkbox"
          checked={enabled}
          onChange={e => onEnabledChange(e.target.checked)}
          className="w-4 h-4 accent-yellow-600 cursor-pointer"
        />
      </label>

      {audioUrl ? (
        <div className="space-y-3 bg-[#faf9f6] p-3.5 rounded-xl border border-[#e5e1da]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={togglePlay}
                className="w-10 h-10 rounded-full bg-[#2c2a29] text-yellow-400 hover:bg-yellow-500 hover:text-black transition-all flex items-center justify-center shadow-md cursor-pointer"
              >
                {isPlaying ? <Pause size={18} /> : <Play size={18} className="ml-0.5" />}
              </button>
              <div>
                <p className="text-xs font-bold text-[#2c2a29] flex items-center gap-1">
                  <CheckCircle2 size={13} className="text-emerald-600" /> {fileName || "Custom Audio File Loaded"}
                </p>
                <p className="text-[10px] text-gray-400">Ready for studio welcome theme & playback</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Volume2 size={15} className="text-gray-400" />
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={volume}
                onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                className="w-20 accent-yellow-600 cursor-pointer"
              />
            </div>
          </div>
        </div>
      ) : (
        <div className="border-2 border-dashed border-[#e5e1da] rounded-xl p-5 text-center bg-[#faf9f6] hover:bg-yellow-50/40 transition-colors">
          <label className="cursor-pointer space-y-2 block">
            <div className="w-10 h-10 rounded-full bg-white border border-[#e5e1da] text-yellow-600 flex items-center justify-center mx-auto shadow-sm">
              <Upload size={18} />
            </div>
            <div>
              <p className="text-xs font-bold text-[#2c2a29]">Upload Your Custom Audio File</p>
              <p className="text-[10px] text-gray-400">Supports MP3, WAV, M4A, OGG</p>
            </div>
            <input
              type="file"
              accept="audio/*"
              onChange={handleFileUpload}
              className="hidden"
            />
          </label>
        </div>
      )}

      {audioUrl && (
        <div className="flex justify-end pt-1">
          <label className="text-[11px] text-yellow-800 font-bold hover:underline cursor-pointer flex items-center gap-1">
            <Upload size={12} /> Upload a different audio file
            <input
              type="file"
              accept="audio/*"
              onChange={handleFileUpload}
              className="hidden"
            />
          </label>
        </div>
      )}
    </div>
  );
}
