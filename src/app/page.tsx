"use client";
import { useState, useEffect, useMemo, useRef } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { Bot, User, Upload, Send, FileText, Book, Plus, MessageSquare, Headphones, Map, AlignLeft, Search, PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen, ImageIcon, Link as LinkIcon, Database } from "lucide-react";
import ReactMarkdown from "react-markdown";
import MindMapRenderer from "@/components/MindMapRenderer";
import dynamic from "next/dynamic";
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

const DocumentViewer = dynamic(() => import('@/components/DocumentViewer'), { 
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full w-full bg-gray-50 dark:bg-[#121214]">
      <div className="w-8 h-8 border-4 border-gray-400 border-t-transparent rounded-full animate-spin"></div>
    </div>
  )
});

export default function Home() {
  const [role, setRole] = useState("intern");
  const [file, setFile] = useState<File | null>(null);
  const [allowedRoles, setAllowedRoles] = useState("ai,intern,hr,engineering,exec,developer,designer,marketer,data_scientist");
  const [uploading, setUploading] = useState(false);

  const [notebooks, setNotebooks] = useState<any[]>([]);
  const [activeNotebookId, setActiveNotebookId] = useState<string | null>(null);
  const [docs, setDocs] = useState<any[]>([]);
  const [allDocs, setAllDocs] = useState<any[]>([]);
  const [selectedDocIdToLink, setSelectedDocIdToLink] = useState("");
  const [newNotebookTitle, setNewNotebookTitle] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [isFetchingSuggestions, setIsFetchingSuggestions] = useState(false);
  const [activeView, setActiveView] = useState<'chat' | 'guide' | 'mindmap' | 'audio' | 'notes' | 'data'>('chat');
  const [viewData, setViewData] = useState<any>(null);
  const [viewingDocument, setViewingDocument] = useState<{url: string, title: string} | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [newNote, setNewNote] = useState("");

  const [activeTopic, setActiveTopic] = useState<any>(null);
  const [topicContent, setTopicContent] = useState<string | null>(null);
  const [isFetchingTopic, setIsFetchingTopic] = useState(false);

  const [input, setInput] = useState("");
  const endOfMessagesRef = useRef<HTMLDivElement>(null);

  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isRightSidebarOpen, setIsRightSidebarOpen] = useState(true);
  const [searchTopics, setSearchTopics] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const scrollToMessage = (msgId: string) => {
    const el = document.getElementById(`msg-${msgId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('bg-gray-100', 'dark:bg-white/5', 'rounded-xl');
      setTimeout(() => {
        el.classList.remove('bg-gray-100', 'dark:bg-white/5', 'rounded-xl');
      }, 1500);
    }
  };

  const fetchRelatedTopics = async (currentMessages: any[], overrideText?: string) => {
    const lastMsg = currentMessages[currentMessages.length - 1];
    let queryText = overrideText;
    
    if (!queryText) {
      if (!lastMsg || lastMsg.role !== 'assistant') return;
      const userMsg = currentMessages.slice().reverse().find((m: any) => m.role === 'user');
      if (!userMsg) return;
      queryText = typeof userMsg.content === 'string' ? userMsg.content : "cybersecurity";
    }

    setIsSearching(true);
    setIsRightSidebarOpen(true); // Open sidebar automatically when searching
    try {
      const res = await fetch("/api/search", {
        method: "POST",
        body: JSON.stringify({
          query: queryText,
          context: lastMsg && typeof lastMsg.content === 'string' ? lastMsg.content : ""
        }),
        headers: { "Content-Type": "application/json" }
      });
      if (res.ok) {
        const data = await res.json();
        setSearchTopics(data.topics || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsSearching(false);
    }
  };

  const transport = useMemo(() => new DefaultChatTransport({
    api: "/api/chat",
    body: { userRole: role, notebookId: activeNotebookId }
  }), [role, activeNotebookId]);

  const { messages, status, sendMessage, setMessages, error } = useChat({
    transport,
    onFinish: (event: any) => {
      const finalMessages = event.messages || [...messages, event.message || event];
      fetchSuggestions(finalMessages);
      fetchRelatedTopics(finalMessages);
    }
  });

  // similarResources is now a useMemo hook
  const similarResources = useMemo(() => {
    const ids = new Set<string>();
    messages.forEach(m => {
      if (m.role === 'assistant') {
        const rawText = (m as any).text || (m as any).content || m.parts?.map((p: any) => p.type === 'text' ? p.text : '').join('') || '';
        const regex = /\[Doc: ([0-9a-fA-F-]+), Chunk: [0-9a-fA-F-]+\]/g;
        let match;
        while ((match = regex.exec(rawText)) !== null) {
          ids.add(match[1]);
        }
      }
    });
    return Array.from(ids);
  }, [messages]);
  const isLoading = status === 'submitted' || status === 'streaming';

  useEffect(() => {
    fetchNotebooks();
    fetchAllDocs();
  }, []);

  useEffect(() => {
    if (activeNotebookId) {
      fetchDocs();
      setMessages([]);
      setSuggestions([]);
      setActiveView('chat');
    } else {
      setDocs([]);
    }
  }, [activeNotebookId]);

  useEffect(() => {
    if (activeView === 'chat' && endOfMessagesRef.current) {
      endOfMessagesRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, activeView]);

  const fetchNotebooks = async () => {
    const res = await fetch("/api/notebooks");
    if (res.ok) {
      const data = await res.json();
      setNotebooks(data);
      if (data.length > 0 && !activeNotebookId) {
        setActiveNotebookId(data[0].id);
      }
    }
  };

  const handleCreateNotebook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNotebookTitle.trim()) return;
    try {
      const res = await fetch("/api/notebooks", {
        method: "POST",
        body: JSON.stringify({ title: newNotebookTitle }),
        headers: { "Content-Type": "application/json" }
      });
      if (res.ok) {
        setNewNotebookTitle("");
        fetchNotebooks();
      } else {
        const errorData = await res.json().catch(() => ({}));
        alert(`Failed to create notebook: ${errorData.error || res.statusText}`);
      }
    } catch (err: any) {
      alert(`Network error: ${err.message}`);
    }
  };

  const fetchDocs = async () => {
    if (!activeNotebookId) return;
    const res = await fetch(`/api/notebooks/${activeNotebookId}/documents`);
    if (res.ok) {
      const data = await res.json();
      setDocs(data);
    }
  };

  const fetchAllDocs = async () => {
    const res = await fetch("/api/documents");
    if (res.ok) {
      const data = await res.json();
      setAllDocs(data);
    }
  };

  const handleLinkExisting = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDocIdToLink || !activeNotebookId) return;
    setUploading(true);
    try {
      const res = await fetch(`/api/notebooks/${activeNotebookId}/documents`, {
        method: "POST",
        body: JSON.stringify({ document_id: selectedDocIdToLink }),
        headers: { "Content-Type": "application/json" }
      });
      if (res.ok) {
        fetchDocs();
        setSelectedDocIdToLink("");
      } else {
        const err = await res.json();
        alert("Link failed: " + (err.error || res.statusText));
      }
    } catch (err) {
      console.error(err);
    }
    setUploading(false);
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !activeNotebookId) return;
    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("allowed_roles", allowedRoles);

    try {
      const res = await fetch("/api/ingest", { method: "POST", body: formData });
      if (res.ok) {
        const result = await res.json();
        await fetch(`/api/notebooks/${activeNotebookId}/documents`, {
          method: "POST",
          body: JSON.stringify({ document_id: result.docId }),
          headers: { "Content-Type": "application/json" }
        });
        fetchDocs();
        fetchAllDocs();
      } else {
        const errorText = await res.text();
        alert("Upload failed: " + errorText);
      }
    } catch (err) {
      console.error(err);
    }
    setUploading(false);
    setFile(null);
  };

  const fetchSuggestions = async (currentMessages: any[]) => {
    if (!activeNotebookId) return;
    setIsFetchingSuggestions(true);
    try {
      const res = await fetch("/api/chat/suggestions", {
        method: "POST",
        body: JSON.stringify({ messages: currentMessages, userRole: role, notebookId: activeNotebookId }),
        headers: { "Content-Type": "application/json" }
      });
      if (res.ok) {
        const data = await res.json();
        setSuggestions(data.suggestions || []);
      }
    } catch (e) {
      console.error(e);
    }
    setIsFetchingSuggestions(false);
  };

  const generateView = async (view: 'guide' | 'mindmap' | 'audio' | 'notes') => {
    if (!activeNotebookId) return;
    setIsGenerating(true);
    setActiveView(view);
    setViewData(null);
    setActiveTopic(null);
    try {
      if (view === 'notes') {
        const res = await fetch(`/api/notebooks/${activeNotebookId}/notes`);
        if (res.ok) setViewData(await res.json());
      } else {
        const res = await fetch(`/api/notebooks/${activeNotebookId}/${view}`, {
          method: "POST",
          body: JSON.stringify({ userRole: role }),
          headers: { "Content-Type": "application/json" }
        });
        if (res.ok) {
          const data = await res.json();
          if (view === 'mindmap' || view === 'guide') {
            setViewData(data);
          } else {
            setViewData(data[view === 'audio' ? 'script' : view]);
          }
        }
      }
    } catch (e) {
      console.error(e);
    }
    setIsGenerating(false);
  };

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeNotebookId || !newNote.trim()) return;
    const res = await fetch(`/api/notebooks/${activeNotebookId}/notes`, {
      method: "POST",
      body: JSON.stringify({ content: newNote, userRole: role }),
      headers: { "Content-Type": "application/json" }
    });
    if (res.ok) {
      setNewNote("");
      generateView('notes'); // Refresh notes
    }
  };

  const fetchTopicContent = async (topic: any) => {
    if (!activeNotebookId) return;
    setActiveTopic(topic);
    setTopicContent(null);
    setIsFetchingTopic(true);
    try {
      const res = await fetch(`/api/notebooks/${activeNotebookId}/guide/topic`, {
        method: "POST",
        body: JSON.stringify({ userRole: role, topic: topic.title }),
        headers: { "Content-Type": "application/json" }
      });
      if (res.ok) {
        const data = await res.json();
        setTopicContent(data.content);
      }
    } catch (e) {
      console.error(e);
    }
    setIsFetchingTopic(false);
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
        <div className="p-5 font-semibold text-lg border-b border-gray-200 dark:border-white/5 flex items-center gap-3 shrink-0">
          <div className="bg-black dark:bg-white text-white dark:text-black p-1.5 rounded-lg shadow-sm">
            <Bot size={20} strokeWidth={2.5} />
          </div>
          Secure RAG
        </div>

        <div className="p-5 border-b border-gray-200 dark:border-white/5">
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wider">Act As (Role)</label>
          <div className="relative">
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="w-full bg-white dark:bg-[#1e1e20] border border-gray-200 dark:border-white/10 text-gray-900 dark:text-white rounded-xl p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white appearance-none shadow-sm transition-colors cursor-pointer"
            >
              <option value="ai">AI (Default Assistant)</option>
              <option value="intern">Intern</option>
              <option value="hr">HR</option>
              <option value="engineering">Engineering</option>
              <option value="exec">Executive</option>
              <option value="developer">Developer</option>
              <option value="designer">Designer</option>
              <option value="marketer">Marketer</option>
              <option value="data_scientist">Data Scientist</option>
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-gray-500">
              <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" /></svg>
            </div>
          </div>
        </div>

        <div className="p-5 border-b border-gray-200 dark:border-white/5 max-h-64 overflow-y-auto flex-shrink-0">
          <h3 className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-3 uppercase tracking-wider flex items-center gap-2">
            Workspaces
          </h3>
          <form onSubmit={handleCreateNotebook} className="flex gap-2 mb-4">
            <input
              value={newNotebookTitle}
              onChange={(e) => setNewNotebookTitle(e.target.value)}
              placeholder="New Workspace..."
              className="w-full bg-white dark:bg-[#1e1e20] border border-gray-200 dark:border-white/10 text-gray-900 dark:text-white rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white shadow-sm transition-colors placeholder:text-gray-400 dark:placeholder:text-gray-600"
            />
            <button type="submit" className="bg-black dark:bg-white text-white dark:text-black p-2 rounded-lg hover:bg-gray-800 dark:hover:bg-gray-200 transition-colors shadow-sm flex items-center justify-center shrink-0">
              <Plus size={18} />
            </button>
          </form>
          <div className="space-y-1">
            {notebooks.length === 0 && <div className="text-sm text-gray-500 dark:text-gray-500 px-2">No workspaces found.</div>}
            {notebooks.map(nb => (
              <div
                key={nb.id}
                onClick={() => setActiveNotebookId(nb.id)}
                className={`text-sm p-2.5 rounded-lg cursor-pointer truncate transition-all duration-200 font-medium ${activeNotebookId === nb.id ? 'bg-black text-white dark:bg-white dark:text-black shadow-md' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-white/5'}`}
              >
                {nb.title}
              </div>
            ))}
          </div>
        </div>

        {activeNotebookId && (
          <div className="p-5 border-b border-gray-200 dark:border-white/5 flex-shrink-0">
            <h3 className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-3 uppercase tracking-wider">Studio</h3>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => setActiveView('chat')} className={`p-2 text-xs rounded-lg font-medium transition-colors flex items-center gap-1.5 ${activeView === 'chat' ? 'bg-gray-200 dark:bg-white/10 text-black dark:text-white' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5'}`}>
                <MessageSquare size={14} /> Chat
              </button>
              <button onClick={() => generateView('guide')} className={`p-2 text-xs rounded-lg font-medium transition-colors flex items-center gap-1.5 ${activeView === 'guide' ? 'bg-gray-200 dark:bg-white/10 text-black dark:text-white' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5'}`}>
                <FileText size={14} /> Guide
              </button>
              <button onClick={() => generateView('mindmap')} className={`p-2 text-xs rounded-lg font-medium transition-colors flex items-center gap-1.5 ${activeView === 'mindmap' ? 'bg-gray-200 dark:bg-white/10 text-black dark:text-white' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5'}`}>
                <Map size={14} /> Mind Map
              </button>
              <button onClick={() => generateView('audio')} className={`p-2 text-xs rounded-lg font-medium transition-colors flex items-center gap-1.5 ${activeView === 'audio' ? 'bg-gray-200 dark:bg-white/10 text-black dark:text-white' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5'}`}>
                <Headphones size={14} /> Podcast
              </button>
              <button onClick={() => setActiveView('data')} className={`p-2 text-xs rounded-lg font-medium transition-colors flex items-center gap-1.5 ${activeView === 'data' ? 'bg-gray-200 dark:bg-white/10 text-black dark:text-white' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5'}`}>
                <Database size={14} /> Data
              </button>
              <button onClick={() => generateView('notes')} className={`col-span-2 p-2 text-xs rounded-lg font-medium transition-colors flex items-center gap-1.5 justify-center ${activeView === 'notes' ? 'bg-gray-200 dark:bg-white/10 text-black dark:text-white' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5'}`}>
                <AlignLeft size={14} /> Notes & Highlights
              </button>
            </div>
          </div>
        )}

        {/* Doc List & Upload */}
        {activeNotebookId && (
          <div className="flex-1 overflow-y-auto flex flex-col">
            <div className="p-5 border-b border-gray-200 dark:border-white/5">
              <h3 className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-3 uppercase tracking-wider flex items-center gap-2">
                Add Source
              </h3>
              <form onSubmit={handleUpload} className="space-y-3">
                <input
                  type="file"
                  onChange={e => setFile(e.target.files?.[0] || null)}
                  className="text-xs w-full text-gray-600 dark:text-gray-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-gray-100 file:text-gray-700 dark:file:bg-white/10 dark:file:text-gray-200 hover:file:bg-gray-200 dark:hover:file:bg-white/20 transition-colors"
                  required
                />
                <input
                  type="text"
                  value={allowedRoles}
                  onChange={e => setAllowedRoles(e.target.value)}
                  placeholder="Roles (comma separated)"
                  className="w-full bg-white dark:bg-[#1e1e20] border border-gray-200 dark:border-white/10 text-gray-900 dark:text-white rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white shadow-sm transition-colors placeholder:text-gray-400 dark:placeholder:text-gray-600"
                  required
                />
                <button
                  type="submit"
                  disabled={uploading || !file}
                  className="w-full bg-gray-900 hover:bg-black dark:bg-white dark:hover:bg-gray-200 disabled:opacity-50 text-white dark:text-black rounded-lg p-2 text-sm font-semibold transition-colors shadow-sm flex items-center justify-center gap-2"
                >
                  <Upload size={16} />
                  {uploading ? "Uploading..." : "Upload New & Link"}
                </button>
              </form>

              {allDocs.length > 0 && (
                <form onSubmit={handleLinkExisting} className="mt-4 pt-4 border-t border-gray-200 dark:border-white/5 space-y-3">
                  <select
                    value={selectedDocIdToLink}
                    onChange={(e) => setSelectedDocIdToLink(e.target.value)}
                    className="w-full bg-white dark:bg-[#1e1e20] border border-gray-200 dark:border-white/10 text-gray-900 dark:text-white rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white shadow-sm transition-colors"
                  >
                    <option value="" disabled>Select previously uploaded...</option>
                    {allDocs.map(d => (
                      <option key={d.id} value={d.id}>{d.title}</option>
                    ))}
                  </select>
                  <button
                    type="submit"
                    disabled={uploading || !selectedDocIdToLink}
                    className="w-full bg-gray-100 hover:bg-gray-200 dark:bg-white/10 dark:hover:bg-white/20 text-gray-900 dark:text-white disabled:opacity-50 rounded-lg p-2 text-sm font-semibold transition-colors shadow-sm flex items-center justify-center gap-2"
                  >
                    <Plus size={16} />
                    Link Existing Source
                  </button>
                </form>
              )}
            </div>
            <div className="p-5 flex-1">
              <h3 className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-3 uppercase tracking-wider flex items-center gap-2">
                Sources
              </h3>
              <div className="space-y-2">
                {docs.length === 0 && <div className="text-sm text-gray-500 dark:text-gray-500 px-1">No sources linked.</div>}
                {docs.map(d => (
                  <div key={d.id} className="text-sm p-3 bg-white dark:bg-[#1e1e20] rounded-xl border border-gray-200 dark:border-white/5 shadow-sm transition-colors">
                    <div className="font-medium truncate text-gray-900 dark:text-gray-100 flex items-center gap-2" title={d.title}>
                      <FileText size={14} className="text-gray-400 shrink-0" />
                      <span className="truncate">{d.title}</span>
                    </div>
                    <div className="text-gray-500 dark:text-gray-400 mt-1.5 text-xs flex gap-1 flex-wrap">
                      {d.allowed_roles?.map((r: string) => (
                        <span key={r} className="bg-gray-100 dark:bg-white/10 px-1.5 py-0.5 rounded-md">{r}</span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Main Content Area Container */}
      <div className="flex-1 flex overflow-hidden relative bg-white dark:bg-[#0a0a0c]">
        
        {/* Document Viewer (Left Split) */}
        {viewingDocument && (
          <div className="flex-1 flex flex-col relative border-r border-gray-200 dark:border-white/5 bg-gray-50 dark:bg-[#121214] animate-in slide-in-from-left-4 duration-300">
            <div className="absolute top-4 left-4 z-50">
              <button 
                onClick={() => setViewingDocument(null)} 
                className="p-2 px-3 bg-white dark:bg-[#1e1e20] text-gray-700 dark:text-gray-200 rounded-lg shadow-md border border-gray-200 dark:border-white/10 hover:bg-gray-50 flex items-center gap-2 text-xs font-bold transition-transform hover:scale-105"
              >
                &larr; Back to Data
              </button>
            </div>
            <DocumentViewer 
              url={viewingDocument.url} 
              onAskAI={(text) => {
                fetchRelatedTopics(messages, text);
                setInput(`Explain this from the document:\n"${text}"`);
                setActiveView('chat');
              }} 
            />
          </div>
        )}

        {/* Chat / Active View Area (Right Split or Full Width) */}
        <div className={`flex flex-col relative h-full transition-all duration-300 ${viewingDocument ? 'w-1/2 shrink-0 border-l border-gray-200 dark:border-white/5' : 'flex-1'}`}>
          <div className="flex-1 overflow-y-auto p-6 md:p-10 space-y-8 pb-48 scroll-smooth" onMouseUp={() => {
            const selection = window.getSelection();
            if (selection && selection.toString().trim().length > 0 && activeView === 'chat') {
              const text = selection.toString().trim();
              if (text.length > 3) {
                 // Trigger related web search using the selected text!
                 fetchRelatedTopics(messages, text);
              }
            }
          }}>
          {!activeNotebookId ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-400 space-y-6">
              <div className="w-24 h-24 bg-gray-50 dark:bg-white/5 rounded-full flex items-center justify-center shadow-inner border border-gray-100 dark:border-white/5">
                <Book size={48} className="text-gray-300 dark:text-gray-600" />
              </div>
              <p className="text-xl md:text-2xl font-medium text-gray-500 dark:text-gray-400 tracking-tight">Select a workspace to dive in.</p>
            </div>
          ) : activeView !== 'chat' ? (
            <div className="max-w-4xl mx-auto w-full fade-in">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl md:text-3xl font-bold capitalize text-gray-900 dark:text-white tracking-tight">
                  {activeView === 'audio' ? 'Podcast Script' : activeView}
                </h2>
              </div>
              <div className="bg-white dark:bg-[#121214] p-8 md:p-10 rounded-3xl shadow-sm border border-gray-200 dark:border-white/5 min-h-[400px] transition-colors">
                {isGenerating && !viewData ? (
                  <div className="flex flex-col items-center justify-center h-full text-gray-400 space-y-4 py-20">
                    <div className="w-12 h-12 border-4 border-gray-200 dark:border-white/10 border-t-black dark:border-t-white rounded-full animate-spin"></div>
                    <p className="font-medium animate-pulse text-gray-500 dark:text-gray-400">Crafting {activeView}...</p>
                  </div>
                ) : activeView === 'notes' ? (
                  <div>
                    <form onSubmit={handleAddNote} className="mb-8 flex gap-3 relative">
                      <input
                        value={newNote}
                        onChange={(e) => setNewNote(e.target.value)}
                        placeholder="Jot down a quick note..."
                        className="flex-1 bg-gray-50 dark:bg-[#1e1e20] border border-gray-200 dark:border-white/10 rounded-xl p-4 pl-5 text-sm focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white shadow-sm transition-colors text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500"
                      />
                      <button type="submit" disabled={!newNote.trim()} className="bg-black dark:bg-white text-white dark:text-black px-6 py-4 rounded-xl text-sm font-semibold hover:bg-gray-800 dark:hover:bg-gray-200 transition-colors shadow-sm disabled:opacity-50">Save</button>
                    </form>
                    <div className="space-y-4">
                      {Array.isArray(viewData) && viewData.map((note: any) => (
                        <div key={note.id} className="p-5 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700/30 rounded-2xl text-sm text-gray-800 dark:text-yellow-100/90 shadow-sm">
                          <p className="whitespace-pre-wrap text-[15px] leading-relaxed">{note.content}</p>
                          <div className="text-xs text-yellow-600/60 dark:text-yellow-500/50 mt-3 font-medium uppercase tracking-wider flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-yellow-400 dark:bg-yellow-600"></span>
                            {note.created_by_role} • {new Date(note.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </div>
                      ))}
                      {(!viewData || viewData.length === 0) && <div className="text-gray-400 dark:text-gray-500 text-sm text-center py-10 font-medium">No notes saved yet. Capture your thoughts above.</div>}
                    </div>
                  </div>
                ) : activeView === 'mindmap' ? (
                  <div className="relative w-full h-[650px] border border-gray-200 dark:border-white/5 rounded-2xl overflow-hidden bg-gray-50 dark:bg-[#1e1e20]">
                    <MindMapRenderer
                      data={viewData}
                      onNodeClick={(text) => {
                        setInput(`Can you explain this part of the mindmap: "${text}"?`);
                      }}
                    />
                  </div>
                ) : activeView === 'guide' ? (
                  <div className="space-y-6">
                    {activeTopic ? (
                      <div className="space-y-4">
                        <button onClick={() => setActiveTopic(null)} className="text-sm font-medium text-gray-500 dark:text-gray-400 flex items-center gap-1 hover:text-black dark:hover:text-white transition-colors">
                          &larr; Back to Topics
                        </button>
                        <h3 className="text-2xl font-bold">{activeTopic.title}</h3>
                        {isFetchingTopic ? (
                          <div className="flex items-center gap-3 text-gray-500 py-10">
                            <div className="w-5 h-5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"></div>
                            Generating deep-dive for {activeTopic.title}...
                          </div>
                        ) : (
                          <div className="prose prose-gray dark:prose-invert max-w-none prose-headings:tracking-tight prose-a:text-blue-600 dark:prose-a:text-blue-400 fade-in">
                            <ReactMarkdown
                              components={{
                                code({ node, inline, className, children, ...props }: any) {
                                  const match = /language-(\w+)/.exec(className || '')
                                  return !inline && match ? (
                                    <SyntaxHighlighter
                                      {...props}
                                      style={vscDarkPlus}
                                      language={match[1]}
                                      PreTag="div"
                                      className="rounded-lg text-sm my-4"
                                    >
                                      {String(children).replace(/\n$/, '')}
                                    </SyntaxHighlighter>
                                  ) : (
                                    <code {...props} className={className}>
                                      {children}
                                    </code>
                                  )
                                }
                              }}
                            >
                              {topicContent || ''}
                            </ReactMarkdown>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 fade-in">
                        {viewData?.topics?.map((topic: any) => (
                          <div
                            key={topic.id}
                            onClick={() => fetchTopicContent(topic)}
                            className="p-5 border border-gray-200 dark:border-white/10 rounded-2xl cursor-pointer hover:border-black dark:hover:border-white transition-colors group bg-white dark:bg-[#1e1e20] shadow-sm hover:shadow-md"
                          >
                            <h4 className="font-semibold text-gray-900 dark:text-white mb-2 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">{topic.title}</h4>
                            <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">{topic.briefDescription}</p>
                          </div>
                        ))}
                        {(!viewData?.topics || viewData.topics.length === 0) && (
                          <div className="col-span-full text-center py-10 text-gray-500 font-medium">No topics generated. Add more sources or check your role.</div>
                        )}
                      </div>
                    )}
                  </div>
                ) : activeView === 'data' ? (
                  <div className="space-y-4">
                    {docs.length === 0 ? (
                      <div className="text-gray-500 text-center py-10 font-medium">No sources linked to this workspace. Upload some first!</div>
                    ) : (
                      docs.map(doc => (
                        <div key={doc.id} className="p-5 border border-gray-200 dark:border-white/10 rounded-2xl bg-white dark:bg-[#1e1e20] shadow-sm flex flex-col gap-3">
                          <div className="flex justify-between items-start">
                            <h4 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                              <FileText size={16} className="text-gray-400" />
                              {doc.title}
                            </h4>
                            <span className="text-xs text-gray-400 font-mono">{new Date(doc.created_at).toLocaleDateString()}</span>
                          </div>

                          <div className="flex flex-wrap gap-2">
                            {doc.allowed_roles?.map((r: string) => (
                              <span key={r} className="bg-gray-100 dark:bg-white/10 text-gray-600 dark:text-gray-300 px-2 py-1 rounded-md text-xs font-medium">
                                {r}
                              </span>
                            ))}
                          </div>

                          <button
                            onClick={() => {
                              setViewingDocument({
                                url: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/documents/${doc.id}`,
                                title: doc.title
                              });
                            }}
                            className="inline-flex items-center gap-1.5 text-sm text-blue-600 dark:text-blue-400 hover:underline mt-2 w-fit"
                          >
                            <LinkIcon size={14} />
                            View Document
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                ) : (
                  <div className="prose prose-gray dark:prose-invert max-w-none prose-headings:tracking-tight prose-a:text-blue-600 dark:prose-a:text-blue-400">
                    <ReactMarkdown>{viewData || ''}</ReactMarkdown>
                  </div>
                )}
              </div>
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-400 space-y-6 max-w-xl mx-auto text-center">
              <div className="w-16 h-16 bg-transparent flex items-center justify-center">
                <Search size={40} className="text-gray-300 dark:text-gray-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">How can I help you today?</h2>
              <p className="text-gray-500 dark:text-gray-400 text-sm">
                I can summarize documents, answer questions, or help you brainstorm based on the sources in this workspace.
              </p>
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/10 text-xs text-gray-500 dark:text-gray-400">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span> Workspace active • Role: <span className="font-semibold text-gray-900 dark:text-white">{role}</span>
              </div>
            </div>
          ) : (
            <div className="max-w-3xl mx-auto space-y-8 pb-4">
              {messages.map((m) => {
                const rawText = m.parts?.map(p => p.type === 'text' ? p.text : '').join('') || '';
                const parsedText = rawText.replace(/\[Doc: ([0-9a-fA-F-]+), Chunk: ([0-9a-fA-F-]+)\]/g, '`citation:$1:$2`');

                return (
                  <div key={m.id} id={`msg-${m.id}`} className={`flex w-full transition-colors duration-500 p-2 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[85%] whitespace-pre-wrap leading-relaxed text-[15px] ${m.role === 'user' ? 'bg-gray-100 dark:bg-[#1e1e20] text-gray-900 dark:text-white px-6 py-4 rounded-3xl rounded-tr-sm' : 'bg-transparent text-gray-800 dark:text-gray-200 py-2'}`}>
                      {m.role === 'user' ? rawText : (
                        <div className="prose prose-sm dark:prose-invert max-w-none prose-p:leading-relaxed prose-pre:my-4">
                          <ReactMarkdown
                            components={{
                              code: ({ node, inline, className, children, ...props }: any) => {
                                const match = /citation:([0-9a-fA-F-]+):([0-9a-fA-F-]+)/.exec(String(children));
                                if (inline && match) {
                                  return (
                                    <span
                                      className="inline-flex items-center justify-center bg-gray-100 dark:bg-white/10 text-gray-900 dark:text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full cursor-help ml-1 hover:bg-gray-200 dark:hover:bg-white/20 transition-colors border border-gray-200 dark:border-white/10 align-super"
                                      title={`Doc: ${match[1]}\nChunk: ${match[2]}`}
                                    >
                                      {match[1].substring(0, 2)}
                                    </span>
                                  );
                                }
                                const langMatch = /language-(\w+)/.exec(className || '');
                                return !inline && langMatch ? (
                                  <SyntaxHighlighter
                                    {...props}
                                    style={vscDarkPlus}
                                    language={langMatch[1]}
                                    PreTag="div"
                                    className="rounded-xl text-[13px] my-4 shadow-sm border border-gray-200 dark:border-white/5"
                                  >
                                    {String(children).replace(/\n$/, '')}
                                  </SyntaxHighlighter>
                                ) : (
                                  <code className={`${className} bg-gray-100 dark:bg-white/10 px-1.5 py-0.5 rounded-md text-[13px]`} {...props}>{children}</code>
                                );
                              }
                            }}
                          >
                            {parsedText}
                          </ReactMarkdown>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
              {isLoading && (
                <div className="flex w-full justify-start p-2 fade-in">
                  <div className="py-2 text-gray-500 dark:text-gray-400 text-[15px] flex items-center gap-2">
                    <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-pulse"></div>
                    <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
                    <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }}></div>
                  </div>
                </div>
              )}
              <div ref={endOfMessagesRef} className="h-4"></div>
            </div>
          )}

          {/* Suggestions */}
          {!isLoading && suggestions.length > 0 && messages.length > 0 && messages[messages.length - 1].role === 'assistant' && activeView === 'chat' && (
            <div className="flex flex-wrap gap-2 max-w-3xl mx-auto mt-2 pl-14 fade-in">
              {suggestions.map((s, i) => (
                <button
                  key={i}
                  onClick={() => { setInput(s); }}
                  className="bg-white dark:bg-[#1e1e20] border border-gray-200 dark:border-white/10 text-gray-600 dark:text-gray-300 text-sm px-4 py-2 rounded-full shadow-sm hover:bg-gray-50 dark:hover:bg-white/10 transition-colors flex items-center gap-1.5 font-medium"
                >
                  <MessageSquare size={14} className="opacity-50" /> {s}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Input Area */}
        <div className="absolute bottom-0 left-0 right-0 p-6 md:px-10 pb-8 bg-gradient-to-t from-white via-white to-transparent dark:from-[#0a0a0c] dark:via-[#0a0a0c] dark:to-transparent pointer-events-none">
          <div className="max-w-3xl mx-auto relative pointer-events-auto">
            <form onSubmit={(e) => {
              e.preventDefault();
              if (!input.trim() || !activeNotebookId) return;
              if (activeView !== 'chat') setActiveView('chat');
              sendMessage({ text: input });
              setInput('');
            }} className="relative shadow-lg rounded-2xl group">
              <input
                className="w-full p-4 pl-5 pr-14 rounded-full border border-gray-200 dark:border-white/10 focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white focus:border-transparent bg-gray-50 dark:bg-[#1e1e20] text-gray-900 dark:text-white disabled:bg-gray-100 dark:disabled:bg-[#121214] disabled:text-gray-400 shadow-sm transition-shadow text-[15px]"
                value={input}
                disabled={!activeNotebookId}
                placeholder={activeNotebookId ? `Ask a question as ${role === 'ai' ? 'AI' : role}...` : "Select a workspace to start"}
                onChange={(e) => setInput(e.target.value)}
              />
              <button
                type="submit"
                disabled={isLoading || !input.trim() || !activeNotebookId}
                className="absolute right-2 top-2 bottom-2 w-10 bg-black dark:bg-white text-white dark:text-black rounded-full hover:bg-gray-800 dark:hover:bg-gray-200 disabled:opacity-50 disabled:hover:bg-black dark:disabled:hover:bg-white transition-all flex items-center justify-center shadow-sm"
              >
                <Send size={16} className={input.trim() && activeNotebookId ? 'translate-x-0.5' : ''} />
              </button>
            </form>
            <div className="text-center mt-3 text-xs font-medium text-gray-400 dark:text-gray-500 tracking-wide">
              Secure RAG enforces strict role-based access control based on your active role.
            </div>
          </div>
        </div>
      </div>
    </div>

      {/* Right Sidebar Toggle Button */}
      <button
        onClick={() => setIsRightSidebarOpen(!isRightSidebarOpen)}
        className={`absolute top-4 z-50 p-2 bg-white dark:bg-[#1e1e20] border border-gray-200 dark:border-white/10 rounded-lg shadow-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/5 transition-all duration-300 ${isRightSidebarOpen ? 'right-[335px]' : 'right-4'}`}
      >
        {isRightSidebarOpen ? <PanelRightClose size={20} /> : <PanelRightOpen size={20} />}
      </button>

      {/* Right Sidebar */}
      <div className={`transition-all duration-300 ease-in-out border-l bg-gray-50 dark:bg-[#121214] border-gray-200 dark:border-white/5 flex flex-col h-full shrink-0 relative z-40 shadow-[-4px_0_24px_rgba(0,0,0,0.02)] dark:shadow-[-4px_0_24px_rgba(0,0,0,0.2)] ${isRightSidebarOpen ? 'w-80 opacity-100 translate-x-0' : 'w-0 opacity-0 translate-x-full overflow-hidden border-l-0'}`}>
        
        {/* Top Half: Related Web Topics */}
        <div className="flex-1 overflow-y-auto p-5 flex flex-col">
          <h3 className="text-xs font-bold text-gray-500 dark:text-gray-400 mb-4 uppercase tracking-wider flex items-center gap-2">
            <Search size={14} /> Related Web Topics
          </h3>
          <div className="flex flex-col gap-2">
            {isSearching ? (
              <div className="text-sm text-gray-500 flex items-center gap-2">
                <div className="w-3 h-3 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"></div>
                Searching web...
              </div>
            ) : searchTopics.length > 0 ? (
              searchTopics.map((topic, i) => (
                <div key={i} className="text-sm p-3 bg-white dark:bg-[#1e1e20] rounded-xl border border-gray-200 dark:border-white/5 shadow-sm text-gray-800 dark:text-gray-200">
                  <div className="font-medium mb-1">{topic.query}</div>
                  <div className="text-xs text-gray-500">{topic.snippet}</div>
                  {topic.url && (
                    <a href={topic.url} target="_blank" rel="noreferrer" className="text-blue-500 hover:underline text-xs mt-2 inline-block">
                      Read more &rarr;
                    </a>
                  )}
                </div>
              ))
            ) : (
              <div className="text-sm text-gray-400 dark:text-gray-500 p-4 border border-dashed border-gray-200 dark:border-white/10 rounded-xl text-center">
                Select text in a document or chat to see related web topics inline.
              </div>
            )}
          </div>
        </div>

        {/* Bottom Half: Chat History / Quick Go */}
        <div className="flex-1 overflow-y-auto p-5 border-t border-gray-200 dark:border-white/5 flex flex-col">
          <h3 className="text-xs font-bold text-gray-500 dark:text-gray-400 mb-4 uppercase tracking-wider flex items-center gap-2">
            <MessageSquare size={14} /> Quick Go
          </h3>
          <div className="flex flex-col gap-1">
            {messages.filter(m => m.role === 'user').length === 0 ? (
              <div className="text-sm text-gray-400 dark:text-gray-500 text-center py-4">No questions yet in this session.</div>
            ) : (
              messages.filter(m => m.role === 'user').map(m => (
                <button 
                  key={m.id}
                  onClick={() => scrollToMessage(m.id)}
                  className="text-left text-sm truncate px-3 py-2 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-white/10 transition-colors"
                  title={m.parts?.map(p => p.type === 'text' ? p.text : '').join('') || ''}
                >
                  {m.parts?.map(p => p.type === 'text' ? p.text : '').join('') || ''}
                </button>
              ))
            )}
          </div>
        </div>

      </div>

    </div>


  );
}
