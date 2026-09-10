import React, { useState } from 'react';
import { 
    CalendarDays, 
    Clock, 
    Settings, 
    Play, 
    AlertTriangle, 
    AlertCircle,
    X,
    Plus,
    Loader2,
    Calendar,
    Save,
    CheckCircle2,
    ArrowLeft,
    CheckCircle,
    MapPin,
    Tag,
    BookOpen,
    Download,
    ChevronDown
} from 'lucide-react';
import * as XLSX from 'xlsx';

export default function AdminScheduleGenerator() {
    const [step, setStep] = useState(1);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [successMsg, setSuccessMsg] = useState(null);

    // Form States
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [slots, setSlots] = useState([
        { id: '1', name: 'Morning', startTime: '10:00', endTime: '13:00' },
        { id: '2', name: 'Evening', startTime: '14:00', endTime: '17:00' }
    ]);

    // Generated Results State
    const [generatedSchedule, setGeneratedSchedule] = useState([]);
    const [clashes, setClashes] = useState([]);
    const [showDownload, setShowDownload] = useState(false);

    const handleAddSlot = () => {
        const newId = Date.now().toString();
        setSlots([...slots, { id: newId, name: `Slot ${slots.length + 1}`, startTime: '09:00', endTime: '12:00' }]);
    };

    const handleRemoveSlot = (id) => {
        setSlots(slots.filter(s => s.id !== id));
    };

    const handleSlotChange = (id, field, value) => {
        setSlots(slots.map(s => s.id === id ? { ...s, [field]: value } : s));
    };

    const handleReset = () => {
        setStep(1);
        setGeneratedSchedule([]);
        setClashes([]);
        setSuccessMsg(null);
        setError(null);
    };

    const handleGenerate = async () => {
        if (!startDate || !endDate) {
            setError('Please select both start and end dates.');
            return;
        }
        if (new Date(startDate) > new Date(endDate)) {
            setError('Start date cannot be after end date.');
            return;
        }
        if (slots.length === 0) {
            setError('Please configure at least one time slot.');
            return;
        }

        setIsLoading(true);
        setError(null);
        setSuccessMsg(null);

        try {
            const backendUrl = import.meta.env?.VITE_BACKEND_URL || 'http://localhost:5000';
            const response = await fetch(`${backendUrl}/api/admin/schedule/generate-preview`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ startDate, endDate, slots })
            });

            const data = await response.json();
            
            if (response.ok) {
                setGeneratedSchedule(data.schedule || []);
                setClashes(data.clashes || []);
                setStep(2);
            } else {
                setError(data.error || 'Failed to generate schedule.');
            }
        } catch (err) {
            setError('Server connection failed. Could not reach backend.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleCommit = async () => {
        setIsLoading(true);
        setError(null);

        try {
            const backendUrl = import.meta.env?.VITE_BACKEND_URL || 'http://localhost:5000';
            const response = await fetch(`${backendUrl}/api/admin/schedule/commit-generated`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ schedule: generatedSchedule })
            });

            const data = await response.json();

            if (response.ok) {
                setSuccessMsg('Schedule successfully finalized and saved to the database.');
                setStep(3);
            } else {
                setError(data.error || 'Failed to commit schedule.');
            }
        } catch (err) {
            setError('Server connection failed. Could not save.');
        } finally {
            setIsLoading(false);
        }
    };

    const getDaysArray = (start, end) => {
        const arr = [];
        let dt = new Date(start);
        const endDate = new Date(end);
        while (dt <= endDate) {
            arr.push(dt.toISOString().split('T')[0]);
            dt.setDate(dt.getDate() + 1);
        }
        return arr;
    };

    const formatDisplayDate = (dateStr) => {
        const [year, month, day] = dateStr.split('-');
        const date = new Date(year, month - 1, day);
        return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    };

    const handleDownload = (format) => {
        if (!generatedSchedule || generatedSchedule.length === 0) {
            alert("No schedule generated to download.");
            return;
        }

        const exportData = generatedSchedule.map(item => {
            const batchesMapped = item.batches.map(b => b.name).join(', ');
            return {
                "Date": item.date,
                "Slot Name": item.slotName,
                "Start Time": item.startTime,
                "End Time": item.endTime,
                "Course Code": item.course_code,
                "Course Title": item.title,
                "Batches Scheduled": batchesMapped
            };
        });

        const fileName = `Exam_Schedule_${startDate}_to_${endDate}`;

        if (format === 'csv') {
            const worksheet = XLSX.utils.json_to_sheet(exportData);
            const csvOutput = XLSX.utils.sheet_to_csv(worksheet);
            const blob = new Blob([csvOutput], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url; link.download = `${fileName}.csv`; link.click();
            URL.revokeObjectURL(url);
        } else {
            const worksheet = XLSX.utils.json_to_sheet(exportData);
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, "Schedule");
            XLSX.writeFile(workbook, `${fileName}.${format}`);
        }
    };

    // Prepare grid data based on generation
    const gridDates = startDate && endDate ? getDaysArray(startDate, endDate) : [];

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 w-full mx-auto max-w-[1600px]">
            {}
            <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white flex items-center transition-colors">
                        <Play className="w-6 h-6 mr-3 text-blue-600 dark:text-blue-400" />
                        AI Examination Scheduler
                    </h2>
                    <p className="text-slate-500 dark:text-slate-400 text-sm mt-1 transition-colors">
                        Automatically assign exams to slots, preventing batch overlaps and section clashes.
                    </p>
                </div>
                
                <div className="flex items-center space-x-2 text-sm font-medium bg-slate-100 dark:bg-white/5 px-4 py-2 rounded-full border border-slate-200 dark:border-white/10 transition-colors">
                    <span className={step >= 1 ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400 dark:text-slate-600'}>1. Config</span>
                    <span className="text-slate-300 dark:text-slate-600">→</span>
                    <span className={step >= 2 ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400 dark:text-slate-600'}>2. Preview Grid</span>
                    <span className="text-slate-300 dark:text-slate-600">→</span>
                    <span className={step === 3 ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400 dark:text-slate-600'}>3. Finalize</span>
                </div>
            </header>

            {error && (
                <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-4 rounded-xl flex items-center text-sm border border-red-200 dark:border-red-900/30 transition-colors max-w-[1200px]">
                    <AlertCircle className="w-5 h-5 mr-3 flex-shrink-0" />
                    {error}
                </div>
            )}

            {}
            {step === 1 && (
                <div className="bg-white dark:bg-[#111111] p-6 sm:p-8 rounded-2xl border border-slate-200 dark:border-white/10 shadow-sm transition-colors max-w-[1200px]">
                    <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200 mb-6 flex items-center transition-colors">
                        <CalendarDays className="w-5 h-5 mr-2 text-slate-500" />
                        Examination Period Configuration
                    </h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2 transition-colors">Start Date</label>
                            <input 
                                type="date" 
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                                className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white transition-all"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2 transition-colors">End Date</label>
                            <input 
                                type="date" 
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                                className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white transition-all"
                            />
                        </div>
                    </div>

                    <div className="border-t border-slate-200 dark:border-white/10 pt-8 mb-8 transition-colors">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200 flex items-center transition-colors">
                                <Clock className="w-5 h-5 mr-2 text-slate-500" />
                                Daily Time Slots
                            </h3>
                            <button 
                                onClick={handleAddSlot}
                                className="flex items-center text-sm font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-3 py-1.5 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors"
                            >
                                <Plus className="w-4 h-4 mr-1" /> Add Slot
                            </button>
                        </div>

                        <div className="space-y-4">
                            {slots.map((slot, index) => (
                                <div key={slot.id} className="flex flex-col sm:flex-row gap-4 items-end sm:items-center bg-slate-50 dark:bg-white/5 p-4 rounded-xl border border-slate-200 dark:border-white/10 transition-colors">
                                    <div className="w-full sm:flex-1">
                                        <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Slot Name</label>
                                        <input 
                                            type="text" 
                                            value={slot.name}
                                            onChange={(e) => handleSlotChange(slot.id, 'name', e.target.value)}
                                            className="w-full bg-white dark:bg-[#1a1a1a] border border-slate-200 dark:border-white/10 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500 text-sm text-slate-900 dark:text-white transition-all"
                                        />
                                    </div>
                                    <div className="w-full sm:w-32">
                                        <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Start Time</label>
                                        <input 
                                            type="time" 
                                            value={slot.startTime}
                                            onChange={(e) => handleSlotChange(slot.id, 'startTime', e.target.value)}
                                            className="w-full bg-white dark:bg-[#1a1a1a] border border-slate-200 dark:border-white/10 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500 text-sm text-slate-900 dark:text-white transition-all"
                                        />
                                    </div>
                                    <div className="w-full sm:w-32">
                                        <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">End Time</label>
                                        <input 
                                            type="time" 
                                            value={slot.endTime}
                                            onChange={(e) => handleSlotChange(slot.id, 'endTime', e.target.value)}
                                            className="w-full bg-white dark:bg-[#1a1a1a] border border-slate-200 dark:border-white/10 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500 text-sm text-slate-900 dark:text-white transition-all"
                                        />
                                    </div>
                                    {slots.length > 1 && (
                                        <button 
                                            onClick={() => handleRemoveSlot(slot.id)}
                                            className="p-2.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors border border-transparent hover:border-red-200 dark:hover:border-red-900/50"
                                            title="Remove Slot"
                                        >
                                            <X className="w-4 h-4" />
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="flex justify-end pt-4 border-t border-slate-200 dark:border-white/10 transition-colors">
                        <button 
                            onClick={handleGenerate}
                            disabled={isLoading}
                            className="flex items-center px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-sm transition-colors disabled:opacity-70"
                        >
                            {isLoading ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <Settings className="w-5 h-5 mr-2" />}
                            Run Generation Algorithm
                        </button>
                    </div>
                </div>
            )}

            {}
            {step === 2 && (
                <div className="space-y-6 animate-in fade-in">
                    {clashes.length > 0 && (
                        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-900/30 rounded-2xl p-5 transition-colors shadow-sm">
                            <div className="flex items-center space-x-2 text-amber-800 dark:text-amber-500 mb-4">
                                <AlertTriangle className="w-5 h-5" />
                                <h3 className="font-semibold">Scheduling Constraints & Density Warnings</h3>
                            </div>
                            <ul className="space-y-3">
                                {clashes.map((clash, idx) => (
                                    <li key={idx} className="flex items-start text-sm">
                                        <span className={`flex-shrink-0 w-2 h-2 rounded-full mt-1.5 mr-3 ${clash.type === 'error' ? 'bg-red-500' : 'bg-amber-500'}`}></span>
                                        <span className={clash.type === 'error' ? 'text-red-700 dark:text-red-400' : 'text-amber-700 dark:text-amber-400'}>
                                            {clash.message}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    <div className="bg-white dark:bg-[#111111] rounded-2xl border border-slate-200 dark:border-white/10 shadow-sm overflow-hidden transition-colors flex flex-col h-[75vh]">
                        
                        <div className="p-4 sm:p-6 border-b border-slate-200 dark:border-white/10 flex flex-col sm:flex-row justify-between items-start sm:items-center transition-colors bg-slate-50/50 dark:bg-white/5 shrink-0 gap-4">
                            <div>
                                <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200 flex items-center">
                                    <Calendar className="w-5 h-5 mr-2 text-blue-600 dark:text-blue-400" />
                                    Exam Master Grid Preview
                                </h3>
                                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Review the AI-generated timeline mapping courses across dates.</p>
                            </div>
                            <div className="flex items-center gap-3 w-full sm:w-auto">
                                <span className="bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-800/50 px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wide">
                                    {generatedSchedule.length} Exams Scheduled
                                </span>
                                
                                {/* Download Button */}
                                <div className="relative" onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setShowDownload(false); }}>
                                    <button 
                                        onClick={() => setShowDownload(!showDownload)}
                                        className="flex items-center px-3 py-1.5 bg-white dark:bg-[#1a1a1a] border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300 rounded-lg text-sm font-medium hover:bg-slate-50 dark:hover:bg-white/5 transition-colors shadow-sm"
                                    >
                                        <Download className="w-4 h-4 mr-1.5" />
                                        Export
                                        <ChevronDown className={`w-4 h-4 ml-1.5 transition-transform ${showDownload ? 'rotate-180' : ''}`} />
                                    </button>
                                    {showDownload && (
                                        <div className="absolute right-0 mt-2 w-40 bg-white dark:bg-[#1a1a1a] border border-slate-200 dark:border-white/10 rounded-xl shadow-xl z-[60] overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                                            <button onClick={() => { handleDownload('csv'); setShowDownload(false); }} className="block w-full text-left px-4 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">Download CSV</button>
                                            <div className="h-px w-full bg-slate-100 dark:bg-white/5"></div>
                                            <button onClick={() => { handleDownload('xlsx'); setShowDownload(false); }} className="block w-full text-left px-4 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">Download XLSX</button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                        
                        {/* The Actual Matrix Wrapper */}
                        <div className="flex-1 overflow-auto custom-scrollbar relative bg-slate-50 dark:bg-[#0a0a0a]">
                            {generatedSchedule.length === 0 ? (
                                <div className="h-full flex flex-col items-center justify-center text-slate-400 dark:text-slate-600">
                                    <AlertCircle className="w-12 h-12 mb-3 opacity-30" />
                                    <p className="text-sm font-medium">No exams could be scheduled. Please review constraints and dates.</p>
                                </div>
                            ) : (
                                <table className="w-full text-left border-collapse min-w-[900px]">
                                    <thead className="sticky top-0 z-20 shadow-sm">
                                        <tr>
                                            <th className="bg-white dark:bg-[#1a1a1a] border-b border-r border-slate-200 dark:border-white/10 p-4 font-bold text-slate-700 dark:text-slate-300 w-48 sticky left-0 z-30">
                                                Date / Time
                                            </th>
                                            {slots.map(slot => (
                                                <th key={slot.id} className="bg-white dark:bg-[#1a1a1a] border-b border-r border-slate-200 dark:border-white/10 p-4 text-center min-w-[300px]">
                                                    <div className="font-bold text-slate-800 dark:text-slate-200">{slot.name}</div>
                                                    <div className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                                                        {slot.startTime} - {slot.endTime}
                                                    </div>
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-200 dark:divide-white/10">
                                        {gridDates.map((dateStr, dIdx) => (
                                            <tr key={dateStr} className="group transition-colors hover:bg-slate-50/50 dark:hover:bg-white/[0.02]">
                                                {/* Row Header (Date) */}
                                                <td className="bg-white dark:bg-[#1a1a1a] border-r border-slate-200 dark:border-white/10 p-4 font-semibold text-slate-800 dark:text-slate-200 sticky left-0 z-10 group-hover:bg-slate-50 dark:group-hover:bg-[#222] transition-colors align-top">
                                                    {formatDisplayDate(dateStr)}
                                                </td>
                                                
                                                {/* Columns (Slots) */}
                                                {slots.map((slot, sIdx) => {
                                                    const examsInCell = generatedSchedule.filter(e => e.date === dateStr && e.slotName === slot.name);
                                                    
                                                    return (
                                                        <td key={`${dateStr}-${slot.id}`} className="p-3 border-r border-slate-200 dark:border-white/10 bg-transparent align-top last:border-r-0">
                                                            {examsInCell.length > 0 ? (
                                                                <div className="flex flex-col gap-3">
                                                                    {examsInCell.map((exam, eIdx) => (
                                                                        <div key={`${exam.course_code}-${eIdx}`} className="bg-blue-50/80 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800/50 rounded-xl p-3 hover:shadow-md transition-shadow hover:border-blue-300 dark:hover:border-blue-700 group/card relative overflow-hidden">
                                                                            <div className="absolute top-0 left-0 w-1 h-full bg-blue-500 dark:bg-blue-600 rounded-l-xl"></div>
                                                                            
                                                                            <div className="pl-2">
                                                                                <div className="flex justify-between items-start mb-1.5">
                                                                                    <span className="font-bold text-blue-900 dark:text-blue-100 text-sm">{exam.course_code}</span>
                                                                                </div>
                                                                                <h4 className="text-xs font-semibold text-blue-800 dark:text-blue-300 leading-tight mb-2">
                                                                                    {exam.title}
                                                                                </h4>
                                                                                
                                                                                <div className="flex flex-wrap gap-1.5 mt-2 pt-2 border-t border-blue-100 dark:border-blue-800/30">
                                                                                    <span className="w-full text-[10px] uppercase font-bold text-blue-500 dark:text-blue-400 tracking-wider">Batches Mapped:</span>
                                                                                    {exam.batches.map(b => (
                                                                                        <span key={b.timetable_id} className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-white dark:bg-[#111111] text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-white/10 shadow-sm">
                                                                                            {b.name}
                                                                                        </span>
                                                                                    ))}
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            ) : (
                                                                <div className="h-full min-h-[80px] flex items-center justify-center border-2 border-dashed border-slate-200 dark:border-white/5 rounded-xl bg-slate-50/50 dark:bg-black/20 text-slate-400 text-xs font-medium italic opacity-0 group-hover:opacity-100 transition-opacity">
                                                                    Empty Slot
                                                                </div>
                                                            )}
                                                        </td>
                                                    );
                                                })}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>

                        <div className="p-4 sm:p-6 bg-white dark:bg-[#1a1a1a] border-t border-slate-200 dark:border-white/10 flex justify-between items-center transition-colors shrink-0">
                            <button 
                                onClick={() => setStep(1)}
                                className="flex items-center px-4 py-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors text-sm font-medium bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 rounded-lg"
                            >
                                <ArrowLeft className="w-4 h-4 mr-2" /> Adjust Configuration
                            </button>
                            <button 
                                onClick={handleCommit}
                                disabled={isLoading || generatedSchedule.length === 0}
                                className="flex items-center px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold shadow-sm transition-colors disabled:opacity-70"
                            >
                                {isLoading ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <Save className="w-5 h-5 mr-2" />}
                                Finalize and Publish Grid
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {}
            {step === 3 && (
                <div className="bg-white dark:bg-[#111111] p-8 md:p-12 rounded-2xl border border-slate-200 dark:border-white/10 shadow-sm text-center animate-in zoom-in-95 duration-500 transition-colors max-w-[800px] mx-auto mt-10">
                    <div className="w-20 h-20 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner transition-colors">
                        <CheckCircle2 className="w-10 h-10" />
                    </div>
                    <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-2 transition-colors">Schedule Generated Successfully</h3>
                    <p className="text-slate-500 dark:text-slate-400 max-w-md mx-auto mb-8 transition-colors">
                        {successMsg || 'The examination schedule has been finalized and successfully written to the database for all mapped batches.'}
                    </p>
                    
                    <button 
                        onClick={handleReset}
                        className="inline-flex items-center px-6 py-3 bg-slate-900 dark:bg-white hover:bg-slate-800 dark:hover:bg-slate-200 text-white dark:text-black rounded-xl font-bold shadow-sm transition-colors"
                    >
                        <Settings className="w-5 h-5 mr-2" />
                        Generate Another Schedule
                    </button>

                    <div className="mt-6 flex justify-center gap-6">
                        <button onClick={() => handleDownload('csv')} className="inline-flex items-center text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline">
                            <Download className="w-4 h-4 mr-1.5" /> Download CSV
                        </button>
                        <button onClick={() => handleDownload('xlsx')} className="inline-flex items-center text-sm font-medium text-emerald-600 dark:text-emerald-400 hover:underline">
                            <Download className="w-4 h-4 mr-1.5" /> Download Excel
                        </button>
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