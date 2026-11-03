import React, { useState, useRef } from 'react';
import { 
    UploadCloud, FileSpreadsheet, Loader2, CheckCircle, 
    AlertTriangle, Users, BookOpen, X 
} from 'lucide-react';

export default function MasterDataImporter() {
    const [isUploading, setIsUploading] = useState(false);
    const [uploadError, setUploadError] = useState(null);
    const [previewData, setPreviewData] = useState(null);
    const [isCommiting, setIsCommiting] = useState(false);
    const [successMsg, setSuccessMsg] = useState('');
    const fileInputRef = useRef(null);

    const backendUrl = import.meta.env?.VITE_BACKEND_URL || 'http://localhost:5000';

    const handleFileSelection = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setUploadError(null);
        setSuccessMsg('');
        setIsUploading(true);

        const formData = new FormData();
        formData.append('file', file);

        try {
            const res = await fetch(`${backendUrl}/api/master-importer/upload-preview`, {
                method: 'POST',
                body: formData
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to process Excel file.');
            setPreviewData(data);
        } catch (err) {
            setUploadError(err.message);
        } finally {
            setIsUploading(false);
        }
    };

    const commitData = async () => {
        if (!previewData || !previewData.preview) return;
        setIsCommiting(true);
        setUploadError(null);

        try {
            const res = await fetch(`${backendUrl}/api/master-importer/commit`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(previewData.preview)
            });

            const data = await res.json();
            
            if (!res.ok) {
                throw new Error(data.error || 'Failed to commit master data.');
            }
            
            setSuccessMsg(`Successfully imported ${data.summary.teachers} Teachers and ${data.summary.courses} Courses.`);
            setPreviewData(null);
            if (fileInputRef.current) fileInputRef.current.value = "";
        } catch (err) {
            setUploadError(err.message);
        } finally {
            setIsCommiting(false);
        }
    };

    return (
        <div className="max-w-6xl mx-auto space-y-6 p-6 animate-in fade-in duration-500">
            <header>
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center">
                    <FileSpreadsheet className="w-6 h-6 mr-2 text-emerald-500" />
                    Master Multi-Sheet Importer
                </h2>
                <p className="text-slate-500 mt-1">Upload complex timetable schedules to automatically extract and validate Teachers and Subjects across all sheets.</p>
            </header>

            <div className="bg-white dark:bg-[#111] rounded-2xl shadow-sm border border-slate-200 dark:border-white/10 p-6">
                
                {successMsg && (
                    <div className="mb-6 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 p-4 rounded-xl flex items-center shadow-sm">
                        <CheckCircle className="w-5 h-5 mr-3 shrink-0" /> {successMsg}
                        <button onClick={() => setSuccessMsg('')} className="ml-auto opacity-70 hover:opacity-100"><X className="w-4 h-4"/></button>
                    </div>
                )}

                {!previewData ? (
                    <div className="flex flex-col items-center justify-center py-12">
                        {uploadError && (
                            <div className="mb-6 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-4 rounded-xl flex items-center w-full max-w-md">
                                <AlertTriangle className="w-5 h-5 mr-3 shrink-0" /> {uploadError}
                            </div>
                        )}
                        <label className={`w-full max-w-lg aspect-video border-2 border-dashed rounded-2xl flex flex-col items-center justify-center cursor-pointer transition-all ${isUploading ? 'border-emerald-400 bg-emerald-50 dark:bg-emerald-900/10' : 'border-slate-300 dark:border-white/20 hover:border-emerald-500 hover:bg-slate-50 dark:hover:bg-white/5'}`}>
                            <input type="file" accept=".xlsx, .xls" className="hidden" ref={fileInputRef} onChange={handleFileSelection} disabled={isUploading} />
                            {isUploading ? (
                                <>
                                    <Loader2 className="w-10 h-10 animate-spin text-emerald-500 mb-4" />
                                    <p className="font-semibold text-emerald-700 dark:text-emerald-400">Parsing Multiple Sheets...</p>
                                </>
                            ) : (
                                <>
                                    <UploadCloud className="w-12 h-12 text-slate-400 mb-4 transition-transform group-hover:scale-110" />
                                    <p className="text-lg font-bold text-slate-700 dark:text-slate-300">Click or Drop Excel File</p>
                                    <p className="text-xs text-slate-500 mt-2">Extracts metadata from all sheets simultaneously.</p>
                                </>
                            )}
                        </label>
                    </div>
                ) : (
                    <div className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Extracted Teachers */}
                            <div className="bg-slate-50 dark:bg-white/5 rounded-xl p-4 border border-slate-200 dark:border-white/10">
                                <h4 className="font-bold flex items-center mb-4 text-slate-800 dark:text-white">
                                    <Users className="w-5 h-5 mr-2 text-blue-500" />
                                    Detected Teachers ({previewData.preview.teachers?.length || 0})
                                </h4>
                                <div className="space-y-2 max-h-80 overflow-y-auto pr-2 custom-scrollbar">
                                    {previewData.preview.teachers?.map((t, idx) => (
                                        <div key={idx} className="bg-white dark:bg-black/40 p-3 rounded-lg border border-slate-200 dark:border-white/10 text-sm">
                                            <p className="font-bold text-slate-900 dark:text-white truncate">{t.full_name}</p>
                                            <p className="text-xs text-slate-500 truncate">{t.email}</p>
                                            <span className="inline-block mt-1 px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 text-[10px] font-semibold rounded">
                                                Sheet: {t.sheet_source}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Extracted Courses */}
                            <div className="bg-slate-50 dark:bg-white/5 rounded-xl p-4 border border-slate-200 dark:border-white/10">
                                <h4 className="font-bold flex items-center mb-4 text-slate-800 dark:text-white">
                                    <BookOpen className="w-5 h-5 mr-2 text-indigo-500" />
                                    Detected Subjects ({previewData.preview.courses?.length || 0})
                                </h4>
                                <div className="space-y-2 max-h-80 overflow-y-auto pr-2 custom-scrollbar">
                                    {previewData.preview.courses?.map((c, idx) => (
                                        <div key={idx} className="bg-white dark:bg-black/40 p-3 rounded-lg border border-slate-200 dark:border-white/10 text-sm">
                                            <p className="font-bold text-slate-900 dark:text-white truncate">{c.course_title}</p>
                                            <p className="text-xs text-slate-500 truncate">Code: {c.course_code || 'N/A'}</p>
                                            <span className="inline-block mt-1 px-2 py-0.5 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 text-[10px] font-semibold rounded">
                                                Sheet: {c.sheet_source}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="flex justify-end gap-3 pt-4 border-t border-slate-200 dark:border-white/10">
                            <button 
                                onClick={() => setPreviewData(null)}
                                className="px-5 py-2.5 rounded-xl font-medium bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/20 text-slate-700 dark:text-slate-300 transition-colors"
                            >
                                Cancel
                            </button>
                            <button 
                                onClick={commitData}
                                disabled={isCommiting}
                                className="px-6 py-2.5 rounded-xl font-bold bg-emerald-600 hover:bg-emerald-700 text-white flex items-center shadow-sm transition-all disabled:opacity-50"
                            >
                                {isCommiting ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <CheckCircle className="w-5 h-5 mr-2" />}
                                Commit Master Database
                            </button>
                        </div>
                    </div>
                )}
            </div>
            <style dangerouslySetInnerHTML={{__html: `
                .custom-scrollbar::-webkit-scrollbar { width: 6px; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
                .dark .custom-scrollbar::-webkit-scrollbar-thumb { background: #475569; }
            `}} />
        </div>
    );
}