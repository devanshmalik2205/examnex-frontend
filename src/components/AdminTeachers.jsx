import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Plus, Edit2, Trash2, BookOpen, X, Loader2, Search,
  FileSpreadsheet, UploadCloud, AlertTriangle, CheckCircle, Users, Download, ChevronDown,
  GitMerge, Sparkles, Filter, Check, ShieldCheck, RefreshCw, BookMarked, GraduationCap,
  Award, Phone, Building2, Wrench, Info
} from 'lucide-react';
import * as XLSX from 'xlsx';

// All canonical roles across Academic Faculty, Lab/Technical Staff, Visiting Faculty, and PhD Scholars
const TEACHER_ROLES = [
  "Professor",
  "Associate Professor",
  "Assistant Professor - I",
  "Assistant Professor - II",
  "Assistant Professor - III",
  "Assistant Professor",
  "Professor of Practice",
  "Adjunct Industry Professor",
  "Faculty Associate",
  "Visiting Faculty",
  "Coding Skill Faculty",
  "Lab Superintendent",
  "Senior Lab Technician",
  "Lab Supervisor",
  "Lab Technician",
  "Lab Assistant",
  "Engineer",
  "PhD Scholar"
];

// All departments from Faculty, Lab Staff, and PhD Scholar sheets
const DEPARTMENT_OPTIONS = [
  "AS",
  "CSE",
  "Coding Skill Faculty CSE",
  "ECE",
  "ECOM",
  "ECOMP",
  "I&E",
  "LLA",
  "ME",
  "VF",
  "SOET",
  "SOET-LABCSE",
  "SOET-LABECE",
  "SOET-LABMECH",
  "SOET-LABPHY",
  "SOET-LABCHEM",
  "SOET (Language Lab)",
  "BMU-CAMD"
];

// Aesthetic color mappings for roles
const getRoleBadgeStyle = (role) => {
  const normalizedRole = role?.toLowerCase() || '';
  if (normalizedRole.includes('assistant professor -')) {
    return 'bg-sky-100 text-sky-700 border-sky-200 dark:bg-sky-500/10 dark:text-sky-400 dark:border-sky-500/20';
  }
  if (normalizedRole === 'assistant professor') {
    return 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/20';
  }
  if (normalizedRole === 'associate professor') {
    return 'bg-indigo-100 text-indigo-700 border-indigo-200 dark:bg-indigo-500/10 dark:text-indigo-400 dark:border-indigo-500/20';
  }
  if (normalizedRole === 'professor') {
    return 'bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-500/10 dark:text-purple-400 dark:border-purple-500/20';
  }
  if (normalizedRole.includes('practice') || normalizedRole.includes('adjunct')) {
    return 'bg-fuchsia-100 text-fuchsia-700 border-fuchsia-200 dark:bg-fuchsia-500/10 dark:text-fuchsia-400 dark:border-fuchsia-500/20';
  }
  if (normalizedRole.includes('visiting') || normalizedRole.includes('coding skill')) {
    return 'bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-500/10 dark:text-rose-400 dark:border-rose-500/20';
  }
  if (normalizedRole.includes('associate')) {
    return 'bg-teal-100 text-teal-700 border-teal-200 dark:bg-teal-500/10 dark:text-teal-400 dark:border-teal-500/20';
  }
  if (normalizedRole.includes('lab') || normalizedRole.includes('engineer')) {
    return 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20';
  }
  if (normalizedRole.includes('phd') || normalizedRole.includes('scholar')) {
    return 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20';
  }
  return 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-white/10 dark:text-slate-300 dark:border-white/20';
};

// Client-side validation helper for teacher/staff forms
const validateTeacherInput = (teacher) => {
  const errors = [];
  if (!teacher.full_name || teacher.full_name.trim().length < 2) {
    errors.push('Full Name must be at least 2 characters long.');
  }
  if (teacher.contact_no && teacher.contact_no.trim() !== '') {
    const parts = teacher.contact_no
      .split(/[\/,;]+/)
      .map(p => p.replace(/[^0-9+]/g, '').trim())
      .filter(Boolean);
    const badNumbers = parts.filter(p => {
      const digits = p.replace(/^\+?91/, '');
      return digits.length < 10 || digits.length > 12;
    });
    if (badNumbers.length > 0) {
      errors.push(`Invalid 10-digit contact number(s): ${badNumbers.join(', ')}`);
    }
  }
  return errors;
};

export default function AdminTeachers() {
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRoleFilter, setSelectedRoleFilter] = useState('ALL');
  const [selectedDeptFilter, setSelectedDeptFilter] = useState('ALL');

  // Modals state
  const [isTeacherModalOpen, setTeacherModalOpen] = useState(false);
  const [isAllocationModalOpen, setAllocationModalOpen] = useState(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);

  // Non-blocking Toast & Confirmation dialog states
  const [toast, setToast] = useState(null);
  const [confirmDialog, setConfirmDialog] = useState({
    isOpen: false,
    title: '',
    message: '',
    confirmLabel: 'Confirm',
    variant: 'danger',
    onConfirm: null
  });

  // Forms state
  const [currentTeacher, setCurrentTeacher] = useState({
    full_name: '',
    email: '',
    teacher_type: 'Assistant Professor',
    department: '',
    contact_no: ''
  });
  const [formErrors, setFormErrors] = useState([]);
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

  const showNotification = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(prev => (prev?.message === message ? null : prev));
    }, 4000);
  };

  const requestConfirm = ({ title, message, confirmLabel = 'Confirm', variant = 'danger', onConfirm }) => {
    setConfirmDialog({
      isOpen: true,
      title,
      message,
      confirmLabel,
      variant,
      onConfirm
    });
  };

  const closeConfirm = () => {
    setConfirmDialog(prev => ({ ...prev, isOpen: false, onConfirm: null }));
  };

  const getApiBase = () => {
    const backendUrl = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_BACKEND_URL) || 'http://localhost:5000';
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
      setAllocationOptions({
        courses: Array.isArray(data?.courses) ? data.courses : [],
        sections: Array.isArray(data?.sections) ? data.sections : []
      });
    } catch (error) {
      console.error("Failed to fetch allocation options", error);
    }
  };

  const handleSaveTeacher = async (e) => {
    e.preventDefault();
    const validationErrors = validateTeacherInput(currentTeacher);
    if (validationErrors.length > 0) {
      setFormErrors(validationErrors);
      return;
    }
    setFormErrors([]);

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
        showNotification(currentTeacher.id ? 'Profile updated successfully.' : 'New member added successfully.');
      } else {
        const errorData = await res.json();
        setFormErrors([errorData.error || 'Failed to save teacher']);
      }
    } catch (error) {
      console.error("Error saving teacher", error);
      setFormErrors(['An error occurred while saving.']);
    }
  };

  const handleDeleteTeacher = (id, name) => {
    requestConfirm({
      title: 'Delete Member Profile',
      message: `Are you sure you want to delete ${name || 'this member'}? This will also remove their subject allocations.`,
      confirmLabel: 'Delete Profile',
      variant: 'danger',
      onConfirm: async () => {
        closeConfirm();
        try {
          const res = await fetch(`${getApiBase()}/admin/teachers/${id}`, { method: 'DELETE' });
          if (res.ok) {
            fetchTeachers();
            showNotification('Profile deleted successfully.');
          } else {
            showNotification('Failed to delete member profile.', 'error');
          }
        } catch (error) {
          console.error("Error deleting teacher", error);
          showNotification('Error deleting member profile.', 'error');
        }
      }
    });
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
      showNotification('Failed to load allocations.', 'error');
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
        fetchTeachers();
        showNotification('Subject allocations saved successfully.');
      } else {
        showNotification('Failed to save allocations.', 'error');
      }
    } catch (error) {
      console.error("Error saving allocations", error);
      showNotification('An error occurred saving allocations.', 'error');
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
      showNotification('Cannot add allocation: Please ensure courses and timetables are created first.', 'error');
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

  const updatePreviewRow = (index, field, value) => {
    if (!previewData || !previewData.preview?.teachers) return;
    const updatedList = [...previewData.preview.teachers];
    updatedList[index] = { ...updatedList[index], [field]: value };
    setPreviewData({
      ...previewData,
      preview: { ...previewData.preview, teachers: updatedList }
    });
  };

  const removePreviewRow = (index) => {
    if (!previewData || !previewData.preview?.teachers) return;
    const updatedList = previewData.preview.teachers.filter((_, idx) => idx !== index);
    setPreviewData({
      ...previewData,
      preview: { ...previewData.preview, teachers: updatedList }
    });
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

      const count = previewData.preview?.teachers?.length || 0;
      setIsUploadModalOpen(false);
      setPreviewData(null);
      if (fileInputRef.current) fileInputRef.current.value = "";

      fetchTeachers();
      showNotification(`Successfully imported ${count} records!`);
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

  // Normalize email for duplicate detection
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

    let bestDept = primaryTeacher.department;
    if (!bestDept) {
      const deptMember = allMembers.find(m => m.department);
      if (deptMember) bestDept = deptMember.department;
    }

    let bestContact = primaryTeacher.contact_no;
    if (!bestContact) {
      const contactMember = allMembers.find(m => m.contact_no);
      if (contactMember) bestContact = contactMember.contact_no;
    }

    return {
      full_name: primaryTeacher.full_name,
      email: bestEmail || primaryTeacher.email,
      teacher_type: bestRole || primaryTeacher.teacher_type || 'Assistant Professor',
      department: bestDept || '',
      contact_no: bestContact || ''
    };
  };

  const mergeDuplicateGroup = async (primaryId, duplicateIds, preferredProfile) => {
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

    const saveRes = await fetch(`${getApiBase()}/admin/teachers/${primaryId}/allocations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ allocations: mergedAllocations })
    });

    if (!saveRes.ok) throw new Error(`Failed to update allocations for primary teacher ID: ${primaryId}`);

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

    for (const dupId of duplicateIds) {
      const delRes = await fetch(`${getApiBase()}/admin/teachers/${dupId}`, { method: 'DELETE' });
      if (!delRes.ok) console.warn(`Could not delete duplicate teacher ${dupId}`);
    }
  };

  const handleMergeSingleGroup = (group) => {
    const primaryId = selectedPrimaries[group.key] || group.primaryCandidateId;
    const primaryTeacher = group.teachers.find(t => t.id === primaryId) || group.teachers[0];
    const duplicateTeachers = group.teachers.filter(t => t.id !== primaryTeacher.id);
    const duplicateIds = duplicateTeachers.map(t => t.id);

    if (duplicateIds.length === 0) {
      showNotification("No duplicate entries to merge in this group.", "error");
      return;
    }

    requestConfirm({
      title: `Merge Group: ${group.name}`,
      message: `Merge ${duplicateIds.length} duplicate record(s) into Primary: ${primaryTeacher.full_name} (${primaryTeacher.email}). All class allocations will be preserved and redundant profiles will be deleted.`,
      confirmLabel: 'Merge Group',
      variant: 'primary',
      onConfirm: async () => {
        closeConfirm();
        setIsMerging(true);
        setMergeProgress(`Merging duplicate records for ${group.name}...`);
        try {
          const preferredProfile = getPreferredProfileForGroup(primaryTeacher, duplicateTeachers);
          await mergeDuplicateGroup(primaryTeacher.id, duplicateIds, preferredProfile);
          await fetchTeachers();
          showNotification(`Merged duplicate records for ${primaryTeacher.full_name}.`);
        } catch (err) {
          console.error('Error merging duplicate group:', err);
          showNotification(`Failed to merge duplicates: ${err.message}`, 'error');
        } finally {
          setIsMerging(false);
          setMergeProgress(null);
        }
      }
    });
  };

  const handleInstantMergeAll = () => {
    if (duplicateGroups.length === 0) return;

    const totalDupsToDelete = duplicateGroups.reduce((acc, g) => acc + (g.teachers.length - 1), 0);

    requestConfirm({
      title: 'Instant Merge All Duplicates',
      message: `Merge all ${duplicateGroups.length} duplicate groups (${totalDupsToDelete} redundant records). All class and timetable allocations across duplicates will be safely preserved and merged into the selected primary records.`,
      confirmLabel: `Merge All (${duplicateGroups.length})`,
      variant: 'primary',
      onConfirm: async () => {
        closeConfirm();
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
          showNotification(`Successfully merged all ${successCount} duplicate groups!`);
        } catch (err) {
          console.error('Error during bulk merge:', err);
          showNotification(`An error occurred during instant merge: ${err.message}`, 'error');
          await fetchTeachers();
        } finally {
          setIsMerging(false);
          setMergeProgress(null);
        }
      }
    });
  };

  const openDuplicateResolver = (groupIndex = null) => {
    setSelectedDuplicateGroupIndex(groupIndex);
    setIsDuplicateModalOpen(true);
  };

  // Distinct departments present in data + predefined options
  const availableDepartments = useMemo(() => {
    const set = new Set(DEPARTMENT_OPTIONS);
    teachers.forEach(t => {
      if (t.department && t.department.trim()) set.add(t.department.trim());
    });
    return Array.from(set).sort();
  }, [teachers]);

  const filteredTeachers = useMemo(() => {
    const q = searchTerm.toLowerCase();
    let list = teachers.filter(t => {
      const matchesSearch =
        t.full_name?.toLowerCase().includes(q) ||
        t.email?.toLowerCase().includes(q) ||
        t.department?.toLowerCase().includes(q) ||
        t.contact_no?.toLowerCase().includes(q) ||
        t.teacher_type?.toLowerCase().includes(q);

      const matchesRole = selectedRoleFilter === 'ALL' || t.teacher_type === selectedRoleFilter;
      const matchesDept = selectedDeptFilter === 'ALL' || (t.department || '') === selectedDeptFilter;

      return matchesSearch && matchesRole && matchesDept;
    });

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
  }, [teachers, searchTerm, selectedRoleFilter, selectedDeptFilter, filterDuplicatesOnly, sortByDuplicates, teacherDuplicateMap]);

  // Snappy & Animative Grouped Allocations UI for the Main Table
  const renderAllocations = (allocations) => {
    if (!allocations || allocations.length === 0) {
      return <span className="text-slate-400 dark:text-slate-500 text-sm italic">No subjects assigned</span>;
    }

    const grouped = {};
    allocations.forEach(a => {
      const title = a.course_title || a.course_code;
      if (!grouped[title]) grouped[title] = new Set();
      grouped[title].add(`${a.stream} (Sem ${a.semester})`);
    });

    return (
      <div className="flex flex-col gap-2.5 max-h-40 overflow-y-auto custom-scrollbar pr-2 w-full min-w-[260px]">
        {Object.entries(grouped).map(([title, sections], i) => (
          <div key={i} className="group relative bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl p-3 hover:border-blue-300 dark:hover:border-blue-500/50 hover:shadow-sm transition-all duration-200">
            <div className="flex items-start gap-2.5">
              <BookMarked className="w-4 h-4 text-blue-500 mt-0.5 shrink-0 transition-transform group-hover:scale-110" />
              <div className="flex-1">
                <span className="font-semibold text-slate-800 dark:text-slate-200 text-sm leading-tight block mb-2">{title}</span>
                <div className="flex flex-wrap gap-1.5">
                  {Array.from(sections).map((sec, j) => (
                    <span key={j} className="px-2 py-0.5 bg-slate-100 dark:bg-black/40 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-white/10 rounded-md text-[10px] font-medium shadow-sm transition-colors group-hover:bg-blue-50 dark:group-hover:bg-blue-900/30 group-hover:text-blue-700 dark:group-hover:text-blue-300 group-hover:border-blue-200 dark:group-hover:border-blue-800/50">
                      {sec}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  };

  const handleDownload = (format) => {
    if (!filteredTeachers || filteredTeachers.length === 0) {
      showNotification("No data available to export.", "error");
      return;
    }

    const exportData = filteredTeachers.map(t => {
      const allocs = (t.allocations || []).map(a => `${a.course_code} (${a.stream} Sem ${a.semester})`).join(' | ');
      return {
        "Employee / Faculty Name": t.full_name,
        "EmailID": t.email,
        "Designation": t.teacher_type,
        "Department": t.department || "",
        "Contact No.": t.contact_no || "",
        "Allocations": allocs || "None"
      };
    });

    const fileName = `Teachers_Export_${new Date().toISOString().split('T')[0]}`;

    if (format === 'json') {
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${fileName}.json`;
      link.click();
      URL.revokeObjectURL(url);
    } else {
      const worksheet = XLSX.utils.json_to_sheet(exportData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Teachers");
      XLSX.writeFile(workbook, `${fileName}.${format}`);
    }
    showNotification(`Exported ${exportData.length} records as ${format.toUpperCase()}.`);
  };

  return (
    <div className="p-4 sm:p-6 w-full max-w-7xl mx-auto space-y-6 relative">
      {/* Non-blocking Toast Banner */}
      {toast && (
        <div className={`fixed bottom-5 right-5 z-[80] flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-lg border text-sm font-semibold animate-in slide-in-from-bottom-4 duration-200 ${
          toast.type === 'error'
            ? 'bg-red-50 dark:bg-red-950/90 text-red-700 dark:text-red-200 border-red-200 dark:border-red-800'
            : 'bg-emerald-50 dark:bg-emerald-950/90 text-emerald-700 dark:text-emerald-200 border-emerald-200 dark:border-emerald-800'
        }`}>
          {toast.type === 'error' ? <AlertTriangle className="w-4 h-4 shrink-0" /> : <CheckCircle className="w-4 h-4 shrink-0" />}
          <span>{toast.message}</span>
          <button onClick={() => setToast(null)} className="ml-2 opacity-70 hover:opacity-100">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Header & Top Action Controls */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Users className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            Teachers, Lab Staff & Scholars Management
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
            Validate and manage faculty, lab technicians/supervisors, visiting faculty, and PhD scholars.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row w-full lg:w-auto items-center gap-3">
          {/* Resolve Duplicates Button */}
          {duplicateGroups.length > 0 ? (
            <button
              onClick={() => openDuplicateResolver(null)}
              className="w-full sm:w-auto flex items-center justify-center px-4 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-sm border bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/40 dark:hover:bg-amber-900/50 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-700/60 active:scale-95"
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
              className="w-full sm:w-auto flex items-center justify-center px-4 py-2.5 rounded-xl text-sm font-medium transition-all shadow-sm border bg-white dark:bg-[#1a1a1a] border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 active:scale-95"
            >
              <Download className="w-4 h-4 mr-2" />
              Export
              <ChevronDown className={`w-4 h-4 ml-2 transition-transform duration-200 ${showDownload ? 'rotate-180' : ''}`} />
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
            className="w-full sm:w-auto flex-1 sm:flex-none bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center justify-center shadow-sm active:scale-95"
          >
            <FileSpreadsheet className="w-4 h-4 mr-2" /> Bulk Upload
          </button>
          <button
            onClick={() => {
              setFormErrors([]);
              setCurrentTeacher({
                full_name: '',
                email: '',
                teacher_type: 'Assistant Professor',
                department: '',
                contact_no: ''
              });
              setTeacherModalOpen(true);
            }}
            className="w-full sm:w-auto flex-1 sm:flex-none flex items-center justify-center px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold transition-all shadow-sm active:scale-95"
          >
            <Plus className="w-4 h-4 mr-2" /> Add Member
          </button>
        </div>
      </div>

      {}
      <div className="flex flex-col xl:flex-row gap-3 items-stretch xl:items-center justify-between">
        <div className="flex flex-col sm:flex-row gap-3 flex-1">
          <div className="flex items-center flex-1 bg-white dark:bg-[#111111] p-2 rounded-xl border border-slate-200 dark:border-white/5 shadow-sm focus-within:ring-2 focus-within:ring-blue-500/20 transition-all">
            <Search className="w-5 h-5 text-slate-400 ml-2 shrink-0" />
            <input
              type="text"
              placeholder="Search by name, email, department, designation, or contact..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1 bg-transparent border-none outline-none px-3 py-1.5 text-sm text-slate-700 dark:text-white placeholder-slate-400"
            />
            {searchTerm && (
              <button onClick={() => setSearchTerm('')} className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 mr-1 transition-colors">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Role Filter */}
          <div className="relative min-w-[195px]">
            <select
              value={selectedRoleFilter}
              onChange={(e) => setSelectedRoleFilter(e.target.value)}
              className="w-full pl-3.5 pr-9 py-2.5 bg-white dark:bg-[#111111] border border-slate-200 dark:border-white/5 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 outline-none appearance-none shadow-sm cursor-pointer"
            >
              <option value="ALL">All Designations ({teachers.length})</option>
              {TEACHER_ROLES.map(r => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          </div>

          {/* Department Filter */}
          <div className="relative min-w-[165px]">
            <select
              value={selectedDeptFilter}
              onChange={(e) => setSelectedDeptFilter(e.target.value)}
              className="w-full pl-3.5 pr-9 py-2.5 bg-white dark:bg-[#111111] border border-slate-200 dark:border-white/5 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 outline-none appearance-none shadow-sm cursor-pointer"
            >
              <option value="ALL">All Departments</option>
              {availableDepartments.map(d => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="bg-slate-100 dark:bg-white/5 p-1 rounded-xl flex items-center border border-slate-200 dark:border-white/5 text-xs font-medium">
            <button
              onClick={() => setFilterDuplicatesOnly(false)}
              className={`px-3 py-1.5 rounded-lg transition-colors ${!filterDuplicatesOnly ? 'bg-white dark:bg-[#1a1a1a] text-slate-900 dark:text-white shadow-sm font-semibold' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}
            >
              All ({filteredTeachers.length})
            </button>
            <button
              onClick={() => { setFilterDuplicatesOnly(true); setSortByDuplicates(true); }}
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

          <button
            onClick={() => setSortByDuplicates(!sortByDuplicates)}
            className={`px-3.5 py-2 rounded-xl text-xs font-medium border transition-colors flex items-center gap-1.5 shadow-sm active:scale-95 ${sortByDuplicates ? 'bg-indigo-50 dark:bg-indigo-900/30 border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 font-semibold' : 'bg-white dark:bg-[#111111] border-slate-200 dark:border-white/5 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/5'}`}
            title="Cluster duplicate teachers together in table view"
          >
            <Filter className="w-3.5 h-3.5" />
            Sort Duplicates
            {sortByDuplicates && <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 dark:bg-indigo-400 animate-pulse"></span>}
          </button>
        </div>
      </div>

      {}
      <div className="bg-white dark:bg-[#111111] rounded-2xl border border-slate-200 dark:border-white/5 shadow-sm overflow-hidden animate-in fade-in duration-300">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/80 dark:bg-slate-900/50 border-b border-slate-200 dark:border-white/5 text-sm font-semibold text-slate-600 dark:text-slate-400">
                <th className="p-4 pl-6 whitespace-nowrap">Employee / Faculty</th>
                <th className="p-4 whitespace-nowrap">Designation & Dept</th>
                <th className="p-4 whitespace-nowrap">Contact & Email</th>
                <th className="p-4 min-w-[280px]">Allocated Subjects & Classes</th>
                <th className="p-4 pr-6 text-right whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-white/5">
              {loading ? (
                <tr>
                  <td colSpan="5" className="p-12 text-center text-slate-500">
                    <Loader2 className="w-8 h-8 animate-spin mx-auto text-blue-500 mb-3" />
                    <p>Loading Faculty & Staff...</p>
                  </td>
                </tr>
              ) : filteredTeachers.length === 0 ? (
                <tr>
                  <td colSpan="5" className="p-12 text-center text-slate-500">
                    <div className="mx-auto w-16 h-16 bg-slate-100 dark:bg-white/5 rounded-full flex items-center justify-center mb-4">
                      <Search className="w-8 h-8 text-slate-400" />
                    </div>
                    <p className="text-lg font-medium text-slate-700 dark:text-slate-300">No matching records found.</p>
                    <p className="text-sm mt-1">Try adjusting your filters or bulk upload your spreadsheet.</p>
                  </td>
                </tr>
              ) : (
                filteredTeachers.map(teacher => {
                  const dupInfo = teacherDuplicateMap.get(teacher.id);
                  const roleStyle = getRoleBadgeStyle(teacher.teacher_type);
                  const isLabRole = (teacher.teacher_type || '').toLowerCase().includes('lab') || (teacher.teacher_type || '').toLowerCase().includes('engineer');

                  return (
                    <tr
                      key={teacher.id}
                      className={`hover:bg-slate-50/80 dark:hover:bg-slate-900/30 transition-colors group ${dupInfo ? 'bg-amber-500/[0.04] dark:bg-amber-500/[0.07] border-l-4 border-l-amber-500' : ''}`}
                    >
                      <td className="p-4 pl-6 font-medium text-slate-900 dark:text-white align-top pt-5">
                        <div className="flex items-start gap-3">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shrink-0 shadow-sm ${dupInfo ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' : 'bg-gradient-to-br from-blue-100 to-indigo-100 dark:from-blue-900/40 dark:to-indigo-900/40 text-blue-700 dark:text-blue-300 border border-blue-200/50 dark:border-blue-700/30'}`}>
                            {teacher.full_name?.charAt(0) || '?'}
                          </div>
                          <div className="flex flex-col gap-1 overflow-hidden pt-0.5">
                            <span className="truncate max-w-[200px] font-bold text-[15px]">{teacher.full_name}</span>
                            {dupInfo && (
                              <button
                                onClick={(e) => { e.stopPropagation(); openDuplicateResolver(dupInfo.groupIndex); }}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300 border border-amber-200 dark:border-amber-700/50 hover:bg-amber-200 dark:hover:bg-amber-800/60 transition-colors w-fit text-left mt-1"
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
                      <td className="p-4 align-top pt-5">
                        <div className="flex flex-col items-start gap-1.5">
                          <span className={`px-3 py-1 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 border ${roleStyle}`}>
                            {isLabRole ? <Wrench className="w-3.5 h-3.5" /> : <Award className="w-3.5 h-3.5" />}
                            {teacher.teacher_type}
                          </span>
                          {teacher.department && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-semibold bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-white/10">
                              <Building2 className="w-3 h-3 text-slate-400" />
                              {teacher.department}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="p-4 align-top pt-5 text-slate-600 dark:text-slate-300">
                        <div className="flex flex-col gap-1">
                          <span className={`text-sm font-medium ${dupInfo && !dupInfo.isPrimary && teacher.email?.includes('.@') ? 'text-red-500 line-through' : ''}`}>
                            {teacher.email || 'N/A'}
                          </span>
                          {teacher.contact_no ? (
                            <span className="inline-flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 font-medium">
                              <Phone className="w-3 h-3 text-emerald-500 shrink-0" />
                              {teacher.contact_no}
                            </span>
                          ) : (
                            <span className="text-xs text-slate-400 italic">No contact no.</span>
                          )}
                        </div>
                      </td>
                      <td className="p-4 align-top py-4">
                        {renderAllocations(teacher.allocations)}
                      </td>
                      <td className="p-4 pr-6 text-right space-x-1.5 flex justify-end items-start h-full pt-5 opacity-80 group-hover:opacity-100 transition-opacity">
                        {dupInfo && (
                          <button
                            onClick={() => openDuplicateResolver(dupInfo.groupIndex)}
                            className="p-2 text-amber-600 hover:bg-amber-100 dark:text-amber-400 dark:hover:bg-amber-900/30 rounded-xl transition-all hover:scale-105 active:scale-95"
                            title="Resolve & Merge this Duplicate Group"
                          >
                            <GitMerge className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          onClick={() => openAllocationModal(teacher)}
                          className="p-2 text-indigo-600 hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-indigo-900/30 rounded-xl transition-all hover:scale-105 active:scale-95"
                          title="Edit Allocations & Subjects"
                        >
                          <BookOpen className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                            setFormErrors([]);
                            setCurrentTeacher({
                              ...teacher,
                              department: teacher.department || '',
                              contact_no: teacher.contact_no || ''
                            });
                            setTeacherModalOpen(true);
                          }}
                          className="p-2 text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/30 rounded-xl transition-all hover:scale-105 active:scale-95"
                          title="Edit Profile"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteTeacher(teacher.id, teacher.full_name)}
                          className="p-2 text-red-500 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/30 rounded-xl transition-all hover:scale-105 active:scale-95"
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

      {}
      {isTeacherModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-[#1a1a1a] rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden border border-slate-200 dark:border-white/10 animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center p-5 border-b border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-white/[0.02]">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg">
                  <GraduationCap className="w-5 h-5" />
                </div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  {currentTeacher.id ? 'Edit Faculty / Staff Profile' : 'Add Faculty / Staff / Scholar'}
                </h3>
              </div>
              <button onClick={() => setTeacherModalOpen(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-white/10">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveTeacher} className="p-6 space-y-4">
              {formErrors.length > 0 && (
                <div className="p-3.5 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/40 text-red-700 dark:text-red-300 text-xs font-medium space-y-1">
                  {formErrors.map((err, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                      <span>{err}</span>
                    </div>
                  ))}
                </div>
              )}

              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Full Name *</label>
                <input
                  required
                  type="text"
                  value={currentTeacher.full_name || ''}
                  onChange={e => setCurrentTeacher({ ...currentTeacher, full_name: e.target.value })}
                  placeholder="e.g. Dr. Abhimanyu Singh Rana / AMIT GAUTAM / Nishu"
                  className="w-full px-4 py-2.5 bg-white dark:bg-black/50 border border-slate-300 dark:border-white/10 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:text-white outline-none transition-all shadow-sm text-sm"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Designation / Role *</label>
                  <div className="relative">
                    <select
                      value={currentTeacher.teacher_type || 'Assistant Professor'}
                      onChange={e => setCurrentTeacher({ ...currentTeacher, teacher_type: e.target.value })}
                      className="w-full px-3.5 py-2.5 bg-white dark:bg-black/50 border border-slate-300 dark:border-white/10 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:text-white outline-none transition-all shadow-sm appearance-none pr-9 text-sm"
                    >
                      {TEACHER_ROLES.map(role => (
                        <option key={role} value={role}>{role}</option>
                      ))}
                      {!TEACHER_ROLES.includes(currentTeacher.teacher_type) && currentTeacher.teacher_type && (
                        <option value={currentTeacher.teacher_type}>{currentTeacher.teacher_type}</option>
                      )}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Department</label>
                  <input
                    type="text"
                    list="department-presets"
                    value={currentTeacher.department || ''}
                    onChange={e => setCurrentTeacher({ ...currentTeacher, department: e.target.value })}
                    placeholder="e.g. CSE, AS, SOET-LABMECH, VF"
                    className="w-full px-3.5 py-2.5 bg-white dark:bg-black/50 border border-slate-300 dark:border-white/10 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:text-white outline-none transition-all shadow-sm text-sm"
                  />
                  <datalist id="department-presets">
                    {availableDepartments.map(dept => (
                      <option key={dept} value={dept} />
                    ))}
                  </datalist>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Contact No.</label>
                  <input
                    type="text"
                    value={currentTeacher.contact_no || ''}
                    onChange={e => setCurrentTeacher({ ...currentTeacher, contact_no: e.target.value })}
                    placeholder="e.g. 9837752718 / 7503677120"
                    className="w-full px-3.5 py-2.5 bg-white dark:bg-black/50 border border-slate-300 dark:border-white/10 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:text-white outline-none transition-all shadow-sm text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Email Address (@bmu.edu.in)</label>
                  <input
                    type="text"
                    value={currentTeacher.email || ''}
                    onChange={e => setCurrentTeacher({ ...currentTeacher, email: e.target.value })}
                    placeholder="Auto-generated if left blank"
                    className="w-full px-3.5 py-2.5 bg-white dark:bg-black/50 border border-slate-300 dark:border-white/10 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:text-white outline-none transition-all shadow-sm text-sm"
                  />
                </div>
              </div>

              <div className="pt-5 border-t border-slate-100 dark:border-white/5 flex justify-end gap-3">
                <button type="button" onClick={() => setTeacherModalOpen(false)} className="px-5 py-2.5 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 rounded-xl transition-colors">Cancel</button>
                <button type="submit" className="px-6 py-2.5 text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-sm transition-all active:scale-95 flex items-center">
                  <CheckCircle className="w-4 h-4 mr-2" /> Save Profile
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {}
      {isAllocationModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-[#1a1a1a] rounded-2xl w-full max-w-3xl shadow-2xl overflow-hidden border border-slate-200 dark:border-white/10 flex flex-col max-h-[90vh] animate-in slide-in-from-bottom-8 duration-300">
            {/* Header */}
            <div className="flex justify-between items-center p-6 border-b border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-white/[0.02]">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-xl flex items-center justify-center shadow-sm">
                  <BookOpen className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-slate-900 dark:text-white">Subject Allocations</h3>
                  <div className="flex items-center gap-2 mt-0.5">
                    <p className="text-sm text-slate-500 font-medium">Editing load for <span className="text-indigo-600 dark:text-indigo-400">{currentTeacher.full_name}</span></p>
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-slate-600"></span>
                    <span className="text-xs font-bold px-2 py-0.5 bg-slate-200 dark:bg-white/10 text-slate-600 dark:text-slate-300 rounded-md">
                      {currentAllocations.length} Class{currentAllocations.length !== 1 ? 'es' : ''} Assigned
                    </span>
                  </div>
                </div>
              </div>
              <button onClick={() => setAllocationModalOpen(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-white p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-white/10 transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* List Body */}
            <div className="p-6 overflow-y-auto flex-1 bg-slate-50/30 dark:bg-black/10 custom-scrollbar relative">
              {currentAllocations.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center py-16 animate-in zoom-in-95 duration-300">
                  <div className="w-20 h-20 bg-slate-100 dark:bg-white/5 rounded-full flex items-center justify-center mb-5">
                    <BookMarked className="w-10 h-10 text-slate-300 dark:text-slate-600" />
                  </div>
                  <h4 className="text-lg font-bold text-slate-800 dark:text-slate-200">No Subjects Assigned</h4>
                  <p className="text-slate-500 dark:text-slate-400 mt-2 max-w-sm">This member does not have any classes allocated to them yet.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {currentAllocations.map((alloc, idx) => (
                    <div
                      key={idx}
                      className="group flex flex-col sm:flex-row gap-4 items-start sm:items-center p-4 bg-white dark:bg-[#111111] border border-slate-200 dark:border-white/10 rounded-2xl shadow-sm hover:shadow-md hover:border-indigo-300 dark:hover:border-indigo-500/40 transition-all duration-200 animate-in slide-in-from-bottom-2"
                      style={{ animationDelay: `${idx * 50}ms`, animationFillMode: 'both' }}
                    >
                      <div className="hidden sm:flex w-10 h-10 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-500 rounded-xl items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                        <span className="text-sm font-bold">{idx + 1}</span>
                      </div>

                      <div className="flex-1 w-full flex flex-col gap-1.5 relative">
                        <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Course / Subject</label>
                        <div className="relative">
                          <select
                            value={alloc.course_id || ''}
                            onChange={(e) => updateAllocation(idx, 'course_id', e.target.value)}
                            className="w-full pl-3 pr-10 py-2.5 bg-slate-50 dark:bg-black/50 border border-slate-200 dark:border-white/10 rounded-xl text-sm font-semibold text-slate-800 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none appearance-none hover:bg-slate-100 dark:hover:bg-white/5 transition-colors cursor-pointer"
                          >
                            {allocationOptions.courses.map(c => (
                              <option key={c.id} value={c.id}>{c.course_title} ({c.course_code})</option>
                            ))}
                          </select>
                          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                        </div>
                      </div>

                      <div className="hidden sm:block shrink-0 mt-6">
                        <div className="w-6 border-b-2 border-dashed border-slate-300 dark:border-slate-600"></div>
                      </div>

                      <div className="flex-1 w-full flex flex-col gap-1.5 relative">
                        <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Class / Timetable</label>
                        <div className="relative">
                          <select
                            value={alloc.timetable_id || ''}
                            onChange={(e) => updateAllocation(idx, 'timetable_id', e.target.value)}
                            className="w-full pl-3 pr-10 py-2.5 bg-slate-50 dark:bg-black/50 border border-slate-200 dark:border-white/10 rounded-xl text-sm font-medium text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none appearance-none hover:bg-slate-100 dark:hover:bg-white/5 transition-colors cursor-pointer"
                          >
                            {allocationOptions.sections.map(s => (
                              <option key={s.id} value={s.id}>{s.name}</option>
                            ))}
                          </select>
                          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                        </div>
                      </div>

                      <button
                        onClick={() => removeAllocationRow(idx)}
                        className="mt-6 sm:mt-5 p-2.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl shrink-0 transition-colors self-end sm:self-auto"
                        title="Remove this class"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <button
                onClick={addAllocationRow}
                className="mt-6 flex items-center justify-center w-full py-4 border-2 border-dashed border-indigo-200 dark:border-indigo-900/50 bg-indigo-50/50 dark:bg-indigo-900/10 text-indigo-600 dark:text-indigo-400 hover:border-indigo-400 hover:bg-indigo-100/50 dark:hover:border-indigo-500/50 dark:hover:bg-indigo-900/30 rounded-2xl font-bold transition-all active:scale-[0.99] group"
              >
                <div className="p-1 bg-indigo-200 dark:bg-indigo-800 rounded-full mr-3 group-hover:scale-110 transition-transform">
                  <Plus className="w-4 h-4 text-indigo-700 dark:text-indigo-200" />
                </div>
                Add Another Class
              </button>
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-slate-100 dark:border-white/5 flex justify-between items-center bg-white dark:bg-[#1a1a1a]">
              <div className="text-xs font-medium text-slate-500 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-500" /> All changes require saving
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setAllocationModalOpen(false)}
                  disabled={savingAllocations}
                  className="px-5 py-2.5 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 rounded-xl disabled:opacity-50 transition-colors"
                >
                  Discard
                </button>
                <button
                  onClick={handleSaveAllocations}
                  disabled={savingAllocations}
                  className="px-6 py-2.5 text-sm font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-md hover:shadow-lg transition-all active:scale-95 flex items-center disabled:opacity-75 disabled:active:scale-100"
                >
                  {savingAllocations ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <BookOpen className="w-4 h-4 mr-2" />}
                  Save Allocations
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {}
      {isUploadModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm transition-opacity animate-in fade-in">
          <div className="bg-white dark:bg-[#1a1a1a] rounded-2xl w-full max-w-5xl max-h-[92vh] overflow-hidden border border-slate-200 dark:border-white/10 shadow-2xl flex flex-col animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center p-5 border-b border-slate-200 dark:border-white/5">
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center">
                  <FileSpreadsheet className="w-5 h-5 mr-2 text-emerald-500" /> Bulk Excel Validator & Importer
                </h3>
                <p className="text-sm text-slate-500 mt-1">
                  Supports Faculty Lists, Lab Staff sheets, Visiting Faculty, and PhD Scholars automatically.
                </p>
              </div>
              <button onClick={() => { setIsUploadModalOpen(false); setPreviewData(null); }} className="text-slate-400 hover:text-slate-600 dark:hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50 dark:bg-black/20 custom-scrollbar">
              {!previewData ? (
                <div className="h-full flex flex-col items-center justify-center space-y-4 py-8">
                  {uploadError && (
                    <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-3 rounded-xl flex items-center text-sm w-full max-w-md">
                      <AlertTriangle className="w-4 h-4 mr-2 flex-shrink-0" /> {uploadError}
                    </div>
                  )}
                  <label className={`w-full max-w-md aspect-video border-2 border-dashed rounded-2xl flex flex-col items-center justify-center cursor-pointer transition-all ${isUploading ? 'border-emerald-400 bg-emerald-50 dark:bg-emerald-900/20' : 'border-slate-300 dark:border-white/20 hover:border-emerald-500 hover:bg-slate-50 dark:hover:bg-white/5 active:scale-95'}`}>
                    <input type="file" accept=".xlsx, .xls, .csv" className="hidden" ref={fileInputRef} onChange={handleFileSelection} disabled={isUploading} />
                    {isUploading ? (
                      <>
                        <Loader2 className="w-10 h-10 animate-spin text-emerald-500 mb-4" />
                        <p className="text-sm font-bold text-emerald-700 dark:text-emerald-400">Validating & Normalizing Spreadsheet...</p>
                      </>
                    ) : (
                      <>
                        <UploadCloud className="w-12 h-12 text-slate-400 dark:text-slate-500 mb-4 transition-transform group-hover:scale-110" />
                        <p className="text-base font-bold text-slate-700 dark:text-slate-300">Click or Drag Excel / CSV file here</p>
                        <p className="text-xs text-slate-500 mt-2 text-center px-6 font-medium">
                          Automatically normalizes designations and maps departments, names, and contact numbers.
                        </p>
                      </>
                    )}
                  </label>
                </div>
              ) : (
                <div className="space-y-5 animate-in slide-in-from-bottom-4 duration-300">
                  {uploadError && (
                    <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-3 rounded-xl flex items-center text-sm">
                      <AlertTriangle className="w-4 h-4 mr-2 flex-shrink-0" /> {uploadError}
                    </div>
                  )}

                  {/* Summary Cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="bg-white dark:bg-[#111] border border-slate-200 dark:border-white/10 rounded-xl p-3.5 flex items-center gap-3">
                      <div className="p-2.5 rounded-lg bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
                        <Users className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-xs text-slate-500 font-medium">Total Validated Rows</p>
                        <p className="text-lg font-bold text-slate-900 dark:text-white">{previewData.preview.teachers?.length || 0}</p>
                      </div>
                    </div>

                    <div className="bg-white dark:bg-[#111] border border-slate-200 dark:border-white/10 rounded-xl p-3.5 flex items-center gap-3">
                      <div className="p-2.5 rounded-lg bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400">
                        <RefreshCw className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-xs text-slate-500 font-medium">Existing Profiles Updating</p>
                        <p className="text-lg font-bold text-slate-900 dark:text-white">{previewData.overwrites?.total_updates || 0}</p>
                      </div>
                    </div>

                    <div className="bg-white dark:bg-[#111] border border-slate-200 dark:border-white/10 rounded-xl p-3.5 flex items-center gap-3">
                      <div className="p-2.5 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400">
                        <Sparkles className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-xs text-slate-500 font-medium">Auto-Normalized / Inferred</p>
                        <p className="text-lg font-bold text-slate-900 dark:text-white">{previewData.overwrites?.total_warnings || 0}</p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white dark:bg-[#111] border border-slate-200 dark:border-white/10 rounded-xl p-4 shadow-sm">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center">
                        <ShieldCheck className="w-4 h-4 mr-2 text-indigo-500" /> Editable Validation Preview ({previewData.preview.teachers?.length || 0})
                      </h4>
                      <span className="text-xs text-slate-500">
                        You can adjust any Name, Role, Department, Contact, or Email before importing.
                      </span>
                    </div>

                    <div className="overflow-x-auto max-h-96 custom-scrollbar border border-slate-200 dark:border-white/10 rounded-xl">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead className="bg-slate-100 dark:bg-slate-900 sticky top-0 z-10 text-slate-600 dark:text-slate-300 font-bold">
                          <tr>
                            <th className="p-2.5">Status</th>
                            <th className="p-2.5 min-w-[160px]">Name</th>
                            <th className="p-2.5 min-w-[190px]">Designation / Role</th>
                            <th className="p-2.5 min-w-[130px]">Department</th>
                            <th className="p-2.5 min-w-[140px]">Contact No.</th>
                            <th className="p-2.5 min-w-[180px]">Email (@bmu.edu.in)</th>
                            <th className="p-2.5 min-w-[180px]">Validation Notes</th>
                            <th className="p-2.5 text-right">Remove</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                          {(previewData.preview.teachers || []).map((t, i) => (
                            <tr key={i} className={t.is_update ? 'bg-amber-50/40 dark:bg-amber-900/10' : ''}>
                              <td className="p-2.5 whitespace-nowrap">
                                {t.is_update ? (
                                  <span className="text-[10px] font-bold text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-900/40 px-2 py-0.5 rounded uppercase">Update</span>
                                ) : (
                                  <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-900/40 px-2 py-0.5 rounded uppercase">New</span>
                                )}
                              </td>
                              <td className="p-2">
                                <input
                                  type="text"
                                  value={t.full_name || ''}
                                  onChange={(e) => updatePreviewRow(i, 'full_name', e.target.value)}
                                  className="w-full px-2 py-1 bg-white dark:bg-black/40 border border-slate-200 dark:border-white/10 rounded text-slate-800 dark:text-slate-200 font-semibold"
                                />
                              </td>
                              <td className="p-2">
                                <select
                                  value={t.teacher_type || 'Assistant Professor'}
                                  onChange={(e) => updatePreviewRow(i, 'teacher_type', e.target.value)}
                                  className="w-full px-2 py-1 bg-white dark:bg-black/40 border border-slate-200 dark:border-white/10 rounded text-slate-800 dark:text-slate-200 font-medium"
                                >
                                  {TEACHER_ROLES.map(r => (
                                    <option key={r} value={r}>{r}</option>
                                  ))}
                                  {!TEACHER_ROLES.includes(t.teacher_type) && t.teacher_type && (
                                    <option value={t.teacher_type}>{t.teacher_type}</option>
                                  )}
                                </select>
                              </td>
                              <td className="p-2">
                                <input
                                  type="text"
                                  list="department-presets"
                                  value={t.department || ''}
                                  onChange={(e) => updatePreviewRow(i, 'department', e.target.value)}
                                  placeholder="Dept"
                                  className="w-full px-2 py-1 bg-white dark:bg-black/40 border border-slate-200 dark:border-white/10 rounded text-slate-800 dark:text-slate-200"
                                />
                              </td>
                              <td className="p-2">
                                <input
                                  type="text"
                                  value={t.contact_no || ''}
                                  onChange={(e) => updatePreviewRow(i, 'contact_no', e.target.value)}
                                  placeholder="Optional"
                                  className="w-full px-2 py-1 bg-white dark:bg-black/40 border border-slate-200 dark:border-white/10 rounded text-slate-800 dark:text-slate-200"
                                />
                              </td>
                              <td className="p-2">
                                <input
                                  type="text"
                                  value={t.email || ''}
                                  onChange={(e) => updatePreviewRow(i, 'email', e.target.value)}
                                  className="w-full px-2 py-1 bg-white dark:bg-black/40 border border-slate-200 dark:border-white/10 rounded text-slate-600 dark:text-slate-300"
                                />
                              </td>
                              <td className="p-2">
                                <div className="flex flex-col gap-0.5">
                                  {(t.update_details || []).map((d, idx) => (
                                    <span key={`u-${idx}`} className="text-[10px] text-amber-700 dark:text-amber-400 font-medium">
                                      • {d}
                                    </span>
                                  ))}
                                  {(t.validation_warnings || []).map((w, idx) => (
                                    <span key={`w-${idx}`} className="text-[10px] text-slate-500 dark:text-slate-400 flex items-center gap-1">
                                      <Info className="w-2.5 h-2.5 text-blue-500 shrink-0" /> {w}
                                    </span>
                                  ))}
                                </div>
                              </td>
                              <td className="p-2 text-right">
                                <button
                                  onClick={() => removePreviewRow(i)}
                                  className="p-1 text-slate-400 hover:text-red-500 rounded"
                                  title="Remove row from import"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="p-5 border-t border-slate-200 dark:border-white/5 bg-white dark:bg-[#1a1a1a] flex justify-between items-center gap-3">
              {previewData ? (
                <button
                  onClick={() => { setPreviewData(null); if (fileInputRef.current) fileInputRef.current.value = ''; }}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5 rounded-xl"
                  disabled={isCommiting}
                >
                  Choose Another File
                </button>
              ) : <div />}
              <div className="flex gap-3">
                <button
                  onClick={() => { setIsUploadModalOpen(false); setPreviewData(null); }}
                  className="px-5 py-2.5 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 rounded-xl transition-colors"
                  disabled={isCommiting}
                >
                  Cancel
                </button>
                <button
                  onClick={commitTeacherUpload}
                  disabled={!previewData || isCommiting || (previewData.preview?.teachers?.length || 0) === 0}
                  className={`px-6 py-2.5 text-sm font-semibold rounded-xl flex items-center shadow-sm transition-all ${!previewData || isCommiting ? 'bg-slate-300 dark:bg-slate-800 text-slate-500 dark:text-slate-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 text-white active:scale-95'}`}
                >
                  {isCommiting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle className="w-4 h-4 mr-2" />}
                  Import {previewData?.preview?.teachers?.length || ''} Records
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {}
      {isDuplicateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm transition-opacity animate-in fade-in">
          <div className="bg-white dark:bg-[#1a1a1a] rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden border border-slate-200 dark:border-white/10 shadow-2xl flex flex-col animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between p-5 border-b border-slate-200 dark:border-white/5 gap-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                  <GitMerge className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-xl font-bold text-slate-900 dark:text-white">Duplicate Resolver</h3>
                    <span className="px-2.5 py-0.5 rounded-md text-xs font-bold bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-700/50">
                      {duplicateGroups.length} Group{duplicateGroups.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                    Merge duplicate records and safely consolidate course allocations.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 self-end sm:self-auto">
                {duplicateGroups.length > 0 && (
                  <button
                    onClick={handleInstantMergeAll}
                    disabled={isMerging}
                    className="px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white rounded-xl text-xs font-bold flex items-center shadow-md transition-all active:scale-95 disabled:opacity-50 disabled:active:scale-100"
                    title="Instantly merge all duplicate groups into their primary records"
                  >
                    {isMerging ? (
                      <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                    ) : (
                      <Sparkles className="w-4 h-4 mr-1.5 text-amber-300" />
                    )}
                    Instant Merge All
                  </button>
                )}
                <button
                  onClick={() => setIsDuplicateModalOpen(false)}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-white p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-white/10 transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            {/* In-progress banner */}
            {isMerging && (
              <div className="bg-indigo-50 dark:bg-indigo-950/40 border-b border-indigo-100 dark:border-indigo-900/40 p-4 flex items-center justify-center gap-3 text-sm text-indigo-800 dark:text-indigo-200 animate-in slide-in-from-top-2">
                <Loader2 className="w-5 h-5 animate-spin text-indigo-600 dark:text-indigo-400 shrink-0" />
                <span className="font-bold">{mergeProgress || 'Processing merges safely...'}</span>
              </div>
            )}

            {/* Filter mode header if focused on single group */}
            {selectedDuplicateGroupIndex !== null && duplicateGroups[selectedDuplicateGroupIndex] && (
              <div className="px-6 py-3 bg-slate-50 dark:bg-black/30 border-b border-slate-100 dark:border-white/5 flex items-center justify-between text-sm">
                <span className="text-slate-600 dark:text-slate-400 font-semibold">
                  Reviewing Group #{selectedDuplicateGroupIndex + 1} of {duplicateGroups.length}
                </span>
                <button
                  onClick={() => setSelectedDuplicateGroupIndex(null)}
                  className="text-blue-600 dark:text-blue-400 hover:text-blue-700 font-bold hover:underline transition-colors flex items-center"
                >
                  <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> View All {duplicateGroups.length} Groups
                </button>
              </div>
            )}

            {/* Modal Content */}
            <div className="flex-1 overflow-y-auto p-5 sm:p-6 bg-slate-50/50 dark:bg-black/20 custom-scrollbar space-y-6">
              {duplicateGroups.length === 0 ? (
                <div className="py-20 flex flex-col items-center justify-center text-center animate-in zoom-in-95">
                  <div className="w-20 h-20 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-5 shadow-sm">
                    <CheckCircle className="w-10 h-10" />
                  </div>
                  <h4 className="text-xl font-bold text-slate-800 dark:text-white">All Duplicates Resolved!</h4>
                  <p className="text-base text-slate-500 dark:text-slate-400 max-w-sm mt-2">
                    Every faculty member currently has a clean, unique record.
                  </p>
                </div>
              ) : (
                <>
                  <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/40 rounded-xl p-4 flex items-start gap-3 text-sm text-amber-900 dark:text-amber-200 shadow-sm">
                    <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold">Allocation Preservation Guarantee:</span> When you merge a group, all assigned courses and classes from every duplicate are transferred into the <strong>Primary</strong> record before the others are deleted.
                    </div>
                  </div>

                  {/* Duplicate Groups Cards */}
                  <div className="space-y-6">
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
                          className="border border-slate-200 dark:border-white/10 rounded-2xl bg-white dark:bg-[#111111] overflow-hidden shadow-sm animate-in slide-in-from-bottom-4"
                        >
                          {/* Group Header */}
                          <div className="p-4 sm:px-5 bg-slate-50/80 dark:bg-white/[0.03] border-b border-slate-200 dark:border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <div className="flex flex-wrap items-center gap-2.5">
                              <span className="px-2.5 py-1 rounded-md text-xs font-bold bg-slate-200 dark:bg-white/10 text-slate-700 dark:text-slate-300">
                                Group #{idx + 1}
                              </span>
                              <h4 className="font-bold text-slate-900 dark:text-white text-base">
                                {group.name}
                              </h4>
                              <span className="text-sm font-medium text-slate-500 dark:text-slate-400">
                                ({group.teachers.length} entries)
                              </span>
                              <div className="flex flex-wrap gap-1.5 ml-2">
                                {group.reasons.map(reason => (
                                  <span key={reason} className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
                                    {reason}
                                  </span>
                                ))}
                              </div>
                            </div>

                            <button
                              onClick={() => handleMergeSingleGroup(group)}
                              disabled={isMerging}
                              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-sm transition-all active:scale-95 self-start sm:self-auto disabled:opacity-50 disabled:active:scale-100"
                            >
                              <GitMerge className="w-4 h-4" />
                              Merge Group
                            </button>
                          </div>

                          {/* Candidates Grid */}
                          <div className="p-4 sm:p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
                            {group.teachers.map(t => {
                              const isPrimary = t.id === primaryId;
                              const hasAllocations = t.allocations && t.allocations.length > 0;

                              return (
                                <div
                                  key={t.id}
                                  onClick={() => setSelectedPrimaries({ ...selectedPrimaries, [group.key]: t.id })}
                                  className={`p-4 rounded-xl border-2 transition-all cursor-pointer flex flex-col justify-between ${
                                    isPrimary
                                      ? 'border-emerald-500 bg-emerald-50/40 dark:bg-emerald-950/20 shadow-md ring-4 ring-emerald-500/10'
                                      : 'border-slate-200 dark:border-white/10 bg-slate-50/60 dark:bg-white/[0.02] hover:border-slate-300 dark:hover:border-white/20 hover:shadow-sm'
                                  }`}
                                >
                                  <div>
                                    <div className="flex items-center justify-between gap-2 mb-3">
                                      <label className="flex items-center gap-2.5 cursor-pointer text-xs font-bold text-slate-800 dark:text-slate-200">
                                        <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${isPrimary ? 'border-emerald-500 bg-emerald-500' : 'border-slate-300 dark:border-slate-600'}`}>
                                          {isPrimary && <div className="w-1.5 h-1.5 bg-white rounded-full"></div>}
                                        </div>
                                        ID #{t.id}
                                      </label>

                                      {isPrimary ? (
                                        <span className="px-2.5 py-1 rounded-md text-[10px] font-bold bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5 uppercase tracking-wider">
                                          <Check className="w-3.5 h-3.5" /> Primary
                                        </span>
                                      ) : (
                                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-200 dark:bg-white/10 text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                          Will Delete
                                        </span>
                                      )}
                                    </div>

                                    <div className="space-y-1.5">
                                      <p className="font-bold text-base text-slate-900 dark:text-white truncate">
                                        {t.full_name}
                                      </p>
                                      <p className={`text-sm truncate ${!isPrimary && t.email?.includes('.@') ? 'text-red-500 line-through' : 'text-slate-600 dark:text-slate-300'}`}>
                                        {t.email}
                                      </p>
                                      <div className="flex flex-wrap gap-1.5 pt-1">
                                        <span className="inline-block px-2 py-0.5 rounded-md text-xs font-semibold bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300">
                                          {t.teacher_type}
                                        </span>
                                        {t.department && (
                                          <span className="inline-block px-2 py-0.5 rounded-md text-xs font-semibold bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300">
                                            {t.department}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  </div>

                                  {/* Allocations summary in candidate card */}
                                  <div className="mt-4 pt-3 border-t border-slate-200 dark:border-white/10">
                                    {hasAllocations ? (
                                      <div>
                                        <p className="text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-1.5 uppercase tracking-wider">
                                          <BookOpen className="w-3.5 h-3.5 text-indigo-500" />
                                          {t.allocations.length} Class{t.allocations.length !== 1 ? 'es' : ''} Assigned:
                                        </p>
                                        <div className="flex flex-wrap gap-1.5">
                                          {t.allocations.slice(0, 3).map((a, aIdx) => (
                                            <span key={aIdx} className="px-2 py-1 rounded-md bg-white dark:bg-white/10 border border-slate-200 dark:border-white/10 text-[10px] font-bold text-slate-600 dark:text-slate-300 shadow-sm">
                                              {a.course_code} ({a.stream} S{a.semester})
                                            </span>
                                          ))}
                                          {t.allocations.length > 3 && (
                                            <span className="px-2 py-1 rounded-md text-[10px] font-bold text-slate-400 bg-slate-100 dark:bg-white/5 border border-transparent">
                                              +{t.allocations.length - 3} more
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                    ) : (
                                      <p className="text-xs text-slate-400 italic font-medium">No classes assigned</p>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>

                          {/* Group Footer Summary */}
                          <div className="px-5 py-3.5 bg-slate-50 dark:bg-white/[0.02] border-t border-slate-100 dark:border-white/5 text-sm text-slate-700 dark:text-slate-300 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                            <span>
                              After merge: <strong>{primaryTeacher.full_name}</strong> retains all <strong className="text-indigo-600 dark:text-indigo-400">{totalGroupAllocs}</strong> classes.
                            </span>
                            <span className="text-xs font-semibold text-slate-500 bg-slate-200 dark:bg-white/10 px-2 py-1 rounded-md">
                              {group.teachers.length - 1} redundant record{group.teachers.length - 1 !== 1 ? 's' : ''} deleted.
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
            <div className="p-5 border-t border-slate-200 dark:border-white/5 bg-white dark:bg-[#1a1a1a] flex flex-col sm:flex-row justify-between items-center gap-4">
              <div className="text-sm text-slate-500 dark:text-slate-400">
                {duplicateGroups.length > 0 ? (
                  <span>
                    Total <strong className="text-slate-700 dark:text-slate-200">{duplicateGroups.reduce((acc, g) => acc + g.teachers.length, 0)} teachers</strong> in <strong className="text-slate-700 dark:text-slate-200">{duplicateGroups.length} duplicate groups</strong>.
                  </span>
                ) : (
                  <span className="font-medium">Faculty roster is clean and unified.</span>
                )}
              </div>

              <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
                <button
                  onClick={() => setIsDuplicateModalOpen(false)}
                  className="px-5 py-2.5 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 rounded-xl font-bold text-sm transition-colors"
                >
                  Close
                </button>

                {duplicateGroups.length > 0 && (
                  <button
                    onClick={handleInstantMergeAll}
                    disabled={isMerging}
                    className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-sm flex items-center shadow-md transition-all active:scale-95 disabled:opacity-50 disabled:active:scale-100"
                  >
                    {isMerging ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Sparkles className="w-4 h-4 mr-2 text-amber-300" />
                    )}
                    Merge All ({duplicateGroups.length})
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {}
      {confirmDialog.isOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white dark:bg-[#1a1a1a] rounded-2xl w-full max-w-md border border-slate-200 dark:border-white/10 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="p-6">
              <div className="flex items-start gap-3.5">
                <div className={`p-2.5 rounded-xl shrink-0 ${confirmDialog.variant === 'danger' ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400' : 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400'}`}>
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-base font-bold text-slate-900 dark:text-white">{confirmDialog.title}</h4>
                  <p className="text-sm text-slate-600 dark:text-slate-300 mt-1.5 leading-relaxed">{confirmDialog.message}</p>
                </div>
              </div>
            </div>
            <div className="px-6 py-4 bg-slate-50 dark:bg-white/[0.02] border-t border-slate-100 dark:border-white/5 flex justify-end gap-3">
              <button
                onClick={closeConfirm}
                className="px-4 py-2 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-white/5 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmDialog.onConfirm}
                className={`px-5 py-2 text-sm font-semibold text-white rounded-xl shadow-sm transition-all active:scale-95 ${
                  confirmDialog.variant === 'danger'
                    ? 'bg-red-600 hover:bg-red-700'
                    : 'bg-indigo-600 hover:bg-indigo-700'
                }`}
              >
                {confirmDialog.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{ __html: `
        .custom-scrollbar::-webkit-scrollbar { height: 6px; width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
        .dark .custom-scrollbar::-webkit-scrollbar-thumb { background: #333; }
        .dark .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #555; }
      `}} />
    </div>
  );
}