'use client';
import { useState, useRef, useEffect } from 'react';
import { Search, FileText, Loader2, Database, AlertCircle, ExternalLink, ChevronRight, Hash } from 'lucide-react';

interface SearchResult {
  id: string;
  content: string;
  similarity: number;
  document: {
    id: string;
    title: string;
    mime_type: string;
    created_at: string;
  } | null;
}

export default function SearchPage({ params }: { params: { id: string } }) {
  const notebookId = params.id;
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [error, setError] = useState('');
  
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    setHasSearched(true);
    setError('');

    try {
      const res = await fetch(`/api/search?notebookId=${notebookId}&q=${encodeURIComponent(query)}&limit=25`);
      const data = await res.json();
      
      if (!res.ok) throw new Error(data.error || 'Failed to search');
      
      setResults(data.results || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Basic highlighter to emphasize query words
  const highlightText = (text: string, q: string) => {
    if (!q.trim()) return text;
    const words = q.split(/\s+/).filter(w => w.length > 2);
    if (words.length === 0) return text;
    
    // Very simple regex for highlighting
    const regex = new RegExp(`(${words.join('|')})`, 'gi');
    const parts = text.split(regex);
    
    return (
      <>
        {parts.map((part, i) => 
          regex.test(part) ? (
            <span key={i} className="bg-yellow-200 dark:bg-yellow-900/40 text-gray-900 dark:text-yellow-100 font-medium rounded-sm px-0.5">
              {part}
            </span>
          ) : (
            <span key={i}>{part}</span>
          )
        )}
      </>
    );
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-gray-50 dark:bg-[#09090b] overflow-hidden">
      
      {/* ── Search Header ── */}
      <div className="shrink-0 bg-white dark:bg-[#16161a] border-b border-gray-200 dark:border-white/5 p-6 md:p-8">
        <div className="max-w-4xl mx-auto space-y-6">
          
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <Database size={12} /> Knowledge Base
            <ChevronRight size={12} />
            <Search size={12} className="text-indigo-500" />
            <span className="text-indigo-500 font-medium">Spotlight Search</span>
          </div>

          <form onSubmit={handleSearch} className="relative group">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <Search className={`h-5 w-5 transition-colors ${loading ? 'text-indigo-500' : 'text-gray-400 group-focus-within:text-indigo-500'}`} />
            </div>
            <input
              ref={inputRef}
              type="text"
              className="block w-full pl-12 pr-12 py-4 bg-gray-50 dark:bg-white/5 border-2 border-transparent focus:border-indigo-500 dark:focus:border-indigo-500 rounded-2xl text-lg text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 transition-all shadow-sm outline-none"
              placeholder="Search concepts, quotes, or topics..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
              <button 
                type="submit" 
                disabled={loading || !query.trim()}
                className="p-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl transition-colors disabled:opacity-50 disabled:hover:bg-indigo-600"
              >
                {loading ? <Loader2 size={18} className="animate-spin" /> : <ArrowRightIcon />}
              </button>
            </div>
          </form>
          
          <div className="flex gap-4 text-xs text-gray-500">
            <span className="flex items-center gap-1.5"><Hash size={14} className="text-indigo-400" /> Semantic search matching</span>
            <span className="flex items-center gap-1.5"><Database size={14} className="text-emerald-400" /> Cross-document retrieval</span>
          </div>
        </div>
      </div>

      {/* ── Search Results ── */}
      <div className="flex-1 overflow-y-auto p-6 md:p-8">
        <div className="max-w-4xl mx-auto space-y-4">
          
          {error && (
            <div className="p-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-xl flex items-start gap-3 border border-red-100 dark:border-red-900/30">
              <AlertCircle className="shrink-0 mt-0.5" size={18} />
              <p className="text-sm">{error}</p>
            </div>
          )}

          {!hasSearched && !loading && (
            <div className="flex flex-col items-center justify-center py-20 text-gray-400 dark:text-gray-500">
              <Search size={48} className="mb-4 opacity-20" />
              <p>Type a query to search across all your documents.</p>
            </div>
          )}

          {hasSearched && !loading && results.length === 0 && !error && (
            <div className="text-center py-12 text-gray-500">
              No results found for "<span className="text-gray-900 dark:text-white font-medium">{query}</span>"
            </div>
          )}

          {results.map((result, index) => (
            <div 
              key={result.id} 
              className="bg-white dark:bg-[#16161a] border border-gray-200 dark:border-white/5 rounded-2xl p-5 hover:border-indigo-300 dark:hover:border-indigo-700/50 transition-colors shadow-sm"
              style={{ animationDelay: `${index * 30}ms` }}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 flex items-center justify-center text-indigo-500 shrink-0">
                    <FileText size={16} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white text-sm line-clamp-1">
                      {result.document?.title || 'Unknown Document'}
                    </h3>
                    <p className="text-xs text-gray-500 flex items-center gap-2">
                      <span className="px-1.5 py-0.5 bg-gray-100 dark:bg-white/10 rounded uppercase text-[10px] tracking-wider">
                        {result.document?.mime_type?.split('/')[1] || 'TXT'}
                      </span>
                      <span>{Math.round(result.similarity * 100)}% match</span>
                    </p>
                  </div>
                </div>
                {/* Could add a button to view full document here later */}
                <button className="text-gray-400 hover:text-indigo-500 transition-colors p-1.5">
                  <ExternalLink size={16} />
                </button>
              </div>
              
              <div className="mt-4 text-sm text-gray-700 dark:text-gray-300 leading-relaxed bg-gray-50 dark:bg-white/3 p-4 rounded-xl border border-gray-100 dark:border-white/5 font-serif line-clamp-4">
                {highlightText(result.content, query)}
              </div>
            </div>
          ))}

        </div>
      </div>

    </div>
  );
}

function ArrowRightIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14"></path>
      <path d="m12 5 7 7-7 7"></path>
    </svg>
  );
}
