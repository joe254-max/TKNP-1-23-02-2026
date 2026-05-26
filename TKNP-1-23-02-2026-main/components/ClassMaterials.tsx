import React, { useState, useEffect } from 'react';
import { ArrowLeft, Download, FileText, BookOpen, Presentation, Archive, Search } from 'lucide-react';
import { fetchClassMaterials, type ClassMaterial } from '../lib/classContentService';

interface ClassItem {
  id: string;
  title: string;
  teacher: string;
  room: string;
  schedule: string;
}

interface Props {
  selectedClass: ClassItem;
  onBack: () => void;
}

type FilterType = 'ALL' | 'NOTES' | 'SLIDES' | 'PAST PAPERS' | 'LAB SHEETS';

interface Material extends ClassMaterial {
  type: FilterType;
}

const MATERIALS: Material[] = [
  { id: 'm1', classId: 'demo', week: 1, name: 'Introduction to Power Systems — Lecture Notes', type: 'NOTES', size: '1.1 MB', uploadedBy: 'Dr. Kamau', date: 'Feb 3, 2026' },
  { id: 'm2', classId: 'demo', week: 1, name: 'Week 1 Lecture Slides — Overview', type: 'SLIDES', size: '2.3 MB', uploadedBy: 'Dr. Kamau', date: 'Feb 3, 2026' },
  { id: 'm3', classId: 'demo', week: 2, name: 'Single Phase Circuits — Detailed Notes', type: 'NOTES', size: '1.8 MB', uploadedBy: 'Dr. Kamau', date: 'Feb 10, 2026' },
  { id: 'm4', classId: 'demo', week: 2, name: 'Single Phase Circuits — Slides', type: 'SLIDES', size: '3.8 MB', uploadedBy: 'Dr. Kamau', date: 'Feb 10, 2026' },
  { id: 'm5', classId: 'demo', week: 3, name: 'Lab Sheet 1 — Single Phase Measurements', type: 'LAB SHEETS', size: '540 KB', uploadedBy: 'Dr. Kamau', date: 'Feb 17, 2026' },
  { id: 'm6', classId: 'demo', week: 4, name: 'Transformer Theory & Efficiency — Notes', type: 'NOTES', size: '2.2 MB', uploadedBy: 'Dr. Kamau', date: 'Feb 24, 2026' },
  { id: 'm7', classId: 'demo', week: 4, name: 'Transformer Theory — Slides', type: 'SLIDES', size: '4.1 MB', uploadedBy: 'Dr. Kamau', date: 'Feb 24, 2026' },
  { id: 'm8', classId: 'demo', week: 5, name: 'Per-Unit System — Lecture Notes', type: 'NOTES', size: '980 KB', uploadedBy: 'Dr. Kamau', date: 'Mar 3, 2026' },
  { id: 'm9', classId: 'demo', week: 6, name: 'Three Phase Power Analysis — Notes', type: 'NOTES', size: '1.9 MB', uploadedBy: 'Dr. Kamau', date: 'Mar 10, 2026' },
  { id: 'm10', classId: 'demo', week: 6, name: 'Three Phase Power — Slides', type: 'SLIDES', size: '3.2 MB', uploadedBy: 'Dr. Kamau', date: 'Mar 10, 2026' },
  { id: 'm11', classId: 'demo', week: 7, name: 'Lab Sheet 3 — Three Phase Measurements', type: 'LAB SHEETS', size: '600 KB', uploadedBy: 'Dr. Kamau', date: 'Mar 17, 2026' },
  { id: 'm12', classId: 'demo', week: 8, name: 'Load Flow Studies — Detailed Notes', type: 'NOTES', size: '3.1 MB', uploadedBy: 'Dr. Kamau', date: 'Mar 24, 2026' },
  { id: 'm13', classId: 'demo', week: 9, name: 'Past Paper 2023 — Power Systems II', type: 'PAST PAPERS', size: '890 KB', uploadedBy: 'Dr. Kamau', date: 'Apr 1, 2026' },
  { id: 'm14', classId: 'demo', week: 9, name: 'Past Paper 2024 — Power Systems II', type: 'PAST PAPERS', size: '910 KB', uploadedBy: 'Dr. Kamau', date: 'Apr 1, 2026' },
  { id: 'm15', classId: 'demo', week: 10, name: 'Power System Protection — Notes', type: 'NOTES', size: '2.4 MB', uploadedBy: 'Dr. Kamau', date: 'Apr 7, 2026' },
];

const FILE_ICONS: Record<FilterType, React.ReactNode> = {
  ALL: <FileText size={20} />,
  NOTES: <BookOpen size={20} />,
  SLIDES: <Presentation size={20} />,
  'PAST PAPERS': <Archive size={20} />,
  'LAB SHEETS': <FileText size={20} />,
};

const FILE_COLORS: Record<FilterType, string> = {
  ALL: 'bg-slate-100 text-slate-600',
  NOTES: 'bg-blue-50 text-blue-700',
  SLIDES: 'bg-rose-50 text-[#3d0413]',
  'PAST PAPERS': 'bg-amber-50 text-amber-700',
  'LAB SHEETS': 'bg-emerald-50 text-emerald-700',
};

const FILTERS: FilterType[] = ['ALL', 'NOTES', 'SLIDES', 'PAST PAPERS', 'LAB SHEETS'];

const ClassMaterials: React.FC<Props> = ({ selectedClass, onBack }) => {
  const [activeFilter, setActiveFilter] = useState<FilterType>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [downloaded, setDownloaded] = useState<Set<string>>(new Set());
  const [materials, setMaterials] = useState<Material[]>(MATERIALS);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    let active = true;
    const loadMaterials = async () => {
      setIsLoading(true);
      setLoadError(false);
      try {
        const remote = await fetchClassMaterials(selectedClass.id);
        if (active && remote.length > 0) {
          setMaterials(remote as Material[]);
        }
      } catch {
        if (active) setLoadError(true);
      } finally {
        if (active) setIsLoading(false);
      }
    };
    void loadMaterials();
    return () => {
      active = false;
    };
  }, [selectedClass.id]);

  const filtered = materials.filter((m) => {
    const matchType = activeFilter === 'ALL' || m.type === activeFilter;
    const matchSearch =
      searchQuery.trim() === '' ||
      m.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchType && matchSearch;
  });

  const grouped = filtered.reduce<Record<number, Material[]>>((acc, m) => {
    if (!acc[m.week]) acc[m.week] = [];
    acc[m.week].push(m);
    return acc;
  }, {});

  const handleDownload = (id: string) => {
    setDownloaded((prev) => new Set([...prev, id]));
  };

  const counts: Record<FilterType, number> = {
    ALL: materials.length,
    NOTES: materials.filter((m) => m.type === 'NOTES').length,
    SLIDES: materials.filter((m) => m.type === 'SLIDES').length,
    'PAST PAPERS': materials.filter((m) => m.type === 'PAST PAPERS').length,
    'LAB SHEETS': materials.filter((m) => m.type === 'LAB SHEETS').length,
  };

  return (
    <div className="px-4 py-8 sm:px-6 lg:px-10 max-w-screen-xl mx-auto">
      <button
        type="button"
        onClick={onBack}
        className="mb-8 inline-flex items-center gap-2 text-slate-500 uppercase tracking-[0.35em] font-black text-[10px] hover:text-[#3d0413] transition-colors"
      >
        <ArrowLeft size={16} /> Back to Class
      </button>

      <div className="mb-10 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.45em] text-slate-400 mb-2">
            {selectedClass.title}
          </p>
          <h1 className="text-4xl sm:text-5xl font-black uppercase text-[#1a202c] tracking-tight">
            Course Materials
          </h1>
          <p className="mt-3 text-sm text-slate-500">
            {selectedClass.teacher} &nbsp;•&nbsp; {selectedClass.room}
          </p>
        </div>
        <div className="relative w-full max-w-sm">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" />
          <input
            type="text"
            placeholder="Search materials..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-2xl border border-slate-200 bg-white py-3 pl-11 pr-4 text-sm font-bold outline-none focus:ring-4 focus:ring-[#3d0413]/10"
          />
        </div>
      </div>

      {isLoading && (
        <div className="mb-6 rounded-[2rem] border border-slate-200 bg-slate-50 p-6 text-slate-500 text-sm">
          Loading materials...
        </div>
      )}
      {loadError && (
        <div className="mb-6 rounded-[2rem] border border-amber-200 bg-amber-50 p-6 text-amber-700 text-sm">
          Could not load remote materials. Showing sample content.
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-10">
        {[
          { label: 'Total Files', value: materials.length },
          { label: 'Weeks Covered', value: 10 },
          { label: 'Downloaded', value: downloaded.size },
          { label: 'Past Papers', value: counts['PAST PAPERS'] },
        ].map((s) => (
          <div key={s.label} className="rounded-[2rem] border border-slate-200 bg-white p-5">
            <p className="text-[9px] font-black uppercase tracking-[0.4em] text-slate-400 mb-2">{s.label}</p>
            <p className="text-3xl font-black text-slate-900">{s.value}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2 mb-8">
        {FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setActiveFilter(f)}
            className={`inline-flex items-center gap-2 px-5 py-3 rounded-2xl text-[9px] font-black uppercase tracking-[0.35em] transition-all border ${
              activeFilter === f
                ? 'bg-[#3d0413] text-white border-[#3d0413] shadow-lg'
                : 'bg-white text-slate-500 border-slate-200 hover:border-[#3d0413] hover:text-[#3d0413]'
            }`}
          >
            <span className={activeFilter === f ? 'text-white' : ''}>
              {FILE_ICONS[f]}
            </span>
            {f}
            <span
              className={`px-2 py-0.5 rounded-full text-[8px] font-black ${
                activeFilter === f ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'
              }`}
            >
              {counts[f]}
            </span>
          </button>
        ))}
      </div>

      {Object.keys(grouped).length === 0 ? (
        <div className="rounded-[3rem] border border-slate-200 bg-slate-50 p-16 text-center text-slate-400 uppercase tracking-[0.35em] text-sm font-black">
          No materials found.
        </div>
      ) : (
        <div className="space-y-8">
          {Object.entries(grouped)
            .sort(([a], [b]) => Number(a) - Number(b))
            .map(([week, files]) => (
              <div key={week} className="rounded-[2.5rem] border border-slate-200 bg-white overflow-hidden">
                <div className="flex items-center justify-between px-7 py-5 border-b border-slate-100 bg-slate-50/60">
                  <div className="flex items-center gap-3">
                    <span className="w-8 h-8 rounded-2xl bg-[#3d0413] text-white flex items-center justify-center text-[10px] font-black">
                      {String(week).padStart(2, '0')}
                    </span>
                    <span className="text-sm font-black uppercase tracking-[0.3em] text-slate-900">
                      Week {week}
                    </span>
                  </div>
                  <span className="text-[9px] font-black uppercase tracking-[0.35em] text-slate-400">
                    {files.length} file{files.length > 1 ? 's' : ''}
                  </span>
                </div>
                <div className="divide-y divide-slate-100">
                  {files.map((f) => (
                    <div
                      key={f.id}
                      className="flex items-center justify-between gap-4 px-7 py-5 hover:bg-slate-50/70 transition-colors"
                    >
                      <div className="flex items-center gap-4 min-w-0">
                        <div
                          className={`w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0 ${FILE_COLORS[f.type]}`}
                        >
                          {FILE_ICONS[f.type]}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-slate-900 truncate">{f.name}</p>
                          <p className="text-[10px] text-slate-400 mt-0.5 uppercase tracking-[0.3em]">
                            {f.type} &nbsp;•&nbsp; {f.size} &nbsp;•&nbsp; {f.date}
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDownload(f.id)}
                        className={`inline-flex items-center gap-2 px-5 py-3 rounded-2xl text-[9px] font-black uppercase tracking-[0.35em] flex-shrink-0 transition-all ${
                          downloaded.has(f.id)
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-[#3d0413] text-white hover:opacity-85'
                        }`}
                      >
                        <Download size={13} />
                        {downloaded.has(f.id) ? 'Saved' : 'Download'}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
        </div>
      )}
    </div>
  );
};

export default ClassMaterials;
