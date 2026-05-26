import React, { useEffect, useState } from 'react';
import { ArrowLeft, Calendar, Clock, MapPin, BookOpen, AlertCircle } from 'lucide-react';
import { fetchClassSchedule, type ClassScheduleEvent, type ClassScheduleSession } from '../lib/classContentService';

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

type SessionType = 'LECTURE' | 'PRACTICAL' | 'TUTORIAL' | 'CAT' | 'EXAM';

interface Session {
  id: string;
  day: string;
  time: string;
  endTime: string;
  type: SessionType;
  room: string;
  topic: string;
  week: number;
}

interface UpcomingEvent {
  date: string;
  month: string;
  day: string;
  label: string;
  type: 'DEADLINE' | 'EXAM' | 'EVENT' | 'RESULTS';
  note?: string;
}

const WEEKLY_SESSIONS: Session[] = [
  { id: 's1', day: 'Monday', time: '05:00 AM', endTime: '07:00 AM', type: 'LECTURE', room: 'Lab 2', topic: 'Power System Protection', week: 10 },
  { id: 's2', day: 'Wednesday', time: '05:00 AM', endTime: '07:00 AM', type: 'PRACTICAL', room: 'Lab 2', topic: 'Relay Testing Lab', week: 10 },
  { id: 's3', day: 'Friday', time: '05:00 AM', endTime: '07:00 AM', type: 'TUTORIAL', room: 'Lab 2', topic: 'Exam Revision — Load Flow & Faults', week: 10 },
];

const UPCOMING: UpcomingEvent[] = [
  { date: 'May 20', month: 'MAY', day: '20', label: 'Final Project Submission Deadline', type: 'DEADLINE', note: 'Submit PDF + source files on the portal' },
  { date: 'May 26', month: 'MAY', day: '26', label: 'End of Semester CAT', type: 'EXAM', note: 'Lab 2 — 05:00 AM. Open notes allowed.' },
  { date: 'Jun 2', month: 'JUN', day: '02', label: 'Semester Break Begins', type: 'EVENT' },
  { date: 'Jun 10', month: 'JUN', day: '10', label: 'Final Exam — Power Systems II', type: 'EXAM', note: 'Examination Hall A — 08:00 AM. Closed book.' },
  { date: 'Jun 20', month: 'JUN', day: '20', label: 'Semester Results Released', type: 'RESULTS' },
];

const SESSION_COLORS: Record<SessionType, { bg: string; text: string; dot: string }> = {
  LECTURE: { bg: 'bg-[#fce7ec]', text: 'text-[#3d0413]', dot: 'bg-[#3d0413]' },
  PRACTICAL: { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  TUTORIAL: { bg: 'bg-blue-50', text: 'text-blue-700', dot: 'bg-blue-500' },
  CAT: { bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-500' },
  EXAM: { bg: 'bg-red-50', text: 'text-red-700', dot: 'bg-red-500' },
};

const EVENT_COLORS: Record<UpcomingEvent['type'], { card: string; date: string; badge: string; badgeText: string }> = {
  DEADLINE: { card: 'border-amber-200', date: 'bg-amber-50 text-amber-700', badge: 'bg-amber-50 text-amber-700 border-amber-200', badgeText: 'Deadline' },
  EXAM: { card: 'border-red-200', date: 'bg-red-50 text-red-700', badge: 'bg-red-50 text-red-700 border-red-200', badgeText: 'Exam' },
  EVENT: { card: 'border-slate-200', date: 'bg-slate-100 text-slate-600', badge: 'bg-slate-50 text-slate-600 border-slate-200', badgeText: 'Event' },
  RESULTS: { card: 'border-emerald-200', date: 'bg-emerald-50 text-emerald-700', badge: 'bg-emerald-50 text-emerald-700 border-emerald-200', badgeText: 'Results' },
};

const DAYS_ORDER = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const ClassSchedule: React.FC<Props> = ({ selectedClass, onBack }) => {
  const [addedToCalendar, setAddedToCalendar] = useState<Set<string>>(new Set());
  const [allAdded, setAllAdded] = useState(false);
  const [sessions, setSessions] = useState<Session[]>(WEEKLY_SESSIONS);
  const [upcoming, setUpcoming] = useState<UpcomingEvent[]>(UPCOMING);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);

  const handleAddEvent = (id: string) => {
    setAddedToCalendar((prev) => new Set([...prev, id]));
  };

  const handleAddAll = () => {
    setAllAdded(true);
    setAddedToCalendar(new Set(upcoming.map((_, i) => String(i))));
  };

  useEffect(() => {
    let active = true;

    const loadSchedule = async () => {
      setIsLoading(true);
      setLoadError(false);
      try {
        const remote = await fetchClassSchedule(selectedClass.id);
        if (!active) return;

        setSessions(
          remote.weeklySessions.length > 0
            ? remote.weeklySessions.map((session) => ({
                id: session.id,
                day: session.day,
                time: session.startTime,
                endTime: session.endTime,
                type: session.sessionType as SessionType,
                room: session.room,
                topic: session.topic,
                week: session.week,
              }))
            : WEEKLY_SESSIONS,
        );
        setUpcoming(
          remote.upcomingEvents.length > 0
            ? remote.upcomingEvents.map((event) => {
                const [month, day] = event.date.split(' ');
                return {
                  date: event.date,
                  month: month?.toUpperCase() ?? 'TBD',
                  day: day ?? '00',
                  label: event.label,
                  type: event.eventType as UpcomingEvent['type'],
                  note: event.note,
                };
              })
            : UPCOMING,
        );
      } catch {
        if (active) setLoadError(true);
      } finally {
        if (active) setIsLoading(false);
      }
    };

    void loadSchedule();

    return () => {
      active = false;
    };
  }, [selectedClass.id]);

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
            Class Schedule
          </h1>
          <p className="mt-3 text-sm text-slate-500">
            {selectedClass.teacher} &nbsp;•&nbsp; {selectedClass.room}
          </p>
        </div>
        <button
          type="button"
          onClick={handleAddAll}
          className={`inline-flex items-center gap-2 px-6 py-4 rounded-2xl text-[10px] font-black uppercase tracking-[0.35em] transition-all ${
            allAdded
              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
              : 'bg-[#3d0413] text-white hover:opacity-85'
          }`}
        >
          <Calendar size={14} />
          {allAdded ? '✓ All Added to Calendar' : 'Add All to Calendar'}
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-10">
        {[
          { label: 'Sessions / Week', value: '3' },
          { label: 'Hours / Week', value: '6 hrs' },
          { label: 'Next Session', value: 'Mon 05:00' },
          { label: 'Exams Upcoming', value: '2' },
        ].map((s) => (
          <div key={s.label} className="rounded-[2rem] border border-slate-200 bg-white p-5">
            <p className="text-[9px] font-black uppercase tracking-[0.4em] text-slate-400 mb-2">{s.label}</p>
            <p className="text-2xl font-black text-slate-900">{s.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-8">
        <div>
          <div className="flex items-center gap-2 mb-5">
            <BookOpen size={16} className="text-slate-400" />
            <p className="text-[9px] font-black uppercase tracking-[0.4em] text-slate-400">
              Weekly Recurring Timetable
            </p>
          </div>

          <div className="flex flex-wrap gap-3 mb-6">
            {(Object.entries(SESSION_COLORS) as [SessionType, typeof SESSION_COLORS[SessionType]][]).map(([type, c]) => (
              <span
                key={type}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[8px] font-black uppercase tracking-[0.3em] ${c.bg} ${c.text}`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
                {type}
              </span>
            ))}
          </div>

          <div className="rounded-[2.5rem] border border-slate-200 bg-white overflow-hidden">
            {DAYS_ORDER.map((day, di) => {
              const sessionsForDay = sessions.filter((s) => s.day === day);
              if (sessionsForDay.length === 0 && day !== 'Monday' && day !== 'Wednesday' && day !== 'Friday') return null;

              return (
                <div
                  key={day}
                  className={`${di < DAYS_ORDER.length - 1 ? 'border-b border-slate-100' : ''}`}
                >
                  <div className="flex items-center gap-3 px-7 py-4 bg-slate-50/60">
                    <span className="text-[9px] font-black uppercase tracking-[0.4em] text-slate-500 min-w-[90px]">
                      {day}
                    </span>
                    {sessions.length === 0 && (
                      <span className="text-[9px] text-slate-300 uppercase tracking-[0.3em]">No session</span>
                    )}
                  </div>
                  {sessionsForDay.map((s) => {
                    const sc = SESSION_COLORS[s.type];
                    return (
                      <div key={s.id} className="flex items-start gap-5 px-7 py-5 hover:bg-slate-50/50 transition-colors">
                        <div className="flex flex-col items-center gap-1 flex-shrink-0 w-16">
                          <div className={`w-2 h-2 rounded-full ${sc.dot}`} />
                          <div className="h-full w-px bg-slate-100 flex-1 min-h-[30px]" />
                        </div>
                        <div className="flex-1">
                          <div className="flex flex-wrap items-center gap-2 mb-2">
                            <span
                              className={`text-[8px] font-black uppercase tracking-[0.35em] px-3 py-1.5 rounded-full ${sc.bg} ${sc.text}`}
                            >
                              {s.type}
                            </span>
                            <span className="text-[9px] font-black text-[#3d0413] uppercase tracking-[0.3em]">
                              Week {s.week}
                            </span>
                          </div>
                          <p className="text-sm font-bold text-slate-900">{s.topic}</p>
                          <div className="flex flex-wrap items-center gap-4 mt-2">
                            <span className="inline-flex items-center gap-1.5 text-[10px] text-slate-500">
                              <Clock size={12} /> {s.time} – {s.endTime}
                            </span>
                            <span className="inline-flex items-center gap-1.5 text-[10px] text-slate-500">
                              <MapPin size={12} /> {s.room}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>

        <div>
          <div className="flex items-center gap-2 mb-5">
            <AlertCircle size={16} className="text-slate-400" />
            <p className="text-[9px] font-black uppercase tracking-[0.4em] text-slate-400">
              Upcoming Key Dates
            </p>
          </div>

          <div className="space-y-4">
            {upcoming.map((e, i) => {
              const ec = EVENT_COLORS[e.type];
              const isAdded = addedToCalendar.has(String(i));
              return (
                <div
                  key={i}
                  className={`rounded-[2rem] border bg-white p-5 transition-all ${ec.card}`}
                >
                  <div className="flex items-start gap-4">
                    <div
                      className={`flex flex-col items-center justify-center rounded-2xl min-w-[52px] min-h-[52px] px-2 py-2 ${ec.date} flex-shrink-0`}
                    >
                      <span className="text-[8px] font-black uppercase tracking-[0.3em]">{e.month}</span>
                      <span className="text-xl font-black leading-none">{e.day}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <p className="text-sm font-bold text-slate-900">{e.label}</p>
                        <span
                          className={`text-[8px] font-black uppercase tracking-[0.3em] px-2.5 py-1 rounded-full border flex-shrink-0 ${ec.badge}`}
                        >
                          {ec.badgeText}
                        </span>
                      </div>
                      {e.note && (
                        <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">{e.note}</p>
                      )}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleAddEvent(String(i))}
                    className={`mt-4 w-full py-3 rounded-2xl text-[9px] font-black uppercase tracking-[0.35em] transition-all border ${
                      isAdded
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : 'bg-white text-slate-600 border-slate-200 hover:border-[#3d0413] hover:text-[#3d0413]'
                    }`}
                  >
                    {isAdded ? '✓ Added to Calendar' : '+ Add to Calendar'}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ClassSchedule;
