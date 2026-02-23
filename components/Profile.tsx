import React, { useState, useEffect } from 'react';
import { User } from '../types';
import { DEPARTMENTS } from '../constants';
import { getStoredProfile, saveStoredProfile, DEFAULT_PROFILE } from '../lib/profile';
import { User as UserIcon, Hash, Smartphone, BookOpen, Building2, Calendar, Cake, Camera, Save, CheckCircle2 } from 'lucide-react';

interface ProfileProps {
  user: User;
  onSaved?: () => void;
}

const Profile: React.FC<ProfileProps> = ({ user, onSaved }) => {
  const [profile, setProfile] = useState(() => getStoredProfile(user.id) || { ...DEFAULT_PROFILE, fullName: user.name || '' });
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const p = getStoredProfile(user.id);
    if (p) setProfile(p);
    else setProfile((prev) => ({ ...DEFAULT_PROFILE, ...prev, fullName: user.name || prev.fullName }));
  }, [user.id, user.name]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    saveStoredProfile(user.id, profile);
    setSaved(true);
    onSaved?.();
    setTimeout(() => setSaved(false), 2000);
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setProfile((p) => ({ ...p, photoDataUrl: reader.result as string }));
    reader.readAsDataURL(file);
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 sm:py-12">
      <h1 className="text-3xl sm:text-4xl font-black text-slate-900 uppercase tracking-tight mb-2">My Profile</h1>
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.35em] mb-8">
        Fill once – the system will use this for registration, live class participants, and forms.
      </p>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="flex flex-col sm:flex-row gap-8 items-start">
          <div className="flex flex-col items-center gap-3">
            <label className="block w-28 h-28 rounded-2xl overflow-hidden bg-slate-100 border-2 border-dashed border-slate-200 cursor-pointer hover:border-[#3d0413] transition-colors">
              <input type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
              {profile.photoDataUrl ? (
                <img src={profile.photoDataUrl} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center text-slate-400">
                  <Camera className="w-10 h-10 mb-1" />
                  <span className="text-[9px] font-black uppercase">Photo</span>
                </div>
              )}
            </label>
            <span className="text-[9px] font-black text-slate-400 uppercase">Profile photo</span>
          </div>

          <div className="flex-1 space-y-4 w-full">
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2 flex items-center gap-2 mb-1"><UserIcon size={12} /> Full Legal Name</label>
              <input type="text" value={profile.fullName} onChange={(e) => setProfile((p) => ({ ...p, fullName: e.target.value }))} placeholder="Enter your full name" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-[#3d0413]/20" />
            </div>
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2 flex items-center gap-2 mb-1"><Hash size={12} /> School Registry ID</label>
              <input type="text" value={profile.schoolRegistryId} onChange={(e) => setProfile((p) => ({ ...p, schoolRegistryId: e.target.value }))} placeholder="e.g. EE/001/2024" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-[#3d0413]/20" />
            </div>
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2 flex items-center gap-2 mb-1"><Smartphone size={12} /> Phone Number</label>
              <input type="tel" value={profile.phone} onChange={(e) => setProfile((p) => ({ ...p, phone: e.target.value }))} placeholder="+254 7XX XXX XXX" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-[#3d0413]/20" />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2 flex items-center gap-2 mb-1">Gender</label>
            <select value={profile.gender} onChange={(e) => setProfile((p) => ({ ...p, gender: e.target.value }))} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-[#3d0413]/20">
              <option value="">Select</option>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
              <option value="Other">Other</option>
            </select>
          </div>
          <div>
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2 flex items-center gap-2 mb-1"><BookOpen size={12} /> Class</label>
            <input type="text" value={profile.class} onChange={(e) => setProfile((p) => ({ ...p, class: e.target.value }))} placeholder="e.g. Year 2 Electrical" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-[#3d0413]/20" />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2 flex items-center gap-2 mb-1"><Building2 size={12} /> Department</label>
            <select value={profile.department} onChange={(e) => setProfile((p) => ({ ...p, department: e.target.value }))} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-[#3d0413]/20">
              <option value="">Select department</option>
              {DEPARTMENTS.map((d) => (
                <option key={d.id} value={d.name}>{d.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2 flex items-center gap-2 mb-1"><Calendar size={12} /> Year</label>
            <select value={profile.year} onChange={(e) => setProfile((p) => ({ ...p, year: e.target.value }))} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-[#3d0413]/20">
              <option value="">Select year</option>
              {[1, 2, 3, 4, 5].map((y) => (
                <option key={y} value={String(y)}>Year {y}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2 flex items-center gap-2 mb-1"><Cake size={12} /> Age</label>
          <input type="text" inputMode="numeric" value={profile.age} onChange={(e) => setProfile((p) => ({ ...p, age: e.target.value }))} placeholder="e.g. 20" className="w-full max-w-[120px] px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-[#3d0413]/20" />
        </div>

        <button type="submit" className="flex items-center gap-3 px-8 py-4 bg-[#3d0413] text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl hover:bg-[#5a061c] transition-all">
          {saved ? <CheckCircle2 size={20} /> : <Save size={20} />}
          {saved ? 'Saved' : 'Save profile'}
        </button>
      </form>
    </div>
  );
};

export default Profile;
