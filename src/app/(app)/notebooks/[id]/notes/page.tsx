'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

export default function NotesPage() {
  const { id } = useParams();
  const [topics, setTopics] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeLink, setActiveLink] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/notebooks/${id}/notes`)
      .then(res => res.json())
      .then(data => {
        setTopics(data.topics || []);
        setLoading(false);
      });
  }, [id]);

  if (loading) return <div className="p-8 flex items-center justify-center h-full">Loading Notes...</div>;

  return (
    <div className="flex h-full w-full bg-white dark:bg-gray-900 overflow-hidden border border-gray-200 dark:border-gray-800 rounded-lg">
      
      {/* Left Column: Notes */}
      <div className="w-1/2 p-6 overflow-y-auto border-r border-gray-200 dark:border-gray-800">
        <h2 className="text-2xl font-semibold mb-6">Topic Notes</h2>
        {topics.length === 0 ? (
          <p className="text-gray-500">No notes generated yet.</p>
        ) : (
          <div className="space-y-8">
            {topics.map((t, idx) => (
              <div key={idx}>
                <h3 className="text-lg font-medium text-gray-800 dark:text-gray-200 mb-2">{t.topic}</h3>
                <ul className="list-disc pl-5 space-y-1 text-gray-600 dark:text-gray-400">
                  {t.points?.map((p: string, i: number) => (
                    <li key={i}>{p}</li>
                  ))}
                </ul>
                {t.links && t.links.length > 0 && (
                  <div className="mt-3">
                    <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">Related Links</h4>
                    <div className="space-y-2">
                      {t.links.map((link: any, i: number) => (
                        <button 
                          key={i} 
                          onClick={() => setActiveLink(link.url)}
                          className="block text-left text-sm text-blue-600 dark:text-blue-400 hover:underline w-full truncate"
                        >
                          {link.title || link.url}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Right Column: Webview for External Links */}
      <div className="w-1/2 flex flex-col bg-gray-50 dark:bg-gray-800/50">
        <div className="p-4 border-b border-gray-200 dark:border-gray-800 flex justify-between items-center">
          <h3 className="font-medium text-gray-700 dark:text-gray-300">External Source Viewer</h3>
          {activeLink && (
            <a href={activeLink} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-500 hover:underline">
              Open in New Tab
            </a>
          )}
        </div>
        <div className="flex-1 bg-white dark:bg-gray-900 relative">
          {activeLink ? (
            <iframe 
              src={activeLink} 
              className="absolute inset-0 w-full h-full border-0"
              sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
            />
          ) : (
            <div className="flex items-center justify-center h-full text-gray-400 text-sm">
              Click a related link to view it here. Note that some sites block iframe embedding.
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
