import React, { useState } from 'react';
import { User } from '../types';

interface ERepositoryUploadProps {
  user: User;
  onUploadSuccess?: () => void;
  onOpenLibraryPage?: () => void;
}

const ERepositoryUpload: React.FC<ERepositoryUploadProps> = ({ user, onUploadSuccess, onOpenLibraryPage }) => {
  const [tab, setTab] = useState<'UPLOAD' | 'MY_UPLOADS'>('UPLOAD');
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState<string | null>(null);

  return (
    <div className="bg-white rounded-2xl border border-[#eddde0] p-5">
      <h3 className="text-xl font-black text-[#1a0208]">E-Library Manager</h3>
      <p className="text-xs text-[#9a7880] mt-1">Logged in as {user.name}. Manage repository uploads here.</p>

      <div className="mt-4 flex gap-2">
        <button
          onClick={() => setTab('UPLOAD')}
          className={`px-4 py-2 rounded-lg text-[11px] font-black uppercase tracking-widest ${tab === 'UPLOAD' ? 'bg-[#3d0413] text-white' : 'bg-[#fdf2f4] text-[#3d0413]'}`}
        >
          Upload
        </button>
        <button
          onClick={() => setTab('MY_UPLOADS')}
          className={`px-4 py-2 rounded-lg text-[11px] font-black uppercase tracking-widest ${tab === 'MY_UPLOADS' ? 'bg-[#3d0413] text-white' : 'bg-[#fdf2f4] text-[#3d0413]'}`}
        >
          My Uploads
        </button>
        {onOpenLibraryPage && (
          <button
            onClick={onOpenLibraryPage}
            className="px-4 py-2 rounded-lg text-[11px] font-black uppercase tracking-widest bg-[#fdf2f4] text-[#3d0413] hover:bg-[#fbeaec]"
          >
            Open Library Page
          </button>
        )}
      </div>

      {message && (
        <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-800">
          {message}
        </div>
      )}

      {tab === 'UPLOAD' ? (
        <form
          className="mt-4 space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (!title.trim()) return;
            setMessage(`✅ ${title} has been queued for E-Repository upload.`);
            setTitle('');
            onUploadSuccess?.();
          }}
        >
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Material title"
            className="w-full rounded-lg border border-[#eddde0] px-3 py-2 text-sm"
          />
          <button className="px-4 py-2 rounded-lg bg-[#3d0413] text-white text-xs font-black uppercase tracking-widest">
            Upload to E-Repository
          </button>
        </form>
      ) : (
        <div className="mt-4 rounded-lg border border-dashed border-[#ddb8bf] p-4 text-sm text-[#9a7880]">
          My Uploads list appears here.
        </div>
      )}
    </div>
  );
};

export default ERepositoryUpload;
