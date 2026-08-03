'use client';
import { useState, useRef, useMemo, useEffect } from 'react';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { Send, Search, Book, MessageSquare } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { useParams } from 'next/navigation';

export default function ChatPage() {
  const params = useParams();
  const activeNotebookId = params.id as string;
  const [role, setRole] = useState("intern");
  const [input, setInput] = useState("");
  const endOfMessagesRef = useRef<HTMLDivElement>(null);

  const transport = useMemo(() => new DefaultChatTransport({
    api: "/api/chat",
    body: { userRole: role, notebookId: activeNotebookId }
  }), [role, activeNotebookId]);

  const { messages, status, sendMessage, setMessages } = useChat({
    transport
  });

  const isLoading = status === 'submitted' || status === 'streaming';

  useEffect(() => {
    if (endOfMessagesRef.current) {
      endOfMessagesRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  return (
    <div className="flex-1 overflow-y-auto p-6 md:p-10 space-y-8 pb-48 scroll-smooth relative h-full">
      {messages.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-full text-gray-400 space-y-6 max-w-xl mx-auto text-center">
          <div className="w-16 h-16 bg-transparent flex items-center justify-center">
            <Search size={40} className="text-gray-300 dark:text-gray-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">How can I help you today?</h2>
          <p className="text-gray-500 dark:text-gray-400 text-sm">
            I can summarize documents, answer questions, or help you brainstorm based on the sources in this workspace.
          </p>
        </div>
      ) : (
        <div className="max-w-3xl mx-auto space-y-8 pb-4">
          {messages.map((m) => {
            const rawText = m.parts?.map((p: any) => p.type === 'text' ? p.text : '').join('') || '';
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

      {/* Input Area */}
      <div className="absolute bottom-0 left-0 right-0 p-6 md:px-10 pb-8 bg-gradient-to-t from-white via-white to-transparent dark:from-[#0a0a0c] dark:via-[#0a0a0c] dark:to-transparent pointer-events-none">
        <div className="max-w-3xl mx-auto relative pointer-events-auto">
          <form onSubmit={(e) => {
            e.preventDefault();
            if (!input.trim() || !activeNotebookId) return;
            sendMessage({ text: input });
            setInput('');
          }} className="relative shadow-lg rounded-2xl group">
            <input
              className="w-full p-4 pl-5 pr-14 rounded-full border border-gray-200 dark:border-white/10 focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white focus:border-transparent bg-gray-50 dark:bg-[#1e1e20] text-gray-900 dark:text-white disabled:bg-gray-100 dark:disabled:bg-[#121214] disabled:text-gray-400 shadow-sm transition-shadow text-[15px]"
              value={input}
              disabled={!activeNotebookId}
              placeholder="Ask a question..."
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
        </div>
      </div>
    </div>
  );
}
