import React, { useMemo, useState } from 'react';

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

type Status = 'Graded' | 'Submitted' | 'Pending' | 'Overdue';

interface Assignment {
  id: string;
  title: string;
  due: string;
  status: Status;
  grade?: number;
  feedback?: string;
  submittedFile?: string | null;
  instructions: string;
}

const seededAssignments: Assignment[] = [
  {
    id: 'a1', title: 'CAT 1', due: new Date(Date.now() - 1000 * 60 * 60 * 24 * 14).toISOString(), status: 'Graded', grade: 78, feedback: 'Good work. Show more workings.', submittedFile: 'cat1-solution.pdf', instructions: 'Answer all questions. Show steps.'
  },
  {
    id: 'a2', title: 'Lab Report 1', due: new Date(Date.now() - 1000 * 60 * 60 * 24 * 7).toISOString(), status: 'Graded', grade: 85, feedback: 'Excellent methodology.', submittedFile: 'lab1-report.pdf', instructions: 'Document experiment and results.'
  },
  {
    id: 'a3', title: 'Assignment: Power Flow', due: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3).toISOString(), status: 'Graded', grade: 88, feedback: 'Clear diagrams.', submittedFile: 'powerflow.pdf', instructions: 'Design a simple power flow model.'
  },
  {
    id: 'a4', title: 'Project Proposal', due: new Date(Date.now() + 1000 * 60 * 60 * 24 * 5).toISOString(), status: 'Pending', instructions: 'Submit a one-page proposal.'
  },
  {
    id: 'a5', title: 'Past Paper Submission', due: new Date(Date.now() + 1000 * 60 * 60 * 24 * 1).toISOString(), status: 'Submitted', submittedFile: 'pastpaper-scan.pdf', grade: undefined, instructions: 'Solve the past paper and upload a scan.'
  }
];

const statusColor = (s: Status) => {
  if (s === 'Graded') return 'bg-emerald-100 text-emerald-700';
  if (s === 'Submitted') return 'bg-sky-100 text-sky-700';
  if (s === 'Pending') return 'bg-amber-100 text-amber-700';
  return 'bg-rose-100 text-rose-700';
};

const ClassAssignments: React.FC<Props> = ({ selectedClass, onBack }) => {
  const [assignments, setAssignments] = useState<Assignment[]>(seededAssignments);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [uploadingFor, setUploadingFor] = useState<string | null>(null);
  const [fileDraft, setFileDraft] = useState<File | null>(null);

  const summary = useMemo(() => {
    const total = assignments.length;
    const graded = assignments.filter(a => a.status === 'Graded').length;
    const pending = assignments.filter(a => a.status === 'Pending').length;
    const avg = Math.round((assignments.filter(a => a.grade).reduce((s, a) => s + (a.grade || 0), 0) / Math.max(1, graded)) || 0);
    return { total, graded, pending, avg };
  }, [assignments]);

  const handleStartUpload = (id: string) => { setUploadingFor(id); setExpanded(id); };
  const handleCancelUpload = () => { setUploadingFor(null); setFileDraft(null); };
  const handleSubmit = (id: string) => {
    if (!fileDraft) return;
    setAssignments((prev) => prev.map((a) => a.id === id ? { ...a, status: 'Submitted', submittedFile: fileDraft.name } : a));
    setUploadingFor(null);
    setFileDraft(null);
  };

  return (
    <div className="min-h-screen p-6 bg-slate-50">
      <div className="max-w-6xl mx-auto">
        <button onClick={onBack} className="inline-flex items-center gap-3 text-slate-500 mb-6 text-[10px] font-black uppercase tracking-[0.35em]">← Back to Class</button>
        <div className="rounded-[2.5rem] bg-white border border-slate-200 p-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <p className="text-[9px] font-black uppercase tracking-[0.4em] text-slate-400">Assignments — {selectedClass.title}</p>
              <h1 className="text-3xl font-black text-slate-900 mt-2">Assignment Tracker</h1>
              <p className="text-sm text-slate-500 mt-2">{selectedClass.teacher} • {selectedClass.room}</p>
            </div>
            <div className="flex gap-3">
              <div className="rounded-[2.5rem] bg-[#3d0413] text-white px-5 py-3 font-black uppercase tracking-[0.35em]">Assignments</div>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="rounded-[2.5rem] bg-white border border-slate-200 p-4">
              <p className="text-[9px] font-black uppercase tracking-[0.4em] text-slate-400">Total</p>
              <p className="text-2xl font-black mt-2">{summary.total}</p>
            </div>
            <div className="rounded-[2.5rem] bg-white border border-slate-200 p-4">
              <p className="text-[9px] font-black uppercase tracking-[0.4em] text-slate-400">Graded</p>
              <p className="text-2xl font-black mt-2">{summary.graded}</p>
            </div>
            <div className="rounded-[2.5rem] bg-white border border-slate-200 p-4">
              <p className="text-[9px] font-black uppercase tracking-[0.4em] text-slate-400">Pending</p>
              <p className="text-2xl font-black mt-2">{summary.pending}</p>
            </div>
            <div className="rounded-[2.5rem] bg-white border border-slate-200 p-4">
              <p className="text-[9px] font-black uppercase tracking-[0.4em] text-slate-400">Average Grade</p>
              <p className="text-2xl font-black mt-2">{summary.avg}%</p>
            </div>
          </div>

          <div className="mt-8 space-y-4">
            {assignments.map((a) => (
              <div key={a.id} className="rounded-[2rem] border border-slate-200 bg-white p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-black text-slate-900">{a.title}</h3>
                      <div className={`px-3 py-2 rounded-2xl text-[10px] font-black uppercase tracking-[0.35em] ${statusColor(a.status)}`}>{a.status}</div>
                    </div>
                    <div className="mt-2 text-sm text-slate-500">Due: {new Date(a.due).toLocaleDateString()}</div>
                    {a.grade !== undefined && (
                      <div className="mt-3 flex items-center gap-3">
                        <div className="text-3xl font-black">{a.grade}%</div>
                        <div className="flex-1 h-3 bg-slate-100 rounded-full overflow-hidden">
                          <div className="h-full bg-emerald-500" style={{ width: `${a.grade}%` }} />
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-3">
                    <button onClick={() => setExpanded(expanded === a.id ? null : a.id)} className="rounded-2xl bg-slate-50 px-4 py-3 text-[10px] font-black uppercase tracking-[0.35em] border border-slate-200">{expanded === a.id ? 'Collapse' : 'Details'}</button>
                  </div>
                </div>

                {expanded === a.id && (
                  <div className="mt-4 border-t pt-4">
                    <p className="text-sm text-slate-700 mb-3">{a.instructions}</p>
                    {a.feedback && (
                      <div className="rounded-2xl bg-slate-50 p-3 border border-slate-100 mb-3">
                        <div className="text-[10px] uppercase tracking-[0.35em] font-black text-slate-400">Lecturer feedback</div>
                        <div className="mt-2 text-sm text-slate-700">{a.feedback}</div>
                      </div>
                    )}
                    <div className="flex items-center gap-3">
                      {a.status === 'Pending' && (
                        <>
                          {!uploadingFor && <button onClick={() => handleStartUpload(a.id)} className="rounded-2xl bg-[#3d0413] px-4 py-3 text-white text-[10px] font-black uppercase tracking-[0.35em]">Submit Assignment</button>}
                          {uploadingFor === a.id && (
                            <div className="flex items-center gap-2">
                              <input type="file" onChange={(e) => setFileDraft(e.target.files?.[0] ?? null)} className="text-sm" />
                              <button onClick={() => handleSubmit(a.id)} className={`rounded-2xl px-4 py-3 text-[10px] font-black uppercase tracking-[0.35em] bg-emerald-600 text-white`}>Submit</button>
                              <button onClick={handleCancelUpload} className="rounded-2xl px-4 py-3 text-[10px] font-black uppercase tracking-[0.35em] bg-slate-50 border border-slate-200">Cancel</button>
                            </div>
                          )}
                        </>
                      )}

                      {a.status === 'Submitted' && (
                        <div className="rounded-2xl bg-emerald-50 px-4 py-3 text-emerald-700 font-black">✓ Submitted — {a.submittedFile}</div>
                      )}

                      {a.status === 'Graded' && (
                        <div className="text-sm text-slate-700">Grade: <span className="font-black">{a.grade}%</span></div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ClassAssignments;
