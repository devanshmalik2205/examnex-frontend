import React, { useState, useEffect } from 'react';
import { 
  Users, CalendarDays, Loader2, Download, AlertTriangle, 
  CheckCircle, Play, FileSpreadsheet, RefreshCw
} from 'lucide-react';
import * as XLSX from 'xlsx';

export default function ExamScheduleAssigner() {
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [data, setData] = useState({ exams: [], teachers: [] });
  const [assignments, setAssignments] = useState(null);
  const [stats, setStats] = useState(null);
  const [error, setError] = useState('');

  const backendUrl = import.meta.env?.VITE_BACKEND_URL || 'http://localhost:5000';

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${backendUrl}/api/admin/exam-assigner/data`);
      if (!res.ok) throw new Error('Failed to fetch data');
      const json = await res.json();
      setData(json);
    } catch (err) {
      setError('Could not load schedule or faculty data. Please ensure the schedule is generated first.');
    } finally {
      setLoading(false);
    }
  };

  // Helper: Convert time strings like '9:00', '14:30', or '2:00 PM' into total minutes for safe math comparison
  const timeToMins = (tStr) => {
      if (!tStr) return 0;
      const str = String(tStr).trim().toLowerCase();
      const isPM = str.includes('pm');
      const isAM = str.includes('am');
      
      const match = str.match(/(\d+)[^\d]*(\d*)/);
      if (!match) return 0;
      
      let hours = parseInt(match[1], 10) || 0;
      const mins = parseInt(match[2], 10) || 0;
      
      if (isPM && hours < 12) hours += 12;
      if (isAM && hours === 12) hours = 0;
      
      return hours * 60 + mins;
  };

  // Helper: Classify time into general shifts to prevent contiguous double bookings
  const getShift = (timeStr) => {
      const mins = timeToMins(timeStr);
      const hour = Math.floor(mins / 60);
      if (hour < 12) return 'M';
      if (hour < 15) return 'A';
      return 'E';
  };

  // Format Date and Time safely avoiding timezone shifts
  const formatSlotKey = (dateStr, timeStr) => {
    if (!dateStr || !timeStr) return '';
    
    let day;
    const dStr = String(dateStr).trim();
    if (dStr.match(/^\d{4}-\d{2}-\d{2}/)) {
        day = parseInt(dStr.substring(8, 10), 10);
    } else {
        const dt = new Date(dateStr);
        if (!isNaN(dt.getTime())) day = dt.getDate();
        else day = dStr.substring(0, 3).toUpperCase();
    }
    
    const shift = getShift(timeStr);
    return `${day}${shift}`;
  };

  const runAssignmentAlgorithm = () => {
    setGenerating(true);
    setTimeout(() => {
      try {
        const { exams, teachers } = data;

        if (!teachers || teachers.length === 0) {
            setError('No faculty members found in the system! You must add teachers or import allocations before assigning duties.');
            setGenerating(false);
            return;
        }

        // 1. Initialize teacher tracking structures safely
        const facultyTrackers = teachers.map(t => {
          const typeStr = (t.teacher_type || 'Faculty').toLowerCase();
          return {
            ...t,
            isPhD: typeStr.includes('phd') || typeStr.includes('scholar'),
            isLab: typeStr.includes('lab') || typeStr.includes('engineer'),
            isFaculty: !typeStr.includes('phd') && !typeStr.includes('lab') && !typeStr.includes('scholar') && !typeStr.includes('engineer'),
            roleClass: typeStr.includes('assistant') ? 'assistant' : 
                       typeStr.includes('associate') ? 'associate' : 
                       typeStr.includes('professor') ? 'professor' : 'other',
            coursesTaught: Array.isArray(t.courses_taught) ? t.courses_taught : (typeof t.courses_taught === 'string' ? JSON.parse(t.courses_taught || '[]') : []),
            ownDuties: [],
            otherDuties: [],
            totalDuties: 0,
            assignedSlots: [], // Upgraded to Array for robust time overlap checking
            maxDuties: 0
          };
        });

        // Set baseline max duties per rules
        facultyTrackers.forEach(f => {
          if (f.isPhD) f.maxDuties = 3;
          else if (f.isLab) f.maxDuties = 3;
          else if (f.roleClass === 'assistant') f.maxDuties = 3;
          else if (f.roleClass === 'associate') f.maxDuties = 2;
          else if (f.roleClass === 'professor') f.maxDuties = 1; 
          else f.maxDuties = 3; 
        });

        // 2. Group Exams by Room, Date, and Time (Unique Invigilation Session)
        const roomSessions = new Map();
        exams.forEach(rawExam => {
          // CRITICAL FIX: Split comma-separated rooms so they generate distinct sessions requiring distinct teachers
          const roomList = rawExam.room ? String(rawExam.room).split(',').map(r => r.trim()).filter(Boolean) : ['TBA'];
          
          roomList.forEach(singleRoom => {
              const exam = { ...rawExam, room: singleRoom };
              const assignedRoom = (singleRoom === 'TBA') ? `Room TBA (${exam.course_code})` : singleRoom;
              
              // Normalize strings to prevent mismatch splits
              const safeDate = String(exam.date || '').trim().toLowerCase();
              const safeTime = String(exam.start_time || '').trim().toLowerCase();
              
              const key = `${safeDate}_${safeTime}_${assignedRoom}`;
              
              if (!roomSessions.has(key)) {
                roomSessions.set(key, {
                  key,
                  date: exam.date,
                  startTime: exam.start_time,
                  endTime: exam.end_time,
                  room: assignedRoom,
                  courses: new Set(),
                  batches: new Set(),
                  rawExams: [],
                  invigilator: null
                });
              }
              const session = roomSessions.get(key);
              session.courses.add(exam.course_code);
              if (exam.stream !== 'GENERIC') {
                  session.batches.add(`${exam.stream} S${exam.semester}`);
              }
              session.rawExams.push(exam);
          });
        });

        const sessionsArray = Array.from(roomSessions.values());

        // STRICT LOCKOUT CHECKER: Prevents teachers from double booking via Minutes AND Shifts
        const isTeacherBusy = (teacher, session) => {
            const sessDate = String(session.date || '').trim().toLowerCase();
            const sStart = timeToMins(session.startTime);
            const sEnd = timeToMins(session.endTime) || (sStart + 180);
            const sShift = getShift(session.startTime);
            
            return teacher.assignedSlots.some(slot => {
                const slotDate = String(slot.date || '').trim().toLowerCase();
                if (slotDate !== sessDate) return false; // Different day, they are not busy
                
                const slotStart = timeToMins(slot.startTime);
                const slotEnd = timeToMins(slot.endTime) || (slotStart + 180);
                const slotShift = getShift(slot.startTime);
                
                // 1. Minute-by-minute overlap: Start A < End B AND Start B < End A
                const isOverlapping = (sStart < slotEnd && slotStart < sEnd);
                
                // 2. Same shift check: Prevents assigning two exams in the same half-day (Morning/Afternoon)
                const isSameShift = (sShift === slotShift);
                
                return isOverlapping || isSameShift;
            });
        };

        // Helper to assign a teacher to a session and lock their time
        const assignTeacher = (teacher, session, dutyType) => {
          teacher.totalDuties++;
          
          // Lock out this specific time block for this teacher to prevent double-booking
          teacher.assignedSlots.push({
              date: session.date,
              startTime: session.startTime,
              endTime: session.endTime
          });
          
          const slotCode = formatSlotKey(session.date, session.startTime);
          // INCLUDE ROOM IN THE DUTY OUTPUT STRING
          const dutyRecord = `${slotCode} [${session.room}]`;
          
          if (dutyType === 'own') teacher.ownDuties.push(dutyRecord);
          else teacher.otherDuties.push(dutyRecord);
          
          session.invigilator = { name: teacher.full_name, type: teacher.teacher_type || 'Faculty' };
        };

        // 3. Assign "Own" Duties first (Faculty evaluating their own courses)
        sessionsArray.forEach(session => {
          const sessionCourses = Array.from(session.courses);
          
          const eligibleOwnTeachers = facultyTrackers.filter(t => 
            t.isFaculty && 
            t.coursesTaught.some(c => sessionCourses.includes(c)) &&
            !isTeacherBusy(t, session) && // Enforce double booking lockout
            t.totalDuties < t.maxDuties
          );

          if (eligibleOwnTeachers.length > 0) {
            eligibleOwnTeachers.sort((a, b) => a.totalDuties - b.totalDuties);
            assignTeacher(eligibleOwnTeachers[0], session, 'own');
          }
        });

        const unassignedSessions = sessionsArray.filter(s => !s.invigilator);

        // Sorting/Priority logic helper
        const assignFromPool = (pool, session, dutyType = 'other') => {
          const available = pool.filter(t => 
            !isTeacherBusy(t, session) && // Enforce double booking lockout
            t.totalDuties < t.maxDuties
          );

          if (available.length === 0) return false;

          available.sort((a, b) => {
            const aNeedsMandatory = (a.isFaculty && a.ownDuties.length > 0 && a.otherDuties.length === 0) ? -1 : 0;
            const bNeedsMandatory = (b.isFaculty && b.ownDuties.length > 0 && b.otherDuties.length === 0) ? -1 : 0;
            if (aNeedsMandatory !== bNeedsMandatory) return aNeedsMandatory - bNeedsMandatory;
            return a.totalDuties - b.totalDuties;
          });

          assignTeacher(available[0], session, dutyType);
          return true;
        };

        // 4. Waterfall Assignment for "Other" duties
        const pools = {
          phd: facultyTrackers.filter(t => t.isPhD),
          lab: facultyTrackers.filter(t => t.isLab),
          asst: facultyTrackers.filter(t => t.isFaculty && t.roleClass === 'assistant'),
          assoc: facultyTrackers.filter(t => t.isFaculty && t.roleClass === 'associate'),
          prof: facultyTrackers.filter(t => t.isFaculty && t.roleClass === 'professor')
        };

        unassignedSessions.forEach(session => {
          if (assignFromPool(pools.phd, session)) return;
          if (assignFromPool(pools.lab, session)) return;
          if (assignFromPool(pools.asst, session)) return;
          if (assignFromPool(pools.assoc, session)) return;
          if (assignFromPool(pools.prof, session)) return;

          // DESPERATE FALLBACK: If standard caps are maxed out, assign ANY free teacher ignoring max limits!
          const anyFree = facultyTrackers.filter(t => !isTeacherBusy(t, session));
          if (anyFree.length > 0) {
              // Pick the one with the absolute lowest current burden
              anyFree.sort((a, b) => a.totalDuties - b.totalDuties);
              assignTeacher(anyFree[0], session, 'other');
          }
        });

        setAssignments({
          sessions: sessionsArray,
          trackers: facultyTrackers
        });

        setStats({
          totalRooms: sessionsArray.length,
          assignedRooms: sessionsArray.filter(s => s.invigilator).length,
          unassignedRooms: sessionsArray.filter(s => !s.invigilator).length,
        });

        setGenerating(false);
      } catch (err) {
        console.error(err);
        setError('Error generating assignments. Please check console for details.');
        setGenerating(false);
      }
    }, 800);
  };

const exportExcel = () => {
    if (!assignments) return;
    
    try {
      const wb = XLSX.utils.book_new();
      const { trackers, sessions } = assignments;

      // 1. Faculty Sheet (Widened columns for longer duty strings with rooms)
      const facultyData = trackers.filter(t => t.isFaculty && t.totalDuties > 0).sort((a,b) => a.full_name.localeCompare(b.full_name));
      const facultyAoA = [
        ["Faculty Name", "Own Exam", "Own Exam", "Own Exam", "Other Exam", "Other Exam", "Other Exam"]
      ];
      facultyData.forEach(f => {
        facultyAoA.push([
          f.full_name,
          f.ownDuties[0] || '', f.ownDuties[1] || '', f.ownDuties[2] || '',
          f.otherDuties[0] || '', f.otherDuties[1] || '', f.otherDuties[2] || ''
        ]);
      });
      const wsFaculty = XLSX.utils.aoa_to_sheet(facultyAoA);
      wsFaculty['!cols'] = [{ wch: 30 }, { wch: 22 }, { wch: 22 }, { wch: 22 }, { wch: 22 }, { wch: 22 }, { wch: 22 }];
      XLSX.utils.book_append_sheet(wb, wsFaculty, "Faculty Duties");

      // 2. Lab Staff Sheet
      const labData = trackers.filter(t => t.isLab && t.totalDuties > 0);
      const labAoA = [["S.No.", "Lab Staff Name", "Duties"]];
      labData.forEach((l, idx) => {
        const allDuties = [...l.ownDuties, ...l.otherDuties].join(' | ');
        labAoA.push([idx + 1, l.full_name, allDuties]);
      });
      const wsLab = XLSX.utils.aoa_to_sheet(labAoA);
      wsLab['!cols'] = [{ wch: 8 }, { wch: 25 }, { wch: 45 }];
      XLSX.utils.book_append_sheet(wb, wsLab, "Lab Staff");

      // 3. PhD Scholars Sheet
      const phdData = trackers.filter(t => t.isPhD && t.totalDuties > 0);
      const phdAoA = [["S.No.", "Name", "School", "Duties"]];
      phdData.forEach((p, idx) => {
        const allDuties = [...p.ownDuties, ...p.otherDuties].join(' | ');
        phdAoA.push([idx + 1, p.full_name, "SOET", allDuties]);
      });
      const wsPhd = XLSX.utils.aoa_to_sheet(phdAoA);
      wsPhd['!cols'] = [{ wch: 8 }, { wch: 25 }, { wch: 15 }, { wch: 45 }];
      XLSX.utils.book_append_sheet(wb, wsPhd, "PhD Scholars");

      // 4. Datesheets (Grouped by Date and Slot)
      const groupedByTime = {};
      sessions.forEach(s => {
        const timeKey = `${s.date}_${s.startTime}`;
        if (!groupedByTime[timeKey]) groupedByTime[timeKey] = [];
        groupedByTime[timeKey].push(s);
      });

      Object.entries(groupedByTime).forEach(([timeKey, sList], idx) => {
        const dObj = new Date(sList[0].date);
        const isValidDate = !isNaN(dObj.getTime());
        const dateStr = isValidDate ? dObj.toLocaleDateString('en-GB') : sList[0].date; 
        const dayStr = isValidDate ? dObj.toLocaleDateString('en-US', { weekday: 'long' }).toUpperCase() : '';
        
        // Use timeToMins for accurate AM/PM parsing to avoid 12-hour format bugs
        const mins = timeToMins(sList[0].startTime);
        const h = Math.floor(mins / 60);
        const shift = h < 12 ? 'MORNING' : h < 15 ? 'AFTERNOON' : 'EVENING';

        let datePrefix = isValidDate ? dObj.getDate() : String(sList[0].date).substring(0, 5);
        // Strip invalid Excel characters from sheet name just in case
        let sheetName = `${datePrefix}_${shift}`.substring(0, 31).replace(/[\\\/\?\*\[\]]/g, '_');
        
        // CRITICAL FIX: Ensure sheet names are unique to prevent xlsx crash
        if (wb.SheetNames.includes(sheetName)) {
            sheetName = `${sheetName.substring(0, 26)}_${idx}`;
        }
        
        const aoa = [];
        aoa.push(["BML MUNJAL UNIVERSITY"]);
        aoa.push(["(SoET Examination)"]);
        aoa.push(["MID TERM EXAMINATIONS"]);
        aoa.push([`Date - ${dateStr} ${dayStr ? `(${dayStr})` : ''} ${shift}`]);
        aoa.push([]);
        
        const headerRow = [
          "S#", "Batch", "Course Code", "Course Title", "Room No.", 
          "Invigilators Name", "Time", "Signature", 
          "Booklets Issued (M)", "Booklets Issued (S)", 
          "Booklets Returned (M)", "Booklets Returned (S)", 
          "Signature", "USED", "UNUSED"
        ];
        aoa.push(headerRow);

        let rowNum = 1;
        sList.forEach(session => {
          session.rawExams.forEach(exam => {
            aoa.push([
              rowNum++,
              exam.stream === 'GENERIC' ? 'Global / Common' : `${exam.stream} Sem ${exam.semester}`,
              exam.course_code,
              exam.course_title,
              session.room,
              session.invigilator ? session.invigilator.name : 'TBA',
              `${session.startTime} - ${session.endTime}`,
              "", "", "", "", "", "", "", ""
            ]);
          });
        });

        const ws = XLSX.utils.aoa_to_sheet(aoa);
        ws['!cols'] = [
          { wch: 5 }, { wch: 15 }, { wch: 15 }, { wch: 35 }, { wch: 18 }, 
          { wch: 25 }, { wch: 15 }, { wch: 12 }, { wch: 15 }, { wch: 15 },
          { wch: 18 }, { wch: 18 }, { wch: 12 }, { wch: 10 }, { wch: 10 }
        ];

        ws['A1'].s = { font: { bold: true } };
        
        XLSX.utils.book_append_sheet(wb, ws, sheetName);
      });

      XLSX.writeFile(wb, `Invigilation_Duties.xlsx`);
    } catch (err) {
      console.error("Excel Export Failed:", err);
      alert("Failed to export Excel file. Check console for details.");
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-[1400px] mx-auto">
      <header className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white transition-colors">
            Invigilation Assigner
          </h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1 transition-colors">
            Automate invigilator duties prioritizing PhD Scholars, Lab Staff, and enforcing Faculty mandatory duties.
          </p>
        </div>
      </header>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-4 rounded-xl flex items-center text-sm border border-red-200 dark:border-red-900/30">
          <AlertTriangle className="w-5 h-5 mr-3 flex-shrink-0" />
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex flex-col items-center justify-center h-64 text-slate-400 bg-white dark:bg-[#111111] rounded-2xl border border-slate-200 dark:border-white/10 shadow-sm">
          <Loader2 className="w-8 h-8 animate-spin mb-4 text-indigo-500" />
          <p>Loading schedule and faculty structures...</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-[#111111] rounded-2xl shadow-sm border border-slate-200 dark:border-white/10 overflow-hidden transition-colors flex flex-col">
          
          <div className="p-6 border-b border-slate-200 dark:border-white/10 bg-slate-50/50 dark:bg-white/5 flex flex-col sm:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-xl flex items-center justify-center shadow-sm">
                <Users className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 dark:text-white">Run Algorithm</h3>
                <p className="text-xs text-slate-500 font-medium">Ready to allocate {data.exams.length} exam blocks.</p>
              </div>
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto">
              {assignments && (
                <button 
                  onClick={exportExcel}
                  className="flex items-center px-4 py-2.5 bg-white dark:bg-[#1a1a1a] border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300 rounded-xl font-medium shadow-sm hover:bg-slate-50 dark:hover:bg-white/5 transition-all"
                >
                  <FileSpreadsheet className="w-4 h-4 mr-2 text-emerald-600" /> Export Excel
                </button>
              )}
              
              <button 
                onClick={runAssignmentAlgorithm}
                disabled={generating}
                className="flex items-center px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shadow-sm transition-all disabled:opacity-70 active:scale-95 w-full sm:w-auto justify-center"
              >
                {generating ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Play className="w-4 h-4 mr-2" />}
                {assignments ? 'Re-Generate Duties' : 'Generate Duties'}
              </button>
            </div>
          </div>

          <div className="p-6">
            {!assignments ? (
              <div className="text-center py-16 text-slate-400">
                <CalendarDays className="w-12 h-12 mx-auto mb-4 opacity-20" />
                <p>Click "Generate Duties" to intelligently distribute invigilation duties.</p>
              </div>
            ) : (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
                
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="bg-slate-50 dark:bg-black/30 border border-slate-200 dark:border-white/10 rounded-xl p-4 flex items-center justify-between">
                    <div>
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Rooms</p>
                      <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{stats.totalRooms}</p>
                    </div>
                    <div className="w-10 h-10 bg-slate-200 dark:bg-white/10 rounded-full flex items-center justify-center text-slate-600 dark:text-slate-400">
                      <CalendarDays className="w-5 h-5" />
                    </div>
                  </div>

                  <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800/50 rounded-xl p-4 flex items-center justify-between">
                    <div>
                      <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Covered</p>
                      <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-300 mt-1">{stats.assignedRooms}</p>
                    </div>
                    <div className="w-10 h-10 bg-emerald-200 dark:bg-emerald-800/40 rounded-full flex items-center justify-center text-emerald-700 dark:text-emerald-400">
                      <CheckCircle className="w-5 h-5" />
                    </div>
                  </div>

                  <div className={`border rounded-xl p-4 flex items-center justify-between ${stats.unassignedRooms > 0 ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800/50' : 'bg-slate-50 dark:bg-black/30 border-slate-200 dark:border-white/10'}`}>
                    <div>
                      <p className={`text-xs font-semibold uppercase tracking-wider ${stats.unassignedRooms > 0 ? 'text-red-600 dark:text-red-400' : 'text-slate-500'}`}>Unassigned (TBA)</p>
                      <p className={`text-2xl font-bold mt-1 ${stats.unassignedRooms > 0 ? 'text-red-700 dark:text-red-300' : 'text-slate-900 dark:text-white'}`}>{stats.unassignedRooms}</p>
                    </div>
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${stats.unassignedRooms > 0 ? 'bg-red-200 dark:bg-red-800/40 text-red-700 dark:text-red-400' : 'bg-slate-200 dark:bg-white/10 text-slate-600 dark:text-slate-400'}`}>
                      <AlertTriangle className="w-5 h-5" />
                    </div>
                  </div>
                </div>

                <div className="border border-slate-200 dark:border-white/10 rounded-xl overflow-hidden">
                  <div className="bg-slate-100 dark:bg-white/5 px-4 py-3 border-b border-slate-200 dark:border-white/10">
                    <h3 className="font-bold text-slate-800 dark:text-slate-200 text-sm">Faculty & Staff Allocation Preview</h3>
                  </div>
                  <div className="max-h-[400px] overflow-y-auto custom-scrollbar">
                    <table className="w-full text-left text-sm whitespace-nowrap">
                      <thead className="bg-slate-50 dark:bg-[#1a1a1a] text-slate-500 font-semibold sticky top-0 z-10 shadow-sm border-b border-slate-200 dark:border-white/5">
                        <tr>
                          <th className="px-4 py-3">Name</th>
                          <th className="px-4 py-3">Type</th>
                          <th className="px-4 py-3 text-center">Total Duties</th>
                          <th className="px-4 py-3">Own Exams</th>
                          <th className="px-4 py-3">Other Exams</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                        {assignments.trackers.filter(t => t.totalDuties > 0).sort((a,b) => b.totalDuties - a.totalDuties).map(t => (
                          <tr key={t.id} className="hover:bg-slate-50 dark:hover:bg-white/[0.02]">
                            <td className="px-4 py-3 font-bold text-slate-800 dark:text-slate-200">{t.full_name}</td>
                            <td className="px-4 py-3">
                              <span className={`px-2.5 py-1 rounded-md text-[10px] font-bold border uppercase tracking-wider ${
                                t.isPhD ? 'bg-purple-100 text-purple-700 border-purple-200' :
                                t.isLab ? 'bg-amber-100 text-amber-700 border-amber-200' :
                                'bg-blue-100 text-blue-700 border-blue-200'
                              }`}>
                                {t.isPhD ? 'PhD Scholar' : t.isLab ? 'Lab Staff' : 'Faculty'}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-center font-semibold text-slate-900 dark:text-white">
                              {t.totalDuties} <span className="text-slate-400 text-xs font-normal">/ {t.maxDuties}</span>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex flex-wrap gap-1">
                                {t.ownDuties.map((d, i) => <span key={i} className="px-2 py-0.5 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-300 rounded text-xs font-bold">{d}</span>)}
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex flex-wrap gap-1">
                                {t.otherDuties.map((d, i) => <span key={i} className="px-2 py-0.5 bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-slate-300 rounded text-xs font-bold">{d}</span>)}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

              </div>
            )}
          </div>
        </div>
      )}
      <style dangerouslySetInnerHTML={{__html: `
        .custom-scrollbar::-webkit-scrollbar { height: 8px; width: 8px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; }
        .dark .custom-scrollbar::-webkit-scrollbar-thumb { background: #333; }
      `}} />
    </div>
  );
}