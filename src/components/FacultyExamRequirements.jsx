import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  FileSpreadsheet, Plus, Trash2, Save, RefreshCw, Upload,
  CheckCircle2, X, Undo2, Redo2, ChevronDown, Menu, AlertCircle
} from 'lucide-react';
import * as XLSX from 'xlsx';

// Options for dropdowns
const SEMESTER_OPTIONS = ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th'];
const COURSE_TYPE_OPTIONS = ['Regular', 'Regular+ Repeat', 'Repeat', 'Recourse', 'MDC', 'Multidisciplinary Course', 'Open elective'];
const EXAM_MODE_OPTIONS = ['Written', 'Online/Lab exam', 'Lab Based', 'Project-based evaluation', 'Project Based (Viva)', 'MCQ Quiz - Online', 'MCQ Quiz - Offline'];
const DURATION_PRESETS = ['1', '1.5', '2', '3', '30 Min', '45 Min', 'Complete Day for whole batch'];
const IS_CONDUCTED_OPTIONS = ['Yes', 'No'];

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

// Generates a local temp ID that is safe and recognizable
const generateTempId = (index = 0) => `temp-${Date.now()}-${index}`;

// Helper to determine Pill Colors based on value
const getPillColor = (value, colKey) => {
    if (!value) return '';
    const v = value.toString().toLowerCase().trim();
    
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
    // Default fallback pill styling
    return 'bg-slate-100 text-slate-800 dark:bg-white/10 dark:text-slate-200';
};

/* 
 * Google Sheets Style Dropdown Component
 * Renders via a portal so it floats over the entire grid without being clipped.
 */
const SheetsDropdown = ({ value, options, onChange, onClose, triggerRef, colKey }) => {
    const [style, setStyle] = useState({});
    const menuRef = useRef(null);

    useEffect(() => {
        if (triggerRef.current) {
            const rect = triggerRef.current.getBoundingClientRect();
            // Position exactly below the cell
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

    const handleKeyDown = (e) => {
        if (e.key === 'Escape') {
            e.stopPropagation();
            onClose();
        }
    };

    return createPortal(
        <div 
            ref={menuRef}
            style={style}
            onKeyDown={handleKeyDown}
            className="bg-white dark:bg-[#222] shadow-2xl border border-slate-200 dark:border-white/10 rounded-lg py-2 flex flex-col gap-1 max-h-[300px] overflow-y-auto animate-in fade-in zoom-in-95 duration-100 custom-scrollbar-thin"
        >
            {/* Blank Option for clearing */}
            <div 
                className="px-3 py-1.5 hover:bg-slate-50 dark:hover:bg-white/5 cursor-pointer text-[13px] text-slate-500 italic"
                onClick={(e) => { e.stopPropagation(); onChange(''); }}
            >
                Clear selection
            </div>

            {options.map((opt) => (
                <div 
                    key={opt}
                    onClick={(e) => { 
                        e.stopPropagation(); 
                        onChange(opt); 
                    }}
                    className="px-3 py-1.5 hover:bg-slate-50 dark:hover:bg-white/5 cursor-pointer flex items-center"
                >
                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${getPillColor(opt, colKey)} ${value === opt ? 'ring-2 ring-blue-400 ring-offset-1' : ''}`}>
                        {opt}
                    </span>
                </div>
            ))}
        </div>,
        document.body
    );
};

export default function FacultyExamRequirements({ user }) {
  const backendUrl = import.meta.env?.VITE_BACKEND_URL || 'http://localhost:5000';
  const facultyName = user?.name || user?.full_name || 'Dr. Faculty Coordinator';

  // Spreadsheet Data State
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [saveStatus, setSaveStatus] = useState('idle'); 
  const [statusMessage, setStatusMessage] = useState('');

  // Autocomplete Catalogs
  const [catalogCourses, setCatalogCourses] = useState([]);
  const [catalogTeachers, setCatalogTeachers] = useState([]);

  // Grid / Selection State
  const [selectedCell, setSelectedCell] = useState({ rowIdx: 0, colKey: 'coordinator_name' });
  const [selectionRange, setSelectionRange] = useState({ startRow: 0, startCol: 0, endRow: 0, endCol: 0 });
  const [isDragging, setIsDragging] = useState(false);
  
  const [selectedRowIndices, setSelectedRowIndices] = useState(new Set());
  const [editingCell, setEditingCell] = useState(null); 
  const [dropdownCell, setDropdownCell] = useState(null); // Tracks which dropdown is open
  const [activeTab, setActiveTab] = useState('all'); 

  // UI State
  const [showInstructions, setShowInstructions] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(100);
  const [isZoomOpen, setIsZoomOpen] = useState(false);

  // History for Undo/Redo
  const [history, setHistory] = useState([]);
  const [future, setFuture] = useState([]);

  // Refs
  const fileInputRef = useRef(null);
  const gridContainerRef = useRef(null);
  const zoomDropdownRef = useRef(null);
  const activeCellRef = useRef(null); 

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

  // Helper to determine if a row has any useful data at all
  const isRowNotEmpty = (r) => {
    return r.course_code?.trim() || 
           r.course_name?.trim() || 
           r.semester?.trim() || 
           r.is_conducted?.trim() || 
           r.course_type?.trim() ||
           r.exam_mode?.trim() || 
           r.remark?.trim();
  };

  useEffect(() => {
    const handleMouseUpGlobal = () => setIsDragging(false);
    window.addEventListener('mouseup', handleMouseUpGlobal);
    return () => window.removeEventListener('mouseup', handleMouseUpGlobal);
  }, []);

  useEffect(() => {
    const seen = localStorage.getItem('examnex_instructions_seen');
    if (!seen) setShowInstructions(true);
  }, []);

  const closeInstructions = () => {
    setShowInstructions(false);
    localStorage.setItem('examnex_instructions_seen', 'true');
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (zoomDropdownRef.current && !zoomDropdownRef.current.contains(event.target)) setIsZoomOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const coursesRes = await fetch(`${backendUrl}/api/admin/courses`).catch(() => null);
      if (coursesRes?.ok) setCatalogCourses(await coursesRes.json());

      const teachersRes = await fetch(`${backendUrl}/api/admin/teachers`).catch(() => null);
      if (teachersRes?.ok) setCatalogTeachers(await teachersRes.json());

      let loadedRows = [];
      const reqRes = await fetch(`${backendUrl}/api/exam-requirements`).catch(() => null);
      if (reqRes?.ok) {
        const data = await reqRes.json();
        if (Array.isArray(data) && data.length > 0) loadedRows = data;
      }

      if (loadedRows.length === 0) {
        const cached = localStorage.getItem('examnex_faculty_sheet');
        if (cached) { try { loadedRows = JSON.parse(cached); } catch (e) {} }
      }

      const MIN_ROWS = 25;
      if (!loadedRows || loadedRows.length < MIN_ROWS) {
          const currentLength = loadedRows ? loadedRows.length : 0;
          const padding = Array(MIN_ROWS - currentLength).fill(null).map((_, i) => ({
              id: generateTempId(i), coordinator_name: '', semester: '', course_name: '', course_code: '',
              is_conducted: '', course_type: '', exam_mode: '', exam_weightage: '', duration: '', remark: '', is_reexam: false
          }));
          loadedRows = [...(loadedRows || []), ...padding];
      }

      setRows(loadedRows);
      setHistory([loadedRows]);
    } catch (err) {
      console.warn('Error fetching data:', err);
    } finally {
      setLoading(false);
    }
  }, [backendUrl]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const recordHistory = useCallback((newRows) => {
    setHistory(prev => {
        if (prev.length > 0 && JSON.stringify(prev[prev.length - 1]) === JSON.stringify(newRows)) return prev;
        return [...prev.slice(-20), newRows];
    });
    setFuture([]);
    setRows(newRows);
    setHasUnsavedChanges(true);
    setSaveStatus('unsaved');
    setStatusMessage('');
  }, []);

  const handleUndo = useCallback(() => {
    if (history.length <= 1) return; 
    setFuture(prev => [rows, ...prev]);
    const previousState = history[history.length - 2];
    setHistory(prev => prev.slice(0, prev.length - 1));
    setRows(previousState);
    setHasUnsavedChanges(true);
    setSaveStatus('unsaved');
  }, [history, rows]);

  const handleRedo = useCallback(() => {
    if (future.length === 0) return;
    const nextState = future[0];
    setHistory(prev => [...prev, nextState]);
    setFuture(prev => prev.slice(1));
    setRows(nextState);
    setHasUnsavedChanges(true);
    setSaveStatus('unsaved');
  }, [future]);

  const handleCellChange = (rowIdx, colKey, value) => {
    const updated = [...rows];
    const targetRow = { ...updated[rowIdx] };
    targetRow[colKey] = value;

    const inputVal = value?.toString().trim().toUpperCase() || '';

    if (['course_code', 'course_name', 'course_type'].includes(colKey)) {
      const code = (targetRow.course_code || '').toUpperCase();
      const name = (targetRow.course_name || '').toUpperCase();
      const type = (targetRow.course_type || '').toUpperCase();
      targetRow.is_reexam = code.endsWith('R') || name.includes('(RE)') || name.includes('RE-EXAM') || type.includes('REPEAT') || type.includes('RECOURSE');
    }

    if (['course_name', 'course_code'].includes(colKey) && inputVal !== '') {
      let matched = catalogCourses.find(c => c.course_title?.toUpperCase() === inputVal || c.course_code?.toUpperCase() === inputVal);
      if (!matched && inputVal.length > 1 && inputVal.length <= 5) matched = catalogCourses.find(c => getAcronym(c.course_title) === inputVal);
      if (matched) {
        targetRow.course_name = matched.course_title || targetRow.course_name;
        targetRow.course_code = matched.course_code || targetRow.course_code;
        if (!targetRow.semester && matched.taught_in?.length > 0) {
          targetRow.semester = `${matched.taught_in[0].semester}${matched.taught_in[0].semester === 1 ? 'st' : (matched.taught_in[0].semester === 2 ? 'nd' : (matched.taught_in[0].semester === 3 ? 'rd' : 'th'))}`;
        }
      }
    }

    if (!targetRow.coordinator_name && ['course_name', 'course_code'].includes(colKey) && inputVal !== '') {
        targetRow.coordinator_name = facultyName;
    }

    updated[rowIdx] = targetRow;
    recordHistory(updated);
  };

  const handleSyncToBackend = async () => {
    if (!hasUnsavedChanges) return;
    setSyncing(true);
    setSaveStatus('saving');
    setStatusMessage('');

    try {
      const validRows = rows.filter(isRowNotEmpty);
      const payload = {
        rows: validRows.map(r => {
          const rowData = { ...r, coordinator_name: r.coordinator_name || facultyName, coordinator_id: user?.id || null, coordinator_email: user?.email || null };
          if (rowData.id && String(rowData.id).includes('temp')) delete rowData.id;
          return rowData;
        }),
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
            setRows(prevRows => {
                const newRows = [...prevRows];
                let apiIdx = 0;
                for (let i = 0; i < newRows.length; i++) {
                    if (isRowNotEmpty(newRows[i])) {
                        if (data.rows[apiIdx]) {
                            newRows[i] = { ...newRows[i], id: data.rows[apiIdx].id }; 
                            apiIdx++;
                        }
                    }
                }
                return newRows;
            });

            setHistory(prev => {
                if (prev.length === 0) return prev;
                const newHist = [...prev];
                const lastState = [...newHist[newHist.length - 1]];
                let histApiIdx = 0;
                for (let i = 0; i < lastState.length; i++) {
                    if (isRowNotEmpty(lastState[i])) {
                        if (data.rows[histApiIdx]) {
                            lastState[i] = { ...lastState[i], id: data.rows[histApiIdx].id };
                            histApiIdx++;
                        }
                    }
                }
                newHist[newHist.length - 1] = lastState;
                return newHist;
            });
        }
        
        setHasUnsavedChanges(false);
        setSaveStatus('saved');
        setTimeout(() => setSaveStatus('idle'), 3000);
      } else {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || 'Server returned error while syncing');
      }
    } catch (err) {
      console.warn('Backend sync failed:', err);
      setSaveStatus('error');
      setStatusMessage(err.message || 'Failed to save');
      setTimeout(() => setSaveStatus('unsaved'), 5000);
    } finally {
      setSyncing(false);
      gridContainerRef.current?.focus(); 
    }
  };

  const handleCopy = (e) => {
    if (editingCell) return; 
    e.preventDefault();

    let copyText = '';
    const minRow = Math.min(selectionRange.startRow, selectionRange.endRow);
    const maxRow = Math.max(selectionRange.startRow, selectionRange.endRow);
    const minCol = Math.min(selectionRange.startCol, selectionRange.endCol);
    const maxCol = Math.max(selectionRange.startCol, selectionRange.endCol);

    for (let r = minRow; r <= maxRow; r++) {
      let rowVals = [];
      for (let c = minCol; c <= maxCol; c++) rowVals.push(rows[r]?.[columns[c].key] || '');
      copyText += rowVals.join('\t') + '\n';
    }

    e.clipboardData.setData('text/plain', copyText.trimEnd());
  };

  const handlePaste = (e) => {
    if (editingCell) return;
    e.preventDefault();
    
    const clipboardData = e.clipboardData || window.clipboardData;
    const pastedText = clipboardData.getData('Text');
    if (!pastedText) return;

    const pasteRows = pastedText.split(/\r?\n/).map(row => row.split('\t'));
    const startRowIdx = Math.min(selectionRange.startRow, selectionRange.endRow);
    const startColIdx = Math.min(selectionRange.startCol, selectionRange.endCol);

    const updatedRows = [...rows];
    
    for (let i = 0; i < pasteRows.length; i++) {
        const targetRowIdx = startRowIdx + i;
        if (targetRowIdx >= updatedRows.length) {
            updatedRows.push({
                id: generateTempId(targetRowIdx), coordinator_name: '', semester: '', course_name: '', course_code: '',
                is_conducted: '', course_type: '', exam_mode: '', exam_weightage: '', duration: '', remark: '', is_reexam: false
            });
        }
        
        const targetRow = { ...updatedRows[targetRowIdx] };
        const rowData = pasteRows[i];
        if (rowData.length === 1 && rowData[0].trim() === '') continue;

        for (let j = 0; j < rowData.length; j++) {
            const targetColIdx = startColIdx + j;
            if (targetColIdx < columns.length) {
                const colKey = columns[targetColIdx].key;
                const value = rowData[j].trim();
                targetRow[colKey] = value;

                if (['course_name', 'course_code'].includes(colKey) && value !== '') {
                    let matched = catalogCourses.find(c => c.course_title?.toUpperCase() === value.toUpperCase() || c.course_code?.toUpperCase() === value.toUpperCase());
                    if (!matched && value.length > 1 && value.length <= 5) matched = catalogCourses.find(c => getAcronym(c.course_title) === value.toUpperCase());
                    if (matched) {
                        targetRow.course_name = matched.course_title || targetRow.course_name;
                        targetRow.course_code = matched.course_code || targetRow.course_code;
                        if (!targetRow.semester && matched.taught_in?.length > 0) targetRow.semester = `${matched.taught_in[0].semester}${matched.taught_in[0].semester === 1 ? 'st' : (matched.taught_in[0].semester === 2 ? 'nd' : (matched.taught_in[0].semester === 3 ? 'rd' : 'th'))}`;
                    }
                    if (!targetRow.coordinator_name) targetRow.coordinator_name = facultyName;
                }
            }
        }
        updatedRows[targetRowIdx] = targetRow;
    }
    recordHistory(updatedRows);
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
    // Block Browser Save mapping explicitly
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        return; 
    }

    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) handleRedo(); else handleUndo();
        return;
    }
    
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault(); handleRedo(); return;
    }

    if (!editingCell && !dropdownCell && e.key === 'Enter') {
        e.preventDefault();
        const col = columns.find(c => c.key === selectedCell.colKey);
        if (col && col.options) {
            setDropdownCell(selectedCell); // Open sheets dropdown
        } else {
            setEditingCell(selectedCell);  // Open text input
        }
        return; 
    }

    if (editingCell || dropdownCell) return; // Inputs/Dropdowns handle their own keydowns

    const colIdx = columns.findIndex(c => c.key === selectedCell.colKey);
    const { rowIdx } = selectedCell;

    if (e.shiftKey) {
        if (e.key === 'ArrowRight' && selectionRange.endCol < columns.length - 1) {
            e.preventDefault(); setSelectionRange(p => ({...p, endCol: p.endCol + 1}));
            scrollToCell(selectionRange.endRow, selectionRange.endCol + 1);
        } else if (e.key === 'ArrowLeft' && selectionRange.endCol > 0) {
            e.preventDefault(); setSelectionRange(p => ({...p, endCol: p.endCol - 1}));
            scrollToCell(selectionRange.endRow, selectionRange.endCol - 1);
        } else if (e.key === 'ArrowDown' && selectionRange.endRow < rows.length - 1) {
            e.preventDefault(); setSelectionRange(p => ({...p, endRow: p.endRow + 1}));
            scrollToCell(selectionRange.endRow + 1, selectionRange.endCol);
        } else if (e.key === 'ArrowUp' && selectionRange.endRow > 0) {
            e.preventDefault(); setSelectionRange(p => ({...p, endRow: p.endRow - 1}));
            scrollToCell(selectionRange.endRow - 1, selectionRange.endCol);
        }
        return;
    }

    switch (e.key) {
        case 'ArrowUp':
            e.preventDefault(); if (rowIdx > 0) updateSelection(rowIdx - 1, colIdx);
            break;
        case 'ArrowDown':
            e.preventDefault();
            if (rowIdx < rows.length - 1) updateSelection(rowIdx + 1, colIdx);
            else { handleAddRow(); setTimeout(() => updateSelection(rowIdx + 1, colIdx), 50); }
            break;
        case 'ArrowLeft':
            e.preventDefault(); if (colIdx > 0) updateSelection(rowIdx, colIdx - 1);
            break;
        case 'ArrowRight':
        case 'Tab':
            e.preventDefault();
            if (colIdx < columns.length - 1) updateSelection(rowIdx, colIdx + 1);
            else if (e.key === 'Tab' && rowIdx < rows.length - 1) updateSelection(rowIdx + 1, 0); 
            break;
        case 'Backspace':
        case 'Delete':
            e.preventDefault(); handleDeleteSelection();
            break;
        default:
            if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
                const col = columns[colIdx];
                if (!col.options) {
                    e.preventDefault();
                    setEditingCell(selectedCell);
                    handleCellChange(rowIdx, selectedCell.colKey, e.key);
                }
            }
            break;
    }
  };

  const handleInputKeyDown = (e, rowIdx, colIdx) => {
    if (e.key === 'Enter') {
        e.preventDefault();
        setEditingCell(null);
        if (rowIdx < rows.length - 1) updateSelection(rowIdx + 1, colIdx);
        gridContainerRef.current?.focus();
    } else if (e.key === 'Escape') {
        e.preventDefault();
        setEditingCell(null);
        gridContainerRef.current?.focus();
    } else if (e.key === 'Tab') {
        e.preventDefault();
        setEditingCell(null);
        if (colIdx < columns.length - 1) updateSelection(rowIdx, colIdx + 1);
        gridContainerRef.current?.focus();
    } else {
        e.stopPropagation(); 
    }
  };

  const updateSelection = (rowIdx, colIdx) => {
      setSelectedCell({ rowIdx, colKey: columns[colIdx].key });
      setSelectionRange({ startRow: rowIdx, startCol: colIdx, endRow: rowIdx, endCol: colIdx });
      scrollToCell(rowIdx, colIdx);
  };

  const handleDeleteSelection = () => {
      const minRow = Math.min(selectionRange.startRow, selectionRange.endRow);
      const maxRow = Math.max(selectionRange.startRow, selectionRange.endRow);
      const minCol = Math.min(selectionRange.startCol, selectionRange.endCol);
      const maxCol = Math.max(selectionRange.startCol, selectionRange.endCol);

      const updated = [...rows];
      for(let r = minRow; r <= maxRow; r++) {
          const target = { ...updated[r] };
          for(let c = minCol; c <= maxCol; c++) target[columns[c].key] = '';
          updated[r] = target;
      }
      recordHistory(updated);
  };

  const handleCellMouseDown = (e, rowIdx, colIdx) => {
      if (e.button !== 0) return; 
      
      const colKey = columns[colIdx].key;
      const col = columns[colIdx];
      
      if (e.shiftKey) {
          setSelectionRange(p => ({ ...p, endRow: rowIdx, endCol: colIdx }));
          scrollToCell(rowIdx, colIdx);
      } else {
          setIsDragging(true);
          updateSelection(rowIdx, colIdx);
          
          // Google Sheets Behavior: Clicking a cell with options opens the menu immediately
          if (col.options) {
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
    setActiveTab('all'); 
    const newRows = Array(10).fill(null).map((_, i) => ({
      id: generateTempId(Date.now() + i), coordinator_name: '', semester: '', course_name: '', course_code: '',
      is_conducted: '', course_type: '', exam_mode: '', exam_weightage: '', duration: '', remark: '', is_reexam: false
    }));
    recordHistory([...rows, ...newRows]);
    setTimeout(() => {
      if (gridContainerRef.current) gridContainerRef.current.scrollTop = gridContainerRef.current.scrollHeight;
    }, 100);
  };

  const handleDeleteSelected = () => {
    if (selectedRowIndices.size === 0) return;
    const updated = rows.filter((_, idx) => !selectedRowIndices.has(idx));
    if(updated.length === 0) {
        updated.push({
            id: generateTempId(), coordinator_name: '', semester: '', course_name: '', course_code: '',
            is_conducted: '', course_type: '', exam_mode: '', exam_weightage: '', duration: '', remark: '', is_reexam: false
        });
    }
    recordHistory(updated);
    setSelectedRowIndices(new Set());
    setEditingCell(null);
    setDropdownCell(null);
  };

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json(ws, { defval: '', raw: false });
        if (data.length === 0) { alert('Uploaded spreadsheet appears empty.'); return; }

        const importedRows = data.map((row, idx) => {
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
            id: generateTempId(idx),
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

        const validImportedRows = importedRows.filter(isRowNotEmpty);
        const emptyIdx = rows.findIndex(r => !isRowNotEmpty(r));
        let newRows = [...rows];
        
        if (emptyIdx !== -1) newRows.splice(emptyIdx, validImportedRows.length, ...validImportedRows);
        else newRows = [...rows, ...validImportedRows];

        if (newRows.length < 25) {
            const padding = Array(25 - newRows.length).fill(null).map((_, i) => ({
                id: generateTempId(i + 2000), coordinator_name: '', semester: '', course_name: '', course_code: '',
                is_conducted: '', course_type: '', exam_mode: '', exam_weightage: '', duration: '', remark: '', is_reexam: false
            }));
            newRows = [...newRows, ...padding];
        }

        recordHistory(newRows);
        alert(`Successfully imported ${validImportedRows.length} active rows!`);
      } catch (err) { alert('Could not read Excel file.'); }
    };
    reader.readAsBinaryString(file);
    e.target.value = '';
  };

  const filteredRows = useMemo(() => {
    return rows.map((r, originalIdx) => ({ ...r, originalIdx })).filter(r => {
      const hasData = isRowNotEmpty(r);
      if (activeTab === 'conducted' && (r.is_conducted !== 'Yes' || !hasData)) return false;
      if (activeTab === 'exempted' && (r.is_conducted !== 'No' || !hasData)) return false;
      if (activeTab === 'reexams' && (!r.is_reexam || !hasData)) return false;
      return true;
    });
  }, [rows, activeTab]);

  return (
    <div className="flex flex-col h-screen w-full bg-white dark:bg-[#111111] font-sans overflow-hidden absolute inset-0 z-50">
      
      {/* Native HTML5 Datalists for Text Auto-complete columns */}
      <datalist id="courseNamesList">{catalogCourses.map(c => <option key={c.id} value={c.course_title} />)}</datalist>
      <datalist id="courseCodesList">{catalogCourses.map(c => <option key={c.id} value={c.course_code} />)}</datalist>
      <datalist id="teachersList">{catalogTeachers.map(t => <option key={t.id} value={t.full_name} />)}</datalist>
      
      {/* Top Application Bar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-slate-200 dark:border-white/10 bg-white dark:bg-[#111111] shrink-0">
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
            <div className="flex items-center gap-1 text-[13px] text-slate-600 dark:text-slate-400 mt-0.5">
              <button type="button" onClick={() => setShowInstructions(true)} className="hover:bg-slate-100 dark:hover:bg-white/5 px-2 py-0.5 rounded cursor-pointer font-medium">Help</button>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 text-xs text-slate-500 dark:text-slate-400">
             {syncing ? (
                <><RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-500" /> <span className="text-blue-600 dark:text-blue-400 font-medium">Saving...</span></>
             ) : saveStatus === 'error' ? (
                <><AlertCircle className="w-3.5 h-3.5 text-red-500" /> <span className="text-red-600 dark:text-red-400 font-medium">{statusMessage || 'Failed to save'}</span></>
             ) : saveStatus === 'unsaved' ? (
                <span className="text-amber-500 font-medium">Unsaved changes</span>
             ) : saveStatus === 'saved' ? (
                <><CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> <span className="text-emerald-600 dark:text-emerald-400 font-medium">Saved to Cloud</span></>
             ) : null}
          </div>
          
          <button type="button" onClick={() => fileInputRef.current?.click()} className="p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10 rounded-full transition-colors" title="Import Excel File"><Upload className="w-5 h-5" /></button>
          
          <button 
            type="button" 
            onClick={handleSyncToBackend}
            disabled={syncing || (!hasUnsavedChanges && saveStatus !== 'error')}
            className={`flex items-center gap-2 px-4 py-2 rounded-full font-medium text-sm transition-colors ${
                (hasUnsavedChanges || saveStatus === 'error')
                  ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-sm cursor-pointer' 
                  : 'bg-slate-100 text-slate-400 dark:bg-white/5 dark:text-slate-600 cursor-default'
            }`}
          >
            {syncing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save Data
          </button>
          
           <div className="w-8 h-8 rounded-full bg-purple-600 text-white flex items-center justify-center font-bold text-sm overflow-hidden border-2 border-white shadow-sm ml-2 cursor-pointer">
            {user?.name ? user.name.charAt(0).toUpperCase() : 'U'}
          </div>
        </div>
      </div>

      {/* Formatting Ribbon */}
      <div className="flex items-center gap-1 px-3 py-1.5 border-b border-slate-200 dark:border-white/10 bg-[#edf2fa] dark:bg-[#1a1a1a] text-slate-600 dark:text-slate-300 overflow-x-auto shrink-0">
        <div className="flex items-center gap-1 pr-2 border-r border-slate-300 dark:border-white/20 shrink-0">
            <button type="button" onClick={handleUndo} disabled={history.length <= 1} className="p-1.5 hover:bg-slate-200 dark:hover:bg-white/10 rounded disabled:opacity-30" title="Undo (Ctrl+Z)"><Undo2 className="w-4 h-4" /></button>
            <button type="button" onClick={handleRedo} disabled={future.length === 0} className="p-1.5 hover:bg-slate-200 dark:hover:bg-white/10 rounded disabled:opacity-30" title="Redo (Ctrl+Y)"><Redo2 className="w-4 h-4" /></button>
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
            {selectedRowIndices.size > 0 && (
                 <button type="button" onClick={handleDeleteSelected} className="flex items-center gap-1 px-2 py-1 text-xs text-red-700 bg-red-50 hover:bg-red-100 rounded border border-red-200 cursor-pointer"><Trash2 className="w-3 h-3" /> Delete Selected</button>
            )}
        </div>
      </div>

      {/* Main Excel Spreadsheet Grid Container */}
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
                    checked={rows.length > 0 && selectedRowIndices.size === rows.length}
                    onChange={(e) => {
                      if (e.target.checked) setSelectedRowIndices(new Set(rows.map((_, idx) => idx)));
                      else setSelectedRowIndices(new Set());
                    }}
                    className="rounded-sm w-3 h-3 cursor-pointer"
                  />
                </th>
                {columns.map(col => (
                  <th key={col.key} className={`${col.width} h-6 text-center border-r border-b border-[#c0c0c0] dark:border-white/20 text-[11px] font-normal text-slate-600 dark:text-slate-300 bg-[#f8f9fa] dark:bg-[#222]`}>
                    {col.letter}
                  </th>
                ))}
              </tr>
              
              <tr className="bg-white dark:bg-[#111]">
                  <th className="w-12 h-8 text-center border-r border-b border-[#e2e3e3] dark:border-white/10 font-medium text-[11px] text-slate-500 bg-[#f8f9fa] dark:bg-[#222] sticky left-0 z-30">1</th>
                   {columns.map(col => (
                    <th key={col.key} className={`${col.width} px-2 h-8 border-r border-b border-[#e2e3e3] dark:border-white/10 font-bold text-slate-700 dark:text-slate-200 text-xs bg-slate-50 dark:bg-[#1a1a1a] shadow-[inset_0_-1px_0_0_#000] dark:shadow-[inset_0_-1px_0_0_#555]`}>
                        {col.title}
                    </th>
                   ))}
              </tr>
            </thead>

            <tbody className="font-sans">
              {filteredRows.map((row) => {
                  const rowIdx = row.originalIdx;
                  const displayRowNumber = rowIdx + 2; 
                  const isRowSelected = selectedRowIndices.has(rowIdx);

                  return (
                    <tr key={row.id || `fallback-${rowIdx}`} className={isRowSelected ? 'bg-blue-50/50 dark:bg-blue-900/20' : 'bg-white dark:bg-[#111]'}>
                      <td className="w-12 h-6 text-center border-r border-b border-[#e2e3e3] dark:border-white/10 text-[11px] text-slate-500 bg-[#f8f9fa] dark:bg-[#222] sticky left-0 z-20 select-none group">
                        <div className="flex items-center justify-center gap-1">
                            <input type="checkbox" checked={isRowSelected} onChange={() => {
                                setSelectedRowIndices(prev => { const next = new Set(prev); if (next.has(rowIdx)) next.delete(rowIdx); else next.add(rowIdx); return next; });
                            }} className="rounded-sm w-3 h-3 cursor-pointer opacity-0 group-hover:opacity-100 absolute left-1" />
                            <span className="group-hover:opacity-0">{displayRowNumber}</span>
                        </div>
                      </td>

                      {columns.map((col, colIdx) => {
                        const colKey = col.key;
                        const cellValue = row[colKey] ?? '';

                        const isInSelectionRange = selectionRange 
                            ? (rowIdx >= Math.min(selectionRange.startRow, selectionRange.endRow) && 
                               rowIdx <= Math.max(selectionRange.startRow, selectionRange.endRow) &&
                               colIdx >= Math.min(selectionRange.startCol, selectionRange.endCol) &&
                               colIdx <= Math.max(selectionRange.startCol, selectionRange.endCol))
                            : false;
                        
                        const isActiveCursor = selectedCell.rowIdx === rowIdx && selectedCell.colKey === colKey;
                        
                        // State for Text Inputs vs Dropdowns
                        const isTextEditing = editingCell?.rowIdx === rowIdx && editingCell?.colKey === colKey && !col.options;
                        const isDropdownOpen = dropdownCell?.rowIdx === rowIdx && dropdownCell?.colKey === colKey && col.options;

                        const cellStyling = isTextEditing || isDropdownOpen ? 'z-50 overflow-visible bg-white dark:bg-[#222]' 
                            : isActiveCursor ? 'ring-[2px] ring-[#1a73e8] ring-inset z-10 bg-blue-50/20 dark:bg-blue-900/40 outline-none'
                            : isInSelectionRange ? 'bg-blue-100/60 dark:bg-blue-800/40 outline outline-1 outline-blue-300 dark:outline-blue-600'
                            : '';

                        return (
                          <td
                            key={colKey}
                            data-row={rowIdx}
                            data-col={colIdx}
                            ref={isDropdownOpen ? activeCellRef : null}
                            onMouseDown={(e) => handleCellMouseDown(e, rowIdx, colIdx)}
                            onMouseEnter={() => handleCellMouseEnter(rowIdx, colIdx)}
                            onDoubleClick={() => {
                                if (!col.options) setEditingCell({ rowIdx, colKey });
                                // If it has options, mousedown already opened it
                            }}
                            className={`px-2 h-6 border-r border-b border-[#e2e3e3] dark:border-white/10 text-[13px] text-slate-800 dark:text-slate-200 relative whitespace-nowrap cursor-cell ${(!isTextEditing && !isDropdownOpen) ? 'overflow-hidden' : ''} ${cellStyling}`}
                          >
                            {/* Option 1: Native Input for text/datalist columns */}
                            {isTextEditing ? (
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
                                /* Option 2: Rendered Cell Content (Regular or Google Sheets Pill Style) */
                                <div className={`flex items-center w-full h-full pointer-events-none ${!cellValue && isActiveCursor ? 'text-slate-400' : ''}`}>
                                  {col.options && cellValue ? (
                                     <span className={`px-2 py-0.5 rounded-full text-xs font-medium inline-block truncate max-w-full ${getPillColor(cellValue, colKey)}`}>
                                        {cellValue}
                                     </span>
                                  ) : (
                                     <span className="block truncate max-w-full">{cellValue}</span>
                                  )}
                                </div>
                            )}

                            {/* Dropdown Menu Portal */}
                            {isDropdownOpen && (
                                <SheetsDropdown
                                   value={cellValue}
                                   options={col.options}
                                   triggerRef={activeCellRef}
                                   colKey={colKey}
                                   onChange={(val) => {
                                      handleCellChange(rowIdx, colKey, val); 
                                      setDropdownCell(null); 
                                      gridContainerRef.current?.focus(); 
                                      // Auto advance to next column
                                      if (colIdx < columns.length - 1) updateSelection(rowIdx, colIdx + 1);
                                   }}
                                   onClose={() => {
                                       setDropdownCell(null);
                                       gridContainerRef.current?.focus(); 
                                   }}
                                />
                            )}

                            {/* Active Cell Blue Square */}
                            {isActiveCursor && !isTextEditing && !isDropdownOpen && (
                              <div className="absolute -bottom-[2px] -right-[2px] w-1.5 h-1.5 bg-[#1a73e8] border border-white z-20 cursor-crosshair pointer-events-none" />
                            )}
                            
                            {/* Dropdown indicator arrow (only visible when hovering or active) */}
                            {col.options && (isActiveCursor || isInSelectionRange) && !isDropdownOpen && (
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
          
          <div className="p-4 pt-2">
             <button type="button" onClick={handleAddRow} className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 text-slate-600 dark:text-slate-300 text-xs font-medium transition-colors border border-slate-200 dark:border-white/10">
                <Plus className="w-3.5 h-3.5" /> Add 10 more rows
              </button>
          </div>
        </div>

        {/* Bottom Sheet Tabs Bar */}
        <div className="bg-[#f8f9fa] dark:bg-[#1a1a1a] border-t border-[#c0c0c0] dark:border-white/20 h-10 flex items-center px-4 justify-between text-xs select-none shrink-0 z-30">
          <div className="flex items-center gap-1 h-full">
            <button type="button" onClick={handleAddRow} className="p-1 text-slate-500 hover:bg-slate-200 dark:hover:bg-white/10 rounded mr-2" title="Add Rows"><Plus className="w-4 h-4" /></button>
            <button type="button" className="p-1 text-slate-500 hover:bg-slate-200 dark:hover:bg-white/10 rounded mr-2"><Menu className="w-4 h-4" /></button>
            
            <button type="button" onClick={() => setActiveTab('all')} className={`px-4 h-full flex items-center font-medium border-b-2 transition-colors ${activeTab === 'all' ? 'border-[#0f9d58] text-[#0f9d58] dark:text-emerald-400 bg-white dark:bg-[#111]' : 'border-transparent text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-white/5'}`}>All Requirements</button>
            <button type="button" onClick={() => setActiveTab('conducted')} className={`px-4 h-full flex items-center font-medium border-b-2 transition-colors ${activeTab === 'conducted' ? 'border-[#0f9d58] text-[#0f9d58] dark:text-emerald-400 bg-white dark:bg-[#111]' : 'border-transparent text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-white/5'}`}>Conducted</button>
            <button type="button" onClick={() => setActiveTab('reexams')} className={`px-4 h-full flex items-center font-medium border-b-2 transition-colors ${activeTab === 'reexams' ? 'border-[#0f9d58] text-[#0f9d58] dark:text-emerald-400 bg-white dark:bg-[#111]' : 'border-transparent text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-white/5'}`}>Re-Exams</button>
          </div>
        </div>
      </div>

      {/* Floating Instructions Modal */}
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
                          <li><strong>Manual Saving:</strong> Auto-save is disabled. Use the Save Data button manually.</li>
                      </ul>
                  </div>
                  
                  <button type="button" onClick={closeInstructions} className="w-full mt-6 py-2.5 bg-[#0f9d58] hover:bg-[#0b8043] text-white font-bold rounded-xl transition-colors">
                      Got it, let's go!
                  </button>
              </div>
          </div>
      )}

      {/* Hidden file input for import */}
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