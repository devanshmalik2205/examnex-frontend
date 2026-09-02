import React, { useState, useEffect, useRef } from 'react';
import { 
    Calendar, Users, BookOpen, Clock, MapPin, Search, 
    ChevronDown, LayoutDashboard, Loader2, Info, User,
    Tag, Layers, Award, FileSpreadsheet, AlertTriangle, CheckCircle, X, UploadCloud
} from 'lucide-react';

// Time slots based on official format
const TIME_SLOTS = [
    { id: 9, label: '9:00 AM-9:55 AM' },
    { id: 10, label: '10:00 AM-10:55 AM' },
    { id: 11, label: '11:00 AM-11:55 AM' },
    { id: 12, label: '12:00 PM-12:55 PM' },
    { id: 13, label: '01:00 PM-01:55 PM' },
    { id: 14, label: '02:00 PM-02:55 PM' },
    { id: 15, label: '03:00 PM-03:55 PM' },
    { id: 16, label: '04:00 PM-04:55 PM' },
    { id: 17, label: '05:00 PM-05:55 PM' },
];

const formatTime = (timeStr) => {
    if (!timeStr || typeof timeStr !== 'string') return 'N/A';
    try {
        let [h, m] = timeStr.split(':');
        h = parseInt(h, 10) || 0;
        const ampm = h >= 12 ? 'PM' : 'AM';
        h = h % 12 || 12;
        return `${h}:${m || '00'} ${ampm}`;
    } catch (e) {
        return 'N/A';
    }
};

const getColorClass = (entry) => {
    const rawText = (entry.raw_entry || '').toLowerCase();
    
    if (rawText.includes('mentor')) return 'bg-yellow-100 dark:bg-yellow-900/40 text-yellow-900 dark:text-yellow-100 border-yellow-300 dark:border-yellow-700/50 hover:bg-yellow-200 dark:hover:bg-yellow-800/60';
    if (rawText.includes('audit')) return 'bg-slate-50 dark:bg-[#1a1a1a] text-red-600 dark:text-red-400 border-red-200 dark:border-red-900/50 hover:bg-red-50 dark:hover:bg-red-900/20';
    if (rawText.includes('lunch')) return 'bg-slate-200 dark:bg-slate-800/50 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700/50';

    const name = entry.course_code || entry.course_title || entry.raw_entry || '';
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
        hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    hash = Math.abs(hash);
    
    const palette = [
        'bg-blue-50/90 dark:bg-blue-900/30 border-blue-200 dark:border-blue-700/50 text-blue-900 dark:text-blue-100 hover:bg-blue-100 dark:hover:bg-blue-900/50',
        'bg-emerald-50/90 dark:bg-emerald-900/30 border-emerald-200 dark:border-emerald-700/50 text-emerald-900 dark:text-emerald-100 hover:bg-emerald-100 dark:hover:bg-emerald-900/50',
        'bg-purple-50/90 dark:bg-purple-900/30 border-purple-200 dark:border-purple-700/50 text-purple-900 dark:text-purple-100 hover:bg-purple-100 dark:hover:bg-purple-900/50',
        'bg-pink-50/90 dark:bg-pink-900/30 border-pink-200 dark:border-pink-700/50 text-pink-900 dark:text-pink-100 hover:bg-pink-100 dark:hover:bg-pink-900/50',
        'bg-indigo-50/90 dark:bg-indigo-900/30 border-indigo-200 dark:border-indigo-700/50 text-indigo-900 dark:text-indigo-100 hover:bg-indigo-100 dark:hover:bg-indigo-900/50',
        'bg-teal-50/90 dark:bg-teal-900/30 border-teal-200 dark:border-teal-700/50 text-teal-900 dark:text-teal-100 hover:bg-teal-100 dark:hover:bg-teal-900/50',
        'bg-orange-50/90 dark:bg-orange-900/30 border-orange-200 dark:border-orange-700/50 text-orange-900 dark:text-orange-100 hover:bg-orange-100 dark:hover:bg-orange-900/50',
        'bg-cyan-50/90 dark:bg-cyan-900/30 border-cyan-200 dark:border-cyan-700/50 text-cyan-900 dark:text-cyan-100 hover:bg-cyan-100 dark:hover:bg-cyan-900/50'
    ];
    return palette[hash % palette.length];
};

const getGridPosition = (entry, rowDays) => {
    let startStr = entry.start_time;
    let endStr = entry.end_time;
    
    if (!startStr || !endStr) return null;
    
    if (endStr.startsWith('23:55')) endStr = '11:55:00';
    if (startStr.startsWith('23:55')) startStr = '11:55:00';

    const startHour = parseInt(startStr.split(':')[0], 10);
    const endHour = parseInt(endStr.split(':')[0], 10);

    const dayIndex = rowDays.indexOf(entry.day_of_week);
    if (dayIndex === -1) return null; 

    if (startHour < 9 || startHour > 17) return null; 

    const gridRow = dayIndex + 2; 
    const colStart = startHour - 9 + 2; 
    
    let span = 1;
    if (endHour >= startHour) span = endHour - startHour + 1;
    if (endStr.endsWith('00:00') && endHour > startHour) span = endHour - startHour;

    const colEnd = colStart + span;

    return { gridRow, gridColumn: `${colStart} / ${colEnd}` };
};

export default function AdminTimetableViewer() {
    const [timetables, setTimetables] = useState([]);
    const [selectedTimetable, setSelectedTimetable] = useState('');
    const [timetableData, setTimetableData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [initialLoading, setInitialLoading] = useState(true);
    const [error, setError] = useState(null);
    
    // UI State expects an array of mapped classes now (for combined slots)
    const [selectedSlot, setSelectedSlot] = useState(null);
    const [studentSearch, setStudentSearch] = useState('');

    // Upload & Modification states
    const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadError, setUploadError] = useState(null);
    const [previewData, setPreviewData] = useState(null);
    const [isCommiting, setIsCommiting] = useState(false);
    const fileInputRef = useRef(null);

    const backendUrl = import.meta.env?.VITE_BACKEND_URL || 'http://localhost:5000';

    useEffect(() => {
        fetchTimetables();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const fetchTimetables = async () => {
        try {
            const response = await fetch(`${backendUrl}/api/admin/timetables`);
            if (!response.ok) throw new Error('Failed to fetch timetables');
            const data = await response.json();
            
            const safeData = Array.isArray(data) ? data : [];
            setTimetables(safeData);
            
            if (safeData.length > 0 && !selectedTimetable) {
                setSelectedTimetable(safeData[0].id);
            }
        } catch (err) {
            setError(err.message === 'Failed to fetch' ? `Cannot connect to backend.` : err.message);
        } finally {
            setInitialLoading(false);
        }
    };

    useEffect(() => {
        if (!selectedTimetable) return;

        const fetchTimetableDetails = async () => {
            setLoading(true);
            setSelectedSlot(null); 
            setStudentSearch('');
            setError(null);
            
            try {
                const response = await fetch(`${backendUrl}/api/admin/timetables/${selectedTimetable}`);
                if (!response.ok) throw new Error('Failed to fetch timetable details');
                const data = await response.json();
                setTimetableData(data || {});
            } catch (err) {
                setError(err.message || 'Error loading timetable data.');
            } finally {
                setLoading(false);
            }
        };
        fetchTimetableDetails();
    }, [selectedTimetable, backendUrl]);

    const handleFileSelection = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setUploadError(null);
        setIsUploading(true);

        const formData = new FormData();
        formData.append('file', file);

        try {
            const res = await fetch(`${backendUrl}/api/admin/timetables/${selectedTimetable}/upload-preview`, {
                method: 'POST',
                body: formData
            });

            if (!res.ok) throw new Error('Failed to process uploaded Excel file.');
            
            const data = await res.json();
            setPreviewData(data);
        } catch (err) {
            setUploadError(err.message);
        } finally {
            setIsUploading(false);
        }
    };

    const commitTimetableChanges = async () => {
        if (!previewData || !previewData.preview) return;
        setIsCommiting(true);
        setUploadError(null);

        try {
            const res = await fetch(`${backendUrl}/api/admin/timetables/${selectedTimetable}/commit`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(previewData.preview)
            });

            if (!res.ok) throw new Error('Failed to commit modifications.');
            
            // Clean up and refresh UI
            setIsUploadModalOpen(false);
            setPreviewData(null);
            if (fileInputRef.current) fileInputRef.current.value = "";
            
            // Re-fetch data for the active timetable
            const refreshRes = await fetch(`${backendUrl}/api/admin/timetables/${selectedTimetable}`);
            const newData = await refreshRes.json();
            setTimetableData(newData || {});

        } catch (err) {
            setUploadError(err.message);
        } finally {
            setIsCommiting(false);
        }
    };

    const handleSlotClick = (groupArray) => {
        if (groupArray && groupArray.length > 0) setSelectedSlot(groupArray);
    };

    const safeStudentsArray = Array.isArray(timetableData?.students) ? timetableData.students : [];
    const filteredStudents = safeStudentsArray.filter(s => {
        if (!s) return false;
        const searchStr = (studentSearch || '').toLowerCase();
        const uName = (s.username || '').toLowerCase();
        const regNo = (s.registration_no || '').toLowerCase();
        return uName.includes(searchStr) || regNo.includes(searchStr);
    });

    const safeTimetables = Array.isArray(timetables) ? timetables : [];
    const safeEntries = Array.isArray(timetableData?.entries) ? timetableData.entries : [];
    
    const ROW_DAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
    const groupedEntries = {};
    
    safeEntries.forEach(entry => {
        const pos = getGridPosition(entry, ROW_DAYS);
        if (!pos) return;
        
        const key = `${pos.gridRow}_${pos.gridColumn}`;
        if (!groupedEntries[key]) groupedEntries[key] = { pos, entries: [] };
        groupedEntries[key].entries.push(entry);
    });

    const safeTeachersMap = new Map();
    if (selectedSlot) {
        selectedSlot.forEach(entry => {
            if (entry.teachers) {
                entry.teachers.forEach(t => {
                    if (t) safeTeachersMap.set(t.id, t);
                });
            }
        });
    }
    const safeTeachers = Array.from(safeTeachersMap.values());

    if (initialLoading) {
        return (
            <div className="w-full h-96 flex flex-col items-center justify-center space-y-4">
                <Loader2 className="w-10 h-10 animate-spin text-blue-600 dark:text-blue-400" />
                <p className="text-slate-500 dark:text-slate-400 font-medium">Initializing Workspace...</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Control Bar */}
            <div className="bg-white dark:bg-[#111111] p-4 sm:p-6 rounded-2xl border border-slate-200 dark:border-white/5 shadow-sm flex flex-col sm:flex-row gap-4 justify-between items-center transition-colors">
                <div>
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <LayoutDashboard className="w-5 h-5 text-blue-600 dark:text-blue-400"/>
                        Master Timetable Explorer
                    </h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Select a configuration to view schedule, faculty, and linked students.</p>
                </div>
                
                <div className="flex w-full sm:w-auto items-center gap-3">
                    <div className="relative min-w-[280px] flex-1">
                        <select
                            value={selectedTimetable || ''}
                            onChange={(e) => setSelectedTimetable(e.target.value)}
                            className="w-full appearance-none bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white rounded-xl px-4 py-2.5 pr-10 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all font-medium cursor-pointer"
                        >
                            {safeTimetables.map((tt, idx) => (
                                <option key={tt?.id || idx} value={tt?.id || ''} className="dark:bg-[#1a1a1a]">
                                    Batch {tt?.batch_year || 'N/A'} - {tt?.stream || 'N/A'} (Sem {tt?.semester || 'N/A'})
                                </option>
                            ))}
                        </select>
                        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500 pointer-events-none" />
                    </div>
                    
                    <button 
                        onClick={() => setIsUploadModalOpen(true)}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors flex items-center shadow-sm flex-shrink-0"
                    >
                        <FileSpreadsheet className="w-4 h-4 mr-2" /> Modify via Excel
                    </button>
                </div>
            </div>

            {error && (
                <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/50 rounded-xl text-red-600 dark:text-red-400 text-sm flex items-center">
                    <Info className="w-5 h-5 mr-2 flex-shrink-0"/> {error}
                </div>
            )}

            <div className="flex flex-col lg:flex-row gap-6 lg:h-[700px]">
                
                {/* Left: The Native CSS Grid Table */}
                <div className="flex-1 bg-white dark:bg-[#111111] border border-slate-200 dark:border-white/5 rounded-2xl shadow-sm overflow-hidden flex flex-col transition-colors relative">
                    {loading && (
                        <div className="absolute inset-0 bg-white/60 dark:bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center">
                            <Loader2 className="w-8 h-8 animate-spin text-blue-600 dark:text-blue-400" />
                        </div>
                    )}
                    
                    <div className="overflow-auto w-full h-full custom-scrollbar relative bg-white dark:bg-[#111111]">
                        <div 
                            className="min-w-[1200px] grid relative h-full"
                            style={{ 
                                gridTemplateColumns: `80px repeat(${TIME_SLOTS.length}, minmax(130px, 1fr))`,
                                gridAutoRows: 'minmax(80px, 1fr)' 
                            }}
                        >
                            <div className="border-b border-r border-slate-200 dark:border-white/10 bg-slate-50/90 dark:bg-[#161616]/90 backdrop-blur-sm sticky top-0 left-0 z-30" />
                            
                            {/* Column Headers */}
                            {TIME_SLOTS.map((slot, i) => (
                                <div 
                                    key={`head-${slot.id}`} 
                                    className="border-b border-r border-slate-200 dark:border-white/10 bg-slate-50/90 dark:bg-[#161616]/90 backdrop-blur-sm p-3 text-center sticky top-0 z-20 flex items-center justify-center" 
                                    style={{ gridRow: 1, gridColumn: i + 2 }}
                                >
                                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300">{slot.label}</span>
                                </div>
                            ))}

                            {/* Row Headers & Background Grid */}
                            {ROW_DAYS.map((day, dIdx) => (
                                <React.Fragment key={`row-${day}`}>
                                    <div 
                                        className="border-b border-r border-slate-200 dark:border-white/10 bg-white/90 dark:bg-[#111]/90 backdrop-blur-sm p-3 flex items-center justify-center sticky left-0 z-20" 
                                        style={{ gridRow: dIdx + 2, gridColumn: 1 }}
                                    >
                                        <span className="text-sm font-bold text-slate-500 dark:text-slate-400">{day}</span>
                                    </div>
                                    
                                    {TIME_SLOTS.map((slot, sIdx) => (
                                        <div 
                                            key={`bg-${day}-${slot.id}`} 
                                            className="border-b border-r border-slate-100 dark:border-white/[0.05] bg-transparent" 
                                            style={{ gridRow: dIdx + 2, gridColumn: sIdx + 2 }} 
                                        />
                                    ))}
                                </React.Fragment>
                            ))}

                            {/* Dynamically Grouped Entries */}
                            {Object.values(groupedEntries).map((groupObj, idx) => {
                                const { pos, entries } = groupObj;
                                const isSelected = selectedSlot && entries.some(e => selectedSlot.find(s => s.entry_id === e.entry_id));
                                
                                const displayNames = entries.map(e => e.abbreviation || e.course_code || e.raw_entry || 'Unassigned');
                                const rooms = entries.map(e => e.room).filter(Boolean);
                                
                                const uniqueTitles = [...new Set(displayNames)].join(' / ');
                                const uniqueRooms = [...new Set(rooms)].join(' / ');
                                const cardClasses = getColorClass(entries[0]);

                                return (
                                    <div 
                                        key={`group-${idx}`}
                                        onClick={() => handleSlotClick(entries)}
                                        className="p-1.5 z-10 relative cursor-pointer overflow-hidden"
                                        style={{ gridRow: pos.gridRow, gridColumn: pos.gridColumn }}
                                    >
                                        <div className={`w-full h-full rounded-lg p-2 sm:p-2.5 border transition-all duration-200 flex flex-col justify-center overflow-hidden
                                            ${cardClasses}
                                            ${isSelected ? 'ring-2 ring-blue-500 ring-offset-2 dark:ring-offset-[#111] shadow-md z-20 scale-[1.02]' : 'hover:scale-[1.01] hover:shadow-sm'}
                                        `}>
                                            <div className="font-bold text-[11px] sm:text-xs leading-tight break-words line-clamp-3">
                                                {uniqueTitles}
                                            </div>
                                            {uniqueRooms && (
                                                <div className="text-[10px] opacity-80 mt-1 font-medium break-words line-clamp-2 flex items-center">
                                                    <MapPin className="w-3 h-3 mr-1 inline flex-shrink-0" /> <span className="line-clamp-1">{uniqueRooms}</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* Right: Slide-over Context Panel */}
                <div className={`w-full lg:w-96 flex-shrink-0 bg-white dark:bg-[#111111] border border-slate-200 dark:border-white/5 rounded-2xl shadow-sm flex flex-col transition-all duration-300 transform ${selectedSlot ? 'translate-x-0 opacity-100' : 'lg:translate-x-4 opacity-50 pointer-events-none'}`}>
                    
                    <div className="p-5 border-b border-slate-200 dark:border-white/10 bg-slate-50/50 dark:bg-[#161616] rounded-t-2xl flex-shrink-0">
                        {selectedSlot ? (
                            <>
                                <div className="flex items-center space-x-2 mb-3">
                                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400 flex-shrink-0">
                                        {selectedSlot.length > 1 ? 'Combined Slots' : (selectedSlot[0].entry_type || 'Class')}
                                    </span>
                                    <span className="text-xs font-medium text-slate-500 dark:text-slate-400 flex items-center">
                                        <Clock className="w-3.5 h-3.5 mr-1"/> {selectedSlot[0].day_of_week || 'Day TBA'} • {formatTime(selectedSlot[0].start_time)}
                                    </span>
                                </div>
                                
                                <div className="space-y-3 max-h-[30vh] overflow-y-auto custom-scrollbar pr-2">
                                {(() => {
                                    const uniqueCourses = [];
                                    const courseIds = new Set();
                                    selectedSlot.forEach(e => {
                                        const key = e.course_id || e.raw_entry;
                                        if (!courseIds.has(key)) {
                                            courseIds.add(key);
                                            uniqueCourses.push(e);
                                        }
                                    });

                                    return uniqueCourses.map((course, idx) => (
                                        <div key={idx} className={`relative ${idx > 0 ? 'pt-3 border-t border-slate-200 dark:border-white/10' : ''}`}>
                                            <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white leading-tight mb-2">
                                                {course.abbreviation ? `${course.abbreviation} - ` : ''}
                                                {course.course_title || course.raw_entry || 'Untitled Session'}
                                            </h3>
                                            
                                            <div className="flex flex-wrap gap-1.5">
                                                {(course.course_code || course.category) && (
                                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-white/5">
                                                        <Tag className="w-3 h-3 mr-1" />
                                                        {course.course_code} {course.category && `• ${course.category}`}
                                                    </span>
                                                )}
                                                {course.sub_category && (
                                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 border border-indigo-200/50 dark:border-indigo-800/50">
                                                        {course.sub_category}
                                                    </span>
                                                )}
                                                {course.course_type && (
                                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 border border-emerald-200/50 dark:border-emerald-800/50 capitalize">
                                                        {course.course_type}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    ));
                                })()}
                                </div>

                                <div className="mt-4 pt-3 border-t border-slate-200 dark:border-white/10 flex flex-wrap gap-2 text-sm text-slate-600 dark:text-slate-300">
                                    {[...new Set(selectedSlot.map(e => e.room).filter(Boolean))].map((room, i) => (
                                        <div key={i} className="flex items-center bg-slate-100 dark:bg-white/10 px-2 py-1 rounded-md text-xs font-medium border border-slate-200 dark:border-white/5">
                                            <MapPin className="w-3.5 h-3.5 mr-1 flex-shrink-0 opacity-70" /> {room}
                                        </div>
                                    ))}
                                </div>
                            </>
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center text-slate-400 dark:text-slate-600 py-10">
                                <Calendar className="w-12 h-12 mb-3 opacity-20" />
                                <p className="text-sm font-medium">Select a slot to view details</p>
                            </div>
                        )}
                    </div>

                    {selectedSlot && (
                        <div className="flex-1 overflow-y-auto p-5 space-y-6 custom-scrollbar">
                            {/* Faculty list */}
                            <div>
                                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3 flex items-center">
                                    <BookOpen className="w-4 h-4 mr-1.5" /> Assigned Faculty
                                </h4>
                                {safeTeachers.length > 0 ? (
                                    <div className="space-y-3">
                                        {safeTeachers.map((teacher, idx) => {
                                            if (!teacher) return null;
                                            return (
                                                <div key={`teacher-${teacher.id || idx}`} className="flex items-center space-x-3 p-3 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/5">
                                                    <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-700 dark:text-blue-400 font-bold flex-shrink-0">
                                                        {teacher.full_name?.charAt(0) || 'F'}
                                                    </div>
                                                    <div className="overflow-hidden">
                                                        <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                                                            {teacher.full_name || 'Unknown Faculty'}
                                                        </p>
                                                        <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                                                            {teacher.email || 'No email provided'}
                                                        </p>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <p className="text-sm text-slate-500 dark:text-slate-500 italic">No faculty mapped to this slot.</p>
                                )}
                            </div>

                            {/* Linked Students */}
                            <div>
                                <div className="flex items-center justify-between mb-3">
                                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center">
                                        <Users className="w-4 h-4 mr-1.5" /> Linked Students
                                    </h4>
                                    <span className="bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300 text-xs font-bold px-2 py-0.5 rounded-full">
                                        {safeStudentsArray.length}
                                    </span>
                                </div>
                                
                                <div className="relative mb-3">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                    <input 
                                        type="text" 
                                        placeholder="Search students..." 
                                        value={studentSearch}
                                        onChange={(e) => setStudentSearch(e.target.value)}
                                        className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:border-blue-500 text-slate-900 dark:text-white transition-colors"
                                    />
                                </div>

                                <div className="space-y-2">
                                    {filteredStudents.length > 0 ? (
                                        filteredStudents.map((student, idx) => (
                                            <div key={`student-${student?.id || idx}`} className="flex items-center justify-between p-2.5 rounded-lg hover:bg-slate-50 dark:hover:bg-white/5 transition-colors group">
                                                <div className="flex items-center space-x-3 overflow-hidden">
                                                    <User className="w-4 h-4 text-slate-400 dark:text-slate-500 flex-shrink-0" />
                                                    <div className="truncate">
                                                        <p className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">
                                                            {student?.username || 'Unknown Student'}
                                                        </p>
                                                        <p className="text-xs text-slate-500 dark:text-slate-500">
                                                            {student?.registration_no || 'No ID'}
                                                        </p>
                                                    </div>
                                                </div>
                                                <span className="text-xs font-medium text-slate-400 dark:text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    {student?.stream || 'N/A'}
                                                </span>
                                            </div>
                                        ))
                                    ) : (
                                        <p className="text-sm text-slate-500 dark:text-slate-500 italic text-center py-4">No students found.</p>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
            
            {isUploadModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm transition-opacity animate-in fade-in">
                    <div className="bg-white dark:bg-[#1a1a1a] rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden border border-slate-200 dark:border-white/10 shadow-2xl flex flex-col">
                        <div className="flex justify-between items-center p-5 border-b border-slate-200 dark:border-white/5">
                            <div>
                                <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center">
                                    <FileSpreadsheet className="w-5 h-5 mr-2 text-emerald-500" /> Excel Timetable Upload
                                </h3>
                                <p className="text-sm text-slate-500 mt-1">Upload a `.xlsx` or `.csv` file to extract subjects, teachers, and allocations automatically.</p>
                            </div>
                            <button onClick={() => { setIsUploadModalOpen(false); setPreviewData(null); }} className="text-slate-400 hover:text-slate-600 dark:hover:text-white"><X className="w-5 h-5"/></button>
                        </div>
                        
                        <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50 dark:bg-black/20 custom-scrollbar">
                            {!previewData ? (
                                <div className="h-full flex flex-col items-center justify-center space-y-4 py-8">
                                    {uploadError && (
                                        <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-3 rounded-lg flex items-center text-sm w-full max-w-md">
                                            <AlertTriangle className="w-4 h-4 mr-2 flex-shrink-0" /> {uploadError}
                                        </div>
                                    )}
                                    <label className={`w-full max-w-md aspect-video border-2 border-dashed rounded-2xl flex flex-col items-center justify-center cursor-pointer transition-colors ${isUploading ? 'border-emerald-400 bg-emerald-50 dark:bg-emerald-900/20' : 'border-slate-300 dark:border-white/20 hover:border-emerald-500 hover:bg-slate-50 dark:hover:bg-white/5'}`}>
                                        <input type="file" accept=".xlsx, .xls, .csv" className="hidden" ref={fileInputRef} onChange={handleFileSelection} disabled={isUploading} />
                                        {isUploading ? (
                                            <>
                                                <Loader2 className="w-10 h-10 animate-spin text-emerald-500 mb-4" />
                                                <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">Parsing Spreadsheet Data...</p>
                                            </>
                                        ) : (
                                            <>
                                                <UploadCloud className="w-12 h-12 text-slate-400 dark:text-slate-500 mb-4" />
                                                <p className="text-base font-semibold text-slate-700 dark:text-slate-300">Click or drag Excel file to upload</p>
                                                <p className="text-xs text-slate-500 mt-2">Required format: Day, StartTime, EndTime, CourseCode, Room, FacultyName</p>
                                            </>
                                        )}
                                    </label>
                                </div>
                            ) : (
                                <div className="space-y-6">
                                    {previewData.overwrites?.total_entries_deleted > 0 && (
                                        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50 rounded-xl p-4 flex items-start shadow-sm">
                                            <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 mr-3 mt-0.5 flex-shrink-0" />
                                            <div>
                                                <h4 className="text-sm font-bold text-amber-900 dark:text-amber-200">Overwrite Warning</h4>
                                                <p className="text-sm text-amber-700 dark:text-amber-400 mt-1">Applying this schema will completely replace the existing <strong>{previewData.overwrites.total_entries_deleted} entries</strong> for the currently selected timetable.</p>
                                            </div>
                                        </div>
                                    )}

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="bg-white dark:bg-[#111] border border-slate-200 dark:border-white/10 rounded-xl p-4 shadow-sm">
                                            <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center mb-3">
                                                <BookOpen className="w-4 h-4 mr-2 text-indigo-500" /> Parsed Courses ({previewData.preview.courses?.length || 0})
                                            </h4>
                                            <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar">
                                                {(previewData.preview.courses || []).map((c, i) => (
                                                    <div key={i} className="text-sm p-2 rounded-lg bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/5">
                                                        <p className="font-semibold text-slate-800 dark:text-slate-200">{c.course_title}</p>
                                                        <p className="text-xs text-slate-500">{c.course_code} • {c.category}</p>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        <div className="bg-white dark:bg-[#111] border border-slate-200 dark:border-white/10 rounded-xl p-4 shadow-sm">
                                            <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center mb-3">
                                                <Users className="w-4 h-4 mr-2 text-emerald-500" /> Parsed Faculty Linkages ({previewData.preview.teachers?.length || 0})
                                            </h4>
                                            <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar">
                                                {(previewData.preview.teachers || []).map((t, i) => (
                                                    <div key={i} className="text-sm p-2 rounded-lg bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/5 flex justify-between items-center">
                                                        <div>
                                                            <p className="font-semibold text-slate-800 dark:text-slate-200">{t.full_name}</p>
                                                            <p className="text-xs text-slate-500">{t.email}</p>
                                                        </div>
                                                        <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 px-2 py-1 rounded">
                                                            {t.linked_course_code}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="bg-white dark:bg-[#111] border border-slate-200 dark:border-white/10 rounded-xl p-4 shadow-sm">
                                        <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center mb-3">
                                            <Calendar className="w-4 h-4 mr-2 text-blue-500" /> Extracted Timetable Slots ({previewData.preview.entries?.length || 0})
                                        </h4>
                                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 max-h-48 overflow-y-auto custom-scrollbar">
                                            {(previewData.preview.entries || []).map((e, i) => (
                                                <div key={i} className="text-xs p-2.5 rounded-lg bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/5">
                                                    <div className="font-bold text-slate-700 dark:text-slate-300 mb-0.5">{e.day_of_week} • {e.start_time.substring(0,5)}</div>
                                                    <div className="text-indigo-600 dark:text-indigo-400 font-semibold truncate" title={e.course_code || e.raw_entry}>{e.course_code || e.raw_entry}</div>
                                                    <div className="text-slate-500 mt-1 flex items-center"><MapPin className="w-3 h-3 inline mr-1 flex-shrink-0"/> <span className="truncate">{e.room}</span></div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="p-5 border-t border-slate-200 dark:border-white/5 bg-white dark:bg-[#1a1a1a] flex justify-end gap-3">
                            <button 
                                onClick={() => { setIsUploadModalOpen(false); setPreviewData(null); }} 
                                className="px-5 py-2.5 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 rounded-xl font-medium transition-colors"
                                disabled={isCommiting}
                            >
                                Cancel
                            </button>
                            <button 
                                onClick={commitTimetableChanges} 
                                disabled={!previewData || isCommiting}
                                className={`px-5 py-2.5 rounded-xl font-medium flex items-center shadow-sm transition-all ${!previewData || isCommiting ? 'bg-slate-300 dark:bg-slate-700 text-slate-500 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 text-white'}`}
                            >
                                {isCommiting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle className="w-4 h-4 mr-2" />}
                                Commit Changes to Database
                            </button>
                        </div>
                    </div>
                </div>
            )}
            
            <style dangerouslySetInnerHTML={{__html: `
                .no-scrollbar::-webkit-scrollbar { display: none; }
                .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
                .custom-scrollbar::-webkit-scrollbar { height: 6px; width: 6px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; }
                .dark .custom-scrollbar::-webkit-scrollbar-thumb { background: #333; }
            `}} />
        </div>
    );
}