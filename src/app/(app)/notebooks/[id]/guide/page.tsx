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

  if (loading) return <div className="p-8 flex items-center justify-center h-full">Generating Guide...</div>;

  return (
    <div className="flex h-full w-full bg-white dark:bg-gray-900 overflow-hidden border border-gray-200 dark:border-gray-800 rounded-lg">
      <div className="w-1/2 p-6 overflow-y-auto border-r border-gray-200 dark:border-gray-800" onMouseUp={handleTextSelection}>
        <h2 className="text-2xl font-semibold mb-6">Study Guide</h2>
        <div className="prose dark:prose-invert max-w-none">
          <ReactMarkdown>{guideText}</ReactMarkdown>
        </div>
        <p className="mt-8 text-sm text-gray-500 italic">Select any text in the guide to ask the AI for specific guidance.</p>
      </div>
      <div className="w-1/2 p-6 flex flex-col bg-gray-50 dark:bg-gray-800/50 overflow-hidden">
        <h3 className="text-lg font-medium mb-4 text-gray-700 dark:text-gray-300">Data Viewer</h3>
        <div className="flex-1 flex items-center justify-center bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
          <p className="text-gray-400 text-sm">Select a specific document to view its source data here.</p>
        </div>
      </div>
    </div>
  );
}
