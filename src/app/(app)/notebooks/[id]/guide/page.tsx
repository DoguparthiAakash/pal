'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import ReactMarkdown from 'react-markdown';

export default function GuidePage() {
  const { id } = useParams();
  const router = useRouter();
  const [guideText, setGuideText] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/notebooks/${id}/guide`, { method: 'POST' })
      .then(res => res.json())
      .then(data => {
        setGuideText(data.guide || 'No guide available.');
        setLoading(false);
      });
  }, [id]);

  const handleTextSelection = () => {
    const selection = window.getSelection()?.toString();
    if (selection && selection.trim().length > 0) {
      router.push(`/notebooks/${id}?prompt=Explain this specifically: "${selection}"`);
    }
  };

  if (loading) return (
    <div className="flex h-full w-full items-center justify-center bg-[#FAFAFA] dark:bg-[#0A0A0A]">
      <div className="flex flex-col items-center gap-3">
        <div className="w-5 h-5 border-2 border-black/20 dark:border-white/20 border-t-black dark:border-t-white rounded-full animate-spin" />
        <span className="text-sm text-gray-500 dark:text-gray-400 font-medium tracking-tight">Generating Guide...</span>
      </div>
    </div>
  );

  return (
    <div className="flex h-full w-full bg-[#FAFAFA] dark:bg-[#0A0A0A] overflow-hidden rounded-xl border border-black/[0.08] dark:border-white/[0.08] shadow-sm">
      <div className="w-1/2 p-8 overflow-y-auto border-r border-black/[0.08] dark:border-white/[0.08]" onMouseUp={handleTextSelection}>
        <h2 className="text-2xl font-semibold mb-8 tracking-tight text-gray-900 dark:text-gray-100">Study Guide</h2>
        <div className="prose prose-sm dark:prose-invert max-w-none prose-p:leading-relaxed prose-headings:tracking-tight prose-a:text-blue-500">
          <ReactMarkdown>{guideText}</ReactMarkdown>
        </div>
        <div className="mt-10 p-4 bg-blue-50/50 dark:bg-blue-900/10 rounded-lg border border-blue-100/50 dark:border-blue-800/30">
          <p className="text-sm text-blue-600 dark:text-blue-400 font-medium">Select any text in the guide to ask the AI for specific guidance.</p>
        </div>
      </div>
      <div className="w-1/2 p-6 flex flex-col bg-white dark:bg-[#111111] overflow-hidden">
        <h3 className="text-sm font-medium mb-4 text-gray-900 dark:text-gray-100 tracking-tight flex items-center gap-2">
          <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          Data Viewer
        </h3>
        <div className="flex-1 flex items-center justify-center bg-[#FAFAFA] dark:bg-[#0A0A0A] rounded-lg border border-black/[0.08] dark:border-white/[0.08] overflow-hidden">
          <p className="text-gray-400 dark:text-gray-500 text-sm font-medium tracking-tight">Select a specific document to view its source data here.</p>
        </div>
      </div>
    </div>
  );
}
