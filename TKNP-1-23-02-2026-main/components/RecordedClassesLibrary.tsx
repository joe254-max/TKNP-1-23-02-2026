import React, { useState, useEffect } from 'react';
import { getAllRecordings, type RecordedSession } from '../lib/recordingsDb';
import { Play, FileDown, X, Clock, User, Search } from 'lucide-react';

const RecordedClassesLibrary: React.FC = () => {
  const [recordings, setRecordings] = useState<RecordedSession[]>([]);
  const [search, setSearch] = useState('');
  const [playing, setPlaying] = useState<RecordedSession | null>(null);
  const [playingUrl, setPlayingUrl] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    getAllRecordings().then((list) => {
      if (mounted) setRecordings(list);
    });
    return () => { mounted = false; };
  }, []);

  const filtered = recordings.filter(
    (r) =>
      r.title.toLowerCase().includes(search.toLowerCase()) ||
      r.teacherName.toLowerCase().includes(search.toLowerCase())
  );

  const openWatch = (rec: RecordedSession) => {
    if (playingUrl) URL.revokeObjectURL(playingUrl);
    const url = URL.createObjectURL(rec.blob);
    setPlayingUrl(url);
    setPlaying(rec);
  };

  const closeWatch = () => {
    if (playingUrl) URL.revokeObjectURL(playingUrl);
    setPlayingUrl(null);
    setPlaying(null);
  };

  const handleDownload = (rec: RecordedSession) => {
    const url = URL.createObjectURL(rec.blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${rec.title.replace(/\s+/g, '-')}-${rec.date.slice(0, 10)}.webm`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const formatDuration = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl sm:text-4xl font-black text-slate-900 uppercase tracking-tight mb-2">Class Recordings</h1>
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.35em]">
          Watch or download past sessions. Updated when lecturers end a live class.
        </p>
      </div>

      <div className="relative mb-8 max-w-md">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
        <input
          type="text"
          placeholder="Search by class or teacher..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm font-bold outline-none focus:ring-2 focus:ring-[#3d0413]/20"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-20 bg-slate-50 rounded-[2rem] border-2 border-dashed border-slate-200">
          <div className="w-20 h-20 rounded-full bg-slate-200 flex items-center justify-center mx-auto mb-4">
            <Play className="w-10 h-10 text-slate-400" />
          </div>
          <p className="text-slate-500 font-bold">No recordings yet</p>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2">Recordings appear here after lecturers end a live class</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filtered.map((rec) => (
            <div
              key={rec.id}
              className="group bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300"
            >
              <button
                type="button"
                onClick={() => openWatch(rec)}
                className="relative block w-full aspect-video bg-slate-900 overflow-hidden"
              >
                <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-b from-slate-800 to-slate-900">
                  <div className="w-14 h-14 rounded-full bg-white/20 flex items-center justify-center group-hover:bg-[#3d0413] group-hover:scale-110 transition-all">
                    <Play className="w-7 h-7 text-white ml-1" fill="currentColor" />
                  </div>
                </div>
                <span className="absolute bottom-2 right-2 px-2 py-1 bg-black/70 text-white text-[10px] font-black rounded flex items-center gap-1">
                  <Clock size={10} /> {formatDuration(rec.durationSec)}
                </span>
              </button>
              <div className="p-4">
                <h3 className="font-black text-slate-900 text-sm uppercase tracking-tight line-clamp-2 mb-1">{rec.title}</h3>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider flex items-center gap-1">
                  <User size={10} /> {rec.teacherName}
                </p>
                <p className="text-[9px] text-slate-400 mt-1">{formatDate(rec.date)}</p>
                <div className="flex gap-2 mt-3">
                  <button
                    type="button"
                    onClick={() => openWatch(rec)}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-[#3d0413] text-white rounded-xl text-[10px] font-black uppercase"
                  >
                    <Play size={14} /> Watch
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDownload(rec)}
                    className="flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-100 text-slate-700 rounded-xl text-[10px] font-black uppercase hover:bg-slate-200"
                  >
                    <FileDown size={14} /> Download
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {playing && playingUrl && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-black/90" onClick={closeWatch}>
          <div className="relative w-full max-w-4xl bg-black rounded-2xl overflow-hidden shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <button type="button" onClick={closeWatch} className="absolute top-4 right-4 z-10 p-2 bg-white/10 rounded-full hover:bg-white/20">
              <X size={24} className="text-white" />
            </button>
            <video src={playingUrl} controls autoPlay className="w-full aspect-video" />
            <div className="p-4 bg-slate-900 text-white">
              <h3 className="font-black text-lg">{playing.title}</h3>
              <p className="text-sm text-slate-400">{playing.teacherName} · {formatDate(playing.date)} · {formatDuration(playing.durationSec)}</p>
              <button type="button" onClick={() => handleDownload(playing)} className="mt-3 flex items-center gap-2 px-4 py-2 bg-white/10 rounded-xl text-sm font-bold hover:bg-white/20">
                <FileDown size={16} /> Download
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RecordedClassesLibrary;
