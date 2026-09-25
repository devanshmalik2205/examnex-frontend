import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  FileSpreadsheet,
  Plus,
  Trash2,
  Save,
  RefreshCw,
  Download,
  Upload,
  Search,
  Check,
  CheckCircle2,
  AlertCircle,
  Filter,
  Sparkles,
  Clock,
  BookOpen,
  Calendar,
  Layers,
  ChevronDown,
  Info,
  HelpCircle,
  Copy,
  ArrowUpDown,
  FileCheck,
  UserCheck
} from 'lucide-react';
import * as XLSX from 'xlsx';

// Preset default templates matching the exact prompt format
const DEFAULT_TEMPLATES = [
  {
    id: 1,
    coordinator_name: 'Dr.XYZ',
    semester: '1st',
    course_name: 'PQR',
    course_code: 'CSE2XXX',
    is_conducted: 'Yes',
    course_type: 'Regular+ Repeat',
    exam_mode: 'Written',
    exam_weightage: '20',
    duration: '1',
    remark: 'Regular & Repeat Exam Session',
    is_reexam: false
  },
  {
    id: 2,
    coordinator_name: 'Dr.XYZ',
    semester: '3rd',
    course_name: 'PQR',
    course_code: 'CSE2XXX',
    is_conducted: 'Yes',
    course_type: 'MDC',
    exam_mode: 'Lab Based',
    exam_weightage: '10',
    duration: '30 Min',
    remark: 'Multidisciplinary Lab Evaluation',
    is_reexam: false
  },
  {
    id: 3,
    coordinator_name: 'Dr.XYZ',
    semester: '5th',
    course_name: 'PQR',
    course_code: 'CSE2XXX',
    is_conducted: 'No',
    course_type: 'Regular',
    exam_mode: 'Project Based (Viva)',
    exam_weightage: '10',
    duration: 'Complete Day for whole batch',
    remark: 'Evaluation through presentation & viva',
    is_reexam: false
  },
  {
    id: 4,
    coordinator_name: 'Dr.XYZ',
    semester: '3rd',
    course_name: 'Object Oriented Programming (RE)',
    course_code: 'CSE201R',
    is_conducted: 'Yes',
    course_type: 'Repeat',
    exam_mode: 'Written',
    exam_weightage: '20',
    duration: '1.5',
    remark: 'Re-Exam for eligible backlog students',
    is_reexam: true
  }
];

// Options for dropdowns
const SEMESTER_OPTIONS = ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th'];

const COURSE_TYPE_OPTIONS = [
  'Regular',
  'Regular+ Repeat',
  'Repeat',
  'Recourse',
  'MDC',
  'Multidisciplinary Course',
  'Open elective'
];

const EXAM_MODE_OPTIONS = [
  'Written',
  'Online/Lab exam',
  'Lab Based',
  'Project-based evaluation',
  'Project Based (Viva)'
];

const DURATION_PRESETS = [
  '1',
  '1.5',
  '2',
  '3',
  '30 Min',
  '45 Min',
  'Complete Day for whole batch'
];

export default function FacultyExamRequirements({ user }) {
  const backendUrl = import.meta.env?.VITE_BACKEND_URL || 'http://localhost:5000';
  const facultyName = user?.name || user?.full_name || 'Dr. Faculty Coordinator';

  // Spreadsheet Data State
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [lastSynced, setLastSynced] = useState(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [saveStatus, setSaveStatus] = useState('idle'); // 'idle' | 'saving' | 'saved' | 'error'
  const [statusMessage, setStatusMessage] = useState('');

  // Course autocomplete catalog from Neon DB
  const [catalogCourses, setCatalogCourses] = useState([]);
  const [facultyAllocations, setFacultyAllocations] = useState([]);

  // Grid / Selection State
  const [selectedCell, setSelectedCell] = useState({ rowIdx: 0, colKey: 'course_name' });
  const [selectedRowIndices, setSelectedRowIndices] = useState(new Set());
  const [editingCell, setEditingCell] = useState(null); // { rowIdx, colKey }
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('all'); // 'all' | 'conducted' | 'exempted' | 'reexams'

  // History for Undo/Redo
  const [history, setHistory] = useState([]);
  const [future, setFuture] = useState([]);

  // File input ref for upload
  const fileInputRef = useRef(null);
  const cellInputRef = useRef(null);

  // Column definitions for the Excel Grid
  const columns = useMemo(() => [
    { key: 'sr_no', letter: 'A', title: 'Sr.no.', width: 'w-16 min-w-[64px]', readOnly: true },
    { key: 'coordinator_name', letter: 'B', title: 'Name of coordinator', width: 'w-48 min-w-[192px]' },
    { key: 'semester', letter: 'C', title: 'Semester', width: 'w-24 min-w-[96px]', isDropdown: true, options: SEMESTER_OPTIONS },
    { key: 'course_name', letter: 'D', title: 'Course Name', width: 'w-64 min-w-[256px]' },
    { key: 'course_code', letter: 'E', title: 'Course code', width: 'w-36 min-w-[144px]' },
    { key: 'is_conducted', letter: 'F', title: 'Whether mid-term exam is to be conducted through the committee?', width: 'w-56 min-w-[224px]', isDropdown: true, options: ['Yes', 'No'] },
    { key: 'course_type', letter: 'G', title: 'Course type (Regular, Repeat, Recourse, MDC, OE)', width: 'w-52 min-w-[208px]', isDropdown: true, options: COURSE_TYPE_OPTIONS },
    { key: 'exam_mode', letter: 'H', title: 'Exam mode (Written, Lab, Project-based)', width: 'w-48 min-w-[192px]', isDropdown: true, options: EXAM_MODE_OPTIONS },
    { key: 'exam_weightage', letter: 'I', title: 'Exam Weightage', width: 'w-32 min-w-[128px]' },
    { key: 'duration', letter: 'J', title: 'Duration of Exam (time in hours / min)', width: 'w-48 min-w-[192px]', isDropdown: true, options: DURATION_PRESETS },
    { key: 'remark', letter: 'K', title: 'Remark (Evaluation / Room requirements)', width: 'w-72 min-w-[288px]' }
  ], []);

  // Fetch initial data from Neon backend
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // 1. Fetch courses and faculty allocations to enrich autocomplete
      const [coursesRes, teachersRes] = await Promise.all([
        fetch(`${backendUrl}/api/admin/courses`).catch(() => null),
        fetch(`${backendUrl}/api/admin/teachers`).catch(() => null)
      ]);

      if (coursesRes && coursesRes.ok) {
        const coursesData = await coursesRes.json();
        setCatalogCourses(coursesData);
      }

      if (teachersRes && teachersRes.ok) {
        const teachersData = await teachersRes.json();
        const matched = teachersData.find(t => 
          (user?.id && t.id === user.id) || 
          (t.full_name && user?.name && t.full_name.toLowerCase().includes(user.name.toLowerCase()))
        );
        if (matched?.allocations) {
          setFacultyAllocations(matched.allocations);
        }
      }

      // 2. Fetch saved exam requirements from Neon backend
      let loadedRows = [];
      const reqRes = await fetch(`${backendUrl}/api/exam-requirements`).catch(() => null);
      if (reqRes && reqRes.ok) {
        const data = await reqRes.json();
        if (Array.isArray(data) && data.length > 0) {
          loadedRows = data;
        }
      }

      // If database is empty or not initialized, check local storage or seed default templates
      if (loadedRows.length === 0) {
        const cached = localStorage.getItem('examnex_faculty_sheet');
        if (cached) {
          try {
            loadedRows = JSON.parse(cached);
          } catch (e) {}
        }
      }

      if (!loadedRows || loadedRows.length === 0) {
        loadedRows = DEFAULT_TEMPLATES.map(t => ({
          ...t,
          coordinator_name: user?.name || t.coordinator_name
        }));
      }

      setRows(loadedRows);
      setLastSynced(new Date());
    } catch (err) {
      console.warn('Error fetching exam requirements:', err);
      setRows(DEFAULT_TEMPLATES.map(t => ({
        ...t,
        coordinator_name: user?.name || t.coordinator_name
      })));
    } finally {
      setLoading(false);
    }
  }, [backendUrl, user]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Push state to undo history
  const recordHistory = useCallback((newRows) => {
    setHistory(prev => [...prev.slice(-20), rows]);
    setFuture([]);
    setRows(newRows);
    setHasUnsavedChanges(true);
    setSaveStatus('idle');
    try {
      localStorage.setItem('examnex_faculty_sheet', JSON.stringify(newRows));
    } catch (e) {}
  }, [rows]);

  const handleUndo = () => {
    if (history.length === 0) return;
    const previous = history[history.length - 1];
    setFuture(prev => [rows, ...prev]);
    setHistory(prev => prev.slice(0, prev.length - 1));
    setRows(previous);
    setHasUnsavedChanges(true);
  };

  const handleRedo = () => {
    if (future.length === 0) return;
    const next = future[0];
    setHistory(prev => [...prev, rows]);
    setFuture(prev => prev.slice(1));
    setRows(next);
    setHasUnsavedChanges(true);
  };

  // Cell change handler
  const handleCellChange = (rowIdx, colKey, value) => {
    const updated = [...rows];
    const targetRow = { ...updated[rowIdx] };

    targetRow[colKey] = value;

    // Automatic re-exam flag detection
    if (colKey === 'course_code' || colKey === 'course_name' || colKey === 'course_type') {
      const code = (targetRow.course_code || '').toUpperCase();
      const name = (targetRow.course_name || '').toUpperCase();
      const type = (targetRow.course_type || '').toUpperCase();

      if (code.endsWith('R') || name.includes('(RE)') || name.includes('RE-EXAM') || type.includes('REPEAT') || type.includes('RECOURSE')) {
        targetRow.is_reexam = true;
      }
    }

    // Auto-fill course name when course code is selected from catalog
    if (colKey === 'course_code') {
      const matched = catalogCourses.find(c => c.course_code?.toUpperCase() === value.trim().toUpperCase());
      if (matched) {
        targetRow.course_name = matched.course_title || targetRow.course_name;
        if (matched.taught_in && matched.taught_in.length > 0) {
          targetRow.semester = `${matched.taught_in[0].semester}${matched.taught_in[0].semester === 1 ? 'st' : (matched.taught_in[0].semester === 2 ? 'nd' : (matched.taught_in[0].semester === 3 ? 'rd' : 'th'))}`;
        }
      }
    }

    updated[rowIdx] = targetRow;
    recordHistory(updated);
  };

  // Sync / Save to Neon Database
  const handleSyncToBackend = async () => {
    setSyncing(true);
    setSaveStatus('saving');
    setStatusMessage('Syncing sheet data with Neon Database...');

    try {
      const payload = {
        rows: rows.map(r => ({
          ...r,
          coordinator_name: r.coordinator_name || facultyName,
          coordinator_id: user?.id || null,
          coordinator_email: user?.email || null
        })),
        updateCourses: true
      };

      const res = await fetch(`${backendUrl}/api/exam-requirements/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        const data = await res.json();
        if (data.rows && data.rows.length > 0) {
          setRows(data.rows);
        }
        setLastSynced(new Date());
        setHasUnsavedChanges(false);
        setSaveStatus('saved');
        setStatusMessage('All changes successfully committed to Neon Database!');
        setTimeout(() => setSaveStatus('idle'), 3000);
      } else {
        throw new Error('Server returned error while syncing');
      }
    } catch (err) {
      console.warn('Backend sync failed, storing locally:', err);
      localStorage.setItem('examnex_faculty_sheet', JSON.stringify(rows));
      setSaveStatus('error');
      setStatusMessage('Sync temporarily delayed. Sheet is saved in local browser storage.');
      setTimeout(() => setSaveStatus('idle'), 4000);
    } finally {
      setSyncing(false);
    }
  };

  // Auto-save debounce effect (saves 2.5 seconds after last edit)
  useEffect(() => {
    if (!hasUnsavedChanges || syncing) return;

    const timer = setTimeout(() => {
      handleSyncToBackend();
    }, 2500);

    return () => clearTimeout(timer);
  }, [rows, hasUnsavedChanges]);

  // Add a standard row
  const handleAddRow = () => {
    const newRow = {
      id: Date.now(),
      coordinator_name: facultyName,
      semester: '1st',
      course_name: '',
      course_code: '',
      is_conducted: 'Yes',
      course_type: 'Regular',
      exam_mode: 'Written',
      exam_weightage: '20',
      duration: '1',
      remark: '',
      is_reexam: false
    };
    recordHistory([...rows, newRow]);
    setSelectedCell({ rowIdx: rows.length, colKey: 'course_name' });
  };

  // Add a dedicated Re-Exam row
  const handleAddReExamRow = () => {
    const newRow = {
      id: Date.now(),
      coordinator_name: facultyName,
      semester: '3rd',
      course_name: 'Backlog / Re-Exam Course (RE)',
      course_code: 'CSE201R',
      is_conducted: 'Yes',
      course_type: 'Repeat',
      exam_mode: 'Written',
      exam_weightage: '20',
      duration: '1.5',
      remark: 'Special Re-Exam session for eligible students',
      is_reexam: true
    };
    recordHistory([...rows, newRow]);
    setSelectedCell({ rowIdx: rows.length, colKey: 'course_code' });
  };

  // Load faculty's officially allocated courses from database
  const handleLoadAllocatedCourses = () => {
    if (facultyAllocations.length === 0) {
      alert('No specific course allocations found for your faculty account in the database. You can manually enter or select courses.');
      return;
    }

    const newRows = facultyAllocations.map((alloc, idx) => ({
      id: Date.now() + idx,
      coordinator_name: facultyName,
      semester: `${alloc.semester}${alloc.semester === 1 ? 'st' : (alloc.semester === 2 ? 'nd' : (alloc.semester === 3 ? 'rd' : 'th'))}`,
      course_name: alloc.course_title || 'Allocated Course',
      course_code: alloc.course_code || '',
      is_conducted: 'Yes',
      course_type: 'Regular',
      exam_mode: 'Written',
      exam_weightage: '20',
      duration: '1',
      remark: `Allocated for ${alloc.stream} - Sem ${alloc.semester} (${alloc.batch || ''})`,
      is_reexam: false
    }));

    recordHistory([...rows, ...newRows]);
    alert(`Added ${newRows.length} allocated course(s) from your department timetable!`);
  };

  // Insert predefined Template
  const handleInsertTemplate = (templateType) => {
    let t;
    if (templateType === 1) {
      t = {
        id: Date.now(),
        coordinator_name: facultyName,
        semester: '1st',
        course_name: 'Programming & Problem Solving',
        course_code: 'CSE1001',
        is_conducted: 'Yes',
        course_type: 'Regular+ Repeat',
        exam_mode: 'Written',
        exam_weightage: '20',
        duration: '1',
        remark: 'Regular + Repeat Examination',
        is_reexam: false
      };
    } else if (templateType === 2) {
      t = {
        id: Date.now(),
        coordinator_name: facultyName,
        semester: '3rd',
        course_name: 'Web Technologies & Cloud Lab',
        course_code: 'CSE3102',
        is_conducted: 'Yes',
        course_type: 'MDC',
        exam_mode: 'Lab Based',
        exam_weightage: '10',
        duration: '30 Min',
        remark: 'Multidisciplinary Course (MDC) Lab Evaluation',
        is_reexam: false
      };
    } else if (templateType === 3) {
      t = {
        id: Date.now(),
        coordinator_name: facultyName,
        semester: '5th',
        course_name: 'Capstone Design Project',
        course_code: 'CSE5001',
        is_conducted: 'No',
        course_type: 'Regular',
        exam_mode: 'Project Based (Viva)',
        exam_weightage: '10',
        duration: 'Complete Day for whole batch',
        remark: 'No central written exam. Internal viva evaluation conducted in department',
        is_reexam: false
      };
    }
    if (t) {
      recordHistory([...rows, t]);
    }
  };

  // Delete selected or active row
  const handleDeleteRow = (indexToDelete) => {
    if (rows.length <= 1) {
      alert('The spreadsheet must contain at least one row.');
      return;
    }
    const updated = rows.filter((_, idx) => idx !== indexToDelete);
    recordHistory(updated);
    if (selectedCell.rowIdx >= updated.length) {
      setSelectedCell(prev => ({ ...prev, rowIdx: Math.max(0, updated.length - 1) }));
    }
  };

  // Delete bulk selected rows
  const handleDeleteSelected = () => {
    if (selectedRowIndices.size === 0) return;
    if (rows.length - selectedRowIndices.size < 1) {
      alert('Cannot delete all rows.');
      return;
    }
    const updated = rows.filter((_, idx) => !selectedRowIndices.has(idx));
    recordHistory(updated);
    setSelectedRowIndices(new Set());
  };

  // Toggle row selection checkbox
  const toggleRowSelection = (idx) => {
    setSelectedRowIndices(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  // Export to Excel (.xlsx) matching exact university format
  const handleExportExcel = () => {
    try {
      const exportData = rows.map((r, idx) => ({
        'Sr.no.': idx + 1,
        'Name of coordinator': r.coordinator_name || '',
        'Semester': r.semester || '',
        'Course Name': r.course_name || '',
        'Course code': r.course_code || '',
        'Whether mid-term exam is to be conducted through the committee?': r.is_conducted || 'Yes',
        'Course type': r.course_type || 'Regular',
        'Exam mode': r.exam_mode || 'Written',
        'Exam Weightage': r.exam_weightage || '20',
        'Duration of Exam': r.duration || '1',
        'Remark': r.remark || (r.is_reexam ? 'Re-Exam included' : '')
      }));

      const worksheet = XLSX.utils.json_to_sheet(exportData);
      
      const colWidths = [
        { wch: 8 },  // Sr.no.
        { wch: 24 }, // Name of coordinator
        { wch: 12 }, // Semester
        { wch: 32 }, // Course Name
        { wch: 16 }, // Course code
        { wch: 36 }, // Whether mid-term
        { wch: 22 }, // Course type
        { wch: 24 }, // Exam mode
        { wch: 16 }, // Weightage
        { wch: 24 }, // Duration
        { wch: 36 }  // Remark
      ];
      worksheet['!cols'] = colWidths;

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Exam Requirements');
      
      const fileName = `Exam_Requirements_${facultyName.replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().split('T')[0]}.xlsx`;
      XLSX.writeFile(workbook, fileName);
    } catch (e) {
      console.error('Failed to export Excel:', e);
      alert('Failed to generate Excel download.');
    }
  };

  // Import from Excel (.xlsx/.csv)
  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws, { defval: '' });

        if (data.length === 0) {
          alert('Uploaded spreadsheet appears empty.');
          return;
        }

        const importedRows = data.map((row, idx) => {
          const findKey = (candidates) => {
            const rowKeys = Object.keys(row);
            for (const cand of candidates) {
              const matched = rowKeys.find(k => k.toLowerCase().includes(cand.toLowerCase()));
              if (matched) return row[matched];
            }
            return '';
          };

          const coord = findKey(['coordinator', 'name']) || facultyName;
          const sem = findKey(['semester', 'sem']) || '1st';
          const cName = findKey(['course name', 'course_name', 'title']) || '';
          const cCode = findKey(['course code', 'course_code', 'code']) || '';
          const conducted = findKey(['whether', 'conduct', 'committee']) || 'Yes';
          const cType = findKey(['course type', 'type']) || 'Regular';
          const eMode = findKey(['exam mode', 'mode']) || 'Written';
          const eWeight = findKey(['weightage', 'weight']) || '20';
          const eDur = findKey(['duration', 'time', 'hours']) || '1';
          const rem = findKey(['remark', 'notes', 'comment']) || '';

          const isReexam = cCode.toUpperCase().endsWith('R') || cName.toUpperCase().includes('(RE)') || cType.toUpperCase().includes('REPEAT');

          return {
            id: Date.now() + idx,
            coordinator_name: coord,
            semester: sem,
            course_name: cName,
            course_code: cCode,
            is_conducted: conducted.toLowerCase().includes('no') ? 'No' : 'Yes',
            course_type: cType,
            exam_mode: eMode,
            exam_weightage: eWeight.toString(),
            duration: eDur.toString(),
            remark: rem,
            is_reexam: isReexam
          };
        });

        recordHistory(importedRows);
        alert(`Successfully imported ${importedRows.length} exam requirement rows!`);
      } catch (err) {
        console.error('Import error:', err);
        alert('Could not read the uploaded Excel file. Please ensure it follows the format.');
      }
    };
    reader.readAsBinaryString(file);
    e.target.value = '';
  };

  // Keyboard Navigation in the Live Grid
  const handleKeyDown = (e, rowIdx, colKey) => {
    const colKeys = columns.map(c => c.key);
    const currentColIdx = colKeys.indexOf(colKey);

    if (e.key === 'Enter') {
      e.preventDefault();
      setEditingCell(null);
      if (rowIdx < rows.length - 1) {
        setSelectedCell({ rowIdx: rowIdx + 1, colKey });
      } else {
        handleAddRow();
      }
    } else if (e.key === 'Tab') {
      e.preventDefault();
      setEditingCell(null);
      if (e.shiftKey) {
        if (currentColIdx > 0) {
          setSelectedCell({ rowIdx, colKey: colKeys[currentColIdx - 1] });
        } else if (rowIdx > 0) {
          setSelectedCell({ rowIdx: rowIdx - 1, colKey: colKeys[colKeys.length - 1] });
        }
      } else {
        if (currentColIdx < colKeys.length - 1) {
          setSelectedCell({ rowIdx, colKey: colKeys[currentColIdx + 1] });
        } else if (rowIdx < rows.length - 1) {
          setSelectedCell({ rowIdx: rowIdx + 1, colKey: colKeys[0] });
        } else {
          handleAddRow();
        }
      }
    } else if (e.key === 'Escape') {
      setEditingCell(null);
    }
  };

  // Filtered rows for Active Tab and Search
  const filteredRows = useMemo(() => {
    return rows.map((r, originalIdx) => ({ ...r, originalIdx })).filter(r => {
      if (activeTab === 'conducted' && r.is_conducted !== 'Yes') return false;
      if (activeTab === 'exempted' && r.is_conducted !== 'No') return false;
      if (activeTab === 'reexams' && !r.is_reexam) return false;

      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const combined = `${r.coordinator_name} ${r.semester} ${r.course_name} ${r.course_code} ${r.course_type} ${r.exam_mode} ${r.remark}`.toLowerCase();
        return combined.includes(query);
      }

      return true;
    });
  }, [rows, activeTab, searchQuery]);

  // Aggregate stats
  const stats = useMemo(() => {
    const total = rows.length;
    const conductedCount = rows.filter(r => r.is_conducted === 'Yes').length;
    const exemptedCount = rows.filter(r => r.is_conducted === 'No').length;
    const reexamCount = rows.filter(r => r.is_reexam).length;
    const totalWeight = rows.reduce((acc, r) => acc + (parseFloat(r.exam_weightage) || 0), 0);
    return { total, conductedCount, exemptedCount, reexamCount, totalWeight };
  }, [rows]);

  const activeColLetter = columns.find(c => c.key === selectedCell.colKey)?.letter || 'A';
  const activeCellCoord = `${activeColLetter}${selectedCell.rowIdx + 1}`;
  const activeCellValue = rows[selectedCell.rowIdx]?.[selectedCell.colKey] || '';

  return (
    <div className="w-full flex flex-col space-y-4 max-w-[1700px] mx-auto pb-12 animate-in fade-in duration-300">
      
      {/* Top Header Card - Google Sheets / Excel Style */}
      <div className="bg-white dark:bg-[#111111] rounded-2xl border border-slate-200 dark:border-white/10 shadow-sm p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start sm:items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-md">
            <FileSpreadsheet className="w-6 h-6" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white tracking-tight">
                Faculty Exam Conduct & Scheduling Requirements
              </h1>
              <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800/40">
                Live Excel Editor
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Specify mid-term conduction status, exam duration, weightage, and re-exam slots. Synchronized with Neon DB.
            </p>
          </div>
        </div>

        {/* Sync Status & Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-xs">
            <span className={`w-2 h-2 rounded-full ${syncing ? 'bg-amber-500 animate-ping' : (hasUnsavedChanges ? 'bg-amber-400' : 'bg-emerald-500')}`} />
            <span className="text-slate-600 dark:text-slate-300 font-medium">
              {syncing ? 'Saving to Neon DB...' : (hasUnsavedChanges ? 'Unsaved Edits (Auto-saving...)' : 'Synced to Neon DB')}
            </span>
            {lastSynced && (
              <span className="text-[10px] text-slate-400 hidden sm:inline">
                • {lastSynced.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </div>

          <button
            onClick={handleSyncToBackend}
            disabled={syncing}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-semibold transition-all shadow-sm disabled:opacity-50 cursor-pointer"
            title="Commit changes directly to Neon PostgreSQL Database"
          >
            <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
            <span>{syncing ? 'Syncing...' : 'Sync Now'}</span>
          </button>

          <button
            onClick={handleExportExcel}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 text-slate-700 dark:text-slate-200 text-xs sm:text-sm font-medium transition-colors border border-slate-200 dark:border-white/10"
            title="Download clean Excel file for exam committee"
          >
            <Download className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span className="hidden sm:inline">Export Excel</span>
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx, .xls, .csv"
            onChange={handleFileUpload}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 text-slate-600 dark:text-slate-300 transition-colors border border-slate-200 dark:border-white/10"
            title="Import Excel file"
          >
            <Upload className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Ribbon / Toolbar Section */}
      <div className="bg-white dark:bg-[#111111] rounded-2xl border border-slate-200 dark:border-white/10 shadow-sm p-3 flex flex-wrap items-center justify-between gap-3 text-xs">
        
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleAddRow}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/50 font-semibold transition-colors border border-blue-200 dark:border-blue-800/40"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Row</span>
          </button>

          <button
            onClick={handleAddReExamRow}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/50 font-semibold transition-colors border border-amber-200 dark:border-amber-800/40"
            title="Add a re-exam slot for backlog/repeat students"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            <span>+ Add Re-Exam Slot</span>
          </button>

          {facultyAllocations.length > 0 && (
            <button
              onClick={handleLoadAllocatedCourses}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-900/50 font-medium transition-colors border border-purple-200 dark:border-purple-800/40"
              title="Auto-insert your officially allocated subjects from university database"
            >
              <UserCheck className="w-3.5 h-3.5" />
              <span>Load My Courses ({facultyAllocations.length})</span>
            </button>
          )}

          <div className="relative group">
            <button className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 text-slate-700 dark:text-slate-300 font-medium transition-colors">
              <span>Insert Template</span>
              <ChevronDown className="w-3 h-3 text-slate-400" />
            </button>
            <div className="absolute left-0 top-full mt-1 w-64 bg-white dark:bg-[#1a1a1a] rounded-xl shadow-xl border border-slate-200 dark:border-white/10 py-1.5 hidden group-hover:block z-30 animate-in fade-in duration-150">
              <button
                onClick={() => handleInsertTemplate(1)}
                className="w-full text-left px-3 py-2 text-xs hover:bg-slate-50 dark:hover:bg-white/5 text-slate-700 dark:text-slate-200 flex flex-col"
              >
                <span className="font-semibold text-blue-600 dark:text-blue-400">Template 1 (Regular + Repeat)</span>
                <span className="text-[10px] text-slate-400">1st Sem, Written, 20% Wt, 1 hr</span>
              </button>
              <button
                onClick={() => handleInsertTemplate(2)}
                className="w-full text-left px-3 py-2 text-xs hover:bg-slate-50 dark:hover:bg-white/5 text-slate-700 dark:text-slate-200 flex flex-col border-t border-slate-100 dark:border-white/5"
              >
                <span className="font-semibold text-emerald-600 dark:text-emerald-400">Template 2 (MDC Lab Exam)</span>
                <span className="text-[10px] text-slate-400">3rd Sem, Lab Based, 10% Wt, 30 Min</span>
              </button>
              <button
                onClick={() => handleInsertTemplate(3)}
                className="w-full text-left px-3 py-2 text-xs hover:bg-slate-50 dark:hover:bg-white/5 text-slate-700 dark:text-slate-200 flex flex-col border-t border-slate-100 dark:border-white/5"
              >
                <span className="font-semibold text-purple-600 dark:text-purple-400">Template 3 (Project Based Viva)</span>
                <span className="text-[10px] text-slate-400">5th Sem, No Central Exam, Full Day Viva</span>
              </button>
            </div>
          </div>

          <div className="h-4 w-px bg-slate-200 dark:bg-white/10 mx-1 hidden sm:block" />

          {selectedRowIndices.size > 0 && (
            <button
              onClick={handleDeleteSelected}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 hover:bg-red-100 font-semibold transition-colors border border-red-200 dark:border-red-900/40"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete ({selectedRowIndices.size})</span>
            </button>
          )}

          <div className="flex items-center gap-1">
            <button
              onClick={handleUndo}
              disabled={history.length === 0}
              className="p-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-white/5 text-slate-600 dark:text-slate-400 disabled:opacity-30"
              title="Undo (Ctrl+Z)"
            >
              <span className="font-mono text-xs font-bold">↶ Undo</span>
            </button>
            <button
              onClick={handleRedo}
              disabled={future.length === 0}
              className="p-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-white/5 text-slate-600 dark:text-slate-400 disabled:opacity-30"
              title="Redo (Ctrl+Y)"
            >
              <span className="font-mono text-xs font-bold">↷ Redo</span>
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative w-full sm:w-60">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Filter courses / code..."
              className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>
        </div>
      </div>

      {/* Formula & Active Cell Bar */}
      <div className="bg-slate-50 dark:bg-[#161616] rounded-xl border border-slate-200 dark:border-white/10 px-3 py-2 flex items-center gap-3 text-xs">
        <div className="px-2.5 py-1 rounded bg-white dark:bg-black/40 border border-slate-200 dark:border-white/10 font-mono font-bold text-slate-700 dark:text-slate-300 min-w-[50px] text-center shadow-xs">
          {activeCellCoord}
        </div>
        <div className="font-serif italic text-slate-400 font-bold select-none text-sm">
          fx
        </div>
        <div className="flex-1">
          <input
            type="text"
            value={activeCellValue}
            onChange={e => {
              if (selectedCell.colKey !== 'sr_no') {
                handleCellChange(selectedCell.rowIdx, selectedCell.colKey, e.target.value);
              }
            }}
            placeholder="Edit selected cell value here or double click table cell..."
            className="w-full bg-transparent border-none text-xs text-slate-900 dark:text-white focus:outline-none"
          />
        </div>
      </div>

      {statusMessage && (
        <div className={`p-3 rounded-xl border flex items-center gap-2.5 text-xs animate-in fade-in duration-200 ${
          saveStatus === 'saved' 
            ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800/40 text-emerald-800 dark:text-emerald-200' 
            : (saveStatus === 'error' ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800/40 text-amber-800 dark:text-amber-200' : 'bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800/40 text-blue-800 dark:text-blue-200')
        }`}>
          {saveStatus === 'saved' && <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />}
          {saveStatus === 'error' && <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />}
          {saveStatus === 'saving' && <RefreshCw className="w-4 h-4 animate-spin text-blue-600 shrink-0" />}
          <span className="font-medium">{statusMessage}</span>
        </div>
      )}

      {/* Main Excel Spreadsheet Grid Container */}
      <div className="bg-white dark:bg-[#111111] rounded-2xl border border-slate-200 dark:border-white/10 shadow-lg overflow-hidden flex flex-col">
        <div className="overflow-x-auto overflow-y-auto max-h-[620px] custom-scrollbar relative">
          <table className="w-full text-left border-collapse border-spacing-0 text-xs">
            <thead className="sticky top-0 z-20 bg-slate-100 dark:bg-[#181818] border-b border-slate-300 dark:border-white/15 select-none">
              <tr>
                <th className="w-12 min-w-[48px] p-2 text-center bg-slate-200 dark:bg-[#222222] border-r border-b border-slate-300 dark:border-white/15 text-[11px] font-mono text-slate-500">
                  <input
                    type="checkbox"
                    checked={rows.length > 0 && selectedRowIndices.size === rows.length}
                    onChange={(e) => {
                      if (e.target.checked) setSelectedRowIndices(new Set(rows.map((_, idx) => idx)));
                      else setSelectedRowIndices(new Set());
                    }}
                    className="rounded text-emerald-600 focus:ring-emerald-500 h-3.5 w-3.5 cursor-pointer"
                    title="Select All Rows"
                  />
                </th>

                {columns.map(col => (
                  <th
                    key={col.key}
                    className={`${col.width} p-2 text-center border-r border-slate-300 dark:border-white/15 font-mono text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider bg-slate-100 dark:bg-[#181818]`}
                  >
                    {col.letter}
                  </th>
                ))}

                <th className="w-12 min-w-[48px] p-2 text-center font-mono text-[11px] font-bold text-slate-600 dark:text-slate-400">
                  Del
                </th>
              </tr>

              <tr className="bg-slate-50 dark:bg-[#141414] border-b border-slate-300 dark:border-white/15">
                <th className="p-2 text-center border-r border-slate-300 dark:border-white/15 font-mono text-[10px] text-slate-400 bg-slate-100 dark:bg-[#1c1c1c]">
                  #
                </th>
                {columns.map(col => (
                  <th
                    key={col.key}
                    className={`${col.width} px-3 py-2.5 border-r border-slate-300 dark:border-white/15 font-bold text-slate-800 dark:text-slate-200 text-xs leading-tight`}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span>{col.title}</span>
                    </div>
                  </th>
                ))}
                <th className="p-2 text-center text-slate-400 text-[10px]">
                  Action
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-200 dark:divide-white/10 font-sans">
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={columns.length + 2} className="py-16 text-center text-slate-400">
                    <BookOpen className="w-8 h-8 mx-auto mb-2 opacity-40" />
                    <p className="text-sm font-semibold">No exam requirements found</p>
                    <p className="text-xs text-slate-500 mt-1">Click "+ Add Row" above to enter a course or template</p>
                  </td>
                </tr>
              ) : (
                filteredRows.map((row) => {
                  const rowIdx = row.originalIdx;
                  const isRowSelected = selectedRowIndices.has(rowIdx);
                  const isReexam = row.is_reexam;

                  return (
                    <tr
                      key={row.id || rowIdx}
                      className={`transition-colors group ${
                        isRowSelected 
                          ? 'bg-blue-50/70 dark:bg-blue-950/30' 
                          : (isReexam ? 'bg-amber-50/40 dark:bg-amber-950/20' : 'hover:bg-slate-50 dark:hover:bg-white/[0.02]')
                      }`}
                    >
                      <td className="w-12 min-w-[48px] p-2 text-center border-r border-slate-300 dark:border-white/15 font-mono text-xs font-semibold text-slate-500 bg-slate-100/80 dark:bg-[#161616] select-none">
                        <div className="flex items-center justify-center gap-1">
                          <input
                            type="checkbox"
                            checked={isRowSelected}
                            onChange={() => toggleRowSelection(rowIdx)}
                            className="rounded text-emerald-600 focus:ring-emerald-500 h-3 w-3 cursor-pointer"
                          />
                          <span>{rowIdx + 1}</span>
                        </div>
                      </td>

                      {columns.map(col => {
                        const colKey = col.key;
                        const isCellSelected = selectedCell.rowIdx === rowIdx && selectedCell.colKey === colKey;
                        const isEditing = editingCell?.rowIdx === rowIdx && editingCell?.colKey === colKey;
                        const cellValue = colKey === 'sr_no' ? rowIdx + 1 : (row[colKey] ?? '');

                        return (
                          <td
                            key={colKey}
                            onClick={() => {
                              setSelectedCell({ rowIdx, colKey });
                              if (col.isDropdown) setEditingCell({ rowIdx, colKey });
                            }}
                            onDoubleClick={() => {
                              if (!col.readOnly) setEditingCell({ rowIdx, colKey });
                            }}
                            className={`p-0 border-r border-slate-200 dark:border-white/10 relative transition-all ${
                              isCellSelected 
                                ? 'ring-2 ring-emerald-500 ring-inset z-10 bg-emerald-50/20 dark:bg-emerald-950/30' 
                                : ''
                            }`}
                          >
                            {isEditing && !col.readOnly ? (
                              col.isDropdown ? (
                                <select
                                  autoFocus
                                  value={cellValue}
                                  onChange={e => {
                                    handleCellChange(rowIdx, colKey, e.target.value);
                                    setEditingCell(null);
                                  }}
                                  onBlur={() => setEditingCell(null)}
                                  className="w-full h-full p-2 bg-white dark:bg-[#1a1a1a] text-xs font-medium text-slate-900 dark:text-white outline-none border-none cursor-pointer"
                                >
                                  {col.options.map(opt => (
                                    <option key={typeof opt === 'object' ? opt.value : opt} value={typeof opt === 'object' ? opt.value : opt}>
                                      {typeof opt === 'object' ? opt.label : opt}
                                    </option>
                                  ))}
                                </select>
                              ) : (
                                <input
                                  ref={cellInputRef}
                                  autoFocus
                                  type="text"
                                  value={cellValue}
                                  onChange={e => handleCellChange(rowIdx, colKey, e.target.value)}
                                  onBlur={() => setEditingCell(null)}
                                  onKeyDown={e => handleKeyDown(e, rowIdx, colKey)}
                                  className="w-full h-full p-2 bg-white dark:bg-[#1a1a1a] text-xs text-slate-900 dark:text-white outline-none border-none"
                                />
                              )
                            ) : (
                              <div className="px-3 py-2 min-h-[36px] flex items-center justify-between gap-1 overflow-hidden select-none">
                                <span className={`truncate ${colKey === 'course_code' ? 'font-mono font-bold text-blue-600 dark:text-blue-400' : ''} ${colKey === 'is_conducted' && cellValue === 'Yes' ? 'text-emerald-600 dark:text-emerald-400 font-bold' : ''} ${colKey === 'is_conducted' && cellValue === 'No' ? 'text-amber-600 dark:text-amber-400 font-semibold' : ''}`}>
                                  {cellValue || <span className="text-slate-300 dark:text-slate-600 italic">Empty</span>}
                                </span>

                                {colKey === 'course_code' && isReexam && (
                                  <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-300 shrink-0">
                                    RE-EXAM
                                  </span>
                                )}

                                {colKey === 'is_conducted' && (
                                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
                                    cellValue === 'Yes' 
                                      ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300' 
                                      : 'bg-slate-200 dark:bg-white/10 text-slate-600 dark:text-slate-400'
                                  }`}>
                                    {cellValue === 'Yes' ? 'Conducted' : 'Exempt'}
                                  </span>
                                )}
                              </div>
                            )}

                            {isCellSelected && (
                              <div className="absolute -bottom-1 -right-1 w-2.5 h-2.5 bg-emerald-600 border border-white dark:border-black rounded-xs z-20 pointer-events-none" />
                            )}
                          </td>
                        );
                      })}

                      <td className="w-12 min-w-[48px] p-2 text-center">
                        <button
                          onClick={() => handleDeleteRow(rowIdx)}
                          className="p-1 rounded text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                          title="Delete Row"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Bottom Sheet Tabs Bar */}
        <div className="bg-slate-100 dark:bg-[#161616] border-t border-slate-200 dark:border-white/10 p-2 sm:px-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs select-none">
          <div className="flex items-center gap-1 overflow-x-auto w-full sm:w-auto">
            <button
              onClick={() => setActiveTab('all')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all flex items-center gap-1.5 ${
                activeTab === 'all'
                  ? 'bg-white dark:bg-[#222222] text-emerald-600 dark:text-emerald-400 shadow-xs border border-slate-200 dark:border-white/10'
                  : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>All Requirements ({stats.total})</span>
            </button>

            <button
              onClick={() => setActiveTab('conducted')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all flex items-center gap-1.5 ${
                activeTab === 'conducted'
                  ? 'bg-white dark:bg-[#222222] text-emerald-600 dark:text-emerald-400 shadow-xs border border-slate-200 dark:border-white/10'
                  : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              <Check className="w-3.5 h-3.5 text-emerald-500" />
              <span>Conducted ({stats.conductedCount})</span>
            </button>

            <button
              onClick={() => setActiveTab('exempted')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all flex items-center gap-1.5 ${
                activeTab === 'exempted'
                  ? 'bg-white dark:bg-[#222222] text-amber-600 dark:text-amber-400 shadow-xs border border-slate-200 dark:border-white/10'
                  : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              <span>Exempt / Internal ({stats.exemptedCount})</span>
            </button>

            <button
              onClick={() => setActiveTab('reexams')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all flex items-center gap-1.5 ${
                activeTab === 'reexams'
                  ? 'bg-white dark:bg-[#222222] text-blue-600 dark:text-blue-400 shadow-xs border border-slate-200 dark:border-white/10'
                  : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span>Re-Exams ({stats.reexamCount})</span>
            </button>
          </div>

          <div className="flex items-center gap-4 text-[11px] text-slate-500 dark:text-slate-400 w-full sm:w-auto justify-end">
            <span>
              Total Rows: <strong className="text-slate-800 dark:text-slate-200">{stats.total}</strong>
            </span>
            <span>
              Exams to Schedule: <strong className="text-emerald-600 dark:text-emerald-400">{stats.conductedCount}</strong>
            </span>
            <span>
              Re-Exams: <strong className="text-amber-600 dark:text-amber-400">{stats.reexamCount}</strong>
            </span>
          </div>
        </div>
      </div>

      {/* Helper Information Card */}
      <div className="p-4 rounded-xl bg-blue-50/60 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/30 text-xs text-blue-900 dark:text-blue-200 flex items-start gap-3">
        <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-bold">Instructions for Faculty Coordinators:</p>
          <ul className="list-disc list-inside space-y-0.5 text-slate-600 dark:text-slate-300 text-[11px]">
            <li>Select <strong>Yes</strong> under <em>Whether mid-term exam is to be conducted through the committee</em> if your course requires central room allocation and invigilation.</li>
            <li>For Lab exams or Viva presentations handled directly by the department, set <strong>No</strong> and state duration as <em>Complete Day</em> or <em>Lab Based</em>.</li>
            <li>Use the <strong>+ Add Re-Exam Slot</strong> button to submit backlog and re-exam scheduling requirements for previous semester batches.</li>
            <li>Every edit is automatically synced with the university <strong>Neon PostgreSQL Database</strong> and will be read by the central examination schedule generator.</li>
          </ul>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{__html: `
        .custom-scrollbar::-webkit-scrollbar { height: 8px; width: 8px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(156, 163, 175, 0.4); border-radius: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(156, 163, 175, 0.6); }
      `}} />
    </div>
  );
}
