import React, { useMemo, useState } from 'react';

interface ClassItem {
  id: string;
  title: string;
  teacher: string;
  room: string;
  schedule: string;
  grade?: number;
  attendance?: number;
}

interface Props {
  selectedClass: ClassItem;
  onBack: () => void;
}

type FileType = 'Notes' | 'Slides' | 'Past Paper' | 'Lab Sheet';

const FILE_TYPES: FileType[] = ['Notes', 'Slides', 'Past Paper', 'Lab Sheet'];

const seededFiles = Array.from({ length: 16 }).map((_, i) => {
  const week = (i % 10) + 1;
  const type = FILE_TYPES[i % FILE_TYPES.length];
  return {
    id: `file-${i + 1}`,
    name: `${type} - Topic ${i + 1}.pdf`,
    type,
    size: `${(Math.round(Math.random() * 900) + 100)} KB`,
    uploaded: new Date(Date.now() - (i * 86400000)).toISOString(),
    week,
  } as const;
});

const TypeIcon: React.FC<{ type: FileType }> = ({ type }) => {
  const common = 'inline-flex items-center justify-center h-8 w-8 rounded-md text-white';
  if (type === 'Notes') return <div className={common + ' bg-indigo-600'}>N</div>;
  if (type === 'Slides') return <div className={common + ' bg-rose-600'}>S</div>;
  if (type === 'Past Paper') return <div className={common + ' bg-emerald-600'}>P</div>;
  return <div className={common + ' bg-sky-600'}>L</div>;
};

const ClassMaterials: React.FC<Props> = ({ selectedClass, onBack }) => {
  const [activeFilter, setActiveFilter] = useState<'All' | FileType>('All');
  const [query, setQuery] = useState('');
  const [downloaded, setDownloaded] = useState<Record<string, boolean>>({});

  const filesByWeek = useMemo(() => {
    const filtered = seededFiles.filter((f) => (activeFilter === 'All' ? true : f.type === activeFilter) && f.name.toLowerCase().includes(query.toLowerCase()));
    const map = new Map<number, typeof seededFiles>();
    filtered.forEach((f) => {
      const arr = map.get(f.week) ?? [];
      arr.push(f);
      map.set(f.week, arr);
    });
    return Array.from(map.entries()).sort((a, b) => a[0] - b[0]);
  }, [activeFilter, query]);

  const summary = useMemo(() => {
    const total = seededFiles.length;
    const weeks = new Set(seededFiles.map((f) => f.week)).size;
    const downloadedCount = Object.values(downloaded).filter(Boolean).length;
    const pastPapers = seededFiles.filter((f) => f.type === 'Past Paper').length;
    return { total, weeks, downloadedCount, pastPapers };
  }, [downloaded]);

  return (
    <div className="min-h-screen p-6 bg-slate-50">
      <div className="max-w-6xl mx-auto">
        <button onClick={onBack} className="inline-flex items-center gap-3 text-slate-500 mb-6 text-[10px] font-black uppercase tracking-[0.35em]"><span>←</span> Back to Class</button>

        <div className="rounded-[2.5rem] bg-white border border-slate-200 p-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <p className="text-[9px] font-black uppercase tracking-[0.4em] text-slate-400">{selectedClass.title}</p>
              <h1 className="text-3xl font-black text-slate-900 mt-2">{selectedClass.title}</h1>
              <p className="text-sm text-slate-500 mt-2">{selectedClass.teacher} • {selectedClass.room}</p>
            </div>
            <div className="flex gap-3">
              <div className="rounded-[2.5rem] bg-[#3d0413] text-white px-5 py-3 font-black uppercase tracking-[0.35em]">Open Materials</div>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="rounded-[2.5rem] bg-white border border-slate-200 p-4">
              <p className="text-[9px] font-black uppercase tracking-[0.4em] text-slate-400">Total Files</p>
              <p className="text-2xl font-black mt-2">{summary.total}</p>
            </div>
            <div className="rounded-[2.5rem] bg-white border border-slate-200 p-4">
              <p className="text-[9px] font-black uppercase tracking-[0.4em] text-slate-400">Weeks Covered</p>
              <p className="text-2xl font-black mt-2">{summary.weeks}</p>
            </div>
            <div className="rounded-[2.5rem] bg-white border border-slate-200 p-4">
              <p className="text-[9px] font-black uppercase tracking-[0.4em] text-slate-400">Downloaded</p>
              <p className="text-2xl font-black mt-2">{summary.downloadedCount}</p>
            </div>
            <div className="rounded-[2.5rem] bg-white border border-slate-200 p-4">
              <p className="text-[9px] font-black uppercase tracking-[0.4em] text-slate-400">Past Papers</p>
              <p className="text-2xl font-black mt-2">{summary.pastPapers}</p>
            </div>
          </div>

          <div className="mt-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3 overflow-auto">
              {(['All', ...FILE_TYPES] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveFilter(tab as any)}
                  className={`px-4 py-2 rounded-2xl text-[10px] font-black uppercase tracking-[0.35em] ${activeFilter === tab ? 'bg-[#3d0413] text-white' : 'bg-white border border-slate-200 text-slate-700'}`}
                >
                  {tab}
                  <span className="ml-2 text-[10px] font-black text-slate-400">{tab === 'All' ? seededFiles.length : seededFiles.filter((f) => f.type === tab).length}</span>
                </button>
              ))}
            </div>

            <div className="flex items-center gap-3">
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search files..." className="rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:ring-4 focus:ring-[#3d0413]/20" />
            </div>
          </div>

          <div className="mt-6 space-y-6">
            {filesByWeek.map(([week, files]) => (
              <div key={week} className="rounded-[2.5rem] border border-slate-200 bg-white p-4">
                <div className="flex items-center gap-4 mb-4">
                  <div className="rounded-full bg-[#3d0413] text-white px-3 py-2 font-black">Week {String(week).padStart(2, '0')}</div>
                  <div className="text-sm font-black uppercase tracking-[0.35em] text-slate-400">{files.length} files</div>
                </div>
                <div className="space-y-3">
                  {files.map((f) => (
                    <div key={f.id} className="flex items-center justify-between p-3 rounded-2xl border border-slate-100">
                      <div className="flex items-center gap-3">
                        <TypeIcon type={f.type} />
                        <div>
                          <div className="font-black text-sm text-slate-900">{f.name}</div>
                          <div className="text-[12px] text-slate-500">{f.type} • {f.size} • {new Date(f.uploaded).toLocaleDateString()}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => setDownloaded((prev) => ({ ...prev, [f.id]: true }))}
                          className={`rounded-2xl px-4 py-2 text-[10px] font-black uppercase tracking-[0.35em] transition ${downloaded[f.id] ? 'bg-emerald-600 text-white' : 'bg-[#3d0413] text-white'}`}
                        >
                          {downloaded[f.id] ? '✓ Downloaded' : 'Download'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ClassMaterials;
