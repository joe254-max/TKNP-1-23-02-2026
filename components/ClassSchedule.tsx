import React, { useState } from 'react';

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

type SessionType = 'Lecture' | 'Practical' | 'Tutorial';

interface Session {
  id: string;
  day: 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri';
  type: SessionType;
  topic: string;
  time: string;
  room: string;
  week: number;
}

const seededSessions: Session[] = [
  { id: 's1', day: 'Mon', type: 'Lecture', topic: 'Power Flow Basics', time: '08:00 - 09:30', room: 'Room 1', week: 1 },
  { id: 's2', day: 'Wed', type: 'Practical', topic: 'Transformer Lab', time: '10:00 - 12:00', room: 'Lab 2', week: 1 },
  { id: 's3', day: 'Fri', type: 'Tutorial', topic: 'Problem Solving', time: '09:00 - 10:00', room: 'Room 3', week: 1 },
  { id: 's4', day: 'Mon', type: 'Lecture', topic: 'React Basics', time: '11:00 - 12:30', room: 'Room 4', week: 2 },
  { id: 's5', day: 'Wed', type: 'Practical', topic: 'Circuit Testing', time: '13:00 - 15:00', room: 'Lab 1', week: 2 },
];

const eventSeed = [
  { id: 'e1', title: 'Assignment Deadline', date: '2026-05-25', type: 'deadline' },
  { id: 'e2', title: 'CAT 2', date: '2026-06-01', type: 'exam' },
  { id: 'e3', title: 'Semester Break', date: '2026-06-15', type: 'event' },
  { id: 'e4', title: 'Final Exam', date: '2026-07-10', type: 'exam' },
  { id: 'e5', title: 'Results Day', date: '2026-07-25', type: 'results' },
];

const typeColor = (t: SessionType) => {
  if (t === 'Lecture') return 'bg-rose-100 text-rose-700';
  if (t === 'Practical') return 'bg-emerald-100 text-emerald-700';
  return 'bg-sky-100 text-sky-700';
};

const ClassSchedule: React.FC<Props> = ({ selectedClass, onBack }) => {
  const [events, setEvents] = useState(eventSeed);
  const [addedToCalendar, setAddedToCalendar] = useState<Record<string, boolean>>({});
  const [allAdded, setAllAdded] = useState(false);

  const addOne = (id: string) => setAddedToCalendar((p) => ({ ...p, [id]: true }));
  const addAll = () => { eventSeed.forEach((e) => addOne(e.id)); setAllAdded(true); };

  return (
    <div className="min-h-screen p-6 bg-slate-50">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <button onClick={onBack} className="inline-flex items-center gap-3 text-slate-500 text-[10px] font-black uppercase tracking-[0.35em]">← Back to Class</button>
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-black uppercase tracking-tight">{selectedClass.title}</h2>
            <button onClick={addAll} className={`rounded-2xl px-4 py-3 text-[10px] font-black uppercase tracking-[0.35em] ${allAdded ? 'bg-emerald-600 text-white' : 'bg-[#3d0413] text-white'}`}>Add All to Calendar</button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="rounded-[2.5rem] bg-white border border-slate-200 p-4">
            <h3 className="text-sm font-black uppercase tracking-[0.35em] text-slate-400 mb-4">Weekly Timetable</h3>
            <div className="space-y-4">
              {(['Mon','Wed','Fri'] as const).map((d) => (
                <div key={d} className="rounded-2xl border border-slate-100 p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-[10px] font-black uppercase tracking-[0.35em]">{d}</div>
                    <div className="text-sm text-slate-500">Sessions</div>
                  </div>
                  <div className="space-y-2">
                    {seededSessions.filter(s => s.day === d).map(s => (
                      <div key={s.id} className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 border border-slate-100">
                        <div className="flex items-center gap-3">
                          <div className={`px-3 py-2 rounded-2xl ${typeColor(s.type)} font-black text-[10px] uppercase`}>{s.type}</div>
                          <div>
                            <div className="font-black">{s.topic}</div>
                            <div className="text-sm text-slate-500">{s.time} • {s.room} • W{String(s.week).padStart(2,'0')}</div>
                          </div>
                        </div>
                        <div className="text-sm text-slate-500">{s.week}</div>
                      </div>
                    ))}
                    {seededSessions.filter(s => s.day === d).length === 0 && (
                      <div className="text-sm text-slate-400">No sessions</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 text-sm text-slate-500">Legend: <span className="ml-2 px-2 py-1 rounded-2xl bg-rose-100 text-rose-700">Lecture</span> <span className="ml-2 px-2 py-1 rounded-2xl bg-emerald-100 text-emerald-700">Practical</span> <span className="ml-2 px-2 py-1 rounded-2xl bg-sky-100 text-sky-700">Tutorial</span></div>
          </div>

          <div className="rounded-[2.5rem] bg-white border border-slate-200 p-4">
            <h3 className="text-sm font-black uppercase tracking-[0.35em] text-slate-400 mb-4">Upcoming Key Dates</h3>
            <div className="space-y-3">
              {events.map(e => (
                <div key={e.id} className="flex items-center justify-between p-3 rounded-2xl border border-slate-100">
                  <div className="flex items-center gap-3">
                    <div className={`h-10 w-10 rounded-md flex items-center justify-center font-black ${e.type === 'deadline' ? 'bg-amber-100 text-amber-700' : e.type === 'exam' ? 'bg-rose-100 text-rose-700' : e.type === 'results' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>{new Date(e.date).getDate()}</div>
                    <div>
                      <div className="font-black">{e.title}</div>
                      <div className="text-sm text-slate-500">{new Date(e.date).toLocaleDateString()}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <button onClick={() => { addOne: (() => {}) }} className="hidden" />
                    <button
                      onClick={() => { setEvents((prev) => prev); setAddedToCalendar((p) => ({ ...p, [e.id]: true })); }}
                      className={`rounded-2xl px-4 py-3 text-[10px] font-black uppercase tracking-[0.35em] ${addedToCalendar[e.id] ? 'bg-emerald-600 text-white' : 'bg-[#3d0413] text-white'}`}
                    >
                      {addedToCalendar[e.id] ? '✓ Added' : '+ Add to Calendar'}
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6 grid grid-cols-2 gap-3">
              <div className="rounded-[2rem] bg-white border border-slate-200 p-4">
                <p className="text-[9px] font-black uppercase tracking-[0.35em] text-slate-400">Sessions / Week</p>
                <div className="text-2xl font-black mt-2">3</div>
              </div>
              <div className="rounded-[2rem] bg-white border border-slate-200 p-4">
                <p className="text-[9px] font-black uppercase tracking-[0.35em] text-slate-400">Hours / Week</p>
                <div className="text-2xl font-black mt-2">6</div>
              </div>
              <div className="rounded-[2rem] bg-white border border-slate-200 p-4">
                <p className="text-[9px] font-black uppercase tracking-[0.35em] text-slate-400">Next Session</p>
                <div className="text-2xl font-black mt-2">Mon 08:00</div>
              </div>
              <div className="rounded-[2rem] bg-white border border-slate-200 p-4">
                <p className="text-[9px] font-black uppercase tracking-[0.35em] text-slate-400">Exams Upcoming</p>
                <div className="text-2xl font-black mt-2">2</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ClassSchedule;
