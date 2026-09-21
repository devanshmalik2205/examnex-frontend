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
    Download,
    ChevronDown
} from 'lucide-react';
import XLSX from 'xlsx-js-style';

export default function AdminScheduleGenerator() {
    const [step, setStep] = useState(1);
    const [isLoading, setIsLoading] = useState(false);
    const [isExporting, setIsExporting] = useState(false);
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
        if (!startDate || !endDate) { setError('Please select both start and end dates.'); return; }
        if (new Date(startDate) > new Date(endDate)) { setError('Start date cannot be after end date.'); return; }
        if (slots.length === 0) { setError('Please configure at least one time slot.'); return; }

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
        } catch (err) { setError('Server connection failed. Could not save.'); } 
        finally { setIsLoading(false); }
    };

    const performAllocation = async () => {
        const backendUrl = import.meta.env?.VITE_BACKEND_URL || 'http://localhost:5000';
        
        const [studentsRes, timetablesRes, roomsRes, structuresRes] = await Promise.all([
            fetch(`${backendUrl}/api/admin/students`),
            fetch(`${backendUrl}/api/admin/timetables`),
            fetch(`${backendUrl}/api/admin/rooms`),
            fetch(`${backendUrl}/api/admin/room-structures`)
        ]);

        if (!studentsRes.ok || !timetablesRes.ok || !roomsRes.ok || !structuresRes.ok) throw new Error("Failed fetching allocation data.");

        const allStudents = await studentsRes.json();
        const allTimetables = await timetablesRes.json();
        const allRooms = await roomsRes.json();
        const allStructures = await structuresRes.json();

        // Organize seats per room
        const roomsWithSeats = allRooms.map(r => ({
            ...r,
            seats: allStructures
                .filter(s => s.room_id === r.id)
                .sort((a,b) => a.row_number - b.row_number || a.column_number - b.column_number)
        })).filter(r => r.seats.length > 0);

        const sortedExams = [...generatedSchedule].sort((a, b) => {
            if (a.date !== b.date) return (a.date || '').localeCompare(b.date || '');
            return (a.startTime || '').localeCompare(b.startTime || '');
        });

        const slotsMap = new Map();
        
        // Find which student takes which exam inside the same slot
        sortedExams.forEach((exam, examIdx) => {
            const slotKey = `${exam.date}_${exam.startTime}_${exam.endTime}`;
            if (!slotsMap.has(slotKey)) slotsMap.set(slotKey, { exams: [], studentsToAllocate: [] });
            
            const slotData = slotsMap.get(slotKey);
            slotData.exams.push({...exam, originalIdx: examIdx});

            (exam.batches || []).forEach(batch => {
                const ttInfo = allTimetables.find(t => t.id === batch.timetable_id);
                if (!ttInfo) return;
                const yearPrefix = ttInfo.batch_year ? ttInfo.batch_year.toString().substring(2, 4) : '';
                const targetStream = (ttInfo.stream || '').toUpperCase();

                allStudents.forEach(s => {
                    const studentReg = s.registration_no || '';
                    const studentStream = (s.stream || '').toUpperCase();
                    if ((yearPrefix ? studentReg.startsWith(yearPrefix) : true) && 
                        (targetStream ? studentStream === targetStream : true) && 
                        studentReg) {
                        slotData.studentsToAllocate.push({ student: s, exam: exam, examIdx: examIdx });
                    }
                });
            });
        });

        const studentExamRoomMap = {}; // Maps "regNo_examIdx" -> "roomName"
        const seatingPlansData = []; // To build physical seating sheets

        // Perform Room & Seat allocation per time slot
        slotsMap.forEach((slotData, slotKey) => {
            // Group students logically by course code
            const examQueuesMap = new Map();
            slotData.studentsToAllocate.forEach(item => {
                if (!examQueuesMap.has(item.exam.course_code)) {
                    examQueuesMap.set(item.exam.course_code, {
                        exam: item.exam,
                        examIdx: item.examIdx,
                        students: []
                    });
                }
                examQueuesMap.get(item.exam.course_code).students.push(item);
            });

            let examQueues = Array.from(examQueuesMap.values());
            // Sort students within each queue by registration number
            examQueues.forEach(q => q.students.sort((a, b) => (a.student.registration_no || '').localeCompare(b.student.registration_no || '')));

            let currentRoomIdx = 0;
            const slotRooms = [...roomsWithSeats];

            while (examQueues.some(q => q.students.length > 0) && currentRoomIdx < slotRooms.length) {
                let room = slotRooms[currentRoomIdx];
                
                let currentRoomSeating = {
                    room: room, slotKey,
                    date: slotData.exams[0]?.date, 
                    startTime: slotData.exams[0]?.startTime, 
                    endTime: slotData.exams[0]?.endTime, 
                    slotName: slotData.exams[0]?.slotName,
                    allocations: []
                };

                let currentRow = -1;
                let prevExamCode = null;

                for (const seat of room.seats) {
                    if (seat.row_number !== currentRow) {
                        currentRow = seat.row_number;
                        prevExamCode = null; // Start fresh for a new row
                    }

                    // Filter out empty queues
                    examQueues = examQueues.filter(q => q.students.length > 0);
                    if (examQueues.length === 0) break;

                    // Sort queues by size descending to balance them across the room evenly
                    examQueues.sort((a, b) => b.students.length - a.students.length);

                    // Find best queue (must be different from previous seat in this row to ensure column gap)
                    let selectedQueue = null;
                    for (let i = 0; i < examQueues.length; i++) {
                        if (examQueues[i].exam.course_code !== prevExamCode) {
                            selectedQueue = examQueues[i];
                            break;
                        }
                    }

                    if (selectedQueue) {
                        const item = selectedQueue.students.shift();
                        currentRoomSeating.allocations.push({ seat, student: item.student, exam: item.exam });
                        studentExamRoomMap[`${item.student.registration_no}_${selectedQueue.examIdx}`] = room.room_name;
                        prevExamCode = selectedQueue.exam.course_code;
                    } else {
                        // Have to skip this seat to maintain column gap (e.g., only 1 course is left)
                        prevExamCode = 'EMPTY';
                    }
                }

                if (currentRoomSeating.allocations.length > 0) {
                    seatingPlansData.push(currentRoomSeating);
                }
                currentRoomIdx++;
            }

            // Mark remaining unallocated as TBA
            examQueues.forEach(q => {
                q.students.forEach(item => {
                    studentExamRoomMap[`${item.student.registration_no}_${q.examIdx}`] = 'TBA';
                });
            });
        });

        const involvedStudentsMap = new Map();
        slotsMap.forEach((slotData) => {
            slotData.studentsToAllocate.forEach(item => {
                if(!involvedStudentsMap.has(item.student.registration_no)) {
                    involvedStudentsMap.set(item.student.registration_no, item.student);
                }
            });
        });

        return { 
            sortedExams, 
            involvedStudents: Array.from(involvedStudentsMap.values()), 
            studentExamRoomMap, 
            seatingPlansData 
        };
    };

    const handleDownload = async (format) => {
        if (!generatedSchedule || generatedSchedule.length === 0) {
            alert("No schedule generated to download."); return;
        }

        const fileName = `Exam_Schedule_${startDate}_to_${endDate}`;

        if (format === 'csv') {
            const exportData = generatedSchedule.map(item => {
                const batchesMapped = item.batches.map(b => b.name).join(', ');
                return {
                    "Date": item.date, "Slot Name": item.slotName, "Start Time": item.startTime, "End Time": item.endTime,
                    "Course Code": item.course_code, "Course Title": item.title, "Batches Scheduled": batchesMapped
                };
            });
            const worksheet = XLSX.utils.json_to_sheet(exportData);
            const csvOutput = XLSX.utils.sheet_to_csv(worksheet);
            const blob = new Blob([csvOutput], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob); link.download = `${fileName}.csv`; link.click();
            URL.revokeObjectURL(link.href);
        } else {
            setIsExporting(true);
            try {
                const { sortedExams, involvedStudents, studentExamRoomMap, seatingPlansData } = await performAllocation();

                const borderBlack = { top: { style: 'thin', color: { rgb: '000000' } }, bottom: { style: 'thin', color: { rgb: '000000' } }, left: { style: 'thin', color: { rgb: '000000' } }, right: { style: 'thin', color: { rgb: '000000' } } };
                const ensureCell = (ws, r, c, defaultVal = '') => { const ref = XLSX.utils.encode_cell({ r, c }); if (!ws[ref]) ws[ref] = { t: 's', v: defaultVal }; return ws[ref]; };
                const formatExamDate = (dateStr) => { if (!dateStr) return ''; const parts = dateStr.split('-'); if (parts.length === 3) return `${parts[2]}.${parts[1]}.${parts[0]}`; return dateStr; };
                const formatExamDay = (dateStr) => { if (!dateStr) return ''; const parts = dateStr.split('-'); if (parts.length === 3) return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2])).toLocaleDateString('en-US', { weekday: 'long' }).toUpperCase(); return ''; };

                const workbook = XLSX.utils.book_new();

                if (format === 'xlsx-master') {
                    // MASTER ALLOCATION EXPORT
                    involvedStudents.sort((a, b) => {
                        const streamComp = (a.stream || '').localeCompare(b.stream || '');
                        return streamComp !== 0 ? streamComp : (a.registration_no || '').localeCompare(b.registration_no || '');
                    });

                    const row1 = ["", "", "", "DATE OF EXAM"]; const row2 = ["", "", "", "DAY"]; const row3 = ["", "", "", "SHIFT"]; const row4 = ["S#", "Stream", "Registration No", "Name"];
                    sortedExams.forEach(exam => { row1.push(formatExamDate(exam.date)); row2.push(formatExamDay(exam.date)); row3.push((exam.slotName || '').toUpperCase()); row4.push((exam.title || exam.course_code || '').toUpperCase()); });

                    const aoaData = [row1, row2, row3, row4];
                    involvedStudents.forEach((student, index) => {
                        const rowData = [ index + 1, student.stream || 'N/A', student.registration_no || 'N/A', student.username || 'N/A' ];
                        sortedExams.forEach((exam, examIdx) => {
                            const allocatedRoom = studentExamRoomMap[`${student.registration_no}_${examIdx}`];
                            rowData.push(allocatedRoom ? allocatedRoom : "--");
                        });
                        aoaData.push(rowData);
                    });

                    const worksheet = XLSX.utils.aoa_to_sheet(aoaData);

                    for (let r = 0; r <= 2; r++) ensureCell(worksheet, r, 3).s = { font: { bold: true, sz: 10, name: 'Calibri' }, alignment: { horizontal: 'right', vertical: 'center' }, border: borderBlack };
                    for (let c = 0; c <= 3; c++) ensureCell(worksheet, 3, c).s = { font: { bold: true, sz: 10, name: 'Calibri' }, alignment: { horizontal: 'center', vertical: 'center' }, border: borderBlack };

                    const STREAM_PALETTE = ['D9E1F2', 'FCE4D6', 'E2EFDA', 'FFF2CC', 'F2DCDB', 'E8D8F8', 'D9F2E6', 'EDEDED'];
                    const distinctStreams = [...new Set(involvedStudents.map(s => s.stream || 'N/A'))];
                    const streamColorMap = new Map(); distinctStreams.forEach((st, idx) => streamColorMap.set(st, STREAM_PALETTE[idx % STREAM_PALETTE.length]));

                    sortedExams.forEach((exam, examIdx) => {
                        const c = 4 + examIdx;
                        const sC = (exam.slotName || '').toLowerCase().includes('morning') ? { bg: '92D050', text: '000000' } : { bg: 'FFC000', text: '000000' };
                        [0, 1, 2].forEach(r => ensureCell(worksheet, r, c).s = { fill: { fgColor: { rgb: sC.bg } }, font: { bold: true, sz: 10, name: 'Calibri', color: { rgb: sC.text } }, alignment: { horizontal: 'center', vertical: 'center' }, border: borderBlack });
                        ensureCell(worksheet, 3, c).s = { fill: { fgColor: { rgb: sC.bg } }, font: { bold: true, sz: 9, name: 'Calibri', color: { rgb: sC.text } }, alignment: { horizontal: 'center', vertical: 'center', wrapText: true }, border: borderBlack };
                    });

                    involvedStudents.forEach((student, sIdx) => {
                        const r = 4 + sIdx;
                        ensureCell(worksheet, r, 0).s = { font: { sz: 10, name: 'Calibri' }, alignment: { horizontal: 'center', vertical: 'center' }, border: borderBlack };
                        ensureCell(worksheet, r, 1).s = { fill: { fgColor: { rgb: streamColorMap.get(student.stream || 'N/A') || 'FFFFFF' } }, font: { sz: 10, name: 'Calibri', bold: true }, alignment: { horizontal: 'center', vertical: 'center' }, border: borderBlack };
                        ensureCell(worksheet, r, 2).s = { font: { sz: 10, name: 'Calibri' }, alignment: { horizontal: 'center', vertical: 'center' }, border: borderBlack };
                        ensureCell(worksheet, r, 3).s = { font: { sz: 10, name: 'Calibri' }, alignment: { horizontal: 'left', vertical: 'center' }, border: borderBlack };
                        sortedExams.forEach((exam, examIdx) => {
                            const c = 4 + examIdx;
                            const hasExam = !!studentExamRoomMap[`${student.registration_no}_${examIdx}`];
                            ensureCell(worksheet, r, c).s = { font: { sz: 10, name: 'Calibri', bold: hasExam, color: hasExam ? {rgb: '0000FF'} : {rgb: '000000'} }, alignment: { horizontal: 'center', vertical: 'center' }, border: borderBlack };
                        });
                    });

                    worksheet['!rows'] = [{ hpt: 20 }, { hpt: 20 }, { hpt: 20 }, { hpt: 45 }];
                    for (let i = 0; i < involvedStudents.length; i++) worksheet['!rows'].push({ hpt: 22 });
                    worksheet['!views'] = [{ state: 'frozen', xSplit: 4, ySplit: 4, topLeftCell: 'E5', activePane: 'bottomRight' }];
                    const colWidths = [{ wch: 6 }, { wch: 16 }, { wch: 22 }, { wch: 30 }];
                    sortedExams.forEach(() => colWidths.push({ wch: 25 }));
                    worksheet['!cols'] = colWidths;

                    XLSX.utils.book_append_sheet(workbook, worksheet, "MASTER ALLOCATION");
                    XLSX.writeFile(workbook, `Master_Allocation_${startDate}.xlsx`);

                } else if (format === 'xlsx-seating') {
                    // DETAILED SEATING PLANS EXPORT
                    seatingPlansData.forEach((plan, planIdx) => {
                        const maxCol = Math.max(...plan.room.seats.map(s => s.column_number), 1);
                        const maxRow = Math.max(...plan.room.seats.map(s => s.row_number), 1);
                        const uniqueCourses = [...new Set(plan.allocations.map(a => `${a.exam.title} (${a.exam.course_code})`))].join(', ');
                        
                        const aoa = [];
                        aoa.push(["BML MUNJAL UNIVERSITY"]); 
                        aoa.push(["UG PROG. SOET MID TERM EXAMINATION"]);
                        aoa.push([`SEATING LAYOUT PLAN : ${plan.room.room_name}`]); 
                        
                        // Parse date for fancy display
                        const fDate = new Date(plan.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).replace(/ /g, '-');
                        // Use raw times for formatting
                        const fTime = `${plan.startTime} to ${plan.endTime}`;
                        
                        aoa.push([`${fDate} ${fTime}`]); 
                        aoa.push([`${uniqueCourses} , Session :- ${plan.slotName}`]); 

                        const colHeaders = [""];
                        for(let c=1; c<=maxCol; c++) colHeaders.push(String.fromCharCode(64 + c)); // A, B, C...
                        aoa.push(colHeaders); 

                        for(let r=1; r<=maxRow; r++) {
                            const rowData = [`ROW${r}`];
                            for(let c=1; c<=maxCol; c++) {
                                const alloc = plan.allocations.find(a => a.seat.row_number === r && a.seat.column_number === c);
                                if(alloc) {
                                    rowData.push(`${alloc.student.username}\n${alloc.student.registration_no}\n${alloc.exam.course_code}\n${alloc.student.stream}`);
                                } else {
                                    rowData.push(""); 
                                }
                            }
                            aoa.push(rowData);
                        }

                        const ws = XLSX.utils.aoa_to_sheet(aoa);

                        // Merge headers across the grid width (maxCol)
                        ws['!merges'] = [
                            { s: {r:0, c:0}, e: {r:0, c: maxCol} },
                            { s: {r:1, c:0}, e: {r:1, c: maxCol} },
                            { s: {r:2, c:0}, e: {r:2, c: maxCol} },
                            { s: {r:3, c:0}, e: {r:3, c: maxCol} },
                            { s: {r:4, c:0}, e: {r:4, c: maxCol} },
                        ];

                        for(let r=0; r<=4; r++) {
                           const cell = ensureCell(ws, r, 0);
                           cell.s = { font: { bold: true, sz: 12, name: 'Calibri', color: {rgb:'000080'} }, alignment: { horizontal: 'center', vertical: 'center' }, border: borderBlack };
                           if(r === 0) cell.s.font.sz = 14;
                           for(let c=1; c<=maxCol; c++) ensureCell(ws, r, c).s = { border: borderBlack }; // Fills out borders across merge
                        }

                        for(let r=5; r<=5+maxRow; r++) {
                            // Zebra striping for data rows to "color code each row"
                            const dataRowIdx = r - 6; 
                            const rowColor = dataRowIdx >= 0 ? (dataRowIdx % 2 === 0 ? 'FFFFFF' : 'F4F6F8') : 'FFFFFF';

                            for(let c=0; c<=maxCol; c++) {
                                const isHeader = (r === 5) || (c === 0);
                                const cell = ensureCell(ws, r, c);
                                cell.s = { font: { bold: isHeader, sz: 10, name: 'Calibri' }, alignment: { horizontal: 'center', vertical: 'center', wrapText: !isHeader }, border: borderBlack };
                                
                                if (r > 5 && c > 0) {
                                    if (cell.v) {
                                        // Seat occupied
                                        cell.s.fill = { fgColor: { rgb: rowColor } };
                                    } else {
                                        // Empty Seat / Gap for column separation / Aisle
                                        cell.s.fill = { fgColor: { rgb: 'E2E8F0' } }; 
                                    }
                                }
                            }
                        }

                        ws['!rows'] = [{hpt: 25}, {hpt: 20}, {hpt: 20}, {hpt: 20}, {hpt: 20}, {hpt: 20}];
                        for(let r=1; r<=maxRow; r++) ws['!rows'].push({hpt: 65}); // Tall rows

                        ws['!cols'] = [{wch: 6}]; 
                        for(let c=1; c<=maxCol; c++) ws['!cols'].push({wch: 18}); 

                        // Protect against duplicate sheet names / long sheet names
                        let safeSheetName = `${plan.room.room_name}_${plan.slotName}`.substring(0, 31);
                        // If exact name exists, append random
                        if(workbook.SheetNames.includes(safeSheetName)) safeSheetName = `${safeSheetName.substring(0, 26)}_${planIdx}`;
                        
                        XLSX.utils.book_append_sheet(workbook, ws, safeSheetName);
                    });

                    XLSX.writeFile(workbook, `Seating_Plans_${startDate}.xlsx`);
                }

            } catch (error) {
                console.error("Export Error:", error);
                alert("Failed to export seating plan data.");
            } finally { setIsExporting(false); }
        }
    };

    const getDaysArray = (start, end) => {
        const arr = []; let dt = new Date(start); const endDate = new Date(end);
        while (dt <= endDate) { arr.push(dt.toISOString().split('T')[0]); dt.setDate(dt.getDate() + 1); }
        return arr;
    };
    const formatDisplayDate = (dateStr) => {
        const [year, month, day] = dateStr.split('-');
        return new Date(year, month - 1, day).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    };

    const gridDates = startDate && endDate ? getDaysArray(startDate, endDate) : [];

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 w-full mx-auto max-w-[1600px]">
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
                                
                                <div className="relative" onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setShowDownload(false); }}>
                                    <button 
                                        onClick={() => setShowDownload(!showDownload)}
                                        disabled={isExporting}
                                        className="flex items-center px-3 py-1.5 bg-white dark:bg-[#1a1a1a] border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300 rounded-lg text-sm font-medium hover:bg-slate-50 dark:hover:bg-white/5 transition-colors shadow-sm disabled:opacity-50"
                                    >
                                        {isExporting ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Download className="w-4 h-4 mr-1.5" />}
                                        Export
                                        <ChevronDown className={`w-4 h-4 ml-1.5 transition-transform ${showDownload ? 'rotate-180' : ''}`} />
                                    </button>
                                    {showDownload && !isExporting && (
                                        <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-[#1a1a1a] border border-slate-200 dark:border-white/10 rounded-xl shadow-xl z-[60] overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                                            <button onClick={() => { handleDownload('csv'); setShowDownload(false); }} className="block w-full text-left px-4 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">Download Summary CSV</button>
                                            <div className="h-px w-full bg-slate-100 dark:bg-white/5"></div>
                                            <button onClick={() => { handleDownload('xlsx-master'); setShowDownload(false); }} className="block w-full text-left px-4 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">Download Master Allocations (XLSX)</button>
                                            <div className="h-px w-full bg-slate-100 dark:bg-white/5"></div>
                                            <button onClick={() => { handleDownload('xlsx-seating'); setShowDownload(false); }} className="block w-full text-left px-4 py-2.5 text-sm font-medium text-blue-600 dark:text-blue-400 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">Download Seating Plans (XLSX)</button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                        
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
                                                <td className="bg-white dark:bg-[#1a1a1a] border-r border-slate-200 dark:border-white/10 p-4 font-semibold text-slate-800 dark:text-slate-200 sticky left-0 z-10 group-hover:bg-slate-50 dark:group-hover:bg-[#222] transition-colors align-top">
                                                    {formatDisplayDate(dateStr)}
                                                </td>
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
                        <button onClick={() => handleDownload('xlsx-master')} disabled={isExporting} className="inline-flex items-center text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline disabled:opacity-50">
                            {isExporting ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Download className="w-4 h-4 mr-1.5" />}
                            Download Master Allocation (Excel)
                        </button>
                        <button onClick={() => handleDownload('xlsx-seating')} disabled={isExporting} className="inline-flex items-center text-sm font-medium text-emerald-600 dark:text-emerald-400 hover:underline disabled:opacity-50">
                            {isExporting ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Download className="w-4 h-4 mr-1.5" />}
                            Download Seating Plans (Excel)
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