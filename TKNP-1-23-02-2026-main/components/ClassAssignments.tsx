import React, { useEffect, useState, useRef } from 'react';
import { ArrowLeft, Upload, CheckCircle2, Clock, AlertCircle, FileText, X, ChevronDown, ChevronUp } from 'lucide-react';
import { fetchClassAssignments, submitAssignment } from '../lib/classContentService';

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

type AssignmentStatus = 'GRADED' | 'SUBMITTED' | 'PENDING' | 'OVERDUE';

interface Assignment {
  id: string;
  title: string;
  description: string;
  dueDate: string;
  status: AssignmentStatus;
  grade?: number;
  maxGrade: number;
  feedback?: string;
  submittedFile?: string;
  submittedDate?: string;
  weight: string;
}

const ASSIGNMENTS: Assignment[] = [
  {
    id: 'a1',
    title: 'Lab Report 1 — Single Phase Circuit Analysis',
    description: 'Write a formal lab report on single-phase circuit measurements from Lab Session 1. Include circuit diagrams, data tables, phasor diagrams, and error analysis.',
    dueDate: 'Mar 3, 2026',
    status: 'GRADED',
    grade: 86,
    maxGrade: 100,
    feedback: 'Excellent phasor diagrams. Your error analysis was thorough. Minor deduction for missing conclusion section.',
    submittedFile: 'Lab_Report_1_Joe.pdf',
    submittedDate: 'Mar 1, 2026',
    weight: '10%',
  },
  {
    id: 'a2',
    title: 'CAT 1 — Transformer Analysis',
    description: 'Continuous Assessment Test covering transformer equivalent circuits, efficiency calculations, and voltage regulation. Open notes allowed.',
    dueDate: 'Mar 17, 2026',
    status: 'GRADED',
    grade: 79,
    maxGrade: 100,
    feedback: 'Good understanding of equivalent circuits. Review efficiency calculation under varying loads for the final exam.',
    submittedFile: 'CAT1_Answers.pdf',
    submittedDate: 'Mar 17, 2026',
    weight: '15%',
  },
  {
    id: 'a3',
    title: 'Assignment 2 — Load Flow Study',
    description: 'Perform a Newton-Raphson load flow study on the given 4-bus power system. Submit a typed report with bus voltages, line flows, and losses.',
    dueDate: 'Apr 4, 2026',
    status: 'GRADED',
    grade: 88,
    maxGrade: 100,
    feedback: 'Very well done. Your Newton-Raphson iterations were accurate. Excellent presentation of results.',
    submittedFile: 'LoadFlow_Assignment.pdf',
    submittedDate: 'Apr 2, 2026',
    weight: '10%',
  },
  {
    id: 'a4',
    title: 'Lab Report 3 — Three Phase Power Measurements',
    description: 'Document your findings from the three-phase lab including balanced and unbalanced load measurements, power factor correction, and waveform analysis.',
    dueDate: 'Apr 21, 2026',
    status: 'GRADED',
    grade: 83,
    maxGrade: 100,
    feedback: 'Good data presentation. Your power factor correction analysis was insightful. Work on cleaner circuit diagrams.',
    submittedFile: 'Lab3_ThreePhase.pdf',
    submittedDate: 'Apr 19, 2026',
    weight: '10%',
  },
  {
    id: 'a5',
    title: 'Final Project — Power System Design',
    description: 'Design a small-scale power distribution system for a hypothetical industrial facility. Your report must include load estimation, feeder sizing, transformer selection, protection coordination, and single-line diagram. Submit both PDF and AutoCAD/Visio source files.',
    dueDate: 'May 30, 2026',
    status: 'PENDING',
    maxGrade: 100,
    weight: '30%',
  },
];

const STATUS_CONFIG: Record<AssignmentStatus, { label: string; color: string; icon: React.ReactNode }> = {
  GRADED: { label: 'Graded', color: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: <CheckCircle2 size={12} /> },
  SUBMITTED: { label: 'Submitted', color: 'bg-blue-50 text-blue-700 border-blue-200', icon: <CheckCircle2 size={12} /> },
  PENDING: { label: 'Pending', color: 'bg-amber-50 text-amber-700 border-amber-200', icon: <Clock size={12} /> },
  OVERDUE: { label: 'Overdue', color: 'bg-red-50 text-red-700 border-red-200', icon: <AlertCircle size={12} /> },
};

const ClassAssignments: React.FC<Props> = ({ selectedClass, onBack }) => {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [uploadedFiles, setUploadedFiles] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState<Set<string>>(new Set());
  const [assignments, setAssignments] = useState<Assignment[]>(ASSIGNMENTS);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const graded = assignments.filter((a) => a.status === 'GRADED');
  const avgGrade =
    graded.length > 0
      ? Math.round(graded.reduce((sum, a) => sum + (a.grade ?? 0), 0) / graded.length)
      : 0;

  useEffect(() => {
    let active = true;

    const loadAssignments = async () => {
      setIsLoading(true);
      setLoadError(false);
      try {
        const remote = await fetchClassAssignments(selectedClass.id);
        if (active && remote.length > 0) {
          setAssignments(
            remote.map((assignment) => ({
              id: assignment.id,
              title: assignment.title,
              description: assignment.description,
              dueDate: assignment.dueDate,
              status: ['GRADED', 'SUBMITTED', 'PENDING', 'OVERDUE'].includes(
                assignment.status as AssignmentStatus,
              )
                ? (assignment.status as AssignmentStatus)
                : 'PENDING',
              grade: assignment.grade,
              maxGrade: assignment.maxGrade,
              feedback: assignment.feedback,
              submittedFile: assignment.submittedFile,
              submittedDate: assignment.submittedDate,
              weight: assignment.weight,
            })),
          );
        }
      } catch {
        if (active) setLoadError(true);
      } finally {
        if (active) setIsLoading(false);
      }
    };

    void loadAssignments();

    return () => {
      active = false;
    };
  }, [selectedClass.id]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, id: string) => {
    const file = e.target.files?.[0];
    if (file) setUploadedFiles((prev) => ({ ...prev, [id]: file.name }));
  };

  const handleSubmit = async (id: string) => {
    if (!uploadedFiles[id]) return;
    const assignment = assignments.find((a) => a.id === id);
    if (!assignment) return;

    setUploadingId(null);
    setSubmitted((prev) => new Set([...prev, id]));

    try {
      await submitAssignment({
        classId: selectedClass.id,
        assignmentId: assignment.id,
        studentId: 'demo-student',
        uploadedFile: uploadedFiles[id],
        submittedDate: new Date().toISOString(),
      });
    } catch {
      // keep the UI optimistic, but don't crash on failure.
    }
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

      <div className="mb-10">
        <p className="text-[10px] font-black uppercase tracking-[0.45em] text-slate-400 mb-2">
          {selectedClass.title}
        </p>
        <h1 className="text-4xl sm:text-5xl font-black uppercase text-[#1a202c] tracking-tight">
          Assignments
        </h1>
        <p className="mt-3 text-sm text-slate-500">
          {selectedClass.teacher} &nbsp;•&nbsp; {selectedClass.room}
        </p>
      </div>

      {isLoading && (
        <div className="mb-6 rounded-[2rem] border border-slate-200 bg-slate-50 p-6 text-slate-500 text-sm">
          Loading assignments...
        </div>
      )}
      {loadError && (
        <div className="mb-6 rounded-[2rem] border border-amber-200 bg-amber-50 p-6 text-amber-700 text-sm">
          Could not load assignments from the backend. Showing sample content.
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-10">
        {[
          { label: 'Total', value: assignments.length },
          { label: 'Graded', value: graded.length },
          { label: 'Pending', value: assignments.filter((a) => a.status === 'PENDING').length },
          { label: 'Avg Grade', value: `${avgGrade}%` },
        ].map((s) => (
          <div key={s.label} className="rounded-[2rem] border border-slate-200 bg-white p-5">
            <p className="text-[9px] font-black uppercase tracking-[0.4em] text-slate-400 mb-2">{s.label}</p>
            <p className="text-3xl font-black text-slate-900">{s.value}</p>
          </div>
        ))}
      </div>

      <div className="space-y-4">
        {assignments.map((a) => {
          const cfg = STATUS_CONFIG[submitted.has(a.id) ? 'SUBMITTED' : a.status];
          const isExpanded = expandedId === a.id;
          const isUploading = uploadingId === a.id;

          return (
            <div
              key={a.id}
              className="rounded-[2.5rem] border border-slate-200 bg-white overflow-hidden transition-all"
            >
              <div className="flex items-start justify-between gap-4 p-7">
                <div className="flex items-start gap-4 min-w-0 flex-1">
                  <div className="w-10 h-10 rounded-2xl bg-[#fce7ec] flex items-center justify-center flex-shrink-0">
                    <FileText size={18} className="text-[#3d0413]" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[8px] font-black uppercase tracking-[0.35em] border ${cfg.color}`}
                      >
                        {cfg.icon}
                        {cfg.label}
                      </span>
                      <span className="text-[9px] font-black uppercase tracking-[0.35em] text-slate-400 bg-slate-100 px-3 py-1.5 rounded-full">
                        Weight: {a.weight}
                      </span>
                    </div>
                    <h3 className="text-base font-black text-slate-900 mt-1">{a.title}</h3>
                    <p className="text-[10px] text-slate-400 uppercase tracking-[0.3em] mt-1">
                      Due: {a.dueDate}
                      {a.submittedDate && ` • Submitted: ${a.submittedDate}`}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 flex-shrink-0">
                  {a.grade !== undefined && (
                    <div className="text-right">
                      <p className="text-2xl font-black text-[#3d0413]">{a.grade}%</p>
                      <p className="text-[8px] text-slate-400 uppercase tracking-[0.35em]">/{a.maxGrade}</p>
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => setExpandedId(isExpanded ? null : a.id)}
                    className="p-3 rounded-2xl border border-slate-200 text-slate-400 hover:border-[#3d0413] hover:text-[#3d0413] transition-all"
                  >
                    {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </button>
                </div>
              </div>

              {isExpanded && (
                <div className="px-7 pb-7 border-t border-slate-100">
                  <div className="pt-6 space-y-5">
                    <div>
                      <p className="text-[9px] font-black uppercase tracking-[0.4em] text-slate-400 mb-2">Instructions</p>
                      <p className="text-sm text-slate-600 leading-relaxed">{a.description}</p>
                    </div>

                    {a.grade !== undefined && (
                      <div>
                        <p className="text-[9px] font-black uppercase tracking-[0.4em] text-slate-400 mb-2">Your Score</p>
                        <div className="h-3 rounded-full bg-slate-100 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-[#3d0413] transition-all"
                            style={{ width: `${a.grade}%` }}
                          />
                        </div>
                        <div className="flex justify-between mt-1">
                          <span className="text-[9px] text-slate-400">0</span>
                          <span className="text-[9px] font-black text-[#3d0413]">{a.grade}%</span>
                          <span className="text-[9px] text-slate-400">100</span>
                        </div>
                      </div>
                    )}

                    {a.feedback && (
                      <div className="rounded-2xl bg-emerald-50 border border-emerald-100 p-5">
                        <p className="text-[9px] font-black uppercase tracking-[0.4em] text-emerald-600 mb-2">
                          Lecturer Feedback
                        </p>
                        <p className="text-sm text-emerald-800 leading-relaxed">{a.feedback}</p>
                        <p className="text-[9px] text-emerald-500 mt-2 uppercase tracking-[0.3em]">
                          — {selectedClass.teacher}
                        </p>
                      </div>
                    )}

                    {a.submittedFile && (
                      <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4">
                        <FileText size={16} className="text-slate-400" />
                        <span className="text-sm font-bold text-slate-700">{a.submittedFile}</span>
                        <span className="ml-auto text-[9px] text-slate-400 uppercase tracking-[0.3em]">
                          Submitted
                        </span>
                      </div>
                    )}

                    {a.status === 'PENDING' && !submitted.has(a.id) && (
                      <div>
                        {!isUploading ? (
                          <button
                            type="button"
                            onClick={() => setUploadingId(a.id)}
                            className="inline-flex items-center gap-2 px-7 py-4 bg-[#3d0413] text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.35em] hover:opacity-85 transition"
                          >
                            <Upload size={14} />
                            Submit Assignment
                          </button>
                        ) : (
                          <div className="rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 p-6">
                            <p className="text-[9px] font-black uppercase tracking-[0.4em] text-slate-400 mb-4">
                              Upload Your File
                            </p>
                            <div className="flex flex-wrap items-center gap-3">
                              <input
                                ref={fileRef}
                                type="file"
                                accept=".pdf,.doc,.docx,.zip"
                                className="hidden"
                                onChange={(e) => handleFileChange(e, a.id)}
                              />
                              <button
                                type="button"
                                onClick={() => fileRef.current?.click()}
                                className="px-5 py-3 rounded-2xl border border-slate-200 bg-white text-[9px] font-black uppercase tracking-[0.35em] text-slate-600 hover:border-[#3d0413] transition"
                              >
                                Browse Files
                              </button>
                              {uploadedFiles[a.id] && (
                                <span className="text-sm font-bold text-slate-700">{uploadedFiles[a.id]}</span>
                              )}
                              <button
                                type="button"
                                onClick={() => handleSubmit(a.id)}
                                disabled={!uploadedFiles[a.id]}
                                className="px-5 py-3 rounded-2xl bg-[#3d0413] text-white text-[9px] font-black uppercase tracking-[0.35em] disabled:opacity-40 hover:opacity-85 transition"
                              >
                                Submit
                              </button>
                              <button
                                type="button"
                                onClick={() => setUploadingId(null)}
                                className="p-3 text-slate-400 hover:text-slate-700"
                              >
                                <X size={16} />
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {submitted.has(a.id) && (
                      <div className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-emerald-50 text-emerald-700 text-[9px] font-black uppercase tracking-[0.35em] border border-emerald-200">
                        <CheckCircle2 size={14} />
                        Submitted — {uploadedFiles[a.id]}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ClassAssignments;
