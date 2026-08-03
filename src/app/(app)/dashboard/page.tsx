'use client';
import { Book, Plus } from 'lucide-react';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function DashboardPage() {
  const [newNotebookTitle, setNewNotebookTitle] = useState("");
  const router = useRouter();

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
        const notebook = await res.json();
        router.push(`/notebooks/${notebook.id}/chat`);
      } else {
        alert("Failed to create workspace");
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 md:p-10 scroll-smooth">
      <div className="max-w-4xl mx-auto w-full fade-in">
        <h2 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white mb-8">Dashboard</h2>
        
        <div className="bg-white dark:bg-[#121214] p-8 md:p-10 rounded-3xl shadow-sm border border-gray-200 dark:border-white/5 transition-colors">
          <div className="flex flex-col items-center justify-center text-center space-y-6">
            <div className="w-24 h-24 bg-gray-50 dark:bg-white/5 rounded-full flex items-center justify-center shadow-inner border border-gray-100 dark:border-white/5">
              <Book size={48} className="text-gray-300 dark:text-gray-600" />
            </div>
            
            <h3 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">Create a New Workspace</h3>
            <p className="text-gray-500 dark:text-gray-400 max-w-md">
              A workspace (notebook) is an isolated environment where you can upload documents and securely chat with them.
            </p>

            <form onSubmit={handleCreateNotebook} className="flex gap-2 w-full max-w-md mt-4">
              <input
                value={newNotebookTitle}
                onChange={(e) => setNewNotebookTitle(e.target.value)}
                placeholder="Name your workspace..."
                className="flex-1 bg-gray-50 dark:bg-[#1e1e20] border border-gray-200 dark:border-white/10 text-gray-900 dark:text-white rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white shadow-sm transition-colors"
                required
              />
              <button type="submit" className="bg-black dark:bg-white text-white dark:text-black px-6 py-3 rounded-xl font-medium hover:bg-gray-800 dark:hover:bg-gray-200 transition-colors shadow-sm flex items-center justify-center gap-2">
                <Plus size={18} />
                Create
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
