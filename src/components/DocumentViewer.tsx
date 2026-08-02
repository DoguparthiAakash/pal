'use client';
import React, { useState, useEffect, useRef } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { Search, Loader2 } from 'lucide-react';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

// Configure PDF worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface DocumentViewerProps {
  url: string;
  onAskAI: (text: string) => void;
}

export default function DocumentViewer({ url, onAskAI }: DocumentViewerProps) {
  const [numPages, setNumPages] = useState<number>();
  const [pageNumber, setPageNumber] = useState<number>(1);
  const [selectionMenu, setSelectionMenu] = useState<{ x: number, y: number, text: string } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const isPDF = url.toLowerCase().includes('.pdf') || url.includes('/documents/');

  useEffect(() => {
    const handleSelection = () => {
      const selection = window.getSelection();
      if (selection && selection.toString().trim().length > 0) {
        const range = selection.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        
        // Calculate position relative to container
        if (containerRef.current) {
          const containerRect = containerRef.current.getBoundingClientRect();
          setSelectionMenu({
            x: rect.left - containerRect.left + (rect.width / 2) - 40,
            y: rect.top - containerRect.top - 40,
            text: selection.toString().trim()
          });
        }
      } else {
        setSelectionMenu(null);
      }
    };

    document.addEventListener('selectionchange', handleSelection);
    return () => document.removeEventListener('selectionchange', handleSelection);
  }, []);

  function onDocumentLoadSuccess({ numPages }: { numPages: number }): void {
    setNumPages(numPages);
    setPageNumber(1);
  }

  return (
    <div ref={containerRef} className="w-full h-full relative flex flex-col bg-gray-50 dark:bg-[#121214] border-r border-gray-200 dark:border-white/5 overflow-hidden">
      {/* Floating Ask AI Button */}
      {selectionMenu && (
        <button
          onClick={() => {
            onAskAI(selectionMenu.text);
            setSelectionMenu(null);
            window.getSelection()?.removeAllRanges();
          }}
          className="absolute z-50 bg-black dark:bg-white text-white dark:text-black shadow-lg rounded-lg px-3 py-1.5 text-xs font-bold flex items-center gap-1 hover:scale-105 transition-transform cursor-pointer pointer-events-auto"
          style={{ top: selectionMenu.y, left: selectionMenu.x }}
          onMouseDown={(e) => e.preventDefault()} // Keep selection
        >
          <Search size={12} /> Ask AI
        </button>
      )}

      {isPDF ? (
        <div className="flex-1 overflow-y-auto p-4 flex justify-center items-start">
          <Document 
            file={url} 
            onLoadSuccess={onDocumentLoadSuccess}
            loading={
              <div className="flex flex-col items-center justify-center h-64 text-gray-500">
                <Loader2 className="animate-spin mb-2" size={24} />
                <p className="text-sm">Loading document...</p>
              </div>
            }
            error={
              <div className="flex flex-col items-center justify-center h-64 text-red-500">
                <p className="text-sm">Failed to load PDF.</p>
              </div>
            }
          >
            {Array.from(new Array(numPages), (el, index) => (
              <div key={`page_${index + 1}`} className="mb-4 shadow-sm border border-gray-200 dark:border-white/10 rounded-sm overflow-hidden bg-white">
                <Page 
                  pageNumber={index + 1} 
                  renderTextLayer={true}
                  renderAnnotationLayer={true}
                  width={Math.min(containerRef.current?.clientWidth ? containerRef.current.clientWidth - 40 : 800, 800)}
                />
              </div>
            ))}
          </Document>
        </div>
      ) : (
        <div className="flex-1 w-full h-full">
          <iframe src={url} className="w-full h-full border-none" title="Document Viewer" />
        </div>
      )}
    </div>
  );
}
