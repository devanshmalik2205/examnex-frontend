import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
    Plus, Edit2, Trash2, BookOpen, X, Loader2, Search, 
    FileSpreadsheet, UploadCloud, AlertTriangle, CheckCircle, Users, Download, ChevronDown,
    GitMerge, Sparkles, Filter, Check, ArrowRight, ShieldCheck, Layers, RefreshCw
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

  // Duplication management state
  const [isDuplicateModalOpen, setIsDuplicateModalOpen] = useState(false);
  const [filterDuplicatesOnly, setFilterDuplicatesOnly] = useState(false);
  const [sortByDuplicates, setSortByDuplicates] = useState(false);
  const [selectedDuplicateGroupIndex, setSelectedDuplicateGroupIndex] = useState(null);
  const [selectedPrimaries, setSelectedPrimaries] = useState({});
  const [isMerging, setIsMerging] = useState(false);
  const [mergeProgress, setMergeProgress] = useState(null);
  
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

  // Normalize teacher full name for duplicate detection
  const normalizeName = (name) => {
    if (!name) return '';
    return name
      .replace(/^(Dr\.|Dr\s|Mr\.|Mr\s|Mrs\.|Mrs\s|Ms\.|Ms\s|Prof\.|Prof\s|Associate\s+Prof\.|Assistant\s+Prof\.|Er\.|Er\s)+/ig, '')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  };

  // Normalize email for duplicate detection (removes edge dots like 'tanvi.jain.@bmu.edu.in')
  const normalizeEmail = (email) => {
    if (!email) return '';
    const clean = email.toLowerCase().trim();
    const parts = clean.split('@');
    const user = parts[0].replace(/\.+$/g, '').replace(/^\.+/g, '');
    return user + (parts[1] ? '@' + parts[1] : '');
  };

  // Detect duplicate groups using transitive matching
  const duplicateGroups = useMemo(() => {
    if (!teachers || teachers.length < 2) return [];

    const n = teachers.length;
    const adj = Array.from({ length: n }, () => []);

    for (let i = 0; i < n; i++) {
      const t1 = teachers[i];
      const normN1 = normalizeName(t1.full_name);
      const normE1 = normalizeEmail(t1.email);

      for (let j = i + 1; j < n; j++) {
        const t2 = teachers[j];
        const normN2 = normalizeName(t2.full_name);
        const normE2 = normalizeEmail(t2.email);

        let isMatch = false;
        const reasons = [];

        if (normE1 && normE2 && normE1 === normE2) {
          isMatch = true;
          reasons.push('Same Email');
        }
        if (normN1 && normN2 && normN1 === normN2 && normN1.length >= 3) {
          isMatch = true;
          if (t1.full_name?.trim().toLowerCase() === t2.full_name?.trim().toLowerCase()) {
            reasons.push('Exact Name Match');
          } else {
            reasons.push('Normalized Name Match');
          }
        }

        if (isMatch) {
          adj[i].push({ node: j, reasons });
          adj[j].push({ node: i, reasons });
        }
      }
    }

    const visited = new Array(n).fill(false);
    const groups = [];

    for (let i = 0; i < n; i++) {
      if (!visited[i]) {
        const compIndices = [];
        const groupReasons = new Set();
        const queue = [i];
        visited[i] = true;

        while (queue.length > 0) {
          const curr = queue.shift();
          compIndices.push(curr);

          for (const edge of adj[curr]) {
            edge.reasons.forEach(r => groupReasons.add(r));
            if (!visited[edge.node]) {
              visited[edge.node] = true;
              queue.push(edge.node);
            }
          }
        }

        if (compIndices.length > 1) {
          const groupTeachers = compIndices.map(idx => teachers[idx]);

          // Determine recommended primary:
          // 1. Most allocations
          // 2. Clean valid email (no trailing dots before @)
          // 3. Lowest ID (established record)
          const sortedCandidates = [...groupTeachers].sort((a, b) => {
            const allocA = a.allocations?.length || 0;
            const allocB = b.allocations?.length || 0;
            if (allocB !== allocA) return allocB - allocA;

            const cleanEmailA = a.email && !a.email.includes('.@') ? 1 : 0;
            const cleanEmailB = b.email && !b.email.includes('.@') ? 1 : 0;
            if (cleanEmailB !== cleanEmailA) return cleanEmailB - cleanEmailA;

            return (Number(a.id) || 0) - (Number(b.id) || 0);
          });

          const primaryCandidateId = sortedCandidates[0].id;
          const groupKey = `group-${compIndices.slice().sort((a, b) => a - b).join('-')}`;

          groups.push({
            key: groupKey,
            teachers: groupTeachers,
            reasons: Array.from(groupReasons),
            primaryCandidateId,
            name: sortedCandidates[0].full_name || 'Duplicate Faculty Set'
          });
        }
      }
    }

    return groups;
  }, [teachers]);

  // Quick lookup map for teacher duplicate membership
  const teacherDuplicateMap = useMemo(() => {
    const map = new Map();
    duplicateGroups.forEach((group, groupIdx) => {
      const primaryId = selectedPrimaries[group.key] || group.primaryCandidateId;
      group.teachers.forEach(t => {
        map.set(t.id, {
          groupIndex: groupIdx,
          groupKey: group.key,
          groupName: group.name,
          isPrimary: t.id === primaryId,
          reasons: group.reasons,
          totalInGroup: group.teachers.length
        });
      });
    });
    return map;
  }, [duplicateGroups, selectedPrimaries]);

  // Pick cleanest email and most descriptive role when merging
  const getPreferredProfileForGroup = (primaryTeacher, duplicateTeachers) => {
    const allMembers = [primaryTeacher, ...duplicateTeachers];
    let bestEmail = primaryTeacher.email;
    if (!bestEmail || bestEmail.includes('.@')) {
      const cleanMember = allMembers.find(m => m.email && !m.email.includes('.@'));
      if (cleanMember) bestEmail = cleanMember.email;
    }

    let bestRole = primaryTeacher.teacher_type;
    if (!bestRole || bestRole.toLowerCase() === 'faculty') {
      const specificRoleMember = allMembers.find(m => m.teacher_type && m.teacher_type.toLowerCase() !== 'faculty');
      if (specificRoleMember) bestRole = specificRoleMember.teacher_type;
    }

    return {
      full_name: primaryTeacher.full_name,
      email: bestEmail || primaryTeacher.email,
      teacher_type: bestRole || primaryTeacher.teacher_type || 'Assistant Prof.'
    };
  };

  // Safe merge core: combines allocations and deletes duplicate records
  const mergeDuplicateGroup = async (primaryId, duplicateIds, preferredProfile) => {
    // 1. Fetch current allocations for primary teacher
    let primaryAllocs = [];
    try {
      const res = await fetch(`${getApiBase()}/admin/teachers/${primaryId}/allocations`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) primaryAllocs = data;
      }
    } catch (e) {
      console.error(`Failed to fetch allocations for primary ${primaryId}`, e);
    }

    // 2. Fetch allocations for all duplicate teachers
    const duplicateAllocs = [];
    for (const dupId of duplicateIds) {
      try {
        const res = await fetch(`${getApiBase()}/admin/teachers/${dupId}/allocations`);
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data)) duplicateAllocs.push(...data);
        }
      } catch (e) {
        console.error(`Failed to fetch allocations for duplicate ${dupId}`, e);
      }
    }

    // 3. Deduplicate allocations by course_id + timetable_id
    const uniqueMap = new Map();
    [...primaryAllocs, ...duplicateAllocs].forEach(a => {
      if (a.course_id && a.timetable_id) {
        const key = `${a.course_id}_${a.timetable_id}`;
        if (!uniqueMap.has(key)) {
          uniqueMap.set(key, { course_id: a.course_id, timetable_id: a.timetable_id });
        }
      }
    });

    const mergedAllocations = Array.from(uniqueMap.values());

    // 4. Save combined allocations to primary teacher
    const saveRes = await fetch(`${getApiBase()}/admin/teachers/${primaryId}/allocations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ allocations: mergedAllocations })
    });

    if (!saveRes.ok) {
      throw new Error(`Failed to update allocations for primary teacher ID: ${primaryId}`);
    }

    // 5. Update primary profile if cleaner email or role exists
    if (preferredProfile) {
      try {
        await fetch(`${getApiBase()}/admin/teachers/${primaryId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(preferredProfile)
        });
      } catch (e) {
        console.warn("Could not update profile details during merge", e);
      }
    }

    // 6. Delete duplicate teacher records
    for (const dupId of duplicateIds) {
      const delRes = await fetch(`${getApiBase()}/admin/teachers/${dupId}`, {
        method: 'DELETE'
      });
      if (!delRes.ok) {
        console.warn(`Could not delete duplicate teacher ${dupId}`);
      }
    }
  };

  const handleMergeSingleGroup = async (group) => {
    const primaryId = selectedPrimaries[group.key] || group.primaryCandidateId;
    const primaryTeacher = group.teachers.find(t => t.id === primaryId) || group.teachers[0];
    const duplicateTeachers = group.teachers.filter(t => t.id !== primaryTeacher.id);
    const duplicateIds = duplicateTeachers.map(t => t.id);

    if (duplicateIds.length === 0) {
      alert("No duplicate entries to merge in this group.");
      return;
    }

    const confirmMsg = `Merge ${duplicateIds.length} duplicate record(s) into:\n` +
      `• Primary: ${primaryTeacher.full_name} (${primaryTeacher.email})\n\n` +
      `All class allocations will be safely preserved and merged into the primary record. Redundant profiles will be deleted.\n\nProceed?`;

    if (!window.confirm(confirmMsg)) return;

    setIsMerging(true);
    setMergeProgress(`Merging duplicate records for ${group.name}...`);
    try {
      const preferredProfile = getPreferredProfileForGroup(primaryTeacher, duplicateTeachers);
      await mergeDuplicateGroup(primaryTeacher.id, duplicateIds, preferredProfile);
      await fetchTeachers();
    } catch (err) {
      console.error('Error merging duplicate group:', err);
      alert(`Failed to merge duplicates: ${err.message}`);
    } finally {
      setIsMerging(false);
      setMergeProgress(null);
    }
  };

  const handleInstantMergeAll = async () => {
    if (duplicateGroups.length === 0) return;

    const totalDupsToDelete = duplicateGroups.reduce((acc, g) => acc + (g.teachers.length - 1), 0);
    const confirmMsg = `Instant Merge All:\n\n` +
      `• Merge ${duplicateGroups.length} duplicate groups (${totalDupsToDelete} redundant records)\n` +
      `• All class and timetable allocations across duplicates will be safely preserved and merged into the selected primary records\n` +
      `• Redundant records will be deleted\n\n` +
      `Are you sure you want to proceed?`;

    if (!window.confirm(confirmMsg)) return;

    setIsMerging(true);
    let successCount = 0;

    try {
      for (let i = 0; i < duplicateGroups.length; i++) {
        const group = duplicateGroups[i];
        const primaryId = selectedPrimaries[group.key] || group.primaryCandidateId;
        const primaryTeacher = group.teachers.find(t => t.id === primaryId) || group.teachers[0];
        const duplicateTeachers = group.teachers.filter(t => t.id !== primaryTeacher.id);
        const duplicateIds = duplicateTeachers.map(t => t.id);

        setMergeProgress(`Merging group ${i + 1} of ${duplicateGroups.length}: ${group.name}...`);

        if (duplicateIds.length > 0) {
          const preferredProfile = getPreferredProfileForGroup(primaryTeacher, duplicateTeachers);
          await mergeDuplicateGroup(primaryTeacher.id, duplicateIds, preferredProfile);
          successCount++;
        }
      }

      await fetchTeachers();
      setIsDuplicateModalOpen(false);
      alert(`Successfully merged all ${successCount} duplicate groups! Faculty records are now unified.`);
    } catch (err) {
      console.error('Error during bulk merge:', err);
      alert(`An error occurred during instant merge: ${err.message}`);
      await fetchTeachers();
    } finally {
      setIsMerging(false);
      setMergeProgress(null);
    }
  };

  const openDuplicateResolver = (groupIndex = null) => {
    setSelectedDuplicateGroupIndex(groupIndex);
    setIsDuplicateModalOpen(true);
  };

  const filteredTeachers = useMemo(() => {
    let list = teachers.filter(t => 
      t.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
      t.email?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (filterDuplicatesOnly) {
      list = list.filter(t => teacherDuplicateMap.has(t.id));
    }

    if (sortByDuplicates || filterDuplicatesOnly) {
      list = [...list].sort((a, b) => {
        const dupA = teacherDuplicateMap.get(a.id);
        const dupB = teacherDuplicateMap.get(b.id);
        if (dupA && !dupB) return -1;
        if (!dupA && dupB) return 1;
        if (dupA && dupB) {
          if (dupA.groupIndex !== dupB.groupIndex) {
            return dupA.groupIndex - dupB.groupIndex;
          }
          if (dupA.isPrimary && !dupB.isPrimary) return -1;
          if (!dupA.isPrimary && dupB.isPrimary) return 1;
        }
        return (a.full_name || '').localeCompare(b.full_name || '');
      });
    }

    return list;
  }, [teachers, searchTerm, filterDuplicatesOnly, sortByDuplicates, teacherDuplicateMap]);


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
          
          {/* Resolve Duplicates Button */}
          {duplicateGroups.length > 0 ? (
            <button 
              onClick={() => openDuplicateResolver(null)}
              className="w-full sm:w-auto flex items-center justify-center px-4 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-sm border bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/40 dark:hover:bg-amber-900/50 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-700/60"
              title="Review and resolve duplicate teachers"
            >
              <GitMerge className="w-4 h-4 mr-2 text-amber-600 dark:text-amber-400" />
              Resolve Duplicates
              <span className="ml-2 px-2 py-0.5 text-xs font-bold bg-amber-500 text-white rounded-full">
                {duplicateGroups.length}
              </span>
            </button>
          ) : (
            <div className="hidden sm:flex items-center px-3.5 py-2 text-xs font-medium text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/40 rounded-xl">
              <CheckCircle className="w-3.5 h-3.5 mr-1.5 text-emerald-500" /> 0 Duplicates
            </div>
          )}

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

      {/* Search and Duplicate Filter Controls */}
      <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        <div className="flex items-center flex-1 bg-white dark:bg-[#111111] p-2 rounded-xl border border-slate-200 dark:border-white/5 shadow-sm">
          <Search className="w-5 h-5 text-slate-400 ml-2" />
          <input 
            type="text" 
            placeholder="Search teachers by name or email..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-1 bg-transparent border-none outline-none px-4 py-2 text-slate-700 dark:text-white"
          />
          {searchTerm && (
            <button onClick={() => setSearchTerm('')} className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 mr-2">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* View filter pills */}
          <div className="bg-slate-100 dark:bg-white/5 p-1 rounded-xl flex items-center border border-slate-200 dark:border-white/5 text-xs font-medium">
            <button
              onClick={() => setFilterDuplicatesOnly(false)}
              className={`px-3 py-1.5 rounded-lg transition-colors ${!filterDuplicatesOnly ? 'bg-white dark:bg-[#1a1a1a] text-slate-900 dark:text-white shadow-sm font-semibold' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}
            >
              All ({teachers.length})
            </button>
            <button
              onClick={() => {
                setFilterDuplicatesOnly(true);
                setSortByDuplicates(true);
              }}
              className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${filterDuplicatesOnly ? 'bg-amber-500 text-white shadow-sm font-semibold' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}
            >
              <GitMerge className="w-3.5 h-3.5" />
              Duplicates Only
              {duplicateGroups.length > 0 && (
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${filterDuplicatesOnly ? 'bg-white text-amber-700' : 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300'}`}>
                  {duplicateGroups.length}
                </span>
              )}
            </button>
          </div>

          {/* Duplication Sorting toggle button */}
          <button
            onClick={() => setSortByDuplicates(!sortByDuplicates)}
            className={`px-3.5 py-2 rounded-xl text-xs font-medium border transition-colors flex items-center gap-1.5 shadow-sm ${sortByDuplicates ? 'bg-indigo-50 dark:bg-indigo-900/30 border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 font-semibold' : 'bg-white dark:bg-[#111111] border-slate-200 dark:border-white/5 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/5'}`}
            title="Cluster duplicate teachers together in table view"
          >
            <Filter className="w-3.5 h-3.5" />
            Sort Duplicates
            {sortByDuplicates && <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 dark:bg-indigo-400 animate-pulse"></span>}
          </button>
        </div>
      </div>

      {/* Duplicates View Alert Banner */}
      {filterDuplicatesOnly && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/40 rounded-xl p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-sm">
          <div className="flex items-center gap-2.5 text-amber-900 dark:text-amber-200">
            <GitMerge className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
            <span>Showing <strong>{filteredTeachers.length} potential duplicate teachers</strong> across <strong>{duplicateGroups.length} duplicate groups</strong>.</span>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button 
              onClick={() => openDuplicateResolver(null)}
              className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-semibold flex items-center shadow-sm transition-colors"
            >
              <Sparkles className="w-3.5 h-3.5 mr-1.5" /> Open Duplicate Resolver
            </button>
            <button 
              onClick={() => setFilterDuplicatesOnly(false)}
              className="px-3 py-1.5 text-xs text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/40 rounded-lg transition-colors"
            >
              View All
            </button>
          </div>
        </div>
      )}

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
                filteredTeachers.map(teacher => {
                  const dupInfo = teacherDuplicateMap.get(teacher.id);
                  return (
                    <tr 
                      key={teacher.id} 
                      className={`hover:bg-slate-50 dark:hover:bg-slate-900/30 transition-colors ${dupInfo ? 'bg-amber-500/[0.04] dark:bg-amber-500/[0.07] border-l-4 border-l-amber-500' : ''}`}
                    >
                      <td className="p-4 font-medium text-slate-900 dark:text-white">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm shrink-0 ${dupInfo ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' : 'bg-blue-100 dark:bg-blue-900/30 text-blue-600'}`}>
                            {teacher.full_name?.charAt(0) || '?'}
                          </div>
                          <div className="flex flex-col gap-1 overflow-hidden">
                            <span className="truncate max-w-[170px] font-semibold">{teacher.full_name}</span>
                            {dupInfo && (
                              <button 
                                onClick={(e) => { e.stopPropagation(); openDuplicateResolver(dupInfo.groupIndex); }}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300 border border-amber-200 dark:border-amber-700/50 hover:bg-amber-200 dark:hover:bg-amber-800/60 transition-colors w-fit text-left"
                                title="Click to view and resolve this duplicate group"
                              >
                                <GitMerge className="w-2.5 h-2.5 shrink-0" />
                                Group #{dupInfo.groupIndex + 1}
                                {dupInfo.isPrimary ? (
                                  <span className="text-[9px] uppercase tracking-wider text-emerald-700 dark:text-emerald-400 font-extrabold">• Primary</span>
                                ) : (
                                  <span className="text-[9px] uppercase tracking-wider text-amber-700 dark:text-amber-400 font-medium">• Duplicate</span>
                                )}
                              </button>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="p-4 text-slate-600 dark:text-slate-300">
                        <span className={dupInfo && !dupInfo.isPrimary && teacher.email?.includes('.@') ? 'text-red-500 line-through' : ''}>
                          {teacher.email}
                        </span>
                      </td>
                      <td className="p-4">
                        <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 capitalize">
                          {teacher.teacher_type}
                        </span>
                      </td>
                      <td className="p-4 align-top">
                          {renderAllocations(teacher.allocations)}
                      </td>
                      <td className="p-4 text-right space-x-1.5 flex justify-end items-start h-full pt-6">
                        {dupInfo && (
                          <button 
                            onClick={() => openDuplicateResolver(dupInfo.groupIndex)}
                            className="p-2 text-amber-600 hover:bg-amber-100 dark:text-amber-400 dark:hover:bg-amber-900/30 rounded-lg transition-colors"
                            title="Resolve & Merge this Duplicate Group"
                          >
                            <GitMerge className="w-4 h-4" />
                          </button>
                        )}
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
                  );
                })
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

      {/* Duplicate Teachers Resolver Modal */}
      {isDuplicateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm transition-opacity animate-in fade-in">
          <div className="bg-white dark:bg-[#1a1a1a] rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden border border-slate-200 dark:border-white/10 shadow-2xl flex flex-col">
            
            {/* Modal Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between p-5 border-b border-slate-200 dark:border-white/5 gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                  <GitMerge className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">Faculty Duplicate Resolver</h3>
                    <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-700/50">
                      {duplicateGroups.length} Group{duplicateGroups.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Resolve duplicate entries and consolidate all course allocations into primary profiles.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 self-end sm:self-auto">
                {duplicateGroups.length > 0 && (
                  <button
                    onClick={handleInstantMergeAll}
                    disabled={isMerging}
                    className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white rounded-xl text-xs font-semibold flex items-center shadow-md transition-all disabled:opacity-50"
                    title="Instantly merge all duplicate groups into their primary records"
                  >
                    {isMerging ? (
                      <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                    ) : (
                      <Sparkles className="w-3.5 h-3.5 mr-1.5 text-amber-300" />
                    )}
                    Instant Merge All ({duplicateGroups.length})
                  </button>
                )}
                <button 
                  onClick={() => setIsDuplicateModalOpen(false)} 
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-white p-1 rounded-lg"
                >
                  <X className="w-5 h-5"/>
                </button>
              </div>
            </div>

            {/* In-progress banner */}
            {isMerging && (
              <div className="bg-indigo-50 dark:bg-indigo-950/40 border-b border-indigo-100 dark:border-indigo-900/40 p-3.5 flex items-center justify-center gap-3 text-sm text-indigo-800 dark:text-indigo-200">
                <Loader2 className="w-4 h-4 animate-spin text-indigo-600 dark:text-indigo-400 shrink-0" />
                <span className="font-medium text-xs sm:text-sm">{mergeProgress || 'Processing merges safely...'}</span>
              </div>
            )}

            {/* Filter mode header if focused on single group */}
            {selectedDuplicateGroupIndex !== null && duplicateGroups[selectedDuplicateGroupIndex] && (
              <div className="px-5 py-2.5 bg-slate-50 dark:bg-black/30 border-b border-slate-100 dark:border-white/5 flex items-center justify-between text-xs">
                <span className="text-slate-600 dark:text-slate-400 font-medium">
                  Showing Group #{selectedDuplicateGroupIndex + 1} of {duplicateGroups.length}
                </span>
                <button 
                  onClick={() => setSelectedDuplicateGroupIndex(null)}
                  className="text-blue-600 dark:text-blue-400 hover:underline font-semibold"
                >
                  View All {duplicateGroups.length} Groups
                </button>
              </div>
            )}

            {/* Modal Content */}
            <div className="flex-1 overflow-y-auto p-5 sm:p-6 bg-slate-50/50 dark:bg-black/20 custom-scrollbar space-y-5">
              {duplicateGroups.length === 0 ? (
                <div className="py-16 flex flex-col items-center justify-center text-center">
                  <div className="w-16 h-16 rounded-2xl bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-4 shadow-sm">
                    <CheckCircle className="w-8 h-8" />
                  </div>
                  <h4 className="text-lg font-bold text-slate-800 dark:text-white">All Duplicates Resolved!</h4>
                  <p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm mt-1">
                    Every faculty member currently has a clean, unique record. No duplicate names or email addresses exist.
                  </p>
                </div>
              ) : (
                <>
                  <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/40 rounded-xl p-3.5 flex items-start gap-3 text-xs text-amber-900 dark:text-amber-200">
                    <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-semibold">Allocation Preservation Guarantee:</span> When you merge a group, all course and timetable allocations from every duplicate record are combined into your designated <strong>Primary</strong> record before redundant records are removed.
                    </div>
                  </div>

                  {/* Duplicate Groups Cards */}
                  <div className="space-y-4">
                    {(selectedDuplicateGroupIndex !== null && duplicateGroups[selectedDuplicateGroupIndex]
                      ? [{ group: duplicateGroups[selectedDuplicateGroupIndex], idx: selectedDuplicateGroupIndex }]
                      : duplicateGroups.map((group, idx) => ({ group, idx }))
                    ).map(({ group, idx }) => {
                      const primaryId = selectedPrimaries[group.key] || group.primaryCandidateId;
                      const primaryTeacher = group.teachers.find(t => t.id === primaryId) || group.teachers[0];
                      const totalGroupAllocs = group.teachers.reduce((sum, t) => sum + (t.allocations?.length || 0), 0);

                      return (
                        <div 
                          key={group.key}
                          className="border border-slate-200 dark:border-white/10 rounded-2xl bg-white dark:bg-[#111111] overflow-hidden shadow-sm"
                        >
                          {/* Group Header */}
                          <div className="p-4 bg-slate-50/80 dark:bg-white/[0.03] border-b border-slate-200 dark:border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="px-2 py-0.5 rounded-md text-xs font-bold bg-slate-200 dark:bg-white/10 text-slate-700 dark:text-slate-300">
                                Group #{idx + 1}
                              </span>
                              <h4 className="font-bold text-slate-900 dark:text-white text-sm sm:text-base">
                                {group.name}
                              </h4>
                              <span className="text-xs text-slate-500 dark:text-slate-400">
                                ({group.teachers.length} entries)
                              </span>
                              <div className="flex flex-wrap gap-1 ml-1">
                                {group.reasons.map(reason => (
                                  <span key={reason} className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
                                    {reason}
                                  </span>
                                ))}
                              </div>
                            </div>

                            <button
                              onClick={() => handleMergeSingleGroup(group)}
                              disabled={isMerging}
                              className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-colors self-start sm:self-auto disabled:opacity-50"
                            >
                              <GitMerge className="w-3.5 h-3.5" />
                              Merge Group
                            </button>
                          </div>

                          {/* Candidates Grid */}
                          <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                            {group.teachers.map(t => {
                              const isPrimary = t.id === primaryId;
                              const hasAllocations = t.allocations && t.allocations.length > 0;

                              return (
                                <div
                                  key={t.id}
                                  onClick={() => setSelectedPrimaries({ ...selectedPrimaries, [group.key]: t.id })}
                                  className={`p-3.5 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                                    isPrimary 
                                      ? 'border-emerald-500 bg-emerald-50/40 dark:bg-emerald-950/20 shadow-sm ring-1 ring-emerald-500' 
                                      : 'border-slate-200 dark:border-white/10 bg-slate-50/60 dark:bg-white/[0.02] hover:border-slate-300 dark:hover:border-white/20'
                                  }`}
                                >
                                  <div>
                                    <div className="flex items-center justify-between gap-2 mb-2">
                                      <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-800 dark:text-slate-200">
                                        <input
                                          type="radio"
                                          name={`primary-${group.key}`}
                                          checked={isPrimary}
                                          onChange={() => setSelectedPrimaries({ ...selectedPrimaries, [group.key]: t.id })}
                                          className="text-emerald-600 focus:ring-emerald-500 h-3.5 w-3.5"
                                        />
                                        ID #{t.id}
                                      </label>

                                      {isPrimary ? (
                                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300 flex items-center gap-1">
                                          <Check className="w-3 h-3" /> Keep as Primary
                                        </span>
                                      ) : (
                                        <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-200 dark:bg-white/10 text-slate-600 dark:text-slate-400">
                                          Merge & Delete
                                        </span>
                                      )}
                                    </div>

                                    <div className="space-y-1">
                                      <p className="font-bold text-sm text-slate-900 dark:text-white truncate">
                                        {t.full_name}
                                      </p>
                                      <p className={`text-xs truncate ${!isPrimary && t.email?.includes('.@') ? 'text-red-500 line-through' : 'text-slate-600 dark:text-slate-300'}`}>
                                        {t.email}
                                      </p>
                                      <span className="inline-block px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-400 capitalize">
                                        {t.teacher_type}
                                      </span>
                                    </div>
                                  </div>

                                  {/* Allocations summary in candidate card */}
                                  <div className="mt-3 pt-2.5 border-t border-slate-200 dark:border-white/10">
                                    {hasAllocations ? (
                                      <div>
                                        <p className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1">
                                          <BookOpen className="w-3 h-3 text-indigo-500" />
                                          {t.allocations.length} Class Allocation{t.allocations.length !== 1 ? 's' : ''}:
                                        </p>
                                        <div className="flex flex-wrap gap-1">
                                          {t.allocations.slice(0, 3).map((a, aIdx) => (
                                            <span key={aIdx} className="px-1.5 py-0.5 rounded bg-white dark:bg-white/10 border border-slate-200 dark:border-white/10 text-[9.5px] font-medium text-slate-700 dark:text-slate-300">
                                              {a.course_code} ({a.stream} Sem {a.semester})
                                            </span>
                                          ))}
                                          {t.allocations.length > 3 && (
                                            <span className="px-1.5 py-0.5 text-[10px] text-slate-400">
                                              +{t.allocations.length - 3} more
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                    ) : (
                                      <p className="text-[11px] text-slate-400 italic">No class allocations assigned</p>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>

                          {/* Group Footer Summary */}
                          <div className="px-4 py-2.5 bg-slate-50 dark:bg-white/[0.02] border-t border-slate-100 dark:border-white/5 text-xs text-slate-600 dark:text-slate-400 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                            <span>
                              Result after merge: <strong>{primaryTeacher.full_name}</strong> will retain all <strong>{totalGroupAllocs}</strong> class allocation{totalGroupAllocs !== 1 ? 's' : ''}.
                            </span>
                            <span className="text-[11px] text-slate-400">
                              {group.teachers.length - 1} redundant record{group.teachers.length - 1 !== 1 ? 's' : ''} will be deleted.
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>

            {/* Modal Bottom Action Bar */}
            <div className="p-4 sm:p-5 border-t border-slate-200 dark:border-white/5 bg-white dark:bg-[#1a1a1a] flex flex-col sm:flex-row justify-between items-center gap-3">
              <div className="text-xs text-slate-500 dark:text-slate-400">
                {duplicateGroups.length > 0 ? (
                  <span>
                    Total <strong>{duplicateGroups.reduce((acc, g) => acc + g.teachers.length, 0)} teachers</strong> in <strong>{duplicateGroups.length} duplicate groups</strong>.
                  </span>
                ) : (
                  <span>Faculty roster is clean and unified.</span>
                )}
              </div>

              <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
                <button
                  onClick={() => setIsDuplicateModalOpen(false)}
                  className="px-4 py-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 rounded-xl font-medium text-xs sm:text-sm transition-colors"
                >
                  Close
                </button>

                {duplicateGroups.length > 0 && (
                  <button
                    onClick={handleInstantMergeAll}
                    disabled={isMerging}
                    className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold text-xs sm:text-sm flex items-center shadow-md transition-all disabled:opacity-50"
                  >
                    {isMerging ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Sparkles className="w-4 h-4 mr-2 text-amber-300" />
                    )}
                    Instant Merge All ({duplicateGroups.length})
                  </button>
                )}
              </div>
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