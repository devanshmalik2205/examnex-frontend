import React, { useState, useEffect } from 'react';
import { 
  BookOpen, 
  Search, 
  Loader2, 
  ChevronRight, 
  GraduationCap, 
  Users, 
  Calendar,
  X,
  UserCheck,
  Plus,
  Edit2,
  Trash2,
  Filter,
  AlertTriangle,
  Download,
  ChevronDown
} from 'lucide-react';
import * as XLSX from 'xlsx';

export default function AdminCourses() {
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Details Modal State
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [courseDetails, setCourseDetails] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);

  // Filter State
  const [selectedTypes, setSelectedTypes] = useState([]);
  const [selectedSemesters, setSelectedSemesters] = useState([]);
  const [selectedCredits, setSelectedCredits] = useState([]);
  const [showFilters, setShowFilters] = useState(false);
  const filterRef = React.useRef(null);
  
  // Download State
  const [showDownload, setShowDownload] = useState(false);

  // CRUD Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [courseToDelete, setCourseToDelete] = useState(null);
  const [formLoading, setFormLoading] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    course_code: '',
    course_title: '',
    abbreviation: '',
    category: '',
    credits: '',
    ldp: '',
    course_type: 'regular'
  });

  const backendUrl = import.meta.env?.VITE_BACKEND_URL || 'http://localhost:5000';

  useEffect(() => {
    fetchCourses();
    
    // Close filter dropdown on outside click
    const handleClickOutside = (event) => {
      if (filterRef.current && !filterRef.current.contains(event.target)) {
        setShowFilters(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchCourses = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${backendUrl}/api/admin/courses`);
      if (res.ok) {
        const data = await res.json();
        setCourses(data);
      }
    } catch (err) {
      console.error("Failed to fetch courses:", err);
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
        ? `${backendUrl}/api/admin/courses/${editingId}`
        : `${backendUrl}/api/admin/courses`;
        
      const method = editingId ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      const data = await res.json();

      if (!res.ok) throw new Error(data.error || 'Failed to save course');

      await fetchCourses();
      closeModal();
    } catch (err) {
      setError(err.message);
    } finally {
      setFormLoading(false);
    }
  };

  const confirmDelete = async () => {
    if (!courseToDelete) return;
    setFormLoading(true);
    setError('');

    try {
      const res = await fetch(`${backendUrl}/api/admin/courses/${courseToDelete.id}`, {
        method: 'DELETE'
      });

      if (!res.ok) throw new Error('Failed to delete course');

      await fetchCourses();
      setIsDeleteModalOpen(false);
      setCourseToDelete(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setFormLoading(false);
    }
  };

  const openCourseDetails = async (course) => {
    setSelectedCourse(course);
    setDetailsLoading(true);
    try {
      const res = await fetch(`${backendUrl}/api/admin/courses/${course.id}/details`);
      if (res.ok) {
        const data = await res.json();
        setCourseDetails(data);
      }
    } catch (err) {
      console.error("Failed to fetch course details:", err);
    } finally {
      setDetailsLoading(false);
    }
  };

  const closeDetails = () => {
    setSelectedCourse(null);
    setCourseDetails(null);
  };

  const openAddModal = () => {
    setEditingId(null);
    setFormData({ 
      course_code: '', course_title: '', abbreviation: '', category: '', credits: '', ldp: '', course_type: 'regular' 
    });
    setError('');
    setIsModalOpen(true);
  };

  const openEditModal = (course) => {
    setEditingId(course.id);
    setFormData({ 
      course_code: course.course_code || '', 
      course_title: course.course_title || '', 
      abbreviation: course.abbreviation || '', 
      category: course.category || '', 
      credits: course.credits || '', 
      ldp: course.ldp || '', 
      course_type: course.course_type || 'regular' 
    });
    setError('');
    setIsModalOpen(true);
  };

  const openDeleteModal = (course) => {
    setCourseToDelete(course);
    setError('');
    setIsDeleteModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingId(null);
  };

  // Extract unique filter options
  const availableTypes = [...new Set(courses.map(c => c.course_type).filter(Boolean))].sort();
  const availableCredits = [...new Set(courses.map(c => c.credits).filter(Boolean))].sort((a, b) => parseFloat(a) - parseFloat(b));
  const availableSemesters = [...new Set(courses.flatMap(c => c.taught_in.map(t => t.semester)).filter(Boolean))].sort();

  const toggleFilter = (setter, value) => {
    setter(prev => prev.includes(value) ? prev.filter(item => item !== value) : [...prev, value]);
  };

  const filteredCourses = courses.filter(course => {
    const matchesSearch = course.course_title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (course.course_code && course.course_code.toLowerCase().includes(searchQuery.toLowerCase()));
    
    const matchesType = selectedTypes.length === 0 || selectedTypes.includes(course.course_type);
    const matchesCredit = selectedCredits.length === 0 || selectedCredits.includes(course.credits);
    
    const courseSems = course.taught_in.map(t => t.semester).filter(Boolean);
    const matchesSem = selectedSemesters.length === 0 || selectedSemesters.some(sem => courseSems.includes(sem));

    return matchesSearch && matchesType && matchesCredit && matchesSem;
  });

  const handleDownload = (format) => {
    if (!filteredCourses || filteredCourses.length === 0) {
      alert("No data to download");
      return;
    }

    const exportData = filteredCourses.map(c => {
      const semesters = [...new Set(c.taught_in.map(t => t.semester).filter(Boolean))].sort().join(', ');
      return {
        "Course Code": c.course_code,
        "Abbreviation": c.abbreviation,
        "Course Title": c.course_title,
        "Category": c.category,
        "Type": c.course_type,
        "Credits": c.credits ? parseFloat(c.credits) : '',
        "LDP": c.ldp,
        "Semesters Taught": semesters || "Unassigned"
      };
    });

    const fileName = `Courses_Export_${new Date().toISOString().split('T')[0]}`;

    if (format === 'json') {
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url; link.download = `${fileName}.json`; link.click();
      URL.revokeObjectURL(url);
    } else {
      const worksheet = XLSX.utils.json_to_sheet(exportData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Courses");
      XLSX.writeFile(workbook, `${fileName}.${format}`);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-[1600px] mx-auto">
      <header className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white transition-colors">Course Directory</h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1 transition-colors">Browse all offered courses, manage details, and view assigned faculty.</p>
        </div>
        
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full lg:w-auto">
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
            <span>Add Course</span>
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
                placeholder="Search courses by name or code..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-[#1a1a1a] border border-slate-200 dark:border-white/10 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500/50 dark:text-white transition-all shadow-sm placeholder:text-slate-400"
              />
            </div>

            {/* Filter Dropdown */}
            <div className="relative w-full sm:w-auto" ref={filterRef}>
              <button 
                onClick={() => setShowFilters(!showFilters)}
                className={`w-full sm:w-auto flex items-center justify-center px-4 py-2.5 rounded-xl text-sm font-medium transition-all shadow-sm border ${showFilters || selectedTypes.length > 0 || selectedSemesters.length > 0 || selectedCredits.length > 0 ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800/50 text-blue-700 dark:text-blue-400' : 'bg-white dark:bg-[#1a1a1a] border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5'}`}
              >
                <Filter className="w-4 h-4 mr-2" />
                Filters
                {(selectedTypes.length > 0 || selectedSemesters.length > 0 || selectedCredits.length > 0) && (
                  <span className="ml-2 bg-blue-600 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                    {selectedTypes.length + selectedSemesters.length + selectedCredits.length}
                  </span>
                )}
              </button>

              {showFilters && (
                <div className="absolute left-0 sm:left-auto sm:right-0 mt-2 w-72 bg-white dark:bg-[#1a1a1a] border border-slate-200 dark:border-white/10 rounded-2xl shadow-xl z-[60] p-4 flex flex-col gap-4 animate-in fade-in slide-in-from-top-2 duration-200">
                  {/* Semester Filter */}
                  <div>
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2.5">Filter by Semester Taught</h4>
                    <div className="flex flex-wrap gap-2">
                      {availableSemesters.map(sem => (
                        <button
                          key={sem}
                          onClick={() => toggleFilter(setSelectedSemesters, sem)}
                          className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-colors ${selectedSemesters.includes(sem) ? 'bg-blue-600 border-blue-600 text-white' : 'bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 hover:border-slate-300 dark:hover:border-white/20'}`}
                        >
                          Sem {sem}
                        </button>
                      ))}
                      {availableSemesters.length === 0 && <p className="text-xs text-slate-500">No active semesters.</p>}
                    </div>
                  </div>

                  <div className="h-px w-full bg-slate-100 dark:bg-white/5"></div>

                  {/* Course Type Filter */}
                  <div>
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2.5">Filter by Type</h4>
                    <div className="space-y-2 max-h-32 overflow-y-auto pr-1">
                      {availableTypes.map(type => (
                        <label key={type} className="flex items-center space-x-3 cursor-pointer group">
                          <input 
                            type="checkbox" 
                            checked={selectedTypes.includes(type)}
                            onChange={() => toggleFilter(setSelectedTypes, type)}
                            className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-600/20 dark:border-gray-600 dark:bg-black dark:focus:ring-blue-500/50 transition-colors cursor-pointer"
                          />
                          <span className="text-sm font-medium text-slate-700 dark:text-slate-300 group-hover:text-slate-900 dark:group-hover:text-white transition-colors capitalize">{type}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="h-px w-full bg-slate-100 dark:bg-white/5"></div>

                  {/* Credits Filter */}
                  <div>
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2.5">Filter by Credits</h4>
                    <div className="flex flex-wrap gap-2">
                      {availableCredits.map(credit => (
                        <button
                          key={credit}
                          onClick={() => toggleFilter(setSelectedCredits, credit)}
                          className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-colors ${selectedCredits.includes(credit) ? 'bg-blue-600 border-blue-600 text-white' : 'bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 hover:border-slate-300 dark:hover:border-white/20'}`}
                        >
                          {parseFloat(credit)} Cr
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
          <div className="text-sm font-medium text-slate-500 dark:text-slate-400 w-full sm:w-auto text-left sm:text-right mt-2 sm:mt-0">
            Showing <span className="text-slate-900 dark:text-white">{filteredCourses.length}</span> of {courses.length}
          </div>
        </div>

        {/* Active Filters Display */}
        {(selectedTypes.length > 0 || selectedSemesters.length > 0 || selectedCredits.length > 0) && (
          <div className="px-4 sm:px-5 py-3 flex flex-wrap items-center gap-2 border-b border-slate-200 dark:border-white/10 bg-slate-50/80 dark:bg-[#161616]">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 mr-1 uppercase tracking-wider">Active Filters:</span>
            {selectedSemesters.map(s => (
              <span key={`sem-${s}`} className="inline-flex items-center px-2.5 py-1 rounded-md bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 text-xs font-medium border border-indigo-200 dark:border-indigo-800/50 shadow-sm">
                Sem: {s}
                <button onClick={() => toggleFilter(setSelectedSemesters, s)} className="ml-1.5 hover:text-indigo-900 dark:hover:text-indigo-200 focus:outline-none"><X className="w-3.5 h-3.5" /></button>
              </span>
            ))}
            {selectedTypes.map(t => (
              <span key={`type-${t}`} className="inline-flex items-center px-2.5 py-1 rounded-md bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 text-xs font-medium border border-blue-200 dark:border-blue-800/50 shadow-sm capitalize">
                Type: {t}
                <button onClick={() => toggleFilter(setSelectedTypes, t)} className="ml-1.5 hover:text-blue-900 dark:hover:text-blue-200 focus:outline-none"><X className="w-3.5 h-3.5" /></button>
              </span>
            ))}
            {selectedCredits.map(c => (
              <span key={`cr-${c}`} className="inline-flex items-center px-2.5 py-1 rounded-md bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 text-xs font-medium border border-purple-200 dark:border-purple-800/50 shadow-sm">
                Credits: {parseFloat(c)}
                <button onClick={() => toggleFilter(setSelectedCredits, c)} className="ml-1.5 hover:text-purple-900 dark:hover:text-purple-200 focus:outline-none"><X className="w-3.5 h-3.5" /></button>
              </span>
            ))}
            <button onClick={() => { setSelectedTypes([]); setSelectedSemesters([]); setSelectedCredits([]); }} className="text-xs font-medium text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white underline underline-offset-2 ml-1 px-2 py-1 transition-colors">Clear all</button>
          </div>
        )}

        {/* Course Grid */}
        <div className="flex-1 p-4 sm:p-6 overflow-y-auto">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-64 text-slate-400">
              <Loader2 className="w-8 h-8 animate-spin mb-4 text-blue-500" />
              <p>Loading course catalogue...</p>
            </div>
          ) : filteredCourses.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-slate-400">
              <BookOpen className="w-12 h-12 mb-4 opacity-20" />
              <p>No courses found matching your criteria.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filteredCourses.map((course) => {
                const uniqueSemesters = [...new Set(course.taught_in.map(t => t.semester).filter(Boolean))].sort();

                return (
                  <div 
                    key={course.id}
                    onClick={() => openCourseDetails(course)}
                    className="group bg-white dark:bg-[#1a1a1a] border border-slate-200 dark:border-white/10 rounded-2xl p-5 hover:border-blue-400 dark:hover:border-blue-500/50 hover:shadow-md transition-all cursor-pointer flex flex-col h-full relative"
                  >
                    {/* Action Buttons */}
                    <div className="absolute top-4 right-4 flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={(e) => { e.stopPropagation(); openEditModal(course); }}
                          className="p-1.5 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-md transition-colors bg-white dark:bg-[#1a1a1a]"
                          title="Edit Course"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={(e) => { e.stopPropagation(); openDeleteModal(course); }}
                          className="p-1.5 text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-colors bg-white dark:bg-[#1a1a1a]"
                          title="Delete Course"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                    </div>

                    <div className="flex justify-between items-start mb-3 pr-16">
                      <div className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800/50">
                        {course.course_code || 'No Code'}
                      </div>
                    </div>
                    
                    <h3 className="text-base font-bold text-slate-900 dark:text-white line-clamp-2 mb-2 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                      {course.course_title}
                    </h3>
                    
                    <div className="mt-auto pt-4 flex flex-col gap-2">
                      <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                        <div className="flex items-center">
                          <GraduationCap className="w-3.5 h-3.5 mr-1.5 shrink-0" />
                          <span className="truncate">{course.category || 'General'}</span>
                        </div>
                        {course.credits && <span className="font-semibold">{parseFloat(course.credits)} Cr</span>}
                      </div>
                      
                      <div className="flex flex-wrap items-center gap-1.5 mt-1">
                        <span className={`text-[10px] px-2 py-0.5 rounded capitalize font-medium ${course.course_type === 'elective' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' : 'bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-300'}`}>
                          {course.course_type || 'Regular'}
                        </span>

                        {uniqueSemesters.length > 0 ? (
                           uniqueSemesters.slice(0, 3).map((sem, idx) => (
                             <span key={idx} className="text-[10px] px-1.5 py-0.5 rounded border border-slate-200 dark:border-white/10 text-slate-500 dark:text-slate-400">
                               Sem {sem}
                             </span>
                           ))
                        ) : (
                          <span className="text-[10px] px-1.5 py-0.5 rounded border border-dashed border-slate-300 dark:border-white/10 text-slate-400 italic">
                            No classes
                          </span>
                        )}
                        {uniqueSemesters.length > 3 && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded text-slate-500">
                            +{uniqueSemesters.length - 3}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Course Details Modal */}
      {selectedCourse && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-slate-900/50 dark:bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-[#111111] w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-200 dark:border-white/10 overflow-hidden flex flex-col max-h-[90vh] sm:max-h-[80vh]">
            
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-100 dark:border-white/5 flex items-start justify-between bg-slate-50 dark:bg-white/[0.02]">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800/50">
                    {selectedCourse.course_code || 'No Code'}
                  </span>
                  {selectedCourse.abbreviation && (
                    <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-slate-200 dark:bg-white/10 text-slate-700 dark:text-slate-300">
                      {selectedCourse.abbreviation}
                    </span>
                  )}
                  <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-slate-200 dark:bg-white/10 text-slate-700 dark:text-slate-300">
                    {selectedCourse.credits ? `${parseFloat(selectedCourse.credits)} Credits` : 'Credits N/A'}
                  </span>
                </div>
                <h3 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white leading-tight">
                  {selectedCourse.course_title}
                </h3>
              </div>
              <button onClick={closeDetails} className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-xl hover:bg-slate-200 dark:hover:bg-white/10 transition-colors shrink-0 bg-white dark:bg-[#1a1a1a] shadow-sm border border-slate-200 dark:border-white/10">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            {/* Modal Body */}
            <div className="p-6 overflow-y-auto flex-1">
              {detailsLoading ? (
                <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                  <Loader2 className="w-8 h-8 animate-spin mb-4 text-blue-500" />
                  <p>Loading assigned faculty...</p>
                </div>
              ) : courseDetails ? (
                <div className="space-y-6">
                  
                  {/* General Info */}
                  <div className="grid grid-cols-2 gap-4 bg-slate-50 dark:bg-[#1a1a1a] p-4 rounded-xl border border-slate-200 dark:border-white/5">
                    <div>
                      <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Category</p>
                      <p className="text-sm text-slate-900 dark:text-white font-medium">{courseDetails.course.category || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Type</p>
                      <p className="text-sm text-slate-900 dark:text-white font-medium capitalize">{courseDetails.course.course_type || 'Regular'}</p>
                    </div>
                    {courseDetails.course.ldp && (
                      <div className="col-span-2 border-t border-slate-200 dark:border-white/10 pt-3 mt-1">
                        <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">LDP (Lecture-Demo-Pract)</p>
                        <p className="text-sm text-slate-900 dark:text-white font-medium">{courseDetails.course.ldp}</p>
                      </div>
                    )}
                  </div>

                  {/* Faculty List */}
                  <div>
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center mb-4">
                      <Users className="w-4 h-4 mr-2 text-blue-500" />
                      Assigned Faculty & Classes
                    </h4>
                    
                    {courseDetails.teachers.length === 0 ? (
                      <div className="text-center py-8 border border-dashed border-slate-200 dark:border-white/10 rounded-xl bg-slate-50/50 dark:bg-white/[0.01]">
                        <UserCheck className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-600 mb-2" />
                        <p className="text-sm text-slate-500 dark:text-slate-400">No faculty currently assigned to this course.</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {courseDetails.teachers.map((teacher, idx) => (
                          <div key={idx} className="bg-white dark:bg-[#111111] border border-slate-200 dark:border-white/10 p-4 rounded-xl shadow-sm flex flex-col sm:flex-row sm:items-start justify-between gap-4 transition-colors hover:border-blue-200 dark:hover:border-blue-900/50">
                            <div>
                              <p className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                {teacher.name}
                                {teacher.type === 'phd_scholar' && (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 font-bold uppercase tracking-wide">Scholar</span>
                                )}
                              </p>
                              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{teacher.email}</p>
                            </div>
                            
                            <div className="w-full sm:w-auto">
                              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5 flex items-center">
                                <Calendar className="w-3 h-3 mr-1" /> Classes Taught
                              </p>
                              <div className="flex flex-wrap gap-1.5">
                                {teacher.classes.map((cls, cIdx) => (
                                  <span key={cIdx} className="inline-flex items-center px-2 py-1 rounded bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/5 text-[11px] font-medium text-slate-700 dark:text-slate-300">
                                    {cls}
                                  </span>
                                ))}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                </div>
              ) : (
                <div className="text-center py-8 text-red-500">Failed to load course details.</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 dark:bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-[#111111] w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 dark:border-white/10 overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-5 border-b border-slate-100 dark:border-white/5 flex items-center justify-between sticky top-0 bg-white dark:bg-[#111111] z-10">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                {editingId ? 'Edit Course' : 'Add New Course'}
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
              
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Course Code</label>
                  <input 
                    type="text" 
                    value={formData.course_code}
                    onChange={e => setFormData({...formData, course_code: e.target.value.toUpperCase()})}
                    className="w-full bg-slate-50 dark:bg-[#1a1a1a] border border-slate-200 dark:border-white/10 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-blue-500/50 text-slate-900 dark:text-white transition-all uppercase placeholder:normal-case font-mono text-sm"
                    placeholder="e.g. CSE101"
                  />
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Abbreviation</label>
                  <input 
                    type="text" 
                    value={formData.abbreviation}
                    onChange={e => setFormData({...formData, abbreviation: e.target.value})}
                    className="w-full bg-slate-50 dark:bg-[#1a1a1a] border border-slate-200 dark:border-white/10 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-blue-500/50 text-slate-900 dark:text-white transition-all text-sm"
                    placeholder="e.g. DSA"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Course Title *</label>
                <input 
                  required
                  type="text" 
                  value={formData.course_title}
                  onChange={e => setFormData({...formData, course_title: e.target.value})}
                  className="w-full bg-slate-50 dark:bg-[#1a1a1a] border border-slate-200 dark:border-white/10 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-blue-500/50 text-slate-900 dark:text-white transition-all"
                  placeholder="Full name of the course"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Category</label>
                  <input 
                    type="text" 
                    value={formData.category}
                    onChange={e => setFormData({...formData, category: e.target.value})}
                    className="w-full bg-slate-50 dark:bg-[#1a1a1a] border border-slate-200 dark:border-white/10 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-blue-500/50 text-slate-900 dark:text-white transition-all"
                    placeholder="e.g. Core, Elective"
                  />
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Course Type</label>
                  <select 
                    value={formData.course_type}
                    onChange={e => setFormData({...formData, course_type: e.target.value})}
                    className="w-full bg-slate-50 dark:bg-[#1a1a1a] border border-slate-200 dark:border-white/10 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-blue-500/50 text-slate-900 dark:text-white transition-all text-sm capitalize"
                  >
                    <option value="regular">Regular</option>
                    <option value="elective">Elective</option>
                    <option value="minor">Minor</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Credits</label>
                  <input 
                    type="number" 
                    step="0.1"
                    min="0"
                    value={formData.credits}
                    onChange={e => setFormData({...formData, credits: e.target.value})}
                    className="w-full bg-slate-50 dark:bg-[#1a1a1a] border border-slate-200 dark:border-white/10 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-blue-500/50 text-slate-900 dark:text-white transition-all"
                    placeholder="e.g. 3.00"
                  />
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">LDP (L-D-P)</label>
                  <input 
                    type="text" 
                    value={formData.ldp}
                    onChange={e => setFormData({...formData, ldp: e.target.value})}
                    className="w-full bg-slate-50 dark:bg-[#1a1a1a] border border-slate-200 dark:border-white/10 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-blue-500/50 text-slate-900 dark:text-white transition-all"
                    placeholder="e.g. 2-0-2"
                  />
                </div>
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
                  Save Course
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
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">Delete Course?</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
              Are you sure you want to remove <span className="font-semibold text-slate-700 dark:text-slate-200">{courseToDelete?.course_title}</span>? This will remove it from all timetables. This action cannot be undone.
            </p>
            
            {error && <p className="text-red-500 text-sm mb-4">{error}</p>}
            
            <div className="flex justify-center gap-3">
              <button 
                onClick={() => { setIsDeleteModalOpen(false); setCourseToDelete(null); setError(''); }}
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