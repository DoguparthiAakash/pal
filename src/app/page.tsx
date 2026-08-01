"use client";
import { useState, useEffect } from "react";
import { useChat } from "ai/react";
import { Bot, User, Upload, Send, FileText } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { supabase } from "@/lib/supabase";

export default function Home() {
  const [role, setRole] = useState("intern");
  const [file, setFile] = useState<File | null>(null);
  const [allowedRoles, setAllowedRoles] = useState("intern,hr,engineering,exec");
  const [uploading, setUploading] = useState(false);
  const [docs, setDocs] = useState<any[]>([]);

  const { messages, input, handleInputChange, handleSubmit, isLoading } = useChat({
    body: { userRole: role }
  });

  useEffect(() => {
    fetchDocs();
  }, []);

  const fetchDocs = async () => {
    const { data } = await supabase.from("documents").select("*").order("created_at", { ascending: false });
    if (data) setDocs(data);
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;
    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("allowed_roles", allowedRoles);
    
    try {
      const res = await fetch("/api/ingest", { method: "POST", body: formData });
      if (res.ok) {
        alert("Upload successful");
        fetchDocs();
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

  return (
    <div className="flex h-screen bg-gray-50 text-gray-900 font-sans">
      {/* Sidebar */}
      <div className="w-64 bg-gray-900 text-white flex flex-col">
        <div className="p-4 font-bold text-xl border-b border-gray-700 flex items-center gap-2">
          <Bot /> Secure RAG
        </div>
        
        {/* Role Switcher */}
        <div className="p-4 border-b border-gray-700">
          <label className="block text-sm text-gray-400 mb-1">Act As (Role):</label>
          <select 
            value={role} 
            onChange={(e) => setRole(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 text-white rounded p-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="intern">Intern</option>
            <option value="hr">HR</option>
            <option value="engineering">Engineering</option>
            <option value="exec">Executive</option>
          </select>
          <p className="text-xs text-gray-500 mt-2">Switching roles instantly restricts chunk retrieval visibility.</p>
        </div>

        {/* Upload Form */}
        <div className="p-4 border-b border-gray-700">
          <h3 className="text-sm font-semibold mb-2 flex items-center gap-2"><Upload size={16}/> Upload Doc</h3>
          <form onSubmit={handleUpload} className="space-y-2">
            <input 
              type="file" 
              onChange={e => setFile(e.target.files?.[0] || null)}
              className="text-xs w-full text-gray-300"
              required
            />
            <input 
              type="text" 
              value={allowedRoles}
              onChange={e => setAllowedRoles(e.target.value)}
              placeholder="Roles (comma separated)"
              className="w-full bg-gray-800 border border-gray-700 text-white rounded p-1 text-xs"
              required
            />
            <button 
              type="submit" 
              disabled={uploading || !file}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded p-1.5 text-xs font-semibold transition"
            >
              {uploading ? "Uploading..." : "Upload & Ingest"}
            </button>
          </form>
        </div>

        {/* Doc List */}
        <div className="flex-1 overflow-y-auto p-4">
          <h3 className="text-sm font-semibold mb-2 flex items-center gap-2"><FileText size={16}/> All Documents (Admin)</h3>
          <div className="space-y-2">
            {docs.map(d => (
              <div key={d.id} className="text-xs p-2 bg-gray-800 rounded border border-gray-700">
                <div className="font-semibold truncate text-gray-200" title={d.title}>{d.title}</div>
                <div className="text-gray-400 mt-1">ACL: {d.allowed_roles?.join(", ")}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col relative">
        <div className="flex-1 overflow-y-auto p-4 space-y-6 pb-32 pt-8">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-400 space-y-4">
              <Bot size={64} className="text-gray-300" />
              <p className="text-2xl font-medium text-gray-600">How can I help you today?</p>
              <p className="text-sm text-gray-500">Currently logged in as: <span className="font-semibold text-blue-600">{role}</span></p>
            </div>
          ) : (
            messages.map((m) => (
              <div key={m.id} className={`flex gap-4 max-w-3xl mx-auto ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {m.role !== 'user' && (
                  <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0 text-blue-600 mt-1">
                    <Bot size={18} />
                  </div>
                )}
                <div className={`p-4 rounded-2xl shadow-sm whitespace-pre-wrap leading-relaxed text-[15px] ${m.role === 'user' ? 'bg-blue-600 text-white ml-12 rounded-tr-sm' : 'bg-white border border-gray-200 mr-12 rounded-tl-sm'}`}>
                  {m.role === 'user' ? m.content : <ReactMarkdown className="prose prose-sm max-w-none">{m.content}</ReactMarkdown>}
                </div>
                {m.role === 'user' && (
                  <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0 text-gray-600 mt-1">
                    <User size={18} />
                  </div>
                )}
              </div>
            ))
          )}
          {isLoading && (
            <div className="flex gap-4 max-w-3xl mx-auto justify-start animate-pulse">
              <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0 text-blue-600 mt-1">
                <Bot size={18} />
              </div>
              <div className="p-4 rounded-2xl bg-white border border-gray-200 text-gray-400 rounded-tl-sm text-[15px]">
                Thinking...
              </div>
            </div>
          )}
        </div>

        {/* Input Area */}
        <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-white via-white to-transparent">
          <form onSubmit={handleSubmit} className="max-w-3xl mx-auto relative shadow-sm">
            <input
              className="w-full p-4 pr-14 rounded-2xl border border-gray-300 shadow-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white text-gray-800"
              value={input}
              placeholder={`Send a message as ${role}...`}
              onChange={handleInputChange}
            />
            <button
              type="submit"
              disabled={isLoading || !input.trim()}
              className="absolute right-2 top-2 bottom-2 w-10 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 transition flex items-center justify-center"
            >
              <Send size={18} />
            </button>
          </form>
          <div className="text-center mt-2 text-xs text-gray-400">
            Assistant uses vector search with strict role-based access control.
          </div>
        </div>
      </div>
    </div>
  );
}
