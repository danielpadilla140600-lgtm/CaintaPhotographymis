import React, { useState } from "react";
import { CheckCircle, KeyRound, Save, ShieldAlert, UserRound } from "lucide-react";
import { apiRequest, ApiError } from "../utils/apiClient.ts";

interface AccountSettingsProps {
  currentUser: any;
  onUserUpdated: (user: any) => void;
}

export default function AccountSettings({ currentUser, onUserUpdated }: AccountSettingsProps) {
  const safeUser = currentUser || {} as any;
  const [fullName, setFullName] = useState(safeUser.fullName || "");
  const [email, setEmail] = useState(safeUser.email || "");
  const [contactNumber, setContactNumber] = useState(safeUser.contactNumber || "");
  const [address, setAddress] = useState(safeUser.address || "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState<{ text: string; success: boolean } | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setMessage(null);
    if (newPassword && newPassword !== confirmPassword) {
      setMessage({ text: "New password and confirmation do not match.", success: false });
      return;
    }
    setLoading(true);
    try {
      const data = await apiRequest("/api/auth/account", {
        method: "PUT",
        body: { fullName, email, contactNumber, address, currentPassword, newPassword }
      });
      onUserUpdated(data.user);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setMessage({ text: "Account details updated successfully.", success: true });
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Failed to connect to the server.";
      setMessage({ text: msg || "Unable to update account.", success: false });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10 text-left">
      <div className="bg-white border border-[#e5e1da] rounded-3xl shadow-sm p-6 sm:p-10 space-y-8">
        <div className="flex items-center gap-3 border-b border-[#e5e1da] pb-5">
          <div className="w-11 h-11 rounded-2xl bg-[#2c2a29] text-yellow-400 flex items-center justify-center"><UserRound size={21} /></div>
          <div>
            <h2 className="font-display text-2xl font-extrabold text-[#2c2a29]">My Account</h2>
            <p className="text-xs text-[#7c756d]">Update your personal details and login credentials.</p>
          </div>
        </div>

        {message && <div className={`${message.success ? "bg-green-50 text-green-800 border-green-200" : "bg-red-50 text-red-800 border-red-200"} p-3 rounded-xl border text-xs font-bold flex items-center gap-2`}>
          {message.success ? <CheckCircle size={16} /> : <ShieldAlert size={16} />}{message.text}
        </div>}

        <form onSubmit={handleSubmit} className="space-y-7">
          <section className="space-y-4">
            <h3 className="font-bold text-sm text-[#2c2a29]">Profile Details</h3>
            <div className="grid sm:grid-cols-2 gap-4 text-xs">
              <label className="space-y-1 font-bold text-[#2c2a29]">Full Name<input required value={fullName} onChange={event => setFullName(event.target.value)} className="w-full mt-1 bg-[#faf9f6] border border-[#e5e1da] rounded-xl px-3 py-2.5 font-normal focus:outline-none focus:border-[#2c2a29]" /></label>
              <label className="space-y-1 font-bold text-[#2c2a29]">Email Address<input required type="email" value={email} onChange={event => setEmail(event.target.value)} className="w-full mt-1 bg-[#faf9f6] border border-[#e5e1da] rounded-xl px-3 py-2.5 font-normal focus:outline-none focus:border-[#2c2a29]" /></label>
              <label className="space-y-1 font-bold text-[#2c2a29]">Contact Number<input value={contactNumber} onChange={event => setContactNumber(event.target.value)} className="w-full mt-1 bg-[#faf9f6] border border-[#e5e1da] rounded-xl px-3 py-2.5 font-normal focus:outline-none focus:border-[#2c2a29]" /></label>
              <label className="space-y-1 font-bold text-[#2c2a29]">Address<input value={address} onChange={event => setAddress(event.target.value)} className="w-full mt-1 bg-[#faf9f6] border border-[#e5e1da] rounded-xl px-3 py-2.5 font-normal focus:outline-none focus:border-[#2c2a29]" /></label>
            </div>
          </section>

          <section className="space-y-4 border-t border-[#e5e1da] pt-7">
            <div><h3 className="font-bold text-sm text-[#2c2a29] flex items-center gap-2"><KeyRound size={16} /> Change Password</h3><p className="text-[11px] text-[#7c756d] mt-1">Leave the new password fields blank to keep your current password.</p></div>
            <div className="grid sm:grid-cols-3 gap-4 text-xs">
              <label className="space-y-1 font-bold text-[#2c2a29] sm:col-span-3">Current Password<input type="password" value={currentPassword} onChange={event => setCurrentPassword(event.target.value)} className="w-full mt-1 bg-[#faf9f6] border border-[#e5e1da] rounded-xl px-3 py-2.5 font-normal focus:outline-none focus:border-[#2c2a29]" /></label>
              <label className="space-y-1 font-bold text-[#2c2a29]">New Password<input type="password" minLength={6} value={newPassword} onChange={event => setNewPassword(event.target.value)} className="w-full mt-1 bg-[#faf9f6] border border-[#e5e1da] rounded-xl px-3 py-2.5 font-normal focus:outline-none focus:border-[#2c2a29]" /></label>
              <label className="space-y-1 font-bold text-[#2c2a29] sm:col-span-2">Confirm New Password<input type="password" minLength={6} value={confirmPassword} onChange={event => setConfirmPassword(event.target.value)} className="w-full mt-1 bg-[#faf9f6] border border-[#e5e1da] rounded-xl px-3 py-2.5 font-normal focus:outline-none focus:border-[#2c2a29]" /></label>
            </div>
          </section>

          <button type="submit" disabled={loading} className="w-full sm:w-auto px-5 py-3 bg-[#2c2a29] hover:bg-[#4a4644] text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"><Save size={15} />{loading ? "Saving..." : "Save Account Changes"}</button>
        </form>
      </div>
    </div>
  );
}
