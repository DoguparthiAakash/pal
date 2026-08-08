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

  if (loading) return (
    <div className="flex h-full w-full items-center justify-center bg-[#FAFAFA] dark:bg-[#0A0A0A]">
      <div className="flex flex-col items-center gap-3">
        <div className="w-5 h-5 border-2 border-black/20 dark:border-white/20 border-t-black dark:border-t-white rounded-full animate-spin" />
        <span className="text-sm text-gray-500 dark:text-gray-400 font-medium tracking-tight">Loading Notes...</span>
      </div>
    </div>
  );

  return (
    <div className="flex h-full w-full bg-[#FAFAFA] dark:bg-[#0A0A0A] overflow-hidden rounded-xl border border-black/[0.08] dark:border-white/[0.08] shadow-sm">
      
      {/* Left Column: Notes */}
      <div className="w-1/2 p-8 overflow-y-auto border-r border-black/[0.08] dark:border-white/[0.08]">
        <h2 className="text-2xl font-semibold mb-8 tracking-tight text-gray-900 dark:text-gray-100">Topic Notes</h2>
        {topics.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <div className="w-12 h-12 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>
            <p className="text-sm text-gray-500 font-medium tracking-tight">No notes generated yet.</p>
          </div>
        ) : (
          <div className="space-y-10">
            {topics.map((t, idx) => (
              <div key={idx} className="group">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3 tracking-tight group-hover:text-blue-500 transition-colors">{t.topic}</h3>
                <ul className="space-y-2 mb-4">
                  {t.points?.map((p: string, i: number) => (
                    <li key={i} className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed flex items-start">
                      <span className="w-1.5 h-1.5 bg-gray-300 dark:bg-gray-600 rounded-full mt-2 mr-3 flex-shrink-0" />
                      <span>{p}</span>
                    </li>
                  ))}
                </ul>
                {t.links && t.links.length > 0 && (
                  <div className="mt-5 p-4 rounded-lg bg-white dark:bg-[#111111] border border-black/[0.04] dark:border-white/[0.04]">
                    <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3">Related Links</h4>
                    <div className="space-y-2">
                      {t.links.map((link: any, i: number) => (
                        <button 
                          key={i} 
                          onClick={() => setActiveLink(link.url)}
                          className="flex items-center gap-2 text-left text-sm text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors w-full"
                        >
                          <svg className="w-4 h-4 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                          </svg>
                          <span className="truncate flex-1">{link.title || link.url}</span>
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
      <div className="w-1/2 flex flex-col bg-white dark:bg-[#111111]">
        <div className="px-6 py-4 border-b border-black/[0.08] dark:border-white/[0.08] flex justify-between items-center bg-[#FAFAFA] dark:bg-[#0A0A0A]">
          <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 tracking-tight flex items-center gap-2">
            <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
            </svg>
            External Source Viewer
          </h3>
          {activeLink && (
            <a href={activeLink} target="_blank" rel="noopener noreferrer" className="text-xs font-medium text-blue-500 hover:text-blue-600 transition-colors flex items-center gap-1">
              Open in New Tab
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
          )}
        </div>
        <div className="flex-1 bg-[#FAFAFA] dark:bg-[#0A0A0A] relative">
          {activeLink ? (
            <iframe 
              src={activeLink} 
              className="absolute inset-0 w-full h-full border-0"
              sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
            />
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center p-8">
              <div className="w-12 h-12 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                </svg>
              </div>
              <p className="text-sm text-gray-500 font-medium tracking-tight">Click a related link to view it here.</p>
              <p className="text-xs text-gray-400 mt-2">Note: some sites block iframe embedding.</p>
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
