'use client';
import { ReactNode, useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Bot, PanelLeftClose, PanelLeftOpen, MessageSquare, FileText, Map,
  AlignLeft, Upload, Share2, BookOpen, StickyNote, BrainCircuit, Trash2,
  FolderOpen, X, CheckCircle, AlertCircle, Loader2, Cloud, HardDrive, FlaskConical
} from 'lucide-react';
import { createBrowserClient } from '@/infrastructure/auth/client';

// ─── Types ────────────────────────────────────────────────────────────────────
interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  modifiedTime: string;
}

interface UploadState {
  fileName: string;
  status: 'uploading' | 'processing' | 'done' | 'error';
  error?: string;
}

// ─── Google Drive File Picker Modal ──────────────────────────────────────────
function DrivePickerModal({
  notebookId,
  onClose,
  onImported,
}: {
  notebookId: string;
  onClose: () => void;
  onImported: () => void;
}) {
  const [files, setFiles] = useState<DriveFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);
  const [importing, setImporting] = useState<string | null>(null);
  const [importedIds, setImportedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetch(`/api/ingest/import-drive?notebookId=${notebookId}`)
      .then(r => r.json())
      .then(data => {
        setConnected(data.connected);
        setFiles(data.files || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [notebookId]);

  const handleConnect = async () => {
    const res = await fetch(`/api/auth/drive-connect?notebookId=${notebookId}`);
    const { url } = await res.json();
    if (url) window.location.href = url;
  };

  const handleImport = async (file: DriveFile) => {
    setImporting(file.id);
    try {
      const res = await fetch('/api/ingest/import-drive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileId: file.id,
          fileName: file.name,
          mimeType: file.mimeType,
          notebookId,
        }),
      });
      if (res.ok) {
        setImportedIds(prev => new Set([...prev, file.id]));
        onImported();
      }
    } finally {
      setImporting(null);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-lg mx-4 bg-white dark:bg-[#1a1a1c] rounded-2xl shadow-2xl border border-gray-200 dark:border-white/10 overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-200 dark:border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-blue-50 dark:bg-blue-900/30 rounded-xl flex items-center justify-center">
              <HardDrive size={18} className="text-blue-500" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white text-sm">Google Drive</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">Import files from your Drive</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-white/5 text-gray-500">
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="p-5">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 size={24} className="animate-spin text-gray-400" />
            </div>
          ) : !connected ? (
            <div className="text-center py-8 space-y-4">
              <div className="w-16 h-16 bg-blue-50 dark:bg-blue-900/20 rounded-full flex items-center justify-center mx-auto">
                <Cloud size={28} className="text-blue-500" />
              </div>
              <div>
                <h4 className="font-semibold text-gray-900 dark:text-white mb-1">Connect Google Drive</h4>
                <p className="text-sm text-gray-500 dark:text-gray-400 max-w-xs mx-auto">
                  One click to connect. We'll only request read-only access to your files.
                </p>
              </div>
              <button
                onClick={handleConnect}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium text-sm transition-colors shadow-sm"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#fff" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#fff" opacity="0.8"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#fff" opacity="0.7"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#fff" opacity="0.6"/>
                </svg>
                Connect with Google
              </button>
            </div>
          ) : files.length === 0 ? (
            <div className="text-center py-8 text-sm text-gray-500 dark:text-gray-400">
              No documents found in your Drive.
            </div>
          ) : (
            <div className="space-y-1 max-h-80 overflow-y-auto pr-1">
              {files.map(file => {
                const isImported = importedIds.has(file.id);
                const isImporting = importing === file.id;
                return (
                  <div
                    key={file.id}
                    className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-white/5 transition-colors group"
                  >
                    <FileText size={16} className="text-gray-400 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{file.name}</p>
                      <p className="text-xs text-gray-400">{new Date(file.modifiedTime).toLocaleDateString()}</p>
                    </div>
                    <button
                      onClick={() => !isImported && !isImporting && handleImport(file)}
                      disabled={isImported || isImporting}
                      className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                        isImported
                          ? 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 cursor-default'
                          : isImporting
                          ? 'bg-gray-100 dark:bg-white/10 text-gray-400 cursor-wait'
                          : 'bg-black dark:bg-white text-white dark:text-black hover:bg-gray-800 dark:hover:bg-gray-200'
                      }`}
                    >
                      {isImported ? (
                        <span className="flex items-center gap-1"><CheckCircle size={12} /> Added</span>
                      ) : isImporting ? (
                        <span className="flex items-center gap-1"><Loader2 size={12} className="animate-spin" /> Adding...</span>
                      ) : (
                        'Add'
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main Layout ──────────────────────────────────────────────────────────────
export default function AppLayout({ children }: { children: ReactNode }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [notebooks, setNotebooks] = useState<any[]>([]);
  const [docs, setDocs] = useState<any[]>([]);
  const [uploading, setUploading] = useState<UploadState | null>(null);
  const [user, setUser] = useState<any>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [showDrivePicker, setShowDrivePicker] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pathname = usePathname();

  // Extract active notebook ID from URL e.g. /notebooks/123/chat
  const notebookMatch = pathname.match(/\/notebooks\/([^/]+)/);
  const activeNotebookId = notebookMatch ? notebookMatch[1] : null;

  const fetchDocs = useCallback(async () => {
    if (!activeNotebookId) return;
    const res = await fetch(`/api/notebooks/${activeNotebookId}/documents`);
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data)) setDocs(data);
    }
  }, [activeNotebookId]);

  useEffect(() => {
    fetch('/api/notebooks')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setNotebooks(data);
        else console.error('API returned non-array:', data);
      })
      .catch(console.error);

    const supabase = createBrowserClient();
    supabase.auth.getUser().then((res: any) => {
      setUser(res.data?.user);
    });
  }, []);

  useEffect(() => {
    if (activeNotebookId) {
      fetchDocs();
    } else {
      setDocs([]);
    }

    const handleRefresh = () => { if (activeNotebookId) fetchDocs(); };
    window.addEventListener('refresh-docs', handleRefresh);
    return () => window.removeEventListener('refresh-docs', handleRefresh);
  }, [activeNotebookId, fetchDocs]);

  const handleDeleteDocument = async (docId: string) => {
    if (!activeNotebookId) return;
    if (!confirm('Are you sure you want to delete this document? This will permanently remove its parsed data and graphs.')) return;

    try {
      const res = await fetch(`/api/notebooks/${activeNotebookId}/documents/${docId}`, { method: 'DELETE' });
      if (res.ok) {
        fetchDocs();
      } else {
        const err = await res.json();
        alert('Delete failed: ' + err.error);
      }
    } catch (e: any) {
      alert('Delete failed: ' + e.message);
    }
  };

  // ─── Upload Logic ────────────────────────────────────────────────────────────
  const uploadFile = async (file: File) => {
    if (!activeNotebookId) {
      alert('Please open a workspace before uploading.');
      return;
    }

    setUploading({ fileName: file.name, status: 'uploading' });

    try {
      // Step 1: Upload file to Supabase Storage via API
      const formData = new FormData();
      formData.append('file', file);
      formData.append('notebookId', activeNotebookId);

      const uploadRes = await fetch('/api/documents/upload', {
        method: 'POST',
        body: formData,
      });

      if (!uploadRes.ok) {
        const err = await uploadRes.json();
        throw new Error(err.error || 'Upload failed');
      }

      const { filePath, fileName, mimeType, size } = await uploadRes.json();

      // Step 2: Run ingest pipeline
      setUploading({ fileName: file.name, status: 'processing' });

      const ingestRes = await fetch('/api/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filePath, fileName, mimeType, size, notebookId: activeNotebookId }),
      });

      if (!ingestRes.ok) {
        const err = await ingestRes.json();
        throw new Error(err.error || 'Processing failed');
      }

      setUploading({ fileName: file.name, status: 'done' });
      await fetchDocs();
      window.dispatchEvent(new Event('refresh-docs'));

      setTimeout(() => setUploading(null), 2500);
    } catch (err: any) {
      setUploading({ fileName: file.name, status: 'error', error: err.message });
      setTimeout(() => setUploading(null), 4000);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploadFile(file);
    e.target.value = '';
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) uploadFile(file);
  }, [activeNotebookId]);

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = () => setIsDragging(false);

  return (
    <div
      className="flex h-screen bg-white dark:bg-[#09090b] text-gray-900 dark:text-gray-100 font-sans transition-colors duration-200 relative overflow-hidden"
      onDrop={activeNotebookId ? handleDrop : undefined}
      onDragOver={activeNotebookId ? handleDragOver : undefined}
      onDragLeave={activeNotebookId ? handleDragLeave : undefined}
    >
      {/* Drag-and-Drop Overlay */}
      {isDragging && activeNotebookId && (
        <div className="absolute inset-0 z-[60] bg-blue-500/10 border-2 border-dashed border-blue-400 flex items-center justify-center pointer-events-none">
          <div className="text-center">
            <Upload size={40} className="text-blue-400 mx-auto mb-3" />
            <p className="text-blue-500 font-semibold text-lg">Drop to upload</p>
          </div>
        </div>
      )}

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        id="sidebar-file-input"
        className="hidden"
        accept=".pdf,.doc,.docx,.txt,.pptx,.xlsx,.csv,.md"
        onChange={handleFileChange}
      />

      {/* Left Sidebar Toggle Button */}
      <button
        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
        className={`absolute top-4 z-50 p-2 bg-white dark:bg-[#1e1e20] border border-gray-200 dark:border-white/10 rounded-lg shadow-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/5 transition-all duration-300 ${isSidebarOpen ? 'left-[335px]' : 'left-4'}`}
      >
        {isSidebarOpen ? <PanelLeftClose size={20} /> : <PanelLeftOpen size={20} />}
      </button>

      {/* Sidebar */}
      <div className={`transition-all duration-300 ease-in-out border-r bg-gray-50 dark:bg-[#121214] border-gray-200 dark:border-white/5 flex flex-col h-full shrink-0 z-40 relative ${isSidebarOpen ? 'w-80 opacity-100 translate-x-0' : 'w-0 opacity-0 -translate-x-full overflow-hidden'}`}>
        <Link href="/dashboard" className="p-5 font-semibold text-lg border-b border-gray-200 dark:border-white/5 flex items-center gap-3 shrink-0 hover:opacity-80 transition-opacity">
          <div className="bg-black dark:bg-white text-white dark:text-black p-1.5 rounded-lg shadow-sm">
            <Bot size={20} strokeWidth={2.5} />
          </div>
          Secure RAG
        </Link>

        <div className="p-5 border-b border-gray-200 dark:border-white/5 flex-shrink-0">
          <h3 className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-3 uppercase tracking-wider flex items-center gap-2">
            Workspaces
          </h3>
          <div className="space-y-1">
            {notebooks.length === 0 && <div className="text-sm text-gray-500 dark:text-gray-500 px-2">No workspaces found.</div>}
            {notebooks.map(nb => {
              const isActive = pathname.includes(`/notebooks/${nb.id}`);
              return (
                <Link
                  key={nb.id}
                  href={`/notebooks/${nb.id}/chat`}
                  className={`block text-sm p-2.5 rounded-lg truncate transition-all duration-200 font-medium ${isActive ? 'bg-black text-white dark:bg-white dark:text-black shadow-md' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-white/5'}`}
                >
                  {nb.title}
                </Link>
              );
            })}
          </div>
        </div>

        {/* Studio Section */}
        {activeNotebookId && (
          <div className="p-5 border-b border-gray-200 dark:border-white/5 flex-shrink-0">
            <h3 className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-3 uppercase tracking-wider">Studio</h3>
            <div className="grid grid-cols-2 gap-2">
              <Link href={`/notebooks/${activeNotebookId}/chat`} className={`p-2 text-xs rounded-lg font-medium transition-colors flex items-center gap-1.5 ${pathname.includes('/chat') ? 'bg-gray-200 dark:bg-white/10 text-black dark:text-white' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5'}`}>
                <MessageSquare size={14} /> Chat
              </Link>
              <Link href={`/notebooks/${activeNotebookId}/mindmap`} className={`p-2 text-xs rounded-lg font-medium transition-colors flex items-center gap-1.5 ${pathname.includes('/mindmap') ? 'bg-gray-200 dark:bg-white/10 text-black dark:text-white' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5'}`}>
                <Share2 size={14} /> Mind Map
              </Link>
              <Link href={`/notebooks/${activeNotebookId}/guide`} className={`p-2 text-xs rounded-lg font-medium transition-colors flex items-center gap-1.5 ${pathname.includes('/guide') ? 'bg-gray-200 dark:bg-white/10 text-black dark:text-white' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5'}`}>
                <BookOpen size={14} /> Guide
              </Link>
              <Link href={`/notebooks/${activeNotebookId}/notes`} className={`p-2 text-xs rounded-lg font-medium transition-colors flex items-center gap-1.5 ${pathname.includes('/notes') ? 'bg-gray-200 dark:bg-white/10 text-black dark:text-white' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5'}`}>
                <StickyNote size={14} /> Notes
              </Link>
              <Link href={`/notebooks/${activeNotebookId}/memory`} className={`p-2 text-xs rounded-lg font-medium transition-colors flex items-center gap-1.5 ${pathname.includes('/memory') ? 'bg-gray-200 dark:bg-white/10 text-black dark:text-white' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5'}`}>
                <BrainCircuit size={14} /> Memory
              </Link>
              <Link href={`/notebooks/${activeNotebookId}/research`} className={`p-2 text-xs rounded-lg font-medium transition-colors flex items-center gap-1.5 col-span-2 ${pathname.includes('/research') ? 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5'}`}>
                <FlaskConical size={14} /> Research Lab
              </Link>
            </div>
          </div>
        )}

        {/* Sources Section */}
        {activeNotebookId && (
          <div className="flex-1 overflow-y-auto flex flex-col">
            <div className="p-5 flex-1 flex flex-col">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Sources</h3>
                {/* Upload action buttons */}
                <div className="flex gap-1">
                  {/* Local file upload */}
                  <button
                    id="upload-file-btn"
                    onClick={() => fileInputRef.current?.click()}
                    title="Upload a file"
                    className="p-1.5 rounded-lg text-gray-500 hover:text-black dark:hover:text-white hover:bg-gray-200 dark:hover:bg-white/10 transition-colors"
                  >
                    <Upload size={14} />
                  </button>
                  {/* Google Drive */}
                  <button
                    id="connect-drive-btn"
                    onClick={() => setShowDrivePicker(true)}
                    title="Import from Google Drive"
                    className="p-1.5 rounded-lg text-gray-500 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                  >
                    <HardDrive size={14} />
                  </button>
                </div>
              </div>

              {/* Upload progress */}
              {uploading && (
                <div className={`mb-2 p-3 rounded-xl border text-xs flex items-center gap-2 ${
                  uploading.status === 'error'
                    ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-600 dark:text-red-400'
                    : uploading.status === 'done'
                    ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-600 dark:text-green-400'
                    : 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400'
                }`}>
                  {uploading.status === 'uploading' && <Loader2 size={12} className="animate-spin shrink-0" />}
                  {uploading.status === 'processing' && <Loader2 size={12} className="animate-spin shrink-0" />}
                  {uploading.status === 'done' && <CheckCircle size={12} className="shrink-0" />}
                  {uploading.status === 'error' && <AlertCircle size={12} className="shrink-0" />}
                  <span className="truncate">
                    {uploading.status === 'uploading' && `Uploading ${uploading.fileName}...`}
                    {uploading.status === 'processing' && `Processing ${uploading.fileName}...`}
                    {uploading.status === 'done' && `${uploading.fileName} added!`}
                    {uploading.status === 'error' && (uploading.error || 'Upload failed')}
                  </span>
                </div>
              )}

              {/* Drag-and-drop hint when no docs */}
              {docs.length === 0 && !uploading && (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full mb-2 p-4 border-2 border-dashed border-gray-200 dark:border-white/10 rounded-xl text-center text-xs text-gray-400 dark:text-gray-500 hover:border-gray-300 dark:hover:border-white/20 hover:text-gray-500 dark:hover:text-gray-400 transition-colors cursor-pointer"
                >
                  <Upload size={16} className="mx-auto mb-1 opacity-60" />
                  Drop files here or click to upload
                </button>
              )}

              <div className="space-y-2">
                {docs.map(d => (
                  <div key={d.id} className="text-sm p-3 bg-white dark:bg-[#1e1e20] rounded-xl border border-gray-200 dark:border-white/5 shadow-sm group flex items-center justify-between">
                    <div className="font-medium truncate text-gray-900 dark:text-gray-100 flex items-center gap-2 min-w-0">
                      <FileText size={14} className={`shrink-0 ${d.status === 'Ready' ? 'text-green-500' : d.status === 'Failed' ? 'text-red-400' : 'text-gray-400'}`} />
                      <span className="truncate">{d.title}</span>
                      {d.status === 'Processing' && <Loader2 size={12} className="animate-spin text-blue-400 shrink-0" />}
                    </div>
                    <button
                      onClick={() => handleDeleteDocument(d.id)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md shrink-0"
                      title="Delete document"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* User Profile */}
        <div className="p-5 border-t border-gray-200 dark:border-white/5 mt-auto">
          {user ? (
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center text-blue-600 dark:text-blue-300 font-semibold text-sm shrink-0">
                {user.email?.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{user.email}</p>
                <form action="/auth/signout" method="POST">
                  <button type="submit" className="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors">Sign out</button>
                </form>
              </div>
            </div>
          ) : (
            <Link href="/login" className="text-sm text-gray-600 hover:text-black dark:text-gray-400 dark:hover:text-white transition-colors">Sign In</Link>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden relative bg-white dark:bg-[#0a0a0c]">
        {children}
      </div>

      {/* Google Drive Picker Modal */}
      {showDrivePicker && activeNotebookId && (
        <DrivePickerModal
          notebookId={activeNotebookId}
          onClose={() => setShowDrivePicker(false)}
          onImported={fetchDocs}
        />
      )}
    </div>
  );
}
