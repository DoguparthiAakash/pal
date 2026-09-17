'use client';

import { useState, useEffect } from 'react';
import { Presentation, Loader2, Download, Copy, CheckCircle, RefreshCcw } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

export default function BriefingPage({ params }: { params: Promise<{ id: string }> }) {
  const [notebookId, setNotebookId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [briefing, setBriefing] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    params.then(p => setNotebookId(p.id));
  }, [params]);

  const generateBriefing = async () => {
    if (!notebookId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/notebooks/${notebookId}/briefing`);
      if (!res.ok) throw new Error('Failed to generate briefing');
      const data = await res.json();
      setBriefing(data.briefing);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = () => {
    if (briefing) {
      navigator.clipboard.writeText(briefing);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const downloadMarkdown = () => {
    if (briefing) {
      const blob = new Blob([briefing], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `executive-briefing-${notebookId}.md`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50 dark:bg-[#0a0a0c]">
      <div className="max-w-4xl mx-auto p-8">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Presentation className="text-amber-500" /> Executive Briefing
            </h1>
            <p className="text-gray-500 dark:text-gray-400 mt-1">
              Generate a high-level summary and actionable insights from your workspace data.
            </p>
          </div>
          
          {briefing && (
            <div className="flex gap-2">
              <button
                onClick={generateBriefing}
                disabled={loading}
                className="p-2 bg-white dark:bg-[#1a1a1c] border border-gray-200 dark:border-white/10 rounded-lg hover:bg-gray-50 dark:hover:bg-white/5 transition-colors text-gray-600 dark:text-gray-300 disabled:opacity-50 flex items-center gap-2 text-sm"
                title="Regenerate"
              >
                {loading ? <Loader2 size={16} className="animate-spin" /> : <RefreshCcw size={16} />}
              </button>
              <button
                onClick={copyToClipboard}
                className="p-2 bg-white dark:bg-[#1a1a1c] border border-gray-200 dark:border-white/10 rounded-lg hover:bg-gray-50 dark:hover:bg-white/5 transition-colors text-gray-600 dark:text-gray-300 flex items-center gap-2 text-sm"
              >
                {copied ? <CheckCircle size={16} className="text-green-500" /> : <Copy size={16} />}
              </button>
              <button
                onClick={downloadMarkdown}
                className="p-2 bg-white dark:bg-[#1a1a1c] border border-gray-200 dark:border-white/10 rounded-lg hover:bg-gray-50 dark:hover:bg-white/5 transition-colors text-gray-600 dark:text-gray-300 flex items-center gap-2 text-sm"
              >
                <Download size={16} />
              </button>
            </div>
          )}
        </div>

        {!briefing && !loading && (
          <div className="flex flex-col items-center justify-center p-12 bg-white dark:bg-[#1a1a1c] rounded-2xl border border-gray-200 dark:border-white/10 shadow-sm text-center">
            <div className="w-16 h-16 bg-amber-100 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 rounded-2xl flex items-center justify-center mb-4">
              <Presentation size={32} />
            </div>
            <h2 className="text-xl font-semibold mb-2">Ready to Brief You</h2>
            <p className="text-gray-500 dark:text-gray-400 max-w-md mb-6">
              Click below to analyze all extracted knowledge in this workspace and generate a concise executive summary with key themes and actionable insights.
            </p>
            <button
              onClick={generateBriefing}
              className="px-6 py-3 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-medium transition-colors shadow-sm flex items-center gap-2"
            >
              Generate Briefing
            </button>
            {error && <p className="text-red-500 mt-4 text-sm">{error}</p>}
          </div>
        )}

        {loading && (
          <div className="flex flex-col items-center justify-center p-12 space-y-4">
            <Loader2 size={32} className="animate-spin text-amber-500" />
            <p className="text-gray-500 animate-pulse">Analyzing knowledge graph and generating briefing...</p>
          </div>
        )}

        {briefing && !loading && (
          <div className="bg-white dark:bg-[#1a1a1c] rounded-2xl border border-gray-200 dark:border-white/10 shadow-sm p-8 prose prose-slate dark:prose-invert max-w-none">
            <ReactMarkdown>
              {briefing}
            </ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  );
}
