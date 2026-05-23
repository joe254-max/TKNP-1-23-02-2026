import React, { useEffect, useState } from 'react';
import { ArrowLeft, TrendingUp, Award } from 'lucide-react';
import { fetchClassGrades, type ClassGradeSummary, type GradeComponent } from '../lib/classContentService';

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

interface GradeEntry {
  label: string;
  date: string;
  score: number;
  max: number;
  weight: string;
  type: 'CAT' | 'ASSIGNMENT' | 'LAB' | 'PROJECT';
}

const GRADE_ENTRIES: GradeEntry[] = [
  { label: 'Lab Report 1 — Single Phase Analysis', date: 'Mar 3, 2026', score: 86, max: 100, weight: '10%', type: 'LAB' },
  { label: 'CAT 1 — Transformer Analysis', date: 'Mar 17, 2026', score: 79, max: 100, weight: '15%', type: 'CAT' },
  { label: 'Assignment 2 — Load Flow Study', date: 'Apr 4, 2026', score: 88, max: 100, weight: '10%', type: 'ASSIGNMENT' },
  { label: 'Lab Report 3 — Three Phase Power', date: 'Apr 21, 2026', score: 83, max: 100, weight: '10%', type: 'LAB' },
];

const SCHEME = [
  { component: 'CATs (×2)', weight: 30, earned: 23.7 },
  { component: 'Assignments', weight: 20, earned: 17.6 },
  { component: 'Lab Reports (×2)', weight: 20, earned: 16.9 },
  { component: 'Final Project', weight: 30, earned: null },
];

const TYPE_COLORS: Record<string, string> = {
  CAT: 'bg-[#fce7ec] text-[#3d0413]',
  ASSIGNMENT: 'bg-blue-50 text-blue-700',
  LAB: 'bg-emerald-50 text-emerald-700',
  PROJECT: 'bg-amber-50 text-amber-700',
};

const getLetterGrade = (pct: number): { letter: string; label: string; color: string } => {
  if (pct >= 70) return { letter: 'A', label: 'Distinction', color: 'text-emerald-600' };
  if (pct >= 60) return { letter: 'B', label: 'Credit', color: 'text-blue-600' };
  if (pct >= 50) return { letter: 'C', label: 'Pass', color: 'text-amber-600' };
  return { letter: 'D', label: 'Below Pass', color: 'text-red-600' };
};

const ClassGrades: React.FC<Props> = ({ selectedClass, onBack }) => {
  const [gradeEntries, setGradeEntries] = useState<GradeEntry[]>(GRADE_ENTRIES);
  const [scheme, setScheme] = useState(SCHEME);
  const [overallGrade, setOverallGrade] = useState(selectedClass.grade ?? 82);
  const [attendance, setAttendance] = useState(selectedClass.attendance ?? 90);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    let active = true;

    const loadGrades = async () => {
      setIsLoading(true);
      setLoadError(false);
      try {
        const remote = await fetchClassGrades(selectedClass.id);
        if (!active) return;

        setGradeEntries(
          (remote.gradeEntries ?? []).map((entry) => ({
            label: entry.title,
            date: entry.date,
            score: entry.score,
            max: entry.maxScore,
            weight: entry.weight,
            type: entry.entryType as GradeEntry['type'],
          })),
        );
        setScheme(remote.scheme ?? SCHEME);
        setOverallGrade(remote.overall ?? selectedClass.grade ?? 82);
        setAttendance(remote.attendance ?? selectedClass.attendance ?? 90);
      } catch {
        if (active) {
          setLoadError(true);
        }
      } finally {
        if (active) setIsLoading(false);
      }
    };

    void loadGrades();

    return () => {
      active = false;
    };
  }, [selectedClass.id, selectedClass.attendance, selectedClass.grade]);

  const { letter, label, color } = getLetterGrade(overallGrade);

  const catAvg = Math.round(
    gradeEntries.filter((g) => g.type === 'CAT').reduce((s, g) => s + g.score, 0) /
      Math.max(1, gradeEntries.filter((g) => g.type === 'CAT').length),
  );
  const labAvg = Math.round(
    gradeEntries.filter((g) => g.type === 'LAB').reduce((s, g) => s + g.score, 0) /
      Math.max(1, gradeEntries.filter((g) => g.type === 'LAB').length),
  );
  const assignAvg = Math.round(
    gradeEntries.filter((g) => g.type === 'ASSIGNMENT').reduce((s, g) => s + g.score, 0) /
      Math.max(1, gradeEntries.filter((g) => g.type === 'ASSIGNMENT').length),
  );

  return (
    <div className="px-4 py-8 sm:px-6 lg:px-10 max-w-screen-xl mx-auto">
      <button
        type="button"
        onClick={onBack}
        className="mb-8 inline-flex items-center gap-2 text-slate-500 uppercase tracking-[0.35em] font-black text-[10px] hover:text-[#3d0413] transition-colors"
      >
        <ArrowLeft size={16} /> Back to Class
      </button>

      <div className="mb-10">
        <p className="text-[10px] font-black uppercase tracking-[0.45em] text-slate-400 mb-2">
          {selectedClass.title}
        </p>
        <h1 className="text-4xl sm:text-5xl font-black uppercase text-[#1a202c] tracking-tight">
          My Grades
        </h1>
        <p className="mt-3 text-sm text-slate-500">
          {selectedClass.teacher} &nbsp;•&nbsp; {selectedClass.room}
        </p>
      </div>

      {isLoading && (
        <div className="mb-6 rounded-[2rem] border border-slate-200 bg-slate-50 p-6 text-slate-500 text-sm">
          Loading grade summary...
        </div>
      )}
      {loadError && (
        <div className="mb-6 rounded-[2rem] border border-amber-200 bg-amber-50 p-6 text-amber-700 text-sm">
          Could not load grades from the backend. Showing sample content.
        </div>
      )}

      <div className="rounded-[2.5rem] bg-[#3d0413] text-white p-8 sm:p-10 mb-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-8">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.45em] text-white/50 mb-3">
            Overall Grade Average
          </p>
          <div className="flex items-end gap-4">
            <span className="text-6xl font-black">{overallGrade}%</span>
            <div className="pb-2">
              <span className={`text-3xl font-black ${color.replace('text-', 'text-')} text-white/80`}>
                {letter}
              </span>
              <p className="text-sm text-white/50 uppercase tracking-[0.3em]">{label}</p>
            </div>
          </div>
          <div className="mt-5 h-2.5 rounded-full bg-white/10 overflow-hidden w-72 max-w-full">
            <div
              className="h-full rounded-full bg-white transition-all"
              style={{ width: `${overallGrade}%` }}
            />
          </div>
        </div>
        <div className="flex flex-col gap-4">
          <div className="rounded-2xl bg-white/10 px-6 py-4 text-center border border-white/10">
            <p className="text-[9px] uppercase tracking-[0.4em] text-white/50 mb-1">Attendance</p>
            <p className="text-2xl font-black">{attendance}%</p>
          </div>
          <div className="rounded-2xl bg-white/10 px-6 py-4 text-center border border-white/10">
            <Award size={20} className="mx-auto mb-1 text-white/50" />
            <p className="text-[9px] uppercase tracking-[0.4em] text-white/50">{label}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-8">
        {[
          { label: 'CAT Average', value: catAvg, icon: '📝', color: '#3d0413' },
          { label: 'Lab Report Avg', value: labAvg, icon: '🧪', color: '#0f6e56' },
          { label: 'Assignment Avg', value: assignAvg, icon: '📋', color: '#185fa5' },
        ].map((c) => (
          <div key={c.label} className="rounded-[2.5rem] border border-slate-200 bg-white p-7">
            <div className="flex items-center justify-between mb-4">
              <span className="text-2xl">{c.icon}</span>
              <TrendingUp size={16} className="text-slate-300" />
            </div>
            <p className="text-[9px] font-black uppercase tracking-[0.4em] text-slate-400 mb-2">{c.label}</p>
            <p className="text-4xl font-black text-slate-900">{c.value}%</p>
            <div className="mt-4 h-2 rounded-full bg-slate-100 overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${c.value}%`, backgroundColor: c.color }}
              />
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-[2.5rem] border border-slate-200 bg-white overflow-hidden mb-8">
        <div className="px-7 py-5 border-b border-slate-100 flex items-center justify-between">
          <p className="text-[9px] font-black uppercase tracking-[0.4em] text-slate-400">Grade Breakdown</p>
          <p className="text-[9px] font-black uppercase tracking-[0.4em] text-slate-400">{gradeEntries.length} items graded</p>
        </div>
        <div className="divide-y divide-slate-100">
          {gradeEntries.map((g) => (
            <div key={g.label} className="flex items-center gap-4 px-7 py-5 hover:bg-slate-50/60 transition-colors">
              <span
                className={`text-[8px] font-black uppercase tracking-[0.35em] px-3 py-1.5 rounded-full flex-shrink-0 ${TYPE_COLORS[g.type]}`}
              >
                {g.type}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-slate-900 truncate">{g.label}</p>
                <p className="text-[10px] text-slate-400 uppercase tracking-[0.3em] mt-0.5">{g.date}</p>
              </div>
              <div className="flex items-center gap-6 flex-shrink-0">
                <div className="w-24 hidden sm:block">
                  <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-[#3d0413]"
                      style={{ width: `${g.score}%` }}
                    />
                  </div>
                </div>
                <div className="text-right min-w-[60px]">
                  <p className="text-lg font-black text-slate-900">{g.score}%</p>
                  <p className="text-[9px] text-slate-400 uppercase tracking-[0.3em]">/{g.max}</p>
                </div>
                <span className="text-[9px] font-black uppercase tracking-[0.35em] text-slate-400 bg-slate-100 px-3 py-1.5 rounded-full hidden sm:block">
                  {g.weight}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-[2.5rem] border border-slate-200 bg-white overflow-hidden">
        <div className="px-7 py-5 border-b border-slate-100">
          <p className="text-[9px] font-black uppercase tracking-[0.4em] text-slate-400">Grading Scheme &amp; Weighted Total</p>
        </div>
        <div className="divide-y divide-slate-100">
          {scheme.map((row) => (
            <div key={row.component} className="flex items-center gap-4 px-7 py-5">
              <div className="flex-1">
                <p className="text-sm font-bold text-slate-900">{row.component}</p>
              </div>
              <div className="flex items-center gap-5 flex-shrink-0">
                <span className="text-[9px] font-black uppercase tracking-[0.35em] bg-slate-100 text-slate-500 px-3 py-1.5 rounded-full">
                  Weight: {row.weight}%
                </span>
                {row.earned !== null ? (
                  <span className="text-base font-black text-[#3d0413] min-w-[60px] text-right">
                    {row.earned}%
                  </span>
                ) : (
                  <span className="text-base font-black text-slate-300 min-w-[60px] text-right">TBA</span>
                )}
              </div>
            </div>
          ))}
          <div className="flex items-center gap-4 px-7 py-5 bg-slate-50">
            <div className="flex-1">
              <p className="text-sm font-black text-slate-900 uppercase tracking-[0.2em]">
                Current Weighted Total
              </p>
              <p className="text-[10px] text-slate-400 mt-0.5">(Final Project not yet included)</p>
            </div>
            <span className="text-2xl font-black text-[#3d0413]">58.2%</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ClassGrades;
