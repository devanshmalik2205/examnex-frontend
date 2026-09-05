import React, { useState, useEffect, useRef } from 'react';
import { 
    Plus, Edit2, Trash2, BookOpen, X, Loader2, Search, 
    FileSpreadsheet, UploadCloud, AlertTriangle, CheckCircle, Users, Download, ChevronDown
} from 'lucide-react';
import * as XLSX from 'xlsx';

export default function AdminTeachers() {
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Modals state
  const [isTeacherModalOpen, setTeacherModalOpen] = useState(false);
  const [isAllocationModalOpen, setAllocationModalOpen] = useState(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  
  // Forms state
  const [currentTeacher, setCurrentTeacher] = useState({ full_name: '', email: '', teacher_type: 'Assistant Prof.' });
  const [selectedTeacherId, setSelectedTeacherId] = useState(null);
  
  // Allocation state
  const [allocationOptions, setAllocationOptions] = useState({ courses: [], sections: [] });
  const [currentAllocations, setCurrentAllocations] = useState([]);
  const [savingAllocations, setSavingAllocations] = useState(false);

  // Upload state
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const [previewData, setPreviewData] = useState(null);
  const [isCommiting, setIsCommiting] = useState(false);
  const fileInputRef = useRef(null);
  
  // Download state
  const [showDownload, setShowDownload] = useState(false);
  
  const getApiBase = () => {
    const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';
    return `${backendUrl}/api`;
  };

  useEffect(() => {
    fetchTeachers();
    fetchAllocationOptions();
  }, []);

    const fetchTeachers = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${getApiBase()}/admin/teachers`);
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setTeachers(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Failed to fetch teachers", error);
      setTeachers([]); 
    } finally {
      setLoading(false);
    }
  };

  const fetchAllocationOptions = async () => {
    try {
      const res = await fetch(`${getApiBase()}/admin/teachers/data/options`);
      const data = await res.json();
      setAllocationOptions(data);
    } catch (error) {
      console.error("Failed to fetch allocation options", error);
    }
  };

  const handleSaveTeacher = async (e) => {
    e.preventDefault();
    try {
      const method = currentTeacher.id ? 'PUT' : 'POST';
      const url = currentTeacher.id 
        ? `${getApiBase()}/admin/teachers/${currentTeacher.id}` 
        : `${getApiBase()}/admin/teachers`;

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(currentTeacher)
      });
      
      if (res.ok) {
        fetchTeachers();
        setTeacherModalOpen(false);
      } else {
        const errorData = await res.json();
        alert(errorData.error || 'Failed to save teacher');
      }
    } catch (error) {
      console.error("Error saving teacher", error);
      alert('An error occurred while saving.');
    }
  };

  const handleDeleteTeacher = async (id) => {
    if (!window.confirm("Are you sure you want to delete this teacher? This will also remove their subject allocations.")) return;
    try {
      const res = await fetch(`${getApiBase()}/admin/teachers/${id}`, { method: 'DELETE' });
      if(res.ok) {
        fetchTeachers();
      } else {
        alert('Failed to delete teacher.');
      }
    } catch (error) {
      console.error("Error deleting teacher", error);
    }
  };

  const openAllocationModal = async (teacher) => {
    setSelectedTeacherId(teacher.id);
    setCurrentTeacher(teacher);
    try {
      const res = await fetch(`${getApiBase()}/admin/teachers/${teacher.id}/allocations`);
      const data = await res.json();
      setCurrentAllocations(Array.isArray(data) ? data : []);
      setAllocationModalOpen(true);
    } catch (error) {
      console.error("Failed to fetch current allocations", error);
      alert('Failed to load allocations');
    }
  };

  const handleSaveAllocations = async () => {
    try {
      setSavingAllocations(true);
      const res = await fetch(`${getApiBase()}/admin/teachers/${selectedTeacherId}/allocations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ allocations: currentAllocations })
      });
      if (res.ok) {
        setAllocationModalOpen(false);
        fetchTeachers(); // Refresh allocations on main table
      } else {
        alert('Failed to save allocations.');
      }
    } catch (error) {
      console.error("Error saving allocations", error);
      alert('An error occurred saving allocations.');
    } finally {
      setSavingAllocations(false);
    }
  };

  const addAllocationRow = () => {
    if (allocationOptions.courses.length > 0 && allocationOptions.sections.length > 0) {
      setCurrentAllocations([
        ...currentAllocations, 
        { course_id: allocationOptions.courses[0].id, timetable_id: allocationOptions.sections[0].id }
      ]);
    } else {
      alert('Cannot add allocation: Please ensure courses and timetables are created first.');
    }
  };

  const removeAllocationRow = (index) => {
    const newAllocations = [...currentAllocations];
    newAllocations.splice(index, 1);
    setCurrentAllocations(newAllocations);
  };

  const updateAllocation = (index, field, value) => {
    const newAllocations = [...currentAllocations];
    newAllocations[index][field] = value;
    setCurrentAllocations(newAllocations);
  };

  const handleFileSelection = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploadError(null);
    setIsUploading(true);

    const formData = new FormData();
    formData.append('file', file);

    try {
        const res = await fetch(`${getApiBase()}/admin/teachers/upload-preview`, {
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

  const commitTeacherUpload = async () => {
      if (!previewData || !previewData.preview) return;
      setIsCommiting(true);
      setUploadError(null);

      try {
          const res = await fetch(`${getApiBase()}/admin/teachers/commit-upload`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(previewData.preview)
          });

          if (!res.ok) {
              const errData = await res.json();
              throw new Error(errData.error || 'Failed to commit modifications.');
          }
          
          setIsUploadModalOpen(false);
          setPreviewData(null);
          if (fileInputRef.current) fileInputRef.current.value = "";
          
          fetchTeachers();
      } catch (err) {
          setUploadError(err.message);
      } finally {
          setIsCommiting(false);
      }
  };

  const filteredTeachers = teachers.filter(t => 
    t.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    t.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Group allocations for visually pleasing unified UI
  const renderAllocations = (allocations) => {
    if (!allocations || allocations.length === 0) return <span className="text-slate-400 text-xs italic">No allocations yet</span>;
    
    const grouped = {};
    allocations.forEach(a => {
        const title = a.course_title || a.course_code;
        if (!grouped[title]) grouped[title] = new Set();
        grouped[title].add(`${a.stream} (Sem ${a.semester})`);
    });

    return (
        <div className="flex flex-col gap-2 max-h-32 overflow-y-auto custom-scrollbar pr-2 w-full max-w-[400px]">
            {Object.entries(grouped).map(([title, sections], i) => (
                <div key={i} className="text-xs bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/5 rounded-lg p-2">
                    <span className="font-semibold text-slate-700 dark:text-slate-200 block mb-1">{title}</span>
                    <div className="flex flex-wrap gap-1.5">
                        {Array.from(sections).map((sec, j) => (
                            <span key={j} className="px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800/50 rounded-md text-[10px] font-medium shadow-sm">
                                {sec}
                            </span>
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
  };

  const handleDownload = (format) => {
    if (!filteredTeachers || filteredTeachers.length === 0) {
      alert("No data to download");
      return;
    }

    const exportData = filteredTeachers.map(t => {
      const allocs = (t.allocations || []).map(a => `${a.course_code} (${a.stream} Sem ${a.semester})`).join(' | ');
      return {
        "Full Name": t.full_name,
        "Email": t.email,
        "Role/Type": t.teacher_type,
        "Allocations": allocs || "None"
      };
    });

    const fileName = `Teachers_Export_${new Date().toISOString().split('T')[0]}`;

    if (format === 'json') {
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url; link.download = `${fileName}.json`; link.click();
      URL.revokeObjectURL(url);
    } else {
      const worksheet = XLSX.utils.json_to_sheet(exportData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Teachers");
      XLSX.writeFile(workbook, `${fileName}.${format}`);
    }
  };

  return (
    <div className="p-4 sm:p-6 w-full max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Teachers Management</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Manage faculty, update profiles, and view allocations.</p>
        </div>
        
        <div className="flex flex-col sm:flex-row w-full lg:w-auto items-center gap-3">
          
          {/* Collapsible Download Button */}
          <div 
            className="relative w-full sm:w-auto" 
            tabIndex={-1}
            onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setShowDownload(false); }}
          >
            <button 
              onClick={() => setShowDownload(!showDownload)}
              className="w-full sm:w-auto flex items-center justify-center px-4 py-2.5 rounded-xl text-sm font-medium transition-all shadow-sm border bg-white dark:bg-[#1a1a1a] border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5"
            >
              <Download className="w-4 h-4 mr-2" />
              Export
              <ChevronDown className={`w-4 h-4 ml-2 transition-transform ${showDownload ? 'rotate-180' : ''}`} />
            </button>

            {showDownload && (
              <div className="absolute right-0 mt-2 w-full sm:w-40 bg-white dark:bg-[#1a1a1a] border border-slate-200 dark:border-white/10 rounded-xl shadow-xl z-[60] overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                <button onClick={() => { handleDownload('csv'); setShowDownload(false); }} className="block w-full text-left px-4 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">Download CSV</button>
                <div className="h-px w-full bg-slate-100 dark:bg-white/5"></div>
                <button onClick={() => { handleDownload('json'); setShowDownload(false); }} className="block w-full text-left px-4 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">Download JSON</button>
                <div className="h-px w-full bg-slate-100 dark:bg-white/5"></div>
                <button onClick={() => { handleDownload('xlsx'); setShowDownload(false); }} className="block w-full text-left px-4 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">Download XLSX</button>
              </div>
            )}
          </div>

          <button 
            onClick={() => setIsUploadModalOpen(true)}
            className="w-full sm:w-auto flex-1 sm:flex-none bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors flex items-center justify-center shadow-sm"
          >
            <FileSpreadsheet className="w-4 h-4 mr-2" /> Bulk Upload
          </button>
          <button 
            onClick={() => { setCurrentTeacher({ full_name: '', email: '', teacher_type: 'Assistant Prof.' }); setTeacherModalOpen(true); }}
            className="w-full sm:w-auto flex-1 sm:flex-none flex items-center justify-center px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4 mr-2" /> Add Teacher
          </button>
        </div>
      </div>

      <div className="flex items-center bg-white dark:bg-[#111111] p-2 rounded-xl border border-slate-200 dark:border-white/5 shadow-sm">
        <Search className="w-5 h-5 text-slate-400 ml-2" />
        <input 
          type="text" 
          placeholder="Search teachers by name or email..." 
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="flex-1 bg-transparent border-none outline-none px-4 py-2 text-slate-700 dark:text-white"
        />
      </div>

      <div className="bg-white dark:bg-[#111111] rounded-xl border border-slate-200 dark:border-white/5 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-white/5 text-sm font-medium text-slate-500 dark:text-slate-400">
                <th className="p-4">Name</th>
                <th className="p-4">Email</th>
                <th className="p-4">Role/Type</th>
                <th className="p-4">Allocated Subjects & Classes</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-white/5">
              {loading ? (
                <tr>
                  <td colSpan="5" className="p-8 text-center text-slate-500"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></td>
                </tr>
              ) : filteredTeachers.length === 0 ? (
                <tr>
                  <td colSpan="5" className="p-8 text-center text-slate-500">No teachers found.</td>
                </tr>
              ) : (
                filteredTeachers.map(teacher => (
                  <tr key={teacher.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/30 transition-colors">
                    <td className="p-4 font-medium text-slate-900 dark:text-white flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 flex items-center justify-center font-bold text-sm shrink-0">
                        {teacher.full_name?.charAt(0) || '?'}
                      </div>
                      <span className="truncate max-w-[150px]">{teacher.full_name}</span>
                    </td>
                    <td className="p-4 text-slate-600 dark:text-slate-300">{teacher.email}</td>
                    <td className="p-4">
                      <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 capitalize">
                        {teacher.teacher_type}
                      </span>
                    </td>
                    <td className="p-4 align-top">
                        {renderAllocations(teacher.allocations)}
                    </td>
                    <td className="p-4 text-right space-x-2 flex justify-end items-start h-full pt-6">
                      <button 
                        onClick={() => openAllocationModal(teacher)}
                        className="p-2 text-indigo-600 hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-indigo-900/30 rounded-lg transition-colors"
                        title="Allocate Subjects"
                      >
                        <BookOpen className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => { setCurrentTeacher(teacher); setTeacherModalOpen(true); }}
                        className="p-2 text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/30 rounded-lg transition-colors"
                        title="Edit Profile"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => handleDeleteTeacher(teacher.id)}
                        className="p-2 text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                        title="Delete Teacher"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isTeacherModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-[#1a1a1a] rounded-2xl w-full max-w-md shadow-2xl overflow-hidden border border-slate-200 dark:border-white/10">
            <div className="flex justify-between items-center p-5 border-b border-slate-200 dark:border-white/5">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                {currentTeacher.id ? 'Edit Teacher' : 'Add New Teacher'}
              </h3>
              <button onClick={() => setTeacherModalOpen(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-white"><X className="w-5 h-5"/></button>
            </div>
            <form onSubmit={handleSaveTeacher} className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Full Name</label>
                <input 
                  required type="text" value={currentTeacher.full_name || ''} 
                  onChange={e => setCurrentTeacher({...currentTeacher, full_name: e.target.value})}
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-black/50 border border-slate-200 dark:border-white/10 rounded-lg focus:ring-2 focus:ring-blue-500 dark:text-white outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Email</label>
                <input 
                  type="email" value={currentTeacher.email || ''} 
                  onChange={e => setCurrentTeacher({...currentTeacher, email: e.target.value})}
                  placeholder="Will be auto-generated if left blank"
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-black/50 border border-slate-200 dark:border-white/10 rounded-lg focus:ring-2 focus:ring-blue-500 dark:text-white outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Role / Type</label>
                <select 
                  value={currentTeacher.teacher_type || 'Assistant Prof.'} 
                  onChange={e => setCurrentTeacher({...currentTeacher, teacher_type: e.target.value})}
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-black/50 border border-slate-200 dark:border-white/10 rounded-lg focus:ring-2 focus:ring-blue-500 dark:text-white outline-none"
                >
                  <option value="Assistant Prof.">Assistant Prof.</option>
                  <option value="Associate Prof.">Associate Prof.</option>
                  <option value="Prof.">Prof.</option>
                  <option value="Lab Prof.">Lab Prof.</option>
                  <option value="Researchers">Researchers</option>
                  <option value="Faculty">Faculty</option>
                  <option value="PhD Scholar">PhD Scholar</option>
                </select>
              </div>
              <div className="pt-4 flex justify-end gap-3">
                <button type="button" onClick={() => setTeacherModalOpen(false)} className="px-4 py-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-sm">Save Teacher</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isAllocationModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-[#1a1a1a] rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden border border-slate-200 dark:border-white/10 flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center p-5 border-b border-slate-200 dark:border-white/5">
              <div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Subject Allocations</h3>
                <p className="text-sm text-slate-500 mt-1">Assigning courses for <span className="font-medium text-slate-800 dark:text-slate-200">{currentTeacher.full_name}</span></p>
              </div>
              <button onClick={() => setAllocationModalOpen(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-white"><X className="w-5 h-5"/></button>
            </div>
            
            <div className="p-5 overflow-y-auto flex-1 bg-slate-50/50 dark:bg-black/20 custom-scrollbar">
              {currentAllocations.length === 0 ? (
                <div className="text-center py-10">
                  <BookOpen className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
                  <p className="text-slate-500 dark:text-slate-400">No subjects allocated to this teacher yet.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {currentAllocations.map((alloc, idx) => (
                    <div key={idx} className="flex flex-col sm:flex-row gap-3 items-center p-3 bg-white dark:bg-[#111111] border border-slate-200 dark:border-white/5 rounded-xl shadow-sm">
                      <select 
                        value={alloc.course_id || ''} 
                        onChange={(e) => updateAllocation(idx, 'course_id', e.target.value)}
                        className="flex-1 w-full px-3 py-2 bg-slate-50 dark:bg-black/50 border border-slate-200 dark:border-white/10 rounded-lg text-sm dark:text-white outline-none"
                      >
                        {allocationOptions.courses.map(c => <option key={c.id} value={c.id}>{c.course_title} ({c.course_code})</option>)}
                      </select>
                      
                      <span className="text-slate-400 hidden sm:block">in</span>
                      
                      <select 
                        value={alloc.timetable_id || ''} 
                        onChange={(e) => updateAllocation(idx, 'timetable_id', e.target.value)}
                        className="flex-1 w-full px-3 py-2 bg-slate-50 dark:bg-black/50 border border-slate-200 dark:border-white/10 rounded-lg text-sm dark:text-white outline-none"
                      >
                        {allocationOptions.sections.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>
                      
                      <button onClick={() => removeAllocationRow(idx)} className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg flex-shrink-0">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              
              <button 
                onClick={addAllocationRow}
                className="mt-4 flex items-center justify-center w-full py-2.5 border-2 border-dashed border-slate-300 dark:border-white/20 text-slate-500 dark:text-slate-400 hover:border-blue-500 hover:text-blue-500 dark:hover:border-blue-500 dark:hover:text-blue-400 rounded-xl transition-colors"
              >
                <Plus className="w-4 h-4 mr-2" /> Add New Allocation
              </button>
            </div>

            <div className="p-5 border-t border-slate-200 dark:border-white/5 flex justify-end gap-3 bg-white dark:bg-[#1a1a1a]">
              <button 
                onClick={() => setAllocationModalOpen(false)} 
                disabled={savingAllocations}
                className="px-4 py-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg disabled:opacity-50"
              >
                Cancel
              </button>
              <button 
                onClick={handleSaveAllocations} 
                disabled={savingAllocations}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg shadow-sm flex items-center disabled:opacity-75"
              >
                {savingAllocations ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                Save Allocations
              </button>
            </div>
          </div>
        </div>
      )}

      {isUploadModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm transition-opacity animate-in fade-in">
          <div className="bg-white dark:bg-[#1a1a1a] rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden border border-slate-200 dark:border-white/10 shadow-2xl flex flex-col">
              <div className="flex justify-between items-center p-5 border-b border-slate-200 dark:border-white/5">
                  <div>
                      <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center">
                          <FileSpreadsheet className="w-5 h-5 mr-2 text-emerald-500" /> Excel Teachers Upload
                      </h3>
                      <p className="text-sm text-slate-500 mt-1">Upload a `.xlsx` or `.csv` file to add or update faculty members in bulk.</p>
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
                                      <p className="text-xs text-slate-500 mt-2 text-center px-4">Standard Columns expected: Name/FacultyName, Email, Role/Type</p>
                                  </>
                              )}
                          </label>
                      </div>
                  ) : (
                      <div className="space-y-6">
                          {previewData.overwrites?.total_updates > 0 && (
                              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50 rounded-xl p-4 flex items-start shadow-sm">
                                  <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 mr-3 mt-0.5 flex-shrink-0" />
                                  <div>
                                      <h4 className="text-sm font-bold text-amber-900 dark:text-amber-200">Existing Records Found</h4>
                                      <p className="text-sm text-amber-700 dark:text-amber-400 mt-1">
                                        Found <strong>{previewData.overwrites.total_updates} existing teachers</strong> based on name or email. Their profiles will be updated seamlessly without losing existing class allocations.
                                        {previewData.overwrites.email_updates > 0 && (
                                            <span className="block mt-1.5 text-amber-800 dark:text-amber-300">
                                                Includes <strong>{previewData.overwrites.email_updates} email address updates</strong>.
                                            </span>
                                        )}
                                      </p>
                                  </div>
                              </div>
                          )}

                          <div className="bg-white dark:bg-[#111] border border-slate-200 dark:border-white/10 rounded-xl p-4 shadow-sm">
                              <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center mb-3">
                                  <Users className="w-4 h-4 mr-2 text-indigo-500" /> Parsed Faculty ({previewData.preview.teachers?.length || 0})
                              </h4>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-72 overflow-y-auto custom-scrollbar pr-2">
                                  {(previewData.preview.teachers || []).map((t, i) => (
                                      <div key={i} className={`text-sm p-3 rounded-lg border flex justify-between items-start ${t.is_update ? 'bg-amber-50/50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-800/50' : 'bg-slate-50 dark:bg-white/5 border-slate-100 dark:border-white/5'}`}>
                                          <div className="overflow-hidden mr-2">
                                              <p className="font-semibold text-slate-800 dark:text-slate-200 truncate">{t.full_name}</p>
                                              <p className="text-xs text-slate-500 truncate">{t.email}</p>
                                              <p className="text-[10px] font-bold uppercase text-slate-400 mt-1.5">{t.teacher_type}</p>
                                          </div>
                                          <div className="flex flex-col items-end gap-1 shrink-0 ml-4 text-right">
                                            {t.is_update ? (
                                                <>
                                                    <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/30 px-1.5 rounded uppercase tracking-wider">Update</span>
                                                    {t.update_details && t.update_details.length > 0 && (
                                                        <div className="flex flex-col items-end mt-1">
                                                            {t.update_details.map((detail, dIdx) => (
                                                                <span key={dIdx} className="text-[9.5px] font-medium text-amber-700 dark:text-amber-500 bg-amber-50 dark:bg-amber-900/10 px-1.5 py-0.5 rounded-sm mt-0.5 whitespace-nowrap border border-amber-100 dark:border-amber-800/30">
                                                                    {detail}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    )}
                                                </>
                                            ) : (
                                                <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/30 px-1.5 rounded uppercase tracking-wider">New</span>
                                            )}
                                          </div>
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
                      onClick={commitTeacherUpload} 
                      disabled={!previewData || isCommiting}
                      className={`px-5 py-2.5 rounded-xl font-medium flex items-center shadow-sm transition-all ${!previewData || isCommiting ? 'bg-slate-300 dark:bg-slate-700 text-slate-500 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 text-white'}`}
                  >
                      {isCommiting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle className="w-4 h-4 mr-2" />}
                      Import Faculty List
                  </button>
              </div>
          </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{__html: `
        .custom-scrollbar::-webkit-scrollbar { height: 6px; width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; }
        .dark .custom-scrollbar::-webkit-scrollbar-thumb { background: #333; }
      `}} />
    </div>
  );
}