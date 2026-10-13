import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { io } from 'socket.io-client';
import {
  FileSpreadsheet, Plus, Trash2, Save, RefreshCw, Upload,
  CheckCircle2, X, Undo2, Redo2, ChevronDown, Menu, AlertCircle, CalendarClock, Lock, Users, Clock
} from 'lucide-react';
import * as XLSX from 'xlsx';

// Options for dropdowns
const SEMESTER_OPTIONS = ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th'];
const COURSE_TYPE_OPTIONS = ['Regular', 'Regular+ Repeat', 'Repeat', 'Recourse', 'MDC', 'Multidisciplinary Course', 'Open elective','Core Elective'];
const EXAM_MODE_OPTIONS = ['Written', 'Online/Lab exam', 'Lab Based', 'Project-based evaluation', 'Project Based (Viva)', 'MCQ Quiz - Online', 'MCQ Quiz - Offline'];
const DURATION_PRESETS = ['1', '1.5', '2', '3', '30 Min', '45 Min', 'Complete Day for whole batch'];
const IS_CONDUCTED_OPTIONS = ['Yes', 'No'];

const getAcronym = (text) => {
  if (!text || typeof text !== 'string') return '';
  const words = text.split(/[\s\-_]+/);
  let acronym = '';
  words.forEach(w => {
      const match = w.match(/[a-zA-Z0-9]/);
      if (match) acronym += match[0].toUpperCase();
  });
  return acronym;
};

// Generates a local temp ID that is safe and recognizable
const generateTempId = (index = 0) => `temp-${Date.now()}-${index}-${Math.floor(Math.random() * 1000)}`;

// Helper to determine Pill Colors based on value
const getPillColor = (value, colKey) => {
    if (!value) return '';
    const v = String(value).toLowerCase().trim();
    
    if (colKey === 'is_conducted') {
        if (v === 'yes') return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300';
        if (v === 'no') return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
    }
    if (colKey === 'course_type') {
        if (v.includes('repeat') || v.includes('recourse')) return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300';
        if (v.includes('mdc') || v.includes('multidisciplinary')) return 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300';
        if (v.includes('regular')) return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300';
    }
    if (colKey === 'exam_mode') {
        if (v.includes('lab') || v.includes('online')) return 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-300';
        if (v.includes('project') || v.includes('viva')) return 'bg-fuchsia-100 text-fuchsia-800 dark:bg-fuchsia-900/30 dark:text-fuchsia-300';
        if (v.includes('written') || v.includes('mcq')) return 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300';
    }
    return 'bg-slate-100 text-slate-800 dark:bg-white/10 dark:text-slate-200';
};

// Advanced sanitization to transform messy typing/pasting into clean preset options
const sanitizeValue = (colKey, rawValue) => {
    if (rawValue == null) return '';
    let str = String(rawValue).trim();
    if (!str) return '';
    const lower = str.toLowerCase();

    if (colKey === 'is_conducted') {
        if (['yes', 'y', 'yup'].includes(lower)) return 'Yes';
        if (['no', 'n', 'nope'].includes(lower)) return 'No';
        return str;
    }

    if (colKey === 'exam_weightage') {
        const match = str.match(/^[\d.]+/); // strips '%' or letters, keeps numbers
        if (match) return match[0];
        return str;
    }

    if (colKey === 'duration') {
        if (lower.includes('30 min') || lower.includes('30min') || lower.includes('0.5') || lower === '.5') return '30 Min';
        if (lower.includes('45 min') || lower.includes('45min') || lower.includes('0.75')) return '45 Min';
        if (lower.includes('1.5') || lower.includes('1 hr 30') || lower.includes('1 hour 30') || lower.includes('90 min')) return '1.5';
        if (lower.includes('2.5') || lower.includes('2 hr 30') || lower.includes('2 hour 30') || lower.includes('150 min')) return '2.5';
        
        if (lower === '1' || lower === '1 hr' || lower === '1 hour' || lower === '1 hrs' || lower === '1 hours' || lower.includes('60 min')) return '1';
        if (lower === '2' || lower === '2 hr' || lower === '2 hour' || lower === '2 hrs' || lower === '2 hours' || lower.includes('120 min')) return '2';
        if (lower === '3' || lower === '3 hr' || lower === '3 hour' || lower === '3 hrs' || lower === '3 hours' || lower.includes('180 min')) return '3';
        if (lower.includes('complete') || lower.includes('whole')) return 'Complete Day for whole batch';
        
        const match = str.match(/^[\d.]+/);
        if (match) return match[0];
        return str;
    }

    if (colKey === 'course_type') {
        if (lower.includes('regular') && (lower.includes('repeat') || lower.includes('+ repeat'))) return 'Regular+ Repeat';
        if (lower.includes('regular') && (lower.includes('recourse') || lower.includes('+ recourse'))) return 'Recourse';
        if (lower === 'regular') return 'Regular';
        if (lower.includes('mdc') || lower.includes('excel novice')) return 'MDC'; 
        if (lower.includes('open elective')) return 'Open elective';
        if (lower.includes('core elective') || lower.includes('elective')) return 'Core Elective'; 
        if (lower.includes('multidisciplinary') || lower.includes('multi')) return 'Multidisciplinary Course';
        if (lower.includes('recourse')) return 'Recourse';
        if (lower.includes('repeat')) return 'Repeat';
        return str.charAt(0).toUpperCase() + str.slice(1); // capitalize fallback
    }

    if (colKey === 'exam_mode') {
        if (lower.includes('project') && lower.includes('viva')) return 'Project Based (Viva)';
        if (lower.includes('project')) return 'Project-based evaluation';
        if (lower.includes('mcq') && lower.includes('online')) return 'MCQ Quiz - Online';
        if (lower.includes('mcq') && lower.includes('offline')) return 'MCQ Quiz - Offline';
        if (lower.includes('lab') && lower.includes('online')) return 'Online/Lab exam';
        if (lower.includes('lab') && !lower.includes('online')) return 'Lab Based';
        if (lower.includes('written')) return 'Written';
        return str; 
    }

    return str;
};

// Hardcoded examples acting as View-Only rows at the top of the sheet
const HARDCODED_EXAMPLES = [
    { id: 'ex1', is_example: true, coordinator_name: 'Dr. Example One', semester: '3rd', course_name: 'Introduction to AI', course_code: 'CSC301', is_conducted: 'Yes', course_type: 'Regular', exam_mode: 'Written', exam_weightage: '40', duration: '2', remark: 'Standard exam protocol', is_reexam: false },
    { id: 'ex2', is_example: true, coordinator_name: 'Prof. Example Two', semester: '5th', course_name: 'Web Technologies', course_code: 'CSC302', is_conducted: 'Yes', course_type: 'Regular', exam_mode: 'MCQ Quiz - Online', exam_weightage: '30', duration: '1', remark: 'MCQ format on LMS', is_reexam: false },
    { id: 'ex3', is_example: true, coordinator_name: 'Dr. Example Three', semester: '1st', course_name: 'Advanced Physics', course_code: 'PHY101', is_conducted: 'No', course_type: 'Regular', exam_mode: 'Project-based evaluation', exam_weightage: '0', duration: '0', remark: 'Exempt from final exams', is_reexam: false },
    { id: 'ex4', is_example: true, coordinator_name: 'Er. Example Four', semester: '7th', course_name: 'Capstone Project', course_code: 'PRJ401', is_conducted: 'Yes', course_type: 'Regular', exam_mode: 'Project Based (Viva)', exam_weightage: '50', duration: '3', remark: 'Jury presentation evaluation', is_reexam: false }
];

const SheetsDropdown = ({ value, options, onChange, onClose, triggerRef, colKey }) => {
    const [style, setStyle] = useState({});
    const menuRef = useRef(null);

    useEffect(() => {
        if (triggerRef.current) {
            const rect = triggerRef.current.getBoundingClientRect();
            setStyle({
                position: 'fixed',
                top: `${rect.bottom + 2}px`,
                left: `${rect.left}px`,
                minWidth: `${Math.max(rect.width, 180)}px`,
                zIndex: 999999 
            });
        }
    }, [triggerRef]);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (menuRef.current && !menuRef.current.contains(event.target) && 
                triggerRef.current && !triggerRef.current.contains(event.target)) {
                onClose();
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [onClose, triggerRef]);

    return createPortal(
        <div 
            ref={menuRef} style={style} onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); onClose(); } }}
            className="bg-white dark:bg-[#222] shadow-2xl border border-slate-200 dark:border-white/10 rounded-lg py-2 flex flex-col gap-1 max-h-[300px] overflow-y-auto animate-in fade-in zoom-in-95 duration-100 custom-scrollbar-thin"
        >
            <div className="px-3 py-1.5 hover:bg-slate-50 dark:hover:bg-white/5 cursor-pointer text-[13px] text-slate-500 italic" onClick={(e) => { e.stopPropagation(); onChange(''); }}>Clear selection</div>
            {(options || []).map((opt) => (
                <div key={opt} onClick={(e) => { e.stopPropagation(); onChange(opt); }} className="px-3 py-1.5 hover:bg-slate-50 dark:hover:bg-white/5 cursor-pointer flex items-center">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${getPillColor(opt, colKey)} ${String(value) === String(opt) ? 'ring-2 ring-blue-400 ring-offset-1' : ''}`}>{opt}</span>
                </div>
            ))}
        </div>,
        document.body
    );
};

// Helper for safe date parsing
const parseDateSafely = (dateString) => {
    if (!dateString) return null;
    const d = new Date(dateString);
    return isNaN(d.getTime()) ? null : d;
};

export default function FacultyExamRequirements({ user, isAdmin = false }) {
  const backendUrl = import.meta.env?.VITE_BACKEND_URL || 'http://localhost:5000';
  const facultyName = user?.name || user?.full_name || 'Dr. Faculty Coordinator';

  const [rows, setRows] = useState([]);
  const [deletedIds, setDeletedIds] = useState([]); 
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [saveStatus, setSaveStatus] = useState('idle'); 
  const [statusMessage, setStatusMessage] = useState('');

  // Editing Window State
  const [editWindow, setEditWindow] = useState({ start_date: '', end_date: '' });
  const [isWindowModalOpen, setIsWindowModalOpen] = useState(false);
  const [savingWindow, setSavingWindow] = useState(false);
  const [liveUsers, setLiveUsers] = useState(1);
  const [timeLeft, setTimeLeft] = useState('');

  const [catalogCourses, setCatalogCourses] = useState([]);
  const [catalogTeachers, setCatalogTeachers] = useState([]);

  // Grid interaction states
  const [selectedCell, setSelectedCell] = useState({ rowIdx: 0, colKey: 'coordinator_name' });
  const [selectionRange, setSelectionRange] = useState({ startRow: 0, startCol: 0, endRow: 0, endCol: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [selectedRowIndices, setSelectedRowIndices] = useState(new Set());
  const [editingCell, setEditingCell] = useState(null); 
  const [dropdownCell, setDropdownCell] = useState(null); 
  const [activeTab, setActiveTab] = useState('all'); 
  
  // UI & History states
  const [showInstructions, setShowInstructions] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(100);
  const [isZoomOpen, setIsZoomOpen] = useState(false); 
  const [history, setHistory] = useState([]);
  const [future, setFuture] = useState([]);

  const fileInputRef = useRef(null);
  const gridContainerRef = useRef(null);
  const zoomDropdownRef = useRef(null);
  const activeCellRef = useRef(null); 
  const socketRef = useRef(null);

  // Latest state references for the debounce autosave
  const rowsRef = useRef(rows);
  const deletedIdsRef = useRef(deletedIds);
  
  useEffect(() => { rowsRef.current = rows; }, [rows]);
  useEffect(() => { deletedIdsRef.current = deletedIds; }, [deletedIds]);

  const columns = useMemo(() => [
    { key: 'coordinator_name', letter: 'A', title: 'Name of coordinator', width: 'w-48 min-w-[192px]', listId: 'teachersList' },
    { key: 'semester', letter: 'B', title: 'Semester', width: 'w-24 min-w-[96px]', options: SEMESTER_OPTIONS },
    { key: 'course_name', letter: 'C', title: 'Course Name', width: 'w-72 min-w-[288px]', listId: 'courseNamesList' },
    { key: 'course_code', letter: 'D', title: 'Course code', width: 'w-36 min-w-[144px]', listId: 'courseCodesList' },
    { key: 'is_conducted', letter: 'E', title: 'Mid-term conducted via committee?', width: 'w-64 min-w-[256px]', options: IS_CONDUCTED_OPTIONS },
    { key: 'course_type', letter: 'F', title: 'Course type (Regular, Repeat, MDC)', width: 'w-56 min-w-[224px]', options: COURSE_TYPE_OPTIONS },
    { key: 'exam_mode', letter: 'G', title: 'Exam mode (Written, Lab, Project, MCQ)', width: 'w-64 min-w-[256px]', options: EXAM_MODE_OPTIONS },
    { key: 'exam_weightage', letter: 'H', title: 'Weightage %', width: 'w-28 min-w-[112px]' },
    { key: 'duration', letter: 'I', title: 'Duration (hours / min)', width: 'w-48 min-w-[192px]', options: DURATION_PRESETS },
    { key: 'remark', letter: 'J', title: 'Remark (Evaluation / Room requirements)', width: 'w-72 min-w-[288px]' }
  ], []);

  // SAFELY check for emptiness by aggressively casting to strings
  const isRowNotEmpty = (r) => {
    if (!r || typeof r !== 'object') return false;
    const check = (val) => val != null && String(val).trim() !== '';
    return check(r?.course_code) || check(r?.course_name) || check(r?.semester) || check(r?.is_conducted) || check(r?.course_type) || check(r?.exam_mode) || check(r?.remark);
  };

  // Determine if the current user has permission to edit the sheet
  const isEditingOpen = useMemo(() => {
    if (!editWindow?.start_date || !editWindow?.end_date) return false; 
    
    const now = new Date();
    const start = parseDateSafely(editWindow.start_date);
    const end = parseDateSafely(editWindow.end_date);
    
    if (!start || !end) return false;

    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
    return now >= start && now <= end;
  }, [editWindow]);

  const isEditable = isAdmin || isEditingOpen;

  // Countdown timer for faculty display
  useEffect(() => {
      if (!editWindow?.end_date || !isEditingOpen) {
          setTimeLeft('');
          return;
      }
      
      const updateTimer = () => {
          const now = new Date();
          const end = parseDateSafely(editWindow.end_date);
          
          if (!end) {
              setTimeLeft('');
              return;
          }
          
          end.setHours(23, 59, 59, 999);
          const diff = end - now;
          
          if (diff <= 0) {
              setTimeLeft('Expired');
          } else {
              const days = Math.floor(diff / (1000 * 60 * 60 * 24));
              const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
              const mins = Math.floor((diff / 1000 / 60) % 60);
              const secs = Math.floor((diff / 1000) % 60);
              
              if (days > 0) setTimeLeft(`${days}d ${hours}h ${mins}m`);
              else setTimeLeft(`${hours}h ${mins}m ${secs}s`);
          }
      };

      updateTimer();
      const interval = setInterval(updateTimer, 1000);
      return () => clearInterval(interval);
  }, [editWindow?.end_date, isEditingOpen]);

  // Handle Admin Prerequisite check
  useEffect(() => {
      if (isAdmin && !loading && (!editWindow?.start_date || !editWindow?.end_date || timeLeft === 'Expired')) {
          setIsWindowModalOpen(true);
      }
  }, [isAdmin, loading, editWindow?.start_date, editWindow?.end_date, timeLeft]);

  useEffect(() => {
    const handleMouseUpGlobal = () => setIsDragging(false);
    window.addEventListener('mouseup', handleMouseUpGlobal);
    return () => window.removeEventListener('mouseup', handleMouseUpGlobal);
  }, []);

  useEffect(() => {
    try {
        const seen = localStorage.getItem('examnex_instructions_seen');
        if (!seen) setShowInstructions(true);
    } catch (e) {
        setShowInstructions(true); 
    }
  }, []);

  const closeInstructions = () => {
    setShowInstructions(false);
    try { localStorage.setItem('examnex_instructions_seen', 'true'); } catch (e) { }
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (zoomDropdownRef.current && !zoomDropdownRef.current.contains(event.target)) setIsZoomOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Socket.IO Setup for Live Editing
  useEffect(() => {
    if (!backendUrl) return;

    socketRef.current = io(backendUrl);

    socketRef.current.on('cell-updated', (data) => {
      if (!data || !Array.isArray(data.updatedRows)) return;
      
      setRows(prev => {
        const newRows = [...(prev || [])];
        data.updatedRows.forEach(incomingRow => {
          if (!incomingRow || !incomingRow.id) return;
          const index = newRows.findIndex(r => r && r.id === incomingRow.id);
          if (index !== -1) newRows[index] = incomingRow;
        });
        return newRows;
      });
    });

    socketRef.current.on('rows-added', (data) => {
      if (data && Array.isArray(data.newRows)) {
         setRows(prev => [...(prev || []), ...data.newRows]);
      }
    });

    socketRef.current.on('rows-deleted', (data) => {
      if (data && Array.isArray(data.deletedIds)) {
         setRows(prev => (prev || []).filter(r => r && !data.deletedIds.includes(r.id)));
      }
    });

    return () => {
      if (socketRef.current) socketRef.current.disconnect();
    };
  }, [backendUrl]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const settingsRes = await fetch(`${backendUrl}/api/settings/exam_req_window`).catch(() => null);
      if (settingsRes?.ok) {
          const data = await settingsRes.json().catch(() => ({}));
          const extractDate = (dt) => dt ? String(dt).split('T')[0] : '';
          setEditWindow({ start_date: extractDate(data?.start_date), end_date: extractDate(data?.end_date) });
      }

      const coursesRes = await fetch(`${backendUrl}/api/admin/courses`).catch(() => null);
      if (coursesRes?.ok) {
          const coursesData = await coursesRes.json().catch(() => ([]));
          if (Array.isArray(coursesData)) setCatalogCourses(coursesData);
      }

      const teachersRes = await fetch(`${backendUrl}/api/admin/teachers`).catch(() => null);
      if (teachersRes?.ok) {
          const teachersData = await teachersRes.json().catch(() => ([]));
          if (Array.isArray(teachersData)) setCatalogTeachers(teachersData);
      }

      let loadedRows = [];
      // Cache buster included here to prevent stale reload bugs!
      const reqRes = await fetch(`${backendUrl}/api/exam-requirements?t=${Date.now()}`).catch(() => null);
      if (reqRes?.ok) {
        const data = await reqRes.json().catch(() => ([]));
        if (Array.isArray(data)) loadedRows = data;
      }

      // Provide default rows if empty so faculty isn't stuck with an uneditable empty state
      if (!loadedRows || loadedRows.length === 0) {
          loadedRows = Array(isAdmin ? 1 : 5).fill(null).map((_, i) => ({
            id: generateTempId(i), coordinator_name: '', semester: '', course_name: '', course_code: '',
            is_conducted: '', course_type: '', exam_mode: '', exam_weightage: '', duration: '', remark: '', is_reexam: false
          }));
      }

      const fullSet = [...HARDCODED_EXAMPLES, ...loadedRows];
      setRows(fullSet);
      setHistory([fullSet]);
    } catch (err) {
      console.warn('Error fetching data:', err);
    } finally {
      setLoading(false);
    }
  }, [backendUrl, isAdmin]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const saveEditingWindow = async () => {
      setSavingWindow(true);
      try {
          const res = await fetch(`${backendUrl}/api/settings/exam_req_window`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(editWindow)
          });
          if (res.ok) setIsWindowModalOpen(false);
          else throw new Error("Failed to update window.");
      } catch (err) {
          alert(err.message);
      } finally {
          setSavingWindow(false);
      }
  };

  const recordHistory = useCallback((newRows) => {
    setHistory(prev => {
        const safePrev = Array.isArray(prev) ? prev : [];
        if (safePrev.length > 0 && JSON.stringify(safePrev[safePrev.length - 1]) === JSON.stringify(newRows)) return safePrev;
        return [...safePrev.slice(-20), newRows];
    });
    setFuture([]);
    setRows(newRows || []);
    setHasUnsavedChanges(true);
    setSaveStatus('unsaved');
    setStatusMessage('');
  }, []);

  const handleUndo = useCallback(() => {
    if (!isEditable || !Array.isArray(history) || history.length <= 1) return; 
    setFuture(prev => [rows, ...(prev || [])]);
    const previousState = history[history.length - 2];
    setHistory(prev => (prev || []).slice(0, prev.length - 1));
    setRows(previousState || []);
    setHasUnsavedChanges(true);
    setSaveStatus('unsaved');
  }, [history, rows, isEditable]);

  const handleRedo = useCallback(() => {
    if (!isEditable || !Array.isArray(future) || future.length === 0) return;
    const nextState = future[0];
    setHistory(prev => [...(prev || []), nextState]);
    setFuture(prev => (prev || []).slice(1));
    setRows(nextState || []);
    setHasUnsavedChanges(true);
    setSaveStatus('unsaved');
  }, [future, isEditable]);

  const handleCellChange = (rowIdx, colKey, value) => {
    const updated = [...(rows || [])];
    const targetRow = { ...(updated[rowIdx] || {}) };
    
    // Process input aggressively to clean it before saving state
    targetRow[colKey] = sanitizeValue(colKey, value);

    const inputVal = String(targetRow[colKey] || '').trim().toUpperCase();

    if (['course_code', 'course_name', 'course_type'].includes(colKey)) {
      const code = String(targetRow?.course_code || '').toUpperCase();
      const name = String(targetRow?.course_name || '').toUpperCase();
      const type = String(targetRow?.course_type || '').toUpperCase();
      targetRow.is_reexam = code.endsWith('R') || name.includes('(RE)') || name.includes('RE-EXAM') || type.includes('REPEAT') || type.includes('RECOURSE');
    }

    if (!targetRow.coordinator_name && ['course_name', 'course_code'].includes(colKey) && inputVal !== '') {
        targetRow.coordinator_name = facultyName;
    }

    updated[rowIdx] = targetRow;
    recordHistory(updated);

    if (socketRef.current) socketRef.current.emit('edit-cell', { updatedRows: [targetRow] });
  };

  const handleSyncToBackend = async () => {
    const snapshotRows = Array.isArray(rowsRef.current) ? rowsRef.current : [];
    let snapshotDeleted = Array.isArray(deletedIdsRef.current) ? [...deletedIdsRef.current] : [];
    
    const validRows = [];
    
    // Check for empty rows that exist in the database and mark them for deletion
    snapshotRows.forEach(r => {
        if (!r || r.is_example) return;
        if (isRowNotEmpty(r)) {
            validRows.push(r);
        } else if (r.id && !String(r.id).includes('temp')) {
            if (!snapshotDeleted.includes(r.id)) {
                snapshotDeleted.push(r.id);
            }
        }
    });
    
    if ((!hasUnsavedChanges && snapshotDeleted.length === 0) || !isEditable) return;
    
    setSyncing(true);
    setSaveStatus('saving');
    setStatusMessage('');

    try {
      const payload = {
        rows: validRows.map(r => {
          const rowData = { 
              ...r, 
              coordinator_name: r.coordinator_name, // Removed aggressive facultyName fallback that overwrites intentional clears
              coordinator_id: user?.id || null, 
              coordinator_email: user?.email || null 
          };
          if (rowData.id && String(rowData.id).includes('temp')) delete rowData.id;
          return rowData;
        }),
        deleted_ids: snapshotDeleted, 
        updateCourses: true
      };

      const res = await fetch(`${backendUrl}/api/exam-requirements/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        const data = await res.json();
        const newlyUpdatedRows = [];
        
        if (data && Array.isArray(data.rows)) {
            setRows(prevRows => {
                const nextRows = [...(prevRows || [])];
                for (let v = 0; v < validRows.length; v++) {
                    const sentRow = validRows[v];
                    const returnedRow = data.rows[v];
                    
                    if (returnedRow && returnedRow.id) {
                        const index = nextRows.findIndex(r => r && r.id === sentRow?.id);
                        if (index !== -1) {
                            nextRows[index] = { ...nextRows[index], id: returnedRow.id };
                            newlyUpdatedRows.push(nextRows[index]);
                        }
                    }
                }
                return nextRows;
            });
        }
        
        setDeletedIds(prev => (prev || []).filter(id => !snapshotDeleted.includes(id))); 
        
        if (rowsRef.current === snapshotRows) setHasUnsavedChanges(false);
        
        setSaveStatus('saved');
        setTimeout(() => setSaveStatus(prev => prev === 'saved' ? 'idle' : prev), 3000);

        if (socketRef.current && newlyUpdatedRows.length > 0) {
            socketRef.current.emit('edit-cell', { updatedRows: newlyUpdatedRows });
        }
      } else {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || 'Server returned error while syncing');
      }
    } catch (err) {
        console.warn('Backend sync failed:', err);
        setSaveStatus('error');
        setStatusMessage(err.message || 'Failed to save');
        setTimeout(() => setSaveStatus(prev => prev === 'error' ? 'unsaved' : prev), 5000);
    } finally {
        setSyncing(false);
    }
  };

  useEffect(() => {
      let saveTimer;
      if (hasUnsavedChanges && isEditable) saveTimer = setTimeout(() => handleSyncToBackend(), 1500); 
      return () => clearTimeout(saveTimer);
  }, [rows, hasUnsavedChanges, isEditable]);

  const handleCopy = (e) => {
    if (editingCell) return; 
    e.preventDefault();

    let copyText = '';
    const minRow = Math.min(selectionRange.startRow, selectionRange.endRow);
    const maxRow = Math.max(selectionRange.startRow, selectionRange.endRow);
    const minCol = Math.min(selectionRange.startCol, selectionRange.endCol);
    const maxCol = Math.max(selectionRange.startCol, selectionRange.endCol);

    const safeRows = Array.isArray(rows) ? rows : [];
    for (let r = minRow; r <= maxRow; r++) {
      let rowVals = [];
      for (let c = minCol; c <= maxCol; c++) rowVals.push(safeRows[r]?.[columns[c]?.key] || '');
      copyText += rowVals.join('\t') + '\n';
    }

    e.clipboardData.setData('text/plain', copyText.trimEnd());
  };

  const handlePaste = (e) => {
    if (editingCell || !isEditable) return;
    e.preventDefault();
    
    const clipboardData = e.clipboardData || window.clipboardData;
    const pastedText = clipboardData.getData('Text');
    if (!pastedText) return;

    const pasteRows = pastedText.split(/\r?\n/).map(row => row.split('\t'));
    const startRowIdx = Math.min(selectionRange.startRow, selectionRange.endRow);
    const startColIdx = Math.min(selectionRange.startCol, selectionRange.endCol);

    const updatedRows = [...(rows || [])];
    const changedRowsToSync = [];
    const safeCatalog = Array.isArray(catalogCourses) ? catalogCourses : [];
    
    for (let i = 0; i < pasteRows.length; i++) {
        const targetRowIdx = startRowIdx + i;
        
        if (targetRowIdx >= updatedRows.length) {
            // Allow extending the grid if pasting requires more space
            updatedRows.push({
                id: generateTempId(targetRowIdx), coordinator_name: '', semester: '', course_name: '', course_code: '',
                is_conducted: '', course_type: '', exam_mode: '', exam_weightage: '', duration: '', remark: '', is_reexam: false
            });
        }
        
        const targetRow = { ...(updatedRows[targetRowIdx] || {}) };
        if (targetRow?.is_example) continue; 

        const rowData = pasteRows[i];
        if (rowData.length === 1 && String(rowData[0] || '').trim() === '') continue;

        let rowHasChanged = false;

        for (let j = 0; j < rowData.length; j++) {
            const targetColIdx = startColIdx + j;
            if (targetColIdx < columns.length) {
                const colKey = columns[targetColIdx].key;
                
                // Sanitize upon pasting
                const value = sanitizeValue(colKey, String(rowData[j] || '').trim());
                
                targetRow[colKey] = value;
                rowHasChanged = true;

                if (['course_name', 'course_code'].includes(colKey) && value !== '') {
                    let matched = safeCatalog.find(c => String(c?.course_title || '').toUpperCase() === value.toUpperCase() || String(c?.course_code || '').toUpperCase() === value.toUpperCase());
                    if (!matched && value.length > 1 && value.length <= 5) {
                        matched = safeCatalog.find(c => getAcronym(c?.course_title) === value.toUpperCase());
                    }
                    if (matched) {
                        targetRow.course_name = matched.course_title || targetRow.course_name;
                        targetRow.course_code = matched.course_code || targetRow.course_code;
                        if (!targetRow.semester && Array.isArray(matched.taught_in) && matched.taught_in.length > 0) {
                            targetRow.semester = `${matched.taught_in[0].semester}${matched.taught_in[0].semester === 1 ? 'st' : (matched.taught_in[0].semester === 2 ? 'nd' : (matched.taught_in[0].semester === 3 ? 'rd' : 'th'))}`;
                        }
                    }
                    if (!targetRow.coordinator_name) targetRow.coordinator_name = facultyName;
                }
            }
        }
        if (rowHasChanged) {
            updatedRows[targetRowIdx] = targetRow;
            changedRowsToSync.push(targetRow);
        }
    }

    recordHistory(updatedRows);
    
    if (socketRef.current && changedRowsToSync.length > 0) {
        socketRef.current.emit('edit-cell', { updatedRows: changedRowsToSync });
    }
  };

  const scrollToCell = useCallback((rowIdx, colIdx) => {
      const tableCell = document.querySelector(`td[data-row="${rowIdx}"][data-col="${colIdx}"]`);
      if (tableCell && gridContainerRef.current) {
          const container = gridContainerRef.current;
          const cellRect = tableCell.getBoundingClientRect();
          const containerRect = container.getBoundingClientRect();

          const paddingY = 40;
          const paddingX = 120;

          if (cellRect.bottom > containerRect.bottom) {
              container.scrollTop += (cellRect.bottom - containerRect.bottom + paddingY);
          } else if (cellRect.top < containerRect.top + 32) {
              container.scrollTop -= (containerRect.top + 32 - cellRect.top + paddingY);
          }

          if (cellRect.right > containerRect.right) {
              container.scrollLeft += (cellRect.right - containerRect.right + paddingX);
          } else if (cellRect.left < containerRect.left + 48) {
              container.scrollLeft -= (containerRect.left + 48 - cellRect.left + paddingX);
          }
      }
  }, []);

  const handleContainerKeyDown = (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); handleSyncToBackend(); return; }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); if (e.shiftKey) handleRedo(); else handleUndo(); return; }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') { e.preventDefault(); handleRedo(); return; }

    const { rowIdx } = selectedCell;
    const colIdx = columns.findIndex(c => c.key === selectedCell.colKey);
    const safeRows = Array.isArray(rows) ? rows : [];
    const targetRow = safeRows[rowIdx];
    const isColEditable = isEditable && targetRow && !targetRow?.is_example; 

    if (!editingCell && !dropdownCell && e.key === 'Enter') {
        e.preventDefault();
        if (!isColEditable) return;
        const col = columns[colIdx];
        if (col && col.options) setDropdownCell(selectedCell); else setEditingCell(selectedCell);
        return; 
    }

    if (editingCell || dropdownCell) return; 

    if (e.shiftKey) {
        if (e.key === 'ArrowRight' && selectionRange.endCol < columns.length - 1) {
            e.preventDefault(); setSelectionRange(p => ({...p, endCol: p.endCol + 1}));
            scrollToCell(selectionRange.endRow, selectionRange.endCol + 1);
        } else if (e.key === 'ArrowLeft' && selectionRange.endCol > 0) {
            e.preventDefault(); setSelectionRange(p => ({...p, endCol: p.endCol - 1}));
            scrollToCell(selectionRange.endRow, selectionRange.endCol - 1);
        } else if (e.key === 'ArrowDown' && selectionRange.endRow < safeRows.length - 1) {
            e.preventDefault(); setSelectionRange(p => ({...p, endRow: p.endRow + 1}));
            scrollToCell(selectionRange.endRow + 1, selectionRange.endCol);
        } else if (e.key === 'ArrowUp' && selectionRange.endRow > 0) {
            e.preventDefault(); setSelectionRange(p => ({...p, endRow: p.endRow - 1}));
            scrollToCell(selectionRange.endRow - 1, selectionRange.endCol);
        }
        return;
    }

    switch (e.key) {
        case 'ArrowUp': e.preventDefault(); if (rowIdx > 0) updateSelection(rowIdx - 1, colIdx); break;
        case 'ArrowDown':
            e.preventDefault();
            if (rowIdx < safeRows.length - 1) updateSelection(rowIdx + 1, colIdx);
            else if (isEditable) { handleAddRow(); setTimeout(() => updateSelection(rowIdx + 1, colIdx), 50); }
            break;
        case 'ArrowLeft': e.preventDefault(); if (colIdx > 0) updateSelection(rowIdx, colIdx - 1); break;
        case 'ArrowRight':
        case 'Tab':
            e.preventDefault();
            if (colIdx < columns.length - 1) updateSelection(rowIdx, colIdx + 1);
            else if (e.key === 'Tab' && rowIdx < safeRows.length - 1) updateSelection(rowIdx + 1, 0); 
            break;
        case 'Backspace':
        case 'Delete': e.preventDefault(); handleDeleteSelection(); break;
        default:
            if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
                if (!columns[colIdx]?.options && isColEditable) {
                    e.preventDefault(); setEditingCell(selectedCell); handleCellChange(rowIdx, selectedCell.colKey, e.key);
                }
            }
            break;
    }
  };

  const handleInputKeyDown = (e, rowIdx, colIdx) => {
    const safeRows = Array.isArray(rows) ? rows : [];
    if (e.key === 'Enter') {
        e.preventDefault(); setEditingCell(null);
        if (rowIdx < safeRows.length - 1) updateSelection(rowIdx + 1, colIdx);
        gridContainerRef.current?.focus();
    } else if (e.key === 'Escape') {
        e.preventDefault(); setEditingCell(null);
        gridContainerRef.current?.focus();
    } else if (e.key === 'Tab') {
        e.preventDefault(); setEditingCell(null);
        if (colIdx < columns.length - 1) updateSelection(rowIdx, colIdx + 1);
        gridContainerRef.current?.focus();
    } else { e.stopPropagation(); }
  };

  const updateSelection = (rowIdx, colIdx) => {
      if (!columns[colIdx]) return;
      setSelectedCell({ rowIdx, colKey: columns[colIdx].key });
      setSelectionRange({ startRow: rowIdx, startCol: colIdx, endRow: rowIdx, endCol: colIdx });
      scrollToCell(rowIdx, colIdx);
  };

  const handleDeleteSelection = () => {
      if (!isEditable) return;
      const minRow = Math.min(selectionRange.startRow, selectionRange.endRow);
      const maxRow = Math.max(selectionRange.startRow, selectionRange.endRow);
      const minCol = Math.min(selectionRange.startCol, selectionRange.endCol);
      const maxCol = Math.max(selectionRange.startCol, selectionRange.endCol);

      const updated = [...(rows || [])];
      const changedRowsToSync = [];
      
      for(let r = minRow; r <= maxRow; r++) {
          const target = { ...(updated[r] || {}) };
          if (target?.is_example) continue; 

          let hasCleared = false;
          for(let c = minCol; c <= maxCol; c++) {
              if (columns[c]) {
                  target[columns[c].key] = '';
                  hasCleared = true;
              }
          }
          if (hasCleared) {
              updated[r] = target;
              changedRowsToSync.push(target);
          }
      }
      recordHistory(updated);
      
      if (socketRef.current && changedRowsToSync.length > 0) {
          socketRef.current.emit('edit-cell', { updatedRows: changedRowsToSync });
      }
  };

  const handleCellMouseDown = (e, rowIdx, colIdx) => {
      if (e.button !== 0) return; 
      
      const col = columns[colIdx];
      if (!col) return;
      
      const colKey = col.key;
      const safeRows = Array.isArray(rows) ? rows : [];
      const targetRow = safeRows[rowIdx];
      const isColEditable = isEditable && targetRow && !targetRow?.is_example;
      
      if (e.shiftKey) {
          setSelectionRange(p => ({ ...p, endRow: rowIdx, endCol: colIdx }));
          scrollToCell(rowIdx, colIdx);
      } else {
          setIsDragging(true);
          updateSelection(rowIdx, colIdx);
          
          if (col.options && isColEditable) {
              setDropdownCell({ rowIdx, colKey });
              setEditingCell(null);
          } else {
              setDropdownCell(null);
          }
      }
      if (gridContainerRef.current) gridContainerRef.current.focus();
  };

  const handleCellMouseEnter = (rowIdx, colIdx) => {
      if (isDragging) {
          setSelectionRange(p => ({ ...p, endRow: rowIdx, endCol: colIdx }));
          scrollToCell(rowIdx, colIdx);
      }
  };

  const handleAddRow = () => {
    if (!isEditable) return; // Fixed to allow non-admins to append rows if window is open
    setActiveTab('all'); 
    const newRows = Array(isAdmin ? 10 : 5).fill(null).map((_, i) => ({
      id: generateTempId(Date.now() + i), coordinator_name: '', semester: '', course_name: '', course_code: '',
      is_conducted: '', course_type: '', exam_mode: '', exam_weightage: '', duration: '', remark: '', is_reexam: false
    }));
    recordHistory([...(rows || []), ...newRows]);
    setTimeout(() => { if (gridContainerRef.current) gridContainerRef.current.scrollTop = gridContainerRef.current.scrollHeight; }, 100);

    if (socketRef.current) socketRef.current.emit('add-rows', { newRows });
  };

  const handleDeleteSelected = () => {
    if (!selectedRowIndices || selectedRowIndices.size === 0 || !isEditable) return;
    
    const newDeletedIds = [...(deletedIds || [])];
    const idsToDelete = [];
    
    const safeRows = Array.isArray(rows) ? rows : [];
    const updated = safeRows.filter((r, idx) => {
        if (selectedRowIndices.has(idx)) {
            if (r?.is_example) return true; 
            if (r?.id && !String(r.id).includes('temp')) newDeletedIds.push(r.id); 
            if (r?.id) idsToDelete.push(r.id);
            return false;
        }
        return true;
    });

    if(updated.filter(r => r && !r?.is_example).length === 0) {
        updated.push({
            id: generateTempId(), coordinator_name: '', semester: '', course_name: '', course_code: '',
            is_conducted: '', course_type: '', exam_mode: '', exam_weightage: '', duration: '', remark: '', is_reexam: false
        });
    }

    setDeletedIds(newDeletedIds);
    recordHistory(updated);
    setSelectedRowIndices(new Set());
    setEditingCell(null);
    setDropdownCell(null);

    if (socketRef.current && idsToDelete.length > 0) socketRef.current.emit('delete-rows', { deletedIds: idsToDelete });
  };

  const handleFileUpload = (e) => {
    if (!isAdmin) return;
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        if (!bstr) return;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json(ws, { defval: '', raw: false });
        if (!Array.isArray(data) || data.length === 0) { alert('Uploaded spreadsheet appears empty.'); return; }

        const importedRows = data.map((row, idx) => {
          const findKey = (candidates) => {
            if (!row || typeof row !== 'object') return '';
            const rowKeys = Object.keys(row);
            for (const cand of candidates) {
              const matched = rowKeys.find(k => String(k || '').toLowerCase().includes(cand.toLowerCase()));
              if (matched) return String(row[matched] || '').trim();
            }
            return '';
          };
          
          const cCode = findKey(['course code', 'course_code', 'code']) || '';
          const cName = findKey(['course name', 'course_name', 'title']) || '';
          const cType = findKey(['course type', 'type']) || '';

          return {
            id: generateTempId(idx),
            coordinator_name: findKey(['coordinator', 'name']) || facultyName,
            semester: findKey(['semester', 'sem']) || '',
            course_name: cName,
            course_code: cCode,
            is_conducted: sanitizeValue('is_conducted', findKey(['whether', 'conduct', 'committee'])),
            course_type: sanitizeValue('course_type', cType),
            exam_mode: sanitizeValue('exam_mode', findKey(['exam mode', 'mode'])),
            exam_weightage: sanitizeValue('exam_weightage', findKey(['weightage', 'weight'])),
            duration: sanitizeValue('duration', findKey(['duration', 'time', 'hours'])),
            remark: findKey(['remark', 'notes', 'comment']) || '',
            is_reexam: cCode.toUpperCase().endsWith('R') || cName.toUpperCase().includes('(RE)') || cType.toUpperCase().includes('REPEAT')
          };
        });

        const validImportedRows = importedRows.filter(isRowNotEmpty);
        
        const safeRows = Array.isArray(rows) ? rows : [];
        const emptyIdx = safeRows.findIndex(r => r && !isRowNotEmpty(r) && !r?.is_example);
        let newRows = [...safeRows];
        
        if (emptyIdx !== -1) newRows.splice(emptyIdx, validImportedRows.length, ...validImportedRows);
        else newRows = [...safeRows, ...validImportedRows];

        recordHistory(newRows);
        alert(`Successfully imported ${validImportedRows.length} active rows!`);
        
        if (socketRef.current && validImportedRows.length > 0) socketRef.current.emit('edit-cell', { updatedRows: validImportedRows });
      } catch (err) { alert('Could not read Excel file.'); }
    };
    reader.readAsBinaryString(file);
    e.target.value = '';
  };

  const filteredRows = useMemo(() => {
    const safeRows = Array.isArray(rows) ? rows : [];
    
    return safeRows.map((r, originalIdx) => {
        if (!r) return null;
        return { ...r, originalIdx };
    }).filter(r => {
      if (!r) return false;
      if (r?.is_example && activeTab !== 'all') return false; 
      
      const hasData = isRowNotEmpty(r);
      if (activeTab === 'conducted' && (String(r?.is_conducted || '').trim().toLowerCase() !== 'yes' || !hasData)) return false;
      if (activeTab === 'exempted' && (String(r?.is_conducted || '').trim().toLowerCase() !== 'no' || !hasData)) return false;
      if (activeTab === 'reexams' && (!r?.is_reexam || !hasData)) return false;
      return true;
    });
  }, [rows, activeTab]);

  return (
    <div className="flex flex-col h-screen w-full bg-white dark:bg-[#111111] font-sans overflow-hidden absolute inset-0 z-50">
      
      <datalist id="courseNamesList">{(Array.isArray(catalogCourses) ? catalogCourses : []).map((c, i) => <option key={c?.id || i} value={c?.course_title || ''} />)}</datalist>
      <datalist id="courseCodesList">{(Array.isArray(catalogCourses) ? catalogCourses : []).map((c, i) => <option key={c?.id || i} value={c?.course_code || ''} />)}</datalist>
      <datalist id="teachersList">{(Array.isArray(catalogTeachers) ? catalogTeachers : []).map((t, i) => <option key={t?.id || i} value={t?.full_name || ''} />)}</datalist>
      
      {!isEditable && !isAdmin ? (
         <div className="bg-red-50 dark:bg-red-900/40 text-red-700 dark:text-red-300 px-4 py-2 text-sm flex items-center justify-center font-bold tracking-wide border-b border-red-200 dark:border-red-900/50 shadow-sm z-50 shrink-0">
            <Lock className="w-4 h-4 mr-2" /> 
            READ-ONLY MODE: The editing window is currently closed. Please contact the administrator to make modifications.
         </div>
      ) : editWindow?.end_date && timeLeft && timeLeft !== 'Expired' ? (
         <div className="bg-blue-50 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 px-4 py-2 text-sm flex items-center justify-center font-bold tracking-wide border-b border-blue-200 dark:border-blue-900/50 shadow-sm z-50 shrink-0">
             <Clock className="w-4 h-4 mr-2" />
             EDITING WINDOW OPEN: {timeLeft} remaining to submit requirements. Data auto-saves as you type.
         </div>
      ) : isAdmin && (!editWindow?.start_date || !editWindow?.end_date || timeLeft === 'Expired') ? (
         <div 
             className="bg-amber-50 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 px-4 py-2 text-sm flex items-center justify-center font-bold tracking-wide border-b border-amber-200 dark:border-amber-900/50 shadow-sm z-50 shrink-0 cursor-pointer hover:bg-amber-100 dark:hover:bg-amber-900/60 transition-colors"
             onClick={() => setIsWindowModalOpen(true)}
         >
             <AlertCircle className="w-4 h-4 mr-2" />
             ACTION REQUIRED: The editing window for faculty is not set or has expired. Click here to configure it.
         </div>
      ) : null}

      <div className="flex flex-col md:flex-row md:items-center justify-between px-4 py-2 border-b border-slate-200 dark:border-white/10 bg-white dark:bg-[#111111] shrink-0 gap-3">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded bg-[#0f9d58] flex items-center justify-center text-white shrink-0 shadow-sm cursor-pointer hover:bg-[#0b8043] transition-colors">
            <FileSpreadsheet className="w-6 h-6" />
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
                <input 
                    type="text" 
                    defaultValue="Exam Requirements Sheet" 
                    readOnly
                    className="text-lg text-slate-800 dark:text-slate-100 font-medium bg-transparent border-none focus:outline-none px-1 rounded w-full sm:w-auto"
                />
            </div>
            <div className="flex items-center gap-1 text-[13px] text-slate-600 dark:text-slate-400 mt-0.5">
              <button type="button" onClick={() => setShowInstructions(true)} className="hover:bg-slate-100 dark:hover:bg-white/5 px-2 py-0.5 rounded cursor-pointer font-medium">Help</button>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 overflow-x-auto pb-1 md:pb-0">
          <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-100 dark:bg-white/5 text-xs text-slate-600 dark:text-slate-400 font-medium">
             <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
             {liveUsers} Active Connection{liveUsers > 1 ? 's' : ''}
          </div>

          <div className="flex items-center gap-2 px-3 py-1.5 text-xs text-slate-500 dark:text-slate-400 font-medium">
             {syncing ? (
                <><RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-500" /> <span className="text-blue-600 dark:text-blue-400 font-medium">Saving...</span></>
             ) : saveStatus === 'error' ? (
                <><AlertCircle className="w-3.5 h-3.5 text-red-500" /> <span className="text-red-600 dark:text-red-400 font-medium">{String(statusMessage || 'Failed to save')}</span></>
             ) : saveStatus === 'unsaved' ? (
                <span className="text-amber-500 font-medium">Unsaved changes</span>
             ) : saveStatus === 'saved' ? (
                <><CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> <span className="text-emerald-600 dark:text-emerald-400 font-medium">Saved</span></>
             ) : null}
          </div>
          
          {isAdmin && (
            <button 
              type="button" 
              onClick={() => setIsWindowModalOpen(true)} 
              className="p-2 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-full transition-colors flex-shrink-0" 
              title="Set Faculty Editing Window"
            >
                <CalendarClock className="w-5 h-5" />
            </button>
          )}

          {isAdmin && (
            <button type="button" onClick={() => fileInputRef.current?.click()} className="p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10 rounded-full transition-colors flex-shrink-0" title="Import Excel File">
                <Upload className="w-5 h-5" />
            </button>
          )}
          
          <button 
            type="button" 
            onClick={handleSyncToBackend}
            disabled={!isEditable || syncing || (!hasUnsavedChanges && (deletedIds || []).length === 0 && saveStatus !== 'error')}
            className={`flex items-center gap-2 px-4 py-2 rounded-full font-bold text-sm transition-colors flex-shrink-0 ${
                !isEditable 
                  ? 'bg-slate-200 text-slate-400 dark:bg-white/10 dark:text-slate-600 cursor-not-allowed'
                  : (hasUnsavedChanges || (deletedIds || []).length > 0 || saveStatus === 'error')
                    ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-sm cursor-pointer' 
                    : 'bg-slate-100 text-slate-400 dark:bg-white/5 dark:text-slate-600 cursor-default'
            }`}
          >
            {syncing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save Data
          </button>
          
           <div className="w-8 h-8 rounded-full bg-purple-600 text-white flex items-center justify-center font-bold text-sm overflow-hidden border-2 border-white shadow-sm ml-2 cursor-pointer flex-shrink-0">
            {user?.name ? String(user.name).charAt(0).toUpperCase() : 'U'}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1 px-3 py-1.5 border-b border-slate-200 dark:border-white/10 bg-[#edf2fa] dark:bg-[#1a1a1a] text-slate-600 dark:text-slate-300 overflow-x-auto shrink-0">
        <div className="flex items-center gap-1 pr-2 border-r border-slate-300 dark:border-white/20 shrink-0">
            <button type="button" onClick={handleUndo} disabled={!isEditable || !Array.isArray(history) || history.length <= 1} className="p-1.5 hover:bg-slate-200 dark:hover:bg-white/10 rounded disabled:opacity-30" title="Undo (Ctrl+Z)"><Undo2 className="w-4 h-4" /></button>
            <button type="button" onClick={handleRedo} disabled={!isEditable || !Array.isArray(future) || future.length === 0} className="p-1.5 hover:bg-slate-200 dark:hover:bg-white/10 rounded disabled:opacity-30" title="Redo (Ctrl+Y)"><Redo2 className="w-4 h-4" /></button>
        </div>

        <div className="flex items-center gap-1 px-2 border-r border-slate-300 dark:border-white/20 shrink-0 relative" ref={zoomDropdownRef}>
             <div onClick={() => setIsZoomOpen(!isZoomOpen)} className="flex items-center gap-1 hover:bg-slate-200 dark:hover:bg-white/10 px-2 py-1 rounded text-xs cursor-pointer w-[70px] justify-between">
                <span>{zoomLevel}%</span><ChevronDown className="w-3 h-3" />
             </div>
             {isZoomOpen && (
                <div className="absolute top-full left-0 mt-1 bg-white dark:bg-[#222] border border-slate-200 dark:border-white/10 shadow-xl rounded z-50 py-1 w-24 overflow-hidden">
                    {[50, 75, 90, 100, 125, 150, 200].map(z => (
                        <div key={z} onClick={() => { setZoomLevel(z); setIsZoomOpen(false); }} className={`px-3 py-1.5 hover:bg-slate-100 dark:hover:bg-white/10 cursor-pointer text-xs ${z === zoomLevel ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600' : ''}`}>{z}%</div>
                    ))}
                </div>
             )}
        </div>

        <div className="flex items-center gap-1 px-2 shrink-0">
            {isEditable && selectedRowIndices && selectedRowIndices.size > 0 && (
                 <button type="button" onClick={handleDeleteSelected} className="flex items-center gap-1 px-2 py-1 text-xs text-red-700 bg-red-50 hover:bg-red-100 rounded border border-red-200 cursor-pointer"><Trash2 className="w-3 h-3" /> Delete Selected</button>
            )}
        </div>
      </div>

      <div className="flex-1 relative bg-white dark:bg-[#111111] overflow-hidden flex flex-col">
        <div 
           ref={gridContainerRef} 
           className="flex-1 overflow-auto custom-scrollbar relative bg-[#f8f9fa] dark:bg-[#111] transform origin-top-left outline-none"
           style={{ zoom: `${zoomLevel}%` }}
           tabIndex={0}
           onPaste={handlePaste}
           onCopy={handleCopy}
           onKeyDown={handleContainerKeyDown}
        >
          <table className="w-max min-w-full text-left border-collapse border-spacing-0 table-fixed bg-white dark:bg-[#111] select-none">
            <thead className="sticky top-0 z-40">
              <tr className="bg-[#f8f9fa] dark:bg-[#1a1a1a]">
                <th className="w-12 h-6 border-r border-b border-[#c0c0c0] dark:border-white/20 text-center bg-[#f8f9fa] dark:bg-[#222]">
                  <input
                    type="checkbox"
                    checked={(Array.isArray(rows) ? rows.length : 0) > 0 && selectedRowIndices && selectedRowIndices.size === (Array.isArray(rows) ? rows.length : 0)}
                    onChange={(e) => {
                      if (e.target.checked && Array.isArray(rows)) setSelectedRowIndices(new Set(rows.map((_, idx) => idx)));
                      else setSelectedRowIndices(new Set());
                    }}
                    className="rounded-sm w-3 h-3 cursor-pointer"
                  />
                </th>
                {(columns || []).map(col => (
                  <th key={col.key} className={`${col.width} h-6 text-center border-r border-b border-[#c0c0c0] dark:border-white/20 text-[11px] font-normal text-slate-600 dark:text-slate-300 bg-[#f8f9fa] dark:bg-[#222]`}>
                    {col.letter}
                  </th>
                ))}
              </tr>
              
              <tr className="bg-white dark:bg-[#111]">
                  <th className="w-12 h-8 text-center border-r border-b border-[#e2e3e3] dark:border-white/10 font-medium text-[11px] text-slate-500 bg-[#f8f9fa] dark:bg-[#222] sticky left-0 z-30">1</th>
                   {(columns || []).map(col => (
                    <th key={col.key} className={`${col.width} px-2 h-8 border-r border-b border-[#e2e3e3] dark:border-white/10 font-bold text-slate-700 dark:text-slate-200 text-xs bg-slate-50 dark:bg-[#1a1a1a] shadow-[inset_0_-1px_0_0_#000] dark:shadow-[inset_0_-1px_0_0_#555]`}>
                        {col.title}
                    </th>
                   ))}
              </tr>
            </thead>

            <tbody className="font-sans">
              {filteredRows.map((row, idx) => {
                  if (!row) return null; 
                  const rowIdx = row?.originalIdx ?? idx;
                  const displayRowNumber = rowIdx + 2; 
                  const isRowSelected = selectedRowIndices && selectedRowIndices.has(rowIdx);
                  const rowKey = row?.id ? `id-${row.id}` : `idx-${rowIdx}`;

                  return (
                    <tr key={rowKey} className={`${isRowSelected ? 'bg-blue-50/50 dark:bg-blue-900/20' : (row?.is_example ? 'bg-amber-50/50 dark:bg-amber-900/10' : 'bg-white dark:bg-[#111]')}`}>
                      <td className="w-12 h-6 text-center border-r border-b border-[#e2e3e3] dark:border-white/10 text-[11px] text-slate-500 bg-[#f8f9fa] dark:bg-[#222] sticky left-0 z-20 select-none group">
                        <div className="flex items-center justify-center gap-1">
                            {!row?.is_example && (
                                <input type="checkbox" checked={isRowSelected} onChange={() => {
                                    setSelectedRowIndices(prev => { const next = new Set(prev || []); if (next.has(rowIdx)) next.delete(rowIdx); else next.add(rowIdx); return next; });
                                }} className="rounded-sm w-3 h-3 cursor-pointer opacity-0 group-hover:opacity-100 absolute left-1" />
                            )}
                            <span className={!row?.is_example ? "group-hover:opacity-0" : ""}>{displayRowNumber}</span>
                        </div>
                      </td>

                      {(columns || []).map((col, colIdx) => {
                        const colKey = col.key;
                        const cellValue = row?.[colKey] != null ? String(row[colKey]) : '';
                        
                        const isColEditable = isEditable && !row?.is_example;

                        const isInSelectionRange = selectionRange 
                            ? (rowIdx >= Math.min(selectionRange.startRow, selectionRange.endRow) && 
                               rowIdx <= Math.max(selectionRange.startRow, selectionRange.endRow) &&
                               colIdx >= Math.min(selectionRange.startCol, selectionRange.endCol) &&
                               colIdx <= Math.max(selectionRange.startCol, selectionRange.endCol))
                            : false;
                        
                        const isActiveCursor = selectedCell?.rowIdx === rowIdx && selectedCell?.colKey === colKey;
                        const isTextEditing = editingCell?.rowIdx === rowIdx && editingCell?.colKey === colKey && !col.options;
                        const isDropdownOpen = dropdownCell?.rowIdx === rowIdx && dropdownCell?.colKey === colKey && col.options;

                        const cellStyling = isTextEditing || isDropdownOpen ? 'z-50 overflow-visible bg-white dark:bg-[#222]' 
                            : isActiveCursor ? 'ring-[2px] ring-[#1a73e8] ring-inset z-10 bg-blue-50/20 dark:bg-blue-900/40 outline-none'
                            : isInSelectionRange ? 'bg-blue-100/60 dark:bg-blue-800/40 outline outline-1 outline-blue-300 dark:outline-blue-600'
                            : (!isColEditable && !row?.is_example ? 'bg-slate-50 dark:bg-white/[0.02]' : '');

                        return (
                          <td
                            key={colKey}
                            data-row={rowIdx}
                            data-col={colIdx}
                            ref={isDropdownOpen ? activeCellRef : null}
                            onMouseDown={(e) => handleCellMouseDown(e, rowIdx, colIdx)}
                            onMouseEnter={() => handleCellMouseEnter(rowIdx, colIdx)}
                            onDoubleClick={() => {
                                if (!isColEditable) return;
                                if (!col.options) setEditingCell({ rowIdx, colKey });
                            }}
                            className={`px-2 h-6 border-r border-b border-[#e2e3e3] dark:border-white/10 text-[13px] ${row?.is_example ? 'text-amber-700 dark:text-amber-500' : 'text-slate-800 dark:text-slate-200'} relative whitespace-nowrap cursor-cell ${(!isTextEditing && !isDropdownOpen) ? 'overflow-hidden' : ''} ${cellStyling}`}
                          >
                            {isTextEditing && isColEditable ? (
                                <input
                                  autoFocus
                                  type="text"
                                  list={col.listId}
                                  value={cellValue}
                                  onChange={e => handleCellChange(rowIdx, colKey, e.target.value)}
                                  onBlur={() => setEditingCell(null)}
                                  onKeyDown={(e) => handleInputKeyDown(e, rowIdx, colIdx)} 
                                  className="absolute top-0 left-0 w-[calc(100%+2px)] h-[calc(100%+2px)] -m-[1px] px-2 bg-white dark:bg-[#222] text-slate-900 dark:text-white text-[13px] outline-none shadow-xl z-50 border-2 border-[#1a73e8]"
                                />
                            ) : (
                                <div className={`flex items-center w-full h-full pointer-events-none ${!cellValue && isActiveCursor ? 'text-slate-400' : ''}`}>
                                  {col.options && cellValue ? (
                                     <span className={`px-2 py-0.5 rounded-full text-xs font-medium inline-block truncate max-w-full ${row?.is_example ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300' : getPillColor(cellValue, colKey)}`}>
                                        {cellValue}
                                     </span>
                                  ) : (
                                     <span className="block truncate max-w-full">{cellValue}</span>
                                  )}
                                </div>
                            )}

                            {isDropdownOpen && isColEditable && (
                                <SheetsDropdown
                                   value={cellValue}
                                   options={col.options}
                                   triggerRef={activeCellRef}
                                   colKey={colKey}
                                   onChange={(val) => {
                                      handleCellChange(rowIdx, colKey, val); 
                                      setDropdownCell(null); 
                                      gridContainerRef.current?.focus(); 
                                      if (colIdx < columns.length - 1) updateSelection(rowIdx, colIdx + 1);
                                   }}
                                   onClose={() => {
                                       setDropdownCell(null);
                                       gridContainerRef.current?.focus(); 
                                   }}
                                />
                            )}

                            {isActiveCursor && !isTextEditing && !isDropdownOpen && (
                              <div className="absolute -bottom-[2px] -right-[2px] w-1.5 h-1.5 bg-[#1a73e8] border border-white z-20 cursor-crosshair pointer-events-none" />
                            )}
                            
                            {col.options && isColEditable && (isActiveCursor || isInSelectionRange) && !isDropdownOpen && (
                                <div className="absolute right-1 top-1/2 -translate-y-1/2 bg-slate-100 dark:bg-[#333] rounded px-0.5 text-slate-500 cursor-pointer hover:bg-slate-200 pointer-events-auto">
                                    <ChevronDown className="w-3 h-3" />
                                </div>
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
          
          {isEditable && (
          <div className="p-4 pt-2">
             <button type="button" onClick={handleAddRow} className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 text-slate-600 dark:text-slate-300 text-xs font-medium transition-colors border border-slate-200 dark:border-white/10">
                <Plus className="w-3.5 h-3.5" /> Add {isAdmin ? '10' : '5'} more rows
              </button>
          </div>
          )}
        </div>

        <div className="bg-[#f8f9fa] dark:bg-[#1a1a1a] border-t border-[#c0c0c0] dark:border-white/20 h-10 flex items-center px-4 justify-between text-xs select-none shrink-0 z-30">
          <div className="flex items-center gap-1 h-full">
            {isEditable && (
               <button type="button" onClick={handleAddRow} className="p-1 text-slate-500 hover:bg-slate-200 dark:hover:bg-white/10 rounded mr-2" title="Add Rows"><Plus className="w-4 h-4" /></button>
            )}
            <button type="button" className="p-1 text-slate-500 hover:bg-slate-200 dark:hover:bg-white/10 rounded mr-2"><Menu className="w-4 h-4" /></button>
            
            <button type="button" onClick={() => setActiveTab('all')} className={`px-4 h-full flex items-center font-medium border-b-2 transition-colors ${activeTab === 'all' ? 'border-[#0f9d58] text-[#0f9d58] dark:text-emerald-400 bg-white dark:bg-[#111]' : 'border-transparent text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-white/5'}`}>All Requirements</button>
            <button type="button" onClick={() => setActiveTab('conducted')} className={`px-4 h-full flex items-center font-medium border-b-2 transition-colors ${activeTab === 'conducted' ? 'border-[#0f9d58] text-[#0f9d58] dark:text-emerald-400 bg-white dark:bg-[#111]' : 'border-transparent text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-white/5'}`}>Conducted</button>
            <button type="button" onClick={() => setActiveTab('reexams')} className={`px-4 h-full flex items-center font-medium border-b-2 transition-colors ${activeTab === 'reexams' ? 'border-[#0f9d58] text-[#0f9d58] dark:text-emerald-400 bg-white dark:bg-[#111]' : 'border-transparent text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-white/5'}`}>Re-Exams</button>
          </div>
        </div>
      </div>

      {showInstructions && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in">
              <div className="bg-white dark:bg-[#1a1a1a] p-6 rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 dark:border-white/10">
                  <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3 text-emerald-600 dark:text-emerald-400">
                          <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg"><FileSpreadsheet className="w-6 h-6" /></div>
                          <h2 className="text-xl font-bold text-slate-900 dark:text-white">How to use this sheet</h2>
                      </div>
                      <button type="button" onClick={closeInstructions} className="p-1 hover:bg-slate-100 dark:hover:bg-white/5 rounded-full text-slate-500"><X className="w-5 h-5" /></button>
                  </div>
                  
                  <div className="space-y-4 text-sm text-slate-600 dark:text-slate-300">
                      <p>Welcome to the Exam Requirements editor. It works just like Excel!</p>
                      <ul className="space-y-2 list-disc list-inside">
                          <li><strong>Arrow Keys:</strong> Navigate between cells and press <strong>Enter</strong> to commit changes.</li>
                          <li><strong>Single Click Dropdowns:</strong> Click any cell with a dropdown to instantly show the list.</li>
                          <li><strong>Click and Drag:</strong> Select multiple cells smoothly, auto-scrolling to the edge.</li>
                          <li><strong>Ctrl + Z / Y:</strong> Undo and Redo changes.</li>
                          <li><strong>Auto-Save:</strong> Edits are instantly live for others and save to the server automatically.</li>
                          {!isAdmin && (
                             <li className="text-amber-600 dark:text-amber-400"><strong>Note:</strong> Data entry relies on an active edit window setup by the administration.</li>
                          )}
                      </ul>
                  </div>
                  
                  <button type="button" onClick={closeInstructions} className="w-full mt-6 py-2.5 bg-[#0f9d58] hover:bg-[#0b8043] text-white font-bold rounded-xl transition-colors">
                      Got it, let's go!
                  </button>
              </div>
          </div>
      )}

      {isAdmin && isWindowModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in">
              <div className="bg-white dark:bg-[#1a1a1a] rounded-2xl w-full max-w-sm shadow-2xl border border-slate-200 dark:border-white/10 overflow-hidden">
                  <div className="p-5 border-b border-slate-100 dark:border-white/5 flex items-center justify-between">
                      <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                          <CalendarClock className="w-5 h-5 text-indigo-500" /> Editing Window Setup
                      </h3>
                      <button onClick={() => setIsWindowModalOpen(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-white"><X className="w-5 h-5"/></button>
                  </div>
                  <div className="p-5 space-y-4">
                      <p className="text-sm text-slate-500 dark:text-slate-400 mb-2">
                          As a prerequisite, you must set the date range during which Faculty are permitted to make modifications to their requirements.
                      </p>
                      <div>
                          <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Start Date</label>
                          <input 
                              type="date" 
                              value={editWindow?.start_date || ''}
                              onChange={(e) => setEditWindow({ ...editWindow, start_date: e.target.value })}
                              className="w-full bg-slate-50 dark:bg-black/50 border border-slate-200 dark:border-white/10 rounded-lg px-4 py-2.5 outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-white"
                          />
                      </div>
                      <div>
                          <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">End Date</label>
                          <input 
                              type="date" 
                              value={editWindow?.end_date || ''}
                              onChange={(e) => setEditWindow({ ...editWindow, end_date: e.target.value })}
                              className="w-full bg-slate-50 dark:bg-black/50 border border-slate-200 dark:border-white/10 rounded-lg px-4 py-2.5 outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-white"
                          />
                      </div>
                  </div>
                  <div className="p-5 border-t border-slate-100 dark:border-white/5 flex justify-end gap-3 bg-slate-50 dark:bg-white/[0.02]">
                      <button onClick={() => setIsWindowModalOpen(false)} className="px-4 py-2 rounded-xl text-slate-600 dark:text-slate-400 font-medium hover:bg-slate-200 dark:hover:bg-white/5 transition-colors">Cancel</button>
                      <button 
                          onClick={saveEditingWindow} 
                          disabled={savingWindow}
                          className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold shadow-sm transition-colors flex items-center"
                      >
                          {savingWindow ? "Saving..." : "Save Window"}
                      </button>
                  </div>
              </div>
          </div>
      )}

      <input ref={fileInputRef} type="file" accept=".xlsx, .xls, .csv" onChange={handleFileUpload} className="hidden" />

      <style dangerouslySetInnerHTML={{__html: `
        .custom-scrollbar::-webkit-scrollbar { height: 12px; width: 12px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: #f1f3f4; }
        .dark .custom-scrollbar::-webkit-scrollbar-track { background: #111; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #c0c4c9; border-radius: 6px; border: 3px solid #f1f3f4; }
        .dark .custom-scrollbar::-webkit-scrollbar-thumb { background: #555; border: 3px solid #111; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #a8aab0; }
        .dark .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #777; }

        .custom-scrollbar-thin::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar-thin::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar-thin::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 3px; }
        .dark .custom-scrollbar-thin::-webkit-scrollbar-thumb { background: #475569; }
      `}} />
    </div>
  );
}