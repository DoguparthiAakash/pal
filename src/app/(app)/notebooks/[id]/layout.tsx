'use client';
import { ReactNode, useState, useEffect } from 'react';
import { PanelRightClose, PanelRightOpen, MessageSquare, Search } from 'lucide-react';
import { useParams } from 'next/navigation';

export default function NotebookLayout({ children }: { children: ReactNode }) {
  const [isRightSidebarOpen, setIsRightSidebarOpen] = useState(true);
  const params = useParams();
  
  // Note: in a full implementation, messages/topics would be pulled from a Context or Store
  const messages: any[] = []; 
  const searchTopics: any[] = [];
  const isSearching = false;

  return (
    <>
      <div className="flex-1 flex overflow-hidden relative">
        {children}
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
                  className="text-left text-sm truncate px-3 py-2 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-white/10 transition-colors"
                  title={m.parts?.map((p: any) => p.type === 'text' ? p.text : '').join('') || ''}
                >
                  {m.parts?.map((p: any) => p.type === 'text' ? p.text : '').join('') || ''}
                </button>
              ))
            )}
          </div>
        </div>
      </div>
    </>
  );
}
