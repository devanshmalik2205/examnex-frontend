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
  CheckCircle2,
  X,
  Undo2,
  Redo2,
  ChevronDown,
  Menu
} from 'lucide-react';
import * as XLSX from 'xlsx';

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

// Helper to create acronyms (e.g., "Advanced Data Science" -> "ADS")
const getAcronym = (text) => {
  if (!text) return '';
  const words = text.split(/[\s\-_]+/);
  let acronym = '';
  words.forEach(w => {
      const match = w.match(/[a-zA-Z0-9]/);
      if (match) acronym += match[0].toUpperCase();
  });
  return acronym;
};

export default function FacultyExamRequirements({ user }) {
  const backendUrl = import.meta.env?.VITE_BACKEND_URL || 'http://localhost:5000';
  const facultyName = user?.name || user?.full_name || 'Dr. Faculty Coordinator';

  // Spreadsheet Data State
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [saveStatus, setSaveStatus] = useState('idle'); // 'idle' | 'saving' | 'saved' | 'error'

  // Course autocomplete catalog from Neon DB
  const [catalogCourses, setCatalogCourses] = useState([]);

  // Grid / Selection State
  const [selectedCell, setSelectedCell] = useState({ rowIdx: 0, colKey: 'coordinator_name' });
  const [selectedRowIndices, setSelectedRowIndices] = useState(new Set());
  const [editingCell, setEditingCell] = useState(null); // { rowIdx, colKey }
  const [activeTab, setActiveTab] = useState('all'); // 'all' | 'conducted' | 'exempted' | 'reexams'

  // UI State
  const [showInstructions, setShowInstructions] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(100);
  const [isZoomOpen, setIsZoomOpen] = useState(false);

  // History for Undo/Redo
  const [history, setHistory] = useState([]);
  const [future, setFuture] = useState([]);

  // Refs
  const fileInputRef = useRef(null);
  const cellInputRef = useRef(null);
  const gridContainerRef = useRef(null);
  const zoomDropdownRef = useRef(null);

  // Column definitions for the Excel Grid
  const columns = useMemo(() => [
    { key: 'coordinator_name', letter: 'A', title: 'Name of coordinator', width: 'w-48 min-w-[192px]' },
    { key: 'semester', letter: 'B', title: 'Semester', width: 'w-24 min-w-[96px]', isDropdown: true, options: SEMESTER_OPTIONS },
    { key: 'course_name', letter: 'C', title: 'Course Name', width: 'w-72 min-w-[288px]' },
    { key: 'course_code', letter: 'D', title: 'Course code', width: 'w-36 min-w-[144px]' },
    { key: 'is_conducted', letter: 'E', title: 'Mid-term conducted via committee?', width: 'w-64 min-w-[256px]', isDropdown: true, options: ['Yes', 'No'] },
    { key: 'course_type', letter: 'F', title: 'Course type (Regular, Repeat, MDC)', width: 'w-56 min-w-[224px]', isDropdown: true, options: COURSE_TYPE_OPTIONS },
    { key: 'exam_mode', letter: 'G', title: 'Exam mode (Written, Lab, Project)', width: 'w-56 min-w-[224px]', isDropdown: true, options: EXAM_MODE_OPTIONS },
    { key: 'exam_weightage', letter: 'H', title: 'Weightage %', width: 'w-28 min-w-[112px]' },
    { key: 'duration', letter: 'I', title: 'Duration (hours / min)', width: 'w-48 min-w-[192px]', isDropdown: true, options: DURATION_PRESETS },
    { key: 'remark', letter: 'J', title: 'Remark (Evaluation / Room requirements)', width: 'w-72 min-w-[288px]' }
  ], []);

  // Show instructions once on mount if not seen
  useEffect(() => {
    const seen = localStorage.getItem('examnex_instructions_seen');
    if (!seen) {
      setShowInstructions(true);
    }
  }, []);

  const closeInstructions = () => {
    setShowInstructions(false);
    localStorage.setItem('examnex_instructions_seen', 'true');
  };

  // Close zoom dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (zoomDropdownRef.current && !zoomDropdownRef.current.contains(event.target)) {
        setIsZoomOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch initial data from Neon backend
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // 1. Fetch courses catalog for autocomplete
      const coursesRes = await fetch(`${backendUrl}/api/admin/courses`).catch(() => null);
      if (coursesRes && coursesRes.ok) {
        const coursesData = await coursesRes.json();
        setCatalogCourses(coursesData);
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

      // If database is empty, check local storage
      if (loadedRows.length === 0) {
        const cached = localStorage.getItem('examnex_faculty_sheet');
        if (cached) {
          try { loadedRows = JSON.parse(cached); } catch (e) {}
        }
      }

      // Ensure we have padding rows to look like a real spreadsheet
      const MIN_ROWS = 25;
      if (loadedRows.length < MIN_ROWS) {
          const padding = Array(MIN_ROWS - loadedRows.length).fill(null).map((_, i) => ({
              id: Date.now() + i + 1000, coordinator_name: '', semester: '', course_name: '', course_code: '',
              is_conducted: '', course_type: '', exam_mode: '', exam_weightage: '', duration: '', remark: '', is_reexam: false
          }));
          loadedRows = [...loadedRows, ...padding];
      }

      setRows(loadedRows);
    } catch (err) {
      console.warn('Error fetching data:', err);
    } finally {
      setLoading(false);
    }
  }, [backendUrl]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Push state to undo history
  const recordHistory = useCallback((newRows) => {
    setHistory(prev => [...prev.slice(-20), rows]);
    setFuture([]);
    setRows(newRows);
    setHasUnsavedChanges(true);
    setSaveStatus('unsaved');
    try { localStorage.setItem('examnex_faculty_sheet', JSON.stringify(newRows)); } catch (e) {}
  }, [rows]);

  const handleUndo = () => {
    if (history.length === 0) return;
    const previous = history[history.length - 1];
    setFuture(prev => [rows, ...prev]);
    setHistory(prev => prev.slice(0, prev.length - 1));
    setRows(previous);
    setHasUnsavedChanges(true);
    setSaveStatus('unsaved');
  };

  const handleRedo = () => {
    if (future.length === 0) return;
    const next = future[0];
    setHistory(prev => [...prev, rows]);
    setFuture(prev => prev.slice(1));
    setRows(next);
    setHasUnsavedChanges(true);
    setSaveStatus('unsaved');
  };

  // Cell change handler (With Auto-fill & Smart Acronym Logic)
  const handleCellChange = (rowIdx, colKey, value) => {
    const updated = [...rows];
    const targetRow = { ...updated[rowIdx] };
    targetRow[colKey] = value;

    const inputVal = value.trim().toUpperCase();

    // Automatic re-exam flag detection
    if (colKey === 'course_code' || colKey === 'course_name' || colKey === 'course_type') {
      const code = (targetRow.course_code || '').toUpperCase();
      const name = (targetRow.course_name || '').toUpperCase();
      const type = (targetRow.course_type || '').toUpperCase();

      if (code.endsWith('R') || name.includes('(RE)') || name.includes('RE-EXAM') || type.includes('REPEAT') || type.includes('RECOURSE')) {
        targetRow.is_reexam = true;
      } else {
        targetRow.is_reexam = false;
      }
    }

    // Smart Auto-fill Logic for Course Name and Course Code
    if ((colKey === 'course_name' || colKey === 'course_code') && inputVal !== '') {
      
      // 1. Try Exact Match (Title or Code)
      let matched = catalogCourses.find(c => 
        c.course_title?.toUpperCase() === inputVal || 
        c.course_code?.toUpperCase() === inputVal
      );

      // 2. Try Acronym Match (e.g., 'ADS' -> 'Advanced Data Science')
      if (!matched && inputVal.length > 1 && inputVal.length <= 5) {
        matched = catalogCourses.find(c => {
           const acronym = getAcronym(c.course_title);
           return acronym === inputVal;
        });
      }

      // If a match is found (exact or acronym), auto-populate fields
      if (matched) {
        targetRow.course_name = matched.course_title || targetRow.course_name;
        targetRow.course_code = matched.course_code || targetRow.course_code;
        
        // Only override semester if it is currently blank
        if (!targetRow.semester && matched.taught_in && matched.taught_in.length > 0) {
          targetRow.semester = `${matched.taught_in[0].semester}${matched.taught_in[0].semester === 1 ? 'st' : (matched.taught_in[0].semester === 2 ? 'nd' : (matched.taught_in[0].semester === 3 ? 'rd' : 'th'))}`;
        }
      }
    }

    // Automatically fill Coordinator Name on first edit if empty
    if (!targetRow.coordinator_name && (colKey === 'course_name' || colKey === 'course_code') && inputVal !== '') {
        targetRow.coordinator_name = facultyName;
    }

    updated[rowIdx] = targetRow;
    recordHistory(updated);
  };

  // Sync / Save to Neon Database
  const handleSyncToBackend = async () => {
    if (!hasUnsavedChanges) return;
    setSyncing(true);
    setSaveStatus('saving');

    try {
      // Filter out completely empty rows before saving
      const validRows = rows.filter(r => r.course_code?.trim() || r.course_name?.trim());
      const payload = {
        rows: validRows.map(r => ({
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
        setHasUnsavedChanges(false);
        setSaveStatus('saved');
        // Hide the 'saved' message after 3 seconds
        setTimeout(() => setSaveStatus('idle'), 3000);
      } else {
        throw new Error('Server returned error while syncing');
      }
    } catch (err) {
      console.warn('Backend sync failed, storing locally:', err);
      localStorage.setItem('examnex_faculty_sheet', JSON.stringify(rows));
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('unsaved'), 4000);
    } finally {
      setSyncing(false);
    }
  };

  // Auto-save debounce effect (saves 3 seconds after last edit)
  useEffect(() => {
    if (!hasUnsavedChanges || syncing) return;
    const timer = setTimeout(() => { handleSyncToBackend(); }, 3000);
    return () => clearTimeout(timer);
  }, [rows, hasUnsavedChanges]);

  // Add standard rows
  const handleAddRow = () => {
    setActiveTab('all'); // Ensure we can see the new rows
    const newRows = Array(10).fill(null).map((_, i) => ({
      id: Date.now() + i, coordinator_name: '', semester: '', course_name: '', course_code: '',
      is_conducted: '', course_type: '', exam_mode: '', exam_weightage: '', duration: '', remark: '', is_reexam: false
    }));
    recordHistory([...rows, ...newRows]);
    
    // Scroll to bottom
    setTimeout(() => {
      if (gridContainerRef.current) {
        gridContainerRef.current.scrollTop = gridContainerRef.current.scrollHeight;
      }
    }, 100);
  };

  // Delete bulk selected rows
  const handleDeleteSelected = () => {
    if (selectedRowIndices.size === 0) return;
    const updated = rows.filter((_, idx) => !selectedRowIndices.has(idx));
    if(updated.length === 0) {
        updated.push({
            id: Date.now(), coordinator_name: '', semester: '', course_name: '', course_code: '',
            is_conducted: '', course_type: '', exam_mode: '', exam_weightage: '', duration: '', remark: '', is_reexam: false
        });
    }
    recordHistory(updated);
    setSelectedRowIndices(new Set());
    setEditingCell(null);
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

  // Import from Excel (.xlsx/.csv)
  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        // Read raw data starting from the second row (assuming row 1 is headers)
        const data = XLSX.utils.sheet_to_json(ws, { defval: '', raw: false });

        if (data.length === 0) { alert('Uploaded spreadsheet appears empty.'); return; }

        const importedRows = data.map((row, idx) => {
          // Helper to find column keys flexibly
          const findKey = (candidates) => {
            const rowKeys = Object.keys(row);
            for (const cand of candidates) {
              const matched = rowKeys.find(k => k.toLowerCase().includes(cand.toLowerCase()));
              if (matched) return row[matched]?.toString().trim();
            }
            return '';
          };
          
          const cCode = findKey(['course code', 'course_code', 'code']) || '';
          const cName = findKey(['course name', 'course_name', 'title']) || '';
          const cType = findKey(['course type', 'type']) || '';

          return {
            id: Date.now() + idx,
            coordinator_name: findKey(['coordinator', 'name']) || facultyName,
            semester: findKey(['semester', 'sem']) || '',
            course_name: cName,
            course_code: cCode,
            is_conducted: findKey(['whether', 'conduct', 'committee']) || '',
            course_type: cType,
            exam_mode: findKey(['exam mode', 'mode']) || '',
            exam_weightage: (findKey(['weightage', 'weight']) || '').toString(),
            duration: (findKey(['duration', 'time', 'hours']) || '').toString(),
            remark: findKey(['remark', 'notes', 'comment']) || '',
            is_reexam: cCode.toUpperCase().endsWith('R') || cName.toUpperCase().includes('(RE)') || cType.toUpperCase().includes('REPEAT')
          };
        });

        // Filter out rows that have NO course name AND NO course code
        const validImportedRows = importedRows.filter(r => r.course_code || r.course_name);

        // Replace empty padding rows with imported data
        const emptyIdx = rows.findIndex(r => !r.course_code && !r.course_name);
        let newRows = [...rows];
        
        if (emptyIdx !== -1) {
            newRows.splice(emptyIdx, validImportedRows.length, ...validImportedRows);
        } else {
            newRows = [...rows, ...validImportedRows];
        }

        // Ensure we always have at least 20 rows for layout
        if (newRows.length < 20) {
            const padding = Array(20 - newRows.length).fill(null).map((_, i) => ({
                id: Date.now() + i + 2000, coordinator_name: '', semester: '', course_name: '', course_code: '',
                is_conducted: '', course_type: '', exam_mode: '', exam_weightage: '', duration: '', remark: '', is_reexam: false
            }));
            newRows = [...newRows, ...padding];
        }

        recordHistory(newRows);
        alert(`Successfully imported ${validImportedRows.length} active rows!`);
      } catch (err) { alert('Could not read Excel file.'); }
    };
    reader.readAsBinaryString(file);
    e.target.value = ''; // Reset input
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
        setSelectedCell({ rowIdx: rowIdx + 1, colKey });
      }
    } else if (e.key === 'Tab') {
      e.preventDefault();
      setEditingCell(null);
      if (e.shiftKey) {
        if (currentColIdx > 0) setSelectedCell({ rowIdx, colKey: colKeys[currentColIdx - 1] });
        else if (rowIdx > 0) setSelectedCell({ rowIdx: rowIdx - 1, colKey: colKeys[colKeys.length - 1] });
      } else {
        if (currentColIdx < colKeys.length - 1) setSelectedCell({ rowIdx, colKey: colKeys[currentColIdx + 1] });
        else if (rowIdx < rows.length - 1) setSelectedCell({ rowIdx: rowIdx + 1, colKey: colKeys[0] });
        else { handleAddRow(); setSelectedCell({ rowIdx: rowIdx + 1, colKey: colKeys[0] }); }
      }
    } else if (e.key === 'Escape') {
      setEditingCell(null);
    }
  };

  // Filtered rows for Active Tab
  const filteredRows = useMemo(() => {
    return rows.map((r, originalIdx) => ({ ...r, originalIdx })).filter(r => {
      const hasData = r.course_code?.trim() || r.course_name?.trim();
      
      // If filtering by tabs, only show non-empty rows that match
      if (activeTab === 'conducted' && (r.is_conducted !== 'Yes' || !hasData)) return false;
      if (activeTab === 'exempted' && (r.is_conducted !== 'No' || !hasData)) return false;
      if (activeTab === 'reexams' && (!r.is_reexam || !hasData)) return false;

      return true;
    });
  }, [rows, activeTab]);

  // Automatic Color Coding Logic
  const getCellColorClass = (colKey, value) => {
    if (!value) return '';
    const v = value.toString().toLowerCase().trim();
    
    if (colKey === 'is_conducted') {
        if (v === 'yes') return 'bg-emerald-100 text-emerald-800 font-medium';
        if (v === 'no') return 'bg-red-100 text-red-800 font-medium';
    }
    if (colKey === 'course_type') {
        if (v.includes('repeat') || v.includes('recourse')) return 'bg-amber-100 text-amber-800 font-medium';
        if (v.includes('mdc') || v.includes('multidisciplinary')) return 'bg-purple-100 text-purple-800 font-medium';
        if (v.includes('regular')) return 'bg-blue-100 text-blue-800 font-medium';
    }
    if (colKey === 'exam_mode') {
        if (v.includes('lab') || v.includes('online')) return 'bg-cyan-100 text-cyan-800 font-medium';
        if (v.includes('project') || v.includes('viva')) return 'bg-fuchsia-100 text-fuchsia-800 font-medium';
        if (v.includes('written')) return 'bg-indigo-100 text-indigo-800 font-medium';
    }
    return '';
  };

  return (
    <div className="flex flex-col h-screen w-full bg-white dark:bg-[#111111] font-sans overflow-hidden absolute inset-0 z-50">
      
      {/* Hidden Datalists for Auto-Complete */}
      <datalist id="courseNamesList">
        {catalogCourses.map(c => <option key={c.id} value={c.course_title} />)}
      </datalist>
      <datalist id="courseCodesList">
        {catalogCourses.map(c => <option key={c.id} value={c.course_code} />)}
      </datalist>

      {/* Top Application Bar - Mimics Google Sheets Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-slate-200 dark:border-white/10 bg-white dark:bg-[#111111]">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded bg-[#0f9d58] flex items-center justify-center text-white shrink-0 shadow-sm cursor-pointer hover:bg-[#0b8043] transition-colors">
            <FileSpreadsheet className="w-6 h-6" />
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
                <input 
                    type="text" 
                    defaultValue="Exam Requirements Sheet" 
                    className="text-lg text-slate-800 dark:text-slate-100 font-medium bg-transparent border-none focus:outline-none hover:bg-slate-100 dark:hover:bg-white/5 px-1 rounded transition-colors"
                />
            </div>
            
            {/* Cleaned Menu Bar - Only Help remains */}
            <div className="flex items-center gap-1 text-[13px] text-slate-600 dark:text-slate-400 mt-0.5">
              <button 
                onClick={() => setShowInstructions(true)}
                className="hover:bg-slate-100 dark:hover:bg-white/5 px-2 py-0.5 rounded cursor-pointer font-medium"
              >
                Help
              </button>
            </div>
          </div>
        </div>

        {/* Sync Status & Right Actions */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 text-xs text-slate-500 dark:text-slate-400">
             {syncing ? (
                <><RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-500" /> <span className="text-blue-600 dark:text-blue-400 font-medium">Saving...</span></>
             ) : saveStatus === 'unsaved' ? (
                <span className="text-amber-500 font-medium">Unsaved changes</span>
             ) : saveStatus === 'error' ? (
                <span className="text-red-500 font-medium">Failed to save</span>
             ) : saveStatus === 'saved' ? (
                <><CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> <span className="text-emerald-600 dark:text-emerald-400 font-medium">Saved to Cloud</span></>
             ) : null}
          </div>
          
          <button 
            onClick={() => fileInputRef.current?.click()}
            className="p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10 rounded-full transition-colors"
            title="Import Excel File"
          >
            <Upload className="w-5 h-5" />
          </button>
          
          {/* Functional Save Button */}
          <button 
            onClick={handleSyncToBackend}
            disabled={syncing || !hasUnsavedChanges}
            className={`flex items-center gap-2 px-4 py-2 rounded-full font-medium text-sm transition-colors ${
                hasUnsavedChanges 
                  ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-sm cursor-pointer' 
                  : 'bg-slate-100 text-slate-400 dark:bg-white/5 dark:text-slate-600 cursor-default'
            }`}
          >
            {syncing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save Data
          </button>
          
           <div className="w-8 h-8 rounded-full bg-purple-600 text-white flex items-center justify-center font-bold text-sm overflow-hidden border-2 border-white shadow-sm ml-2 cursor-pointer">
            {user?.name ? user.name.charAt(0).toUpperCase() : 'U'}
          </div>
        </div>
      </div>

      {/* Simplified Formatting Ribbon - No Fonts or fx codes */}
      <div className="flex items-center gap-1 px-3 py-1.5 border-b border-slate-200 dark:border-white/10 bg-[#edf2fa] dark:bg-[#1a1a1a] text-slate-600 dark:text-slate-300 overflow-x-auto">
        <div className="flex items-center gap-1 pr-2 border-r border-slate-300 dark:border-white/20 shrink-0">
            <button onClick={handleUndo} disabled={history.length === 0} className="p-1.5 hover:bg-slate-200 dark:hover:bg-white/10 rounded disabled:opacity-30" title="Undo"><Undo2 className="w-4 h-4" /></button>
            <button onClick={handleRedo} disabled={future.length === 0} className="p-1.5 hover:bg-slate-200 dark:hover:bg-white/10 rounded disabled:opacity-30" title="Redo"><Redo2 className="w-4 h-4" /></button>
        </div>

        <div className="flex items-center gap-1 px-2 border-r border-slate-300 dark:border-white/20 shrink-0 relative" ref={zoomDropdownRef}>
             <div 
                onClick={() => setIsZoomOpen(!isZoomOpen)} 
                className="flex items-center gap-1 hover:bg-slate-200 dark:hover:bg-white/10 px-2 py-1 rounded text-xs cursor-pointer w-[70px] justify-between"
             >
                <span>{zoomLevel}%</span>
                <ChevronDown className="w-3 h-3" />
             </div>
             {isZoomOpen && (
                <div className="absolute top-full left-0 mt-1 bg-white dark:bg-[#222] border border-slate-200 dark:border-white/10 shadow-xl rounded z-50 py-1 w-24 overflow-hidden">
                    {[50, 75, 90, 100, 125, 150, 200].map(z => (
                        <div 
                          key={z} 
                          onClick={() => { setZoomLevel(z); setIsZoomOpen(false); }}
                          className={`px-3 py-1.5 hover:bg-slate-100 dark:hover:bg-white/10 cursor-pointer text-xs ${z === zoomLevel ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-semibold' : ''}`}
                        >
                          {z}%
                        </div>
                    ))}
                </div>
             )}
        </div>

        <div className="flex items-center gap-1 px-2 shrink-0">
            {selectedRowIndices.size > 0 && (
                 <button onClick={handleDeleteSelected} className="flex items-center gap-1 px-2 py-1 text-xs text-red-700 bg-red-50 hover:bg-red-100 rounded border border-red-200 cursor-pointer">
                    <Trash2 className="w-3 h-3" /> Delete Selected
                </button>
            )}
        </div>
      </div>

      {/* Main Excel Spreadsheet Grid Container */}
      <div className="flex-1 relative bg-white dark:bg-[#111111] overflow-hidden flex flex-col">
        {/* The Grid with dynamic Zoom property */}
        <div 
           ref={gridContainerRef} 
           className="flex-1 overflow-auto custom-scrollbar relative bg-[#f8f9fa] dark:bg-[#111] transform origin-top-left"
           style={{ zoom: `${zoomLevel}%` }}
        >
          <table className="w-max min-w-full text-left border-collapse border-spacing-0 table-fixed bg-white dark:bg-[#111]">
            <thead className="sticky top-0 z-30 select-none">
              <tr className="bg-[#f8f9fa] dark:bg-[#1a1a1a]">
                <th className="w-12 h-6 border-r border-b border-[#c0c0c0] dark:border-white/20 text-center bg-[#f8f9fa] dark:bg-[#222]">
                  <input
                    type="checkbox"
                    checked={rows.length > 0 && selectedRowIndices.size === rows.length}
                    onChange={(e) => {
                      if (e.target.checked) setSelectedRowIndices(new Set(rows.map((_, idx) => idx)));
                      else setSelectedRowIndices(new Set());
                    }}
                    className="rounded-sm w-3 h-3 cursor-pointer"
                  />
                </th>

                {columns.map(col => (
                  <th
                    key={col.key}
                    className={`${col.width} h-6 text-center border-r border-b border-[#c0c0c0] dark:border-white/20 text-[11px] font-normal text-slate-600 dark:text-slate-300 hover:bg-[#e8eaed] dark:hover:bg-white/10 cursor-pointer relative group bg-[#f8f9fa] dark:bg-[#222]`}
                  >
                    {col.letter}
                    <div className="absolute inset-x-0 bottom-0 h-0.5 bg-blue-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </th>
                ))}
              </tr>
              
              {/* Row 1: Header Titles */}
              <tr className="bg-white dark:bg-[#111]">
                  <th className="w-12 h-8 text-center border-r border-b border-[#e2e3e3] dark:border-white/10 font-medium text-[11px] text-slate-500 bg-[#f8f9fa] dark:bg-[#222] sticky left-0 z-20">
                    1
                  </th>
                   {columns.map(col => (
                    <th
                        key={col.key}
                        className={`${col.width} px-2 h-8 border-r border-b border-[#e2e3e3] dark:border-white/10 font-bold text-slate-700 dark:text-slate-200 text-xs bg-slate-50 dark:bg-[#1a1a1a] shadow-[inset_0_-1px_0_0_#000] dark:shadow-[inset_0_-1px_0_0_#555]`}
                    >
                        {col.title}
                    </th>
                   ))}
              </tr>
            </thead>

            <tbody className="font-sans">
              {filteredRows.map((row) => {
                  const rowIdx = row.originalIdx;
                  // Skip index 0 visually because we used 1 for the header
                  const displayRowNumber = rowIdx + 2; 
                  const isRowSelected = selectedRowIndices.has(rowIdx);

                  return (
                    <tr
                      key={row.id || rowIdx}
                      className={`${isRowSelected ? 'bg-blue-50/50 dark:bg-blue-900/20' : 'bg-white dark:bg-[#111]'}`}
                    >
                      <td className="w-12 h-6 text-center border-r border-b border-[#e2e3e3] dark:border-white/10 text-[11px] text-slate-500 bg-[#f8f9fa] dark:bg-[#222] sticky left-0 z-10 select-none group">
                        <div className="flex items-center justify-center gap-1">
                             <input
                                type="checkbox"
                                checked={isRowSelected}
                                onChange={() => toggleRowSelection(rowIdx)}
                                className="rounded-sm w-3 h-3 cursor-pointer opacity-0 group-hover:opacity-100 absolute left-1"
                            />
                            <span className="group-hover:opacity-0">{displayRowNumber}</span>
                        </div>
                      </td>

                      {columns.map(col => {
                        const colKey = col.key;
                        const isCellSelected = selectedCell.rowIdx === rowIdx && selectedCell.colKey === colKey;
                        const isEditing = editingCell?.rowIdx === rowIdx && editingCell?.colKey === colKey;
                        const cellValue = row[colKey] ?? '';

                        // Determine if we need a datalist for this cell
                        let dataListId = undefined;
                        if (colKey === 'course_name') dataListId = 'courseNamesList';
                        if (colKey === 'course_code') dataListId = 'courseCodesList';

                        // Apply automatic color coding to the cell
                        const autoColorClass = !isEditing && !isCellSelected ? getCellColorClass(colKey, cellValue) : '';

                        return (
                          <td
                            key={colKey}
                            onClick={() => {
                              setSelectedCell({ rowIdx, colKey });
                              if (col.isDropdown) setEditingCell({ rowIdx, colKey });
                            }}
                            onDoubleClick={() => {
                              setEditingCell({ rowIdx, colKey });
                            }}
                            className={`px-2 h-6 border-r border-b border-[#e2e3e3] dark:border-white/10 text-[13px] text-slate-800 dark:text-slate-200 relative whitespace-nowrap overflow-hidden ${
                              isCellSelected ? 'ring-[2px] ring-[#1a73e8] ring-inset z-20 bg-blue-50/20' : autoColorClass
                            }`}
                          >
                            {isEditing ? (
                              col.isDropdown ? (
                                <select
                                  autoFocus
                                  value={cellValue}
                                  onChange={e => {
                                    handleCellChange(rowIdx, colKey, e.target.value);
                                    setEditingCell(null);
                                  }}
                                  onBlur={() => setEditingCell(null)}
                                  className="absolute inset-0 w-full h-full px-2 bg-white dark:bg-[#222] text-[13px] outline-none shadow-lg z-30 cursor-pointer border border-[#1a73e8]"
                                >
                                  <option value=""></option>
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
                                  list={dataListId}
                                  value={cellValue}
                                  onChange={e => handleCellChange(rowIdx, colKey, e.target.value)}
                                  onBlur={() => setEditingCell(null)}
                                  onKeyDown={e => handleKeyDown(e, rowIdx, colKey)}
                                  className="absolute inset-0 w-full h-full px-2 bg-white dark:bg-[#222] text-[13px] outline-none shadow-lg z-30 border border-[#1a73e8]"
                                />
                              )
                            ) : (
                                <span className={`block truncate ${!cellValue && isCellSelected ? 'text-slate-400' : ''}`}>
                                  {cellValue}
                                </span>
                            )}

                            {/* Excel Fill Handle (Visual only) */}
                            {isCellSelected && (
                              <div className="absolute -bottom-1 -right-1 w-1.5 h-1.5 bg-[#1a73e8] border border-white z-30 cursor-crosshair" />
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })
              }
            </tbody>
          </table>
          
          <div className="p-4 pt-2">
             <button
                onClick={handleAddRow}
                className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 text-slate-600 dark:text-slate-300 text-xs font-medium transition-colors border border-slate-200 dark:border-white/10"
              >
                <Plus className="w-3.5 h-3.5" />
                Add 10 more rows
              </button>
          </div>
        </div>

        {/* Bottom Sheet Tabs Bar - Mimics Google Sheets */}
        <div className="bg-[#f8f9fa] dark:bg-[#1a1a1a] border-t border-[#c0c0c0] dark:border-white/20 h-10 flex items-center px-4 justify-between text-xs select-none">
          <div className="flex items-center gap-1 h-full">
            <button onClick={handleAddRow} className="p-1 text-slate-500 hover:bg-slate-200 dark:hover:bg-white/10 rounded mr-2" title="Add Rows"><Plus className="w-4 h-4" /></button>
            <button className="p-1 text-slate-500 hover:bg-slate-200 dark:hover:bg-white/10 rounded mr-2"><Menu className="w-4 h-4" /></button>
            
            <button
              onClick={() => setActiveTab('all')}
              className={`px-4 h-full flex items-center font-medium border-b-2 transition-colors ${
                activeTab === 'all'
                  ? 'border-[#0f9d58] text-[#0f9d58] dark:text-emerald-400 bg-white dark:bg-[#111]'
                  : 'border-transparent text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-white/5'
              }`}
            >
              All Requirements
            </button>

            <button
              onClick={() => setActiveTab('conducted')}
              className={`px-4 h-full flex items-center font-medium border-b-2 transition-colors ${
                activeTab === 'conducted'
                  ? 'border-[#0f9d58] text-[#0f9d58] dark:text-emerald-400 bg-white dark:bg-[#111]'
                  : 'border-transparent text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-white/5'
              }`}
            >
              Conducted
            </button>

             <button
              onClick={() => setActiveTab('reexams')}
              className={`px-4 h-full flex items-center font-medium border-b-2 transition-colors ${
                activeTab === 'reexams'
                  ? 'border-[#0f9d58] text-[#0f9d58] dark:text-emerald-400 bg-white dark:bg-[#111]'
                  : 'border-transparent text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-white/5'
              }`}
            >
              Re-Exams
            </button>
          </div>
        </div>
      </div>

      {/* Floating Instructions Modal */}
      {showInstructions && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in">
              <div className="bg-white dark:bg-[#1a1a1a] p-6 rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 dark:border-white/10">
                  <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3 text-emerald-600 dark:text-emerald-400">
                          <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg">
                              <FileSpreadsheet className="w-6 h-6" />
                          </div>
                          <h2 className="text-xl font-bold text-slate-900 dark:text-white">How to use this sheet</h2>
                      </div>
                      <button onClick={closeInstructions} className="p-1 hover:bg-slate-100 dark:hover:bg-white/5 rounded-full text-slate-500">
                          <X className="w-5 h-5" />
                      </button>
                  </div>
                  
                  <div className="space-y-4 text-sm text-slate-600 dark:text-slate-300">
                      <p>Welcome to the Exam Requirements editor. It works just like Google Sheets!</p>
                      
                      <ul className="space-y-2 list-disc list-inside">
                          <li><strong>Click</strong> any cell to select it.</li>
                          <li><strong>Double-click</strong> or press <strong>Enter</strong> to edit a cell.</li>
                          <li>Use arrow keys or <strong>Tab / Shift+Tab</strong> to navigate quickly.</li>
                          <li><strong>Smart Auto-fill:</strong> Try typing an acronym like "ADS" and it will automatically find "Advanced Data Science" and fill the course code!</li>
                          <li><strong>Color Coding:</strong> Cells automatically change colors based on their values (e.g. Yes/No).</li>
                          <li>Click the <strong>Save</strong> button in the top right to commit your changes to the database.</li>
                      </ul>
                  </div>
                  
                  <button onClick={closeInstructions} className="w-full mt-6 py-2.5 bg-[#0f9d58] hover:bg-[#0b8043] text-white font-bold rounded-xl transition-colors">
                      Got it, let's go!
                  </button>
              </div>
          </div>
      )}

      {/* Hidden file input for import */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx, .xls, .csv"
        onChange={handleFileUpload}
        className="hidden"
      />

      <style dangerouslySetInnerHTML={{__html: `
        .custom-scrollbar::-webkit-scrollbar { height: 12px; width: 12px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: #f1f3f4; }
        .dark .custom-scrollbar::-webkit-scrollbar-track { background: #111; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #c0c4c9; border-radius: 6px; border: 3px solid #f1f3f4; }
        .dark .custom-scrollbar::-webkit-scrollbar-thumb { background: #555; border: 3px solid #111; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #a8aab0; }
        .dark .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #777; }
        
        td { outline: none; }
        input[type="text"]::-webkit-calendar-picker-indicator {
            display: none !important;
        }
      `}} />
    </div>
  );
}