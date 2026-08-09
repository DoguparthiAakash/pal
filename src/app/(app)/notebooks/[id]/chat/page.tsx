'use client';
import { Suspense, useState, useRef, useMemo, useEffect } from 'react';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { Send, Search, Paperclip, History, X, MessageSquare, Loader2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { useParams, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { createBrowserClient } from '@/infrastructure/auth/client';

function ChatContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const activeNotebookId = params.id as string;
  const conversationId = searchParams.get('conversationId');
  const [role, setRole] = useState("intern");
  const [input, setInput] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState("");
  const endOfMessagesRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  useEffect(() => {
    if (activeNotebookId && conversationId) {
      const loadConversation = async (convId: string) => {
        try {
          const res = await fetch(`/api/notebooks/${activeNotebookId}/conversations/${convId}`);
          if (res.ok) {
            const pastMessages = await res.json();
            // convert to what useChat expects
            if (Array.isArray(pastMessages)) {
              const mapped = pastMessages.map((m: any) => ({
                id: m.id,
                role: m.role,
                parts: [{ type: 'text' as const, text: m.content }]
              }));
              setMessages(mapped);
            } else {
              console.error('Expected array of messages but got:', pastMessages);
            }
          }
        } catch (e) {
          console.error(e);
        }
      };
      loadConversation(conversationId);
    } else {
      setMessages([]);
    }
  }, [activeNotebookId, conversationId, setMessages]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeNotebookId) return;
    
    setUploading(true);
    setUploadStatus("Uploading file to secure storage...");
    
    try {
      const supabase = createBrowserClient();
      const { data: userData } = await supabase.auth.getUser();
      const user = userData?.user;

      const docId = crypto.randomUUID();
      const fileExt = file.name.split('.').pop() || 'bin';
      const filePath = `uploads/${user?.id || 'guest'}/${docId}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(filePath, file);

      if (uploadError) throw new Error(uploadError.message);

      setUploadStatus("Extracting and splitting text...");
      const extractRes = await fetch("/api/ingest/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          filePath,
          fileName: file.name,
          mimeType: file.type,
          size: file.size,
          notebookId: activeNotebookId
        })
      });

      if (!extractRes.ok) throw new Error(await extractRes.text());
      const extractData = await extractRes.json();
      const rawChunks: string[] = extractData.chunks;
      const serverDocId: string = extractData.docId;

      setUploadStatus("Generating AI embeddings in batches...");
      const allEmbeddings: number[][] = [];
      const BATCH_SIZE = 15;
      for (let i = 0; i < rawChunks.length; i += BATCH_SIZE) {
        setUploadStatus(`Embedding chunk batch ${Math.floor(i/BATCH_SIZE) + 1} of ${Math.ceil(rawChunks.length/BATCH_SIZE)}...`);
        const batch = rawChunks.slice(i, i + BATCH_SIZE);
        const embedRes = await fetch("/api/ingest/embed", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chunks: batch })
        });
        if (!embedRes.ok) throw new Error(await embedRes.text());
        const embedData = await embedRes.json();
        allEmbeddings.push(...embedData.embeddings);
      }

      setUploadStatus("Saving to Vector Database...");
      const storeRes = await fetch("/api/ingest/store", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          docId: serverDocId,
          notebookId: activeNotebookId,
          chunks: rawChunks,
          embeddings: allEmbeddings
        })
      });
      if (!storeRes.ok) throw new Error(await storeRes.text());
      const storeData = await storeRes.json();

      setUploadStatus("Updating Notebook...");
      await fetch(`/api/notebooks/${activeNotebookId}/documents`, {
        method: "POST",
        body: JSON.stringify({ document_id: storeData.document_id }),
        headers: { "Content-Type": "application/json" }
      });

      setUploadStatus("Generating AI Notes and Mindmap...");
      await fetch("/api/ingest/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          docId: serverDocId,
          notebookId: activeNotebookId,
          chunks: rawChunks
        })
      });
      
      window.dispatchEvent(new Event('refresh-docs'));
      
      // Add a system message locally
      setMessages([...messages, {
        id: crypto.randomUUID(),
        role: 'assistant',
        parts: [{ type: 'text', text: `✅ I have successfully uploaded and parsed \`${file.name}\`. It is now ready for questions!` }]
      }]);
      
    } catch (err: any) {
      alert("Upload failed: " + err.message);
    }
    
    setUploading(false);
    setUploadStatus("");
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="flex-1 flex flex-col h-full relative overflow-hidden">
      <div className="flex-1 overflow-y-auto p-6 md:p-10 space-y-8 pb-48 scroll-smooth w-full">
      {messages.length === 0 ? (
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="flex flex-col items-center justify-center h-full text-gray-400 space-y-6 max-w-xl mx-auto text-center"
        >
          <div className="w-16 h-16 bg-transparent flex items-center justify-center">
            <Search size={40} className="text-gray-300 dark:text-gray-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">How can I help you today?</h2>
          <p className="text-gray-500 dark:text-gray-400 text-sm">
            I can summarize documents, answer questions, or help you brainstorm based on the sources in this workspace.
          </p>
        </motion.div>
      ) : (
        <div className="max-w-3xl mx-auto space-y-8 pb-4">
          <AnimatePresence>
            {messages.map((m) => {
              const rawText = m.parts?.map((p: any) => p.type === 'text' ? p.text : '').join('') || '';
              const parsedText = rawText.replace(/\[Doc: ([0-9a-fA-F-]+), Chunk: ([0-9a-fA-F-]+)\]/g, '`citation:$1:$2`');

              return (
                <motion.div 
                  key={m.id} 
                  id={`msg-${m.id}`} 
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                  className={`flex w-full p-2 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
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
                </motion.div>
              );
            })}
          </AnimatePresence>
          {isLoading && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex w-full justify-start p-2"
            >
              <div className="py-2 text-gray-500 dark:text-gray-400 text-[15px] flex items-center gap-2">
                <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-pulse"></div>
                <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
                <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }}></div>
              </div>
            </motion.div>
          )}
          <div ref={endOfMessagesRef} className="h-4"></div>
        </div>
      )}
      </div>

      {/* Input Area */}
      <div className="absolute bottom-0 left-0 right-0 p-6 md:px-10 pb-8 bg-gradient-to-t from-white via-white to-transparent dark:from-[#0a0a0c] dark:via-[#0a0a0c] dark:to-transparent pointer-events-none z-10">
        <div className="max-w-3xl mx-auto relative pointer-events-auto flex items-end gap-3">
          <form onSubmit={(e) => {
            e.preventDefault();
            if (!input.trim() || !activeNotebookId || uploading) return;
            sendMessage({ text: input });
            setInput('');
          }} className="relative shadow-lg rounded-3xl group flex-1 bg-gray-50 dark:bg-[#1e1e20] border border-gray-200 dark:border-white/10 transition-shadow focus-within:ring-2 focus-within:ring-black dark:focus-within:ring-white focus-within:border-transparent flex items-center">
            
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="pl-4 pr-2 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors disabled:opacity-50"
              title="Attach File"
            >
              {uploading ? <Loader2 size={20} className="animate-spin" /> : <Paperclip size={20} />}
            </button>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              className="hidden"
              accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.md,.csv,image/*"
            />
            
            {uploadStatus && (
              <div className="absolute -top-8 left-4 text-xs text-blue-500 font-medium tracking-wide bg-blue-50 dark:bg-blue-900/20 px-2 py-1 rounded-md">
                {uploadStatus}
              </div>
            )}
            
            <input
              className="flex-1 py-4 pr-14 bg-transparent text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none text-[15px]"
              value={input}
              disabled={!activeNotebookId || uploading}
              placeholder={uploading ? "Uploading document..." : "Ask a question..."}
              onChange={(e) => setInput(e.target.value)}
            />
            
            <button
              type="submit"
              disabled={isLoading || !input.trim() || !activeNotebookId || uploading}
              className="absolute right-2 top-2 bottom-2 w-10 bg-black dark:bg-white text-white dark:text-black rounded-full hover:bg-gray-800 dark:hover:bg-gray-200 disabled:opacity-50 disabled:hover:bg-black dark:disabled:hover:bg-white transition-all flex items-center justify-center shadow-sm"
            >
              <Send size={16} className={input.trim() && activeNotebookId ? 'translate-x-0.5' : ''} />
            </button>
          </form>

        </div>
      </div>

      {/* Removed Floating History Button */}

    </div>
  );
}

export default function ChatPage() {
  return (
    <Suspense fallback={
      <div className="flex-1 flex items-center justify-center h-full">
        <Loader2 className="animate-spin text-gray-400" size={32} />
      </div>
    }>
      <ChatContent />
    </Suspense>
  );
}
