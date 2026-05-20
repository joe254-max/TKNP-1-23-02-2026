import React, { useMemo } from 'react';

interface ClassItem {
  id: string;
  title: string;
  teacher: string;
  room: string;
  schedule: string;
  attendance?: number;
}

interface Props {
  selectedClass: ClassItem;
  onBack: () => void;
}

interface GradeRow {
  id: string;
  type: string;
  name: string;
  date: string;
  score: number;
  weight: number;
}

const seededRows: GradeRow[] = [
  { id: 'g1', type: 'CAT', name: 'CAT 1', date: '2026-02-02', score: 78, weight: 10 },
  { id: 'g2', type: 'Lab', name: 'Lab Report 1', date: '2026-02-12', score: 85, weight: 10 },
  { id: 'g3', type: 'Assignment', name: 'Assignment 1', date: '2026-02-20', score: 88, weight: 10 },
  { id: 'g4', type: 'CAT', name: 'CAT 2', date: '2026-03-02', score: 82, weight: 20 },
  { id: 'g5', type: 'Project', name: 'Final Project', date: '2026-04-15', score: 0, weight: 30 },
];

const getLetter = (pct: number) => {
  if (pct >= 70) return 'A';
  if (pct >= 60) return 'B';
  if (pct >= 50) return 'C';
  return 'D';
};

const ClassGrades: React.FC<Props> = ({ selectedClass, onBack }) => {
  const rows = seededRows;
  const totals = useMemo(() => {
    const earnedWeighted = rows.reduce((acc, r) => acc + (r.score * r.weight) / 100, 0);
    const weightSum = rows.reduce((acc, r) => acc + r.weight, 0);
    const overall = Math.round((earnedWeighted / Math.max(1, weightSum)) * 100);
    return { earnedWeighted: Math.round(earnedWeighted * 100) / 100, weightSum, overall };
  }, [rows]);

  const componentAverages = useMemo(() => {
    const cat = rows.filter(r => r.type === 'CAT');
    const lab = rows.filter(r => r.type === 'Lab');
    const assign = rows.filter(r => r.type === 'Assignment' || r.type === 'Project');
    const avg = (arr: typeof rows) => Math.round((arr.reduce((s, x) => s + x.score, 0) / Math.max(1, arr.length)) || 0);
    return { cat: avg(cat), lab: avg(lab), assign: avg(assign) };
  }, [rows]);

  const letter = getLetter(totals.overall);

  return (
    <div className="min-h-screen p-6 bg-slate-50">
      <div className="max-w-6xl mx-auto">
        <button onClick={onBack} className="inline-flex items-center gap-3 text-slate-500 mb-6 text-[10px] font-black uppercase tracking-[0.35em]">← Back to Class</button>
        <div className="rounded-[2.5rem] bg-white border border-slate-200 p-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <p className="text-[9px] font-black uppercase tracking-[0.4em] text-slate-400">{selectedClass.title}</p>
              <h1 className="text-3xl font-black text-slate-900 mt-2">Grade Report</h1>
              <p className="text-sm text-slate-500 mt-2">{selectedClass.teacher} • {selectedClass.room}</p>
            </div>
            <div className="rounded-[2.5rem] bg-[#3d0413] px-6 py-4 text-white font-black uppercase tracking-[0.35em]">
              Overall: <span className="text-3xl ml-2">{totals.overall}%</span>
              <div className="text-sm mt-1">Letter: {letter}</div>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="rounded-[2.5rem] bg-white border border-slate-200 p-4">
              <p className="text-[9px] font-black uppercase tracking-[0.4em] text-slate-400">CAT Average</p>
              <div className="mt-3 text-2xl font-black">{componentAverages.cat}%</div>
              <div className="mt-3 h-3 bg-slate-100 rounded-full overflow-hidden"><div className="h-full bg-rose-500" style={{ width: `${componentAverages.cat}%` }} /></div>
            </div>
            <div className="rounded-[2.5rem] bg-white border border-slate-200 p-4">
              <p className="text-[9px] font-black uppercase tracking-[0.4em] text-slate-400">Lab Average</p>
              <div className="mt-3 text-2xl font-black">{componentAverages.lab}%</div>
              <div className="mt-3 h-3 bg-slate-100 rounded-full overflow-hidden"><div className="h-full bg-emerald-500" style={{ width: `${componentAverages.lab}%` }} /></div>
            </div>
            <div className="rounded-[2.5rem] bg-white border border-slate-200 p-4">
              <p className="text-[9px] font-black uppercase tracking-[0.4em] text-slate-400">Assignment Average</p>
              <div className="mt-3 text-2xl font-black">{componentAverages.assign}%</div>
              <div className="mt-3 h-3 bg-slate-100 rounded-full overflow-hidden"><div className="h-full bg-sky-500" style={{ width: `${componentAverages.assign}%` }} /></div>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="rounded-[2.5rem] bg-white border border-slate-200 p-4">
              <h3 className="text-sm font-black uppercase tracking-[0.35em] text-slate-400 mb-4">Full Grade Breakdown</h3>
              <div className="space-y-3">
                {rows.map((r) => (
                  <div key={r.id} className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="rounded-2xl bg-slate-50 px-3 py-2 text-[10px] font-black uppercase tracking-[0.35em]">{r.type}</div>
                      <div>
                        <div className="font-black">{r.name}</div>
                        <div className="text-[12px] text-slate-500">{r.date}</div>
                      </div>
                    </div>
                    <div className="w-1/2">
                      <div className="h-3 bg-slate-100 rounded-full overflow-hidden"><div className="h-full bg-[#3d0413]" style={{ width: `${r.score}%` }} /></div>
                    </div>
                    <div className="w-20 text-right font-black">{r.score}%</div>
                    <div className="w-16 text-right text-sm text-slate-500">{r.weight}%</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[2.5rem] bg-white border border-slate-200 p-4">
              <h3 className="text-sm font-black uppercase tracking-[0.35em] text-slate-400 mb-4">Grading Scheme</h3>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-slate-500 text-[10px] uppercase tracking-[0.35em]">
                    <th>Component</th>
                    <th>Weight</th>
                    <th>Earned %</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="py-2 font-black">CATs</td>
                    <td>30%</td>
                    <td>{Math.round((componentAverages.cat * 30) / 100)}%</td>
                  </tr>
                  <tr>
                    <td className="py-2 font-black">Assignments</td>
                    <td>20%</td>
                    <td>{Math.round((componentAverages.assign * 20) / 100)}%</td>
                  </tr>
                  <tr>
                    <td className="py-2 font-black">Labs</td>
                    <td>20%</td>
                    <td>{Math.round((componentAverages.lab * 20) / 100)}%</td>
                  </tr>
                  <tr>
                    <td className="py-2 font-black">Final Project</td>
                    <td>30%</td>
                    <td>{Math.round((0 * 30) / 100)}%</td>
                  </tr>
                  <tr className="border-t pt-3">
                    <td className="py-3 font-black">Total</td>
                    <td className="font-black">100%</td>
                    <td className="font-black">{totals.overall}%</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div className="mt-6 rounded-[2.5rem] bg-white border border-slate-200 p-4">
            <h3 className="text-sm font-black uppercase tracking-[0.35em] text-slate-400 mb-4">Grade Progression</h3>
            <div className="flex items-end gap-3 h-28">
              {rows.map((r) => (
                <div key={r.id} className="flex-1">
                  <div className="h-full flex items-end">
                    <div className="mx-auto bg-[#3d0413]" style={{ width: '60%', height: `${Math.max(6, r.score)}%`, borderRadius: 6 }} />
                  </div>
                  <div className="text-[10px] font-black uppercase tracking-[0.25em] text-center mt-2">{r.name}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ClassGrades;
