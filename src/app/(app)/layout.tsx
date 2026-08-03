'use client';
import { ReactNode, useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Bot, PanelLeftClose, PanelLeftOpen, MessageSquare, FileText, Map, Headphones, Database, AlignLeft, Plus, Upload, Link as LinkIcon } from 'lucide-react';
import { createBrowserClient } from '@/infrastructure/auth/client';

export default function AppLayout({ children }: { children: ReactNode }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [notebooks, setNotebooks] = useState<any[]>([]);
  const [docs, setDocs] = useState<any[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const pathname = usePathname();

  // Extract active notebook ID from URL e.g. /notebooks/123/chat
  const notebookMatch = pathname.match(/\/notebooks\/([^/]+)/);
  const activeNotebookId = notebookMatch ? notebookMatch[1] : null;

  const fetchDocs = async () => {
    if (!activeNotebookId) return;
    const res = await fetch(`/api/notebooks/${activeNotebookId}/documents`);
    if (res.ok) setDocs(await res.json());
  };

  useEffect(() => {
    fetch('/api/notebooks')
      .then(res => res.json())
      .then(data => setNotebooks(data))
      .catch(console.error);
  }, []);

  useEffect(() => {
    if (activeNotebookId) {
      fetchDocs();
    } else {
      setDocs([]);
    }
  }, [activeNotebookId]);

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !activeNotebookId) return;
    setUploading(true);
    
    try {
      const docId = crypto.randomUUID();
      const supabase = createBrowserClient();
      
      const { error: storageError } = await supabase.storage
        .from('documents')
        .upload(docId, file, { contentType: file.type || 'application/pdf', upsert: true });

      if (storageError) throw new Error(`Storage upload failed: ${storageError.message}`);

      const res = await fetch("/api/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ docId, fileName: file.name, allowedRoles: 'ai,intern,hr,engineering,exec,developer,designer,marketer,data_scientist' })
      });

      if (res.ok) {
        const result = await res.json();
        await fetch(`/api/notebooks/${activeNotebookId}/documents`, {
          method: "POST",
          body: JSON.stringify({ document_id: result.docId }),
          headers: { "Content-Type": "application/json" }
        });
        fetchDocs();
      }
    } catch (err: any) {
      alert("Upload failed: " + err.message);
    }
    setUploading(false);
    setFile(null);
  };

  return (
    <div className="flex h-screen bg-white dark:bg-[#09090b] text-gray-900 dark:text-gray-100 font-sans transition-colors duration-200 relative overflow-hidden">
      
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
              <Link href={`/notebooks/${activeNotebookId}/guide`} className={`p-2 text-xs rounded-lg font-medium transition-colors flex items-center gap-1.5 ${pathname.includes('/guide') ? 'bg-gray-200 dark:bg-white/10 text-black dark:text-white' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5'}`}>
                <FileText size={14} /> Guide
              </Link>
              <Link href={`/notebooks/${activeNotebookId}/mindmap`} className={`p-2 text-xs rounded-lg font-medium transition-colors flex items-center gap-1.5 ${pathname.includes('/mindmap') ? 'bg-gray-200 dark:bg-white/10 text-black dark:text-white' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5'}`}>
                <Map size={14} /> Mind Map
              </Link>
              <Link href={`/notebooks/${activeNotebookId}/notes`} className={`p-2 text-xs rounded-lg font-medium transition-colors flex items-center gap-1.5 justify-center ${pathname.includes('/notes') ? 'bg-gray-200 dark:bg-white/10 text-black dark:text-white' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5'}`}>
                <AlignLeft size={14} /> Notes
              </Link>
            </div>
          </div>
        )}

        {/* Sources Section */}
        {activeNotebookId && (
          <div className="flex-1 overflow-y-auto flex flex-col">
            <div className="p-5 border-b border-gray-200 dark:border-white/5">
              <h3 className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-3 uppercase tracking-wider flex items-center gap-2">Add Source</h3>
              <form onSubmit={handleUpload} className="space-y-3">
                <input
                  type="file"
                  onChange={e => setFile(e.target.files?.[0] || null)}
                  className="text-xs w-full text-gray-600 dark:text-gray-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200 transition-colors"
                  required
                />
                <button type="submit" disabled={uploading || !file} className="w-full bg-gray-900 hover:bg-black text-white rounded-lg p-2 text-sm font-semibold transition-colors flex items-center justify-center gap-2">
                  <Upload size={16} /> {uploading ? "Uploading..." : "Upload New"}
                </button>
              </form>
            </div>
            
            <div className="p-5 flex-1">
              <h3 className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-3 uppercase tracking-wider flex items-center gap-2">Sources</h3>
              <div className="space-y-2">
                {docs.length === 0 && <div className="text-sm text-gray-500 px-1">No sources linked.</div>}
                {docs.map(d => (
                  <div key={d.id} className="text-sm p-3 bg-white dark:bg-[#1e1e20] rounded-xl border border-gray-200 dark:border-white/5 shadow-sm">
                    <div className="font-medium truncate text-gray-900 dark:text-gray-100 flex items-center gap-2"><FileText size={14} className="text-gray-400 shrink-0" /> <span className="truncate">{d.title}</span></div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden relative bg-white dark:bg-[#0a0a0c]">
        {children}
      </div>
    </div>
  );
}
