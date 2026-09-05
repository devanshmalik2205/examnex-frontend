import React, { useState, useEffect } from 'react';
import { 
  Search, 
  Plus, 
  Edit2, 
  Trash2, 
  X, 
  Loader2, 
  AlertTriangle,
  GraduationCap,
  Filter,
  Download,
  ChevronDown
} from 'lucide-react';
import * as XLSX from 'xlsx';

export default function AdminStudents() {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Filter State
  const [selectedStreams, setSelectedStreams] = useState([]);
  const [selectedYears, setSelectedYears] = useState([]);
  const [showFilters, setShowFilters] = useState(false);
  const filterRef = React.useRef(null);
  
  // Download State
  const [showDownload, setShowDownload] = useState(false);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (filterRef.current && !filterRef.current.contains(event.target)) {
        setShowFilters(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [studentToDelete, setStudentToDelete] = useState(null);
  const [formLoading, setFormLoading] = useState(false);
  const [error, setError] = useState('');

  const [formData, setFormData] = useState({
    registration_no: '',
    username: '',
    stream: '',
    email: '',
    password: ''
  });

  const backendUrl = import.meta.env?.VITE_BACKEND_URL || 'http://localhost:5000';

  useEffect(() => {
    fetchStudents();
  }, []);

  const fetchStudents = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${backendUrl}/api/admin/students`);
      if (res.ok) {
        const data = await res.json();
        setStudents(data);
      } else {
        throw new Error('Failed to fetch students');
      }
    } catch (err) {
      console.error(err);
      setError('Failed to load students. Please check your connection.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormLoading(true);
    setError('');

    try {
      const url = editingId 
        ? `${backendUrl}/api/admin/students/${editingId}`
        : `${backendUrl}/api/admin/students`;
        
      const method = editingId ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      const data = await res.json();

      if (!res.ok) throw new Error(data.error || 'Failed to save student');

      await fetchStudents();
      closeModal();
    } catch (err) {
      setError(err.message);
    } finally {
      setFormLoading(false);
    }
  };

  const confirmDelete = async () => {
    if (!studentToDelete) return;
    setFormLoading(true);
    setError('');

    try {
      const res = await fetch(`${backendUrl}/api/admin/students/${studentToDelete.id}`, {
        method: 'DELETE'
      });

      if (!res.ok) throw new Error('Failed to delete student');

      await fetchStudents();
      setIsDeleteModalOpen(false);
      setStudentToDelete(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setFormLoading(false);
    }
  };

  const openAddModal = () => {
    setEditingId(null);
    setFormData({ registration_no: '', username: '', stream: '', email: '', password: '' });
    setError('');
    setIsModalOpen(true);
  };

  const openEditModal = (student) => {
    setEditingId(student.id);
    setFormData({ 
      registration_no: student.registration_no, 
      username: student.username, 
      stream: student.stream || '', 
      email: student.email || '', 
      password: '' // Don't prefill password
    });
    setError('');
    setIsModalOpen(true);
  };

  const openDeleteModal = (student) => {
    setStudentToDelete(student);
    setError('');
    setIsDeleteModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingId(null);
  };

  // Extract unique streams and years from fetched data
  const availableStreams = [...new Set(students.map(s => s.stream).filter(Boolean))].sort();
  const availableYears = [...new Set(students.map(s => {
    const match = s.registration_no?.match(/^(\d{2})/);
    return match ? `20${match[1]}` : 'Other';
  }))].sort();

  const toggleStream = (stream) => {
    setSelectedStreams(prev => prev.includes(stream) ? prev.filter(s => s !== stream) : [...prev, stream]);
  };

  const toggleYear = (year) => {
    setSelectedYears(prev => prev.includes(year) ? prev.filter(y => y !== year) : [...prev, year]);
  };

  const filteredStudents = students.filter(student => {
    const matchesSearch = student.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          student.registration_no.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (student.stream && student.stream.toLowerCase().includes(searchQuery.toLowerCase()));

    const studentYear = student.registration_no?.match(/^(\d{2})/) ? `20${student.registration_no.match(/^(\d{2})/)[1]}` : 'Other';
    
    const matchesStream = selectedStreams.length === 0 || selectedStreams.includes(student.stream);
    const matchesYear = selectedYears.length === 0 || selectedYears.includes(studentYear);

    return matchesSearch && matchesStream && matchesYear;
  });

  const handleDownload = (format) => {
    if (!filteredStudents || filteredStudents.length === 0) {
      alert("No data to download");
      return;
    }

    const exportData = filteredStudents.map(s => ({
      "Registration No": s.registration_no,
      "Full Name": s.username,
      "Stream": s.stream || 'N/A',
      "Email": s.email || 'N/A'
    }));

    const fileName = `Students_Export_${new Date().toISOString().split('T')[0]}`;

    if (format === 'json') {
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url; link.download = `${fileName}.json`; link.click();
      URL.revokeObjectURL(url);
    } else {
      const worksheet = XLSX.utils.json_to_sheet(exportData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Students");
      XLSX.writeFile(workbook, `${fileName}.${format}`);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-[1600px] mx-auto">
      <header className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white transition-colors">Student Management</h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1 transition-colors">Manage student accounts, streams, and system access.</p>
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
            onClick={openAddModal}
            className="w-full sm:w-auto flex items-center justify-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl text-sm font-bold transition-all shadow-sm hover:shadow-md flex-shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Add Student</span>
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="bg-white dark:bg-[#111111] rounded-2xl shadow-sm border border-slate-200 dark:border-white/5 overflow-hidden transition-colors flex flex-col min-h-[500px]">
        
        {/* Toolbar */}
        <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-white/10 bg-slate-50/50 dark:bg-white/5 transition-colors flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input 
                type="text" 
                placeholder="Search by name, reg no, or stream..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-[#1a1a1a] border border-slate-200 dark:border-white/10 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500/50 dark:text-white transition-all shadow-sm placeholder:text-slate-400"
              />
            </div>
            
            {/* Filter Dropdown */}
            <div className="relative w-full sm:w-auto" ref={filterRef}>
              <button 
                onClick={() => setShowFilters(!showFilters)}
                className={`w-full sm:w-auto flex items-center justify-center px-4 py-2.5 rounded-xl text-sm font-medium transition-all shadow-sm border ${showFilters || selectedStreams.length > 0 || selectedYears.length > 0 ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800/50 text-blue-700 dark:text-blue-400' : 'bg-white dark:bg-[#1a1a1a] border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5'}`}
              >
                <Filter className="w-4 h-4 mr-2" />
                Filters
                {(selectedStreams.length > 0 || selectedYears.length > 0) && (
                  <span className="ml-2 bg-blue-600 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                    {selectedStreams.length + selectedYears.length}
                  </span>
                )}
              </button>

              {showFilters && (
                <div className="absolute left-0 sm:left-auto sm:right-0 mt-2 w-72 bg-white dark:bg-[#1a1a1a] border border-slate-200 dark:border-white/10 rounded-2xl shadow-xl z-[60] p-4 flex flex-col gap-4 animate-in fade-in slide-in-from-top-2 duration-200">
                  {/* Year Filter */}
                  <div>
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2.5">Filter by Year</h4>
                    <div className="space-y-2 max-h-32 overflow-y-auto pr-1">
                      {availableYears.map(year => (
                        <label key={year} className="flex items-center space-x-3 cursor-pointer group">
                          <input 
                            type="checkbox" 
                            checked={selectedYears.includes(year)}
                            onChange={() => toggleYear(year)}
                            className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-600/20 dark:border-gray-600 dark:bg-black dark:focus:ring-blue-500/50 transition-colors cursor-pointer"
                          />
                          <span className="text-sm font-medium text-slate-700 dark:text-slate-300 group-hover:text-slate-900 dark:group-hover:text-white transition-colors">{year}</span>
                        </label>
                      ))}
                      {availableYears.length === 0 && <p className="text-xs text-slate-500">No years available.</p>}
                    </div>
                  </div>

                  <div className="h-px w-full bg-slate-100 dark:bg-white/5"></div>

                  {/* Stream Filter */}
                  <div>
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2.5">Filter by Stream</h4>
                    <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                      {availableStreams.map(stream => (
                        <label key={stream} className="flex items-center space-x-3 cursor-pointer group">
                          <input 
                            type="checkbox" 
                            checked={selectedStreams.includes(stream)}
                            onChange={() => toggleStream(stream)}
                            className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-600/20 dark:border-gray-600 dark:bg-black dark:focus:ring-blue-500/50 transition-colors cursor-pointer"
                          />
                          <span className="text-sm font-medium text-slate-700 dark:text-slate-300 group-hover:text-slate-900 dark:group-hover:text-white transition-colors">{stream}</span>
                        </label>
                      ))}
                      {availableStreams.length === 0 && <p className="text-xs text-slate-500">No streams available.</p>}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
          <div className="text-sm font-medium text-slate-500 dark:text-slate-400 w-full sm:w-auto text-left sm:text-right mt-2 sm:mt-0">
            Showing <span className="text-slate-900 dark:text-white">{filteredStudents.length}</span> of {students.length}
          </div>
        </div>

        {/* Active Filters Display */}
        {(selectedStreams.length > 0 || selectedYears.length > 0) && (
          <div className="px-4 sm:px-5 py-3 flex flex-wrap items-center gap-2 border-b border-slate-200 dark:border-white/10 bg-slate-50/80 dark:bg-[#161616]">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 mr-1 uppercase tracking-wider">Active Filters:</span>
            {selectedYears.map(y => (
              <span key={y} className="inline-flex items-center px-2.5 py-1 rounded-md bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 text-xs font-medium border border-blue-200 dark:border-blue-800/50 shadow-sm">
                Year: {y}
                <button onClick={() => toggleYear(y)} className="ml-1.5 hover:text-blue-900 dark:hover:text-blue-200 focus:outline-none"><X className="w-3.5 h-3.5" /></button>
              </span>
            ))}
            {selectedStreams.map(s => (
              <span key={s} className="inline-flex items-center px-2.5 py-1 rounded-md bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 text-xs font-medium border border-purple-200 dark:border-purple-800/50 shadow-sm">
                Stream: {s}
                <button onClick={() => toggleStream(s)} className="ml-1.5 hover:text-purple-900 dark:hover:text-purple-200 focus:outline-none"><X className="w-3.5 h-3.5" /></button>
              </span>
            ))}
            <button onClick={() => { setSelectedStreams([]); setSelectedYears([]); }} className="text-xs font-medium text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white underline underline-offset-2 ml-1 px-2 py-1 transition-colors">Clear all</button>
          </div>
        )}

        {/* Table Area */}
        <div className="flex-1 overflow-x-auto">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-64 text-slate-400">
              <Loader2 className="w-8 h-8 animate-spin mb-4 text-blue-500" />
              <p>Loading students data...</p>
            </div>
          ) : filteredStudents.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-slate-400">
              <GraduationCap className="w-12 h-12 mb-4 opacity-20" />
              <p>No students found matching your criteria.</p>
            </div>
          ) : (
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-slate-50/80 dark:bg-[#161616] text-slate-600 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-white/5 transition-colors">
                <tr>
                  <th className="px-6 py-4">Reg No.</th>
                  <th className="px-6 py-4">Student Name</th>
                  <th className="px-6 py-4">Stream</th>
                  <th className="px-6 py-4">Email</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/5 text-slate-800 dark:text-slate-300 transition-colors">
                {filteredStudents.map((student) => (
                  <tr key={student.id} className="hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors group">
                    <td className="px-6 py-4 font-mono text-xs">{student.registration_no}</td>
                    <td className="px-6 py-4 font-medium text-slate-900 dark:text-white">{student.username}</td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-white/5">
                        {student.stream || 'N/A'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-500 dark:text-slate-400">{student.email || '-'}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={() => openEditModal(student)}
                          className="p-1.5 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-md transition-colors"
                          title="Edit Student"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => openDeleteModal(student)}
                          className="p-1.5 text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-colors"
                          title="Delete Student"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Add/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 dark:bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-[#111111] w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 dark:border-white/10 overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-5 border-b border-slate-100 dark:border-white/5 flex items-center justify-between sticky top-0 bg-white dark:bg-[#111111] z-10">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                {editingId ? 'Edit Student' : 'Add New Student'}
              </h3>
              <button onClick={closeModal} className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-4 flex-1">
              {error && (
                <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm rounded-lg flex items-center border border-red-100 dark:border-red-900/30">
                  <AlertTriangle className="w-4 h-4 mr-2 shrink-0" />
                  {error}
                </div>
              )}
              
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Registration No. *</label>
                <input 
                  required
                  type="text" 
                  value={formData.registration_no}
                  onChange={e => setFormData({...formData, registration_no: e.target.value.toUpperCase()})}
                  className="w-full bg-slate-50 dark:bg-[#1a1a1a] border border-slate-200 dark:border-white/10 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-blue-500/50 text-slate-900 dark:text-white transition-all uppercase placeholder:normal-case font-mono text-sm"
                  placeholder="e.g. 240C2070001"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Full Name *</label>
                <input 
                  required
                  type="text" 
                  value={formData.username}
                  onChange={e => setFormData({...formData, username: e.target.value})}
                  className="w-full bg-slate-50 dark:bg-[#1a1a1a] border border-slate-200 dark:border-white/10 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-blue-500/50 text-slate-900 dark:text-white transition-all"
                  placeholder="Student Name"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Stream</label>
                  <input 
                    type="text" 
                    value={formData.stream}
                    onChange={e => setFormData({...formData, stream: e.target.value})}
                    className="w-full bg-slate-50 dark:bg-[#1a1a1a] border border-slate-200 dark:border-white/10 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-blue-500/50 text-slate-900 dark:text-white transition-all"
                    placeholder="e.g. CSE I, ME"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">Used to auto-link timetable</p>
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Email</label>
                  <input 
                    type="email" 
                    value={formData.email}
                    onChange={e => setFormData({...formData, email: e.target.value})}
                    className="w-full bg-slate-50 dark:bg-[#1a1a1a] border border-slate-200 dark:border-white/10 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-blue-500/50 text-slate-900 dark:text-white transition-all text-sm"
                    placeholder="student@university.edu"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  Password {editingId && <span className="text-slate-400 font-normal">(Leave blank to keep current)</span>}
                </label>
                <input 
                  type="password" 
                  value={formData.password}
                  onChange={e => setFormData({...formData, password: e.target.value})}
                  className="w-full bg-slate-50 dark:bg-[#1a1a1a] border border-slate-200 dark:border-white/10 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-blue-500/50 text-slate-900 dark:text-white transition-all"
                  placeholder={editingId ? "••••••••" : "Defaults to 'password123' if blank"}
                />
              </div>

              <div className="pt-4 border-t border-slate-100 dark:border-white/5 flex justify-end gap-3 sticky bottom-0 bg-white dark:bg-[#111111]">
                <button 
                  type="button" 
                  onClick={closeModal}
                  className="px-4 py-2.5 rounded-xl font-medium text-slate-600 dark:text-slate-300 bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={formLoading}
                  className="px-6 py-2.5 rounded-xl font-bold text-white bg-blue-600 hover:bg-blue-700 transition-colors shadow-sm flex items-center disabled:opacity-70"
                >
                  {formLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Save Student
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 dark:bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-[#111111] w-full max-w-sm rounded-2xl shadow-2xl border border-slate-200 dark:border-white/10 overflow-hidden p-6 text-center">
            <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 mx-auto flex items-center justify-center mb-4">
              <Trash2 className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">Delete Student?</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
              Are you sure you want to remove <span className="font-semibold text-slate-700 dark:text-slate-200">{studentToDelete?.username}</span>? This will also remove them from any assigned timetables. This action cannot be undone.
            </p>
            
            {error && <p className="text-red-500 text-sm mb-4">{error}</p>}
            
            <div className="flex justify-center gap-3">
              <button 
                onClick={() => { setIsDeleteModalOpen(false); setStudentToDelete(null); setError(''); }}
                className="px-4 py-2.5 rounded-xl font-medium text-slate-600 dark:text-slate-300 bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 transition-colors w-full"
              >
                Cancel
              </button>
              <button 
                onClick={confirmDelete}
                disabled={formLoading}
                className="px-4 py-2.5 rounded-xl font-bold text-white bg-red-600 hover:bg-red-700 transition-colors shadow-sm w-full flex items-center justify-center"
              >
                {formLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Yes, Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}